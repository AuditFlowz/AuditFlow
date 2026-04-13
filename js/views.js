const V={},I={};

// ─── Constantes ───────────────────────────────────────────────
var STEP_PCT=[10,20,30,40,50,60,70,80,90,100];

// Niveaux de risque Audit Universe
var RISK_LEVELS=[
  {key:'faible',   label:'Faible',   color:'var(--green)',  badge:'bdn'},
  {key:'modere',   label:'Modéré',   color:'var(--amber)',  badge:'bp2'},
  {key:'eleve',    label:'Élevé',    color:'var(--red)',    badge:'blt'},
  {key:'critique', label:'Critique', color:'#7f1d1d',       badge:'bhi'},
];

function riskLabel(key){
  var r=RISK_LEVELS.find(function(x){return x.key===key;});
  return r?'<span class="badge '+r.badge+'">'+r.label+'</span>':'<span class="badge bpl">—</span>';
}

function calculateAuditProgress(ap){
  if(!ap) return 0;
  if(ap.statut==='Clôturé') return 100;
  if(ap.statut==='Planifié') return 0;
  if(ap.step !== undefined && ap.step !== null){
    return STEP_PCT[Math.min(ap.step, STEP_PCT.length-1)];
  }
  return 50;
}

// ══════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════
V['dashboard']=()=>{
  var CY=2026;
  var yearAudits=AUDIT_PLAN.filter(function(a){return a.annee===CY;});
  var yClosed=yearAudits.filter(function(a){return (a.statut||'').startsWith('Clôturé');});
  var yInProg=yearAudits.filter(function(a){return (a.statut||'').startsWith('En cours');});
  var yPlanned=yearAudits.filter(function(a){return (a.statut||'').startsWith('Planifié');});
  var closedPct=yearAudits.length?Math.round(yClosed.length/yearAudits.length*100):0;
  var late=ACTIONS.filter(function(a){return a.status==='En retard';}).slice(0,3);

  var auditRows=yearAudits.length?yearAudits.map(function(ap){
    var detail=ap.type==='Process'?(ap.domaine+' > '+ap.process):(ap.pays||[]).join(', ');
    var avs=(ap.auditeurs||[]).map(function(id){return avEl(id,18);}).join('');
    var pct=calculateAuditProgress(ap);
    var tb=ap.type==='Process'?'bpc':'bbu';
    var stat=badge(ap.statut||'Planifié');
    return '<tr style="cursor:pointer" onclick="openAudit(this.getAttribute(\'data-id\'))" data-id="'+ap.id+'">'
      +'<td style="font-weight:500;font-size:11px">'+ap.titre+'</td>'
      +'<td><span class="badge '+tb+'">'+ap.type+'</span></td>'
      +'<td style="font-size:10px;color:var(--text-2)">'+detail+'</td>'
      +'<td><div style="display:flex;gap:2px">'+avs+'</div></td>'
      +'<td>'+stat+'</td>'
      +'<td style="font-size:11px;color:var(--text-2)">'+(ap.step!==undefined&&ap.step!==null?STEPS[Math.min(ap.step,STEPS.length-1)].s:(ap.statut==='Planifié'?'—':'En cours'))+'</td>'
      +'<td><div style="display:flex;align-items:center;gap:6px"><div class="pbar" style="width:70px"><div class="pfill" style="width:'+pct+'%"></div></div><span style="font-size:10px;color:var(--text-3);white-space:nowrap">'+pct+'%</span></div></td>'
      +'</tr>';
  }).join(''):'<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:1rem">Aucun audit planifié en '+CY+'</td></tr>';

  var lateRows=late.map(function(a){
    return '<div class="ar"><div style="flex:1"><div class="an">'+a.title+'</div>'
      +'<div class="am">'+a.dept+' · '+a.quarter+' '+a.year+'</div></div>'
      +badge(a.status)+'</div>';
  }).join('')||'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun plan urgent</div>';

  var html='';
  html+='<div class="topbar"><div class="tbtitle">Tableau de bord — '+CY+'</div>';
  html+='<button class="bp" onclick="nav(\'plan-audit\')">+ Nouvel audit</button></div>';
  html+='<div class="content">';
  html+='<div class="metrics">';
  html+='<div class="mc"><div class="ml">Audits planifiés '+CY+'</div><div class="mv">'+yearAudits.length+'</div><div class="ms">Plan annuel</div></div>';
  html+='<div class="mc"><div class="ml">Clôturés</div><div class="mv" style="color:var(--green)">'+yClosed.length+'</div><div class="ms">'+closedPct+'% du plan</div></div>';
  html+='<div class="mc"><div class="ml">En cours</div><div class="mv" style="color:var(--purple)">'+yInProg.length+'</div><div class="ms">Missions actives</div></div>';
  html+='<div class="mc"><div class="ml">Planifiés (à démarrer)</div><div class="mv" style="color:var(--amber)">'+yPlanned.length+'</div><div class="ms">Non démarrés</div></div>';
  html+='</div>';
  html+='<div style="margin-bottom:1.25rem">';
  html+='<div class="sth"><div class="st">Audits '+CY+'</div></div>';
  html+='<div class="tw"><table>';
  html+='<thead><tr><th>Titre</th><th>Type</th><th>Détail</th><th>Auditeurs</th><th>Statut</th><th>Étape</th><th>Avancement</th></tr></thead>';
  html+='<tbody>'+auditRows+'</tbody></table></div></div>';
  html+='<div class="sth"><div class="st">Plans d\'action urgents</div><button class="bs" style="font-size:11px" onclick="nav(\'plans-action\')">Voir tout</button></div>';
  html+='<div>'+lateRows+'</div>';
  html+='</div>';
  return html;
};

// ══════════════════════════════════════════════════════════════
//  AUDIT UNIVERSE (ex Plan Process)
// ══════════════════════════════════════════════════════════════
V['plan-process']=()=>`
  <div class="topbar">
    <div class="tbtitle">Audit Universe</div>
    <div style="display:flex;gap:7px">
      <button class="bp ao" onclick="showAddDomainModal()">+ Domaine</button>
      <button class="bp ao" onclick="showAddProcModal()">+ Processus</button>
    </div>
  </div>
  <div class="content">
    <div class="tw"><table id="pp-tbl"></table></div>
  </div>`;

I['plan-process']=()=>renderProcTable();

function renderProcTable(){
  var doms=[...new Set(PROCESSES.map(function(p){return p.dom;}))];
  var h='<thead><tr>'
    +'<th style="width:160px">Domaine</th>'
    +'<th>Processus</th>'
    +'<th style="width:120px">Niveau de risque</th>'
    +(CU&&CU.role==='admin'?'<th style="width:120px">Actions</th>':'')
    +'</tr></thead><tbody>';

  if(!doms.length){
    h+='<tr><td colspan="4" style="text-align:center;color:var(--text-3);padding:2rem">Aucun processus. Cliquez sur "+ Domaine" pour commencer.</td></tr>';
  } else {
    doms.forEach(function(dom){
      var rows=PROCESSES.filter(function(p){return p.dom===dom&&!p.archived;});
      if(!rows.length) return;
      // Ligne de section domaine
      var domIdx=PROCESSES.findIndex(function(p){return p.dom===dom;});
      h+='<tr class="sr">';
      h+='<td colspan="'+(CU&&CU.role==='admin'?'4':'3')+'" style="display:flex;align-items:center;justify-content:space-between">';
      h+='<span>'+dom+'</span>';
      if(CU&&CU.role==='admin'){
        h+='<button class="bs" style="font-size:10px;padding:2px 7px" onclick="showRenameDomainModal(\''+_escQ(dom)+'\')">Renommer</button>';
      }
      h+='</td></tr>';

      rows.forEach(function(p){
        var idx=PROCESSES.indexOf(p);
        // Sélecteur de risque (admin) ou badge (lecture)
        var riskCell;
        if(CU&&CU.role==='admin'){
          riskCell='<select style="font-size:11px;padding:3px 7px;border:.5px solid var(--border-md);border-radius:var(--radius);background:var(--bg-card)" onchange="editRiskLevel('+idx+',this.value)">'
            +RISK_LEVELS.map(function(r){return'<option value="'+r.key+'"'+(p.riskLevel===r.key?' selected':'')+'>'+r.label+'</option>';}).join('')
            +'</select>';
        } else {
          riskCell=riskLabel(p.riskLevel||'faible');
        }
        var adminCell=CU&&CU.role==='admin'
          ?'<td style="white-space:nowrap">'
            +'<button class="bs" style="font-size:10px;padding:2px 7px" onclick="showEditProcModal('+idx+')">Modifier</button> '
            +'<button class="bd" style="font-size:10px;padding:2px 7px" onclick="archiveProc('+idx+')">Archiver</button>'
            +'</td>'
          :'';
        h+='<tr>';
        h+='<td style="font-size:11px;color:var(--text-2)">'+dom+'</td>';
        h+='<td style="font-weight:500;font-size:12px">'+p.proc+'</td>';
        h+='<td>'+riskCell+'</td>';
        h+=adminCell;
        h+='</tr>';
      });
    });
  }
  document.getElementById('pp-tbl').innerHTML=h+'</tbody>';
}

// Créer un domaine
function showAddDomainModal(){
  openModal('Nouveau domaine',
    '<div><label>Nom du domaine</label><input id="m-dom-name" placeholder="ex : Finance, IT, Opérations..."/></div>',
    function(){
      var name=document.getElementById('m-dom-name').value.trim();
      if(!name){toast('Nom obligatoire');return;}
      // Créer un processus placeholder pour initialiser le domaine
      var newP={id:'p'+Date.now(),dom:name,proc:'(Nouveau processus)',riskLevel:'faible',risk:1,archived:false};
      PROCESSES.push(newP);
      sbUpsert('af_processes',{id:newP.id,organization_id:CU.organization_id,dom:name,proc:newP.proc,risk:1,archived:false}).catch(console.warn);
      addHist('add','Domaine "'+name+'" créé');
      renderProcTable();
      toast('Domaine "'+name+'" créé ✓');
    });
}

// Renommer un domaine
function showRenameDomainModal(dom){
  openModal('Renommer le domaine "'+dom+'"',
    '<div><label>Nouveau nom</label><input id="m-dom-rename" value="'+dom+'"/></div>',
    function(){
      var newName=document.getElementById('m-dom-rename').value.trim();
      if(!newName){toast('Nom obligatoire');return;}
      PROCESSES.forEach(function(p){if(p.dom===dom)p.dom=newName;});
      addHist('edit','Domaine "'+dom+'" renommé en "'+newName+'"');
      renderProcTable();
      toast('Renommé ✓');
    });
}

// Modifier le niveau de risque
function editRiskLevel(idx,val){
  PROCESSES[idx].riskLevel=val;
  PROCESSES[idx].risk=RISK_LEVELS.findIndex(function(r){return r.key===val;})+1||1;
  addHist('edit','Risque "'+PROCESSES[idx].proc+'" modifié → '+val);
  toast('Risque mis à jour');
}

function archiveProc(idx){PROCESSES[idx].archived=true;addHist('arch','Process "'+PROCESSES[idx].proc+'" archivé');renderProcTable();toast('Archivé');}

