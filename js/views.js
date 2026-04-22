// Génère un UUID v4 compatible Supabase
function uuidv4(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){
    var r=Math.random()*16|0;
    return(c==='x'?r:(r&0x3|0x8)).toString(16);
  });
}

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

// ══════════════════════════════════════════════════════════════
//  MATRICE RISQUES — Helpers
// ══════════════════════════════════════════════════════════════
var RISK_LABELS_PxI={
  1:{label:'Faible',   color:'#059669',bg:'#ECFDF5',badge:'bdn'},
  2:{label:'Modéré',   color:'#B45309',bg:'#FFFBEB',badge:'bp2'},
  3:{label:'Élevé',    color:'#DC2626',bg:'#FEF2F2',badge:'blt'},
  4:{label:'Critique', color:'#7F1D1D',bg:'#FEE2E2',badge:'bhi'},
};

function riskScore(p,i){return Math.ceil(p*i/4);}
// Score 1-16 → criticité 1-4
function riskCrit(p,i){var s=p*i;if(s<=4)return 1;if(s<=8)return 2;if(s<=12)return 3;return 4;}
function riskCritLabel(p,i){return RISK_LABELS_PxI[riskCrit(p,i)];}

function riskBadge(p,i){
  var rl=riskCritLabel(p,i);
  return '<span class="badge" style="background:'+rl.bg+';color:'+rl.color+'">'+rl.label+' ('+p+'×'+i+'='+p*i+')</span>';
}

// Récupérer les risques d'un processus depuis PROCESSES
function getProcRisks(procId){
  var p=PROCESSES.find(function(x){return x.id===procId;});
  return(p&&p.risks)||[];
}

// ── Modale risques d'un processus ────────────────────────────────────────────
function showProcRisksModal(procId){
  var proc=PROCESSES.find(function(p){return p.id===procId;});
  if(!proc){toast('Processus introuvable');return;}
  var risks=proc.risks||[];

  function buildRiskRows(){
    if(!risks.length) return '<div style="font-size:12px;color:var(--text-3);padding:.5rem 0">Aucun risque défini.</div>';
    return risks.map(function(r,ri){
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);">'
        +'<div style="flex:1;font-size:12px;font-weight:500;">'+r.label+'</div>'
        +riskBadge(r.probability,r.impact)
        +(CU&&CU.role==='admin'?'<button class="bd" style="font-size:10px;padding:2px 6px" onclick="removeProcRisk(\''+procId+'\','+ri+')">×</button>':'')
        +'</div>';
    }).join('');
  }

  function buildModal(){
    var body='<div style="margin-bottom:1rem"><div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:.5rem">Risques du processus : <strong>'+proc.proc+'</strong></div>'
      +'<div id="proc-risk-list">'+buildRiskRows()+'</div></div>'
      +(CU&&CU.role==='admin'
        ?'<div style="border-top:1px solid var(--border);padding-top:.875rem;margin-top:.5rem">'
          +'<div style="font-size:12px;font-weight:600;margin-bottom:.625rem">Ajouter un risque</div>'
          +'<div><label>Description du risque <span style="color:var(--red)">*</span></label>'
          +'<input id="nr-label" placeholder="ex : Fraude fournisseur, Erreur de rapprochement..."/></div>'
          +'<div class="g2">'
          +'<div><label>Probabilité (1-4)</label>'
          +'<select id="nr-prob"><option value="1">1 — Rare</option><option value="2">2 — Peu probable</option><option value="3">3 — Probable</option><option value="4">4 — Quasi-certain</option></select></div>'
          +'<div><label>Impact (1-4)</label>'
          +'<select id="nr-imp"><option value="1">1 — Mineur</option><option value="2">2 — Modéré</option><option value="3">3 — Majeur</option><option value="4">4 — Critique</option></select></div>'
          +'</div>'
          +'<button class="bp" style="width:100%;margin-top:8px" onclick="addProcRisk(\''+procId+'\')">+ Ajouter ce risque</button>'
          +'</div>'
        :'');
    return body;
  }

  openModal('Risques — '+proc.proc, buildModal(), function(){});
  // Masquer le bouton Confirmer (on confirme via le bouton Ajouter)
  setTimeout(function(){var mok=document.getElementById('mok');if(mok)mok.style.display='none';},50);
}

async function addProcRisk(procId){
  var label=document.getElementById('nr-label').value.trim();
  if(!label){toast('Description obligatoire');return;}
  var prob=parseInt(document.getElementById('nr-prob').value)||1;
  var imp=parseInt(document.getElementById('nr-imp').value)||1;
  var proc=PROCESSES.find(function(p){return p.id===procId;});
  if(!proc){toast('Processus introuvable');return;}
  if(!proc.risks)proc.risks=[];
  proc.risks.push({id:'r'+Date.now(),label:label,probability:prob,impact:imp});
  // Sauvegarder en base
  await spUpsert('AF_Processes',proc.id,{dom:proc.dom,proc:proc.proc,risk:proc.risk,risk_level:proc.riskLevel||'faible',archived:proc.archived||false,risks_json:JSON.stringify(proc.risks),Title:proc.proc});
  document.getElementById('nr-label').value='';
  document.getElementById('proc-risk-list').innerHTML=(function(){
    var risks=proc.risks;
    if(!risks.length) return '<div style="font-size:12px;color:var(--text-3);padding:.5rem 0">Aucun risque défini.</div>';
    return risks.map(function(r,ri){
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);">'
        +'<div style="flex:1;font-size:12px;font-weight:500;">'+r.label+'</div>'
        +riskBadge(r.probability,r.impact)
        +'<button class="bd" style="font-size:10px;padding:2px 6px" onclick="removeProcRisk(\''+procId+'\','+ri+')">×</button>'
        +'</div>';
    }).join('');
  })();
  toast('Risque ajouté ✓');
}

async function removeProcRisk(procId,ri){
  var proc=PROCESSES.find(function(p){return p.id===procId;});
  if(!proc||!proc.risks)return;
  proc.risks.splice(ri,1);
  await spUpsert('AF_Processes',proc.id,{dom:proc.dom,proc:proc.proc,risk:proc.risk,risk_level:proc.riskLevel||'faible',archived:proc.archived||false,risks_json:JSON.stringify(proc.risks),Title:proc.proc});
  // Rafraîchir la liste dans la modale
  document.getElementById('proc-risk-list').innerHTML=(function(){
    var risks=proc.risks;
    if(!risks.length) return '<div style="font-size:12px;color:var(--text-3);padding:.5rem 0">Aucun risque défini.</div>';
    return risks.map(function(r,ri2){
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);">'
        +'<div style="flex:1;font-size:12px;font-weight:500;">'+r.label+'</div>'
        +riskBadge(r.probability,r.impact)
        +'<button class="bd" style="font-size:10px;padding:2px 6px" onclick="removeProcRisk(\''+procId+'\','+ri2+')">×</button>'
        +'</div>';
    }).join('');
  })();
  toast('Risque supprimé ✓');
}

// ══════════════════════════════════════════════════════════════
//  MATRICE RISQUES — Step 5
// ══════════════════════════════════════════════════════════════
function renderRiskMatrix(){
  var ap=AUDIT_PLAN.find(function(a){return a.id===CA;});
  var d=getAudData(CA);
  if(!d.riskLinks)d.riskLinks={};  // {riskId: [controlId, ...]}
  if(!d.auditRisks)d.auditRisks=[]; // risques spécifiques à cet audit

  // Risques des processus associés (prédéfinis) — gère multi-processus
  var pids = (Array.isArray(ap&&ap.processIds) && ap.processIds.length)
    ? ap.processIds
    : (ap && ap.processId ? [ap.processId] : []);
  var procRisks = [];
  pids.forEach(function(pid){
    var procObj = PROCESSES.find(function(p){return p.id===pid;});
    var procName = procObj ? procObj.proc : '';
    (getProcRisks(pid)||[]).forEach(function(r){
      // Préfixer le nom du risque par le processus source (utile en cross-process)
      procRisks.push(Object.assign({}, r, {
        _procName: procName,
        title: (pids.length>1 && procName) ? ('['+procName+'] '+r.title) : r.title,
      }));
    });
  });

  // Fusionner risques prédéfinis + risques audit
  var allRisks=[...procRisks,...(d.auditRisks||[])];

  // Contrôles disponibles (step 4 = index 4)
  var allControls=d.controls[4]||[];

  // Calculer le statut de couverture pour chaque risque
  function getRiskStatus(riskId){
    var linkedCtrlIds=d.riskLinks[riskId]||[];
    if(!linkedCtrlIds.length) return {status:'uncovered',label:'Non couvert',color:'#DC2626',bg:'#FEF2F2'};
    var linkedCtrls=allControls.filter(function(c){return linkedCtrlIds.includes(c.name);});
    var allPass=linkedCtrls.filter(function(c){return c.finalized&&c.result==='pass';});
    var anyFail=linkedCtrls.some(function(c){return c.finalized&&c.result==='fail';});
    var anyTarget=linkedCtrls.some(function(c){return c.design==='target';});
    if(anyFail||anyTarget) return {status:'residual',label:'Risque résiduel',color:'#B45309',bg:'#FFFBEB'};
    if(allPass.length>0) return {status:'covered',label:'Couvert',color:'#059669',bg:'#ECFDF5'};
    return {status:'partial',label:'En cours',color:'#2563EB',bg:'#EFF6FF'};
  }

  // Stats
  var covered=allRisks.filter(function(r){return getRiskStatus(r.id).status==='covered';}).length;
  var residual=allRisks.filter(function(r){return getRiskStatus(r.id).status==='residual';}).length;
  var uncovered=allRisks.filter(function(r){return getRiskStatus(r.id).status==='uncovered';}).length;

  // Construire le HTML
  var html='<div class="card">';
  html+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">';
  html+='<div style="font-size:13px;font-weight:600">Matrice de couverture des risques</div>';
  html+='<button class="bs" style="font-size:11px" onclick="showAddAuditRiskModal()">+ Risque ad hoc</button>';
  html+='</div>';

  // KPIs
  html+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:1rem">';
  html+='<div class="card" style="background:#ECFDF5;text-align:center;padding:.625rem"><div style="font-size:10px;color:var(--text-3)">Couverts</div><div style="font-size:20px;font-weight:700;color:#059669">'+covered+'</div></div>';
  html+='<div class="card" style="background:#FFFBEB;text-align:center;padding:.625rem"><div style="font-size:10px;color:var(--text-3)">Résiduel</div><div style="font-size:20px;font-weight:700;color:#B45309">'+residual+'</div></div>';
  html+='<div class="card" style="background:#FEF2F2;text-align:center;padding:.625rem"><div style="font-size:10px;color:var(--text-3)">Non couverts</div><div style="font-size:20px;font-weight:700;color:#DC2626">'+uncovered+'</div></div>';
  html+='</div>';

  if(!allRisks.length){
    html+='<div style="font-size:12px;color:var(--text-3);padding:.5rem">';
    html+='Aucun risque défini.'+(pids.length?' Ajoutez des risques dans <strong>Audit Universe</strong> sur les processus de cet audit, ou ajoutez un risque ad hoc ci-dessus.':' Ajoutez des risques ad hoc ou associez un processus à cet audit.');
    html+='</div>';
    html+='</div>';
    return html;
  }

  // Tableau risques
  html+='<div class="tw"><table>';
  html+='<thead><tr><th>Risque</th><th>P</th><th>I</th><th>Score</th><th>Criticité</th><th>Contrôles associés</th><th>Statut couverture</th><th></th></tr></thead><tbody>';

  allRisks.forEach(function(r){
    var status=getRiskStatus(r.id);
    var linkedIds=d.riskLinks[r.id]||[];
    var linkedCtrls=allControls.filter(function(c){return linkedIds.includes(c.name);});
    var ctrlBadges=linkedCtrls.map(function(c){
      var res=c.finalized?(c.result==='pass'?'<span style="color:#059669">✓</span>':'<span style="color:#DC2626">✗</span>'):'';
      return '<span class="badge bpl" style="font-size:9px;margin-right:2px">'+c.name+res+'</span>';
    }).join('');
    var isAuditRisk=(d.auditRisks||[]).some(function(x){return x.id===r.id;});

    html+='<tr>';
    html+='<td style="font-weight:500;font-size:11px">'+r.label+(isAuditRisk?'<span class="badge bpc" style="font-size:8px;margin-left:4px">Ad hoc</span>':'')+'</td>';
    html+='<td style="text-align:center;font-weight:600">'+r.probability+'</td>';
    html+='<td style="text-align:center;font-weight:600">'+r.impact+'</td>';
    html+='<td style="text-align:center;font-weight:700;font-size:13px">'+r.probability*r.impact+'</td>';
    html+='<td>'+riskBadge(r.probability,r.impact)+'</td>';
    html+='<td style="max-width:200px">'+( ctrlBadges||'<span style="color:var(--text-3);font-size:10px">—</span>')+'</td>';
    html+='<td><span class="badge" style="background:'+status.bg+';color:'+status.color+'">'+status.label+'</span></td>';
    html+='<td style="white-space:nowrap">';
    html+='<button class="bs" style="font-size:9px;padding:2px 6px" onclick="showLinkControlModal(\''+r.id+'\')">Lier contrôle</button>';
    if(isAuditRisk) html+=' <button class="bd" style="font-size:9px;padding:2px 6px" onclick="removeAuditRisk(\''+r.id+'\')">×</button>';
    html+='</td>';
    html+='</tr>';
  });

  html+='</tbody></table></div>';

  // Heatmap 4x4
  html+='<div style="margin-top:1.25rem">';
  html+='<div style="font-size:12px;font-weight:600;margin-bottom:.625rem">Heat Map P×I</div>';
  html+=buildHeatmap(allRisks,d.riskLinks);
  html+='</div>';
  html+='</div>';
  return html;
}

