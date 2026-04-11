const V={},I={};

V['dashboard']=()=>{
  var CY=2026;
  var yearAudits=AUDIT_PLAN.filter(function(a){return a.annee===CY;});
  var yClosed=yearAudits.filter(function(a){return a.statut==='Clôturé';});
  var yInProg=yearAudits.filter(function(a){return a.statut==='En cours';});
  var yPlanned=yearAudits.filter(function(a){return a.statut==='Planifié';});
  var closedPct=yearAudits.length?Math.round(yClosed.length/yearAudits.length*100):0;
  var late=ACTIONS.filter(function(a){return a.status==='En retard';}).slice(0,3);

  var auditRows=yearAudits.length?yearAudits.map(function(ap){
    var detail=ap.type==='Process'?(ap.domaine+' > '+ap.process):(ap.pays||[]).join(', ');
    var avs=(ap.auditeurs||[]).map(function(id){return avEl(id,18);}).join('');
    var pct=ap.statut==='Clôturé'?100:ap.statut==='En cours'?50:0;
    var tb=ap.type==='Process'?'bpc':'bbu';
    var stat=badge(ap.statut||'Planifié');
    return `<tr style="cursor:pointer" onclick="openAudit(this.getAttribute('data-id'))" data-id="${ap.id}">
      <td style="font-weight:500;font-size:11px">${ap.titre}</td>
      <td><span class="badge ${tb}">${ap.type}</span></td>
      <td style="font-size:10px;color:var(--text-2)">${detail}</td>
      <td><div style="display:flex;gap:2px">${avs}</div></td>
      <td>${stat}</td>
      <td><div class="pbar" style="width:80px"><div class="pfill" style="width:${pct}%"></div></div>
      <div style="font-size:10px;color:var(--text-3)">${pct}%</div></td>
      </tr>`;
  }).join(''):'<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:1rem">Aucun audit planifié en '+CY+'</td></tr>';

  var lateRows=late.map(function(a){
    return `<div class="ar"><div style="flex:1"><div class="an">${a.title}</div>
      <div class="am">${a.dept} · ${a.quarter} ${a.year}</div></div>
      ${badge(a.status)}</div>`;
  }).join('')||'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun plan urgent</div>';

  var html="";
  html+=`<div class="topbar"><div class="tbtitle">Tableau de bord — ${CY}</div>`;
  html+='<button class="bp" onclick="nav(\'plan-audit\')">+ Nouvel audit</button></div>';
  html+='<div class="content">';
  html+='<div class="metrics">';
  html+=`<div class="mc"><div class="ml">Audits planifiés ${CY}</div><div class="mv">${yearAudits.length}</div><div class="ms">Plan annuel</div></div>`;
  html+=`<div class="mc"><div class="ml">Clôturés</div><div class="mv" style="color:var(--green)">${yClosed.length}</div><div class="ms">${closedPct}% du plan</div></div>`;
  html+=`<div class="mc"><div class="ml">En cours</div><div class="mv" style="color:var(--purple)">${yInProg.length}</div><div class="ms">Missions actives</div></div>`;
  html+=`<div class="mc"><div class="ml">Planifiés (à démarrer)</div><div class="mv" style="color:var(--amber)">${yPlanned.length}</div><div class="ms">Non démarrés</div></div>`;
  html+='</div>';
  html+='<div style="margin-bottom:1.25rem">';
  html+=`<div class="sth"><div class="st">Audits ${CY}</div><button class="bs" style="font-size:11px" onclick="nav('mes-audits')">Voir tout</button></div>`;
  html+='<div class="tw"><table>';
  html+='<thead><tr><th>Titre</th><th>Type</th><th>Détail</th><th>Auditeurs</th><th>Statut</th><th>Avancement</th></tr></thead>';
  html+='<tbody>'+auditRows+'</tbody></table></div></div>';
  html+='<div class="sth"><div class="st">Plans d\'action urgents</div><button class="bs" style="font-size:11px" onclick="nav(\'plans-action\')">Voir tout</button></div>';
  html+='<div>'+lateRows+'</div>';
  html+='</div>';
  return html;
};

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
  var h=`<thead><tr><th>Type</th><th>Titre</th><th>Detail</th><th>Annee</th><th>Auditeurs</th><th>Statut</th>${CU&&CU.role==='admin'?'<th>Actions</th>':''}</tr></thead><tbody>`;
  if(!rows.length){
    h+='<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:1.5rem">Aucun audit planifie.</td></tr>';
  } else {
    rows.forEach(function(ap){
      var idx=AUDIT_PLAN.indexOf(ap);
      var detail=ap.type==='Process'
        ? `<span style="font-size:11px"><strong>${ap.domaine}</strong> &rsaquo; ${ap.process}</span>`
        : `<span style="font-size:11px"><strong>${ap.entite}</strong> &middot; ${ap.region} &middot; ${(ap.pays||[]).join(', ')}</span>`;
      var avs=(ap.auditeurs||[]).map(function(id){return avEl(id,20);}).join('');
      var tb=ap.type==='Process'?'bpc':'bbu';
      var adminBtn=CU&&CU.role==='admin'
        ? `<td style="white-space:nowrap"><button class="bs" style="font-size:10px;padding:2px 7px" onclick="showEditAuditModal(${idx})">Modifier</button> <button class="bd" style="font-size:10px;padding:2px 7px" onclick="deleteAudit(${idx})">Supprimer</button></td>`
        : '';
      h+='<tr>';
      h+= `<td><span class="badge ${tb}">${ap.type}</span></td>`;
      h+= `<td style="font-weight:500;font-size:12px">${ap.titre}</td>`;
      h+= `<td>${detail}</td>`;
      h+= `<td style="font-weight:500;color:var(--purple-dk)">${ap.annee}</td>`;
      h+= `<td><div style="display:flex;gap:3px">${avs||'<span style="font-size:10px;color:var(--text-3)">-</span>'}</div></td>`;
      h+= `<td>${badge(ap.statut||'Planifie')}</td>`;
      h+=adminBtn;
      h+='</tr>';
    });
  }
  document.getElementById('pa-tbl').innerHTML=h+'</tbody>';
}

function auditModalBody(ap){
  var doms=[...new Set(PROCESSES.map(function(p){return p.dom;}))];
  var type=(ap&&ap.type)||'Process';
  var domOpts=doms.map(function(d){
    return '<option'+(ap&&ap.domaine===d?' selected':'')+'>'+d+'</option>';
  }).join('');
  var currentDom=(ap&&ap.domaine)||doms[0];
  var procOpts=PROCESSES.filter(function(p){return p.dom===currentDom;}).map(function(p){
    return '<option value="'+p.id+'"'+(ap&&ap.processId===p.id?' selected':'')+'>'+p.proc+'</option>';
  }).join('');
  var h='';
  h+='<div><label>Type d\'audit</label>';
  h+='<select id="m-type" onchange="toggleAuditTypeFields(this.value)">';
  h+='<option value="Process"'+(type==='Process'?' selected':'')+'>Process Audit</option>';
  h+='<option value="BU"'+(type==='BU'?' selected':'')+'>BU Audit</option>';
  h+='</select></div>';
  h+= `<div id="m-proc-fields" style="${type==='BU'?'display:none':''}">`;
  h+='<div><label>Domaine</label><select id="m-dom" onchange="updateProcessList()">'+domOpts+'</select></div>';
  h+='<div><label>Processus</label><select id="m-proc">'+procOpts+'</select></div>';
  h+='</div>';
  h+= `<div id="m-bu-fields" style="${type!=='BU'?'display:none':''}">`;
  h+='<div><label>Entite</label><select id="m-ent">';
  h+='<option'+(ap&&ap.entite==='SBS'?' selected':'')+'>SBS</option>';
  h+='<option'+(ap&&ap.entite==='AXW'?' selected':'')+'>AXW</option>';
  h+='<option'+(ap&&ap.entite==='ALL'?' selected':'')+'>ALL</option>';
  h+='</select></div>';
  h+='<div><label>Region</label><select id="m-reg">';
  ['Europe','AMEE','North America','APAC','South America'].forEach(function(r){
    h+='<option'+(ap&&ap.region===r?' selected':'')+'>'+r+'</option>';
  });
  h+='</select></div>';
  h+='<div><label>Pays (separes par des virgules)</label>';
  h+='<input id="m-pays" placeholder="ex : Maroc, Tunisie" value="'+((ap&&ap.pays||[]).join(', '))+'"/></div>';
  h+='</div>';
  h+='<div><label>Titre de la mission</label>';
  h+='<input id="m-titre" placeholder="ex : BU Maroc 2025" value="'+((ap&&ap.titre)||'')+'"/></div>';
  h+='<div class="g2">';
  h+='<div><label>Annee</label><select id="m-annee">';
  [2025,2026,2027,2028].forEach(function(y){
    h+='<option'+(ap&&ap.annee===y?' selected':'')+'>'+y+'</option>';
  });
  h+='</select></div>';
  h+='<div><label>Statut</label><select id="m-statut">';
  ['Planifié','En cours','Clôturé'].forEach(function(s){
    var match=ap&&(ap.statut===s);
    h+='<option'+(match?' selected':'')+'>'+s+'</option>';
  });
  h+='</select></div></div>';
  h+='<div><label>Auditeurs assignes</label>';
  h+='<div style="display:flex;gap:12px;margin-top:4px">';
  h+='<label style="display:flex;align-items:center;gap:5px;font-size:12px">';
  h+='<input type="checkbox" id="a-sh"'+((ap&&ap.auditeurs&&ap.auditeurs.includes('sh'))?' checked':'')+'>  Selma H.</label>';
  h+='<label style="display:flex;align-items:center;gap:5px;font-size:12px">';
  h+='<input type="checkbox" id="a-ne"'+((ap&&ap.auditeurs&&ap.auditeurs.includes('ne'))?' checked':'')+'>  Nisrine E.</label>';
  h+='</div></div>';
  return h;
}

