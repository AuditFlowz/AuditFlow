// ═══════════════════════════════════════════════════════════
//  graph.js — Couche données Microsoft Graph / SharePoint
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
var _graphTokenPromise = null;

async function getMsalApp() {
  if (_msalApp) return _msalApp;
  if (!window.msal) { console.warn('[Graph] MSAL not loaded'); return null; }
  _msalApp = new window.msal.PublicClientApplication({
    auth: {
      clientId: AUDITFLOW_CONFIG.clientId,
      authority: 'https://login.microsoftonline.com/' + AUDITFLOW_CONFIG.tenantId,
      redirectUri: AUDITFLOW_CONFIG.appUrl + '/',
    },
    cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false }
  });
  await _msalApp.initialize();
  // handleRedirectPromise est appelé explicitement dans _doGetGraphToken
  return _msalApp;
}

var GRAPH_SCOPES = ['Sites.ReadWrite.All', 'Files.ReadWrite', 'User.Read'];
var _redirectCount = 0; // Compteur en mémoire (reset à chaque chargement)

// Stub pour compatibilité avec app.js (l'ancien nom)
async function handleGraphRedirect() {
  // La gestion de redirection est maintenant intégrée dans _doGetGraphToken
  return null;
}

async function getGraphToken() {
  // Récupérer depuis sessionStorage si dispo
  if (!_graphToken) {
    try {
      var stored = sessionStorage.getItem('af_graph_token');
      if (stored) {
        var parsed = JSON.parse(stored);
        if (parsed && parsed.exp > Date.now() + 60000) _graphToken = parsed;
      }
    } catch(e) {}
  }
  if (_graphToken && _graphToken.exp > Date.now() + 60000) return _graphToken.token;

  // Verrou : si une acquisition est déjà en cours, attendre
  if (_graphTokenPromise) return _graphTokenPromise;

  _graphTokenPromise = _doGetGraphToken().finally(function() { _graphTokenPromise = null; });
  return _graphTokenPromise;
}