function buildHeatmap(risks){
  var COLORS=[
    ['#ECFDF5','#ECFDF5','#FFFBEB','#FEF2F2'],
    ['#ECFDF5','#FFFBEB','#FEF2F2','#FEF2F2'],
    ['#FFFBEB','#FEF2F2','#FEF2F2','#FEE2E2'],
    ['#FEF2F2','#FEF2F2','#FEE2E2','#FEE2E2'],
  ];
  var h='<div style="display:inline-block">';
  h+='<div style="display:flex;align-items:center;margin-bottom:2px">';
  h+='<div style="width:60px;font-size:9px;color:var(--text-3);text-align:right;padding-right:4px">Impact →</div>';
  for(var i=1;i<=4;i++) h+='<div style="width:64px;text-align:center;font-size:10px;font-weight:600;color:var(--text-2)">I='+i+'</div>';
  h+='</div>';
  for(var p=4;p>=1;p--){
    h+='<div style="display:flex;align-items:center;margin-bottom:2px">';
    h+='<div style="width:60px;font-size:10px;font-weight:600;color:var(--text-2);text-align:right;padding-right:4px">P='+p+'</div>';
    for(var im=1;im<=4;im++){
      var cellRisks=risks.filter(function(r){return r.probability===p&&r.impact===im;});
      var bg=COLORS[4-p][im-1];
      h+='<div style="width:64px;height:52px;background:'+bg+';border:1px solid rgba(0,0,0,.06);border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:9px;text-align:center;padding:2px">';
      h+='<div style="font-size:10px;font-weight:700;color:rgba(0,0,0,.3)">'+p*im+'</div>';
      if(cellRisks.length){
        cellRisks.slice(0,2).forEach(function(r){
          var lbl=r.label.length>12?r.label.slice(0,10)+'…':r.label;
          h+='<div style="font-size:8px;font-weight:500;color:#111;line-height:1.1;text-align:center">'+lbl+'</div>';
        });
        if(cellRisks.length>2) h+='<div style="font-size:8px;color:var(--text-3)">+'+( cellRisks.length-2)+'</div>';
      }
      h+='</div>';
    }
    h+='</div>';
  }
  h+='<div style="font-size:9px;color:var(--text-3);margin-top:4px;padding-left:60px">Probabilité ↑</div>';
  h+='</div>';
  return h;
}

function showAddAuditRiskModal(){
  openModal('Ajouter un risque ad hoc',
    '<div><label>Description du risque <span style="color:var(--red)">*</span></label>'
    +'<input id="ar-label" placeholder="ex : Accès non autorisé au SI..."/></div>'
    +'<div class="g2">'
    +'<div><label>Probabilité (1-4)</label>'
    +'<select id="ar-prob"><option value="1">1 — Rare</option><option value="2">2 — Peu probable</option><option value="3">3 — Probable</option><option value="4">4 — Quasi-certain</option></select></div>'
    +'<div><label>Impact (1-4)</label>'
    +'<select id="ar-imp"><option value="1">1 — Mineur</option><option value="2">2 — Modéré</option><option value="3">3 — Majeur</option><option value="4">4 — Critique</option></select></div>'
    +'</div>',
    async function(){
      var label=document.getElementById('ar-label').value.trim();
      if(!label){toast('Description obligatoire');return;}
      var prob=parseInt(document.getElementById('ar-prob').value)||1;
      var imp=parseInt(document.getElementById('ar-imp').value)||1;
      var d=getAudData(CA);
      if(!d.auditRisks)d.auditRisks=[];
      d.auditRisks.push({id:'ar'+Date.now(),label:label,probability:prob,impact:imp});
      await saveAuditData(CA);
      document.getElementById('det-content').innerHTML=renderDetContent();
      toast('Risque ajouté ✓');
    });
}

async function removeAuditRisk(riskId){
  var d=getAudData(CA);
  d.auditRisks=(d.auditRisks||[]).filter(function(r){return r.id!==riskId;});
  if(d.riskLinks&&d.riskLinks[riskId]) delete d.riskLinks[riskId];
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML=renderDetContent();
  toast('Risque supprimé ✓');
}

function showLinkControlModal(riskId){
  var d=getAudData(CA);
  var allControls=d.controls[4]||[];
  var linkedIds=d.riskLinks[riskId]||[];
  if(!allControls.length){toast('Aucun contrôle disponible — documentez d\'abord les contrôles en step 4');return;}

  var checks=allControls.map(function(c,ci){
    var checked=linkedIds.includes(c.name);
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">'
      +'<input type="checkbox" id="rl-c'+ci+'" value="'+_escQ(c.name)+'" '+(checked?'checked':'')+'/>'
      +'<label for="rl-c'+ci+'" style="font-size:12px;cursor:pointer;flex:1">'+c.name+'</label>'
      +'<span class="badge '+(c.design==='existing'?'bdn':'btg')+'" style="font-size:9px">'+(c.design==='existing'?'Existing':'Target')+'</span>'
      +(c.finalized?'<span class="badge '+(c.result==='pass'?'bdn':'blt')+'" style="font-size:9px">'+(c.result==='pass'?'Pass':'Fail')+'</span>':'')
      +'</div>';
  }).join('');

  openModal('Lier des contrôles à ce risque',
    '<div style="font-size:11px;color:var(--text-2);margin-bottom:.75rem">Sélectionnez les contrôles qui couvrent ce risque :</div>'+checks,
    async function(){
      var selected=[];
      allControls.forEach(function(c,ci){
        var cb=document.getElementById('rl-c'+ci);
        if(cb&&cb.checked) selected.push(c.name);
      });
      if(!d.riskLinks)d.riskLinks={};
      d.riskLinks[riskId]=selected;
      await saveAuditData(CA);
      document.getElementById('det-content').innerHTML=renderDetContent();
      toast(selected.length+' contrôle(s) associé(s) ✓');
    });
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
  // ── Toutes les années disponibles (calculées depuis AUDIT_PLAN) ─
  var allYears=[...new Set(AUDIT_PLAN.map(function(a){return a.annee;}).filter(function(y){return y;}))].sort();

  // ── Année active (filtre) ─────────────────────────────────
  // Par défaut : la plus récente année qui a des audits, sinon 2026
  if(typeof _dbYear==='undefined') {
    window._dbYear = allYears.length ? allYears[allYears.length-1] : 2026;
  }
  // Sécurité : si _dbYear pointe vers une année sans audits, rebasculer sur la plus récente qui en a
  if(allYears.length && !allYears.includes(_dbYear)) {
    window._dbYear = allYears[allYears.length-1];
  }
  if(typeof _dbAuditeur==='undefined') window._dbAuditeur='all';
  if(typeof _dbStatut==='undefined') window._dbStatut='all';

  // Appliquer filtres
  var filtered=AUDIT_PLAN.filter(function(a){
    var okY  = a.annee===_dbYear;
    var okA  = _dbAuditeur==='all'||(a.auditeurs||[]).includes(_dbAuditeur);
    var okS  = _dbStatut==='all'||(a.statut||'').startsWith(_dbStatut);
    return okY&&okA&&okS;
  });

  var yClosed  = filtered.filter(function(a){return (a.statut||'').startsWith('Clôturé');});
  var yInProg  = filtered.filter(function(a){return (a.statut||'').startsWith('En cours');});
  var yPlanned = filtered.filter(function(a){return (a.statut||'').startsWith('Planifié');});
  var yLate    = filtered.filter(function(a){return (a.statut||'').startsWith('En retard');});
  var closedPct= filtered.length?Math.round(yClosed.length/filtered.length*100):0;

  // Toutes les stats pour le graphique (pas filtrées par statut)
  var forChart=AUDIT_PLAN.filter(function(a){
    return a.annee===_dbYear&&(_dbAuditeur==='all'||(a.auditeurs||[]).includes(_dbAuditeur));
  });
  var cClosed  = forChart.filter(function(a){return (a.statut||'').startsWith('Clôturé');}).length;
  var cInProg  = forChart.filter(function(a){return (a.statut||'').startsWith('En cours');}).length;
  var cPlanned = forChart.filter(function(a){return (a.statut||'').startsWith('Planifié');}).length;
  var cLate    = forChart.filter(function(a){return (a.statut||'').startsWith('En retard');}).length;
  var cTotal   = forChart.length;

  var lateActions=ACTIONS.filter(function(a){return a.status==='En retard';}).slice(0,3);

  // Options filtres
  var yearOpts=allYears.map(function(y){
    return '<option value="'+y+'"'+(_dbYear===y?' selected':'')+'>'+y+'</option>';
  }).join('');

  var audOpts='<option value="all">Tous</option>'
    +Object.keys(TM).map(function(id){
      return '<option value="'+id+'"'+(_dbAuditeur===id?' selected':'')+'>'+TM[id].name+'</option>';
    }).join('');

  var statOpts=[
    {v:'all',l:'Tous statuts'},
    {v:'Clôturé',l:'Clôturé'},
    {v:'En cours',l:'En cours'},
    {v:'Planifié',l:'Planifié'},
    {v:'En retard',l:'En retard'},
  ].map(function(o){
    return '<option value="'+o.v+'"'+(_dbStatut===o.v?' selected':'')+'>'+o.l+'</option>';
  }).join('');

  // Tableau d'audits
  var auditRows=filtered.length?filtered.map(function(ap){
    var detail=ap.type==='Process'?(ap.domaine+' › '+ap.process):(ap.pays||[]).join(', ');
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
  }).join(''):'<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:1rem">Aucun audit pour ces filtres.</td></tr>';

  var lateRows=lateActions.map(function(a){
    return '<div class="ar"><div style="flex:1"><div class="an">'+a.title+'</div>'
      +'<div class="am">'+a.dept+' · '+a.quarter+' '+a.year+'</div></div>'
      +badge(a.status)+'</div>';
  }).join('')||'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun plan urgent</div>';

  var html='';
  html+='<div class="topbar"><div class="tbtitle">Tableau de bord — '+_dbYear+'</div>';
  html+='<div style="display:flex;gap:7px;">'
    +'<button class="bs" onclick="exportDashboardPDF()" style="font-size:11px;">⬇ Export PDF</button>'
    +'<button class="bp" onclick="nav(\'plan-audit\')">+ Nouvel audit</button>'
    +'</div></div>';
  html+='<div class="content" style="display:flex;gap:1rem;align-items:flex-start">';

  // ── Colonne de filtres (gauche) ───────────────────────────
  html+='<div style="width:180px;flex-shrink:0;display:flex;flex-direction:column;gap:10px;">';
  html+='<div class="card" style="padding:.875rem;">';
  html+='<div style="font-size:11px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Filtres</div>';

  html+='<div style="margin-bottom:8px;">';
  html+='<label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px;">Année</label>';
  html+='<select class="f-inp" style="width:100%;font-size:12px;height:30px;padding:0 8px;" onchange="dbSetYear(parseInt(this.value))">'+yearOpts+'</select>';
  html+='</div>';

  html+='<div style="margin-bottom:8px;">';
  html+='<label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px;">Auditeur</label>';
  html+='<select class="f-inp" style="width:100%;font-size:12px;height:30px;padding:0 8px;" onchange="dbSetAuditeur(this.value)">'+audOpts+'</select>';
  html+='</div>';

  html+='<div>';
  html+='<label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px;">Statut</label>';
  html+='<select class="f-inp" style="width:100%;font-size:12px;height:30px;padding:0 8px;" onchange="dbSetStatut(this.value)">'+statOpts+'</select>';
  html+='</div>';
  html+='</div>';

  // ── Métriques cliquables ──────────────────────────────────
  html+='<div style="display:flex;flex-direction:column;gap:7px;margin-top:0;">';
  var metrics=[
    {label:'Total '+_dbYear,val:forChart.length,color:'var(--text)',statut:'all'},
    {label:'Clôturés',val:cClosed,color:'var(--green)',statut:'Clôturé'},
    {label:'En cours',val:cInProg,color:'var(--purple)',statut:'En cours'},
    {label:'Planifiés',val:cPlanned,color:'var(--amber)',statut:'Planifié'},
    {label:'En retard',val:cLate,color:'var(--red)',statut:'En retard'},
  ];
  metrics.forEach(function(m){
    var active=_dbStatut===m.statut;
    html+='<div onclick="dbSetStatut(\''+m.statut+'\')" style="cursor:pointer;padding:.625rem .875rem;'
      +'background:'+(active?'var(--purple-lt)':'var(--white)')+';'
      +'border:.5px solid '+(active?'var(--purple)':'var(--border)')+';'
      +'border-radius:var(--radius);transition:all .15s;">'
      +'<div style="font-size:10px;color:var(--text-2);margin-bottom:2px;">'+m.label+'</div>'
      +'<div style="font-size:20px;font-weight:600;color:'+m.color+';">'+m.val+'</div>'
      +'</div>';
  });
  html+='</div>';
  html+='</div>';

  // ── Zone principale (droite) ──────────────────────────────
  html+='<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1rem;">';

  // Graphique donut
  html+='<div class="card" style="padding:1rem;">';
  html+='<div style="font-size:13px;font-weight:600;margin-bottom:.75rem;">Répartition des audits '+_dbYear+'</div>';
  html+='<div style="display:flex;align-items:center;gap:1.5rem;">';
  html+='<canvas id="db-donut" width="140" height="140" style="flex-shrink:0;"></canvas>';
  html+='<div style="display:flex;flex-direction:column;gap:7px;font-size:12px;">';
  var chartItems=[
    {label:'Clôturés',val:cClosed,color:'#5DCAA5'},
    {label:'En cours',val:cInProg,color:'#AFA9EC'},
    {label:'Planifiés',val:cPlanned,color:'#EF9F27'},
    {label:'En retard',val:cLate,color:'#F0997B'},
  ];
  chartItems.forEach(function(ci){
    var pct2=cTotal?Math.round(ci.val/cTotal*100):0;
    html+='<div style="display:flex;align-items:center;gap:7px;">'
      +'<div style="width:10px;height:10px;border-radius:50%;background:'+ci.color+';flex-shrink:0;"></div>'
      +'<span style="color:var(--text-2);">'+ci.label+'</span>'
      +'<span style="font-weight:600;margin-left:auto;">'+ci.val+' <span style="font-weight:400;color:var(--text-3);">('+pct2+'%)</span></span>'
      +'</div>';
  });
  html+='</div></div></div>';

  // Tableau des audits
  html+='<div>';
  html+='<div class="sth" style="margin-bottom:.625rem;">';
  html+='<div class="st">Audits '+_dbYear+(_dbStatut!=='all'?' — '+_dbStatut:'')+(_dbAuditeur!=='all'?' — '+(TM[_dbAuditeur]&&TM[_dbAuditeur].name||_dbAuditeur):'')+' ('+filtered.length+')</div>';
  html+='</div>';
  html+='<div class="tw"><table>';
  html+='<thead><tr><th>Titre</th><th>Type</th><th>Détail</th><th>Auditeurs</th><th>Statut</th><th>Étape</th><th>Avancement</th></tr></thead>';
  html+='<tbody>'+auditRows+'</tbody></table></div></div>';

  // Plans d'action urgents
  html+='<div>';
  html+='<div class="sth"><div class="st">Plans d\'action urgents</div><button class="bs" style="font-size:11px" onclick="nav(\'plans-action\')">Voir tout</button></div>';
  html+='<div>'+lateRows+'</div>';
  html+='</div>';

  html+='</div>'; // fin zone principale
  html+='</div>'; // fin content
  return html;
};