function showAddProcModal(){
  var doms=[...new Set(PROCESSES.map(function(p){return p.dom;}))];
  if(!doms.length){toast('Créez d\'abord un domaine.');return;}
  openModal('Nouveau processus',
    '<div><label>Domaine <span style="color:var(--red)">*</span></label>'
    +'<select id="m-dom">'+doms.map(function(d){return'<option>'+d+'</option>';}).join('')+'</select></div>'
    +'<div><label>Nom du processus <span style="color:var(--red)">*</span></label>'
    +'<input id="m-proc" placeholder="ex : Gestion de la paie"/></div>'
    +'<div><label>Niveau de risque</label>'
    +'<select id="m-risk">'
    +RISK_LEVELS.map(function(r){return'<option value="'+r.key+'">'+r.label+'</option>';}).join('')
    +'</select></div>',
    function(){
      var proc=document.getElementById('m-proc').value.trim();
      if(!proc){toast('Nom obligatoire');return;}
      var dom=document.getElementById('m-dom').value;
      var riskKey=document.getElementById('m-risk').value;
      var riskNum=RISK_LEVELS.findIndex(function(r){return r.key===riskKey;})+1||1;
      var newP={id:'p'+Date.now(),dom:dom,proc:proc,riskLevel:riskKey,risk:riskNum,archived:false};
      PROCESSES.push(newP);
      sbUpsert('af_processes',{id:newP.id,organization_id:CU.organization_id,dom:dom,proc:proc,risk:riskNum,archived:false}).catch(console.warn);
      addHist('add','Process "'+proc+'" ajouté dans "'+dom+'"');
      renderProcTable();
      toast('Processus créé ✓');
    });
}

function showEditProcModal(idx){
  var p=PROCESSES[idx];
  var doms=[...new Set(PROCESSES.map(function(x){return x.dom;}))];
  openModal('Modifier "'+p.proc+'"',
    '<div><label>Domaine</label>'
    +'<select id="m-dom">'+doms.map(function(d){return'<option'+(d===p.dom?' selected':'')+'>'+d+'</option>';}).join('')+'</select></div>'
    +'<div><label>Nom du processus</label><input id="m-proc" value="'+p.proc+'"/></div>'
    +'<div><label>Niveau de risque</label>'
    +'<select id="m-risk">'
    +RISK_LEVELS.map(function(r){return'<option value="'+r.key+'"'+(p.riskLevel===r.key?' selected':'')+'>'+r.label+'</option>';}).join('')
    +'</select></div>',
    function(){
      p.proc=document.getElementById('m-proc').value.trim();
      p.dom=document.getElementById('m-dom').value;
      var riskKey=document.getElementById('m-risk').value;
      p.riskLevel=riskKey;
      p.risk=RISK_LEVELS.findIndex(function(r){return r.key===riskKey;})+1||1;
      addHist('edit','Process "'+p.proc+'" modifié');
      renderProcTable();
      toast('Mis à jour ✓');
    });
}

// ══════════════════════════════════════════════════════════════
//  GROUP STRUCTURE BY COUNTRY (ex Plan BU)
// ══════════════════════════════════════════════════════════════

// Structure en mémoire : tableau d'entités avec régions et pays
// Format : [{id, name, regions:[{id, name, countries:[string]}]}]
var GROUP_STRUCTURE=[];

V['plan-bu']=()=>`
  <div class="topbar">
    <div class="tbtitle">Group Structure By Country</div>
    <div style="display:flex;gap:7px">
      <button class="bp ao" onclick="gsAddEntity()">+ Entité</button>
    </div>
  </div>
  <div class="content">
    <div id="gs-root" style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;"></div>
  </div>`;

I['plan-bu']=async function(){
  await gsLoad();
  gsRender();
};

// Charger depuis Supabase (table af_group_structure)
async function gsLoad(){
  try {
    var res=await getSB()
      .from('af_group_structure')
      .select('*')
      .eq('organization_id',CU.organization_id)
      .order('created_at',{ascending:true});
    if(res.error){console.warn('[GS]',res.error.message);return;}
    // Reconstruire la structure hiérarchique depuis les lignes plates
    var entities={};
    (res.data||[]).forEach(function(row){
      if(row.type==='entity'){
        if(!entities[row.id]) entities[row.id]={id:row.id,name:row.name,regions:[]};
      }
    });
    (res.data||[]).forEach(function(row){
      if(row.type==='region'&&entities[row.parent_id]){
        entities[row.parent_id].regions.push({id:row.id,name:row.name,parent_id:row.parent_id,countries:row.countries||[]});
      }
    });
    GROUP_STRUCTURE=Object.values(entities);
  } catch(e){
    console.warn('[GS] load exception:',e.message);
  }
}

// Sauvegarder une ligne dans af_group_structure
async function gsSave(type,id,name,parentId,countries){
  try {
    await getSB().from('af_group_structure').upsert({
      id:id,
      organization_id:CU.organization_id,
      type:type,
      name:name,
      parent_id:parentId||null,
      countries:countries||[],
    },{onConflict:'id'});
  } catch(e){ console.warn('[GS] save:',e.message); }
}

async function gsDelete(id){
  try {
    await getSB().from('af_group_structure').delete().eq('id',id).eq('organization_id',CU.organization_id);
  } catch(e){ console.warn('[GS] delete:',e.message); }
}

// Rendu de la structure en colonnes
function gsRender(){
  var root=document.getElementById('gs-root');
  if(!root)return;

  if(!GROUP_STRUCTURE.length){
    root.innerHTML='<div style="font-size:13px;color:var(--text-3);padding:1rem;">Aucune entité. Cliquez sur "+ Entité" pour commencer.</div>';
    return;
  }

  root.innerHTML=GROUP_STRUCTURE.map(function(ent){
    var regionsHtml=ent.regions.map(function(reg){
      var countriesHtml=reg.countries.length
        ?reg.countries.map(function(c){
          return '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;background:var(--bg);border-radius:4px;font-size:11px;margin-bottom:3px;">'
            +'<span>'+c+'</span>'
            +(CU&&CU.role==='admin'?'<button onclick="gsRemoveCountry(\''+ent.id+'\',\''+reg.id+'\',\''+_escQ(c)+'\')" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:12px;padding:0 2px;" title="Supprimer">×</button>':'')
            +'</div>';
        }).join('')
        :'<div style="font-size:11px;color:var(--text-3);padding:4px 8px;">Aucun pays</div>';

      return '<div style="background:var(--bg);border-radius:var(--radius);padding:8px 10px;margin-bottom:8px;border:.5px solid var(--border);">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
        +'<span style="font-size:12px;font-weight:500;color:var(--purple-dk)">'+reg.name+'</span>'
        +'<div style="display:flex;gap:4px;">'
        +(CU&&CU.role==='admin'
          ?'<button class="bs" style="font-size:10px;padding:2px 6px;" onclick="gsAddCountry(\''+ent.id+'\',\''+reg.id+'\')">+ Pays</button>'
          +'<button class="bd" style="font-size:10px;padding:2px 6px;" onclick="gsDeleteRegion(\''+ent.id+'\',\''+reg.id+'\')">×</button>'
          :'')
        +'</div></div>'
        +countriesHtml
        +'</div>';
    }).join('');

    return '<div class="card" style="min-width:240px;max-width:300px;flex:1;">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:.5px solid var(--border);">'
      +'<div style="font-size:13px;font-weight:600;">'+ent.name+'</div>'
      +'<div style="display:flex;gap:4px;">'
      +(CU&&CU.role==='admin'
        ?'<button class="bs" style="font-size:10px;padding:2px 6px;" onclick="gsAddRegion(\''+ent.id+'\')">+ Région</button>'
        +'<button class="bd" style="font-size:10px;padding:2px 6px;" onclick="gsDeleteEntity(\''+ent.id+'\')">×</button>'
        :'')
      +'</div></div>'
      +regionsHtml
      +'</div>';
  }).join('');
}

// Actions CRUD
function gsAddEntity(){
  openModal('Nouvelle entité',
    '<div><label>Nom de l\'entité <span style="color:var(--red)">*</span></label><input id="gs-ent-name" placeholder="ex : SBS, AXW, Groupe..."/></div>',
    async function(){
      var name=document.getElementById('gs-ent-name').value.trim();
      if(!name){toast('Nom obligatoire');return;}
      var id='ent_'+Date.now();
      GROUP_STRUCTURE.push({id:id,name:name,regions:[]});
      await gsSave('entity',id,name,null,[]);
      addHist('add','Entité "'+name+'" créée');
      gsRender();
      toast('Entité "'+name+'" créée ✓');
    });
}

async function gsDeleteEntity(entId){
  var ent=GROUP_STRUCTURE.find(function(e){return e.id===entId;});
  if(!confirm('Supprimer l\'entité "'+ent.name+'" et toutes ses régions / pays ?'))return;
  // Supprimer les régions d'abord
  for(var i=0;i<ent.regions.length;i++){
    await gsDelete(ent.regions[i].id);
  }
  await gsDelete(entId);
  GROUP_STRUCTURE=GROUP_STRUCTURE.filter(function(e){return e.id!==entId;});
  addHist('del','Entité "'+ent.name+'" supprimée');
  gsRender();
  toast('Supprimé ✓');
}

function gsAddRegion(entId){
  openModal('Nouvelle région',
    '<div><label>Nom de la région <span style="color:var(--red)">*</span></label><input id="gs-reg-name" placeholder="ex : Europe, AMEE, APAC..."/></div>',
    async function(){
      var name=document.getElementById('gs-reg-name').value.trim();
      if(!name){toast('Nom obligatoire');return;}
      var ent=GROUP_STRUCTURE.find(function(e){return e.id===entId;});
      var id='reg_'+Date.now();
      ent.regions.push({id:id,name:name,parent_id:entId,countries:[]});
      await gsSave('region',id,name,entId,[]);
      addHist('add','Région "'+name+'" ajoutée à "'+ent.name+'"');
      gsRender();
      toast('Région créée ✓');
    });
}

async function gsDeleteRegion(entId,regId){
  var ent=GROUP_STRUCTURE.find(function(e){return e.id===entId;});
  var reg=ent&&ent.regions.find(function(r){return r.id===regId;});
  if(!confirm('Supprimer la région "'+reg.name+'" et ses pays ?'))return;
  ent.regions=ent.regions.filter(function(r){return r.id!==regId;});
  await gsDelete(regId);
  gsRender();
  toast('Région supprimée ✓');
}

function gsAddCountry(entId,regId){
  openModal('Ajouter des pays',
    '<div><label>Pays (séparés par des virgules) <span style="color:var(--red)">*</span></label>'
    +'<input id="gs-countries" placeholder="ex : France, Belgique, Maroc"/></div>',
    async function(){
      var val=document.getElementById('gs-countries').value.trim();
      if(!val){toast('Au moins un pays');return;}
      var newCountries=val.split(',').map(function(c){return c.trim();}).filter(Boolean);
      var ent=GROUP_STRUCTURE.find(function(e){return e.id===entId;});
      var reg=ent&&ent.regions.find(function(r){return r.id===regId;});
      reg.countries=[...new Set([...reg.countries,...newCountries])];
      await gsSave('region',reg.id,reg.name,entId,reg.countries);
      addHist('add',newCountries.join(', ')+' ajouté(s) à "'+reg.name+'"');
      gsRender();
      toast(newCountries.length+' pays ajouté(s) ✓');
    });
}

async function gsRemoveCountry(entId,regId,country){
  var ent=GROUP_STRUCTURE.find(function(e){return e.id===entId;});
  var reg=ent&&ent.regions.find(function(r){return r.id===regId;});
  reg.countries=reg.countries.filter(function(c){return c!==country;});
  await gsSave('region',reg.id,reg.name,entId,reg.countries);
  gsRender();
  toast(country+' retiré ✓');
}