function toggleAuditTypeFields(val){
  document.getElementById('m-proc-fields').style.display=val==='BU'?'none':'';
  document.getElementById('m-bu-fields').style.display=val==='BU'?'':'none';
}

function updateProcessList(){
  const dom=document.getElementById('m-dom')?.value;
  const sel=document.getElementById('m-proc');
  if(!sel||!dom)return;
  sel.innerHTML=PROCESSES.filter(p=>p.dom===dom).map(p=>`<option value="${p.id}">${p.proc}</option>`).join('');
}

function collectAuditModal(){
  const type=document.getElementById('m-type').value;
  const titre=document.getElementById('m-titre').value.trim();
  if(!titre){toast('Titre obligatoire');return null;}
  const auditeurs=[];
  if(document.getElementById('a-sh').checked)auditeurs.push('sh');
  if(document.getElementById('a-ne').checked)auditeurs.push('ne');
  const base={type,titre,annee:parseInt(document.getElementById('m-annee').value),statut:document.getElementById('m-statut').value,auditeurs};
  if(type==='Process'){
    const procEl=document.getElementById('m-proc');
    const procId=procEl?.value;
    const procObj=PROCESSES.find(p=>p.id===procId);
    return{...base,domaine:document.getElementById('m-dom').value,process:procObj?.proc||'',processId:procId};
  } else {
    return{...base,entite:document.getElementById('m-ent').value,region:document.getElementById('m-reg').value,pays:document.getElementById('m-pays').value.split(',').map(s=>s.trim()).filter(Boolean)};
  }
}

function showAddAuditModal(){
  openModal('Nouvel audit',auditModalBody(null),async function(){
    var data=collectAuditModal();
    if(!data)return;
    var newAp={id:'ap'+Date.now(),...data};
    AUDIT_PLAN.push(newAp);
    await saveAuditPlan(newAp);
    addHist('add','Audit "'+data.titre+'" ajouté au plan');
    renderPlanAuditTable();toast('Audit créé ✓');
  });
}

function showEditAuditModal(idx){
  var ap=AUDIT_PLAN[idx];
  openModal('Modifier — '+ap.titre, auditModalBody(ap), async function(){
    var data=collectAuditModal();
    if(!data)return;
    AUDIT_PLAN[idx]={...ap,...data};
    await saveAuditPlan(AUDIT_PLAN[idx]);
    addHist('edit','Audit "'+data.titre+'" modifié');
    renderPlanAuditTable();toast('Audit mis à jour ✓');
  });
}

async function deleteAudit(idx){
  var ap=AUDIT_PLAN[idx];
  if(!confirm('Supprimer "'+ap.titre+'" ?'))return;
  AUDIT_PLAN.splice(idx,1);
  await sbDelete('af_audit_plan', ap.id);
  addHist('del','Audit "'+ap.titre+'" supprimé');
  renderPlanAuditTable();toast('Supprimé');
}

V['plan-process']=()=>`
  <div class="topbar"><div class="tbtitle">Plan Process 2025–2028</div>
    <div style="display:flex;gap:7px">
      <button class="bs ao" onclick="showAddProcModal()">+ Processus</button>
      <button class="bp ao" onclick="nav('plan-audit')">Gérer le plan audit →</button>
    </div>
  </div>
  <div class="content">
    <div style="background:var(--purple-lt);border:.5px solid var(--purple);border-radius:var(--radius);padding:8px 12px;font-size:12px;color:var(--purple-dk);margin-bottom:1rem">
      Les missions planifiées sont gérées depuis l'écran <strong>Plan Audit</strong>. Cet écran affiche la vue consolidée.
    </div>
    <div class="tw"><table id="pp-tbl"></table></div>
  </div>`;

I['plan-process']=()=>renderProcTable();

function renderProcTable(){
  const doms=[...new Set(PROCESSES.map(p=>p.dom))];
  const procAudits=AUDIT_PLAN.filter(a=>a.type==='Process');
  var h=`<thead><tr><th>Domaine</th><th>Processus</th><th>Risque</th><th>2025</th><th>2026</th><th>2027</th><th>2028</th>${CU&&CU.role==='admin'?'<th>Actions</th>':''}</tr></thead><tbody>`;
  doms.forEach(dom=>{
    const rows=PROCESSES.filter(p=>p.dom===dom&&!p.archived);
    if(!rows.length)return;
    h+=`<tr class="sr"><td colspan="8">${dom}</td></tr>`;
    rows.forEach(p=>{
      const idx=PROCESSES.indexOf(p);
      const mByYear={};
      [2025,2026,2027,2028].forEach(y=>{
        const m=procAudits.find(a=>a.processId===p.id&&a.annee===y);
        mByYear[y]=m;
      });
      const yc=y=>{const m=mByYear[y];return m?`<div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:10px;font-weight:500;color:var(--purple-dk)">${m.titre}</span><div style="display:flex;gap:3px">${(m.auditeurs||[]).map(id=>avEl(id,16)).join('')}</div></div>`:'<span style="color:var(--text-3)">—</span>';};
      var riskCell = CU&&CU.role==='admin'
        ? `<select style="font-size:10px;padding:2px 4px;border:none;background:transparent;cursor:pointer" onchange="editRisk(${idx},this.value)"><option value="1" ${p.risk===1?'selected':''}>&#9733;</option><option value="2" ${p.risk===2?'selected':''}>&#9733;&#9733;</option><option value="3" ${p.risk===3?'selected':''}>&#9733;&#9733;&#9733;</option></select>`
        : RS[p.risk];
      var adminCell = CU&&CU.role==='admin'
        ? `<td style="white-space:nowrap"><button class="bs" style="font-size:10px;padding:2px 7px" onclick="showEditProcModal(${idx})">Modifier</button> <button class="bd" style="font-size:10px;padding:2px 7px" onclick="archiveProc(${idx})">Archiver</button></td>`
        : '';
      h+='<tr>';
      h+=`<td style="font-size:11px;color:var(--text-2)">${dom}</td>`;
      h+=`<td style="font-weight:500;font-size:11px">${p.proc}</td>`;
      h+=`<td style="text-align:center">${riskCell}</td>`;
      h+=`<td>${yc(2025)}</td><td>${yc(2026)}</td><td>${yc(2027)}</td><td>${yc(2028)}</td>`;
      h+=adminCell;
      h+='</tr>';
    });
  });
  document.getElementById('pp-tbl').innerHTML=h+'</tbody>';
}