I['dashboard']=function(){
  // Bandeau notifications audits en retard
  var lateAudits=AUDIT_PLAN.filter(function(a){return(a.statut||'').startsWith('En retard');});
  var lateActs  =ACTIONS.filter(function(a){return a.status==='En retard';});
  var total=lateAudits.length+lateActs.length;
  var notifBar=document.getElementById('notif-bar');
  if(notifBar){
    if(total>0){
      notifBar.style.display='flex';
      var msg=total+' élément'+(total>1?'s':'')+' en retard — ';
      if(lateAudits.length) msg+=lateAudits.length+' audit'+(lateAudits.length>1?'s':'');
      if(lateAudits.length&&lateActs.length) msg+=' · ';
      if(lateActs.length) msg+=lateActs.length+' plan'+(lateActs.length>1?'s':'')+' d\u0027action';
      msg+=' nécessitent votre attention.';
      notifBar.innerHTML='<span style="font-size:13px;margin-right:6px;">⚠️</span><span>'+msg+'</span>'
        +'<button onclick="document.getElementById(\'notif-bar\').style.display=\'none\'"'
        +' style="margin-left:auto;background:none;border:none;cursor:pointer;color:#fff;font-size:18px;line-height:1;">×</button>';
    } else {
      notifBar.style.display='none';
    }
  }
  // Dessiner le donut après rendu
  setTimeout(function(){
    var canvas=document.getElementById('db-donut');
    if(!canvas) return;
    var CY=window._dbYear||2026;
    var DA=window._dbAuditeur||'all';
    var forChart=AUDIT_PLAN.filter(function(a){
      return a.annee===CY&&(DA==='all'||(a.auditeurs||[]).includes(DA));
    });
    var cClosed  = forChart.filter(function(a){return (a.statut||'').startsWith('Clôturé');}).length;
    var cInProg  = forChart.filter(function(a){return (a.statut||'').startsWith('En cours');}).length;
    var cPlanned = forChart.filter(function(a){return (a.statut||'').startsWith('Planifié');}).length;
    var cLate    = forChart.filter(function(a){return (a.statut||'').startsWith('En retard');}).length;
    var total    = cClosed+cInProg+cPlanned+cLate;
    if(!total) return;
    var segments=[
      {val:cClosed, color:'#5DCAA5'},
      {val:cInProg, color:'#AFA9EC'},
      {val:cPlanned,color:'#EF9F27'},
      {val:cLate,   color:'#F0997B'},
    ];
    var ctx=canvas.getContext('2d');
    var cx=70,cy=70,r=60,inner=38;
    var start=-Math.PI/2;
    ctx.clearRect(0,0,140,140);
    segments.forEach(function(s){
      if(!s.val) return;
      var slice=2*Math.PI*(s.val/total);
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,r,start,start+slice);
      ctx.closePath();
      ctx.fillStyle=s.color;
      ctx.fill();
      start+=slice;
    });
    // Trou central
    ctx.beginPath();
    ctx.arc(cx,cy,inner,0,2*Math.PI);
    ctx.fillStyle='#fff';
    ctx.fill();
    // Texte central
    ctx.fillStyle='#1A1A18';
    ctx.font='600 20px -apple-system,system-ui,sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(total,cx,cy-8);
    ctx.font='11px -apple-system,system-ui,sans-serif';
    ctx.fillStyle='#9C9A92';
    ctx.fillText('audits',cx,cy+10);
  },60);
};

// Fonctions de filtrage dashboard
function dbSetYear(y){window._dbYear=y;nav('dashboard');}
function dbSetAuditeur(v){window._dbAuditeur=v;nav('dashboard');}
function dbSetStatut(v){window._dbStatut=v;nav('dashboard');}


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
  var doms=[...new Set(PROCESSES.map(function(p){return p.dom;}))].sort(function(a,b){
    return (a||'').localeCompare(b||'', 'fr', {sensitivity:'base'});
  });
  var h='<thead><tr>'
    +'<th style="width:160px">Domaine</th>'
    +'<th>Processus</th>'
    +'<th style="width:120px">Niveau de risque</th>'
    +'<th style="width:180px">'+(CU&&CU.role==='admin'?'Actions':'Risques')+'</th>'
    +'</tr></thead><tbody>';

  if(!doms.length){
    h+='<tr><td colspan="4" style="text-align:center;color:var(--text-3);padding:2rem">Aucun processus. Cliquez sur "+ Domaine" pour commencer.</td></tr>';
  } else {
    doms.forEach(function(dom){
      var rows=PROCESSES.filter(function(p){return p.dom===dom&&!p.archived;});
      if(!rows.length) return;
      // Trier les processus A-Z
      rows.sort(function(a,b){
        return (a.proc||'').localeCompare(b.proc||'', 'fr', {sensitivity:'base'});
      });
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
        var riskCount=(p.risks||[]).length;
        var riskCountBadge=riskCount?'<span class="badge bpc" style="font-size:9px;margin-left:4px">'+riskCount+' risque'+(riskCount>1?'s':'')+'</span>':'';
        var adminCell=CU&&CU.role==='admin'
          ?'<td style="white-space:nowrap">'
            +'<button class="bs" style="font-size:10px;padding:2px 7px" onclick="showProcRisksModal(\''+p.id+'\')">⚠ Risques'+riskCountBadge+'</button> '
            +'<button class="bs" style="font-size:10px;padding:2px 7px" onclick="showEditProcModal('+idx+')">Modifier</button> '
            +'<button class="bd" style="font-size:10px;padding:2px 7px" onclick="archiveProc('+idx+')">Archiver</button>'
            +'</td>'
          :'<td><button class="bs" style="font-size:10px;padding:2px 7px" onclick="showProcRisksModal(\''+p.id+'\')">⚠ Risques'+riskCountBadge+'</button></td>';
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
      spUpsert('AF_Processes',newP.id,{dom:name,proc:newP.proc,risk:1,risk_level:'faible',archived:false,Title:newP.proc}).catch(console.warn);
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
      PROCESSES.forEach(function(p){
        if(p.dom===dom){
          p.dom=newName;
          spUpsert('AF_Processes',p.id,{dom:newName,proc:p.proc,risk:p.risk,risk_level:p.riskLevel||'faible',archived:p.archived||false,Title:p.proc}).catch(console.warn);
        }
      });
      addHist('edit','Domaine "'+dom+'" renommé en "'+newName+'"');
      renderProcTable();
      toast('Renommé ✓');
    });
}

// Modifier le niveau de risque
function editRiskLevel(idx,val){
  PROCESSES[idx].riskLevel=val;
  PROCESSES[idx].risk=RISK_LEVELS.findIndex(function(r){return r.key===val;})+1||1;
  var p=PROCESSES[idx];
  spUpsert('AF_Processes',p.id,{dom:p.dom,proc:p.proc,risk:p.risk,risk_level:val,archived:p.archived||false,Title:p.proc}).catch(console.warn);
  addHist('edit','Risque "'+p.proc+'" modifié → '+val);
  toast('Risque mis à jour ✓');
}

function archiveProc(idx){
  PROCESSES[idx].archived=true;
  var p=PROCESSES[idx];
  spUpsert('AF_Processes',p.id,{dom:p.dom,proc:p.proc,risk:p.risk,risk_level:p.riskLevel||'faible',archived:true,Title:p.proc}).catch(console.warn);
  addHist('arch','Process "'+p.proc+'" archivé');
  renderProcTable();
  toast('Archivé ✓');
}

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
      spUpsert('AF_Processes',newP.id,{dom:dom,proc:proc,risk:riskNum,risk_level:riskKey,archived:false,Title:proc}).catch(console.warn);
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
      spUpsert('AF_Processes',p.id,{dom:p.dom,proc:p.proc,risk:p.risk,risk_level:p.riskLevel,archived:p.archived||false,Title:p.proc}).catch(console.warn);
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
    var stored=sessionStorage.getItem('af_group_structure');
    if(stored) GROUP_STRUCTURE=JSON.parse(stored);
  } catch(e){ console.warn('[GS] load:',e.message); }
}

// Sauvegarder une ligne dans af_group_structure
async function gsSave(type,id,name,parentId,countries){
  sessionStorage.setItem('af_group_structure',JSON.stringify(GROUP_STRUCTURE));
}

