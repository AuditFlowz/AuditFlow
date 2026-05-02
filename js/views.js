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
  {key:'modéré',   label:'Modéré',   color:'var(--amber)',  badge:'bp2'},
  {key:'élevé',    label:'Élevé',    color:'var(--red)',    badge:'blt'},
  {key:'critique', label:'Critique', color:'#7f1d1d',       badge:'bhi'},
];

function riskLabel(key){
  // Tolérer les anciennes valeurs sans accent (modere, eleve) pour compat
  if (key === 'modere') key = 'modéré';
  if (key === 'eleve') key = 'élevé';
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

// ── Modale d'association risques ↔ processus (Risk Universe) ────────
function showProcRisksModal(procId){
  var proc=PROCESSES.find(function(p){return p.id===procId;});
  if(!proc){toast('Processus introuvable');return;}

  var groupRisks = (RISK_UNIVERSE||[]).filter(function(r){return r.level==='group';});
  groupRisks.sort(function(a,b){return (a.title||'').localeCompare(b.title||'','fr',{sensitivity:'base'});});

  var currentRefs = proc.riskRefs || [];

  if (!groupRisks.length) {
    openModal('Risques associés — '+proc.proc,
      '<div style="font-size:12px;color:var(--text-3);padding:1rem;text-align:center;background:var(--bg);border-radius:6px">'
      + '<div style="font-size:28px;margin-bottom:6px">△</div>'
      + '<div style="margin-bottom:4px;font-weight:500">Aucun risque dans le Risk Universe</div>'
      + '<div>Créez d\'abord des risques Groupe (URD) dans l\'onglet <strong>Risk Universe</strong> pour pouvoir les associer.</div>'
      + '</div>',
      function(){});
    return;
  }

  var isAdmin = CU && CU.role === 'admin';

  var body = '<div style="font-size:11px;color:var(--text-3);margin-bottom:10px">Cochez les risques URD qui s\'appliquent à <strong style="color:var(--text)">'+proc.proc+'</strong>. Le niveau de risque du process sera le plus élevé parmi les risques cochés.</div>';
  body += '<div class="cb-list" style="display:flex;flex-direction:column;gap:4px;max-height:350px;overflow-y:auto;border:.5px solid var(--border);border-radius:var(--radius);padding:8px 10px;background:var(--bg-card)">';
  groupRisks.forEach(function(gr){
    var colors = (typeof RISK_IMPACT_COLORS!=='undefined' && RISK_IMPACT_COLORS[gr.impact]) ? RISK_IMPACT_COLORS[gr.impact] : {bg:'#F3F4F6',color:'#374151'};
    var checked = currentRefs.indexOf(gr.id)>=0 ? ' checked' : '';
    var typeBadges = (gr.impactTypes||[]).map(function(t){return '<span class="badge bpl" style="font-size:8px;padding:1px 5px">'+t+'</span>';}).join(' ');
    var disabled = !isAdmin ? ' disabled' : '';
    body += '<label style="align-items:flex-start !important"><input type="checkbox" class="pr-risk-cb" value="'+gr.id+'"'+checked+disabled+'><span style="flex:1">';
    body += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><strong>'+gr.title+'</strong>';
    if (gr.impact) body += '<span class="badge" style="background:'+colors.bg+';color:'+colors.color+';font-size:9px">'+gr.impact+'</span>';
    if (gr.probability) body += '<span class="badge bpl" style="font-size:9px">'+gr.probability+'</span>';
    body += '</div>';
    if (gr.description) body += '<div style="font-size:10px;color:var(--text-3);margin-top:2px">'+gr.description+'</div>';
    if (typeBadges) body += '<div style="margin-top:3px">'+typeBadges+'</div>';
    body += '</span></label>';
  });
  body += '</div>';
  body += '<div id="pr-summary" style="font-size:11px;margin-top:10px;color:var(--purple-dk);font-weight:500"></div>';

  openModal('Risques associés — '+proc.proc, body, async function(){
    if (!isAdmin) return;
    var newRefs = [];
    document.querySelectorAll('.pr-risk-cb:checked').forEach(function(cb){ newRefs.push(cb.value); });
    proc.riskRefs = newRefs;
    // Recalculer le niveau de risque à partir des impacts des risques associés
    proc.riskLevel = computeProcRiskLevelFromRefs(newRefs);
    proc.risk = riskLevelToNum(proc.riskLevel);
    // Sauvegarder (avec risk_refs_json et les champs recalculés)
    await spUpsert('AF_Processes', proc.id, {
      dom: proc.dom, proc: proc.proc,
      risk: proc.risk, risk_level: proc.riskLevel,
      archived: proc.archived||false,
      risks_json: JSON.stringify(proc.risks||[]),
      risk_refs_json: JSON.stringify(newRefs),
      Title: proc.proc,
    });
    addHist('edit', newRefs.length+' risque(s) associé(s) à "'+proc.proc+'"');
    renderProcTable();
    toast('Risques associés ✓');
  });

  // Mise à jour du résumé en temps réel
  setTimeout(function(){
    var update = function(){
      var checkedVals = [];
      document.querySelectorAll('.pr-risk-cb:checked').forEach(function(cb){ checkedVals.push(cb.value); });
      var level = computeProcRiskLevelFromRefs(checkedVals);
      var summary = document.getElementById('pr-summary');
      if (summary) {
        if (checkedVals.length === 0) {
          summary.innerHTML = '<span style="color:var(--text-3);font-style:italic">Aucun risque associé — le niveau sera "—"</span>';
        } else {
          summary.innerHTML = checkedVals.length+' risque(s) associé(s) · Niveau calculé : <strong>'+level+'</strong>';
        }
      }
    };
    update();
    document.querySelectorAll('.pr-risk-cb').forEach(function(cb){ cb.addEventListener('change', update); });
  }, 50);
}

// Helper : calcule le niveau du process à partir des IDs de risques URD associés
// Retourne 'faible', 'modéré', 'élevé' ou 'critique'
// Basé sur le max des impacts des risques sélectionnés
function computeProcRiskLevelFromRefs(riskIds) {
  if (!riskIds || !riskIds.length) return 'faible';
  // Mapping Impact -> ordre (pour calculer le max)
  var impactOrder = {'Minor':1, 'Limited':2, 'Major':3, 'Severe':4};
  var impactToLevel = {'Minor':'faible', 'Limited':'modéré', 'Major':'élevé', 'Severe':'critique'};
  var maxOrder = 0;
  var maxImpact = 'Minor';
  riskIds.forEach(function(rid){
    var r = (RISK_UNIVERSE||[]).find(function(x){return x.id===rid;});
    if (!r) return;
    var ord = impactOrder[r.impact] || 0;
    if (ord > maxOrder) { maxOrder = ord; maxImpact = r.impact; }
  });
  return impactToLevel[maxImpact] || 'faible';
}

function riskLevelToNum(level) {
  return {'faible':1, 'modéré':2, 'élevé':3, 'critique':4}[level] || 1;
}

// ── Anciennes fonctions (conservées pour compat mais plus appelées dans l'UI) ──
async function addProcRisk(procId){
  var label=document.getElementById('nr-label').value.trim();
  if(!label){toast('Description obligatoire');return;}
  var prob=parseInt(document.getElementById('nr-prob').value)||1;
  var imp=parseInt(document.getElementById('nr-imp').value)||1;
  var proc=PROCESSES.find(function(p){return p.id===procId;});
  if(!proc){toast('Processus introuvable');return;}
  if(!proc.risks)proc.risks=[];
  proc.risks.push({id:'r'+Date.now(),label:label,probability:prob,impact:imp});
  await spUpsert('AF_Processes',proc.id,{dom:proc.dom,proc:proc.proc,risk:proc.risk,risk_level:proc.riskLevel||'faible',archived:proc.archived||false,risks_json:JSON.stringify(proc.risks),Title:proc.proc});
  toast('Risque ajouté ✓');
}

async function removeProcRisk(procId,ri){
  // Conservée pour compat (plus appelée depuis l'UI)
  var proc=PROCESSES.find(function(p){return p.id===procId;});
  if(!proc||!proc.risks)return;
  proc.risks.splice(ri,1);
  await spUpsert('AF_Processes',proc.id,{dom:proc.dom,proc:proc.proc,risk:proc.risk,risk_level:proc.riskLevel||'faible',archived:proc.archived||false,risks_json:JSON.stringify(proc.risks),Title:proc.proc});
  toast('Risque supprimé ✓');
}

// ══════════════════════════════════════════════════════════════
//  HELPER GLOBAL — Récupérer tous les risques d'un audit
//  (URD via processus + ad hoc dans d.auditRisks)
// ══════════════════════════════════════════════════════════════
function getAuditRisks(auditId) {
  var ap = (AUDIT_PLAN||[]).find(function(a){return a.id===auditId;});
  if (!ap) return [];
  var d = (typeof AUD_DATA !== 'undefined' && AUD_DATA[auditId]) ? AUD_DATA[auditId] : {};

  var pids = (Array.isArray(ap.processIds) && ap.processIds.length)
    ? ap.processIds
    : (ap.processId ? [ap.processId] : []);

  var probToNum = {'Rare':1,'Unlikely':2,'Possible':3,'Certain':4};
  var impToNum  = {'Minor':1,'Limited':2,'Major':3,'Severe':4};

  var risks = [];
  var seen = {};

  // 1. Risques URD via les processus de l'audit
  pids.forEach(function(pid){
    var procObj = (PROCESSES||[]).find(function(p){return p.id===pid;});
    if (!procObj) return;
    (procObj.riskRefs||[]).forEach(function(rid){
      if (seen[rid]) return;
      seen[rid] = true;
      var r = (RISK_UNIVERSE||[]).find(function(x){return x.id===rid;});
      if (!r) return;
      risks.push({
        id: r.id,
        title: r.title,
        label: r.title,
        description: r.description || '',
        probability: probToNum[r.probability] || 1,
        impact: impToNum[r.impact] || 1,
        impactRaw: r.impact || '',
        probabilityRaw: r.probability || '',
        impactTypes: r.impactTypes || [],
        source: 'urd',
        _fromProc: procObj.proc,
      });
    });
  });

  // 2. Risques ad hoc spécifiques à l'audit
  (d.auditRisks||[]).forEach(function(r){
    risks.push({
      id: r.id,
      title: r.label || r.title || '',
      label: r.label || r.title || '',
      description: r.description || '',
      probability: r.probability || 1,
      impact: r.impact || 1,
      source: 'adhoc',
    });
  });

  return risks;
}

// ══════════════════════════════════════════════════════════════
//  MATRICE RISQUES — Step 5
// ══════════════════════════════════════════════════════════════
function renderRiskMatrix(){
  var ap=AUDIT_PLAN.find(function(a){return a.id===CA;});
  var d=getAudData(CA);
  if(!d.riskLinks)d.riskLinks={};  // {riskId: [controlId, ...]}
  if(!d.auditRisks)d.auditRisks=[]; // risques spécifiques à cet audit

  // Risques des processus associés — récupérés depuis le Risk Universe
  // via les riskRefs du process (nouveau système) — gère multi-processus
  var pids = (Array.isArray(ap&&ap.processIds) && ap.processIds.length)
    ? ap.processIds
    : (ap && ap.processId ? [ap.processId] : []);
  var procRisks = [];
  var seenRiskIds = {}; // dédoublonner si plusieurs process référencent le même risque URD
  pids.forEach(function(pid){
    var procObj = PROCESSES.find(function(p){return p.id===pid;});
    if (!procObj) return;
    var procName = procObj.proc;
    var refs = procObj.riskRefs || [];
    refs.forEach(function(riskId){
      if (seenRiskIds[riskId]) return;
      seenRiskIds[riskId] = true;
      var r = (RISK_UNIVERSE||[]).find(function(x){return x.id===riskId;});
      if (!r) return;
      // Mapper Impact/Proba textuels en valeurs numériques (compat matrice existante)
      var probToNum = {'Rare':1,'Unlikely':2,'Possible':3,'Certain':4};
      var impToNum  = {'Minor':1,'Limited':2,'Major':3,'Severe':4};
      procRisks.push({
        id: r.id,
        title: r.title,
        description: r.description || '',
        label: r.title, // compat avec ancien champ "label"
        probability: probToNum[r.probability] || 1,
        impact: impToNum[r.impact] || 1,
        impactTypes: r.impactTypes || [],
        _fromProc: procName,
        _fromRiskUniverse: true,
      });
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
  // Les missions "Other" ne sont PAS affichées dans le tableau principal
  // (elles ont leur propre capsule dédiée)
  var filtered=AUDIT_PLAN.filter(function(a){
    var okY  = a.annee===_dbYear;
    var okT  = a.type !== 'Other';
    var okA  = _dbAuditeur==='all'||(a.auditeurs||[]).includes(_dbAuditeur);
    var okS  = _dbStatut==='all'||(a.statut||'').startsWith(_dbStatut);
    return okY&&okT&&okA&&okS;
  });

  var yClosed  = filtered.filter(function(a){return (a.statut||'').startsWith('Clôturé');});
  var yInProg  = filtered.filter(function(a){return (a.statut||'').startsWith('En cours');});
  var yPlanned = filtered.filter(function(a){return (a.statut||'').startsWith('Planifié');});
  var yLate    = filtered.filter(function(a){return (a.statut||'').startsWith('En retard');});
  var closedPct= filtered.length?Math.round(yClosed.length/filtered.length*100):0;

  // Toutes les stats Process + BU (pas Other)
  var forChart=AUDIT_PLAN.filter(function(a){
    return a.annee===_dbYear
      && a.type !== 'Other'
      && (_dbAuditeur==='all'||(a.auditeurs||[]).includes(_dbAuditeur));
  });
  var cClosed  = forChart.filter(function(a){return (a.statut||'').startsWith('Clôturé');}).length;
  var cInProg  = forChart.filter(function(a){return (a.statut||'').startsWith('En cours');}).length;
  var cPlanned = forChart.filter(function(a){return (a.statut||'').startsWith('Planifié');}).length;
  var cLate    = forChart.filter(function(a){return (a.statut||'').startsWith('En retard');}).length;
  var cTotal   = forChart.length;

  // ── Stats spécifiques pour les Process Audits uniquement ──
  var processOnly = AUDIT_PLAN.filter(function(a){
    return a.annee===_dbYear && a.type==='Process'
      && (_dbAuditeur==='all'||(a.auditeurs||[]).includes(_dbAuditeur));
  });
  var pTotal = processOnly.length;

  // Comptage par domaine (pour donut Process Audits par domaine)
  var domCount = {};
  processOnly.forEach(function(a){
    var pids = (Array.isArray(a.processIds) && a.processIds.length) ? a.processIds : (a.processId ? [a.processId] : []);
    var doms = new Set();
    pids.forEach(function(pid){
      var p = PROCESSES.find(function(x){return x.id===pid;});
      if (p && p.dom) doms.add(p.dom);
    });
    doms.forEach(function(d){ domCount[d] = (domCount[d]||0) + 1; });
  });

  // Stats pour la nouvelle capsule "Missions par type"
  var byType = {
    Process: AUDIT_PLAN.filter(function(a){return a.annee===_dbYear && a.type==='Process' && (_dbAuditeur==='all'||(a.auditeurs||[]).includes(_dbAuditeur));}).length,
    BU:      AUDIT_PLAN.filter(function(a){return a.annee===_dbYear && a.type==='BU' && (_dbAuditeur==='all'||(a.auditeurs||[]).includes(_dbAuditeur));}).length,
    Other:   AUDIT_PLAN.filter(function(a){return a.annee===_dbYear && a.type==='Other' && (_dbAuditeur==='all'||(a.auditeurs||[]).includes(_dbAuditeur));}).length,
  };
  var totalAll = byType.Process + byType.BU + byType.Other;

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
  html+='<div class="topbar">';
  html+='<div class="tbtitle">Tableau de bord — '+_dbYear+'</div>';
  // ── Filtres en ligne, au centre de la topbar ──
  html+='<div style="display:flex;gap:8px;align-items:center;flex:1;justify-content:center">';
  html+='<select class="f-inp" style="font-size:12px;height:30px;padding:0 8px;min-width:90px" onchange="dbSetYear(parseInt(this.value))" title="Année">'+yearOpts+'</select>';
  html+='<select class="f-inp" style="font-size:12px;height:30px;padding:0 8px;min-width:120px" onchange="dbSetAuditeur(this.value)" title="Auditeur">'+audOpts+'</select>';
  html+='<select class="f-inp" style="font-size:12px;height:30px;padding:0 8px;min-width:120px" onchange="dbSetStatut(this.value)" title="Statut">'+statOpts+'</select>';
  html+='</div>';
  html+='<div style="display:flex;gap:7px;">'
    +'<button class="bs" onclick="exportDashboardPDF()" style="font-size:11px;">⬇ Export PDF</button>'
    +'<button class="bp" onclick="nav(\'plan-audit\')">+ Nouvel audit</button>'
    +'</div>';
  html+='</div>';

  // Content en colonne (plus de colonne gauche)
  html+='<div class="content" style="display:flex;flex-direction:column;gap:1rem;">';

  // ══════════════════════════════════════════════════════════════
  //  3 CAPSULES : Donut audits | Pays audités | Autres missions
  // ══════════════════════════════════════════════════════════════

  // Préparer données Capsule 2 : Pays audités
  // On prend tous les audits BU de l'année (filtrés par auditeur si applicable)
  var buAudits = AUDIT_PLAN.filter(function(a){
    return a.type==='BU' && a.annee===_dbYear
      && (_dbAuditeur==='all'||(a.auditeurs||[]).includes(_dbAuditeur));
  });
  // Construire la liste : {pays, region, statut, titre}
  var countryEntries = [];
  buAudits.forEach(function(a){
    (a.pays||[]).forEach(function(country){
      countryEntries.push({
        country: country,
        region: a.region||'',
        statut: a.statut||'Planifié',
        titre: a.titre||'',
        auditId: a.id,
      });
    });
  });
  // Trier alphabétiquement par pays
  countryEntries.sort(function(a,b){
    return (a.country||'').localeCompare(b.country||'', 'fr', {sensitivity:'base'});
  });

  // Préparer données Capsule 3 : Autres missions
  var otherMissions = AUDIT_PLAN.filter(function(a){
    return a.type==='Other' && a.annee===_dbYear
      && (_dbAuditeur==='all'||(a.auditeurs||[]).includes(_dbAuditeur));
  });
  otherMissions.sort(function(a,b){
    return (a.categorie||'').localeCompare(b.categorie||'', 'fr', {sensitivity:'base'});
  });

  // Construction HTML des 3 capsules
  // ══════════════════════════════════════════════════════════════
  //  LAYOUT : Capsule "Missions" à gauche, 3 capsules à droite
  // ══════════════════════════════════════════════════════════════
  html += '<div style="display:grid;grid-template-columns:1fr 3fr;gap:.875rem;margin-bottom:1rem;">';

  // ── CAPSULE 0 : Missions par type + donut statut ──
  html += '<div class="card" style="padding:1rem;display:flex;flex-direction:column">';
  html += '<div style="font-size:13px;font-weight:600;margin-bottom:.5rem;">Missions '+_dbYear+' ('+totalAll+')</div>';
  // Compteur par type avec barres
  var typeColors = {Process:'#5DCAA5', BU:'#EF9F27', Other:'#AFA9EC'};
  var typeLabels = {Process:'Process', BU:'BU', Other:'Autres'};
  ['Process','BU','Other'].forEach(function(t){
    var pct = totalAll ? Math.round(byType[t]/totalAll*100) : 0;
    html += '<div style="margin-bottom:6px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;font-size:10px;margin-bottom:2px">'
        + '<span style="color:var(--text-2)">'+typeLabels[t]+'</span>'
        + '<span style="font-weight:600">'+byType[t]+' <span style="color:var(--text-3);font-weight:400">('+pct+'%)</span></span>'
      + '</div>'
      + '<div style="height:5px;background:var(--bg);border-radius:3px;overflow:hidden">'
        + '<div style="width:'+pct+'%;height:100%;background:'+typeColors[t]+';transition:width .3s"></div>'
      + '</div>'
      + '</div>';
  });
  // Petit donut statut en dessous
  html += '<div style="margin-top:auto;padding-top:8px;border-top:.5px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
  html += '<canvas id="db-donut2" width="70" height="70" style="flex-shrink:0"></canvas>';
  html += '<div style="display:flex;flex-direction:column;gap:2px;font-size:9px;flex:1;min-width:0">';
  html += '<div style="font-size:10px;color:var(--text-2);font-weight:600;margin-bottom:2px">Par statut</div>';
  var statusItems = [
    {label:'Clôturés', val: AUDIT_PLAN.filter(function(a){var s=(a.statut||'');return a.annee===_dbYear && (_dbAuditeur==='all'||(a.auditeurs||[]).includes(_dbAuditeur)) && (s.startsWith('Clôturé')||s.startsWith('Fait'));}).length, color:'#5DCAA5'},
    {label:'En cours', val: AUDIT_PLAN.filter(function(a){return a.annee===_dbYear && (_dbAuditeur==='all'||(a.auditeurs||[]).includes(_dbAuditeur)) && (a.statut||'').startsWith('En cours');}).length, color:'#AFA9EC'},
    {label:'Planifiés', val: AUDIT_PLAN.filter(function(a){return a.annee===_dbYear && (_dbAuditeur==='all'||(a.auditeurs||[]).includes(_dbAuditeur)) && (a.statut||'').startsWith('Planifié');}).length, color:'#EF9F27'},
  ];
  statusItems.forEach(function(si){
    html+='<div style="display:flex;align-items:center;gap:4px;font-size:10px">'
      +'<div style="width:6px;height:6px;border-radius:50%;background:'+si.color+';flex-shrink:0;"></div>'
      +'<span style="color:var(--text-2)">'+si.label+'</span>'
      +'<span style="font-weight:600;margin-left:auto">'+si.val+'</span>'
      +'</div>';
  });
  html += '</div></div></div>';

  // ── BLOC DROIT : 3 capsules ──
  html += '<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:.875rem;">';

  // ── CAPSULE 1 : Process Audits par domaine ──
  html += '<div class="card" style="padding:1rem;">';
  html += '<div style="font-size:13px;font-weight:600;margin-bottom:.5rem;">Process Audits '+_dbYear+' ('+pTotal+')</div>';
  html += '<div style="display:flex;flex-direction:column;align-items:center;gap:.75rem;">';
  html += '<canvas id="db-donut" width="130" height="130" style="flex-shrink:0;"></canvas>';
  html += '<div style="display:flex;flex-direction:column;gap:3px;width:100%;">';
  // Construire les items à partir de domCount, palette de couleurs
  var domPalette = ['#AFA9EC','#85B7EB','#5DCAA5','#EF9F27','#F0997B','#97C459','#C7B7E5','#8AC6F7','#F4B183','#A0D0A4'];
  var domEntries = Object.keys(domCount).sort(function(a,b){return (a||'').localeCompare(b||'','fr',{sensitivity:'base'});});
  var chartItems = [];
  if (domEntries.length === 0) {
    html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;text-align:center">Aucun process audit cette année</div>';
  } else {
    domEntries.forEach(function(dom, i){
      chartItems.push({label: dom, val: domCount[dom], color: domPalette[i % domPalette.length]});
    });
    chartItems.forEach(function(ci){
      var pct2=pTotal?Math.round(ci.val/pTotal*100):0;
      var lblShort = ci.label.length>30 ? ci.label.slice(0,28)+'…' : ci.label;
      html+='<div style="display:flex;align-items:center;gap:6px;line-height:1.3;">'
        +'<div style="width:8px;height:8px;border-radius:50%;background:'+ci.color+';flex-shrink:0;"></div>'
        +'<span style="color:var(--text-2);font-size:10px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+ci.label+'">'+lblShort+'</span>'
        +'<span style="font-weight:600;font-size:10px;white-space:nowrap;">'+ci.val+' <span style="font-weight:400;color:var(--text-3);">('+pct2+'%)</span></span>'
        +'</div>';
    });
  }
  html += '</div></div></div>';

  // ── CAPSULE 2 : BU Audits ──
  html += '<div class="card" style="padding:1rem;display:flex;flex-direction:column">';
  html += '<div style="font-size:13px;font-weight:600;margin-bottom:.5rem;">BU Audits '+_dbYear+' ('+countryEntries.length+')</div>';
  if (countryEntries.length) {
    html += '<div style="flex:1;max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:5px">';
    countryEntries.forEach(function(ce){
      var statBadge = badge(ce.statut);
      html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--bg);border-radius:6px;font-size:11px;cursor:pointer" onclick="openAudit(\''+ce.auditId+'\')">'
        + '<span style="font-weight:500;flex:1">'+ce.country+'</span>'
        + '<span style="font-size:10px;color:var(--text-3)">'+ce.region+'</span>'
        + statBadge
        + '</div>';
    });
    html += '</div>';
  } else {
    html += '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-3);font-size:12px;padding:2rem 0">Aucun pays audité pour '+_dbYear+'</div>';
  }
  html += '</div>';

  // ── CAPSULE 3 : Autres missions ──
  html += '<div class="card" style="padding:1rem;display:flex;flex-direction:column">';
  html += '<div style="font-size:13px;font-weight:600;margin-bottom:.5rem;">Autres missions '+_dbYear+' ('+otherMissions.length+')</div>';
  if (otherMissions.length) {
    html += '<div style="flex:1;max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:5px">';
    otherMissions.forEach(function(om){
      var cat = om.categorie || 'Autre';
      var colors = getOtherCategoryColors(cat);
      var statBadge = badge(om.statut||'Planifié');
      html += '<div style="padding:6px 8px;background:var(--bg);border-radius:6px;font-size:11px">'
        + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">'
          + '<span class="badge" style="background:'+colors.bg+';color:'+colors.color+';font-size:9px">'+cat+'</span>'
          + statBadge
        + '</div>'
        + '<div style="font-weight:500;font-size:11px">'+om.titre+'</div>'
        + '</div>';
    });
    html += '</div>';
  } else {
    html += '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-3);font-size:12px;padding:2rem 0;text-align:center">Aucune autre mission<br>pour '+_dbYear+'</div>';
  }
  html += '</div>';

  html += '</div>'; // fin bloc droit (3 capsules)
  html += '</div>'; // fin layout 1fr 3fr

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
  // Dessiner le donut après rendu (Process Audits par domaine)
  setTimeout(function(){
    var canvas=document.getElementById('db-donut');
    if(!canvas) return;
    var CY=window._dbYear||2026;
    var DA=window._dbAuditeur||'all';
    // Process Audits uniquement
    var processOnly = AUDIT_PLAN.filter(function(a){
      return a.annee===CY && a.type==='Process'
        && (DA==='all'||(a.auditeurs||[]).includes(DA));
    });
    var pTot = processOnly.length;
    // Comptage par domaine
    var domCount = {};
    processOnly.forEach(function(a){
      var pids = (Array.isArray(a.processIds) && a.processIds.length) ? a.processIds : (a.processId ? [a.processId] : []);
      var doms = new Set();
      pids.forEach(function(pid){
        var p = PROCESSES.find(function(x){return x.id===pid;});
        if (p && p.dom) doms.add(p.dom);
      });
      doms.forEach(function(d){ domCount[d] = (domCount[d]||0) + 1; });
    });
    var domEntries = Object.keys(domCount).sort(function(a,b){return (a||'').localeCompare(b||'','fr',{sensitivity:'base'});});
    var palette = ['#AFA9EC','#85B7EB','#5DCAA5','#EF9F27','#F0997B','#97C459','#C7B7E5','#8AC6F7','#F4B183','#A0D0A4'];
    var totalForDonut = 0;
    var segments = domEntries.map(function(d, i){
      totalForDonut += domCount[d];
      return {val:domCount[d], color:palette[i % palette.length]};
    });
    var ctx=canvas.getContext('2d');
    var W=130, cx=W/2, cy=W/2, r=60, inner=38;
    var start=-Math.PI/2;
    ctx.clearRect(0,0,W,W);
    if (totalForDonut === 0) {
      // Anneau gris si aucune donnée
      ctx.beginPath();
      ctx.arc(cx,cy,r,0,2*Math.PI);
      ctx.fillStyle='#E5E5EE';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx,cy,inner,0,2*Math.PI);
      ctx.fillStyle='#fff';
      ctx.fill();
      ctx.fillStyle='#9C9A92';
      ctx.font='600 22px -apple-system,system-ui,sans-serif';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillText('0',cx,cy-7);
      ctx.font='10px -apple-system,system-ui,sans-serif';
      ctx.fillText('audits',cx,cy+11);
      return;
    }
    segments.forEach(function(s){
      if(!s.val) return;
      var slice=2*Math.PI*(s.val/totalForDonut);
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
    ctx.font='600 22px -apple-system,system-ui,sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(pTot, cx, cy-7);
    ctx.font='10px -apple-system,system-ui,sans-serif';
    ctx.fillStyle='#9C9A92';
    ctx.fillText('audits', cx, cy+11);
  },60);

  // Dessiner le 2e donut "Missions par type" par statut
  setTimeout(function(){
    var canvas2=document.getElementById('db-donut2');
    if(!canvas2) return;
    var CY=window._dbYear||2026;
    var DA=window._dbAuditeur||'all';
    var allMissions = AUDIT_PLAN.filter(function(a){
      return a.annee===CY && (DA==='all'||(a.auditeurs||[]).includes(DA));
    });
    var sClosed  = allMissions.filter(function(a){var s=(a.statut||'');return s.startsWith('Clôturé')||s.startsWith('Fait');}).length;
    var sInProg  = allMissions.filter(function(a){return (a.statut||'').startsWith('En cours');}).length;
    var sPlanned = allMissions.filter(function(a){return (a.statut||'').startsWith('Planifié');}).length;
    var totS = sClosed + sInProg + sPlanned;
    var segs = [
      {val:sClosed, color:'#5DCAA5'},
      {val:sInProg, color:'#AFA9EC'},
      {val:sPlanned, color:'#EF9F27'},
    ];
    var ctx=canvas2.getContext('2d');
    var W=70, cx=W/2, cy=W/2, r=32, inner=20;
    var start=-Math.PI/2;
    ctx.clearRect(0,0,W,W);
    if (totS === 0) {
      ctx.beginPath();
      ctx.arc(cx,cy,r,0,2*Math.PI);
      ctx.fillStyle='#E5E5EE';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx,cy,inner,0,2*Math.PI);
      ctx.fillStyle='#fff';
      ctx.fill();
      return;
    }
    segs.forEach(function(s){
      if(!s.val) return;
      var slice=2*Math.PI*(s.val/totS);
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,r,start,start+slice);
      ctx.closePath();
      ctx.fillStyle=s.color;
      ctx.fill();
      start+=slice;
    });
    ctx.beginPath();
    ctx.arc(cx,cy,inner,0,2*Math.PI);
    ctx.fillStyle='#fff';
    ctx.fill();
    ctx.fillStyle='#1A1A18';
    ctx.font='600 13px -apple-system,system-ui,sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(totS, cx, cy);
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
    +'<th style="width:340px">Domaine / Processus</th>'
    +'<th style="width:120px">Niveau de risque</th>'
    +'<th style="width:180px">'+(CU&&CU.role==='admin'?'Actions':'Risques')+'</th>'
    +'</tr></thead><tbody>';

  if(!doms.length){
    h+='<tr><td colspan="3" style="text-align:center;color:var(--text-3);padding:2rem">Aucun processus. Cliquez sur "+ Domaine" pour commencer.</td></tr>';
  } else {
    doms.forEach(function(dom){
      var rows=PROCESSES.filter(function(p){return p.dom===dom&&!p.archived;});
      if(!rows.length) return;
      rows.sort(function(a,b){
        return (a.proc||'').localeCompare(b.proc||'', 'fr', {sensitivity:'base'});
      });
      h+='<tr class="sr">';
      h+='<td colspan="3" style="background:#EEEDFE;color:#3C3489;font-weight:600;padding:8px 12px;white-space:nowrap;display:flex;align-items:center;justify-content:space-between;width:100%">';
      h+='<span style="font-size:12px">'+dom+'</span>';
      if(CU&&CU.role==='admin'){
        h+='<button class="bs" style="font-size:10px;padding:2px 7px" onclick="showRenameDomainModal(\''+_escQ(dom)+'\')">Renommer</button>';
      }
      h+='</td></tr>';

      rows.forEach(function(p){
        var idx=PROCESSES.indexOf(p);
        var effectiveLevel = (p.riskRefs && p.riskRefs.length)
          ? computeProcRiskLevelFromRefs(p.riskRefs)
          : (p.riskLevel || 'faible');
        var riskCell = riskLabel(effectiveLevel);
        var refCount = (p.riskRefs||[]).length;
        var refCountBadge = refCount
          ? '<span class="badge bpc" style="font-size:9px;margin-left:4px">'+refCount+'</span>'
          : '<span class="badge bpl" style="font-size:9px;margin-left:4px">0</span>';
        var adminCell=CU&&CU.role==='admin'
          ?'<td style="white-space:nowrap">'
            +'<button class="bs" style="font-size:10px;padding:2px 7px" onclick="showProcRisksModal(\''+p.id+'\')">⚠ Risques'+refCountBadge+'</button> '
            +'<button class="bs" style="font-size:10px;padding:2px 7px" onclick="showEditProcModal('+idx+')">Modifier</button> '
            +'<button class="bd" style="font-size:10px;padding:2px 7px" onclick="archiveProc('+idx+')">Archiver</button>'
            +'</td>'
          :'<td><button class="bs" style="font-size:10px;padding:2px 7px" onclick="showProcRisksModal(\''+p.id+'\')">⚠ Risques'+refCountBadge+'</button></td>';
        h+='<tr>';
        h+='<td style="font-weight:500;font-size:12px;padding-left:18px">'+p.proc+'</td>';
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
  spUpsert('AF_Processes',p.id,{dom:p.dom,proc:p.proc,risk:p.risk,risk_level:val,archived:p.archived||false,risks_json:JSON.stringify(p.risks||[]),risk_refs_json:JSON.stringify(p.riskRefs||[]),Title:p.proc}).catch(console.warn);
  addHist('edit','Risque "'+p.proc+'" modifié → '+val);
  toast('Risque mis à jour ✓');
}

function archiveProc(idx){
  PROCESSES[idx].archived=true;
  var p=PROCESSES[idx];
  spUpsert('AF_Processes',p.id,{dom:p.dom,proc:p.proc,risk:p.risk,risk_level:p.riskLevel||'faible',archived:true,risks_json:JSON.stringify(p.risks||[]),risk_refs_json:JSON.stringify(p.riskRefs||[]),Title:p.proc}).catch(console.warn);
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
      spUpsert('AF_Processes',p.id,{dom:p.dom,proc:p.proc,risk:p.risk,risk_level:p.riskLevel,archived:p.archived||false,risks_json:JSON.stringify(p.risks||[]),risk_refs_json:JSON.stringify(p.riskRefs||[]),Title:p.proc}).catch(console.warn);
      addHist('edit','Process "'+p.proc+'" modifié');
      renderProcTable();
      toast('Mis à jour ✓');
    });
}

// ══════════════════════════════════════════════════════════════
//  GROUP STRUCTURE BY COUNTRY (ex Plan BU)
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
//  GROUP STRUCTURE (nouvelle version - Région > Pays > Sociétés)
//  Structure: [{id, region, country, companies:[{id, society, employees, productLineIds:[], domains}]}]
// ══════════════════════════════════════════════════════════════

var GROUP_STRUCTURE=[]; // nouvelle structure (array de pays)

V['plan-bu']=()=>`
  <div class="topbar">
    <div class="tbtitle">Group Structure</div>
    <div style="display:flex;gap:7px">
      <button class="bp ao" onclick="gsAddCountry()">+ Pays</button>
    </div>
  </div>
  <div class="content">
    <div id="gs-root"></div>
  </div>`;

I['plan-bu']=async function(){
  await gsLoad();
  gsRender();
};

// Charger depuis SharePoint
async function gsLoad(){
  try {
    if (typeof listItems !== 'function') {
      // Fallback sessionStorage (si MSAL/SharePoint indisponible)
      var stored=sessionStorage.getItem('af_group_structure_v2');
      GROUP_STRUCTURE = stored ? JSON.parse(stored) : [];
      return;
    }
    var items = await listItems('AF_Structure');
    GROUP_STRUCTURE = items.map(function(r){
      var f = r.fields;
      return {
        id: f.af_id,
        region: f.region || '',
        country: f.country || '',
        companies: tryParse(f.companies_json, []),
      };
    });
    console.log('[GS] Loaded', GROUP_STRUCTURE.length, 'countries');
  } catch(e){
    console.warn('[GS] load error (fallback sessionStorage):', e.message);
    try {
      var st=sessionStorage.getItem('af_group_structure_v2');
      GROUP_STRUCTURE = st ? JSON.parse(st) : [];
    } catch(e2){ GROUP_STRUCTURE = []; }
  }
}

// Sauvegarder un pays
async function gsSaveCountry(entry){
  // Toujours backup en sessionStorage
  try { sessionStorage.setItem('af_group_structure_v2', JSON.stringify(GROUP_STRUCTURE)); } catch(e){}
  try {
    await spUpsert('AF_Structure', entry.id, {
      region: entry.region || '',
      country: entry.country || '',
      companies_json: JSON.stringify(entry.companies||[]),
      Title: entry.country,
    });
  } catch(e){ console.warn('[GS] save error:', e.message); }
}

// Supprimer un pays
async function gsDeleteCountry(entryId){
  try { await spDelete('AF_Structure', entryId); } catch(e){ console.warn('[GS] delete:', e.message); }
  GROUP_STRUCTURE = GROUP_STRUCTURE.filter(function(e){return e.id!==entryId;});
  try { sessionStorage.setItem('af_group_structure_v2', JSON.stringify(GROUP_STRUCTURE)); } catch(e){}
}

// Rendu
function gsRender(){
  var root=document.getElementById('gs-root');
  if(!root)return;

  if(!GROUP_STRUCTURE.length){
    root.innerHTML='<div style="font-size:13px;color:var(--text-3);padding:1rem;text-align:center">Aucun pays défini. Cliquez sur "+ Pays" pour commencer.</div>';
    return;
  }

  // Grouper par région
  var byRegion = {};
  GROUP_STRUCTURE.forEach(function(entry){
    var reg = entry.region || '— Sans région —';
    if (!byRegion[reg]) byRegion[reg] = [];
    byRegion[reg].push(entry);
  });
  var regions = Object.keys(byRegion).sort(function(a,b){return a.localeCompare(b,'fr',{sensitivity:'base'});});

  var html = '';
  regions.forEach(function(region){
    var countries = byRegion[region].sort(function(a,b){
      return (a.country||'').localeCompare(b.country||'','fr',{sensitivity:'base'});
    });
    html += '<div style="margin-bottom:1.5rem">';
    html += '<div style="font-size:11px;font-weight:700;color:var(--purple-dk);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem;padding-bottom:4px;border-bottom:1px solid var(--border)">'+region+' ('+countries.length+' pays)</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px">';
    countries.forEach(function(entry){
      var companiesHtml = entry.companies && entry.companies.length
        ? entry.companies.map(function(co){
            var plNames = (co.productLineIds||[]).map(function(plId){
              var pl = (PRODUCT_LINES||[]).find(function(p){return p.id===plId;});
              return pl ? pl.name : plId;
            });
            var plHtml = plNames.length
              ? plNames.map(function(n){return '<span class="badge bpl" style="font-size:9px;padding:2px 6px">'+n+'</span>';}).join(' ')
              : '<span style="font-size:10px;color:var(--text-3);font-style:italic">Aucune PL</span>';
            var socColor = co.society === 'SBS' ? '#9FE1CB' : co.society === 'AXW' ? '#B5D4F4' : '#CECBF6';
            var socTxt = co.society === 'SBS' ? '#085041' : co.society === 'AXW' ? '#0C447C' : '#3C3489';
            return '<div style="background:var(--bg);border-radius:6px;padding:8px 10px;margin-bottom:6px">'
              + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">'
                + '<span class="badge" style="background:'+socColor+';color:'+socTxt+';font-weight:600;font-size:10px">'+(co.society||'?')+'</span>'
                + '<div style="display:flex;gap:4px">'
                  + (CU&&CU.role==='admin'?'<button class="bs" style="font-size:10px;padding:2px 6px" onclick="gsEditCompany(\''+entry.id+'\',\''+co.id+'\')">Éditer</button>':'')
                  + (CU&&CU.role==='admin'?'<button class="bd" style="font-size:10px;padding:2px 6px" onclick="gsRemoveCompany(\''+entry.id+'\',\''+co.id+'\')">×</button>':'')
                + '</div>'
              + '</div>'
              + '<div style="font-size:11px;color:var(--text-2);margin-bottom:3px"><strong>Salariés :</strong> '+(co.employees||'—')+'</div>'
              + '<div style="font-size:10px;margin-bottom:4px"><strong style="color:var(--text-2)">Product Lines :</strong> '+plHtml+'</div>'
              + (co.domains?'<div style="font-size:10px;color:var(--text-2)"><strong>Domaines :</strong> '+co.domains+'</div>':'')
              + '</div>';
          }).join('')
        : '<div style="font-size:11px;color:var(--text-3);text-align:center;padding:8px 0;font-style:italic">Aucune société</div>';

      html += '<div class="card" style="padding:12px 14px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:.5px solid var(--border)">'
          + '<div style="font-size:14px;font-weight:600">'+entry.country+'</div>'
          + '<div style="display:flex;gap:4px">'
            + (CU&&CU.role==='admin'?'<button class="bs" style="font-size:10px;padding:2px 6px" onclick="gsAddCompany(\''+entry.id+'\')">+ Société</button>':'')
            + (CU&&CU.role==='admin'?'<button class="bs" style="font-size:10px;padding:2px 6px" onclick="gsEditCountry(\''+entry.id+'\')">Éditer</button>':'')
            + (CU&&CU.role==='admin'?'<button class="bd" style="font-size:10px;padding:2px 6px" onclick="gsDeleteCountryAsk(\''+entry.id+'\')">×</button>':'')
          + '</div>'
        + '</div>'
        + companiesHtml
        + '</div>';
    });
    html += '</div></div>';
  });
  root.innerHTML = html;
}

// ── Actions CRUD ─────────────────────────────────────────────
function gsAddCountry(){
  var regionOpts = getKnownRegions().map(function(r){return '<option value="'+r+'">'+r+'</option>';}).join('');
  openModal('Ajouter un pays',
    '<div><label>Pays <span style="color:var(--red)">*</span></label><input id="gs-country" placeholder="ex : France, Maroc, Singapour..."/></div>'
    + '<div><label>Région <span style="color:var(--red)">*</span></label>'
    + '<select id="gs-region">'+regionOpts+'<option value="__new__">+ Nouvelle région...</option></select>'
    + '<input id="gs-region-new" placeholder="Nom de la nouvelle région" style="display:none;margin-top:5px"/>'
    + '</div>',
    async function(){
      var country=document.getElementById('gs-country').value.trim();
      if(!country){toast('Pays obligatoire');return;}
      var regEl = document.getElementById('gs-region');
      var regNewEl = document.getElementById('gs-region-new');
      var region = regEl.value;
      if (region === '__new__') {
        region = (regNewEl.value||'').trim();
        if (!region) { toast('Région obligatoire'); return; }
      }
      // Vérifier doublon
      if (GROUP_STRUCTURE.find(function(e){return (e.country||'').toLowerCase()===country.toLowerCase() && (e.region||'')===region;})) {
        toast('Ce pays/région existe déjà');
        return;
      }
      var id='cty_'+Date.now();
      var entry={id:id, region:region, country:country, companies:[]};
      GROUP_STRUCTURE.push(entry);
      await gsSaveCountry(entry);
      addHist('add','Pays "'+country+'" ('+region+') ajouté');
      gsRender();
      toast('Pays ajouté ✓');
    });
  // Listener pour le champ "nouvelle région"
  setTimeout(function(){
    var s=document.getElementById('gs-region');
    var inp=document.getElementById('gs-region-new');
    if (s && inp) s.addEventListener('change', function(){ inp.style.display = s.value==='__new__'?'block':'none'; });
  }, 50);
}

function gsEditCountry(entryId){
  var entry = GROUP_STRUCTURE.find(function(e){return e.id===entryId;});
  if (!entry) return;
  var regionOpts = getKnownRegions().map(function(r){return '<option value="'+r+'"'+(r===entry.region?' selected':'')+'>'+r+'</option>';}).join('');
  openModal('Éditer le pays',
    '<div><label>Pays <span style="color:var(--red)">*</span></label><input id="gs-country" value="'+(entry.country||'')+'"/></div>'
    + '<div><label>Région <span style="color:var(--red)">*</span></label>'
    + '<select id="gs-region">'+regionOpts+'<option value="__new__">+ Nouvelle région...</option></select>'
    + '<input id="gs-region-new" placeholder="Nom de la nouvelle région" style="display:none;margin-top:5px"/>'
    + '</div>',
    async function(){
      var country=document.getElementById('gs-country').value.trim();
      if(!country){toast('Pays obligatoire');return;}
      var regEl = document.getElementById('gs-region');
      var regNewEl = document.getElementById('gs-region-new');
      var region = regEl.value;
      if (region === '__new__') {
        region = (regNewEl.value||'').trim();
        if (!region) { toast('Région obligatoire'); return; }
      }
      entry.country = country;
      entry.region = region;
      await gsSaveCountry(entry);
      addHist('edit','Pays "'+country+'" modifié');
      gsRender();
      toast('Pays modifié ✓');
    });
  setTimeout(function(){
    var s=document.getElementById('gs-region');
    var inp=document.getElementById('gs-region-new');
    if (s && inp) s.addEventListener('change', function(){ inp.style.display = s.value==='__new__'?'block':'none'; });
  }, 50);
}

async function gsDeleteCountryAsk(entryId){
  var entry = GROUP_STRUCTURE.find(function(e){return e.id===entryId;});
  if (!entry) return;
  if(!confirm('Supprimer "'+entry.country+'" ('+entry.region+') et toutes ses sociétés ?'))return;
  await gsDeleteCountry(entryId);
  addHist('del','Pays "'+entry.country+'" supprimé');
  gsRender();
  toast('Pays supprimé ✓');
}

function gsAddCompany(entryId){
  gsCompanyModal(entryId, null);
}

function gsEditCompany(entryId, companyId){
  var entry = GROUP_STRUCTURE.find(function(e){return e.id===entryId;});
  if (!entry) return;
  var co = (entry.companies||[]).find(function(c){return c.id===companyId;});
  if (!co) return;
  gsCompanyModal(entryId, co);
}

function gsCompanyModal(entryId, existingCo) {
  var entry = GROUP_STRUCTURE.find(function(e){return e.id===entryId;});
  if (!entry) return;
  var currentPLs = (existingCo && existingCo.productLineIds) || [];

  // Liste des PL disponibles (filtrées par société si existante)
  var pls = PRODUCT_LINES || [];
  var plSection = '';
  if (pls.length) {
    plSection = '<div><label>Product Lines</label>'
      + '<div style="font-size:10px;color:var(--text-3);margin-bottom:5px">Cochez les PL présentes dans ce pays pour cette société</div>'
      + '<div class="cb-list" style="display:flex;flex-direction:column;gap:3px;max-height:180px;overflow-y:auto;border:.5px solid var(--border);border-radius:var(--radius);padding:8px 10px;background:var(--bg-card)">'
      + pls.map(function(pl){
          var checked = currentPLs.indexOf(pl.id)>=0 ? ' checked' : '';
          return '<label data-society="'+(pl.society||'')+'"><input type="checkbox" class="gs-pl-cb" value="'+pl.id+'"'+checked+'><span>'+pl.name+' <span style="color:var(--text-3);font-size:10px">('+(pl.society||'')+')</span></span></label>';
        }).join('')
      + '</div></div>';
  } else {
    plSection = '<div style="font-size:11px;color:var(--text-3);padding:8px;background:var(--bg);border-radius:6px">ℹ️ Aucune Product Line définie. Créez-en dans l\'onglet Product Lines pour pouvoir les associer ici.</div>';
  }

  var body = '<div><label>Société <span style="color:var(--red)">*</span></label>'
    + '<select id="gs-co-society">'
      + '<option value="SBS"'+(existingCo && existingCo.society==='SBS'?' selected':'')+'>SBS</option>'
      + '<option value="AXW"'+(existingCo && existingCo.society==='AXW'?' selected':'')+'>AXW</option>'
      + '<option value="Groupe"'+(existingCo && existingCo.society==='Groupe'?' selected':'')+'>Groupe</option>'
    + '</select></div>'
    + '<div><label>Nombre de salariés</label><input id="gs-co-emp" type="number" min="0" value="'+((existingCo && existingCo.employees)||'')+'" placeholder="ex : 150"/></div>'
    + plSection
    + '<div><label>Domaines couverts</label><textarea id="gs-co-domains" style="width:100%;min-height:50px" placeholder="ex : Distribution, Deployment, Support (texte libre)">'+((existingCo && existingCo.domains)||'')+'</textarea></div>';

  openModal(existingCo ? 'Éditer société' : 'Ajouter une société dans '+entry.country, body, async function(){
    var society = document.getElementById('gs-co-society').value;
    var employees = parseInt(document.getElementById('gs-co-emp').value) || 0;
    var domains = document.getElementById('gs-co-domains').value.trim();
    var plIds = [];
    document.querySelectorAll('.gs-pl-cb:checked').forEach(function(cb){ plIds.push(cb.value); });

    if (existingCo) {
      existingCo.society = society;
      existingCo.employees = employees;
      existingCo.productLineIds = plIds;
      existingCo.domains = domains;
    } else {
      var newCo = {
        id: 'co_'+Date.now(),
        society: society,
        employees: employees,
        productLineIds: plIds,
        domains: domains,
      };
      if (!entry.companies) entry.companies = [];
      entry.companies.push(newCo);
    }
    await gsSaveCountry(entry);
    addHist(existingCo?'edit':'add', 'Société '+society+' '+(existingCo?'modifiée':'ajoutée')+' ('+entry.country+')');
    gsRender();
    toast('Société '+(existingCo?'modifiée':'ajoutée')+' ✓');
  });
}

async function gsRemoveCompany(entryId, companyId){
  var entry = GROUP_STRUCTURE.find(function(e){return e.id===entryId;});
  if (!entry) return;
  var co = (entry.companies||[]).find(function(c){return c.id===companyId;});
  if (!co) return;
  if (!confirm('Supprimer la société '+co.society+' de '+entry.country+' ?')) return;
  entry.companies = entry.companies.filter(function(c){return c.id!==companyId;});
  await gsSaveCountry(entry);
  addHist('del', 'Société '+co.society+' retirée de '+entry.country);
  gsRender();
  toast('Société supprimée ✓');
}

// Helpers
function getKnownRegions(){
  var regs = [...new Set(GROUP_STRUCTURE.map(function(e){return e.region;}).filter(Boolean))];
  // Ajouter les régions standards si absentes
  var std = ['Europe', 'AMEE', 'APAC', 'North America', 'Latin America'];
  std.forEach(function(r){ if (regs.indexOf(r)<0) regs.push(r); });
  return regs.sort(function(a,b){return a.localeCompare(b,'fr',{sensitivity:'base'});});
}

// Fournir la liste plate des pays pour les autres vues (ex: formulaire audit BU)
function getAllCountriesFromGS(){
  var set = new Set();
  GROUP_STRUCTURE.forEach(function(e){ if (e.country) set.add(e.country); });
  return Array.from(set).sort(function(a,b){return a.localeCompare(b,'fr',{sensitivity:'base'});});
}

// Trouver la région d'un pays
function getRegionForCountry(country){
  var e = GROUP_STRUCTURE.find(function(entry){return (entry.country||'').toLowerCase()===(country||'').toLowerCase();});
  return e ? e.region : '';
}

// ══════════════════════════════════════════════════════════════
//  PLAN AUDIT (inchangé)
// ══════════════════════════════════════════════════════════════
V['plan-audit']=()=>`
  <div class="topbar"><div class="tbtitle">Plan Audit</div><button class="bp ao" onclick="showAddAuditModal()">+ Ajouter une mission</button></div>
  <div class="content">
    <div style="display:flex;gap:8px;margin-bottom:1rem">
      <select id="f-pa-type" onchange="renderPlanAuditTable()">
        <option value="all">Toutes missions</option>
        <option value="Process">Process Audit</option>
        <option value="BU">BU Audit</option>
        <option value="Other">Autres missions</option>
      </select>
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
    // Tri principal : année (du plus ancien au plus récent)
    var ya = parseInt(a.annee) || 9999;
    var yb = parseInt(b.annee) || 9999;
    if (ya !== yb) return ya - yb;
    // Tri secondaire : mois de début
    var sa = a.dateDebut ? parseInt(a.dateDebut) : 99;
    var sb = b.dateDebut ? parseInt(b.dateDebut) : 99;
    return sa - sb;
  });
  var h='<thead><tr><th>Type</th><th>Titre</th><th>Detail</th><th style="width:140px">Année / Mois</th><th>Auditeurs</th><th>Statut</th>'+(CU&&CU.role==='admin'?'<th>Actions</th>':'')+'</tr></thead><tbody>';
  if(!rows.length){
    h+='<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:1.5rem">Aucun audit planifié.</td></tr>';
  } else {
    rows.forEach(function(ap){
      var idx=AUDIT_PLAN.indexOf(ap);
      var detail;
      var typeBadgeHtml;
      if (ap.type==='Process') {
        // Support multi-processus
        var pids = (Array.isArray(ap.processIds) && ap.processIds.length)
          ? ap.processIds
          : (ap.processId ? [ap.processId] : []);
        if (pids.length > 1) {
          var procNames = pids.map(function(pid){
            var p = PROCESSES.find(function(x){return x.id===pid;});
            return p ? p.proc : pid;
          });
          detail = '<span style="font-size:11px"><strong>'+(ap.domaine||'Multi')+'</strong> › <span style="color:var(--purple-dk)">'+pids.length+' processus</span><div style="font-size:10px;color:var(--text-3);margin-top:2px">'+procNames.join(' · ')+'</div></span>';
        } else {
          detail = '<span style="font-size:11px"><strong>'+(ap.domaine||'')+'</strong> › '+(ap.process||'')+'</span>';
        }
        typeBadgeHtml = '<span class="badge bpc">Process</span>';
      } else if (ap.type==='Other') {
        // Mission "Other" : catégorie + description
        var cat = ap.categorie || 'Autre';
        var colors = getOtherCategoryColors(cat);
        var desc = ap.description
          ? '<div style="font-size:10px;color:var(--text-3);margin-top:2px;font-style:italic">'+ap.description+'</div>'
          : '';
        detail = '<span style="font-size:11px"><strong style="color:'+colors.color+'">'+cat+'</strong>'+desc+'</span>';
        typeBadgeHtml = '<span class="badge" style="background:'+colors.bg+';color:'+colors.color+'">Autre</span>';
      } else {
        detail = '<span style="font-size:11px"><strong>'+(ap.region||'')+'</strong> · '+(ap.pays||[]).join(', ')+'</span>';
        typeBadgeHtml = '<span class="badge bbu">BU</span>';
      }
      var avs=(ap.auditeurs||[]).map(function(id){return avEl(id,20);}).join('');
      var mns=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
      var dateStr=ap.dateDebut||ap.dateFin
        ?'<div style="font-size:10px;color:#888">'+((ap.dateDebut?mns[parseInt(ap.dateDebut)-1]:'?')+' → '+(ap.dateFin?mns[parseInt(ap.dateFin)-1]:'?'))+'</div>':'';
      var adminBtn=CU&&CU.role==='admin'
        ?'<td style="white-space:nowrap" ondblclick="event.stopPropagation()"><button class="bs" style="font-size:10px;padding:2px 7px" onclick="showEditAuditModal('+idx+')">Modifier</button> <button class="bd" style="font-size:10px;padding:2px 7px" onclick="deleteAudit('+idx+')">Supprimer</button></td>':'';
      h+='<tr ondblclick="openAudit(\''+ap.id+'\')" style="cursor:pointer" title="Double-cliquer pour ouvrir l\'audit">'
        +'<td>'+typeBadgeHtml+'</td>'
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

  // Liste des processus en GRILLE (1 colonne par domaine, processus en dessous)
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
      return '<div class="m-dom-col">'
        + '<div class="m-dom-title">'+dom+'</div>'
        + '<div class="m-dom-procs">'+items+'</div>'
        + '</div>';
    }).join('');
  } else {
    procListHtml = '<div style="font-size:11px;color:var(--text-3);padding:.5rem">Aucun processus défini. Créez-en d\'abord dans Audit Universe.</div>';
  }

  // Liste des Product Lines actuellement scopées sur cet audit
  var currentPLs = (ap && Array.isArray(ap.productLineIds)) ? ap.productLineIds : [];
  var hasPLScope = currentPLs.length > 0 || (ap && ap.plScopeEnabled);

  // Section Product Lines (en grille SBS / AXW)
  var plListHtml = '';
  if (PRODUCT_LINES && PRODUCT_LINES.length) {
    var plBySoc = { SBS: [], AXW: [] };
    PRODUCT_LINES.forEach(function(pl){
      if (pl.society === 'SBS') plBySoc.SBS.push(pl);
      else if (pl.society === 'AXW') plBySoc.AXW.push(pl);
    });
    ['SBS','AXW'].forEach(function(soc){
      var list = plBySoc[soc].sort(function(a,b){return (a.name||'').localeCompare(b.name||'','fr',{sensitivity:'base'});});
      if (!list.length) return;
      var items = list.map(function(pl){
        var checked = currentPLs.indexOf(pl.id)>=0 ? ' checked' : '';
        return '<label>'
          + '<input type="checkbox" class="m-pl-cb" value="'+pl.id+'"'+checked+'>'
          + '<span>'+pl.name+'</span>'
          + '</label>';
      }).join('');
      plListHtml += '<div class="m-dom-col">'
        + '<div class="m-dom-title" style="color:'+(soc==='SBS'?'#085041':'#0C447C')+'">'+soc+'</div>'
        + '<div class="m-dom-procs">'+items+'</div>'
        + '</div>';
    });
    if (!plListHtml) plListHtml = '<div style="font-size:11px;color:var(--text-3);padding:.5rem">Aucune Product Line définie.</div>';
  } else {
    plListHtml = '<div style="font-size:11px;color:var(--text-3);padding:.5rem">Aucune Product Line définie. Créez-en dans l\'onglet Product Lines.</div>';
  }

  var h='';
  h+='<div><label>Type de mission</label><select id="m-type" onchange="toggleAuditTypeFields(this.value)"><option value="Process"'+(type==='Process'?' selected':'')+'>Process Audit</option><option value="BU"'+(type==='BU'?' selected':'')+'>BU Audit</option><option value="Other"'+(type==='Other'?' selected':'')+'>Autre mission</option></select></div>';

  // Fields PROCESS — process en grille + Product Lines (scope)
  h+='<div id="m-proc-fields" style="'+(type!=='Process'?'display:none':'')+'">';
  h+='<div><label>Processus couverts <span style="color:var(--red)">*</span></label>';
  h+='<div style="font-size:10px;color:var(--text-3);margin-bottom:5px">Cochez un ou plusieurs processus (multi-domaines autorisés)</div>';
  h+='<div id="m-proc-list" class="m-proc-grid">'
    + procListHtml
    + '</div>';
  h+='<div id="m-proc-count" style="font-size:11px;color:var(--purple);margin-top:5px;font-weight:500"></div>';
  h+='</div>';
  // Section Product Lines (radio Oui/Non)
  h+='<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border)">';
  h+='<label>Product Lines scopées</label>';
  h+='<div style="font-size:10px;color:var(--text-3);margin-bottom:5px">Si l\'audit ne couvre qu\'une partie des Product Lines, indiquez lesquelles</div>';
  h+='<div style="display:flex;gap:14px;margin-bottom:8px">';
  h+='<label style="display:inline-flex !important;flex-direction:row !important;align-items:center !important;gap:5px !important;width:auto !important;padding:0 !important"><input type="radio" name="m-pl-scope" value="no" style="width:auto !important"'+(!hasPLScope?' checked':'')+'> Non</label>';
  h+='<label style="display:inline-flex !important;flex-direction:row !important;align-items:center !important;gap:5px !important;width:auto !important;padding:0 !important"><input type="radio" name="m-pl-scope" value="yes" style="width:auto !important"'+(hasPLScope?' checked':'')+'> Oui</label>';
  h+='</div>';
  h+='<div id="m-pl-list-wrapper" style="'+(!hasPLScope?'display:none':'')+'">';
  h+='<div id="m-pl-list" class="m-proc-grid" style="grid-template-columns:repeat(2,1fr)">'+plListHtml+'</div>';
  h+='</div>';
  h+='</div>';
  h+='</div>';

  h+='<div id="m-bu-fields" style="'+(type!=='BU'?'display:none':'')+'">';
  h+='<div><label>Région</label><select id="m-reg">';
  var allRegs = (typeof getKnownRegions === 'function') ? getKnownRegions() : [];
  if (!allRegs.length) allRegs = ['Europe','AMEE','North America','APAC'];
  allRegs.forEach(function(r){h+='<option'+(ap&&ap.region===r?' selected':'')+'>'+r+'</option>';});
  h+='</select></div>';
  h+='<div><label>Pays (séparés par des virgules)</label><input id="m-pays" placeholder="ex : Maroc, Tunisie" value="'+((ap&&ap.pays||[]).join(', '))+'"/></div></div>';

  // Bloc "Other mission" (Sapin 2, URD, Comité...)
  var cats = getAllOtherCategories();
  var currentCat = (ap && ap.categorie) || '';
  var catOpts = cats.map(function(c){
    return '<option value="'+c+'"'+(currentCat===c?' selected':'')+'>'+c+'</option>';
  }).join('');
  h+='<div id="m-other-fields" style="'+(type!=='Other'?'display:none':'')+'">';
  h+='<div><label>Catégorie <span style="color:var(--red)">*</span></label>';
  h+='<div style="display:flex;gap:6px">';
  h+='<select id="m-other-cat" style="flex:1">'+catOpts+'<option value="__new__">+ Nouvelle catégorie...</option></select>';
  h+='</div>';
  h+='<input id="m-other-cat-new" placeholder="Nom de la nouvelle catégorie" style="display:none;margin-top:5px"/>';
  h+='</div>';
  h+='<div><label>Description</label><textarea id="m-other-desc" style="width:100%;min-height:60px;resize:vertical" placeholder="Description de la mission (facultatif)">'+((ap&&ap.description)||'')+'</textarea></div>';
  h+='</div>';

  h+='<div><label>Titre de la mission</label><input id="m-titre" placeholder="ex : BU Maroc 2025" value="'+((ap&&ap.titre)||'')+'"/></div>';
  h+='<div class="g2"><div><label>Année</label><select id="m-annee">';
  var YEARS_LIST = [];
  for (var yr = 2020; yr <= 2035; yr++) YEARS_LIST.push(yr);
  YEARS_LIST.forEach(function(y){h+='<option'+(ap&&ap.annee===y?' selected':'')+'>'+y+'</option>';});
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
  var procEl = document.getElementById('m-proc-fields');
  var buEl = document.getElementById('m-bu-fields');
  var otherEl = document.getElementById('m-other-fields');
  if (procEl) procEl.style.display = val==='Process' ? '' : 'none';
  if (buEl) buEl.style.display = val==='BU' ? '' : 'none';
  if (otherEl) otherEl.style.display = val==='Other' ? '' : 'none';
  // Adapter le statut : si Other, proposer "Fait" au lieu de "Clôturé"
  var statutEl = document.getElementById('m-statut');
  if (statutEl) {
    var current = statutEl.value;
    if (val==='Other') {
      statutEl.innerHTML = '<option value="Planifié"'+(current==='Planifié'?' selected':'')+'>Planifié</option>'
        + '<option value="En cours"'+(current==='En cours'?' selected':'')+'>En cours</option>'
        + '<option value="Fait"'+(current==='Fait'||current==='Clôturé'?' selected':'')+'>Fait</option>';
    } else {
      statutEl.innerHTML = '<option value="Planifié"'+(current==='Planifié'?' selected':'')+'>Planifié</option>'
        + '<option value="En cours"'+(current==='En cours'?' selected':'')+'>En cours</option>'
        + '<option value="Clôturé"'+(current==='Clôturé'||current==='Fait'?' selected':'')+'>Clôturé</option>';
    }
  }
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

    // Collecter les Product Lines scopées (si radio Oui)
    var plScopeRadio = document.querySelector('input[name="m-pl-scope"]:checked');
    var plScopeYes = plScopeRadio && plScopeRadio.value === 'yes';
    var productLineIds = [];
    if (plScopeYes) {
      var plCbs = document.querySelectorAll('.m-pl-cb:checked');
      productLineIds = Array.from(plCbs).map(function(cb){return cb.value;});
    }

    return Object.assign({}, base, {
      domaine: domaine,
      process: procNames,
      processId: processIds[0],        // compat ancien champ (premier process)
      processIds: processIds,          // nouveau tableau complet
      productLineIds: productLineIds,  // NOUVEAU — Product Lines scopées
      plScopeEnabled: plScopeYes,      // NOUVEAU — flag (utile si 0 PL coché mais radio Oui)
    });
  } else if (type==='Other') {
    // Collecter catégorie et description
    var catEl = document.getElementById('m-other-cat');
    var catNewEl = document.getElementById('m-other-cat-new');
    var descEl = document.getElementById('m-other-desc');
    var categorie = '';
    if (catEl && catEl.value === '__new__') {
      // Nouvelle catégorie saisie
      categorie = (catNewEl && catNewEl.value || '').trim();
      if (!categorie) { toast('Nom de la nouvelle catégorie requis'); return null; }
    } else {
      categorie = catEl ? catEl.value : '';
    }
    if (!categorie) { toast('Catégorie obligatoire'); return null; }
    var description = descEl ? descEl.value.trim() : '';
    return Object.assign({}, base, {
      categorie: categorie,
      description: description,
    });
  } else {
    return Object.assign({},base,{region:document.getElementById('m-reg').value,pays:document.getElementById('m-pays').value.split(',').map(function(s){return s.trim();}).filter(Boolean)});
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
  }, {wide:true});
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
  }, {wide:true});
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
    updateProcCount();

    // Listener pour le select de catégorie (Other missions)
    var catSelect = document.getElementById('m-other-cat');
    var catNewInput = document.getElementById('m-other-cat-new');
    if (catSelect && catNewInput) {
      catSelect.addEventListener('change', function(){
        if (catSelect.value === '__new__') {
          catNewInput.style.display = 'block';
          catNewInput.focus();
        } else {
          catNewInput.style.display = 'none';
        }
      });
    }

    // Listener pour le radio Product Lines scopées Oui/Non
    var plRadios = document.querySelectorAll('input[name="m-pl-scope"]');
    var plWrapper = document.getElementById('m-pl-list-wrapper');
    plRadios.forEach(function(r){
      r.addEventListener('change', function(){
        if (plWrapper) plWrapper.style.display = (r.checked && r.value==='yes') ? 'block' : (r.value==='no' && r.checked ? 'none' : plWrapper.style.display);
      });
    });
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

  var h='<thead><tr><th style="width:200px">Domaine / Processus</th><th>Risque</th><th>Couverture</th><th>2025</th><th>2026</th><th>2027</th><th>2028</th></tr></thead><tbody>';
  doms.forEach(function(dom){
    var rows=PROCESSES.filter(function(p){return p.dom===dom&&!p.archived;});
    if(!rows.length)return;
    rows.sort(function(a,b){
      return (a.proc||'').localeCompare(b.proc||'', 'fr', {sensitivity:'base'});
    });
    h+='<tr class="sr"><td colspan="7" style="background:#EEEDFE;color:#3C3489;font-weight:600;font-size:12px;padding:8px 12px;white-space:nowrap">'+dom+'</td></tr>';
    rows.forEach(function(p){
      var yc=function(y){
        // Trouver tous les audits de l'année qui couvrent ce processus
        var matches = procAudits.filter(function(a){
          return a.annee===y && getApProcIds(a).indexOf(p.id) >= 0;
        });
        if (!matches.length) return '<span style="color:var(--text-3)">—</span>';
        return matches.map(function(m){
          return '<div ondblclick="openAudit(\''+m.id+'\')" style="display:flex;flex-direction:column;gap:2px;margin-bottom:2px;cursor:pointer;padding:2px 4px;border-radius:3px" title="Double-cliquer pour ouvrir l\'audit" onmouseover="this.style.background=\'var(--purple-lt)\'" onmouseout="this.style.background=\'\'">'
            + '<span style="font-size:10px;font-weight:500;color:var(--purple-dk)">'+m.titre+'</span>'
            + '<div style="display:flex;gap:3px">'+((m.auditeurs||[]).map(function(id){return avEl(id,16);}).join(''))+'</div>'
            + '</div>';
        }).join('');
      };
      var covered=auditedIds.has(p.id);
      var covBadge=covered
        ?'<span class="badge bdn" style="font-size:10px;">✓ Audité</span>'
        :'<span class="badge bpl" style="font-size:10px;">Non audité</span>';
      var effLvl = (p.riskRefs && p.riskRefs.length)
        ? computeProcRiskLevelFromRefs(p.riskRefs)
        : (p.riskLevel||'faible');
      h+='<tr>'
        +'<td style="font-weight:500;font-size:11px;padding-left:18px">'+p.proc+'</td>'
        +'<td>'+riskLabel(effLvl)+'</td>'
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
    <div id="bu-banner-zone"></div>
    <div class="tw"><table id="bu-tbl"></table></div>
  </div>`;
I['plans-bu']=()=>{
  // Réinitialiser le filtre pays au chargement de la vue
  window._buCountryFilter = null;
  // Le filtre "entité" n'est plus pertinent avec la nouvelle structure pays-société
  // (les entités peuvent être SBS et AXW dans le même pays). On le laisse vide ou avec valeur "all" uniquement.
  var sel=document.getElementById('f-bu-ent');
  if(sel) sel.innerHTML='<option value="all">Toutes entités</option>';
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

  // Construire la table inverse ISO A2 → nom de pays français (premier match)
  // À partir de la table nameToIso (utilisée plus haut)
  var nameToIsoMap={
    'maroc':'MA','tunisie':'TN','algérie':'DZ','cameroun':'CM','liban':'LB',
    'royaume-uni':'GB','france':'FR','allemagne':'DE','roumanie':'RO','bulgarie':'BG',
    'espagne':'ES','italie':'IT','états-unis':'US','inde':'IN','australie':'AU',
    'singapour':'SG','émirats arabes unis':'AE','arabie saoudite':'SA','chine':'CN',
    'japon':'JP','brésil':'BR','nigéria':'NG','afrique du sud':'ZA','kenya':'KE',
    'sénégal':'SN','belgique':'BE','pays-bas':'NL','pologne':'PL','turquie':'TR',
    'égypte':'EG','mexique':'MX','argentine':'AR','colombie':'CO',"côte d'ivoire":'CI',
  };
  var isoToName={};
  Object.keys(nameToIsoMap).forEach(function(name){
    var iso = nameToIsoMap[name];
    if (!isoToName[iso]) isoToName[iso] = name.charAt(0).toUpperCase()+name.slice(1);
  });

  // Helper : retourner la liste des pays effectivement audités (passés ou futurs)
  function isoHasAudit(iso) {
    var buAudits = AUDIT_PLAN.filter(function(a){return a.type==='BU';});
    return buAudits.some(function(a){
      return (a.pays||[]).some(function(p){
        var key = (p||'').toLowerCase().trim();
        return nameToIsoMap[key] === iso;
      });
    });
  }

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
    .style('cursor', function(d){
      var iso=_isoNumToA2[parseInt(d.id)]||'';
      return isoHasAudit(iso) ? 'pointer' : 'default';
    })
    .on('dblclick', function(event, d){
      var iso=_isoNumToA2[parseInt(d.id)]||'';
      if (!isoHasAudit(iso)) return;
      var name = isoToName[iso] || iso;
      // Capitalize correctement le nom (gérer "Côte d'Ivoire", etc.)
      window._buCountryFilter = name;
      renderBUTable();
      // Scroller vers la table
      setTimeout(function(){
        var t = document.getElementById('bu-tbl');
        if (t) t.scrollIntoView({behavior:'smooth', block:'start'});
      }, 60);
    })
    .append('title')
    .text(function(d){
      var iso=_isoNumToA2[parseInt(d.id)]||'';
      var name = isoToName[iso] || iso;
      var hasAudit = isoHasAudit(iso);
      return hasAudit ? (name + ' — Double-cliquez pour voir les audits') : name;
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
  var countryFilter = window._buCountryFilter || null;

  // Toutes les BU (toutes années si filtre pays actif, pour montrer historique + futur)
  var rows = AUDIT_PLAN.filter(function(a){
    if (a.type !== 'BU') return false;
    if (fe !== 'all' && a.entite !== fe) return false;
    if (countryFilter) {
      // Si filtre par pays : on ignore le filtre année et on prend toutes les BU touchant ce pays
      var paysMatch = (a.pays||[]).some(function(p){
        return (p||'').toLowerCase().trim() === countryFilter.toLowerCase().trim();
      });
      return paysMatch;
    } else {
      if (fy !== 'all' && String(a.annee) !== fy) return false;
      return true;
    }
  });

  // Bandeau si filtre pays actif
  var bannerHtml = '';
  if (countryFilter) {
    bannerHtml = '<div style="background:var(--purple-lt);border-left:3px solid var(--purple);padding:8px 12px;margin-bottom:.75rem;border-radius:6px;display:flex;align-items:center;justify-content:space-between;font-size:12px">'
      + '<div><strong>Audits du pays : '+countryFilter+'</strong> ('+rows.length+' audit'+(rows.length>1?'s':'')+' — toutes années)</div>'
      + '<button class="bs" style="font-size:11px;padding:3px 10px" onclick="clearBUCountryFilter()">× Effacer le filtre</button>'
      + '</div>';
  }

  // Trier par année (les plus récents en premier) si filtre pays actif
  if (countryFilter) {
    rows.sort(function(a,b){return (b.annee||0)-(a.annee||0);});
  }

  var regs=[...new Set(rows.map(function(b){return b.region;}))];
  var h='<thead><tr><th>Entité</th><th>Région</th><th>Pays</th><th>Titre mission</th><th>Année</th><th>Auditeurs</th><th>Statut</th></tr></thead><tbody>';
  if(!rows.length){
    h+='<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:1.5rem">'
      +(countryFilter?'Aucun audit pour '+countryFilter+'.':'Aucune BU planifiée.')
      +'</td></tr>';
  } else if (countryFilter) {
    // Si filtre pays : pas de regroupement par région (on est déjà dans un seul pays)
    rows.forEach(function(b){
      var avs=(b.auditeurs||[]).map(function(id){return avEl(id,20);}).join('');
      h+='<tr style="cursor:pointer" ondblclick="openAudit(\''+b.id+'\')" title="Double-cliquer pour ouvrir l\'audit">'
        +'<td><span class="badge bsbs">'+(b.entite||'')+'</span></td>'
        +'<td style="color:var(--text-2);font-size:11px">'+(b.region||'')+'</td>'
        +'<td style="font-weight:500;font-size:11px">'+((b.pays||[]).join(', '))+'</td>'
        +'<td style="font-size:11px">'+b.titre+'</td>'
        +'<td style="font-weight:500;color:var(--purple-dk)">'+b.annee+'</td>'
        +'<td><div style="display:flex;gap:3px">'+(avs||'<span style="font-size:10px;color:var(--text-3)">—</span>')+'</div></td>'
        +'<td>'+badge(b.statut||'Planifié')+'</td>'
        +'</tr>';
    });
  } else {
    regs.forEach(function(reg){
      h+='<tr class="sr"><td colspan="7">'+reg+'</td></tr>';
      rows.filter(function(b){return b.region===reg;}).forEach(function(b){
        var avs=(b.auditeurs||[]).map(function(id){return avEl(id,20);}).join('');
        h+='<tr style="cursor:pointer" ondblclick="openAudit(\''+b.id+'\')" title="Double-cliquer pour ouvrir l\'audit">'
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

  document.getElementById('bu-tbl').innerHTML = h + '</tbody>';
  var banner = document.getElementById('bu-banner-zone');
  if (banner) banner.innerHTML = bannerHtml;
}

function clearBUCountryFilter() {
  window._buCountryFilter = null;
  renderBUTable();
}

// ══════════════════════════════════════════════════════════════
//  PLANIFICATION (Gantt — inchangé)
// ══════════════════════════════════════════════════════════════
V['planification']=()=>`
  <div class="topbar">
    <div class="tbtitle">Planification</div>
    ${CU&&CU.role==='admin'?'<button class="bp ao" onclick="showAddAuditFromPlanif()">+ Créer un audit</button>':''}
  </div>
  <div class="content">
    <div style="display:flex;gap:8px;margin-bottom:1rem;align-items:center">
      <select id="f-pl" onchange="renderGantt()">
        <option value="all">Toutes missions</option>
        <option value="Process">Process</option>
        <option value="BU">BU</option>
        <option value="Other">Autres</option>
      </select>
      <button class="bs" onclick="shiftYear(-1)" title="Année précédente" style="font-size:14px;padding:4px 10px;line-height:1">◀</button>
      <select id="f-pyr" onchange="renderGantt()"><option value="all">Toutes années</option><option value="2025" selected>2025</option><option value="2026">2026</option><option value="2027">2027</option><option value="2028">2028</option></select>
      <button class="bs" onclick="shiftYear(1)" title="Année suivante" style="font-size:14px;padding:4px 10px;line-height:1">▶</button>
      <div style="display:flex;gap:14px;align-items:center;margin-left:18px;font-size:11px;color:var(--text-2)">
        <span style="display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:14px;height:10px;background:#93C5FD;border-radius:2px"></span>Process</span>
        <span style="display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:14px;height:10px;background:#86EFAC;border-radius:2px"></span>BU</span>
        <span style="display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:14px;height:10px;background:#FDBA74;border-radius:2px"></span>Autres</span>
      </div>
      ${CU&&CU.role==='admin'?'<span style="font-size:10px;color:var(--text-3);font-style:italic;margin-left:auto">💡 Double-cliquez sur un audit pour le modifier</span>':''}
    </div>
    <div class="gw" id="gantt-wrap"></div>
  </div>`;
I['planification']=()=>renderGantt();

// ── Navigation année précédente / suivante ─────────────────────────────
function shiftYear(delta) {
  var sel = document.getElementById('f-pyr');
  if (!sel) return;
  var cur = sel.value;
  // Si "all" → on prend l'année courante comme point de départ
  var year = (cur === 'all') ? new Date().getFullYear() : parseInt(cur, 10);
  if (isNaN(year)) year = new Date().getFullYear();
  var newYear = year + delta;
  // Vérifier que l'option existe
  var opt = sel.querySelector('option[value="'+newYear+'"]');
  if (!opt) {
    if (typeof toast === 'function') toast('Pas d\'option pour ' + newYear);
    return;
  }
  sel.value = String(newYear);
  renderGantt();
}

// ── Création d'un audit depuis Planification (réutilise la modale Plan Audit, pré-remplit l'année) ──
function showAddAuditFromPlanif(){
  // Lire l'année du filtre courant
  var fy = document.getElementById('f-pyr');
  var prefilledYear = null;
  if (fy && fy.value && fy.value !== 'all') {
    prefilledYear = parseInt(fy.value);
  }
  // Si "all", utiliser l'année courante
  if (!prefilledYear) prefilledYear = new Date().getFullYear();

  // Construire un audit "stub" avec uniquement l'année pré-remplie
  // pour que auditModalBody pré-sélectionne le bon <option>
  var stub = {annee: prefilledYear};
  openModal('Nouvel audit', auditModalBody(stub), async function(){
    var data = collectAuditModal();
    if (!data) return;
    var newAp = Object.assign({id:'ap'+Date.now()}, data);
    AUDIT_PLAN.push(newAp);
    await saveAuditPlan(newAp);
    addHist('add','Audit "'+data.titre+'" ajouté au plan');
    // Refresh du Gantt
    renderGantt();
    toast('Audit créé ✓');
  }, {wide:true});
  attachProcCheckboxListeners();
}

function renderGantt(){
  var ft=document.getElementById('f-pl')&&document.getElementById('f-pl').value||'all';
  var fy=document.getElementById('f-pyr')&&document.getElementById('f-pyr').value||'all';
  var rows=AUDIT_PLAN.filter(function(a){return(ft==='all'||a.type===ft)&&(fy==='all'||String(a.annee)===fy);});
  rows=rows.slice().sort(function(a,b){return (a.dateDebut?parseInt(a.dateDebut):99)-(b.dateDebut?parseInt(b.dateDebut):99);});
  var curMonth=new Date().getMonth();
  var months=MO.map(function(m,mi){return'<div class="gc'+(mi===curMonth?' today-col':'')+'" style="font-size:11px;text-align:center;padding:4px 0;'+(mi===curMonth?'background:rgba(83,74,183,0.08);font-weight:600':'')+'">'+ m+'</div>';}).join('');
  var hdr='<div class="gr gw" style="border-bottom:.5px solid var(--border)"><div class="gc" style="text-align:left;padding-left:8px;font-size:11px;font-weight:500">Audit</div>'+months+'</div>';
  var isAdmin = CU && CU.role==='admin';
  var body=rows.map(function(a){
    var realIdx = AUDIT_PLAN.indexOf(a);
    var start=a.dateDebut?parseInt(a.dateDebut)-1:-1;
    var end=a.dateFin?parseInt(a.dateFin)-1:-1;
    var hasDate=start>=0&&end>=0;
    // Couleur de la barre selon le TYPE d'audit (3 couleurs strictes)
    // Process: bleu clair, BU: vert clair, Autres: orange clair
    var barColor;
    if (a.type==='Process') {
      barColor = '#93C5FD';
    } else if (a.type==='BU') {
      barColor = '#86EFAC';
    } else {
      barColor = '#FDBA74';
    }
    var cells=MO.map(function(_,m){
      var isToday=m===curMonth;
      var inRange=hasDate&&m>=start&&m<=end;
      var isFirst=hasDate&&m===start;
      var isLast=hasDate&&m===end;
      var bar='';
      if(inRange){
        var radius=isFirst&&isLast?'4px':isFirst?'4px 0 0 4px':isLast?'0 4px 4px 0':'0';
        bar='<div class="gb" style="background:'+barColor+';border-radius:'+radius+';height:22px;margin:2px 1px;display:flex;align-items:center;justify-content:center">'+(isFirst?'<span style="font-size:9px;color:rgba(0,0,0,0.5);padding-left:4px">'+MO[start]+'</span>':'')+'</div>';
      }
      return'<div class="gm'+(isToday?' td':'')+'" style="'+(isToday?'background:rgba(83,74,183,0.05)':'')+'">'+bar+'</div>';
    }).join('');
    var bdg = a.type==='Process'?'bpc':(a.type==='BU'?'bbu':'bpl');
    var label = a.type==='Process'?'P':(a.type==='BU'?'BU':'A');
    var title=a.titre.length>22?a.titre.slice(0,21)+'…':a.titre;
    var noDate=!hasDate?'<span style="font-size:9px;color:#bbb;margin-left:4px">dates non définies</span>':'';
    var dblClickAttr = isAdmin ? ' ondblclick="showEditAuditModal('+realIdx+')" style="cursor:pointer" title="Double-cliquez pour modifier"' : '';
    return'<div class="gr ga-row" data-audit-idx="'+realIdx+'"'+dblClickAttr+' style="border-bottom:.5px solid var(--border)"><div class="gn2" style="display:flex;align-items:center;gap:5px"><span class="badge '+bdg+'" style="font-size:9px;padding:1px 5px;flex-shrink:0">'+label+'</span><span style="font-size:11px">'+title+'</span>'+noDate+'</div>'+cells+'</div>';
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
//  RISK UNIVERSE : hiérarchie des risques Groupe / Opérationnels
// ══════════════════════════════════════════════════════════════

V['risk-assessment']=()=>`
  <div class="topbar">
    <div class="tbtitle">Risk Assessment Methodology</div>
    <div style="display:flex;gap:7px">
      <button class="bs" onclick="raResetDefaults()" style="font-size:11px">↺ Restaurer les valeurs par défaut</button>
      <button class="bp" onclick="raSave()">Sauvegarder</button>
    </div>
  </div>
  <div class="content">
    <div id="ra-root"></div>
  </div>`;

I['risk-assessment']=function(){
  raRender();
};

// ─── Risk Assessment : valeurs par défaut ───────────────────────────
const RA_DEFAULT = {
  intro: "Risks are assessed based on their inherent impact and likelihood of occurrence. This evaluation is theoretical and performed prior to considering the control environment in place within the Group.",
  impacts: ['Minor', 'Limited', 'Major', 'Severe'],
  rows: [
    {
      label: 'Financial',
      cells: [
        'Revenue < €7M or <1%\nROA < €1M or <1%',
        'Revenue €7–14M or 1–2%\nROA €1M-2M or 1–2%',
        'Revenue €14–70M or 2–10%\nROA €2M-10M or 2–10%',
        'Revenue > €70M or >10%\nROA > €10M or >10%',
      ],
    },
    {
      label: 'Legal',
      cells: [
        'Minor breach without legal implications\nNo fine\nEasy to resolve',
        'Breach with limited consequences\nProbable fine < €200K',
        'Major breach\nProbable fine between €200K and €2M\nPublic disclosure\nCustomer compensation',
        'Serious breach\nFine > €2M\nPublic disclosure\nCustomer compensation ≥ €2M\nBusiness cessation',
      ],
    },
    {
      label: 'Reputation',
      cells: [
        'Internal effects only\nBrand value unaffected',
        'Limited external exposure\nModerate brand impact\nNegative media coverage',
        'Significant external exposure\nStrong brand impact\nNegative stakeholder perception',
        'Extensive external exposure\nDamage to brand values\nIrreversible loss of stakeholder trust',
      ],
    },
    {
      label: 'Operations',
      cells: [
        'Minor outages\nNo data loss\nNo customer loss',
        'Outages requiring correction\nLow impact on NPS\nLimited customer loss',
        'Significant customer dissatisfaction\nPotential business loss\nReversible security breach',
        'Customer data loss\nMultiple customers affected\nMajor business loss',
      ],
    },
  ],
  likelihoods: [
    {label: 'Rare',      desc: 'Likely to occur in Exceptional cases'},
    {label: 'Unlikely',  desc: 'Likely to occur in a particular set of conditions'},
    {label: 'Possible',  desc: 'May occur at a given time'},
    {label: 'Certain',   desc: 'Group already exposed or currently happening'},
  ],
};

// Charger / sauvegarder le RA dans une variable globale (synced avec SharePoint)
var RA_DATA = null;

function raLoad() {
  // Charge depuis DB (rempli par graph.js au boot)
  if (typeof DB !== 'undefined' && DB.riskAssessment) {
    RA_DATA = JSON.parse(JSON.stringify(DB.riskAssessment));
  } else {
    RA_DATA = JSON.parse(JSON.stringify(RA_DEFAULT));
  }
}

async function raSave() {
  if (!RA_DATA) return;
  try {
    if (typeof saveRiskAssessment === 'function') {
      await saveRiskAssessment(RA_DATA);
      toast('Risk Assessment sauvegardé ✓');
    } else {
      toast('Fonction de sauvegarde non disponible');
    }
  } catch(e) {
    console.error('[RA] save error:', e);
    toast('Erreur lors de la sauvegarde');
  }
}

function raResetDefaults() {
  if (!confirm('Restaurer toutes les valeurs par défaut ? Vos modifications non sauvegardées seront perdues.')) return;
  RA_DATA = JSON.parse(JSON.stringify(RA_DEFAULT));
  raRender();
}

function raSetIntro(val) { if (RA_DATA) RA_DATA.intro = val; }
function raSetImpactLabel(idx, val) { if (RA_DATA && RA_DATA.impacts) RA_DATA.impacts[idx] = val; }
function raSetRowLabel(rowIdx, val) { if (RA_DATA && RA_DATA.rows[rowIdx]) RA_DATA.rows[rowIdx].label = val; }
function raSetCell(rowIdx, colIdx, val) { if (RA_DATA && RA_DATA.rows[rowIdx]) RA_DATA.rows[rowIdx].cells[colIdx] = val; }
function raSetLikelihood(idx, field, val) { if (RA_DATA && RA_DATA.likelihoods[idx]) RA_DATA.likelihoods[idx][field] = val; }

function raRender() {
  if (!RA_DATA) raLoad();
  var root = document.getElementById('ra-root');
  if (!root) return;

  var html = '';
  // ── Intro ──
  html += '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:6px">Introduction (apparaît en haut de la slide « Risk valuation matrix » du rapport)</div>';
  html += '<textarea onchange="raSetIntro(this.value)" style="width:100%;min-height:80px;font-size:12px;padding:8px;border:1px solid var(--border);border-radius:4px;resize:vertical">'+(RA_DATA.intro||'').replace(/</g,'&lt;')+'</textarea>';
  html += '</div>';

  // ── Tableau Impacts (matrice 4 colonnes par catégorie) ──
  html += '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:8px">Impact Matrix</div>';
  html += '<div style="font-size:10px;color:var(--text-3);font-style:italic;margin-bottom:10px">Cliquez dans une cellule pour la modifier. Les sauts de ligne sont conservés.</div>';
  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
  // Header
  html += '<thead><tr>';
  html += '<th style="background:#2D2E83;color:#fff;padding:8px;text-align:left;width:120px;border:1px solid #ccc">Impact</th>';
  RA_DATA.impacts.forEach(function(imp, i){
    html += '<th style="background:#2D2E83;color:#fff;padding:6px;border:1px solid #ccc"><input value="'+(imp||'').replace(/"/g,'&quot;')+'" onchange="raSetImpactLabel('+i+',this.value)" style="width:100%;background:transparent;color:#fff;border:none;font-weight:bold;font-size:11px;text-align:center"/></th>';
  });
  html += '</tr></thead><tbody>';
  // Rows
  RA_DATA.rows.forEach(function(row, ri){
    html += '<tr>';
    html += '<td style="background:#F2F2F2;padding:6px;border:1px solid #ccc;font-weight:bold;vertical-align:top"><input value="'+(row.label||'').replace(/"/g,'&quot;')+'" onchange="raSetRowLabel('+ri+',this.value)" style="width:100%;background:transparent;border:none;font-weight:bold;font-size:11px"/></td>';
    row.cells.forEach(function(c, ci){
      html += '<td style="padding:0;border:1px solid #ccc;vertical-align:top"><textarea onchange="raSetCell('+ri+','+ci+',this.value)" style="width:100%;min-height:80px;border:none;padding:6px;font-size:10px;resize:vertical;font-family:inherit;background:transparent">'+(c||'').replace(/</g,'&lt;')+'</textarea></td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  html += '</div>';

  // ── Tableau Likelihood ──
  html += '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:8px">Likelihood</div>';
  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
  html += '<thead><tr>';
  html += '<th style="background:#2D2E83;color:#fff;padding:8px;text-align:left;width:140px;border:1px solid #ccc">Likelihood</th>';
  html += '<th style="background:#2D2E83;color:#fff;padding:8px;text-align:left;border:1px solid #ccc">Description</th>';
  html += '</tr></thead><tbody>';
  RA_DATA.likelihoods.forEach(function(l, li){
    html += '<tr>';
    html += '<td style="background:#F2F2F2;padding:0;border:1px solid #ccc;font-weight:bold"><input value="'+(l.label||'').replace(/"/g,'&quot;')+'" onchange="raSetLikelihood('+li+',\'label\',this.value)" style="width:100%;background:transparent;border:none;padding:6px;font-weight:bold;font-size:11px"/></td>';
    html += '<td style="padding:0;border:1px solid #ccc"><input value="'+(l.desc||'').replace(/"/g,'&quot;')+'" onchange="raSetLikelihood('+li+',\'desc\',this.value)" style="width:100%;border:none;padding:6px;font-size:11px"/></td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  html += '</div>';

  root.innerHTML = html;
}

V['risk-universe']=()=>`
  <div class="topbar">
    <div class="tbtitle">Risk Universe</div>
    <div style="display:flex;gap:7px">
      <button class="bs" onclick="ruShowMatrix()" style="font-size:11px">📊 Matrice de synthèse</button>
      <button class="bp ao" onclick="ruAddGroupRisk()">+ Risque Groupe (URD)</button>
    </div>
  </div>
  <div class="content">
    <div id="ru-root"></div>
  </div>`;

I['risk-universe']=function(){
  ruRender();
};

function ruRender(){
  var root=document.getElementById('ru-root');
  if(!root) return;

  // Séparer les risques groupe (URD) des opérationnels
  var groupRisks = RISK_UNIVERSE.filter(function(r){return r.level==='group';});
  groupRisks.sort(function(a,b){return (a.title||'').localeCompare(b.title||'','fr',{sensitivity:'base'});});

  if (!groupRisks.length) {
    root.innerHTML = '<div style="font-size:13px;color:var(--text-3);padding:2rem;text-align:center">'
      + '<div style="font-size:36px;margin-bottom:8px">△</div>'
      + '<div style="font-weight:500;margin-bottom:4px">Aucun risque défini</div>'
      + '<div>Commencez par créer un risque Groupe (URD). Les risques opérationnels y seront rattachés.</div>'
      + '</div>';
    return;
  }

  var html = '<div style="display:flex;flex-direction:column;gap:12px">';
  groupRisks.forEach(function(gr){
    var operationalRisks = RISK_UNIVERSE.filter(function(r){return r.level==='operational' && r.parentId===gr.id;});
    operationalRisks.sort(function(a,b){return (a.title||'').localeCompare(b.title||'','fr',{sensitivity:'base'});});

    var impactColors = (typeof RISK_IMPACT_COLORS!=='undefined' && RISK_IMPACT_COLORS[gr.impact])
      ? RISK_IMPACT_COLORS[gr.impact]
      : {bg:'#F3F4F6', color:'#374151'};

    var typeBadges = (gr.impactTypes||[]).map(function(t){
      return '<span class="badge bpl" style="font-size:9px">'+t+'</span>';
    }).join(' ');

    // En-tête du risque groupe
    html += '<div class="card" style="padding:0;overflow:hidden">';
    html += '<div style="padding:12px 14px;border-left:4px solid '+impactColors.color+';background:'+impactColors.bg+'22">';
    html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">';
    html += '<div style="flex:1">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
    html += '<span style="font-size:10px;font-weight:700;color:var(--purple-dk);letter-spacing:.05em">URD</span>';
    html += '<span style="font-size:15px;font-weight:600">'+gr.title+'</span>';
    html += '</div>';
    if (gr.description) html += '<div style="font-size:11px;color:var(--text-2);margin-bottom:6px">'+gr.description+'</div>';
    html += '<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-top:6px">';
    if (gr.probability) html += '<span class="badge bpl" style="font-size:10px">Prob: '+gr.probability+'</span>';
    if (gr.impact) html += '<span class="badge" style="background:'+impactColors.bg+';color:'+impactColors.color+';font-size:10px;font-weight:600">Impact: '+gr.impact+'</span>';
    html += typeBadges;
    html += '</div></div>';
    // Boutons d'action
    html += '<div style="display:flex;gap:4px;flex-shrink:0">';
    if (CU && CU.role==='admin') {
      html += '<button class="bs" style="font-size:10px;padding:2px 8px" onclick="ruAddOperationalRisk(\''+gr.id+'\')">+ Op.</button>';
      html += '<button class="bs" style="font-size:10px;padding:2px 8px" onclick="ruEditGroupRisk(\''+gr.id+'\')">Éditer</button>';
      html += '<button class="bd" style="font-size:10px;padding:2px 6px" onclick="ruDeleteGroupRisk(\''+gr.id+'\')">×</button>';
    }
    html += '</div></div></div>';

    // Liste des risques opérationnels
    if (operationalRisks.length) {
      html += '<div style="padding:8px 14px;background:var(--bg)">';
      html += '<div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Risques opérationnels ('+operationalRisks.length+')</div>';
      operationalRisks.forEach(function(or){
        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--bg-card);border-radius:6px;margin-bottom:4px;font-size:11px">';
        html += '<div style="flex:1">';
        html += '<div style="font-weight:500">'+or.title+'</div>';
        if (or.description) html += '<div style="font-size:10px;color:var(--text-3);margin-top:2px">'+or.description+'</div>';
        html += '</div>';
        html += '<div style="display:flex;gap:4px;margin-left:10px">';
        html += '<span class="badge" style="background:'+impactColors.bg+';color:'+impactColors.color+';font-size:9px">Hérite '+(gr.impact||'—')+'</span>';
        if (CU && CU.role==='admin') {
          html += '<button class="bs" style="font-size:10px;padding:1px 6px" onclick="ruEditOperationalRisk(\''+or.id+'\')">Éditer</button>';
          html += '<button class="bd" style="font-size:10px;padding:1px 5px" onclick="ruDeleteOperationalRisk(\''+or.id+'\')">×</button>';
        }
        html += '</div></div>';
      });
      html += '</div>';
    } else {
      html += '<div style="padding:8px 14px;font-size:10px;color:var(--text-3);font-style:italic;background:var(--bg)">Aucun risque opérationnel rattaché</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  root.innerHTML = html;
}

// ── Formulaire Risque Groupe (URD) ──────────────────────────
function ruGroupRiskModal(existingRisk) {
  var probOpts = (typeof RISK_PROBABILITIES!=='undefined' ? RISK_PROBABILITIES : ['Rare','Unlikely','Possible','Certain'])
    .map(function(p){return '<option value="'+p+'"'+(existingRisk && existingRisk.probability===p?' selected':'')+'>'+p+'</option>';}).join('');
  var impactOpts = (typeof RISK_IMPACTS!=='undefined' ? RISK_IMPACTS : ['Minor','Limited','Major','Severe'])
    .map(function(i){return '<option value="'+i+'"'+(existingRisk && existingRisk.impact===i?' selected':'')+'>'+i+'</option>';}).join('');
  var types = typeof RISK_IMPACT_TYPES!=='undefined' ? RISK_IMPACT_TYPES : ['Réputation','Financier','Legal','Operations'];
  var currentTypes = (existingRisk && existingRisk.impactTypes) || [];
  var typesHtml = types.map(function(t){
    var checked = currentTypes.indexOf(t)>=0 ? ' checked' : '';
    return '<label><input type="checkbox" class="ru-type-cb" value="'+t+'"'+checked+'><span>'+t+'</span></label>';
  }).join('');

  var body = '<div><label>Intitulé du risque <span style="color:var(--red)">*</span></label><input id="ru-title" value="'+((existingRisk&&existingRisk.title)||'')+'" placeholder="ex: Cyber Security"/></div>'
    + '<div><label>Description</label><textarea id="ru-desc" style="width:100%;min-height:50px" placeholder="Description détaillée du risque">'+((existingRisk&&existingRisk.description)||'')+'</textarea></div>'
    + '<div class="g2">'
      + '<div><label>Probabilité <span style="color:var(--red)">*</span></label><select id="ru-prob"><option value="">—</option>'+probOpts+'</select></div>'
      + '<div><label>Impact <span style="color:var(--red)">*</span></label><select id="ru-impact"><option value="">—</option>'+impactOpts+'</select></div>'
    + '</div>'
    + '<div><label>Types d\'impact (1 ou plusieurs)</label>'
      + '<div class="cb-list" style="display:flex;flex-wrap:wrap;gap:6px">'+typesHtml+'</div>'
    + '</div>';

  openModal(existingRisk ? 'Éditer risque Groupe (URD)' : 'Nouveau risque Groupe (URD)', body, async function(){
    var title = document.getElementById('ru-title').value.trim();
    if (!title) { toast('Titre obligatoire'); return; }
    var prob = document.getElementById('ru-prob').value;
    var impact = document.getElementById('ru-impact').value;
    if (!prob || !impact) { toast('Probabilité et Impact obligatoires'); return; }
    var desc = document.getElementById('ru-desc').value.trim();
    var impactTypes = [];
    document.querySelectorAll('.ru-type-cb:checked').forEach(function(cb){ impactTypes.push(cb.value); });

    if (existingRisk) {
      existingRisk.title = title;
      existingRisk.description = desc;
      existingRisk.probability = prob;
      existingRisk.impact = impact;
      existingRisk.impactTypes = impactTypes;
      await ruSaveRisk(existingRisk);
      addHist('edit', 'Risque URD "'+title+'" modifié');
      // Propagation : les opérationnels héritent auto du niveau (pas de champ à update côté code)
      toast('Risque modifié ✓');
    } else {
      var newRisk = {
        id: 'rsk_'+Date.now(),
        level: 'group',
        parentId: '',
        title: title, description: desc,
        probability: prob, impact: impact, impactTypes: impactTypes,
      };
      RISK_UNIVERSE.push(newRisk);
      await ruSaveRisk(newRisk);
      addHist('add', 'Risque URD "'+title+'" créé');
      toast('Risque créé ✓');
    }
    ruRender();
  });
}

function ruAddGroupRisk(){ ruGroupRiskModal(null); }
function ruEditGroupRisk(rId){
  var r = RISK_UNIVERSE.find(function(x){return x.id===rId;});
  if (!r) return;
  ruGroupRiskModal(r);
}

async function ruDeleteGroupRisk(rId){
  var r = RISK_UNIVERSE.find(function(x){return x.id===rId;});
  if (!r) return;
  var children = RISK_UNIVERSE.filter(function(x){return x.parentId===rId;});
  if (!confirm('Supprimer le risque URD "'+r.title+'"'+(children.length?' et ses '+children.length+' risque(s) opérationnel(s) rattaché(s)':'')+' ?')) return;
  // Supprimer les enfants d'abord
  for (var i=0; i<children.length; i++) {
    await spDelete('AF_RiskUniverse', children[i].id);
  }
  await spDelete('AF_RiskUniverse', rId);
  RISK_UNIVERSE = RISK_UNIVERSE.filter(function(x){return x.id!==rId && x.parentId!==rId;});
  addHist('del', 'Risque URD "'+r.title+'" supprimé');
  ruRender();
  toast('Risque supprimé ✓');
}

// ── Formulaire Risque Opérationnel ──────────────────────────
function ruOperationalRiskModal(parentId, existingRisk) {
  var parent = RISK_UNIVERSE.find(function(x){return x.id===parentId;});
  var parentInfo = parent
    ? '<div style="padding:8px 10px;background:var(--bg);border-radius:6px;margin-bottom:10px;font-size:11px">'
      + '<div style="color:var(--text-3);margin-bottom:2px">Rattaché au risque URD :</div>'
      + '<div style="font-weight:500">'+parent.title+'</div>'
      + '<div style="color:var(--text-3);margin-top:4px">Niveau hérité : <strong>'+(parent.impact||'—')+'</strong> · Prob: '+(parent.probability||'—')+'</div>'
      + '</div>'
    : '';

  var body = parentInfo
    + '<div><label>Intitulé du risque opérationnel <span style="color:var(--red)">*</span></label><input id="ru-title" value="'+((existingRisk&&existingRisk.title)||'')+'" placeholder="ex: Phishing employés"/></div>'
    + '<div><label>Description</label><textarea id="ru-desc" style="width:100%;min-height:50px" placeholder="Description détaillée">'+((existingRisk&&existingRisk.description)||'')+'</textarea></div>';

  openModal(existingRisk ? 'Éditer risque opérationnel' : 'Nouveau risque opérationnel', body, async function(){
    var title = document.getElementById('ru-title').value.trim();
    if (!title) { toast('Titre obligatoire'); return; }
    var desc = document.getElementById('ru-desc').value.trim();

    if (existingRisk) {
      existingRisk.title = title;
      existingRisk.description = desc;
      await ruSaveRisk(existingRisk);
      addHist('edit', 'Risque opérationnel "'+title+'" modifié');
      toast('Risque modifié ✓');
    } else {
      var newRisk = {
        id: 'rsk_'+Date.now(),
        level: 'operational',
        parentId: parentId,
        title: title, description: desc,
        probability: '', impact: '', impactTypes: [],  // hérite du parent
      };
      RISK_UNIVERSE.push(newRisk);
      await ruSaveRisk(newRisk);
      addHist('add', 'Risque opérationnel "'+title+'" créé');
      toast('Risque créé ✓');
    }
    ruRender();
  });
}

function ruAddOperationalRisk(parentId){ ruOperationalRiskModal(parentId, null); }
function ruEditOperationalRisk(rId){
  var r = RISK_UNIVERSE.find(function(x){return x.id===rId;});
  if (!r) return;
  ruOperationalRiskModal(r.parentId, r);
}

async function ruDeleteOperationalRisk(rId){
  var r = RISK_UNIVERSE.find(function(x){return x.id===rId;});
  if (!r) return;
  if (!confirm('Supprimer le risque opérationnel "'+r.title+'" ?')) return;
  await spDelete('AF_RiskUniverse', rId);
  RISK_UNIVERSE = RISK_UNIVERSE.filter(function(x){return x.id!==rId;});
  addHist('del', 'Risque opérationnel "'+r.title+'" supprimé');
  ruRender();
  toast('Risque supprimé ✓');
}

async function ruSaveRisk(risk) {
  try {
    await spUpsert('AF_RiskUniverse', risk.id, {
      level: risk.level,
      parent_id: risk.parentId || '',
      risk_title: risk.title,
      description: risk.description || '',
      probability: risk.probability || '',
      impact: risk.impact || '',
      impact_types_json: JSON.stringify(risk.impactTypes||[]),
      Title: risk.title,
    });
  } catch(e){ console.warn('[RU] save error:', e.message); toast('Erreur sauvegarde: '+e.message); }
}

// Matrice 4x4 probabilité × impact
function ruShowMatrix() {
  var probs = typeof RISK_PROBABILITIES!=='undefined' ? RISK_PROBABILITIES : ['Rare','Unlikely','Possible','Certain'];
  var impacts = typeof RISK_IMPACTS!=='undefined' ? RISK_IMPACTS : ['Minor','Limited','Major','Severe'];
  var groupRisks = RISK_UNIVERSE.filter(function(r){return r.level==='group';});

  // Grouper les risques par (proba, impact)
  var cells = {};
  groupRisks.forEach(function(r){
    var key = r.probability + '__' + r.impact;
    if (!cells[key]) cells[key] = [];
    cells[key].push(r);
  });

  // Construire tableau
  var html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
  html += '<thead><tr><th style="padding:8px;background:var(--bg);border:.5px solid var(--border)"></th>';
  impacts.forEach(function(imp){
    var col = (typeof RISK_IMPACT_COLORS!=='undefined' && RISK_IMPACT_COLORS[imp]) ? RISK_IMPACT_COLORS[imp] : {bg:'#F3F4F6',color:'#374151'};
    html += '<th style="padding:8px;background:'+col.bg+';color:'+col.color+';border:.5px solid var(--border);font-size:11px">'+imp+'</th>';
  });
  html += '</tr></thead><tbody>';
  // Inverser ordre des probabilités pour avoir Certain en haut
  probs.slice().reverse().forEach(function(prob){
    html += '<tr>';
    html += '<td style="padding:8px;font-weight:600;background:var(--bg);border:.5px solid var(--border)">'+prob+'</td>';
    impacts.forEach(function(imp){
      var risks = cells[prob+'__'+imp] || [];
      var col = (typeof RISK_IMPACT_COLORS!=='undefined' && RISK_IMPACT_COLORS[imp]) ? RISK_IMPACT_COLORS[imp] : {bg:'#F3F4F6',color:'#374151'};
      if (risks.length) {
        var content = risks.map(function(r){return '<div style="font-size:10px;padding:2px 4px;background:'+col.bg+';color:'+col.color+';border-radius:3px;margin-bottom:2px">'+r.title+'</div>';}).join('');
        html += '<td style="padding:6px;border:.5px solid var(--border);vertical-align:top">'+content+'</td>';
      } else {
        html += '<td style="padding:8px;border:.5px solid var(--border);color:var(--text-3);text-align:center">—</td>';
      }
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  html += '<div style="font-size:10px;color:var(--text-3);margin-top:10px;font-style:italic">Seuls les risques Groupe (URD) apparaissent dans la matrice. Les risques opérationnels héritent du niveau de leur parent.</div>';

  openModal('Matrice des risques URD', html, function(){});
}

// ══════════════════════════════════════════════════════════════
//  PRODUCT LINES (squelette - phase D)
// ══════════════════════════════════════════════════════════════
V['product-lines']=()=>`
  <div class="topbar">
    <div class="tbtitle">Product Lines</div>
    <div style="display:flex;gap:7px">
      <button class="bp ao" onclick="plAddProductLine()">+ Product Line</button>
    </div>
  </div>
  <div class="content">
    <div id="pl-root"></div>
  </div>`;

I['product-lines']=function(){
  plRender();
};

function plRender(){
  var root=document.getElementById('pl-root');
  if(!root) return;

  if (!PRODUCT_LINES || !PRODUCT_LINES.length) {
    root.innerHTML = '<div style="font-size:13px;color:var(--text-3);padding:2rem;text-align:center">'
      + '<div style="font-size:36px;margin-bottom:8px">▲</div>'
      + '<div style="font-weight:500;margin-bottom:4px">Aucune Product Line définie</div>'
      + '<div>Cliquez sur "+ Product Line" pour commencer.</div>'
      + '</div>';
    return;
  }

  // Grouper par société
  var bySociety = { SBS:[], AXW:[], Autre:[] };
  PRODUCT_LINES.forEach(function(pl){
    var soc = (pl.society==='SBS' || pl.society==='AXW') ? pl.society : 'Autre';
    bySociety[soc].push(pl);
  });

  var html = '';
  ['SBS','AXW','Autre'].forEach(function(soc){
    var list = bySociety[soc];
    if (!list.length) return;
    list.sort(function(a,b){return (a.name||'').localeCompare(b.name||'','fr',{sensitivity:'base'});});
    html += '<div style="margin-bottom:1.5rem">';
    html += '<div style="font-size:11px;font-weight:700;color:var(--purple-dk);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem;padding-bottom:4px;border-bottom:1px solid var(--border)">'+soc+' ('+list.length+')</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';
    list.forEach(function(pl){
      var countries = pl.countries || [];
      var countriesHtml = countries.length
        ? countries.map(function(c){return '<span class="badge bpl" style="font-size:9px;padding:2px 6px">'+c+'</span>';}).join(' ')
        : '<span style="font-size:10px;color:var(--text-3);font-style:italic">Aucun pays</span>';
      html += '<div class="card" style="padding:12px 14px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
          + '<div style="font-size:13px;font-weight:600">'+pl.name+'</div>'
          + '<div style="display:flex;gap:4px">'
            + (CU&&CU.role==='admin'?'<button class="bs" style="font-size:10px;padding:2px 6px" onclick="plEditProductLine(\''+pl.id+'\')">Éditer</button>':'')
            + (CU&&CU.role==='admin'?'<button class="bd" style="font-size:10px;padding:2px 6px" onclick="plDeleteProductLine(\''+pl.id+'\')">×</button>':'')
          + '</div>'
        + '</div>'
        + (pl.description ? '<div style="font-size:11px;color:var(--text-2);margin-bottom:8px">'+pl.description+'</div>' : '')
        + '<div style="font-size:10px;color:var(--text-3);margin-bottom:4px">Pays ('+countries.length+')</div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:3px">'+countriesHtml+'</div>'
        + '</div>';
    });
    html += '</div></div>';
  });
  root.innerHTML = html;
}

function plProductLineModal(existingPL) {
  // Pays disponibles depuis Group Structure
  var availableCountries = (typeof getAllCountriesFromGS==='function') ? getAllCountriesFromGS() : [];
  var currentCountries = (existingPL && existingPL.countries) || [];

  var countriesHtml = '';
  if (availableCountries.length) {
    countriesHtml = availableCountries.map(function(c){
      var checked = currentCountries.indexOf(c)>=0 ? ' checked' : '';
      return '<label><input type="checkbox" class="pl-country-cb" value="'+c+'"'+checked+'><span>'+c+'</span></label>';
    }).join('');
    countriesHtml = '<div><label>Pays de déploiement</label>'
      + '<div style="font-size:10px;color:var(--text-3);margin-bottom:5px">Cochez les pays où cette Product Line est présente (depuis Group Structure)</div>'
      + '<div class="cb-list" style="display:flex;flex-direction:column;gap:3px;max-height:200px;overflow-y:auto;border:.5px solid var(--border);border-radius:var(--radius);padding:8px 10px;background:var(--bg-card)">'
      + countriesHtml
      + '</div></div>';
  } else {
    countriesHtml = '<div style="font-size:11px;color:var(--text-3);padding:8px;background:var(--bg);border-radius:6px">ℹ️ Aucun pays dans Group Structure. Définissez-en d\'abord pour pouvoir associer des pays à cette Product Line.</div>';
  }

  var body = '<div><label>Nom de la Product Line <span style="color:var(--red)">*</span></label><input id="pl-name" value="'+((existingPL&&existingPL.name)||'')+'" placeholder="ex: API Management"/></div>'
    + '<div><label>Société <span style="color:var(--red)">*</span></label>'
    + '<select id="pl-society">'
      + '<option value="SBS"'+(existingPL && existingPL.society==='SBS'?' selected':'')+'>SBS</option>'
      + '<option value="AXW"'+(existingPL && existingPL.society==='AXW'?' selected':'')+'>AXW</option>'
    + '</select></div>'
    + '<div><label>Description</label><textarea id="pl-desc" style="width:100%;min-height:50px" placeholder="Description de la Product Line">'+((existingPL&&existingPL.description)||'')+'</textarea></div>'
    + countriesHtml;

  openModal(existingPL ? 'Éditer Product Line' : 'Nouvelle Product Line', body, async function(){
    var name = document.getElementById('pl-name').value.trim();
    if (!name) { toast('Nom obligatoire'); return; }
    var society = document.getElementById('pl-society').value;
    var description = document.getElementById('pl-desc').value.trim();
    var countries = [];
    document.querySelectorAll('.pl-country-cb:checked').forEach(function(cb){ countries.push(cb.value); });

    if (existingPL) {
      existingPL.name = name;
      existingPL.society = society;
      existingPL.description = description;
      existingPL.countries = countries;
      await plSavePL(existingPL);
      addHist('edit', 'Product Line "'+name+'" modifiée');
      toast('Product Line modifiée ✓');
    } else {
      var newPL = {
        id: 'pl_'+Date.now(),
        name: name, society: society,
        description: description, countries: countries,
      };
      PRODUCT_LINES.push(newPL);
      await plSavePL(newPL);
      addHist('add', 'Product Line "'+name+'" créée');
      toast('Product Line créée ✓');
    }
    plRender();
  });
}

function plAddProductLine(){ plProductLineModal(null); }
function plEditProductLine(plId){
  var pl = PRODUCT_LINES.find(function(x){return x.id===plId;});
  if (!pl) return;
  plProductLineModal(pl);
}

async function plDeleteProductLine(plId){
  var pl = PRODUCT_LINES.find(function(x){return x.id===plId;});
  if (!pl) return;
  if (!confirm('Supprimer la Product Line "'+pl.name+'" ?')) return;
  await spDelete('AF_ProductLines', plId);
  PRODUCT_LINES = PRODUCT_LINES.filter(function(x){return x.id!==plId;});
  addHist('del', 'Product Line "'+pl.name+'" supprimée');
  plRender();
  toast('Product Line supprimée ✓');
}

async function plSavePL(pl) {
  try {
    await spUpsert('AF_ProductLines', pl.id, {
      pl_name: pl.name,
      society: pl.society || '',
      countries_json: JSON.stringify(pl.countries||[]),
      description: pl.description || '',
      Title: pl.name,
    });
  } catch(e){ console.warn('[PL] save error:', e.message); toast('Erreur sauvegarde: '+e.message); }
}

// ══════════════════════════════════════════════════════════════
//  TEAM (profils enrichis : photo + experience + academics)
// ══════════════════════════════════════════════════════════════
V['team']=()=>`
  <div class="topbar">
    <div class="tbtitle">Team</div>
    <div style="font-size:11px;color:var(--text-3);font-style:italic">Profils utilisés dans la slide « Audit Team » du Kick Off Presentation.</div>
  </div>
  <div class="content">
    <div id="team-root"></div>
  </div>`;

I['team']=function(){ teamRender(); };

function teamRender() {
  var root = document.getElementById('team-root');
  if (!root) return;

  // Utiliser groupUsersByName() pour dédupliquer les alias 74S/Axway
  var grouped = (typeof groupUsersByName === 'function') ? groupUsersByName() : [];
  // Filtrer : exclure viewers et archivés
  var members = grouped.filter(function(g){
    return g.role !== 'viewer' && g.status !== 'archived';
  });

  if (!members.length) {
    root.innerHTML = '<div style="text-align:center;color:var(--text-3);padding:2rem">Aucun membre actif dans l\'équipe.</div>';
    return;
  }

  // Pour chaque groupe, agréger photo/experience/academics depuis les alias
  members.forEach(function(g){
    g._photoFilename = '';
    g._experience = '';
    g._academics = '';
    g._initials = '';
    // Calculer la clé canonique (préfixe email du premier alias avec email)
    g._canonicalKey = '';
    (g.userIds || []).forEach(function(uid){
      var u = (DB.users || []).find(function(x){return x.id===uid;});
      if (!u) return;
      // Photo : prendre la première non vide
      if (!g._photoFilename && u.photoFilename) g._photoFilename = u.photoFilename;
      // Experience / Academics : agréger
      if (!g._experience && u.experience) g._experience = u.experience;
      if (!g._academics && u.academics) g._academics = u.academics;
      // Initiales : prendre la première dispo
      if (!g._initials && u.initials) g._initials = u.initials;
      // Clé canonique : préfixe email du premier user avec email
      if (!g._canonicalKey && u.email) {
        var em = u.email.toLowerCase().trim();
        if (em.indexOf('@')>0) g._canonicalKey = em.split('@')[0];
      }
    });
    // Fallback initials si rien trouvé
    if (!g._initials && g.name) {
      g._initials = g.name.split(/\s+/).map(function(w){return w.charAt(0);}).join('').toUpperCase().substring(0,2);
    }
    // Fallback canonical key si rien trouvé
    if (!g._canonicalKey && g.name) {
      g._canonicalKey = g.name.toLowerCase().replace(/[^a-z0-9]/g,'_');
    }
  });

  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">';
  members.forEach(function(g, i){
    html += teamRenderCard(g, i);
  });
  html += '</div>';
  root.innerHTML = html;
}

function teamRenderCard(g, idx) {
  var html = '<div class="card" style="display:flex;flex-direction:column;align-items:center;padding:16px;text-align:center">';

  // Photo ou initiales
  if (g._photoFilename) {
    var imgId = 'team-img-' + idx;
    html += '<div id="'+imgId+'" style="width:100px;height:100px;border-radius:50%;background:var(--purple);display:flex;align-items:center;justify-content:center;margin-bottom:12px;overflow:hidden;color:#fff;font-size:32px;font-weight:600">'+(g._initials||'?')+'</div>';
    setTimeout(function(){
      if (typeof getTeamPhotoDataUrl === 'function') {
        getTeamPhotoDataUrl(g._photoFilename).then(function(dataUrl){
          if (!dataUrl) return;
          var el = document.getElementById(imgId);
          if (el) el.innerHTML = '<img src="'+dataUrl+'" style="width:100%;height:100%;object-fit:cover"/>';
        });
      }
    }, 0);
  } else {
    html += '<div style="width:100px;height:100px;border-radius:50%;background:var(--purple);display:flex;align-items:center;justify-content:center;margin-bottom:12px;color:#fff;font-size:32px;font-weight:600">'+(g._initials||'?')+'</div>';
  }

  // Nom
  html += '<div style="font-size:15px;font-weight:600;color:var(--text-1)">'+g.name+'</div>';
  // Role
  var roleLabel = g.role === 'admin' ? 'Administrateur' : g.role === 'auditeur' ? 'Auditeur' : g.role;
  html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;margin-bottom:10px">'+roleLabel+'</div>';

  // Experience + Academics
  if (g._experience) {
    html += '<div style="font-size:10px;color:var(--text-2);text-align:left;width:100%;margin-bottom:4px"><strong>Experience:</strong> '+(g._experience.length>80?g._experience.substring(0,80)+'…':g._experience)+'</div>';
  }
  if (g._academics) {
    html += '<div style="font-size:10px;color:var(--text-2);text-align:left;width:100%;margin-bottom:8px"><strong>Academics:</strong> '+(g._academics.length>80?g._academics.substring(0,80)+'…':g._academics)+'</div>';
  }
  if (!g._experience && !g._academics) {
    html += '<div style="font-size:10px;color:var(--text-3);font-style:italic;margin-bottom:8px">Aucun détail renseigné</div>';
  }

  // Stocker le groupe dans une variable globale pour que la modale d'édition puisse y accéder
  // (on passe l'index, et on relit groupUsersByName au moment de l'édition)
  html += '<button class="bs" style="font-size:11px;padding:5px 12px;margin-top:auto" onclick="teamShowEditModal('+idx+')">Éditer le profil</button>';

  html += '</div>';
  return html;
}

async function teamShowEditModal(memberIdx) {
  // Récupérer le groupe à partir de l'index dans la liste filtrée
  var grouped = (typeof groupUsersByName === 'function') ? groupUsersByName() : [];
  var members = grouped.filter(function(g){
    return g.role !== 'viewer' && g.status !== 'archived';
  });
  var g = members[memberIdx];
  if (!g) return;

  // Recalculer les données agrégées (photo/experience/academics)
  var photoFilename = '';
  var experience = '';
  var academics = '';
  var initials = '';
  var canonicalKey = '';
  (g.userIds || []).forEach(function(uid){
    var u = (DB.users || []).find(function(x){return x.id===uid;});
    if (!u) return;
    if (!photoFilename && u.photoFilename) photoFilename = u.photoFilename;
    if (!experience && u.experience) experience = u.experience;
    if (!academics && u.academics) academics = u.academics;
    if (!initials && u.initials) initials = u.initials;
    if (!canonicalKey && u.email) {
      var em = u.email.toLowerCase().trim();
      if (em.indexOf('@')>0) canonicalKey = em.split('@')[0];
    }
  });
  if (!initials && g.name) {
    initials = g.name.split(/\s+/).map(function(w){return w.charAt(0);}).join('').toUpperCase().substring(0,2);
  }
  if (!canonicalKey && g.name) {
    canonicalKey = g.name.toLowerCase().replace(/[^a-z0-9]/g,'_');
  }

  var body = '<div style="display:flex;flex-direction:column;gap:12px">';

  // Photo upload
  body += '<div>';
  body += '<label style="font-size:11px;color:var(--text-3)">Photo</label>';
  body += '<div style="display:flex;align-items:center;gap:12px;margin-top:4px">';
  body += '<div id="tm-photo-preview" style="width:80px;height:80px;border-radius:50%;background:var(--purple);display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:600;overflow:hidden;flex-shrink:0">'+(initials||'?')+'</div>';
  body += '<div style="flex:1;display:flex;flex-direction:column;gap:6px">';
  body += '<input type="file" id="tm-photo-input" accept="image/png,image/jpeg,image/gif,image/webp" style="font-size:11px"/>';
  body += '<div style="font-size:10px;color:var(--text-3);font-style:italic">PNG, JPG, GIF ou WebP. Recommandé : carré, 200×200 minimum.</div>';
  if (photoFilename) {
    body += '<div style="font-size:10px;color:var(--text-2)">Photo actuelle : '+photoFilename+'</div>';
  }
  body += '</div></div></div>';

  // Experience
  body += '<div>';
  body += '<label style="font-size:11px;color:var(--text-3)">Experience</label>';
  body += '<textarea id="tm-experience" style="width:100%;min-height:60px;font-size:12px;padding:6px;border:1px solid var(--border);border-radius:4px;resize:vertical" placeholder="ex : 10+ years in audit, 5 years at PwC, IFRS expert...">'+(experience||'').replace(/</g,'&lt;')+'</textarea>';
  body += '</div>';

  // Academics
  body += '<div>';
  body += '<label style="font-size:11px;color:var(--text-3)">Academics</label>';
  body += '<textarea id="tm-academics" style="width:100%;min-height:60px;font-size:12px;padding:6px;border:1px solid var(--border);border-radius:4px;resize:vertical" placeholder="ex : MSc Finance ESCP, CFA, CIA...">'+(academics||'').replace(/</g,'&lt;')+'</textarea>';
  body += '</div>';

  body += '</div>';

  openModal('Éditer le profil — '+g.name, body, async function(){
    var newExperience = document.getElementById('tm-experience').value.trim();
    var newAcademics = document.getElementById('tm-academics').value.trim();
    var photoInput = document.getElementById('tm-photo-input');
    var newPhoto = photoInput && photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
    var newPhotoFilename = photoFilename;

    // Upload photo si fournie — on utilise la canonicalKey comme nom (partagé entre alias)
    if (newPhoto) {
      try {
        toast('Upload de la photo...');
        var result = await uploadTeamPhoto(canonicalKey, newPhoto);
        if (result && result.fileName) newPhotoFilename = result.fileName;
      } catch(e) {
        toast('Erreur upload photo : '+e.message);
        console.error(e);
        return;
      }
    }

    // Choisir l'alias canonique : 74Software en priorité, sinon le premier userId
    var canonicalUserId = null;
    (g.userIds || []).forEach(function(uid){
      var u = (DB.users || []).find(function(x){return x.id===uid;});
      if (!u) return;
      if (!canonicalUserId && u.email && u.email.toLowerCase().indexOf('@74software.com')>=0) {
        canonicalUserId = u.id;
      }
    });
    if (!canonicalUserId && g.userIds && g.userIds.length) canonicalUserId = g.userIds[0];

    // Sauvegarder sur l'alias canonique (saveUser SP)
    var canonicalUser = (DB.users || []).find(function(x){return x.id===canonicalUserId;});
    if (canonicalUser) {
      canonicalUser.experience = newExperience;
      canonicalUser.academics = newAcademics;
      canonicalUser.photoFilename = newPhotoFilename;
      await saveUser(canonicalUser);
    }

    // Mettre à jour TOUS les TM[id] du groupe en mémoire pour que kickoff-generator
    // affiche la photo quel que soit l'alias assigné à l'audit
    (g.userIds || []).forEach(function(uid){
      if (TM[uid]) {
        TM[uid].experience = newExperience;
        TM[uid].academics = newAcademics;
        TM[uid].photoFilename = newPhotoFilename;
      }
      // Aussi propager dans DB.users (en mémoire) pour que teamRender voit les nouvelles valeurs
      var u = (DB.users || []).find(function(x){return x.id===uid;});
      if (u) {
        // Pour les non-canoniques, on laisse les champs SP vides mais on sync en mémoire
        // pour que tout reflète la même chose à l'écran
        if (uid !== canonicalUserId) {
          u.experience = u.experience || newExperience;
          u.academics = u.academics || newAcademics;
          u.photoFilename = u.photoFilename || newPhotoFilename;
        }
      }
    });

    toast('Profil mis à jour ✓');
    teamRender();
  });
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
    <div class="tw"><table><thead><tr><th>Membre</th><th>Email @74software.com</th><th>Email @axway.com</th><th>Rôle</th><th>Statut</th><th>Modifier</th></tr></thead><tbody id="utbl"></tbody></table></div>
    <div class="card" style="margin-top:1rem;font-size:12px;color:var(--text-2);line-height:1.8">
      <strong>Admin / Directeur</strong> — accès complet, validation des étapes, gestion du Plan Audit et des utilisateurs.<br>
      <strong>Auditrice</strong> — accès à ses audits assignés, remplissage des tâches, contrôles, findings et documents.<br>
      <strong>Viewer</strong> — accès en lecture seule.
    </div>
  </div>`;
I['roles']=()=>renderUsersTbl();

// Regroupe les utilisateurs par identité réelle :
// 1. D'abord par "préfixe email" (partie avant @) — capture les alias @74software.com et @axway.com
// 2. Sinon par nom (insensible à la casse)
function groupUsersByName(){
  var byKey = {}; // clé = préfixe email ou nom

  function getKey(u) {
    var email = (u.email||'').toLowerCase().trim();
    if (email && email.indexOf('@')>0) {
      return 'em:' + email.split('@')[0]; // ex: "em:pmassard"
    }
    return 'nm:' + (u.name||'').trim().toLowerCase();
  }

  // Choisit le meilleur nom à afficher : le plus complet (le plus long et avec espace)
  function bestName(a, b) {
    if (!a) return b;
    if (!b) return a;
    var aLen = (a||'').trim().length;
    var bLen = (b||'').trim().length;
    var aHasSpace = (a||'').indexOf(' ')>=0;
    var bHasSpace = (b||'').indexOf(' ')>=0;
    // Préférer celui avec un espace (= prénom + nom)
    if (aHasSpace && !bHasSpace) return a;
    if (bHasSpace && !aHasSpace) return b;
    // Sinon, le plus long
    if (bLen > aLen) return b;
    return a;
  }

  // Capitalise un nom (première lettre de chaque mot)
  function capitalize(s) {
    if (!s) return s;
    return s.split(' ').map(function(w){
      if (!w) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
  }

  (USERS||[]).forEach(function(u){
    var key = getKey(u);
    if (!byKey[key]) {
      byKey[key] = {
        name: u.name,
        email74: '',
        emailAxway: '',
        emailOther: '',
        role: u.role || 'auditeur',
        status: u.status || 'actif',
        userIds: [],
      };
    }
    var entry = byKey[key];
    entry.userIds.push(u.id);
    // Choisir le meilleur nom à afficher
    entry.name = bestName(entry.name, u.name);
    var email = (u.email||'').toLowerCase();
    if (email.indexOf('@74software.com')>=0) entry.email74 = u.email;
    else if (email.indexOf('@axway.com')>=0) entry.emailAxway = u.email;
    else if (email) entry.emailOther = u.email;
    var rolePrio = {admin:3, auditeur:2, viewer:1, audite:1};
    if ((rolePrio[u.role]||0) > (rolePrio[entry.role]||0)) entry.role = u.role;
  });

  // Capitaliser proprement le nom affiché
  Object.values(byKey).forEach(function(entry){
    entry.name = capitalize(entry.name);
  });

  return Object.values(byKey).sort(function(a,b){return (a.name||'').localeCompare(b.name||'','fr',{sensitivity:'base'});});
}

function renderUsersTbl(){
  var RL={admin:'Admin / Directeur',auditeur:'Auditrice',audite:'Audité',viewer:'Viewer'};
  var RB={admin:'bpc',auditeur:'bdn',audite:'btg',viewer:'bpl'};
  var grouped = groupUsersByName();
  document.getElementById('utbl').innerHTML = grouped.map(function(p, i){
    var emptyMail = '<span style="color:var(--text-3);font-size:11px;font-style:italic">—</span>';
    return'<tr>'
      +'<td style="font-weight:500">'+p.name+'</td>'
      +'<td style="color:var(--text-2);font-size:11px">'+(p.email74 || emptyMail)+'</td>'
      +'<td style="color:var(--text-2);font-size:11px">'+(p.emailAxway || emptyMail)+(p.emailOther && !p.email74 && !p.emailAxway ? ' '+p.emailOther : '')+'</td>'
      +'<td><span class="badge '+(RB[p.role]||'bpl')+'">'+(RL[p.role]||p.role)+'</span></td>'
      +'<td><span style="font-size:11px;color:var(--green)">● '+p.status+'</span></td>'
      +'<td><select style="font-size:11px;padding:3px 7px;border:.5px solid var(--border-md);border-radius:var(--radius);background:var(--bg-card)" onchange="changeRoleByName('+i+',this.value)">'
      +'<option value="admin" '+(p.role==='admin'?'selected':'')+'>Admin / Directeur</option>'
      +'<option value="auditeur" '+(p.role==='auditeur'?'selected':'')+'>Auditrice</option>'
      +'<option value="viewer" '+(p.role==='viewer'?'selected':'')+'>Viewer</option>'
      +'</select></td></tr>';
  }).join('');
}

// Change le rôle pour TOUS les alias d'un même nom (fusion)
async function changeRoleByName(groupedIdx, newRole){
  var grouped = groupUsersByName();
  var entry = grouped[groupedIdx];
  if (!entry) return;
  // Mettre à jour tous les USERS qui ont l'un de ces userIds
  var updated = 0;
  for (var i=0; i<USERS.length; i++) {
    if (entry.userIds.indexOf(USERS[i].id) >= 0) {
      USERS[i].role = newRole;
      updated++;
      // Sauvegarder dans SharePoint
      try {
        await spUpsert('AF_Users', USERS[i].id, {
          email: USERS[i].email||'',
          name: USERS[i].name||'',
          role: newRole,
          initials: USERS[i].initials||'',
          status: USERS[i].status||'actif',
          source: USERS[i].source||'sso',
          Title: USERS[i].name||USERS[i].email,
        });
      } catch(e){ console.warn('[Roles] save error:', e.message); }
    }
  }
  addHist('edit', 'Rôle de '+entry.name+' changé en '+newRole+' ('+updated+' alias)');
  renderUsersTbl();
  toast('Rôle mis à jour ('+updated+' alias) ✓');
}

// Conservée pour compat (ancien appel direct par index USERS)
function changeRole(i,r){
  if (USERS[i]) USERS[i].role=r;
  renderUsersTbl();
  toast('Rôle mis à jour');
}
function showInviteModal(){
  openModal('Inviter un membre',
    '<div style="font-size:12px;color:var(--text-2);margin-bottom:.75rem;line-height:1.5">'
    +'L\'utilisateur doit déjà avoir un compte Microsoft de l\'entreprise. '
    +'Une fois ajouté, il pourra se connecter immédiatement avec son compte SSO.</div>'
    +'<div><label>Prénom Nom</label><input id="iv-nm" placeholder="ex : Jean Martin"/></div>'
    +'<div><label>Email professionnel</label><input id="iv-em" placeholder="jean.martin@74software.com"/></div>'
    +'<div><label>Rôle</label><select id="iv-rl"><option value="admin">Admin / Directeur</option><option value="auditeur" selected>Auditeur(rice)</option><option value="viewer">Observateur (lecture seule)</option></select></div>',
    async function(){
      var name=document.getElementById('iv-nm').value.trim();
      var email=document.getElementById('iv-em').value.trim();
      var role=document.getElementById('iv-rl').value;
      if(!name||!email){toast('Nom et email obligatoires');return;}
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('Email invalide');return;}
      try {
        await inviteUser(email, name, role);
        addHist('add', name+' invité(e)');
        renderUsersTbl();
        toast(name+' ajouté(e) ✓');
      } catch(e) {
        console.error('inviteUser error:', e);
        toast('Erreur lors de l\'ajout : '+(e.message||'inconnue'));
      }
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
  // Compter les docs de l'audit
  const audData = getAudData(CA);
  const docsCount = (audData.docs || []).length;
  // État panneau ouvert/fermé (lu depuis variable globale, par défaut fermé)
  if (typeof DOCS_PANEL_OPEN === 'undefined') window.DOCS_PANEL_OPEN = false;
  const panelOpen = !!window.DOCS_PANEL_OPEN;
  return `
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="bs" onclick="nav('dashboard')">← Retour</button>
        <div class="tbtitle">${a.name}</div>
      </div>
      <div style="display:flex;gap:7px" id="step-actions">
        <button class="bs" onclick="toggleDocsPanel()" style="font-size:11px;${panelOpen?'background:#EEEDFE;color:#3C3489;border-color:#CECBF6':''}" title="Voir les documents de l'audit">📁 Documents (${docsCount})</button>
        <button class="bs" onclick="exportAuditPDF(CA)" style="font-size:11px;">⬇ Export PDF</button>
        ${getStepActionButtonHTML()}
      </div>
    </div>
    <div class="content">
      <div id="audit-header-compact">${renderAuditHeaderCompact(a, step, pct)}</div>
      <div id="det-layout" style="display:grid;grid-template-columns:${panelOpen?'1fr 320px':'1fr'};gap:14px;align-items:start">
        <div id="det-content" style="min-width:0">${renderDetContent()}</div>
        ${panelOpen ? '<div id="docs-panel" style="position:sticky;top:14px;max-height:calc(100vh - 140px)">'+renderDocsPanel()+'</div>' : ''}
      </div>
    </div>`;
};
I['audit-detail']=()=>{};

// ─── Panel "Documents" sticky à droite (option 2 — workflow audit) ────────
window.DOCS_PANEL_OPEN = false;

function toggleDocsPanel() {
  window.DOCS_PANEL_OPEN = !window.DOCS_PANEL_OPEN;
  // Re-render via nav() (la fonction officielle de routage)
  if (typeof nav === 'function' && CA) {
    nav('audit-detail');
  } else {
    // Fallback : rebuild manuel
    var c = document.getElementById('vc');
    if (c) {
      c.innerHTML = V['audit-detail']();
      if (I['audit-detail']) I['audit-detail']();
    }
  }
}

function renderDocsPanel() {
  var d = getAudData(CA);
  var docs = d.docs || [];
  var STEPS_LOCAL = (typeof STEPS !== 'undefined') ? STEPS : [];

  // Grouper par étape
  var byStep = {};
  var noStep = [];
  docs.forEach(function(doc, idx){
    var step = (typeof doc.step === 'number') ? doc.step : null;
    if (step === null || step === undefined) {
      noStep.push({doc: doc, idx: idx});
    } else {
      if (!byStep[step]) byStep[step] = [];
      byStep[step].push({doc: doc, idx: idx});
    }
  });

  var html = '<div class="card" style="padding:0;overflow:hidden;display:flex;flex-direction:column;height:100%">';
  // Header
  html += '<div style="padding:12px 14px;border-bottom:.5px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">';
  html += '<div style="font-size:13px;font-weight:600;color:var(--text-1)">📁 Documents <span style="font-size:11px;font-weight:400;color:var(--text-3)">('+docs.length+')</span></div>';
  html += '<button class="bs" onclick="toggleDocsPanel()" style="font-size:13px;padding:2px 8px;line-height:1" title="Fermer">✕</button>';
  html += '</div>';

  // Search
  html += '<div style="padding:10px 14px;border-bottom:.5px solid var(--border);flex-shrink:0">';
  html += '<input id="docs-panel-search" placeholder="Rechercher..." oninput="filterDocsPanel(this.value)" style="width:100%;font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px"/>';
  html += '</div>';

  // Body scrollable
  html += '<div id="docs-panel-list" style="flex:1;overflow-y:auto;padding:8px 6px">';

  if (!docs.length) {
    html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;text-align:center;padding:1.5rem 1rem">Aucun document uploadé pour cet audit.</div>';
  } else {
    // Sections par étape (ordonnées 0..9)
    var stepKeys = Object.keys(byStep).map(Number).sort(function(a,b){return a-b;});
    stepKeys.forEach(function(stepIdx){
      var stepName = STEPS_LOCAL[stepIdx] ? (STEPS_LOCAL[stepIdx].s || ('Étape '+(stepIdx+1))) : ('Étape '+(stepIdx+1));
      html += '<div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.3px;padding:8px 8px 4px 8px;font-weight:500">Étape '+(stepIdx+1)+' — '+stepName+'</div>';
      byStep[stepIdx].forEach(function(item){
        html += renderDocsPanelItem(item.doc, item.idx);
      });
    });
    if (noStep.length) {
      html += '<div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.3px;padding:8px 8px 4px 8px;font-weight:500">Sans étape</div>';
      noStep.forEach(function(item){
        html += renderDocsPanelItem(item.doc, item.idx);
      });
    }
  }

  html += '</div></div>';
  return html;
}

function renderDocsPanelItem(doc, idx) {
  var ext = ((doc.name||'').split('.').pop()||'').toUpperCase();
  // Couleur du badge selon le type
  var badge = {bg:'#F1EFE8', fg:'#5F5E5A', label: ext||'?'};
  if (ext === 'PDF') badge = {bg:'#FAECE7', fg:'#993C1D', label:'PDF'};
  else if (['PNG','JPG','JPEG','GIF','WEBP'].indexOf(ext)>=0) badge = {bg:'#E1F5EE', fg:'#0F6E56', label:ext};
  else if (['DOC','DOCX'].indexOf(ext)>=0) badge = {bg:'#E6F1FB', fg:'#0C447C', label:ext};
  else if (['XLS','XLSX'].indexOf(ext)>=0) badge = {bg:'#EAF3DE', fg:'#3B6D11', label:ext};
  else if (['PPT','PPTX'].indexOf(ext)>=0) badge = {bg:'#FBEAF0', fg:'#993556', label:ext};

  var name = doc.name || 'fichier';
  var meta = [];
  if (doc.uploadedBy) meta.push(doc.uploadedBy);
  if (doc.size) meta.push(doc.size);

  var canView = doc.driveId && doc.itemId;
  var clickAttr = canView ? 'onclick="openDocViewer(getAudData(CA).docs['+idx+'])" style="cursor:pointer"' : 'style="cursor:default;opacity:0.7"';

  var html = '<div class="docs-panel-item" data-name="'+_escQ((name||'').toLowerCase())+'" '+clickAttr+' style="display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:4px;margin-bottom:1px" onmouseover="this.style.background=\'#f5f5f5\'" onmouseout="this.style.background=\'transparent\'">';
  html += '<div style="width:22px;height:22px;background:'+badge.bg+';color:'+badge.fg+';border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:600;flex-shrink:0">'+badge.label+'</div>';
  html += '<div style="flex:1;min-width:0">';
  html += '<div style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-1)" title="'+_escQ(name)+'">'+name+'</div>';
  if (meta.length) {
    html += '<div style="font-size:9px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+meta.join(' · ')+'</div>';
  }
  html += '</div>';
  if (canView) {
    html += '<span style="font-size:11px;color:var(--text-3);flex-shrink:0">👁</span>';
  }
  html += '</div>';
  return html;
}

function filterDocsPanel(q) {
  q = (q||'').toLowerCase().trim();
  var items = document.querySelectorAll('.docs-panel-item');
  items.forEach(function(it){
    var name = it.getAttribute('data-name') || '';
    it.style.display = (!q || name.indexOf(q)>=0) ? '' : 'none';
  });
  // Cacher les sections vides
  var sections = document.querySelectorAll('#docs-panel-list > div[style*="text-transform"]');
  sections.forEach(function(sec){
    // Sibling cards visibles ?
    var sib = sec.nextElementSibling;
    var hasVisible = false;
    while (sib && !sib.style.cssText.includes('text-transform')) {
      if (sib.style.display !== 'none') { hasVisible = true; break; }
      sib = sib.nextElementSibling;
    }
    sec.style.display = hasVisible ? '' : 'none';
  });
}

// Rafraîchit le panel docs et le compteur dans la topbar (à appeler après tout changement de docs)
function refreshDocsPanel() {
  // Compteur dans la topbar
  var topbarBtn = document.querySelector('#step-actions button[onclick="toggleDocsPanel()"]');
  if (topbarBtn) {
    var d = getAudData(CA);
    var n = (d.docs || []).length;
    topbarBtn.innerHTML = '📁 Documents ('+n+')';
  }
  // Panel content (si ouvert)
  var panel = document.getElementById('docs-panel');
  if (panel) panel.innerHTML = renderDocsPanel();
}

function getStepTabs(){return ['main'];} // gardé pour compat (plus utilisé avec onglets)
const TLBL={'main':'Détail'};
function renderDetTabs(){return '';}

// ─── Nouveau header compact (option B - phases colorées) ───────────────
function renderAuditHeaderCompact(a, step, pct) {
  var d = getAudData(CA);
  var keyStep = isKeyStep(CS);
  var state = getStepState(CA, CS);
  var isAdmin = CU && CU.role === 'admin';
  var prepDone = (state.status === 'finalized' || state.status === 'reviewed');
  var revDone = (state.status === 'reviewed');

  // Statut de l'étape sous forme de capsule
  var statusPill;
  if (revDone) {
    statusPill = '<span style="background:#E1F5EE;color:#085041;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:500">✓ Revue & validée</span>';
  } else if (prepDone) {
    statusPill = '<span style="background:#E6F1FB;color:#0C447C;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:500">⏳ En attente revue</span>';
  } else {
    statusPill = '<span style="background:#F1EFE8;color:#5F5E5A;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:500">À faire</span>';
  }

  // Bouton d'action selon le rôle et l'état
  var actionBtn = '';
  if (!prepDone) {
    actionBtn = '<button class="bs" style="font-size:11px;padding:5px 12px" onclick="toggleStepPrepDone(true)">Marquer prête pour revue</button>';
  } else if (prepDone && !revDone && isAdmin) {
    actionBtn = '<button class="bp" style="font-size:11px;padding:5px 12px" onclick="toggleStepReviewed(true)">Valider la revue</button>';
  } else if (prepDone && !revDone && !isAdmin) {
    actionBtn = '<span style="font-size:11px;color:var(--text-3);padding:5px 0;font-style:italic">En attente d\'un admin</span>';
  } else {
    actionBtn = '<button class="bs" style="font-size:11px;padding:5px 12px" onclick="toggleStepReviewed(false)">Rouvrir l\'étape</button>';
  }

  // Construction du stepper en 3 phases colorées
  var phases = [
    {idxs: [0,1,2],   name: 'Préparation', bg: '#EEEDFE', txt: '#3C3489'},
    {idxs: [3,4,5],   name: 'Réalisation', bg: '#E1F5EE', txt: '#085041'},
    {idxs: [6,7,8,9], name: 'Restitution', bg: '#FAEEDA', txt: '#854F0B'},
  ];

  var phaseHtml = phases.map(function(p){
    var stepDots = p.idxs.map(function(i, idx){
      var isDone = i < CS;
      var isActive = i === CS;
      var dotStyle = isDone
        ? 'background:'+p.txt+';color:#fff;border:none'
        : isActive
        ? 'background:#fff;color:'+p.txt+';border:2px solid '+p.txt+';font-weight:500'
        : 'background:#fff;color:'+p.txt+';border:1px solid '+p.txt+';opacity:0.4';
      var dotContent = isDone ? '✓' : (i+1);
      var separator = idx < p.idxs.length - 1
        ? '<div style="flex:1;height:2px;background:'+(i<CS?p.txt:p.txt+'40')+';min-width:6px"></div>'
        : '';
      return '<div onclick="goStep('+i+')" style="width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer;flex-shrink:0;'+dotStyle+'" title="'+STEPS[i].s+'">'+dotContent+'</div>'+separator;
    }).join('');
    return '<div style="background:'+p.bg+';padding:7px 10px;border-radius:6px;flex:'+p.idxs.length+'">'
      + '<div style="font-size:9px;color:'+p.txt+';font-weight:500;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">'+p.name+'</div>'
      + '<div style="display:flex;align-items:center;gap:0">'+stepDots+'</div>'
      + '</div>';
  }).join('<div style="width:6px"></div>');

  // En-tête final
  var html = '<div class="card" style="margin-bottom:1rem;padding:14px 16px">';

  // Ligne 1 : capsules de statut + bouton d'action
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">';
  html += '<span style="background:#EEEDFE;color:#3C3489;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:500">⏳ '+pct+'%</span>';
  if (keyStep) {
    html += '<span style="background:#FAEEDA;color:#854F0B;padding:4px 10px;border-radius:6px;font-size:11px">⚡ Étape clé</span>';
  }
  html += statusPill;
  html += '<div style="margin-left:auto">'+actionBtn+'</div>';
  html += '</div>';

  // Ligne 2 : stepper en 3 phases colorées
  html += '<div style="display:flex;align-items:stretch">'+phaseHtml+'</div>';

  // Ligne 3 : nom de l'étape courante
  html += '<div style="font-size:12px;color:var(--text-2);margin-top:8px;text-align:center">';
  html += 'Étape '+(CS+1)+'/10 — <strong>'+step.s+'</strong>';
  html += '</div>';

  html += '</div>';
  return html;
}

function renderStepper(){
  // Wrapper pour rétrocompatibilité (appelé ailleurs dans le code)
  const a = getAudits().find(x => x.id === CA);
  if (!a) return '';
  const step = STEPS[CS] || {s:'—'};
  const pct = Math.min(100, (CS + 1) * 10);
  return renderAuditHeaderCompact(a, step, pct);
}

// ══════════════════════════════════════════════════════════════
//  RENDER DET CONTENT — Layout commun (Workflow + Statut + Documents + Notes)
//  + sections spécifiques métier pour étapes 5/6/7/8
// ══════════════════════════════════════════════════════════════
function renderDetContent(){
  const a=getAudits().find(x=>x.id===CA);
  if (!a) return '';
  const s=STEPS[CS];
  const d=getAudData(CA);
  var isAdmin = CU && CU.role === 'admin';
  var isPreparer = (a.assignedTo||a.auditeurs||[]).indexOf(CU&&CU.id)>=0 || isAdmin;

  var html = '';

  // L'en-tête (étape + statut + workflow + cases revue) est désormais dans renderAuditHeaderCompact
  // Plus besoin de répéter ici.

  // ── 3. SECTIONS SPÉCIFIQUES MÉTIER selon l'étape ─────────
  if (CS === 1) {
    // Étape 2 (index 1) : Work Program — préparation du Kick Off
    html += renderKickoffPrepSection();
  } else if (CS === 2) {
    // Étape 3 (index 2) : Audit Kick Off — bouton de génération mis en avant
    html += renderKickoffGenerateBanner();
  } else if (CS === 4) {
    // Étape 5 (index 4) : ITW : WCGW & Contrôles (groupés)
    html += renderRiskSection();
    html += renderWCGWSection();
    // renderControlsSection désactivée - tout est dans renderWCGWSection
  } else if (CS === 5) {
    // Étape 6 (index 5) : Testings — tests des contrôles uniquement
    html += renderTestsSection();
  } else if (CS === 6) {
    // Étape 7 (index 6) : Report — Header + Maturity (côte-à-côte) puis Findings
    html += renderAuditReportGenerateBanner();
    html += renderHeaderAndMaturitySection();
    html += renderFindingsSection();
  } else if (CS === 8) {
    // Étape 9 (index 8) : Management Responses
    html += renderMgtRespSection();
  }

  // ── 4. DOCUMENTS ─────────────────────────────────────────
  html += renderDocumentsSection();

  // ── 5. NOTES (préparer + reviewer) ───────────────────────
  html += renderNotesSection();

  // Rafraîchir le panel docs (compteur + contenu) après le re-render de det-content
  setTimeout(function(){ if (typeof refreshDocsPanel === 'function') refreshDocsPanel(); }, 0);

  return html;
}

// ─── Helpers de rendu de sections ─────────────────────────

function renderWorkflowSection() {
  var keyStep = isKeyStep(CS);
  var html = '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2)">Workflow</div>';
  if (keyStep) {
    html += '<span class="badge bpc" style="font-size:10px">⚡ Étape clé — revue requise</span>';
  } else {
    html += '<span class="badge bpl" style="font-size:10px">Étape standard</span>';
  }
  html += '</div>';
  if (keyStep) {
    html += '<div style="font-size:11px;color:var(--text-3);margin-top:6px">Cette étape doit être finalisée par le préparer puis revue par l\'admin avant validation.</div>';
  }
  html += '</div>';
  return html;
}

function renderStatusSection() {
  var state = getStepState(CA, CS);
  var isAdmin = CU && CU.role === 'admin';
  var keyStep = isKeyStep(CS);

  // Pour les étapes non-clé, on garde un statut simplifié
  // Pour les étapes clé, on a 3 états : preparation / finalized / reviewed
  var prepDone = (state.status === 'finalized' || state.status === 'reviewed');
  var revDone = (state.status === 'reviewed');

  var html = '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:8px">Statut de l\'étape</div>';
  html += '<div style="display:flex;flex-direction:column;gap:8px">';

  // Case 1 : "Étape exécutée — prête pour revue" (préparer)
  html += '<label style="display:flex !important;align-items:center !important;flex-direction:row !important;gap:8px;font-size:12px;width:auto !important;padding:0 !important;cursor:pointer">'
    + '<input type="checkbox" '+(prepDone?'checked':'')+' '+(prepDone&&!isAdmin?'disabled':'')+' onchange="toggleStepPrepDone(this.checked)" style="width:14px !important">'
    + '<span style="flex:1">Étape exécutée — prête pour revue</span>'
    + '<span style="font-size:10px;color:var(--text-3)">(préparer)</span>'
    + '</label>';
  if (state.finalizedBy && state.finalizedAt) {
    html += '<div style="font-size:10px;color:var(--text-3);padding-left:22px;margin-top:-6px">Par '+state.finalizedBy+' le '+new Date(state.finalizedAt).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})+'</div>';
  }

  // Case 2 : "Étape revue et validée" (admin uniquement)
  html += '<label style="display:flex !important;align-items:center !important;flex-direction:row !important;gap:8px;font-size:12px;width:auto !important;padding:0 !important;cursor:'+(isAdmin&&prepDone?'pointer':'not-allowed')+';opacity:'+(prepDone?'1':'.5')+'">'
    + '<input type="checkbox" '+(revDone?'checked':'')+' '+(!isAdmin||!prepDone?'disabled':'')+' onchange="toggleStepReviewed(this.checked)" style="width:14px !important">'
    + '<span style="flex:1">Étape revue et validée</span>'
    + '<span style="font-size:10px;color:var(--text-3)">(admin)</span>'
    + '</label>';
  if (state.reviewedBy && state.reviewedAt) {
    html += '<div style="font-size:10px;color:var(--text-3);padding-left:22px;margin-top:-6px">Par '+state.reviewedBy+' le '+new Date(state.reviewedAt).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})+'</div>';
  }

  html += '</div></div>';
  return html;
}

function renderDocumentsSection() {
  var d = getAudData(CA);
  var expectedDocs = (typeof EXPECTED_DOCS_BY_STEP !== 'undefined' && EXPECTED_DOCS_BY_STEP[CS]) ? EXPECTED_DOCS_BY_STEP[CS] : [];
  var stepDocs = (d.docs||[]).filter(function(doc){
    return doc && (doc.step === CS || doc.step === undefined); // compat avec docs sans step
  });
  var isAdmin = CU && CU.role === 'admin';

  var html = '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2)">Documents</div>';
  html += '<button class="bs" style="font-size:11px;padding:3px 9px" onclick="addFreeDocument()">+ Document libre</button>';
  html += '</div>';

  if (!expectedDocs.length && !stepDocs.length) {
    html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:.5rem">Aucun document attendu pour cette étape.</div>';
  }

  // Afficher chaque document attendu (même si pas encore uploadé)
  expectedDocs.forEach(function(expectedName){
    var matchingDoc = stepDocs.find(function(doc){
      return (doc.expectedName === expectedName) || (doc.name||'').toLowerCase().indexOf(expectedName.toLowerCase()) >= 0;
    });
    html += renderDocumentRow(expectedName, matchingDoc, true, isAdmin);
  });

  // Afficher les docs additionnels (libres) qui ne correspondent à aucun document attendu
  stepDocs.forEach(function(doc){
    var isMatched = expectedDocs.some(function(expectedName){
      return (doc.expectedName === expectedName) || (doc.name||'').toLowerCase().indexOf(expectedName.toLowerCase()) >= 0;
    });
    if (!isMatched) {
      html += renderDocumentRow(doc.name, doc, false, isAdmin);
    }
  });

  html += '</div>';
  return html;
}

function renderDocumentRow(label, doc, isExpected, isAdmin) {
  var hasDoc = !!doc;
  var reviewed = doc && doc.reviewStatus === 'reviewed';
  var pendingReview = doc && doc.reviewStatus === 'pending';

  var html = '<div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:8px 0;border-top:.5px solid var(--border)">';
  // Colonne label + détails fichier
  html += '<div style="min-width:0">';
  html += '<div style="font-size:12px;font-weight:500;display:flex;align-items:center;gap:6px">';
  html += '<span>'+label+'</span>';
  if (isExpected) html += '<span style="font-size:9px;color:var(--text-3)">(attendu)</span>';
  // Bouton génération auto pour Kick Off à l'étape 3 (CS=2)
  if ((label === 'Kick-Off Presentation' || label === 'Présentation de cadrage' || label === 'Mémo de Kick-Off') && CS === 2) {
    html += '<button class="bs" style="font-size:10px;padding:2px 7px;background:#EEEDFE;color:#3C3489;border-color:#CECBF6" onclick="generateKickoffPptx(CA);event.stopPropagation();">⬇ Générer</button>';
  }
  // Bouton génération auto pour Audit Report à l'étape 7 (CS=6)
  if ((label === 'Rapport d\'audit (draft)' || label === 'Rapport d\'audit (final)') && CS === 6) {
    html += '<button class="bs" style="font-size:10px;padding:2px 7px;background:#FAEEDA;color:#854F0B;border-color:#FAC775" onclick="generateAuditReportPptx(CA);event.stopPropagation();">⬇ Générer</button>';
  }
  html += '</div>';
  if (hasDoc) {
    html += '<div style="font-size:10px;color:var(--text-3);margin-top:2px">'+(doc.name||'fichier')+(doc.size?' — '+doc.size:'')+(doc.uploadedBy?' · par '+doc.uploadedBy:'')+'</div>';
  } else {
    html += '<div style="font-size:10px;color:var(--text-3);margin-top:2px;font-style:italic">Aucun fichier attaché</div>';
  }
  html += '</div>';
  // Colonne actions
  html += '<div style="display:flex;gap:5px;flex-wrap:nowrap">';
  if (!hasDoc) {
    html += '<button class="bs" style="font-size:10px;padding:3px 8px" onclick="attachExpectedDocument(\''+_escQ(label)+'\')">Attacher un document</button>';
  } else {
    if (!reviewed) {
      if (!pendingReview) {
        html += '<button class="bs" style="font-size:10px;padding:3px 8px" onclick="markDocPendingReview(\''+doc.id+'\')">Prêt pour revue</button>';
      } else {
        html += '<span class="badge" style="background:#FAEEDA;color:#854F0B;font-size:9px;padding:3px 7px">⏳ En attente revue</span>';
        if (isAdmin) {
          html += '<button class="bs" style="font-size:10px;padding:3px 8px" onclick="markDocReviewed(\''+doc.id+'\')">Document revu</button>';
        }
      }
    } else {
      html += '<span class="badge bdn" style="font-size:9px;padding:3px 7px">✓ Revu</span>';
    }
    if (doc.driveId && doc.itemId) {
      html += '<button class="bs" style="font-size:10px;padding:3px 6px;background:#EEEDFE;color:#3C3489;border-color:#CECBF6" onclick="openDocByDriveItem(\''+doc.driveId+'\',\''+doc.itemId+'\',\''+(doc.name||'').replace(/'/g,"\\'")+'\',\''+(doc.url||'').replace(/'/g,"\\'")+'\')" title="Voir">👁</button>';
    }
    html += '<button class="bs" style="font-size:10px;padding:3px 6px" onclick="downloadDoc(\''+doc.id+'\')" title="Télécharger">⬇</button>';
    html += '<button class="bd" style="font-size:10px;padding:3px 6px" onclick="removeDoc(\''+doc.id+'\')" title="Supprimer">×</button>';
  }
  html += '</div>';
  html += '</div>';
  return html;
}

function renderNotesSection() {
  var d = getAudData(CA);
  // Stockage : d.prepNotes[CS] et d.revNotes[CS]
  if (!d.prepNotes) d.prepNotes = {};
  if (!d.revNotes) d.revNotes = {};
  var prepNote = d.prepNotes[CS] || '';
  var revNote = d.revNotes[CS] || '';
  var isAdmin = CU && CU.role === 'admin';

  var html = '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:10px">Notes</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
  html += '<div>';
  html += '<label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:4px">Notes du préparer</label>';
  html += '<textarea id="prep-notes-'+CS+'" placeholder="Notes pendant l\'exécution..." style="width:100%;min-height:80px;resize:vertical;font-size:12px" onchange="saveStepNote(\'prep\', this.value)">'+prepNote+'</textarea>';
  html += '</div>';
  html += '<div>';
  html += '<label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:4px">Notes du reviewer'+(!isAdmin?' (lecture seule)':'')+'</label>';
  html += '<textarea id="rev-notes-'+CS+'" placeholder="Commentaires de revue..." style="width:100%;min-height:80px;resize:vertical;font-size:12px" '+(!isAdmin?'readonly':'')+' onchange="saveStepNote(\'rev\', this.value)">'+revNote+'</textarea>';
  html += '</div>';
  html += '</div>';
  html += '</div>';
  return html;
}

// ─── ÉTAPE 7 (CS=6) : Bandeau de génération du Audit Report ───────────
function renderAuditReportGenerateBanner() {
  var d = getAudData(CA);
  var findings = Array.isArray(d.findings) ? d.findings : [];
  var maturity = d.maturity;
  var mgtResp = Array.isArray(d.mgtResp) ? d.mgtResp : [];
  var controls = (d.controls && d.controls[4]) || [];
  var testedControls = controls.filter(function(c){return c.clef && c.design==='existing' && c.finalized;});

  var findingsCount = findings.length;
  var findingsComplete = findings.filter(function(f){return f.title && f.potentialRisk && f.owner && f.probability && f.impact;}).length;
  var maturityFilled = !!maturity;
  var mgtRespCount = mgtResp.filter(function(r){return r.action;}).length;

  var html = '<div class="card" style="margin-bottom:.75rem;background:linear-gradient(135deg,#FAEEDA 0%,#FFF4D9 100%);border:.5px solid #FAC775">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">';
  html += '<div style="flex:1;min-width:200px">';
  html += '<div style="font-size:14px;font-weight:600;color:#854F0B;margin-bottom:4px">📄 Audit Report</div>';
  html += '<div style="font-size:11px;color:#BA7517;margin-bottom:8px">Génération automatique du rapport d\'audit PowerPoint à partir des données de l\'audit.</div>';
  html += '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:#854F0B">';
  html += '<span>'+(findingsCount?'✓':'○')+' Findings ('+findingsComplete+'/'+findingsCount+' complets)</span>';
  html += '<span>'+(testedControls.length?'✓':'○')+' Tests ('+testedControls.length+')</span>';
  html += '<span>'+(maturityFilled?'✓':'○')+' Maturity</span>';
  html += '<span>'+(mgtRespCount?'✓':'○')+' Mgt Responses ('+mgtRespCount+')</span>';
  html += '</div>';
  html += '</div>';
  html += '<button class="bp" style="font-size:13px;padding:8px 18px;background:#854F0B;color:#fff;font-weight:500" onclick="generateAuditReportPptx(CA)">⬇ Générer le Audit Report</button>';
  html += '</div>';
  if (!findingsCount) {
    html += '<div style="font-size:10px;color:#854F0B;margin-top:10px;padding:6px 10px;background:#FAEEDA;border-radius:4px;font-style:italic">⚠ Aucun finding défini. Le rapport sera généré sans détail de findings.</div>';
  } else if (findingsComplete < findingsCount) {
    html += '<div style="font-size:10px;color:#854F0B;margin-top:10px;padding:6px 10px;background:#FAEEDA;border-radius:4px;font-style:italic">ⓘ '+(findingsCount-findingsComplete)+' finding(s) incomplet(s) (Potential Risk, Owner ou Risk Level manquant). Ils apparaîtront avec « — » dans le rapport.</div>';
  }
  html += '</div>';
  return html;
}

// ─── ÉTAPE 3 (CS=2) : Bandeau de génération du Kick Off ───────────────
function renderKickoffGenerateBanner() {
  var d = getAudData(CA);
  var prep = d.kickoffPrep || {};
  var subProcesses = Array.isArray(prep.subProcesses) ? prep.subProcesses : [];
  var interviews = Array.isArray(prep.interviews) ? prep.interviews : [];
  var planning = prep.planning || {};

  // Compter ce qui est rempli
  var subProcCount = subProcesses.length;
  var interviewsCount = interviews.length;
  var planningCount = Object.values(planning).filter(Boolean).length;

  var html = '<div class="card" style="margin-bottom:.75rem;background:linear-gradient(135deg,#EEEDFE 0%,#F5F4FE 100%);border:.5px solid #CECBF6">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">';
  html += '<div style="flex:1;min-width:200px">';
  html += '<div style="font-size:14px;font-weight:600;color:#3C3489;margin-bottom:4px">📊 Kick Off Presentation</div>';
  html += '<div style="font-size:11px;color:#534AB7;margin-bottom:8px">Génération automatique du PowerPoint à partir des données de l\'audit.</div>';
  html += '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:#3C3489">';
  html += '<span>'+(subProcCount?'✓':'○')+' Sous-processus ('+subProcCount+')</span>';
  html += '<span>'+(interviewsCount?'✓':'○')+' Interviews ('+interviewsCount+')</span>';
  html += '<span>'+(planningCount?'✓':'○')+' Planning ('+planningCount+'/5)</span>';
  html += '</div>';
  html += '</div>';
  html += '<button class="bp" style="font-size:13px;padding:8px 18px;background:#3C3489;color:#fff;font-weight:500" onclick="generateKickoffPptx(CA)">⬇ Générer le Kick Off</button>';
  html += '</div>';
  if (!subProcCount && !interviewsCount && !planningCount) {
    html += '<div style="font-size:10px;color:#854F0B;margin-top:10px;padding:6px 10px;background:#FAEEDA;border-radius:4px;font-style:italic">⚠ Aucune information saisie en étape Work Program. Le PowerPoint sera généré avec des sections vides à compléter manuellement.</div>';
  }
  html += '</div>';
  return html;
}

// ─── ÉTAPE 2 (CS=1) : Préparation du Kick Off ─────────────────────────
function renderKickoffPrepSection() {
  var d = getAudData(CA);
  if (!d.kickoffPrep) d.kickoffPrep = {};
  var p = d.kickoffPrep;
  if (!Array.isArray(p.subProcesses)) p.subProcesses = [];
  if (!Array.isArray(p.interviews)) p.interviews = [];
  if (!p.planning) p.planning = {kickOff:'', interviews:'', testing:'', report:'', restitution:''};

  var html = '';

  // ── SECTION 1 : Périmètre & Scope (sous-processus) ─────────
  html += '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
  html += '<span style="font-size:12px;font-weight:600;color:var(--text-2)">Périmètre & Scope <span style="font-size:10px;font-weight:400;color:var(--text-3)">('+p.subProcesses.length+' sous-processus)</span></span>';
  html += '<button class="bs" style="font-size:11px;padding:3px 9px" onclick="addSubProcess()">+ Ajouter un sous-processus</button>';
  html += '</div>';
  html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:10px;font-style:italic">Découpage du processus audité en sous-processus avec leur description et owners. Apparaîtra en slide « Audit Scope » du Kick Off.</div>';

  if (!p.subProcesses.length) {
    html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:.5rem;text-align:center;border:1px dashed var(--border);border-radius:4px">Aucun sous-processus défini. Cliquez sur « + Ajouter un sous-processus ».</div>';
  } else {
    p.subProcesses.forEach(function(sp, idx){
      html += '<div style="border:.5px solid var(--border);border-radius:6px;padding:10px;margin-bottom:8px;background:#fafafa">';
      html += '<div style="display:grid;grid-template-columns:1.5fr 2fr 1.5fr auto;gap:8px;align-items:start">';
      // Nom
      html += '<div>';
      html += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Sous-processus</label>';
      html += '<input value="'+(sp.name||'').replace(/"/g,'&quot;')+'" placeholder="ex : Order entry" onchange="setSubProcess('+idx+',\'name\',this.value)" style="width:100%;font-size:11px;padding:5px 7px;border:1px solid var(--border);border-radius:3px"/>';
      html += '</div>';
      // Description
      html += '<div>';
      html += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Description</label>';
      html += '<textarea onchange="setSubProcess('+idx+',\'description\',this.value)" placeholder="ex : Saisie commandes clients dans SAP" style="width:100%;min-height:48px;font-size:11px;padding:5px 7px;border:1px solid var(--border);border-radius:3px;resize:vertical">'+(sp.description||'').replace(/</g,'&lt;')+'</textarea>';
      html += '</div>';
      // Owner(s) + email
      html += '<div>';
      html += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Owner(s)</label>';
      html += '<input value="'+(sp.owners||'').replace(/"/g,'&quot;')+'" placeholder="ex : J. Smith, M. Dupont" onchange="setSubProcess('+idx+',\'owners\',this.value)" style="width:100%;font-size:11px;padding:5px 7px;border:1px solid var(--border);border-radius:3px;margin-bottom:4px"/>';
      html += '<input value="'+(sp.email||'').replace(/"/g,'&quot;')+'" type="email" placeholder="email facultatif" onchange="setSubProcess('+idx+',\'email\',this.value)" style="width:100%;font-size:10px;padding:4px 7px;border:1px solid var(--border);border-radius:3px;color:var(--text-2)"/>';
      html += '</div>';
      // Bouton supprimer
      html += '<button class="bd" style="font-size:11px;padding:4px 8px;align-self:start;margin-top:14px" onclick="removeSubProcess('+idx+')" title="Supprimer">×</button>';
      html += '</div>';
      html += '</div>';
    });
  }

  // ── Sous-section : Risques de l'audit (URD + ad hoc) ──────
  html += renderAuditRisksSubsection();

  html += '</div>';

  // ── SECTION 2 : Interviews planifiées (inchangée) ──────────
  html += '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
  html += '<span style="font-size:12px;font-weight:600;color:var(--text-2)">Interviews planifiées <span style="font-size:10px;font-weight:400;color:var(--text-3)">('+p.interviews.length+')</span></span>';
  html += '<button class="bs" style="font-size:11px;padding:3px 9px" onclick="addKickoffInterview()">+ Ajouter une interview</button>';
  html += '</div>';
  html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:10px;font-style:italic">Liste des entretiens prévus pendant l\'audit. Apparaîtra en slide « Interviews » du Kick Off.</div>';

  if (!p.interviews.length) {
    html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:.5rem;text-align:center;border:1px dashed var(--border);border-radius:4px">Aucune interview planifiée. Cliquez sur « + Ajouter une interview ».</div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:1fr 1.2fr 1.4fr 1.4fr 30px;gap:6px;font-size:10px;color:var(--text-3);font-weight:500;padding:4px 0;border-bottom:.5px solid var(--border)">';
    html += '<span>Département</span><span>Main contact</span><span>Email</span><span>Timeslot</span><span></span>';
    html += '</div>';
    p.interviews.forEach(function(itw, idx){
      // Détecter le mode courant : si timeslot vaut '__tbd__' ou commence par 'TBD' → mode "Slot not defined yet"
      var ts = itw.timeslot || '';
      var isTbd = (ts === '__tbd__' || ts === 'Slot not defined yet');
      var dateValue = isTbd ? '' : ts;
      // Vérifier si la valeur actuelle ressemble à une date YYYY-MM-DD ; sinon afficher en texte libre
      var isDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue);
      html += '<div style="display:grid;grid-template-columns:1fr 1.2fr 1.4fr 1.4fr 30px;gap:6px;padding:4px 0;border-bottom:.5px solid var(--border)">';
      html += '<input value="'+(itw.dept||'').replace(/"/g,'&quot;')+'" placeholder="ex : Finance" onchange="setKickoffInterview('+idx+',\'dept\',this.value)" style="font-size:11px;padding:4px 6px;border:1px solid var(--border);border-radius:3px"/>';
      html += '<input value="'+(itw.contact||'').replace(/"/g,'&quot;')+'" placeholder="ex : J. Smith — CFO" onchange="setKickoffInterview('+idx+',\'contact\',this.value)" style="font-size:11px;padding:4px 6px;border:1px solid var(--border);border-radius:3px"/>';
      html += '<input value="'+(itw.email||'').replace(/"/g,'&quot;')+'" type="email" placeholder="j.smith@..." onchange="setKickoffInterview('+idx+',\'email\',this.value)" style="font-size:11px;padding:4px 6px;border:1px solid var(--border);border-radius:3px"/>';
      // Cell "Timeslot" — checkbox TBD + date input
      html += '<div style="display:flex;flex-direction:column;gap:3px">';
      html += '<label style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text-3);cursor:pointer">';
      html += '<input type="checkbox" '+(isTbd?'checked':'')+' onchange="setKickoffInterviewTbd('+idx+',this.checked)" style="margin:0"/>';
      html += '<span>Slot not defined yet</span>';
      html += '</label>';
      if (!isTbd) {
        html += '<input type="date" value="'+(isDate?dateValue:'')+'" onchange="setKickoffInterview('+idx+',\'timeslot\',this.value)" style="font-size:11px;padding:4px 6px;border:1px solid var(--border);border-radius:3px"/>';
      }
      html += '</div>';
      html += '<button class="bd" style="font-size:11px;padding:3px 6px;align-self:start" onclick="removeKickoffInterview('+idx+')" title="Supprimer">×</button>';
      html += '</div>';
    });
  }
  html += '</div>';

  // ── SECTION 3 : Planning - Dates clés (inchangée) ──────────
  html += '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px">Planning — Dates clés</div>';
  html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:10px;font-style:italic">Apparaîtra en slide « Key Deadlines » du Kick Off (transformé en « Week of [date] »).</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">';
  var dateFields = [
    {key:'kickOff',     label:'Kick Off'},
    {key:'interviews',  label:'Interviews — semaine de début'},
    {key:'testing',     label:'Testing — semaine de début'},
    {key:'report',      label:'Rapport — semaine de livraison'},
    {key:'restitution', label:'Restitution ExCom'},
  ];
  dateFields.forEach(function(f){
    html += '<div>';
    html += '<label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px">'+f.label+'</label>';
    html += '<input type="date" value="'+(p.planning[f.key]||'')+'" onchange="setKickoffPlanning(\''+f.key+'\',this.value)" style="width:100%;font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:4px"/>';
    html += '</div>';
  });
  html += '</div>';
  html += '</div>';

  return html;
}

// ─── Sous-section "Risques de l'audit" (dans Périmètre & Scope) ──────
// Affiche les risques URD du processus + risques ad hoc, avec possibilité
// d'ajouter/supprimer des risques ad hoc. Utilisée dans l'étape Work Program.
function renderAuditRisksSubsection() {
  var risks = getAuditRisks(CA);
  var probLabels = {1:'Rare',2:'Peu probable',3:'Probable',4:'Quasi-certain'};
  var impLabels  = {1:'Mineur',2:'Modéré',3:'Majeur',4:'Critique'};

  var html = '';
  html += '<div style="margin-top:1rem;padding-top:.875rem;border-top:.5px solid var(--border)">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
  html += '<span style="font-size:12px;font-weight:600;color:var(--text-2)">Risques de l\'audit <span style="font-size:10px;font-weight:400;color:var(--text-3)">('+risks.length+' risque'+(risks.length>1?'s':'')+')</span></span>';
  html += '<button class="bs" style="font-size:11px;padding:3px 9px" onclick="showAddAuditRiskModal()">+ Ajouter un risque</button>';
  html += '</div>';
  html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:10px;font-style:italic">Risques URD associés au processus (lecture seule, gérés dans Audit Universe) + risques ad hoc spécifiques à cet audit. Apparaîtront dans les slides du Kick Off et seront sélectionnables dans les WCGW à l\'étape Testings.</div>';

  if (!risks.length) {
    html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:.75rem;text-align:center;border:1px dashed var(--border);border-radius:4px">';
    html += 'Aucun risque pour cet audit. Associez des risques URD au processus dans <strong>Audit Universe</strong>, ou cliquez sur « + Ajouter un risque » pour ajouter un risque ad hoc.';
    html += '</div>';
  } else {
    html += '<div style="border:.5px solid var(--border);border-radius:6px;overflow:hidden">';
    html += '<div style="display:grid;grid-template-columns:90px 2fr 1fr 1fr 80px 50px;gap:0;font-size:10px;color:var(--text-3);font-weight:500;background:#fafafa;padding:6px 10px;border-bottom:.5px solid var(--border)">';
    html += '<span>Source</span><span>Risque</span><span>Probabilité</span><span>Impact</span><span style="text-align:center">Score</span><span></span>';
    html += '</div>';
    risks.forEach(function(r){
      var isAdhoc = r.source === 'adhoc';
      var sourceBadge = isAdhoc
        ? '<span class="badge bpc" style="font-size:9px;padding:2px 6px">Ad hoc</span>'
        : '<span class="badge bpl" style="font-size:9px;padding:2px 6px" title="Risque URD du processus '+(r._fromProc||'')+'">URD</span>';
      var score = (r.probability||1) * (r.impact||1);
      var scoreColor = score>=12 ? '#DC2626' : (score>=8 ? '#B45309' : (score>=4 ? '#0C447C' : '#085041'));
      var probDisp = isAdhoc
        ? (r.probability + ' — ' + (probLabels[r.probability]||''))
        : (r.probabilityRaw ? r.probabilityRaw + ' ('+r.probability+')' : r.probability);
      var impDisp = isAdhoc
        ? (r.impact + ' — ' + (impLabels[r.impact]||''))
        : (r.impactRaw ? r.impactRaw + ' ('+r.impact+')' : r.impact);
      html += '<div style="display:grid;grid-template-columns:90px 2fr 1fr 1fr 80px 50px;gap:0;font-size:11px;padding:8px 10px;border-bottom:.5px solid var(--border);align-items:center;background:#fff">';
      html += '<span>'+sourceBadge+'</span>';
      html += '<span><div style="font-weight:500;color:var(--text)">'+(r.title||r.label||'').replace(/</g,'&lt;')+'</div>';
      if (r.description) html += '<div style="font-size:10px;color:var(--text-3);margin-top:2px">'+r.description.replace(/</g,'&lt;')+'</div>';
      html += '</span>';
      html += '<span style="font-size:11px">'+probDisp+'</span>';
      html += '<span style="font-size:11px">'+impDisp+'</span>';
      html += '<span style="text-align:center;font-weight:700;color:'+scoreColor+'">'+score+'</span>';
      html += '<span style="text-align:right">';
      if (isAdhoc) {
        html += '<button class="bd" style="font-size:11px;padding:3px 7px" onclick="removeAuditRisk(\''+r.id+'\')" title="Supprimer ce risque ad hoc">×</button>';
      }
      html += '</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// Setters Sous-processus
async function addSubProcess() {
  var d = getAudData(CA);
  if (!d.kickoffPrep) d.kickoffPrep = {};
  if (!Array.isArray(d.kickoffPrep.subProcesses)) d.kickoffPrep.subProcesses = [];
  d.kickoffPrep.subProcesses.push({name:'', description:'', owners:'', email:''});
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}
async function setSubProcess(idx, field, val) {
  var d = getAudData(CA);
  if (!d.kickoffPrep || !Array.isArray(d.kickoffPrep.subProcesses)) return;
  if (!d.kickoffPrep.subProcesses[idx]) return;
  d.kickoffPrep.subProcesses[idx][field] = val;
  await saveAuditData(CA);
}
async function removeSubProcess(idx) {
  var d = getAudData(CA);
  if (!d.kickoffPrep || !Array.isArray(d.kickoffPrep.subProcesses)) return;
  d.kickoffPrep.subProcesses.splice(idx, 1);
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// Setters Kickoff Prep (planning + interviews — inchangés)
async function setKickoffPlanning(field, val) {
  var d = getAudData(CA);
  if (!d.kickoffPrep) d.kickoffPrep = {};
  if (!d.kickoffPrep.planning) d.kickoffPrep.planning = {};
  d.kickoffPrep.planning[field] = val;
  await saveAuditData(CA);
}
async function addKickoffInterview() {
  var d = getAudData(CA);
  if (!d.kickoffPrep) d.kickoffPrep = {};
  if (!Array.isArray(d.kickoffPrep.interviews)) d.kickoffPrep.interviews = [];
  d.kickoffPrep.interviews.push({dept:'', contact:'', email:'', timeslot:''});
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}
async function setKickoffInterview(idx, field, val) {
  var d = getAudData(CA);
  if (!d.kickoffPrep || !Array.isArray(d.kickoffPrep.interviews)) return;
  if (!d.kickoffPrep.interviews[idx]) return;
  d.kickoffPrep.interviews[idx][field] = val;
  await saveAuditData(CA);
}
async function setKickoffInterviewTbd(idx, isTbd) {
  var d = getAudData(CA);
  if (!d.kickoffPrep || !Array.isArray(d.kickoffPrep.interviews)) return;
  if (!d.kickoffPrep.interviews[idx]) return;
  d.kickoffPrep.interviews[idx].timeslot = isTbd ? '__tbd__' : '';
  await saveAuditData(CA);
  // Re-render pour afficher/masquer le date input
  document.getElementById('det-content').innerHTML = renderDetContent();
}
async function removeKickoffInterview(idx) {
  var d = getAudData(CA);
  if (!d.kickoffPrep || !Array.isArray(d.kickoffPrep.interviews)) return;
  d.kickoffPrep.interviews.splice(idx, 1);
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// ─── Sections métier (Phase 3/4 - placeholder pour l'instant) ─────────────────

function renderRiskSection() {
  // Étape 5 : risques du processus (lecture seule depuis Risk Universe)
  // IMPORTANT : on lit depuis AUDIT_PLAN directement (pas getAudits qui simplifie l'objet et perd processIds)
  var a = (AUDIT_PLAN||[]).find(function(x){return x.id===CA;});
  var pids = (Array.isArray(a&&a.processIds) && a.processIds.length) ? a.processIds : (a&&a.processId ? [a.processId] : []);
  var seen = {};
  var risks = [];
  pids.forEach(function(pid){
    var p = PROCESSES.find(function(x){return x.id===pid;});
    if (!p) return;
    (p.riskRefs||[]).forEach(function(rid){
      if (seen[rid]) return;
      seen[rid] = true;
      var r = (RISK_UNIVERSE||[]).find(function(x){return x.id===rid;});
      if (r) risks.push(r);
    });
  });

  var html = '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:6px">Risques du processus <span style="font-weight:400;font-size:10px;color:var(--text-3)">(depuis Risk Universe — lecture seule)</span></div>';
  if (!risks.length) {
    html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:6px">Aucun risque associé. Va dans Audit Universe → Risques pour en associer aux processus.</div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:5px">';
    risks.forEach(function(r){
      var colors = (typeof RISK_IMPACT_COLORS!=='undefined' && RISK_IMPACT_COLORS[r.impact]) ? RISK_IMPACT_COLORS[r.impact] : {bg:'#F3F4F6',color:'#374151'};
      html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 9px;background:var(--bg);border-radius:5px;font-size:11px">'
        + '<span class="badge" style="background:'+colors.bg+';color:'+colors.color+';font-size:9px">'+(r.impact||'—')+'</span>'
        + '<span style="font-weight:500">'+r.title+'</span>'
        + '</div>';
    });
    html += '</div>';
  }
  html += '</div>';
  return html;
}

// ─── ÉTAPE 5 : WCGW (What Could Go Wrong) avec contrôles groupés ─────
function renderWCGWSection() {
  var d = getAudData(CA);
  if (!d.wcgw) d.wcgw = {};
  var wcgwList = d.wcgw[CS] || [];
  var ctrls = (d.controls && d.controls[CS]) || [];

  var html = '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2)">WCGW & Contrôles <span style="font-size:10px;font-weight:400;color:var(--text-3)">('+wcgwList.length+' WCGW · '+ctrls.length+' contrôles)</span></div>';
  html += '<div style="display:flex;gap:6px">';
  html += '<button class="bs" style="font-size:11px;padding:3px 9px;background:#E1F5EE;color:#085041;border-color:#5DCAA5" onclick="openControlLibraryPicker(CA)">📚 Importer depuis la bibliothèque</button>';
  html += '<button class="bs" style="font-size:11px;padding:3px 9px" onclick="showAddWCGWModal()">+ Ajouter un WCGW</button>';
  html += '</div>';
  html += '</div>';
  html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:8px;font-style:italic">Pour chaque scénario à risque (WCGW), définissez les contrôles existants ou cibles qui le bloquent.</div>';

  if (!wcgwList.length) {
    html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:.5rem;text-align:center;border:1px dashed var(--border);border-radius:4px">Aucun WCGW défini. Commencez par cliquer sur « + Ajouter un WCGW » pour identifier un scénario à risque.</div>';
  } else {
    wcgwList.forEach(function(w, idx){
      // Résoudre les noms des risques liés : d'abord chercher dans RISK_UNIVERSE (URD),
      // puis dans d.auditRisks (ad hoc)
      var linkedRisks = (w.riskIds||[]).map(function(rid){
        var r = (RISK_UNIVERSE||[]).find(function(x){return x.id===rid;});
        if (r) return {title: r.title, source: 'urd'};
        var ar = (d.auditRisks||[]).find(function(x){return x.id===rid;});
        if (ar) return {title: ar.label || ar.title || '—', source: 'adhoc'};
        return null;
      }).filter(Boolean);
      var wcgwCtrls = ctrls.filter(function(c){return c.wcgwId === w.id;});

      html += '<div style="border:.5px solid var(--border);border-radius:6px;padding:10px;margin-bottom:8px;background:#fafafa">';
      // En-tête WCGW
      html += '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">';
      html += '<span class="badge bpl" style="font-size:9px;padding:2px 6px;flex-shrink:0">'+(w.code||('WCGW-'+(idx+1)))+'</span>';
      html += '<div style="flex:1">';
      html += '<div style="font-size:12px;font-weight:600">'+w.title+'</div>';
      if (w.description) html += '<div style="font-size:10px;color:var(--text-3);margin-top:2px">'+w.description+'</div>';
      html += '</div>';
      html += '<button class="bs" style="font-size:10px;padding:1px 6px" onclick="showEditWCGWModal('+idx+')">Éditer</button>';
      html += '<button class="bd" style="font-size:10px;padding:1px 5px" onclick="removeWCGW('+idx+')">×</button>';
      html += '</div>';

      // Risques liés
      if (linkedRisks.length) {
        html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:10px;padding:4px 0 6px;margin-left:38px">';
        html += '<span style="color:var(--text-3)"><strong>Risques liés :</strong></span>';
        linkedRisks.forEach(function(lr){
          var badgeClass = lr.source === 'adhoc' ? 'bpc' : 'bpl';
          var sourcePrefix = lr.source === 'adhoc' ? '<span style="opacity:.7;margin-right:3px">[Ad hoc]</span>' : '';
          html += '<span class="badge '+badgeClass+'" style="font-size:9px;padding:1px 5px">'+sourcePrefix+lr.title+'</span>';
        });
        html += '</div>';
      }

      // Bloc Contrôles
      html += '<div style="margin-left:38px;margin-top:6px;padding-top:6px;border-top:.5px dashed var(--border)">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">';
      html += '<span style="font-size:10px;font-weight:600;color:var(--text-2)">Contrôles bloquants ('+wcgwCtrls.length+')</span>';
      html += '<button class="bs" style="font-size:10px;padding:1px 6px" onclick="showAddControlModalForWCGW(\''+w.id+'\')">+ Ajouter contrôle</button>';
      html += '</div>';

      if (!wcgwCtrls.length) {
        html += '<div style="font-size:10px;color:var(--text-3);font-style:italic;padding:4px">Aucun contrôle. Cliquez sur « + Ajouter contrôle » ou utilisez la bibliothèque.</div>';
      } else {
        wcgwCtrls.forEach(function(c){
          var origIdx = ctrls.indexOf(c);
          var ctrlCode = c.code || ('CTRL-'+(origIdx+1));
          var typeBadge = c.clef
            ? '<span class="badge" style="background:#E0E7FF;color:#3730A3;font-size:9px">Key</span>'
            : '<span class="badge bpl" style="font-size:9px">Non Key</span>';
          var designBadge = c.design === 'existing'
            ? '<span class="badge bdn" style="font-size:9px">Existing</span>'
            : '<span class="badge" style="background:#FAEEDA;color:#854F0B;font-size:9px">Target</span>';
          var sourceBadge = c.addedFromLib
            ? '<span class="badge" style="background:#E1F5EE;color:#085041;font-size:9px">Biblio</span>'
            : '';

          html += '<div style="background:#fff;border:.5px solid var(--border);border-radius:4px;padding:6px 8px;margin-bottom:4px">';
          html += '<div style="display:flex;align-items:flex-start;gap:6px">';
          html += '<div style="flex:1;min-width:0">';
          html += '<div style="font-size:11px;font-weight:500"><span style="color:var(--text-3);font-size:10px;margin-right:5px">'+ctrlCode+'</span>'+(c.name||c.label||'(sans nom)')+'</div>';
          if (c.description) html += '<div style="font-size:10px;color:var(--text-3);margin-top:1px">'+c.description+'</div>';
          // Détails compact
          var details = [];
          if (c.nature) details.push(c.nature);
          if (c.freq) details.push(c.freq);
          if (c.owner) details.push('Owner: '+c.owner);
          if (details.length) html += '<div style="font-size:10px;color:var(--text-2);margin-top:2px">'+details.join(' · ')+'</div>';
          html += '</div>';
          html += '<div style="display:flex;gap:3px;align-items:center;flex-shrink:0">';
          html += sourceBadge + typeBadge + designBadge;
          html += '<button class="bs" style="font-size:9px;padding:1px 5px;margin-left:3px" onclick="showEditControlModal('+origIdx+')">Éditer</button>';
          html += '<button class="bd" style="font-size:9px;padding:1px 4px" onclick="removeControlAt('+origIdx+')">×</button>';
          html += '</div>';
          html += '</div>';
          html += '</div>';
        });
      }
      html += '</div>';  // fin bloc Contrôles
      html += '</div>';  // fin bloc WCGW
    });
  }

  // Section "Contrôles non rattachés" pour les anciens audits
  var orphans = ctrls.filter(function(c){return !c.wcgwId;});
  if (orphans.length) {
    html += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">';
    html += '<span style="font-size:11px;font-weight:600;color:#854F0B">⚠ Contrôles non rattachés à un WCGW ('+orphans.length+')</span>';
    html += '</div>';
    html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:6px;font-style:italic">Ces contrôles ne sont liés à aucun WCGW. Éditez-les pour les rattacher.</div>';
    orphans.forEach(function(c){
      var origIdx = ctrls.indexOf(c);
      var ctrlCode = c.code || ('CTRL-'+(origIdx+1));
      html += '<div style="background:#FFF7ED;border:.5px solid #FED7AA;border-radius:4px;padding:6px 8px;margin-bottom:4px;display:flex;align-items:center;gap:6px">';
      html += '<div style="flex:1"><span style="color:var(--text-3);font-size:10px;margin-right:5px">'+ctrlCode+'</span><span style="font-size:11px">'+(c.name||c.label||'(sans nom)')+'</span></div>';
      html += '<button class="bs" style="font-size:9px;padding:1px 5px" onclick="showEditControlModal('+origIdx+')">Rattacher</button>';
      html += '<button class="bd" style="font-size:9px;padding:1px 4px" onclick="removeControlAt('+origIdx+')">×</button>';
      html += '</div>';
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
}

function showAddWCGWModal() { showWCGWModal(null); }
function showEditWCGWModal(idx) {
  var d = getAudData(CA);
  var w = (d.wcgw && d.wcgw[CS] || [])[idx];
  if (!w) return;
  showWCGWModal({idx:idx, wcgw:w});
}

function showWCGWModal(existing) {
  // Récupérer tous les risques de l'audit (URD via processus + ad hoc)
  // via le helper getAuditRisks() qui consolide les deux sources.
  var risks = (typeof getAuditRisks === 'function') ? getAuditRisks(CA) : [];

  var currentRiskIds = (existing && existing.wcgw.riskIds) || [];
  var risksHtml = '';
  if (risks.length) {
    risksHtml = '<div><label>Risques liés (cochez ceux que ce WCGW concerne)</label>'
      + '<div class="cb-list" style="display:flex;flex-direction:column;gap:3px;max-height:200px;overflow-y:auto;border:.5px solid var(--border);border-radius:var(--radius);padding:8px 10px;background:var(--bg-card)">'
      + risks.map(function(r){
          var checked = currentRiskIds.indexOf(r.id)>=0 ? ' checked' : '';
          var isAdhoc = r.source === 'adhoc';
          var sourceBadge = isAdhoc
            ? '<span class="badge bpc" style="font-size:9px;margin-right:5px">Ad hoc</span>'
            : '<span class="badge bpl" style="font-size:9px;margin-right:5px">URD</span>';
          // Pour les risques URD on utilise impactRaw (Minor/Limited/Major/Severe)
          // Pour les risques ad hoc on utilise impact numérique
          var impactDisp = isAdhoc ? ('I'+r.impact) : (r.impactRaw||'—');
          var impactColors = (!isAdhoc && typeof RISK_IMPACT_COLORS!=='undefined' && RISK_IMPACT_COLORS[r.impactRaw])
            ? RISK_IMPACT_COLORS[r.impactRaw]
            : {bg:'#F3F4F6',color:'#374151'};
          return '<label><input type="checkbox" class="wcgw-risk-cb" value="'+r.id+'"'+checked+'><span>'
            + sourceBadge
            + '<span class="badge" style="background:'+impactColors.bg+';color:'+impactColors.color+';font-size:9px;margin-right:5px">'+impactDisp+'</span>'
            + (r.title || r.label || '—')
            + '</span></label>';
        }).join('')
      + '</div></div>';
  } else {
    risksHtml = '<div style="font-size:11px;color:var(--text-3);padding:8px;background:var(--bg);border-radius:6px">ℹ️ Aucun risque pour cet audit. Associez des risques URD aux processus dans Audit Universe, ou ajoutez des risques ad hoc dans l\'étape Work Program.</div>';
  }

  var body = '<div><label>Code <span style="color:var(--red)">*</span></label><input id="wcgw-code" value="'+((existing&&existing.wcgw.code)||'')+'" placeholder="ex : WCGW-1"/></div>'
    + '<div><label>Titre <span style="color:var(--red)">*</span></label><input id="wcgw-title" value="'+((existing&&existing.wcgw.title)||'')+'" placeholder="ex : Accès non autorisé aux données client"/></div>'
    + '<div><label>Description</label><textarea id="wcgw-desc" style="width:100%;min-height:60px" placeholder="Décrivez le scénario de risque...">'+((existing&&existing.wcgw.description)||'')+'</textarea></div>'
    + risksHtml;

  openModal(existing ? 'Éditer WCGW' : 'Nouveau WCGW', body, async function(){
    var code = document.getElementById('wcgw-code').value.trim();
    var title = document.getElementById('wcgw-title').value.trim();
    if (!code) { toast('Code obligatoire'); return; }
    if (!title) { toast('Titre obligatoire'); return; }
    var description = document.getElementById('wcgw-desc').value.trim();
    var riskIds = [];
    document.querySelectorAll('.wcgw-risk-cb:checked').forEach(function(cb){riskIds.push(cb.value);});

    var d = getAudData(CA);
    if (!d.wcgw) d.wcgw = {};
    if (!d.wcgw[CS]) d.wcgw[CS] = [];

    if (existing) {
      d.wcgw[CS][existing.idx] = Object.assign({}, existing.wcgw, {code, title, description, riskIds});
      addHist('edit', 'WCGW "'+title+'" modifié');
    } else {
      d.wcgw[CS].push({
        id: 'wcgw_'+Date.now(),
        code, title, description, riskIds,
      });
      addHist('add', 'WCGW "'+title+'" créé');
    }
    await saveAuditData(CA);
    document.getElementById('det-content').innerHTML = renderDetContent();
    toast('WCGW '+(existing?'modifié':'créé')+' ✓');
  });
}

async function removeWCGW(idx) {
  var d = getAudData(CA);
  var w = (d.wcgw && d.wcgw[CS] || [])[idx];
  if (!w) return;
  // Vérifier qu'aucun contrôle n'y est lié
  var ctrls = (d.controls && d.controls[CS]) || [];
  var linked = ctrls.filter(function(c){return c.wcgwId === w.id;}).length;
  var msg = 'Supprimer le WCGW "'+w.title+'" ?';
  if (linked) msg += '\n\n⚠️ '+linked+' contrôle(s) y est/sont lié(s) — ils perdront leur référence.';
  if (!confirm(msg)) return;
  d.wcgw[CS].splice(idx, 1);
  // Casser les liens des contrôles vers ce WCGW
  ctrls.forEach(function(c){if (c.wcgwId === w.id) delete c.wcgwId;});
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('WCGW supprimé ✓');
}

// ─── ÉTAPE 5 : Contrôles enrichis ───────────────────────────────
function renderControlsSection() {
  var d = getAudData(CA);
  var ctrls = (d.controls && d.controls[CS]) || [];

  var html = '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2)">Contrôles <span style="font-size:10px;font-weight:400;color:var(--text-3)">('+ctrls.length+')</span></div>';
  html += '<div style="display:flex;gap:6px">';
  html += '<button class="bs" style="font-size:11px;padding:3px 9px;background:#E1F5EE;color:#085041;border-color:#5DCAA5" onclick="openControlLibraryPicker(CA)">📚 Importer depuis la bibliothèque</button>';
  html += '<button class="bs" style="font-size:11px;padding:3px 9px" onclick="showAddControlModal()">+ Ajouter un contrôle</button>';
  html += '</div>';
  html += '</div>';
  html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:8px;font-style:italic">Chaque contrôle bloque un WCGW spécifique.</div>';

  if (!ctrls.length) {
    html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:.5rem">Aucun contrôle défini.</div>';
  } else {
    var wcgwList = (d.wcgw && d.wcgw[CS]) || [];
    ctrls.forEach(function(c, idx){
      var ctrlCode = c.code || ('CTRL-'+(idx+1));
      var typeBadge = c.clef
        ? '<span class="badge" style="background:#E0E7FF;color:#3730A3;font-size:9px">Key</span>'
        : '<span class="badge bpl" style="font-size:9px">Non Key</span>';
      var designBadge = c.design === 'existing'
        ? '<span class="badge bdn" style="font-size:9px">Existing</span>'
        : '<span class="badge" style="background:#FAEEDA;color:#854F0B;font-size:9px">Target</span>';
      var wcgwLinked = wcgwList.find(function(w){return w.id === c.wcgwId;});
      var sourceBadge = c.addedFromLib
        ? '<span class="badge" style="background:#E1F5EE;color:#085041;font-size:9px">Bibliothèque</span>'
        : '<span class="badge" style="background:#FBEAF0;color:#72243E;font-size:9px">Manuel</span>';

      html += '<div style="border-top:.5px solid var(--border);padding:8px 0">';
      html += '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:4px">';
      html += '<div style="flex:1">';
      html += '<div style="font-size:12px;font-weight:500"><span style="color:var(--text-3);font-size:10px;margin-right:6px">'+ctrlCode+'</span>'+(c.name||c.label||'(sans nom)')+'</div>';
      if (c.description) html += '<div style="font-size:10px;color:var(--text-3);margin-top:2px">'+c.description+'</div>';
      html += '</div>';
      html += sourceBadge + typeBadge + designBadge;
      html += '<button class="bs" style="font-size:10px;padding:1px 6px;margin-left:5px" onclick="showEditControlModal('+idx+')">Éditer</button>';
      html += '<button class="bd" style="font-size:10px;padding:1px 5px" onclick="removeControlAt('+idx+')">×</button>';
      html += '</div>';
      // Détails secondaires
      html += '<div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;font-size:10px;color:var(--text-2);padding-left:0;margin-top:6px">';
      if (c.nature) html += '<div><span style="color:var(--text-3)">Nature :</span> '+c.nature+'</div>';
      if (c.freq) html += '<div><span style="color:var(--text-3)">Fréquence :</span> '+c.freq+'</div>';
      if (c.owner) html += '<div><span style="color:var(--text-3)">Owner :</span> '+c.owner+'</div>';
      if (c.wcgwId) {
        html += '<div style="grid-column:span 3"><span style="color:var(--text-3)">Bloque WCGW :</span> '+(wcgwLinked ? '<span class="badge bpl" style="font-size:9px;padding:1px 5px">'+(wcgwLinked.code||'')+' — '+wcgwLinked.title+'</span>' : '<span style="font-style:italic;color:var(--text-3)">référence cassée</span>')+'</div>';
      }
      html += '</div>';
      html += '</div>';
    });
  }
  html += '</div>';
  return html;
}

function showAddControlModal(preselectedWcgwId) {
  showControlModal(preselectedWcgwId ? {ctrl: {wcgwId: preselectedWcgwId}, isPreset: true} : null);
}
function showAddControlModalForWCGW(wcgwId) {
  showAddControlModal(wcgwId);
}
function showEditControlModal(idx) {
  var d = getAudData(CA);
  var c = (d.controls && d.controls[CS] || [])[idx];
  if (!c) return;
  showControlModal({idx:idx, ctrl:c});
}

function showControlModal(existing) {
  var d = getAudData(CA);
  var wcgwList = (d.wcgw && d.wcgw[CS]) || [];
  var FREQS = ['As needed','Day','Week','Month','Quarter','Semester','Year'];
  var NATURES = ['IT','IT-Dependent','Manual'];

  var c = existing ? existing.ctrl : {};
  var wcgwOpts = '<option value="">— Aucun —</option>'
    + wcgwList.map(function(w){return '<option value="'+w.id+'"'+(c.wcgwId===w.id?' selected':'')+'>'+(w.code||'')+' — '+w.title+'</option>';}).join('');
  var freqOpts = FREQS.map(function(f){return '<option value="'+f+'"'+(c.freq===f?' selected':'')+'>'+f+'</option>';}).join('');
  var natureOpts = NATURES.map(function(n){return '<option value="'+n+'"'+(c.nature===n?' selected':'')+'>'+n+'</option>';}).join('');

  var body = '<div><label>Nom du contrôle <span style="color:var(--red)">*</span></label><input id="c-name" value="'+(c.name||c.label||'')+'" placeholder="ex : Validation à 2 niveaux"/></div>'
    + '<div><label>Description</label><textarea id="c-desc" style="width:100%;min-height:50px" placeholder="Description du contrôle...">'+(c.description||'')+'</textarea></div>'
    + '<div class="g2">'
      + '<div><label>Type</label><select id="c-key"><option value="1"'+(c.clef?' selected':'')+'>Key</option><option value="0"'+(!c.clef?' selected':'')+'>Non Key</option></select></div>'
      + '<div><label>Design</label><select id="c-design"><option value="existing"'+(c.design==='existing'?' selected':'')+'>Existing</option><option value="target"'+(c.design==='target'?' selected':'')+'>Target</option></select></div>'
    + '</div>'
    + '<div class="g2">'
      + '<div><label>Nature</label><select id="c-nature"><option value="">—</option>'+natureOpts+'</select></div>'
      + '<div><label>Fréquence</label><select id="c-freq"><option value="">—</option>'+freqOpts+'</select></div>'
    + '</div>'
    + '<div><label>Owner</label><input id="c-owner" value="'+(c.owner||'')+'" placeholder="ex : Finance, IT Sécurité..."/></div>'
    + '<div><label>WCGW bloqué</label><select id="c-wcgw">'+wcgwOpts+'</select>'
    + (wcgwList.length?'':'<div style="font-size:10px;color:var(--text-3);margin-top:3px;font-style:italic">Créez d\'abord des WCGW pour pouvoir les lier.</div>')
    + '</div>';

  openModal((existing && !existing.isPreset) ? 'Éditer contrôle' : 'Nouveau contrôle', body, async function(){
    var name = document.getElementById('c-name').value.trim();
    if (!name) { toast('Nom obligatoire'); return; }
    var description = document.getElementById('c-desc').value.trim();
    var clef = document.getElementById('c-key').value === '1';
    var design = document.getElementById('c-design').value;
    var nature = document.getElementById('c-nature').value;
    var freq = document.getElementById('c-freq').value;
    var owner = document.getElementById('c-owner').value.trim();
    var wcgwId = document.getElementById('c-wcgw').value;

    if (!d.controls) d.controls = {};
    if (!d.controls[CS]) d.controls[CS] = [];

    if (existing && !existing.isPreset) {
      Object.assign(d.controls[CS][existing.idx], {
        name, label:name, description, clef, design, nature, freq, owner, wcgwId,
      });
      addHist('edit', 'Contrôle "'+name+'" modifié');
    } else {
      var idx = d.controls[CS].length;
      d.controls[CS].push({
        id: 'ctrl_'+Date.now(),
        code: 'CTRL-'+(idx+1),
        name, label:name, description, clef, design, nature, freq, owner, wcgwId,
        result: null, testNature: '', finding: '', finalized: false,
      });
      addHist('add', 'Contrôle "'+name+'" créé');
    }
    await saveAuditData(CA);
    document.getElementById('det-content').innerHTML = renderDetContent();
    toast('Contrôle '+(existing && !existing.isPreset ?'modifié':'créé')+' ✓');
  });
}

async function removeControlAt(idx) {
  var d = getAudData(CA);
  var c = (d.controls && d.controls[CS] || [])[idx];
  if (!c) return;
  if (!confirm('Supprimer le contrôle "'+(c.name||c.label||'')+'" ?')) return;
  d.controls[CS].splice(idx, 1);
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Contrôle supprimé ✓');
}
function renderTestsSection() {
  var d = getAudData(CA);
  var step5c = d.controls[4]||[];
  var keyExist = step5c.filter(function(c){return c.clef && c.design==='existing';});
  var targets = step5c.filter(function(c){return c.design==='target';});
  var html = '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px">Testings — Contrôles clefs existants</div>';
  html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:10px;font-style:italic">Pour chaque contrôle clef existant, documentez votre procédure de test, votre échantillon et le résultat. Les contrôles Target (à mettre en place) seront pris en compte directement à l\'étape Findings sans test.</div>';
  html += buildExecTable(keyExist);
  if (targets.length) {
    html += '<div style="margin-top:14px;padding-top:10px;border-top:1px dashed var(--border)">';
    html += '<div style="font-size:11px;font-weight:600;color:#854F0B;margin-bottom:4px">Contrôles Target (non testés — alimenteront les Findings)</div>';
    html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:6px;font-style:italic">Ces contrôles n\'existent pas encore. Pas de test à réaliser. Ils apparaîtront automatiquement à l\'étape Report comme déficiences à adresser.</div>';
    targets.forEach(function(c, idx){
      var ctrlCode = c.code || ('CTRL-T'+(idx+1));
      html += '<div style="background:#FFF7ED;border:.5px solid #FED7AA;border-radius:4px;padding:6px 10px;margin-bottom:4px;display:flex;align-items:center;gap:8px">';
      html += '<span class="badge" style="background:#FAEEDA;color:#854F0B;font-size:9px">Target</span>';
      html += '<div style="flex:1;font-size:11px"><span style="color:var(--text-3);font-size:10px;margin-right:5px">'+ctrlCode+'</span>'+c.name+'</div>';
      if (c.owner) html += '<span style="font-size:10px;color:var(--text-3)">Owner : '+c.owner+'</span>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';
  return html;
}
function renderFindingsSection() {
  var d = getAudData(CA);
  if (!d.findings) d.findings = [];
  var step5c = d.controls[4]||[];
  // Contrôles "à traiter" = fail (test finalisé fail) ou target
  var failedCtrls = step5c.filter(function(c){return c.clef && c.design==='existing' && c.finalized && c.result==='fail';});
  var targetCtrls = step5c.filter(function(c){return c.design==='target';});
  var problematicCtrls = failedCtrls.concat(targetCtrls);

  // Helper : récupérer un contrôle par son ID
  function getCtrl(id) {
    return step5c.find(function(c){return c.id === id;});
  }
  // Contrôles déjà liés à au moins un finding
  var linkedCtrlIds = new Set();
  d.findings.forEach(function(f){
    (f.controlIds||[]).forEach(function(id){linkedCtrlIds.add(id);});
  });
  // Contrôles problématiques pas encore liés
  var unlinkedProblems = problematicCtrls.filter(function(c){return c.id && !linkedCtrlIds.has(c.id);});

  var html = '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2)">Findings <span style="font-size:10px;font-weight:400;color:var(--text-3)">('+d.findings.length+')</span></div>';
  html += '<button class="bs" style="font-size:11px;padding:3px 9px" onclick="showAddFindingModal()">+ Ajouter un finding</button>';
  html += '</div>';
  html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:10px;font-style:italic">Chaque finding peut regrouper plusieurs déficiences (contrôles fail, contrôles target). Articulez votre constat puis liez les contrôles concernés.</div>';

  // Section "Contrôles à traiter" non encore liés
  if (unlinkedProblems.length) {
    html += '<div style="background:#FFF7ED;border:.5px solid #FED7AA;border-radius:6px;padding:10px;margin-bottom:12px">';
    html += '<div style="font-size:11px;font-weight:600;color:#854F0B;margin-bottom:6px">⚠ Contrôles à traiter dans un finding ('+unlinkedProblems.length+')</div>';
    html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:6px;font-style:italic">Ces contrôles fail ou target ne sont rattachés à aucun finding. Créez ou éditez un finding pour les inclure.</div>';
    unlinkedProblems.forEach(function(c){
      var ctrlCode = c.code || c.id;
      var typeLabel = c.design === 'target'
        ? '<span class="badge" style="background:#FAEEDA;color:#854F0B;font-size:9px">🎯 Target</span>'
        : '<span class="badge bfl" style="font-size:9px">❌ Fail</span>';
      html += '<div style="background:#fff;border:.5px solid var(--border);border-radius:4px;padding:5px 8px;margin-bottom:3px;display:flex;align-items:center;gap:8px">';
      html += typeLabel;
      html += '<div style="flex:1;font-size:11px"><span style="color:var(--text-3);font-size:10px;margin-right:5px">'+ctrlCode+'</span>'+c.name+'</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // Liste des findings
  if (!d.findings.length) {
    html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:.5rem;text-align:center;border:1px dashed var(--border);border-radius:4px">Aucun finding rédigé. Cliquez sur « + Ajouter un finding » pour commencer.</div>';
  } else {
    d.findings.forEach(function(f, idx){
      var linkedCtrls = (f.controlIds||[]).map(getCtrl).filter(Boolean);
      html += '<div style="border:.5px solid var(--border);border-radius:6px;padding:12px;margin-bottom:10px;background:#fff">';
      html += '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">';
      html += '<span class="badge bpc" style="font-size:10px;flex-shrink:0">Finding '+(idx+1)+'</span>';
      html += '<div style="flex:1">';
      html += '<div style="font-size:13px;font-weight:600">'+(f.title||'(sans titre)')+'</div>';
      // Description courte (Exec Summary) - en gras pour distinction
      var execTxt = f.descExec || (f.desc && f.desc.length<200 ? f.desc : '');
      var detailTxt = f.descDetailed || f.desc || '';
      if (execTxt) html += '<div style="font-size:11px;color:var(--text-2);margin-top:4px;white-space:pre-wrap;font-style:italic">📋 <span style="color:var(--text-3);font-style:normal;font-size:9px">EXEC SUMMARY:</span> '+execTxt+'</div>';
      if (detailTxt && detailTxt !== execTxt) html += '<div style="font-size:11px;color:var(--text-2);margin-top:4px;white-space:pre-wrap">📄 <span style="color:var(--text-3);font-size:9px">DETAILED:</span> '+detailTxt+'</div>';
      // Métadonnées : Owner + Risk level
      var metaParts = [];
      if (f.owner) metaParts.push('<strong>Owner:</strong> '+f.owner);
      if (f.probability && f.impact) {
        var probLabel = {rare:'Rare',unlikely:'Unlikely',possible:'Possible',probable:'Probable'}[f.probability]||f.probability;
        var impLabel  = {minor:'Minor',limited:'Limited',major:'Major',severe:'Severe'}[f.impact]||f.impact;
        metaParts.push('<strong>Risk:</strong> '+probLabel+' × '+impLabel);
      }
      if (metaParts.length) {
        html += '<div style="font-size:10px;color:var(--text-3);margin-top:4px">'+metaParts.join(' · ')+'</div>';
      }
      if (f.potentialRisk) {
        html += '<div style="font-size:10px;color:var(--text-3);margin-top:4px;padding:5px 8px;background:#FFF7ED;border-left:2px solid #F2A900;border-radius:3px"><strong>Potential Risk:</strong> '+f.potentialRisk+'</div>';
      }
      html += '</div>';
      html += '<button class="bs" style="font-size:10px;padding:1px 6px" onclick="showEditFindingModal('+idx+')">Éditer</button>';
      html += '<button class="bd" style="font-size:10px;padding:1px 5px" onclick="removeManualFinding('+idx+')">×</button>';
      html += '</div>';

      // Contrôles liés
      html += '<div style="margin-top:8px;padding-top:8px;border-top:.5px dashed var(--border)">';
      html += '<div style="font-size:10px;font-weight:600;color:var(--text-2);margin-bottom:4px">Contrôles liés ('+linkedCtrls.length+')</div>';
      if (!linkedCtrls.length) {
        html += '<div style="font-size:10px;color:var(--text-3);font-style:italic;padding:4px">Aucun contrôle lié. Éditez le finding pour rattacher les déficiences.</div>';
      } else {
        linkedCtrls.forEach(function(c){
          var ctrlCode = c.code || c.id;
          var typeLabel = c.design === 'target'
            ? '<span class="badge" style="background:#FAEEDA;color:#854F0B;font-size:9px">🎯 Target</span>'
            : c.result === 'fail'
            ? '<span class="badge bfl" style="font-size:9px">❌ Fail</span>'
            : '<span class="badge bdn" style="font-size:9px">✓ Pass</span>';
          html += '<div style="background:#fafafa;border:.5px solid var(--border);border-radius:4px;padding:5px 8px;margin-bottom:3px;display:flex;align-items:center;gap:8px">';
          html += typeLabel;
          html += '<div style="flex:1;font-size:11px"><span style="color:var(--text-3);font-size:10px;margin-right:5px">'+ctrlCode+'</span>'+c.name+'</div>';
          if (c.testComment) html += '<span style="font-size:10px;color:var(--text-3);font-style:italic;max-width:200px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap" title="'+c.testComment.replace(/"/g,'&quot;')+'">'+c.testComment+'</span>';
          html += '</div>';
        });
      }
      html += '</div>';
      html += '</div>';
    });
  }

  html += '</div>';
  return html;
}
function renderHeaderAndMaturitySection() {
  var d = getAudData(CA);
  if (!d.maturity) d.maturity = {level:'',notes:'',saved:false};
  if (typeof d.execSummaryHeader === 'undefined') d.execSummaryHeader = '';

  var MLEVELS = [
    {key:'unsatisfactory',label:'Unsatisfactory',color:'#A32D2D',bg:'#FCEBEB'},
    {key:'major',label:'Major Improvements',color:'#854F0B',bg:'#FAEEDA'},
    {key:'some',label:'Some Improvements',color:'#1D6B45',bg:'#E1F5EE'},
    {key:'effective',label:'Effective',color:'#3B6D11',bg:'#EAF3DE'},
  ];

  var html = '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="display:grid;grid-template-columns:1.6fr 1fr;gap:14px">';

  // ─── Colonne gauche : Header de l'Executive Summary ────────
  html += '<div>';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px">Executive Summary — Header</div>';
  html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:8px;font-style:italic">Texte d\'introduction qui apparaîtra en haut de la slide « Executive Summary - Findings ». La maturité est ajoutée automatiquement à la fin.</div>';
  html += '<textarea id="exec-summary-header" placeholder="ex : The audit of the Renewals process identified improvement opportunities in operational efficiency. These weaknesses elevate the risk of missed renewals and lost revenue opportunities..." style="width:100%;min-height:160px;font-size:12px;padding:8px;border:1px solid var(--border);border-radius:4px;resize:vertical" onchange="setExecSummaryHeader(this.value)">'+(d.execSummaryHeader||'').replace(/</g,'&lt;')+'</textarea>';
  html += '</div>';

  // ─── Colonne droite : Maturity compacte ─────────────────────
  html += '<div>';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px">Overall Process Maturity'+(d.maturity.saved?' <span class="tag-new" style="font-size:9px;margin-left:6px">✓</span>':'')+'</div>';
  html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:8px;font-style:italic">Niveau global du process audité.</div>';
  // Grid 2x2 des niveaux
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  MLEVELS.forEach(function(l){
    var sel = d.maturity.level === l.key;
    html += '<div onclick="setMaturity(\''+l.key+'\')" style="border:1.5px solid '+(sel?l.color:'var(--border)')+';border-radius:5px;padding:8px 10px;cursor:pointer;background:'+(sel?l.bg:'var(--bg-card)')+';font-size:11px;text-align:center;transition:all 0.15s"><strong style="color:'+l.color+'">'+l.label+'</strong></div>';
  });
  html += '</div>';
  html += '<textarea id="maturity-notes" style="width:100%;min-height:60px;resize:vertical;font-size:11px;padding:6px;border:1px solid var(--border);border-radius:4px" placeholder="Justification (optionnel)...">'+(d.maturity.notes||'')+'</textarea>';
  html += '<div style="display:flex;justify-content:flex-end;margin-top:6px"><button class="bp" style="font-size:11px;padding:4px 10px" onclick="saveMaturity()">Sauvegarder</button></div>';
  html += '</div>';

  html += '</div>'; // grid
  html += '</div>'; // card
  return html;
}

// Setter pour le header de l'exec summary
async function setExecSummaryHeader(val) {
  var d = getAudData(CA);
  d.execSummaryHeader = val;
  await saveAuditData(CA);
}

// Ancienne fonction conservée pour compat (pas appelée mais existe au cas où)
function renderMaturitySection() {
  var d = getAudData(CA);
  if (!d.maturity) d.maturity = {level:'',notes:'',saved:false};
  var MLEVELS = [
    {key:'unsatisfactory',label:'Unsatisfactory',color:'#A32D2D',bg:'#FCEBEB'},
    {key:'major',label:'Major Improvements Needed',color:'#854F0B',bg:'#FAEEDA'},
    {key:'some',label:'Some Improvements Needed',color:'#1D6B45',bg:'#E1F5EE'},
    {key:'effective',label:'Effective',color:'#3B6D11',bg:'#EAF3DE'},
  ];
  var html = '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:10px">Overall Process Maturity'+(d.maturity.saved?' <span class="tag-new" style="font-size:9px;margin-left:6px">✓ Sauvegardée</span>':'')+'</div>';
  html += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">';
  MLEVELS.forEach(function(l){
    var sel = d.maturity.level === l.key;
    html += '<div onclick="setMaturity(\''+l.key+'\')" style="border:1.5px solid '+(sel?l.color:'var(--border)')+';border-radius:5px;padding:8px 10px;cursor:pointer;background:'+(sel?l.bg:'var(--bg-card)')+';font-size:12px"><strong style="color:'+l.color+'">'+l.label+'</strong></div>';
  });
  html += '</div>';
  html += '<textarea id="maturity-notes" style="width:100%;min-height:60px;resize:vertical;font-size:12px" placeholder="Justification...">'+(d.maturity.notes||'')+'</textarea>';
  html += '<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="bp" onclick="saveMaturity()">Sauvegarder</button></div>';
  html += '</div>';
  return html;
}
function renderMgtRespSection() {
  var d = getAudData(CA);
  if (!d.findings) d.findings = [];
  if (!d.mgtResp) d.mgtResp = [];
  var step5c = d.controls[4]||[];
  function getCtrl(id) { return step5c.find(function(c){return c.id === id;}); }

  // Source unique : les findings rédigés à l'étape Report
  var allFindings = d.findings.map(function(f, i){
    var fid = f.id || ('f_'+i);
    var linkedCtrls = (f.controlIds||[]).map(getCtrl).filter(Boolean);
    return {id: fid, title: f.title, desc: f.desc, type: 'finding', controls: linkedCtrls};
  });

  // S'assurer qu'une mgtResp existe pour chaque finding
  allFindings.forEach(function(f){
    if (!d.mgtResp.find(function(r){return r.findingId===f.id;})) {
      d.mgtResp.push({findingId:f.id, action:'', owner:'', year:2026, quarter:'Q1', pushed:false});
    }
  });

  var html = '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2)">Management Responses <span style="font-size:10px;font-weight:400;color:var(--text-3)">('+allFindings.length+' finding'+(allFindings.length>1?'s':'')+')</span></div>';
  html += '<button class="bs" style="font-size:11px;padding:3px 9px" onclick="pushAllMgtResp()">Envoyer vers Plans d\'action →</button>';
  html += '</div>';
  if (!allFindings.length) {
    html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:.5rem">Aucun finding identifié. Rédigez les findings à l\'étape Report.</div>';
  } else {
    allFindings.forEach(function(f){
      var resp = d.mgtResp.find(function(r){return r.findingId===f.id;}) || {};
      html += '<div class="mr-row">';
      html += '<div class="mr-hdr"><span class="badge bpc">Finding</span><div class="mr-title">'+f.title+'</div>'+(resp.pushed?'<span class="tag-new">✓ Envoyé</span>':'')+'</div>';
      if (f.desc) html += '<div style="font-size:11px;color:var(--text-2);margin-bottom:.5rem;white-space:pre-wrap">'+f.desc+'</div>';
      // Liste compact des contrôles liés
      if (f.controls.length) {
        html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:.5rem">Contrôles concernés : ';
        html += f.controls.map(function(c){
          var typeLabel = c.design === 'target' ? '🎯' : '❌';
          return typeLabel+' '+(c.code||c.id)+' '+c.name;
        }).join(' · ');
        html += '</div>';
      }
      html += '<div class="mr-fields">';
      html += '<div><label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px">Action</label><input style="font-size:11px" placeholder="Action corrective..." value="'+(resp.action||'').replace(/"/g,'&quot;')+'" onchange="setMgtResp(\''+f.id+'\',\'action\',this.value)"/></div>';
      html += '<div><label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px">Owner</label><input style="font-size:11px" placeholder="ex: Finance, IT..." value="'+(resp.owner||'').replace(/"/g,'&quot;')+'" onchange="setMgtResp(\''+f.id+'\',\'owner\',this.value)"/></div>';
      html += '<div><label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px">Deadline</label><div style="display:flex;gap:4px">';
      html += '<select style="font-size:11px" onchange="setMgtResp(\''+f.id+'\',\'year\',parseInt(this.value))">';
      html += '<option '+(resp.year===2025?'selected':'')+'>2025</option>';
      html += '<option '+(resp.year===2026?'selected':'')+'>2026</option>';
      html += '<option '+(resp.year===2027?'selected':'')+'>2027</option>';
      html += '<option '+(resp.year===2028?'selected':'')+'>2028</option>';
      html += '</select>';
      html += '<select style="font-size:11px" onchange="setMgtResp(\''+f.id+'\',\'quarter\',this.value)">';
      html += '<option '+(resp.quarter==='Q1'?'selected':'')+'>Q1</option>';
      html += '<option '+(resp.quarter==='Q2'?'selected':'')+'>Q2</option>';
      html += '<option '+(resp.quarter==='Q3'?'selected':'')+'>Q3</option>';
      html += '<option '+(resp.quarter==='Q4'?'selected':'')+'>Q4</option>';
      html += '</select>';
      html += '</div></div>';
      html += '</div>';
      html += '</div>';
    });
  }
  html += '</div>';
  return html;
}

// ─── Handlers (Statut + Notes + Documents) ────────────────────

async function toggleStepPrepDone(checked) {
  var d = getAudData(CA);
  if (!d.stepStates) d.stepStates = {};
  var state = d.stepStates[CS] || {status:'preparation'};
  if (checked) {
    state.status = 'finalized';
    state.finalizedBy = CU ? CU.name : '—';
    state.finalizedAt = new Date().toISOString();
  } else {
    state.status = 'preparation';
    delete state.finalizedBy; delete state.finalizedAt;
    delete state.reviewedBy; delete state.reviewedAt;
  }
  d.stepStates[CS] = state;
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Statut mis à jour ✓');
}

async function toggleStepReviewed(checked) {
  var d = getAudData(CA);
  if (!d.stepStates) d.stepStates = {};
  var state = d.stepStates[CS] || {status:'preparation'};
  if (checked) {
    state.status = 'reviewed';
    state.reviewedBy = CU ? CU.name : '—';
    state.reviewedAt = new Date().toISOString();
  } else {
    state.status = 'finalized';
    delete state.reviewedBy; delete state.reviewedAt;
  }
  d.stepStates[CS] = state;
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Statut mis à jour ✓');
}

async function saveStepNote(which, value) {
  var d = getAudData(CA);
  if (which === 'prep') {
    if (!d.prepNotes) d.prepNotes = {};
    d.prepNotes[CS] = value;
  } else {
    if (!d.revNotes) d.revNotes = {};
    d.revNotes[CS] = value;
  }
  await saveAuditData(CA);
}

// Documents : créer/uploader, marquer prêt-pour-revue, marquer revu, supprimer
function attachExpectedDocument(expectedName) {
  // Ouvre la fenêtre du système pour sélectionner un fichier
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.csv,.txt,.png,.jpg,.jpeg';
  inp.onchange = async function(){
    if (!inp.files.length) return;
    var file = inp.files[0];
    var d = getAudData(CA);
    if (!d.docs) d.docs = [];
    var newDoc = {
      id: 'doc_'+Date.now(),
      name: file.name,
      expectedName: expectedName,
      step: CS,
      size: formatFileSize(file.size),
      uploadedBy: CU ? CU.name : '—',
      uploadedAt: new Date().toISOString(),
      reviewStatus: 'none',
    };
    // Tenter l'upload réel via la mécanique existante (uploadDoc → SharePoint Drive)
    if (typeof uploadDoc === 'function') {
      try {
        toast('Upload en cours...');
        var uploaded = await uploadDoc(CA, file, CS, CU?CU.name:'Inconnu');
        // uploadDoc renvoie un objet avec id, name, url, size, etc.
        if (uploaded) {
          // Fusionner avec nos métadonnées (expectedName, reviewStatus)
          Object.assign(newDoc, uploaded);
          newDoc.expectedName = expectedName;
          newDoc.reviewStatus = 'none';
        }
      } catch(e){
        console.warn('[Doc] upload échoué, stockage métadonnées seules:', e.message);
      }
    }
    d.docs.push(newDoc);
    await saveAuditData(CA);
    document.getElementById('det-content').innerHTML = renderDetContent();
    toast(file.name+' attaché ✓');
  };
  inp.click();
}

function addFreeDocument() {
  // Ouvre la fenêtre du système pour sélectionner un fichier
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.csv,.txt,.png,.jpg,.jpeg';
  inp.multiple = true;
  inp.onchange = async function(){
    if (!inp.files.length) return;
    var d = getAudData(CA);
    if (!d.docs) d.docs = [];
    var files = Array.from(inp.files);
    toast('Upload en cours...');
    for (var i=0; i<files.length; i++) {
      var file = files[i];
      var newDoc = {
        id: 'doc_'+Date.now()+'_'+i,
        name: file.name,
        step: CS,
        size: formatFileSize(file.size),
        uploadedBy: CU ? CU.name : '—',
        uploadedAt: new Date().toISOString(),
        reviewStatus: 'none',
      };
      if (typeof uploadDoc === 'function') {
        try {
          var uploaded = await uploadDoc(CA, file, CS, CU?CU.name:'Inconnu');
          if (uploaded) {
            Object.assign(newDoc, uploaded);
            newDoc.reviewStatus = 'none';
          }
        } catch(e){
          console.warn('[Doc] upload échoué:', e.message);
        }
      }
      d.docs.push(newDoc);
    }
    await saveAuditData(CA);
    document.getElementById('det-content').innerHTML = renderDetContent();
    toast(files.length+' fichier(s) attaché(s) ✓');
  };
  inp.click();
}

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' Ko';
  return (bytes/(1024*1024)).toFixed(1) + ' Mo';
}

async function markDocPendingReview(docId) {
  var d = getAudData(CA);
  var doc = (d.docs||[]).find(function(x){return x.id===docId;});
  if (!doc) return;
  doc.reviewStatus = 'pending';
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Document marqué prêt pour revue ✓');
}

async function markDocReviewed(docId) {
  var d = getAudData(CA);
  var doc = (d.docs||[]).find(function(x){return x.id===docId;});
  if (!doc) return;
  doc.reviewStatus = 'reviewed';
  doc.reviewedBy = CU ? CU.name : '—';
  doc.reviewedAt = new Date().toISOString();
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Document validé ✓');
}

async function removeDoc(docId) {
  if (!confirm('Supprimer ce document ?')) return;
  var d = getAudData(CA);
  d.docs = (d.docs||[]).filter(function(x){return x.id!==docId;});
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Document supprimé ✓');
}

function downloadDoc(docId) {
  var d = getAudData(CA);
  var doc = (d.docs||[]).find(function(x){return x.id===docId;});
  if (!doc) return;
  // Si on a une URL SharePoint, on l'ouvre dans un nouvel onglet
  if (doc.url) {
    window.open(doc.url, '_blank');
  } else if (doc.webUrl) {
    window.open(doc.webUrl, '_blank');
  } else {
    toast('URL non disponible pour ce document');
  }
}

function goStep(i){
  CS=i;
  const pct=Math.min(100,(i+1)*10);
  document.getElementById('audit-header-compact').innerHTML=renderStepper();
  var pf=document.getElementById('gp-fill'); if(pf)pf.style.width=pct+'%';
  var pp=document.getElementById('gp-pct'); if(pp)pp.textContent=pct+'%';
  var pl=document.getElementById('gp-lbl'); if(pl)pl.textContent=`Étape ${i+1}/11 — ${STEPS[i].s}`;
  document.getElementById('det-content').innerHTML=renderDetContent();
}
function switchDetTab(tab){
  // Conservée pour compat (plus utilisée avec les nouveaux onglets)
  document.getElementById('det-content').innerHTML=renderDetContent();
}

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
async function toggleTask(i){const d=getAudData(CA);if(!d.tasks[CS])d.tasks[CS]=[];d.tasks[CS][i].done=!d.tasks[CS][i].done;await saveAuditData(CA);const a=getAudits().find(x=>x.id===CA);document.getElementById('task-list').innerHTML=renderTaskList(d.tasks[CS],a);document.getElementById('audit-header-compact').innerHTML=renderStepper();}
async function reassignTask(i,val){const d=getAudData(CA);if(d.tasks[CS]&&d.tasks[CS][i])d.tasks[CS][i].assignee=val;await saveAuditData(CA);document.getElementById('audit-header-compact').innerHTML=renderStepper();if(val!=='none')toast(`Assigné à ${TM[val]?.name}`);}
function showNewTaskModal(){const a=getAudits().find(x=>x.id===CA);openModal('Nouvelle tâche',`<div><label>Description</label><input id="t-desc" placeholder="ex : Analyser les données..."/></div><div><label>Assignée à</label><select id="t-assign"><option value="none">— Non assignée</option>${buildAssigneeOpts(a.assignedTo,null)}</select></div>`,async ()=>{const desc=document.getElementById('t-desc').value.trim();if(!desc){toast('Description obligatoire');return;}const d=getAudData(CA);if(!d.tasks[CS])d.tasks[CS]=[];d.tasks[CS].push({desc,assignee:document.getElementById('t-assign').value,done:false});await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();document.getElementById('audit-header-compact').innerHTML=renderStepper();toast('Tâche créée ✓');});}
function showAddControlModal_LEGACY_REMOVED(){/* doublon retiré */}
async function removeControl(i){const d=getAudData(CA);d.controls[CS].splice(i,1);await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();}
async function setTestNature(i,val){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(c=>c.clef&&c.design==='existing');if(kc[i]){kc[i].testNature=val;await saveAuditData(CA);}}
async function setTestResult(i,val){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(c=>c.clef&&c.design==='existing');if(kc[i]){kc[i].result=val;await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();}}
async function setFinding(i,val){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(c=>c.clef&&c.design==='existing');if(kc[i]){kc[i].finding=val;await saveAuditData(CA);}}
async function setSampleSize(i,val){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(c=>c.clef&&c.design==='existing');if(kc[i]){kc[i].sampleSize=val?parseInt(val):null;await saveAuditData(CA);}}
async function setSampleMethod(i,val){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(c=>c.clef&&c.design==='existing');if(kc[i]){kc[i].sampleMethod=val;await saveAuditData(CA);}}
async function setTestComment(i,val){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(c=>c.clef&&c.design==='existing');if(kc[i]){kc[i].testComment=val;await saveAuditData(CA);}}
function showAddFindingModal() { showFindingModal(null); }
function showEditFindingModal(idx) {
  var d = getAudData(CA);
  var f = (d.findings||[])[idx];
  if (!f) return;
  showFindingModal({idx: idx, finding: f});
}
function showFindingModal(existing) {
  var d = getAudData(CA);
  var step5c = d.controls[4]||[];
  // Liste des contrôles "à traiter" : fail (test finalisé) + target
  var failedCtrls = step5c.filter(function(c){return c.clef && c.design==='existing' && c.finalized && c.result==='fail';});
  var targetCtrls = step5c.filter(function(c){return c.design==='target';});
  var problematicCtrls = failedCtrls.concat(targetCtrls);

  var f = existing ? existing.finding : {};
  var currentCtrlIds = (f.controlIds || []);

  // Construire la liste des checkboxes
  var ctrlsHtml = '';
  if (!problematicCtrls.length) {
    ctrlsHtml = '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:8px">Aucun contrôle fail ni target dans cet audit. Vous pouvez quand même créer un finding sans contrôle lié.</div>';
  } else {
    ctrlsHtml = problematicCtrls.map(function(c){
      var ctrlCode = c.code || c.id;
      var checked = currentCtrlIds.indexOf(c.id) >= 0 ? 'checked' : '';
      var typeLabel = c.design === 'target'
        ? '<span class="badge" style="background:#FAEEDA;color:#854F0B;font-size:9px">🎯 Target</span>'
        : '<span class="badge bfl" style="font-size:9px">❌ Fail</span>';
      var commentary = c.testComment
        ? '<div style="font-size:10px;color:var(--text-3);margin-top:2px;font-style:italic">'+c.testComment.replace(/</g,'&lt;')+'</div>'
        : '';
      return '<label style="display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-bottom:.5px solid var(--border);cursor:pointer">'
        + '<input type="checkbox" class="f-ctrl-cb" value="'+c.id+'" '+checked+' style="margin-top:3px"/>'
        + '<div style="flex:1">'
        + '<div style="display:flex;align-items:center;gap:6px">'
        + typeLabel
        + '<span style="font-size:10px;color:var(--text-3);font-family:monospace">'+ctrlCode+'</span>'
        + '<span style="font-size:11px;font-weight:500">'+c.name+'</span>'
        + '</div>'
        + commentary
        + '</div>'
        + '</label>';
    }).join('');
  }

  var body = '<div><label>Titre du finding <span style="color:var(--red)">*</span></label>'
    + '<input id="f-title" value="'+(f.title||'').replace(/"/g,'&quot;')+'" placeholder="ex : Ségrégation des tâches insuffisante en P2P"/></div>'
    + '<div><label>Description courte (Executive Summary)</label>'
    + '<div style="font-size:10px;color:var(--text-3);font-style:italic;margin-bottom:3px">2-3 lignes maximum. Apparaîtra en slide « Executive Summary - Findings ».</div>'
    + '<textarea id="f-desc-exec" style="width:100%;min-height:50px" placeholder="ex : Process incomplet de tracking des opportunités de renouvellement dans SFDC.">'+((f.descExec || '')).replace(/</g,'&lt;')+'</textarea></div>'
    + '<div><label>Description détaillée</label>'
    + '<div style="font-size:10px;color:var(--text-3);font-style:italic;margin-bottom:3px">Constat complet, contexte, lien avec les contrôles failed. Apparaîtra en slide détaillée du finding.</div>'
    + '<textarea id="f-desc-detail" style="width:100%;min-height:80px" placeholder="Description complète, références aux contrôles fail, contexte business...">'+(f.descDetailed || f.desc || '').replace(/</g,'&lt;')+'</textarea></div>'
    + '<div><label>Potential Risk</label>'
    + '<textarea id="f-risk" style="width:100%;min-height:50px" placeholder="ex : Missed renewals, lost revenue opportunities, contract leakage...">'+(f.potentialRisk||'').replace(/</g,'&lt;')+'</textarea></div>'
    + '<div class="g2" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">'
    + '<div><label>Owner</label>'
    + '<input id="f-owner" value="'+(f.owner||'').replace(/"/g,'&quot;')+'" placeholder="ex : Sales Ops Director"/></div>'
    + '<div><label>Probability</label>'
    + '<select id="f-prob"><option value="">— Choose —</option>'
    + '<option value="rare"'+(f.probability==='rare'?' selected':'')+'>Rare</option>'
    + '<option value="unlikely"'+(f.probability==='unlikely'?' selected':'')+'>Unlikely</option>'
    + '<option value="possible"'+(f.probability==='possible'?' selected':'')+'>Possible</option>'
    + '<option value="probable"'+(f.probability==='probable'?' selected':'')+'>Probable</option>'
    + '</select></div>'
    + '<div><label>Impact</label>'
    + '<select id="f-impact"><option value="">— Choose —</option>'
    + '<option value="minor"'+(f.impact==='minor'?' selected':'')+'>Minor</option>'
    + '<option value="limited"'+(f.impact==='limited'?' selected':'')+'>Limited</option>'
    + '<option value="major"'+(f.impact==='major'?' selected':'')+'>Major</option>'
    + '<option value="severe"'+(f.impact==='severe'?' selected':'')+'>Severe</option>'
    + '</select></div>'
    + '</div>'
    + '<div><label>Contrôles liés ('+problematicCtrls.length+' candidats)</label>'
    + '<div style="border:.5px solid var(--border);border-radius:4px;max-height:200px;overflow-y:auto;background:#fafafa">'
    + ctrlsHtml
    + '</div></div>';

  openModal(existing ? 'Éditer le finding' : 'Nouveau finding', body, async function(){
    var title = document.getElementById('f-title').value.trim();
    if (!title) { toast('Titre obligatoire'); return; }
    var descExec = document.getElementById('f-desc-exec').value.trim();
    var descDetailed = document.getElementById('f-desc-detail').value.trim();
    var potentialRisk = document.getElementById('f-risk').value.trim();
    var owner = document.getElementById('f-owner').value.trim();
    var probability = document.getElementById('f-prob').value;
    var impact = document.getElementById('f-impact').value;
    var checkedIds = Array.from(document.querySelectorAll('.f-ctrl-cb:checked')).map(function(cb){return cb.value;});

    if (!d.findings) d.findings = [];
    if (existing) {
      d.findings[existing.idx] = Object.assign({}, d.findings[existing.idx], {
        title: title,
        descExec: descExec,
        descDetailed: descDetailed,
        desc: descDetailed, // backward compat
        potentialRisk: potentialRisk,
        owner: owner,
        probability: probability,
        impact: impact,
        controlIds: checkedIds,
      });
      addHist('edit', 'Finding "'+title+'" modifié');
    } else {
      d.findings.push({
        id: 'f_'+Date.now(),
        title: title,
        descExec: descExec,
        descDetailed: descDetailed,
        desc: descDetailed,
        potentialRisk: potentialRisk,
        owner: owner,
        probability: probability,
        impact: impact,
        controlIds: checkedIds,
        createdAt: new Date().toISOString(),
      });
      addHist('add', 'Finding "'+title+'" créé');
    }
    await saveAuditData(CA);
    document.getElementById('det-content').innerHTML = renderDetContent();
    toast('Finding '+(existing?'modifié':'ajouté')+' ✓');
  });
}
async function removeManualFinding(i){const d=getAudData(CA);d.findings.splice(i,1);await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();}
async function setMgtResp(findingId,field,val){const d=getAudData(CA);const r=d.mgtResp.find(x=>x.findingId===findingId);if(r){r[field]=val;await saveAuditData(CA);}}
function pushAllMgtResp(){
  const d=getAudData(CA);
  const ap=AUDIT_PLAN.find(a=>a.id===CA);
  const pushed=d.mgtResp.filter(r=>r.action&&r.owner&&!r.pushed);
  if(!pushed.length){toast('Aucune réponse complète à envoyer');return;}
  pushed.forEach(r=>{
    const f=(d.findings||[]).find((x,i)=>(x.id||('f_'+i))===r.findingId);
    if(!f)return;
    ACTIONS.unshift({
      id:'ac'+Date.now()+Math.random(),
      title:r.action,
      audit:ap?.titre||'—',
      resp:CU?.name||'—',
      dept:r.owner,
      ent:ap?.type==='BU'?ap.entite:'Groupe',
      year:r.year,
      quarter:r.quarter,
      status:'Non démarré',
      pct:0,
      fromFinding:true,
      findingTitle:f.title
    });
    r.pushed=true;
    addHist('add',`Plan d'action créé depuis finding "${f.title}"`);
  });
  document.getElementById('det-content').innerHTML=renderDetContent();
  toast(pushed.length+' plan(s) d\'action créé(s) ✓');
}
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
// Helper visionneuse : ouvre un doc par ses driveId/itemId (pour boutons inline)
function openDocByDriveItem(driveId, itemId, name, url) {
  if (typeof openDocViewer === 'function') {
    openDocViewer({ driveId: driveId, itemId: itemId, name: name, url: url });
  } else {
    toast('Visionneuse non disponible');
  }
}

async function renameDoc(docIndex){var d=getAudData(CA);var doc=d.docs[docIndex];if(!doc)return;var newName=prompt('Nouveau nom :', doc.name);if(!newName||newName.trim()===''||newName===doc.name)return;try{await renameDocInDB(CA,docIndex,newName.trim());document.getElementById('det-content').innerHTML=renderDetContent();toast('Renommé ✓');}catch(e){toast('Erreur : '+e.message);}}
async function replaceDoc(docIndex){var inp=document.createElement('input');inp.type='file';inp.accept='.pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.csv,.txt';inp.onchange=async function(){if(!inp.files.length)return;var file=inp.files[0];toast('Remplacement...');try{await replaceDocInDB(CA,docIndex,file,CS,CU?CU.name:'Inconnu');document.getElementById('det-content').innerHTML=renderDetContent();toast(file.name+' remplacé ✓');}catch(e){toast('Erreur : '+e.message);}};inp.click();}
async function saveNotes(){var d=getAudData(CA);d.notes=document.querySelector('textarea')?document.querySelector('textarea').value:'';await saveAuditData(CA);toast('Notes sauvegardées ✓');}
async function finalizeTest(i){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(x=>x.clef&&x.design==='existing');const ctrl=kc[i];if(!ctrl)return;if(!ctrl.testNature){toast('Renseignez la nature du test');return;}if(!ctrl.result){toast('Renseignez le résultat (Pass/Fail)');return;}if(ctrl.result==='fail'&&!ctrl.testComment){toast('Documentez le commentaire de test (constats)');return;}ctrl.finalized=true;addHist('edit',`Test finalisé — "${ctrl.name}" : ${ctrl.result}`);await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();toast(`Test "${ctrl.name}" finalisé ✓`);}
async function unfinalizeTest(i){const d=getAudData(CA);const kc=(d.controls[4]||[]).filter(x=>x.clef&&x.design==='existing');const ctrl=kc[i];if(!ctrl)return;ctrl.finalized=false;addHist('edit',`Test rouvert — "${ctrl.name}"`);await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();toast(`Test "${ctrl.name}" rouvert`);}
function setMaturity(key){const d=getAudData(CA);if(!d.maturity)d.maturity={level:'',notes:'',saved:false};d.maturity.level=key;d.maturity.saved=false;document.getElementById('det-content').innerHTML=renderDetContent();}
async function saveMaturity(){const d=getAudData(CA);if(!d.maturity?.level){toast('Veuillez sélectionner un niveau');return;}d.maturity.notes=document.getElementById('maturity-notes')?.value||'';d.maturity.saved=true;addHist('edit',`Maturité définie : ${d.maturity.level}`);await saveAuditData(CA);toast('Évaluation sauvegardée ✓');document.getElementById('det-content').innerHTML=renderDetContent();}

function buildControlList(ctrls){if(!ctrls||!ctrls.length)return'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun contrôle identifié.</div>';var h='<div class="ch"><span>Contrôle</span><span>Owner</span><span>Fréquence</span><span>Clef ?</span><span>Design</span><span></span></div>';ctrls.forEach(function(ctrl,ci){h+='<div class="cr"><span style="font-weight:500">'+ctrl.name+'</span><span style="color:var(--text-2)">'+ctrl.owner+'</span><span style="color:var(--text-2)">'+ctrl.freq+'</span><span><span class="badge '+(ctrl.clef?'bps':'bpl')+'">'+(ctrl.clef?'Oui':'Non')+'</span></span><span><span class="badge '+(ctrl.design==='existing'?'bdn':'btg')+'">'+(ctrl.design==='existing'?'Existing':'Target')+'</span></span><button class="bd" style="font-size:10px;padding:2px 6px" onclick="removeControl('+ci+')">X</button></div>';});return h;}
function buildTargetList(targets){if(!targets||!targets.length)return'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun contrôle target.</div>';return targets.map(function(ctrl){return'<div class="fr"><div class="fh"><span class="badge btg">Target</span><div class="ft">'+ctrl.name+'</div></div><div style="font-size:11px;color:var(--red)">Contrôle non existant — à définir par '+ctrl.owner+'.</div></div>';}).join('');}
function buildExecTable(kc){
  if (!kc || !kc.length) return '<div style="font-size:11px;color:var(--text-3);padding:.5rem;font-style:italic">Aucun contrôle clef existant à tester.</div>';
  var d = getAudData(CA);
  var wcgwList = (d.wcgw && d.wcgw[4]) || [];
  var html = '';
  kc.forEach(function(ctrl, i){
    var dis = ctrl.finalized ? 'disabled' : '';
    var ctrlCode = ctrl.code || ('CTRL-'+(i+1));
    var wcgwLinked = wcgwList.find(function(w){return w.id === ctrl.wcgwId;});
    var wcgwBadge = wcgwLinked
      ? '<span class="badge bpl" style="font-size:9px;padding:1px 5px">'+(wcgwLinked.code||'')+' — '+wcgwLinked.title+'</span>'
      : '<span style="font-size:10px;color:#854F0B;font-style:italic">Pas de WCGW lié</span>';
    var details = [];
    if (ctrl.owner) details.push('Owner : '+ctrl.owner);
    if (ctrl.freq) details.push('Fréquence : '+ctrl.freq);
    if (ctrl.nature) details.push('Nature : '+ctrl.nature);
    var resultBadge = ctrl.result === 'pass'
      ? '<span class="badge bdn" style="font-size:10px">✓ Pass</span>'
      : ctrl.result === 'fail'
      ? '<span class="badge bfl" style="font-size:10px">✗ Fail</span>'
      : '';

    html += '<div style="border:.5px solid var(--border);border-radius:6px;padding:12px;margin-bottom:10px;background:'+(ctrl.finalized?'#fafafa':'#fff')+'">';
    // En-tête
    html += '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">';
    html += '<div style="flex:1">';
    html += '<div style="font-size:12px;font-weight:600"><span style="color:var(--text-3);font-size:10px;margin-right:6px">'+ctrlCode+'</span>'+ctrl.name+'</div>';
    if (ctrl.description) html += '<div style="font-size:10px;color:var(--text-3);margin-top:2px">'+ctrl.description+'</div>';
    html += '<div style="font-size:10px;color:var(--text-2);margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
    html += wcgwBadge;
    if (details.length) html += '<span>·</span><span>'+details.join(' · ')+'</span>';
    html += '</div>';
    html += '</div>';
    if (resultBadge) html += '<div style="flex-shrink:0">'+resultBadge+'</div>';
    if (ctrl.finalized) html += '<span class="badge bdn" style="font-size:10px;flex-shrink:0">Finalisé</span>';
    html += '</div>';

    // Champs de test
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">';
    // Nature de test (textarea libre)
    html += '<div style="grid-column:span 2">';
    html += '<label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px">Nature du test</label>';
    html += '<textarea onchange="setTestNature('+i+',this.value)" '+dis+' placeholder="Décrivez la procédure de test..." style="width:100%;min-height:50px;font-size:11px;padding:6px">'+(ctrl.testNature||'')+'</textarea>';
    html += '</div>';
    // Sample size + méthode
    html += '<div>';
    html += '<label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px">Taille du sample</label>';
    html += '<input type="number" min="0" onchange="setSampleSize('+i+',this.value)" '+dis+' value="'+(ctrl.sampleSize||'')+'" placeholder="ex : 25" style="width:100%;font-size:11px;padding:6px"/>';
    html += '</div>';
    html += '<div>';
    html += '<label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px">Méthode d\'échantillonnage</label>';
    html += '<select onchange="setSampleMethod('+i+',this.value)" '+dis+' style="width:100%;font-size:11px;padding:6px">';
    html += '<option value="">— Choisir —</option>';
    html += '<option value="random"'+(ctrl.sampleMethod==='random'?' selected':'')+'>Aléatoire</option>';
    html += '<option value="judgmental"'+(ctrl.sampleMethod==='judgmental'?' selected':'')+'>Judgmental</option>';
    html += '<option value="full"'+(ctrl.sampleMethod==='full'?' selected':'')+'>Full population</option>';
    html += '</select>';
    html += '</div>';
    // Résultat
    html += '<div style="grid-column:span 2">';
    html += '<label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px">Résultat</label>';
    html += '<div style="display:flex;gap:12px;padding:4px 0">';
    html += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px">';
    html += '<input type="radio" name="result-'+i+'" value="pass" '+(ctrl.result==='pass'?'checked':'')+' '+dis+' onchange="setTestResult('+i+',this.value)"/> ✓ Pass';
    html += '</label>';
    html += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px">';
    html += '<input type="radio" name="result-'+i+'" value="fail" '+(ctrl.result==='fail'?'checked':'')+' '+dis+' onchange="setTestResult('+i+',this.value)"/> ✗ Fail';
    html += '</label>';
    html += '</div>';
    html += '</div>';
    // Commentaire de test
    html += '<div style="grid-column:span 2">';
    html += '<label style="font-size:10px;color:var(--text-3);display:block;margin-bottom:3px">Commentaire de test (observations)</label>';
    html += '<textarea onchange="setTestComment('+i+',this.value)" '+dis+' placeholder="Ce que vous avez constaté pendant le test (chiffres, exceptions, anomalies...)..." style="width:100%;min-height:50px;font-size:11px;padding:6px">'+(ctrl.testComment||'')+'</textarea>';
    html += '</div>';
    html += '</div>';

    // Bouton finaliser
    if (!ctrl.finalized) {
      html += '<div style="display:flex;justify-content:flex-end;margin-top:8px">';
      html += '<button class="bp" style="font-size:11px;padding:5px 12px" onclick="finalizeTest('+i+')">Finaliser le test</button>';
      html += '</div>';
    } else {
      html += '<div style="display:flex;justify-content:flex-end;margin-top:8px">';
      html += '<button class="bs" style="font-size:11px;padding:5px 12px" onclick="unfinalizeTest('+i+')">Rouvrir</button>';
      html += '</div>';
    }
    html += '</div>';
  });
  return html;
}
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
    // View button : ouvre la visionneuse intégrée
    var viewBtn = '';
    if (f.driveId && f.itemId) {
      viewBtn = '<button class="bs" style="font-size:10px;padding:2px 7px;background:#EEEDFE;color:#3C3489;border-color:#CECBF6" onclick="openDocViewer(getAudData(CA).docs['+fi+'])">👁 Voir</button>';
    }

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
        + viewBtn
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
          <div style="font-size:11px;color:var(--text-3);margin-top:2px;">${CU&&CU.role==='admin'?'Admin / Directeur':CU&&CU.role==='viewer'?'Observateur':'Auditeur(rice)'}</div>
        </div>
      </div>
      <div style="font-size:13px;font-weight:600;margin-bottom:.5rem;">Sécurité du compte</div>
      <div style="font-size:12px;color:var(--text-2);line-height:1.6;margin-bottom:1rem;">
        Votre accès à AuditFlow utilise le compte Microsoft de l'entreprise (SSO Entra ID).
        La gestion du mot de passe, de l'authentification multi-facteur (MFA) et des appareils
        de confiance se fait dans le portail Microsoft.
      </div>
      <a href="https://mysignins.microsoft.com/security-info" target="_blank" rel="noopener noreferrer"
         class="bp" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none;width:auto;">
        🔐 Gérer mon compte Microsoft
      </a>
    </div>
  </div>`;
I['profil']=()=>{};

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

  // ── Section Risques du processus ──────────────────────────
  // Récupérer tous les risques URD associés aux processus de l'audit
  var pids = (Array.isArray(ap.processIds) && ap.processIds.length) ? ap.processIds : (ap.processId ? [ap.processId] : []);
  var seenRiskIds = {};
  var auditRisks = [];
  pids.forEach(function(pid){
    var p = PROCESSES.find(function(x){return x.id===pid;});
    if (!p) return;
    var procName = p.proc;
    (p.riskRefs||[]).forEach(function(rid){
      if (seenRiskIds[rid]) return;
      seenRiskIds[rid] = true;
      var r = (RISK_UNIVERSE||[]).find(function(x){return x.id===rid;});
      if (r) auditRisks.push(Object.assign({}, r, {_procName: procName}));
    });
  });

  var risksHtml = '<div class="section">'
    + '<div class="section-title">Risques du processus ('+auditRisks.length+')</div>';
  if (auditRisks.length) {
    var riskRows = auditRisks.map(function(r){
      var typesStr = (r.impactTypes||[]).join(', ') || '—';
      var impactColor = ({'Minor':'#059669','Limited':'#B45309','Major':'#DC2626','Severe':'#7F1D1D'})[r.impact] || '#6B7280';
      return '<tr>'
        + '<td style="font-weight:500">'+(r.title||'')+'</td>'
        + '<td style="color:#6B7280;font-size:11px">'+(r.description||'—')+'</td>'
        + '<td style="color:#6B7280">'+(r.probability||'—')+'</td>'
        + '<td><span style="color:'+impactColor+';font-weight:600">'+(r.impact||'—')+'</span></td>'
        + '<td style="color:#6B7280;font-size:11px">'+typesStr+'</td>'
        + '</tr>';
    }).join('');
    risksHtml += '<table><thead><tr><th>Risque</th><th>Description</th><th>Probabilité</th><th>Impact</th><th>Types</th></tr></thead><tbody>'+riskRows+'</tbody></table>';
  } else {
    risksHtml += '<div style="color:#9CA3AF;font-size:12px;font-style:italic">Aucun risque associé au processus dans l\'Audit Universe.</div>';
  }
  risksHtml += '</div>';

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
    +adminHtml+risksHtml+execHtml+ctrlHtml+targetHtml+findHtml
    +'</body></html>';

  var w=window.open('','_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(function(){w.print();},400);
}

// Helper anti-XSS pour les attributs onclick (apostrophes)
function _escQ(s){return(s||'').replace(/'/g,'&#39;');}