function editRisk(idx,v){PROCESSES[idx].risk=parseInt(v);addHist('edit',`Risque "${PROCESSES[idx].proc}" modifié`);toast('Risque mis à jour');}
function archiveProc(idx){PROCESSES[idx].archived=true;addHist('arch',`Process "${PROCESSES[idx].proc}" archivé`);renderProcTable();toast('Archivé');}

function showAddProcModal(){
  const doms=[...new Set(PROCESSES.map(p=>p.dom))];
  openModal('Nouveau processus',`
    <div><label>Domaine</label><select id="m-dom">${doms.map(function(d){return'<option>'+d+'</option>';}).join('')}<option>+ Nouveau domaine</option></select></div>
    <div><label>Nom du processus</label><input id="m-proc" placeholder="ex : Gestion de la paie"/></div>
    <div><label>Niveau de risque</label><select id="m-risk"><option value="1">★ Faible</option><option value="2" selected>★★ Moyen</option><option value="3">★★★ Élevé</option></select></div>`,
    ()=>{
      const proc=document.getElementById('m-proc').value.trim();
      if(!proc){toast('Nom obligatoire');return;}
      PROCESSES.push({id:'p'+Date.now(),dom:document.getElementById('m-dom').value,proc,risk:parseInt(document.getElementById('m-risk').value),archived:false});
      addHist('add',`Process "${proc}" ajouté`);
      renderProcTable();toast('Processus créé ✓');
    });
}

function showEditProcModal(idx){
  const p=PROCESSES[idx];
  openModal(`Modifier "${p.proc}"`,`
    <div><label>Nom du processus</label><input id="m-proc" value="${p.proc}"/></div>
    <div><label>Risque</label><select id="m-risk"><option value="1" ${p.risk===1?'selected':''}>★</option><option value="2" ${p.risk===2?'selected':''}>★★</option><option value="3" ${p.risk===3?'selected':''}>★★★</option></select></div>`,
    ()=>{
      p.proc=document.getElementById('m-proc').value.trim();
      p.risk=parseInt(document.getElementById('m-risk').value);
      addHist('edit',`Process "${p.proc}" modifié`);
      renderProcTable();toast('Mis à jour ✓');
    });
}

V['plan-bu']=()=>`
  <div class="topbar"><div class="tbtitle">Plan BU 2025–2028</div>
    <button class="bp ao" onclick="nav('plan-audit')">Gérer le plan audit →</button>
  </div>
  <div class="content">
    <div style="background:var(--purple-lt);border:.5px solid var(--purple);border-radius:var(--radius);padding:8px 12px;font-size:12px;color:var(--purple-dk);margin-bottom:1rem">
      Les BU Audits sont gérés depuis l'écran <strong>Plan Audit</strong>. Cet écran affiche la vue consolidée par entité.
    </div>
    <div style="display:flex;gap:8px;margin-bottom:1rem">
      <select id="f-bu-ent" onchange="renderBUTable()"><option value="all">SBS + AXW + ALL</option><option value="SBS">SBS</option><option value="AXW">AXW</option></select>
      <select id="f-bu-yr" onchange="renderBUTable()"><option value="all">Toutes années</option><option value="2025">2025</option><option value="2026">2026</option><option value="2027">2027</option><option value="2028">2028</option></select>
    </div>
    <div class="tw"><table id="bu-tbl"></table></div>
  </div>`;

I['plan-bu']=()=>renderBUTable();

function renderBUTable(){
  const fe=document.getElementById('f-bu-ent')?.value||'all';
  const fy=document.getElementById('f-bu-yr')?.value||'all';
  const rows=AUDIT_PLAN.filter(a=>a.type==='BU'&&(fe==='all'||a.entite===fe)&&(fy==='all'||String(a.annee)===fy));
  const regs=[...new Set(rows.map(b=>b.region))];
  var h='<thead><tr><th>Entite</th><th>Region</th><th>Pays</th><th>Titre mission</th><th>Annee</th><th>Auditeurs</th><th>Statut</th></tr></thead><tbody>';
  if(!rows.length){h+=`<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:1.5rem">Aucune BU planifiée.</td></tr>`;
  } else {
    regs.forEach(reg=>{
      h+=`<tr class="sr"><td colspan="7">${reg}</td></tr>`;
      rows.filter(b=>b.region===reg).forEach(b=>{
        const avs=(b.auditeurs||[]).map(id=>avEl(id,20)).join('');
        h+=`<tr>
          <td><span class="badge ${b.entite==='SBS'?'bsbs':'baxw'}">${b.entite}</span></td>
          <td style="color:var(--text-2);font-size:11px">${b.region}</td>
          <td style="font-weight:500;font-size:11px">${(b.pays||[]).join(', ')}</td>
          <td style="font-size:11px">${b.titre}</td>
          <td style="font-weight:500;color:var(--purple-dk)">${b.annee}</td>
          <td><div style="display:flex;gap:3px">${avs||'<span style="font-size:10px;color:var(--text-3)">—</span>'}</div></td>
          <td>${badge(b.statut||'Planifié')}</td>
        </tr>`;
      });
    });
  }
  document.getElementById('bu-tbl').innerHTML=h+'</tbody>';
}

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
  const ft=document.getElementById('f-ty')?.value||'all';
  const fs=document.getElementById('f-st')?.value||'all';
  const rows=getAudits().filter(a=>(ft==='all'||a.type===ft)&&(fs==='all'||a.status===fs));
  document.getElementById('audit-list').innerHTML=rows.length
    ?rows.map(a=>`<div class="ar" onclick="openAudit('${a.id}')">
        <div style="flex:1"><div class="an">${a.name}</div><div class="am">${a.ent} · ${a.type}</div></div>
        <div style="display:flex;gap:2px">${(a.assignedTo||[]).map(id=>avEl(id,20)).join('')}</div>
        <span class="badge ${a.type==='Process'?'bpc':'bbu'}">${a.type}</span>
        ${badge(a.status)}
        <div>${pbar(a.status)}</div>
      </div>`).join('')
    :'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun audit.</div>';
}

async function openAudit(id){
  CA=id;
  var found=getAudits().find(function(a){return a.id===id;});
  CS=found?found.step||0:0;
  CT='roles';
  await loadAuditData(id);
  nav('audit-detail');
};