// ══════════════════════════════════════════════════════════════
//  PLAN AUDIT (inchangé)
// ══════════════════════════════════════════════════════════════
V['plan-audit']=()=>`
  <div class="topbar"><div class="tbtitle">Plan Audit</div><button class="bp ao" onclick="showAddAuditModal()">+ Ajouter un audit</button></div>
  <div class="content">
    <div style="display:flex;gap:8px;margin-bottom:1rem">
      <select id="f-pa-type" onchange="renderPlanAuditTable()"><option value="all">Process + BU</option><option value="Process">Process</option><option value="BU">BU</option></select>
      <select id="f-pa-year" onchange="renderPlanAuditTable()"><option value="all">Toutes années</option><option value="2025">2025</option><option value="2026">2026</option><option value="2027">2027</option><option value="2028">2028</option></select>
    </div>
    <div class="tw"><table id="pa-tbl"></table></div>
  </div>`;

I['plan-audit']=()=>renderPlanAuditTable();

function renderPlanAuditTable(){
  var ft=document.getElementById('f-pa-type')?document.getElementById('f-pa-type').value:'all';
  var fy=document.getElementById('f-pa-year')?document.getElementById('f-pa-year').value:'all';
  var rows=AUDIT_PLAN.filter(function(a){return(ft==='all'||a.type===ft)&&(fy==='all'||String(a.annee)===fy);});
  rows=rows.slice().sort(function(a,b){
    var sa=a.dateDebut?parseInt(a.dateDebut):99;
    var sb=b.dateDebut?parseInt(b.dateDebut):99;
    return sa-sb;
  });
  var h='<thead><tr><th>Type</th><th>Titre</th><th>Detail</th><th>Annee</th><th>Auditeurs</th><th>Statut</th>'+(CU&&CU.role==='admin'?'<th>Actions</th>':'')+'</tr></thead><tbody>';
  if(!rows.length){
    h+='<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:1.5rem">Aucun audit planifié.</td></tr>';
  } else {
    rows.forEach(function(ap){
      var idx=AUDIT_PLAN.indexOf(ap);
      var detail=ap.type==='Process'
        ?'<span style="font-size:11px"><strong>'+ap.domaine+'</strong> › '+ap.process+'</span>'
        :'<span style="font-size:11px"><strong>'+(ap.entite||'')+'</strong> · '+(ap.region||'')+' · '+(ap.pays||[]).join(', ')+'</span>';
      var avs=(ap.auditeurs||[]).map(function(id){return avEl(id,20);}).join('');
      var tb=ap.type==='Process'?'bpc':'bbu';
      var mns=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
      var dateStr=ap.dateDebut||ap.dateFin
        ?'<div style="font-size:10px;color:#888">'+((ap.dateDebut?mns[parseInt(ap.dateDebut)-1]:'?')+' → '+(ap.dateFin?mns[parseInt(ap.dateFin)-1]:'?'))+'</div>':'';
      var adminBtn=CU&&CU.role==='admin'
        ?'<td style="white-space:nowrap"><button class="bs" style="font-size:10px;padding:2px 7px" onclick="showEditAuditModal('+idx+')">Modifier</button> <button class="bd" style="font-size:10px;padding:2px 7px" onclick="deleteAudit('+idx+')">Supprimer</button></td>':'';
      h+='<tr>'
        +'<td><span class="badge '+tb+'">'+ap.type+'</span></td>'
        +'<td style="font-weight:500;font-size:12px">'+ap.titre+'</td>'
        +'<td>'+detail+'</td>'
        +'<td style="font-weight:500;color:var(--purple-dk)">'+ap.annee+dateStr+'</td>'
        +'<td><div style="display:flex;gap:3px">'+(avs||'<span style="font-size:10px;color:var(--text-3)">-</span>')+'</div></td>'
        +'<td>'+badge(ap.statut||'Planifié')+'</td>'
        +adminBtn
        +'</tr>';
    });
  }
  document.getElementById('pa-tbl').innerHTML=h+'</tbody>';
}

// ── Modal audit (inchangé) ────────────────────────────────────
function auditModalBody(ap){
  var doms=[...new Set(PROCESSES.map(function(p){return p.dom;}))];
  var type=(ap&&ap.type)||'Process';
  var domOpts=doms.map(function(d){return'<option'+(ap&&ap.domaine===d?' selected':'')+'>'+d+'</option>';}).join('');
  var currentDom=(ap&&ap.domaine)||doms[0];
  var procOpts=PROCESSES.filter(function(p){return p.dom===currentDom;}).map(function(p){
    return'<option value="'+p.id+'"'+(ap&&ap.processId===p.id?' selected':'')+'>'+p.proc+'</option>';
  }).join('');
  var h='';
  h+='<div><label>Type d\'audit</label><select id="m-type" onchange="toggleAuditTypeFields(this.value)"><option value="Process"'+(type==='Process'?' selected':'')+'>Process Audit</option><option value="BU"'+(type==='BU'?' selected':'')+'>BU Audit</option></select></div>';
  h+='<div id="m-proc-fields" style="'+(type==='BU'?'display:none':'')+'"><div><label>Domaine</label><select id="m-dom" onchange="updateProcessList()">'+domOpts+'</select></div><div><label>Processus</label><select id="m-proc">'+procOpts+'</select></div></div>';
  h+='<div id="m-bu-fields" style="'+(type!=='BU'?'display:none':'')+'"><div><label>Entité</label><select id="m-ent">';
  var entNames=GROUP_STRUCTURE.map(function(e){return e.name;});
  if(!entNames.length) entNames=['SBS','AXW','Groupe'];
  entNames.forEach(function(e){h+='<option'+(ap&&ap.entite===e?' selected':'')+'>'+e+'</option>';});
  h+='</select></div>';
  h+='<div><label>Région</label><select id="m-reg">';
  var allRegs=[];
  GROUP_STRUCTURE.forEach(function(e){e.regions.forEach(function(r){allRegs.push(r.name);});});
  if(!allRegs.length) allRegs=['Europe','AMEE','North America','APAC'];
  allRegs.forEach(function(r){h+='<option'+(ap&&ap.region===r?' selected':'')+'>'+r+'</option>';});
  h+='</select></div>';
  h+='<div><label>Pays (séparés par des virgules)</label><input id="m-pays" placeholder="ex : Maroc, Tunisie" value="'+((ap&&ap.pays||[]).join(', '))+'"/></div></div>';
  h+='<div><label>Titre de la mission</label><input id="m-titre" placeholder="ex : BU Maroc 2025" value="'+((ap&&ap.titre)||'')+'"/></div>';
  h+='<div class="g2"><div><label>Année</label><select id="m-annee">';
  [2025,2026,2027,2028].forEach(function(y){h+='<option'+(ap&&ap.annee===y?' selected':'')+'>'+y+'</option>';});
  h+='</select></div><div><label>Statut</label><select id="m-statut">';
  ['Planifié','En cours','Clôturé'].forEach(function(s){h+='<option'+(ap&&ap.statut===s?' selected':'')+'>'+s+'</option>';});
  h+='</select></div></div>';
  h+='<div><label>Auditeurs assignés</label><div style="display:flex;gap:12px;margin-top:4px">';
  h+='<label style="display:flex;align-items:center;gap:5px;font-size:12px"><input type="checkbox" id="a-sh"'+((ap&&ap.auditeurs&&ap.auditeurs.includes('sh'))?' checked':'')+'>  Selma H.</label>';
  h+='<label style="display:flex;align-items:center;gap:5px;font-size:12px"><input type="checkbox" id="a-ne"'+((ap&&ap.auditeurs&&ap.auditeurs.includes('ne'))?' checked':'')+'>  Nisrine E.</label>';
  h+='</div></div>';
  var mns=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  var mOpts=function(sel){return mns.map(function(m,i){var vv=String(i+1);return'<option value="'+vv+'"'+(sel===vv?' selected':'')+'>'+m+'</option>';}).join('');};
  h+='<div class="f-row"><div style="display:flex;gap:8px">';
  h+='<div style="flex:1"><label class="f-lbl">Mois début</label><select id="m-deb" class="f-inp"><option value="">— Non défini</option>'+mOpts(ap&&ap.dateDebut?ap.dateDebut:'')+'</select></div>';
  h+='<div style="flex:1"><label class="f-lbl">Mois fin</label><select id="m-fin" class="f-inp"><option value="">— Non défini</option>'+mOpts(ap&&ap.dateFin?ap.dateFin:'')+'</select></div>';
  h+='</div></div>';
  return h;
}

function toggleAuditTypeFields(val){
  document.getElementById('m-proc-fields').style.display=val==='BU'?'none':'';
  document.getElementById('m-bu-fields').style.display=val==='BU'?'':'none';
}
function updateProcessList(){
  var dom=document.getElementById('m-dom')&&document.getElementById('m-dom').value;
  var sel=document.getElementById('m-proc');
  if(!sel||!dom)return;
  sel.innerHTML=PROCESSES.filter(function(p){return p.dom===dom;}).map(function(p){return'<option value="'+p.id+'">'+p.proc+'</option>';}).join('');
}
function collectAuditModal(){
  var type=document.getElementById('m-type').value;
  var titre=document.getElementById('m-titre').value.trim();
  if(!titre){toast('Titre obligatoire');return null;}
  var auditeurs=[];
  if(document.getElementById('a-sh').checked)auditeurs.push('sh');
  if(document.getElementById('a-ne').checked)auditeurs.push('ne');
  var dateDebut=document.getElementById('m-deb')?document.getElementById('m-deb').value:'';
  var dateFin=document.getElementById('m-fin')?document.getElementById('m-fin').value:'';
  var base={type,titre,annee:parseInt(document.getElementById('m-annee').value),statut:document.getElementById('m-statut').value,auditeurs,dateDebut,dateFin};
  if(type==='Process'){
    var procEl=document.getElementById('m-proc');
    var procId=procEl&&procEl.value;
    var procObj=PROCESSES.find(function(p){return p.id===procId;});
    return Object.assign({},base,{domaine:document.getElementById('m-dom').value,process:procObj&&procObj.proc||'',processId:procId});
  } else {
    return Object.assign({},base,{entite:document.getElementById('m-ent').value,region:document.getElementById('m-reg').value,pays:document.getElementById('m-pays').value.split(',').map(function(s){return s.trim();}).filter(Boolean)});
  }
}
function showAddAuditModal(){
  openModal('Nouvel audit',auditModalBody(null),async function(){
    var data=collectAuditModal();if(!data)return;
    var newAp=Object.assign({id:'ap'+Date.now()},data);
    AUDIT_PLAN.push(newAp);
    await saveAuditPlan(newAp);
    addHist('add','Audit "'+data.titre+'" ajouté au plan');
    renderPlanAuditTable();toast('Audit créé ✓');
  });
}
function showEditAuditModal(idx){
  var ap=AUDIT_PLAN[idx];
  openModal('Modifier — '+ap.titre,auditModalBody(ap),async function(){
    var data=collectAuditModal();if(!data)return;
    AUDIT_PLAN[idx]=Object.assign({},ap,data);
    await saveAuditPlan(AUDIT_PLAN[idx]);
    addHist('edit','Audit "'+data.titre+'" modifié');
    renderPlanAuditTable();toast('Audit mis à jour ✓');
  });
}
async function deleteAudit(idx){
  var ap=AUDIT_PLAN[idx];
  if(!confirm('Supprimer "'+ap.titre+'" ?'))return;
  AUDIT_PLAN.splice(idx,1);
  await sbDelete('af_audit_plan',ap.id);
  addHist('del','Audit "'+ap.titre+'" supprimé');
  renderPlanAuditTable();toast('Supprimé');
}

