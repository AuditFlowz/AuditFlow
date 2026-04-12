var DB = {
  users: [],
  auditPlan: [],
  processes: [],
  actions: [],
  auditData: {},
  history: [],
};

async function sbGet(table, filter){
  var q = getSB().from(table).select('*');
  if(CU && CU.organization_id && table !== 'organizations') q = q.eq('organization_id', CU.organization_id);
  if(filter) q = q.match(filter);
  var {data,error} = await q;
  if(error){ console.error(table, error); return []; }
  return data||[];
}

async function sbUpsert(table, row){
  if(CU && CU.organization_id && table !== 'organizations') row.organization_id = CU.organization_id;
  var res = await getSB().from(table).upsert(row, {onConflict:'id'});
  if(res.error){
    console.error('Supabase upsert error ['+table+']:', res.error.message);
    if(typeof toast === 'function') toast('Erreur sauvegarde: '+res.error.message);
  } else {
    console.log('Saved to '+table+' OK');
  }
}

async function sbDelete(table, id){
  var q = getSB().from(table).delete().eq('id', id);
  if(CU && CU.organization_id && table !== 'organizations') q = q.eq('organization_id', CU.organization_id);
  var {error} = await q;
  if(error) console.error('delete', table, error);
}

async function sbInsert(table, row){
  if(CU && CU.organization_id && table !== 'organizations') row.organization_id = CU.organization_id;
  var {error} = await getSB().from(table).insert(row);
  if(error) console.error('insert', table, error);
}

async function loadAllData(){
  DB.users     = await sbGet('af_users');
  DB.auditPlan = (await sbGet('af_audit_plan')).map(function(r){
    return {
      id:r.id, type:r.type, titre:r.titre, annee:r.annee,
      statut:r.statut||'Planifié',
      auditeurs:r.auditeurs||[],
      domaine:r.domaine, process:r.process, processId:r.process_id,
      entite:r.entite, region:r.region, pays:r.pays||[],
      dateDebut:r.date_debut||'', dateFin:r.date_fin||'',
      step: r.step !== null && r.step !== undefined ? r.step : undefined,
    };
  });
  DB.processes = (await sbGet('af_processes')).map(function(r){
    return {id:r.id,dom:r.dom,proc:r.proc,risk:r.risk,archived:r.archived,
      y25:r.y25,y26:r.y26,y27:r.y27,y28:r.y28};
  });
  DB.actions   = (await sbGet('af_actions')).map(function(r){
    return {id:r.id,title:r.title,audit:r.audit,resp:r.resp,dept:r.dept,
      ent:r.ent,year:r.year,quarter:r.quarter,status:r.status,pct:r.pct,
      fromFinding:r.from_finding,findingTitle:r.finding_title};
  });
  DB.history   = (await sbGet('af_history')).map(function(r){
    return {type:r.type,msg:r.msg,user:r.user_name,
      date:new Date(r.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})};
  });

  AUDIT_PLAN = DB.auditPlan;
  PROCESSES  = DB.processes;
  ACTIONS    = DB.actions;
  HISTORY_LOG= DB.history;
  USERS      = DB.users.map(function(u){
    return {id:u.id,name:u.name,email:u.email,role:u.role,
      initials:u.initials||u.name.split(' ').map(function(w){return w[0];}).join('').toUpperCase().slice(0,2),
      status:u.status,pwd:u.pwd||'', organization_id:u.organization_id};
  });
}

async function loadAuditData(auditId){
  if(DB.auditData[auditId]) return DB.auditData[auditId];
  var rows = await sbGet('af_audit_data', {id: auditId});
  if(rows.length){
    DB.auditData[auditId] = {
      tasks:    rows[0].tasks||{},
      controls: rows[0].controls||{},
      findings: rows[0].findings||[],
      mgtResp:  rows[0].mgt_resp||[],
      docs:     rows[0].docs||[],
      notes:    rows[0].notes||'',
      maturity: rows[0].maturity||null,
    };
  } else {
    DB.auditData[auditId] = {tasks:{},controls:{},findings:[],mgtResp:[],docs:[],notes:'',maturity:null};
  }
  AUD_DATA[auditId] = DB.auditData[auditId];
  return DB.auditData[auditId];
}

async function saveAuditData(auditId){
  var d = AUD_DATA[auditId];
  if(!d) return;
  await sbUpsert('af_audit_data', {
    id: auditId,
    tasks:    d.tasks,
    controls: d.controls,
    findings: d.findings,
    mgt_resp: d.mgtResp,
    docs:     d.docs,
    notes:    d.notes,
    maturity: d.maturity,
    updated_at: new Date().toISOString(),
  });
}