V['audit-detail']=()=>{
  const a=getAudits().find(x=>x.id===CA);
  if(!a) return '<div class="content">Audit introuvable.</div>';
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
        <span style="font-size:11px;color:var(--text-2);white-space:nowrap" id="gp-lbl">Étape ${CS+1}/11</span>
        <div class="pbar" style="flex:1"><div class="pfill" id="gp-fill" style="width:${Math.round(CS/10*100)}%"></div></div>
        <span style="font-size:11px;color:var(--text-2)" id="gp-pct">${Math.round(CS/10*100)}%</span>
      </div>
      <div class="card" style="margin-bottom:1rem" id="stepper-card">${renderStepper()}</div>
      <div class="tabs" id="det-tabs">${renderDetTabs()}</div>
      <div id="det-content">${renderDetContent()}</div>
    </div>`;
};
I['audit-detail']=()=>{};

function getStepTabs(){
  if(CS===4)return['roles','tasks','controls','docs','notes'];
  if(CS===5)return['roles','tasks','controls-exec','findings-exec','docs','notes'];
  if(CS===6)return['roles','tasks','findings','maturity','docs','notes'];
  if(CS===8)return['roles','tasks','mgt-resp','docs','notes'];
  return['roles','tasks','docs','notes'];
}
const TLBL={'roles':'Rôles','tasks':'Tâches','controls':'Contrôles','controls-exec':'Contrôles & Tests','findings-exec':'Findings (tests)','findings':'Findings','maturity':'Overall Maturity','mgt-resp':'Mgt Response','docs':'Documents','notes':'Notes'};

function renderDetTabs(){
  return getStepTabs().map(t=>`<div class="tab ${CT===t?'active':''}" onclick="switchDetTab('${t}')">${TLBL[t]}</div>`).join('');
}

function renderStepper(){
  const phases=[[0,1,2],[3,4,5],[6,7,8,9,10]];
  const pn=['Préparation','Réalisation','Restitution'];
  const d=getAudData(CA);
  return phases.map((idxs,pi)=>`
    <div class="pl">${pn[pi]}</div>
    <div class="step-row" style="margin-bottom:${pi<2?'1rem':'0'}">
    ${idxs.map(i=>{
      const cls=i<CS?'done':i===CS?'active':'';
      const lbl=STEPS[i].s.replace('/',' /').split(' /');
      const st=(d.tasks[i]||[]);
      const assigned=[...new Set(st.map(t=>t.assignee).filter(x=>x&&x!=='none'))];
      return`<div class="step-item ${cls}" onclick="goStep(${i})">
        <div class="sc">${i<CS?'✓':i+1}</div>
        <div class="sl">${lbl[0]}${lbl[1]?'<br>/'+lbl[1]:''}</div>
        <div style="display:flex;gap:1px;margin-top:2px">${assigned.map(id=>avEl(id,12)).join('')}</div>
      </div>`;
    }).join('')}</div>`).join('');
}

function renderDetContent(){
  const a=getAudits().find(x=>x.id===CA);
  const s=STEPS[CS];
  const d=getAudData(CA);
  const stepTasks=d.tasks[CS]||[];

  if(CT==='roles'){
    return`<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem">
      <div style="font-size:13px;font-weight:600">Étape ${CS+1} — ${s.s}</div>${badge(a.status)}</div>
      <div class="g2" style="margin-bottom:.875rem">
        ${(a.assignedTo||[]).map(id=>{const m=TM[id];if(!m)return'';const my=stepTasks.filter(t=>t.assignee===id);
          return`<div class="card" style="background:var(--bg)"><div style="font-size:10px;color:var(--text-3);margin-bottom:5px">Auditrice</div><div style="display:flex;align-items:center;gap:7px">${avEl(id,26)}<div><div style="font-size:12px;font-weight:500">${m.name}</div><div style="font-size:10px;color:${my.filter(t=>t.done).length===my.length&&my.length>0?'var(--green)':'var(--amber)'}">${my.length?my.filter(t=>t.done).length+'/'+my.length+' tâches':'Aucune tâche'}</div></div></div></div>`;}).join('')}
        <div class="card" style="background:var(--bg)"><div style="font-size:10px;color:var(--text-3);margin-bottom:5px">Valideur</div><div style="display:flex;align-items:center;gap:7px">${avEl('pm',26)}<div><div style="font-size:12px;font-weight:500">Philippe M.</div><div style="font-size:10px;color:var(--amber)">Validation requise</div></div></div></div>
      </div>
      ${CU?.role!=='admin'?'<div class="notice">La validation est réservée au Directeur Audit.</div>':''}
    </div>`;
  }

  if(CT==='tasks'){
    const done=stepTasks.filter(t=>t.done).length;
    return`<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem">
      <div style="font-size:13px;font-weight:600">Tâches — ${s.s}</div>
      <div style="display:flex;gap:8px;align-items:center"><span style="font-size:11px;color:var(--text-2)">${done}/${stepTasks.length}</span><button class="bs" style="font-size:11px" onclick="showNewTaskModal()">+ Ajouter</button></div>
    </div><div id="task-list">${renderTaskList(stepTasks,a)}</div></div>`;
  }

  if(CT==='controls'){
    const ctrls=d.controls[CS]||[];
    return`<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem">
      <div style="font-size:13px;font-weight:600">Contrôles identifiés</div>
      <button class="bs" style="font-size:11px" onclick="showAddControlModal()">+ Ajouter</button>
    </div>
    ${buildControlList(ctrls)}
    </div>`;
  }

  if(CT==='controls-exec'){
    const step5c=d.controls[4]||[];
    const keyExist=step5c.filter(c=>c.clef&&c.design==='existing');
    const targets=step5c.filter(c=>c.design==='target');
    return`<div class="card">
      <div style="font-size:13px;font-weight:600;margin-bottom:.875rem">Tests — Contrôles clefs existants</div>
      ${keyExist.length?buildExecTable(keyExist):'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun controle clef existant (definis a l\'etape 5).</div>'}
      <div style="font-size:13px;font-weight:600;margin:.875rem 0 .5rem">Contrôles Target — anomalies automatiques</div>
      ${buildTargetList(targets)}
    </div>`;
  }

  if(CT==='findings-exec'||CT==='findings'){
    const step5c=d.controls[4]||[];
    const step6c=(d.controls[4]||[]).filter(x=>x.clef&&x.design==='existing'&&x.finalized&&x.result==='fail');
    const failF=step6c.filter(c=>c.finding);
    const targetF=step5c.filter(c=>c.design==='target');
    const manualF=d.findings||[];
    return`<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem">
      <div style="font-size:13px;font-weight:600">Findings</div>
      <button class="bs" style="font-size:11px" onclick="showAddFindingModal()">+ Ajouter un finding</button>
    </div>
    ${failF.length?('<div style="font-size:11px;font-weight:500;color:var(--text-2);margin-bottom:.5rem">Controles - Fail</div>'+failF.map(function(ctrl){return'<div class="fr"><div class="fh"><span class="badge bfl">Fail</span><div class="ft">'+ctrl.name+'</div></div><div style="font-size:11px;color:var(--text-2)">'+ctrl.finding+'</div></div>';}).join('')):''}
    ${targetF.length?('<div style="font-size:11px;font-weight:500;color:var(--text-2);margin:.75rem 0 .5rem">Controles non existants (Target)</div>'+targetF.map(function(ctrl){return'<div class="fr"><div class="fh"><span class="badge btg">Target</span><div class="ft">'+ctrl.name+'</div></div><div style="font-size:11px;color:var(--red)">Controle non existant.</div></div>';}).join('')):''}
    ${manualF.length?('<div style="font-size:11px;font-weight:500;color:var(--text-2);margin:.75rem 0 .5rem">Findings additionnels</div>'+manualF.map(function(f,idx2){return'<div class="fr"><div class="fh"><span class="badge bpc">Finding</span><div class="ft">'+f.title+'</div><button class="bd" style="font-size:10px;padding:2px 6px" onclick="removeManualFinding('+idx2+')">X</button></div><div style="font-size:11px;color:var(--text-2)">'+f.desc+'</div></div>';}).join('')):''}
    ${!failF.length&&!targetF.length&&!manualF.length?'<div style="font-size:12px;color:var(--text-3)">Aucun finding pour le moment.</div>':''}
    </div>`;
  }

  if(CT==='maturity'){
    const d=getAudData(CA);
    if(!d.maturity)d.maturity={level:'',notes:'',saved:false};
    const MLEVELS=[
      {key:'unsatisfactory',label:'Unsatisfactory',color:'#A32D2D',bg:'#FCEBEB',
        def:'Controle interne insuffisant. De nombreux controles manquent ou sont inefficaces. Des deficiences significatives exposent l\'organisation a des risques importants.',
        meas:'Plus de 70% des controles testes sont en Fail. Plusieurs controles Target identifies. Risque eleve non mitige.'},
      {key:'major',label:'Major Improvements Needed',color:'#854F0B',bg:'#FAEEDA',
        def:'Le cadre de controle existe mais presente des lacunes importantes. Des ameliorations substantielles sont necessaires pour atteindre un niveau d\'efficacite acceptable.',
        meas:'40 a 70% des controles testes en Fail. Controles clefs manquants ou mal concus. Plans d\'action correctifs requis a court terme.'},
      {key:'some',label:'Some Improvements Needed',color:'#1D6B45',bg:'#E1F5EE',
        def:'Le cadre de controle est globalement en place mais des ameliorations ponctuelles sont necessaires pour optimiser son efficacite.',
        meas:'10 a 40% des controles en Fail. La majorite des controles clefs fonctionnent correctement. Axes d\'amelioration identifies.'},
      {key:'effective',label:'Effective',color:'#3B6D11',bg:'#EAF3DE',
        def:'Le cadre de controle est solide et efficace. Les controles clefs sont en place, bien concus et operationnels. Le processus est gere de maniere appropriee.',
        meas:'Moins de 10% des controles en Fail. Tous les controles clefs sont existants et fonctionnels. Aucun gap majeur identifie.'},
    ];
    const step6c=(d.controls[4]||[]).filter(function(x){return x.clef&&x.design==='existing'&&x.finalized;});
    const failCount=step6c.filter(function(x){return x.result==='fail';}).length;
    const passCount=step6c.filter(function(x){return x.result==='pass';}).length;
    const targetCount=(d.controls[4]||[]).filter(function(x){return x.design==='target';}).length;
    const ratio=step6c.length?failCount/step6c.length:0;
    const suggestedKey=step6c.length===0?'':ratio>0.7?'unsatisfactory':ratio>0.4?'major':ratio>0.1?'some':'effective';
    const sugLabel=suggestedKey?MLEVELS.find(function(l){return l.key===suggestedKey;}):null;
    let html='<div class="card">';
    html+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">';
    html+='<div style="font-size:13px;font-weight:600">Overall Process Maturity</div>';
    if(d.maturity.saved)html+='<span class="tag-new">&#10003; Evaluation sauvegardee</span>';
    html+='</div>';
    html+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:1rem">';
    html+='<div class="card" style="background:var(--bg);text-align:center"><div style="font-size:10px;color:var(--text-3);margin-bottom:3px">Tests finalises</div><div style="font-size:20px;font-weight:600">'+step6c.length+'</div></div>';
    html+='<div class="card" style="background:var(--green-lt);text-align:center"><div style="font-size:10px;color:var(--text-3);margin-bottom:3px">Pass</div><div style="font-size:20px;font-weight:600;color:var(--green)">'+passCount+'</div></div>';
    html+='<div class="card" style="background:var(--red-lt);text-align:center"><div style="font-size:10px;color:var(--text-3);margin-bottom:3px">Fail + Target</div><div style="font-size:20px;font-weight:600;color:var(--red)">'+(failCount+targetCount)+'</div></div>';
    html+='</div>';
    if(sugLabel)html+='<div style="background:var(--purple-lt);border:.5px solid var(--purple);border-radius:var(--radius);padding:8px 12px;font-size:12px;color:var(--purple-dk);margin-bottom:1rem">Niveau suggere : <strong>'+sugLabel.label+'</strong></div>';
    html+='<div style="font-size:12px;font-weight:500;color:var(--text-2);margin-bottom:.625rem">Selectionnez le niveau de maturite du processus audite :</div>';
    html+='<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:1rem">';
    MLEVELS.forEach(function(l){
      const sel=d.maturity.level===l.key;
      const border='border:2px solid '+(sel?l.color:'var(--border)')+';';
      const bg='background:'+(sel?l.bg:'var(--bg-card)')+';';
      const radioBg='background:'+(sel?l.color:'transparent')+';';
      html+='<div onclick="setMaturity(\''+l.key+'\')" style="'+border+'border-radius:var(--radius);padding:.875rem 1rem;cursor:pointer;'+bg+'transition:all .15s">';
      html+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">';
      html+='<div style="width:14px;height:14px;border-radius:50%;border:2px solid '+l.color+';'+radioBg+'flex-shrink:0"></div>';
      html+='<div style="font-size:13px;font-weight:600;color:'+l.color+'">'+l.label+'</div>';
      html+='</div>';
      html+='<div style="padding-left:24px">';
      html+='<div style="font-size:11px;color:var(--text-2);margin-bottom:4px"><strong>Definition :</strong> '+l.def+'</div>';
      html+='<div style="font-size:11px;color:var(--text-3)"><strong>Mesure :</strong> '+l.meas+'</div>';
      html+='</div></div>';
    });
    html+='</div>';
    html+='<div style="font-size:12px;font-weight:500;color:var(--text-2);margin-bottom:.375rem">Commentaires / Justification</div>';
    html+='<textarea id="maturity-notes" style="width:100%;min-height:80px;resize:vertical;font-size:12px" placeholder="Justifiez votre evaluation...">'+(d.maturity.notes||'')+'</textarea>';
    html+='<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="bp" onclick="saveMaturity()">Sauvegarder</button></div>';
    html+='</div>';
    return html;
  }

  if(CT==='mgt-resp'){
    const step5c=d.controls[4]||[];
    const step6c=(d.controls[4]||[]).filter(x=>x.clef&&x.design==='existing'&&x.finalized&&x.result==='fail');
    const allFindings=[
      ...step6c.filter(c=>c.finding).map(c=>({id:'f_'+c.name,title:c.name,desc:c.finding,type:'fail'})),
      ...step5c.filter(c=>c.design==='target').map(c=>({id:'t_'+c.name,title:c.name,desc:`Contrôle non existant — à définir par ${c.owner}`,type:'target'})),
      ...(d.findings||[]).map((f,i)=>({id:'m_'+i,title:f.title,desc:f.desc,type:'manual'})),
    ];
    if(!d.mgtResp)d.mgtResp=[];
    allFindings.forEach(f=>{
      if(!d.mgtResp.find(r=>r.findingId===f.id)){
        d.mgtResp.push({findingId:f.id,action:'',owner:'',year:2026,quarter:'Q1',pushed:false});
      }
    });
    return`<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem">
      <div style="font-size:13px;font-weight:600">Management Responses</div>
      <button class="bs" style="font-size:11px" onclick="pushAllMgtResp()">Envoyer vers Plans d'action →</button>
    </div>
    ${allFindings.length?allFindings.map((f,fi)=>{
      const resp=d.mgtResp.find(r=>r.findingId===f.id)||{};
      const tcolor={fail:'var(--red)',target:'var(--amber)',manual:'var(--purple-dk)'}[f.type];
      const tbadge={fail:'bfl',target:'btg',manual:'bpc'}[f.type];
      return`<div class="mr-row">
        <div class="mr-hdr"><span class="badge ${tbadge}">${f.type==='fail'?'Fail':f.type==='target'?'Target':'Finding'}</span><div class="mr-title">${f.title}</div>${resp.pushed?'<span class="tag-new">✓ Envoyé</span>':''}</div>
        <div style="font-size:11px;color:var(--text-2);margin-bottom:.625rem">${f.desc}</div>
        <div class="mr-fields">
          <div><label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px">Action</label><input style="font-size:11px" placeholder="Action corrective à mener..." value="${resp.action||''}" onchange="setMgtResp('${f.id}','action',this.value)"/></div>
          <div><label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px">Owner (département)</label><input style="font-size:11px" placeholder="ex : Finance, IT..." value="${resp.owner||''}" onchange="setMgtResp('${f.id}','owner',this.value)"/></div>
          <div><label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px">Deadline</label>
            <div style="display:flex;gap:4px">
              <select style="font-size:11px" onchange="setMgtResp('${f.id}','year',parseInt(this.value))"><option ${resp.year===2025?'selected':''}>2025</option><option ${resp.year===2026?'selected':''} selected>2026</option><option ${resp.year===2027?'selected':''}>2027</option><option ${resp.year===2028?'selected':''}>2028</option></select>
              <select style="font-size:11px" onchange="setMgtResp('${f.id}','quarter',this.value)"><option ${resp.quarter==='Q1'?'selected':''}>Q1</option><option ${resp.quarter==='Q2'?'selected':''}>Q2</option><option ${resp.quarter==='Q3'?'selected':''}>Q3</option><option ${resp.quarter==='Q4'?'selected':''}>Q4</option></select>
            </div>
          </div>
        </div>
      </div>`;
    }).join(''):'<div style="font-size:12px;color:var(--text-3)">Aucun finding identifié (complétez les étapes 5, 6 et 7).</div>'}
    </div>`;
  }

  if(CT==='docs'){
    return`<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem"><div style="font-size:13px;font-weight:600">Documents</div><button class="bs" style="font-size:11px" onclick="addFakeDoc()">+ Ajouter</button></div>
    <div class="uz" onclick="addFakeDoc()"><div style="font-size:12px;color:var(--text-2)">Glissez vos fichiers ou cliquez</div><div style="font-size:10px;color:var(--text-3);margin-top:2px">PDF, Excel, Word, PowerPoint</div></div>
    <div id="doc-list">${buildDocList(d.docs)}</div>
    </div>`;
  }

  if(CT==='notes'){
    return`<div class="card"><div style="font-size:13px;font-weight:600;margin-bottom:.75rem">Notes de l'auditeur</div>
    <textarea style="width:100%;min-height:120px;resize:vertical" placeholder="Observations, constats...">${d.notes||''}</textarea>
    <div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="bp" onclick="saveNotes()">Sauvegarder</button></div></div>`;
  }
  return'';
}

function goStep(i){CS=i;const tabs=getStepTabs();if(!tabs.includes(CT))CT='roles';document.getElementById('stepper-card').innerHTML=renderStepper();document.getElementById('gp-fill').style.width=Math.round(i/10*100)+'%';document.getElementById('gp-pct').textContent=Math.round(i/10*100)+'%';document.getElementById('gp-lbl').textContent=`Étape ${i+1}/11 — ${STEPS[i].s}`;document.getElementById('det-tabs').innerHTML=renderDetTabs();document.getElementById('det-content').innerHTML=renderDetContent();}
function switchDetTab(tab){CT=tab;document.getElementById('det-tabs').innerHTML=renderDetTabs();document.getElementById('det-content').innerHTML=renderDetContent();}

async function validerEtape(){
  var ap=AUDIT_PLAN.find(function(a){return a.id===CA;});
  if(CS<10){
    CS++;
    if(ap)ap.statut='En cours';
    await saveAuditPlan(ap);
    addHist('edit','Étape '+CS+' validée — "'+( ap?ap.titre:'')+ '"');
    goStep(CS);
    toast('"'+STEPS[CS].s+'" validée ✓');
  } else {
    if(ap){ap.statut='Clôturé'; await saveAuditPlan(ap);}
    toast('Mission clôturée ✓');
  }
}

function renderTaskList(st,a){
  if(!st.length)return'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucune tâche.</div>';
  return st.map((t,i)=>`<div class="ti">
    <div class="tcb ${t.done?'done':''}" onclick="toggleTask(${i})">${t.done?'✓':''}</div>
    <div class="tt ${t.done?'dt':''}">${t.desc}</div>
    <select style="font-size:11px;padding:2px 6px;border-radius:20px;background:var(--bg)" onchange="reassignTask(${i},this.value)">
      <option value="none" ${!t.assignee||t.assignee==='none'?'selected':''}>—</option>
      ${buildAssigneeOpts(a.assignedTo,t.assignee)}
    </select>
    <span style="font-size:10px;color:${t.done?'var(--green)':t.assignee&&t.assignee!=='none'?'var(--purple)':'var(--text-3)'}">${t.done?'✓':t.assignee&&t.assignee!=='none'?'En cours':'À faire'}</span>
  </div>`).join('');
}

async function toggleTask(i){const d=getAudData(CA);if(!d.tasks[CS])d.tasks[CS]=[];d.tasks[CS][i].done=!d.tasks[CS][i].done;const a=getAudits().find(x=>x.id===CA);document.getElementById('task-list').innerHTML=renderTaskList(d.tasks[CS],a);document.getElementById('stepper-card').innerHTML=renderStepper();}
function reassignTask(i,val){const d=getAudData(CA);if(d.tasks[CS]&&d.tasks[CS][i])d.tasks[CS][i].assignee=val;document.getElementById('stepper-card').innerHTML=renderStepper();if(val!=='none')toast(`Assigné à ${TM[val]?.name}`);}

function showNewTaskModal(){
  const a=getAudits().find(x=>x.id===CA);
  openModal('Nouvelle tâche',`
    <div><label>Description</label><input id="t-desc" placeholder="ex : Analyser les données..."/></div>
    <div><label>Assignée à</label><select id="t-assign"><option value="none">— Non assignée</option>${buildAssigneeOpts(a.assignedTo,null)}</select></div>`,
    ()=>{
      const desc=document.getElementById('t-desc').value.trim();
      if(!desc){toast('Description obligatoire');return;}
      const d=getAudData(CA);if(!d.tasks[CS])d.tasks[CS]=[];
      d.tasks[CS].push({desc,assignee:document.getElementById('t-assign').value,done:false});
      document.getElementById('det-content').innerHTML=renderDetContent();
      document.getElementById('stepper-card').innerHTML=renderStepper();
      toast('Tâche créée ✓');
    });

  saveAuditData(CA);
}

function showAddControlModal(){
  openModal('Ajouter un contrôle', `
    <div><label>Nom du contrôle</label><input id="c-name" placeholder="ex : Rapprochement mensuel des soldes"/></div>
    <div><label>Contrôle owner (département)</label><input id="c-owner" placeholder="ex : Finance / Comptabilité"/></div>
    <div class="g2">
      <div><label>Fréquence</label><select id="c-freq"><option>Mensuel</option><option>Trimestriel</option><option>Semestriel</option><option>Annuel</option><option>Ad hoc</option></select></div>
      <div><label>Contrôle clef ?</label><select id="c-clef"><option value="1">Oui — sera testé</option><option value="0">Non — non testé</option></select></div>
    </div>
    <div><label>Design</label><select id="c-design"><option value="existing">Existing — contrôle en place</option><option value="target">Target — contrôle non existant</option></select></div>`,
    ()=>{
      const name=document.getElementById('c-name').value.trim();
      if(!name){toast('Nom obligatoire');return;}
      const d=getAudData(CA);if(!d.controls[CS])d.controls[CS]=[];
      d.controls[CS].push({name,owner:document.getElementById('c-owner').value,freq:document.getElementById('c-freq').value,clef:document.getElementById('c-clef').value==='1',design:document.getElementById('c-design').value,result:null,testNature:'',finding:''});
      document.getElementById('det-content').innerHTML=renderDetContent();
      toast('Contrôle ajouté ✓');
    });
}

function removeControl(i){const d=getAudData(CA);d.controls[CS].splice(i,1);document.getElementById('det-content').innerHTML=renderDetContent();}

function setTestNature(i,val){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(c=>c.clef&&c.design==='existing');if(kc[i])kc[i].testNature=val;}
function setTestResult(i,val){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(c=>c.clef&&c.design==='existing');if(kc[i]){kc[i].result=val;document.getElementById('det-content').innerHTML=renderDetContent();}}
function setFinding(i,val){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(c=>c.clef&&c.design==='existing');if(kc[i])kc[i].finding=val;}

function showAddFindingModal(){
  openModal('Nouveau finding',`
    <div><label>Titre</label><input id="f-title" placeholder="ex : Absence de contrôle sur les accès"/></div>
    <div><label>Description / Observation</label><textarea id="f-desc" style="height:80px" placeholder="Décrivez l'anomalie ou l'amélioration..."></textarea></div>`,
    ()=>{
      const title=document.getElementById('f-title').value.trim();
      if(!title){toast('Titre obligatoire');return;}
      const d=getAudData(CA);
      d.findings.push({title,desc:document.getElementById('f-desc').value.trim()});
      document.getElementById('det-content').innerHTML=renderDetContent();
      toast('Finding ajouté ✓');
    });
}

function removeManualFinding(i){const d=getAudData(CA);d.findings.splice(i,1);document.getElementById('det-content').innerHTML=renderDetContent();}

function setMgtResp(findingId,field,val){
  const d=getAudData(CA);
  const r=d.mgtResp.find(x=>x.findingId===findingId);
  if(r)r[field]=val;
}

function pushAllMgtResp(){
  const d=getAudData(CA);
  const ap=AUDIT_PLAN.find(a=>a.id===CA);
  const pushed=d.mgtResp.filter(r=>r.action&&r.owner&&!r.pushed);
  if(!pushed.length){toast('Aucune réponse complète à envoyer (action + owner requis)');return;}
  pushed.forEach(r=>{
    const step5c=d.controls[4]||[];
    const step6c=d.controls[5]||[];
    const allF=[
      ...step6c.filter(c=>c.result==='fail'&&c.finding).map(c=>({id:'f_'+c.name,title:c.name})),
      ...step5c.filter(c=>c.design==='target').map(c=>({id:'t_'+c.name,title:c.name})),
      ...(d.findings||[]).map((f,i)=>({id:'m_'+i,title:f.title})),
    ];
    const f=allF.find(x=>x.id===r.findingId);
    if(!f)return;
    ACTIONS.unshift({id:'ac'+Date.now()+Math.random(),title:r.action,audit:ap?.titre||'—',resp:CU?.name||'—',dept:r.owner,ent:ap?.type==='BU'?ap.entite:'Groupe',year:r.year,quarter:r.quarter,status:'Non démarré',pct:0,fromFinding:true,findingTitle:f.title});
    r.pushed=true;
    addHist('add',`Plan d'action créé depuis finding "${f.title}"`);
  });
  document.getElementById('det-content').innerHTML=renderDetContent();
  toast(`${pushed.length} plan(s) d'action créé(s) ✓`);
}

