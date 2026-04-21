// ═══════════════════════════════════════════════════════════
//  graph.js — Couche données Microsoft Graph / SharePoint
//  Remplace db.js (Supabase)
//  Tables SharePoint Lists : AF_AuditPlan, AF_Processes,
//    AF_Actions, AF_AuditData, AF_History, AF_Users
//  Documents : OneDrive/SharePoint /AuditFlow/<audit>/
// ═══════════════════════════════════════════════════════════

var DB = {
  users:     [],
  auditPlan: [],
  processes: [],
  actions:   [],
  auditData: {},
  history:   [],
};

// ── Token Microsoft Graph via MSAL ───────────────────────────
var _graphToken = null;
var _msalApp = null;

async function getMsalApp() {
  if (_msalApp) return _msalApp;
  if (!window.msal) {
    console.warn('[Graph] MSAL not loaded');
    return null;
  }
  _msalApp = new window.msal.PublicClientApplication({
    auth: {
      clientId: AUDITFLOW_CONFIG.clientId,
      authority: 'https://login.microsoftonline.com/' + AUDITFLOW_CONFIG.tenantId,
      redirectUri: AUDITFLOW_CONFIG.appUrl + '/',
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false,
    }
  });
  await _msalApp.initialize();
  try {
    await _msalApp.handleRedirectPromise();
  } catch(e) {
    console.warn('[MSAL] handleRedirectPromise:', e.message);
  }
  return _msalApp;
}

async function getGraphToken() {
  // Récupérer depuis sessionStorage si dispo
  if (!_graphToken) {
    try {
      var stored = sessionStorage.getItem('af_graph_token');
      if (stored) {
        var parsed = JSON.parse(stored);
        if (parsed && parsed.exp > Date.now() + 60000) {
          _graphToken = parsed;
        }
      }
    } catch(e) {}
  }

  if (_graphToken && _graphToken.exp > Date.now() + 60000) return _graphToken.token;

  try {
    var msalApp = await getMsalApp();
    if (!msalApp) throw new Error('MSAL not available');

    var accounts = msalApp.getAllAccounts();
    var account = accounts[0];

    if (!account) {
      // Tenter via popup MSAL (iframe ne fonctionne pas avec Azure SWA)
      try {
        var res = await fetch('/.auth/me');
        var data = await res.json();
        var email = data && data.clientPrincipal && data.clientPrincipal.userDetails;
        if (email) {
          var loginResp = await msalApp.acquireTokenPopup({
            loginHint: email,
            scopes: ['Sites.ReadWrite.All', 'Files.ReadWrite', 'User.Read'],
          });
          account = loginResp.account;
          _graphToken = {
            token: loginResp.accessToken,
            exp: loginResp.expiresOn ? loginResp.expiresOn.getTime() : Date.now() + 3500000,
          };
          sessionStorage.setItem('af_graph_token', JSON.stringify(_graphToken));
          console.log('[MSAL] Token Graph via popup ✓');
          return _graphToken.token;
        }
      } catch(e) {
        console.warn('[MSAL] Popup failed:', e.message);
      }
    }

    if (!account) throw new Error('No MSAL account found');

    var tokenResp = await msalApp.acquireTokenSilent({
      account: account,
      scopes: ['Sites.ReadWrite.All', 'Files.ReadWrite', 'User.Read'],
    });

    _graphToken = {
      token: tokenResp.accessToken,
      exp: tokenResp.expiresOn ? tokenResp.expiresOn.getTime() : Date.now() + 3500000,
    };
    sessionStorage.setItem('af_graph_token', JSON.stringify(_graphToken));
    console.log('[MSAL] Token Graph acquis silencieusement ✓');
    return _graphToken.token;

  } catch(e) {
    console.warn('[Graph] Token error:', e.message);
    return null;
  }
}