async function saveAuditPlan(ap){
  await sbUpsert('af_audit_plan', {
    id: ap.id, type: ap.type, titre: ap.titre, annee: ap.annee,
    statut: ap.statut, auditeurs: ap.auditeurs,
    domaine: ap.domaine, process: ap.process, process_id: ap.processId,
    entite: ap.entite, region: ap.region, pays: ap.pays,
    date_debut: ap.dateDebut||null, date_fin: ap.dateFin||null,
    step: ap.step !== undefined ? ap.step : null,
    updated_at: new Date().toISOString(),
  });
}

async function saveAction(ac){
  await sbUpsert('af_actions', {
    id: ac.id, title: ac.title, audit: ac.audit, resp: ac.resp,
    dept: ac.dept, ent: ac.ent, year: ac.year, quarter: ac.quarter,
    status: ac.status, pct: ac.pct,
    from_finding: ac.fromFinding||false,
    finding_title: ac.findingTitle||null,
  });
}

async function addHistoryDB(type, msg, userName){
  await sbInsert('af_history', {type, msg, user_name: userName, created_at: new Date().toISOString()});
}

async function saveUser(user){
  await sbUpsert('af_users', {
    id: user.id, email: user.email, name: user.name,
    role: user.role, initials: user.initials, status: user.status,
    pwd: user.pwd||'',
  });
}

var _sb = null;
function getSB(){
  if(!_sb) _sb = supabase.createClient(AUDITFLOW_CONFIG.supabaseUrl, AUDITFLOW_CONFIG.supabaseKey);
  return _sb;
}

async function deleteDoc(auditId, path, name){
  if(!confirm('Supprimer "' + name + '" ?')) return;
  var {error} = await getSB().storage.from('auditflow-docs').remove([path]);
  if(error){ toast('Erreur suppression : ' + error.message); return; }
  var d = getAudData(auditId);
  d.docs = d.docs.filter(function(f){ return f.path !== path; });
  await saveAuditData(auditId);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast(name + ' supprimé ✓');
}

async function uploadDoc(auditId, file, stepIndex, userName) {
  var ap = AUDIT_PLAN.find(function(a){return a.id===auditId;});
  var folderName = ap ? ap.titre.replace(/[^a-zA-Z0-9]/g,'_') : auditId;
  var path = folderName + '/' + Date.now() + '_' + file.name;

  var {data, error} = await getSB().storage
    .from('auditflow-docs')
    .upload(path, file, {upsert: true});

  if(error) throw error;

  var {data: urlData} = getSB().storage
    .from('auditflow-docs')
    .getPublicUrl(path);

  var d = getAudData(auditId);
  var sizeTxt = file.size < 1024*1024
    ? Math.round(file.size/1024) + ' Ko'
    : (file.size/1024/1024).toFixed(1) + ' Mo';

  var docObj = {
    name: file.name,
    size: sizeTxt,
    url: urlData.publicUrl,
    path: path,
    uploadedBy: userName || 'Inconnu',
    uploadedAt: new Date().toISOString(),
    step: stepIndex !== undefined ? stepIndex : null,
  };
  d.docs.push(docObj);
  await saveAuditData(auditId);
  return docObj;
}

async function renameDocInDB(auditId, docIndex, newName) {
  var d = getAudData(auditId);
  if(!d.docs[docIndex]) return;
  d.docs[docIndex].name = newName;
  await saveAuditData(auditId);
}

async function replaceDocInDB(auditId, docIndex, file, stepIndex, userName) {
  var d = getAudData(auditId);
  var oldDoc = d.docs[docIndex];
  if(!oldDoc) return null;
  // Delete old file from storage
  await getSB().storage.from('auditflow-docs').remove([oldDoc.path]);
  // Upload new file
  var ap = AUDIT_PLAN.find(function(a){return a.id===auditId;});
  var folderName = ap ? ap.titre.replace(/[^a-zA-Z0-9]/g,'_') : auditId;
  var path = folderName + '/' + Date.now() + '_' + file.name;
  var {data, error} = await getSB().storage.from('auditflow-docs').upload(path, file, {upsert: true});
  if(error) throw error;
  var {data: urlData} = getSB().storage.from('auditflow-docs').getPublicUrl(path);
  var sizeTxt = file.size < 1024*1024 ? Math.round(file.size/1024)+' Ko' : (file.size/1024/1024).toFixed(1)+' Mo';
  d.docs[docIndex] = {
    name: file.name, size: sizeTxt, url: urlData.publicUrl, path: path,
    uploadedBy: userName || 'Inconnu',
    uploadedAt: new Date().toISOString(),
    step: stepIndex !== undefined ? stepIndex : oldDoc.step,
  };
  await saveAuditData(auditId);
  return d.docs[docIndex];
}