// ── Plan Process consolidé (section Plans Audit) ──────────────
V['plans-process']=()=>`
  <div class="topbar">
    <div class="tbtitle">Plan Process 2025–2028</div>
    <button class="bp" onclick="nav('plan-audit')">Gérer le plan audit →</button>
  </div>
  <div class="content">
    <div style="background:var(--purple-lt);border:.5px solid var(--purple);border-radius:var(--radius);padding:8px 12px;font-size:12px;color:var(--purple-dk);margin-bottom:1rem">
      Vue consolidée des audits Process planifiés. Les missions sont gérées depuis <strong>Plan Audit</strong>.
    </div>
    <div class="tw"><table id="pp-tbl2"></table></div>
  </div>`;
I['plans-process']=()=>renderPlanProcessTable();

function renderPlanProcessTable(){
  var doms=[...new Set(PROCESSES.map(function(p){return p.dom;}))];
  var procAudits=AUDIT_PLAN.filter(function(a){return a.type==='Process';});
  var h='<thead><tr><th>Domaine</th><th>Processus</th><th>Risque</th><th>2025</th><th>2026</th><th>2027</th><th>2028</th></tr></thead><tbody>';
  doms.forEach(function(dom){
    var rows=PROCESSES.filter(function(p){return p.dom===dom&&!p.archived;});
    if(!rows.length)return;
    h+='<tr class="sr"><td colspan="7">'+dom+'</td></tr>';
    rows.forEach(function(p){
      var yc=function(y){
        var m=procAudits.find(function(a){return a.processId===p.id&&a.annee===y;});
        return m?'<div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:10px;font-weight:500;color:var(--purple-dk)">'+m.titre+'</span><div style="display:flex;gap:3px">'+((m.auditeurs||[]).map(function(id){return avEl(id,16);}).join(''))+'</div></div>':'<span style="color:var(--text-3)">—</span>';
      };
      h+='<tr>'
        +'<td style="font-size:11px;color:var(--text-2)">'+dom+'</td>'
        +'<td style="font-weight:500;font-size:11px">'+p.proc+'</td>'
        +'<td>'+riskLabel(p.riskLevel||'faible')+'</td>'
        +'<td>'+yc(2025)+'</td><td>'+yc(2026)+'</td><td>'+yc(2027)+'</td><td>'+yc(2028)+'</td>'
        +'</tr>';
    });
  });
  document.getElementById('pp-tbl2').innerHTML=h+'</tbody>';
}

// ── Plan BU consolidé (section Plans Audit) ───────────────────
V['plans-bu']=()=>`
  <div class="topbar">
    <div class="tbtitle">Plan BU 2025–2028</div>
    <button class="bp" onclick="nav('plan-audit')">Gérer le plan audit →</button>
  </div>
  <div class="content">
    <div style="background:var(--purple-lt);border:.5px solid var(--purple);border-radius:var(--radius);padding:8px 12px;font-size:12px;color:var(--purple-dk);margin-bottom:1rem">
      Vue consolidée des BU Audits planifiés. Les missions sont gérées depuis <strong>Plan Audit</strong>.
    </div>
    <div style="display:flex;gap:8px;margin-bottom:1rem">
      <select id="f-bu-ent" onchange="renderBUTable()"><option value="all">Toutes entités</option></select>
      <select id="f-bu-yr" onchange="renderBUTable()"><option value="all">Toutes années</option><option value="2025">2025</option><option value="2026">2026</option><option value="2027">2027</option><option value="2028">2028</option></select>
    </div>
    <div class="tw"><table id="bu-tbl"></table></div>
  </div>`;
I['plans-bu']=()=>{
  // Peupler le filtre entités depuis GROUP_STRUCTURE
  var sel=document.getElementById('f-bu-ent');
  if(sel&&GROUP_STRUCTURE.length){
    sel.innerHTML='<option value="all">Toutes entités</option>'
      +GROUP_STRUCTURE.map(function(e){return'<option>'+e.name+'</option>';}).join('');
  }
  renderBUTable();
};

function renderBUTable(){
  var fe=document.getElementById('f-bu-ent')&&document.getElementById('f-bu-ent').value||'all';
  var fy=document.getElementById('f-bu-yr')&&document.getElementById('f-bu-yr').value||'all';
  var rows=AUDIT_PLAN.filter(function(a){return a.type==='BU'&&(fe==='all'||a.entite===fe)&&(fy==='all'||String(a.annee)===fy);});
  var regs=[...new Set(rows.map(function(b){return b.region;}))];
  var h='<thead><tr><th>Entité</th><th>Région</th><th>Pays</th><th>Titre mission</th><th>Année</th><th>Auditeurs</th><th>Statut</th></tr></thead><tbody>';
  if(!rows.length){
    h+='<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:1.5rem">Aucune BU planifiée.</td></tr>';
  } else {
    regs.forEach(function(reg){
      h+='<tr class="sr"><td colspan="7">'+reg+'</td></tr>';
      rows.filter(function(b){return b.region===reg;}).forEach(function(b){
        var avs=(b.auditeurs||[]).map(function(id){return avEl(id,20);}).join('');
        h+='<tr>'
          +'<td><span class="badge bsbs">'+(b.entite||'')+'</span></td>'
          +'<td style="color:var(--text-2);font-size:11px">'+(b.region||'')+'</td>'
          +'<td style="font-weight:500;font-size:11px">'+((b.pays||[]).join(', '))+'</td>'
          +'<td style="font-size:11px">'+b.titre+'</td>'
          +'<td style="font-weight:500;color:var(--purple-dk)">'+b.annee+'</td>'
          +'<td><div style="display:flex;gap:3px">'+(avs||'<span style="font-size:10px;color:var(--text-3)">—</span>')+'</div></td>'
          +'<td>'+badge(b.statut||'Planifié')+'</td>'
          +'</tr>';
      });
    });
  }
  document.getElementById('bu-tbl').innerHTML=h+'</tbody>';
}

// ══════════════════════════════════════════════════════════════
//  PLANIFICATION (Gantt — inchangé)
// ══════════════════════════════════════════════════════════════
V['planification']=()=>`
  <div class="topbar"><div class="tbtitle">Planification</div></div>
  <div class="content">
    <div style="display:flex;gap:8px;margin-bottom:1rem">
      <select id="f-pl" onchange="renderGantt()"><option value="all">Process + BU</option><option value="Process">Process</option><option value="BU">BU</option></select>
      <select id="f-pyr" onchange="renderGantt()"><option value="all">Toutes années</option><option value="2025" selected>2025</option><option value="2026">2026</option><option value="2027">2027</option><option value="2028">2028</option></select>
    </div>
    <div class="gw" id="gantt-wrap"></div>
  </div>`;
I['planification']=()=>renderGantt();

function renderGantt(){
  var ft=document.getElementById('f-pl')&&document.getElementById('f-pl').value||'all';
  var fy=document.getElementById('f-pyr')&&document.getElementById('f-pyr').value||'all';
  var rows=AUDIT_PLAN.filter(function(a){return(ft==='all'||a.type===ft)&&(fy==='all'||String(a.annee)===fy);});
  rows=rows.slice().sort(function(a,b){return (a.dateDebut?parseInt(a.dateDebut):99)-(b.dateDebut?parseInt(b.dateDebut):99);});
  var curMonth=new Date().getMonth();
  var months=MO.map(function(m,mi){return'<div class="gc'+(mi===curMonth?' today-col':'')+'" style="font-size:11px;text-align:center;padding:4px 0;'+(mi===curMonth?'background:rgba(83,74,183,0.08);font-weight:600':'')+'">'+ m+'</div>';}).join('');
  var hdr='<div class="gr gw" style="border-bottom:.5px solid var(--border)"><div class="gc" style="text-align:left;padding-left:8px;font-size:11px;font-weight:500">Audit</div>'+months+'</div>';
  var body=rows.map(function(a,idx){
    var start=a.dateDebut?parseInt(a.dateDebut)-1:-1;
    var end=a.dateFin?parseInt(a.dateFin)-1:-1;
    var hasDate=start>=0&&end>=0;
    var cells=MO.map(function(_,m){
      var isToday=m===curMonth;
      var inRange=hasDate&&m>=start&&m<=end;
      var isFirst=hasDate&&m===start;
      var isLast=hasDate&&m===end;
      var bar='';
      if(inRange){
        var radius=isFirst&&isLast?'4px':isFirst?'4px 0 0 4px':isLast?'0 4px 4px 0':'0';
        bar='<div class="gb" style="background:'+GC[idx%GC.length]+';border-radius:'+radius+';height:22px;margin:2px 1px;display:flex;align-items:center;justify-content:center">'+(isFirst?'<span style="font-size:9px;color:rgba(0,0,0,0.5);padding-left:4px">'+MO[start]+'</span>':'')+'</div>';
      }
      return'<div class="gm'+(isToday?' td':'')+'" style="'+(isToday?'background:rgba(83,74,183,0.05)':'')+'">'+bar+'</div>';
    }).join('');
    var bdg=a.type==='Process'?'bpc':'bbu';
    var label=a.type==='Process'?'P':'BU';
    var title=a.titre.length>18?a.titre.slice(0,17)+'…':a.titre;
    var noDate=!hasDate?'<span style="font-size:9px;color:#bbb;margin-left:4px">dates non définies</span>':'';
    return'<div class="gr" style="border-bottom:.5px solid var(--border)"><div class="gn2" style="display:flex;align-items:center;gap:5px"><span class="badge '+bdg+'" style="font-size:9px;padding:1px 5px;flex-shrink:0">'+label+'</span><span style="font-size:11px">'+title+'</span>'+noDate+'</div>'+cells+'</div>';
  }).join('');
  document.getElementById('gantt-wrap').innerHTML=hdr+(body||'<div style="padding:2rem;color:#aaa;text-align:center;font-size:12px">Aucun audit pour cette période</div>');
}

// ══════════════════════════════════════════════════════════════
//  PLANS D'ACTION (inchangé)
// ══════════════════════════════════════════════════════════════
V['plans-action']=()=>`
  <div class="topbar"><div class="tbtitle">Suivi des plans d'action</div><button class="bp" onclick="showNewActionModal()">+ Ajouter</button></div>
  <div class="content">
    <div class="metrics">
      <div class="mc"><div class="ml">Total</div><div class="mv">${ACTIONS.length}</div></div>
      <div class="mc"><div class="ml">En cours</div><div class="mv" style="color:var(--purple)">${ACTIONS.filter(function(a){return a.status==='En cours';}).length}</div></div>
      <div class="mc"><div class="ml">En retard</div><div class="mv" style="color:var(--red)">${ACTIONS.filter(function(a){return a.status==='En retard';}).length}</div></div>
      <div class="mc"><div class="ml">Issus de findings</div><div class="mv" style="color:var(--green)">${ACTIONS.filter(function(a){return a.fromFinding;}).length}</div></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:1rem">
      <select id="f-pa-st" onchange="renderActionList()"><option value="all">Tous statuts</option><option>En cours</option><option>En retard</option><option>Non démarré</option><option>Clôturé</option></select>
    </div>
    <div id="action-list"></div>
  </div>`;
I['plans-action']=()=>renderActionList();