async function addFakeDoc(){
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.csv,.txt';
  inp.multiple = true;
  inp.onchange = async function(){
    if(!inp.files.length) return;
    for(var fi=0; fi<inp.files.length; fi++){
      var file = inp.files[fi];
      toast('Upload en cours : ' + file.name + '...');
      try {
        await uploadDoc(CA, file);
        document.getElementById('det-content').innerHTML = renderDetContent();
        toast(file.name + ' uploadé ✓');
      } catch(e){
        console.error('Upload error:', e);
        toast('Erreur : ' + e.message);
      }
    }
  };
  inp.click();
}

async function saveNotes(){
  var d=getAudData(CA);
  d.notes=document.querySelector('textarea')?document.querySelector('textarea').value:'';
  await saveAuditData(CA);
  toast('Notes sauvegardées ✓');
}

function finalizeTest(i){
  const d=getAudData(CA);
  const kc=(d.controls[4]||[]).filter(x=>x.clef&&x.design==='existing');
  const ctrl=kc[i];
  if(!ctrl)return;
  if(!ctrl.testNature){toast('Veuillez sélectionner la nature du test');return;}
  if(!ctrl.result){toast('Veuillez indiquer le résultat (Pass/Fail)');return;}
  if(ctrl.result==='fail'&&!ctrl.finding){toast('Veuillez documenter le finding avant de finaliser');return;}
  ctrl.finalized=true;
  addHist('edit',`Test finalisé — "${ctrl.name}" : ${ctrl.result==='pass'?'Pass':'Fail'}`);
  document.getElementById('det-content').innerHTML=renderDetContent();
  toast(`Test "${ctrl.name}" finalisé — ${ctrl.result==='pass'?'✓ Pass':'✗ Fail'}`);
}