async function gsDelete(id){
  sessionStorage.setItem('af_group_structure',JSON.stringify(GROUP_STRUCTURE));
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
      var id=uuidv4();
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
      var id=uuidv4();
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
      var detail;
      if (ap.type==='Process') {
        // Support multi-processus
        var pids = (Array.isArray(ap.processIds) && ap.processIds.length)
          ? ap.processIds
          : (ap.processId ? [ap.processId] : []);
        if (pids.length > 1) {
          // Plusieurs processus : afficher le domaine + liste compacte
          var procNames = pids.map(function(pid){
            var p = PROCESSES.find(function(x){return x.id===pid;});
            return p ? p.proc : pid;
          });
          detail = '<span style="font-size:11px"><strong>'+(ap.domaine||'Multi')+'</strong> › <span style="color:var(--purple-dk)">'+pids.length+' processus</span><div style="font-size:10px;color:var(--text-3);margin-top:2px">'+procNames.join(' · ')+'</div></span>';
        } else {
          detail = '<span style="font-size:11px"><strong>'+(ap.domaine||'')+'</strong> › '+(ap.process||'')+'</span>';
        }
      } else {
        detail = '<span style="font-size:11px"><strong>'+(ap.entite||'')+'</strong> · '+(ap.region||'')+' · '+(ap.pays||[]).join(', ')+'</span>';
      }
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

// ── Modal audit (multi-processus) ─────────────────────────────
function auditModalBody(ap){
  var doms=[...new Set(PROCESSES.map(function(p){return p.dom;}))].sort(function(a,b){
    return (a||'').localeCompare(b||'', 'fr', {sensitivity:'base'});
  });
  var type=(ap&&ap.type)||'Process';
  // Récupérer les processIds actuels (ou [processId] pour compat)
  var currentPids = (ap && Array.isArray(ap.processIds) && ap.processIds.length)
    ? ap.processIds
    : (ap && ap.processId ? [ap.processId] : []);

  // Liste des checkboxes groupées par domaine
  var procListHtml = '';
  if (doms.length) {
    procListHtml = doms.map(function(dom){
      var procsInDom = PROCESSES.filter(function(p){return p.dom===dom && !p.archived;})
        .sort(function(a,b){return (a.proc||'').localeCompare(b.proc||'', 'fr', {sensitivity:'base'});});
      if (!procsInDom.length) return '';
      var items = procsInDom.map(function(p){
        var checked = currentPids.indexOf(p.id)>=0 ? ' checked' : '';
        return '<label>'
          + '<input type="checkbox" class="m-proc-cb" value="'+p.id+'"'+checked+'>'
          + '<span>'+p.proc+'</span>'
          + '</label>';
      }).join('');
      return '<div style="margin-bottom:10px">'
        + '<div style="font-size:10px;font-weight:600;color:var(--purple-dk);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;padding-bottom:3px;border-bottom:.5px solid var(--border)">'+dom+'</div>'
        + '<div>'+items+'</div>'
        + '</div>';
    }).join('');
  } else {
    procListHtml = '<div style="font-size:11px;color:var(--text-3);padding:.5rem">Aucun processus défini. Créez-en d\'abord dans Audit Universe.</div>';
  }

  var h='';
  h+='<div><label>Type d\'audit</label><select id="m-type" onchange="toggleAuditTypeFields(this.value)"><option value="Process"'+(type==='Process'?' selected':'')+'>Process Audit</option><option value="BU"'+(type==='BU'?' selected':'')+'>BU Audit</option></select></div>';
  h+='<div id="m-proc-fields" style="'+(type==='BU'?'display:none':'')+'">';
  h+='<div><label>Processus couverts <span style="color:var(--red)">*</span></label>';
  h+='<div style="font-size:10px;color:var(--text-3);margin-bottom:5px">Cochez un ou plusieurs processus (multi-domaines autorisés)</div>';
  h+='<div id="m-proc-list" style="max-height:220px;overflow-y:auto;border:.5px solid var(--border);border-radius:var(--radius);padding:8px 10px;background:var(--bg-card)">'
    + procListHtml
    + '</div>';
  h+='<div id="m-proc-count" style="font-size:11px;color:var(--purple);margin-top:5px;font-weight:500"></div>';
  h+='</div></div>';
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
  // Auditeurs : dédupliqués par nom + exclusion de l'admin courant (auto-assigné)
  // Les auditeurs actifs sont automatiquement disponibles, l'admin actuel est pré-assigné
  h+='<div><label>Auditeurs assignés</label>';
  h+='<div style="font-size:10px;color:var(--text-3);margin-bottom:5px">Vous (admin) êtes automatiquement assigné.</div>';
  h+='<div class="cb-list" style="display:flex;gap:6px;flex-wrap:wrap">';
  // Récupérer les auditeurs actifs (rôle = auditeur)
  var availAuditors = (USERS||[]).filter(function(u){return u.status==='actif' && u.role==='auditeur';});
  // Dédupliquer par nom (cas des alias @74software + @axway)
  var seenNames = {};
  var uniqueAuditors = [];
  availAuditors.forEach(function(u){
    var key = (u.name||'').trim().toLowerCase();
    if (!seenNames[key]) {
      seenNames[key] = true;
      uniqueAuditors.push(u);
    }
  });
  // Vérifier si un auditeur est coché (dans l'audit existant, peut-être via un id différent mais même nom)
  var isAuditorChecked = function(user) {
    if (!ap || !ap.auditeurs) return false;
    if (ap.auditeurs.indexOf(user.id)>=0) return true;
    var myName = (user.name||'').trim().toLowerCase();
    return ap.auditeurs.some(function(aId){
      var matched = (USERS||[]).find(function(u){return u.id===aId;});
      if (matched && (matched.name||'').trim().toLowerCase()===myName) return true;
      var tm = TM[aId];
      if (tm && tm.name && tm.name.trim().toLowerCase().indexOf(myName.split(' ')[0])>=0) return true;
      return false;
    });
  };
  if (!uniqueAuditors.length) {
    h+='<label><input type="checkbox" class="m-auditor" value="sh"'+((ap&&ap.auditeurs&&ap.auditeurs.includes('sh'))?' checked':'')+'><span>Selma H.</span></label>';
    h+='<label><input type="checkbox" class="m-auditor" value="ne"'+((ap&&ap.auditeurs&&ap.auditeurs.includes('ne'))?' checked':'')+'><span>Nisrine E.</span></label>';
  } else {
    uniqueAuditors.forEach(function(u){
      var checked = isAuditorChecked(u) ? ' checked' : '';
      h+='<label><input type="checkbox" class="m-auditor" value="'+u.id+'"'+checked+'><span>'+u.name+'</span></label>';
    });
  }
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

// Mettre à jour le compteur de processus sélectionnés (appelé sur change)
function updateProcCount(){
  var cbs = document.querySelectorAll('.m-proc-cb:checked');
  var el = document.getElementById('m-proc-count');
  if (el) {
    if (cbs.length === 0) {
      el.style.color = 'var(--red)';
      el.textContent = '⚠ Sélectionnez au moins 1 processus';
    } else {
      el.style.color = 'var(--purple)';
      el.textContent = cbs.length + ' processus sélectionné' + (cbs.length>1?'s':'');
    }
  }
}

// Fonction de compatibilité (ancien code)
function updateProcessList(){
  // Plus nécessaire : la liste est statique et multi-domaines
  updateProcCount();
}

function collectAuditModal(){
  var type=document.getElementById('m-type').value;
  var titre=document.getElementById('m-titre').value.trim();
  if(!titre){toast('Titre obligatoire');return null;}
  // Collecter les auditeurs cochés
  var auditeurs=[];
  var auditorCbs = document.querySelectorAll('.m-auditor:checked');
  if (auditorCbs.length) {
    auditorCbs.forEach(function(cb){ auditeurs.push(cb.value); });
  } else {
    // Fallback legacy
    if (document.getElementById('a-sh') && document.getElementById('a-sh').checked) auditeurs.push('sh');
    if (document.getElementById('a-ne') && document.getElementById('a-ne').checked) auditeurs.push('ne');
  }
  // Auto-assigner l'admin courant si ce n'est pas déjà fait
  if (CU && CU.role==='admin' && CU.id && auditeurs.indexOf(CU.id)<0) {
    auditeurs.unshift(CU.id);
  }
  var dateDebut=document.getElementById('m-deb')?document.getElementById('m-deb').value:'';
  var dateFin=document.getElementById('m-fin')?document.getElementById('m-fin').value:'';
  var base={type,titre,annee:parseInt(document.getElementById('m-annee').value),statut:document.getElementById('m-statut').value,auditeurs,dateDebut,dateFin};
  if(type==='Process'){
    // Collecter les processus cochés
    var cbs = document.querySelectorAll('.m-proc-cb:checked');
    if (!cbs.length) { toast('Sélectionnez au moins 1 processus'); return null; }
    var processIds = Array.from(cbs).map(function(cb){return cb.value;});
    // Construire le libellé synthétique (liste des noms, joints par virgule)
    var procObjs = processIds.map(function(pid){return PROCESSES.find(function(p){return p.id===pid;});}).filter(Boolean);
    var procNames = procObjs.map(function(p){return p.proc;}).join(', ');
    // Domaine : si cross-domaines, on met "Multi-domaines", sinon le domaine unique
    var uniqueDoms = [...new Set(procObjs.map(function(p){return p.dom;}))];
    var domaine = uniqueDoms.length === 1 ? uniqueDoms[0] : uniqueDoms.join(', ');
    return Object.assign({}, base, {
      domaine: domaine,
      process: procNames,
      processId: processIds[0],        // compat ancien champ (premier process)
      processIds: processIds,          // nouveau tableau complet
    });
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
  attachProcCheckboxListeners();
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
  attachProcCheckboxListeners();
}

// Attache les listeners sur les checkboxes de processus après ouverture de la modal
// et met à jour le compteur initial
function attachProcCheckboxListeners() {
  setTimeout(function(){
    var cbs = document.querySelectorAll('.m-proc-cb');
    cbs.forEach(function(cb){
      cb.addEventListener('change', updateProcCount);
    });
    updateProcCount(); // Affichage initial
  }, 50);
}
async function deleteAudit(idx){
  var ap=AUDIT_PLAN[idx];
  if(!confirm('Supprimer "'+ap.titre+'" ?'))return;
  AUDIT_PLAN.splice(idx,1);
  await spDelete('AF_AuditPlan',ap.id);
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
  var doms=[...new Set(PROCESSES.map(function(p){return p.dom;}))].sort(function(a,b){
    return (a||'').localeCompare(b||'', 'fr', {sensitivity:'base'});
  });
  var procAudits=AUDIT_PLAN.filter(function(a){return a.type==='Process';});

  // Helper : retourner tous les processIds d'un audit (support old et new format)
  var getApProcIds = function(ap){
    if (Array.isArray(ap.processIds) && ap.processIds.length) return ap.processIds;
    if (ap.processId) return [ap.processId];
    return [];
  };

  // Set de tous les processIds couverts par au moins un audit
  var auditedIds = new Set();
  procAudits.forEach(function(a){
    getApProcIds(a).forEach(function(pid){ auditedIds.add(pid); });
  });

  var activeProcesses = PROCESSES.filter(function(p){return!p.archived;});
  var coveragePct = activeProcesses.length
    ? Math.round(auditedIds.size/activeProcesses.length*100) : 0;
  var coveredCount = auditedIds.size;
  var totalCount = activeProcesses.length;

  // Barre de couverture globale en haut
  var coverageBar =
    '<div class="card" style="padding:12px 16px;margin-bottom:1rem;background:linear-gradient(90deg,var(--purple-lt),var(--white));border-left:4px solid var(--purple)">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">'
      + '<div>'
        + '<div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Couverture globale du plan</div>'
        + '<div style="font-size:18px;font-weight:600;color:var(--purple-dk)">'+coveredCount+'/'+totalCount+' processus audités</div>'
      + '</div>'
      + '<div style="flex:1;min-width:200px;max-width:400px">'
        + '<div style="display:flex;align-items:center;gap:10px">'
          + '<div style="flex:1;height:10px;background:var(--border);border-radius:5px;overflow:hidden">'
            + '<div style="width:'+coveragePct+'%;height:100%;background:var(--purple);border-radius:5px;transition:width .3s"></div>'
          + '</div>'
          + '<div style="font-size:20px;font-weight:700;color:var(--purple-dk);min-width:55px;text-align:right">'+coveragePct+'%</div>'
        + '</div>'
      + '</div>'
    + '</div>'
    + '</div>';

  var h='<thead><tr><th>Domaine</th><th>Processus</th><th>Risque</th><th>Couverture</th><th>2025</th><th>2026</th><th>2027</th><th>2028</th></tr></thead><tbody>';
  doms.forEach(function(dom){
    var rows=PROCESSES.filter(function(p){return p.dom===dom&&!p.archived;});
    if(!rows.length)return;
    rows.sort(function(a,b){
      return (a.proc||'').localeCompare(b.proc||'', 'fr', {sensitivity:'base'});
    });
    h+='<tr class="sr"><td colspan="7">'+dom+'</td></tr>';
    rows.forEach(function(p){
      var yc=function(y){
        // Trouver tous les audits de l'année qui couvrent ce processus
        var matches = procAudits.filter(function(a){
          return a.annee===y && getApProcIds(a).indexOf(p.id) >= 0;
        });
        if (!matches.length) return '<span style="color:var(--text-3)">—</span>';
        return matches.map(function(m){
          return '<div style="display:flex;flex-direction:column;gap:2px;margin-bottom:2px">'
            + '<span style="font-size:10px;font-weight:500;color:var(--purple-dk)">'+m.titre+'</span>'
            + '<div style="display:flex;gap:3px">'+((m.auditeurs||[]).map(function(id){return avEl(id,16);}).join(''))+'</div>'
            + '</div>';
        }).join('');
      };
      var covered=auditedIds.has(p.id);
      var covBadge=covered
        ?'<span class="badge bdn" style="font-size:10px;">✓ Audité</span>'
        :'<span class="badge bpl" style="font-size:10px;">Non audité</span>';
      h+='<tr>'
        +'<td style="font-size:11px;color:var(--text-2)">'+dom+'</td>'
        +'<td style="font-weight:500;font-size:11px">'+p.proc+'</td>'
        +'<td>'+riskLabel(p.riskLevel||'faible')+'</td>'
        +'<td>'+covBadge+'</td>'
        +'<td>'+yc(2025)+'</td><td>'+yc(2026)+'</td><td>'+yc(2027)+'</td><td>'+yc(2028)+'</td>'
        +'</tr>';
    });
  });
  // Injecter la barre de couverture avant le tableau
  var container = document.getElementById('pp-tbl2');
  if (container) {
    var wrapper = container.parentNode;
    var old = document.getElementById('pp-coverage-bar');
    if (old) old.remove();
    var div = document.createElement('div');
    div.id = 'pp-coverage-bar';
    div.innerHTML = coverageBar;
    wrapper.parentNode.insertBefore(div.firstChild, wrapper);
  }
  document.getElementById('pp-tbl2').innerHTML=h+'</tbody>';
}

// ── Plan BU consolidé (section Plans Audit) ───────────────────
V['plans-bu']=()=>`
  <div class="topbar">
    <div class="tbtitle">Plan BU 2025–2028</div>
    <button class="bp" onclick="nav('plan-audit')">Gérer le plan audit →</button>
  </div>
  <div class="content">
    <div style="display:flex;gap:16px;align-items:center;margin-bottom:.75rem;font-size:12px;">
      <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:50%;background:#5DCAA5;display:inline-block;"></span>Déjà audité (clôturé)</span>
      <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:50%;background:#378ADD;display:inline-block;"></span>Audit futur planifié</span>
      <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:50%;background:#E2DDD5;display:inline-block;border:1px solid #ccc;"></span>Aucun audit prévu</span>
    </div>
    <div class="card" style="padding:.75rem;margin-bottom:1rem;overflow:hidden;background:#D6EAF5;max-width:700px;margin-left:auto;margin-right:auto">
      <div id="world-map-svg" style="width:100%;"></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:1rem">
      <select id="f-bu-ent" onchange="renderBUTable()"><option value="all">Toutes entités</option></select>
      <select id="f-bu-yr" onchange="renderBUTable()"><option value="all">Toutes années</option><option value="2025">2025</option><option value="2026">2026</option><option value="2027">2027</option><option value="2028">2028</option></select>
    </div>
    <div class="tw"><table id="bu-tbl"></table></div>
  </div>`;
I['plans-bu']=()=>{
  var sel=document.getElementById('f-bu-ent');
  if(sel&&GROUP_STRUCTURE.length){
    sel.innerHTML='<option value="all">Toutes entités</option>'
      +GROUP_STRUCTURE.map(function(e){return'<option>'+e.name+'</option>';}).join('');
  }
  renderBUTable();
  renderWorldMap();
};

function renderWorldMap(){
  var container=document.getElementById('world-map-svg');
  if(!container) return;

  // Collecter pays audités / planifiés
  var buAudits=AUDIT_PLAN.filter(function(a){return a.type==='BU';});
  var auditedSet=new Set();
  var plannedSet=new Set();
  buAudits.forEach(function(a){
    var pays=(a.pays||[]).map(function(p){return p.toLowerCase().trim();});
    var clotured=(a.statut||'').toLowerCase().includes('clôturé')||(a.statut||'').toLowerCase().includes('cloture');
    pays.forEach(function(p){
      if(clotured) auditedSet.add(p);
      else plannedSet.add(p);
    });
  });

  // Table de correspondance nom → ISO A2 pour les pays du plan BU
  var nameToIso={
    'maroc':'MA','morocco':'MA',
    'tunisie':'TN','tunisia':'TN',
    'algérie':'DZ','algeria':'DZ',
    'cameroun':'CM','cameroon':'CM',
    'liban':'LB','lebanon':'LB',
    'uk':'GB','united kingdom':'GB','royaume-uni':'GB',
    'france':'FR',
    'germany':'DE','allemagne':'DE',
    'romania':'RO','roumanie':'RO',
    'bulgaria':'BG','bulgarie':'BG',
    'spain':'ES','espagne':'ES',
    'italy':'IT','italie':'IT',
    'usa':'US','united states':'US','états-unis':'US',
    'india':'IN','inde':'IN',
    'australia':'AU','australie':'AU',
    'singapore':'SG','singapour':'SG',
    'uae':'AE','émirats arabes unis':'AE',
    'saudi arabia':'SA','arabie saoudite':'SA',
    'china':'CN','chine':'CN',
    'japan':'JP','japon':'JP',
    'brazil':'BR','brésil':'BR',
    'nigeria':'NG','nigéria':'NG',
    'south africa':'ZA','afrique du sud':'ZA',
    'kenya':'KE',
    'senegal':'SN','sénégal':'SN',
    'belgium':'BE','belgique':'BE',
    'netherlands':'NL','pays-bas':'NL',
    'poland':'PL','pologne':'PL',
    'turkey':'TR','turquie':'TR',
    'egypt':'EG','égypte':'EG',
    'mexico':'MX','mexique':'MX',
    'argentina':'AR','argentine':'AR',
    'colombia':'CO','colombie':'CO',
    'ivory coast':'CI',"côte d'ivoire":'CI',
  };

  // Construire les sets ISO
  var auditedISO=new Set();
  var plannedISO=new Set();
  auditedSet.forEach(function(n){if(nameToIso[n])auditedISO.add(nameToIso[n]);});
  plannedSet.forEach(function(n){if(nameToIso[n])plannedISO.add(nameToIso[n]);});

  function getCountryColor(iso){
    if(auditedISO.has(iso)) return '#5DCAA5';
    if(plannedISO.has(iso)) return '#378ADD';
    return '#E2DDD5';
  }
  function getCountryStroke(iso){
    if(auditedISO.has(iso)) return '#2D9A75';
    if(plannedISO.has(iso)) return '#1A5FAD';
    return '#C8C2B8';
  }

  // Charger TopoJSON depuis CDN et afficher avec D3
  if(!window._d3Loaded){
    var s1=document.createElement('script');
    s1.src='https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
    s1.onload=function(){
      var s2=document.createElement('script');
      s2.src='https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js';
      s2.onload=function(){
        window._d3Loaded=true;
        _drawD3Map(container,getCountryColor,getCountryStroke);
      };
      document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
  } else {
    _drawD3Map(container,getCountryColor,getCountryStroke);
  }
}

function _drawD3Map(container,getColor,getStroke){
  container.innerHTML='';
  var W=container.offsetWidth||900;
  var H=Math.round(W*0.45);

  var svg=d3.select(container)
    .append('svg')
    .attr('width','100%')
    .attr('height',H)
    .style('display','block');

  var projection=d3.geoNaturalEarth1()
    .scale(W/6.2)
    .translate([W/2, H/2]);

  var path=d3.geoPath().projection(projection);

  // Charger world-atlas
  if(window._worldTopo){
    _renderMap(svg,path,getColor,getStroke,window._worldTopo);
  } else {
    d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(function(world){
      window._worldTopo=world;
      _renderMap(svg,path,getColor,getStroke,world);
    }).catch(function(e){
      container.innerHTML='<div style="padding:1rem;color:var(--text-2);font-size:12px;">Carte non disponible (connexion requise)</div>';
    });
  }
}

// Table ISO numérique → ISO A2
var _isoNumToA2={
  4:'AF',8:'AL',12:'DZ',24:'AO',32:'AR',36:'AU',40:'AT',50:'BD',56:'BE',64:'BT',
  68:'BO',76:'BR',100:'BG',116:'KH',120:'CM',124:'CA',152:'CL',156:'CN',170:'CO',
  180:'CD',188:'CR',191:'HR',192:'CU',196:'CY',208:'DK',214:'DO',218:'EC',818:'EG',
  222:'SV',231:'ET',246:'FI',250:'FR',266:'GA',276:'DE',288:'GH',320:'GT',324:'GN',
  332:'HT',340:'HN',348:'HU',356:'IN',360:'ID',364:'IR',368:'IQ',372:'IE',376:'IL',
  380:'IT',388:'JM',392:'JP',400:'JO',398:'KZ',404:'KE',410:'KR',408:'KP',
  414:'KW',418:'LA',422:'LB',430:'LR',434:'LY',484:'MX',504:'MA',508:'MZ',
  516:'NA',524:'NP',528:'NL',540:'NC',558:'NI',566:'NG',578:'NO',586:'PK',
  591:'PA',598:'PG',604:'PE',608:'PH',616:'PL',620:'PT',630:'PR',634:'QA',
  642:'RO',643:'RU',682:'SA',686:'SN',694:'SL',706:'SO',710:'ZA',724:'ES',
  144:'LK',729:'SD',752:'SE',756:'CH',760:'SY',764:'TH',768:'TG',780:'TT',
  788:'TN',792:'TR',800:'UG',804:'UA',784:'AE',826:'GB',840:'US',858:'UY',
  862:'VE',704:'VN',887:'YE',716:'ZW',900:'PS'
};

function _renderMap(svg,path,getColor,getStroke,world){
  var countries=topojson.feature(world,world.objects.countries);
  var borders=topojson.mesh(world,world.objects.countries,function(a,b){return a!==b;});

  // Fond pays
  svg.selectAll('path.country')
    .data(countries.features)
    .enter()
    .append('path')
    .attr('class','country')
    .attr('d',path)
    .attr('fill',function(d){
      var iso=_isoNumToA2[parseInt(d.id)]||'';
      return getColor(iso);
    })
    .attr('stroke',function(d){
      var iso=_isoNumToA2[parseInt(d.id)]||'';
      return getStroke(iso);
    })
    .attr('stroke-width',0.4)
    .append('title')
    .text(function(d){
      var iso=_isoNumToA2[parseInt(d.id)]||'';
      return iso;
    });

  // Frontières
  svg.append('path')
    .datum(borders)
    .attr('fill','none')
    .attr('stroke','#b8b2a8')
    .attr('stroke-width',0.3)
    .attr('d',path);
}

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
  await spDelete('AF_Actions',id);
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

async function openAudit(id){CA=id;var found=getAudits().find(function(a){return a.id===id;});var step=found?found.step||0:0;CS=Math.max(0,Math.min(9,step));CT='roles';await loadAuditData(id);nav('audit-detail');}

// (Le reste des fonctions audit-detail, contrôles, findings, maturity, mgt-resp, docs, notes
//  sont strictement identiques à l'original — on les conserve tels quels)

V['audit-detail']=()=>{
  const a=getAudits().find(x=>x.id===CA);
  if(!a) return '<div class="content">Audit introuvable.</div>';
  // Sécurité : CS doit toujours être entre 0 et 9
  if(typeof CS!=='number' || CS<0 || CS>9) CS=0;
  const step=STEPS[CS]||{s:'—'};
  const pct = Math.min(100, (CS + 1) * 10);
  return `
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="bs" onclick="nav('dashboard')">← Retour</button>
        <div class="tbtitle">${a.name}</div>
      </div>
      <div style="display:flex;gap:7px" id="step-actions">
        <button class="bs" onclick="exportAuditPDF(CA)" style="font-size:11px;">⬇ Export PDF</button>
        ${getStepActionButtonHTML()}
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
        <span style="font-size:11px;color:var(--text-2);white-space:nowrap" id="gp-lbl">Étape ${CS+1}/11 — ${step.s}</span>
        <div class="pbar" style="flex:1"><div class="pfill" id="gp-fill" style="width:${pct}%"></div></div>
        <span style="font-size:11px;color:var(--text-2)" id="gp-pct">${pct}%</span>
      </div>
      <div class="card" style="margin-bottom:1rem" id="stepper-card">${renderStepper()}</div>
      <div class="tabs" id="det-tabs">${renderDetTabs()}</div>
      <div id="det-content">${renderDetContent()}</div>
    </div>`;
};
I['audit-detail']=()=>{};

function getStepTabs(){if(CS===4)return['roles','tasks','controls','risk-matrix','docs','notes'];if(CS===5)return['roles','tasks','controls-exec','findings-exec','docs','notes'];if(CS===6)return['roles','tasks','findings','maturity','docs','notes'];if(CS===8)return['roles','tasks','mgt-resp','docs','notes'];return['roles','tasks','docs','notes'];}
const TLBL={'roles':'Rôles','tasks':'Tâches','controls':'Contrôles','controls-exec':'Contrôles & Tests','risk-matrix':'Matrice Risques','findings-exec':'Findings (tests)','findings':'Findings','maturity':'Overall Maturity','mgt-resp':'Mgt Response','docs':'Documents','notes':'Notes'};
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
  if(CT==='roles'){
    // Bloc workflow de revue pour les étapes clés
    var workflowBlock = '';
    if (isKeyStep(CS)) {
      var state = getStepState(CA, CS);
      var stateBadge = '';
      var stateDesc = '';
      if (state.status === 'preparation') {
        stateBadge = '<span class="badge bpl">🔘 En préparation</span>';
        stateDesc = 'Les auditeurs travaillent sur cette étape.';
      } else if (state.status === 'finalized') {
        stateBadge = '<span class="badge btg">🟡 Finalisée — en attente revue</span>';
        stateDesc = 'Finalisée par '+(state.finalizedBy||'—')
          + (state.finalizedAt?' le '+new Date(state.finalizedAt).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):'');
      } else if (state.status === 'reviewed') {
        stateBadge = '<span class="badge bdn">✅ Revue & validée</span>';
        stateDesc = 'Revue par '+(state.reviewedBy||'—')
          + (state.reviewedAt?' le '+new Date(state.reviewedAt).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):'');
      }

      // Préparateurs = auditeurs de l'audit
      var ap = AUDIT_PLAN.find(function(x){return x.id===CA;});
      var preparers = (ap && ap.auditeurs) ? ap.auditeurs : [];
      var preparersHtml = preparers.length
        ? preparers.map(function(id){
            var m = TM[id];
            if (!m) return '';
            return '<div style="display:flex;align-items:center;gap:7px;padding:4px 0">'+avEl(id,22)+'<span style="font-size:12px">'+m.name+'</span></div>';
          }).join('')
        : '<div style="font-size:11px;color:var(--text-3)">Aucun auditeur assigné</div>';

      // Reviewer = admin(s)
      var admins = (USERS||[]).filter(function(u){return u.role==='admin' && u.status==='actif';});
      var reviewersHtml = admins.length
        ? admins.map(function(u){
            var m = TM[u.id];
            return '<div style="display:flex;align-items:center;gap:7px;padding:4px 0">'
              + (m ? avEl(u.id,22) : '')
              + '<span style="font-size:12px">'+u.name+'</span></div>';
          }).join('')
        : '<div style="font-size:11px;color:var(--text-3)">Aucun admin</div>';

      workflowBlock =
        '<div class="card" style="background:var(--purple-lt);border:.5px solid var(--purple);margin-bottom:.875rem;padding:12px 14px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
          + '<div style="font-size:12px;font-weight:600;color:var(--purple-dk)">⚡ Workflow de revue — étape clé</div>'
          + stateBadge
        + '</div>'
        + '<div style="font-size:11px;color:var(--text-2);margin-bottom:10px">'+stateDesc+'</div>'
        + '<div class="g2">'
          + '<div>'
            + '<div style="font-size:10px;color:var(--text-3);font-weight:500;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">Préparateurs</div>'
            + preparersHtml
          + '</div>'
          + '<div>'
            + '<div style="font-size:10px;color:var(--text-3);font-weight:500;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">Reviewer</div>'
            + reviewersHtml
          + '</div>'
        + '</div>'
        + '</div>';
    }

    return workflowBlock + `<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem"><div style="font-size:13px;font-weight:600">Étape ${CS+1} — ${s.s}</div>${badge(a.status)}</div><div class="g2" style="margin-bottom:.875rem">${(a.assignedTo||[]).map(id=>{const m=TM[id];if(!m)return'';const my=stepTasks.filter(t=>t.assignee===id);return`<div class="card" style="background:var(--bg)"><div style="font-size:10px;color:var(--text-3);margin-bottom:5px">Auditrice</div><div style="display:flex;align-items:center;gap:7px">${avEl(id,26)}<div><div style="font-size:12px;font-weight:500">${m.name}</div><div style="font-size:10px;color:${my.filter(t=>t.done).length===my.length&&my.length>0?'var(--green)':'var(--amber)'}">${my.length?my.filter(t=>t.done).length+'/'+my.length+' tâches':'Aucune tâche'}</div></div></div></div>`;}).join('')}<div class="card" style="background:var(--bg)"><div style="font-size:10px;color:var(--text-3);margin-bottom:5px">Valideur</div><div style="display:flex;align-items:center;gap:7px">${avEl('pm',26)}<div><div style="font-size:12px;font-weight:500">Philippe M.</div><div style="font-size:10px;color:var(--amber)">Validation requise</div></div></div></div></div>${CU?.role!=='admin'?'<div class="notice">La validation est réservée au Directeur Audit.</div>':''}</div>`;
  }
  if(CT==='tasks'){const done=stepTasks.filter(t=>t.done).length;return`<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem"><div style="font-size:13px;font-weight:600">Tâches — ${s.s}</div><div style="display:flex;gap:8px;align-items:center"><span style="font-size:11px;color:var(--text-2)">${done}/${stepTasks.length}</span><button class="bs" style="font-size:11px" onclick="showNewTaskModal()">+ Ajouter</button></div></div><div id="task-list">${renderTaskList(stepTasks,a)}</div></div>`;}
  if(CT==='controls'){const ctrls=d.controls[CS]||[];return`<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem"><div style="font-size:13px;font-weight:600">Contrôles identifiés</div><button class="bs" style="font-size:11px" onclick="showAddControlModal()">+ Ajouter</button></div>${buildControlList(ctrls)}</div>`;}
  if(CT==='controls-exec'){const step5c=d.controls[4]||[];const keyExist=step5c.filter(c=>c.clef&&c.design==='existing');const targets=step5c.filter(c=>c.design==='target');return`<div class="card"><div style="font-size:13px;font-weight:600;margin-bottom:.875rem">Tests — Contrôles clefs existants</div>${keyExist.length?buildExecTable(keyExist):'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun contrôle clef existant.</div>'}<div style="font-size:13px;font-weight:600;margin:.875rem 0 .5rem">Contrôles Target — anomalies automatiques</div>${buildTargetList(targets)}</div>`;}
  if(CT==='risk-matrix'){return renderRiskMatrix();}
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
// ── Workflow d'étape : finalisation + revue ────────────────────
// Structure : d.stepStates[stepIdx] = { status, finalizedBy, finalizedAt, reviewedBy, reviewedAt }
// status: 'preparation' (défaut) | 'finalized' | 'reviewed'

function getStepState(auditId, stepIdx) {
  var d = getAudData(auditId);
  if (!d.stepStates) d.stepStates = {};
  if (!d.stepStates[stepIdx]) d.stepStates[stepIdx] = { status: 'preparation' };
  return d.stepStates[stepIdx];
}

function isKeyStep(stepIdx) {
  return (typeof KEY_STEPS!=='undefined' ? KEY_STEPS : [2,4,5,6,8]).indexOf(stepIdx) >= 0;
}

// Génère le bouton d'action affiché en haut à droite selon le statut de l'étape
function getStepActionButtonHTML() {
  if (CS < 0 || CS > 9) return '';
  var isAdmin = CU && CU.role==='admin';
  var isKey = isKeyStep(CS);

  // Étape non-clé : bouton classique "Valider l'étape"
  if (!isKey) {
    return '<button class="bp" onclick="validerEtape()">Valider l\'étape →</button>';
  }

  // Étape clé : dépend du statut
  var state = getStepState(CA, CS);
  if (state.status === 'preparation') {
    return '<button class="bp" onclick="finalizeStep()">Finaliser l\'étape (prête pour revue) →</button>';
  }
  if (state.status === 'finalized') {
    if (isAdmin) {
      return '<button class="bp" onclick="reviewStep()">Valider la revue →</button>'
        + ' <button class="bs" style="font-size:11px" onclick="unfinalizeStep()">Renvoyer en préparation</button>';
    }
    return '<span style="font-size:11px;color:var(--amber);padding:6px 10px;background:var(--amber-lt);border-radius:6px">⏳ En attente de revue par l\'admin</span>';
  }
  if (state.status === 'reviewed') {
    return '<button class="bp" onclick="validerEtape()">Étape suivante →</button>';
  }
  return '';
}

// Rafraîchit le bouton d'action (à appeler après toute modification)
function refreshStepActionButton() {
  var el = document.getElementById('step-actions');
  if (el) {
    el.innerHTML = '<button class="bs" onclick="exportAuditPDF(CA)" style="font-size:11px;">⬇ Export PDF</button> '
      + getStepActionButtonHTML();
  }
}

// Finaliser une étape (l'auditeur déclare l'étape prête pour revue)
async function finalizeStep() {
  var ap = AUDIT_PLAN.find(function(a){return a.id===CA;});
  var d = getAudData(CA);
  var missing = getMissingDocs(CS, d.docs);
  if (missing.length) {
    var msg = 'Document(s) requis :\n';
    missing.forEach(function(m){msg += '  • '+m+'\n';});
    alert(msg);
    return;
  }
  var state = getStepState(CA, CS);
  state.status = 'finalized';
  state.finalizedBy = CU ? CU.name : '—';
  state.finalizedAt = new Date().toISOString();
  delete state.reviewedBy;
  delete state.reviewedAt;
  await saveAuditData(CA);
  addHist('edit', 'Étape '+(CS+1)+' finalisée — '+(ap?ap.titre:''));
  refreshStepActionButton();
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Étape finalisée, en attente de revue ✓');
}

// Valider la revue d'une étape (admin seulement)
async function reviewStep() {
  if (!CU || CU.role!=='admin') { toast('Seul l\'admin peut valider la revue'); return; }
  var ap = AUDIT_PLAN.find(function(a){return a.id===CA;});
  var state = getStepState(CA, CS);
  state.status = 'reviewed';
  state.reviewedBy = CU.name;
  state.reviewedAt = new Date().toISOString();
  await saveAuditData(CA);

  // Passer à l'étape suivante automatiquement
  if (CS < 9) {
    CS++;
    if (ap) { ap.statut = 'En cours'; ap.step = CS; await saveAuditPlan(ap); }
    addHist('edit', 'Étape '+CS+' revue & validée — '+(ap?ap.titre:''));
    goStep(CS);
    toast('Revue validée — passage à l\'étape suivante ✓');
  } else {
    if (ap) { ap.statut = 'Clôturé'; ap.step = 9; await saveAuditPlan(ap); }
    refreshStepActionButton();
    document.getElementById('det-content').innerHTML = renderDetContent();
    toast('Mission clôturée ✓');
  }
}

// Renvoyer l'étape en préparation (admin peut déverrouiller)
async function unfinalizeStep() {
  if (!CU || CU.role!=='admin') { toast('Seul l\'admin peut renvoyer en préparation'); return; }
  var state = getStepState(CA, CS);
  state.status = 'preparation';
  delete state.finalizedBy;
  delete state.finalizedAt;
  await saveAuditData(CA);
  addHist('edit', 'Étape '+(CS+1)+' renvoyée en préparation');
  refreshStepActionButton();
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Étape renvoyée en préparation ✓');
}

// Appelé automatiquement quand on modifie le contenu d'une étape finalisée
// → repasse l'étape en "preparation"
async function autoUnfinalizeIfNeeded() {
  if (!isKeyStep(CS)) return;
  var state = getStepState(CA, CS);
  if (state.status === 'finalized') {
    state.status = 'preparation';
    delete state.finalizedBy;
    delete state.finalizedAt;
    await saveAuditData(CA);
    refreshStepActionButton();
    toast('Étape repassée en préparation (modifiée)');
  }
}

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
async function addFakeDoc(){
  // Étape 1 : sélection du fichier
  var inp=document.createElement('input');
  inp.type='file';
  inp.accept='.pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.csv,.txt';
  inp.multiple=true;
  inp.onchange=async function(){
    if(!inp.files.length) return;
    var files = Array.from(inp.files);
    // Étape 2 : demander preparer/reviewer dans une modal
    showPrepReviewerModal(files);
  };
  inp.click();
}

function showPrepReviewerModal(files) {
  // Liste des auditeurs de l'audit (pour preparer)
  var ap = AUDIT_PLAN.find(function(a){ return a.id===CA; });
  var auditors = (ap && ap.auditeurs) ? ap.auditeurs : [];
  // Liste de tous les users pour reviewer (on privilégie admin)
  var adminUsers = (USERS||[]).filter(function(u){return u.role==='admin' && u.status==='actif';});
  var allUsers = (USERS||[]).filter(function(u){return u.status==='actif';});

  // Default values
  var defaultPreparer = '';
  // Si l'utilisateur courant est dans les auditeurs, on le met par défaut
  if (CU) {
    var myId = Object.keys(TM).find(function(k){
      return TM[k].name && CU.name && TM[k].name.indexOf(CU.name.split(' ')[0])>=0;
    });
    if (myId && auditors.indexOf(myId)>=0) defaultPreparer = myId;
    else if (auditors.length) defaultPreparer = auditors[0];
  }
  var defaultReviewer = adminUsers.length ? adminUsers[0].id : '';

  var fileNames = files.map(function(f){return '<li style="font-size:11px;color:var(--text-2)">'+f.name+'</li>';}).join('');
  var prepOpts = auditors.map(function(id){
    var m = TM[id];
    return '<option value="'+id+'"'+(id===defaultPreparer?' selected':'')+'>'+((m&&m.name)||id)+'</option>';
  }).join('');
  var revOpts = allUsers.map(function(u){
    return '<option value="'+u.id+'"'+(u.id===defaultReviewer?' selected':'')+'>'+u.name+(u.role==='admin'?' (admin)':'')+'</option>';
  }).join('');

  var bodyHtml =
    '<div style="font-size:12px;color:var(--text-2);margin-bottom:10px">Documents à uploader :</div>'
    + '<ul style="margin:0 0 14px 0;padding-left:20px">'+fileNames+'</ul>'
    + '<div style="margin-bottom:10px"><label class="f-lbl">Préparateur <span style="color:var(--red)">*</span></label>'
    + (auditors.length
        ? '<select id="doc-preparer" class="f-inp" style="width:100%">'+prepOpts+'</select>'
        : '<div style="font-size:11px;color:var(--amber);padding:6px 0">Aucun auditeur assigné à cet audit. Assignez-en un d\'abord.</div>')
    + '</div>'
    + '<div><label class="f-lbl">Reviewer <span style="color:var(--red)">*</span></label>'
    + '<select id="doc-reviewer" class="f-inp" style="width:100%">'+revOpts+'</select>'
    + '</div>';

  openModal('Préparateur / Reviewer', bodyHtml, async function() {
    var prepEl = document.getElementById('doc-preparer');
    var revEl = document.getElementById('doc-reviewer');
    var preparer = prepEl ? prepEl.value : '';
    var reviewer = revEl ? revEl.value : '';
    if (!preparer) { toast('Sélectionnez un préparateur'); return; }
    if (!reviewer) { toast('Sélectionnez un reviewer'); return; }

    // Upload de tous les fichiers
    for (var fi=0; fi<files.length; fi++) {
      var file = files[fi];
      toast('Upload : '+file.name+'...');
      try {
        var docObj = await uploadDoc(CA, file, CS, CU?CU.name:'Inconnu');
        // Ajouter preparer/reviewer au doc qui vient d'être créé
        if (docObj) {
          var d = getAudData(CA);
          var last = d.docs[d.docs.length-1];
          if (last && last.name===file.name) {
            last.preparer = preparer;
            last.reviewer = reviewer;
            last.reviewStatus = 'pending';
            await saveAuditData(CA);
          }
        }
        toast(file.name+' uploadé ✓');
      } catch(e) {
        toast('Erreur : '+e.message);
      }
    }
    document.getElementById('det-content').innerHTML = renderDetContent();
  });
}

// Marquer un document comme revu (admin seulement)
async function markDocReviewed(docIndex) {
  if (!CU || CU.role!=='admin') { toast('Seul l\'admin peut valider'); return; }
  var d = getAudData(CA);
  var doc = d.docs[docIndex];
  if (!doc) return;
  doc.reviewStatus = 'reviewed';
  doc.reviewedBy = CU.name;
  doc.reviewedAt = new Date().toISOString();
  await saveAuditData(CA);
  addHist('edit', 'Document revu : '+doc.name);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Document marqué comme revu ✓');
}

async function unmarkDocReviewed(docIndex) {
  if (!CU || CU.role!=='admin') { toast('Seul l\'admin peut modifier'); return; }
  var d = getAudData(CA);
  var doc = d.docs[docIndex];
  if (!doc) return;
  doc.reviewStatus = 'pending';
  delete doc.reviewedBy;
  delete doc.reviewedAt;
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Revue annulée');
}
async function renameDoc(docIndex){var d=getAudData(CA);var doc=d.docs[docIndex];if(!doc)return;var newName=prompt('Nouveau nom :', doc.name);if(!newName||newName.trim()===''||newName===doc.name)return;try{await renameDocInDB(CA,docIndex,newName.trim());document.getElementById('det-content').innerHTML=renderDetContent();toast('Renommé ✓');}catch(e){toast('Erreur : '+e.message);}}
async function replaceDoc(docIndex){var inp=document.createElement('input');inp.type='file';inp.accept='.pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.csv,.txt';inp.onchange=async function(){if(!inp.files.length)return;var file=inp.files[0];toast('Remplacement...');try{await replaceDocInDB(CA,docIndex,file,CS,CU?CU.name:'Inconnu');document.getElementById('det-content').innerHTML=renderDetContent();toast(file.name+' remplacé ✓');}catch(e){toast('Erreur : '+e.message);}};inp.click();}
async function saveNotes(){var d=getAudData(CA);d.notes=document.querySelector('textarea')?document.querySelector('textarea').value:'';await saveAuditData(CA);toast('Notes sauvegardées ✓');}
async function finalizeTest(i){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(x=>x.clef&&x.design==='existing');const ctrl=kc[i];if(!ctrl)return;if(!ctrl.testNature){toast('Veuillez sélectionner la nature du test');return;}if(!ctrl.result){toast('Veuillez indiquer le résultat');return;}if(ctrl.result==='fail'&&!ctrl.finding){toast('Documentez le finding avant de finaliser');return;}ctrl.finalized=true;addHist('edit',`Test finalisé — "${ctrl.name}" : ${ctrl.result}`);await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();toast(`Test "${ctrl.name}" finalisé ✓`);}
function setMaturity(key){const d=getAudData(CA);if(!d.maturity)d.maturity={level:'',notes:'',saved:false};d.maturity.level=key;d.maturity.saved=false;document.getElementById('det-content').innerHTML=renderDetContent();}
async function saveMaturity(){const d=getAudData(CA);if(!d.maturity?.level){toast('Veuillez sélectionner un niveau');return;}d.maturity.notes=document.getElementById('maturity-notes')?.value||'';d.maturity.saved=true;addHist('edit',`Maturité définie : ${d.maturity.level}`);await saveAuditData(CA);toast('Évaluation sauvegardée ✓');document.getElementById('det-content').innerHTML=renderDetContent();}

function buildControlList(ctrls){if(!ctrls||!ctrls.length)return'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun contrôle identifié.</div>';var h='<div class="ch"><span>Contrôle</span><span>Owner</span><span>Fréquence</span><span>Clef ?</span><span>Design</span><span></span></div>';ctrls.forEach(function(ctrl,ci){h+='<div class="cr"><span style="font-weight:500">'+ctrl.name+'</span><span style="color:var(--text-2)">'+ctrl.owner+'</span><span style="color:var(--text-2)">'+ctrl.freq+'</span><span><span class="badge '+(ctrl.clef?'bps':'bpl')+'">'+(ctrl.clef?'Oui':'Non')+'</span></span><span><span class="badge '+(ctrl.design==='existing'?'bdn':'btg')+'">'+(ctrl.design==='existing'?'Existing':'Target')+'</span></span><button class="bd" style="font-size:10px;padding:2px 6px" onclick="removeControl('+ci+')">X</button></div>';});return h;}
function buildTargetList(targets){if(!targets||!targets.length)return'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun contrôle target.</div>';return targets.map(function(ctrl){return'<div class="fr"><div class="fh"><span class="badge btg">Target</span><div class="ft">'+ctrl.name+'</div></div><div style="font-size:11px;color:var(--red)">Contrôle non existant — à définir par '+ctrl.owner+'.</div></div>';}).join('');}
function buildExecTable(kc){let h='<div class="tw"><table><thead><tr><th>Contrôle</th><th>Nature du test</th><th>Résultat</th><th>Finding</th><th>Action</th></tr></thead><tbody>';kc.forEach(function(ctrl,i){const dis=ctrl.finalized?'disabled':'';h+='<tr><td style="font-size:11px;font-weight:500">'+ctrl.name+'</td><td><select onchange="setTestNature('+i+',this.value)" '+dis+' style="font-size:11px"><option value="">-- Nature --</option><option value="Instruction" '+(ctrl.testNature==='Instruction'?'selected':'')+'>Instruction</option><option value="Observation" '+(ctrl.testNature==='Observation'?'selected':'')+'>Observation</option><option value="Re-performance" '+(ctrl.testNature==='Re-performance'?'selected':'')+'>Re-performance</option></select></td><td><select onchange="setTestResult('+i+',this.value)" '+dis+' style="font-size:11px"><option value="">-- Résultat --</option><option value="pass" '+(ctrl.result==='pass'?'selected':'')+'>Pass</option><option value="fail" '+(ctrl.result==='fail'?'selected':'')+'>Fail</option></select></td><td>'+(ctrl.result==='fail'?'<textarea onchange="setFinding('+i+',this.value)" placeholder="Documentez..." '+dis+' style="width:100%;font-size:10px;min-height:40px">'+(ctrl.finding||'')+'</textarea>':'<span style="color:var(--text-3)">-</span>')+'</td><td>'+(ctrl.finalized?'<span class="badge bdn">Finalisé</span>':'<button class="bp" style="font-size:10px;padding:4px 8px" onclick="finalizeTest('+i+')">Finaliser</button>')+'</td></tr>';});return h+'</tbody></table></div>';}
function buildDocList(docs){
  if(!docs||!docs.length) return '';
  var isAdmin = CU && CU.role==='admin';
  return docs.map(function(f,fi){
    var link = f.url
      ? '<a href="'+f.url+'" target="_blank" rel="noopener" style="color:#534AB7;text-decoration:none;font-weight:500">'+f.name+'</a>'
      : '<span style="font-weight:500">'+f.name+'</span>';

    // Statut de revue
    var reviewStatus = f.reviewStatus || 'pending'; // 'pending' ou 'reviewed'
    var statusBadge = reviewStatus==='reviewed'
      ? '<span class="badge bdn" style="font-size:10px">✓ Revu</span>'
      : '<span class="badge bpl" style="font-size:10px">À revoir</span>';

    // Preparer / Reviewer
    var preparerName = f.preparer ? (TM[f.preparer] ? TM[f.preparer].name : f.preparer) : (f.uploadedBy || '—');
    var reviewerName = f.reviewer ? (TM[f.reviewer] ? TM[f.reviewer].name : f.reviewer) : '—';

    // Meta line 1 : preparer / reviewer
    var reviewMeta = '<div style="font-size:10px;color:#666;padding-left:18px;margin-top:3px">'
      + '<strong>Préparé par :</strong> '+preparerName
      + ' · <strong>Reviewer :</strong> '+reviewerName;
    if (reviewStatus==='reviewed' && f.reviewedBy) {
      reviewMeta += ' · <span style="color:var(--green)">Revu par '+f.reviewedBy+(f.reviewedAt?' le '+new Date(f.reviewedAt).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'')+'</span>';
    }
    reviewMeta += '</div>';

    // Meta line 2 : upload info + étape
    var meta=[];
    if(f.uploadedBy) meta.push('Uploadé par '+f.uploadedBy);
    if(f.uploadedAt) meta.push(new Date(f.uploadedAt).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}));
    if(f.step!==undefined&&f.step!==null&&STEPS[f.step]) meta.push('Etape '+(f.step+1)+' — '+STEPS[f.step].s);
    var metaHtml = meta.length ? '<div style="font-size:10px;color:#888;padding-left:18px;margin-top:2px">'+meta.join(' · ')+'</div>' : '';

    var delFn = "deleteDoc(CA,'"+(f.itemId||f.path||'').replace(/'/g,"\\'")+"','"+(f.name||'').replace(/'/g,"\\'")+'\')';

    // Boutons action : bouton "Marquer revu" seulement pour admin si pas déjà revu
    var reviewBtn = '';
    if (isAdmin && reviewStatus!=='reviewed') {
      reviewBtn = '<button class="bp" style="font-size:10px;padding:2px 7px" onclick="markDocReviewed('+fi+')">Marquer comme revu</button>';
    } else if (isAdmin && reviewStatus==='reviewed') {
      reviewBtn = '<button class="bs" style="font-size:10px;padding:2px 7px" onclick="unmarkDocReviewed('+fi+')">Annuler revue</button>';
    }

    return '<div style="background:#f8f8f8;border-radius:6px;padding:8px 10px;margin-bottom:6px;border:.5px solid #e0e0e0">'
      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
        + '<span style="color:#534AB7">&#9646;</span>'
        + '<span style="flex:1;font-size:12px;min-width:200px">'+link+'</span>'
        + statusBadge
        + '<span style="font-size:10px;color:#aaa;flex-shrink:0">'+(f.size||'')+'</span>'
        + reviewBtn
        + '<button class="bs" style="font-size:10px;padding:2px 7px" onclick="renameDoc('+fi+')">Renommer</button>'
        + '<button class="bs" style="font-size:10px;padding:2px 7px" onclick="replaceDoc('+fi+')">Remplacer</button>'
        + '<button class="bd" style="font-size:10px;padding:2px 7px" onclick="'+delFn+'">Supprimer</button>'
      + '</div>'
      + reviewMeta
      + metaHtml
      + '</div>';
  }).join('');
}
function buildAssigneeOpts(assigned,current){return(assigned||[]).map(function(id){return'<option value="'+id+'"'+(current===id?' selected':'')+'>'+((TM[id]&&TM[id].name)||id)+'</option>';}).join('');}
function buildTplCards(names,badgeCls){return names.map(function(n){return'<div class="card" style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between"><div style="font-size:12px;font-weight:500">'+n+'</div><span class="badge '+badgeCls+'">'+(badgeCls==='bpc'?'Process':'BU')+'</span></div><div style="font-size:11px;color:var(--text-2)">3 phases · 11 étapes</div><button class="bs" style="width:100%">Utiliser</button></div>';}).join('');}


// ══════════════════════════════════════════════════════════════
//  PROFIL UTILISATEUR
// ══════════════════════════════════════════════════════════════
V['profil']=()=>`
  <div class="topbar"><div class="tbtitle">Mon profil</div></div>
  <div class="content" style="max-width:520px;">
    <div class="card" style="padding:1.5rem;margin-bottom:1rem;">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:.5px solid var(--border);">
        <div class="uav" style="width:48px;height:48px;font-size:16px;border-radius:50%;background:var(--purple-lt);color:var(--purple-dk);display:flex;align-items:center;justify-content:center;font-weight:600;">${CU?CU.initials||'?':'?'}</div>
        <div>
          <div style="font-size:15px;font-weight:600;">${CU?CU.name:'—'}</div>
          <div style="font-size:12px;color:var(--text-2);">${CU?CU.email:'—'}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px;">${CU&&CU.role==='admin'?'Admin / Directeur':'Auditeur'}</div>
        </div>
      </div>
      <div style="font-size:13px;font-weight:600;margin-bottom:.875rem;">Changer le mot de passe</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label class="f-lbl">Mot de passe actuel</label>
          <input type="password" id="pw-current" class="f-inp" style="width:100%;" placeholder="••••••••"/>
        </div>
        <div>
          <label class="f-lbl">Nouveau mot de passe</label>
          <input type="password" id="pw-new" class="f-inp" style="width:100%;" placeholder="8 car. min., 1 majuscule, 1 spécial"/>
        </div>
        <div>
          <label class="f-lbl">Confirmer le nouveau mot de passe</label>
          <input type="password" id="pw-confirm" class="f-inp" style="width:100%;" placeholder="••••••••"/>
        </div>
        <div id="pw-error" style="display:none;font-size:12px;color:var(--red);background:var(--red-lt);padding:6px 10px;border-radius:6px;"></div>
        <button class="bp" style="width:100%;margin-top:4px;" onclick="changePassword()">Enregistrer le nouveau mot de passe</button>
      </div>
    </div>
  </div>`;
I['profil']=()=>{};

async function changePassword(){
  var current =document.getElementById('pw-current').value;
  var newPwd   =document.getElementById('pw-new').value;
  var confirm2 =document.getElementById('pw-confirm').value;
  var errEl    =document.getElementById('pw-error');
  errEl.style.display='none';

  var user=USERS.find(function(u){return u.id===CU.id;});
  if(!user||user.pwd!==current){
    errEl.textContent='Mot de passe actuel incorrect.';
    errEl.style.display='block';
    return;
  }
  if(newPwd.length<8||!/[A-Z]/.test(newPwd)||!/[^a-zA-Z0-9]/.test(newPwd)){
    errEl.textContent='Le nouveau mot de passe doit contenir 8 caractères min., 1 majuscule et 1 caractère spécial.';
    errEl.style.display='block';
    return;
  }
  if(newPwd!==confirm2){
    errEl.textContent='Les mots de passe ne correspondent pas.';
    errEl.style.display='block';
    return;
  }
  // Mettre à jour en mémoire
  user.pwd=newPwd;
  CU.pwd=newPwd;
  sessionStorage.setItem('af_user',JSON.stringify(CU));
  // Mettre à jour en base
  try {
    var userObj=USERS.find(function(u){return u.id===CU.id;});
    if(userObj) await saveUser(userObj);
  } catch(e){ console.warn('pwd update:',e); }
  toast('Mot de passe mis à jour ✓');
  document.getElementById('pw-current').value='';
  document.getElementById('pw-new').value='';
  document.getElementById('pw-confirm').value='';
}

// ══════════════════════════════════════════════════════════════
//  EXPORT PDF
// ══════════════════════════════════════════════════════════════
function exportDashboardPDF(){
  var CY=window._dbYear||new Date().getFullYear();
  // Tous les audits de l'année (sans filtre statut pour avoir les 3 sections)
  var allYear=AUDIT_PLAN.filter(function(a){
    return a.annee===CY
      &&(window._dbAuditeur==='all'||(a.auditeurs||[]).includes(window._dbAuditeur));
  });

  // Tri chronologique : dateDebut si dispo, sinon annee+statut
  function sortChron(arr){
    return arr.slice().sort(function(a,b){
      var da=a.dateDebut?new Date(a.dateDebut):new Date(a.annee,0,1);
      var db=b.dateDebut?new Date(b.dateDebut):new Date(b.annee,0,1);
      return da-db;
    });
  }

  var closed  = sortChron(allYear.filter(function(a){return(a.statut||'').startsWith('Clôturé');}));
  var ongoing = sortChron(allYear.filter(function(a){return(a.statut||'').startsWith('En cours');}));
  var planned = sortChron(allYear.filter(function(a){return(a.statut||'').startsWith('Planifié');}));

  function auds(ap){
    return (ap.auditeurs||[]).map(function(id){return TM[id]?TM[id].name:id;}).join(', ')||'—';
  }
  function detail(ap){
    return ap.type==='Process'?(ap.domaine+' › '+ap.process):((ap.pays||[]).join(', '));
  }

  var CSS='body{font-family:system-ui,sans-serif;padding:2rem;color:#111827;max-width:900px;margin:0 auto}'
    +'h1{font-size:20px;font-weight:700;margin-bottom:2px;letter-spacing:-.02em}'
    +'h2{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;'
    +'color:#5B4CF5;border-bottom:2px solid #5B4CF5;padding-bottom:4px;margin:1.5rem 0 .75rem}'
    +'.sub{font-size:12px;color:#6B7280;margin-bottom:1.25rem}'
    +'.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:1.75rem}'
    +'.mc{border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px}'
    +'.ml{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;margin-bottom:6px}'
    +'.mv{font-size:24px;font-weight:700}'
    +'table{width:100%;border-collapse:collapse;font-size:11px}'
    +'thead th{background:#F9FAFB;padding:7px 10px;text-align:left;font-weight:700;font-size:10px;'
    +'text-transform:uppercase;letter-spacing:.05em;color:#6B7280;border-bottom:2px solid #E5E7EB}'
    +'tbody td{padding:8px 10px;border-bottom:1px solid #F3F4F6;vertical-align:top}'
    +'tbody tr:last-child td{border-bottom:none}'
    +'.tag{display:inline-block;font-size:9px;font-weight:700;padding:1px 7px;border-radius:20px}'
    +'.tag-green{background:#ECFDF5;color:#059669}.tag-blue{background:#EFF6FF;color:#2563EB}'
    +'.tag-amber{background:#FFFBEB;color:#B45309}.tag-proc{background:#EEEAFF;color:#5B4CF5}'
    +'.tag-bu{background:#EFF6FF;color:#2563EB}'
    +'@media print{body{padding:.75rem}}';

  function buildRows(arr,tagClass,tagLabel){
    if(!arr.length) return '<tr><td colspan="5" style="color:#9CA3AF;padding:12px 10px;font-style:italic;">Aucun audit.</td></tr>';
    return arr.map(function(ap){
      var ttype=ap.type==='Process'?'<span class="tag tag-proc">Process</span>':'<span class="tag tag-bu">BU</span>';
      return '<tr>'
        +'<td style="font-weight:600;color:#111827">'+ap.titre+'</td>'
        +'<td>'+ttype+'</td>'
        +'<td style="color:#6B7280">'+detail(ap)+'</td>'
        +'<td style="color:#374151">'+auds(ap)+'</td>'
        +'<td style="color:#6B7280">'+(ap.dateDebut||ap.annee)+'</td>'
        +'</tr>';
    }).join('');
  }

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"/>'
    +'<title>AuditFlow — Plan '+CY+'</title>'
    +'<style>'+CSS+'</style></head><body>'
    +'<h1>Plan d\'audit — '+CY+'</h1>'
    +'<div class="sub">Généré le '+new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})
    +(window._dbAuditeur!=='all'?' · Auditeur : '+(TM[window._dbAuditeur]&&TM[window._dbAuditeur].name||window._dbAuditeur):'')
    +' · '+allYear.length+' audit(s) au total</div>'
    +'<div class="metrics">'
    +'<div class="mc"><div class="ml">Clôturés</div><div class="mv" style="color:#059669">'+closed.length+'</div></div>'
    +'<div class="mc"><div class="ml">En cours</div><div class="mv" style="color:#5B4CF5">'+ongoing.length+'</div></div>'
    +'<div class="mc"><div class="ml">Planifiés</div><div class="mv" style="color:#B45309">'+planned.length+'</div></div>'
    +'</div>'

    // Section Clôturés
    +'<h2>Audits Clôturés ('+closed.length+')</h2>'
    +'<table><thead><tr><th>Titre</th><th>Type</th><th>Périmètre</th><th>Auditeur(s)</th><th>Période</th></tr></thead>'
    +'<tbody>'+buildRows(closed,'tag-green','Clôturé')+'</tbody></table>'

    // Section En cours
    +'<h2>Audits En cours ('+ongoing.length+')</h2>'
    +'<table><thead><tr><th>Titre</th><th>Type</th><th>Périmètre</th><th>Auditeur(s)</th><th>Période</th></tr></thead>'
    +'<tbody>'+buildRows(ongoing,'tag-blue','En cours')+'</tbody></table>'

    // Section Planifiés
    +'<h2>Audits Planifiés ('+planned.length+')</h2>'
    +'<table><thead><tr><th>Titre</th><th>Type</th><th>Périmètre</th><th>Auditeur(s)</th><th>Période</th></tr></thead>'
    +'<tbody>'+buildRows(planned,'tag-amber','Planifié')+'</tbody></table>'

    +'</body></html>';

  var w=window.open('','_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(function(){w.print();},400);
}