function renderActionList(){
  var fs=document.getElementById('f-pa-st')&&document.getElementById('f-pa-st').value||'all';
  var rows=ACTIONS.filter(function(a){return fs==='all'||a.status===fs;});
  var fc={'En retard':'var(--red)','Clôturé':'var(--green)','Non démarré':'var(--gray)','En cours':'var(--purple)'};
  document.getElementById('action-list').innerHTML=rows.map(function(a){
    return '<div class="card" style="margin-bottom:6px">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><div style="font-size:12px;font-weight:500;flex:1">'+a.title+'</div>'
      +badge(a.status)
      +(a.fromFinding?'<span class="tag-new">↗ Finding</span>':'')
      +'</div>'
      +'<div style="font-size:11px;color:var(--text-2);margin-bottom:4px">Audit : '+a.audit+' · Resp. : '+a.resp+' · Dept : <strong>'+a.dept+'</strong> · Éch. : '+a.quarter+' '+a.year+(a.findingTitle?'<span style="color:var(--text-3)"> · "'+a.findingTitle+'"</span>':'')+'</div>'
      +'<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:5px;background:var(--bg);border-radius:3px;overflow:hidden"><div style="height:100%;border-radius:3px;background:'+(fc[a.status]||'var(--purple)')+';width:'+a.pct+'%"></div></div><span style="font-size:10px;color:var(--text-3)">'+a.pct+'%</span></div>'
      +'</div>';
  }).join('')||'<div style="font-size:12px;color:var(--text-3)">Aucun plan d\'action.</div>';
}

async function showNewActionModal(){
  openModal("Nouveau plan d'action",
    '<div><label>Titre</label><input id="pa-title" placeholder="ex : Revue des accès ERP"/></div>'
    +'<div><label>Lié à l\'audit</label><select id="pa-audit">'+AUDIT_PLAN.map(function(a){return'<option>'+a.titre+'</option>';}).join('')+'</select></div>'
    +'<div><label>Responsable</label><select id="pa-resp"><option>Selma H.</option><option>Nisrine E.</option></select></div>'
    +'<div><label>Département owner</label><input id="pa-dept" placeholder="ex : Finance, IT, RH..."/></div>'
    +'<div><label>Entité</label><select id="pa-ent"><option>Groupe</option><option>74S</option><option>SBS</option><option>AXW</option></select></div>'
    +'<div class="g2"><div><label>Année</label><select id="pa-yr"><option>2025</option><option>2026</option><option>2027</option><option>2028</option></select></div><div><label>Trimestre</label><select id="pa-q"><option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option></select></div></div>',
    async function(){
      var title=document.getElementById('pa-title').value.trim();
      if(!title){toast('Titre obligatoire');return;}
      var newAc={id:'ac'+Date.now(),title,audit:document.getElementById('pa-audit').value,resp:document.getElementById('pa-resp').value,dept:document.getElementById('pa-dept').value||'—',ent:document.getElementById('pa-ent').value,year:parseInt(document.getElementById('pa-yr').value),quarter:document.getElementById('pa-q').value,status:'Non démarré',pct:0,fromFinding:false};
      ACTIONS.unshift(newAc);await saveAction(newAc);renderActionList();toast("Plan d'action créé ✓");
    });
}

async function deleteAction(id){
  var idx=ACTIONS.findIndex(function(a){return a.id===id;});
  if(idx===-1)return;
  if(!confirm('Supprimer "'+ACTIONS[idx].title+'" ?'))return;
  await sbDelete('af_actions',id);
  ACTIONS.splice(idx,1);
  addHist('del',"Plan d'action supprimé");
  renderActionList();
  toast("Plan d'action supprimé");
}

// ══════════════════════════════════════════════════════════════
//  HISTORIQUE (inchangé)
// ══════════════════════════════════════════════════════════════
V['historique']=()=>`<div class="topbar"><div class="tbtitle">Historique des modifications</div></div>
  <div class="content"><div class="card" id="hl"></div></div>`;
I['historique']=()=>{
  var dc={add:'var(--green)',edit:'var(--purple)',arch:'var(--amber)',del:'var(--red)'};
  document.getElementById('hl').innerHTML=HISTORY_LOG.length
    ?HISTORY_LOG.map(function(h){return'<div style="display:flex;gap:10px;padding:.625rem 0;border-bottom:.5px solid var(--border)"><div style="width:8px;height:8px;border-radius:50%;background:'+(dc[h.type]||'var(--purple)')+';margin-top:4px;flex-shrink:0"></div><div><div style="font-size:12px">'+h.msg+'</div><div style="font-size:10px;color:var(--text-3);margin-top:2px">'+h.user+' · '+h.date+'</div></div></div>';}).join('')
    :'<div style="font-size:12px;color:var(--text-3)">Aucune modification.</div>';
};

// ══════════════════════════════════════════════════════════════
//  RÔLES & ACCÈS (inchangé)
// ══════════════════════════════════════════════════════════════
V['roles']=()=>`
  <div class="topbar"><div class="tbtitle">Rôles & Accès</div><button class="bp" onclick="showInviteModal()">+ Inviter</button></div>
  <div class="content">
    ${PENDING.length?('<div style="margin-bottom:1rem"><div class="st" style="margin-bottom:.5rem">Demandes en attente ('+PENDING.length+')</div>'+PENDING.map(function(u,pi){return'<div class="card" style="margin-bottom:6px;display:flex;align-items:center;gap:10px"><div style="flex:1"><div style="font-size:12px;font-weight:500">'+u.name+'</div><div style="font-size:11px;color:var(--text-2)">'+u.email+'</div></div><button class="bp" style="font-size:11px" onclick="approveUser('+pi+')">Valider</button><button class="bd" style="font-size:11px" onclick="rejectUser('+pi+')">Refuser</button></div>';}).join('')+'</div>'):''}
    <div class="tw"><table><thead><tr><th>Membre</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Modifier</th></tr></thead><tbody id="utbl"></tbody></table></div>
    <div class="card" style="margin-top:1rem;font-size:12px;color:var(--text-2);line-height:1.8">
      <strong>Admin / Directeur</strong> — accès complet, validation des étapes, gestion du Plan Audit et des utilisateurs.<br>
      <strong>Auditrice</strong> — accès à ses audits assignés, remplissage des tâches, contrôles, findings et documents.
    </div>
  </div>`;
I['roles']=()=>renderUsersTbl();

function renderUsersTbl(){
  var RL={admin:'Admin / Directeur',auditeur:'Auditrice',audite:'Audité'};
  var RB={admin:'bpc',auditeur:'bdn',audite:'btg'};
  document.getElementById('utbl').innerHTML=USERS.map(function(u,i){
    return'<tr><td style="font-weight:500">'+u.name+'</td><td style="color:var(--text-2);font-size:11px">'+u.email+'</td>'
      +'<td><span class="badge '+(RB[u.role]||'bpl')+'">'+(RL[u.role]||u.role)+'</span></td>'
      +'<td><span style="font-size:11px;color:var(--green)">● '+u.status+'</span></td>'
      +'<td><select style="font-size:11px;padding:3px 7px;border:.5px solid var(--border-md);border-radius:var(--radius);background:var(--bg-card)" onchange="changeRole('+i+',this.value)">'
      +'<option value="admin" '+(u.role==='admin'?'selected':'')+'>Admin / Directeur</option>'
      +'<option value="auditeur" '+(u.role==='auditeur'?'selected':'')+'>Auditrice</option>'
      +'<option value="audite" '+(u.role==='audite'?'selected':'')+'>Audité</option>'
      +'</select></td></tr>';
  }).join('');
}
function changeRole(i,r){USERS[i].role=r;renderUsersTbl();toast('Rôle mis à jour');}
function approveUser(i){var u=PENDING[i];u.status='actif';USERS.push(u);PENDING.splice(i,1);addHist('add','Accès validé pour '+u.name);nav('roles');toast('Accès accordé à '+u.name+' ✓');}
function rejectUser(i){var u=PENDING[i];PENDING.splice(i,1);addHist('del','Demande refusée pour '+u.name);nav('roles');toast('Refusé');}
function showInviteModal(){
  openModal('Inviter un membre',
    '<div><label>Prénom Nom</label><input id="iv-nm" placeholder="ex : Jean Martin"/></div>'
    +'<div><label>Email</label><input id="iv-em" placeholder="jean@groupe.com"/></div>'
    +'<div><label>Mot de passe provisoire</label><input id="iv-pw" type="password" placeholder="••••••••"/></div>'
    +'<div><label>Rôle</label><select id="iv-rl"><option value="admin">Admin / Directeur</option><option value="auditeur" selected>Auditrice</option><option value="audite">Audité</option></select></div>',
    function(){
      var name=document.getElementById('iv-nm').value.trim();
      var email=document.getElementById('iv-em').value.trim();
      var pwd=document.getElementById('iv-pw').value;
      if(!name||!email||!pwd){toast('Champs obligatoires');return;}
      USERS.push({id:'u'+Date.now(),name,email,pwd,role:document.getElementById('iv-rl').value,status:'actif'});
      addHist('add',name+' invité(e)');renderUsersTbl();toast(name+' ajouté(e) ✓');
    });
}

// ══════════════════════════════════════════════════════════════
//  AUDIT DETAIL (inchangé — tout le code original conservé)
// ══════════════════════════════════════════════════════════════
V['mes-audits']=()=>`
  <div class="topbar"><div class="tbtitle">Mes audits</div><button class="bp ao" onclick="nav('plan-audit')">+ Nouvel audit</button></div>
  <div class="content">
    <div style="display:flex;gap:8px;margin-bottom:1rem">
      <select id="f-ty" onchange="renderAuditList()"><option value="all">Process + BU</option><option value="Process">Process</option><option value="BU">BU</option></select>
      <select id="f-st" onchange="renderAuditList()"><option value="all">Tous statuts</option><option>En cours</option><option>Planifié</option><option>Clôturé</option></select>
    </div>
    <div id="audit-list"></div>
  </div>`;
I['mes-audits']=()=>renderAuditList();

function renderAuditList(){
  var ft=document.getElementById('f-ty')&&document.getElementById('f-ty').value||'all';
  var fs=document.getElementById('f-st')&&document.getElementById('f-st').value||'all';
  var rows=getAudits().filter(function(a){return(ft==='all'||a.type===ft)&&(fs==='all'||a.status===fs);});
  document.getElementById('audit-list').innerHTML=rows.length
    ?rows.map(function(a){return'<div class="ar" onclick="openAudit(\''+a.id+'\')">'
      +'<div style="flex:1"><div class="an">'+a.name+'</div><div class="am">'+a.ent+' · '+a.type+'</div></div>'
      +'<div style="display:flex;gap:2px">'+((a.assignedTo||[]).map(function(id){return avEl(id,20);}).join(''))+'</div>'
      +'<span class="badge '+(a.type==='Process'?'bpc':'bbu')+'">'+a.type+'</span>'
      +badge(a.status)
      +'<div>'+pbar(a.status)+'</div>'
      +'</div>';}).join('')
    :'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun audit.</div>';
}

async function openAudit(id){CA=id;var found=getAudits().find(function(a){return a.id===id;});CS=found?found.step||0:0;CT='roles';await loadAuditData(id);nav('audit-detail');}

// (Le reste des fonctions audit-detail, contrôles, findings, maturity, mgt-resp, docs, notes
//  sont strictement identiques à l'original — on les conserve tels quels)