function setMaturity(key){
  const d=getAudData(CA);
  if(!d.maturity)d.maturity={level:'',notes:'',saved:false};
  d.maturity.level=key;
  d.maturity.saved=false;
  document.getElementById('det-content').innerHTML=renderDetContent();
}

async function saveMaturity(){
  const d=getAudData(CA);
  if(!d.maturity?.level){toast('Veuillez sélectionner un niveau de maturité');return;}
  d.maturity.notes=document.getElementById('maturity-notes')?.value||'';
  d.maturity.saved=true;
  addHist('edit', `Maturité process définie : ${d.maturity.level} — "${AUDIT_PLAN.find(a=>a.id===CA)?.titre}"`);
  await saveAuditData(CA); toast('Évaluation sauvegardée ✓');
  document.getElementById('det-content').innerHTML=renderDetContent();
}

async function deleteAction(id){
  var idx=ACTIONS.findIndex(function(a){return a.id===id;});
  if(idx===-1)return;
  if(!confirm('Supprimer "'+ACTIONS[idx].title+'" ?'))return;
  await sbDelete('af_actions', id);
  ACTIONS.splice(idx,1);
  addHist('del', "Plan d'action supprimé");
  renderActionList();
  toast("Plan d'action supprimé");
}

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
  const ft=document.getElementById('f-pl')?.value||'all';
  const fy=document.getElementById('f-pyr')?.value||'all';
  const rows=AUDIT_PLAN.filter(a=>(ft==='all'||a.type===ft)&&(fy==='all'||String(a.annee)===fy));
  const months=MO.map(function(m,mi){return'<div class="gc'+(mi===8?' today-col':'')+'">'+m+'</div>';}).join('');
  const hdr=`<div class="gr gw" style="border-bottom:.5px solid var(--border)"><div class="gc" style="text-align:left;padding-left:8px">Audit</div>${months}</div>`;
  const body=rows.map((a,idx)=>{
    const start=a.annee===2025?Math.floor(Math.random()*4):0;
    const dur=4;
    const cells=MO.map(function(_,m){var cls=m===8?'gm td':'gm';var bar=m>=start&&m<start+dur?'<div class="gb" style="background:'+GC[idx%GC.length]+'"></div>':'';return'<div class="'+cls+'">'+bar+'</div>';}).join('');
    return`<div class="gr" style="border-bottom:.5px solid var(--border)">
      <div class="gn2"><span class="badge ${a.type==='Process'?'bpc':'bbu'}" style="font-size:9px;padding:1px 5px">${a.type==='Process'?'P':'BU'}</span>${a.titre.length>16?a.titre.slice(0,15)+'…':a.titre}</div>${cells}</div>`;
  }).join('');
  document.getElementById('gantt-wrap').innerHTML=hdr+body;
}