function exportAuditPDF(auditId){
  var ap=AUDIT_PLAN.find(function(a){return a.id===auditId;});
  if(!ap){toast('Audit introuvable');return;}
  var d=getAudData(auditId);
  var pct=calculateAuditProgress(ap);
  var auds=(ap.auditeurs||[]).map(function(id){return TM[id]?TM[id].name:id;}).join(', ')||'—';

  // ── Données contrôles / tests ──────────────────────────────
  var allControls=d.controls[4]||[];
  var keyExisting=allControls.filter(function(c){return c.clef&&c.design==='existing';});
  var targetControls=allControls.filter(function(c){return c.design==='target';});
  var finalized=keyExisting.filter(function(c){return c.finalized;});
  var passCount=finalized.filter(function(c){return c.result==='pass';}).length;
  var failCount=finalized.filter(function(c){return c.result==='fail';}).length;
  var targetCount=targetControls.length;

  // ── Maturity ───────────────────────────────────────────────
  var mat=d.maturity||{};
  var MLEVELS={
    unsatisfactory:'Unsatisfactory',
    major:'Major Improvements Needed',
    some:'Some Improvements Needed',
    effective:'Effective'
  };
  var matLabel=mat.level?MLEVELS[mat.level]||mat.level:'Non évalué';
  var matColors={unsatisfactory:'#A32D2D',major:'#854F0B',some:'#1D6B45',effective:'#3B6D11'};
  var matColor=mat.level?matColors[mat.level]||'#374151':'#9CA3AF';

  // ── Période ────────────────────────────────────────────────
  var periode=ap.dateDebut&&ap.dateFin
    ?ap.dateDebut+' → '+ap.dateFin
    :ap.dateDebut||String(ap.annee);

  // ── CSS ───────────────────────────────────────────────────
  var CSS='body{font-family:system-ui,sans-serif;padding:2rem;color:#111827;max-width:860px;margin:0 auto}'
    +'h1{font-size:19px;font-weight:700;margin-bottom:.25rem;letter-spacing:-.02em}'
    +'.gen{font-size:11px;color:#6B7280;margin-bottom:1.5rem}'
    +'.section{border:1px solid #E5E7EB;border-radius:10px;padding:1rem 1.25rem;margin-bottom:1.25rem}'
    +'.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;'
    +'color:#5B4CF5;margin-bottom:.875rem;padding-bottom:.5rem;border-bottom:1px solid #EEEAFF}'
    +'.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}'
    +'.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}'
    +'.lbl{font-size:10px;color:#9CA3AF;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}'
    +'.val{font-size:13px;font-weight:600;color:#111827}'
    +'.stat-box{border:1px solid #E5E7EB;border-radius:8px;padding:10px 14px;text-align:center}'
    +'table{width:100%;border-collapse:collapse;font-size:11px}'
    +'thead th{background:#F9FAFB;padding:6px 10px;text-align:left;font-weight:700;font-size:10px;'
    +'text-transform:uppercase;letter-spacing:.05em;color:#6B7280;border-bottom:2px solid #E5E7EB}'
    +'tbody td{padding:7px 10px;border-bottom:1px solid #F3F4F6;vertical-align:top}'
    +'tbody tr:last-child td{border-bottom:none}'
    +'.badge{display:inline-block;font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;white-space:nowrap}'
    +'.b-pass{background:#ECFDF5;color:#059669}.b-fail{background:#FEF2F2;color:#DC2626}'
    +'.b-target{background:#FFFBEB;color:#B45309}.b-nd{background:#F3F4F6;color:#6B7280}'
    +'@media print{body{padding:.75rem}.section{break-inside:avoid}}';

  // ── Section Admin ─────────────────────────────────────────
  var adminHtml='<div class="section">'
    +'<div class="section-title">Admin</div>'
    +'<div class="grid2" style="gap:12px">'
    +'<div><div class="lbl">Mission</div><div class="val">'+ap.titre+'</div></div>'
    +'<div><div class="lbl">Type</div><div class="val">'+ap.type+'</div></div>'
    +'<div><div class="lbl">Auditeur(s)</div><div class="val">'+auds+'</div></div>'
    +'<div><div class="lbl">Période</div><div class="val">'+periode+'</div></div>'
    +'<div><div class="lbl">Statut</div><div class="val">'+pct+'% — '+(ap.statut||'Planifié')+'</div></div>'
    +'<div><div class="lbl">Étape</div><div class="val">'+(ap.step!=null?STEPS[Math.min(ap.step,9)].s:'—')+'</div></div>'
    +'</div>'
    +'</div>';

  // ── Section Exec Summary ──────────────────────────────────
  var execHtml='<div class="section">'
    +'<div class="section-title">Exec Summary</div>'
    +'<div style="margin-bottom:1rem">'
    +'<div class="lbl" style="margin-bottom:6px">Overall Process Maturity</div>'
    +'<div style="display:inline-block;padding:6px 14px;border-radius:8px;border:2px solid '+matColor+';color:'+matColor+';font-size:13px;font-weight:700">'+matLabel+'</div>'
    +(mat.notes?'<div style="font-size:11px;color:#6B7280;margin-top:6px;font-style:italic">'+mat.notes+'</div>':'')
    +'</div>'
    +'<div class="grid3">'
    +'<div class="stat-box"><div class="lbl">Tests finalisés</div><div class="val" style="font-size:20px">'+finalized.length+'</div></div>'
    +'<div class="stat-box" style="border-color:#ECFDF5"><div class="lbl">Pass</div><div class="val" style="font-size:20px;color:#059669">'+passCount+'</div></div>'
    +'<div class="stat-box" style="border-color:#FEF2F2"><div class="lbl">Fail + Target</div><div class="val" style="font-size:20px;color:#DC2626">'+(failCount+targetCount)+'</div></div>'
    +'</div>'
    +'</div>';

  // ── Section Contrôles & Tests ─────────────────────────────
  var ctrlRows='';
  if(keyExisting.length){
    ctrlRows=keyExisting.map(function(ctrl){
      var resBadge=ctrl.finalized
        ?(ctrl.result==='pass'?'<span class="badge b-pass">Pass</span>':'<span class="badge b-fail">Fail</span>')
        :'<span class="badge b-nd">Non finalisé</span>';
      return '<tr>'
        +'<td style="font-weight:500">'+ctrl.name+'</td>'
        +'<td style="color:#6B7280">'+ctrl.owner+'</td>'
        +'<td style="color:#6B7280">'+ctrl.freq+'</td>'
        +'<td style="color:#6B7280">'+ctrl.testNature+'</td>'
        +'<td>'+resBadge+'</td>'
        +'<td style="color:#DC2626;font-size:10px">'+(ctrl.result==='fail'&&ctrl.finding?ctrl.finding:'—')+'</td>'
        +'</tr>';
    }).join('');
  }

  var ctrlHtml='<div class="section">'
    +'<div class="section-title">Contrôles existants ('+keyExisting.length+')</div>'
    +(keyExisting.length
      ?'<table><thead><tr><th>Contrôle</th><th>Owner</th><th>Fréquence</th><th>Nature du test</th><th>Résultat</th><th>Finding</th></tr></thead><tbody>'+ctrlRows+'</tbody></table>'
      :'<div style="color:#9CA3AF;font-size:12px;font-style:italic">Aucun contrôle documenté.</div>')
    +'</div>';

  // ── Section Contrôles manquants (Target) ──────────────────
  var targetHtml='<div class="section">'
    +'<div class="section-title">Contrôles manquants — Target ('+targetControls.length+')</div>'
    +(targetControls.length
      ?'<table><thead><tr><th>Contrôle</th><th>Owner</th><th>Fréquence</th></tr></thead><tbody>'
        +targetControls.map(function(ctrl){
          return '<tr>'
            +'<td style="font-weight:500">'+ctrl.name+'</td>'
            +'<td style="color:#6B7280">'+ctrl.owner+'</td>'
            +'<td style="color:#6B7280">'+ctrl.freq+'</td>'
            +'</tr>';
        }).join('')
        +'</tbody></table>'
      :'<div style="color:#9CA3AF;font-size:12px;font-style:italic">Aucun contrôle manquant identifié.</div>')
    +'</div>';

  // ── Section Findings ──────────────────────────────────────
  var allFindings=[];
  keyExisting.forEach(function(c){if(c.result==='fail'&&c.finding)allFindings.push({type:'fail',title:c.name,desc:c.finding});});
  targetControls.forEach(function(c){allFindings.push({type:'target',title:c.name,desc:'Contrôle non existant'});});
  (d.findings||[]).forEach(function(f){allFindings.push({type:'manual',title:f.title,desc:f.desc});});

  var findHtml='<div class="section">'
    +'<div class="section-title">Findings ('+allFindings.length+')</div>'
    +(allFindings.length
      ?allFindings.map(function(f){
          var typeB=f.type==='fail'?'<span class="badge b-fail">Fail</span>'
            :f.type==='target'?'<span class="badge b-target">Target</span>'
            :'<span class="badge b-nd">Finding</span>';
          return '<div style="padding:8px 0;border-bottom:1px solid #F3F4F6">'
            +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'+typeB
            +'<span style="font-size:12px;font-weight:600">'+f.title+'</span></div>'
            +'<div style="font-size:11px;color:#6B7280;padding-left:4px">'+f.desc+'</div>'
            +'</div>';
        }).join('')
      :'<div style="color:#9CA3AF;font-size:12px;font-style:italic">Aucun finding identifié.</div>')
    +'</div>';

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"/>'
    +'<title>Rapport — '+ap.titre+'</title>'
    +'<style>'+CSS+'</style></head><body>'
    +'<h1>Rapport d\'audit — '+ap.titre+'</h1>'
    +'<div class="gen">Généré le '+new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+'</div>'
    +adminHtml+execHtml+ctrlHtml+targetHtml+findHtml
    +'</body></html>';

  var w=window.open('','_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(function(){w.print();},400);
}

// Helper anti-XSS pour les attributs onclick (apostrophes)
function _escQ(s){return(s||'').replace(/'/g,'&#39;');}