V['audit-detail']=()=>{
  const a=getAudits().find(x=>x.id===CA);
  if(!a) return '<div class="content">Audit introuvable.</div>';
  const pct = Math.min(100, (CS + 1) * 10);
  return `
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="bs" onclick="nav('mes-audits')">← Retour</button>
        <div class="tbtitle">${a.name}</div>
      </div>
      <div style="display:flex;gap:7px">
        <button class="bp" onclick="validerEtape()">Valider l'étape →</button>
      </div>
    </div>
    <div class="content">
      <div class="card" style="margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:14px;font-weight:600">${a.name}</div>
          <div style="font-size:11px;color:var(--text-2);margin-top:2px">${a.ent} · ${a.type} Audit</div>
        </div>
      </div>
      <div class="card" style="display:flex;align-items:center;gap:12px;margin-bottom:1rem">
        <span style="font-size:11px;color:var(--text-2);white-space:nowrap" id="gp-lbl">Étape ${CS+1}/11 — ${STEPS[CS].s}</span>
        <div class="pbar" style="flex:1"><div class="pfill" id="gp-fill" style="width:${pct}%"></div></div>
        <span style="font-size:11px;color:var(--text-2)" id="gp-pct">${pct}%</span>
      </div>
      <div class="card" style="margin-bottom:1rem" id="stepper-card">${renderStepper()}</div>
      <div class="tabs" id="det-tabs">${renderDetTabs()}</div>
      <div id="det-content">${renderDetContent()}</div>
    </div>`;
};
I['audit-detail']=()=>{};