V['modeles']=()=>`
  <div class="topbar"><div class="tbtitle">Modèles d'audit</div><button class="bp">+ Nouveau modèle</button></div>
  <div class="content">
    <div class="tabs"><div class="tab active" onclick="sTT(this,'tp-p')">Process</div><div class="tab" onclick="sTT(this,'tp-b')">BU</div></div>
    <div id="tp-p" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${buildTplCards(['Product Development','Cybersecurity & Data','Treasury & Tax','Sales & Services','P2P / Third Party','Governance'],'bpc')}</div>
    <div id="tp-b" style="display:none;grid-template-columns:repeat(3,1fr);gap:10px">${buildTplCards(['Legal/Compliance','HR','Sales','Procurement','Accounting','IS/IT'],'bbu')}</div>
  </div>`;
function sTT(el,id){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');document.getElementById('tp-p').style.display=id==='tp-p'?'grid':'none';document.getElementById('tp-b').style.display=id==='tp-b'?'grid':'none';}

V['plans-action']=()=>`
  <div class="topbar"><div class="tbtitle">Suivi des plans d'action</div><button class="bp" onclick="showNewActionModal()">+ Ajouter</button></div>
  <div class="content">
    <div class="metrics">
      <div class="mc"><div class="ml">Total</div><div class="mv">${ACTIONS.length}</div></div>
      <div class="mc"><div class="ml">En cours</div><div class="mv" style="color:var(--purple)">${ACTIONS.filter(a=>a.status==='En cours').length}</div></div>
      <div class="mc"><div class="ml">En retard</div><div class="mv" style="color:var(--red)">${ACTIONS.filter(a=>a.status==='En retard').length}</div></div>
      <div class="mc"><div class="ml">Issus de findings</div><div class="mv" style="color:var(--green)">${ACTIONS.filter(a=>a.fromFinding).length}</div></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:1rem">
      <select id="f-pa-st" onchange="renderActionList()"><option value="all">Tous statuts</option><option>En cours</option><option>En retard</option><option>Non démarré</option><option>Clôturé</option></select>
    </div>
    <div id="action-list"></div>
  </div>`;
I['plans-action']=()=>renderActionList();

function renderActionList(){
  const fs=document.getElementById('f-pa-st')?.value||'all';
  const rows=ACTIONS.filter(a=>fs==='all'||a.status===fs);
  const fc={'En retard':'var(--red)','Clôturé':'var(--green)','Non démarré':'var(--gray)','En cours':'var(--purple)'};
  document.getElementById('action-list').innerHTML=rows.map(a=>`
    <div class="card" style="margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
        <div style="font-size:12px;font-weight:500;flex:1">${a.title}</div>
        ${badge(a.status)}
        ${a.fromFinding?'<span class="tag-new">↗ Finding</span>':''}
      </div>
      <div style="font-size:11px;color:var(--text-2);margin-bottom:4px">
        Audit : ${a.audit} · Resp. : ${a.resp} · Dept owner : <strong>${a.dept}</strong> · Éch. : ${a.quarter} ${a.year}
        ${a.findingTitle?'<span style="color:var(--text-3)"> · Finding : "'+a.findingTitle+'"</span>':''}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;height:5px;background:var(--bg);border-radius:3px;overflow:hidden"><div style="height:100%;border-radius:3px;background:${fc[a.status]||'var(--purple)'};width:${a.pct}%"></div></div>
        <span style="font-size:10px;color:var(--text-3)">${a.pct}%</span>
      </div>
    </div>`).join('')||'<div style="font-size:12px;color:var(--text-3)">Aucun plan d\'action.</div>';
}

async function showNewActionModal(){
  openModal("Nouveau plan d'action",`
    <div><label>Titre</label><input id="pa-title" placeholder="ex : Revue des accès ERP"/></div>
    <div><label>Lié à l'audit</label><select id="pa-audit">${AUDIT_PLAN.map(function(a){return'<option>'+a.titre+'</option>';}).join('')}</select></div>
    <div><label>Responsable</label><select id="pa-resp"><option>Selma H.</option><option>Nisrine E.</option></select></div>
    <div><label>Département owner</label><input id="pa-dept" placeholder="ex : Finance, IT, RH..."/></div>
    <div><label>Entité</label><select id="pa-ent"><option>Groupe</option><option>74S</option><option>SBS</option><option>AXW</option></select></div>
    <div class="g2">
      <div><label>Année</label><select id="pa-yr"><option>2025</option><option>2026</option><option>2027</option><option>2028</option></select></div>
      <div><label>Trimestre</label><select id="pa-q"><option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option></select></div>
    </div>`,
    async ()=>{
      const title=document.getElementById('pa-title').value.trim();
      if(!title){toast('Titre obligatoire');return;}
      var newAc={id:'ac'+Date.now(),title,audit:document.getElementById('pa-audit').value,resp:document.getElementById('pa-resp').value,dept:document.getElementById('pa-dept').value||'—',ent:document.getElementById('pa-ent').value,year:parseInt(document.getElementById('pa-yr').value),quarter:document.getElementById('pa-q').value,status:'Non démarré',pct:0,fromFinding:false};
      ACTIONS.unshift(newAc); await saveAction(newAc); renderActionList();toast("Plan d'action créé ✓");
    });
}

V['historique']=()=>`<div class="topbar"><div class="tbtitle">Historique des modifications</div></div>
  <div class="content"><div class="card" id="hl"></div></div>`;
I['historique']=()=>{
  const dc={add:'var(--green)',edit:'var(--purple)',arch:'var(--amber)',del:'var(--red)'};
  document.getElementById('hl').innerHTML=HISTORY_LOG.length
    ?HISTORY_LOG.map(h=>`<div style="display:flex;gap:10px;padding:.625rem 0;border-bottom:.5px solid var(--border)"><div style="width:8px;height:8px;border-radius:50%;background:${dc[h.type]||'var(--purple)'};margin-top:4px;flex-shrink:0"></div><div><div style="font-size:12px">${h.msg}</div><div style="font-size:10px;color:var(--text-3);margin-top:2px">${h.user} · ${h.date}</div></div></div>`).join('')
    :'<div style="font-size:12px;color:var(--text-3)">Aucune modification.</div>';
};

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
  const RL={admin:'Admin / Directeur',auditeur:'Auditrice',audite:'Audité'};
  const RB={admin:'bpc',auditeur:'bdn',audite:'btg'};
  document.getElementById('utbl').innerHTML=USERS.map((u,i)=>`
    <tr><td style="font-weight:500">${u.name}</td><td style="color:var(--text-2);font-size:11px">${u.email}</td>
    <td><span class="badge ${RB[u.role]||'bpl'}">${RL[u.role]||u.role}</span></td>
    <td><span style="font-size:11px;color:var(--green)">● ${u.status}</span></td>
    <td><select style="font-size:11px;padding:3px 7px;border:.5px solid var(--border-md);border-radius:var(--radius);background:var(--bg-card)" onchange="changeRole(${i},this.value)">
      <option value="admin" ${u.role==='admin'?'selected':''}>Admin / Directeur</option>
      <option value="auditeur" ${u.role==='auditeur'?'selected':''}>Auditrice</option>
      <option value="audite" ${u.role==='audite'?'selected':''}>Audité</option>
    </select></td></tr>`).join('');
}