// ── Appel Graph API générique ────────────────────────────────
async function graphCall(method, url, body) {
  var token = await getGraphToken();
  var headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  var opts = { method: method, headers: headers };
  if (body) opts.body = JSON.stringify(body);

  var res = await fetch('https://graph.microsoft.com/v1.0' + url, opts);
  if (!res.ok) {
    var err = await res.text();
    console.error('[Graph]', method, url, res.status, err);
    throw new Error('Graph API error ' + res.status);
  }
  if (res.status === 204) return null;
  return await res.json();
}

// ── Récupérer l'ID du site SharePoint ───────────────────────
async function getSiteId() {
  if (AUDITFLOW_CONFIG.siteId) return AUDITFLOW_CONFIG.siteId;
  var u = new URL(AUDITFLOW_CONFIG.siteUrl);
  var hostname = u.hostname;
  var sitePath = u.pathname.replace(/^\//, '');
  var data = await graphCall('GET', '/sites/' + hostname + ':/' + sitePath);
  AUDITFLOW_CONFIG.siteId = data.id;
  return data.id;
}

// ── Récupérer l'ID du drive OneDrive du site ─────────────────
async function getDriveId() {
  if (AUDITFLOW_CONFIG.driveId) return AUDITFLOW_CONFIG.driveId;
  var siteId = await getSiteId();
  var data = await graphCall('GET', '/sites/' + siteId + '/drive');
  AUDITFLOW_CONFIG.driveId = data.id;
  return data.id;
}

// ── Récupérer l'ID d'une liste SharePoint par son nom ────────
var _listIds = {};
async function getListId(listName) {
  if (_listIds[listName]) return _listIds[listName];
  var siteId = await getSiteId();
  try {
    var data = await graphCall('GET', '/sites/' + siteId + '/lists/' + encodeURIComponent(listName));
    _listIds[listName] = data.id;
    return data.id;
  } catch(e) {
    console.log('[Graph] Création liste:', listName);
    await createList(siteId, listName);
    var data2 = await graphCall('GET', '/sites/' + siteId + '/lists/' + encodeURIComponent(listName));
    _listIds[listName] = data2.id;
    return data2.id;
  }
}

// ── Créer une liste SharePoint si elle n'existe pas ──────────
async function createList(siteId, listName) {
  var columns = LIST_SCHEMAS[listName] || [];
  await graphCall('POST', '/sites/' + siteId + '/lists', {
    displayName: listName,
    columns: columns,
    list: { template: 'genericList' }
  });
}

// Schémas des listes (colonnes SharePoint)
var LIST_SCHEMAS = {
  AF_AuditPlan: [
    {name:'af_id',text:{}},{name:'type',text:{}},{name:'titre',text:{}},
    {name:'annee',number:{}},{name:'statut',text:{}},{name:'auditeurs',text:{}},
    {name:'domaine',text:{}},{name:'process',text:{}},{name:'process_id',text:{}},
    {name:'entite',text:{}},{name:'region',text:{}},{name:'pays',text:{}},
    {name:'date_debut',text:{}},{name:'date_fin',text:{}},{name:'step_num',number:{}},
  ],
  AF_Processes: [
    {name:'af_id',text:{}},{name:'dom',text:{}},{name:'proc',text:{}},
    {name:'risk',number:{}},{name:'risk_level',text:{}},{name:'archived',boolean:{}},
    {name:'risks_json',text:{}},{name:'y25_json',text:{}},{name:'y26_json',text:{}},
    {name:'y27_json',text:{}},{name:'y28_json',text:{}},
  ],
  AF_Actions: [
    {name:'af_id',text:{}},{name:'title',text:{}},{name:'audit',text:{}},
    {name:'resp',text:{}},{name:'dept',text:{}},{name:'ent',text:{}},
    {name:'year',number:{}},{name:'quarter',text:{}},{name:'status',text:{}},
    {name:'pct',number:{}},{name:'from_finding',boolean:{}},{name:'finding_title',text:{}},
  ],
  AF_AuditData: [
    {name:'af_id',text:{}},{name:'tasks_json',text:{}},{name:'controls_json',text:{}},
    {name:'findings_json',text:{}},{name:'mgt_resp_json',text:{}},
    {name:'docs_json',text:{}},{name:'notes',text:{}},
    {name:'maturity_json',text:{}},{name:'risk_links_json',text:{}},
    {name:'audit_risks_json',text:{}},
  ],
  AF_History: [
    {name:'af_type',text:{}},{name:'msg',text:{}},{name:'user_name',text:{}},
  ],
  AF_Users: [
    {name:'af_id',text:{}},{name:'email',text:{}},{name:'name',text:{}},
    {name:'role',text:{}},{name:'initials',text:{}},{name:'status',text:{}},
    {name:'pwd',text:{}},{name:'source',text:{}},
  ],
};

// ── Lire tous les items d'une liste ─────────────────────────
async function listItems(listName, filter) {
  var siteId = await getSiteId();
  var listId = await getListId(listName);
  var url = '/sites/' + siteId + '/lists/' + listId + '/items?expand=fields&$top=999';
  if (filter) url += '&$filter=' + encodeURIComponent(filter);
  var data = await graphCall('GET', url);
  return (data && data.value) || [];
}

// ── Créer un item dans une liste ────────────────────────────
async function createItem(listName, fields) {
  var siteId = await getSiteId();
  var listId = await getListId(listName);
  var data = await graphCall('POST',
    '/sites/' + siteId + '/lists/' + listId + '/items',
    { fields: fields }
  );
  return data;
}

// ── Mettre à jour un item (par son ID SharePoint interne) ───
async function updateItem(listName, spItemId, fields) {
  var siteId = await getSiteId();
  var listId = await getListId(listName);
  await graphCall('PATCH',
    '/sites/' + siteId + '/lists/' + listId + '/items/' + spItemId + '/fields',
    fields
  );
}

// ── Supprimer un item ────────────────────────────────────────
async function deleteItem(listName, spItemId) {
  var siteId = await getSiteId();
  var listId = await getListId(listName);
  await graphCall('DELETE',
    '/sites/' + siteId + '/lists/' + listId + '/items/' + spItemId
  );
}

// ── Trouver l'ID SharePoint d'un item par son af_id ─────────
var _spIdCache = {};
async function findSpItemId(listName, afId) {
  var cacheKey = listName + '::' + afId;
  if (_spIdCache[cacheKey]) return _spIdCache[cacheKey];
  var items = await listItems(listName, "fields/af_id eq '" + afId + "'");
  if (items.length) {
    _spIdCache[cacheKey] = items[0].id;
    return items[0].id;
  }
  return null;
}

// ── Upsert générique (create ou update) ─────────────────────
async function spUpsert(listName, afId, fields) {
  try {
    var spId = await findSpItemId(listName, afId);
    if (spId) {
      await updateItem(listName, spId, fields);
    } else {
      var created = await createItem(listName, { af_id: afId, ...fields });
      _spIdCache[listName + '::' + afId] = created.id;
    }
    console.log('[SP] Saved', listName, afId);
  } catch(e) {
    console.error('[SP] Upsert error', listName, afId, e.message);
    if (typeof toast === 'function') toast('Erreur sauvegarde: ' + e.message);
  }
}

// ── Supprimer par af_id ──────────────────────────────────────
async function spDelete(listName, afId) {
  try {
    var spId = await findSpItemId(listName, afId);
    if (spId) {
      await deleteItem(listName, spId);
      delete _spIdCache[listName + '::' + afId];
    }
  } catch(e) {
    console.error('[SP] Delete error', listName, afId, e.message);
  }
}

// ════════════════════════════════════════════════════════════
//  CHARGEMENT DES DONNÉES (remplace loadAllData Supabase)
// ════════════════════════════════════════════════════════════
async function loadAllData() {
  try {
    var [usersRaw, planRaw, procRaw, actRaw, histRaw] = await Promise.all([
      listItems('AF_Users'),
      listItems('AF_AuditPlan'),
      listItems('AF_Processes'),
      listItems('AF_Actions'),
      listItems('AF_History'),
    ]);

    DB.users = usersRaw.map(function(r){ var f=r.fields; return {
      id: f.af_id, name: f.name||f.Title, email: f.email,
      role: f.role||'auditeur', initials: f.initials||'',
      status: f.status||'actif', pwd: f.pwd||'',
      source: f.source||'local',
    };});

    DB.auditPlan = planRaw.map(function(r){ var f=r.fields; return {
      id: f.af_id, type: f.type, titre: f.titre||f.Title,
      annee: parseInt(f.annee)||2026,
      statut: f.statut||'Planifié',
      auditeurs: tryParse(f.auditeurs, []),
      domaine: f.domaine, process: f.process, processId: f.process_id,
      entite: f.entite, region: f.region,
      pays: tryParse(f.pays, []),
      dateDebut: f.date_debut||'', dateFin: f.date_fin||'',
      step: f.step_num !== null && f.step_num !== undefined ? parseInt(f.step_num) : undefined,
    };});

    DB.processes = procRaw.map(function(r){ var f=r.fields; return {
      id: f.af_id, dom: f.dom, proc: f.proc||f.Title,
      risk: parseInt(f.risk)||1,
      riskLevel: f.risk_level||'faible',
      archived: f.archived||false,
      risks: tryParse(f.risks_json, []),
      y25: tryParse(f.y25_json, null), y26: tryParse(f.y26_json, null),
      y27: tryParse(f.y27_json, null), y28: tryParse(f.y28_json, null),
    };});

    DB.actions = actRaw.map(function(r){ var f=r.fields; return {
      id: f.af_id, title: f.title||f.Title, audit: f.audit,
      resp: f.resp, dept: f.dept, ent: f.ent,
      year: parseInt(f.year)||2026, quarter: f.quarter,
      status: f.status||'Non démarré', pct: parseInt(f.pct)||0,
      fromFinding: f.from_finding||false, findingTitle: f.finding_title||null,
    };});

    DB.history = histRaw.map(function(r){ var f=r.fields; return {
      type: f.af_type, msg: f.msg||f.Title, user: f.user_name,
      date: new Date(r.createdDateTime||Date.now()).toLocaleDateString('fr-FR',
        {day:'numeric',month:'short',year:'numeric'}),
    };});

    AUDIT_PLAN  = DB.auditPlan;
    PROCESSES   = DB.processes;
    ACTIONS     = DB.actions;
    HISTORY_LOG = DB.history;
    USERS       = DB.users;

    console.log('[SP] Data loaded — audits:', AUDIT_PLAN.length,
      'processes:', PROCESSES.length, 'actions:', ACTIONS.length);

  } catch(e) {
    console.warn('[SP] loadAllData error:', e.message);
  }
}

// ── Charger les données d'un audit ──────────────────────────
async function loadAuditData(auditId) {
  if (DB.auditData[auditId]) return DB.auditData[auditId];
  try {
    var items = await listItems('AF_AuditData', "fields/af_id eq '" + auditId + "'");
    if (items.length) {
      var f = items[0].fields;
      DB.auditData[auditId] = {
        tasks:      tryParse(f.tasks_json,      {}),
        controls:   tryParse(f.controls_json,   {}),
        findings:   tryParse(f.findings_json,   []),
        mgtResp:    tryParse(f.mgt_resp_json,   []),
        docs:       tryParse(f.docs_json,        []),
        notes:      f.notes||'',
        maturity:   tryParse(f.maturity_json,   null),
        riskLinks:  tryParse(f.risk_links_json, {}),
        auditRisks: tryParse(f.audit_risks_json,[]),
      };
    } else {
      DB.auditData[auditId] = {
        tasks:{}, controls:{}, findings:[], mgtResp:[],
        docs:[], notes:'', maturity:null, riskLinks:{}, auditRisks:[],
      };
    }
  } catch(e) {
    console.warn('[SP] loadAuditData error:', e.message);
    DB.auditData[auditId] = {
      tasks:{}, controls:{}, findings:[], mgtResp:[],
      docs:[], notes:'', maturity:null, riskLinks:{}, auditRisks:[],
    };
  }
  AUD_DATA[auditId] = DB.auditData[auditId];
  return DB.auditData[auditId];
}

// ── Sauvegarder les données d'un audit ──────────────────────
async function saveAuditData(auditId) {
  var d = AUD_DATA[auditId];
  if (!d) return;
  await spUpsert('AF_AuditData', auditId, {
    tasks_json:       JSON.stringify(d.tasks),
    controls_json:    JSON.stringify(d.controls),
    findings_json:    JSON.stringify(d.findings),
    mgt_resp_json:    JSON.stringify(d.mgtResp),
    docs_json:        JSON.stringify(d.docs),
    notes:            d.notes||'',
    maturity_json:    JSON.stringify(d.maturity),
    risk_links_json:  JSON.stringify(d.riskLinks||{}),
    audit_risks_json: JSON.stringify(d.auditRisks||[]),
    Title:            auditId,
  });
}

// ── Sauvegarder un audit ─────────────────────────────────────
async function saveAuditPlan(ap) {
  await spUpsert('AF_AuditPlan', ap.id, {
    type:       ap.type,
    titre:      ap.titre,
    annee:      ap.annee,
    statut:     ap.statut,
    auditeurs:  JSON.stringify(ap.auditeurs),
    domaine:    ap.domaine||'',
    process:    ap.process||'',
    process_id: ap.processId||'',
    entite:     ap.entite||'',
    region:     ap.region||'',
    pays:       JSON.stringify(ap.pays||[]),
    date_debut: ap.dateDebut||'',
    date_fin:   ap.dateFin||'',
    step_num:   ap.step !== undefined ? ap.step : null,
    Title:      ap.titre,
  });
}

// ── Sauvegarder une action ───────────────────────────────────
async function saveAction(ac) {
  await spUpsert('AF_Actions', ac.id, {
    title:         ac.title,
    audit:         ac.audit,
    resp:          ac.resp,
    dept:          ac.dept,
    ent:           ac.ent,
    year:          ac.year,
    quarter:       ac.quarter,
    status:        ac.status,
    pct:           ac.pct,
    from_finding:  ac.fromFinding||false,
    finding_title: ac.findingTitle||'',
    Title:         ac.title,
  });
}

// ── Historique ───────────────────────────────────────────────
async function addHistoryDB(type, msg, userName) {
  try {
    var siteId = await getSiteId();
    var listId = await getListId('AF_History');
    await graphCall('POST',
      '/sites/' + siteId + '/lists/' + listId + '/items',
      { fields: { af_type: type, msg: msg, user_name: userName, Title: msg.slice(0,100) } }
    );
  } catch(e) { console.warn('[SP] History error:', e.message); }
}

// ── Sauvegarder un utilisateur ──────────────────────────────
async function saveUser(user) {
  await spUpsert('AF_Users', user.id, {
    email:    user.email,
    name:     user.name,
    role:     user.role,
    initials: user.initials||'',
    status:   user.status||'actif',
    pwd:      user.pwd||'',
    source:   user.source||'local',
    Title:    user.name,
  });
}

// ── Upload document vers OneDrive ────────────────────────────
async function uploadDoc(auditId, file, stepIndex, userName) {
  var ap = AUDIT_PLAN.find(function(a){ return a.id === auditId; });
  var folderName = ap ? ap.titre.replace(/[^a-zA-Z0-9 _-]/g, '_') : auditId;
  var driveId = await getDriveId();

  var uploadPath = '/drives/' + driveId + '/root:/AuditFlow/' + folderName + '/' + file.name + ':/content';

  var token = await getGraphToken();
  var res = await fetch('https://graph.microsoft.com/v1.0' + uploadPath, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!res.ok) throw new Error('Upload failed: ' + res.status);
  var data = await res.json();

  var sizeTxt = file.size < 1024*1024
    ? Math.round(file.size/1024) + ' Ko'
    : (file.size/1024/1024).toFixed(1) + ' Mo';

  var docObj = {
    name:       file.name,
    size:       sizeTxt,
    url:        data.webUrl,
    driveId:    driveId,
    itemId:     data.id,
    uploadedBy: userName||'Inconnu',
    uploadedAt: new Date().toISOString(),
    step:       stepIndex !== undefined ? stepIndex : null,
  };

  var d = getAudData(auditId);
  d.docs.push(docObj);
  await saveAuditData(auditId);
  return docObj;
}

// ── Supprimer un document ────────────────────────────────────
async function deleteDoc(auditId, itemId, name) {
  if (!confirm('Supprimer "' + name + '" ?')) return;
  try {
    var driveId = await getDriveId();
    await graphCall('DELETE', '/drives/' + driveId + '/items/' + itemId);
  } catch(e) {
    console.warn('[SP] Delete doc error:', e.message);
  }
  var d = getAudData(auditId);
  d.docs = d.docs.filter(function(f){ return f.itemId !== itemId; });
  await saveAuditData(auditId);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast(name + ' supprimé ✓');
}

// ── Renommer / Remplacer doc ─────────────────────────────────
async function renameDocInDB(auditId, docIndex, newName) {
  var d = getAudData(auditId);
  if (!d.docs[docIndex]) return;
  d.docs[docIndex].name = newName;
  await saveAuditData(auditId);
}

async function replaceDocInDB(auditId, docIndex, file, stepIndex, userName) {
  var d = getAudData(auditId);
  var oldDoc = d.docs[docIndex];
  if (!oldDoc) return null;
  if (oldDoc.itemId) {
    try {
      var driveId = await getDriveId();
      await graphCall('DELETE', '/drives/' + driveId + '/items/' + oldDoc.itemId);
    } catch(e) {}
  }
  d.docs.splice(docIndex, 1);
  var newDoc = await uploadDoc(auditId, file, stepIndex, userName);
  return newDoc;
}

// ── Helper JSON parse sécurisé ───────────────────────────────
function tryParse(str, fallback) {
  if (!str) return fallback;
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch(e) { return fallback; }
}

// ══════════════════════════════════════════════════════════════
//  GESTION DES UTILISATEURS / ACCÈS
// ══════════════════════════════════════════════════════════════

async function loadAuthorizedUsers() {
  try {
    var items = await listItems('AF_Users');
    return items.map(function(r){ var f=r.fields; return {
      id: f.af_id||f.email, name: f.name||f.Title,
      email: f.email, role: f.role||'viewer',
      initials: f.initials||'', status: f.status||'actif',
      pwd: f.pwd||'', source: f.source||'sso',
    };});
  } catch(e) {
    console.warn('[SP] loadAuthorizedUsers error:', e.message);
    return USERS;
  }
}

async function inviteUser(email, name, role) {
  var id = 'usr_' + Date.now();
  var initials = name.split(' ').map(function(w){return w[0];}).join('').toUpperCase().slice(0,2);
  var user = { id, name, email, role, initials, status:'actif', source:'invited', pwd:'' };
  await saveUser(user);
  USERS.push(user);
  return user;
}

async function revokeUser(userId) {
  await spDelete('AF_Users', userId);
  USERS = USERS.filter(function(u){ return u.id !== userId; });
}

// ── Initialiser MSAL au chargement de la page ────────────────
document.addEventListener('DOMContentLoaded', async function() {
  try {
    await getMsalApp();
    console.log('[MSAL] App initialisée au chargement ✓');
    // Token obtenu dans launchApp() après auth utilisateur (popup requiert action user)
  } catch(e) {
    console.warn('[MSAL] Init error:', e.message);
  }
});