function getStepTabs(){if(CS===4)return['roles','tasks','controls','docs','notes'];if(CS===5)return['roles','tasks','controls-exec','findings-exec','docs','notes'];if(CS===6)return['roles','tasks','findings','maturity','docs','notes'];if(CS===8)return['roles','tasks','mgt-resp','docs','notes'];return['roles','tasks','docs','notes'];}
const TLBL={'roles':'Rôles','tasks':'Tâches','controls':'Contrôles','controls-exec':'Contrôles & Tests','findings-exec':'Findings (tests)','findings':'Findings','maturity':'Overall Maturity','mgt-resp':'Mgt Response','docs':'Documents','notes':'Notes'};
function renderDetTabs(){return getStepTabs().map(t=>`<div class="tab ${CT===t?'active':''}" onclick="switchDetTab('${t}')">${TLBL[t]}</div>`).join('');}
function renderStepper(){
  const phases=[[0,1,2],[3,4,5],[6,7,8,9]];
  const pn=['Préparation','Réalisation','Restitution'];
  const d=getAudData(CA);
  return phases.map((idxs,pi)=>`<div class="pl">${pn[pi]}</div><div class="step-row" style="margin-bottom:${pi<2?'1rem':'0'}">${idxs.map(i=>{const cls=i<CS?'done':i===CS?'active':'';const lbl=STEPS[i].s.replace('/',' /').split(' /');const st=(d.tasks[i]||[]);const assigned=[...new Set(st.map(t=>t.assignee).filter(x=>x&&x!=='none'))];return`<div class="step-item ${cls}" onclick="goStep(${i})"><div class="sc">${i<CS?'✓':i+1}</div><div class="sl">${lbl[0]}${lbl[1]?'<br>/'+lbl[1]:''}</div><div style="display:flex;gap:1px;margin-top:2px">${assigned.map(id=>avEl(id,12)).join('')}</div></div>`;}).join('')}</div>`).join('');
}
function renderDetContent(){
  const a=getAudits().find(x=>x.id===CA);
  const s=STEPS[CS];
  const d=getAudData(CA);
  const stepTasks=d.tasks[CS]||[];
  if(CT==='roles'){return`<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem"><div style="font-size:13px;font-weight:600">Étape ${CS+1} — ${s.s}</div>${badge(a.status)}</div><div class="g2" style="margin-bottom:.875rem">${(a.assignedTo||[]).map(id=>{const m=TM[id];if(!m)return'';const my=stepTasks.filter(t=>t.assignee===id);return`<div class="card" style="background:var(--bg)"><div style="font-size:10px;color:var(--text-3);margin-bottom:5px">Auditrice</div><div style="display:flex;align-items:center;gap:7px">${avEl(id,26)}<div><div style="font-size:12px;font-weight:500">${m.name}</div><div style="font-size:10px;color:${my.filter(t=>t.done).length===my.length&&my.length>0?'var(--green)':'var(--amber)'}">${my.length?my.filter(t=>t.done).length+'/'+my.length+' tâches':'Aucune tâche'}</div></div></div></div>`;}).join('')}<div class="card" style="background:var(--bg)"><div style="font-size:10px;color:var(--text-3);margin-bottom:5px">Valideur</div><div style="display:flex;align-items:center;gap:7px">${avEl('pm',26)}<div><div style="font-size:12px;font-weight:500">Philippe M.</div><div style="font-size:10px;color:var(--amber)">Validation requise</div></div></div></div></div>${CU?.role!=='admin'?'<div class="notice">La validation est réservée au Directeur Audit.</div>':''}</div>`;}
  if(CT==='tasks'){const done=stepTasks.filter(t=>t.done).length;return`<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem"><div style="font-size:13px;font-weight:600">Tâches — ${s.s}</div><div style="display:flex;gap:8px;align-items:center"><span style="font-size:11px;color:var(--text-2)">${done}/${stepTasks.length}</span><button class="bs" style="font-size:11px" onclick="showNewTaskModal()">+ Ajouter</button></div></div><div id="task-list">${renderTaskList(stepTasks,a)}</div></div>`;}
  if(CT==='controls'){const ctrls=d.controls[CS]||[];return`<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem"><div style="font-size:13px;font-weight:600">Contrôles identifiés</div><button class="bs" style="font-size:11px" onclick="showAddControlModal()">+ Ajouter</button></div>${buildControlList(ctrls)}</div>`;}
  if(CT==='controls-exec'){const step5c=d.controls[4]||[];const keyExist=step5c.filter(c=>c.clef&&c.design==='existing');const targets=step5c.filter(c=>c.design==='target');return`<div class="card"><div style="font-size:13px;font-weight:600;margin-bottom:.875rem">Tests — Contrôles clefs existants</div>${keyExist.length?buildExecTable(keyExist):'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun contrôle clef existant.</div>'}<div style="font-size:13px;font-weight:600;margin:.875rem 0 .5rem">Contrôles Target — anomalies automatiques</div>${buildTargetList(targets)}</div>`;}
  if(CT==='findings-exec'||CT==='findings'){const step5c=d.controls[4]||[];const step6c=(d.controls[4]||[]).filter(x=>x.clef&&x.design==='existing'&&x.finalized&&x.result==='fail');const failF=step6c.filter(c=>c.finding);const targetF=step5c.filter(c=>c.design==='target');const manualF=d.findings||[];return`<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem"><div style="font-size:13px;font-weight:600">Findings</div><button class="bs" style="font-size:11px" onclick="showAddFindingModal()">+ Ajouter un finding</button></div>${failF.length?('<div style="font-size:11px;font-weight:500;color:var(--text-2);margin-bottom:.5rem">Contrôles - Fail</div>'+failF.map(ctrl=>'<div class="fr"><div class="fh"><span class="badge bfl">Fail</span><div class="ft">'+ctrl.name+'</div></div><div style="font-size:11px;color:var(--text-2)">'+ctrl.finding+'</div></div>').join('')):''}${targetF.length?('<div style="font-size:11px;font-weight:500;color:var(--text-2);margin:.75rem 0 .5rem">Contrôles non existants (Target)</div>'+targetF.map(ctrl=>'<div class="fr"><div class="fh"><span class="badge btg">Target</span><div class="ft">'+ctrl.name+'</div></div><div style="font-size:11px;color:var(--red)">Contrôle non existant.</div></div>').join('')):''}${manualF.length?('<div style="font-size:11px;font-weight:500;color:var(--text-2);margin:.75rem 0 .5rem">Findings additionnels</div>'+manualF.map((f,idx2)=>'<div class="fr"><div class="fh"><span class="badge bpc">Finding</span><div class="ft">'+f.title+'</div><button class="bd" style="font-size:10px;padding:2px 6px" onclick="removeManualFinding('+idx2+')">X</button></div><div style="font-size:11px;color:var(--text-2)">'+f.desc+'</div></div>').join('')):''}${!failF.length&&!targetF.length&&!manualF.length?'<div style="font-size:12px;color:var(--text-3)">Aucun finding pour le moment.</div>':''}</div>`;}
  if(CT==='maturity'){const d=getAudData(CA);if(!d.maturity)d.maturity={level:'',notes:'',saved:false};const MLEVELS=[{key:'unsatisfactory',label:'Unsatisfactory',color:'#A32D2D',bg:'#FCEBEB',def:'Contrôle interne insuffisant.',meas:'Plus de 70% des contrôles testés sont en Fail.'},{key:'major',label:'Major Improvements Needed',color:'#854F0B',bg:'#FAEEDA',def:'Le cadre de contrôle présente des lacunes importantes.',meas:'40 à 70% des contrôles testés en Fail.'},{key:'some',label:'Some Improvements Needed',color:'#1D6B45',bg:'#E1F5EE',def:'Des améliorations ponctuelles sont nécessaires.',meas:'10 à 40% des contrôles en Fail.'},{key:'effective',label:'Effective',color:'#3B6D11',bg:'#EAF3DE',def:'Le cadre de contrôle est solide et efficace.',meas:'Moins de 10% des contrôles en Fail.'}];const step6c=(d.controls[4]||[]).filter(x=>x.clef&&x.design==='existing'&&x.finalized);const failCount=step6c.filter(x=>x.result==='fail').length;const passCount=step6c.filter(x=>x.result==='pass').length;const targetCount=(d.controls[4]||[]).filter(x=>x.design==='target').length;const ratio=step6c.length?failCount/step6c.length:0;const suggestedKey=step6c.length===0?'':ratio>0.7?'unsatisfactory':ratio>0.4?'major':ratio>0.1?'some':'effective';const sugLabel=suggestedKey?MLEVELS.find(l=>l.key===suggestedKey):null;let html='<div class="card">';html+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem"><div style="font-size:13px;font-weight:600">Overall Process Maturity</div>'+(d.maturity.saved?'<span class="tag-new">✓ Évaluation sauvegardée</span>':'')+'</div>';html+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:1rem"><div class="card" style="background:var(--bg);text-align:center"><div style="font-size:10px;color:var(--text-3);margin-bottom:3px">Tests finalisés</div><div style="font-size:20px;font-weight:600">'+step6c.length+'</div></div><div class="card" style="background:var(--green-lt);text-align:center"><div style="font-size:10px;color:var(--text-3);margin-bottom:3px">Pass</div><div style="font-size:20px;font-weight:600;color:var(--green)">'+passCount+'</div></div><div class="card" style="background:var(--red-lt);text-align:center"><div style="font-size:10px;color:var(--text-3);margin-bottom:3px">Fail + Target</div><div style="font-size:20px;font-weight:600;color:var(--red)">'+(failCount+targetCount)+'</div></div></div>';if(sugLabel)html+='<div style="background:var(--purple-lt);border:.5px solid var(--purple);border-radius:var(--radius);padding:8px 12px;font-size:12px;color:var(--purple-dk);margin-bottom:1rem">Niveau suggéré : <strong>'+sugLabel.label+'</strong></div>';html+='<div style="font-size:12px;font-weight:500;color:var(--text-2);margin-bottom:.625rem">Sélectionnez le niveau de maturité :</div><div style="display:flex;flex-direction:column;gap:8px;margin-bottom:1rem">';MLEVELS.forEach(l=>{const sel=d.maturity.level===l.key;html+='<div onclick="setMaturity(\''+l.key+'\')" style="border:2px solid '+(sel?l.color:'var(--border)')+';border-radius:var(--radius);padding:.875rem 1rem;cursor:pointer;background:'+(sel?l.bg:'var(--bg-card)')+';transition:all .15s"><div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><div style="width:14px;height:14px;border-radius:50%;border:2px solid '+l.color+';background:'+(sel?l.color:'transparent')+';flex-shrink:0"></div><div style="font-size:13px;font-weight:600;color:'+l.color+'">'+l.label+'</div></div><div style="padding-left:24px"><div style="font-size:11px;color:var(--text-2);margin-bottom:4px"><strong>Définition :</strong> '+l.def+'</div><div style="font-size:11px;color:var(--text-3)"><strong>Mesure :</strong> '+l.meas+'</div></div></div>';});html+='</div><div style="font-size:12px;font-weight:500;color:var(--text-2);margin-bottom:.375rem">Commentaires</div><textarea id="maturity-notes" style="width:100%;min-height:80px;resize:vertical;font-size:12px" placeholder="Justifiez votre évaluation...">'+(d.maturity.notes||'')+'</textarea><div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="bp" onclick="saveMaturity()">Sauvegarder</button></div></div>';return html;}
  if(CT==='mgt-resp'){const step5c=d.controls[4]||[];const step6c=(d.controls[4]||[]).filter(x=>x.clef&&x.design==='existing'&&x.finalized&&x.result==='fail');const allFindings=[...step6c.filter(c=>c.finding).map(c=>({id:'f_'+c.name,title:c.name,desc:c.finding,type:'fail'})),...step5c.filter(c=>c.design==='target').map(c=>({id:'t_'+c.name,title:c.name,desc:'Contrôle non existant',type:'target'})),...(d.findings||[]).map((f,i)=>({id:'m_'+i,title:f.title,desc:f.desc,type:'manual'}))];if(!d.mgtResp)d.mgtResp=[];allFindings.forEach(f=>{if(!d.mgtResp.find(r=>r.findingId===f.id))d.mgtResp.push({findingId:f.id,action:'',owner:'',year:2026,quarter:'Q1',pushed:false});});return`<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem"><div style="font-size:13px;font-weight:600">Management Responses</div><button class="bs" style="font-size:11px" onclick="pushAllMgtResp()">Envoyer vers Plans d'action →</button></div>${allFindings.length?allFindings.map((f,fi)=>{const resp=d.mgtResp.find(r=>r.findingId===f.id)||{};const tbadge={fail:'bfl',target:'btg',manual:'bpc'}[f.type];return`<div class="mr-row"><div class="mr-hdr"><span class="badge ${tbadge}">${f.type==='fail'?'Fail':f.type==='target'?'Target':'Finding'}</span><div class="mr-title">${f.title}</div>${resp.pushed?'<span class="tag-new">✓ Envoyé</span>':''}</div><div style="font-size:11px;color:var(--text-2);margin-bottom:.625rem">${f.desc}</div><div class="mr-fields"><div><label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px">Action</label><input style="font-size:11px" placeholder="Action corrective..." value="${resp.action||''}" onchange="setMgtResp('${f.id}','action',this.value)"/></div><div><label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px">Owner</label><input style="font-size:11px" placeholder="ex : Finance, IT..." value="${resp.owner||''}" onchange="setMgtResp('${f.id}','owner',this.value)"/></div><div><label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px">Deadline</label><div style="display:flex;gap:4px"><select style="font-size:11px" onchange="setMgtResp('${f.id}','year',parseInt(this.value))"><option ${resp.year===2025?'selected':''}>2025</option><option ${resp.year===2026?'selected':''} selected>2026</option><option ${resp.year===2027?'selected':''}>2027</option><option ${resp.year===2028?'selected':''}>2028</option></select><select style="font-size:11px" onchange="setMgtResp('${f.id}','quarter',this.value)"><option ${resp.quarter==='Q1'?'selected':''}>Q1</option><option ${resp.quarter==='Q2'?'selected':''}>Q2</option><option ${resp.quarter==='Q3'?'selected':''}>Q3</option><option ${resp.quarter==='Q4'?'selected':''}>Q4</option></select></div></div></div></div>`;}).join(''):'<div style="font-size:12px;color:var(--text-3)">Aucun finding identifié.</div>'}</div>`;}
  if(CT==='docs'){var reqDocs=REQUIRED_DOCS[CS]||[];var reqHtml='';if(reqDocs.length){reqHtml='<div style="background:#f0effe;border:.5px solid #AFA9EC;border-radius:6px;padding:8px 12px;margin-bottom:.75rem;font-size:11px"><div style="font-weight:600;color:#3C3489;margin-bottom:5px">Documents requis :</div>';reqDocs.forEach(function(req){var ok=(d.docs||[]).some(function(f){return f.name.toLowerCase().indexOf(req.toLowerCase())!==-1;});reqHtml+='<div style="display:flex;align-items:center;gap:6px;padding:2px 0"><span style="color:'+(ok?'#1D9E75':'#E24B4A')+';font-size:14px;font-weight:bold">'+(ok?'✓':'✗')+'</span><span style="color:'+(ok?'#085041':'#A32D2D')+';'+(ok?'opacity:.7;text-decoration:line-through':'')+'">' +req+'</span>'+(ok?'':'<span style="font-size:10px;color:#A32D2D;background:#FCE8E8;padding:1px 6px;border-radius:10px">requis</span>')+'</div>';});reqHtml+='</div>';}return'<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem"><div style="font-size:13px;font-weight:600">Documents</div><button class="bs" style="font-size:11px" onclick="addFakeDoc()">+ Ajouter</button></div>'+reqHtml+'<div class="uz" onclick="addFakeDoc()"><div style="font-size:12px;color:var(--text-2)">Glissez vos fichiers ou cliquez</div><div style="font-size:10px;color:var(--text-3);margin-top:2px">PDF, Excel, Word, PowerPoint</div></div><div id="doc-list">'+buildDocList(d.docs)+'</div></div>';}
  if(CT==='notes'){return`<div class="card"><div style="font-size:13px;font-weight:600;margin-bottom:.75rem">Notes de l'auditeur</div><textarea style="width:100%;min-height:120px;resize:vertical" placeholder="Observations, constats...">${d.notes||''}</textarea><div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="bp" onclick="saveNotes()">Sauvegarder</button></div></div>`;}
  return'';
}

function goStep(i){CS=i;const tabs=getStepTabs();if(!tabs.includes(CT))CT='roles';const pct=Math.min(100,(i+1)*10);document.getElementById('stepper-card').innerHTML=renderStepper();document.getElementById('gp-fill').style.width=pct+'%';document.getElementById('gp-pct').textContent=pct+'%';document.getElementById('gp-lbl').textContent=`Étape ${i+1}/11 — ${STEPS[i].s}`;document.getElementById('det-tabs').innerHTML=renderDetTabs();document.getElementById('det-content').innerHTML=renderDetContent();}
function switchDetTab(tab){CT=tab;document.getElementById('det-tabs').innerHTML=renderDetTabs();document.getElementById('det-content').innerHTML=renderDetContent();}

var REQUIRED_DOCS={0:['Audit Planning Memo'],1:['Work Program'],2:['Kick Off Slides','Meeting Invitation'],3:['Narratif'],4:['Testing Strategy'],5:['Testing Documentation'],6:['Rapport']};
function getMissingDocs(stepIndex,docs){var required=REQUIRED_DOCS[stepIndex];if(!required||!required.length)return[];var uploadedNames=(docs||[]).map(function(f){return f.name.toLowerCase();});return required.filter(function(req){return!uploadedNames.some(function(name){return name.indexOf(req.toLowerCase())!==-1;});});}
async function validerEtape(){var ap=AUDIT_PLAN.find(function(a){return a.id===CA;});var d=getAudData(CA);var missing=getMissingDocs(CS,d.docs);if(missing.length){var msg='Document(s) requis :\n';missing.forEach(function(m){msg+='  • '+m+'\n';});alert(msg);return;}if(CS<9){CS++;if(ap){ap.statut='En cours';ap.step=CS;}await saveAuditPlan(ap);addHist('edit','Etape '+CS+' validée — '+(ap?ap.titre:''));goStep(CS);toast('"'+STEPS[CS].s+'" validée ✓');}else{if(ap){ap.statut='Clôturé';ap.step=9;await saveAuditPlan(ap);}toast('Mission clôturée ✓');}}
function renderTaskList(st,a){if(!st.length)return'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucune tâche.</div>';return st.map((t,i)=>`<div class="ti"><div class="tcb ${t.done?'done':''}" onclick="toggleTask(${i})">${t.done?'✓':''}</div><div class="tt ${t.done?'dt':''}">${t.desc}</div><select style="font-size:11px;padding:2px 6px;border-radius:20px;background:var(--bg)" onchange="reassignTask(${i},this.value)"><option value="none" ${!t.assignee||t.assignee==='none'?'selected':''}>—</option>${buildAssigneeOpts(a.assignedTo,t.assignee)}</select><span style="font-size:10px;color:${t.done?'var(--green)':t.assignee&&t.assignee!=='none'?'var(--purple)':'var(--text-3)'}">${t.done?'✓':t.assignee&&t.assignee!=='none'?'En cours':'À faire'}</span></div>`).join('');}
async function toggleTask(i){const d=getAudData(CA);if(!d.tasks[CS])d.tasks[CS]=[];d.tasks[CS][i].done=!d.tasks[CS][i].done;await saveAuditData(CA);const a=getAudits().find(x=>x.id===CA);document.getElementById('task-list').innerHTML=renderTaskList(d.tasks[CS],a);document.getElementById('stepper-card').innerHTML=renderStepper();}
async function reassignTask(i,val){const d=getAudData(CA);if(d.tasks[CS]&&d.tasks[CS][i])d.tasks[CS][i].assignee=val;await saveAuditData(CA);document.getElementById('stepper-card').innerHTML=renderStepper();if(val!=='none')toast(`Assigné à ${TM[val]?.name}`);}
function showNewTaskModal(){const a=getAudits().find(x=>x.id===CA);openModal('Nouvelle tâche',`<div><label>Description</label><input id="t-desc" placeholder="ex : Analyser les données..."/></div><div><label>Assignée à</label><select id="t-assign"><option value="none">— Non assignée</option>${buildAssigneeOpts(a.assignedTo,null)}</select></div>`,async ()=>{const desc=document.getElementById('t-desc').value.trim();if(!desc){toast('Description obligatoire');return;}const d=getAudData(CA);if(!d.tasks[CS])d.tasks[CS]=[];d.tasks[CS].push({desc,assignee:document.getElementById('t-assign').value,done:false});await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();document.getElementById('stepper-card').innerHTML=renderStepper();toast('Tâche créée ✓');});}
function showAddControlModal(){openModal('Ajouter un contrôle',`<div><label>Nom du contrôle</label><input id="c-name" placeholder="ex : Rapprochement mensuel des soldes"/></div><div><label>Contrôle owner</label><input id="c-owner" placeholder="ex : Finance"/></div><div class="g2"><div><label>Fréquence</label><select id="c-freq"><option>Mensuel</option><option>Trimestriel</option><option>Semestriel</option><option>Annuel</option><option>Ad hoc</option></select></div><div><label>Contrôle clef ?</label><select id="c-clef"><option value="1">Oui — sera testé</option><option value="0">Non</option></select></div></div><div><label>Design</label><select id="c-design"><option value="existing">Existing</option><option value="target">Target</option></select></div>`,async ()=>{const name=document.getElementById('c-name').value.trim();if(!name){toast('Nom obligatoire');return;}const d=getAudData(CA);if(!d.controls[CS])d.controls[CS]=[];d.controls[CS].push({name,owner:document.getElementById('c-owner').value,freq:document.getElementById('c-freq').value,clef:document.getElementById('c-clef').value==='1',design:document.getElementById('c-design').value,result:null,testNature:'',finding:''});await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();toast('Contrôle ajouté ✓');});}
async function removeControl(i){const d=getAudData(CA);d.controls[CS].splice(i,1);await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();}
async function setTestNature(i,val){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(c=>c.clef&&c.design==='existing');if(kc[i]){kc[i].testNature=val;await saveAuditData(CA);}}
async function setTestResult(i,val){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(c=>c.clef&&c.design==='existing');if(kc[i]){kc[i].result=val;await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();}}
async function setFinding(i,val){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(c=>c.clef&&c.design==='existing');if(kc[i]){kc[i].finding=val;await saveAuditData(CA);}}
function showAddFindingModal(){openModal('Nouveau finding',`<div><label>Titre</label><input id="f-title" placeholder="ex : Absence de contrôle sur les accès"/></div><div><label>Description</label><textarea id="f-desc" style="height:80px" placeholder="Décrivez l'anomalie..."></textarea></div>`,async ()=>{const title=document.getElementById('f-title').value.trim();if(!title){toast('Titre obligatoire');return;}const d=getAudData(CA);d.findings.push({title,desc:document.getElementById('f-desc').value.trim()});await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();toast('Finding ajouté ✓');});}
async function removeManualFinding(i){const d=getAudData(CA);d.findings.splice(i,1);await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();}
async function setMgtResp(findingId,field,val){const d=getAudData(CA);const r=d.mgtResp.find(x=>x.findingId===findingId);if(r){r[field]=val;await saveAuditData(CA);}}
function pushAllMgtResp(){const d=getAudData(CA);const ap=AUDIT_PLAN.find(a=>a.id===CA);const pushed=d.mgtResp.filter(r=>r.action&&r.owner&&!r.pushed);if(!pushed.length){toast('Aucune réponse complète à envoyer');return;}pushed.forEach(r=>{const step5c=d.controls[4]||[];const step6c=d.controls[5]||[];const allF=[...step6c.filter(c=>c.result==='fail'&&c.finding).map(c=>({id:'f_'+c.name,title:c.name})),...step5c.filter(c=>c.design==='target').map(c=>({id:'t_'+c.name,title:c.name})),...(d.findings||[]).map((f,i)=>({id:'m_'+i,title:f.title}))];const f=allF.find(x=>x.id===r.findingId);if(!f)return;ACTIONS.unshift({id:'ac'+Date.now()+Math.random(),title:r.action,audit:ap?.titre||'—',resp:CU?.name||'—',dept:r.owner,ent:ap?.type==='BU'?ap.entite:'Groupe',year:r.year,quarter:r.quarter,status:'Non démarré',pct:0,fromFinding:true,findingTitle:f.title});r.pushed=true;addHist('add',`Plan d'action créé depuis finding "${f.title}"`);});document.getElementById('det-content').innerHTML=renderDetContent();toast(pushed.length+' plan(s) d\'action créé(s) ✓');}
async function addFakeDoc(){var inp=document.createElement('input');inp.type='file';inp.accept='.pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.csv,.txt';inp.multiple=true;inp.onchange=async function(){if(!inp.files.length)return;for(var fi=0;fi<inp.files.length;fi++){var file=inp.files[fi];toast('Upload : '+file.name+'...');try{await uploadDoc(CA,file,CS,CU?CU.name:'Inconnu');document.getElementById('det-content').innerHTML=renderDetContent();toast(file.name+' uploadé ✓');}catch(e){toast('Erreur : '+e.message);}}};inp.click();}
async function renameDoc(docIndex){var d=getAudData(CA);var doc=d.docs[docIndex];if(!doc)return;var newName=prompt('Nouveau nom :', doc.name);if(!newName||newName.trim()===''||newName===doc.name)return;try{await renameDocInDB(CA,docIndex,newName.trim());document.getElementById('det-content').innerHTML=renderDetContent();toast('Renommé ✓');}catch(e){toast('Erreur : '+e.message);}}
async function replaceDoc(docIndex){var inp=document.createElement('input');inp.type='file';inp.accept='.pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.csv,.txt';inp.onchange=async function(){if(!inp.files.length)return;var file=inp.files[0];toast('Remplacement...');try{await replaceDocInDB(CA,docIndex,file,CS,CU?CU.name:'Inconnu');document.getElementById('det-content').innerHTML=renderDetContent();toast(file.name+' remplacé ✓');}catch(e){toast('Erreur : '+e.message);}};inp.click();}
async function saveNotes(){var d=getAudData(CA);d.notes=document.querySelector('textarea')?document.querySelector('textarea').value:'';await saveAuditData(CA);toast('Notes sauvegardées ✓');}
async function finalizeTest(i){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(x=>x.clef&&x.design==='existing');const ctrl=kc[i];if(!ctrl)return;if(!ctrl.testNature){toast('Veuillez sélectionner la nature du test');return;}if(!ctrl.result){toast('Veuillez indiquer le résultat');return;}if(ctrl.result==='fail'&&!ctrl.finding){toast('Documentez le finding avant de finaliser');return;}ctrl.finalized=true;addHist('edit',`Test finalisé — "${ctrl.name}" : ${ctrl.result}`);await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();toast(`Test "${ctrl.name}" finalisé ✓`);}
function setMaturity(key){const d=getAudData(CA);if(!d.maturity)d.maturity={level:'',notes:'',saved:false};d.maturity.level=key;d.maturity.saved=false;document.getElementById('det-content').innerHTML=renderDetContent();}
async function saveMaturity(){const d=getAudData(CA);if(!d.maturity?.level){toast('Veuillez sélectionner un niveau');return;}d.maturity.notes=document.getElementById('maturity-notes')?.value||'';d.maturity.saved=true;addHist('edit',`Maturité définie : ${d.maturity.level}`);await saveAuditData(CA);toast('Évaluation sauvegardée ✓');document.getElementById('det-content').innerHTML=renderDetContent();}

function buildControlList(ctrls){if(!ctrls||!ctrls.length)return'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun contrôle identifié.</div>';var h='<div class="ch"><span>Contrôle</span><span>Owner</span><span>Fréquence</span><span>Clef ?</span><span>Design</span><span></span></div>';ctrls.forEach(function(ctrl,ci){h+='<div class="cr"><span style="font-weight:500">'+ctrl.name+'</span><span style="color:var(--text-2)">'+ctrl.owner+'</span><span style="color:var(--text-2)">'+ctrl.freq+'</span><span><span class="badge '+(ctrl.clef?'bps':'bpl')+'">'+(ctrl.clef?'Oui':'Non')+'</span></span><span><span class="badge '+(ctrl.design==='existing'?'bdn':'btg')+'">'+(ctrl.design==='existing'?'Existing':'Target')+'</span></span><button class="bd" style="font-size:10px;padding:2px 6px" onclick="removeControl('+ci+')">X</button></div>';});return h;}
function buildTargetList(targets){if(!targets||!targets.length)return'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun contrôle target.</div>';return targets.map(function(ctrl){return'<div class="fr"><div class="fh"><span class="badge btg">Target</span><div class="ft">'+ctrl.name+'</div></div><div style="font-size:11px;color:var(--red)">Contrôle non existant — à définir par '+ctrl.owner+'.</div></div>';}).join('');}
function buildExecTable(kc){let h='<div class="tw"><table><thead><tr><th>Contrôle</th><th>Nature du test</th><th>Résultat</th><th>Finding</th><th>Action</th></tr></thead><tbody>';kc.forEach(function(ctrl,i){const dis=ctrl.finalized?'disabled':'';h+='<tr><td style="font-size:11px;font-weight:500">'+ctrl.name+'</td><td><select onchange="setTestNature('+i+',this.value)" '+dis+' style="font-size:11px"><option value="">-- Nature --</option><option value="Instruction" '+(ctrl.testNature==='Instruction'?'selected':'')+'>Instruction</option><option value="Observation" '+(ctrl.testNature==='Observation'?'selected':'')+'>Observation</option><option value="Re-performance" '+(ctrl.testNature==='Re-performance'?'selected':'')+'>Re-performance</option></select></td><td><select onchange="setTestResult('+i+',this.value)" '+dis+' style="font-size:11px"><option value="">-- Résultat --</option><option value="pass" '+(ctrl.result==='pass'?'selected':'')+'>Pass</option><option value="fail" '+(ctrl.result==='fail'?'selected':'')+'>Fail</option></select></td><td>'+(ctrl.result==='fail'?'<textarea onchange="setFinding('+i+',this.value)" placeholder="Documentez..." '+dis+' style="width:100%;font-size:10px;min-height:40px">'+(ctrl.finding||'')+'</textarea>':'<span style="color:var(--text-3)">-</span>')+'</td><td>'+(ctrl.finalized?'<span class="badge bdn">Finalisé</span>':'<button class="bp" style="font-size:10px;padding:4px 8px" onclick="finalizeTest('+i+')">Finaliser</button>')+'</td></tr>';});return h+'</tbody></table></div>';}
function buildDocList(docs){if(!docs||!docs.length)return'';return docs.map(function(f,fi){var link=f.url?'<a href="'+f.url+'" target="_blank" rel="noopener" style="color:#534AB7;text-decoration:none;font-weight:500">'+f.name+'</a>':'<span style="font-weight:500">'+f.name+'</span>';var meta=[];if(f.uploadedBy)meta.push(f.uploadedBy);if(f.uploadedAt)meta.push(new Date(f.uploadedAt).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}));if(f.step!==undefined&&f.step!==null&&STEPS[f.step])meta.push('Etape '+(f.step+1)+' — '+STEPS[f.step].s);var metaHtml=meta.length?'<div style="font-size:10px;color:#888;padding-left:18px;margin-top:2px">'+meta.join(' · ')+'</div>':'';var delFn="deleteDoc(CA,'"+(f.path||'').replace(/'/g,"\\'")+"','"+(f.name||'').replace(/'/g,"\\'")+'\')';return'<div style="background:#f8f8f8;border-radius:6px;padding:8px 10px;margin-bottom:6px;border:.5px solid #e0e0e0"><div style="display:flex;align-items:center;gap:6px"><span style="color:#534AB7">&#9646;</span><span style="flex:1;font-size:12px">'+link+'</span><span style="font-size:10px;color:#aaa;flex-shrink:0">'+(f.size||'')+'</span><button class="bs" style="font-size:10px;padding:2px 7px" onclick="renameDoc('+fi+')">Renommer</button><button class="bs" style="font-size:10px;padding:2px 7px" onclick="replaceDoc('+fi+')">Remplacer</button><button class="bd" style="font-size:10px;padding:2px 7px" onclick="'+delFn+'">Supprimer</button></div>'+metaHtml+'</div>';}).join('');}
function buildAssigneeOpts(assigned,current){return(assigned||[]).map(function(id){return'<option value="'+id+'"'+(current===id?' selected':'')+'>'+((TM[id]&&TM[id].name)||id)+'</option>';}).join('');}
function buildTplCards(names,badgeCls){return names.map(function(n){return'<div class="card" style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between"><div style="font-size:12px;font-weight:500">'+n+'</div><span class="badge '+badgeCls+'">'+(badgeCls==='bpc'?'Process':'BU')+'</span></div><div style="font-size:11px;color:var(--text-2)">3 phases · 11 étapes</div><button class="bs" style="width:100%">Utiliser</button></div>';}).join('');}

// Helper anti-XSS pour les attributs onclick (apostrophes)
function _escQ(s){return(s||'').replace(/'/g,'&#39;');}