async function _doGetGraphToken() {
  try {
    var msalApp = await getMsalApp();
    if (!msalApp) throw new Error('MSAL not available');

    // Capturer token si on revient d'une redirection MSAL (cas rare)
    try {
      var redirectResp = await msalApp.handleRedirectPromise();
      if (redirectResp && redirectResp.accessToken) {
        _graphToken = {
          token: redirectResp.accessToken,
          exp: redirectResp.expiresOn ? redirectResp.expiresOn.getTime() : Date.now() + 3500000,
        };
        sessionStorage.setItem('af_graph_token', JSON.stringify(_graphToken));
        console.log('[MSAL] Token via redirection ✓');
        return _graphToken.token;
      }
    } catch(e) {
      console.warn('[MSAL] handleRedirectPromise:', e.message);
    }

    // Récupérer l'email SSO pour loginHint
    var email = null;
    try {
      var res = await fetch('/.auth/me');
      var data = await res.json();
      if (data && data.clientPrincipal) email = data.clientPrincipal.userDetails;
    } catch(e) {}

    var accounts = msalApp.getAllAccounts();
    var account = accounts[0];

    // ÉTAPE 1 : Essai silencieux avec account en cache
    if (account) {
      try {
        var tokenResp = await msalApp.acquireTokenSilent({
          account: account,
          scopes: GRAPH_SCOPES,
        });
        _graphToken = {
          token: tokenResp.accessToken,
          exp: tokenResp.expiresOn ? tokenResp.expiresOn.getTime() : Date.now() + 3500000,
        };
        sessionStorage.setItem('af_graph_token', JSON.stringify(_graphToken));
        console.log('[MSAL] Token acquis silencieusement (cache) ✓');
        return _graphToken.token;
      } catch(e) {
        console.warn('[MSAL] acquireTokenSilent a échoué:', e.message);
      }
    }

    // ÉTAPE 2 : ssoSilent avec le loginHint (utilise les cookies Microsoft existants)
    // Cette étape marche en navigation normale quand l'utilisateur est connecté à Office/Teams
    if (email) {
      try {
        console.log('[MSAL] Tentative ssoSilent avec', email);
        var ssoResp = await msalApp.ssoSilent({
          loginHint: email,
          scopes: GRAPH_SCOPES,
        });
        _graphToken = {
          token: ssoResp.accessToken,
          exp: ssoResp.expiresOn ? ssoResp.expiresOn.getTime() : Date.now() + 3500000,
        };
        sessionStorage.setItem('af_graph_token', JSON.stringify(_graphToken));
        console.log('[MSAL] Token acquis via ssoSilent ✓');
        return _graphToken.token;
      } catch(e) {
        console.warn('[MSAL] ssoSilent a échoué:', e.message);
      }
    }

    // ÉTAPE 3 : Dernier recours - acquireTokenPopup (pas loginRedirect qui boucle)
    // On n'essaie cette étape qu'une seule fois par chargement de page
    if (_redirectCount >= 1) {
      throw new Error('Impossible d\'obtenir le token. Essayez de rafraîchir la page ou de vous reconnecter.');
    }
    _redirectCount++;

    console.log('[MSAL] Fallback : popup pour obtenir le token');
    var popupResp = await msalApp.acquireTokenPopup({
      loginHint: email || undefined,
      scopes: GRAPH_SCOPES,
    });
    _graphToken = {
      token: popupResp.accessToken,
      exp: popupResp.expiresOn ? popupResp.expiresOn.getTime() : Date.now() + 3500000,
    };
    sessionStorage.setItem('af_graph_token', JSON.stringify(_graphToken));
    console.log('[MSAL] Token acquis via popup ✓');
    return _graphToken.token;

  } catch(e) {
    console.error('[Graph] Token error:', e.message);
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
  var data = await graphCall('GET', '/sites/' + u.hostname + ':/' + u.pathname.replace(/^\//, ''));
  AUDITFLOW_CONFIG.siteId = data.id;
  return data.id;
}

async function getDriveId() {
  if (AUDITFLOW_CONFIG.driveId) return AUDITFLOW_CONFIG.driveId;
  var siteId = await getSiteId();
  var data = await graphCall('GET', '/sites/' + siteId + '/drive');
  AUDITFLOW_CONFIG.driveId = data.id;
  return data.id;
}

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

async function createList(siteId, listName) {
  var columns = LIST_SCHEMAS[listName] || [];
  await graphCall('POST', '/sites/' + siteId + '/lists', {
    displayName: listName, columns: columns, list: { template: 'genericList' }
  });
}

var LIST_SCHEMAS = {
  AF_AuditPlan: [
    {name:'af_id',text:{}},{name:'type',text:{}},{name:'titre',text:{}},
    {name:'annee',number:{}},{name:'statut',text:{}},{name:'auditeurs',text:{}},
    {name:'domaine',text:{}},{name:'process',text:{}},{name:'process_id',text:{}},
    {name:'process_ids_json',text:{}},
    {name:'entite',text:{}},{name:'region',text:{}},{name:'pays',text:{}},
    {name:'date_debut',text:{}},{name:'date_fin',text:{}},{name:'step_num',number:{}},
    {name:'categorie',text:{}},{name:'description',text:{}},
    {name:'product_line_ids_json',text:{}},{name:'pl_scope_enabled',text:{}},
  ],
  AF_Processes: [
    {name:'af_id',text:{}},{name:'dom',text:{}},{name:'proc',text:{}},
    {name:'risk',number:{}},{name:'risk_level',text:{}},{name:'archived',boolean:{}},
    {name:'risks_json',text:{}},{name:'y25_json',text:{}},{name:'y26_json',text:{}},
    {name:'y27_json',text:{}},{name:'y28_json',text:{}},
    {name:'risk_refs_json',text:{}},
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
    {name:'audit_risks_json',text:{}},{name:'step_states_json',text:{}},
    {name:'prep_notes_json',text:{}},{name:'rev_notes_json',text:{}},{name:'wcgw_json',text:{}},
  ],
  AF_History: [{name:'af_type',text:{}},{name:'msg',text:{}},{name:'user_name',text:{}}],
  AF_Users: [
    {name:'af_id',text:{}},{name:'email',text:{}},{name:'name',text:{}},
    {name:'role',text:{}},{name:'initials',text:{}},{name:'status',text:{}},
    {name:'pwd',text:{}},{name:'source',text:{}},
  ],
  AF_Structure: [
    {name:'af_id',text:{}},{name:'region',text:{}},{name:'country',text:{}},
    {name:'companies_json',text:{}},
  ],
  AF_RiskUniverse: [
    {name:'af_id',text:{}},{name:'level',text:{}},{name:'parent_id',text:{}},
    {name:'risk_title',text:{}},{name:'description',text:{}},
    {name:'probability',text:{}},{name:'impact',text:{}},
    {name:'impact_types_json',text:{}},
  ],
  AF_ProductLines: [
    {name:'af_id',text:{}},{name:'pl_name',text:{}},{name:'society',text:{}},
    {name:'countries_json',text:{}},{name:'description',text:{}},
  ],
  AF_Config: [
    {name:'af_id',text:{}},{name:'value_json',text:{}},
  ],
};

async function listItems(listName, filter) {
  var siteId = await getSiteId();
  var listId = await getListId(listName);
  var url = '/sites/' + siteId + '/lists/' + listId + '/items?expand=fields&$top=999';
  if (filter) url += '&$filter=' + encodeURIComponent(filter);
  var data = await graphCall('GET', url);
  return (data && data.value) || [];
}

async function createItem(listName, fields) {
  var siteId = await getSiteId();
  var listId = await getListId(listName);
  return await graphCall('POST', '/sites/' + siteId + '/lists/' + listId + '/items', { fields: fields });
}

async function updateItem(listName, spItemId, fields) {
  var siteId = await getSiteId();
  var listId = await getListId(listName);
  await graphCall('PATCH', '/sites/' + siteId + '/lists/' + listId + '/items/' + spItemId + '/fields', fields);
}

async function deleteItem(listName, spItemId) {
  var siteId = await getSiteId();
  var listId = await getListId(listName);
  await graphCall('DELETE', '/sites/' + siteId + '/lists/' + listId + '/items/' + spItemId);
}

var _spIdCache = {};
async function findSpItemId(listName, afId) {
  var cacheKey = listName + '::' + afId;
  if (_spIdCache[cacheKey]) return _spIdCache[cacheKey];
  var items = await listItems(listName, "fields/af_id eq '" + afId + "'");
  if (items.length) { _spIdCache[cacheKey] = items[0].id; return items[0].id; }
  return null;
}

async function spUpsert(listName, afId, fields) {
  // Blocage viewer : interdit toute modification
  if (typeof CU !== 'undefined' && CU && CU.role === 'viewer') {
    console.warn('[SP] Upsert bloqué — utilisateur en lecture seule');
    if (typeof toast === 'function') toast('Accès en lecture seule');
    return;
  }
  try {
    var spId = await findSpItemId(listName, afId);
    if (spId) {
      await updateItem(listName, spId, fields);
    } else {
      var created = await createItem(listName, Object.assign({ af_id: afId }, fields));
      _spIdCache[listName + '::' + afId] = created.id;
    }
    console.log('[SP] Saved', listName, afId);
  } catch(e) {
    console.error('[SP] Upsert error', listName, afId, e.message);
    if (typeof toast === 'function') toast('Erreur sauvegarde: ' + e.message);
  }
}

async function spDelete(listName, afId) {
  // Blocage viewer : interdit toute suppression
  if (typeof CU !== 'undefined' && CU && CU.role === 'viewer') {
    console.warn('[SP] Delete bloqué — utilisateur en lecture seule');
    if (typeof toast === 'function') toast('Accès en lecture seule');
    return;
  }
  try {
    var spId = await findSpItemId(listName, afId);
    if (spId) { await deleteItem(listName, spId); delete _spIdCache[listName + '::' + afId]; }
  } catch(e) { console.error('[SP] Delete error', listName, afId, e.message); }
}

// ════════════════════════════════════════════════════════════
//  CHARGEMENT DES DONNÉES
// ════════════════════════════════════════════════════════════
async function loadAllData() {
  try {
    var [usersRaw, planRaw, procRaw, actRaw, histRaw] = await Promise.all([
      listItems('AF_Users'), listItems('AF_AuditPlan'), listItems('AF_Processes'),
      listItems('AF_Actions'), listItems('AF_History'),
    ]);

    DB.users = usersRaw.map(function(r){ var f=r.fields; return {
      id:f.af_id, name:f.name||f.Title, email:f.email, role:f.role||'auditeur',
      initials:f.initials||'', status:f.status||'actif', pwd:f.pwd||'', source:f.source||'local',
    };});

    DB.auditPlan = planRaw.map(function(r){
      var f=r.fields;
      // Support multi-processus : priorité à process_ids_json (nouveau) sinon fallback sur process_id (ancien)
      var processIds = tryParse(f.process_ids_json, null);
      if (!Array.isArray(processIds) || !processIds.length) {
        // Migration auto : utilise process_id (ancien champ mono)
        processIds = f.process_id ? [f.process_id] : [];
      }
      return {
        id:f.af_id, type:f.type, titre:f.titre||f.Title, annee:parseInt(f.annee)||2026,
        statut:f.statut||'Planifié', auditeurs:tryParse(f.auditeurs,[]),
        domaine:f.domaine, process:f.process,
        processId:f.process_id,        // gardé pour compat affichage
        processIds: processIds,        // NOUVEAU — tableau d'IDs de processus
        entite:f.entite, region:f.region, pays:tryParse(f.pays,[]),
        dateDebut:f.date_debut||'', dateFin:f.date_fin||'',
        step:f.step_num!=null&&f.step_num!==undefined?parseInt(f.step_num):undefined,
        categorie:f.categorie||'',     // NOUVEAU — pour les missions "Other"
        description:f.description||'', // NOUVEAU — description libre
        productLineIds: tryParse(f.product_line_ids_json, []),
        plScopeEnabled: f.pl_scope_enabled === 'true' || f.pl_scope_enabled === true,
      };
    });

    DB.processes = procRaw.map(function(r){ var f=r.fields; return {
      id:f.af_id, dom:f.dom, proc:f.proc||f.Title, risk:parseInt(f.risk)||1,
      riskLevel:f.risk_level||'faible', archived:f.archived||false,
      risks:tryParse(f.risks_json,[]),
      riskRefs: tryParse(f.risk_refs_json, []), // NOUVEAU — IDs de risques du Risk Universe
      y25:tryParse(f.y25_json,null), y26:tryParse(f.y26_json,null),
      y27:tryParse(f.y27_json,null), y28:tryParse(f.y28_json,null),
    };});
    // DEBUG : afficher le nombre de process qui ont des riskRefs
    var withRefs = DB.processes.filter(function(p){return p.riskRefs && p.riskRefs.length;});
    console.log('[SP] Processes avec riskRefs:', withRefs.length, '/', DB.processes.length);
    if (withRefs.length) {
      withRefs.forEach(function(p){console.log('  •', p.proc, '→', p.riskRefs.length, 'risque(s):', p.riskRefs);});
    }

    DB.actions = actRaw.map(function(r){ var f=r.fields; return {
      id:f.af_id, title:f.title||f.Title, audit:f.audit, resp:f.resp, dept:f.dept, ent:f.ent,
      year:parseInt(f.year)||2026, quarter:f.quarter, status:f.status||'Non démarré',
      pct:parseInt(f.pct)||0, fromFinding:f.from_finding||false, findingTitle:f.finding_title||null,
    };});

    DB.history = histRaw.map(function(r){ var f=r.fields; return {
      type:f.af_type, msg:f.msg||f.Title, user:f.user_name,
      date:new Date(r.createdDateTime||Date.now()).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}),
    };});

    AUDIT_PLAN=DB.auditPlan; PROCESSES=DB.processes; ACTIONS=DB.actions;
    HISTORY_LOG=DB.history; USERS=DB.users;

    // ── Charger les nouvelles listes (Structure / RiskUniverse / ProductLines) ──
    // Si une liste n'existe pas, on ne bloque pas le chargement des autres
    try {
      var structRaw = await listItems('AF_Structure');
      GROUP_STRUCTURE = structRaw.map(function(r){
        var f = r.fields;
        return {
          id: f.af_id, region: f.region || '', country: f.country || '',
          companies: tryParse(f.companies_json, []),
        };
      });
      console.log('[SP] Structure loaded:', GROUP_STRUCTURE.length, 'countries');
    } catch(e){ console.warn('[SP] AF_Structure not found or empty:', e.message); GROUP_STRUCTURE = []; }

    try {
      var riskRaw = await listItems('AF_RiskUniverse');
      RISK_UNIVERSE = riskRaw.map(function(r){
        var f = r.fields;
        return {
          id: f.af_id, level: f.level || 'group',
          parentId: f.parent_id || '',
          title: f.risk_title || f.title || f.Title || '',
          description: f.description || '',
          probability: f.probability || '',
          impact: f.impact || '',
          impactTypes: tryParse(f.impact_types_json, []),
        };
      });
      console.log('[SP] RiskUniverse loaded:', RISK_UNIVERSE.length, 'risks');
    } catch(e){ console.warn('[SP] AF_RiskUniverse not found or empty:', e.message); RISK_UNIVERSE = []; }

    try {
      var plRaw = await listItems('AF_ProductLines');
      PRODUCT_LINES = plRaw.map(function(r){
        var f = r.fields;
        return {
          id: f.af_id, name: f.pl_name || f.name || f.Title || '',
          society: f.society || '',
          countries: tryParse(f.countries_json, []),
          description: f.description || '',
        };
      });
      console.log('[SP] ProductLines loaded:', PRODUCT_LINES.length, 'PLs');
    } catch(e){ console.warn('[SP] AF_ProductLines not found or empty:', e.message); PRODUCT_LINES = []; }

    // Synchroniser TM et AVC avec les utilisateurs SharePoint
    syncTeamMembers();

    console.log('[SP] Data loaded — audits:',AUDIT_PLAN.length,'processes:',PROCESSES.length,'actions:',ACTIONS.length);
  } catch(e) { console.warn('[SP] loadAllData error:', e.message); }
}

async function loadAuditData(auditId) {
  if (DB.auditData[auditId]) return DB.auditData[auditId];
  try {
    var items = await listItems('AF_AuditData', "fields/af_id eq '" + auditId + "'");
    if (items.length) {
      var f = items[0].fields;
      DB.auditData[auditId] = {
        tasks:tryParse(f.tasks_json,{}), controls:tryParse(f.controls_json,{}),
        findings:tryParse(f.findings_json,[]), mgtResp:tryParse(f.mgt_resp_json,[]),
        docs:tryParse(f.docs_json,[]), notes:f.notes||'',
        maturity:tryParse(f.maturity_json,null), riskLinks:tryParse(f.risk_links_json,{}),
        auditRisks:tryParse(f.audit_risks_json,[]),
        stepStates:tryParse(f.step_states_json,{}),
        prepNotes:tryParse(f.prep_notes_json,{}),
        revNotes:tryParse(f.rev_notes_json,{}),
        wcgw:tryParse(f.wcgw_json,{}),
      };
    } else {
      DB.auditData[auditId] = {tasks:{},controls:{},findings:[],mgtResp:[],docs:[],notes:'',maturity:null,riskLinks:{},auditRisks:[],stepStates:{},prepNotes:{},revNotes:{},wcgw:{}};
    }
  } catch(e) {
    console.warn('[SP] loadAuditData error:', e.message);
    DB.auditData[auditId] = {tasks:{},controls:{},findings:[],mgtResp:[],docs:[],notes:'',maturity:null,riskLinks:{},auditRisks:[],stepStates:{},prepNotes:{},revNotes:{},wcgw:{}};
  }
  AUD_DATA[auditId] = DB.auditData[auditId];
  return DB.auditData[auditId];
}

async function saveAuditData(auditId) {
  var d = AUD_DATA[auditId];
  if (!d) return;
  await spUpsert('AF_AuditData', auditId, {
    tasks_json:JSON.stringify(d.tasks), controls_json:JSON.stringify(d.controls),
    findings_json:JSON.stringify(d.findings), mgt_resp_json:JSON.stringify(d.mgtResp),
    docs_json:JSON.stringify(d.docs), notes:d.notes||'',
    maturity_json:JSON.stringify(d.maturity), risk_links_json:JSON.stringify(d.riskLinks||{}),
    audit_risks_json:JSON.stringify(d.auditRisks||[]),
    step_states_json:JSON.stringify(d.stepStates||{}),
    prep_notes_json:JSON.stringify(d.prepNotes||{}),
    rev_notes_json:JSON.stringify(d.revNotes||{}),
    wcgw_json:JSON.stringify(d.wcgw||{}),
    Title:auditId,
  });
}

async function saveAuditPlan(ap) {
  // Assurer cohérence : si processIds existe, on en déduit processId (le premier) pour compat
  if (Array.isArray(ap.processIds) && ap.processIds.length) {
    ap.processId = ap.processIds[0];
    // Reconstruire le libellé "process" (liste des noms joints)
    var procNames = ap.processIds.map(function(pid){
      var p = PROCESSES.find(function(x){return x.id===pid;});
      return p ? p.proc : pid;
    });
    ap.process = procNames.join(', ');
  }
  await spUpsert('AF_AuditPlan', ap.id, {
    type:ap.type, titre:ap.titre, annee:ap.annee, statut:ap.statut,
    auditeurs:JSON.stringify(ap.auditeurs), domaine:ap.domaine||'',
    process:ap.process||'', process_id:ap.processId||'',
    process_ids_json: JSON.stringify(ap.processIds||[]),
    entite:ap.entite||'',
    region:ap.region||'', pays:JSON.stringify(ap.pays||[]),
    date_debut:ap.dateDebut||'', date_fin:ap.dateFin||'',
    step_num:ap.step!==undefined?ap.step:null, Title:ap.titre,
    categorie:ap.categorie||'', description:ap.description||'',
    product_line_ids_json: JSON.stringify(ap.productLineIds||[]),
    pl_scope_enabled: ap.plScopeEnabled ? 'true' : 'false',
  });
}

async function saveAction(ac) {
  await spUpsert('AF_Actions', ac.id, {
    title:ac.title, audit:ac.audit, resp:ac.resp, dept:ac.dept, ent:ac.ent,
    year:ac.year, quarter:ac.quarter, status:ac.status, pct:ac.pct,
    from_finding:ac.fromFinding||false, finding_title:ac.findingTitle||'', Title:ac.title,
  });
}

async function addHistoryDB(type, msg, userName) {
  try {
    var siteId = await getSiteId();
    var listId = await getListId('AF_History');
    await graphCall('POST', '/sites/'+siteId+'/lists/'+listId+'/items',
      {fields:{af_type:type,msg:msg,user_name:userName,Title:msg.slice(0,100)}});
  } catch(e) { console.warn('[SP] History error:', e.message); }
}

async function saveUser(user) {
  await spUpsert('AF_Users', user.id, {
    email:user.email, name:user.name, role:user.role, initials:user.initials||'',
    status:user.status||'actif', pwd:user.pwd||'', source:user.source||'local', Title:user.name,
  });
}

async function uploadDoc(auditId, file, stepIndex, userName) {
  // Blocage viewer
  if (typeof CU !== 'undefined' && CU && CU.role === 'viewer') {
    if (typeof toast === 'function') toast('Accès en lecture seule');
    return null;
  }
  var ap = AUDIT_PLAN.find(function(a){ return a.id===auditId; });
  var folderName = ap ? ap.titre.replace(/[^a-zA-Z0-9 _-]/g,'_') : auditId;
  var driveId = await getDriveId();
  var uploadPath = '/drives/'+driveId+'/root:/AuditFlow/'+folderName+'/'+file.name+':/content';
  var token = await getGraphToken();
  var res = await fetch('https://graph.microsoft.com/v1.0'+uploadPath, {
    method:'PUT',
    headers:{'Authorization':'Bearer '+token,'Content-Type':file.type||'application/octet-stream'},
    body:file,
  });
  if (!res.ok) throw new Error('Upload failed: '+res.status);
  var data = await res.json();
  var sizeTxt = file.size<1024*1024 ? Math.round(file.size/1024)+' Ko' : (file.size/1024/1024).toFixed(1)+' Mo';
  var docObj = {
    name:file.name, size:sizeTxt, url:data.webUrl, driveId:driveId, itemId:data.id,
    uploadedBy:userName||'Inconnu', uploadedAt:new Date().toISOString(),
    step:stepIndex!==undefined?stepIndex:null,
  };
  var d = getAudData(auditId);
  d.docs.push(docObj);
  await saveAuditData(auditId);
  return docObj;
}

async function deleteDoc(auditId, itemId, name) {
  if (!confirm('Supprimer "'+name+'" ?')) return;
  try {
    var driveId = await getDriveId();
    await graphCall('DELETE', '/drives/'+driveId+'/items/'+itemId);
  } catch(e) { console.warn('[SP] Delete doc error:', e.message); }
  var d = getAudData(auditId);
  d.docs = d.docs.filter(function(f){ return f.itemId!==itemId; });
  await saveAuditData(auditId);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast(name+' supprimé ✓');
}

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
    try { var driveId = await getDriveId(); await graphCall('DELETE','/drives/'+driveId+'/items/'+oldDoc.itemId); } catch(e) {}
  }
  d.docs.splice(docIndex,1);
  return await uploadDoc(auditId, file, stepIndex, userName);
}