function changeRole(i,r){USERS[i].role=r;renderUsersTbl();toast('Rôle mis à jour');}
function approveUser(i){const u=PENDING[i];u.status='actif';USERS.push(u);PENDING.splice(i,1);addHist('add', `Accès validé pour ${u.name}`);nav('roles');toast(`Accès accordé à ${u.name} ✓`);}
function rejectUser(i){const u=PENDING[i];PENDING.splice(i,1);addHist('del', `Demande refusée pour ${u.name}`);nav('roles');toast('Refusé');}

function showInviteModal(){
  openModal('Inviter un membre',`
    <div><label>Prénom Nom</label><input id="iv-nm" placeholder="ex : Jean Martin"/></div>
    <div><label>Email</label><input id="iv-em" placeholder="jean@groupe.com"/></div>
    <div><label>Mot de passe provisoire</label><input id="iv-pw" type="password" placeholder="••••••••"/></div>
    <div><label>Rôle</label><select id="iv-rl"><option value="admin">Admin / Directeur</option><option value="auditeur" selected>Auditrice</option><option value="audite">Audité</option></select></div>`,
    ()=>{
      const name=document.getElementById('iv-nm').value.trim();
      const email=document.getElementById('iv-em').value.trim();
      const pwd=document.getElementById('iv-pw').value;
      if(!name||!email||!pwd){toast('Champs obligatoires');return;}
      USERS.push({id:'u'+Date.now(),name,email,pwd,role:document.getElementById('iv-rl').value,status:'actif'});
      addHist('add', `${name} invité(e)`);renderUsersTbl();toast(`${name} ajouté(e) ✓`);
    });
}

function buildControlList(ctrls){
  if(!ctrls||!ctrls.length)return'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun controle identifie.</div>';
  var h='<div class="ch"><span>Controle</span><span>Owner</span><span>Frequence</span><span>Clef ?</span><span>Design</span><span></span></div>';
  ctrls.forEach(function(ctrl,ci){
    h+='<div class="cr"><span style="font-weight:500">'+ctrl.name+'</span><span style="color:var(--text-2)">'+ctrl.owner+'</span><span style="color:var(--text-2)">'+ctrl.freq+'</span>';
    h+='<span><span class="badge '+(ctrl.clef?'bps':'bpl')+'">'+(ctrl.clef?'Oui':'Non')+'</span></span>';
    h+='<span><span class="badge '+(ctrl.design==='existing'?'bdn':'btg')+'">'+(ctrl.design==='existing'?'Existing':'Target')+'</span></span>';
    h+='<button class="bd" style="font-size:10px;padding:2px 6px" onclick="removeControl('+ci+')">X</button></div>';
  });
  return h;
}

function buildTargetList(targets){
  if(!targets||!targets.length)return'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun controle target.</div>';
  return targets.map(function(ctrl){
    return '<div class="fr"><div class="fh"><span class="badge btg">Target</span><div class="ft">'+ctrl.name+'</div></div>'
      +'<div style="font-size:11px;color:var(--red)">Controle non existant a definir par '+ctrl.owner+'.</div></div>';
  }).join('');
}

function buildDocList(docs){
  if(!docs||!docs.length)return'';
  return docs.map(function(f){
    return `<div style="display:flex;align-items:center;gap:7px;font-size:11px;color:var(--text-2);background:var(--bg);padding:5px 9px;border-radius:var(--radius);margin-bottom:5px">
      <span style="color:var(--purple)">&#9646;</span>${f.name}<span style="margin-left:auto;color:var(--text-3)">${f.size}</span>
      <button class="bd" style="font-size:10px;padding:2px 6px;margin-left:8px" onclick="deleteDoc(CA, '${f.path}', '${f.name}')">X</button></div>`;
  }).join('');
}

function buildAssigneeOpts(assigned,current){
  return (assigned||[]).map(function(id){
    return '<option value="'+id+'"'+(current===id?' selected':'')+'>'+((TM[id]&&TM[id].name)||id)+'</option>';
  }).join('');
}

function buildTplCards(names,badgeCls){
  return names.map(function(n){
    return '<div class="card" style="display:flex;flex-direction:column;gap:6px">'
      +'<div style="display:flex;justify-content:space-between"><div style="font-size:12px;font-weight:500">'+n+'</div>'
      +'<span class="badge '+badgeCls+'">'+(badgeCls==='bpc'?'Process':'BU')+'</span></div>'
      +'<div style="font-size:11px;color:var(--text-2)">3 phases · 11 etapes</div>'
      +'<button class="bs" style="width:100%">Utiliser</button></div>';
  }).join('');
}