function tryParse(str, fallback) {
  if (!str) return fallback;
  if (typeof str==='object') return str;
  try { return JSON.parse(str); } catch(e) { return fallback; }
}

async function loadAuthorizedUsers() {
  try {
    var items = await listItems('AF_Users');
    return items.map(function(r){ var f=r.fields; return {
      id:f.af_id||f.email, name:f.name||f.Title, email:f.email, role:f.role||'viewer',
      initials:f.initials||'', status:f.status||'actif', pwd:f.pwd||'', source:f.source||'sso',
    };});
  } catch(e) { console.warn('[SP] loadAuthorizedUsers error:', e.message); return USERS; }
}

async function inviteUser(email, name, role) {
  var id = 'usr_'+Date.now();
  var initials = name.split(' ').map(function(w){return w[0];}).join('').toUpperCase().slice(0,2);
  var user = {id,name,email,role,initials,status:'actif',source:'invited',pwd:''};
  await saveUser(user);
  USERS.push(user);
  return user;
}

async function revokeUser(userId) {
  await spDelete('AF_Users', userId);
  USERS = USERS.filter(function(u){ return u.id!==userId; });
}

// ── Synchroniser TM (Team Members) avec les utilisateurs SharePoint ──
// Permet d'utiliser tous les utilisateurs de AF_Users comme auditeurs,
// et évite les crashs quand un auditeur référencé n'est pas dans TM
function syncTeamMembers() {
  if (!USERS || !USERS.length) return;

  // Palette de couleurs pour les avatars
  var palette = [
    'background:#CECBF6;color:#3C3489', // violet
    'background:#9FE1CB;color:#085041', // vert
    'background:#B5D4F4;color:#0C447C', // bleu
    'background:#F6CECE;color:#893434', // rouge
    'background:#F6E8CE;color:#897734', // jaune
    'background:#E8CEF6;color:#703489', // mauve
    'background:#CEE8F6;color:#347089', // cyan
    'background:#F6D4CE;color:#895034', // orange
  ];

  var newTM = {};
  var newAVC = {};
  var colorIdx = 0;

  USERS.forEach(function(u) {
    if (!u.id || u.status !== 'actif') return;

    // Initiales
    var initials = u.initials;
    if (!initials && u.name) {
      initials = u.name.split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
    }
    if (!initials) initials = (u.email || '??').slice(0,2).toUpperCase();

    // Nom court affiché
    var shortName = u.name || u.email || u.id;
    // Format "Prénom N." pour compact
    var parts = shortName.split(' ');
    if (parts.length >= 2) {
      shortName = parts[0] + ' ' + parts[parts.length-1][0] + '.';
    }

    // Titre (rôle humanisé)
    var title = u.role === 'admin' ? 'Administrateur(trice)' :
                u.role === 'viewer' ? 'Observateur(trice)' :
                'Auditeur(rice)';

    newTM[u.id] = {
      name: shortName,
      short: initials,
      role: u.role || 'auditeur',
      title: title,
    };

    newAVC[u.id] = palette[colorIdx % palette.length];
    colorIdx++;
  });

  // Fusionner : on garde l'ancien TM hardcodé ET on ajoute les nouveaux
  // (pour ne pas casser les audits existants qui référencent encore pm/sh/ne)
  Object.keys(newTM).forEach(function(k) { TM[k] = newTM[k]; });
  Object.keys(newAVC).forEach(function(k) { AVC[k] = newAVC[k]; });

  console.log('[SP] TM sync — ' + Object.keys(TM).length + ' membres disponibles');
}

// ── Initialiser MSAL au chargement ──────────────────────────
document.addEventListener('DOMContentLoaded', async function() {
  try {
    await getMsalApp();
    console.log('[MSAL] App initialisée au chargement ✓');
  } catch(e) { console.warn('[MSAL] Init error:', e.message); }
});
