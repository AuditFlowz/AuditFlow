// Génère un UUID v4 compatible Supabase
function uuidv4(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){
    var r=Math.random()*16|0;
    return(c==='x'?r:(r&0x3|0x8)).toString(16);
  });
}

const V={},I={};

// v75 fallback : si data.js n'a pas (encore) défini ces constantes/fonctions root cause,
// on en fournit une version minimale ici pour ne pas casser le rendu.
if (typeof ROOT_CAUSE_CATEGORIES === 'undefined') {
  window.ROOT_CAUSE_CATEGORIES = [
    {id: 'awareness',     label: 'Lack of awareness / Training',         shortLabel: 'Awareness/Training',  color: '#3C3489'},
    {id: 'process',       label: 'Inadequate process design',            shortLabel: 'Process design',      color: '#7C3AED'},
    {id: 'resources',     label: 'Insufficient resources',               shortLabel: 'Resources',           color: '#0E7490'},
    {id: 'oversight',     label: 'Inadequate supervision / Oversight',   shortLabel: 'Oversight',           color: '#854F0B'},
    {id: 'tooling',       label: 'Inadequate IT systems / Tooling',      shortLabel: 'IT/Tooling',          color: '#1E40AF'},
    {id: 'sod',           label: 'Lack of segregation of duties',        shortLabel: 'Segregation of duties', color: '#9A3412'},
    {id: 'policy',        label: 'Inadequate policies / Standards',      shortLabel: 'Policies',            color: '#085041'},
    {id: 'culture',       label: 'Cultural / Behavioral',                shortLabel: 'Culture/Behavior',    color: '#BE185D'},
    {id: 'external',      label: 'External constraints',                 shortLabel: 'External',            color: '#1F2937'},
    {id: 'tbd',           label: 'À déterminer',                          shortLabel: 'À déterminer',         color: '#6B7280'},
  ];
}
if (typeof _getRootCauseCategory === 'undefined') {
  window._getRootCauseCategory = function(id) {
    if (!id) return null;
    return ROOT_CAUSE_CATEGORIES.find(function(c){return c.id === id;}) || null;
  };
}


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
    // Sauvegarder via le helper centralisé (gère univers/dom/proc/etc.)
    await saveProcessFull(proc);
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
  await saveProcessFull(proc);
  toast('Risque ajouté ✓');
}

async function removeProcRisk(procId,ri){
  // Conservée pour compat (plus appelée depuis l'UI)
  var proc=PROCESSES.find(function(p){return p.id===procId;});
  if(!proc||!proc.risks)return;
  proc.risks.splice(ri,1);
  await saveProcessFull(proc);
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
//  AUDIT UNIVERSE (Plan Process) — restauré à l'état d'origine
//  Process + risques uniquement. Les sous-processus + tests
//  ont été déplacés vers le BU Work Program (référentiel séparé).
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

// État UI pour le tri/filtre du tableau Audit Universe
// (en mémoire seulement, pas persisté)
var _puFilterUniv = '';   // '' = tous
var _puFilterDom = '';    // '' = tous
var _puFilterText = '';   // recherche par nom de Process
var _puSortCol = 'univ';  // 'univ' | 'dom' | 'proc' | 'risk'
var _puSortDir = 'asc';   // 'asc' | 'desc'

function renderProcTable(){
  // Construire la liste plate des Process (non archivés)
  var allProcs = PROCESSES.filter(function(p){return !p.archived;});

  // Listes uniques pour les selects de filtre (avant filtrage)
  var allUniverses = {};
  var allDomains = {};
  allProcs.forEach(function(p){
    if (p.univers) allUniverses[p.univers] = true;
    if (p.dom) allDomains[p.dom] = true;
  });
  var UNIVERS_ORDER = ['GOVERNANCE', 'EDITION (Factory)', 'DISTRIBUTION', 'SUPPORT FUNCTIONS'];
  var universList = Object.keys(allUniverses).sort(function(a,b){
    var ia=UNIVERS_ORDER.indexOf(a), ib=UNIVERS_ORDER.indexOf(b);
    if (ia<0) ia=999; if (ib<0) ib=999;
    if (ia!==ib) return ia-ib;
    return a.localeCompare(b, 'fr', {sensitivity:'base'});
  });
  var domainList = Object.keys(allDomains).sort(function(a,b){return a.localeCompare(b, 'fr', {sensitivity:'base'});});

  // Appliquer les filtres
  var filtered = allProcs.filter(function(p){
    if (_puFilterUniv && (p.univers||'') !== _puFilterUniv) return false;
    if (_puFilterDom && (p.dom||'') !== _puFilterDom) return false;
    if (_puFilterText) {
      var needle = _puFilterText.toLowerCase();
      if ((p.proc||'').toLowerCase().indexOf(needle) < 0) return false;
    }
    return true;
  });

  // Niveaux de risque pour le tri (asc = du plus faible au plus fort)
  var riskOrder = {'faible':1, 'modéré':2, 'élevé':3, 'critique':4};
  function getRiskLevel(p) {
    return (p.riskRefs && p.riskRefs.length)
      ? computeProcRiskLevelFromRefs(p.riskRefs)
      : (p.riskLevel || 'faible');
  }

  // Tri
  filtered.sort(function(a, b){
    var va, vb;
    if (_puSortCol === 'univ') {
      var ai = UNIVERS_ORDER.indexOf(a.univers||''); if (ai<0) ai=999;
      var bi = UNIVERS_ORDER.indexOf(b.univers||''); if (bi<0) bi=999;
      if (ai !== bi) va = ai, vb = bi;
      else va = (a.univers||'').toLowerCase(), vb = (b.univers||'').toLowerCase();
    } else if (_puSortCol === 'dom') {
      va = (a.dom||'').toLowerCase(); vb = (b.dom||'').toLowerCase();
    } else if (_puSortCol === 'proc') {
      va = (a.proc||'').toLowerCase(); vb = (b.proc||'').toLowerCase();
    } else if (_puSortCol === 'risk') {
      va = riskOrder[getRiskLevel(a)] || 0;
      vb = riskOrder[getRiskLevel(b)] || 0;
    }
    var cmp;
    if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
    else cmp = (''+va).localeCompare(''+vb, 'fr', {sensitivity:'base'});
    // Tri secondaire par Univers > Domaine > Process pour stabilité
    if (cmp === 0 && _puSortCol !== 'univ') {
      var au = UNIVERS_ORDER.indexOf(a.univers||''); if (au<0) au=999;
      var bu = UNIVERS_ORDER.indexOf(b.univers||''); if (bu<0) bu=999;
      cmp = au - bu;
    }
    if (cmp === 0 && _puSortCol !== 'proc') {
      cmp = (a.proc||'').localeCompare(b.proc||'', 'fr', {sensitivity:'base'});
    }
    return _puSortDir === 'desc' ? -cmp : cmp;
  });

  // ─── Construire le HTML (filtres + tableau) ────────────────────
  var isAdmin = (CU && CU.role==='admin');

  // Barre de filtres (au-dessus du tableau)
  var filterBar = '<div style="display:flex;gap:8px;align-items:center;padding:10px 12px;background:#fafafa;border:.5px solid var(--border);border-bottom:none;border-radius:6px 6px 0 0;flex-wrap:wrap">';
  filterBar += '<span style="font-size:11px;color:var(--text-3);font-weight:500;text-transform:uppercase;letter-spacing:.4px">Filtrer</span>';
  // Filtre Univers
  filterBar += '<select onchange="_puSetFilter(\'univ\',this.value)" style="font-size:11px;padding:4px 8px;border:.5px solid var(--border);border-radius:3px;background:#fff">';
  filterBar += '<option value="">Tous les univers</option>';
  universList.forEach(function(u){
    filterBar += '<option value="'+_escAttr(u)+'"'+(_puFilterUniv===u?' selected':'')+'>'+(''+u).replace(/</g,'&lt;')+'</option>';
  });
  filterBar += '</select>';
  // Filtre Domaine
  filterBar += '<select onchange="_puSetFilter(\'dom\',this.value)" style="font-size:11px;padding:4px 8px;border:.5px solid var(--border);border-radius:3px;background:#fff">';
  filterBar += '<option value="">Tous les domaines</option>';
  domainList.forEach(function(dd){
    filterBar += '<option value="'+_escAttr(dd)+'"'+(_puFilterDom===dd?' selected':'')+'>'+(''+dd).replace(/</g,'&lt;')+'</option>';
  });
  filterBar += '</select>';
  // Recherche texte
  filterBar += '<input type="text" placeholder="Rechercher un Process..." value="'+_escAttr(_puFilterText)+'" oninput="_puSetFilter(\'text\',this.value)" style="font-size:11px;padding:4px 8px;border:.5px solid var(--border);border-radius:3px;background:#fff;flex:1;min-width:160px;max-width:280px"/>';
  // Compteur + reset
  filterBar += '<span style="font-size:11px;color:var(--text-3);margin-left:auto">'+filtered.length+' / '+allProcs.length+' process</span>';
  if (_puFilterUniv || _puFilterDom || _puFilterText) {
    filterBar += '<button class="bs" style="font-size:11px;padding:4px 8px" onclick="_puResetFilters()">Réinitialiser</button>';
  }
  filterBar += '</div>';

  // En-têtes de tableau avec icône de tri
  function sortIcon(col) {
    if (_puSortCol !== col) return '<span style="opacity:.3;margin-left:3px">⇅</span>';
    return _puSortDir === 'asc'
      ? '<span style="margin-left:3px">▲</span>'
      : '<span style="margin-left:3px">▼</span>';
  }
  function sortableTh(col, label, width) {
    return '<th style="width:'+width+';cursor:pointer;user-select:none" onclick="_puToggleSort(\''+col+'\')">'+label+sortIcon(col)+'</th>';
  }

  var h = '';
  h += '<thead><tr>';
  h += sortableTh('univ', 'Univers', '17%');
  h += sortableTh('dom', 'Domaine', '22%');
  h += sortableTh('proc', 'Process', '24%');
  h += sortableTh('risk', 'Risque', '11%');
  h += '<th style="width:9%">Risques</th>';
  h += '<th style="width:17%">Actions</th>';
  h += '</tr></thead><tbody>';

  if (!filtered.length) {
    h += '<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:2rem;font-style:italic">';
    if (allProcs.length === 0) h += 'Aucun processus. Cliquez sur "+ Domaine" pour commencer.';
    else h += 'Aucun process ne correspond aux filtres. Essaie de réinitialiser.';
    h += '</td></tr>';
  } else {
    filtered.forEach(function(p){
      var idx = PROCESSES.indexOf(p);
      var effectiveLevel = getRiskLevel(p);
      var riskCell = riskLabel(effectiveLevel);
      var refCount = (p.riskRefs||[]).length;

      // Compteur de risques : caché si 0, pill neutre si > 0
      var risksCell = refCount > 0
        ? '<button class="bs" style="font-size:10px;padding:2px 8px;background:#f1efe8;color:#5f5e5a;border:.5px solid #d3d1c7;border-radius:3px;cursor:pointer" onclick="showProcRisksModal(\''+p.id+'\')" title="Voir les risques liés">⚠ '+refCount+'</button>'
        : (isAdmin
            ? '<button class="bs" style="font-size:10px;padding:2px 8px;color:var(--text-3);opacity:.6" onclick="showProcRisksModal(\''+p.id+'\')" title="Aucun risque lié">—</button>'
            : '<span style="color:var(--text-3);font-size:11px">—</span>');

      // Cellule Univers : avec bouton Renommer au survol (admin only)
      var univName = (p.univers||'(sans)').replace(/</g,'&lt;');
      var univCell = isAdmin
        ? '<td class="hover-rename" style="font-size:11px;color:var(--text-2);position:relative">'
            + '<span>'+univName+'</span>'
            + '<button class="rename-btn" onclick="event.stopPropagation();showRenameUniversModal(\''+_escJsArg(p.univers||'')+'\')" style="font-size:9px;padding:1px 5px;margin-left:6px;border:.5px solid var(--border);border-radius:3px;background:#fff;cursor:pointer;color:var(--text-3);opacity:0;transition:opacity .15s">Renommer</button>'
          + '</td>'
        : '<td style="font-size:11px;color:var(--text-2)">'+univName+'</td>';

      // Cellule Domaine : avec bouton Renommer au survol (admin only)
      var domName = (p.dom||'(sans)').replace(/</g,'&lt;');
      var domCell = isAdmin
        ? '<td class="hover-rename" style="font-size:11px;color:var(--text-2);position:relative">'
            + '<span>'+domName+'</span>'
            + '<button class="rename-btn" onclick="event.stopPropagation();showRenameDomainModal(\''+_escJsArg(p.dom||'')+'\')" style="font-size:9px;padding:1px 5px;margin-left:6px;border:.5px solid var(--border);border-radius:3px;background:#fff;cursor:pointer;color:var(--text-3);opacity:0;transition:opacity .15s">Renommer</button>'
          + '</td>'
        : '<td style="font-size:11px;color:var(--text-2)">'+domName+'</td>';

      // Cellule Actions
      var actionsCell = isAdmin
        ? '<td style="white-space:nowrap">'
            + '<button class="bs" style="font-size:10px;padding:2px 7px" onclick="showEditProcModal('+idx+')" title="Modifier le Process">Modifier</button> '
            + '<button class="bd" style="font-size:10px;padding:2px 7px" onclick="archiveProc('+idx+')" title="Archiver le Process">Archiver</button>'
          + '</td>'
        : '<td><span style="font-size:10px;color:var(--text-3)">—</span></td>';

      h += '<tr>';
      h += univCell;
      h += domCell;
      h += '<td style="font-weight:500;font-size:12px">'+(''+p.proc).replace(/</g,'&lt;')+'</td>';
      h += '<td>'+riskCell+'</td>';
      h += '<td>'+risksCell+'</td>';
      h += actionsCell;
      h += '</tr>';
    });
  }

  // Style hover pour révéler les boutons Renommer (injection one-shot)
  if (!document.getElementById('pp-hover-style')) {
    var st = document.createElement('style');
    st.id = 'pp-hover-style';
    st.textContent = '#pp-tbl tr:hover .rename-btn{opacity:1!important}';
    document.head.appendChild(st);
  }

  // Injecter dans le DOM
  var tbl = document.getElementById('pp-tbl');
  if (tbl) {
    tbl.innerHTML = h + '</tbody>';
    // Insérer la barre de filtres juste avant la table (si pas déjà là)
    var existingBar = document.getElementById('pp-filter-bar');
    if (existingBar) existingBar.remove();
    var barDiv = document.createElement('div');
    barDiv.id = 'pp-filter-bar';
    barDiv.innerHTML = filterBar;
    tbl.parentNode.insertBefore(barDiv.firstChild, tbl);
  }
}

// ─── Setters de filtre/tri (pour les controls ci-dessus) ──────────
function _puSetFilter(kind, val) {
  if (kind === 'univ') _puFilterUniv = val;
  else if (kind === 'dom') _puFilterDom = val;
  else if (kind === 'text') _puFilterText = val;
  renderProcTable();
}

function _puResetFilters() {
  _puFilterUniv = '';
  _puFilterDom = '';
  _puFilterText = '';
  renderProcTable();
}

function _puToggleSort(col) {
  if (_puSortCol === col) {
    _puSortDir = (_puSortDir === 'asc') ? 'desc' : 'asc';
  } else {
    _puSortCol = col;
    _puSortDir = 'asc';
  }
  renderProcTable();
}

// ══════════════════════════════════════════════════════════════
//  HELPERS PARTAGÉS (utilisés par le BU Work Program)
// ══════════════════════════════════════════════════════════════
// Échappe une string pour usage en attribut HTML
function _escAttr(s) { return (''+(s||'')).replace(/"/g,'&quot;').replace(/'/g,"&#39;"); }
// Échappe pour usage dans un onclick="..."
function _escJsArg(s) { return (''+(s||'')).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }


// ══════════════════════════════════════════════════════════════
//  BU WORK PROGRAM — Référentiel des tests substantifs BU
//
//  Le BU Work Program n'a PAS ses propres "Process" : il s'appuie
//  sur les Process de l'Audit Universe (lien vivant). Une entrée
//  BU_PROCESSES = { auditProcessId, tests: [...] }.
//  Le NOM, le DOMAINE, etc. proviennent toujours de PROCESSES
//  (Audit Universe). Renommer un Process dans Audit Universe se
//  reflète immédiatement ici.
//
//  Structure simplifiée : pas de niveau "sous-processus".
//  Process > Tests directement.
// ══════════════════════════════════════════════════════════════

var TEST_TYPES = ['Test of Design', 'Test of Effectiveness', 'Substantive'];
var _buwpCurrentProcId = null; // ID du Process Audit Universe actuellement sélectionné
var _buwpShowEmpty = false; // Afficher les Process sans tests BU ? (par défaut : non)

V['bu-work-program']=()=>`
  <div class="topbar">
    <div class="tbtitle">BU Work Program</div>
    <div style="display:flex;gap:7px">
      <button id="buwp-toggle-empty" class="bs" onclick="buwpToggleShowEmpty()" style="font-size:11px;padding:4px 10px"></button>
    </div>
  </div>
  <div class="content">
    <div style="font-size:11px;color:var(--text-2);margin-bottom:10px;font-style:italic">Référentiel des tests substantifs standardisés. S'appuie sur les processus de l'Audit Universe (renommer là-bas se répercute ici). Pour chaque process, ajoute la liste des tests à réaliser dans un audit BU.</div>
    <div id="buwp-list"></div>
  </div>`;

I['bu-work-program']=()=>{
  _updateBuwpToggleBtn();
  renderBuwpList();
};

// Met à jour le label du bouton toggle selon l'état
function _updateBuwpToggleBtn() {
  var btn = document.getElementById('buwp-toggle-empty');
  if (!btn) return;
  btn.textContent = _buwpShowEmpty ? 'Masquer les non-couverts' : 'Afficher tous les process';
}

// Toggle affichage des Process sans tests
function buwpToggleShowEmpty() {
  _buwpShowEmpty = !_buwpShowEmpty;
  _updateBuwpToggleBtn();
  renderBuwpList();
}

function _getBuEntry(auditProcessId) {
  return (BU_PROCESSES||[]).find(function(b){return b.auditProcessId===auditProcessId;});
}

// Helper : nombre de tests pour un Process Audit Universe donné
function _buCounts(auditProcessId) {
  var entry = _getBuEntry(auditProcessId);
  if (!entry || !entry.tests) return {tests:0};
  return {tests: entry.tests.length};
}

// État UI (mémoire seulement, pas persisté)
// Tous les Process repliés par défaut
var _buwpExpandedProcs = {};
var _buwpExpandedTests = {};

// Toggle pliage Process
function toggleBuwpProcess(auditProcessId) {
  _buwpExpandedProcs[auditProcessId] = !_buwpExpandedProcs[auditProcessId];
  renderBuwpList();
}

// Toggle pliage test (déplie/replie son détail inline)
function toggleBuwpTest(testId) {
  _buwpExpandedTests[testId] = !_buwpExpandedTests[testId];
  renderBuwpList();
}

// ─── Rendu principal : liste des Process en cartes pliables ─────
function renderBuwpList() {
  var box = document.getElementById('buwp-list');
  if (!box) return;
  var isAdmin = CU && CU.role==='admin';

  // Filtrer Process : actifs, et selon toggle "Afficher tous"
  var procs = (PROCESSES||[]).filter(function(p){return !p.archived;});
  if (!_buwpShowEmpty) {
    procs = procs.filter(function(p){return _buCounts(p.id).tests > 0;});
  }
  // Trier : Univers > Domaine > Process
  var UNIVERS_ORDER = ['GOVERNANCE', 'EDITION (Factory)', 'DISTRIBUTION', 'SUPPORT FUNCTIONS'];
  procs.sort(function(a, b){
    var au = UNIVERS_ORDER.indexOf(a.univers||''); if (au<0) au=999;
    var bu = UNIVERS_ORDER.indexOf(b.univers||''); if (bu<0) bu=999;
    if (au !== bu) return au - bu;
    var ud = (a.univers||'').localeCompare(b.univers||'', 'fr', {sensitivity:'base'});
    if (ud) return ud;
    var dd = (a.dom||'').localeCompare(b.dom||'', 'fr', {sensitivity:'base'});
    if (dd) return dd;
    return (a.proc||'').localeCompare(b.proc||'', 'fr', {sensitivity:'base'});
  });

  if (!procs.length) {
    box.innerHTML = '<div style="font-size:12px;color:var(--text-3);font-style:italic;padding:1.5rem;text-align:center;border:1px dashed var(--border);border-radius:6px">'
      + (_buwpShowEmpty
          ? 'Aucun processus dans l\'Audit Universe.'
          : 'Aucun processus n\'a de tests substantifs définis. Activez « Afficher tous les process » pour en ajouter.')
      + '</div>';
    return;
  }

  var h = '';
  procs.forEach(function(p){
    h += renderBuwpProcessCard(p, isAdmin);
  });
  box.innerHTML = h;
}

// ─── Carte Process ──────────────────────────────────────────────
function renderBuwpProcessCard(p, isAdmin) {
  var entry = _getBuEntry(p.id);
  var tests = (entry && Array.isArray(entry.tests)) ? entry.tests : [];
  var testCount = tests.length;
  var expanded = !!_buwpExpandedProcs[p.id];

  var hierarchy = (p.univers||'') + (p.univers && p.dom ? ' > ' : '') + (p.dom||'');

  var h = '';
  h += '<div style="border:.5px solid var(--border);border-radius:6px;margin-bottom:6px;background:#fff;overflow:hidden">';

  // Header compact (1 ligne, cliquable pour plier/déplier)
  h += '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#fafafa;cursor:pointer" onclick="toggleBuwpProcess(\''+_escJsArg(p.id)+'\')">';
  h += '<span style="font-size:10px;color:var(--text-3);width:10px;flex-shrink:0">'+(expanded?'▼':'▶')+'</span>';
  h += '<div style="flex:1;min-width:0">';
  h += '<div style="font-size:12px;font-weight:500">'+(''+(p.proc||'')).replace(/</g,'&lt;')+'</div>';
  if (hierarchy) h += '<div style="font-size:9px;color:var(--text-3)">'+(''+hierarchy).replace(/</g,'&lt;')+'</div>';
  h += '</div>';
  h += '<span style="font-size:10px;color:var(--text-3);flex-shrink:0">'+testCount+(testCount>1?' tests':' test')+'</span>';
  // Bouton "+ Ajouter un test" : à droite, dans le header (stop propagation pour ne pas plier/déplier)
  if (isAdmin) {
    h += '<button class="bs" style="font-size:10px;padding:3px 8px;flex-shrink:0" onclick="event.stopPropagation();addBuTest(\''+_escJsArg(p.id)+'\')">+ Ajouter un test</button>';
  }
  h += '</div>';

  // Contenu déplié
  if (expanded) {
    h += '<div style="border-top:.5px solid #f0f0f0">';
    if (!testCount) {
      h += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:10px;text-align:center">Aucun test pour ce process. Cliquez sur « + Ajouter un test » dans l\'en-tête.</div>';
    } else {
      h += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
      tests.forEach(function(t){
        h += renderBuwpTestRow(p.id, t, isAdmin);
      });
      h += '</table>';
    }
    h += '</div>';
  }

  h += '</div>';
  return h;
}

// ─── Ligne compacte d'un test (table) + détail inline si déplié ──
function renderBuwpTestRow(auditProcessId, t, isAdmin) {
  var expanded = !!_buwpExpandedTests[t.id];

  // Énoncé tronqué pour la ligne compacte
  var statement = (t.statement || '(sans énoncé)').replace(/</g,'&lt;');
  var maxLen = 110;
  var truncated = statement.length > maxLen ? statement.slice(0, maxLen-1)+'…' : statement;

  var h = '';
  h += '<tr style="border-top:.5px solid #f0f0f0;cursor:pointer" onclick="toggleBuwpTest(\''+_escJsArg(t.id)+'\')">';
  h += '<td style="padding:6px 8px;width:90px;vertical-align:middle;white-space:nowrap">';
  h += '<span style="font-size:9px;color:var(--text-3);margin-right:4px">'+(expanded?'▼':'▶')+'</span>';
  h += '<span style="background:var(--purple);color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;font-family:monospace;letter-spacing:.4px">'+(t.code||'').replace(/</g,'&lt;')+'</span>';
  h += '</td>';
  h += '<td style="padding:6px 8px;vertical-align:middle">'+truncated+'</td>';
  h += '<td style="padding:6px 8px;width:60px;vertical-align:middle;text-align:right" onclick="event.stopPropagation()">';
  h += '<button class="bs" style="font-size:9px;padding:2px 6px" onclick="toggleBuwpTest(\''+_escJsArg(t.id)+'\')">'+(expanded?'Replier':'Détail')+'</button>';
  h += '</td>';
  h += '</tr>';

  // Si déplié : ligne supplémentaire avec le détail éditable inline
  if (expanded) {
    h += '<tr style="background:#fafafa">';
    h += '<td colspan="3" style="padding:0">';
    h += renderBuwpTestDetail(auditProcessId, t, isAdmin);
    h += '</td></tr>';
  }
  return h;
}

// ─── Détail éditable inline d'un test (référentiel BU) ──────────
function renderBuwpTestDetail(auditProcessId, t, isAdmin) {
  if (!Array.isArray(t.pbc)) t.pbc = [];

  var h = '';
  h += '<div style="padding:10px 14px;border-top:.5px dashed #e0e0e0;background:#fafafa">';

  // Énoncé
  h += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Énoncé du test</label>';
  if (isAdmin) {
    h += '<textarea onchange="setBuTestField(\''+_escJsArg(auditProcessId)+'\',\''+_escJsArg(t.id)+'\',\'statement\',this.value)" style="width:100%;min-height:38px;font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px;resize:vertical;font-family:inherit;box-sizing:border-box;margin-bottom:5px">'+(''+(t.statement||'')).replace(/</g,'&lt;')+'</textarea>';
  } else {
    h += '<div style="font-size:11px;padding:5px 8px;background:#fff;border-radius:3px;margin-bottom:5px">'+(''+(t.statement||'—')).replace(/</g,'&lt;')+'</div>';
  }

  // Objectif (zone large, style assurance)
  h += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Objectif (assurance / contrôle interne)</label>';
  if (isAdmin) {
    h += '<textarea onchange="setBuTestField(\''+_escJsArg(auditProcessId)+'\',\''+_escJsArg(t.id)+'\',\'objective\',this.value)" style="width:100%;min-height:38px;font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px;resize:vertical;font-family:inherit;box-sizing:border-box;margin-bottom:5px" placeholder="ex : S\'assurer que...">'+(''+(t.objective||'')).replace(/</g,'&lt;')+'</textarea>';
  } else {
    h += '<div style="font-size:11px;padding:5px 8px;background:#fff;border-radius:3px;margin-bottom:5px">'+(''+(t.objective||'—')).replace(/</g,'&lt;')+'</div>';
  }

  // Assertions COSO (zone large, format puces, monospace pour bien aligner)
  h += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Assertions COSO testées</label>';
  if (isAdmin) {
    h += '<textarea onchange="setBuTestField(\''+_escJsArg(auditProcessId)+'\',\''+_escJsArg(t.id)+'\',\'assertions\',this.value)" style="width:100%;min-height:60px;font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.5;box-sizing:border-box;margin-bottom:1px" placeholder="• Complétude (...)\n• Existence (...)\n• Exactitude (...)">'+(''+(t.assertions||'')).replace(/</g,'&lt;')+'</textarea>';
    h += '<div style="font-size:9px;color:var(--text-3);font-style:italic;margin-bottom:7px">Une assertion par ligne, précédée d\'une puce « • »</div>';
  } else {
    h += '<div style="font-size:11px;padding:5px 8px;background:#fff;border-radius:3px;margin-bottom:7px;white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.5">'+(''+(t.assertions||'—')).replace(/</g,'&lt;')+'</div>';
  }

  // Sampling hint
  h += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Méthode / sample (orientation pour la sélection)</label>';
  if (isAdmin) {
    h += '<input value="'+_escAttr(t.samplingHint)+'" placeholder="ex : 25 transactions sur les 12 derniers mois" onchange="setBuTestField(\''+_escJsArg(auditProcessId)+'\',\''+_escJsArg(t.id)+'\',\'samplingHint\',this.value)" style="width:100%;font-size:11px;padding:4px 7px;border:1px solid var(--border);border-radius:3px;box-sizing:border-box;margin-bottom:7px"/>';
  } else {
    h += '<div style="font-size:11px;padding:4px 7px;margin-bottom:7px">'+(''+(t.samplingHint||'—')).replace(/</g,'&lt;')+'</div>';
  }

  // PBC (sans statut, juste nom + suppression)
  h += '<div style="border-top:.5px dashed var(--border);padding-top:7px;margin-top:3px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
  h += '<span style="font-size:10px;font-weight:600;color:var(--text-2)">PBC · '+t.pbc.length+' document'+(t.pbc.length>1?'s':'')+'</span>';
  if (isAdmin) {
    h += '<button class="bs" style="font-size:10px;padding:2px 7px" onclick="addBuPbcDoc(\''+_escJsArg(auditProcessId)+'\',\''+_escJsArg(t.id)+'\')">+ Document</button>';
  }
  h += '</div>';
  if (!t.pbc.length) {
    h += '<div style="font-size:10px;color:var(--text-3);font-style:italic;padding:4px 0">Aucun document.</div>';
  } else {
    t.pbc.forEach(function(doc){
      h += '<div style="display:flex;align-items:center;gap:5px;padding:3px 0">';
      h += '<span style="font-size:11px;color:var(--text-3)">📄</span>';
      if (isAdmin) {
        h += '<input value="'+_escAttr(doc.name)+'" placeholder="ex : Journal des ventes" onchange="setBuPbcDoc(\''+_escJsArg(auditProcessId)+'\',\''+_escJsArg(t.id)+'\',\''+_escJsArg(doc.id)+'\',this.value)" style="flex:1;font-size:11px;padding:3px 7px;border:1px solid var(--border);border-radius:3px"/>';
        h += '<button onclick="removeBuPbcDoc(\''+_escJsArg(auditProcessId)+'\',\''+_escJsArg(t.id)+'\',\''+_escJsArg(doc.id)+'\')" title="Supprimer" style="background:#fff;border:.5px solid var(--border);color:var(--text-3);border-radius:3px;width:20px;height:20px;cursor:pointer;font-size:12px;padding:0;line-height:1">×</button>';
      } else {
        h += '<span style="font-size:11px;flex:1">'+(''+(doc.name||'')).replace(/</g,'&lt;')+'</span>';
      }
      h += '</div>';
    });
  }
  h += '</div>';

  // Bouton supprimer le test (en bas)
  if (isAdmin) {
    h += '<div style="text-align:right;margin-top:8px">';
    h += '<button class="bd" style="font-size:9px;padding:2px 7px" onclick="removeBuTest(\''+_escJsArg(auditProcessId)+'\',\''+_escJsArg(t.id)+'\')">Supprimer ce test</button>';
    h += '</div>';
  }

  h += '</div>';
  return h;
}
async function _ensureBuEntry(auditProcessId) {
  if (!Array.isArray(BU_PROCESSES)) BU_PROCESSES = [];
  var entry = _getBuEntry(auditProcessId);
  if (entry) return entry;
  entry = {
    id: 'buentry_'+Date.now()+'_'+Math.floor(Math.random()*1000),
    auditProcessId: auditProcessId,
    tests: [],
  };
  BU_PROCESSES.push(entry);
  return entry;
}

// ──────────────────────────────────────────────────────────────
//  CRUD Tests BU (avec PBC)
// ──────────────────────────────────────────────────────────────

function _genBuTestCode(p, existingTests) {
  var slug = (p.proc||'SUB').replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase() || 'SUB';
  var existingCodes = (existingTests||[]).map(function(t){return t.code||'';});
  var n = 1;
  while (existingCodes.indexOf('T-'+slug+'-'+(n<10?'0':'')+n) >= 0) n++;
  return 'T-'+slug+'-'+(n<10?'0':'')+n;
}

async function addBuTest(auditProcessId) {
  if (!CU || CU.role!=='admin') { toast('Réservé aux admins'); return; }
  var p = (PROCESSES||[]).find(function(x){return x.id===auditProcessId;});
  if (!p) return;
  var entry = await _ensureBuEntry(auditProcessId);
  if (!Array.isArray(entry.tests)) entry.tests = [];
  entry.tests.push({
    id: 'but_'+Date.now()+'_'+Math.floor(Math.random()*1000),
    code: _genBuTestCode(p, entry.tests),
    statement: '',
    objective: '',
    testType: 'Substantive',
    samplingHint: '',
    pbc: [],
  });
  try {
    if (typeof saveBuProcessFull === 'function') await saveBuProcessFull(entry);
  } catch(e) { console.warn(e); }
  renderBuwpList();
  renderBuwpList();
}

async function removeBuTest(auditProcessId, testId) {
  if (!CU || CU.role!=='admin') { toast('Réservé aux admins'); return; }
  if (!confirm('Supprimer ce test ?')) return;
  var entry = _getBuEntry(auditProcessId);
  if (!entry) return;
  entry.tests = (entry.tests||[]).filter(function(x){return x.id!==testId;});
  try {
    if (typeof saveBuProcessFull === 'function') await saveBuProcessFull(entry);
  } catch(e) { console.warn(e); }
  renderBuwpList();
  renderBuwpList();
}

async function setBuTestField(auditProcessId, testId, field, val) {
  if (!CU || CU.role!=='admin') return;
  var entry = _getBuEntry(auditProcessId);
  if (!entry) return;
  var t = (entry.tests||[]).find(function(x){return x.id===testId;});
  if (!t) return;
  t[field] = val;
  try {
    if (typeof saveBuProcessFull === 'function') await saveBuProcessFull(entry);
  } catch(e) { console.warn(e); }
  if (field === 'testType') {
    renderBuwpList();
  }
}

// ──────────────────────────────────────────────────────────────
//  CRUD PBC dans le référentiel BU
// ──────────────────────────────────────────────────────────────

async function addBuPbcDoc(auditProcessId, testId) {
  if (!CU || CU.role!=='admin') return;
  var entry = _getBuEntry(auditProcessId);
  if (!entry) return;
  var t = (entry.tests||[]).find(function(x){return x.id===testId;});
  if (!t) return;
  if (!Array.isArray(t.pbc)) t.pbc = [];
  t.pbc.push({
    id: 'pbc_'+Date.now()+'_'+Math.floor(Math.random()*1000),
    name: '',
  });
  try {
    if (typeof saveBuProcessFull === 'function') await saveBuProcessFull(entry);
  } catch(e) { console.warn(e); }
  renderBuwpList();
}

async function setBuPbcDoc(auditProcessId, testId, pbcId, name) {
  if (!CU || CU.role!=='admin') return;
  var entry = _getBuEntry(auditProcessId);
  if (!entry) return;
  var t = (entry.tests||[]).find(function(x){return x.id===testId;});
  if (!t) return;
  var doc = (t.pbc||[]).find(function(x){return x.id===pbcId;});
  if (!doc) return;
  doc.name = name;
  try {
    if (typeof saveBuProcessFull === 'function') await saveBuProcessFull(entry);
  } catch(e) { console.warn(e); }
}

async function removeBuPbcDoc(auditProcessId, testId, pbcId) {
  if (!CU || CU.role!=='admin') return;
  var entry = _getBuEntry(auditProcessId);
  if (!entry) return;
  var t = (entry.tests||[]).find(function(x){return x.id===testId;});
  if (!t) return;
  t.pbc = (t.pbc||[]).filter(function(x){return x.id!==pbcId;});
  try {
    if (typeof saveBuProcessFull === 'function') await saveBuProcessFull(entry);
  } catch(e) { console.warn(e); }
  renderBuwpList();
}

function showAddDomainModal(){
  openModal('Nouveau domaine',
    '<div><label>Nom du domaine</label><input id="m-dom-name" placeholder="ex : Finance, IT, Opérations..."/></div>',
    function(){
      var name=document.getElementById('m-dom-name').value.trim();
      if(!name){toast('Nom obligatoire');return;}
      // Créer un processus placeholder pour initialiser le domaine
      var newP={id:'p'+Date.now(),univers:'',dom:name,proc:'(Nouveau processus)',riskLevel:'faible',risk:1,archived:false};
      PROCESSES.push(newP);
      saveProcessFull(newP).catch(console.warn);
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
          saveProcessFull(p).catch(console.warn);
        }
      });
      addHist('edit','Domaine "'+dom+'" renommé en "'+newName+'"');
      renderProcTable();
      toast('Renommé ✓');
    });
}

// Renommer un Univers (propage le changement à tous les Process qui l'utilisent)
function showRenameUniversModal(univ){
  openModal('Renommer l\'univers "'+univ+'"',
    '<div><label>Nouveau nom</label><input id="m-univ-rename" value="'+_escAttr(univ)+'"/></div>',
    function(){
      var newName=document.getElementById('m-univ-rename').value.trim();
      if(!newName){toast('Nom obligatoire');return;}
      var count = 0;
      PROCESSES.forEach(function(p){
        if(p.univers===univ){
          p.univers=newName;
          saveProcessFull(p).catch(console.warn);
          count++;
        }
      });
      addHist('edit','Univers "'+univ+'" renommé en "'+newName+'" ('+count+' process)');
      renderProcTable();
      toast('Renommé ✓ ('+count+' process)');
    });
}

// Modifier le niveau de risque
function editRiskLevel(idx,val){
  PROCESSES[idx].riskLevel=val;
  PROCESSES[idx].risk=RISK_LEVELS.findIndex(function(r){return r.key===val;})+1||1;
  var p=PROCESSES[idx];
  saveProcessFull(p).catch(console.warn);
  addHist('edit','Risque "'+p.proc+'" modifié → '+val);
  toast('Risque mis à jour ✓');
}

function archiveProc(idx){
  PROCESSES[idx].archived=true;
  var p=PROCESSES[idx];
  saveProcessFull(p).catch(console.warn);
  addHist('arch','Process "'+p.proc+'" archivé');
  renderProcTable();
  toast('Archivé ✓');
}

function showAddProcModal(){
  var pairs=[]; // [{univ, dom}]
  var seen={};
  PROCESSES.forEach(function(p){
    var key=(p.univers||'')+'|'+p.dom;
    if(!seen[key]&&p.dom){seen[key]=true;pairs.push({univ:p.univers||'',dom:p.dom});}
  });
  if(!pairs.length){toast('Créez d\'abord un domaine.');return;}
  // Construit les options "Univers > Domaine"
  var domOpts = pairs.map(function(pa){
    var label = pa.univ ? pa.univ+' > '+pa.dom : pa.dom;
    return '<option value="'+_escAttr(pa.univ+'|'+pa.dom)+'">'+label.replace(/</g,'&lt;')+'</option>';
  }).join('');
  openModal('Nouveau processus',
    '<div><label>Univers > Domaine <span style="color:var(--red)">*</span></label>'
    +'<select id="m-domkey">'+domOpts+'</select></div>'
    +'<div><label>Nom du processus <span style="color:var(--red)">*</span></label>'
    +'<input id="m-proc" placeholder="ex : Gestion de la paie"/></div>'
    +'<div><label>Niveau de risque</label>'
    +'<select id="m-risk">'
    +RISK_LEVELS.map(function(r){return'<option value="'+r.key+'">'+r.label+'</option>';}).join('')
    +'</select></div>',
    function(){
      var proc=document.getElementById('m-proc').value.trim();
      if(!proc){toast('Nom obligatoire');return;}
      var domkey=document.getElementById('m-domkey').value;
      var parts=domkey.split('|');
      var univ=parts[0]||'';
      var dom=parts[1]||'';
      var riskKey=document.getElementById('m-risk').value;
      var riskNum=RISK_LEVELS.findIndex(function(r){return r.key===riskKey;})+1||1;
      var newP={id:'p'+Date.now(),univers:univ,dom:dom,proc:proc,riskLevel:riskKey,risk:riskNum,archived:false};
      PROCESSES.push(newP);
      saveProcessFull(newP).catch(console.warn);
      addHist('add','Process "'+proc+'" ajouté dans "'+dom+'"');
      renderProcTable();
      toast('Processus créé ✓');
    });
}

function showEditProcModal(idx){
  var p=PROCESSES[idx];
  var pairs=[]; var seen={};
  PROCESSES.forEach(function(x){
    var key=(x.univers||'')+'|'+x.dom;
    if(!seen[key]&&x.dom){seen[key]=true;pairs.push({univ:x.univers||'',dom:x.dom});}
  });
  var currentKey=(p.univers||'')+'|'+p.dom;
  var domOpts = pairs.map(function(pa){
    var key = pa.univ+'|'+pa.dom;
    var label = pa.univ ? pa.univ+' > '+pa.dom : pa.dom;
    return '<option value="'+_escAttr(key)+'"'+(key===currentKey?' selected':'')+'>'+label.replace(/</g,'&lt;')+'</option>';
  }).join('');
  openModal('Modifier "'+p.proc+'"',
    '<div><label>Univers > Domaine</label>'
    +'<select id="m-domkey">'+domOpts+'</select></div>'
    +'<div><label>Nom du processus</label><input id="m-proc" value="'+_escAttr(p.proc)+'"/></div>'
    +'<div><label>Niveau de risque</label>'
    +'<select id="m-risk">'
    +RISK_LEVELS.map(function(r){return'<option value="'+r.key+'"'+(p.riskLevel===r.key?' selected':'')+'>'+r.label+'</option>';}).join('')
    +'</select></div>',
    function(){
      p.proc=document.getElementById('m-proc').value.trim();
      var parts=document.getElementById('m-domkey').value.split('|');
      p.univers=parts[0]||'';
      p.dom=parts[1]||'';
      var riskKey=document.getElementById('m-risk').value;
      p.riskLevel=riskKey;
      p.risk=RISK_LEVELS.findIndex(function(r){return r.key===riskKey;})+1||1;
      saveProcessFull(p).catch(console.warn);
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
  const interviewsCount = (audData.interviews || []).length; // v71
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
        <button class="bs" onclick="showInterviewsLibrary()" style="font-size:11px;" title="Bibliothèque d'entretiens de l'audit">📋 Entretiens (${interviewsCount})</button>
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
  // Pour les audits BU :
  //   - On saute l'étape 4 (index 4 = ITW : WCGW & Contrôles) : pas pertinente pour les audits substantifs
  //   - On saute l'étape 8 (index 7 = Report Restitution) : génération de rapport intégrée à l'étape 6
  //   - L'étape 7 (index 6) est renommée "Findings & Rapport" car elle inclut maintenant la génération
  // Pour les audits Process :
  //   - On saute l'étape 4 (index 3 = Interview / Flowcharts) : pas pertinente avec la nouvelle struct WCGW par sous-processus
  //   - On saute l'étape 8 (index 7 = Report Restitution) : MR seule suffit
  // Le numéro d'étape affiché est ajusté en conséquence.
  var auditObj = AUDIT_PLAN.find(function(x){return x.id===CA;});
  var isBu = auditObj && auditObj.type === 'BU';
  var isProcess = auditObj && auditObj.type !== 'BU';
  var phases = isBu
    ? [
        {idxs: [0,1,2],   name: 'Préparation', bg: '#EEEDFE', txt: '#3C3489'},
        {idxs: [3,5],     name: 'Réalisation', bg: '#E1F5EE', txt: '#085041'},
        {idxs: [6,8,9],   name: 'Restitution', bg: '#FAEEDA', txt: '#854F0B'},
      ]
    : [
        // Process v73 : Réalisation = 3 (ITW/Narratif), 4 (Flowcharts), 5 (Testings)
        {idxs: [0,1,2],   name: 'Préparation', bg: '#EEEDFE', txt: '#3C3489'},
        {idxs: [3,4,5],   name: 'Réalisation', bg: '#E1F5EE', txt: '#085041'},
        {idxs: [6,8,9],   name: 'Restitution', bg: '#FAEEDA', txt: '#854F0B'},
      ];

  // Helper : renvoie le nom de l'étape (avec renommage spécifique BU pour l'étape 6)
  function _stepLabel(realIdx) {
    if (isBu && realIdx === 6) return 'Findings & Rapport';
    if (isBu && realIdx === 3) return 'Interview (Design Issues)';
    // Process : renommer index 4 en "Flowcharts (WCGW & Contrôles)"
    if (isProcess && realIdx === 4) return 'Flowcharts (WCGW & Contrôles)';
    if (isProcess && realIdx === 3) return 'ITW / Narratif';
    return STEPS[realIdx] ? STEPS[realIdx].s : '—';
  }

  //   - BU : 0,1,2,3,5,6,8,9 → 1..8 (saute 4 et 7)
  //   - Process v73 : 0,1,2,3,4,5,6,8,9 → 1..9 (saute juste idx 7)
  function _displayedStepNum(realIdx) {
    if (isBu) {
      var buMap = {0:1, 1:2, 2:3, 3:4, 5:5, 6:6, 8:7, 9:8};
      return buMap[realIdx] !== undefined ? buMap[realIdx] : realIdx + 1;
    }
    // Process v73 : 9 étapes (ITW/Narratif ajoutée à idx 3)
    var procMap = {0:1, 1:2, 2:3, 3:4, 4:5, 5:6, 6:7, 8:8, 9:9};
    return procMap[realIdx] !== undefined ? procMap[realIdx] : realIdx + 1;
  }

  var phaseHtml = phases.map(function(p){
    var stepDots = p.idxs.map(function(i, idx){
      var isDone = i < CS;
      var isActive = i === CS;
      var dotStyle = isDone
        ? 'background:'+p.txt+';color:#fff;border:none'
        : isActive
        ? 'background:#fff;color:'+p.txt+';border:2px solid '+p.txt+';font-weight:500'
        : 'background:#fff;color:'+p.txt+';border:1px solid '+p.txt+';opacity:0.4';
      var dotContent = isDone ? '✓' : _displayedStepNum(i);
      var separator = idx < p.idxs.length - 1
        ? '<div style="flex:1;height:2px;background:'+(i<CS?p.txt:p.txt+'40')+';min-width:6px"></div>'
        : '';
      return '<div onclick="goStep('+i+')" style="width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer;flex-shrink:0;'+dotStyle+'" title="'+_stepLabel(i)+'">'+dotContent+'</div>'+separator;
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

  // Ligne 3 : nom de l'étape courante (avec numérotation et renommage adaptés au type d'audit)
  html += '<div style="font-size:12px;color:var(--text-2);margin-top:8px;text-align:center">';
  var totalSteps = 8; // BU et Process ont tous les deux 8 étapes maintenant
  html += 'Étape '+_displayedStepNum(CS)+'/'+totalSteps+' — <strong>'+_stepLabel(CS)+'</strong>';
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

  // v67 : sortir du mode maximisé si on n'est plus en CS=4 ou si l'éditeur n'est plus actif
  if (typeof _flowchartEditor !== 'undefined' && document.body) {
    if (CS !== 4 || !_flowchartEditor || a.type === 'BU' || !_flowchartEditor.maximized) {
      document.body.classList.remove('fc-maximized');
    } else {
      document.body.classList.add('fc-maximized');
    }
  }

  var html = '';

  // L'en-tête (étape + statut + workflow + cases revue) est désormais dans renderAuditHeaderCompact
  // Plus besoin de répéter ici.

  // ── 3. SECTIONS SPÉCIFIQUES MÉTIER selon l'étape ─────────
  if (CS === 1) {
    // Étape 2 (index 1) : Work Program
    // Pour les audits BU : sélection des Process + tests substantifs depuis le référentiel
    // Pour les audits Process : préparation classique (sous-process + risques + ITW)
    if (a.type === 'BU') {
      html += renderWorkProgramBuSection();
    } else {
      html += renderKickoffPrepSection();
    }
  } else if (CS === 2) {
    // Étape 3 (index 2) : Audit Kick Off — bouton de génération mis en avant
    html += renderKickoffGenerateBanner();
    html += renderKickoffBookingSection();
  } else if (CS === 3) {
    // v73 : Process → ITW/Narratif (nouvelle étape) ; BU → reste comme avant (Design Issues, sera sauté en pratique)
    if (a.type === 'BU') {
      html += renderDesignIssuesSection();
    } else {
      // Process : nouvelle vue ITW / Narratif consolidé
      html += renderItwNarrativeSection();
    }
  } else if (CS === 4) {
    // Étape 5 affichée (index 4) : Flowcharts (WCGW & Contrôles) Process / WCGW & Contrôles BU
    html += renderRiskSection();
    if (a.type === 'BU') {
      // BU : pas de flowchart, vue simplifiée Contrôles par sous-processus (v65)
      html += renderControlsBySpSection();
    } else {
      // Process : vue flowchart prioritaire
      _fcEnsureState();
      if (_flowchartEditor) {
        html += renderFlowchartEditor();
      } else {
        // Splash : pas encore de flowchart pour cet audit
        html += renderFlowchartSplash();
      }
    }
    // renderControlsSection désactivée - tout est dans renderWCGWSection
  } else if (CS === 5) {
    // Étape 6 (index 5) : Testings
    // Pour les audits BU : refonte avec sample/population/issues + extrapolation
    // Pour les audits Process : tests des contrôles uniquement (existant)
    if (a.type === 'BU') {
      html += renderTestingsBuSection();
    } else {
      html += renderTestsSection();
    }
  } else if (CS === 6) {
    // Étape 7 (index 6) : Report — Header + Maturity (côte-à-côte) puis Findings
    html += renderAuditReportGenerateBanner();
    html += renderHeaderAndMaturitySection();
    // Pour les audits BU : refonte avec Findings agrégeant des Issues + bloc Issues non agrégées
    // Pour les audits Process : section Findings classique inchangée
    if (a.type === 'BU') {
      html += renderFindingsBuSection();
    } else {
      html += renderFindingsSection();
    }
  } else if (CS === 8) {
    // Étape 9 (index 8) : Management Responses
    html += renderReportPublicationBanner();
    html += renderMgtRespSection();
  }

  // ── 4. DOCUMENTS ─────────────────────────────────────────
  // Pour les audits BU : on cache la zone Documents en étapes 2 (Kick Off), 6 (Findings & Rapport) et 8 (MR)
  // Ces étapes ont leur propre gestion de fichiers via SharePoint (draft/final)
  var auditForDocs = AUDIT_PLAN.find(function(x){return x.id===CA;});
  var isBuForDocs = auditForDocs && auditForDocs.type === 'BU';
  var hideDocsForBu = isBuForDocs && (CS === 2 || CS === 6 || CS === 8);
  // Demande utilisateur : cacher Documents sur étapes 2 (Work Program, CS=1), 3 (Kick Off, CS=2),
  // 4 (WCGW, CS=4) et 6 (Findings & Rapport, CS=6)
  // (les uploads se font via les UI dédiées : Work Program, génération Kick-off, flowchart narrative, génération Rapport…)
  var hideDocsForSimplifiedSteps = (CS === 1 || CS === 2 || CS === 4 || CS === 6);
  if (!hideDocsForBu && !hideDocsForSimplifiedSteps) {
    html += renderDocumentsSection();
  }

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

  // Migration douce : s'assurer que les anciens docs (uploadés avant le fix
  // qui ajoute l'id dans uploadDoc) aient un id pour que les boutons fonctionnent.
  if (hasDoc && !doc.id) {
    doc.id = 'doc_'+(doc.itemId || (doc.name||'unknown').replace(/[^a-zA-Z0-9]/g,''));
  }

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

// ─── ÉTAPE 7 (CS=6) : Bandeau Audit Report (génération + draft + final) ─
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

  // Approche A : draft + final
  var attR = d.attachments && d.attachments.report;
  var draftR = attR && (attR.draft || (attR.webUrl && !attR.draft && !attR.final ? attR : null));
  var finalR = attR && attR.final;
  var hasDraft = !!(draftR && draftR.webUrl);
  var hasFinal = !!(finalR && finalR.webUrl);

  var html = '<div class="card" style="margin-bottom:.75rem;background:linear-gradient(135deg,#FAEEDA 0%,#FFF4D9 100%);border:.5px solid #FAC775">';

  // En-tête + indicateurs de complétude
  html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">';
  html += '<div style="flex:1;min-width:200px">';
  html += '<div style="font-size:14px;font-weight:600;color:#854F0B;margin-bottom:4px">📄 Audit Report</div>';
  html += '<div style="font-size:11px;color:#BA7517;margin-bottom:8px">Génération du rapport d\'audit PowerPoint et publication sur SharePoint pour partage avec les parties prenantes.</div>';
  html += '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:#854F0B">';
  html += '<span>'+(findingsCount?'✓':'○')+' Findings ('+findingsComplete+'/'+findingsCount+' complets)</span>';
  html += '<span>'+(testedControls.length?'✓':'○')+' Tests ('+testedControls.length+')</span>';
  html += '<span>'+(maturityFilled?'✓':'○')+' Maturity</span>';
  html += '<span>'+(mgtRespCount?'✓':'○')+' Mgt Responses ('+mgtRespCount+')</span>';
  html += '</div>';
  html += '</div>';

  // Boutons d'action principaux (génération initiale + alternatives upload)
  html += '<div style="display:flex;gap:8px;flex-direction:column;align-items:stretch;min-width:220px">';
  if (!hasDraft) {
    // Pas encore de draft : 2 options principales
    html += '<button class="bp" style="font-size:13px;padding:8px 16px;background:#854F0B;color:#fff;font-weight:500" onclick="publishReportRegenerate()" title="Générer le rapport et le publier comme draft sur SharePoint">⬇ Générer le rapport (draft)</button>';
    html += '<button class="bs" style="font-size:11px;padding:5px 10px;border:.5px solid #854F0B;color:#854F0B" onclick="publishReportUpload()" title="Uploader un PPT existant comme draft (sans passer par la génération)">📁 Importer un PPT existant</button>';
  } else {
    // Draft existe → 2 options : régénérer ou remplacer
    html += '<button class="bs" style="font-size:11px;padding:5px 10px;border:.5px solid #FAC775;color:#854F0B" onclick="publishReportRegenerate()" title="Régénérer le draft (écrase le draft mais pas le final)">🔄 Régénérer le draft</button>';
    html += '<button class="bs" style="font-size:11px;padding:5px 10px;border:.5px solid #FAC775;color:#854F0B" onclick="publishReportUpload()" title="Remplacer le draft par un fichier Office">📁 Remplacer le draft</button>';
  }
  html += '</div>';
  html += '</div>';

  // Avertissements complétude
  if (!findingsCount) {
    html += '<div style="font-size:10px;color:#854F0B;margin-top:10px;padding:6px 10px;background:#FAEEDA;border-radius:4px;font-style:italic">⚠ Aucun finding défini. Le rapport sera généré sans détail de findings.</div>';
  } else if (findingsComplete < findingsCount) {
    html += '<div style="font-size:10px;color:#854F0B;margin-top:10px;padding:6px 10px;background:#FAEEDA;border-radius:4px;font-style:italic">ⓘ '+(findingsCount-findingsComplete)+' finding(s) incomplet(s) (Potential Risk, Owner ou Risk Level manquant). Ils apparaîtront avec « — » dans le rapport.</div>';
  }

  // Bandeaux draft / final si dispo
  if (hasDraft || hasFinal) {
    html += '<div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">';
    if (hasDraft) {
      var draftDate = (draftR.uploadedAt||'').slice(0,10);
      var draftEditUrl = toEditableOfficeUrl(draftR.webUrl);
      html += '<div style="font-size:11px;color:#854F0B;padding:7px 10px;background:#FFF4D9;border:.5px solid #FAC775;border-radius:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      html += '<span>📝</span>';
      html += '<span style="flex:1;min-width:160px"><strong style="font-weight:500">Draft</strong> · publié le '+draftDate+(draftR.uploadedBy?' par '+draftR.uploadedBy.replace(/</g,'&lt;'):'')+'</span>';
      html += '<a href="'+draftEditUrl.replace(/"/g,'&quot;')+'" target="_blank" rel="noopener" style="font-size:10px;padding:3px 8px;background:#854F0B;color:#fff;border:.5px solid #854F0B;border-radius:3px;text-decoration:none;font-weight:500">✏ Modifier draft</a>';
      html += '<button class="bp" style="font-size:10px;padding:3px 8px;background:#3C3489;color:#fff;border:.5px solid #3C3489;border-radius:3px;font-weight:500" onclick="finalizeReport()" title="Copier le draft actuel comme version finale (la version qui sera partagée)">📌 Marquer comme version finale</button>';
      html += '</div>';
    }
    if (hasFinal) {
      var finalDate = (finalR.finalizedAt||'').slice(0,10);
      var finalEditUrl = toEditableOfficeUrl(finalR.webUrl);
      html += '<div style="font-size:11px;color:#085041;padding:7px 10px;background:#E1F5EE;border:.5px solid #A6E2CD;border-radius:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      html += '<span>📌</span>';
      html += '<span style="flex:1;min-width:160px"><strong style="font-weight:500">Version finale</strong> · figée le '+finalDate+(finalR.finalizedBy?' par '+finalR.finalizedBy.replace(/</g,'&lt;'):'')+' &middot; <em>Lien envoyé dans la demande MR (étape suivante)</em></span>';
      html += '<a href="'+finalEditUrl.replace(/"/g,'&quot;')+'" target="_blank" rel="noopener" style="font-size:10px;padding:3px 8px;background:#3C3489;color:#fff;border:.5px solid #3C3489;border-radius:3px;text-decoration:none;font-weight:500">✏ Modifier final</a>';
      html += '<a href="'+finalR.webUrl.replace(/"/g,'&quot;')+'" target="_blank" rel="noopener" style="font-size:10px;padding:3px 8px;background:#fff;color:#085041;border:.5px solid #A6E2CD;border-radius:3px;text-decoration:none">Ouvrir →</a>';
      html += '</div>';
    } else if (hasDraft) {
      html += '<div style="font-size:10px;color:#BA7517;font-style:italic;padding:3px 10px">Aucune version finale — la demande MR (étape suivante) ne pourra être envoyée qu\'après le marquage final.</div>';
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// ─── HELPER : Transformer un webUrl SharePoint en lien d'édition Office Online
//
// Le webUrl par défaut ouvre le fichier en lecture. En ajoutant ?web=1,
// SharePoint redirige vers PowerPoint Online en mode édition.
// L'utilisateur peut éditer + sauvegarde auto vers SharePoint.
function toEditableOfficeUrl(webUrl) {
  if (!webUrl) return '';
  // Si le webUrl contient déjà des query params, on ajoute &web=1, sinon ?web=1
  var separator = webUrl.indexOf('?') >= 0 ? '&' : '?';
  return webUrl + separator + 'web=1';
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
  html += '<div style="display:flex;gap:8px;align-items:center">';
  html += '<button class="bs" style="font-size:12px;padding:7px 14px;background:#fff;color:#3C3489;border:1px solid #3C3489;font-weight:500" onclick="openKickoffBookingUI()" title="Rechercher des créneaux libres et créer la (les) réunion(s) Outlook avec lien Teams">📅 Booker la réunion</button>';
  html += '<button class="bp" style="font-size:13px;padding:8px 18px;background:#3C3489;color:#fff;font-weight:500" onclick="generateKickoffPptx(CA)">⬇ Générer le Kick Off</button>';
  html += '</div>';
  html += '</div>';
  if (!subProcCount && !interviewsCount && !planningCount) {
    html += '<div style="font-size:10px;color:#854F0B;margin-top:10px;padding:6px 10px;background:#FAEEDA;border-radius:4px;font-style:italic">⚠ Aucune information saisie en étape Work Program. Le PowerPoint sera généré avec des sections vides à compléter manuellement.</div>';
  }
  // Afficher les liens SharePoint si le Kick-off a été uploadé (Approche A : draft + final)
  var attachmentKickoff = d.attachments && d.attachments.kickoff;
  // Backward-compat : ancien format plat → on lit directement webUrl
  var draftKO = attachmentKickoff && (attachmentKickoff.draft || (attachmentKickoff.webUrl ? attachmentKickoff : null));
  var finalKO = attachmentKickoff && attachmentKickoff.final;

  if (draftKO || finalKO) {
    html += '<div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">';

    // Bandeau DRAFT
    if (draftKO && draftKO.webUrl) {
      var draftDate = (draftKO.uploadedAt||'').slice(0,10);
      var draftEditUrl = toEditableOfficeUrl(draftKO.webUrl);
      html += '<div style="font-size:11px;color:#854F0B;padding:7px 10px;background:#FAEEDA;border:.5px solid #FAC775;border-radius:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      html += '<span>📝</span>';
      html += '<span style="flex:1;min-width:160px"><strong style="font-weight:500">Draft</strong> · généré le '+draftDate+(draftKO.uploadedBy?' par '+draftKO.uploadedBy.replace(/</g,'&lt;'):'')+'</span>';
      html += '<a href="'+draftEditUrl.replace(/"/g,'&quot;')+'" target="_blank" rel="noopener" style="font-size:10px;padding:3px 8px;background:#854F0B;color:#fff;border:.5px solid #854F0B;border-radius:3px;text-decoration:none;font-weight:500" title="Ouvrir et modifier le draft dans PowerPoint Online">✏ Modifier draft</a>';
      html += '<button class="bp" style="font-size:10px;padding:3px 8px;background:#3C3489;color:#fff;border:.5px solid #3C3489;border-radius:3px;font-weight:500" onclick="finalizeKickoff()" title="Copier le draft actuel comme version finale">📌 Marquer comme version finale</button>';
      html += '</div>';
    }

    // Bandeau FINAL
    if (finalKO && finalKO.webUrl) {
      var finalDate = (finalKO.finalizedAt||'').slice(0,10);
      var finalEditUrl = toEditableOfficeUrl(finalKO.webUrl);
      html += '<div style="font-size:11px;color:#085041;padding:7px 10px;background:#E1F5EE;border:.5px solid #A6E2CD;border-radius:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      html += '<span>📌</span>';
      html += '<span style="flex:1;min-width:160px"><strong style="font-weight:500">Version finale</strong> · figée le '+finalDate+(finalKO.finalizedBy?' par '+finalKO.finalizedBy.replace(/</g,'&lt;'):'')+' &middot; <em>Lien envoyé dans la convocation</em></span>';
      html += '<a href="'+finalEditUrl.replace(/"/g,'&quot;')+'" target="_blank" rel="noopener" style="font-size:10px;padding:3px 8px;background:#3C3489;color:#fff;border:.5px solid #3C3489;border-radius:3px;text-decoration:none;font-weight:500" title="Ouvrir et modifier la version finale dans PowerPoint Online">✏ Modifier final</a>';
      html += '<a href="'+finalKO.webUrl.replace(/"/g,'&quot;')+'" target="_blank" rel="noopener" style="font-size:10px;padding:3px 8px;background:#fff;color:#085041;border:.5px solid #A6E2CD;border-radius:3px;text-decoration:none" title="Ouvrir en lecture seule">Ouvrir →</a>';
      html += '</div>';
    } else if (draftKO) {
      // Indication discrète : pas encore de version finale
      html += '<div style="font-size:10px;color:var(--text-3);font-style:italic;padding:3px 10px">Aucune version finale — la convocation utilisera le draft tant qu\'aucune version finale n\'est marquée.</div>';
    }

    html += '</div>';
  }

  // ─── Réunions Outlook créées (persistant, visible après F5) ──────
  var existingEvents = (d.attachments && d.attachments.kickoff && d.attachments.kickoff.outlookEvents) || [];
  if (existingEvents.length > 0) {
    html += '<div style="margin-top:10px;padding:8px 10px;background:#E1F5EE;border:.5px solid #A6E2CD;border-radius:4px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    html += '<span style="font-size:11px;color:#085041;font-weight:500">📅 '+existingEvents.length+' réunion'+(existingEvents.length>1?'s':'')+' Outlook créée'+(existingEvents.length>1?'s':'')+'</span>';
    html += '<button class="bs" style="font-size:10px;padding:2px 8px" onclick="openKickoffBookingUI()" title="Ajouter une autre réunion">+ Réunion</button>';
    html += '</div>';
    existingEvents.forEach(function(ev, evIdx){
      var startD = new Date(ev.startISO);
      var endD = new Date(ev.endISO);
      var dayLabel = startD.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
      var timeLabel = startD.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}) + ' — ' + endD.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
      html += '<div style="font-size:11px;color:#085041;display:flex;align-items:center;gap:6px;padding:4px 0;flex-wrap:wrap;border-top:'+(evIdx>0?'.5px solid #A6E2CD':'none')+';margin-top:'+(evIdx>0?'4px':'0')+';padding-top:'+(evIdx>0?'6px':'4px')+'">';
      html += '<span style="font-weight:500">'+dayLabel+' · '+timeLabel+'</span>';
      if (ev.webLink) html += '<a href="'+ev.webLink+'" target="_blank" rel="noopener" style="color:#085041;text-decoration:underline;font-size:10px">📅 Outlook ↗</a>';
      if (ev.teamsUrl) html += '<a href="'+ev.teamsUrl+'" target="_blank" rel="noopener" style="color:#0C447C;text-decoration:underline;font-size:10px">💻 Teams ↗</a>';
      html += '<button class="bd" style="font-size:9px;padding:1px 6px;margin-left:auto" onclick="deleteKickoffMeeting('+evIdx+')" title="Annuler/supprimer cette réunion">× Supprimer</button>';
      html += '</div>';
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
}

/**
 * Supprime une réunion Outlook (annulation côté Graph + retrait de la liste)
 */
async function deleteKickoffMeeting(idx) {
  var d = getAudData(CA);
  var events = (d.attachments && d.attachments.kickoff && d.attachments.kickoff.outlookEvents) || [];
  var ev = events[idx];
  if (!ev) return;
  var startD = new Date(ev.startISO);
  var label = startD.toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short'}) + ' ' + startD.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
  if (!confirm('Annuler la réunion du '+label+' ? Les invités recevront une notification d\'annulation.')) return;

  // Best effort : supprimer côté Graph
  try {
    var token = await getGraphToken();
    if (token && ev.eventId) {
      var resp = await fetch('https://graph.microsoft.com/v1.0/me/events/' + encodeURIComponent(ev.eventId), {
        method: 'DELETE',
        headers: {'Authorization': 'Bearer ' + token},
      });
      if (!resp.ok && resp.status !== 404) {
        console.warn('[Kickoff] Suppression Graph échouée :', resp.status);
      }
    }
  } catch (e) {
    console.warn('[Kickoff] Suppression Graph error :', e);
  }

  // Retirer de la liste locale
  events.splice(idx, 1);
  d.attachments.kickoff.outlookEvents = events;
  await saveAuditData(CA);
  if (typeof addHist === 'function') addHist(CA, 'Réunion Outlook annulée — ' + label);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('✓ Réunion annulée');
}

/**
 * Copie le draft Kick-off vers final.
 * Approche A : draft = brouillon modifiable, final = version partagée par mail.
 */
async function finalizeKickoff() {
  var ap = (AUDIT_PLAN||[]).find(function(a){return a.id===CA;});
  if (!ap) { toast('Audit introuvable'); return; }
  var d = getAudData(CA);
  if (!d.attachments) d.attachments = {};
  if (!d.attachments.kickoff) d.attachments.kickoff = {};
  // Backward-compat : si format plat, on convertit
  if (d.attachments.kickoff.webUrl && !d.attachments.kickoff.draft) {
    d.attachments.kickoff = { draft: d.attachments.kickoff };
  }
  var draft = d.attachments.kickoff.draft;
  if (!draft || !draft.webUrl) {
    toast('Génère d\'abord un draft du Kick Off');
    return;
  }

  // Confirmation si une version finale existe déjà
  if (d.attachments.kickoff.final && d.attachments.kickoff.final.webUrl) {
    if (!confirm('Une version finale existe déjà (figée le ' + (d.attachments.kickoff.final.finalizedAt||'').slice(0,10) + '). Cela remplacera la version finale actuelle. Continuer ?')) {
      return;
    }
  }

  if (typeof copyFileInSharePoint !== 'function' || typeof getOrCreateAuditFolder !== 'function') {
    toast('Helpers SharePoint indisponibles');
    return;
  }

  try {
    toast('📌 Création de la version finale...');
    var folderInfo = await getOrCreateAuditFolder(ap);
    var driveItem = await copyFileInSharePoint(folderInfo.path, 'KickOff_draft.pptx', 'KickOff_final.pptx');
    d.attachments.kickoff.final = {
      webUrl: driveItem.webUrl,
      fileName: driveItem.name,
      finalizedAt: new Date().toISOString(),
      finalizedBy: (typeof CU !== 'undefined' && CU && CU.name) ? CU.name : '',
    };
    await saveAuditData(CA);
    if (typeof addHist === 'function') addHist(CA, 'Kick Off — version finale figée (' + driveItem.name + ')');
    toast('✓ Version finale créée — la convocation utilisera ce lien');
    if (document.getElementById('det-content')) {
      document.getElementById('det-content').innerHTML = renderDetContent();
    }
  } catch (e) {
    console.error('[finalizeKickoff] error:', e);
    toast('Erreur : ' + (e.message||e));
  }
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

  // ── SECTION 1 : Processus Couverts (sous-processus) ─────────
  html += '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
  html += '<span style="font-size:12px;font-weight:600;color:var(--text-2)">Processus Couverts <span style="font-size:10px;font-weight:400;color:var(--text-3)">('+p.subProcesses.length+' sous-processus)</span></span>';
  html += '<button class="bs" style="font-size:11px;padding:3px 9px" onclick="addSubProcess()">+ Ajouter un sous-processus</button>';
  html += '</div>';
  html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:10px;font-style:italic">Découpage du processus audité en sous-processus avec leur description et owners. Apparaîtra en slide « Audit Scope » du Kick Off.</div>';

  if (!p.subProcesses.length) {
    html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:.5rem;text-align:center;border:1px dashed var(--border);border-radius:4px">Aucun sous-processus défini. Cliquez sur « + Ajouter un sous-processus ».</div>';
  } else {
    // Grille 2 colonnes responsive : 2 colonnes sur grand écran, 1 colonne en mobile (<700px)
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:10px">';
    p.subProcesses.forEach(function(sp, idx){
      html += '<div style="border:.5px solid var(--border);border-radius:6px;padding:12px 14px;background:#fafafa;position:relative">';
      // Bouton supprimer discret en haut à droite
      html += '<button onclick="removeSubProcess('+idx+')" title="Supprimer" style="position:absolute;top:8px;right:8px;background:#fff;border:.5px solid var(--border);color:var(--text-3);border-radius:4px;width:22px;height:22px;cursor:pointer;font-size:13px;padding:0;line-height:1">×</button>';
      // Label commun
      html += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:3px">Sous-processus & description</label>';
      // Titre (gras)
      html += '<input value="'+(sp.name||'').replace(/"/g,'&quot;')+'" placeholder="ex : Order entry" onchange="setSubProcess('+idx+',\'name\',this.value)" style="width:100%;font-size:12px;font-weight:500;padding:6px 9px;border:1px solid var(--border);border-radius:3px;margin-bottom:5px;box-sizing:border-box"/>';
      // Description (textarea sous le titre)
      html += '<textarea onchange="setSubProcess('+idx+',\'description\',this.value)" placeholder="ex : Saisie commandes clients dans SAP" style="width:100%;min-height:54px;font-size:11px;padding:6px 9px;border:1px solid var(--border);border-radius:3px;resize:vertical;margin-bottom:7px;box-sizing:border-box;font-family:inherit">'+(sp.description||'').replace(/</g,'&lt;')+'</textarea>';
      // Owner(s) + email côte à côte
      html += '<div style="display:grid;grid-template-columns:1.4fr 2fr;gap:6px">';
      html += '<input value="'+(sp.owners||'').replace(/"/g,'&quot;')+'" placeholder="Owner(s) — ex : J. Smith" onchange="setSubProcess('+idx+',\'owners\',this.value)" style="font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
      html += '<input value="'+(sp.email||'').replace(/"/g,'&quot;')+'" type="email" placeholder="email facultatif" onchange="setSubProcess('+idx+',\'email\',this.value)" style="font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px;color:var(--text-2);box-sizing:border-box"/>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>'; // fin grid
  }

  // ── Sous-section : Risques de l'audit (URD + ad hoc) ──────
  html += renderAuditRisksSubsection();

  html += '</div>';

  // ── SECTION 2 : Planning - Dates clés (inchangée) ──────────
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

// ─── Sous-section "Risques de l'audit" (dans Processus Couverts) ──────
// Affiche les risques URD du processus + risques ad hoc, avec possibilité
// d'ajouter/supprimer des risques ad hoc. Utilisée dans l'étape Work Program.
function renderAuditRisksSubsection() {
  var risks = getAuditRisks(CA);
  var probLabels = {1:'Rare',2:'Peu probable',3:'Probable',4:'Quasi-certain'};
  var impLabels  = {1:'Mineur',2:'Modéré',3:'Majeur',4:'Critique'};

  // Liste des sous-processus pour les badges (depuis kickoffPrep.subProcesses)
  var d_aud = getAudData(CA);
  var subProcs = (d_aud.kickoffPrep && Array.isArray(d_aud.kickoffPrep.subProcesses))
    ? d_aud.kickoffPrep.subProcesses : [];
  // Liens risque ↔ sous-processus : { riskId: [subProcessName, ...] }
  if (!d_aud.subProcessRiskLinks) d_aud.subProcessRiskLinks = {};

  var html = '';
  html += '<div style="margin-top:1rem;padding-top:.875rem;border-top:.5px solid var(--border)">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
  html += '<span style="font-size:12px;font-weight:600;color:var(--text-2)">Risques de l\'audit <span style="font-size:10px;font-weight:400;color:var(--text-3)">('+risks.length+' risque'+(risks.length>1?'s':'')+')</span></span>';
  html += '<button class="bs" style="font-size:11px;padding:3px 9px" onclick="showAddAuditRiskModal()">+ Ajouter un risque</button>';
  html += '</div>';
  html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:10px;font-style:italic">Risques URD associés au processus (lecture seule, gérés dans Audit Universe) + risques ad hoc spécifiques à cet audit. Cliquer sur les badges pour associer chaque risque à un ou plusieurs sous-processus. Apparaîtront dans les slides du Kick Off et seront sélectionnables dans les WCGW à l\'étape Testings.</div>';

  if (!risks.length) {
    html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:.75rem;text-align:center;border:1px dashed var(--border);border-radius:4px">';
    html += 'Aucun risque pour cet audit. Associez des risques URD au processus dans <strong>Audit Universe</strong>, ou cliquez sur « + Ajouter un risque » pour ajouter un risque ad hoc.';
    html += '</div>';
  } else {
    var gridCols = '90px 2fr 1fr 1fr 80px 50px';
    html += '<div style="border:.5px solid var(--border);border-radius:6px;overflow:hidden">';
    // En-tête
    html += '<div style="display:grid;grid-template-columns:'+gridCols+';gap:0;font-size:10px;color:var(--text-3);font-weight:500;background:#fafafa;padding:6px 10px;border-bottom:.5px solid var(--border)">';
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

      // Bloc englobant pour le risque (ligne principale + ligne badges sous-process)
      html += '<div style="padding:8px 10px;border-bottom:.5px solid var(--border);background:#fff">';
      // Ligne principale
      html += '<div style="display:grid;grid-template-columns:'+gridCols+';gap:0;font-size:11px;align-items:center">';
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

      // Ligne des badges sous-processus
      var linkedSubProcs = d_aud.subProcessRiskLinks[r.id] || [];
      if (subProcs.length) {
        html += '<div style="margin-top:7px;padding-left:90px;display:flex;flex-wrap:wrap;gap:5px;align-items:center">';
        html += '<span style="font-size:10px;color:var(--text-3)">Lié à :</span>';
        subProcs.forEach(function(sp){
          var spName = sp.name || '';
          if (!spName) return;
          var isLinked = linkedSubProcs.indexOf(spName) >= 0;
          var spNameEsc = spName.replace(/'/g,"\\'").replace(/"/g,'&quot;');
          var pillStyle = isLinked
            ? 'background:var(--purple-lt);color:var(--purple-dk);border:1px solid var(--purple);font-size:10px;padding:3px 9px;border-radius:11px;cursor:pointer;user-select:none;line-height:1.2'
            : 'background:#fff;color:var(--text-3);border:.5px solid var(--border);font-size:10px;padding:3px 9px;border-radius:11px;cursor:pointer;user-select:none;line-height:1.2';
          var prefix = isLinked ? '✓ ' : '+ ';
          html += '<span onclick="toggleSubProcessRiskLink(\''+r.id+'\',\''+spNameEsc+'\')" style="'+pillStyle+'">'+prefix+(spName.length>26?spName.slice(0,24)+'…':spName).replace(/</g,'&lt;')+'</span>';
        });
        html += '</div>';
      } else {
        html += '<div style="margin-top:6px;padding-left:90px;font-size:10px;color:var(--text-3);font-style:italic">Aucun sous-processus défini — ajoutez-en au-dessus pour pouvoir lier ce risque.</div>';
      }
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
  d.kickoffPrep.subProcesses.push({
    id: 'sp_'+Date.now()+'_'+Math.floor(Math.random()*100000),
    name:'', description:'', owners:'', email:''
  });
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// Helper : assure que tous les sous-processus existants ont un id (migration auto)
function _ensureSubProcessIds(d) {
  if (!d.kickoffPrep || !Array.isArray(d.kickoffPrep.subProcesses)) return false;
  var changed = false;
  d.kickoffPrep.subProcesses.forEach(function(sp){
    if (!sp.id) {
      sp.id = 'sp_'+Date.now()+'_'+Math.floor(Math.random()*100000);
      changed = true;
    }
  });
  return changed;
}
async function setSubProcess(idx, field, val) {
  var d = getAudData(CA);
  if (!d.kickoffPrep || !Array.isArray(d.kickoffPrep.subProcesses)) return;
  if (!d.kickoffPrep.subProcesses[idx]) return;
  var oldVal = d.kickoffPrep.subProcesses[idx][field];
  d.kickoffPrep.subProcesses[idx][field] = val;
  // Migration : si on renomme un sous-process, mettre à jour les liens existants
  // pour qu'ils pointent vers le nouveau nom (sinon les pills cochées seraient perdues).
  if (field === 'name' && oldVal && oldVal !== val && d.subProcessRiskLinks) {
    Object.keys(d.subProcessRiskLinks).forEach(function(riskId){
      var arr = d.subProcessRiskLinks[riskId] || [];
      var i = arr.indexOf(oldVal);
      if (i >= 0) arr[i] = val;
    });
  }
  await saveAuditData(CA);
  // Re-render seulement si on change le nom (les pills doivent refléter le nouveau nom)
  if (field === 'name') {
    document.getElementById('det-content').innerHTML = renderDetContent();
  }
}
async function removeSubProcess(idx) {
  var d = getAudData(CA);
  if (!d.kickoffPrep || !Array.isArray(d.kickoffPrep.subProcesses)) return;
  // Récupérer le nom du sous-process avant suppression pour nettoyer les liens
  var removedName = (d.kickoffPrep.subProcesses[idx] && d.kickoffPrep.subProcesses[idx].name) || '';
  d.kickoffPrep.subProcesses.splice(idx, 1);
  // Nettoyer les liens risque ↔ sous-processus pointant vers ce nom
  if (removedName && d.subProcessRiskLinks) {
    Object.keys(d.subProcessRiskLinks).forEach(function(riskId){
      d.subProcessRiskLinks[riskId] = (d.subProcessRiskLinks[riskId]||[]).filter(function(n){return n!==removedName;});
      if (!d.subProcessRiskLinks[riskId].length) delete d.subProcessRiskLinks[riskId];
    });
  }
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// Toggle d'association risque ↔ sous-processus.
// Stocké dans d.subProcessRiskLinks = { [riskId]: [subProcessName, ...] }
async function toggleSubProcessRiskLink(riskId, subProcessName) {
  var d = getAudData(CA);
  if (!d.subProcessRiskLinks) d.subProcessRiskLinks = {};
  if (!Array.isArray(d.subProcessRiskLinks[riskId])) d.subProcessRiskLinks[riskId] = [];
  var arr = d.subProcessRiskLinks[riskId];
  var idx = arr.indexOf(subProcessName);
  if (idx >= 0) {
    arr.splice(idx, 1);
    if (!arr.length) delete d.subProcessRiskLinks[riskId];
  } else {
    arr.push(subProcessName);
  }
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// ════════════════════════════════════════════════════════════════════
//  WORK PROGRAM BU — Phase BU.3
//
//  Pour les audits de type BU, l'étape 2 (Work Program) permet :
//  - de sélectionner les Process à couvrir depuis le référentiel BU
//  - les tests sont copiés du référentiel (snapshot, modifiables localement)
//  - d'ajouter des Process Owners (multi)
//  - d'éditer les tests, ajouter des tests ad hoc, supprimer
//  - d'éditer les PBC et leur statut (à demander/demandé/reçu/N/A)
//
//  Modèle de données stocké dans audit.workProgramBU :
//  {
//    processes: [{
//      id, auditProcessId,
//      owners: [{id, name, email}],
//      tests: [{
//        id, source: 'ref'|'adhoc', refTestId, modifiedFromRef,
//        code, statement, objective, testType, samplingHint,
//        pbc: [{id, name, status}]
//      }]
//    }]
//  }
// ════════════════════════════════════════════════════════════════════

var PBC_STATUSES = ['à demander', 'demandé', 'reçu', 'N/A'];

function _wpBu(d) {
  // Helper : renvoie l'objet workProgramBU initialisé
  if (!d.workProgramBU) d.workProgramBU = { processes: [] };
  if (!Array.isArray(d.workProgramBU.processes)) d.workProgramBU.processes = [];
  return d.workProgramBU;
}

// Liste des Process à pré-inclure automatiquement en mode "Design only"
// au démarrage de tout audit BU. L'auditeur peut les retirer si non pertinents.
var DESIGN_ONLY_AUTO_PROCESSES = [
  'ESRs',
  'Corp Control & Compliance',
  'Intellectual Property',
  'Reporting & Forecasting',
];

// Injecte automatiquement les Process à revoir en Design only (si pas déjà fait).
// Utilise un flag persistant `wp._designOnlyAutoSeeded` pour ne le faire qu'une seule fois.
// Renvoie true si une modification a été faite (pour déclencher une sauvegarde).
function _seedDesignOnlyProcesses(wp) {
  if (wp._designOnlyAutoSeeded) return false;
  var changed = false;
  DESIGN_ONLY_AUTO_PROCESSES.forEach(function(procName){
    // Chercher le Process correspondant dans l'Audit Universe (par nom)
    var p = (PROCESSES||[]).find(function(x){
      return !x.archived && x.proc === procName;
    });
    if (!p) return; // Process pas trouvé dans Audit Universe, on skip silencieusement
    // Vérifier qu'il n'est pas déjà couvert
    if (wp.processes.find(function(wpp){return wpp.auditProcessId===p.id;})) return;
    // Ajouter en mode Design only
    wp.processes.push({
      id: 'wpp_'+Date.now()+'_'+Math.floor(Math.random()*100000),
      auditProcessId: p.id,
      owners: [],
      coverageMode: 'design_only',
      tests: [],
    });
    changed = true;
  });
  // Marquer comme seedé même si rien n'a été ajouté (par exemple si tous les Process sont déjà là)
  wp._designOnlyAutoSeeded = true;
  return changed || true; // On considère qu'il y a eu un changement (au minimum le flag)
}

// État de pliage par Process (UI uniquement, pas persisté en DB)
// Tous les Process sont repliés par défaut.
var _wpBuExpanded = {};
// État de pliage par test (pour afficher/masquer les détails inline)
var _wpBuTestExpanded = {};

function renderWorkProgramBuSection() {
  var a = AUDIT_PLAN.find(function(x){return x.id===CA;});
  var d = getAudData(CA);
  var wp = _wpBu(d);
  var isAdmin = CU && CU.role==='admin';
  var isPreparer = (a.assignedTo||a.auditeurs||[]).indexOf(CU&&CU.id)>=0 || isAdmin;
  // Le bouton "Uploader le BU Work Program" est masqué après le 1er upload
  var alreadyUploaded = !!wp.buWorkProgramUploaded;

  // Auto-inclusion des 4 Process Design only au 1er chargement
  if (isPreparer && !wp._designOnlyAutoSeeded) {
    var seeded = _seedDesignOnlyProcesses(wp);
    if (seeded) {
      // Sauvegarder en arrière-plan (sans bloquer le rendu)
      saveAuditData(CA).catch(function(e){console.warn('[WP-BU] auto-seed save error:', e);});
    }
  }

  var html = '';
  html += '<div class="cd" style="margin-bottom:1rem">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:8px">';
  html += '<span style="font-size:13px;font-weight:500">Process couverts <span style="color:var(--text-3);font-weight:400">('+wp.processes.length+' process)</span></span>';
  if (isPreparer) {
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    if (!alreadyUploaded) {
      html += '<button class="bp" style="font-size:11px;padding:4px 10px" onclick="showUploadBuWorkProgramModal()">↓ Uploader le BU Work Program</button>';
    }
    html += '<button class="bs" style="font-size:11px;padding:4px 10px" onclick="showAddBuProcessFromUniverseModal()">+ Définir le scope d\'audit</button>';
    html += '</div>';
  }
  html += '</div>';
  html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;margin-bottom:14px">Importe les Process et tests du référentiel BU Work Program (action en bloc), ou ajoute des Process supplémentaires depuis l\'Audit Universe. Les tests issus du référentiel sont copiés et restent modifiables localement sans impacter le référentiel.</div>';

  if (!wp.processes.length) {
    html += '<div style="font-size:12px;color:var(--text-3);font-style:italic;padding:1.5rem;text-align:center;border:1px dashed var(--border);border-radius:6px">';
    html += 'Aucun Process couvert pour cet audit. ';
    if (isPreparer) html += 'Commence par « Uploader le BU Work Program » pour importer le référentiel, ou ajoute un Process spécifique.';
    html += '</div>';
  } else {
    // ─── Tableau Owners (en haut) ─────────────────────────────────
    html += renderWpBuOwnersTable(wp, isPreparer);
    // ─── Liste des Process / Tests ────────────────────────────────
    wp.processes.forEach(function(wpp){
      html += renderWpBuProcessCard(wpp, isPreparer);
    });
  }

  html += '</div>';
  return html;
}

// ════════════════════════════════════════════════════════════════
//  TABLEAU OWNERS (en haut de la step Work Program)
//  Source de vérité unique pour les owners et leurs emails.
//  Alimente la présentation Kick Off et le mail de convocation.
// ════════════════════════════════════════════════════════════════
function renderWpBuOwnersTable(wp, isPreparer) {
  // Synthèse : nombre total owners + emails
  var totalOwners = 0;
  var totalEmails = 0;
  var processWithoutOwners = 0;
  var ownersWithoutEmail = 0;
  wp.processes.forEach(function(wpp){
    var owners = wpp.owners || [];
    if (!owners.length) processWithoutOwners++;
    owners.forEach(function(o){
      totalOwners++;
      if ((o.email||'').trim()) totalEmails++;
      else ownersWithoutEmail++;
    });
  });

  var h = '';
  h += '<div style="margin-bottom:14px;border:.5px solid var(--border);border-radius:6px;background:#fff">';

  // Header + synthèse
  h += '<div style="padding:9px 12px 9px 12px;border-bottom:.5px solid #f0f0f0">';
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">';
  h += '<span style="font-size:13px;font-weight:500">Process Owners — Scope d\'audit</span>';
  h += '</div>';
  h += '<div style="font-size:11px;color:var(--text-3);font-style:italic">Liste des owners et emails par process en scope. Ces informations alimentent la présentation Kick Off et le mail de convocation.</div>';
  // Synthèse colorée
  var summaryBg, summaryColor, summaryIcon, summaryText;
  if (totalOwners === 0) {
    summaryBg = '#FAEEDA'; summaryColor = '#854F0B'; summaryIcon = '⚠';
    summaryText = 'Aucun owner défini. Ajoute au moins un owner par process.';
  } else if (ownersWithoutEmail > 0 || processWithoutOwners > 0) {
    summaryBg = '#FAEEDA'; summaryColor = '#854F0B'; summaryIcon = '⚠';
    summaryText = wp.processes.length+' process · '+totalOwners+' owners · '+totalEmails+' emails — ';
    var problems = [];
    if (processWithoutOwners > 0) problems.push(processWithoutOwners+' process sans owner');
    if (ownersWithoutEmail > 0) problems.push(ownersWithoutEmail+' owner(s) sans email');
    summaryText += problems.join(', ');
  } else {
    summaryBg = '#E1F5EE'; summaryColor = '#085041'; summaryIcon = '✓';
    summaryText = wp.processes.length+' process · '+totalOwners+' owners · '+totalEmails+' emails. Tous les owners ont un email.';
  }
  h += '<div style="margin-top:6px;padding:6px 10px;background:'+summaryBg+';color:'+summaryColor+';border-radius:4px;font-size:11px;display:flex;align-items:center;gap:6px">';
  h += '<span>'+summaryIcon+'</span><span>'+summaryText+'</span>';
  h += '</div>';
  h += '</div>';

  // Tableau (1 ligne par Process)
  h += '<table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed">';
  h += '<colgroup><col style="width:32%"/><col style="width:68%"/></colgroup>';
  h += '<thead><tr>';
  h += '<th style="background:#fafafa;color:var(--text-2);padding:7px 10px;font-weight:500;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.4px;border-bottom:.5px solid #f0f0f0">Process</th>';
  h += '<th style="background:#fafafa;color:var(--text-2);padding:7px 10px;font-weight:500;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.4px;border-bottom:.5px solid #f0f0f0">Owners &amp; emails</th>';
  h += '</tr></thead><tbody>';

  wp.processes.forEach(function(wpp){
    // Récupérer le nom du Process depuis Audit Universe (lien vivant)
    var p = (PROCESSES||[]).find(function(x){return x.id===wpp.auditProcessId;});
    var procName = p ? p.proc : '(Process introuvable)';
    var loc = p ? ((p.univers||'') + (p.univers && p.dom ? ' > ' : '') + (p.dom||'')) : '';

    h += '<tr style="border-bottom:.5px solid #f0f0f0">';
    // Cell Process
    h += '<td style="padding:8px 10px;vertical-align:top">';
    h += '<div style="font-weight:500;font-size:12px">'+(''+procName).replace(/</g,'&lt;')+'</div>';
    if (loc) h += '<div style="font-size:9px;color:var(--text-3);margin-top:1px">'+(''+loc).replace(/</g,'&lt;')+'</div>';
    h += '</td>';
    // Cell Owners
    h += '<td style="padding:6px 10px;vertical-align:top">';
    var owners = wpp.owners || [];
    if (!owners.length) {
      h += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:3px 0">Aucun owner défini.</div>';
    } else {
      owners.forEach(function(o){
        h += '<div style="display:flex;align-items:center;gap:5px;padding:2px 0">';
        if (isPreparer) {
          h += '<input value="'+_escAttr(o.name)+'" placeholder="Nom" onchange="setWpBuOwner(\''+_escJsArg(wpp.id)+'\',\''+_escJsArg(o.id)+'\',\'name\',this.value)" style="flex:0 0 110px;font-size:11px;padding:3px 6px;border:.5px solid var(--border);border-radius:3px;background:#fff"/>';
          h += '<input value="'+_escAttr(o.email)+'" type="email" placeholder="email" onchange="setWpBuOwner(\''+_escJsArg(wpp.id)+'\',\''+_escJsArg(o.id)+'\',\'email\',this.value)" style="flex:1;font-size:11px;padding:3px 6px;border:.5px solid var(--border);border-radius:3px;background:#fff;color:var(--text-2);min-width:0"/>';
          h += '<button onclick="removeWpBuOwner(\''+_escJsArg(wpp.id)+'\',\''+_escJsArg(o.id)+'\')" title="Supprimer" style="background:#fff;border:.5px solid var(--border);color:var(--text-3);border-radius:3px;width:18px;height:20px;line-height:1;cursor:pointer;padding:0;font-size:11px;flex-shrink:0">×</button>';
        } else {
          h += '<span style="flex:0 0 110px;font-size:11px;font-weight:500">'+(''+(o.name||'')).replace(/</g,'&lt;')+'</span>';
          h += '<span style="flex:1;font-size:11px;color:var(--text-2)">'+(''+(o.email||'')).replace(/</g,'&lt;')+'</span>';
        }
        h += '</div>';
      });
    }
    if (isPreparer) {
      h += '<button class="bs" style="font-size:10px;padding:2px 7px;background:transparent;border:.5px dashed var(--border);color:var(--text-2);margin-top:3px" onclick="addWpBuOwner(\''+_escJsArg(wpp.id)+'\')">+ Ajouter un owner</button>';
    }
    h += '</td>';
    h += '</tr>';
  });

  h += '</tbody></table>';
  h += '</div>';
  return h;
}

// Helper backward compat : un wpp sans coverageMode est considéré comme design_and_operating
// (ce qui correspond à l'ancien comportement par défaut où tout Process avait des tests)
function _wppCoverageMode(wpp) {
  return wpp.coverageMode || 'design_and_operating';
}

function renderWpBuProcessCard(wpp, isPreparer) {
  // Récupérer les infos du Process depuis Audit Universe (lien vivant pour le nom)
  var p = (PROCESSES||[]).find(function(x){return x.id===wpp.auditProcessId;});
  var procName = p ? p.proc : '(Process introuvable)';
  var hierarchy = p ? ((p.univers||'') + (p.univers&&p.dom?' > ':'') + (p.dom||'')) : '';
  var testCount = (wpp.tests||[]).length;
  var adhocCount = (wpp.tests||[]).filter(function(t){return t.source==='adhoc';}).length;
  var owners = wpp.owners || [];
  var mode = _wppCoverageMode(wpp);
  var isDesignOnly = (mode === 'design_only');
  var expanded = !!_wpBuExpanded[wpp.id];

  // Couleurs selon le mode (chip discret)
  var modeBadgeBg = isDesignOnly ? '#FAEEDA' : '#E1F5EE';
  var modeBadgeColor = isDesignOnly ? '#854F0B' : '#085041';
  var modeBadgeLabel = isDesignOnly ? 'DESIGN ONLY' : 'DESIGN + OPERATING';

  var h = '';
  h += '<div style="border:.5px solid var(--border);border-radius:6px;margin-bottom:6px;background:#fff;overflow:hidden">';

  // ─── Header compact (1 ligne, cliquable pour plier/déplier) ─────
  h += '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#fafafa;cursor:pointer" onclick="toggleWpBuProcess(\''+_escJsArg(wpp.id)+'\')">';
  h += '<span style="font-size:10px;color:var(--text-3);width:10px;flex-shrink:0">'+(expanded?'▼':'▶')+'</span>';
  h += '<div style="flex:1;min-width:0">';
  h += '<div style="font-size:12px;font-weight:500">'+(''+procName).replace(/</g,'&lt;')+'</div>';
  if (hierarchy) h += '<div style="font-size:9px;color:var(--text-3)">'+(''+hierarchy).replace(/</g,'&lt;')+'</div>';
  h += '</div>';
  h += '<span style="background:'+modeBadgeBg+';color:'+modeBadgeColor+';font-size:9px;padding:2px 7px;border-radius:3px;font-weight:600;letter-spacing:.3px;flex-shrink:0">'+modeBadgeLabel+'</span>';
  if (isDesignOnly) {
    h += '<span style="font-size:10px;color:var(--text-3);font-style:italic;flex-shrink:0">revue conception · '+(owners.length?owners.length+(owners.length>1?' owners':' owner'):'aucun owner')+'</span>';
  } else {
    h += '<span style="font-size:10px;color:var(--text-3);flex-shrink:0">'+testCount+(testCount>1?' tests':' test')+(adhocCount?' ('+adhocCount+' ad hoc)':'')+' · '+(owners.length?owners.length+(owners.length>1?' owners':' owner'):'aucun owner')+'</span>';
  }
  if (isPreparer) {
    h += '<div style="display:flex;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">';
    h += '<select onchange="setWpBuCoverageMode(\''+_escJsArg(wpp.id)+'\',this.value)" style="font-size:9px;padding:2px 5px;border:.5px solid var(--border);border-radius:3px;background:#fff" title="Mode de couverture">';
    h += '<option value="design_and_operating"'+(mode==='design_and_operating'?' selected':'')+'>D+O</option>';
    h += '<option value="design_only"'+(mode==='design_only'?' selected':'')+'>D only</option>';
    h += '</select>';
    // "+ Test" : seulement en mode D+O (pas de tests à ajouter en mode Design only)
    if (!isDesignOnly) {
      h += '<button class="bs" style="font-size:9px;padding:2px 6px" onclick="addWpBuAdHocTest(\''+_escJsArg(wpp.id)+'\')" title="Ajouter un test hors BU Work Program">+ Test</button>';
    }
    h += '<button class="bd" style="font-size:9px;padding:2px 6px" onclick="removeWpBuProcess(\''+_escJsArg(wpp.id)+'\')" title="Retirer">Retirer</button>';
    h += '</div>';
  }
  h += '</div>';

  // ─── Contenu déplié ──────────────────────────────────────────────
  if (expanded) {
    if (isDesignOnly) {
      h += '<div style="padding:10px 14px;font-size:11px;color:var(--text-3);font-style:italic;text-align:center;border-top:.5px dashed #e0e0e0">';
      if (testCount > 0) {
        h += testCount+(testCount>1?' tests':' test')+' masqué'+(testCount>1?'s':'')+' (mode Design only). Pour les afficher à nouveau, repasse en mode « D+O ».';
      } else {
        h += 'Process en mode Design only — pas de tests substantifs. Les Issues Design seront saisies à l\'étape Interviews.';
      }
      h += '</div>';
    } else {
      // Table compacte des tests
      h += '<div style="border-top:.5px solid #f0f0f0">';
      if (!testCount) {
        h += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:10px;text-align:center">Aucun test pour ce process. Cliquez sur « + Test » dans l\'en-tête pour en ajouter un.</div>';
      } else {
        h += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
        (wpp.tests||[]).forEach(function(t){
          h += renderWpBuTestRowCompact(wpp.id, t, isPreparer);
        });
        h += '</table>';
      }
      h += '</div>';
    }
  }

  h += '</div>';
  return h;
}

// Toggle pliage d'un Process
function toggleWpBuProcess(wppId) {
  _wpBuExpanded[wppId] = !_wpBuExpanded[wppId];
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// Toggle pliage d'un test
function toggleWpBuTest(testId) {
  _wpBuTestExpanded[testId] = !_wpBuTestExpanded[testId];
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// Setter du mode de couverture
async function setWpBuCoverageMode(wppId, mode) {
  var d = getAudData(CA);
  var wp = (d.workProgramBU && Array.isArray(d.workProgramBU.processes))
    ? d.workProgramBU.processes : [];
  var wpp = wp.find(function(x){return x.id===wppId;});
  if (!wpp) return;
  wpp.coverageMode = mode;
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  if (mode === 'design_only') {
    toast('Mode Design only — les tests sont masqués');
  } else {
    toast('Mode Design + Operating');
  }
}



// ─── Test : ligne compacte (vue par défaut) ─────────────────────
// Affiche : Code | Énoncé | Type | bouton "Détail/Replier"
// Cliquer sur la ligne ou "Détail" déplie le test inline.
function renderWpBuTestRowCompact(wppId, t, isPreparer) {
  var expanded = !!_wpBuTestExpanded[t.id];
  var sourceTag = '';
  if (t.source === 'adhoc') sourceTag = ' <span style="font-size:8px;color:#993556;font-style:italic">(ad hoc)</span>';
  else if (t.modifiedFromRef) sourceTag = ' <span style="font-size:8px;color:#854F0B;font-style:italic">(modifié)</span>';

  // Énoncé tronqué si trop long (les détails complets seront dans la vue dépliée)
  var statement = (t.statement || '(sans énoncé)').replace(/</g,'&lt;');
  var maxLen = 110;
  var truncated = statement.length > maxLen ? statement.slice(0, maxLen-1)+'…' : statement;

  var h = '';
  h += '<tr style="border-top:.5px solid #f0f0f0;cursor:pointer" onclick="toggleWpBuTest(\''+_escJsArg(t.id)+'\')">';
  h += '<td style="padding:6px 8px;width:90px;vertical-align:middle;white-space:nowrap">';
  h += '<span style="font-size:9px;color:var(--text-3);width:8px;display:inline-block;margin-right:3px">'+(expanded?'▼':'▶')+'</span>';
  h += '<span style="background:var(--purple);color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;font-family:monospace;letter-spacing:.4px">'+(t.code||'').replace(/</g,'&lt;')+'</span>';
  h += '</td>';
  h += '<td style="padding:6px 8px;vertical-align:middle">'+truncated+sourceTag+'</td>';
  if (isPreparer) {
    h += '<td style="padding:6px 8px;width:60px;vertical-align:middle;text-align:right" onclick="event.stopPropagation()">';
    h += '<button class="bs" style="font-size:9px;padding:2px 6px" onclick="toggleWpBuTest(\''+_escJsArg(t.id)+'\')">'+(expanded?'Replier':'Détail')+'</button>';
    h += '</td>';
  }
  h += '</tr>';
  // Si déplié : 1 ligne supplémentaire qui contient les détails inline
  if (expanded) {
    h += '<tr style="background:#fafafa">';
    h += '<td colspan="'+(isPreparer?3:2)+'" style="padding:0">';
    h += renderWpBuTestRowDetail(wppId, t, isPreparer);
    h += '</td></tr>';
  }
  return h;
}

// ─── Test : détail déplié inline (édition complète) ──────────────
// Affiche tous les champs éditables : énoncé, objectif, type, sample, PBC...
// + bouton "Supprimer ce test" en bas.
function renderWpBuTestRowDetail(wppId, t, isPreparer) {
  if (!Array.isArray(t.pbc)) t.pbc = [];

  var h = '';
  h += '<div style="padding:10px 14px;border-top:.5px dashed #e0e0e0;background:#fafafa">';
  // Énoncé éditable
  h += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Énoncé du test</label>';
  if (isPreparer) {
    h += '<textarea onchange="setWpBuTestField(\''+_escJsArg(wppId)+'\',\''+_escJsArg(t.id)+'\',\'statement\',this.value)" style="width:100%;min-height:38px;font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px;resize:vertical;font-family:inherit;box-sizing:border-box;margin-bottom:5px">'+(''+(t.statement||'')).replace(/</g,'&lt;')+'</textarea>';
  } else {
    h += '<div style="font-size:11px;padding:5px 8px;background:#fff;border-radius:3px;margin-bottom:5px">'+(''+(t.statement||'—')).replace(/</g,'&lt;')+'</div>';
  }
  // Objectif (zone large, style assurance)
  h += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Objectif (assurance / contrôle interne)</label>';
  if (isPreparer) {
    h += '<textarea onchange="setWpBuTestField(\''+_escJsArg(wppId)+'\',\''+_escJsArg(t.id)+'\',\'objective\',this.value)" style="width:100%;min-height:38px;font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px;resize:vertical;font-family:inherit;box-sizing:border-box;margin-bottom:5px" placeholder="ex : S\'assurer que...">'+(''+(t.objective||'')).replace(/</g,'&lt;')+'</textarea>';
  } else {
    h += '<div style="font-size:11px;padding:5px 8px;background:#fff;border-radius:3px;margin-bottom:5px">'+(''+(t.objective||'—')).replace(/</g,'&lt;')+'</div>';
  }

  // Assertions COSO (zone large, monospace pour bien aligner les puces)
  h += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Assertions COSO testées</label>';
  if (isPreparer) {
    h += '<textarea onchange="setWpBuTestField(\''+_escJsArg(wppId)+'\',\''+_escJsArg(t.id)+'\',\'assertions\',this.value)" style="width:100%;min-height:60px;font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.5;box-sizing:border-box;margin-bottom:1px" placeholder="• Complétude (...)\n• Existence (...)\n• Exactitude (...)">'+(''+(t.assertions||'')).replace(/</g,'&lt;')+'</textarea>';
    h += '<div style="font-size:9px;color:var(--text-3);font-style:italic;margin-bottom:7px">Une assertion par ligne, précédée d\'une puce « • »</div>';
  } else {
    h += '<div style="font-size:11px;padding:5px 8px;background:#fff;border-radius:3px;margin-bottom:7px;white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.5">'+(''+(t.assertions||'—')).replace(/</g,'&lt;')+'</div>';
  }
  // Sampling
  h += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Méthode / sample (combien et comment)</label>';
  if (isPreparer) {
    h += '<input value="'+_escAttr(t.samplingHint)+'" placeholder="ex : 25 transactions sur les 12 derniers mois" onchange="setWpBuTestField(\''+_escJsArg(wppId)+'\',\''+_escJsArg(t.id)+'\',\'samplingHint\',this.value)" style="width:100%;font-size:11px;padding:4px 7px;border:1px solid var(--border);border-radius:3px;box-sizing:border-box;margin-bottom:7px"/>';
  } else {
    h += '<div style="font-size:11px;padding:4px 7px;margin-bottom:7px">'+(''+(t.samplingHint||'—')).replace(/</g,'&lt;')+'</div>';
  }
  // PBC avec statut
  h += '<div style="border-top:.5px dashed var(--border);padding-top:7px;margin-top:3px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
  h += '<span style="font-size:10px;font-weight:600;color:var(--text-2)">PBC · '+t.pbc.length+' document'+(t.pbc.length>1?'s':'')+'</span>';
  if (isPreparer) {
    h += '<button class="bs" style="font-size:10px;padding:2px 7px" onclick="addWpBuPbc(\''+_escJsArg(wppId)+'\',\''+_escJsArg(t.id)+'\')">+ Document</button>';
  }
  h += '</div>';
  if (!t.pbc.length) {
    h += '<div style="font-size:10px;color:var(--text-3);font-style:italic;padding:4px 0">Aucun document.</div>';
  } else {
    t.pbc.forEach(function(doc){
      var statusColor = doc.status==='reçu' ? '#085041' :
                        doc.status==='demandé' ? '#0C447C' :
                        doc.status==='N/A' ? '#888780' : '#854F0B';
      var statusBg = doc.status==='reçu' ? '#E1F5EE' :
                     doc.status==='demandé' ? '#E6F1FB' :
                     doc.status==='N/A' ? '#F1EFE8' : '#FAEEDA';
      h += '<div style="display:flex;align-items:center;gap:5px;padding:3px 0">';
      h += '<span style="font-size:11px;color:var(--text-3)">📄</span>';
      if (isPreparer) {
        h += '<input value="'+_escAttr(doc.name)+'" placeholder="ex : Journal des ventes" onchange="setWpBuPbcDoc(\''+_escJsArg(wppId)+'\',\''+_escJsArg(t.id)+'\',\''+_escJsArg(doc.id)+'\',\'name\',this.value)" style="flex:1;font-size:11px;padding:3px 7px;border:1px solid var(--border);border-radius:3px"/>';
        h += '<select onchange="setWpBuPbcDoc(\''+_escJsArg(wppId)+'\',\''+_escJsArg(t.id)+'\',\''+_escJsArg(doc.id)+'\',\'status\',this.value)" style="font-size:10px;padding:3px 6px;border:1px solid var(--border);border-radius:3px;background:'+statusBg+';color:'+statusColor+';font-weight:500">';
        PBC_STATUSES.forEach(function(s){
          h += '<option'+(doc.status===s?' selected':'')+'>'+s+'</option>';
        });
        h += '</select>';
        h += '<button onclick="removeWpBuPbc(\''+_escJsArg(wppId)+'\',\''+_escJsArg(t.id)+'\',\''+_escJsArg(doc.id)+'\')" title="Supprimer" style="background:#fff;border:.5px solid var(--border);color:var(--text-3);border-radius:3px;width:20px;height:20px;cursor:pointer;font-size:12px;padding:0;line-height:1">×</button>';
      } else {
        h += '<span style="font-size:11px;flex:1">'+(''+(doc.name||'')).replace(/</g,'&lt;')+'</span>';
        h += '<span style="font-size:10px;padding:2px 7px;border-radius:3px;background:'+statusBg+';color:'+statusColor+';font-weight:500">'+(doc.status||'à demander')+'</span>';
      }
      h += '</div>';
    });
  }
  h += '</div>';
  // Bouton supprimer le test (en bas, discret)
  if (isPreparer) {
    h += '<div style="text-align:right;margin-top:8px">';
    h += '<button class="bd" style="font-size:9px;padding:2px 7px" onclick="removeWpBuTest(\''+_escJsArg(wppId)+'\',\''+_escJsArg(t.id)+'\')">Supprimer ce test</button>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}


// ────────────────────────────────────────────────────────────────────
//  MODALE 1 — Uploader le BU Work Program (en bloc, depuis le référentiel)
//  Affiche les Process du référentiel (qui ont au moins 1 test) avec checkbox.
//  Chaque Process coché est ajouté à l'audit avec ses tests copiés.
//  Une fois validé, le bouton "Uploader" disparaît (alreadyUploaded).
// ────────────────────────────────────────────────────────────────────

function showUploadBuWorkProgramModal() {
  var d = getAudData(CA);
  var wp = _wpBu(d);
  var alreadyCovered = {};
  wp.processes.forEach(function(wpp){alreadyCovered[wpp.auditProcessId]=true;});

  // On ne propose QUE les Process qui ont au moins 1 test dans le référentiel
  var refEntries = (BU_PROCESSES||[]).filter(function(b){return (b.tests||[]).length>0;});
  if (!refEntries.length) {
    toast('Aucun process avec tests dans le référentiel BU');
    return;
  }

  // Construire la hiérarchie Univers > Domaine > Process pour les entrées du référentiel
  var hierarchy = {};
  refEntries.forEach(function(entry){
    var p = (PROCESSES||[]).find(function(x){return x.id===entry.auditProcessId;});
    if (!p || p.archived) return;
    var u = p.univers || '(Sans univers)';
    var dom = p.dom || '(Sans domaine)';
    if (!hierarchy[u]) hierarchy[u] = {};
    if (!hierarchy[u][dom]) hierarchy[u][dom] = [];
    hierarchy[u][dom].push({ process: p, refEntry: entry });
  });
  var UNIVERS_ORDER = ['GOVERNANCE', 'EDITION (Factory)', 'DISTRIBUTION', 'SUPPORT FUNCTIONS'];
  var universList = Object.keys(hierarchy).sort(function(a,b){
    var ia=UNIVERS_ORDER.indexOf(a), ib=UNIVERS_ORDER.indexOf(b);
    if (ia<0) ia=999; if (ib<0) ib=999;
    if (ia!==ib) return ia-ib;
    return a.localeCompare(b, 'fr', {sensitivity:'base'});
  });

  var body = '<div style="font-size:11px;color:var(--text-3);margin-bottom:10px">Coche les Process du référentiel BU à importer dans l\'audit. Leurs tests seront copiés et restent modifiables localement.</div>';
  body += '<div id="upload-bu-body">';
  universList.forEach(function(univ){
    body += '<div style="background:#3C3489;color:#fff;font-weight:700;padding:6px 10px;font-size:10px;letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px">'+(''+univ).replace(/</g,'&lt;')+'</div>';
    var domains = Object.keys(hierarchy[univ]).sort(function(a,b){return a.localeCompare(b,'fr',{sensitivity:'base'});});
    domains.forEach(function(dom){
      var rows = hierarchy[univ][dom].slice().sort(function(a,b){return (a.process.proc||'').localeCompare(b.process.proc||'','fr',{sensitivity:'base'});});
      body += '<div style="background:#EEEDFE;color:#3C3489;font-weight:600;padding:5px 10px 5px 16px;font-size:10px;margin-bottom:4px">'+(''+dom).replace(/</g,'&lt;')+'</div>';
      rows.forEach(function(item){
        var p = item.process;
        var refEntry = item.refEntry;
        var testCount = (refEntry.tests||[]).length;
        var isAlready = !!alreadyCovered[p.id];
        var disabledAttr = isAlready ? ' disabled' : '';
        var checkedAttr = isAlready ? '' : ' checked'; // par défaut, on coche tous les non-déjà-couverts
        body += '<label style="display:flex;align-items:center;gap:8px;padding:7px 16px;cursor:'+(isAlready?'default':'pointer')+';border-bottom:.5px solid #f0f0f0'+(isAlready?';opacity:.55':'')+'">';
        body += '<input type="checkbox" class="upl-bu-cb" value="'+_escAttr(p.id)+'"'+checkedAttr+disabledAttr+' style="width:14px;height:14px;flex-shrink:0"/>';
        body += '<div style="flex:1;min-width:0">';
        body += '<div style="font-size:12px;font-weight:500">'+(''+p.proc).replace(/</g,'&lt;')+'</div>';
        body += '<div style="font-size:10px;color:var(--purple)">'+testCount+' test'+(testCount>1?'s':'')+' dans le référentiel</div>';
        body += '</div>';
        if (isAlready) body += '<span style="background:#E1F5EE;color:#085041;font-size:9px;padding:2px 6px;border-radius:3px">déjà couvert</span>';
        body += '</label>';
      });
    });
  });
  body += '</div>';

  openModal('Uploader le BU Work Program', body, async function(){
    var checked = document.querySelectorAll('.upl-bu-cb:checked');
    if (!checked.length) {
      toast('Aucun process sélectionné');
      return;
    }
    var d2 = getAudData(CA);
    var wp2 = _wpBu(d2);
    var added = 0;

    checked.forEach(function(cb){
      var procId = cb.value;
      // Vérifier qu'on ne double pas (sécurité)
      if (wp2.processes.find(function(x){return x.auditProcessId===procId;})) return;
      var entry = (BU_PROCESSES||[]).find(function(b){return b.auditProcessId===procId;});
      if (!entry) return;
      var copiedTests = (entry.tests||[]).map(function(rt){
        return {
          id: 'wpt_'+Date.now()+'_'+Math.floor(Math.random()*100000),
          source: 'ref',
          refTestId: rt.id,
          modifiedFromRef: false,
          code: rt.code,
          statement: rt.statement,
          objective: rt.objective || '',
          testType: rt.testType || 'Substantive',
          samplingHint: rt.samplingHint || '',
          pbc: (rt.pbc||[]).map(function(pbc){
            return {
              id: 'wppbc_'+Date.now()+'_'+Math.floor(Math.random()*100000),
              name: pbc.name,
              status: 'à demander',
            };
          }),
        };
      });
      wp2.processes.push({
        id: 'wpp_'+Date.now()+'_'+Math.floor(Math.random()*100000),
        auditProcessId: procId,
        owners: [],
        coverageMode: 'design_and_operating', // Process avec tests → mode complet par défaut
        tests: copiedTests,
      });
      added++;
    });

    // Marquer comme uploadé pour cacher le bouton dorénavant
    wp2.buWorkProgramUploaded = true;

    await saveAuditData(CA);
    document.getElementById('det-content').innerHTML = renderDetContent();
    toast('BU Work Program importé ✓ — '+added+' process ajoutés');
  }, { wide: true });
}

// ────────────────────────────────────────────────────────────────────
//  MODALE 2 — Ajouter un Process hors BU Work Program
//  Affiche les Process de l'Audit Universe non encore couverts.
//  Inclut tous les Process (pas seulement ceux qui ont des tests dans le réf BU).
//  Création vide (pas de tests pré-remplis), à enrichir manuellement.
// ────────────────────────────────────────────────────────────────────

function showAddBuProcessFromUniverseModal() {
  var d = getAudData(CA);
  var wp = _wpBu(d);
  var alreadyCovered = {};
  wp.processes.forEach(function(wpp){alreadyCovered[wpp.auditProcessId]=true;});

  // Tous les Process de l'Audit Universe non archivés et non déjà couverts
  var available = (PROCESSES||[]).filter(function(p){
    return !p.archived && !alreadyCovered[p.id];
  });

  if (!available.length) {
    toast('Tous les Process de l\'Audit Universe sont déjà couverts');
    return;
  }

  // Construire la hiérarchie
  var hierarchy = {};
  available.forEach(function(p){
    var u = p.univers || '(Sans univers)';
    var dom = p.dom || '(Sans domaine)';
    if (!hierarchy[u]) hierarchy[u] = {};
    if (!hierarchy[u][dom]) hierarchy[u][dom] = [];
    hierarchy[u][dom].push(p);
  });
  var UNIVERS_ORDER = ['GOVERNANCE', 'EDITION (Factory)', 'DISTRIBUTION', 'SUPPORT FUNCTIONS'];
  var universList = Object.keys(hierarchy).sort(function(a,b){
    var ia=UNIVERS_ORDER.indexOf(a), ib=UNIVERS_ORDER.indexOf(b);
    if (ia<0) ia=999; if (ib<0) ib=999;
    if (ia!==ib) return ia-ib;
    return a.localeCompare(b, 'fr', {sensitivity:'base'});
  });

  var body = '<div style="font-size:11px;color:var(--text-3);margin-bottom:10px">Coche les Process à ajouter à l\'audit. Les tests du référentiel BU Work Program seront automatiquement importés (en mode Design + Operating). Tu pourras retirer/modifier les tests ensuite, ou basculer en mode Design only si nécessaire.</div>';
  body += '<div id="add-bu-univ-body">';
  universList.forEach(function(univ){
    body += '<div style="background:#3C3489;color:#fff;font-weight:700;padding:6px 10px;font-size:10px;letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px">'+(''+univ).replace(/</g,'&lt;')+'</div>';
    var domains = Object.keys(hierarchy[univ]).sort(function(a,b){return a.localeCompare(b,'fr',{sensitivity:'base'});});
    domains.forEach(function(dom){
      var rows = hierarchy[univ][dom].slice().sort(function(a,b){return (a.proc||'').localeCompare(b.proc||'','fr',{sensitivity:'base'});});
      body += '<div style="background:#EEEDFE;color:#3C3489;font-weight:600;padding:5px 10px 5px 16px;font-size:10px;margin-bottom:4px">'+(''+dom).replace(/</g,'&lt;')+'</div>';
      rows.forEach(function(p){
        // Indique si ce Process a des tests dans le référentiel BU (info utile)
        var refEntry = (BU_PROCESSES||[]).find(function(b){return b.auditProcessId===p.id;});
        var refTestCount = (refEntry && refEntry.tests) ? refEntry.tests.length : 0;
        // Process spécial Design Only ?
        var isDesignOnlyProc = DESIGN_ONLY_AUTO_PROCESSES.indexOf(p.proc) >= 0;
        body += '<label style="display:flex;align-items:center;gap:8px;padding:7px 16px;cursor:pointer;border-bottom:.5px solid #f0f0f0">';
        body += '<input type="checkbox" class="add-bu-univ-cb" value="'+_escAttr(p.id)+'" style="width:14px;height:14px;flex-shrink:0"/>';
        body += '<div style="flex:1;min-width:0">';
        body += '<div style="font-size:12px;font-weight:500">'+(''+p.proc).replace(/</g,'&lt;')+'</div>';
        if (isDesignOnlyProc) {
          body += '<div style="font-size:10px;color:#854F0B;font-style:italic">Process spécial → mode <strong>Design only</strong> par défaut</div>';
        } else if (refTestCount>0) {
          body += '<div style="font-size:10px;color:#085041;font-style:italic">'+refTestCount+' test'+(refTestCount>1?'s':'')+' du référentiel BU seront importés (mode D+O)</div>';
        } else {
          body += '<div style="font-size:10px;color:var(--text-3);font-style:italic">Aucun test dans le référentiel BU — à toi d\'ajouter des tests ad hoc (mode D+O)</div>';
        }
        body += '</div>';
        body += '</label>';
      });
    });
  });
  body += '</div>';

  openModal('Définir le scope d\'audit', body, async function(){
    var checked = document.querySelectorAll('.add-bu-univ-cb:checked');
    if (!checked.length) {
      toast('Aucun process sélectionné');
      return;
    }
    var d2 = getAudData(CA);
    var wp2 = _wpBu(d2);
    var added = 0;
    var totalTestsImported = 0;
    checked.forEach(function(cb){
      var procId = cb.value;
      if (wp2.processes.find(function(x){return x.auditProcessId===procId;})) return;
      // Trouver le Process pour décider du mode (D+O ou Design only selon la liste spéciale)
      var proc = (PROCESSES||[]).find(function(p){return p.id===procId;});
      var isDesignOnlyProc = proc && DESIGN_ONLY_AUTO_PROCESSES.indexOf(proc.proc) >= 0;
      var mode = isDesignOnlyProc ? 'design_only' : 'design_and_operating';

      // Importer les tests du référentiel BU (sauf Design only qui n'a pas besoin de tests substantifs)
      var importedTests = [];
      if (!isDesignOnlyProc) {
        var refEntry = (BU_PROCESSES||[]).find(function(b){return b.auditProcessId===procId;});
        if (refEntry && Array.isArray(refEntry.tests)) {
          refEntry.tests.forEach(function(refTest){
            // Cloner profondément le test pour éviter de modifier le référentiel
            var clonedTest = JSON.parse(JSON.stringify(refTest));
            // Réassigner un ID unique au test cloné (et à ses PBC)
            clonedTest.id = 'wpbut_'+Date.now()+'_'+Math.floor(Math.random()*100000);
            clonedTest.source = 'reference'; // marqueur pour distinguer du test ad hoc
            if (Array.isArray(clonedTest.pbc)) {
              clonedTest.pbc.forEach(function(pbcDoc){
                pbcDoc.id = 'wpbupbc_'+Date.now()+'_'+Math.floor(Math.random()*100000);
                // Initialiser le statut PBC (par audit, pas dans le référentiel)
                if (!pbcDoc.status) pbcDoc.status = 'todo';
              });
            }
            importedTests.push(clonedTest);
            totalTestsImported++;
          });
        }
      }

      wp2.processes.push({
        id: 'wpp_'+Date.now()+'_'+Math.floor(Math.random()*100000),
        auditProcessId: procId,
        owners: [],
        coverageMode: mode,
        tests: importedTests,
      });
      added++;
    });
    await saveAuditData(CA);
    document.getElementById('det-content').innerHTML = renderDetContent();
    var msg = added+' process ajouté'+(added>1?'s':'')+' ✓';
    if (totalTestsImported > 0) msg += ' ('+totalTestsImported+' test'+(totalTestsImported>1?'s':'')+' importé'+(totalTestsImported>1?'s':'')+')';
    toast(msg);
  }, { wide: true });
}


// ────────────────────────────────────────────────────────────────────
//  Setters & actions sur les Process couverts (Work Program BU)
// ────────────────────────────────────────────────────────────────────

async function removeWpBuProcess(wppId) {
  var d = getAudData(CA);
  var wp = _wpBu(d);
  var wpp = wp.processes.find(function(x){return x.id===wppId;});
  if (!wpp) return;
  var hasAdhoc = (wpp.tests||[]).some(function(t){return t.source==='adhoc';});
  var hasOwners = (wpp.owners||[]).length>0;
  var msg = 'Retirer ce Process de l\'audit ?';
  if (hasAdhoc || hasOwners) msg += '\n\nLes tests ad hoc et les owners seront perdus.';
  if (!confirm(msg)) return;
  wp.processes = wp.processes.filter(function(x){return x.id!==wppId;});
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Process retiré');
}

// Setter d'un champ d'un test
async function setWpBuTestField(wppId, testId, field, val) {
  var d = getAudData(CA);
  var wp = _wpBu(d);
  var wpp = wp.processes.find(function(x){return x.id===wppId;});
  if (!wpp) return;
  var t = (wpp.tests||[]).find(function(x){return x.id===testId;});
  if (!t) return;
  // Détecter si on modifie un test issu du référentiel
  if (t.source==='ref' && field==='statement' && val !== t.statement) {
    t.modifiedFromRef = true;
  }
  t[field] = val;
  await saveAuditData(CA);
  // Re-render seulement si on change le testType (pour rafraîchir le badge couleur)
  // ou si on vient de marquer comme "modifiedFromRef"
  if (field==='testType' || (field==='statement' && t.source==='ref')) {
    document.getElementById('det-content').innerHTML = renderDetContent();
  }
}

// Ajouter un test ad hoc
async function addWpBuAdHocTest(wppId) {
  var d = getAudData(CA);
  var wp = _wpBu(d);
  var wpp = wp.processes.find(function(x){return x.id===wppId;});
  if (!wpp) return;
  if (!Array.isArray(wpp.tests)) wpp.tests = [];
  var p = (PROCESSES||[]).find(function(x){return x.id===wpp.auditProcessId;});
  var slug = ((p&&p.proc)||'SUB').replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase()||'SUB';
  // Trouver le prochain numéro libre dans ce process
  var existingCodes = (wpp.tests||[]).map(function(t){return t.code||'';});
  var n = 1;
  while (existingCodes.indexOf('T-'+slug+'-'+(n<10?'0':'')+n)>=0) n++;
  wpp.tests.push({
    id: 'wpt_'+Date.now()+'_'+Math.floor(Math.random()*100000),
    source: 'adhoc',
    refTestId: '',
    modifiedFromRef: false,
    code: 'T-'+slug+'-'+(n<10?'0':'')+n,
    statement: '',
    objective: '',
    testType: 'Substantive',
    samplingHint: '',
    pbc: [],
  });
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// Supprimer un test
async function removeWpBuTest(wppId, testId) {
  if (!confirm('Supprimer ce test ?')) return;
  var d = getAudData(CA);
  var wp = _wpBu(d);
  var wpp = wp.processes.find(function(x){return x.id===wppId;});
  if (!wpp) return;
  wpp.tests = (wpp.tests||[]).filter(function(x){return x.id!==testId;});
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// Ajouter un PBC
async function addWpBuPbc(wppId, testId) {
  var d = getAudData(CA);
  var wp = _wpBu(d);
  var wpp = wp.processes.find(function(x){return x.id===wppId;});
  if (!wpp) return;
  var t = (wpp.tests||[]).find(function(x){return x.id===testId;});
  if (!t) return;
  if (!Array.isArray(t.pbc)) t.pbc = [];
  t.pbc.push({
    id: 'wppbc_'+Date.now()+'_'+Math.floor(Math.random()*100000),
    name: '',
    status: 'à demander',
  });
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}

async function setWpBuPbcDoc(wppId, testId, pbcId, field, val) {
  var d = getAudData(CA);
  var wp = _wpBu(d);
  var wpp = wp.processes.find(function(x){return x.id===wppId;});
  if (!wpp) return;
  var t = (wpp.tests||[]).find(function(x){return x.id===testId;});
  if (!t) return;
  var doc = (t.pbc||[]).find(function(x){return x.id===pbcId;});
  if (!doc) return;
  doc[field] = val;
  await saveAuditData(CA);
  // Re-render uniquement si on change le statut (pour rafraîchir la couleur)
  if (field==='status') {
    document.getElementById('det-content').innerHTML = renderDetContent();
  }
}

async function removeWpBuPbc(wppId, testId, pbcId) {
  var d = getAudData(CA);
  var wp = _wpBu(d);
  var wpp = wp.processes.find(function(x){return x.id===wppId;});
  if (!wpp) return;
  var t = (wpp.tests||[]).find(function(x){return x.id===testId;});
  if (!t) return;
  t.pbc = (t.pbc||[]).filter(function(x){return x.id!==pbcId;});
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// ────────────────────────────────────────────────────────────────────
//  MODALE — Process Owners
// ────────────────────────────────────────────────────────────────────

function showWpBuOwnersModal(wppId) {
  var d = getAudData(CA);
  var wp = _wpBu(d);
  var wpp = wp.processes.find(function(x){return x.id===wppId;});
  if (!wpp) return;
  var p = (PROCESSES||[]).find(function(x){return x.id===wpp.auditProcessId;});
  var procName = p ? p.proc : 'Process';
  if (!Array.isArray(wpp.owners)) wpp.owners = [];

  var body = '<div id="bu-owners-body">' + renderWpBuOwnersBody(wpp) + '</div>';
  openModal('Process Owners — '+procName.replace(/</g,'&lt;'),
    body,
    null,
    { hideOk: true, cancelLabel: 'Fermer' }
  );
}

function renderWpBuOwnersBody(wpp) {
  var h = '';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
  h += '<span style="font-size:12px;font-weight:500">'+(wpp.owners||[]).length+' owner'+((wpp.owners||[]).length>1?'s':'')+'</span>';
  h += '<button class="bp" style="font-size:11px;padding:4px 10px" onclick="addWpBuOwner(\''+_escJsArg(wpp.id)+'\')">+ Ajouter un owner</button>';
  h += '</div>';
  if (!(wpp.owners||[]).length) {
    h += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:1rem;text-align:center;border:1px dashed var(--border);border-radius:4px">Aucun owner. Cliquez sur « + Ajouter un owner ».</div>';
  } else {
    wpp.owners.forEach(function(o){
      h += '<div style="border:.5px solid var(--border);border-radius:5px;padding:8px 10px;margin-bottom:5px;background:#fafafa;display:grid;grid-template-columns:1fr 1.4fr 30px;gap:6px;align-items:center">';
      h += '<input value="'+_escAttr(o.name)+'" placeholder="Nom" onchange="setWpBuOwner(\''+_escJsArg(wpp.id)+'\',\''+_escJsArg(o.id)+'\',\'name\',this.value)" style="font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px"/>';
      h += '<input value="'+_escAttr(o.email)+'" type="email" placeholder="email facultatif" onchange="setWpBuOwner(\''+_escJsArg(wpp.id)+'\',\''+_escJsArg(o.id)+'\',\'email\',this.value)" style="font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px"/>';
      h += '<button onclick="removeWpBuOwner(\''+_escJsArg(wpp.id)+'\',\''+_escJsArg(o.id)+'\')" title="Supprimer" style="background:#fff;border:.5px solid var(--border);color:var(--text-3);border-radius:3px;width:24px;height:24px;cursor:pointer;font-size:13px;padding:0;line-height:1">×</button>';
      h += '</div>';
    });
  }
  return h;
}

async function addWpBuOwner(wppId) {
  var d = getAudData(CA);
  var wp = _wpBu(d);
  var wpp = wp.processes.find(function(x){return x.id===wppId;});
  if (!wpp) return;
  if (!Array.isArray(wpp.owners)) wpp.owners = [];
  wpp.owners.push({
    id: 'wpown_'+Date.now()+'_'+Math.floor(Math.random()*100000),
    name: '',
    email: '',
  });
  await saveAuditData(CA);
  // Refresh la vue principale (le tableau Owners + les compteurs sur les cartes Process)
  if (document.getElementById('det-content')) {
    document.getElementById('det-content').innerHTML = renderDetContent();
  }
  // Backward compat : si la modale Owners est encore ouverte (legacy), refresh-la aussi
  var body = document.getElementById('bu-owners-body');
  if (body) body.innerHTML = renderWpBuOwnersBody(wpp);
}

async function setWpBuOwner(wppId, ownerId, field, val) {
  var d = getAudData(CA);
  var wp = _wpBu(d);
  var wpp = wp.processes.find(function(x){return x.id===wppId;});
  if (!wpp) return;
  var o = (wpp.owners||[]).find(function(x){return x.id===ownerId;});
  if (!o) return;
  o[field] = val;
  await saveAuditData(CA);
}

async function removeWpBuOwner(wppId, ownerId) {
  var d = getAudData(CA);
  var wp = _wpBu(d);
  var wpp = wp.processes.find(function(x){return x.id===wppId;});
  if (!wpp) return;
  wpp.owners = (wpp.owners||[]).filter(function(x){return x.id!==ownerId;});
  await saveAuditData(CA);
  var body = document.getElementById('bu-owners-body');
  if (body) body.innerHTML = renderWpBuOwnersBody(wpp);
  if (document.getElementById('det-content')) {
    document.getElementById('det-content').innerHTML = renderDetContent();
  }
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

// ════════════════════════════════════════════════════════════════
//  KICK-OFF — Préparation du mail d'invitation (mailto:)
//  Ouvre Outlook avec destinataires + sujet + corps pré-remplis.
//  L'utilisateur ajoute la date/heure et le lien Teams dans Outlook.
// ════════════════════════════════════════════════════════════════

/**
 * Récupère la liste des participants du Kick-off (Auditeurs + Process Owners + Interviewees).
 * Retourne un objet { all: [{name, email, role}], summary: {auditors, owners, interviewees} }
 * Dédoublonne par email (case insensitive).
 */
function _gatherKickoffParticipants(audit, kickoffPrep) {
  var byEmail = {}; // dédup par email lowercase
  var summary = {auditors: 0, owners: 0, interviewees: 0};

  function add(name, email, role) {
    if (!email) return;
    var key = email.trim().toLowerCase();
    if (!key || byEmail[key]) return; // skip si déjà ajouté
    byEmail[key] = {name: (name || email).trim(), email: email.trim(), role: role};
    summary[role + 's']++;
  }

  // 1. Auditeurs assignés (depuis AUDIT_PLAN.auditeurs → IDs vers TM)
  var auditeurIds = Array.isArray(audit && audit.auditeurs) ? audit.auditeurs : [];
  auditeurIds.forEach(function(uid) {
    var tm = (typeof TM !== 'undefined' && TM[uid]) ? TM[uid] : null;
    if (tm && tm.email) {
      add(tm.name, tm.email, 'auditor');
    }
  });

  // 2. Process Owners (depuis Work Program — wpp.owners est la source de vérité)
  //    NOTE : auparavant on lisait kickoffPrep.subProcesses[].email, mais on a unifié
  //    la saisie dans le tableau Owners du Work Program (Sujet 3).
  var d = (typeof CA !== 'undefined' && typeof getAudData === 'function') ? getAudData(CA) : null;
  var wpProcesses = (d && d.workProgramBU && Array.isArray(d.workProgramBU.processes))
    ? d.workProgramBU.processes : [];
  wpProcesses.forEach(function(wpp) {
    (wpp.owners || []).forEach(function(o) {
      if (o && o.email) {
        add(o.name, o.email, 'owner');
      }
    });
  });

  // 2bis. Backward-compat : si kickoffPrep.subProcesses contient encore des emails
  //    (audits anciens, avant la migration), on les remonte aussi (dédup auto par email).
  var subProcs = (kickoffPrep && Array.isArray(kickoffPrep.subProcesses))
    ? kickoffPrep.subProcesses : [];
  subProcs.forEach(function(sp) {
    if (sp && sp.email) {
      add(sp.owners, sp.email, 'owner');
    }
  });

  // 3. Interviewees (depuis kickoffPrep.interviews)
  var interviews = (kickoffPrep && Array.isArray(kickoffPrep.interviews))
    ? kickoffPrep.interviews : [];
  interviews.forEach(function(itw) {
    if (itw && itw.email) {
      add(itw.contact, itw.email, 'interviewee');
    }
  });

  // Convertir l'objet en tableau (préserve ordre d'insertion JS)
  var all = Object.keys(byEmail).map(function(k) { return byEmail[k]; });
  return {all: all, summary: summary};
}

/**
 * Construit le sujet de l'email.
 */
function _buildKickoffSubject(audit) {
  var titre = (audit && audit.titre) || 'Audit interne';
  return 'Kick-off — ' + titre;
}

/**
 * Construit le corps texte du mail (mailto: ne supporte que le texte brut).
 * Garde-fous : sous ~1500 caractères pour éviter la troncature côté client mail.
 */
function _buildKickoffBody(audit, kickoffPrep, participants) {
  var titre = (audit && audit.titre) || 'l\'audit';
  var annee = (audit && audit.annee) || '';
  var type = (audit && audit.type) || '';
  var planning = (kickoffPrep && kickoffPrep.planning) || {};
  var subProcs = (kickoffPrep && Array.isArray(kickoffPrep.subProcesses))
    ? kickoffPrep.subProcesses : [];

  var lines = [];
  lines.push('Bonjour,');
  lines.push('');
  lines.push('Dans le cadre de l\'audit interne ' + titre + (annee ? ' (' + annee + ')' : '') + ', nous organisons la réunion de Kick-off.');
  lines.push('');
  lines.push('Cette réunion permettra de présenter :');
  lines.push('  • Le contexte et les objectifs de l\'audit');
  lines.push('  • Le périmètre couvert');
  lines.push('  • Le planning prévisionnel (interviews, testings, restitution)');
  lines.push('  • Les attentes vis-à-vis des équipes auditées');
  lines.push('');

  // Périmètre
  if (subProcs.length > 0) {
    lines.push('Périmètre couvert :');
    subProcs.forEach(function(sp) {
      if (sp.name) lines.push('  • ' + sp.name + (sp.owners ? ' — ' + sp.owners : ''));
    });
    lines.push('');
  }

  // Planning
  var hasPlanning = planning.kickOff || planning.interviews || planning.testing || planning.report;
  if (hasPlanning) {
    lines.push('Planning prévisionnel :');
    if (planning.kickOff)     lines.push('  • Kick-off : ' + planning.kickOff);
    if (planning.interviews)  lines.push('  • Interviews : semaine du ' + planning.interviews);
    if (planning.testing)     lines.push('  • Testing : semaine du ' + planning.testing);
    if (planning.report)      lines.push('  • Rapport : semaine du ' + planning.report);
    if (planning.restitution) lines.push('  • Restitution : ' + planning.restitution);
    lines.push('');
  }

  // Lien SharePoint vers le Kick-off PPT (priorité : final → draft → format ancien)
  var d = (typeof CA !== 'undefined' && typeof getAudData === 'function') ? getAudData(CA) : null;
  var attK = d && d.attachments && d.attachments.kickoff;
  var koToShare = null;
  var koShareLabel = '';
  if (attK) {
    if (attK.final && attK.final.webUrl) {
      koToShare = attK.final;
      koShareLabel = 'figée le ' + (attK.final.finalizedAt||'').slice(0,10);
    } else if (attK.draft && attK.draft.webUrl) {
      koToShare = attK.draft;
      koShareLabel = 'dernière mise à jour le ' + (attK.draft.uploadedAt||'').slice(0,10) + ' (draft)';
    } else if (attK.webUrl) {
      // Backward-compat ancien format plat
      koToShare = attK;
      koShareLabel = 'dernière mise à jour le ' + (attK.uploadedAt||'').slice(0,10);
    }
  }
  if (koToShare) {
    lines.push('Présentation Kick-off :');
    lines.push('  ' + koToShare.webUrl);
    lines.push('  (Document SharePoint, ' + koShareLabel + ')');
    lines.push('');
  }

  lines.push('Merci de me confirmer votre disponibilité afin que je vous envoie une invitation Outlook (avec lien Teams).');
  lines.push('');
  lines.push('Bien cordialement,');
  if (typeof CU !== 'undefined' && CU && CU.name) {
    lines.push(CU.name);
  }
  lines.push('— Audit interne');

  return lines.join('\r\n'); // \r\n recommandé pour mailto:
}

// ════════════════════════════════════════════════════════════════════
//  UI BOOKING KICK-OFF — Multi-créneaux + assignation manuelle
//  Utilise Graph (findMeetingTimes + createOutlookEvent)
// ════════════════════════════════════════════════════════════════════

// État éphémère côté JS (reset à chaque fermeture de la modale)
var _kickoffBooking = null;

function _initKickoffBooking() {
  return {
    open: false,
    durationMinutes: 60,
    daysAhead: 7,
    workingHours: '09-18',
    slotsLoaded: false,
    slots: [],         // [{id, startISO, endISO, status: 'good'|'partial', conflicts: ['email']}]
    selected: {},      // {slotId: true}
    assignments: {},   // {slotId: {to: ['email'], cc: ['email']}}
    manualSlots: [],   // [{id, startISO, endISO}]
    adHocContacts: [], // [{email, name, type: 'to'|'cc'}] — contacts ad hoc ajoutés manuellement
    options: {
      includeTeams: true,
      attachKickoff: true,
    },
    busy: false,
  };
}

function openKickoffBookingUI() {
  _kickoffBooking = _initKickoffBooking();
  _kickoffBooking.open = true;
  // Pré-remplir l'attachKickoff selon disponibilité du final
  var d = getAudData(CA);
  var finalKO = d.attachments && d.attachments.kickoff && d.attachments.kickoff.final;
  if (!finalKO || !finalKO.webUrl) {
    _kickoffBooking.options.attachKickoff = false;
  }
  document.getElementById('det-content').innerHTML = renderDetContent();
  // Scroll vers la section
  setTimeout(function(){
    var el = document.getElementById('kickoff-booking-section');
    if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
  }, 100);
}

function closeKickoffBookingUI() {
  _kickoffBooking = null;
  document.getElementById('det-content').innerHTML = renderDetContent();
}

function _kbGetParticipants() {
  var audit = (AUDIT_PLAN || []).find(function(a) { return a.id === CA; });
  if (!audit) return {to: [], cc: []};
  var d = getAudData(CA);
  var to = {};
  var cc = {};

  // Auditeurs (TO)
  (audit.auditeurs || []).forEach(function(uid) {
    var tm = (typeof TM !== 'undefined' && TM[uid]) ? TM[uid] : null;
    if (tm && tm.email) to[tm.email.toLowerCase()] = {email: tm.email, name: tm.name || tm.email};
  });

  // Owners du Work Program (TO) — audit BU
  if (d.workProgramBU && Array.isArray(d.workProgramBU.processes)) {
    d.workProgramBU.processes.forEach(function(wpp) {
      (wpp.owners||[]).forEach(function(o) {
        if (o && o.email) {
          var key = o.email.toLowerCase();
          if (!to[key]) to[key] = {email: o.email, name: o.name || o.email};
        }
      });
    });
  }

  // Owners des sous-processus (TO) — audit Process
  if (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) {
    d.kickoffPrep.subProcesses.forEach(function(sp) {
      if (sp && sp.email) {
        var emails = sp.email.split(/[,;]/).map(function(e){return e.trim();}).filter(Boolean);
        emails.forEach(function(e){
          var key = e.toLowerCase();
          if (!to[key]) to[key] = {email: e, name: sp.owners || e};
        });
      }
    });
  }

  // Interviewees (CC)
  if (d.kickoffPrep && Array.isArray(d.kickoffPrep.interviews)) {
    d.kickoffPrep.interviews.forEach(function(itw) {
      if (itw && itw.email) {
        var key = itw.email.toLowerCase();
        if (!to[key]) cc[key] = {email: itw.email, name: itw.name || itw.email};
      }
    });
  }

  // Ajouts ad hoc (saisis manuellement dans l'UI booking)
  if (_kickoffBooking && Array.isArray(_kickoffBooking.adHocContacts)) {
    _kickoffBooking.adHocContacts.forEach(function(c){
      if (!c || !c.email) return;
      var key = c.email.toLowerCase();
      var entry = {email: c.email, name: c.name || c.email, isAdHoc: true};
      if (c.type === 'cc') {
        if (!to[key]) cc[key] = entry;
      } else {
        // type 'to' (défaut)
        if (!to[key]) to[key] = entry;
        // Si déjà en CC, on le promeut en TO
        if (cc[key]) delete cc[key];
      }
    });
  }

  return {
    to: Object.keys(to).map(function(k){return to[k];}),
    cc: Object.keys(cc).map(function(k){return cc[k];})
  };
}

// ─── Render UI booking Kick-off (version simplifiée — création manuelle) ──
function renderKickoffBookingSection() {
  if (!_kickoffBooking || !_kickoffBooking.open) return '';

  var participants = _kbGetParticipants();
  var d = getAudData(CA);
  var finalKO = d.attachments && d.attachments.kickoff && d.attachments.kickoff.final;
  var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';

  var html = '<div id="kickoff-booking-section" class="card" style="margin-bottom:.75rem;background:linear-gradient(135deg,#EEEDFE 0%,#F5F4FE 100%);border:.5px solid #CECBF6">';

  // Header
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  html += '<div>';
  html += '<div style="font-size:14px;font-weight:600;color:#3C3489">📅 Booker la (les) réunion(s) Kick-off</div>';
  html += '<div style="font-size:11px;color:#534AB7;margin-top:2px">Saisis manuellement un ou plusieurs créneaux et crée les réunions Outlook avec invitations.</div>';
  html += '</div>';
  html += '<button class="bs" style="font-size:11px;padding:4px 10px" onclick="closeKickoffBookingUI()">× Fermer</button>';
  html += '</div>';

  // Bandeau timezone
  html += '<div style="font-size:10px;color:#534AB7;background:#fff;padding:5px 10px;border-radius:3px;border:.5px solid #CECBF6;margin-bottom:10px">';
  html += '<span style="margin-right:5px">🕐</span>Horaires en <strong style="font-weight:500">'+tz+'</strong> (ton fuseau). Les invités verront leur fuseau local automatiquement dans Outlook.';
  html += '</div>';

  // Récap participants
  var hasMain = participants.to.length || participants.cc.length;
  var adHoc = (_kickoffBooking.adHocContacts || []);
  if (!hasMain && !adHoc.length) {
    html += '<div style="background:#FAEEDA;border:.5px solid #FAC775;color:#854F0B;padding:8px 10px;border-radius:4px;font-size:11px;margin-bottom:10px">';
    html += '⚠ Aucun participant avec email. Ajoute des auditeurs (avec email TM), des Owners au Work Program, des Interviewees, ou utilise « + Ajouter un contact » ci-dessous.';
    html += '</div>';
  } else {
    html += '<div style="background:#fff;border:.5px solid var(--border);padding:8px 10px;border-radius:4px;font-size:11px;margin-bottom:10px">';
    html += '<strong style="font-weight:500;color:#3C3489">'+participants.to.length+' participants TO</strong>';
    if (participants.cc.length) html += ' · <strong style="font-weight:500;color:#854F0B">'+participants.cc.length+' CC</strong>';
    if (adHoc.length) html += ' <span style="color:var(--text-3);font-style:italic"> · dont '+adHoc.length+' ad hoc</span>';
    // Liste détaillée (cliquable pour expanded ?)
    html += '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">';
    participants.to.forEach(function(p){
      html += '<span style="font-size:10px;background:#EEEDFE;color:#3C3489;padding:2px 7px;border-radius:10px">'+(p.name||p.email).replace(/</g,'&lt;')+'</span>';
    });
    participants.cc.forEach(function(p){
      html += '<span style="font-size:10px;background:#FFF4D9;color:#854F0B;padding:2px 7px;border-radius:10px">'+(p.name||p.email).replace(/</g,'&lt;')+' · CC</span>';
    });
    html += '</div>';
    html += '</div>';
  }

  // ─── Zone "Ajouter un contact ad hoc" ─────────────────────────
  html += '<div style="background:#fff;border:.5px solid var(--border);padding:8px 10px;border-radius:4px;margin-bottom:10px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
  html += '<span style="font-size:11px;color:var(--text-2);font-weight:500">Contacts ad hoc <span style="font-weight:400;color:var(--text-3);font-style:italic">(non listés dans les owners/interviewees)</span></span>';
  html += '</div>';
  html += '<div style="display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap">';
  html += '<div style="flex:1;min-width:140px"><label style="font-size:9px;color:var(--text-3);display:block">Email</label><input id="adhoc-email" type="email" placeholder="ex : j.dupont@axway.com" style="width:100%;font-size:11px;padding:4px 7px;border:1px solid var(--border);border-radius:3px;box-sizing:border-box"/></div>';
  html += '<div style="flex:1;min-width:120px"><label style="font-size:9px;color:var(--text-3);display:block">Nom (facultatif)</label><input id="adhoc-name" placeholder="ex : J. Dupont" style="width:100%;font-size:11px;padding:4px 7px;border:1px solid var(--border);border-radius:3px;box-sizing:border-box"/></div>';
  html += '<div><label style="font-size:9px;color:var(--text-3);display:block">Type</label><select id="adhoc-type" style="font-size:11px;padding:4px 7px;border:1px solid var(--border);border-radius:3px"><option value="to">TO</option><option value="cc">CC</option></select></div>';
  html += '<button class="bs" style="font-size:11px;padding:5px 10px" onclick="addAdHocContact()">+ Ajouter</button>';
  html += '</div>';
  if (adHoc.length) {
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;padding-top:8px;border-top:.5px solid #f0f0f0">';
    adHoc.forEach(function(c, idx){
      var bg = c.type === 'cc' ? '#FFF4D9' : '#EEEDFE';
      var color = c.type === 'cc' ? '#854F0B' : '#3C3489';
      var border = c.type === 'cc' ? '#FAC775' : '#CECBF6';
      var label = (c.name || c.email) + ' · ' + (c.type === 'cc' ? 'CC' : 'TO');
      html += '<span style="font-size:10px;background:'+bg+';color:'+color+';padding:3px 8px;border-radius:10px;border:.5px solid '+border+';display:inline-flex;align-items:center;gap:4px">'
        + label.replace(/</g,'&lt;')
        + ' <button onclick="removeAdHocContact('+idx+')" title="Retirer" style="background:transparent;border:none;color:'+color+';font-size:11px;cursor:pointer;padding:0;line-height:1">×</button>'
        + '</span>';
    });
    html += '</div>';
  }
  html += '</div>';

  // ─── Section Créneaux (saisie manuelle uniquement) ────────────
  var manualSlots = _kickoffBooking.manualSlots || [];
  html += '<div style="background:#fff;border:.5px solid var(--border);padding:10px 12px;border-radius:4px;margin-bottom:10px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  html += '<span style="font-size:11px;color:var(--text-2);font-weight:500">Créneaux à créer ('+manualSlots.length+')</span>';
  html += '<button class="bs" style="font-size:11px;padding:4px 10px;background:#3C3489;color:#fff;border-color:#3C3489" onclick="showAddManualSlotForm()">+ Ajouter un créneau</button>';
  html += '</div>';
  if (!manualSlots.length) {
    html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;text-align:center;padding:8px">Aucun créneau saisi. Clique sur « + Ajouter un créneau » pour commencer.</div>';
  } else {
    manualSlots.forEach(function(slot, idx){
      var startD = new Date(slot.startISO);
      var endD = new Date(slot.endISO);
      var dayLabel = startD.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
      var timeLabel = startD.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}) + ' — ' + endD.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
      html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:.5px solid #CECBF6;background:#FAFAFE;border-radius:4px;margin-bottom:5px">';
      html += '<span style="background:#EEEDFE;color:#3C3489;font-size:9px;padding:2px 7px;border-radius:3px;font-weight:500">M'+(idx+1)+'</span>';
      html += '<span style="font-size:11px;font-weight:500;flex:1">'+dayLabel+' · '+timeLabel+'</span>';
      html += '<button onclick="removeManualSlot(\''+_escJsArg(slot.id)+'\')" title="Retirer" style="background:#fff;border:.5px solid var(--border);color:#993C1D;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:11px">×</button>';
      html += '</div>';
    });
  }
  html += '</div>';

  // ─── Options ─────────────────────────────────────────────────
  if (manualSlots.length > 0) {
    html += '<div style="display:flex;gap:14px;margin:10px 0;padding:10px 12px;background:#fff;border-radius:4px;border:.5px solid var(--border);flex-wrap:wrap">';
    html += '<label style="font-size:11px;display:flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" '+(_kickoffBooking.options.includeTeams?'checked':'')+' onchange="_kickoffBooking.options.includeTeams=this.checked"/> Inclure lien Teams (1 par réunion)</label>';
    if (finalKO && finalKO.webUrl) {
      html += '<label style="font-size:11px;display:flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" '+(_kickoffBooking.options.attachKickoff?'checked':'')+' onchange="_kickoffBooking.options.attachKickoff=this.checked"/> Joindre le PPT Kick-off (final)</label>';
    } else {
      html += '<label style="font-size:11px;display:flex;align-items:center;gap:5px;color:var(--text-3)" title="Génère et marque comme final le Kick-off pour pouvoir l\'attacher"><input type="checkbox" disabled/> <em>Joindre le PPT (final non disponible)</em></label>';
    }
    html += '</div>';

    // Boutons de création (v67 : 2 modes — Outlook deep link OU création directe via Graph)
    var totalParticipants = participants.to.length + participants.cc.length;
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px;flex-wrap:wrap">';
    html += '<div style="font-size:11px;color:#3C3489;font-weight:500">'+manualSlots.length+' réunion(s) · '+totalParticipants+' participants chacune</div>';
    html += '<div style="display:flex;gap:8px">';
    // Bouton 1 : ouvrir dans Outlook (deep link)
    html += '<button class="bs" style="font-size:11px;padding:8px 14px;background:#fff;color:#0078D4;border:1px solid #0078D4;border-radius:3px;cursor:pointer;font-weight:500" onclick="openMeetingsInOutlook()" title="Ouvrir Outlook avec sujet/invités/heure pré-remplis pour vérifier les dispos avant d\'envoyer">↗ Ouvrir dans Outlook</button>';
    // Bouton 2 : création directe via Graph
    html += '<button class="bp" style="font-size:12px;padding:8px 16px;background:#3C3489;color:#fff;font-weight:500" onclick="createKickoffMeetings()" '+(_kickoffBooking.busy?'disabled':'')+'>📅 '+(_kickoffBooking.busy?'Création en cours...':'Créer & envoyer ('+manualSlots.length+')')+'</button>';
    html += '</div>';
    html += '</div>';
    html += '<div style="font-size:10px;color:var(--text-3);font-style:italic;margin-top:6px;text-align:right">↗ Outlook : voir les dispos avant d\'envoyer · 📅 Créer & envoyer : crée et envoie directement les invitations</div>';
  }

  html += '</div>';
  return html;
}

function showAddManualSlotForm() {
  var defaultDate = new Date(Date.now() + 86400000); // demain
  var defaultDateStr = defaultDate.toISOString().slice(0,10);
  var body = '<div><label>Date</label><input id="ms-date" type="date" value="'+defaultDateStr+'"/></div>'
    + '<div class="g2"><div><label>Heure début</label><input id="ms-start" type="time" value="14:00"/></div>'
    + '<div><label>Heure fin</label><input id="ms-end" type="time" value="15:00"/></div></div>';
  openModal('Ajouter un créneau', body, async function(){
    var date = document.getElementById('ms-date').value;
    var startT = document.getElementById('ms-start').value;
    var endT = document.getElementById('ms-end').value;
    if (!date || !startT || !endT) { toast('Remplir date + heure début + heure fin'); return; }
    var startISO = new Date(date+'T'+startT+':00').toISOString();
    var endISO = new Date(date+'T'+endT+':00').toISOString();
    if (new Date(endISO) <= new Date(startISO)) { toast('L\'heure de fin doit être après l\'heure de début'); return; }
    var slotId = 'manual_'+Date.now();
    if (!_kickoffBooking) _kickoffBooking = _initKickoffBooking();
    _kickoffBooking.manualSlots.push({id: slotId, startISO: startISO, endISO: endISO});
    document.getElementById('det-content').innerHTML = renderDetContent();
    toast('Créneau ajouté ✓');
  });
}

function removeManualSlot(slotId) {
  if (!_kickoffBooking) return;
  _kickoffBooking.manualSlots = _kickoffBooking.manualSlots.filter(function(s){return s.id!==slotId;});
  document.getElementById('det-content').innerHTML = renderDetContent();
}

function addAdHocContact() {
  if (!_kickoffBooking) return;
  var emailEl = document.getElementById('adhoc-email');
  var nameEl = document.getElementById('adhoc-name');
  var typeEl = document.getElementById('adhoc-type');
  if (!emailEl) return;
  var email = (emailEl.value || '').trim();
  var name = (nameEl ? nameEl.value : '').trim();
  var type = (typeEl ? typeEl.value : 'to');

  // Validation email simple
  if (!email) { toast('Email obligatoire'); return; }
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) { toast('Email invalide'); return; }

  // Empêcher les doublons (insensible à la casse)
  var lc = email.toLowerCase();
  if (!Array.isArray(_kickoffBooking.adHocContacts)) _kickoffBooking.adHocContacts = [];
  var exists = _kickoffBooking.adHocContacts.some(function(c){return c.email.toLowerCase()===lc;});
  if (exists) { toast('Ce contact est déjà ajouté'); return; }

  _kickoffBooking.adHocContacts.push({
    email: email,
    name: name || email,
    type: (type === 'cc' ? 'cc' : 'to'),
  });

  // Reset du formulaire (input + name)
  emailEl.value = '';
  if (nameEl) nameEl.value = '';
  if (typeEl) typeEl.value = 'to';

  // Si des créneaux sont déjà chargés, on remet à zéro car la recherche dépend des participants.
  // (On garde slotsLoaded à false pour inviter à relancer la recherche.)
  if (_kickoffBooking.slotsLoaded && _kickoffBooking.slots && _kickoffBooking.slots.length) {
    toast('Contact ajouté ✓ — relance la recherche de créneaux pour en tenir compte');
  } else {
    toast('Contact ajouté ✓');
  }

  document.getElementById('det-content').innerHTML = renderDetContent();
}

function removeAdHocContact(idx) {
  if (!_kickoffBooking || !Array.isArray(_kickoffBooking.adHocContacts)) return;
  if (idx < 0 || idx >= _kickoffBooking.adHocContacts.length) return;
  var removed = _kickoffBooking.adHocContacts[idx];
  _kickoffBooking.adHocContacts.splice(idx, 1);

  // Nettoyer aussi les assignations existantes pour cet email (ils ne doivent plus apparaître)
  if (removed && removed.email && _kickoffBooking.assignments) {
    var lc = removed.email.toLowerCase();
    Object.keys(_kickoffBooking.assignments).forEach(function(slotId){
      var a = _kickoffBooking.assignments[slotId];
      if (a) {
        a.to = (a.to||[]).filter(function(em){return em.toLowerCase()!==lc;});
        a.cc = (a.cc||[]).filter(function(em){return em.toLowerCase()!==lc;});
      }
    });
  }

  document.getElementById('det-content').innerHTML = renderDetContent();
}


// v67 : Deep link Outlook pour ouvrir l'écran de planification de réunion avec
// les infos pré-remplies. Permet à l'utilisateur de voir les disponibilités dans
// Outlook (Scheduling Assistant) avant d'envoyer les invitations.
// Doc : https://learn.microsoft.com/en-us/exchange/clients/outlook-on-the-web/url-commands
function openMeetingsInOutlook() {
  if (!_kickoffBooking) return;
  var manualSlots = _kickoffBooking.manualSlots || [];
  if (!manualSlots.length) { toast('Ajoute au moins un créneau'); return; }

  var audit = (AUDIT_PLAN || []).find(function(a) { return a.id === CA; });
  if (!audit) { toast('Audit introuvable'); return; }
  var d = getAudData(CA);

  var participants = _kbGetParticipants();
  if (!participants.to.length && !participants.cc.length) {
    toast('Aucun participant — ajoute au moins un contact (auto ou ad hoc)');
    return;
  }

  // Lien SharePoint du Kick-off final
  var kickoffLink = null;
  var kickoffName = null;
  if (_kickoffBooking.options.attachKickoff) {
    var finalKO = d.attachments && d.attachments.kickoff && d.attachments.kickoff.final;
    if (finalKO && finalKO.webUrl) {
      kickoffLink = finalKO.webUrl;
      kickoffName = finalKO.fileName || 'KickOff_final.pptx';
    }
  }

  var auditTitle = audit.titre || '';
  var organizerName = (typeof CU !== 'undefined' && CU && CU.name) ? CU.name : '';

  // Body bilingue (texte simple, pas HTML — Outlook deep link prend du plain text dans body)
  var body = '';
  body += 'Hello,\n\n';
  body += 'I invite you to the kick-off meeting of the audit "' + auditTitle + '".\n';
  body += 'The purpose of this meeting is to present the scope, objectives, and timeline of the audit assignment.\n\n';
  if (kickoffLink) body += 'Presentation deck: ' + kickoffLink + '\n\n';
  body += 'Kind regards,\n' + organizerName + ' — Director of Internal Audit\n\n';
  body += '====================================================\n\n';
  body += 'Bonjour,\n\n';
  body += 'Je vous invite à la réunion de Kick-off de l\'audit « ' + auditTitle + ' ».\n';
  body += 'Cette réunion vise à présenter le périmètre, les objectifs et le planning de la mission.\n\n';
  if (kickoffLink) body += 'Support de présentation : ' + kickoffLink + '\n\n';
  body += 'Cordialement,\n' + organizerName + '\nDirecteur de l\'Audit Interne\n';

  // Construire la liste des destinataires (TO + CC séparés)
  var toList = participants.to.map(function(p){return p.email;}).join(';');
  var ccList = participants.cc.map(function(p){return p.email;}).join(';');

  // Pour chaque créneau, ouvrir un onglet Outlook (limité à 1 par clic pour éviter
  // les pop-up blockers — si plusieurs slots, on prend le 1er + indication)
  var slot = manualSlots[0];
  var subject = 'Kick-off audit — ' + auditTitle + (manualSlots.length > 1 ? ' (à dupliquer pour les autres créneaux)' : '');

  // Format de date attendu par Outlook : ISO 8601 avec décalage UTC ou date format YYYY-MM-DDTHH:mm
  // L'API URL Outlook accepte format "YYYY-MM-DDTHH:mm:ss"
  var startDate = new Date(slot.startISO);
  var endDate = new Date(slot.endISO);
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtLocal(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate())
      + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':00';
  }
  var startStr = fmtLocal(startDate);
  var endStr = fmtLocal(endDate);

  // URL Outlook deep link
  // Note : online=true tente d'utiliser Outlook Web ; allowonline=true permet la création
  var url = 'https://outlook.office.com/calendar/0/deeplink/compose'
    + '?path=/calendar/action/compose'
    + '&rru=addevent'
    + '&subject=' + encodeURIComponent(subject)
    + '&body=' + encodeURIComponent(body)
    + '&startdt=' + encodeURIComponent(startStr)
    + '&enddt=' + encodeURIComponent(endStr)
    + '&to=' + encodeURIComponent(toList)
    + (ccList ? '&cc=' + encodeURIComponent(ccList) : '')
    + (_kickoffBooking.options.includeTeams ? '&online=true&allowonline=true' : '');

  // Ouvrir dans un nouvel onglet
  var win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    toast('⚠ Pop-up bloqué. Autorise les pop-ups pour outlook.office.com et réessaie.');
    return;
  }
  if (manualSlots.length > 1) {
    toast('↗ Outlook ouvert pour le 1er créneau · Duplique manuellement pour les autres');
  } else {
    toast('↗ Outlook ouvert · Vérifie les dispos et envoie depuis Outlook');
  }
}


async function createKickoffMeetings() {
  if (!_kickoffBooking) return;
  var manualSlots = _kickoffBooking.manualSlots || [];
  if (!manualSlots.length) { toast('Ajoute au moins un créneau'); return; }

  var audit = (AUDIT_PLAN || []).find(function(a) { return a.id === CA; });
  if (!audit) { toast('Audit introuvable'); return; }
  var d = getAudData(CA);

  // Récupérer la liste de tous les participants (TO + CC) — vont dans toutes les réunions
  var participants = _kbGetParticipants();
  if (!participants.to.length && !participants.cc.length) {
    toast('Aucun participant — ajoute au moins un contact (auto ou ad hoc)');
    return;
  }

  if (typeof createOutlookEvent !== 'function') { toast('Helper Graph indisponible'); return; }

  _kickoffBooking.busy = true;
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('📅 Création de '+manualSlots.length+' réunion(s)...');

  // Lien SharePoint du Kick-off final (mis dans le body — pas en attachment, plus fiable)
  var kickoffLink = null;
  var kickoffName = null;
  if (_kickoffBooking.options.attachKickoff) {
    var finalKO = d.attachments && d.attachments.kickoff && d.attachments.kickoff.final;
    if (finalKO && finalKO.webUrl) {
      kickoffLink = finalKO.webUrl;
      kickoffName = finalKO.fileName || 'KickOff_final.pptx';
    }
  }

  // Body bilingue EN puis FR, en typo Calibri
  var auditTitle = (audit.titre || '').replace(/</g,'&lt;');
  var organizerName = (typeof CU !== 'undefined' && CU && CU.name) ? CU.name : '';
  var organizerTitle = 'Director of Internal Audit';
  var organizerTitleFr = 'Directeur de l\'Audit Interne';
  var calibriOpen = '<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#000">';
  var calibriClose = '</div>';

  var bodyHtml = calibriOpen
    // ─── EN ───────────────────────────────────────
    + '<p>Hello,</p>'
    + '<p>I invite you to the kick-off meeting of the audit &ldquo;' + auditTitle + '&rdquo;.<br/>'
    + 'The purpose of this meeting is to present the scope, objectives, and timeline of the audit assignment.</p>';
  if (kickoffLink) {
    bodyHtml += '<p>Presentation deck (SharePoint): <a href="'+kickoffLink+'">'+kickoffName.replace(/</g,'&lt;')+'</a></p>';
  }
  bodyHtml += '<p>Kind regards,<br/>'
    + organizerName + ' &mdash; ' + organizerTitle + '</p>'
    + '<p style="color:#888;font-size:10pt">===================================================</p>'
    // ─── FR ───────────────────────────────────────
    + '<p>Bonjour,</p>'
    + '<p>Je vous invite &agrave; la r&eacute;union de Kick-off de l\'audit &laquo;&nbsp;' + auditTitle + '&nbsp;&raquo;.<br/>'
    + 'Cette r&eacute;union vise &agrave; pr&eacute;senter le p&eacute;rim&egrave;tre, les objectifs et le planning de la mission.</p>';
  if (kickoffLink) {
    bodyHtml += '<p>Support de pr&eacute;sentation (SharePoint) : <a href="'+kickoffLink+'">'+kickoffName.replace(/</g,'&lt;')+'</a></p>';
  }
  bodyHtml += '<p>Cordialement,<br/>'
    + organizerName + '<br/>'
    + organizerTitleFr + '</p>'
    + calibriClose;

  // Construire la liste des attendees (commune à toutes les réunions)
  var attendees = [];
  participants.to.forEach(function(p){ attendees.push({email: p.email, name: p.name || p.email, type:'required'}); });
  participants.cc.forEach(function(p){ attendees.push({email: p.email, name: p.name || p.email, type:'optional'}); });

  // Crée les réunions une par une
  var createdEvents = [];
  for (var k = 0; k < manualSlots.length; k++) {
    var slot = manualSlots[k];
    var subject = 'Kick-off audit — '+(audit.titre||'')+(manualSlots.length>1?' (Session '+(k+1)+'/'+manualSlots.length+')':'');

    console.log('[Kickoff Booking] Création réunion '+(k+1)+'/'+manualSlots.length+' :', {
      subject: subject,
      start: slot.startISO,
      end: slot.endISO,
      attendeesCount: attendees.length,
      addTeamsLink: _kickoffBooking.options.includeTeams,
    });

    try {
      var event = await createOutlookEvent({
        subject: subject,
        bodyHtml: bodyHtml,
        start: new Date(slot.startISO),
        end: new Date(slot.endISO),
        attendees: attendees,
        addTeamsLink: _kickoffBooking.options.includeTeams,
        // Pas d'attachment Graph (referenceAttachment cause des erreurs 400 dans certains tenants)
        // Le lien SharePoint est inclus dans le body à la place — comportement plus robuste
      });
      createdEvents.push({
        eventId: event.id,
        webLink: event.webLink,
        startISO: slot.startISO,
        endISO: slot.endISO,
        teamsUrl: event.onlineMeeting ? event.onlineMeeting.joinUrl : null,
        attendeeEmails: attendees.map(function(a){return a.email;}),
        createdAt: new Date().toISOString(),
      });
      console.log('[Kickoff Booking] ✓ Réunion créée :', event.id, '— invitations envoyées à', attendees.length, 'attendees');
    } catch (e) {
      console.error('[Kickoff Booking] Erreur création réunion '+(k+1), e);
      toast('Erreur réunion '+(k+1)+' : ' + (e.message||e));
      _kickoffBooking.busy = false;
      document.getElementById('det-content').innerHTML = renderDetContent();
      return;
    }
  }

  // Stocker les événements créés
  if (!d.attachments) d.attachments = {};
  if (!d.attachments.kickoff) d.attachments.kickoff = {};
  if (!Array.isArray(d.attachments.kickoff.outlookEvents)) d.attachments.kickoff.outlookEvents = [];
  d.attachments.kickoff.outlookEvents = d.attachments.kickoff.outlookEvents.concat(createdEvents);
  await saveAuditData(CA);

  if (typeof addHist === 'function') {
    addHist(CA, createdEvents.length+' réunion(s) Kick-off créée(s) dans Outlook');
  }

  _kickoffBooking = null; // fermer la UI
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('✓ '+createdEvents.length+' réunion(s) créée(s) — invitations envoyées');
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
// ─── État UI pour les cartes pliables par sous-processus ─────────
// Persiste pendant la session (reset au reload de l'app)
var _wcgwExpandedSPs = {};

function toggleWCGWSubProcess(spId) {
  _wcgwExpandedSPs[spId] = !_wcgwExpandedSPs[spId];
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// ════════════════════════════════════════════════════════════════════
//  Vue simplifiée Étape 4 — Contrôles par sous-processus (v65)
//  Remplace l'accordéon WCGW : on liste directement les contrôles
//  Existants/Target par sous-processus, avec WCGW en pill discret.
// ════════════════════════════════════════════════════════════════════
function renderControlsBySpSection() {
  var d = getAudData(CA);
  if (!d.wcgw) d.wcgw = {};
  var wcgwList = d.wcgw[CS] || [];
  var ctrls = (d.controls && d.controls[CS]) || [];

  // Migration auto : ids stables sur les sous-processus
  if (typeof _ensureSubProcessIds === 'function' && _ensureSubProcessIds(d)) {
    saveAuditData(CA);
  }
  var subProcs = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses))
    ? d.kickoffPrep.subProcesses : [];

  // Mapping wcgwId → wcgw (pour récupérer le label en pill)
  var wcgwById = {};
  wcgwList.forEach(function(w){ wcgwById[w.id] = w; });

  // Compteurs globaux
  var nbExisting = ctrls.filter(function(c){return c.design==='existing';}).length;
  var nbTarget = ctrls.filter(function(c){return c.design==='target';}).length;

  var html = '';

  // ── Bandeau récap ──
  html += '<div class="card" style="margin-bottom:.75rem;background:linear-gradient(135deg,#EEEDFE 0%,#F5F4FE 100%);border:.5px solid #CECBF6">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center">';
  html += '<div>';
  html += '<div style="font-size:13px;font-weight:600;color:#3C3489">🛡 Contrôles par sous-processus</div>';
  html += '<div style="font-size:10px;color:#534AB7;margin-top:2px">'+subProcs.length+' sous-processus · <strong style="color:#085041">'+nbExisting+' Existants</strong> · <strong style="color:#854F0B">'+nbTarget+' Target</strong></div>';
  html += '</div>';
  html += '<div style="font-size:10px;color:#534AB7;font-style:italic">Documente les contrôles existants et ceux à mettre en place (Target).</div>';
  html += '</div>';
  html += '</div>';

  // Si pas de sous-processus définis → message
  if (!subProcs.length) {
    html += '<div class="card" style="margin-bottom:.75rem">';
    html += '<div style="font-size:11px;color:#854F0B;background:#FAEEDA;border:.5px solid #FAC775;padding:10px 14px;border-radius:4px;text-align:center">';
    html += '⚠ Aucun sous-processus défini. Définis-les d\'abord en étape 2 (Work Program → Processus Couverts).';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // ── Liste des sous-processus avec leurs contrôles ──
  subProcs.forEach(function(sp, spIdx){
    // Récupérer les contrôles pour ce SP : on passe par les wcgw du SP
    var wcgwsForSP = wcgwList.filter(function(w){return w.subProcessId === sp.id;});
    var wcgwIdsForSP = wcgwsForSP.map(function(w){return w.id;});
    var ctrlsForSP = ctrls.filter(function(c){return wcgwIdsForSP.indexOf(c.wcgwId) >= 0;});
    var existingForSP = ctrlsForSP.filter(function(c){return c.design==='existing';});
    var targetForSP = ctrlsForSP.filter(function(c){return c.design==='target';});

    var expanded = _wcgwExpandedSPs[sp.id] !== false; // par défaut ouvert

    html += '<div class="card" style="margin-bottom:8px;padding:0;overflow:hidden">';

    // En-tête cliquable
    html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#fafafa;'+(expanded?'border-bottom:.5px solid var(--border);':'')+'cursor:pointer" onclick="toggleWCGWSubProcess(\''+_escJsArg(sp.id)+'\')">';
    html += '<span style="font-size:11px;color:var(--text-3);width:14px;text-align:center">'+(expanded?'▼':'▶')+'</span>';
    html += '<div style="flex:1;min-width:0">';
    html += '<div style="font-size:13px;font-weight:500;color:var(--text-1)">'+(spIdx+1)+'. '+(sp.name||'(sans nom)').replace(/</g,'&lt;')+'</div>';
    if (sp.description) html += '<div style="font-size:10px;color:var(--text-3);margin-top:1px">'+(''+sp.description).replace(/</g,'&lt;')+'</div>';
    html += '</div>';
    html += '<span style="font-size:10px;color:var(--text-3);background:#fff;border:.5px solid var(--border);border-radius:3px;padding:2px 6px">'+existingForSP.length+' E · '+targetForSP.length+' T</span>';
    html += '<button class="bs" style="font-size:10px;padding:3px 8px;background:#F5FBF8;color:#085041;border-color:#A6E2CD" onclick="event.stopPropagation();showAddControlForSP(\''+_escJsArg(sp.id)+'\',\'existing\')">+ Existant</button>';
    html += '<button class="bs" style="font-size:10px;padding:3px 8px;background:#FFFAF0;color:#854F0B;border-color:#FAC775" onclick="event.stopPropagation();showAddControlForSP(\''+_escJsArg(sp.id)+'\',\'target\')">+ Target</button>';
    html += '</div>';

    // Contenu (2 colonnes)
    if (expanded) {
      html += '<div style="padding:10px 12px;display:grid;grid-template-columns:1fr 1fr;gap:8px">';

      // ── Colonne EXISTANTS ──
      html += '<div>';
      html += '<div style="font-size:9px;color:#085041;text-transform:uppercase;letter-spacing:.4px;font-weight:500;margin-bottom:5px;display:flex;align-items:center;gap:4px">✓ EXISTANTS ('+existingForSP.length+')</div>';
      if (!existingForSP.length) {
        html += '<div style="font-size:10px;color:var(--text-3);font-style:italic;padding:8px;border:.5px dashed var(--border);border-radius:3px;text-align:center">Aucun contrôle existant.</div>';
      } else {
        existingForSP.forEach(function(c, ci){
          html += renderControlMiniCard(c, ctrls.indexOf(c), wcgwById);
        });
      }
      html += '</div>';

      // ── Colonne TARGET ──
      html += '<div>';
      html += '<div style="font-size:9px;color:#854F0B;text-transform:uppercase;letter-spacing:.4px;font-weight:500;margin-bottom:5px;display:flex;align-items:center;gap:4px">⚑ TARGET ('+targetForSP.length+')</div>';
      if (!targetForSP.length) {
        html += '<div style="font-size:10px;color:var(--text-3);font-style:italic;padding:8px;border:.5px dashed var(--border);border-radius:3px;text-align:center">Aucun contrôle target.</div>';
      } else {
        targetForSP.forEach(function(c, ci){
          html += renderControlMiniCard(c, ctrls.indexOf(c), wcgwById);
        });
      }
      html += '</div>';

      html += '</div>'; // end grid
    }

    html += '</div>'; // end card
  });

  return html;
}

// Mini-carte d'un contrôle pour la vue simplifiée
function renderControlMiniCard(c, globalIdx, wcgwById) {
  var isExisting = c.design === 'existing';
  var bg = isExisting ? '#F5FBF8' : '#FFFAF0';
  var border = isExisting ? '#A6E2CD' : '#FAC775';
  var codeColor = isExisting ? '#5DCAA5' : '#F59E0B';
  var code = c.code || ('CTRL-'+(globalIdx+1));
  var name = (c.name || c.label || '(sans nom)').replace(/</g,'&lt;');
  var wcgw = c.wcgwId ? wcgwById[c.wcgwId] : null;

  var h = '<div style="background:'+bg+';border:.5px solid '+border+';border-radius:3px;padding:6px 8px;margin-bottom:4px;display:flex;align-items:flex-start;gap:5px;font-size:10px">';
  h += '<span style="font-weight:600;font-size:9px;flex-shrink:0;padding:1px 6px;border-radius:2px;background:'+codeColor+';color:#fff">'+code.replace(/</g,'&lt;')+'</span>';
  h += '<div style="flex:1;min-width:0;line-height:1.4">';
  h += '<div style="color:var(--text-1);font-weight:500">'+name+'</div>';
  if (wcgw && wcgw.title) {
    h += '<div style="font-size:9px;color:#3C3489;font-style:italic;margin-top:2px;background:#EEEDFE;padding:1px 5px;border-radius:2px;display:inline-block">WCGW : '+(''+wcgw.title).replace(/</g,'&lt;')+'</div>';
  }
  if (c.description) {
    h += '<div style="font-size:9px;color:var(--text-3);margin-top:2px">'+(''+c.description).replace(/</g,'&lt;')+'</div>';
  }
  h += '</div>';
  h += '<div style="display:flex;gap:3px;flex-shrink:0">';
  h += '<button class="bs" style="font-size:10px;padding:1px 5px" onclick="showEditControlModal('+globalIdx+')" title="Éditer">✎</button>';
  h += '<button class="bd" style="font-size:10px;padding:1px 5px" onclick="removeControl('+globalIdx+')" title="Supprimer">×</button>';
  h += '</div>';
  h += '</div>';
  return h;
}

// Ouvrir la modale d'ajout de contrôle pour un SP donné
// On crée un WCGW "implicite" par SP au besoin (1 par SP) — invisible pour l'utilisateur
async function showAddControlForSP(spId, designMode) {
  var d = getAudData(CA);
  if (!d.wcgw) d.wcgw = {};
  if (!Array.isArray(d.wcgw[CS])) d.wcgw[CS] = [];
  // Chercher un WCGW existant pour ce SP, sinon en créer un implicite
  var wcgwsForSP = d.wcgw[CS].filter(function(w){return w.subProcessId === spId;});
  var wcgwId;
  if (wcgwsForSP.length > 0) {
    wcgwId = wcgwsForSP[0].id;
  } else {
    var sp = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses))
      ? d.kickoffPrep.subProcesses.find(function(x){return x.id===spId;}) : null;
    var spName = sp ? (sp.name||'sous-processus') : 'sous-processus';
    var newWcgw = {
      id: 'w_' + Date.now() + '_' + Math.floor(Math.random()*100000),
      code: 'WCGW-' + (d.wcgw[CS].length+1),
      title: 'Contrôles pour ' + spName,
      description: '',
      subProcessId: spId,
      riskIds: [],
    };
    d.wcgw[CS].push(newWcgw);
    wcgwId = newWcgw.id;
    await saveAuditData(CA);
  }
  // Ouvrir la modale standard avec preset
  showControlModal({
    ctrl: {wcgwId: wcgwId, design: designMode || 'existing'},
    isPreset: true
  });
}

function renderWCGWSection() {
  var d = getAudData(CA);
  if (!d.wcgw) d.wcgw = {};
  var wcgwList = d.wcgw[CS] || [];
  var ctrls = (d.controls && d.controls[CS]) || [];

  // Migration auto : s'assurer que les sous-processus ont tous un id stable
  if (typeof _ensureSubProcessIds === 'function' && _ensureSubProcessIds(d)) {
    saveAuditData(CA); // best-effort, async
  }
  var subProcs = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses))
    ? d.kickoffPrep.subProcesses : [];

  // Header global
  var html = '<div class="card" style="margin-bottom:.75rem">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--text-2)">WCGW & Contrôles <span style="font-size:10px;font-weight:400;color:var(--text-3)">('+subProcs.length+' sous-processus · '+wcgwList.length+' WCGW · '+ctrls.length+' contrôles)</span></div>';
  html += '<div style="display:flex;gap:6px">';
  html += '<button class="bs" style="font-size:11px;padding:3px 9px;background:#E1F5EE;color:#085041;border-color:#5DCAA5" onclick="openControlLibraryPicker(CA)">📚 Importer depuis la bibliothèque</button>';
  html += '</div>';
  html += '</div>';
  html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:12px;font-style:italic">Pour chaque sous-processus défini en étape Work Program, identifie les WCGW (scénarios à risque). Pour chaque WCGW, lui rattache des contrôles Target (à mettre en place — Design Issues) et/ou des contrôles Existants (à tester en étape Testings).</div>';

  if (!subProcs.length) {
    html += '<div style="font-size:11px;color:#854F0B;font-style:italic;padding:10px;text-align:center;background:#FAEEDA;border:.5px solid #FAC775;border-radius:4px">';
    html += 'Aucun sous-processus défini. Retourne à l\'étape Work Program pour en ajouter avant de définir les WCGW.';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // Une carte pliable par sous-processus
  subProcs.forEach(function(sp, spIdx) {
    var spName = sp.name || '(sous-processus sans nom)';
    var spDesc = sp.description || '';
    var wcgwsForSP = wcgwList.filter(function(w){return w.subProcessId === sp.id;});
    var ctrlsForSP = wcgwsForSP.reduce(function(acc, w) {
      return acc + ctrls.filter(function(c){return c.wcgwId === w.id;}).length;
    }, 0);
    var expanded = _wcgwExpandedSPs[sp.id] !== false; // déplié par défaut

    html += '<div style="border:.5px solid var(--border);border-radius:6px;margin-bottom:10px;background:#fff;overflow:hidden">';

    // En-tête cliquable de la carte sous-processus
    html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#fafafa;border-bottom:'+(expanded?'.5px solid var(--border)':'none')+';cursor:pointer" onclick="toggleWCGWSubProcess(\''+_escJsArg(sp.id)+'\')">';
    html += '<span style="font-size:11px;color:var(--text-3);width:14px;text-align:center">'+(expanded?'▼':'▶')+'</span>';
    html += '<div style="flex:1;min-width:0">';
    html += '<div style="font-size:13px;font-weight:500;color:var(--text-1)">'+(''+spName).replace(/</g,'&lt;')+'</div>';
    if (spDesc) html += '<div style="font-size:10px;color:var(--text-3);margin-top:1px">'+(''+spDesc).replace(/</g,'&lt;')+'</div>';
    html += '</div>';
    html += '<span style="font-size:10px;color:var(--text-3);background:#fff;border:.5px solid var(--border);border-radius:3px;padding:2px 6px">'+wcgwsForSP.length+' WCGW · '+ctrlsForSP+' contrôles</span>';
    html += '<button class="bs" style="font-size:10px;padding:3px 8px" onclick="event.stopPropagation();showAddWCGWModalForSP(\''+_escJsArg(sp.id)+'\')">+ WCGW</button>';
    html += '</div>';

    // Contenu de la carte (WCGW)
    if (expanded) {
      if (!wcgwsForSP.length) {
        html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:14px;text-align:center">Aucun WCGW pour ce sous-processus. Cliquez sur « + WCGW » dans l\'en-tête pour en ajouter un.</div>';
      } else {
        html += '<div style="padding:10px 12px">';
        wcgwsForSP.forEach(function(w) {
          // Index global du WCGW dans wcgwList (pour les actions edit/remove existantes)
          var globalIdx = wcgwList.indexOf(w);
          html += renderWCGWCardForSP(w, globalIdx, ctrls, d);
        });
        html += '</div>';
      }
    }

    html += '</div>'; // fin carte sous-processus
  });

  // Section "WCGW non rattachés" (legacy : audits anciens créés avant la nouvelle structure)
  var orphanWcgws = wcgwList.filter(function(w){return !w.subProcessId;});
  if (orphanWcgws.length) {
    html += '<div style="margin-top:14px;padding:10px 12px;background:#FFF7ED;border:.5px solid #FED7AA;border-radius:4px">';
    html += '<div style="font-size:11px;font-weight:500;color:#854F0B;margin-bottom:5px">⚠ '+orphanWcgws.length+' WCGW non rattaché'+(orphanWcgws.length>1?'s':'')+' à un sous-processus</div>';
    html += '<div style="font-size:10px;color:#854F0B;margin-bottom:8px;font-style:italic">Ces WCGW ont été créés avant la refonte. Édite-les pour les rattacher à un sous-processus.</div>';
    orphanWcgws.forEach(function(w) {
      var globalIdx = wcgwList.indexOf(w);
      html += '<div style="background:#fff;border:.5px solid #FED7AA;border-radius:4px;padding:6px 8px;margin-bottom:4px;display:flex;align-items:center;gap:6px">';
      html += '<span class="badge bpl" style="font-size:9px;padding:2px 6px;flex-shrink:0">'+(w.code||('WCGW-'+(globalIdx+1)))+'</span>';
      html += '<span style="flex:1;font-size:11px">'+(w.title||'(sans titre)').replace(/</g,'&lt;')+'</span>';
      html += '<button class="bs" style="font-size:10px;padding:1px 6px" onclick="showEditWCGWModal('+globalIdx+')">Rattacher</button>';
      html += '<button class="bd" style="font-size:10px;padding:1px 5px" onclick="removeWCGW('+globalIdx+')">×</button>';
      html += '</div>';
    });
    html += '</div>';
  }

  // Section "Contrôles non rattachés" pour les anciens audits
  var orphanCtrls = ctrls.filter(function(c){return !c.wcgwId;});
  if (orphanCtrls.length) {
    html += '<div style="margin-top:14px;padding:10px 12px;background:#FFF7ED;border:.5px solid #FED7AA;border-radius:4px">';
    html += '<div style="font-size:11px;font-weight:500;color:#854F0B;margin-bottom:5px">⚠ '+orphanCtrls.length+' contrôle'+(orphanCtrls.length>1?'s':'')+' non rattaché'+(orphanCtrls.length>1?'s':'')+' à un WCGW</div>';
    orphanCtrls.forEach(function(c){
      var origIdx = ctrls.indexOf(c);
      var ctrlCode = c.code || ('CTRL-'+(origIdx+1));
      html += '<div style="background:#fff;border:.5px solid #FED7AA;border-radius:4px;padding:6px 8px;margin-bottom:4px;display:flex;align-items:center;gap:6px">';
      html += '<span style="color:var(--text-3);font-size:10px;flex-shrink:0">'+ctrlCode+'</span>';
      html += '<span style="flex:1;font-size:11px">'+(c.name||c.label||'(sans nom)').replace(/</g,'&lt;')+'</span>';
      html += '<button class="bs" style="font-size:10px;padding:1px 6px" onclick="showEditControlModal('+origIdx+')">Rattacher</button>';
      html += '<button class="bd" style="font-size:10px;padding:1px 4px" onclick="removeControlAt('+origIdx+')">×</button>';
      html += '</div>';
    });
    html += '</div>';
  }

  html += '</div>'; // fin card globale
  return html;
}

// ─── Carte d'un WCGW dans une cellule sous-processus ─────────────
function renderWCGWCardForSP(w, globalIdx, ctrls, d) {
  // Risques liés
  var linkedRisks = (w.riskIds||[]).map(function(rid){
    var r = (RISK_UNIVERSE||[]).find(function(x){return x.id===rid;});
    if (r) return {title: r.title, source: 'urd'};
    var ar = (d.auditRisks||[]).find(function(x){return x.id===rid;});
    if (ar) return {title: ar.label || ar.title || '—', source: 'adhoc'};
    return null;
  }).filter(Boolean);

  // Contrôles rattachés à ce WCGW, séparés par design
  var wcgwCtrls = ctrls.filter(function(c){return c.wcgwId === w.id;});
  var targets = wcgwCtrls.filter(function(c){return c.design === 'target';});
  var existings = wcgwCtrls.filter(function(c){return c.design === 'existing';});

  var h = '<div style="border:.5px solid var(--border);border-radius:5px;padding:10px;margin-bottom:8px;background:#fff">';

  // En-tête WCGW
  h += '<div style="display:flex;align-items:flex-start;gap:8px;padding-bottom:8px;border-bottom:.5px solid #f0f0f0;margin-bottom:8px">';
  h += '<span class="badge bpl" style="font-size:9px;padding:2px 6px;flex-shrink:0">'+(w.code||('WCGW-'+(globalIdx+1)))+'</span>';
  h += '<div style="flex:1;min-width:0">';
  h += '<div style="font-size:12px;font-weight:500">'+(''+(w.title||'(sans titre)')).replace(/</g,'&lt;')+'</div>';
  if (w.description) h += '<div style="font-size:10px;color:var(--text-3);margin-top:2px">'+(''+w.description).replace(/</g,'&lt;')+'</div>';
  h += '</div>';
  h += '<button class="bs" style="font-size:9px;padding:2px 6px" onclick="showEditWCGWModal('+globalIdx+')">Éditer</button>';
  h += '<button class="bd" style="font-size:9px;padding:2px 6px" onclick="removeWCGW('+globalIdx+')" title="Supprimer">×</button>';
  h += '</div>';

  // Risques liés
  if (linkedRisks.length) {
    h += '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;font-size:10px;padding:0 0 8px">';
    h += '<span style="color:var(--text-3)"><strong style="font-weight:500">Risques liés :</strong></span>';
    linkedRisks.forEach(function(lr){
      h += '<span class="badge '+(lr.source==='adhoc'?'bpc':'bpl')+'" style="font-size:9px;padding:1px 6px">'+(''+lr.title).replace(/</g,'&lt;')+'</span>';
    });
    h += '</div>';
  }

  // 2 colonnes Target / Existants
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';

  // Colonne Target
  h += '<div style="background:#FFFAF0;border:.5px solid #FAC775;border-radius:4px;padding:6px 8px">';
  h += '<div style="font-size:9px;font-weight:500;color:#854F0B;text-transform:uppercase;letter-spacing:.4px;padding-bottom:4px;display:flex;align-items:center;gap:5px">';
  h += '<span style="width:7px;height:7px;border-radius:50%;background:#FAC775;display:inline-block"></span>';
  h += 'Target <span style="color:var(--text-3);font-weight:400;text-transform:none;letter-spacing:0">(à mettre en place)</span>';
  h += '</div>';
  if (!targets.length) {
    h += '<div style="font-size:10px;color:var(--text-3);font-style:italic;text-align:center;padding:5px 0">Aucun contrôle Target</div>';
  } else {
    targets.forEach(function(c) {
      var origIdx = ctrls.indexOf(c);
      h += renderWCGWControlRow(c, origIdx);
    });
  }
  h += '<button class="bs" style="font-size:10px;padding:2px 7px;background:transparent;border:.5px dashed var(--border);color:var(--text-2);width:100%;margin-top:4px" onclick="showAddControlForWCGW(\''+_escJsArg(w.id)+'\',\'target\')">+ Contrôle Target</button>';
  h += '</div>';

  // Colonne Existants
  h += '<div style="background:#F5FBF8;border:.5px solid #A6E2CD;border-radius:4px;padding:6px 8px">';
  h += '<div style="font-size:9px;font-weight:500;color:#085041;text-transform:uppercase;letter-spacing:.4px;padding-bottom:4px;display:flex;align-items:center;gap:5px">';
  h += '<span style="width:7px;height:7px;border-radius:50%;background:#5DCAA5;display:inline-block"></span>';
  h += 'Existants <span style="color:var(--text-3);font-weight:400;text-transform:none;letter-spacing:0">(à tester en Testings)</span>';
  h += '</div>';
  if (!existings.length) {
    h += '<div style="font-size:10px;color:var(--text-3);font-style:italic;text-align:center;padding:5px 0">Aucun contrôle Existant</div>';
  } else {
    existings.forEach(function(c) {
      var origIdx = ctrls.indexOf(c);
      h += renderWCGWControlRow(c, origIdx);
    });
  }
  h += '<button class="bs" style="font-size:10px;padding:2px 7px;background:transparent;border:.5px dashed var(--border);color:var(--text-2);width:100%;margin-top:4px" onclick="showAddControlForWCGW(\''+_escJsArg(w.id)+'\',\'existing\')">+ Contrôle Existant</button>';
  h += '</div>';

  h += '</div>'; // fin grid 2 colonnes

  h += '</div>'; // fin carte WCGW
  return h;
}

// ─── Ligne d'un contrôle dans une colonne Target ou Existants ───
function renderWCGWControlRow(c, origIdx) {
  var ctrlCode = c.code || ('CTRL-'+(origIdx+1));
  var name = c.name || c.label || '(sans nom)';
  var clefBadge = c.clef ? '<span style="display:inline-block;background:#EEEDFE;color:#3C3489;font-size:9px;padding:1px 4px;border-radius:2px;margin-left:4px">Clef</span>' : '';
  var h = '<div style="display:flex;align-items:flex-start;gap:5px;padding:4px 0;border-bottom:.5px solid rgba(0,0,0,.06);font-size:11px;cursor:pointer" onclick="showEditControlModal('+origIdx+')">';
  h += '<span style="font-family:monospace;font-size:9px;background:#fff;color:var(--text-3);padding:1px 5px;border-radius:2px;flex-shrink:0;border:.5px solid var(--border);margin-top:1px">'+ctrlCode+'</span>';
  h += '<div style="flex:1;color:var(--text-1)">'+(''+name).replace(/</g,'&lt;')+clefBadge+'</div>';
  h += '<button onclick="event.stopPropagation();removeControlAt('+origIdx+')" title="Supprimer" style="background:transparent;border:none;color:var(--text-3);font-size:11px;padding:0 2px;cursor:pointer">×</button>';
  h += '</div>';
  return h;
}

// ─── Ouverture modale "+ WCGW" pré-remplie avec sous-processus ───
function showAddWCGWModalForSP(spId) {
  showWCGWModal({preselectSpId: spId});
}

// ─── Ouverture modale "+ Contrôle" pré-remplie avec WCGW + design ─
function showAddControlForWCGW(wcgwId, designMode) {
  // showControlModal attend un objet existing avec ctrl.wcgwId + ctrl.design
  // isPreset : flag indiquant qu'on pré-sélectionne pour un WCGW (pas une édition)
  showControlModal({
    ctrl: {wcgwId: wcgwId, design: designMode || 'existing'},
    isPreset: true
  });
}

// ════════════════════════════════════════════════════════════════════
//  ÉDITEUR FLOWCHART (v59 — MVP : palette, drag, propriétés, save)
// ════════════════════════════════════════════════════════════════════

// État éphémère de l'éditeur. Structure :
//   {
//     fcId: 'fc_xxx',                  // flowchart actuellement affiché
//     selectedNodeId: 'n_xxx' | null,
//     dragging: {nodeId, offsetX, offsetY, moved} | null,
//     edgeMode: false,                 // mode "création de lien" actif
//     edgeFromId: 'n_xxx' | null,      // 1er nœud cliqué pendant edgeMode
//     sidePanelTab: 'narrative' | 'wcgw',
//     zoom: 1.0,
//   }
// Initialisé automatiquement par _fcEnsureState() à l'ouverture de l'étape 4.
var _flowchartEditor = null;

// v67 : mode maximisé pour l'éditeur flowchart (cache header + sidebar AuditFlow)
var _flowchartMaximized = false;

// Largeurs/tailles par défaut des formes
var _FC_DEFAULTS = {
  start:    {w: 110, h: 36, label: 'Début'},
  end:      {w: 110, h: 36, label: 'Fin'},
  step:     {w: 130, h: 40, label: 'Nouvelle étape'},
  decision: {w: 100, h: 70, label: 'Condition ?'},
  meeting:  {w: 80, h: 80, label: 'Meeting'},
  document: {w: 130, h: 56, label: 'Document'},
  database: {w: 110, h: 50, label: 'Système'},
  wcgw:     {w: 90, h: 65, label: 'WCGW'}, // v68 : nouveau type WCGW (losange rouge)
  ctrl_existing: {w: 60, h: 60, label: 'CTRL'},
  ctrl_target:   {w: 60, h: 60, label: 'CTRL-T'},
};

// ─── Splash (vue quand 0 flowchart pour cet audit) ──────────────
function renderFlowchartSplash() {
  var d = getAudData(CA);
  var sps = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) ? d.kickoffPrep.subProcesses : [];
  var wcgwList = (d.wcgw && d.wcgw[4]) || [];
  var ctrls = (d.controls && d.controls[4]) || [];

  var html = '<div class="card" style="margin-bottom:.75rem;background:linear-gradient(135deg,#EEEDFE 0%,#F5F4FE 100%);border:.5px solid #CECBF6">';
  html += '<div style="text-align:center;padding:24px 16px">';
  html += '<div style="font-size:42px">📊</div>';
  html += '<div style="font-size:16px;font-weight:600;color:#3C3489;margin-top:8px">Flowcharts</div>';
  html += '<div style="font-size:12px;color:#534AB7;margin-top:6px;max-width:540px;margin-left:auto;margin-right:auto;line-height:1.5">';
  html += 'Documentez les processus audités via des flowcharts visuels. Liez les WCGW et les contrôles existants/target aux étapes du processus, attachez le narratif descriptif (texte ou fichier).';
  html += '</div>';
  html += '<div style="margin-top:18px">';
  if (!sps.length) {
    html += '<div style="font-size:11px;color:#854F0B;background:#FAEEDA;border:.5px solid #FAC775;border-radius:4px;padding:8px 12px;display:inline-block">⚠ Définis d\'abord les sous-processus en étape 2 (Work Program)</div>';
  } else {
    html += '<button class="bp" style="font-size:13px;padding:9px 22px;background:#3C3489;color:#fff;font-weight:500" onclick="showCreateFlowchartModal()">📊 Créer le 1er flowchart</button>';
  }
  html += '</div>';
  html += '</div>';
  html += '</div>';

  // Section Contrôles classique en complément (l'utilisateur peut quand même y accéder)
  html += '<div style="margin-top:14px">';
  html += '<details style="background:#fff;border:.5px solid var(--border);border-radius:6px">';
  html += '<summary style="padding:10px 14px;cursor:pointer;font-size:12px;font-weight:500;color:var(--text-2)">🛡 Définir les Contrôles directement (vue simplifiée) <span style="font-size:10px;font-weight:400;color:var(--text-3)">— '+ctrls.length+' contrôles</span></summary>';
  html += '<div style="padding:10px;border-top:.5px solid var(--border)">';
  html += renderControlsBySpSection();
  html += '</div>';
  html += '</details>';
  html += '</div>';

  return html;
}


// ─── Init / sélection automatique d'un flowchart ─────────────────
function _fcEnsureState() {
  var d = getAudData(CA);
  // Migration de sécurité : si flowcharts est dans d.attachments.flowcharts mais pas à la racine,
  // on les remonte. (Au cas où getAudData retourne un objet qui n'a pas été passé par loadAuditData.)
  if (!Array.isArray(d.flowcharts) && d.attachments && Array.isArray(d.attachments.flowcharts)) {
    d.flowcharts = d.attachments.flowcharts;
  }
  if (!Array.isArray(d.flowcharts)) d.flowcharts = [];
  if (d.flowcharts.length === 0) {
    // Pas de flowchart : on n'initialise pas l'éditeur (la vue affiche le splash)
    _flowchartEditor = null;
    return null;
  }
  if (!_flowchartEditor) {
    _flowchartEditor = {
      fcId: d.flowcharts[0].id,
      selectedNodeId: null,
      dragging: null,
      edgeMode: false,
      edgeFromId: null,
      edgeStyle: 'orthogonal', // style par défaut des nouveaux connecteurs
      sidePanelTab: 'narrative',
      sidePanelOpen: true, // Narratif ouvert par défaut
      highlightedControlId: null, // Contrôle highlight (cliqué dans flowchart ou bottom)
      maximized: false, // v67 : mode maximisé (cache header/sidebar AuditFlow)
      zoom: 1.0,
    };
  } else {
    // Vérifier que le flowchart existe toujours
    var stillExists = d.flowcharts.some(function(fc){return fc.id === _flowchartEditor.fcId;});
    if (!stillExists) {
      _flowchartEditor.fcId = d.flowcharts[0].id;
      _flowchartEditor.selectedNodeId = null;
    }
  }
  return _flowchartEditor;
}

function switchFlowchart(fcId) {
  if (!_flowchartEditor) _fcEnsureState();
  _flowchartEditor.fcId = fcId;
  _flowchartEditor.selectedNodeId = null;
  _flowchartEditor.edgeMode = false;
  _flowchartEditor.edgeFromId = null;
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// Naviguer ← / → entre flowcharts
function navigateFlowchart(direction) {
  var d = getAudData(CA);
  if (!Array.isArray(d.flowcharts) || d.flowcharts.length === 0) return;
  if (!_flowchartEditor) return;
  var idx = d.flowcharts.findIndex(function(fc){return fc.id === _flowchartEditor.fcId;});
  if (idx < 0) idx = 0;
  var newIdx = idx + (direction === 'next' ? 1 : -1);
  if (newIdx < 0) newIdx = d.flowcharts.length - 1;
  if (newIdx >= d.flowcharts.length) newIdx = 0;
  switchFlowchart(d.flowcharts[newIdx].id);
}

// ─── Création de flowchart ──────────────────────────────────────
async function createFlowchartForSP(spId) {
  var d = getAudData(CA);
  if (!Array.isArray(d.flowcharts)) d.flowcharts = [];
  var sp = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses))
    ? d.kickoffPrep.subProcesses.find(function(x){return x.id===spId;}) : null;
  var defaultLabel = sp ? (sp.name || 'Flowchart') : 'Flowchart';
  // Si on a déjà un flowchart pour ce SP, suffixer pour distinguer
  var existingForSP = d.flowcharts.filter(function(fc){return fc.subProcessId === spId;});
  if (existingForSP.length > 0) {
    defaultLabel += ' #' + (existingForSP.length + 1);
  }
  var fc = {
    id: 'fc_' + Date.now() + '_' + Math.floor(Math.random()*100000),
    label: defaultLabel,
    subProcessId: spId,
    nodes: [],
    edges: [],
    narrative: '',
    narrativeFile: null, // {webUrl, fileName, uploadedAt}
    createdAt: new Date().toISOString(),
  };
  d.flowcharts.push(fc);
  await saveAuditData(CA);
  if (typeof addHist === 'function') addHist(CA, 'Flowchart créé : ' + defaultLabel);
  switchFlowchart(fc.id);
}

// Ouvrir une modale de choix de SP pour créer un flowchart libre
function showCreateFlowchartModal() {
  var d = getAudData(CA);
  var sps = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses))
    ? d.kickoffPrep.subProcesses : [];
  if (!sps.length) {
    toast('Aucun sous-processus défini. Crée d\'abord les sous-processus en étape 2 (Work Program).');
    return;
  }
  var spOptions = sps.map(function(sp){
    return '<option value="'+sp.id+'">'+(''+(sp.name||'(sans nom)')).replace(/"/g,'&quot;')+'</option>';
  }).join('');
  var body = '<div><label>Sous-processus <span style="color:var(--red)">*</span></label>';
  body += '<select id="newfc-sp">'+spOptions+'</select></div>';
  body += '<div><label>Titre du flowchart (facultatif)</label>';
  body += '<input id="newfc-label" placeholder="ex : Workflow d\'octroi"/></div>';
  openModal('Nouveau flowchart', body, async function(){
    var spId = document.getElementById('newfc-sp').value;
    var customLabel = document.getElementById('newfc-label').value.trim();
    if (!spId) { toast('Sous-processus obligatoire'); return; }
    var d2 = getAudData(CA);
    if (!Array.isArray(d2.flowcharts)) d2.flowcharts = [];
    var sp = sps.find(function(x){return x.id===spId;});
    var spName = sp ? (sp.name || 'Flowchart') : 'Flowchart';
    var label = customLabel || spName;
    var existingForSP = d2.flowcharts.filter(function(fc){return fc.subProcessId === spId;});
    if (!customLabel && existingForSP.length > 0) {
      label += ' #' + (existingForSP.length + 1);
    }
    var fc = {
      id: 'fc_' + Date.now() + '_' + Math.floor(Math.random()*100000),
      label: label,
      subProcessId: spId,
      nodes: [],
      edges: [],
      narrative: '',
      narrativeFile: null,
      createdAt: new Date().toISOString(),
    };
    d2.flowcharts.push(fc);
    await saveAuditData(CA);
    if (typeof addHist === 'function') addHist(CA, 'Flowchart créé : ' + label);
    switchFlowchart(fc.id);
  });
}

async function deleteFlowchart(fcId) {
  if (!confirm('Supprimer ce flowchart ? Cette action est irréversible.')) return;
  var d = getAudData(CA);
  if (!Array.isArray(d.flowcharts)) return;
  var idx = d.flowcharts.findIndex(function(x){return x.id===fcId;});
  if (idx < 0) return;
  var label = d.flowcharts[idx].label;
  d.flowcharts.splice(idx, 1);
  // Si on supprime le flowchart actuellement affiché, basculer
  if (_flowchartEditor && _flowchartEditor.fcId === fcId) {
    if (d.flowcharts.length > 0) {
      _flowchartEditor.fcId = d.flowcharts[0].id;
      _flowchartEditor.selectedNodeId = null;
    } else {
      _flowchartEditor = null;
    }
  }
  await saveAuditData(CA);
  if (typeof addHist === 'function') addHist(CA, 'Flowchart supprimé : ' + label);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Flowchart supprimé');
}

// ─── Helpers d'accès au flowchart courant ───────────────────────
function _fcGetCurrent() {
  if (!_flowchartEditor) return null;
  var d = getAudData(CA);
  return (d.flowcharts || []).find(function(x){return x.id===_flowchartEditor.fcId;});
}

function _fcGetSelectedNode() {
  var fc = _fcGetCurrent();
  if (!fc || !_flowchartEditor.selectedNodeId) return null;
  return fc.nodes.find(function(n){return n.id===_flowchartEditor.selectedNodeId;});
}

// ─── Rendu de l'éditeur ────────────────────────────────────────
function renderFlowchartEditor() {
  if (!_flowchartEditor) return '';
  var fc = _fcGetCurrent();
  if (!fc) return '';
  var d = getAudData(CA);
  var allCtrls = (d.controls && d.controls[4]) || [];
  var allFcs = Array.isArray(d.flowcharts) ? d.flowcharts : [];
  var sps = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) ? d.kickoffPrep.subProcesses : [];
  var currentSp = sps.find(function(sp){return sp.id === fc.subProcessId;});

  var html = '<div style="background:#fff;border:.5px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:10px">';

  // ─── TOP BAR : navigation + actions ────────────────────────────
  html += '<div style="background:#3C3489;color:#fff;padding:8px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
  html += '<div style="display:flex;align-items:center;gap:8px;flex:0 0 auto">';
  html += '<span style="font-size:14px">📊</span>';
  html += '<span style="font-size:12px;font-weight:500">Flowcharts</span>';
  html += '</div>';

  // Onglets de flowcharts (navigation)
  html += '<div style="flex:1;display:flex;gap:2px;align-items:center;overflow-x:auto;padding:0 8px;min-width:0">';
  if (allFcs.length > 1) {
    html += '<button onclick="navigateFlowchart(\'prev\')" title="Flowchart précédent" style="background:rgba(255,255,255,.1);border:.5px solid rgba(255,255,255,.3);color:#fff;width:22px;height:22px;border-radius:3px;cursor:pointer;font-size:12px;flex-shrink:0;padding:0">‹</button>';
  }
  allFcs.forEach(function(f){
    var isActive = f.id === _flowchartEditor.fcId;
    var sp = sps.find(function(s){return s.id === f.subProcessId;});
    var spName = sp ? (sp.name || '') : '';
    var label = f.label || '(sans titre)';
    // Format compact : si label fait ref au SP, on n'affiche que label, sinon "label (SP)"
    var displayLabel = label;
    if (spName && label.toLowerCase().indexOf(spName.toLowerCase()) < 0) {
      displayLabel = label + ' · ' + spName;
    }
    var bg = isActive ? '#fff' : 'rgba(255,255,255,.1)';
    var color = isActive ? '#3C3489' : 'rgba(255,255,255,.85)';
    var weight = isActive ? '500' : '400';
    html += '<span onclick="switchFlowchart(\''+_escJsArg(f.id)+'\')" style="font-size:11px;padding:5px 11px;background:'+bg+';color:'+color+';border-radius:3px;cursor:pointer;flex-shrink:0;font-weight:'+weight+'">';
    html += (''+displayLabel).replace(/</g,'&lt;')
      + ' <span style="font-size:9px;opacity:.7">('+(f.nodes||[]).length+')</span>';
    html += '</span>';
  });
  if (allFcs.length > 1) {
    html += '<button onclick="navigateFlowchart(\'next\')" title="Flowchart suivant" style="background:rgba(255,255,255,.1);border:.5px solid rgba(255,255,255,.3);color:#fff;width:22px;height:22px;border-radius:3px;cursor:pointer;font-size:12px;flex-shrink:0;padding:0">›</button>';
  }
  html += '<button onclick="showCreateFlowchartModal()" title="Nouveau flowchart" style="font-size:11px;padding:5px 9px;background:transparent;color:rgba(255,255,255,.85);border:.5px dashed rgba(255,255,255,.4);border-radius:3px;cursor:pointer;flex-shrink:0">+ Flowchart</button>';
  html += '</div>';

  html += '<div style="display:flex;gap:6px;flex-shrink:0">';
  // Bouton toggle panneau Narratif (v66)
  var sideOpen = !!_flowchartEditor.sidePanelOpen;
  var sideLabel = sideOpen ? '📑 Narratif ▶' : '📑 Narratif ◀';
  html += '<button onclick="toggleFcSidePanel()" title="'+(sideOpen?'Fermer':'Ouvrir')+' le panneau Narratif" style="font-size:11px;padding:5px 10px;background:'+(sideOpen?'rgba(255,255,255,.2)':'transparent')+';color:#fff;border:.5px solid rgba(255,255,255,.4);border-radius:3px;cursor:pointer">'+sideLabel+'</button>';
  // Bouton toggle Maximiser (v67)
  var maximized = (typeof _flowchartMaximized !== 'undefined' && _flowchartMaximized);
  var maxIcon = maximized ? '↙' : '⛶';
  var maxLabel = maximized ? 'Restaurer' : 'Maximiser';
  html += '<button onclick="toggleFcMaximized()" title="'+(maximized?'Restaurer la vue normale (avec sidebar AuditFlow)':'Maximiser le flowchart (cache la sidebar AuditFlow)')+'" style="font-size:11px;padding:5px 10px;background:'+(maximized?'rgba(255,255,255,.2)':'transparent')+';color:#fff;border:.5px solid rgba(255,255,255,.4);border-radius:3px;cursor:pointer">'+maxIcon+' '+maxLabel+'</button>';
  html += '<button onclick="deleteFlowchart(\''+_escJsArg(fc.id)+'\')" title="Supprimer ce flowchart" style="font-size:11px;padding:5px 10px;background:transparent;color:rgba(255,255,255,.85);border:.5px solid rgba(255,255,255,.4);border-radius:3px;cursor:pointer">🗑 Supprimer</button>';
  html += '</div>';
  html += '</div>';

  // ─── v68 : Bandeau d'alerte (orphelins + non-couverts) ──────────
  var fcVal = _fcAnalyzeWcgwCoverage(fc);
  var nbOrphan = fcVal.orphanCtrlNodeIds.length;
  var nbUncovered = fcVal.uncoveredWcgwNodeIds.length;
  if (nbOrphan + nbUncovered > 0) {
    html += '<div style="background:#FCEBEB;border-bottom:.5px solid #F2C2C0;color:#993C1D;padding:8px 14px;font-size:11px;display:flex;align-items:center;gap:8px">';
    html += '<span style="font-size:14px">⚠</span>';
    html += '<span><strong style="font-weight:600">'+(nbOrphan+nbUncovered)+' alerte'+(nbOrphan+nbUncovered>1?'s':'')+'</strong> · ';
    var msgs = [];
    if (nbUncovered > 0) msgs.push(nbUncovered+' WCGW non couvert'+(nbUncovered>1?'s':'')+' (ajoute un Existant ou Target lié)');
    if (nbOrphan > 0) msgs.push(nbOrphan+' contrôle'+(nbOrphan>1?'s':'')+' orphelin'+(nbOrphan>1?'s':'')+' (lie-le à un WCGW)');
    html += msgs.join(' · ');
    html += '</span>';
    html += '</div>';
  } else if ((fcVal.wcgwNodes.length + fcVal.ctrlNodes.length) > 0) {
    html += '<div style="background:#E1F5EE;border-bottom:.5px solid #A6E2CD;color:#085041;padding:8px 14px;font-size:11px;display:flex;align-items:center;gap:8px">';
    html += '<span style="font-size:14px">✓</span>';
    html += '<span>Tous les WCGW sont couverts et tous les contrôles sont liés</span>';
    html += '</div>';
  }

  // ─── TOOLBAR : titre éditable + actions ─────────────────────────
  html += '<div style="display:flex;gap:8px;padding:8px 14px;background:#fafafa;border-bottom:.5px solid var(--border);align-items:center;flex-wrap:wrap">';
  html += '<input id="fc-label" value="'+(''+(fc.label||'')).replace(/"/g,'&quot;')+'" placeholder="Titre du flowchart..." onchange="setFlowchartLabel(this.value)" style="font-size:12px;padding:4px 9px;border:.5px solid var(--border);border-radius:3px;width:280px;font-weight:500;box-sizing:border-box"/>';
  if (currentSp) {
    html += '<span style="font-size:10px;color:var(--text-3)">Sous-processus : <strong style="font-weight:500;color:var(--text-2)">'+(''+currentSp.name).replace(/</g,'&lt;')+'</strong></span>';
  }
  html += '<div style="width:1px;height:18px;background:var(--border);margin:0 4px"></div>';
  // Edge mode toggle
  var edgeMode = !!_flowchartEditor.edgeMode;
  var edgeBtnBg = edgeMode ? '#3C3489' : '#fff';
  var edgeBtnColor = edgeMode ? '#fff' : 'var(--text-2)';
  html += '<button onclick="toggleEdgeMode()" style="font-size:10px;padding:4px 10px;background:'+edgeBtnBg+';color:'+edgeBtnColor+';border:.5px solid '+(edgeMode?'#3C3489':'var(--border)')+';border-radius:3px;cursor:pointer;font-weight:500" title="Cliquer 2 nœuds pour les relier">';
  html += edgeMode ? '✓ Mode lien actif (cliquer 2 nœuds)' : '🔗 Créer un lien';
  html += '</button>';
  // Style des connecteurs (toggle straight ↔ orthogonal)
  var edgeStyle = _flowchartEditor.edgeStyle || 'orthogonal';
  var nextStyle = edgeStyle === 'orthogonal' ? 'straight' : 'orthogonal';
  var styleIcon = edgeStyle === 'orthogonal' ? '┐ Coudes' : '╱ Droit';
  html += '<button onclick="toggleEdgeStyle()" title="Style des nouveaux connecteurs : '+(edgeStyle==='orthogonal'?'angles droits (escalier)':'ligne droite')+' — clic pour basculer" style="font-size:10px;padding:4px 10px;background:#fff;color:var(--text-2);border:.5px solid var(--border);border-radius:3px;cursor:pointer">';
  html += styleIcon;
  html += '</button>';
  if (_flowchartEditor.selectedNodeId) {
    html += '<button class="bd" style="font-size:10px;padding:4px 10px" onclick="deleteSelectedNode()">🗑 Supprimer la forme</button>';
  }
  // v68 : bouton "Importer" si des WCGW/Contrôles non représentés
  if (fc.subProcessId) {
    var dForImport = getAudData(CA);
    var wcgwListImport = (dForImport.wcgw && dForImport.wcgw[4]) || [];
    var ctrlsImport = (dForImport.controls && dForImport.controls[4]) || [];
    var wcgwsForSPImport = wcgwListImport.filter(function(w){return w.subProcessId === fc.subProcessId;});
    var existingWcgwIds = (fc.nodes || []).filter(function(n){return n.type === 'wcgw' && n.wcgwId;}).map(function(n){return n.wcgwId;});
    var nbWcgwToImport = wcgwsForSPImport.filter(function(w){return existingWcgwIds.indexOf(w.id) < 0;}).length;
    var wcgwIdsForSPImport = wcgwsForSPImport.map(function(w){return w.id;});
    var ctrlsForSPImport = ctrlsImport.filter(function(c){return wcgwIdsForSPImport.indexOf(c.wcgwId) >= 0;});
    var existingCtrlIds = (fc.nodes || []).filter(function(n){return (n.type === 'ctrl_existing' || n.type === 'ctrl_target') && n.controlId;}).map(function(n){return n.controlId;});
    var nbCtrlToImport = ctrlsForSPImport.filter(function(c){return existingCtrlIds.indexOf(c.id) < 0;}).length;
    var totalToImport = nbWcgwToImport + nbCtrlToImport;
    if (totalToImport > 0) {
      html += '<button onclick="importExistingWcgwsAndControls()" title="Crée des losanges et cercles pour les WCGW/contrôles déjà définis dans ce sous-processus" style="font-size:10px;padding:4px 10px;background:#FFF4D9;color:#854F0B;border:.5px solid #FAC775;border-radius:3px;cursor:pointer;font-weight:500">🔄 Importer ('+totalToImport+')</button>';
    }
  }
  html += '<span style="margin-left:auto;font-size:10px;color:var(--text-3);font-style:italic">'+(fc.nodes||[]).length+' nœud(s) · '+(fc.edges||[]).length+' lien(s)</span>';
  html += '</div>';

  // ─── 3 COLONNES : palette / canvas / side panel ────────────────
  html += '<div style="display:flex;height:560px">';

  // PALETTE GAUCHE
  html += '<div style="width:150px;background:#fafafa;border-right:.5px solid var(--border);padding:10px;overflow-y:auto;box-sizing:border-box;flex-shrink:0">';
  html += _fcRenderPaletteSection('Flux', [
    {type:'start',    icon:'<span style="display:inline-block;width:18px;height:11px;background:#EEEDFE;border:1.5px solid #3C3489;border-radius:50px"></span>', label:'Début'},
    {type:'end',      icon:'<span style="display:inline-block;width:18px;height:11px;background:#EEEDFE;border:1.5px solid #3C3489;border-radius:50px"></span>', label:'Fin'},
    {type:'step',     icon:'<span style="display:inline-block;width:20px;height:13px;background:#fff;border:1.5px solid #3C3489;border-radius:2px"></span>', label:'Étape'},
    {type:'decision', icon:'<span style="display:inline-block;width:14px;height:14px;background:#FFFAF0;border:1.5px solid #FAC775;transform:rotate(45deg);margin:1px 4px"></span>', label:'Décision'},
    {type:'meeting',  icon:'<span style="display:inline-block;width:14px;height:14px;background:#FCE7F3;border:1.5px solid #BE185D;border-radius:50%;text-align:center;line-height:11px;font-size:8px">👥</span>', label:'Réunion'},
  ]);
  html += _fcRenderPaletteSection('Données', [
    {type:'document', icon:'<span style="display:inline-block;width:18px;height:15px;background:#ECFEFF;border:1.5px solid #0E7490;text-align:center;line-height:13px;font-size:9px">📄</span>', label:'Document'},
    {type:'database', icon:'<span style="display:inline-block;width:18px;height:14px;background:#F5FBF8;border:1.5px solid #5DCAA5;border-radius:50%/30%"></span>', label:'Système'},
  ]);
  // v68 : section Risques (nouveau type WCGW)
  html += _fcRenderPaletteSection('⚠ Risques', [
    {type:'wcgw', icon:'<span style="display:inline-block;width:13px;height:13px;background:#FCEBEB;border:2px solid #993C1D;transform:rotate(45deg);margin:1px 3px"></span>', label:'WCGW'},
  ]);
  html += _fcRenderPaletteSection('Contrôles', [
    {type:'ctrl_existing', icon:'<span style="display:inline-block;width:13px;height:13px;background:#E1F5EE;border:2px solid #5DCAA5;border-radius:50%"></span>', label:'Existant'},
    {type:'ctrl_target',   icon:'<span style="display:inline-block;width:13px;height:13px;background:#FFFAF0;border:2px dashed #F59E0B;border-radius:50%"></span>', label:'Target'},
  ]);
  html += '</div>';

  // CANVAS CENTRAL — rendu SVG (avec edges)
  html += '<div id="fc-canvas-wrap" style="flex:1;position:relative;background:#fff;background-image:radial-gradient(circle,#e5e5e5 1px,transparent 1px);background-size:20px 20px;overflow:auto;min-width:0">';
  if (edgeMode) {
    html += '<div style="position:absolute;top:8px;left:8px;background:#3C3489;color:#fff;font-size:10px;padding:4px 9px;border-radius:3px;z-index:10;pointer-events:none">';
    if (_flowchartEditor.edgeFromId) {
      html += '🔗 Cliquer le 2e nœud (destination) — ESC pour annuler';
    } else {
      html += '🔗 Cliquer le 1er nœud (source)';
    }
    html += '</div>';
  }
  html += '<svg id="fc-canvas" width="100%" height="100%" style="min-width:1200px;min-height:540px;display:block" onclick="if(event.target===this){_fcOnCanvasClick();}">';
  // defs pour la flèche réutilisable
  html += '<defs><marker id="fc-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#374151"/></marker></defs>';

  // Render edges en premier (pour qu'elles soient sous les nœuds)
  (fc.edges||[]).forEach(function(edge){
    html += _fcRenderEdge(edge, fc.nodes);
  });

  // v68 : calcul de validation (orphelins/non-couverts) pour halo rouge
  var fcValidation = _fcAnalyzeWcgwCoverage(fc);

  // Render nodes
  (fc.nodes||[]).forEach(function(node){
    html += _fcRenderNode(node, allCtrls, fcValidation);
  });

  html += '</svg>';

  // Indication si vide
  if ((fc.nodes||[]).length === 0) {
    html += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:12px;color:var(--text-3);font-style:italic;pointer-events:none;text-align:center;line-height:1.6">';
    html += '📊<br/>Cliquez une forme dans la palette de gauche<br/>pour l\'ajouter au flowchart.';
    html += '</div>';
  }
  html += '</div>';

  // SIDE PANEL DROITE — Narratif (fermable) ───────────────────────
  // En v66 : panneau dédié au narratif uniquement, fermable via le bouton ×.
  // Les contrôles sont maintenant en bas (renderControlsBottomBar).
  // Les propriétés du nœud sélectionné s'affichent ici quand un nœud est sélectionné.
  if (_flowchartEditor.sidePanelOpen) {
    html += '<div style="width:300px;background:#fafafa;border-left:.5px solid var(--border);display:flex;flex-direction:column;flex-shrink:0">';
    // Header avec bouton fermer
    var headerLabel, headerIcon;
    if (_flowchartEditor.selectedNodeId) {
      headerLabel = 'Propriétés du nœud';
      headerIcon = '⚙';
    } else {
      headerLabel = 'Narratif';
      headerIcon = '📝';
    }
    html += '<div style="padding:8px 12px;background:#fff;border-bottom:.5px solid var(--border);display:flex;justify-content:space-between;align-items:center">';
    html += '<div style="font-size:11px;font-weight:500;color:#3C3489;display:flex;align-items:center;gap:5px">'+headerIcon+' '+headerLabel+'</div>';
    html += '<button onclick="toggleFcSidePanel()" title="Fermer le panneau" style="background:transparent;border:.5px solid var(--border);color:var(--text-2);width:22px;height:22px;border-radius:3px;cursor:pointer;font-size:11px;line-height:1;padding:0">×</button>';
    html += '</div>';
    // Contenu : si nœud sélectionné → propriétés ; sinon → narratif
    html += '<div style="flex:1;overflow-y:auto;padding:10px 12px">';
    if (_flowchartEditor.selectedNodeId) {
      var sel = _fcGetSelectedNode();
      if (sel) html += _fcRenderProperties(sel, allCtrls);
      else html += '<div style="font-size:11px;color:var(--text-3);font-style:italic">Aucun nœud sélectionné.</div>';
    } else {
      html += _fcRenderNarrativeSidePanel(fc);
    }
    html += '</div>';
    html += '</div>';
  }

  html += '</div>'; // end 3 columns

  // ─── BOTTOM : Contrôles du flowchart courant (v66) ─────────────
  html += renderFlowchartBottomControls(fc, d, allCtrls);

  html += '</div>'; // end editor

  return html;
}

// ─── Section Contrôles en bas du flowchart (v66) ──────────────────
// Liste les contrôles du sous-processus courant. Highlight bidirectionnel
// avec les cercles CTRL du flowchart : cliquer une card highlight le cercle,
// cliquer un cercle highlight la card.

// v68 : Vue dérivée WCGW → Contrôles, lecture seule
// Construit la vue à partir des nœuds du flowchart (qui sont la source de vérité)
function renderFlowchartBottomControls(fc, d, allCtrls) {
  if (!fc.subProcessId) {
    return '<div style="border-top:1.5px solid #CECBF6;background:#fff;padding:10px 14px;font-size:11px;color:var(--text-3);font-style:italic">Aucun sous-processus rattaché à ce flowchart : pas de contrôles à afficher.</div>';
  }
  var sps = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) ? d.kickoffPrep.subProcesses : [];
  var sp = sps.find(function(x){return x.id===fc.subProcessId;});
  var spName = sp ? (sp.name || '(sans nom)') : '';

  var validation = _fcAnalyzeWcgwCoverage(fc);
  var wcgwById = {};
  ((d.wcgw && d.wcgw[4]) || []).forEach(function(w){ wcgwById[w.id] = w; });
  var ctrlById = {};
  (allCtrls || []).forEach(function(c){ ctrlById[c.id] = c; });

  var highlightedId = _flowchartEditor && _flowchartEditor.highlightedControlId;
  var hasHighlight = !!highlightedId;

  var nbE = 0, nbT = 0;
  validation.ctrlNodes.forEach(function(n){
    if (n.type === 'ctrl_existing') nbE++;
    else if (n.type === 'ctrl_target') nbT++;
  });

  var h = '';
  h += '<div style="border-top:1.5px solid #CECBF6;background:#fff;padding:12px 14px">';

  // Header
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
  h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
  h += '<div style="font-size:12px;font-weight:600;color:#3C3489;display:flex;align-items:center;gap:6px">🛡 WCGW & Contrôles · '+spName.replace(/</g,'&lt;')+'</div>';
  h += '<span style="font-size:10px;color:var(--text-3);font-style:italic"><strong style="color:#993C1D;font-weight:500">'+validation.wcgwNodes.length+' WCGW</strong> · <strong style="color:#085041;font-weight:500">'+nbE+' Existant'+(nbE>1?'s':'')+'</strong> · <strong style="color:#854F0B;font-weight:500">'+nbT+' Target</strong></span>';
  h += '<span style="font-size:9px;color:var(--text-3);background:#fafafa;padding:2px 7px;border-radius:3px;border:.5px solid var(--border);font-style:italic">📊 dérivé du flowchart · lecture seule</span>';
  h += '</div>';
  h += '<div style="display:flex;gap:6px">';
  if (hasHighlight) {
    h += '<button onclick="setHighlightedControl(null)" style="font-size:10px;padding:4px 9px;background:#fff;color:var(--text-2);border:.5px solid var(--border);border-radius:3px;cursor:pointer">× Désélectionner</button>';
  }
  h += '</div>';
  h += '</div>';

  if (!validation.wcgwNodes.length && !validation.ctrlNodes.length) {
    h += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:14px;text-align:center;border:1px dashed var(--border);border-radius:4px">Aucun WCGW ni contrôle. Ajoute des losanges WCGW depuis la palette puis lie-les à des cercles Existant/Target.</div>';
    h += '</div>';
    return h;
  }

  // ── Liste : 1 carte par WCGW + ses contrôles ─────────
  h += '<div style="display:flex;flex-direction:column;gap:8px">';

  validation.wcgwNodes.forEach(function(wNode){
    var wDef = wNode.wcgwId ? wcgwById[wNode.wcgwId] : null;
    var wTitle = wDef && wDef.title ? wDef.title : (wNode.text || '(à décrire)');
    var wCode = wDef && wDef.code ? wDef.code : 'WCGW';
    var ctrlNodeIds = validation.mapWcgwToCtrls[wNode.id] || [];
    var isUncovered = ctrlNodeIds.length === 0;

    h += '<div style="background:#fafafa;border:.5px solid var(--border);border-radius:4px;padding:8px 10px">';
    // Header WCGW
    h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">';
    h += '<span style="font-size:9px;background:#FCEBEB;color:#993C1D;border:.5px solid #F2C2C0;padding:2px 7px;border-radius:3px;font-weight:600">⚠ '+wCode.replace(/</g,'&lt;')+'</span>';
    h += '<span style="color:var(--text-1);font-weight:500;font-size:11px;flex:1">'+wTitle.replace(/</g,'&lt;')+'</span>';
    if (isUncovered) {
      h += '<span style="font-size:9px;color:#993C1D;background:#FCEBEB;border:.5px solid #F2C2C0;padding:2px 6px;border-radius:3px;font-weight:500">⚠ Non couvert</span>';
    } else {
      h += '<span style="font-size:9px;color:#085041;background:#E1F5EE;border:.5px solid #A6E2CD;padding:2px 6px;border-radius:3px;font-weight:500">✓ Couvert ('+ctrlNodeIds.length+')</span>';
    }
    h += '</div>';

    // Liste des contrôles backed
    if (isUncovered) {
      h += '<div style="margin-left:18px;font-size:10px;color:#993C1D;font-style:italic;background:#FCEBEB;padding:3px 8px;border-radius:3px;border:.5px dashed #F2C2C0;display:inline-block">→ Ajoute un cercle Existant ou Target dans le flowchart, puis lie-le à ce WCGW</div>';
    } else {
      h += '<div style="margin-left:18px;display:flex;gap:5px;flex-wrap:wrap">';
      ctrlNodeIds.forEach(function(ctrlNodeId){
        var ctrlNode = (fc.nodes||[]).find(function(n){return n.id === ctrlNodeId;});
        if (!ctrlNode) return;
        var c = ctrlNode.controlId ? ctrlById[ctrlNode.controlId] : null;
        var isExisting = ctrlNode.type === 'ctrl_existing';
        var bg = isExisting ? '#F5FBF8' : '#FFFAF0';
        var border = isExisting ? '#A6E2CD' : '#FAC775';
        var codeColor = isExisting ? '#5DCAA5' : '#F59E0B';
        var code = c ? (c.code || 'CTRL') : ctrlNode.text;
        var name = c ? (c.name || c.label || '(à décrire)') : '(non lié au modèle)';
        var isHighlighted = c && (highlightedId === c.id);
        var isDimmed = hasHighlight && c && !isHighlighted;
        var pillStyle = 'font-size:10px;padding:3px 8px;border-radius:3px;display:flex;align-items:center;gap:4px;background:'+bg+';border:.5px solid '+(isExisting?border:border)+(isExisting?'':';border-style:dashed')+';cursor:pointer;transition:all .2s';
        if (isHighlighted) pillStyle += ';box-shadow:0 0 0 2px #3C3489';
        if (isDimmed) pillStyle += ';opacity:.4';
        h += '<div onclick="setHighlightedControl(\''+(c?_escJsArg(c.id):'')+'\')" style="'+pillStyle+'">';
        h += '<span style="font-weight:600;font-size:9px;padding:1px 5px;border-radius:2px;background:'+codeColor+';color:#fff">'+code.replace(/</g,'&lt;')+'</span>';
        h += '<span>'+name.replace(/</g,'&lt;')+'</span>';
        if (c) {
          h += '<button onclick="event.stopPropagation();showEditControlModal('+(allCtrls.indexOf(c))+')" title="Éditer" style="background:transparent;border:none;color:var(--text-3);font-size:11px;padding:0 2px;cursor:pointer;line-height:1;margin-left:4px">✎</button>';
        }
        h += '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
  });

  // ── Carte spéciale "Contrôles orphelins" ─────────
  if (validation.orphanCtrlNodeIds.length > 0) {
    h += '<div style="background:#FCEBEB;border:.5px solid #F2C2C0;border-radius:4px;padding:8px 10px">';
    h += '<div style="font-size:9px;color:#993C1D;font-weight:600;text-transform:uppercase;letter-spacing:.3px;margin-bottom:6px">⚠ Contrôles orphelins ('+validation.orphanCtrlNodeIds.length+')</div>';
    h += '<div style="margin-left:0;display:flex;gap:5px;flex-wrap:wrap">';
    validation.orphanCtrlNodeIds.forEach(function(ctrlNodeId){
      var ctrlNode = (fc.nodes||[]).find(function(n){return n.id === ctrlNodeId;});
      if (!ctrlNode) return;
      var c = ctrlNode.controlId ? ctrlById[ctrlNode.controlId] : null;
      var isExisting = ctrlNode.type === 'ctrl_existing';
      var bg = '#fff';
      var border = isExisting ? '#A6E2CD' : '#FAC775';
      var codeColor = isExisting ? '#5DCAA5' : '#F59E0B';
      var code = c ? (c.code || 'CTRL') : ctrlNode.text;
      var name = c ? (c.name || '(à décrire)') : '(non lié)';
      h += '<div style="font-size:10px;padding:3px 8px;border-radius:3px;display:flex;align-items:center;gap:4px;background:'+bg+';border:.5px solid '+border+(isExisting?'':';border-style:dashed')+'">';
      h += '<span style="font-weight:600;font-size:9px;padding:1px 5px;border-radius:2px;background:'+codeColor+';color:#fff">'+code.replace(/</g,'&lt;')+'</span>';
      h += '<span>'+name.replace(/</g,'&lt;')+'</span>';
      h += '<span style="font-style:italic;color:var(--text-3);font-size:9px;margin-left:3px">→ lie à un WCGW</span>';
      h += '</div>';
    });
    h += '</div>';
    h += '</div>';
  }

  h += '</div>'; // end list
  h += '</div>'; // end card
  return h;
}

// ─── Side panel : Narratif ──────────────────────────────────────
function _fcRenderNarrativeSidePanel(fc) {
  var h = '';

  // v73 : panneau Narratif passe en lecture seule, depuis le narratif consolidé de l'audit
  var d = getAudData(CA);
  var sps = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) ? d.kickoffPrep.subProcesses : [];
  var spForFc = fc.subProcessId ? sps.find(function(x){return x.id===fc.subProcessId;}) : null;
  var consolidatedNarrative = d.consolidatedNarrative || '';

  // Tenter d'extraire la section qui correspond au SP du flowchart
  var sectionExtract = '';
  if (spForFc && consolidatedNarrative) {
    sectionExtract = _extractNarrativeSection(consolidatedNarrative, spForFc.name);
  }

  // Bandeau d'info en haut : redirection vers l'étape ITW/Narratif
  h += '<div style="background:#EEEDFE;border:.5px solid #CECBF6;border-radius:3px;padding:8px 10px;margin-bottom:10px;font-size:10px;color:#3C3489;line-height:1.5">';
  h += '<div style="font-weight:600;margin-bottom:3px">📝 Narratif en lecture seule</div>';
  h += '<div>Le narratif est désormais géré dans l\'étape <strong>ITW / Narratif</strong> (consolidé pour tout l\'audit). Pour modifier ce texte, retourne à cette étape.</div>';
  h += '<button onclick="goStep(3)" style="margin-top:6px;width:100%;font-size:10px;padding:5px 8px;background:#3C3489;color:#fff;border:none;border-radius:3px;cursor:pointer;font-weight:500">↗ Aller à ITW / Narratif</button>';
  h += '</div>';

  // Affichage du narratif (section SP courante si trouvée, sinon message)
  h += '<div style="margin-bottom:14px">';
  h += '<div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;margin-bottom:5px">';
  if (spForFc) h += 'Section · '+(spForFc.name||'').replace(/</g,'&lt;');
  else h += 'Narratif';
  h += '</div>';
  if (sectionExtract) {
    // Affichage avec highlight des marqueurs WCGW/CTRL/DIVERGENCE
    h += '<div style="font-size:11px;line-height:1.7;color:var(--text-2);white-space:pre-wrap;background:#fff;padding:10px 12px;border:.5px solid var(--border);border-radius:3px;max-height:380px;overflow-y:auto">'+_highlightNarrative(sectionExtract)+'</div>';
  } else if (consolidatedNarrative) {
    h += '<div style="font-size:10px;color:var(--text-3);font-style:italic;background:#fafafa;padding:10px 12px;border:.5px dashed var(--border);border-radius:3px;line-height:1.5">';
    h += 'Aucune section <code style="background:#fff;padding:1px 4px;border-radius:2px;border:.5px solid var(--border)">## '+(spForFc?spForFc.name:'?')+'</code> trouvée dans le narratif consolidé.';
    h += '<br><br>Va à l\'étape ITW / Narratif et utilise le bouton « + section » pour ajouter cette section.';
    h += '</div>';
  } else {
    h += '<div style="font-size:10px;color:var(--text-3);font-style:italic;background:#fafafa;padding:10px 12px;border:.5px dashed var(--border);border-radius:3px;line-height:1.5">';
    h += 'Aucun narratif n\'a encore été rédigé pour cet audit.<br><br>Va à l\'étape ITW / Narratif pour le construire (à partir des entretiens si tu en as ajouté en bibliothèque).';
    h += '</div>';
  }
  h += '</div>';

  h += '<div style="margin-bottom:14px">';
  h += '<div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;margin-bottom:5px">Document narratif (optionnel)</div>';
  if (fc.narrativeFile && fc.narrativeFile.webUrl) {
    var nf = fc.narrativeFile;
    var uploadedLabel = '';
    if (nf.uploadedAt) {
      var ageMs = Date.now() - new Date(nf.uploadedAt).getTime();
      var days = Math.floor(ageMs / 86400000);
      uploadedLabel = days < 1 ? 'aujourd\'hui' : (days === 1 ? 'hier' : 'il y a ' + days + ' jours');
    }
    h += '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:#fff;border:.5px solid var(--border);border-radius:3px">';
    h += '<span style="font-size:18px;color:#3C3489;flex-shrink:0">📄</span>';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-weight:500;color:#3C3489;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px">'+(''+nf.fileName).replace(/</g,'&lt;')+'</div>';
    if (uploadedLabel) h += '<div style="font-size:9px;color:var(--text-3)">'+uploadedLabel+'</div>';
    h += '</div>';
    h += '<a href="'+nf.webUrl+'" target="_blank" rel="noopener" title="Ouvrir" style="text-decoration:none;font-size:11px;padding:3px 6px;border:.5px solid var(--border);border-radius:3px;color:var(--text-2);background:#fff">↗</a>';
    h += '<button onclick="detachFlowchartFile()" title="Détacher" style="font-size:11px;padding:1px 5px;background:transparent;border:.5px solid var(--border);color:#993C1D;border-radius:3px;cursor:pointer">×</button>';
    h += '</div>';
    h += '<button onclick="document.getElementById(\'fc-narrative-file\').click()" style="font-size:10px;padding:5px 10px;background:#fff;border:.5px solid var(--border);border-radius:3px;cursor:pointer;width:100%;margin-top:6px">📎 Remplacer le fichier</button>';
  } else {
    h += '<div style="border:.5px dashed var(--border-secondary);border-radius:4px;padding:12px;text-align:center;background:#fff;cursor:pointer" onclick="document.getElementById(\'fc-narrative-file\').click()">';
    h += '<div style="font-size:18px;color:var(--text-3)">📎</div>';
    h += '<div style="font-size:11px;color:var(--text-2);margin-top:5px">Cliquer pour attacher un fichier</div>';
    h += '<div style="font-size:9px;color:var(--text-3);font-style:italic;margin-top:2px">Word, PDF, Excel… stocké sur SharePoint</div>';
    h += '</div>';
  }
  h += '<input type="file" id="fc-narrative-file" accept=".docx,.doc,.pdf,.xlsx,.xls,.txt" onchange="uploadFlowchartFile(event)" style="display:none"/>';
  h += '</div>';

  return h;
}

// Side panel : WCGW & Contrôles (vue compacte)
function _fcRenderWcgwSidePanel(fc, d, allCtrls) {
  if (!fc.subProcessId) {
    return '<div style="font-size:11px;color:var(--text-3);font-style:italic">Ce flowchart n\'est pas rattaché à un sous-processus.</div>';
  }
  var wcgwList = (d.wcgw && d.wcgw[4]) || [];
  var wcgwsForSP = wcgwList.filter(function(w){return w.subProcessId === fc.subProcessId;});
  if (!wcgwsForSP.length) {
    var h = '<div style="font-size:11px;color:var(--text-3);font-style:italic;margin-bottom:8px">Aucun WCGW pour ce sous-processus.</div>';
    h += '<button onclick="showAddWCGWModalForSP(\''+_escJsArg(fc.subProcessId)+'\')" class="bs" style="font-size:11px;padding:5px 10px;width:100%">+ Ajouter un WCGW</button>';
    return h;
  }
  var h = '';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  h += '<span style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500">'+wcgwsForSP.length+' WCGW</span>';
  h += '<button onclick="showAddWCGWModalForSP(\''+_escJsArg(fc.subProcessId)+'\')" class="bs" style="font-size:10px;padding:2px 7px">+ WCGW</button>';
  h += '</div>';
  wcgwsForSP.forEach(function(w){
    var globalIdx = wcgwList.indexOf(w);
    var ctrlsForW = allCtrls.filter(function(c){return c.wcgwId === w.id;});
    var targets = ctrlsForW.filter(function(c){return c.design === 'target';});
    var existings = ctrlsForW.filter(function(c){return c.design === 'existing';});

    h += '<div style="background:#fff;border:.5px solid var(--border);border-radius:4px;padding:8px;margin-bottom:6px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">';
    h += '<div style="display:flex;align-items:center;gap:5px;flex:1;min-width:0">';
    h += '<span style="background:#EEEDFE;color:#3C3489;font-size:9px;padding:1px 5px;border-radius:2px;flex-shrink:0;font-weight:500">'+(w.code||('WCGW-'+(globalIdx+1)))+'</span>';
    h += '<span style="font-size:11px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(''+(w.title||'(sans titre)')).replace(/</g,'&lt;')+'</span>';
    h += '</div>';
    h += '<button onclick="showEditWCGWModal('+globalIdx+')" class="bs" style="font-size:9px;padding:1px 5px;flex-shrink:0">Éditer</button>';
    h += '</div>';
    if (w.description) {
      h += '<div style="font-size:10px;color:var(--text-3);margin-bottom:6px;line-height:1.3">'+(''+w.description).replace(/</g,'&lt;')+'</div>';
    }
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:10px">';
    // Target
    h += '<div style="background:#FFFAF0;padding:5px;border-radius:3px">';
    h += '<div style="font-size:8px;color:#854F0B;font-weight:500;text-transform:uppercase;letter-spacing:.3px;margin-bottom:2px">Target ('+targets.length+')</div>';
    if (targets.length === 0) {
      h += '<div style="font-style:italic;color:var(--text-3);font-size:9px">—</div>';
    } else {
      targets.forEach(function(c){
        var ci = allCtrls.indexOf(c);
        h += '<div style="font-size:10px;padding:1px 0;color:#854F0B" onclick="showEditControlModal('+ci+')" style="cursor:pointer">';
        h += '<span style="font-family:monospace;font-size:8px;background:#fff;padding:1px 3px;border-radius:2px;margin-right:3px">'+(c.code||'C-'+(ci+1))+'</span>';
        h += (''+(c.name||'(sans nom)').substring(0,30)).replace(/</g,'&lt;');
        h += '</div>';
      });
    }
    h += '</div>';
    // Existing
    h += '<div style="background:#F5FBF8;padding:5px;border-radius:3px">';
    h += '<div style="font-size:8px;color:#085041;font-weight:500;text-transform:uppercase;letter-spacing:.3px;margin-bottom:2px">Existants ('+existings.length+')</div>';
    if (existings.length === 0) {
      h += '<div style="font-style:italic;color:var(--text-3);font-size:9px">—</div>';
    } else {
      existings.forEach(function(c){
        var ci = allCtrls.indexOf(c);
        h += '<div style="font-size:10px;padding:1px 0;color:#085041" onclick="showEditControlModal('+ci+')" style="cursor:pointer">';
        h += '<span style="font-family:monospace;font-size:8px;background:#fff;padding:1px 3px;border-radius:2px;margin-right:3px">'+(c.code||'C-'+(ci+1))+'</span>';
        h += (''+(c.name||'(sans nom)').substring(0,30)).replace(/</g,'&lt;');
        h += '</div>';
      });
    }
    h += '</div>';
    h += '</div>';
    h += '</div>';
  });
  return h;
}

function setFcSidePanelTab(tab) {
  if (!_flowchartEditor) return;
  _flowchartEditor.sidePanelTab = tab;
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// v66 : toggle ouvrir/fermer le panneau Narratif
function toggleFcSidePanel() {
  if (!_flowchartEditor) return;
  _flowchartEditor.sidePanelOpen = !_flowchartEditor.sidePanelOpen;
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// v67 : toggle mode maximisé (cache header AuditFlow + sidebar étapes)
function toggleFcMaximized() {
  _flowchartMaximized = !_flowchartMaximized;
  if (_flowchartMaximized) {
    document.body.classList.add('fc-maximized');
    // v72.1 : forcer en JS pour ne pas dépendre du CSS externe (au cas où l'utilisateur n'aurait pas déployé app.css)
    var sidebar = document.querySelector('.sidebar');
    var topbar = document.querySelector('.topbar');
    var auditHdr = document.getElementById('audit-header-compact');
    var docsPanel = document.getElementById('docs-panel');
    if (sidebar) { sidebar.dataset.fcSavedDisplay = sidebar.style.display || ''; sidebar.style.display = 'none'; }
    if (topbar) { topbar.dataset.fcSavedDisplay = topbar.style.display || ''; topbar.style.display = 'none'; }
    if (auditHdr) { auditHdr.dataset.fcSavedDisplay = auditHdr.style.display || ''; auditHdr.style.display = 'none'; }
    if (docsPanel) { docsPanel.dataset.fcSavedDisplay = docsPanel.style.display || ''; docsPanel.style.display = 'none'; }
    // Le content padding aussi
    var content = document.querySelector('.content');
    if (content) {
      content.dataset.fcSavedPadding = content.style.padding || '';
      content.style.padding = '0';
    }
  } else {
    document.body.classList.remove('fc-maximized');
    // Restaurer
    ['.sidebar', '.topbar'].forEach(function(sel){
      var el = document.querySelector(sel);
      if (el && 'fcSavedDisplay' in el.dataset) { el.style.display = el.dataset.fcSavedDisplay; delete el.dataset.fcSavedDisplay; }
    });
    ['audit-header-compact', 'docs-panel'].forEach(function(id){
      var el = document.getElementById(id);
      if (el && 'fcSavedDisplay' in el.dataset) { el.style.display = el.dataset.fcSavedDisplay; delete el.dataset.fcSavedDisplay; }
    });
    var content2 = document.querySelector('.content');
    if (content2 && 'fcSavedPadding' in content2.dataset) {
      content2.style.padding = content2.dataset.fcSavedPadding;
      delete content2.dataset.fcSavedPadding;
    }
  }
  // Re-render seulement le contenu central (sinon perd les listeners du flowchart)
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// v66 : highlight bidirectionnel entre cercle CTRL du flowchart et card en bas
// - Si le contrôle cliqué est déjà highlighté → désélectionne
// - Si null passé → désélectionne
function setHighlightedControl(controlId) {
  if (!_flowchartEditor) return;
  if (controlId && _flowchartEditor.highlightedControlId === controlId) {
    _flowchartEditor.highlightedControlId = null;
  } else {
    _flowchartEditor.highlightedControlId = controlId;
  }
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// ─── Edge mode (création de liens) ───────────────────────────────
function toggleEdgeMode() {
  if (!_flowchartEditor) return;
  _flowchartEditor.edgeMode = !_flowchartEditor.edgeMode;
  _flowchartEditor.edgeFromId = null;
  _flowchartEditor.selectedNodeId = null;
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// Toggle global du style des nouveaux connecteurs (et reapply à TOUS les existants pour cohérence visuelle)
async function toggleEdgeStyle() {
  if (!_flowchartEditor) return;
  var current = _flowchartEditor.edgeStyle || 'orthogonal';
  var next = current === 'orthogonal' ? 'straight' : 'orthogonal';
  _flowchartEditor.edgeStyle = next;
  // Appliquer aussi à tous les edges du flowchart courant (cohérence visuelle attendue par l'utilisateur)
  var fc = _fcGetCurrent();
  if (fc && Array.isArray(fc.edges)) {
    fc.edges.forEach(function(e){ e.style = next; });
    await saveAuditData(CA);
  }
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Style : ' + (next === 'orthogonal' ? 'angles droits' : 'ligne droite'));
}

// Géométrie d'un nœud → renvoie {cx, cy, ...} pour le rendu de bords
function _fcNodeBox(node) {
  return {
    cx: node.x + node.w/2,
    cy: node.y + node.h/2,
    left: node.x,
    right: node.x + node.w,
    top: node.y,
    bottom: node.y + node.h,
    w: node.w,
    h: node.h,
  };
}

// Calcul du point d'intersection entre la frontière du nœud et la ligne vers (tx, ty)
function _fcEdgePoint(node, tx, ty) {
  var b = _fcNodeBox(node);
  var dx = tx - b.cx;
  var dy = ty - b.cy;
  if (dx === 0 && dy === 0) return {x: b.cx, y: b.cy};
  // Pour les cercles (contrôles)
  if (node.type === 'ctrl_existing' || node.type === 'ctrl_target') {
    var r = Math.min(b.w, b.h) / 2;
    var len = Math.sqrt(dx*dx + dy*dy);
    return {x: b.cx + (dx/len)*r, y: b.cy + (dy/len)*r};
  }
  // Pour les autres : intersection avec rectangle bounding (approximation simple, fonctionne pour rect/oval/diamond/doc/db)
  var hw = b.w/2, hh = b.h/2;
  var absDx = Math.abs(dx), absDy = Math.abs(dy);
  var t;
  if (absDx/hw > absDy/hh) {
    t = hw / absDx;
  } else {
    t = hh / absDy;
  }
  return {x: b.cx + dx*t, y: b.cy + dy*t};
}

// Rendu SVG d'un edge
function _fcRenderEdge(edge, nodes) {
  var nodeFrom = nodes.find(function(n){return n.id===edge.from;});
  var nodeTo = nodes.find(function(n){return n.id===edge.to;});
  if (!nodeFrom || !nodeTo) return '';
  var bFrom = _fcNodeBox(nodeFrom);
  var bTo = _fcNodeBox(nodeTo);

  var label = (edge.label || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var style = edge.style || 'straight';

  // v69.1 : si lien WCGW ↔ Contrôle → ligne d'association (pas de flèche, plus fine)
  var isWcgwCtrlAssoc = (
    (nodeFrom.type === 'wcgw' && (nodeTo.type === 'ctrl_existing' || nodeTo.type === 'ctrl_target')) ||
    ((nodeFrom.type === 'ctrl_existing' || nodeFrom.type === 'ctrl_target') && nodeTo.type === 'wcgw')
  );
  var strokeColor = isWcgwCtrlAssoc ? '#993C1D' : '#374151';
  var strokeWidth = isWcgwCtrlAssoc ? '1.5' : '1.5';
  var strokeDash = isWcgwCtrlAssoc ? ' stroke-dasharray="2,3"' : '';
  var arrowAttr = isWcgwCtrlAssoc ? '' : ' marker-end="url(#fc-arrow)"';

  var s = '<g data-edge-id="'+edge.id+'" onclick="event.stopPropagation();selectEdge(\''+edge.id+'\')" style="cursor:pointer">';

  if (style === 'orthogonal') {
    var path = _fcOrthogonalPath(bFrom, bTo);
    s += '<path d="'+path.d+'" stroke="transparent" stroke-width="10" fill="none"/>';
    s += '<path d="'+path.d+'" stroke="'+strokeColor+'" stroke-width="'+strokeWidth+'" fill="none"'+strokeDash+arrowAttr+'/>';
    if (label) {
      var midX = path.midX, midY = path.midY;
      var labelW = Math.max(label.length * 5.5, 18);
      s += '<rect x="'+(midX - labelW/2 - 3)+'" y="'+(midY - 8)+'" width="'+(labelW + 6)+'" height="14" fill="#fff" stroke="#e5e5e5" stroke-width=".5" rx="2"/>';
      s += '<text x="'+midX+'" y="'+(midY + 3)+'" text-anchor="middle" font-size="9" fill="'+strokeColor+'" font-family="sans-serif">'+label+'</text>';
    }
  } else {
    var pFrom = _fcEdgePoint(nodeFrom, bTo.cx, bTo.cy);
    var pTo = _fcEdgePoint(nodeTo, bFrom.cx, bFrom.cy);
    var midX2 = (pFrom.x + pTo.x) / 2;
    var midY2 = (pFrom.y + pTo.y) / 2;
    s += '<line x1="'+pFrom.x+'" y1="'+pFrom.y+'" x2="'+pTo.x+'" y2="'+pTo.y+'" stroke="transparent" stroke-width="10"/>';
    s += '<line x1="'+pFrom.x+'" y1="'+pFrom.y+'" x2="'+pTo.x+'" y2="'+pTo.y+'" stroke="'+strokeColor+'" stroke-width="'+strokeWidth+'"'+strokeDash+arrowAttr+'/>';
    if (label) {
      var labelW2 = Math.max(label.length * 5.5, 18);
      s += '<rect x="'+(midX2 - labelW2/2 - 3)+'" y="'+(midY2 - 8)+'" width="'+(labelW2 + 6)+'" height="14" fill="#fff" stroke="#e5e5e5" stroke-width=".5" rx="2"/>';
      s += '<text x="'+midX2+'" y="'+(midY2 + 3)+'" text-anchor="middle" font-size="9" fill="'+strokeColor+'" font-family="sans-serif">'+label+'</text>';
    }
  }
  s += '</g>';
  return s;
}

// ─── Calcul du chemin orthogonal entre 2 nœuds ──────────────────
// Algorithme : choisit le meilleur point de sortie/entrée selon position relative,
// puis trace 3 segments avec 2 coudes (forme L ou Z selon le cas).
function _fcOrthogonalPath(bFrom, bTo) {
  var dx = bTo.cx - bFrom.cx;
  var dy = bTo.cy - bFrom.cy;
  var absDx = Math.abs(dx), absDy = Math.abs(dy);

  var fromX, fromY, toX, toY;
  var horizontalDominant = absDx >= absDy;

  if (horizontalDominant) {
    // Sortie horizontale du nœud source, entrée horizontale dans le nœud cible
    fromX = dx >= 0 ? bFrom.right : bFrom.left;
    fromY = bFrom.cy;
    toX = dx >= 0 ? bTo.left : bTo.right;
    toY = bTo.cy;
    // Coude au milieu en X
    var midX = (fromX + toX) / 2;
    var d = 'M '+fromX+' '+fromY+' L '+midX+' '+fromY+' L '+midX+' '+toY+' L '+toX+' '+toY;
    return {d: d, midX: midX, midY: (fromY + toY) / 2};
  } else {
    // Sortie verticale du nœud source, entrée verticale dans le nœud cible
    fromX = bFrom.cx;
    fromY = dy >= 0 ? bFrom.bottom : bFrom.top;
    toX = bTo.cx;
    toY = dy >= 0 ? bTo.top : bTo.bottom;
    // Coude au milieu en Y
    var midY = (fromY + toY) / 2;
    var d2 = 'M '+fromX+' '+fromY+' L '+fromX+' '+midY+' L '+toX+' '+midY+' L '+toX+' '+toY;
    return {d: d2, midX: (fromX + toX) / 2, midY: midY};
  }
}

// Sélection d'un edge (pour le supprimer ou éditer son label)
function selectEdge(edgeId) {
  if (!_flowchartEditor) return;
  // Pour l'instant : prompt pour le label, ou ESC pour supprimer
  var fc = _fcGetCurrent();
  if (!fc) return;
  var edge = (fc.edges||[]).find(function(e){return e.id===edgeId;});
  if (!edge) return;
  var newLabel = prompt('Label du lien (laisser vide pour effacer le label, taper "DELETE" pour supprimer le lien) :', edge.label || '');
  if (newLabel === null) return; // annulé
  if (newLabel === 'DELETE') {
    fc.edges = fc.edges.filter(function(e){return e.id !== edgeId;});
    saveAuditData(CA);
    document.getElementById('det-content').innerHTML = renderDetContent();
    toast('Lien supprimé');
    return;
  }
  edge.label = newLabel.trim();
  saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// Click sur le canvas vide
function _fcOnCanvasClick() {
  if (!_flowchartEditor) return;
  if (_flowchartEditor.edgeMode) {
    // Annule le mode edge si on clique dans le vide
    _flowchartEditor.edgeMode = false;
    _flowchartEditor.edgeFromId = null;
  } else {
    _flowchartEditor.selectedNodeId = null;
    _flowchartEditor.highlightedControlId = null; // v66 : annule aussi highlight
    if (_flowchartEditor.sidePanelTab === 'props') _flowchartEditor.sidePanelTab = 'narrative';
  }
  document.getElementById('det-content').innerHTML = renderDetContent();
}

function _fcRenderPaletteSection(title, items) {
  var h = '<div style="margin-bottom:14px">';
  h += '<div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;margin-bottom:6px">'+title+'</div>';
  items.forEach(function(it){
    h += '<div onclick="addFlowchartNode(\''+it.type+'\')" style="display:flex;align-items:center;gap:6px;padding:5px 7px;border:.5px solid var(--border);border-radius:3px;background:#fff;margin-bottom:4px;cursor:pointer;font-size:10px;color:var(--text-2)" title="Ajouter au canvas">';
    h += '<span style="display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:20px">'+it.icon+'</span>';
    h += '<span>'+it.label+'</span>';
    h += '</div>';
  });
  h += '</div>';
  return h;
}

// ════════════════════════════════════════════════════════════════════
//  v68 : Helpers de validation "flowchart-as-source"
//  - Identifie WCGW non couverts (sans contrôle backed)
//  - Identifie contrôles orphelins (sans WCGW backed)
// ════════════════════════════════════════════════════════════════════

// Pour un flowchart donné, calcule :
//  - mapWcgwToCtrls : { wcgwNodeId → [ctrlNodeIds] } via les edges
//  - orphanCtrlNodeIds : ctrls qui ne sont liés à AUCUN wcgw
//  - uncoveredWcgwNodeIds : wcgw qui n'ont AUCUN ctrl lié
function _fcAnalyzeWcgwCoverage(fc) {
  if (!fc) return {mapWcgwToCtrls:{}, orphanCtrlNodeIds:[], uncoveredWcgwNodeIds:[]};
  var nodes = fc.nodes || [];
  var edges = fc.edges || [];
  var wcgwNodes = nodes.filter(function(n){return n.type === 'wcgw';});
  var ctrlNodes = nodes.filter(function(n){return n.type === 'ctrl_existing' || n.type === 'ctrl_target';});

  // Map des edges entre wcgw et ctrl (dans les 2 sens)
  var wcgwToCtrls = {};
  var ctrlsToWcgws = {};
  wcgwNodes.forEach(function(w){ wcgwToCtrls[w.id] = []; });
  ctrlNodes.forEach(function(c){ ctrlsToWcgws[c.id] = []; });
  edges.forEach(function(e){
    var nFrom = nodes.find(function(x){return x.id===e.from;});
    var nTo = nodes.find(function(x){return x.id===e.to;});
    if (!nFrom || !nTo) return;
    // wcgw → ctrl
    if (nFrom.type === 'wcgw' && (nTo.type === 'ctrl_existing' || nTo.type === 'ctrl_target')) {
      wcgwToCtrls[nFrom.id].push(nTo.id);
      ctrlsToWcgws[nTo.id].push(nFrom.id);
    }
    // ctrl → wcgw (autorisé aussi)
    else if ((nFrom.type === 'ctrl_existing' || nFrom.type === 'ctrl_target') && nTo.type === 'wcgw') {
      wcgwToCtrls[nTo.id].push(nFrom.id);
      ctrlsToWcgws[nFrom.id].push(nTo.id);
    }
  });

  var orphanCtrlNodeIds = ctrlNodes.filter(function(c){return ctrlsToWcgws[c.id].length === 0;}).map(function(c){return c.id;});
  var uncoveredWcgwNodeIds = wcgwNodes.filter(function(w){return wcgwToCtrls[w.id].length === 0;}).map(function(w){return w.id;});

  return {
    mapWcgwToCtrls: wcgwToCtrls,
    mapCtrlsToWcgws: ctrlsToWcgws,
    orphanCtrlNodeIds: orphanCtrlNodeIds,
    uncoveredWcgwNodeIds: uncoveredWcgwNodeIds,
    wcgwNodes: wcgwNodes,
    ctrlNodes: ctrlNodes,
  };
}

// Rendu SVG d'un nœud selon son type
// validation : objet retourné par _fcAnalyzeWcgwCoverage (optionnel, pour halo orphelin/non-couvert)
function _fcRenderNode(node, allCtrls, validation) {
  var sel = _flowchartEditor && _flowchartEditor.selectedNodeId === node.id;
  var x = node.x, y = node.y, w = node.w, h = node.h;
  var label = (node.text || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // v68 : flag d'erreur pour halo rouge
  var isOrphan = validation && validation.orphanCtrlNodeIds && validation.orphanCtrlNodeIds.indexOf(node.id) >= 0;
  var isUncovered = validation && validation.uncoveredWcgwNodeIds && validation.uncoveredWcgwNodeIds.indexOf(node.id) >= 0;
  var hasError = isOrphan || isUncovered;

  // Si lié à un contrôle, on prend le code du contrôle comme label
  if ((node.type === 'ctrl_existing' || node.type === 'ctrl_target') && node.controlId) {
    var c = allCtrls.find(function(x){return x.id===node.controlId;});
    if (c) label = (c.code || c.name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // v66 : highlight bidirectionnel — si un contrôle est highlight, dimme tout sauf
  // les nœuds CTRL dont controlId correspond
  var highlightedCtrlId = _flowchartEditor && _flowchartEditor.highlightedControlId;
  var nodeOpacity = '';
  var isHighlighted = false;
  if (highlightedCtrlId) {
    if ((node.type === 'ctrl_existing' || node.type === 'ctrl_target') && node.controlId === highlightedCtrlId) {
      isHighlighted = true;
    } else {
      nodeOpacity = ' opacity="0.35"';
    }
  }

  var dataAttrs = 'data-node-id="'+node.id+'" onmousedown="startDragNode(event,\''+node.id+'\')" ondblclick="event.stopPropagation();startEditNodeText(\''+node.id+'\')" style="cursor:move"';
  var s = '<g '+dataAttrs+nodeOpacity+'>';

  switch (node.type) {
    case 'start':
    case 'end':
      s += '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+Math.min(h/2, 24)+'" ry="'+Math.min(h/2, 24)+'" fill="#EEEDFE" stroke="#3C3489" stroke-width="1.5"/>';
      s += '<text x="'+(x+w/2)+'" y="'+(y+h/2+4)+'" text-anchor="middle" font-size="11" fill="#3C3489" font-weight="500" font-family="sans-serif">'+label+'</text>';
      break;
    case 'step':
      s += '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="4" ry="4" fill="#fff" stroke="#3C3489" stroke-width="1.5"/>';
      s += '<text x="'+(x+w/2)+'" y="'+(y+h/2+4)+'" text-anchor="middle" font-size="11" fill="#1F2937" font-weight="500" font-family="sans-serif">'+label+'</text>';
      break;
    case 'decision':
      var cx = x + w/2, cy = y + h/2;
      var pts = (cx)+','+(y)+' '+(x+w)+','+(cy)+' '+(cx)+','+(y+h)+' '+(x)+','+(cy);
      s += '<polygon points="'+pts+'" fill="#FFFAF0" stroke="#FAC775" stroke-width="1.5"/>';
      s += '<text x="'+cx+'" y="'+(cy+3)+'" text-anchor="middle" font-size="10" fill="#854F0B" font-weight="500" font-family="sans-serif">'+label+'</text>';
      break;
    case 'wcgw':
      // v68 : losange rouge (risque) — WCGW
      var wcx = x + w/2, wcy = y + h/2;
      var wpts = (wcx)+','+(y)+' '+(x+w)+','+(wcy)+' '+(wcx)+','+(y+h)+' '+(x)+','+(wcy);
      s += '<polygon points="'+wpts+'" fill="#FCEBEB" stroke="#993C1D" stroke-width="2"/>';
      // Icône ⚠ en haut + label en dessous
      s += '<text x="'+wcx+'" y="'+(wcy-3)+'" text-anchor="middle" font-size="13" fill="#993C1D" font-weight="600" font-family="sans-serif">⚠</text>';
      s += '<text x="'+wcx+'" y="'+(wcy+10)+'" text-anchor="middle" font-size="9" fill="#993C1D" font-weight="600" font-family="sans-serif">'+label+'</text>';
      break;
    case 'document':
      // Document : icône 📄 + titre, vague prononcée en bas
      // Bordure plus marquée (cyan foncé) et fond cyan clair pour bien différencier de l'étape
      var docTopH = h - 14; // hauteur sans la vague
      var docPath = 'M '+x+' '+y+' L '+(x+w)+' '+y+' L '+(x+w)+' '+(y+docTopH);
      // Vague prononcée (3 ondulations)
      var dStep = w / 3;
      for (var i=0; i<3; i++) {
        var dMidX = x + dStep*i + dStep/2;
        var dEndX = x + dStep*(i+1);
        docPath += ' Q '+dMidX+' '+(y+docTopH+18)+' '+dEndX+' '+(y+docTopH);
      }
      docPath += ' L '+x+' '+(y+docTopH)+' Z';
      s += '<path d="'+docPath+'" fill="#ECFEFF" stroke="#0E7490" stroke-width="2"/>';
      // Icône 📄
      s += '<text x="'+(x+14)+'" y="'+(y+18)+'" font-size="14" font-family="sans-serif">📄</text>';
      // Label texte (à droite de l'icône)
      s += '<text x="'+(x+w/2+8)+'" y="'+(y+docTopH/2+4)+'" text-anchor="middle" font-size="10" fill="#0E7490" font-weight="500" font-family="sans-serif">'+label+'</text>';
      break;
    case 'meeting':
      // Cercle avec icône 👥
      var cxM = x + w/2, cyM = y + h/2, rM = Math.min(w, h) / 2;
      s += '<circle cx="'+cxM+'" cy="'+cyM+'" r="'+rM+'" fill="#FCE7F3" stroke="#BE185D" stroke-width="1.5"/>';
      // Icône 👥 en haut
      s += '<text x="'+cxM+'" y="'+(cyM-5)+'" text-anchor="middle" font-size="20" font-family="sans-serif">👥</text>';
      // Label en bas
      s += '<text x="'+cxM+'" y="'+(cyM+18)+'" text-anchor="middle" font-size="9" fill="#BE185D" font-weight="500" font-family="sans-serif">'+label+'</text>';
      break;
    case 'database':
      // Cylindre : ellipse top + côtés + ellipse bottom
      var rx = w/2, ryTop = 8;
      s += '<path d="M '+x+' '+(y+ryTop)+' L '+x+' '+(y+h-ryTop)
         + ' A '+rx+' '+ryTop+' 0 0 0 '+(x+w)+' '+(y+h-ryTop)
         + ' L '+(x+w)+' '+(y+ryTop)
         + ' A '+rx+' '+ryTop+' 0 0 0 '+x+' '+(y+ryTop)+' Z'
         + '" fill="#F5FBF8" stroke="#5DCAA5" stroke-width="1.5"/>';
      s += '<ellipse cx="'+(x+rx)+'" cy="'+(y+ryTop)+'" rx="'+rx+'" ry="'+ryTop+'" fill="none" stroke="#5DCAA5" stroke-width="1.5"/>';
      s += '<text x="'+(x+w/2)+'" y="'+(y+h/2+3)+'" text-anchor="middle" font-size="10" fill="#085041" font-weight="500" font-family="sans-serif">'+label+'</text>';
      break;
    case 'ctrl_existing':
      var cxC = x + w/2, cyC = y + h/2, rC = Math.min(w,h)/2;
      s += '<circle cx="'+cxC+'" cy="'+cyC+'" r="'+rC+'" fill="#E1F5EE" stroke="#5DCAA5" stroke-width="2"/>';
      s += '<text x="'+cxC+'" y="'+(cyC+3)+'" text-anchor="middle" font-size="10" fill="#085041" font-weight="600" font-family="sans-serif">'+label+'</text>';
      break;
    case 'ctrl_target':
      var cxT = x + w/2, cyT = y + h/2, rT = Math.min(w,h)/2;
      s += '<circle cx="'+cxT+'" cy="'+cyT+'" r="'+rT+'" fill="#FFFAF0" stroke="#F59E0B" stroke-width="2" stroke-dasharray="5,3"/>';
      s += '<text x="'+cxT+'" y="'+(cyT+3)+'" text-anchor="middle" font-size="10" fill="#854F0B" font-weight="600" font-family="sans-serif">'+label+'</text>';
      break;
    default:
      s += '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="#fff" stroke="#999" stroke-width="1"/>';
      s += '<text x="'+(x+w/2)+'" y="'+(y+h/2+4)+'" text-anchor="middle" font-size="11" fill="#374151" font-family="sans-serif">'+label+'</text>';
  }

  // v66 : halo violet sur cercle CTRL highlighté (en plus, sans handles de resize)
  if (isHighlighted && !sel) {
    var hcx = x + w/2, hcy = y + h/2, hr = Math.min(w,h)/2 + 6;
    s += '<circle cx="'+hcx+'" cy="'+hcy+'" r="'+hr+'" fill="none" stroke="#3C3489" stroke-width="3" pointer-events="none"/>';
  }

  // v68 : halo rouge + label "⚠ orphelin" / "⚠ non couvert"
  if (hasError && !sel) {
    s += '<rect x="'+(x-3)+'" y="'+(y-3)+'" width="'+(w+6)+'" height="'+(h+6)+'" rx="3" ry="3" fill="none" stroke="#993C1D" stroke-width="2.5" stroke-dasharray="3,2" pointer-events="none"/>';
    var warnLabel = isOrphan ? '⚠ orphelin' : '⚠ non couvert';
    var warnW = warnLabel.length * 5.5 + 8;
    var warnX = x + w/2 - warnW/2;
    var warnY = y + h + 4;
    s += '<rect x="'+warnX+'" y="'+warnY+'" width="'+warnW+'" height="13" fill="#FCEBEB" stroke="#993C1D" stroke-width="0.5" rx="2" pointer-events="none"/>';
    s += '<text x="'+(x+w/2)+'" y="'+(warnY+9)+'" text-anchor="middle" font-size="9" fill="#993C1D" font-weight="600" font-family="sans-serif" pointer-events="none">'+warnLabel+'</text>';
  }

  // Surbrillance si sélectionné + 8 poignées de redimensionnement
  if (sel) {
    s += '<rect x="'+(x-4)+'" y="'+(y-4)+'" width="'+(w+8)+'" height="'+(h+8)+'" rx="3" ry="3" fill="none" stroke="#3C3489" stroke-width="2" stroke-dasharray="4,2" pointer-events="none"/>';

    // 8 poignées : 4 coins + 4 milieux. Chacune avec son curseur et son anchor.
    // anchor = quel coin/côté du nœud reste fixe pendant le resize. Ex : NW veut dire qu'on tire le coin NW
    // (haut-gauche) ; le SE (bas-droite) reste fixe.
    var handles = [
      {anchor:'nw', x:x-4,       y:y-4,       cursor:'nwse-resize'},
      {anchor:'n',  x:x+w/2-4,   y:y-4,       cursor:'ns-resize'},
      {anchor:'ne', x:x+w-4,     y:y-4,       cursor:'nesw-resize'},
      {anchor:'e',  x:x+w-4,     y:y+h/2-4,   cursor:'ew-resize'},
      {anchor:'se', x:x+w-4,     y:y+h-4,     cursor:'nwse-resize'},
      {anchor:'s',  x:x+w/2-4,   y:y+h-4,     cursor:'ns-resize'},
      {anchor:'sw', x:x-4,       y:y+h-4,     cursor:'nesw-resize'},
      {anchor:'w',  x:x-4,       y:y+h/2-4,   cursor:'ew-resize'},
    ];
    handles.forEach(function(hd){
      s += '<rect x="'+hd.x+'" y="'+hd.y+'" width="8" height="8" fill="#fff" stroke="#3C3489" stroke-width="1.5" '
        + 'data-resize-anchor="'+hd.anchor+'" '
        + 'onmousedown="startResizeNode(event,\''+node.id+'\',\''+hd.anchor+'\')" '
        + 'style="cursor:'+hd.cursor+'"/>';
    });
  }

  // Affichage de l'acteur (qui exécute) sous la forme — pour tous types sauf start/end et wcgw
  if (node.actor && node.type !== 'start' && node.type !== 'end' && node.type !== 'wcgw') {
    var actorTxt = (''+node.actor).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if (actorTxt.length > 28) actorTxt = actorTxt.substring(0, 26) + '…';
    var actorY = y + h + 14; // 14px sous le bas de la forme
    // Petit fond pour la lisibilité (pas de border, juste fond clair)
    var actorW = Math.max(actorTxt.length * 5.5 + 12, 30);
    s += '<rect x="'+(x + w/2 - actorW/2)+'" y="'+(actorY - 9)+'" width="'+actorW+'" height="13" fill="#fafafa" stroke="#e5e5e5" stroke-width=".5" rx="2" pointer-events="none"/>';
    s += '<text x="'+(x + w/2)+'" y="'+(actorY + 1)+'" text-anchor="middle" font-size="9" fill="#6B7280" font-style="italic" font-family="sans-serif" pointer-events="none">👤 '+actorTxt+'</text>';
  }

  // v69 : pour les WCGW, afficher le titre sous le losange (similaire pill mais rouge)
  if (node.type === 'wcgw' && node.wcgwId && !hasError) {
    var dForWcgw = getAudData(CA);
    var wcgwListCanvas = (dForWcgw.wcgw && dForWcgw.wcgw[4]) || [];
    var wcgwDefCanvas = wcgwListCanvas.find(function(w){return w.id === node.wcgwId;});
    if (wcgwDefCanvas && wcgwDefCanvas.title && wcgwDefCanvas.title !== 'WCGW à décrire') {
      var titleTxt = wcgwDefCanvas.title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if (titleTxt.length > 32) titleTxt = titleTxt.substring(0, 30) + '…';
      var titleY = y + h + 14;
      var titleW = Math.max(titleTxt.length * 5.5 + 12, 30);
      s += '<rect x="'+(x + w/2 - titleW/2)+'" y="'+(titleY - 9)+'" width="'+titleW+'" height="13" fill="#FCEBEB" stroke="#F2C2C0" stroke-width=".5" rx="2" pointer-events="none"/>';
      s += '<text x="'+(x + w/2)+'" y="'+(titleY + 1)+'" text-anchor="middle" font-size="9" fill="#993C1D" font-style="italic" font-family="sans-serif" pointer-events="none">'+titleTxt+'</text>';
    }
  }

  s += '</g>';
  return s;
}

// Panneau de propriétés du nœud sélectionné
function _fcRenderProperties(node, allCtrls) {
  var h = '<div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;margin-bottom:6px">Propriétés</div>';
  var typeLabels = {start:'Début', end:'Fin', step:'Étape', decision:'Décision', meeting:'Réunion', document:'Document', database:'Système / BDD', wcgw:'WCGW (risque)', ctrl_existing:'Contrôle Existant', ctrl_target:'Contrôle Target'};
  h += '<div style="font-size:11px;color:#3C3489;font-weight:500;margin-bottom:10px">'+(typeLabels[node.type]||node.type)+'</div>';

  // ── v69 : Champs spécifiques au WCGW ──────────────
  if (node.type === 'wcgw') {
    var d = getAudData(CA);
    var wcgwList = (d.wcgw && d.wcgw[4]) || [];
    var wcgwDef = node.wcgwId ? wcgwList.find(function(w){return w.id === node.wcgwId;}) : null;

    if (!wcgwDef) {
      // Cas anormal : losange WCGW sans wcgwId — on affiche juste le texte basique
      h += '<div style="font-size:10px;color:#993C1D;background:#FCEBEB;padding:6px 8px;border-radius:3px;margin-bottom:10px">⚠ Ce losange n\'est pas lié à un WCGW dans le modèle. Supprime-le et recrée-le depuis la palette.</div>';
    } else {
      // Code (modifiable, mais avec validation)
      h += '<div style="margin-bottom:10px">';
      h += '<label style="font-size:10px;color:var(--text-2);display:block;margin-bottom:3px">Code</label>';
      h += '<input type="text" value="'+(''+(wcgwDef.code||'')).replace(/"/g,'&quot;')+'" onchange="setWcgwField(\''+wcgwDef.id+'\',\'code\',this.value)" placeholder="ex : WCGW-1" style="width:100%;font-size:11px;padding:4px 7px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box;font-family:monospace;font-weight:500"/>';
      h += '<div style="font-size:9px;color:var(--text-3);font-style:italic;margin-top:3px">Le code apparaît sur le losange dans le canvas</div>';
      h += '</div>';

      // Titre
      h += '<div style="margin-bottom:10px">';
      h += '<label style="font-size:10px;color:var(--text-2);display:block;margin-bottom:3px">Titre</label>';
      h += '<input type="text" value="'+(''+(wcgwDef.title||'')).replace(/"/g,'&quot;')+'" onchange="setWcgwField(\''+wcgwDef.id+'\',\'title\',this.value)" placeholder="ex : Engagement non autorisé > 50k€" style="width:100%;font-size:11px;padding:4px 7px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
      h += '</div>';

      // Description (textarea)
      h += '<div style="margin-bottom:10px">';
      h += '<label style="font-size:10px;color:var(--text-2);display:block;margin-bottom:3px">Description du scénario à risque</label>';
      h += '<textarea onchange="setWcgwField(\''+wcgwDef.id+'\',\'description\',this.value)" placeholder="Décris en détail le scénario : qui pourrait faire quoi, dans quelles circonstances, avec quelles conséquences…" style="width:100%;min-height:80px;font-size:11px;padding:6px 8px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box;resize:vertical;font-family:inherit;line-height:1.5">'+(''+(wcgwDef.description||'')).replace(/</g,'&lt;')+'</textarea>';
      h += '</div>';

      // Risques associés (multi-select depuis Risk Universe)
      var auditObj = AUDIT_PLAN.find(function(x){return x.id===CA;});
      var auditRiskRefs = (d.auditRisks || []).filter(function(r){return r.id;});
      // Si l'audit n'a pas de risques URD attachés, on propose tous les risques URD globaux
      var availRisks = auditRiskRefs.length ? auditRiskRefs : (typeof RISK_UNIVERSE !== 'undefined' ? RISK_UNIVERSE : []);
      if (availRisks.length > 0) {
        h += '<div style="margin-bottom:10px">';
        h += '<label style="font-size:10px;color:var(--text-2);display:block;margin-bottom:3px">Risques URD associés</label>';
        var riskIds = wcgwDef.riskIds || [];
        h += '<div style="max-height:120px;overflow-y:auto;border:.5px solid var(--border);border-radius:3px;background:#fff;padding:4px 6px">';
        availRisks.forEach(function(r){
          var rid = r.id;
          var rcode = r.code || rid;
          var rname = r.name || r.title || rid;
          var checked = riskIds.indexOf(rid) >= 0 ? 'checked' : '';
          h += '<label style="display:flex;align-items:flex-start;gap:5px;padding:3px 0;font-size:10px;cursor:pointer">';
          h += '<input type="checkbox" '+checked+' onchange="toggleWcgwRisk(\''+wcgwDef.id+'\',\''+rid+'\',this.checked)" style="margin-top:1px"/>';
          h += '<span><strong style="font-weight:500;color:#3C3489;font-family:monospace">'+rcode.replace(/</g,'&lt;')+'</strong> · '+(''+rname).replace(/</g,'&lt;')+'</span>';
          h += '</label>';
        });
        h += '</div>';
        if (riskIds.length > 0) {
          h += '<div style="font-size:9px;color:#3C3489;margin-top:4px">'+riskIds.length+' risque(s) URD associé(s)</div>';
        }
        h += '</div>';
      }

      // Sous-processus (lecture seule, dérivé du flowchart)
      var sps = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) ? d.kickoffPrep.subProcesses : [];
      var fc = _fcGetCurrent();
      var spForFc = fc && fc.subProcessId ? sps.find(function(x){return x.id===fc.subProcessId;}) : null;
      if (spForFc) {
        h += '<div style="margin-bottom:10px;padding:6px 8px;background:#fafafa;border-radius:3px;border:.5px solid var(--border)">';
        h += '<div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;margin-bottom:3px">Sous-processus rattaché</div>';
        h += '<div style="font-size:11px;color:var(--text-1);font-weight:500">'+(''+spForFc.name).replace(/</g,'&lt;')+'</div>';
        h += '<div style="font-size:9px;color:var(--text-3);font-style:italic;margin-top:2px">Hérité du flowchart</div>';
        h += '</div>';
      }

      // Compteur de contrôles backed (lecture seule)
      var fcCur = _fcGetCurrent();
      if (fcCur) {
        var validation = _fcAnalyzeWcgwCoverage(fcCur);
        var ctrlsBackedNodeIds = validation.mapWcgwToCtrls[node.id] || [];
        var coverageColor = ctrlsBackedNodeIds.length > 0 ? '#085041' : '#993C1D';
        var coverageBg = ctrlsBackedNodeIds.length > 0 ? '#E1F5EE' : '#FCEBEB';
        var coverageBorder = ctrlsBackedNodeIds.length > 0 ? '#A6E2CD' : '#F2C2C0';
        h += '<div style="margin-bottom:10px;padding:6px 8px;background:'+coverageBg+';border:.5px solid '+coverageBorder+';border-radius:3px">';
        h += '<div style="font-size:9px;color:'+coverageColor+';text-transform:uppercase;letter-spacing:.4px;font-weight:500;margin-bottom:3px">'+(ctrlsBackedNodeIds.length > 0 ? '✓ Couvert' : '⚠ Non couvert')+'</div>';
        h += '<div style="font-size:11px;color:'+coverageColor+';font-weight:500">'+ctrlsBackedNodeIds.length+' contrôle(s) lié(s)</div>';
        if (ctrlsBackedNodeIds.length === 0) {
          h += '<div style="font-size:9px;color:'+coverageColor+';font-style:italic;margin-top:3px">→ Ajoute un cercle Existant ou Target dans le flowchart, puis lie-le à ce WCGW (mode 🔗)</div>';
        }
        h += '</div>';
      }
    }

    // Position et taille (toujours utiles)
    h += '<div style="margin-bottom:10px">';
    h += '<label style="font-size:10px;color:var(--text-2);display:block;margin-bottom:3px">Position (x, y)</label>';
    h += '<div style="display:flex;gap:4px">';
    h += '<input type="number" value="'+node.x+'" onchange="setFlowchartNodeProp(\''+node.id+'\',\'x\',parseInt(this.value))" style="width:50%;font-size:11px;padding:4px 7px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
    h += '<input type="number" value="'+node.y+'" onchange="setFlowchartNodeProp(\''+node.id+'\',\'y\',parseInt(this.value))" style="width:50%;font-size:11px;padding:4px 7px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
    h += '</div>';
    h += '</div>';

    h += '<div style="margin-bottom:10px">';
    h += '<label style="font-size:10px;color:var(--text-2);display:block;margin-bottom:3px">Taille (largeur × hauteur)</label>';
    h += '<div style="display:flex;gap:4px">';
    h += '<input type="number" min="20" value="'+node.w+'" onchange="setFlowchartNodeProp(\''+node.id+'\',\'w\',parseInt(this.value))" style="width:50%;font-size:11px;padding:4px 7px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
    h += '<input type="number" min="20" value="'+node.h+'" onchange="setFlowchartNodeProp(\''+node.id+'\',\'h\',parseInt(this.value))" style="width:50%;font-size:11px;padding:4px 7px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
    h += '</div>';
    h += '</div>';

    return h; // on s'arrête ici pour les WCGW (pas de champ Texte/Acteur génériques)
  }

  // Texte (sauf si lié à un contrôle)
  var hasControlLink = (node.type==='ctrl_existing' || node.type==='ctrl_target') && node.controlId;
  h += '<div style="margin-bottom:10px">';
  h += '<label style="font-size:10px;color:var(--text-2);display:block;margin-bottom:3px">Texte</label>';
  if (hasControlLink) {
    h += '<input type="text" value="'+(''+(node.text||'')).replace(/"/g,'&quot;')+'" disabled style="width:100%;font-size:11px;padding:4px 7px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box;background:#f5f5f5;color:var(--text-3)"/>';
    h += '<div style="font-size:9px;color:var(--text-3);font-style:italic;margin-top:3px">Le label suit automatiquement le code du contrôle lié</div>';
  } else {
    h += '<input type="text" value="'+(''+(node.text||'')).replace(/"/g,'&quot;')+'" onchange="setFlowchartNodeText(\''+node.id+'\',this.value)" style="width:100%;font-size:11px;padding:4px 7px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
  }
  h += '</div>';

  // Acteur — qui exécute (sauf pour Début/Fin)
  if (node.type !== 'start' && node.type !== 'end') {
    h += '<div style="margin-bottom:10px">';
    h += '<label style="font-size:10px;color:var(--text-2);display:block;margin-bottom:3px">👤 Acteur (qui exécute)</label>';
    h += '<input type="text" value="'+(''+(node.actor||'')).replace(/"/g,'&quot;')+'" placeholder="ex : Trésorerie, Manager, ERP…" onchange="setFlowchartNodeProp(\''+node.id+'\',\'actor\',this.value)" style="width:100%;font-size:11px;padding:4px 7px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
    h += '</div>';
  }

  // Position
  h += '<div style="margin-bottom:10px">';
  h += '<label style="font-size:10px;color:var(--text-2);display:block;margin-bottom:3px">Position (x, y)</label>';
  h += '<div style="display:flex;gap:4px">';
  h += '<input type="number" value="'+node.x+'" onchange="setFlowchartNodeProp(\''+node.id+'\',\'x\',parseInt(this.value))" style="width:50%;font-size:11px;padding:4px 7px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
  h += '<input type="number" value="'+node.y+'" onchange="setFlowchartNodeProp(\''+node.id+'\',\'y\',parseInt(this.value))" style="width:50%;font-size:11px;padding:4px 7px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
  h += '</div>';
  h += '</div>';

  // Taille
  h += '<div style="margin-bottom:10px">';
  h += '<label style="font-size:10px;color:var(--text-2);display:block;margin-bottom:3px">Taille (largeur × hauteur)</label>';
  h += '<div style="display:flex;gap:4px">';
  h += '<input type="number" min="20" value="'+node.w+'" onchange="setFlowchartNodeProp(\''+node.id+'\',\'w\',parseInt(this.value))" style="width:50%;font-size:11px;padding:4px 7px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
  h += '<input type="number" min="20" value="'+node.h+'" onchange="setFlowchartNodeProp(\''+node.id+'\',\'h\',parseInt(this.value))" style="width:50%;font-size:11px;padding:4px 7px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
  h += '</div>';
  h += '</div>';

  // Lien contrôle (uniquement pour ctrl_existing / ctrl_target)
  if (node.type === 'ctrl_existing' || node.type === 'ctrl_target') {
    var designFilter = node.type === 'ctrl_existing' ? 'existing' : 'target';
    var availCtrls = allCtrls.filter(function(c){return c.design === designFilter;});
    h += '<div style="margin-bottom:10px">';
    h += '<label style="font-size:10px;color:var(--text-2);display:block;margin-bottom:3px">Lier à un contrôle</label>';
    h += '<select onchange="setFlowchartNodeProp(\''+node.id+'\',\'controlId\',this.value)" style="width:100%;font-size:11px;padding:4px 7px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box">';
    h += '<option value="">— Aucun —</option>';
    availCtrls.forEach(function(c){
      var ctrlIdx = allCtrls.indexOf(c);
      var code = c.code || ('CTRL-'+(ctrlIdx+1));
      var name = c.name || c.label || '(sans nom)';
      var sel = (node.controlId === c.id) ? ' selected' : '';
      h += '<option value="'+c.id+'"'+sel+'>'+code+' · '+name.replace(/</g,'&lt;')+'</option>';
    });
    h += '</select>';
    if (availCtrls.length === 0) {
      h += '<div style="font-size:9px;color:var(--text-3);font-style:italic;margin-top:3px">Aucun contrôle '+designFilter+' défini dans cet audit. Crée d\'abord les contrôles dans les WCGW.</div>';
    } else {
      h += '<div style="font-size:9px;color:#3C3489;background:#EEEDFE;padding:4px 6px;border-radius:3px;margin-top:6px;line-height:1.4">ℹ Lier à un contrôle synchronise auto le label avec le code du contrôle.</div>';
    }
    h += '</div>';
  }

  return h;
}

// ─── Setters / Actions ──────────────────────────────────────────
async function setFlowchartLabel(val) {
  var fc = _fcGetCurrent();
  if (!fc) return;
  fc.label = val;
  await saveAuditData(CA);
}

// v68 : Importe les WCGW + Contrôles existants du sous-processus dans le flowchart courant
// si ils ne sont pas encore représentés (création de losanges + cercles flottants au centre)
async function importExistingWcgwsAndControls() {
  var fc = _fcGetCurrent();
  if (!fc) return;
  if (!fc.subProcessId) {
    toast('Ce flowchart n\'a pas de sous-processus rattaché');
    return;
  }
  var d = getAudData(CA);
  var wcgwList = (d.wcgw && d.wcgw[4]) || [];
  var ctrls = (d.controls && d.controls[4]) || [];

  // WCGW du SP non encore représentés
  var wcgwsForSP = wcgwList.filter(function(w){return w.subProcessId === fc.subProcessId;});
  var existingWcgwIds = (fc.nodes || []).filter(function(n){return n.type === 'wcgw' && n.wcgwId;}).map(function(n){return n.wcgwId;});
  var wcgwsToImport = wcgwsForSP.filter(function(w){return existingWcgwIds.indexOf(w.id) < 0;});

  // Contrôles dont wcgwId fait partie d'un WCGW du SP, non encore représentés
  var wcgwIdsForSP = wcgwsForSP.map(function(w){return w.id;});
  var ctrlsForSP = ctrls.filter(function(c){return wcgwIdsForSP.indexOf(c.wcgwId) >= 0;});
  var existingCtrlIds = (fc.nodes || []).filter(function(n){return (n.type === 'ctrl_existing' || n.type === 'ctrl_target') && n.controlId;}).map(function(n){return n.controlId;});
  var ctrlsToImport = ctrlsForSP.filter(function(c){return existingCtrlIds.indexOf(c.id) < 0;});

  if (!wcgwsToImport.length && !ctrlsToImport.length) {
    toast('Tous les WCGW et contrôles sont déjà représentés');
    return;
  }

  // Position de départ : centre approximatif du canvas
  var baseX = 200;
  var baseY = 280;
  var col = 0;

  wcgwsToImport.forEach(function(w){
    var def = _FC_DEFAULTS.wcgw;
    var node = {
      id: 'n_' + Date.now() + '_' + Math.floor(Math.random()*100000),
      type: 'wcgw',
      x: baseX + col * 130,
      y: baseY,
      w: def.w,
      h: def.h,
      text: w.code || 'WCGW',
      wcgwId: w.id,
    };
    fc.nodes.push(node);
    col++;
  });
  ctrlsToImport.forEach(function(c){
    var type = (c.design === 'target') ? 'ctrl_target' : 'ctrl_existing';
    var def = _FC_DEFAULTS[type];
    var node = {
      id: 'n_' + Date.now() + '_' + Math.floor(Math.random()*100000),
      type: type,
      x: baseX + col * 90,
      y: baseY + 100,
      w: def.w,
      h: def.h,
      text: c.code || 'CTRL',
      controlId: c.id,
    };
    fc.nodes.push(node);
    col++;
  });

  // Optionnel : créer aussi les edges WCGW→Ctrl pour les contrôles déjà liés à un WCGW
  if (!Array.isArray(fc.edges)) fc.edges = [];
  ctrlsToImport.forEach(function(c){
    if (!c.wcgwId) return;
    var ctrlNode = fc.nodes.find(function(n){return n.controlId === c.id;});
    var wcgwNode = fc.nodes.find(function(n){return n.wcgwId === c.wcgwId;});
    if (ctrlNode && wcgwNode) {
      // Vérifier si edge n'existe pas déjà
      var existing = fc.edges.find(function(e){return (e.from===wcgwNode.id && e.to===ctrlNode.id) || (e.from===ctrlNode.id && e.to===wcgwNode.id);});
      if (!existing) {
        fc.edges.push({
          id: 'e_' + Date.now() + '_' + Math.floor(Math.random()*100000),
          from: wcgwNode.id,
          to: ctrlNode.id,
          label: '',
          style: 'orthogonal',
        });
      }
    }
  });

  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('✓ '+wcgwsToImport.length+' WCGW + '+ctrlsToImport.length+' contrôle(s) importés');
}

async function addFlowchartNode(type) {
  var fc = _fcGetCurrent();
  if (!fc) return;
  var def = _FC_DEFAULTS[type] || _FC_DEFAULTS.step;
  // Position : décalée si déjà des nœuds (pour pas tout empiler)
  var baseX = 80, baseY = 80;
  var offset = (fc.nodes.length % 8) * 30;
  var node = {
    id: 'n_' + Date.now() + '_' + Math.floor(Math.random()*100000),
    type: type,
    x: baseX + offset,
    y: baseY + offset,
    w: def.w,
    h: def.h,
    text: def.label,
  };

  // v68 : si WCGW → créer aussi un WCGW dans d.wcgw[4] et lier via wcgwId
  if (type === 'wcgw') {
    var d = getAudData(CA);
    if (!d.wcgw) d.wcgw = {};
    if (!Array.isArray(d.wcgw[4])) d.wcgw[4] = [];
    var wcgwCount = d.wcgw[4].length;
    var newWcgw = {
      id: 'w_' + Date.now() + '_' + Math.floor(Math.random()*100000),
      code: 'WCGW-' + (wcgwCount + 1),
      title: 'WCGW à décrire',
      description: '',
      subProcessId: fc.subProcessId || null,
      riskIds: [],
    };
    d.wcgw[4].push(newWcgw);
    node.wcgwId = newWcgw.id;
    node.text = newWcgw.code; // label du losange = code
  }

  // v68 : si Contrôle (existing/target) → créer aussi un contrôle dans d.controls[4]
  if (type === 'ctrl_existing' || type === 'ctrl_target') {
    var d2 = getAudData(CA);
    if (!d2.controls) d2.controls = {};
    if (!Array.isArray(d2.controls[4])) d2.controls[4] = [];
    var ctrlCount = d2.controls[4].length;
    var prefix = (type === 'ctrl_existing') ? 'CTRL-' : 'CT-';
    // Calcul du prochain numéro selon le préfixe pour éviter doublons
    var existingNumbers = d2.controls[4]
      .filter(function(c){return c.code && c.code.startsWith(prefix);})
      .map(function(c){return parseInt(c.code.substring(prefix.length), 10);})
      .filter(function(n){return !isNaN(n);});
    var nextNum = existingNumbers.length ? Math.max.apply(Math, existingNumbers) + 1 : 1;
    var ctrlCode = prefix + nextNum;
    var newCtrl = {
      id: 'c_' + Date.now() + '_' + Math.floor(Math.random()*100000),
      code: ctrlCode,
      name: 'Contrôle à décrire',
      description: '',
      design: (type === 'ctrl_existing') ? 'existing' : 'target',
      // wcgwId à définir manuellement par l'auditeur via les liens du flowchart
    };
    d2.controls[4].push(newCtrl);
    node.controlId = newCtrl.id;
    node.text = ctrlCode;
  }

  fc.nodes.push(node);
  _flowchartEditor.selectedNodeId = node.id;
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}

async function setFlowchartNodeText(nodeId, val) {
  var fc = _fcGetCurrent();
  if (!fc) return;
  var n = fc.nodes.find(function(x){return x.id===nodeId;});
  if (!n) return;
  n.text = val;
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}

async function setFlowchartNodeProp(nodeId, prop, val) {
  var fc = _fcGetCurrent();
  if (!fc) return;
  var n = fc.nodes.find(function(x){return x.id===nodeId;});
  if (!n) return;
  n[prop] = val;
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// v69 : modifier un champ d'un WCGW dans le modèle (code, title, description)
// Si le champ est `code` ou `title`, on met aussi à jour le label du losange WCGW
async function setWcgwField(wcgwId, field, val) {
  var d = getAudData(CA);
  var wcgwList = (d.wcgw && d.wcgw[4]) || [];
  var w = wcgwList.find(function(x){return x.id === wcgwId;});
  if (!w) { toast('WCGW introuvable'); return; }

  // Validation unicité du code
  if (field === 'code') {
    var trimmed = (val || '').trim();
    if (!trimmed) { toast('Le code ne peut pas être vide'); return; }
    var dup = wcgwList.find(function(x){return x.id !== wcgwId && (x.code||'').trim() === trimmed;});
    if (dup) { toast('Code déjà utilisé par un autre WCGW'); return; }
    val = trimmed;
  }

  w[field] = val;

  // Synchroniser le label du losange dans tous les flowcharts
  if (field === 'code') {
    (d.flowcharts || []).forEach(function(fc){
      (fc.nodes || []).forEach(function(n){
        if (n.type === 'wcgw' && n.wcgwId === wcgwId) {
          n.text = val;
        }
      });
    });
  }

  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// v69 : ajouter/retirer un risque URD au WCGW
async function toggleWcgwRisk(wcgwId, riskId, checked) {
  var d = getAudData(CA);
  var wcgwList = (d.wcgw && d.wcgw[4]) || [];
  var w = wcgwList.find(function(x){return x.id === wcgwId;});
  if (!w) return;
  if (!Array.isArray(w.riskIds)) w.riskIds = [];
  if (checked) {
    if (w.riskIds.indexOf(riskId) < 0) w.riskIds.push(riskId);
  } else {
    w.riskIds = w.riskIds.filter(function(x){return x !== riskId;});
  }
  await saveAuditData(CA);
  // Pas besoin de rerender complet (juste pour le compteur en bas)
  document.getElementById('det-content').innerHTML = renderDetContent();
}

function selectNode(nodeId) {
  if (!_flowchartEditor) return;
  // Mode edge : si actif, traiter comme création de lien
  if (_flowchartEditor.edgeMode) {
    if (!_flowchartEditor.edgeFromId) {
      // 1er clic = source
      _flowchartEditor.edgeFromId = nodeId;
      document.getElementById('det-content').innerHTML = renderDetContent();
      return;
    } else {
      // 2e clic = destination
      var fromId = _flowchartEditor.edgeFromId;
      if (fromId === nodeId) {
        toast('Source et destination doivent être différentes');
        _flowchartEditor.edgeFromId = null;
        document.getElementById('det-content').innerHTML = renderDetContent();
        return;
      }
      var fc = _fcGetCurrent();
      if (!fc) return;
      if (!Array.isArray(fc.edges)) fc.edges = [];
      // Empêcher les doublons (même source-dest)
      var existing = fc.edges.find(function(e){return e.from===fromId && e.to===nodeId;});
      if (existing) {
        toast('Un lien existe déjà entre ces deux nœuds');
        _flowchartEditor.edgeMode = false;
        _flowchartEditor.edgeFromId = null;
        document.getElementById('det-content').innerHTML = renderDetContent();
        return;
      }
      fc.edges.push({
        id: 'e_' + Date.now() + '_' + Math.floor(Math.random()*100000),
        from: fromId,
        to: nodeId,
        label: '',
        style: _flowchartEditor.edgeStyle || 'orthogonal',
      });

      // v68 : si lien entre WCGW et Contrôle → sync wcgwId du contrôle
      var nodeFrom = fc.nodes.find(function(x){return x.id===fromId;});
      var nodeTo = fc.nodes.find(function(x){return x.id===nodeId;});
      if (nodeFrom && nodeTo) {
        var wcgwNode = null, ctrlNode = null;
        if (nodeFrom.type === 'wcgw' && (nodeTo.type === 'ctrl_existing' || nodeTo.type === 'ctrl_target')) {
          wcgwNode = nodeFrom; ctrlNode = nodeTo;
        } else if ((nodeFrom.type === 'ctrl_existing' || nodeFrom.type === 'ctrl_target') && nodeTo.type === 'wcgw') {
          wcgwNode = nodeTo; ctrlNode = nodeFrom;
        }
        if (wcgwNode && ctrlNode && wcgwNode.wcgwId && ctrlNode.controlId) {
          var d = getAudData(CA);
          var ctrl = (d.controls && d.controls[4] || []).find(function(c){return c.id === ctrlNode.controlId;});
          if (ctrl && ctrl.wcgwId !== wcgwNode.wcgwId) {
            ctrl.wcgwId = wcgwNode.wcgwId;
          }
        }
      }

      _flowchartEditor.edgeMode = false;
      _flowchartEditor.edgeFromId = null;
      saveAuditData(CA);
      document.getElementById('det-content').innerHTML = renderDetContent();
      toast('Lien créé ✓');
      return;
    }
  }
  // Mode normal : sélection
  _flowchartEditor.selectedNodeId = nodeId;
  // Auto-bascule sur l'onglet propriétés
  _flowchartEditor.sidePanelTab = 'props';
  // v66 : si c'est un cercle CTRL lié à un contrôle, highlight bidirectionnel
  var fcCur = _fcGetCurrent();
  if (fcCur) {
    var nClicked = fcCur.nodes.find(function(x){return x.id===nodeId;});
    if (nClicked && (nClicked.type === 'ctrl_existing' || nClicked.type === 'ctrl_target') && nClicked.controlId) {
      _flowchartEditor.highlightedControlId = nClicked.controlId;
    }
  }
  document.getElementById('det-content').innerHTML = renderDetContent();
}

function deselectNode() {
  if (!_flowchartEditor) return;
  _flowchartEditor.selectedNodeId = null;
  if (_flowchartEditor.sidePanelTab === 'props') _flowchartEditor.sidePanelTab = 'narrative';
  document.getElementById('det-content').innerHTML = renderDetContent();
}

async function deleteSelectedNode() {
  if (!_flowchartEditor || !_flowchartEditor.selectedNodeId) return;
  var fc = _fcGetCurrent();
  if (!fc) return;
  var nodeId = _flowchartEditor.selectedNodeId;
  var node = fc.nodes.find(function(n){return n.id === nodeId;});
  if (!node) return;

  // v68 : Si nœud lié à un contrôle déjà testé/finalisé/avec finding → refus
  if ((node.type === 'ctrl_existing' || node.type === 'ctrl_target') && node.controlId) {
    var d = getAudData(CA);
    var ctrl = (d.controls && d.controls[4] || []).find(function(c){return c.id === node.controlId;});
    if (ctrl) {
      var hasTestData = !!(ctrl.testNature || ctrl.testStatus || ctrl.finalized || (ctrl.anomalies && ctrl.anomalies.count));
      var findings = d.findings || [];
      var linkedFinding = findings.find(function(f){return Array.isArray(f.controlIds) && f.controlIds.indexOf(ctrl.id) >= 0;});
      if (hasTestData || linkedFinding) {
        var msg = 'Impossible de supprimer ce contrôle (' + (ctrl.code||'') + ') :\n';
        if (hasTestData) msg += '— il a des données de test (statut, nature, anomalies, ou finalisé)\n';
        if (linkedFinding) msg += '— il est lié à un finding existant\n';
        msg += '\nNettoie d\'abord les tests/findings dans les étapes 5/6 avant de retirer ce contrôle du flowchart.';
        alert(msg);
        return;
      }
      // Sinon : supprimer aussi du modèle controls
      d.controls[4] = d.controls[4].filter(function(c){return c.id !== ctrl.id;});
    }
  }

  // v68 : Si nœud WCGW → supprimer aussi le WCGW du modèle (sauf s'il y a des contrôles liés via wcgwId)
  if (node.type === 'wcgw' && node.wcgwId) {
    var d2 = getAudData(CA);
    var wcgw = (d2.wcgw && d2.wcgw[4] || []).find(function(w){return w.id === node.wcgwId;});
    if (wcgw) {
      var ctrlsUsingWcgw = (d2.controls && d2.controls[4] || []).filter(function(c){return c.wcgwId === wcgw.id;});
      if (ctrlsUsingWcgw.length > 0) {
        if (!confirm('Ce WCGW (' + (wcgw.code||'') + ') est associé à ' + ctrlsUsingWcgw.length + ' contrôle(s) (champ wcgwId). Supprimer le losange seulement (les contrôles seront orphelins) ?')) return;
        // On ne supprime que le losange du flowchart, on garde le WCGW dans le modèle
      } else {
        // Pas de contrôle qui le référence : on peut le supprimer aussi
        d2.wcgw[4] = d2.wcgw[4].filter(function(w){return w.id !== wcgw.id;});
      }
    }
  }

  fc.nodes = fc.nodes.filter(function(n){return n.id !== nodeId;});
  // Retirer aussi les edges qui pointent vers ce nœud
  fc.edges = (fc.edges || []).filter(function(e){return e.from !== nodeId && e.to !== nodeId;});
  _flowchartEditor.selectedNodeId = null;
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Nœud supprimé');
}

// ─── Drag & drop ───────────────────────────────────────────────
function startDragNode(event, nodeId) {
  if (!_flowchartEditor) return;
  event.preventDefault();
  event.stopPropagation();
  var fc = _fcGetCurrent();
  if (!fc) return;
  var node = fc.nodes.find(function(x){return x.id===nodeId;});
  if (!node) return;

  // ─── Mode edge : on traite tout de suite comme création de lien ─
  // (pas de drag possible en mode edge)
  if (_flowchartEditor.edgeMode) {
    selectNode(nodeId);
    return;
  }

  // Calcul des coordonnées en repère SVG
  var svg = document.getElementById('fc-canvas');
  if (!svg) return;
  var pt = svg.createSVGPoint();
  pt.x = event.clientX; pt.y = event.clientY;
  var startSvgPt = pt.matrixTransform(svg.getScreenCTM().inverse());

  _flowchartEditor.dragging = {
    nodeId: nodeId,
    offsetX: startSvgPt.x - node.x,
    offsetY: startSvgPt.y - node.y,
    moved: false,
    startClientX: event.clientX,
    startClientY: event.clientY,
  };

  // Bind global handlers
  document.addEventListener('mousemove', _fcOnDrag);
  document.addEventListener('mouseup', _fcOnDragEnd);
}

function _fcOnDrag(event) {
  if (!_flowchartEditor || !_flowchartEditor.dragging) return;
  // Détection de drag réel : seuil de 3px (sinon on considère que c'est un clic)
  var dx = Math.abs(event.clientX - _flowchartEditor.dragging.startClientX);
  var dy = Math.abs(event.clientY - _flowchartEditor.dragging.startClientY);
  if (!_flowchartEditor.dragging.moved && (dx + dy) < 3) {
    return; // pas encore considéré comme drag
  }
  var svg = document.getElementById('fc-canvas');
  if (!svg) return;
  var pt = svg.createSVGPoint();
  pt.x = event.clientX; pt.y = event.clientY;
  var svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
  var fc = _fcGetCurrent();
  if (!fc) return;
  var node = fc.nodes.find(function(x){return x.id===_flowchartEditor.dragging.nodeId;});
  if (!node) return;
  var newX = Math.max(0, Math.round(svgPt.x - _flowchartEditor.dragging.offsetX));
  var newY = Math.max(0, Math.round(svgPt.y - _flowchartEditor.dragging.offsetY));
  if (newX !== node.x || newY !== node.y) {
    _flowchartEditor.dragging.moved = true;
  }
  node.x = newX;
  node.y = newY;
  // Update SVG en direct sans rerender (perf)
  var g = svg.querySelector('g[data-node-id="'+node.id+'"]');
  if (g) {
    // Easiest: trigger SVG re-render by setting outer HTML
    // But to keep perf acceptable, we re-render the entire editor at the end of drag
    // For now, brute-force update of all attributes by re-rendering the inner SVG
    _fcRefreshSvg();
  }
}

async function _fcOnDragEnd(event) {
  if (!_flowchartEditor || !_flowchartEditor.dragging) return;
  document.removeEventListener('mousemove', _fcOnDrag);
  document.removeEventListener('mouseup', _fcOnDragEnd);
  var moved = _flowchartEditor.dragging.moved;
  var nodeId = _flowchartEditor.dragging.nodeId;
  _flowchartEditor.dragging = null;
  if (moved) {
    await saveAuditData(CA);
    // Rerender complet pour rafraîchir le panneau de propriétés (x,y mis à jour)
    document.getElementById('det-content').innerHTML = renderDetContent();
  } else {
    // Pas de drag réel = clic simple → traiter comme sélection (gère aussi le mode edge)
    selectNode(nodeId);
  }
}

// Refresh SVG inline pendant le drag (sans détruire les listeners)
function _fcRefreshSvg() {
  var svg = document.getElementById('fc-canvas');
  if (!svg) return;
  var fc = _fcGetCurrent();
  if (!fc) return;
  var d = getAudData(CA);
  var allCtrls = (d.controls && d.controls[4]) || [];
  var fcValidation = _fcAnalyzeWcgwCoverage(fc);
  var inner = '<defs><marker id="fc-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#374151"/></marker></defs>';
  // Edges en premier (sous les nœuds)
  (fc.edges||[]).forEach(function(e){ inner += _fcRenderEdge(e, fc.nodes); });
  fc.nodes.forEach(function(n){ inner += _fcRenderNode(n, allCtrls, fcValidation); });
  svg.innerHTML = inner;
}

// ─── Conversion SVG → PNG (data URL) ──────────────────────────────
// Utilisé pour exporter un flowchart en image (rapport, slide PPT…)
async function _fcExportPng(flowchart, allCtrls) {
  return new Promise(function(resolve, reject) {
    if (!flowchart || !Array.isArray(flowchart.nodes) || flowchart.nodes.length === 0) {
      return reject(new Error('Flowchart vide'));
    }
    // Calcul de la bounding box (avec padding pour les acteurs et labels)
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    flowchart.nodes.forEach(function(n){
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      var rightX = n.x + (n.w||100);
      var bottomY = n.y + (n.h||40);
      // Acteur sous la forme : +20px en bas
      if (n.actor && n.type !== 'start' && n.type !== 'end') bottomY += 22;
      if (rightX > maxX) maxX = rightX;
      if (bottomY > maxY) maxY = bottomY;
    });
    // Padding
    var pad = 30;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    var width = Math.max(maxX - minX, 100);
    var height = Math.max(maxY - minY, 100);

    // Construire le SVG complet
    var svgInner = '<defs><marker id="fc-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#374151"/></marker></defs>';
    // Edges en premier
    (flowchart.edges||[]).forEach(function(e){
      svgInner += _fcRenderEdge(e, flowchart.nodes);
    });
    // Nœuds (sans handles ni surbrillance — on simule "non sélectionné" en passant par _fcRenderNode mais avec un état temporaire)
    var savedSelectedId = null;
    if (typeof _flowchartEditor !== 'undefined' && _flowchartEditor) {
      savedSelectedId = _flowchartEditor.selectedNodeId;
      _flowchartEditor.selectedNodeId = null; // pas de surbrillance
    }
    flowchart.nodes.forEach(function(n){ svgInner += _fcRenderNode(n, allCtrls || []); });
    if (typeof _flowchartEditor !== 'undefined' && _flowchartEditor) {
      _flowchartEditor.selectedNodeId = savedSelectedId; // restaurer
    }

    var svgStr = '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="'+minX+' '+minY+' '+width+' '+height+'">'
      + '<rect x="'+minX+'" y="'+minY+'" width="'+width+'" height="'+height+'" fill="#fff"/>'
      + svgInner
      + '</svg>';

    // Convertir en PNG via canvas (avec scale x2 pour qualité)
    var scale = 2;
    var img = new Image();
    var blob = new Blob([svgStr], {type: 'image/svg+xml;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    img.onload = function() {
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      try {
        var dataUrl = canvas.toDataURL('image/png');
        resolve({dataUrl: dataUrl, width: canvas.width, height: canvas.height});
      } catch(e) {
        reject(e);
      }
    };
    img.onerror = function(e) {
      URL.revokeObjectURL(url);
      reject(new Error('Erreur chargement SVG'));
    };
    img.src = url;
  });
}

// ─── Resize via les 8 poignées ─────────────────────────────────────
function startResizeNode(event, nodeId, anchor) {
  if (!_flowchartEditor) return;
  event.preventDefault();
  event.stopPropagation(); // important : empêche déclenchement de startDragNode
  var fc = _fcGetCurrent();
  if (!fc) return;
  var node = fc.nodes.find(function(x){return x.id===nodeId;});
  if (!node) return;

  var svg = document.getElementById('fc-canvas');
  if (!svg) return;
  var pt = svg.createSVGPoint();
  pt.x = event.clientX; pt.y = event.clientY;
  var startSvgPt = pt.matrixTransform(svg.getScreenCTM().inverse());

  _flowchartEditor.resizing = {
    nodeId: nodeId,
    anchor: anchor,
    startMouseX: startSvgPt.x,
    startMouseY: startSvgPt.y,
    startX: node.x, startY: node.y,
    startW: node.w, startH: node.h,
    initialRatio: node.w / node.h, // pour Shift
    moved: false,
  };

  document.addEventListener('mousemove', _fcOnResize);
  document.addEventListener('mouseup', _fcOnResizeEnd);
}

function _fcOnResize(event) {
  if (!_flowchartEditor || !_flowchartEditor.resizing) return;
  var svg = document.getElementById('fc-canvas');
  if (!svg) return;
  var pt = svg.createSVGPoint();
  pt.x = event.clientX; pt.y = event.clientY;
  var svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
  var fc = _fcGetCurrent();
  if (!fc) return;
  var node = fc.nodes.find(function(x){return x.id===_flowchartEditor.resizing.nodeId;});
  if (!node) return;

  var r = _flowchartEditor.resizing;
  var dx = svgPt.x - r.startMouseX;
  var dy = svgPt.y - r.startMouseY;
  var minSize = 30;

  // Calcul du nouveau rect selon l'anchor
  var newX = r.startX, newY = r.startY, newW = r.startW, newH = r.startH;

  // Composante horizontale
  if (r.anchor === 'e' || r.anchor === 'ne' || r.anchor === 'se') {
    newW = Math.max(minSize, r.startW + dx);
  } else if (r.anchor === 'w' || r.anchor === 'nw' || r.anchor === 'sw') {
    newW = Math.max(minSize, r.startW - dx);
    newX = r.startX + (r.startW - newW);
  }
  // Composante verticale
  if (r.anchor === 's' || r.anchor === 'se' || r.anchor === 'sw') {
    newH = Math.max(minSize, r.startH + dy);
  } else if (r.anchor === 'n' || r.anchor === 'ne' || r.anchor === 'nw') {
    newH = Math.max(minSize, r.startH - dy);
    newY = r.startY + (r.startH - newH);
  }

  // Ratio bloqué si Shift (utile pour cercles)
  if (event.shiftKey) {
    var ratio = r.initialRatio || 1;
    // On force la nouvelle hauteur en fonction de la nouvelle largeur (priorité à la dimension la plus modifiée)
    var ratioW = newW / r.startW;
    var ratioH = newH / r.startH;
    if (Math.abs(1 - ratioW) > Math.abs(1 - ratioH)) {
      // largeur dominante : on ajuste la hauteur
      var oldH = newH;
      newH = newW / ratio;
      // Réajuster Y si on tirait depuis le haut
      if (r.anchor === 'n' || r.anchor === 'ne' || r.anchor === 'nw') {
        newY = newY + (oldH - newH);
      }
    } else {
      // hauteur dominante : on ajuste la largeur
      var oldW = newW;
      newW = newH * ratio;
      // Réajuster X si on tirait depuis la gauche
      if (r.anchor === 'w' || r.anchor === 'nw' || r.anchor === 'sw') {
        newX = newX + (oldW - newW);
      }
    }
  }

  // Application
  node.x = Math.round(newX);
  node.y = Math.round(newY);
  node.w = Math.round(newW);
  node.h = Math.round(newH);
  r.moved = true;

  _fcRefreshSvg();
}

async function _fcOnResizeEnd(event) {
  if (!_flowchartEditor || !_flowchartEditor.resizing) return;
  document.removeEventListener('mousemove', _fcOnResize);
  document.removeEventListener('mouseup', _fcOnResizeEnd);
  var moved = _flowchartEditor.resizing.moved;
  _flowchartEditor.resizing = null;
  if (moved) {
    await saveAuditData(CA);
    // Rerender complet pour rafraîchir le panneau de propriétés (w,h mis à jour)
    document.getElementById('det-content').innerHTML = renderDetContent();
  }
}

// ─── Édition texte inline par double-clic ─────────────────────────
function startEditNodeText(nodeId) {
  if (!_flowchartEditor) return;
  var fc = _fcGetCurrent();
  if (!fc) return;
  var node = fc.nodes.find(function(x){return x.id===nodeId;});
  if (!node) return;

  // Si lié à un contrôle, on n'autorise pas l'édition (le texte suit le code du contrôle)
  if ((node.type === 'ctrl_existing' || node.type === 'ctrl_target') && node.controlId) {
    toast('Ce nœud est lié à un contrôle — le texte est synchronisé automatiquement');
    return;
  }

  // Trouver l'élément SVG du nœud pour positionner l'input par-dessus
  var svg = document.getElementById('fc-canvas');
  if (!svg) return;
  var canvasWrap = document.getElementById('fc-canvas-wrap');
  if (!canvasWrap) return;

  // Coordonnées SVG → écran
  var ctm = svg.getScreenCTM();
  if (!ctm) return;
  var wrapRect = canvasWrap.getBoundingClientRect();

  // Position en pixels-écran absolus
  var screenX = ctm.a * node.x + ctm.c * node.y + ctm.e;
  var screenY = ctm.b * node.x + ctm.d * node.y + ctm.f;
  // Conversion vers coordonnées relatives au canvas-wrap (qui est position:relative)
  var relX = screenX - wrapRect.left + canvasWrap.scrollLeft;
  var relY = screenY - wrapRect.top + canvasWrap.scrollTop;
  var w = node.w * ctm.a; // largeur scaled
  var h = node.h * ctm.d;

  // Retirer un éditeur précédent si encore présent
  var prev = document.getElementById('fc-inline-editor');
  if (prev) prev.remove();

  // Créer l'input HTML par-dessus la forme
  var input = document.createElement('input');
  input.id = 'fc-inline-editor';
  input.type = 'text';
  input.value = node.text || '';
  input.style.position = 'absolute';
  input.style.left = (relX) + 'px';
  input.style.top = (relY) + 'px';
  input.style.width = w + 'px';
  input.style.height = h + 'px';
  input.style.zIndex = '50';
  input.style.fontSize = '11px';
  input.style.textAlign = 'center';
  input.style.padding = '4px 6px';
  input.style.boxSizing = 'border-box';
  input.style.border = '2px solid #3C3489';
  input.style.borderRadius = '3px';
  input.style.background = '#fff';
  input.style.fontFamily = 'inherit';
  input.style.outline = 'none';

  canvasWrap.appendChild(input);
  input.focus();
  input.select();

  function commit(save) {
    if (!input.parentNode) return;
    var newText = save ? input.value : node.text;
    input.remove();
    if (save && newText !== node.text) {
      setFlowchartNodeText(nodeId, newText);
    }
  }
  input.addEventListener('keydown', function(e){
    if (e.key === 'Enter') { e.preventDefault(); commit(true); }
    else if (e.key === 'Escape') { e.preventDefault(); commit(false); }
  });
  input.addEventListener('blur', function(){ commit(true); });
}

// ─── Narrative : indicateur "dirty" + save ───────────────────────
function _fcMarkNarrativeDirty() {
  var st = document.getElementById('fc-narrative-status');
  if (st) {
    var ta = document.getElementById('fc-narrative');
    var len = ta ? ta.value.length : 0;
    st.textContent = len + ' caractères · modification non sauvegardée';
    st.style.color = '#854F0B';
  }
}

async function saveFlowchartNarrative(val) {
  var fc = _fcGetCurrent();
  if (!fc) return;
  if (fc.narrative === val) return; // pas de changement
  fc.narrative = val;
  await saveAuditData(CA);
  var st = document.getElementById('fc-narrative-status');
  if (st) {
    st.textContent = (val ? (val.length + ' caractères · sauvegardé') : 'Vide');
    st.style.color = '';
  }
}

// ─── Upload du fichier narratif ─────────────────────────────────
async function uploadFlowchartFile(event) {
  var file = event && event.target && event.target.files && event.target.files[0];
  if (!file) return;
  var fc = _fcGetCurrent();
  if (!fc) return;
  if (typeof getOrCreateAuditFolder !== 'function' || typeof uploadFileToSharePoint !== 'function') {
    toast('Helpers SharePoint indisponibles');
    return;
  }
  var ap = (AUDIT_PLAN || []).find(function(a){return a.id===CA;});
  if (!ap) { toast('Audit introuvable'); return; }

  toast('📤 Upload SharePoint...');
  try {
    var folderInfo = await getOrCreateAuditFolder(ap);
    // Subdossier "flowcharts/" sous l'audit
    var spFileName = 'flowchart_' + (fc.label || fc.id).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0,50) + '_' + file.name;
    var driveItem = await uploadFileToSharePoint(folderInfo.path, spFileName, file);
    fc.narrativeFile = {
      webUrl: driveItem.webUrl,
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
    };
    await saveAuditData(CA);
    if (typeof addHist === 'function') addHist(CA, 'Document narratif attaché au flowchart : ' + (fc.label||'') + ' — ' + file.name);
    document.getElementById('det-content').innerHTML = renderDetContent();
    toast('✓ Fichier attaché');
  } catch (e) {
    console.error('[uploadFlowchartFile] error:', e);
    toast('Erreur upload : ' + (e.message||e));
  }
}

async function detachFlowchartFile() {
  if (!confirm('Détacher ce fichier ? Le fichier reste sur SharePoint, seul le lien est retiré du flowchart.')) return;
  var fc = _fcGetCurrent();
  if (!fc) return;
  fc.narrativeFile = null;
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Fichier détaché');
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

  // Récupérer la liste des sous-processus (pour le sélecteur de rattachement)
  var d_modal = getAudData(CA);
  var subProcs = (d_modal.kickoffPrep && Array.isArray(d_modal.kickoffPrep.subProcesses))
    ? d_modal.kickoffPrep.subProcesses : [];

  // Pré-sélection : soit depuis existing (édition), soit depuis preselectSpId (création depuis carte)
  var currentSpId = (existing && existing.wcgw && existing.wcgw.subProcessId)
    || (existing && existing.preselectSpId)
    || '';

  var spOptions = subProcs.map(function(sp){
    var selected = sp.id === currentSpId ? ' selected' : '';
    var label = sp.name || '(sans nom)';
    return '<option value="'+sp.id+'"'+selected+'>'+label.replace(/"/g,'&quot;')+'</option>';
  }).join('');
  var spHtml = subProcs.length
    ? '<div><label>Sous-processus <span style="color:var(--red)">*</span></label><select id="wcgw-sp"><option value="">— Sélectionner —</option>'+spOptions+'</select></div>'
    : '<div style="font-size:11px;color:#854F0B;padding:8px;background:#FAEEDA;border:.5px solid #FAC775;border-radius:4px;margin-bottom:8px">⚠ Aucun sous-processus défini pour cet audit. Retourne à l\'étape Work Program pour en ajouter.</div>';

  var currentRiskIds = (existing && existing.wcgw && existing.wcgw.riskIds) || [];
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

  var body = spHtml
    + '<div><label>Code <span style="color:var(--red)">*</span></label><input id="wcgw-code" value="'+((existing&&existing.wcgw&&existing.wcgw.code)||'')+'" placeholder="ex : WCGW-1"/></div>'
    + '<div><label>Titre <span style="color:var(--red)">*</span></label><input id="wcgw-title" value="'+((existing&&existing.wcgw&&existing.wcgw.title)||'')+'" placeholder="ex : Accès non autorisé aux données client"/></div>'
    + '<div><label>Description</label><textarea id="wcgw-desc" style="width:100%;min-height:60px" placeholder="Décrivez le scénario de risque...">'+((existing&&existing.wcgw&&existing.wcgw.description)||'')+'</textarea></div>'
    + risksHtml;

  var isEdit = !!(existing && existing.wcgw);
  openModal(isEdit ? 'Éditer WCGW' : 'Nouveau WCGW', body, async function(){
    var subProcessId = (document.getElementById('wcgw-sp') ? document.getElementById('wcgw-sp').value.trim() : '');
    if (subProcs.length && !subProcessId) { toast('Sous-processus obligatoire'); return; }
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

    if (isEdit) {
      d.wcgw[CS][existing.idx] = Object.assign({}, existing.wcgw, {code, title, description, riskIds, subProcessId});
      addHist('edit', 'WCGW "'+title+'" modifié');
    } else {
      d.wcgw[CS].push({
        id: 'wcgw_'+Date.now(),
        code, title, description, riskIds, subProcessId,
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
  html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:10px;font-style:italic">Pour chaque contrôle clef existant, documente la procédure de test, la population, l\'échantillon testé et les anomalies identifiées. L\'extrapolation est calculée automatiquement (ratio simple). Les contrôles Target (à mettre en place) seront pris en compte directement à l\'étape Findings sans test.</div>';
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
// ════════════════════════════════════════════════════════════════════
//  PHASE BU.4 — Modèle Issues + Findings agrégés
//
//  Architecture :
//   - Étape 4 (Interviews) : saisie d'ISSUES Design (problèmes de conception)
//   - Étape 5 (Testings)   : saisie d'ISSUES Operating (anomalies sur tests)
//   - Étape 6 (Report)     : création de FINDINGS regroupant 1+ Issues
//
//  Une Issue = un problème ponctuel identifié.
//  Un Finding = synthèse pour le rapport, agrégeant des Issues liées.
//
//  Stockage :
//   audit.issues = [{ id, source, processId, testId, title, description, createdAt }]
//   audit.findings[].issueIds = ['issue_xxx', 'issue_yyy']  ← nouveaux liens
// ════════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────────
//  HELPERS Issues
// ────────────────────────────────────────────────────────────────────

function _ensureIssues(d) {
  if (!Array.isArray(d.issues)) d.issues = [];
  return d.issues;
}

// Renvoie le nom du Process associé à une issue
function _getIssueProcessName(issue) {
  if (!issue || !issue.processId) return null;
  var d = getAudData(CA);
  var wp = (d.workProgramBU && Array.isArray(d.workProgramBU.processes))
    ? d.workProgramBU.processes : [];
  var wpp = wp.find(function(x){return x.id===issue.processId;});
  if (!wpp) return null;
  var p = (PROCESSES||[]).find(function(x){return x.id===wpp.auditProcessId;});
  return p ? p.proc : null;
}

// Renvoie le code du test associé à une issue Operating
function _getIssueTestCode(issue) {
  if (!issue || !issue.testId || !issue.processId) return null;
  var d = getAudData(CA);
  var wp = (d.workProgramBU && Array.isArray(d.workProgramBU.processes))
    ? d.workProgramBU.processes : [];
  var wpp = wp.find(function(x){return x.id===issue.processId;});
  if (!wpp || !Array.isArray(wpp.tests)) return null;
  var t = wpp.tests.find(function(x){return x.id===issue.testId;});
  return t ? (t.code || null) : null;
}

// Crée une issue
async function _createIssue(payload) {
  var d = getAudData(CA);
  _ensureIssues(d);
  var issue = Object.assign({
    id: 'iss_'+Date.now()+'_'+Math.floor(Math.random()*100000),
    source: '',           // 'design' | 'operating'
    processId: '',        // wpProc id
    testId: '',           // wpTest id (si operating)
    title: '',
    description: '',
    createdAt: new Date().toISOString(),
  }, payload || {});
  d.issues.push(issue);
  await saveAuditData(CA);
  return issue;
}

async function _removeIssue(issueId) {
  var d = getAudData(CA);
  _ensureIssues(d);
  d.issues = d.issues.filter(function(x){return x.id!==issueId;});
  // Nettoyer les références dans les findings
  (d.findings||[]).forEach(function(f){
    if (Array.isArray(f.issueIds)) {
      f.issueIds = f.issueIds.filter(function(id){return id!==issueId;});
    }
  });
  await saveAuditData(CA);
}

// ════════════════════════════════════════════════════════════════════
//  ÉTAPE 4 (BU) — Issues Design
//  Pour les audits BU : à l'étape Interviews/Flowcharts, l'auditeur
//  saisit des Issues Design (contrôles manquants ou mal conçus identifiés
//  pendant les interviews, avant les tests).
//  Champs ultra-simples : titre + description + Process concerné.
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
//  v73 : ÉTAPE ITW / NARRATIF (Process uniquement)
//  - Une textarea unique pour le narratif consolidé de l'audit
//  - Structuré par sections markdown `## [Nom du sous-processus]`
//  - Bouton "🤖 Analyser entretiens" (déplacé depuis le flowchart)
//  - Aide pour insérer rapidement les sections de chaque SP
// ════════════════════════════════════════════════════════════════════

function renderItwNarrativeSection() {
  var d = getAudData(CA);
  if (typeof d.consolidatedNarrative !== 'string') d.consolidatedNarrative = '';
  var sps = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) ? d.kickoffPrep.subProcesses : [];
  var nbInterviews = (d.interviews || []).length;
  var nbAnalyzed = (d.interviews || []).filter(function(i){return !!i.analyzedAt;}).length;

  // Détection des sections existantes dans le narratif (par ## [Nom du SP])
  var sectionsFound = _detectNarrativeSections(d.consolidatedNarrative, sps);

  var h = '';

  // ── HEADER avec actions principales ────────────
  h += '<div style="background:linear-gradient(135deg,#3C3489 0%,#534AB7 100%);color:#fff;padding:14px 18px;border-radius:6px;margin-bottom:14px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap">';
  h += '<div style="flex:1;min-width:240px">';
  h += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.6px;opacity:.85;font-weight:500;margin-bottom:3px">Étape 4 · Réalisation</div>';
  h += '<div style="font-size:17px;font-weight:600;margin-bottom:4px">📝 ITW / Narratif consolidé</div>';
  h += '<div style="font-size:11px;opacity:.9;line-height:1.5">Construis un narratif global de l\'audit à partir des entretiens. Sépare les sous-processus par <code style="background:rgba(255,255,255,.2);padding:1px 5px;border-radius:2px">## [Nom du sous-processus]</code>.</div>';
  h += '</div>';
  h += '<div style="display:flex;gap:8px;flex-shrink:0">';
  // Bouton Bibliothèque
  h += '<button onclick="showInterviewsLibrary()" style="font-size:11px;padding:7px 12px;background:rgba(255,255,255,.18);color:#fff;border:.5px solid rgba(255,255,255,.4);border-radius:3px;cursor:pointer;font-weight:500" title="Gérer la bibliothèque d\'entretiens">📋 Entretiens ('+nbInterviews+')</button>';
  // Bouton Analyser
  if (nbInterviews > 0) {
    h += '<button onclick="showAnalyzeInterviewsModalForAudit()" style="font-size:11px;padding:7px 14px;background:#fff;color:#3C3489;border:none;border-radius:3px;cursor:pointer;font-weight:600">🤖 Analyser entretiens</button>';
  } else {
    h += '<button disabled style="font-size:11px;padding:7px 14px;background:rgba(255,255,255,.3);color:rgba(255,255,255,.6);border:none;border-radius:3px;cursor:not-allowed;font-weight:500" title="Bibliothèque vide">🤖 Analyser entretiens</button>';
  }
  h += '</div>';
  h += '</div>';
  h += '</div>';

  // ── LAYOUT 2 cols : narratif principal | side panel ────────────
  h += '<div style="display:grid;grid-template-columns:1fr 280px;gap:14px;align-items:start">';

  // Colonne gauche : NARRATIF PRINCIPAL
  h += '<div style="min-width:0">';
  h += '<div style="background:#fff;border:.5px solid var(--border);border-radius:6px;overflow:hidden">';
  h += '<div style="padding:10px 14px;background:#fafafa;border-bottom:.5px solid var(--border);display:flex;justify-content:space-between;align-items:center">';
  h += '<div style="font-size:11px;font-weight:600;color:var(--text-1)">Narratif consolidé</div>';
  h += '<div id="itw-narrative-status" style="font-size:10px;color:var(--text-3);font-style:italic">'+(d.consolidatedNarrative ? d.consolidatedNarrative.length+' caractères · sauvegardé' : 'Vide')+'</div>';
  h += '</div>';
  h += '<textarea id="itw-narrative-textarea" oninput="_itwMarkNarrativeDirty()" onblur="saveConsolidatedNarrative(this.value)" placeholder="Décris ici les processus audités, à partir des entretiens et de tes observations.\n\nUtilise le format suivant pour structurer par sous-processus :\n\n## Cash Pooling\nChaque matin à 9h, le Trésorier consulte les soldes des filiales…\n\n## Loan Management\n…" style="width:100%;min-height:560px;font-size:12px;padding:14px 16px;border:none;box-sizing:border-box;resize:vertical;font-family:inherit;line-height:1.7;background:#fff">'+(d.consolidatedNarrative||'').replace(/</g,'&lt;')+'</textarea>';
  h += '</div>';
  // Aide / légende
  h += '<div style="font-size:10px;color:var(--text-3);margin-top:6px;padding:6px 10px;background:#fafafa;border:.5px solid var(--border);border-radius:3px;line-height:1.5">';
  h += '<strong style="font-weight:500;color:var(--text-2)">💡 Conventions de balisage :</strong> ';
  h += '<code style="background:#fff;padding:1px 5px;border:.5px solid var(--border);border-radius:2px">## [Nom du SP]</code> pour démarrer une section, ';
  h += '<code style="background:#FCEBEB;padding:1px 5px;border:.5px solid #F2C2C0;border-radius:2px;color:#993C1D">⚠ WCGW :</code> pour un risque, ';
  h += '<code style="background:#F5FBF8;padding:1px 5px;border:.5px solid #A6E2CD;border-radius:2px;color:#085041">✓ CTRL Existant :</code> pour un contrôle existant, ';
  h += '<code style="background:#FFFAF0;padding:1px 5px;border:.5px solid #FAC775;border-radius:2px;color:#854F0B">⚑ CTRL Cible :</code> pour un contrôle cible. ';
  h += 'L\'IA respecte ces marqueurs automatiquement.';
  h += '</div>';
  h += '</div>';

  // Colonne droite : SIDE PANEL (sections + raccourcis)
  h += '<div style="min-width:0">';

  // Couverture par SP
  h += '<div style="background:#fff;border:.5px solid var(--border);border-radius:6px;padding:12px;margin-bottom:10px">';
  h += '<div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;margin-bottom:8px">Sections détectées</div>';
  if (sps.length === 0) {
    h += '<div style="font-size:10px;color:var(--text-3);font-style:italic">Aucun sous-processus défini en étape 2. Va d\'abord les définir.</div>';
  } else {
    sps.forEach(function(sp){
      var found = sectionsFound[sp.id];
      var bg = found ? '#F5FBF8' : '#fafafa';
      var brd = found ? '#A6E2CD' : 'var(--border)';
      var color = found ? '#085041' : 'var(--text-3)';
      var icon = found ? '✓' : '○';
      h += '<div style="padding:6px 8px;background:'+bg+';border:.5px solid '+brd+';border-radius:3px;margin-bottom:4px;display:flex;align-items:center;gap:6px;font-size:10px">';
      h += '<span style="color:'+color+';font-weight:600;font-size:12px;flex-shrink:0">'+icon+'</span>';
      h += '<span style="flex:1;min-width:0;color:'+(found?'var(--text-1)':'var(--text-2)')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+(sp.name||'').replace(/"/g,'&quot;')+'">'+(sp.name||'(sans nom)').replace(/</g,'&lt;')+'</span>';
      if (!found) {
        h += '<button onclick="_itwInsertSpSection(\''+_escQ(sp.name)+'\')" title="Insérer la section dans le narratif" style="font-size:9px;padding:2px 6px;background:#fff;border:.5px solid var(--border);border-radius:2px;cursor:pointer;color:#3C3489;font-weight:500">+ section</button>';
      }
      h += '</div>';
    });
  }
  h += '</div>';

  // Raccourci entretiens
  h += '<div style="background:#fff;border:.5px solid var(--border);border-radius:6px;padding:12px;margin-bottom:10px">';
  h += '<div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;margin-bottom:8px">Bibliothèque entretiens</div>';
  if (nbInterviews === 0) {
    h += '<div style="font-size:10px;color:var(--text-3);font-style:italic;margin-bottom:6px">Aucun entretien dans la bibliothèque.</div>';
    h += '<button onclick="showInterviewsLibrary()" style="width:100%;font-size:11px;padding:7px;background:#3C3489;color:#fff;border:none;border-radius:3px;cursor:pointer;font-weight:500">+ Ajouter un entretien</button>';
  } else {
    h += '<div style="font-size:10px;color:var(--text-2);margin-bottom:8px">'+nbInterviews+' entretien'+(nbInterviews>1?'s':'')+' · '+nbAnalyzed+' analysé'+(nbAnalyzed>1?'s':'')+'</div>';
    // Mini liste
    var itvList = (d.interviews || []).slice(0, 5);
    itvList.forEach(function(itv){
      var initials = _intervInitials(itv.intervieweName);
      var color = _intervColor(itv.intervieweName);
      h += '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:10px">';
      h += '<div style="width:22px;height:22px;border-radius:50%;background:'+color+';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:500;font-size:8px;flex-shrink:0">'+initials+'</div>';
      h += '<div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(itv.intervieweName||'').replace(/</g,'&lt;')+'</div>';
      if (itv.analyzedAt) h += '<span style="color:#085041;font-size:9px;flex-shrink:0">✓</span>';
      h += '</div>';
    });
    if (nbInterviews > 5) {
      h += '<div style="font-size:9px;color:var(--text-3);font-style:italic;margin-top:4px">+ '+(nbInterviews-5)+' autres…</div>';
    }
    h += '<button onclick="showInterviewsLibrary()" style="width:100%;margin-top:8px;font-size:10px;padding:6px;background:#fff;color:var(--text-2);border:.5px solid var(--border);border-radius:3px;cursor:pointer">Gérer la bibliothèque</button>';
  }
  h += '</div>';

  h += '</div>'; // end side panel
  h += '</div>'; // end grid

  // ── v74 : Section Design Issues (sous le grid 2 cols) ────────────
  h += renderDesignIssuesInItwSection();

  return h;
}

// v74 : section Design Issues affichée dans l'étape ITW/Narratif
// Liste les issues source='design' avec filtre Pending/Validated et actions
function renderDesignIssuesInItwSection() {
  var d = getAudData(CA);
  _ensureIssues(d);
  var sps = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) ? d.kickoffPrep.subProcesses : [];
  var spById = {};
  sps.forEach(function(sp){ spById[sp.id] = sp; });

  var designIssues = d.issues.filter(function(i){return i.source === 'design';});
  var pending = designIssues.filter(function(i){return (i.validationStatus || 'pending') === 'pending';});
  var validated = designIssues.filter(function(i){return i.validationStatus === 'validated';});

  // Filtre actuel (state global éphémère)
  if (typeof window._diFilter === 'undefined') window._diFilter = 'pending';

  var h = '';
  h += '<div style="margin-top:18px">';

  // Header
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">';
  h += '<div style="display:flex;align-items:baseline;gap:10px">';
  h += '<span style="font-size:13px;font-weight:600;color:var(--text-1)">⚠ Design Issues</span>';
  h += '<span style="font-size:10px;color:var(--text-3);font-style:italic">Défaillances de conception du dispositif de contrôle (manquant ou insuffisant)</span>';
  h += '</div>';
  // Bouton Ajouter manuellement
  h += '<button onclick="showDesignIssueAiModal(null)" style="font-size:11px;padding:5px 10px;background:#fff;color:#3C3489;border:.5px solid #3C3489;border-radius:3px;cursor:pointer;font-weight:500">+ Ajouter manuellement</button>';
  h += '</div>';

  // Filtres
  h += '<div style="display:flex;gap:6px;margin-bottom:10px">';
  ['pending', 'validated', 'all'].forEach(function(f){
    var isActive = window._diFilter === f;
    var label = f === 'pending' ? '🕐 À valider ('+pending.length+')'
              : f === 'validated' ? '✓ Validées ('+validated.length+')'
              : '📋 Toutes ('+designIssues.length+')';
    h += '<button onclick="_setDiFilter(\''+f+'\')" style="font-size:10px;padding:5px 12px;background:'+(isActive?'#3C3489':'#fff')+';color:'+(isActive?'#fff':'var(--text-2)')+';border:.5px solid '+(isActive?'#3C3489':'var(--border)')+';border-radius:3px;cursor:pointer;font-weight:'+(isActive?'500':'400')+'">'+label+'</button>';
  });
  h += '</div>';

  // Liste filtrée
  var displayList = window._diFilter === 'all' ? designIssues
                  : window._diFilter === 'validated' ? validated
                  : pending;

  if (!displayList.length) {
    var msg = window._diFilter === 'pending' ? 'Aucune Design Issue en attente de validation. Lance une analyse IA pour en générer, ou ajoute-en manuellement.'
            : window._diFilter === 'validated' ? 'Aucune Design Issue validée pour l\'instant. Valide les Design Issues en attente pour qu\'elles deviennent des findings candidates dans le rapport.'
            : 'Aucune Design Issue. Lance une analyse IA des entretiens pour en faire ressortir, ou ajoute-en manuellement.';
    h += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:18px;text-align:center;border:1px dashed var(--border);border-radius:6px;background:#fafafa">'+msg+'</div>';
  } else {
    h += '<div style="display:grid;gap:6px">';
    displayList.forEach(function(iss){
      var idx = d.issues.indexOf(iss);
      var subtype = iss.subtype || 'weak';
      var isMissing = subtype === 'missing';
      var isValidated = iss.validationStatus === 'validated';
      var isAi = !!iss.aiGenerated;
      var sp = iss.relatedSpId ? spById[iss.relatedSpId] : null;

      // Couleurs : Manquant = rouge sombre, Insuffisant = orange
      var borderColor = isMissing ? '#7F1D1D' : '#9A3412';
      var bgColor = isMissing ? '#FEF2F2' : '#FFF7ED';
      var icon = isMissing ? '⚑' : '⚠';
      var typeLabel = isMissing ? 'CTRL Manquant' : 'CTRL Insuffisant';

      h += '<div style="background:'+bgColor+';border:.5px solid '+borderColor+';border-left:3px solid '+borderColor+';border-radius:4px;padding:10px 12px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">';
      h += '<div style="flex:1;min-width:200px">';
      // Header : type + status + AI
      h += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">';
      h += '<span style="font-size:11px;font-weight:600;color:'+borderColor+'">'+icon+' '+typeLabel+'</span>';
      if (isAi) h += '<span style="font-size:9px;background:#fff;color:#3C3489;padding:1px 6px;border-radius:2px;border:.5px solid #CECBF6;font-weight:500">🤖 IA</span>';
      if (isValidated) {
        h += '<span style="font-size:9px;background:#E1F5EE;color:#085041;padding:1px 6px;border-radius:2px;border:.5px solid #A6E2CD;font-weight:500">✓ Validée</span>';
      } else {
        h += '<span style="font-size:9px;background:#FFF4D9;color:#854F0B;padding:1px 6px;border-radius:2px;border:.5px solid #FAC775;font-weight:500">🕐 À valider</span>';
      }
      if (sp) h += '<span style="font-size:9px;background:#fff;color:var(--text-2);padding:1px 6px;border-radius:2px;border:.5px solid var(--border)">'+sp.name.replace(/</g,'&lt;')+'</span>';
      h += '</div>';
      // Title
      h += '<div style="font-size:12px;font-weight:500;color:var(--text-1);margin-bottom:3px">'+(iss.title||'(sans titre)').replace(/</g,'&lt;')+'</div>';
      // Control name
      if (iss.controlName) {
        h += '<div style="font-size:10px;color:var(--text-2);font-style:italic;margin-bottom:4px">Contrôle concerné : '+iss.controlName.replace(/</g,'&lt;')+'</div>';
      }
      // Description
      if (iss.description) {
        h += '<div style="font-size:11px;color:var(--text-2);line-height:1.5;white-space:pre-wrap">'+iss.description.replace(/</g,'&lt;')+'</div>';
      }
      // v75 : Root cause
      var rcCat = _getRootCauseCategory(iss.rootCauseCategory);
      if (rcCat || iss.rootCauseExplanation) {
        h += '<div style="margin-top:8px;padding:7px 9px;background:#fff;border:.5px solid var(--border);border-left:3px solid '+(rcCat?rcCat.color:'#6B7280')+';border-radius:3px">';
        h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">';
        h += '<span style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500">🎯 Root cause</span>';
        if (rcCat) {
          h += '<span style="font-size:10px;font-weight:500;color:'+rcCat.color+';background:'+rcCat.color+'15;border:.5px solid '+rcCat.color+'40;padding:1px 7px;border-radius:2px">'+rcCat.shortLabel+'</span>';
        }
        h += '</div>';
        if (iss.rootCauseExplanation) {
          h += '<div style="font-size:10px;color:var(--text-2);line-height:1.5;font-style:italic">'+iss.rootCauseExplanation.replace(/</g,'&lt;')+'</div>';
        }
        h += '</div>';
      }
      h += '</div>';
      // Actions
      h += '<div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0">';
      if (!isValidated) {
        h += '<button onclick="validateDesignIssue('+idx+')" title="Valider — passera en finding candidate dans le rapport" style="font-size:10px;padding:4px 10px;background:#085041;color:#fff;border:none;border-radius:3px;cursor:pointer;font-weight:500">✓ Valider</button>';
      } else {
        h += '<button onclick="unvalidateDesignIssue('+idx+')" title="Repasser en attente de validation" style="font-size:10px;padding:4px 10px;background:#fff;color:#854F0B;border:.5px solid #FAC775;border-radius:3px;cursor:pointer">↺ Dévalider</button>';
      }
      h += '<button onclick="showDesignIssueAiModal('+idx+')" title="Éditer" style="font-size:10px;padding:4px 10px;background:#fff;border:.5px solid var(--border);border-radius:3px;cursor:pointer">✎ Éditer</button>';
      h += '<button onclick="deleteDesignIssueAi('+idx+')" title="Supprimer" style="font-size:10px;padding:4px 10px;background:#fff;color:#993C1D;border:.5px solid var(--border);border-radius:3px;cursor:pointer">🗑</button>';
      h += '</div>';
      h += '</div>';
      h += '</div>';
    });
    h += '</div>';

    // Footer : compteur + lien vers report
    if (validated.length > 0) {
      h += '<div style="margin-top:10px;padding:8px 12px;background:#E1F5EE;border:.5px solid #A6E2CD;border-radius:3px;font-size:11px;color:#085041;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">';
      h += '<span><strong style="font-weight:500">'+validated.length+' Design Issue'+(validated.length>1?'s':'')+' validée'+(validated.length>1?'s':'')+'</strong> · disponible'+(validated.length>1?'s':'')+' comme finding'+(validated.length>1?'s':'')+' candidate'+(validated.length>1?'s':'')+' dans le rapport</span>';
      h += '<button onclick="goStep(6)" style="font-size:10px;padding:4px 10px;background:#085041;color:#fff;border:none;border-radius:3px;cursor:pointer;font-weight:500">↗ Aller au Report</button>';
      h += '</div>';
    }
  }

  h += '</div>';
  return h;
}

function _setDiFilter(f) {
  window._diFilter = f;
  document.getElementById('det-content').innerHTML = renderDetContent();
}

async function validateDesignIssue(idx) {
  var d = getAudData(CA);
  if (!d.issues || !d.issues[idx]) return;
  d.issues[idx].validationStatus = 'validated';
  d.issues[idx].validatedAt = new Date().toISOString();
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('✓ Design Issue validée — disponible dans le Report');
}

async function unvalidateDesignIssue(idx) {
  var d = getAudData(CA);
  if (!d.issues || !d.issues[idx]) return;
  d.issues[idx].validationStatus = 'pending';
  delete d.issues[idx].validatedAt;
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('↺ Repassée en attente de validation');
}

async function deleteDesignIssueAi(idx) {
  var d = getAudData(CA);
  if (!d.issues || !d.issues[idx]) return;
  var iss = d.issues[idx];
  if (!confirm('Supprimer définitivement cette Design Issue : « '+(iss.title||'(sans titre)')+' » ?')) return;
  d.issues.splice(idx, 1);
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('✓ Design Issue supprimée');
}

// Modale Ajouter/Éditer une Design Issue (variant pour structure v74)
function showDesignIssueAiModal(idx) {
  var d = getAudData(CA);
  _ensureIssues(d);
  var existing = (idx !== null && idx !== undefined) ? d.issues[idx] : null;
  var sps = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) ? d.kickoffPrep.subProcesses : [];

  var subtype = existing ? (existing.subtype || 'weak') : 'weak';
  var title = existing ? (existing.title || '') : '';
  var description = existing ? (existing.description || '') : '';
  var controlName = existing ? (existing.controlName || '') : '';
  var spId = existing ? (existing.relatedSpId || '') : '';
  // v75 : root cause
  var rcCat = existing ? (existing.rootCauseCategory || 'tbd') : 'tbd';
  var rcExpl = existing ? (existing.rootCauseExplanation || '') : '';

  var body = '';
  // Subtype radios
  body += '<div style="margin-bottom:12px">';
  body += '<label style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;display:block;margin-bottom:6px">Type de défaillance *</label>';
  body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
  // Missing
  var mActive = subtype === 'missing';
  body += '<label style="padding:9px 11px;border:1px solid '+(mActive?'#7F1D1D':'var(--border)')+';border-radius:4px;background:'+(mActive?'#FEF2F2':'#fff')+';cursor:pointer;display:flex;align-items:flex-start;gap:8px">';
  body += '<input type="radio" name="di-subtype" value="missing" '+(mActive?'checked':'')+' style="margin:2px 0 0 0;flex-shrink:0"/>';
  body += '<div style="flex:1;min-width:0">';
  body += '<div style="font-size:11px;font-weight:600;color:'+(mActive?'#7F1D1D':'var(--text-2)')+'">⚑ CTRL Manquant</div>';
  body += '<div style="font-size:10px;color:var(--text-3);margin-top:2px">Pas de contrôle là où il en faudrait</div>';
  body += '</div>';
  body += '</label>';
  // Weak
  var wActive = subtype === 'weak';
  body += '<label style="padding:9px 11px;border:1px solid '+(wActive?'#9A3412':'var(--border)')+';border-radius:4px;background:'+(wActive?'#FFF7ED':'#fff')+';cursor:pointer;display:flex;align-items:flex-start;gap:8px">';
  body += '<input type="radio" name="di-subtype" value="weak" '+(wActive?'checked':'')+' style="margin:2px 0 0 0;flex-shrink:0"/>';
  body += '<div style="flex:1;min-width:0">';
  body += '<div style="font-size:11px;font-weight:600;color:'+(wActive?'#9A3412':'var(--text-2)')+'">⚠ CTRL Insuffisant</div>';
  body += '<div style="font-size:10px;color:var(--text-3);margin-top:2px">Existe mais limité par design</div>';
  body += '</div>';
  body += '</label>';
  body += '</div>';
  body += '</div>';

  // Title
  body += '<div style="margin-bottom:10px">';
  body += '<label style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;display:block;margin-bottom:3px">Titre court *</label>';
  body += '<input id="di-title" type="text" value="'+title.replace(/"/g,'&quot;')+'" placeholder="ex : Pas de séparation des tâches sur les paiements > 50k€" style="width:100%;font-size:11px;padding:6px 9px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
  body += '</div>';

  // Control name (uniquement pour weak)
  body += '<div style="margin-bottom:10px">';
  body += '<label style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;display:block;margin-bottom:3px">Contrôle concerné (vide si manquant)</label>';
  body += '<input id="di-control" type="text" value="'+controlName.replace(/"/g,'&quot;')+'" placeholder="ex : Validation manager des paiements > 50k€" style="width:100%;font-size:11px;padding:6px 9px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
  body += '</div>';

  // SP
  if (sps.length > 0) {
    body += '<div style="margin-bottom:10px">';
    body += '<label style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;display:block;margin-bottom:3px">Sous-processus concerné</label>';
    body += '<select id="di-sp" style="width:100%;font-size:11px;padding:6px 9px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box;background:#fff">';
    body += '<option value="">— Aucun / Transverse —</option>';
    sps.forEach(function(sp){
      body += '<option value="'+sp.id+'"'+(spId===sp.id?' selected':'')+'>'+sp.name.replace(/</g,'&lt;')+'</option>';
    });
    body += '</select>';
    body += '</div>';
  }

  // Description
  body += '<div style="margin-bottom:10px">';
  body += '<label style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;display:block;margin-bottom:3px">Description détaillée</label>';
  body += '<textarea id="di-description" placeholder="Décris la défaillance : quel est le gap ou la faiblesse de design, quel risque ça expose, pourquoi c\'est un problème (1-3 phrases)" style="width:100%;min-height:90px;font-size:11px;padding:8px 10px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box;resize:vertical;font-family:inherit;line-height:1.5">'+description.replace(/</g,'&lt;')+'</textarea>';
  body += '</div>';

  // v75 : Root cause section
  body += '<div style="margin-bottom:10px;padding:10px;background:#fafafa;border:.5px solid var(--border);border-radius:4px">';
  body += '<div style="font-size:11px;font-weight:600;color:var(--text-1);margin-bottom:8px;display:flex;align-items:center;gap:6px">🎯 Root cause <span style="font-size:9px;color:var(--text-3);font-weight:400;font-style:italic">— catégorie standard IIA / COSO</span></div>';
  // Catégorie
  body += '<div style="margin-bottom:8px">';
  body += '<label style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;display:block;margin-bottom:3px">Catégorie</label>';
  body += '<select id="di-rc-cat" style="width:100%;font-size:11px;padding:6px 9px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box;background:#fff">';
  ROOT_CAUSE_CATEGORIES.forEach(function(c){
    body += '<option value="'+c.id+'"'+(rcCat===c.id?' selected':'')+'>'+c.label.replace(/</g,'&lt;')+'</option>';
  });
  body += '</select>';
  body += '</div>';
  // Explication
  body += '<div>';
  body += '<label style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;display:block;margin-bottom:3px">Explication factuelle</label>';
  body += '<textarea id="di-rc-expl" placeholder="Justifie la catégorisation à partir d\'éléments concrets des entretiens (ex : « Le trésorier a indiqué qu\'il n\'a jamais reçu de formation sur la procédure de validation des paiements. »). 1-3 phrases." style="width:100%;min-height:60px;font-size:11px;padding:8px 10px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box;resize:vertical;font-family:inherit;line-height:1.5">'+rcExpl.replace(/</g,'&lt;')+'</textarea>';
  body += '</div>';
  body += '</div>';

  var idxAttr = (idx !== null && idx !== undefined) ? idx : -1;
  openModal(
    existing ? '✎ Éditer la Design Issue' : '+ Ajouter une Design Issue',
    body,
    function() { return saveDesignIssueAi(idxAttr); },
    {wide: true, cancelLabel: 'Annuler'}
  );
  setTimeout(function() {
    var okBtn = document.getElementById('mok');
    if (okBtn) okBtn.textContent = existing ? 'Enregistrer' : 'Ajouter';
  }, 50);
}

async function saveDesignIssueAi(idx) {
  try {
    var subtype = document.querySelector('input[name="di-subtype"]:checked');
    subtype = subtype ? subtype.value : 'weak';
    var titleEl = document.getElementById('di-title');
    var descEl = document.getElementById('di-description');
    var ctrlEl = document.getElementById('di-control');
    var spEl = document.getElementById('di-sp');
    // v75 : root cause
    var rcCatEl = document.getElementById('di-rc-cat');
    var rcExplEl = document.getElementById('di-rc-expl');

    var title = (titleEl ? titleEl.value : '').trim();
    var description = (descEl ? descEl.value : '').trim();
    var controlName = (ctrlEl ? ctrlEl.value : '').trim();
    var spId = spEl ? spEl.value : '';
    var rcCat = rcCatEl ? rcCatEl.value : 'tbd';
    var rcExpl = (rcExplEl ? rcExplEl.value : '').trim();

    if (!title) { toast('Indique au moins un titre court'); throw new Error('Validation : titre requis'); }

    var d = getAudData(CA);
    _ensureIssues(d);

    if (idx !== undefined && idx !== null && idx >= 0 && d.issues[idx]) {
      var iss = d.issues[idx];
      iss.subtype = subtype;
      iss.title = title;
      iss.description = description;
      iss.controlName = controlName;
      iss.relatedSpId = spId || null;
      iss.rootCauseCategory = rcCat;
      iss.rootCauseExplanation = rcExpl;
    } else {
      d.issues.push({
        id: 'iss_' + Date.now() + '_' + Math.floor(Math.random()*100000),
        source: 'design',
        subtype: subtype,
        title: title,
        description: description,
        controlName: controlName,
        relatedSpId: spId || null,
        rootCauseCategory: rcCat,
        rootCauseExplanation: rcExpl,
        aiGenerated: false,
        validationStatus: 'pending',
        createdAt: new Date().toISOString(),
      });
    }

    await saveAuditData(CA);
    document.getElementById('det-content').innerHTML = renderDetContent();
    toast('✓ Design Issue sauvegardée');
  } catch (e) {
    if (e && e.message && e.message.indexOf('Validation') === 0) throw e;
    console.error('[saveDesignIssueAi]', e);
    toast('✗ Erreur : '+(e.message||e));
    throw e;
  }
}


// Détection des sections SP dans le narratif (recherche `## [Nom du SP]`)
function _detectNarrativeSections(narrative, sps) {
  var found = {};
  if (!narrative || !sps.length) return found;
  sps.forEach(function(sp){
    var name = (sp.name || '').trim();
    if (!name) return;
    // Regex : `## ` puis le nom (case-insensitive, ignore espaces autour)
    var escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var rx = new RegExp('^\\s*##\\s*\\[?\\s*' + escaped + '\\s*\\]?\\s*$', 'mi');
    if (rx.test(narrative)) found[sp.id] = true;
  });
  return found;
}

// Extraction d'une section spécifique du narratif global (pour la lecture seule du flowchart)
function _extractNarrativeSection(narrative, spName) {
  if (!narrative || !spName) return '';
  var escaped = spName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Regex : capture depuis `## [SP]` jusqu'au prochain `## ` ou fin de texte
  var rx = new RegExp('(^\\s*##\\s*\\[?\\s*' + escaped + '\\s*\\]?\\s*$)([\\s\\S]*?)(?=^\\s*##\\s|\\Z)', 'mi');
  var m = narrative.match(rx);
  if (!m) return '';
  return (m[1] + m[2]).trim();
}

// Insertion d'une nouvelle section SP dans le narratif
function _itwInsertSpSection(spName) {
  var ta = document.getElementById('itw-narrative-textarea');
  if (!ta) return;
  var current = ta.value || '';
  var sectionTpl = '\n\n## ' + spName + '\n\n[À compléter à partir des entretiens et observations…]\n';
  // Insérer à la fin si vide, sinon à la position du curseur
  if (!current.trim()) {
    ta.value = sectionTpl.replace(/^\n\n/, '');
  } else {
    ta.value = current.trimEnd() + sectionTpl;
  }
  // Save + re-render
  saveConsolidatedNarrative(ta.value);
}

function _itwMarkNarrativeDirty() {
  var s = document.getElementById('itw-narrative-status');
  if (s) {
    s.textContent = 'Modifications non sauvegardées…';
    s.style.color = '#854F0B';
  }
}

async function saveConsolidatedNarrative(value) {
  var d = getAudData(CA);
  d.consolidatedNarrative = value || '';
  await saveAuditData(CA);
  var s = document.getElementById('itw-narrative-status');
  if (s) {
    s.textContent = (value ? value.length+' caractères · sauvegardé' : 'Vide');
    s.style.color = 'var(--text-3)';
  }
  // Re-render side panel pour mettre à jour les sections détectées
  var detContent = document.getElementById('det-content');
  if (detContent && CS === 3) {
    // On ne re-render que si on est toujours sur l'étape 3, et on garde le focus sur la textarea
    var ta = document.getElementById('itw-narrative-textarea');
    var savedSelStart = ta ? ta.selectionStart : null;
    var savedSelEnd = ta ? ta.selectionEnd : null;
    var savedScrollTop = ta ? ta.scrollTop : null;
    detContent.innerHTML = renderDetContent();
    // Restaurer le focus + position curseur
    setTimeout(function() {
      var newTa = document.getElementById('itw-narrative-textarea');
      if (newTa) {
        newTa.focus();
        if (savedSelStart !== null) newTa.setSelectionRange(savedSelStart, savedSelEnd);
        if (savedScrollTop !== null) newTa.scrollTop = savedScrollTop;
      }
    }, 0);
  }
}


function renderDesignIssuesSection() {
  var d = getAudData(CA);
  _ensureIssues(d);
  var a = AUDIT_PLAN.find(function(x){return x.id===CA;});
  var isAdmin = CU && CU.role==='admin';
  var isPreparer = (a.assignedTo||a.auditeurs||[]).indexOf(CU&&CU.id)>=0 || isAdmin;

  var wp = (d.workProgramBU && Array.isArray(d.workProgramBU.processes))
    ? d.workProgramBU.processes : [];

  var designIssues = d.issues.filter(function(i){return i.source==='design';});

  var html = '';
  html += '<div class="cd" style="margin-bottom:1rem">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
  html += '<span style="font-size:13px;font-weight:500">Issues Design <span style="color:var(--text-3);font-weight:400">('+designIssues.length+')</span></span>';
  if (isPreparer) {
    html += '<button class="bp" style="font-size:11px;padding:4px 10px" onclick="showDesignIssueModal(null)">+ Ajouter une issue Design</button>';
  }
  html += '</div>';
  html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;margin-bottom:14px">Problématiques de conception du process identifiées en interviews (contrôles manquants, mal conçus, séparation des tâches insuffisante…). Ces issues seront utilisées à l\'étape Report pour construire des findings.</div>';

  if (!wp.length) {
    html += '<div style="font-size:12px;color:var(--text-3);font-style:italic;padding:1rem;text-align:center;border:1px dashed var(--border);border-radius:6px">Aucun Process couvert. Retourne à l\'étape Work Program pour en ajouter.</div>';
    html += '</div>';
    return html;
  }

  if (!designIssues.length) {
    html += '<div style="font-size:12px;color:var(--text-3);font-style:italic;padding:1rem;text-align:center;border:1px dashed var(--border);border-radius:6px">';
    html += 'Aucune issue Design pour le moment.';
    if (isPreparer) html += ' Cliquez sur « + Ajouter une issue Design ».';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // Grouper par Process
  var byProcess = {};
  designIssues.forEach(function(iss){
    var key = iss.processId || '_unassigned';
    if (!byProcess[key]) byProcess[key] = [];
    byProcess[key].push(iss);
  });

  Object.keys(byProcess).forEach(function(procId){
    var wpp = wp.find(function(x){return x.id===procId;});
    var procName = wpp
      ? (function(){ var p=(PROCESSES||[]).find(function(x){return x.id===wpp.auditProcessId;}); return p?p.proc:'(Process introuvable)'; })()
      : '(Process non assigné)';
    html += '<div style="background:#EEEDFE;color:#3C3489;font-weight:600;padding:6px 10px;font-size:11px;border-radius:4px;margin-bottom:6px;margin-top:8px">'+(''+procName).replace(/</g,'&lt;')+'</div>';
    byProcess[procId].forEach(function(iss){
      html += '<div style="border:.5px solid var(--border);border-radius:5px;padding:9px 12px;margin-bottom:6px;background:#fafafa;position:relative">';
      if (isPreparer) {
        html += '<div style="position:absolute;top:7px;right:7px;display:flex;gap:3px">';
        html += '<button class="bs" style="font-size:10px;padding:2px 7px" onclick="showDesignIssueModal(\''+_escJsArg(iss.id)+'\')">Modifier</button>';
        html += '<button class="bd" style="font-size:10px;padding:2px 7px" onclick="removeIssue(\''+_escJsArg(iss.id)+'\')" title="Supprimer">×</button>';
        html += '</div>';
      }
      html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;padding-right:80px">';
      html += '<span style="background:#FAEEDA;color:#854F0B;font-size:9px;padding:2px 7px;border-radius:3px;font-weight:500">DESIGN</span>';
      html += '<span style="font-size:12px;font-weight:500">'+(''+(iss.title||'')).replace(/</g,'&lt;')+'</span>';
      html += '</div>';
      if (iss.description) {
        html += '<div style="font-size:11px;color:var(--text-2);margin-top:3px;white-space:pre-wrap">'+(''+iss.description).replace(/</g,'&lt;')+'</div>';
      }
      html += '</div>';
    });
  });

  html += '</div>';
  return html;
}

function showDesignIssueModal(issueId) {
  var d = getAudData(CA);
  _ensureIssues(d);
  var existing = issueId ? d.issues.find(function(x){return x.id===issueId;}) : null;
  var iss = existing || {};

  var wp = (d.workProgramBU && Array.isArray(d.workProgramBU.processes))
    ? d.workProgramBU.processes : [];

  if (!wp.length) {
    toast('Aucun Process couvert. Retourne à l\'étape Work Program pour en ajouter.');
    return;
  }

  var procOptions = wp.map(function(wpp){
    var p = (PROCESSES||[]).find(function(x){return x.id===wpp.auditProcessId;});
    var name = p ? p.proc : '(Process introuvable)';
    return '<option value="'+_escAttr(wpp.id)+'"'+(iss.processId===wpp.id?' selected':'')+'>'+name.replace(/</g,'&lt;')+'</option>';
  }).join('');

  var body = '';
  body += '<div><label>Process concerné <span style="color:var(--red)">*</span></label>';
  body += '<select id="di-proc"><option value="">— Choisir un Process —</option>'+procOptions+'</select></div>';
  body += '<div><label>Titre <span style="color:var(--red)">*</span></label>';
  body += '<input id="di-title" value="'+_escAttr(iss.title)+'" placeholder="ex : Absence de séparation des tâches en P2P"/></div>';
  body += '<div><label>Description</label>';
  body += '<textarea id="di-desc" style="width:100%;min-height:90px" placeholder="Décris le problème : ce qui est manquant ou mal conçu, pourquoi c\'est un problème, contexte business...">'+(''+(iss.description||'')).replace(/</g,'&lt;')+'</textarea></div>';

  openModal(existing ? 'Modifier l\'issue Design' : 'Nouvelle issue Design', body, async function(){
    var processId = document.getElementById('di-proc').value;
    var title = document.getElementById('di-title').value.trim();
    if (!processId) { toast('Process obligatoire'); return; }
    if (!title) { toast('Titre obligatoire'); return; }
    var description = document.getElementById('di-desc').value.trim();
    if (existing) {
      existing.processId = processId;
      existing.title = title;
      existing.description = description;
      await saveAuditData(CA);
      addHist('edit', 'Issue Design "'+title+'" modifiée');
      toast('Issue modifiée ✓');
    } else {
      await _createIssue({ source:'design', processId:processId, title:title, description:description });
      addHist('add', 'Issue Design "'+title+'" créée');
      toast('Issue ajoutée ✓');
    }
    document.getElementById('det-content').innerHTML = renderDetContent();
  });
}

// Suppression d'une issue (générique design ou operating)
async function removeIssue(issueId) {
  var d = getAudData(CA);
  var iss = (d.issues||[]).find(function(x){return x.id===issueId;});
  if (!iss) return;
  // Vérifier si l'issue est référencée par un finding
  var usedInFindings = (d.findings||[]).filter(function(f){
    return Array.isArray(f.issueIds) && f.issueIds.indexOf(issueId)>=0;
  });
  var msg = 'Supprimer cette issue ?';
  if (usedInFindings.length) {
    msg += '\n\nElle est référencée par '+usedInFindings.length+' finding'+(usedInFindings.length>1?'s':'')+'. Le lien sera supprimé.';
  }
  if (!confirm(msg)) return;
  await _removeIssue(issueId);
  addHist('del', 'Issue "'+(iss.title||'')+'" supprimée');
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Issue supprimée');
}

// ════════════════════════════════════════════════════════════════════
//  ÉTAPE 6 (BU) — Testings BU
//  Pour les audits BU : refonte complète avec :
//   - Statut du test (à faire / en cours / fait)
//   - Méthode (Coverage / Aléatoire / Mix)
//   - Population / Échantillon / Anomalies (nb + valeur €)
//   - Extrapolation auto-calculée (ratio simple — placeholder)
//   - Observations
//   - Création d'ISSUES Operating directement depuis le test
// ════════════════════════════════════════════════════════════════════

var TEST_STATUSES = ['à faire', 'en cours', 'fait'];
var SELECTION_METHODS = ['', 'Coverage', 'Aléatoire', 'Mix'];

function _fmtNum(n) {
  if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
  return Number(n).toLocaleString('fr-FR');
}

function _fmtEur(n) {
  if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
  return Number(n).toLocaleString('fr-FR', {maximumFractionDigits:0}) + ' €';
}

// Calcul d'extrapolation (ratio simple) — placeholder, à remplacer plus tard
function _computeExtrapolation(t) {
  var pop = t.population || {};
  var smp = t.sample || {};
  var ano = t.anomalies || {};
  var method = t.selectionMethod || '';
  if (method === 'Coverage') {
    return { applicable: false, reason: 'Coverage : sample ciblé non extrapolable' };
  }
  if (method !== 'Aléatoire' && method !== 'Mix') {
    return { applicable: false, reason: 'Définissez la méthode de sélection (Aléatoire ou Mix) pour calculer.' };
  }
  if (!smp.count || !pop.count) {
    return { applicable: false, reason: 'Saisissez la population et l\'échantillon (en nombre) pour calculer.' };
  }
  if (!ano.count) {
    return { applicable: true, countExtrapolated: 0, valueExtrapolated: 0, reason: 'Aucune anomalie observée → 0 extrapolé.' };
  }
  var rateCount = Number(ano.count) / Number(smp.count);
  var countExtrapolated = Math.round(rateCount * Number(pop.count));
  var valueExtrapolated = null;
  if (smp.value && pop.value && ano.value !== '' && ano.value !== null && ano.value !== undefined) {
    var rateValue = Number(ano.value) / Number(smp.value);
    valueExtrapolated = Math.round(rateValue * Number(pop.value));
  }
  return {
    applicable: true,
    countExtrapolated: countExtrapolated,
    valueExtrapolated: valueExtrapolated,
    reason: null,
  };
}

var _testingsBuCollapsed = {};

function renderTestingsBuSection() {
  var a = AUDIT_PLAN.find(function(x){return x.id===CA;});
  var d = getAudData(CA);
  var isAdmin = CU && CU.role==='admin';
  var isPreparer = (a.assignedTo||a.auditeurs||[]).indexOf(CU&&CU.id)>=0 || isAdmin;

  var wpAll = (d.workProgramBU && Array.isArray(d.workProgramBU.processes))
    ? d.workProgramBU.processes : [];
  // Ne lister que les Process en mode "Design + Operating" (les "Design only" n'ont pas de tests à exécuter)
  var wp = wpAll.filter(function(wpp){return _wppCoverageMode(wpp) === 'design_and_operating';});
  var designOnlyCount = wpAll.length - wp.length;

  var html = '';
  html += '<div class="cd" style="margin-bottom:1rem">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
  html += '<span style="font-size:13px;font-weight:500">Testings <span style="color:var(--text-3);font-weight:400">— '+wp.length+' process à tester'+(wp.length>1?'s':'')+'</span></span>';
  html += '</div>';
  html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;margin-bottom:14px">Réalise les tests substantifs définis au Work Program. Pour chaque anomalie identifiée, remonte une issue Operating qui pourra être agrégée dans un finding à l\'étape Report.';
  if (designOnlyCount > 0) {
    html += ' <span style="color:#854F0B">'+designOnlyCount+' process en mode Design only ne sont pas affichés ici (ils sont revus à l\'étape Interviews uniquement).</span>';
  }
  html += '</div>';

  if (!wp.length) {
    if (wpAll.length > 0) {
      html += '<div style="font-size:12px;color:var(--text-3);font-style:italic;padding:1.5rem;text-align:center;border:1px dashed var(--border);border-radius:6px">Tous les Process couverts sont en mode <strong>Design only</strong> (revus en interview uniquement). Aucun test substantif à réaliser ici.</div>';
    } else {
      html += '<div style="font-size:12px;color:var(--text-3);font-style:italic;padding:1.5rem;text-align:center;border:1px dashed var(--border);border-radius:6px">Aucun Process couvert dans cet audit. Retourne à l\'étape Work Program pour en ajouter.</div>';
    }
    html += '</div>';
    return html;
  }

  wp.forEach(function(wpp){
    html += renderTestingsBuProcessCard(wpp, isPreparer);
  });

  html += '</div>';
  return html;
}

function renderTestingsBuProcessCard(wpp, isPreparer) {
  var p = (PROCESSES||[]).find(function(x){return x.id===wpp.auditProcessId;});
  var procName = p ? p.proc : '(Process introuvable)';
  var tests = Array.isArray(wpp.tests) ? wpp.tests : [];
  var testCount = tests.length;
  var doneCount = tests.filter(function(t){return t.testStatus==='fait';}).length;
  var inProgressCount = tests.filter(function(t){return t.testStatus==='en cours';}).length;
  var failCount = tests.filter(function(t){return (t.anomalies && t.anomalies.count > 0);}).length;
  var collapsed = !!_testingsBuCollapsed[wpp.id];

  var h = '';
  h += '<div style="border:.5px solid var(--border);border-radius:6px;margin-bottom:8px;background:#fff">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:'+(collapsed?'none':'.5px solid #f0f0f0')+';background:#fafafa;cursor:pointer" onclick="toggleTestingsBuProcess(\''+_escJsArg(wpp.id)+'\')">';
  h += '<div style="flex:1;min-width:0">';
  h += '<div style="font-size:13px;font-weight:500">'+(collapsed?'▶ ':'▼ ')+(''+procName).replace(/</g,'&lt;')+'</div>';
  h += '<div style="font-size:11px;color:var(--purple);margin-top:3px">'
    + testCount+(testCount>1?' tests':' test')
    + ' · '+doneCount+' fait'+(doneCount>1?'s':'')
    + (inProgressCount?' · '+inProgressCount+' en cours':'')
    + (failCount?' · <span style="color:var(--red);font-weight:500">'+failCount+' avec anomalies</span>':'')
    + '</div>';
  h += '</div>';
  h += '</div>';

  if (!collapsed) {
    h += '<div style="padding:8px 14px">';
    if (!testCount) {
      h += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:8px 0;text-align:center">Aucun test pour ce process. Retourne au Work Program pour en ajouter.</div>';
    } else {
      tests.forEach(function(t){
        h += renderTestingsBuTestRow(wpp.id, t, isPreparer);
      });
    }
    h += '</div>';
  }

  h += '</div>';
  return h;
}

function renderTestingsBuTestRow(wppId, t, isPreparer) {
  if (!t.population) t.population = {count:'', value:''};
  if (!t.sample) t.sample = {count:'', value:''};
  if (!t.anomalies) t.anomalies = {count:'', value:''};
  if (!t.testStatus) t.testStatus = 'à faire';
  if (!t.selectionMethod) t.selectionMethod = '';

  var status = t.testStatus;
  var statusColor = status==='fait' ? '#085041' : status==='en cours' ? '#0C447C' : '#854F0B';
  var statusBg = status==='fait' ? '#E1F5EE' : status==='en cours' ? '#E6F1FB' : '#FAEEDA';

  var hasAnomalies = (t.anomalies.count !== '' && Number(t.anomalies.count) > 0);
  var rowBorder = hasAnomalies ? 'border:1px solid #E24B4A' : 'border:.5px solid var(--border)';

  // Issue operating inline pour ce test (au plus 1 par test dans le nouveau modèle)
  var d = getAudData(CA);
  var issue = (d.issues||[]).find(function(iss){
    return iss.source==='operating' && iss.processId===wppId && iss.testId===t.id;
  });
  var hasIssue = !!(issue && issue.description && issue.description.trim());

  var extrap = _computeExtrapolation(t);

  var h = '';
  h += '<div style="'+rowBorder+';border-radius:5px;padding:10px 12px;margin-bottom:8px;background:'+(hasAnomalies?'#FFF8F8':'#fff')+'">';

  h += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap">';
  h += '<span style="background:var(--purple);color:#fff;font-size:9px;padding:2px 7px;border-radius:3px;font-family:monospace;letter-spacing:.4px">'+(t.code||'').replace(/</g,'&lt;')+'</span>';
  h += '<span style="background:#FAEEDA;color:#854F0B;font-size:9px;padding:2px 7px;border-radius:3px">'+(t.testType||'').replace(/</g,'&lt;')+'</span>';
  h += '<span style="background:'+statusBg+';color:'+statusColor+';font-size:9px;padding:2px 7px;border-radius:3px;font-weight:500">'+status+'</span>';
  if (hasAnomalies) {
    h += '<span style="background:#FCEBEB;color:#A32D2D;font-size:9px;padding:2px 7px;border-radius:3px;font-weight:500">⚠ ANOMALIES</span>';
  }
  if (hasIssue) {
    h += '<span style="background:#EEEDFE;color:#3C3489;font-size:9px;padding:2px 7px;border-radius:3px;font-weight:500">ISSUE</span>';
  }
  h += '</div>';

  h += '<div style="font-size:11px;font-weight:500;margin-bottom:4px">'+(''+(t.statement||'(sans énoncé)')).replace(/</g,'&lt;')+'</div>';
  if (t.objective) h += '<div style="font-size:10px;color:var(--text-3);font-style:italic;margin-bottom:6px">Objectif : '+(''+t.objective).replace(/</g,'&lt;')+'</div>';

  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
  h += '<div>';
  h += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Statut du test</label>';
  if (isPreparer) {
    h += '<select onchange="setTestingsBuField(\''+_escJsArg(wppId)+'\',\''+_escJsArg(t.id)+'\',\'testStatus\',this.value)" style="width:100%;font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px;background:'+statusBg+';color:'+statusColor+';font-weight:500">';
    TEST_STATUSES.forEach(function(s){
      h += '<option'+(t.testStatus===s?' selected':'')+'>'+s+'</option>';
    });
    h += '</select>';
  } else {
    h += '<div style="font-size:11px;padding:5px 8px">'+t.testStatus+'</div>';
  }
  h += '</div>';
  h += '<div>';
  h += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Méthode de sélection</label>';
  if (isPreparer) {
    h += '<select onchange="setTestingsBuField(\''+_escJsArg(wppId)+'\',\''+_escJsArg(t.id)+'\',\'selectionMethod\',this.value)" style="width:100%;font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px;background:#fff">';
    h += '<option value=""'+(!t.selectionMethod?' selected':'')+'>— Choisir —</option>';
    h += '<option'+(t.selectionMethod==='Coverage'?' selected':'')+'>Coverage</option>';
    h += '<option'+(t.selectionMethod==='Aléatoire'?' selected':'')+'>Aléatoire</option>';
    h += '<option'+(t.selectionMethod==='Mix'?' selected':'')+'>Mix</option>';
    h += '</select>';
  } else {
    h += '<div style="font-size:11px;padding:5px 8px">'+(t.selectionMethod||'—')+'</div>';
  }
  h += '</div>';
  h += '</div>';

  h += '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px">';
  h += '<thead><tr style="background:#f5f5f0">';
  h += '<th style="text-align:left;padding:5px 8px;font-size:9px;color:var(--text-3);font-weight:500;text-transform:uppercase;letter-spacing:.3px;border:.5px solid var(--border)"></th>';
  h += '<th style="text-align:right;padding:5px 8px;font-size:9px;color:var(--text-3);font-weight:500;border:.5px solid var(--border)">Population</th>';
  h += '<th style="text-align:right;padding:5px 8px;font-size:9px;color:var(--text-3);font-weight:500;border:.5px solid var(--border)">Échantillon testé</th>';
  h += '<th style="text-align:right;padding:5px 8px;font-size:9px;color:var(--text-3);font-weight:500;border:.5px solid var(--border)">Anomalies</th>';
  h += '</tr></thead><tbody>';
  h += '<tr>';
  h += '<td style="padding:5px 8px;color:var(--text-3);border:.5px solid var(--border)">Nombre</td>';
  ['population','sample','anomalies'].forEach(function(field){
    var val = t[field].count;
    h += '<td style="padding:3px 5px;border:.5px solid var(--border)">';
    if (isPreparer) {
      h += '<input type="number" min="0" value="'+_escAttr(val)+'" placeholder="0" onchange="setTestingsBuSubField(\''+_escJsArg(wppId)+'\',\''+_escJsArg(t.id)+'\',\''+field+'\',\'count\',this.value)" style="width:100%;font-size:11px;padding:4px 6px;border:1px solid var(--border);border-radius:3px;text-align:right;box-sizing:border-box"/>';
    } else {
      h += '<div style="text-align:right;padding:4px 6px">'+_fmtNum(val)+'</div>';
    }
    h += '</td>';
  });
  h += '</tr>';
  h += '<tr>';
  h += '<td style="padding:5px 8px;color:var(--text-3);border:.5px solid var(--border)">Valeur (€)</td>';
  ['population','sample','anomalies'].forEach(function(field){
    var val = t[field].value;
    h += '<td style="padding:3px 5px;border:.5px solid var(--border)">';
    if (isPreparer) {
      h += '<input type="number" min="0" step="0.01" value="'+_escAttr(val)+'" placeholder="(facultatif)" onchange="setTestingsBuSubField(\''+_escJsArg(wppId)+'\',\''+_escJsArg(t.id)+'\',\''+field+'\',\'value\',this.value)" style="width:100%;font-size:11px;padding:4px 6px;border:1px solid var(--border);border-radius:3px;text-align:right;box-sizing:border-box"/>';
    } else {
      h += '<div style="text-align:right;padding:4px 6px">'+_fmtEur(val)+'</div>';
    }
    h += '</td>';
  });
  h += '</tr>';
  h += '</tbody></table>';

  h += '<div style="background:'+(extrap.applicable?'#EEEDFE':'#F1EFE8')+';border-radius:4px;padding:8px 10px;margin-bottom:8px">';
  h += '<div style="font-size:10px;color:'+(extrap.applicable?'#3C3489':'#5F5E5A')+';font-weight:600;margin-bottom:3px;text-transform:uppercase;letter-spacing:.3px">Extrapolation auto</div>';
  if (!extrap.applicable) {
    h += '<div style="font-size:11px;color:var(--text-3);font-style:italic">'+extrap.reason+'</div>';
  } else if (extrap.reason) {
    h += '<div style="font-size:11px;color:#3C3489">'+extrap.reason+'</div>';
  } else {
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:11px;color:#3C3489">';
    h += '<div><span style="font-weight:500">'+_fmtNum(extrap.countExtrapolated)+'</span> cas potentiellement impactés</div>';
    if (extrap.valueExtrapolated !== null) {
      h += '<div><span style="font-weight:500">'+_fmtEur(extrap.valueExtrapolated)+'</span> d\'impact estimé</div>';
    } else {
      h += '<div style="color:var(--text-3);font-style:italic">Saisissez les valeurs (€) pour estimer l\'impact financier</div>';
    }
    h += '</div>';
  }
  h += '</div>';

  // Issue Description inline (remplace l'ancienne section "Observations" + modale Issue Operating)
  // Une issue Operating EST cette description sur un test. Si vide → pas d'issue.
  // Réutilise la variable `issue` déjà définie en début de fonction.
  var issueDesc = issue ? (issue.description||'') : '';

  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">';
  h += '<label style="font-size:9px;color:var(--text-3)">Issue description <span style="font-style:italic">(remontée dans le rapport — bouton ci-contre pour pré-remplir avec les résultats du test)</span></label>';
  if (isPreparer) {
    h += '<button class="bs" style="font-size:10px;padding:2px 7px" onclick="prefillBuIssueDescription(\''+_escJsArg(wppId)+'\',\''+_escJsArg(t.id)+'\')" title="Pré-remplir depuis les résultats du test">📋 Pré-remplir</button>';
  }
  h += '</div>';
  if (isPreparer) {
    h += '<textarea id="iss-desc-'+_escAttr(t.id)+'" onchange="setBuIssueDescription(\''+_escJsArg(wppId)+'\',\''+_escJsArg(t.id)+'\',this.value)" style="width:100%;min-height:60px;font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px;resize:vertical;font-family:inherit;box-sizing:border-box;margin-bottom:4px" placeholder="Détail des anomalies trouvées, contexte, ce qui sera remonté dans le rapport...">'+issueDesc.replace(/</g,'&lt;')+'</textarea>';
  } else {
    h += '<div style="font-size:11px;padding:5px 8px;background:#fafafa;border-radius:3px;margin-bottom:4px;white-space:pre-wrap">'+(issueDesc||'—').replace(/</g,'&lt;')+'</div>';
  }

  h += '</div>';
  return h;
}

function toggleTestingsBuProcess(wppId) {
  _testingsBuCollapsed[wppId] = !_testingsBuCollapsed[wppId];
  document.getElementById('det-content').innerHTML = renderDetContent();
}

async function setTestingsBuField(wppId, testId, field, val) {
  var d = getAudData(CA);
  var wp = (d.workProgramBU && Array.isArray(d.workProgramBU.processes))
    ? d.workProgramBU.processes : [];
  var wpp = wp.find(function(x){return x.id===wppId;});
  if (!wpp) return;
  var t = (wpp.tests||[]).find(function(x){return x.id===testId;});
  if (!t) return;
  t[field] = val;
  await saveAuditData(CA);
  if (field === 'testStatus' || field === 'selectionMethod') {
    document.getElementById('det-content').innerHTML = renderDetContent();
  }
}

async function setTestingsBuSubField(wppId, testId, group, sub, val) {
  var d = getAudData(CA);
  var wp = (d.workProgramBU && Array.isArray(d.workProgramBU.processes))
    ? d.workProgramBU.processes : [];
  var wpp = wp.find(function(x){return x.id===wppId;});
  if (!wpp) return;
  var t = (wpp.tests||[]).find(function(x){return x.id===testId;});
  if (!t) return;
  if (!t[group]) t[group] = {};
  t[group][sub] = val === '' ? '' : Number(val);
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}

// Sauvegarde de l'issue description inline (saisie directement dans le test)
// Si la description est vide → on supprime l'issue (s'il y en a une)
// Si la description est non-vide → on crée ou met à jour l'issue
async function setBuIssueDescription(wppId, testId, description) {
  var d = getAudData(CA);
  _ensureIssues(d);
  var trimmed = (description || '').trim();
  // Trouver l'issue existante pour ce test
  var existing = d.issues.find(function(iss){
    return iss.source==='operating' && iss.processId===wppId && iss.testId===testId;
  });
  if (!trimmed) {
    // Description vide → supprimer l'issue si elle existe
    if (existing) {
      // Nettoyer les références dans les findings
      (d.findings||[]).forEach(function(f){
        if (Array.isArray(f.issueIds)) {
          f.issueIds = f.issueIds.filter(function(id){return id!==existing.id;});
        }
      });
      d.issues = d.issues.filter(function(x){return x.id!==existing.id;});
      await saveAuditData(CA);
      // Re-render pour mettre à jour les badges
      document.getElementById('det-content').innerHTML = renderDetContent();
    }
    return;
  }
  // Description non-vide → créer ou mettre à jour
  if (existing) {
    existing.description = trimmed;
    await saveAuditData(CA);
  } else {
    await _createIssue({
      source: 'operating',
      processId: wppId,
      testId: testId,
      title: '', // pas de titre, le code du test sert d'identifiant
      description: trimmed,
    });
    // Re-render pour faire apparaître le badge ISSUE
    document.getElementById('det-content').innerHTML = renderDetContent();
  }
}

// Pré-remplit la zone Issue Description avec un résumé des résultats du test.
// Conserve ce que l'auditeur a déjà tapé (en l'ajoutant à la suite ?) — non, on remplace,
// puisque c'est un bouton volontaire (l'auditeur l'a cliqué intentionnellement).
function prefillBuIssueDescription(wppId, testId) {
  var d = getAudData(CA);
  var wp = (d.workProgramBU && Array.isArray(d.workProgramBU.processes))
    ? d.workProgramBU.processes : [];
  var wpp = wp.find(function(x){return x.id===wppId;});
  if (!wpp) return;
  var t = (wpp.tests||[]).find(function(x){return x.id===testId;});
  if (!t) return;

  var smp = t.sample || {};
  var ano = t.anomalies || {};

  // Construire une description synthétique
  var lines = [];
  var hasAnomalies = (ano.count !== '' && Number(ano.count) > 0);

  if (!hasAnomalies) {
    if (smp.count) {
      lines.push('Test sur '+_fmtNum(smp.count)+' '+(t.selectionMethod==='Coverage'?'cas ciblés':'cas')+' : aucune anomalie identifiée.');
    } else {
      lines.push('Test non finalisé — saisis la population, l\'échantillon et les anomalies pour pré-remplir.');
    }
  } else {
    var line = 'Test sur '+_fmtNum(smp.count)+' '+(t.selectionMethod==='Coverage'?'cas ciblés':'cas')
      +' : '+_fmtNum(ano.count)+' anomalie'+(Number(ano.count)>1?'s':'');
    if (ano.value) line += ' ('+_fmtEur(ano.value)+' d\'écarts)';
    line += '.';
    lines.push(line);
    if (t.selectionMethod === 'Aléatoire' || t.selectionMethod === 'Mix') {
      var extrap = _computeExtrapolation(t);
      if (extrap.applicable && extrap.countExtrapolated > 0) {
        var extrapLine = 'Extrapolation : '+_fmtNum(extrap.countExtrapolated)+' cas potentiellement impactés';
        if (extrap.valueExtrapolated) extrapLine += ' (~'+_fmtEur(extrap.valueExtrapolated)+' d\'impact estimé)';
        extrapLine += '.';
        lines.push(extrapLine);
      }
    }
  }

  var newDesc = lines.join('\n');

  // Confirmation si le textarea contient déjà du texte
  var ta = document.getElementById('iss-desc-'+t.id);
  if (ta && ta.value.trim() && ta.value.trim() !== newDesc) {
    if (!confirm('La description contient déjà du texte. Le remplacer par le pré-remplissage ?\n\n(Pour ajouter à la suite, copie-colle manuellement.)')) {
      return;
    }
  }

  // Mettre à jour le textarea + sauvegarder
  if (ta) ta.value = newDesc;
  setBuIssueDescription(wppId, testId, newDesc);
}

// ════════════════════════════════════════════════════════════════════
//  ÉTAPE 7 (BU) — Findings agrégeant des Issues
//
//  Pour les audits BU : à l'étape Report, l'auditeur voit :
//   1. Les Findings existants (groupés par Process)
//   2. Les Issues non agrégées (qui ne sont dans aucun finding) — pour
//      ne rien oublier dans le rapport
//   3. Un bouton "+ Créer un finding" qui ouvre une modale permettant
//      de sélectionner un Process principal + cocher 1+ Issues à inclure
//
//  Modèle finding (étendu) : ajout du champ `issueIds: ['iss_xxx', ...]`
//  qui référence les issues incluses dans ce finding.
//  Le `processId` du finding référence un wpProc id (Process couvert).
// ════════════════════════════════════════════════════════════════════

// Helpers

function _allIssues() {
  var d = getAudData(CA);
  return Array.isArray(d.issues) ? d.issues : [];
}

// Ids des issues qui sont déjà dans au moins 1 finding
function _aggregatedIssueIds() {
  var d = getAudData(CA);
  var s = {};
  (d.findings||[]).forEach(function(f){
    if (Array.isArray(f.issueIds)) f.issueIds.forEach(function(id){s[id]=true;});
  });
  return s;
}

function _getWppById(wppId) {
  var d = getAudData(CA);
  var wp = (d.workProgramBU && Array.isArray(d.workProgramBU.processes))
    ? d.workProgramBU.processes : [];
  return wp.find(function(x){return x.id===wppId;}) || null;
}

function _getProcNameForWpp(wppId) {
  var wpp = _getWppById(wppId);
  if (!wpp) return '(Process introuvable)';
  var p = (PROCESSES||[]).find(function(x){return x.id===wpp.auditProcessId;});
  return p ? p.proc : '(Process introuvable)';
}

// Construit un libellé court d'issue pour les listes
function _issueShortLabel(iss) {
  if (iss.source === 'design') {
    return (iss.title || '(sans titre)') + (iss.description ? ' — '+iss.description.split('\n')[0].slice(0,80) : '');
  }
  // operating : code du test + début de description
  var code = _getIssueTestCode(iss) || '?';
  var desc = (iss.description || '').split('\n')[0].slice(0, 100);
  return code + ' : ' + (desc || '(sans description)');
}

// ────────────────────────────────────────────────────────────────────
//  RENDU PRINCIPAL — Section Findings BU
// ────────────────────────────────────────────────────────────────────

function renderFindingsBuSection() {
  var d = getAudData(CA);
  if (!Array.isArray(d.findings)) d.findings = [];
  _ensureIssues(d);
  var a = AUDIT_PLAN.find(function(x){return x.id===CA;});
  var isAdmin = CU && CU.role==='admin';
  var isPreparer = (a.assignedTo||a.auditeurs||[]).indexOf(CU&&CU.id)>=0 || isAdmin;

  var allIssues = d.issues;
  var aggregated = _aggregatedIssueIds();
  var unaggregatedIssues = allIssues.filter(function(iss){return !aggregated[iss.id];});

  var html = '';

  // ─── Bloc 1 : Findings ─────────────────────────────────────
  html += '<div class="cd" style="margin-bottom:1rem">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
  html += '<span style="font-size:13px;font-weight:500">Findings <span style="color:var(--text-3);font-weight:400">('+d.findings.length+')</span></span>';
  if (isPreparer) {
    html += '<button class="bp" style="font-size:11px;padding:4px 10px" onclick="showBuFindingModal(null)">+ Créer un finding</button>';
  }
  html += '</div>';
  html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;margin-bottom:14px">Crée des findings en agrégeant 1 ou plusieurs Issues identifiées aux étapes Interviews (Design) et Testings (Operating). Un finding peut combiner les deux types.</div>';

  if (!d.findings.length) {
    html += '<div style="font-size:12px;color:var(--text-3);font-style:italic;padding:1rem;text-align:center;border:1px dashed var(--border);border-radius:6px">Aucun finding. ';
    if (isPreparer) html += 'Cliquez sur « + Créer un finding » pour en créer un.';
    html += '</div>';
  } else {
    // Grouper par Process principal
    var byProcess = {};
    d.findings.forEach(function(f){
      var key = f.processId || '_unassigned';
      if (!byProcess[key]) byProcess[key] = [];
      byProcess[key].push(f);
    });
    Object.keys(byProcess).forEach(function(procId){
      var procName = procId === '_unassigned' ? '(Process non assigné)' : _getProcNameForWpp(procId);
      html += '<div style="background:#EEEDFE;color:#3C3489;font-weight:600;padding:6px 10px;font-size:11px;border-radius:4px;margin-bottom:6px;margin-top:8px">'+procName.replace(/</g,'&lt;')+'</div>';
      byProcess[procId].forEach(function(f){
        var fIdx = d.findings.indexOf(f);
        html += renderBuFindingCard(f, fIdx, isPreparer);
      });
    });
  }

  html += '</div>';

  // ─── Bloc 2 : Issues non agrégées ──────────────────────────
  html += '<div class="cd" style="margin-bottom:1rem">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
  html += '<span style="font-size:13px;font-weight:500">Issues non agrégées <span style="color:var(--text-3);font-weight:400">('+unaggregatedIssues.length+')</span></span>';
  html += '</div>';
  html += '<div style="font-size:11px;color:var(--text-3);font-style:italic;margin-bottom:14px">Issues identifiées (Design ou Operating) qui ne sont pas encore incluses dans un finding. Pour ne rien oublier dans le rapport, transforme-les en finding.</div>';

  if (!unaggregatedIssues.length) {
    if (allIssues.length === 0) {
      html += '<div style="font-size:12px;color:var(--text-3);font-style:italic;padding:1rem;text-align:center;border:1px dashed var(--border);border-radius:6px">Aucune issue saisie aux étapes Interviews/Testings.</div>';
    } else {
      html += '<div style="font-size:12px;color:var(--green);padding:1rem;text-align:center;border:1px dashed var(--green);border-radius:6px;background:#E1F5EE">✓ Toutes les issues ont été agrégées dans des findings.</div>';
    }
  } else {
    // Grouper par Process
    var byProcessIssues = {};
    unaggregatedIssues.forEach(function(iss){
      var key = iss.processId || '_unassigned';
      if (!byProcessIssues[key]) byProcessIssues[key] = [];
      byProcessIssues[key].push(iss);
    });
    Object.keys(byProcessIssues).forEach(function(procId){
      var procName = procId === '_unassigned' ? '(Process non assigné)' : _getProcNameForWpp(procId);
      html += '<div style="background:#FAEEDA;color:#854F0B;font-weight:600;padding:6px 10px;font-size:11px;border-radius:4px;margin-bottom:6px;margin-top:8px">'+procName.replace(/</g,'&lt;')+'</div>';
      byProcessIssues[procId].forEach(function(iss){
        html += renderUnaggregatedIssueRow(iss, isPreparer);
      });
    });
  }

  html += '</div>';

  return html;
}

function renderBuFindingCard(f, fIdx, isPreparer) {
  var d = getAudData(CA);
  var includedIssues = (f.issueIds||[]).map(function(id){
    return d.issues.find(function(x){return x.id===id;});
  }).filter(Boolean);

  var designCount = includedIssues.filter(function(i){return i.source==='design';}).length;
  var operatingCount = includedIssues.filter(function(i){return i.source==='operating';}).length;

  var h = '';
  h += '<div style="border:.5px solid var(--border);border-radius:5px;padding:11px 13px;margin-bottom:8px;background:#fafafa;position:relative">';
  if (isPreparer) {
    h += '<div style="position:absolute;top:8px;right:8px;display:flex;gap:3px">';
    h += '<button class="bs" style="font-size:10px;padding:2px 7px" onclick="showBuFindingModal('+fIdx+')">Modifier</button>';
    h += '<button class="bd" style="font-size:10px;padding:2px 7px" onclick="removeBuFinding('+fIdx+')" title="Supprimer">×</button>';
    h += '</div>';
  }
  // Titre
  h += '<div style="font-size:13px;font-weight:600;margin-bottom:4px;padding-right:80px">'+(''+(f.title||'(sans titre)')).replace(/</g,'&lt;')+'</div>';
  // Description courte
  if (f.descExec) {
    h += '<div style="font-size:11px;color:var(--text-2);margin-bottom:6px;line-height:1.4">'+(''+f.descExec).replace(/</g,'&lt;')+'</div>';
  }
  // Méta : owner / proba / impact
  var meta = [];
  if (f.owner) meta.push('Owner : '+f.owner);
  if (f.probability) meta.push('Probabilité : '+f.probability);
  if (f.impact) meta.push('Impact : '+f.impact);
  if (meta.length) {
    h += '<div style="font-size:10px;color:var(--text-3);margin-bottom:7px;font-style:italic">'+meta.join(' · ').replace(/</g,'&lt;')+'</div>';
  }
  // Issues incluses
  h += '<div style="border-top:.5px dashed var(--border);padding-top:6px;margin-top:4px">';
  h += '<div style="font-size:10px;font-weight:600;color:var(--text-2);margin-bottom:4px">Issues incluses · '
    + includedIssues.length;
  if (designCount && operatingCount) {
    h += ' <span style="font-weight:400;color:var(--text-3)">('+designCount+' design + '+operatingCount+' operating)</span>';
  } else if (designCount) {
    h += ' <span style="font-weight:400;color:var(--text-3)">('+designCount+' design)</span>';
  } else if (operatingCount) {
    h += ' <span style="font-weight:400;color:var(--text-3)">('+operatingCount+' operating)</span>';
  }
  h += '</div>';
  if (!includedIssues.length) {
    h += '<div style="font-size:10px;color:var(--text-3);font-style:italic">Aucune issue rattachée.</div>';
  } else {
    includedIssues.forEach(function(iss){
      var badgeColor = iss.source==='design' ? '#854F0B' : '#085041';
      var badgeBg = iss.source==='design' ? '#FAEEDA' : '#E1F5EE';
      var badgeLabel = iss.source==='design' ? 'DESIGN' : 'OPERATING';
      h += '<div style="display:flex;align-items:flex-start;gap:6px;padding:3px 0">';
      h += '<span style="background:'+badgeBg+';color:'+badgeColor+';font-size:9px;padding:2px 6px;border-radius:3px;font-weight:500;flex-shrink:0;margin-top:2px">'+badgeLabel+'</span>';
      h += '<div style="flex:1;min-width:0;font-size:10px;color:var(--text-2)">'+_issueShortLabel(iss).replace(/</g,'&lt;')+'</div>';
      h += '</div>';
    });
  }
  h += '</div>';
  h += '</div>';
  return h;
}

function renderUnaggregatedIssueRow(iss, isPreparer) {
  var badgeColor = iss.source==='design' ? '#854F0B' : '#085041';
  var badgeBg = iss.source==='design' ? '#FAEEDA' : '#E1F5EE';
  var badgeLabel = iss.source==='design' ? 'DESIGN' : 'OPERATING';

  var h = '';
  h += '<div style="border:.5px solid var(--border);border-radius:5px;padding:8px 11px;margin-bottom:5px;background:#fff;display:flex;align-items:flex-start;gap:8px">';
  h += '<span style="background:'+badgeBg+';color:'+badgeColor+';font-size:9px;padding:2px 6px;border-radius:3px;font-weight:500;flex-shrink:0;margin-top:2px">'+badgeLabel+'</span>';
  h += '<div style="flex:1;min-width:0">';
  if (iss.title) {
    h += '<div style="font-size:11px;font-weight:500">'+(''+iss.title).replace(/</g,'&lt;')+'</div>';
  } else if (iss.source === 'operating') {
    var code = _getIssueTestCode(iss);
    if (code) h += '<div style="font-size:10px;color:var(--text-3);font-family:monospace">'+code+'</div>';
  }
  if (iss.description) {
    h += '<div style="font-size:10px;color:var(--text-2);margin-top:1px;white-space:pre-wrap">'+(''+iss.description).replace(/</g,'&lt;')+'</div>';
  }
  h += '</div>';
  if (isPreparer) {
    h += '<button class="bs" style="font-size:10px;padding:3px 8px;flex-shrink:0;white-space:nowrap" onclick="showBuFindingModal(null,\''+_escJsArg(iss.id)+'\')">→ Créer un finding</button>';
  }
  h += '</div>';
  return h;
}

// ────────────────────────────────────────────────────────────────────
//  MODALE — Création / édition d'un finding BU
//  Si findingIdx est null, c'est une création.
//  Si seedIssueId est fourni (depuis "Issues non agrégées"), on
//  pré-coche cette issue + on pré-sélectionne son Process.
// ────────────────────────────────────────────────────────────────────

function showBuFindingModal(findingIdx, seedIssueId) {
  var d = getAudData(CA);
  if (!Array.isArray(d.findings)) d.findings = [];
  _ensureIssues(d);
  var existing = (findingIdx !== null && findingIdx !== undefined) ? d.findings[findingIdx] : null;
  var f = existing || {};

  // Process couverts
  var wp = (d.workProgramBU && Array.isArray(d.workProgramBU.processes))
    ? d.workProgramBU.processes : [];
  if (!wp.length) {
    toast('Aucun Process couvert dans cet audit.');
    return;
  }

  // Pré-sélection : process du finding existant, ou process de la seed issue, ou rien
  var preSelectedProcId = f.processId || '';
  if (!preSelectedProcId && seedIssueId) {
    var seedIss = d.issues.find(function(x){return x.id===seedIssueId;});
    if (seedIss) preSelectedProcId = seedIss.processId || '';
  }

  var procOptions = wp.map(function(wpp){
    var p = (PROCESSES||[]).find(function(x){return x.id===wpp.auditProcessId;});
    var name = p ? p.proc : '(Process introuvable)';
    return '<option value="'+_escAttr(wpp.id)+'"'+(preSelectedProcId===wpp.id?' selected':'')+'>'+name.replace(/</g,'&lt;')+'</option>';
  }).join('');

  // Construire le panneau d'issues — sera rendu dynamiquement par updateBuFindingIssuesPanel
  // Il dépend du Process sélectionné. On rend juste un placeholder.

  var body = '';
  body += '<div><label>Process principal <span style="color:var(--red)">*</span></label>';
  body += '<select id="bf-proc" onchange="updateBuFindingIssuesPanel()"><option value="">— Choisir un Process —</option>'+procOptions+'</select></div>';
  body += '<div><label>Titre du finding <span style="color:var(--red)">*</span></label>';
  body += '<input id="bf-title" value="'+_escAttr(f.title)+'" placeholder="ex : Ségrégation des tâches insuffisante en P2P"/></div>';
  body += '<div><label>Description courte (Executive Summary)</label>';
  body += '<div style="font-size:10px;color:var(--text-3);font-style:italic;margin-bottom:3px">2-3 lignes — apparaîtra en synthèse du rapport.</div>';
  body += '<textarea id="bf-desc-exec" style="width:100%;min-height:50px">'+(''+(f.descExec||'')).replace(/</g,'&lt;')+'</textarea></div>';
  body += '<div><label>Description détaillée</label>';
  body += '<textarea id="bf-desc-detail" style="width:100%;min-height:80px" placeholder="Constat complet : combine les issues design + operating, contexte business, références aux tests...">'+(''+(f.descDetailed||f.desc||'')).replace(/</g,'&lt;')+'</textarea></div>';
  body += '<div><label>Risque potentiel</label>';
  body += '<textarea id="bf-risk" style="width:100%;min-height:50px" placeholder="ex : Pertes de marge non maîtrisées, fraude possible...">'+(''+(f.potentialRisk||'')).replace(/</g,'&lt;')+'</textarea></div>';
  body += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">';
  body += '<div><label>Owner</label><input id="bf-owner" value="'+_escAttr(f.owner)+'" placeholder="ex : Sales Director"/></div>';
  body += '<div><label>Probability</label>';
  body += '<select id="bf-prob"><option value="">—</option>';
  ['rare','unlikely','possible','certain'].forEach(function(p){
    body += '<option value="'+p+'"'+(f.probability===p?' selected':'')+'>'+p.charAt(0).toUpperCase()+p.slice(1)+'</option>';
  });
  body += '</select></div>';
  body += '<div><label>Impact</label>';
  body += '<select id="bf-imp"><option value="">—</option>';
  ['minor','limited','major','severe'].forEach(function(i){
    body += '<option value="'+i+'"'+(f.impact===i?' selected':'')+'>'+i.charAt(0).toUpperCase()+i.slice(1)+'</option>';
  });
  body += '</select></div>';
  body += '</div>';
  // Panel des issues à inclure (mis à jour quand le Process change)
  body += '<div style="margin-top:10px;width:100%;min-width:0;box-sizing:border-box">';
  body += '<label>Issues à inclure dans ce finding</label>';
  body += '<div style="font-size:10px;color:var(--text-3);font-style:italic;margin-bottom:5px">Les issues du Process sélectionné sont en haut. Tu peux aussi en cocher d\'autres provenant d\'autres Process si pertinent.</div>';
  body += '<div id="bf-issues-panel" style="border:.5px solid var(--border);border-radius:4px;max-height:300px;overflow-y:auto;overflow-x:hidden;background:#fafafa;width:100%;box-sizing:border-box"></div>';
  body += '</div>';

  // Stocker pour le helper updateBuFindingIssuesPanel
  window._buFindingCtx = {
    existing: existing,
    seedIssueId: seedIssueId,
    initialIssueIds: existing ? (existing.issueIds||[]).slice() : (seedIssueId ? [seedIssueId] : []),
  };

  openModal(existing ? 'Modifier le finding' : 'Nouveau finding', body, async function(){
    var processId = document.getElementById('bf-proc').value;
    var title = document.getElementById('bf-title').value.trim();
    if (!processId) { toast('Process principal obligatoire'); return; }
    if (!title) { toast('Titre obligatoire'); return; }
    var checkedIssueIds = [];
    document.querySelectorAll('.bf-iss-cb:checked').forEach(function(cb){checkedIssueIds.push(cb.value);});

    var payload = {
      processId: processId,
      title: title,
      descExec: document.getElementById('bf-desc-exec').value.trim(),
      descDetailed: document.getElementById('bf-desc-detail').value.trim(),
      desc: document.getElementById('bf-desc-detail').value.trim(),
      potentialRisk: document.getElementById('bf-risk').value.trim(),
      owner: document.getElementById('bf-owner').value.trim(),
      probability: document.getElementById('bf-prob').value,
      impact: document.getElementById('bf-imp').value,
      issueIds: checkedIssueIds,
    };

    if (existing) {
      Object.assign(existing, payload);
      await saveAuditData(CA);
      addHist('edit', 'Finding "'+title+'" modifié');
      toast('Finding modifié ✓');
    } else {
      var dd = getAudData(CA);
      if (!Array.isArray(dd.findings)) dd.findings = [];
      dd.findings.push(Object.assign({
        id: 'f_'+Date.now()+'_'+Math.floor(Math.random()*100000),
        controlIds: [],
        createdAt: new Date().toISOString(),
      }, payload));
      await saveAuditData(CA);
      addHist('add', 'Finding "'+title+'" créé');
      toast('Finding ajouté ✓');
    }
    document.getElementById('det-content').innerHTML = renderDetContent();
    delete window._buFindingCtx;
  }, { wide: true });

  // Initialiser le panel d'issues APRÈS l'ouverture de la modale
  setTimeout(updateBuFindingIssuesPanel, 50);
}

// Met à jour le panel des issues à inclure (groupées par Process, avec Process sélectionné en haut)
// Appelé à l'ouverture de la modale + à chaque changement du Process principal
function updateBuFindingIssuesPanel() {
  var panel = document.getElementById('bf-issues-panel');
  if (!panel) return;
  var d = getAudData(CA);
  _ensureIssues(d);
  var allIssues = d.issues;
  if (!allIssues.length) {
    panel.innerHTML = '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:12px;text-align:center">Aucune issue saisie aux étapes précédentes. Saisis des issues Design (étape Interviews) ou Operating (étape Testings) avant de créer un finding.</div>';
    return;
  }
  var ctx = window._buFindingCtx || {existing:null, initialIssueIds:[]};
  var initialIds = ctx.initialIssueIds || [];
  // Conserver les coches existantes pendant le re-render (sauf au tout 1er rendu)
  var currentlyChecked = {};
  document.querySelectorAll('.bf-iss-cb').forEach(function(cb){
    if (cb.checked) currentlyChecked[cb.value] = true;
  });
  // Si pas encore de checkboxes (1er rendu), partir des initialIds
  var alreadyRenderedOnce = !!document.querySelector('.bf-iss-cb');
  if (!alreadyRenderedOnce) {
    initialIds.forEach(function(id){currentlyChecked[id]=true;});
  }

  var selectedProcId = document.getElementById('bf-proc') ? document.getElementById('bf-proc').value : '';

  // Issues groupées par Process. Le Process sélectionné en premier.
  var byProcess = {};
  allIssues.forEach(function(iss){
    var key = iss.processId || '_unassigned';
    if (!byProcess[key]) byProcess[key] = [];
    byProcess[key].push(iss);
  });
  // Ordre d'affichage : selectedProcId d'abord, puis les autres
  var procIds = Object.keys(byProcess);
  procIds.sort(function(a,b){
    if (a === selectedProcId) return -1;
    if (b === selectedProcId) return 1;
    return _getProcNameForWpp(a).localeCompare(_getProcNameForWpp(b),'fr',{sensitivity:'base'});
  });

  // Aggregated ids autres findings (sauf celui qu'on édite)
  var aggregatedElsewhere = {};
  (d.findings||[]).forEach(function(f){
    if (ctx.existing && f === ctx.existing) return; // pas le finding qu'on édite
    if (Array.isArray(f.issueIds)) f.issueIds.forEach(function(id){aggregatedElsewhere[id]=true;});
  });

  // Pré-cochage par défaut au 1er rendu : si Process est sélectionné, cocher ses issues
  // sauf celles déjà dans un autre finding
  if (!alreadyRenderedOnce && selectedProcId && !ctx.existing) {
    (byProcess[selectedProcId] || []).forEach(function(iss){
      if (!aggregatedElsewhere[iss.id] && !currentlyChecked[iss.id]) {
        // Si pas déjà la seed issue, cocher
        if (!ctx.seedIssueId || ctx.seedIssueId === iss.id || iss.processId === selectedProcId) {
          currentlyChecked[iss.id] = true;
        }
      }
    });
  }

  var h = '';
  procIds.forEach(function(procId){
    var procName = procId === '_unassigned' ? '(Process non assigné)' : _getProcNameForWpp(procId);
    var isMainProc = procId === selectedProcId;
    var headerBg = isMainProc ? '#3C3489' : '#EEEDFE';
    var headerColor = isMainProc ? '#fff' : '#3C3489';
    h += '<div style="background:'+headerBg+';color:'+headerColor+';font-weight:600;padding:5px 10px;font-size:10px;letter-spacing:.3px;text-transform:uppercase;box-sizing:border-box;width:100%">'+procName.replace(/</g,'&lt;');
    if (isMainProc) h += ' <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px">(Process principal)</span>';
    h += '</div>';
    byProcess[procId].forEach(function(iss){
      var badgeColor = iss.source==='design' ? '#854F0B' : '#085041';
      var badgeBg = iss.source==='design' ? '#FAEEDA' : '#E1F5EE';
      var badgeLabel = iss.source==='design' ? 'DESIGN' : 'OPERATING';
      var isInOther = !!aggregatedElsewhere[iss.id];
      var checked = currentlyChecked[iss.id] ? ' checked' : '';
      h += '<label style="display:flex;align-items:flex-start;gap:8px;padding:6px 10px;border-bottom:.5px solid #f0f0f0;cursor:pointer;box-sizing:border-box;width:100%;font-weight:normal;color:inherit;margin-bottom:0'+(isInOther?';opacity:.55':'')+'">';
      h += '<input type="checkbox" class="bf-iss-cb" value="'+_escAttr(iss.id)+'"'+checked+' style="margin-top:3px;flex-shrink:0;width:14px;height:14px"/>';
      h += '<span style="background:'+badgeBg+';color:'+badgeColor+';font-size:9px;padding:2px 6px;border-radius:3px;font-weight:500;flex-shrink:0;margin-top:1px">'+badgeLabel+'</span>';
      h += '<div style="flex:1;min-width:0;word-break:break-word;overflow-wrap:break-word">';
      if (iss.title) h += '<div style="font-size:11px;font-weight:500">'+(''+iss.title).replace(/</g,'&lt;')+'</div>';
      else if (iss.source === 'operating') {
        var code = _getIssueTestCode(iss);
        if (code) h += '<div style="font-size:10px;color:var(--text-3);font-family:monospace">'+code+'</div>';
      }
      if (iss.description) {
        var shortDesc = iss.description.length > 150 ? iss.description.slice(0,150)+'…' : iss.description;
        h += '<div style="font-size:10px;color:var(--text-2);margin-top:1px;white-space:pre-wrap">'+shortDesc.replace(/</g,'&lt;')+'</div>';
      }
      if (isInOther) h += '<div style="font-size:9px;color:var(--text-3);font-style:italic;margin-top:2px">⚠ déjà dans un autre finding</div>';
      h += '</div>';
      h += '</label>';
    });
  });
  panel.innerHTML = h;
}

async function removeBuFinding(idx) {
  var d = getAudData(CA);
  var f = d.findings[idx];
  if (!f) return;
  var msg = 'Supprimer ce finding ?';
  if (Array.isArray(f.issueIds) && f.issueIds.length) {
    msg += '\n\nLes '+f.issueIds.length+' issue'+(f.issueIds.length>1?'s':'')+' rattachée'+(f.issueIds.length>1?'s':'')+' redeviendront « non agrégée'+(f.issueIds.length>1?'s':'')+' ».';
  }
  if (!confirm(msg)) return;
  d.findings.splice(idx,1);
  // Nettoyer aussi les management responses qui référenceraient ce finding
  if (Array.isArray(d.mgtResp)) {
    d.mgtResp = d.mgtResp.filter(function(r){return r.findingId !== f.id;});
  }
  await saveAuditData(CA);
  addHist('del', 'Finding "'+(f.title||'')+'" supprimé');
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Finding supprimé');
}

function renderFindingsSection() {
  var d = getAudData(CA);
  if (!d.findings) d.findings = [];
  var step5c = d.controls[4]||[];
  // Contrôles "à traiter" = fail (test finalisé fail) ou target
  var failedCtrls = step5c.filter(_isCtrlFailedExisting);
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

  // v74 : Section "Design Issues validées à traiter" (Process uniquement, depuis l'étape ITW)
  // Les Design Issues validated qui n'ont pas encore de finding rattaché
  _ensureIssues(d);
  var validatedDesignIssues = d.issues.filter(function(i){
    return i.source === 'design' && i.validationStatus === 'validated';
  });
  // Issues déjà rattachées à au moins un finding (via f.designIssueIds)
  var linkedDiIds = new Set();
  d.findings.forEach(function(f){
    (f.designIssueIds || []).forEach(function(id){linkedDiIds.add(id);});
  });
  var unlinkedDi = validatedDesignIssues.filter(function(i){return !linkedDiIds.has(i.id);});

  if (unlinkedDi.length) {
    html += '<div style="background:#FEF2F2;border:.5px solid #FCA5A5;border-radius:6px;padding:10px;margin-bottom:12px">';
    html += '<div style="font-size:11px;font-weight:600;color:#7F1D1D;margin-bottom:6px">⚠ Design Issues à traiter dans un finding ('+unlinkedDi.length+')</div>';
    html += '<div style="font-size:10px;color:var(--text-3);margin-bottom:6px;font-style:italic">Défaillances de design validées à l\'étape ITW/Narratif. Créez un finding pour les inclure.</div>';
    unlinkedDi.forEach(function(iss){
      var subtype = iss.subtype || 'weak';
      var typeLabel = subtype === 'missing'
        ? '<span class="badge" style="background:#FCE7E5;color:#7F1D1D;font-size:9px;border:.5px solid #F8B4B4">⚑ Manquant</span>'
        : '<span class="badge" style="background:#FFEDD5;color:#9A3412;font-size:9px;border:.5px solid #FDBA74">⚠ Insuffisant</span>';
      html += '<div style="background:#fff;border:.5px solid var(--border);border-radius:4px;padding:7px 9px;margin-bottom:4px;display:flex;align-items:flex-start;gap:8px">';
      html += '<div style="flex-shrink:0;padding-top:1px">'+typeLabel+'</div>';
      html += '<div style="flex:1;font-size:11px;min-width:0">';
      html += '<div style="font-weight:500;color:var(--text-1)">'+(iss.title||'(sans titre)').replace(/</g,'&lt;')+'</div>';
      if (iss.controlName) html += '<div style="color:var(--text-3);font-size:9px;font-style:italic;margin-top:2px">Contrôle : '+iss.controlName.replace(/</g,'&lt;')+'</div>';
      // v75 : root cause badge inline
      var rcCat = _getRootCauseCategory(iss.rootCauseCategory);
      if (rcCat) {
        html += '<div style="margin-top:4px;display:flex;align-items:center;gap:4px;flex-wrap:wrap">';
        html += '<span style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500">🎯 RC :</span>';
        html += '<span style="font-size:9px;font-weight:500;color:'+rcCat.color+';background:'+rcCat.color+'15;border:.5px solid '+rcCat.color+'40;padding:1px 6px;border-radius:2px">'+rcCat.shortLabel+'</span>';
        if (iss.rootCauseExplanation) {
          var rcShort = iss.rootCauseExplanation.length > 110 ? iss.rootCauseExplanation.substring(0, 108) + '…' : iss.rootCauseExplanation;
          html += '<span style="font-size:9px;color:var(--text-3);font-style:italic">'+rcShort.replace(/</g,'&lt;')+'</span>';
        }
        html += '</div>';
      }
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

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
// ════════════════════════════════════════════════════════════════════
//  ÉTAPE 8 — BANDEAU PUBLICATION DU RAPPORT + DEMANDE MGT RESPONSE
//  Permet de :
//   1. Publier le rapport final sur SharePoint (re-générer OU upload Office)
//   2. Envoyer la demande de Management Response aux owners avec le lien
// ════════════════════════════════════════════════════════════════════
// ─── ÉTAPE 8 (CS=8) : Bandeau pour envoyer la demande Management Response ─
//   Le rapport doit avoir été marqué comme version finale en étape 7 (Audit Report).
//   Cette étape ne fait que l'envoi du mail aux parties prenantes.
function renderReportPublicationBanner() {
  var d = getAudData(CA);
  var attR = d.attachments && d.attachments.report;
  var finalR = attR && attR.final;
  // Backward-compat ancien format plat sans final
  if (!finalR && attR && attR.webUrl && !attR.draft) {
    finalR = attR;
  }
  var hasFinal = !!(finalR && finalR.webUrl);

  var html = '<div class="card" style="margin-bottom:.75rem;background:linear-gradient(135deg,#FAEEDA 0%,#FFF4D9 100%);border:.5px solid #FAC775">';

  html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">';
  html += '<div style="flex:1;min-width:240px">';
  html += '<div style="font-size:14px;font-weight:600;color:#854F0B;margin-bottom:4px">📧 Demande de Management Response</div>';

  if (!hasFinal) {
    html += '<div style="font-size:11px;color:#BA7517;line-height:1.5">Aucune version finale du rapport n\'est disponible. Retourne à l\'étape <strong>Audit Report</strong> pour générer le rapport et le marquer comme version finale.</div>';
  } else {
    var finalDate = (finalR.finalizedAt||'').slice(0,10);
    var by = finalR.finalizedBy ? ' par '+finalR.finalizedBy : '';
    var finalEditUrl = toEditableOfficeUrl(finalR.webUrl);
    html += '<div style="font-size:11px;color:#085041;background:#E1F5EE;padding:6px 10px;border-radius:4px;border:.5px solid #A6E2CD;line-height:1.5">';
    html += '<strong style="font-weight:500">Version finale</strong> figée le '+finalDate+by+' &middot; ';
    html += '<a href="'+finalEditUrl.replace(/"/g,'&quot;')+'" target="_blank" rel="noopener" style="color:#3C3489;text-decoration:underline;font-weight:500">✏ Modifier dans PowerPoint</a>';
    html += ' &middot; ';
    html += '<a href="'+finalR.webUrl.replace(/"/g,'&quot;')+'" target="_blank" rel="noopener" style="color:#085041;text-decoration:underline">Ouvrir →</a>';
    html += '</div>';
    html += '<div style="font-size:11px;color:#BA7517;line-height:1.5;margin-top:6px">Envoyer la demande de Management Response aux owners avec le lien vers le rapport. Le mail leur demandera de compléter la slide « Management Response » pour chaque finding identifié.</div>';
  }
  html += '</div>';

  // Bouton d'action
  html += '<div style="display:flex;gap:8px;flex-direction:column;align-items:stretch;min-width:200px">';
  if (hasFinal) {
    html += '<button class="bp" style="font-size:12px;padding:7px 14px;background:#854F0B;color:#fff;font-weight:500" onclick="composeMgtRespEmail()" title="Envoyer la demande de Management Response aux owners">📧 Envoyer la demande MR</button>';
  } else {
    html += '<button class="bp" style="font-size:12px;padding:7px 14px;background:#aaa;color:#fff;font-weight:500;cursor:not-allowed" disabled title="Marque d\'abord le rapport comme version finale en étape 7">📧 Envoyer la demande MR</button>';
  }
  html += '</div>';
  html += '</div>';
  html += '</div>';
  return html;
}

/**
 * Copie le draft Rapport vers final.
 * Approche A : draft = brouillon modifiable, final = version partagée par mail.
 */
async function finalizeReport() {
  var ap = (AUDIT_PLAN||[]).find(function(a){return a.id===CA;});
  if (!ap) { toast('Audit introuvable'); return; }
  var d = getAudData(CA);
  if (!d.attachments) d.attachments = {};
  if (!d.attachments.report) d.attachments.report = {};
  // Backward-compat
  if (d.attachments.report.webUrl && !d.attachments.report.draft) {
    d.attachments.report = { draft: d.attachments.report };
  }
  var draft = d.attachments.report.draft;
  if (!draft || !draft.webUrl) {
    toast('Génère ou publie d\'abord un draft du rapport');
    return;
  }

  // Confirmation si une version finale existe déjà
  if (d.attachments.report.final && d.attachments.report.final.webUrl) {
    if (!confirm('Une version finale existe déjà (figée le ' + (d.attachments.report.final.finalizedAt||'').slice(0,10) + '). Cela remplacera la version finale actuelle. Continuer ?')) {
      return;
    }
  }

  if (typeof copyFileInSharePoint !== 'function' || typeof getOrCreateAuditFolder !== 'function') {
    toast('Helpers SharePoint indisponibles');
    return;
  }

  try {
    toast('📌 Création de la version finale du rapport...');
    var folderInfo = await getOrCreateAuditFolder(ap);
    var driveItem = await copyFileInSharePoint(folderInfo.path, 'AuditReport_draft.pptx', 'AuditReport_final.pptx');
    d.attachments.report.final = {
      webUrl: driveItem.webUrl,
      fileName: driveItem.name,
      finalizedAt: new Date().toISOString(),
      finalizedBy: (typeof CU !== 'undefined' && CU && CU.name) ? CU.name : '',
    };
    await saveAuditData(CA);
    if (typeof addHist === 'function') addHist(CA, 'Audit Report — version finale figée (' + driveItem.name + ')');
    toast('✓ Version finale créée — la demande MR utilisera ce lien');
    if (document.getElementById('det-content')) {
      document.getElementById('det-content').innerHTML = renderDetContent();
    }
  } catch (e) {
    console.error('[finalizeReport] error:', e);
    toast('Erreur : ' + (e.message||e));
  }
}

/**
 * Publie le rapport en le re-générant depuis l'app puis en l'uploadant sur SharePoint.
 * Source : audit-report-generator.js — generateAuditReportPptx avec option uploadOnly
 */
async function publishReportRegenerate() {
  var ap = (AUDIT_PLAN||[]).find(function(a){return a.id===CA;});
  if (!ap) { toast('Audit introuvable'); return; }
  if (typeof generateAuditReportPptx !== 'function') {
    toast('generateAuditReportPptx() introuvable');
    return;
  }
  if (typeof getOrCreateAuditFolder !== 'function' || typeof uploadFileToSharePoint !== 'function') {
    toast('Helpers SharePoint indisponibles');
    return;
  }
  try {
    toast('📤 Génération + publication SharePoint...');
    // Appeler le générateur en mode "upload only" (sans téléchargement local)
    await generateAuditReportPptx(CA, {uploadOnly: true});
    // Le générateur stocke directement le lien dans audit.attachments.report
    if (document.getElementById('det-content')) {
      document.getElementById('det-content').innerHTML = renderDetContent();
    }
  } catch (e) {
    console.error('[publishReportRegenerate] error:', e);
    toast('Erreur publication : ' + (e.message||e));
  }
}

/**
 * Publie le rapport en uploadant la version Office finale (drag&drop ou file picker).
 */
function publishReportUpload() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation';
  input.style.display = 'none';
  input.onchange = async function() {
    var file = input.files && input.files[0];
    if (!file) return;
    if (!/\.pptx$/i.test(file.name)) {
      toast('Format non supporté : seul .pptx est accepté');
      return;
    }
    var ap = (AUDIT_PLAN||[]).find(function(a){return a.id===CA;});
    if (!ap) return;
    try {
      toast('📤 Upload draft sur SharePoint...');
      var folderInfo = await getOrCreateAuditFolder(ap);
      // Approche A : upload vers le DRAFT (le final est figé manuellement)
      var driveItem = await uploadFileToSharePoint(folderInfo.path, 'AuditReport_draft.pptx', file);
      var d = getAudData(CA);
      if (!d.attachments) d.attachments = {};
      if (!d.attachments.report) d.attachments.report = {};
      // Migration backward-compat
      if (d.attachments.report.webUrl && !d.attachments.report.draft && !d.attachments.report.final) {
        d.attachments.report = { draft: d.attachments.report };
      }
      d.attachments.report.draft = {
        webUrl: driveItem.webUrl,
        fileName: driveItem.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: (typeof CU !== 'undefined' && CU && CU.name) ? CU.name : '',
        source: 'office_upload',
      };
      await saveAuditData(CA);
      if (typeof addHist === 'function') addHist(CA, 'Rapport (draft) publié sur SharePoint (upload Office)');
      toast('✓ Draft Rapport publié sur SharePoint');
      if (document.getElementById('det-content')) {
        document.getElementById('det-content').innerHTML = renderDetContent();
      }
    } catch (e) {
      console.error('[publishReportUpload] error:', e);
      toast('Erreur upload : ' + (e.message||e));
    }
  };
  document.body.appendChild(input);
  input.click();
  setTimeout(function(){ input.remove(); }, 1000);
}

/**
 * Compose le mail de demande Management Response.
 * - To  : Auditeurs + Process Owners
 * - CC  : Interviewees
 * - Body : demande explicite + lien SharePoint + instruction "slide Management Response"
 */
async function composeMgtRespEmail() {
  var audit = (AUDIT_PLAN || []).find(function(a) { return a.id === CA; });
  if (!audit) { toast('Audit introuvable'); return; }
  var d = getAudData(CA);

  // Approche A : on PARTAGE la version finale (pas le draft). Si pas de final, on bloque.
  var attR = d.attachments && d.attachments.report;
  var finalReport = attR && attR.final;
  // Backward-compat : ancien format plat → on l'accepte aussi comme final
  if (!finalReport && attR && attR.webUrl && !attR.draft) {
    finalReport = attR;
  }
  if (!finalReport || !finalReport.webUrl) {
    toast('Marque d\'abord le draft comme version finale (📌 Marquer comme version finale)');
    return;
  }

  // Vérifier que sendMailWithAttachment est dispo
  if (typeof sendMailWithAttachment !== 'function') {
    toast('Helper Graph indisponible — vérifier les permissions Mail.Send');
    return;
  }

  // Collecter destinataires : Auditeurs + Owners en TO, Interviewees en CC
  var toEmails = {};
  var ccEmails = {};

  // Auditeurs assignés
  var auditeurIds = Array.isArray(audit.auditeurs) ? audit.auditeurs : [];
  auditeurIds.forEach(function(uid) {
    var tm = (typeof TM !== 'undefined' && TM[uid]) ? TM[uid] : null;
    if (tm && tm.email) toEmails[tm.email.toLowerCase()] = {email: tm.email, name: tm.name || tm.email};
  });

  // Process Owners (depuis Work Program — source de vérité, pour BU)
  var wpProcesses = (d.workProgramBU && Array.isArray(d.workProgramBU.processes))
    ? d.workProgramBU.processes : [];
  wpProcesses.forEach(function(wpp) {
    (wpp.owners||[]).forEach(function(o) {
      if (o && o.email) {
        var key = o.email.toLowerCase();
        if (!toEmails[key]) toEmails[key] = {email: o.email, name: o.name || o.email};
      }
    });
  });

  // Owners de sous-processus (audit Process)
  if (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) {
    d.kickoffPrep.subProcesses.forEach(function(sp) {
      if (sp && sp.email) {
        var emails = sp.email.split(/[,;]/).map(function(e){return e.trim();}).filter(Boolean);
        emails.forEach(function(e){
          var key = e.toLowerCase();
          if (!toEmails[key]) toEmails[key] = {email: e, name: sp.owners || e};
        });
      }
    });
  }

  // Interviewees → CC
  var interviews = (d.kickoffPrep && Array.isArray(d.kickoffPrep.interviews))
    ? d.kickoffPrep.interviews : [];
  interviews.forEach(function(itw) {
    if (itw && itw.email) {
      var key = itw.email.toLowerCase();
      if (!toEmails[key]) ccEmails[key] = {email: itw.email, name: itw.name || itw.email};
    }
  });

  var toList = Object.keys(toEmails).map(function(k){return toEmails[k];});
  var ccList = Object.keys(ccEmails).map(function(k){return ccEmails[k];});

  if (!toList.length && !ccList.length) {
    toast('Aucun destinataire avec email — vérifie les Owners et auditeurs');
    return;
  }

  // Construction du sujet et du corps HTML
  var titre = audit.titre || 'l\'audit';
  var findingsCount = (d.findings||[]).length;
  var deadline = new Date(Date.now() + 21 * 86400000);
  var deadlineStr = deadline.toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'});

  var subject = 'Rapport d\'audit — ' + titre + ' — Demande de Management Response';

  var bodyHtml = '<p>Bonjour,</p>';
  bodyHtml += '<p>Suite aux travaux de l\'audit <strong>' + titre.replace(/</g,'&lt;') + '</strong>, le rapport final est désormais disponible.</p>';
  bodyHtml += '<p><strong>Rapport d\'audit :</strong> <a href="' + finalReport.webUrl + '">Ouvrir sur SharePoint</a> (joint à ce mail également)</p>';
  if (findingsCount > 0) {
    bodyHtml += '<p>Le rapport identifie <strong>' + findingsCount + ' finding' + (findingsCount>1?'s':'') + '</strong> pour lesquels nous sollicitons votre Management Response.</p>';
  } else {
    bodyHtml += '<p>Nous sollicitons votre Management Response sur les findings identifiés.</p>';
  }
  bodyHtml += '<p>Merci de :</p>';
  bodyHtml += '<ol>';
  bodyHtml += '<li>Consulter le rapport via le lien SharePoint ci-dessus</li>';
  bodyHtml += '<li>Compléter la slide <strong>« Management Response »</strong> du rapport avec, pour chaque finding :';
  bodyHtml += '<ul>';
  bodyHtml += '<li>L\'action corrective prévue</li>';
  bodyHtml += '<li>L\'owner désigné côté business</li>';
  bodyHtml += '<li>La date cible de mise en œuvre</li>';
  bodyHtml += '</ul></li>';
  bodyHtml += '<li>Nous retourner vos réponses au plus tard le <strong>' + deadlineStr + '</strong></li>';
  bodyHtml += '</ol>';
  bodyHtml += '<p>Je reste à votre disposition pour tout échange complémentaire.</p>';
  bodyHtml += '<p>Bien cordialement,<br/>';
  if (typeof CU !== 'undefined' && CU && CU.name) bodyHtml += CU.name + '<br/>';
  bodyHtml += '<em>Audit interne</em></p>';

  // Pièce jointe : reference attachment SharePoint (lien cliquable, pas de bytes)
  var attachments = [{
    name: finalReport.fileName || 'AuditReport_final.pptx',
    url: finalReport.webUrl,
  }];

  toast('📧 Envoi en cours...');
  try {
    await sendMailWithAttachment({
      subject: subject,
      bodyHtml: bodyHtml,
      to: toList,
      cc: ccList,
      attachments: attachments,
    });
    if (typeof addHist === 'function') {
      addHist(CA, 'Demande Management Response envoyée à ' + (toList.length+ccList.length) + ' destinataire(s)');
    }
    toast('✓ Mail envoyé (' + toList.length + ' TO, ' + ccList.length + ' CC)');
  } catch (e) {
    console.error('[MR Mail] error:', e);
    toast('Erreur envoi : ' + (e.message||e));
  }
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

    var newDoc = null;
    if (typeof uploadDoc === 'function') {
      try {
        toast('Upload en cours...');
        newDoc = await uploadDoc(CA, file, CS, CU?CU.name:'Inconnu');
      } catch(e){
        console.warn('[Doc] upload échoué:', e.message);
        toast('Upload échoué : '+e.message);
        return;
      }
    }
    // Fallback si uploadDoc indisponible (mode dégradé) : créer un objet local
    if (!newDoc) {
      newDoc = {
        id: 'doc_'+Date.now(),
        name: file.name,
        step: CS,
        size: formatFileSize(file.size),
        uploadedBy: CU ? CU.name : '—',
        uploadedAt: new Date().toISOString(),
        reviewStatus: 'none',
      };
    }
    // Métadonnée propre à ce flux : nom attendu pour cette étape
    newDoc.expectedName = expectedName;
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
      var newDoc = null;
      if (typeof uploadDoc === 'function') {
        try {
          newDoc = await uploadDoc(CA, file, CS, CU?CU.name:'Inconnu');
        } catch(e){
          console.warn('[Doc] upload échoué:', e.message);
        }
      }
      // Fallback si uploadDoc indisponible
      if (!newDoc) {
        newDoc = {
          id: 'doc_'+Date.now()+'_'+i,
          name: file.name,
          step: CS,
          size: formatFileSize(file.size),
          uploadedBy: CU ? CU.name : '—',
          uploadedAt: new Date().toISOString(),
          reviewStatus: 'none',
        };
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
  if (!CU || CU.role!=='admin') { toast('Seul l\'admin peut valider'); return; }
  var d = getAudData(CA);
  var doc = (d.docs||[]).find(function(x){return x.id===docId;});
  if (!doc) return;
  doc.reviewStatus = 'reviewed';
  doc.reviewedBy = CU.name;
  doc.reviewedAt = new Date().toISOString();
  await saveAuditData(CA);
  if (typeof addHist === 'function') addHist('edit', 'Document revu : '+doc.name);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Document validé ✓');
}

async function unmarkDocReviewed(docId) {
  if (!CU || CU.role!=='admin') { toast('Seul l\'admin peut modifier'); return; }
  var d = getAudData(CA);
  var doc = (d.docs||[]).find(function(x){return x.id===docId;});
  if (!doc) return;
  doc.reviewStatus = 'pending';
  delete doc.reviewedBy;
  delete doc.reviewedAt;
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Revue annulée');
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
  // v67 : sortir du mode maximisé flowchart si on quitte l'étape 4
  if (i !== 4) {
    document.body.classList.remove('fc-maximized');
    if (typeof _flowchartMaximized !== 'undefined') _flowchartMaximized = false;
  }
  CS=i;
  var auditObj = AUDIT_PLAN.find(function(x){return x.id===CA;});
  var isBu = auditObj && auditObj.type === 'BU';
  // BU : passe par idx 3 (Design Issues), saute idx 4 (WCGW Process-only) et idx 7
  if (isBu && i === 4) { CS = 5; i = 5; }
  if (isBu && i === 7) { CS = 8; i = 8; }
  // Process v73 : utilise toutes les étapes (3 = ITW/Narratif, 4 = Flowcharts), saute juste 7
  if (!isBu && i === 7) { CS = 8; i = 8; }
  // Process a 9 étapes (ITW/Narratif ajoutée), BU reste à 8
  var totalSteps = isBu ? 8 : 9;
  // Mapping index réel → numéro affiché
  var buMap = {0:1, 1:2, 2:3, 3:4, 5:5, 6:6, 8:7, 9:8}; // BU : 8 étapes, saute 4 et 7
  var procMap = {0:1, 1:2, 2:3, 3:4, 4:5, 5:6, 6:7, 8:8, 9:9}; // Process v73 : 9 étapes, saute juste idx 7
  var displayedNum;
  if (isBu) {
    displayedNum = buMap[i] !== undefined ? buMap[i] : i+1;
  } else {
    displayedNum = procMap[i] !== undefined ? procMap[i] : i+1;
  }
  const pct=Math.min(100, Math.round((displayedNum/totalSteps)*100));
  // Renommer libellés selon type d'audit
  var stepLabel;
  if (isBu && i === 6) stepLabel = 'Findings & Rapport';
  else if (!isBu && i === 4) stepLabel = 'Flowcharts (WCGW & Contrôles)';
  else if (!isBu && i === 3) stepLabel = 'ITW / Narratif';
  else if (isBu && i === 3) stepLabel = 'Interview (Design Issues)';
  else stepLabel = (STEPS[i] ? STEPS[i].s : '—');
  document.getElementById('audit-header-compact').innerHTML=renderStepper();
  var pf=document.getElementById('gp-fill'); if(pf)pf.style.width=pct+'%';
  var pp=document.getElementById('gp-pct'); if(pp)pp.textContent=pct+'%';
  var pl=document.getElementById('gp-lbl'); if(pl)pl.textContent=`Étape ${displayedNum}/${totalSteps} — ${stepLabel}`;
  document.getElementById('det-content').innerHTML=renderDetContent();
}
function switchDetTab(tab){
  // Conservée pour compat (plus utilisée avec les nouveaux onglets)
  document.getElementById('det-content').innerHTML=renderDetContent();
}

var REQUIRED_DOCS={0:['Audit Planning Memo'],1:[],2:['Kick Off Slides','Meeting Invitation'],3:['Narratif'],4:['Testing Strategy'],5:['Testing Documentation'],6:['Rapport']};
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

async function validerEtape(){
  var ap=AUDIT_PLAN.find(function(a){return a.id===CA;});
  var d=getAudData(CA);
  var missing=getMissingDocs(CS,d.docs);
  if(missing.length){
    var msg='Document(s) requis :\n';
    missing.forEach(function(m){msg+='  • '+m+'\n';});
    alert(msg);
    return;
  }
  if(CS<9){
    var nextStep = CS + 1;
    // Pour les audits BU : on saute l'étape 4 (ITW : WCGW & Contrôles)
    if (ap && ap.type === 'BU' && nextStep === 4) nextStep = 5;
    CS = nextStep;
    if(ap){ap.statut='En cours';ap.step=CS;}
    await saveAuditPlan(ap);
    addHist('edit','Etape '+CS+' validée — '+(ap?ap.titre:''));
    goStep(CS);
    toast('"'+STEPS[CS].s+'" validée ✓');
  } else {
    if(ap){ap.statut='Clôturé';ap.step=9;await saveAuditPlan(ap);}
    toast('Mission clôturée ✓');
  }
}
function renderTaskList(st,a){if(!st.length)return'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucune tâche.</div>';return st.map((t,i)=>`<div class="ti"><div class="tcb ${t.done?'done':''}" onclick="toggleTask(${i})">${t.done?'✓':''}</div><div class="tt ${t.done?'dt':''}">${t.desc}</div><select style="font-size:11px;padding:2px 6px;border-radius:20px;background:var(--bg)" onchange="reassignTask(${i},this.value)"><option value="none" ${!t.assignee||t.assignee==='none'?'selected':''}>—</option>${buildAssigneeOpts(a.assignedTo,t.assignee)}</select><span style="font-size:10px;color:${t.done?'var(--green)':t.assignee&&t.assignee!=='none'?'var(--purple)':'var(--text-3)'}">${t.done?'✓':t.assignee&&t.assignee!=='none'?'En cours':'À faire'}</span></div>`).join('');}
async function toggleTask(i){const d=getAudData(CA);if(!d.tasks[CS])d.tasks[CS]=[];d.tasks[CS][i].done=!d.tasks[CS][i].done;await saveAuditData(CA);const a=getAudits().find(x=>x.id===CA);document.getElementById('task-list').innerHTML=renderTaskList(d.tasks[CS],a);document.getElementById('audit-header-compact').innerHTML=renderStepper();}
async function reassignTask(i,val){const d=getAudData(CA);if(d.tasks[CS]&&d.tasks[CS][i])d.tasks[CS][i].assignee=val;await saveAuditData(CA);document.getElementById('audit-header-compact').innerHTML=renderStepper();if(val!=='none')toast(`Assigné à ${TM[val]?.name}`);}
function showNewTaskModal(){const a=getAudits().find(x=>x.id===CA);openModal('Nouvelle tâche',`<div><label>Description</label><input id="t-desc" placeholder="ex : Analyser les données..."/></div><div><label>Assignée à</label><select id="t-assign"><option value="none">— Non assignée</option>${buildAssigneeOpts(a.assignedTo,null)}</select></div>`,async ()=>{const desc=document.getElementById('t-desc').value.trim();if(!desc){toast('Description obligatoire');return;}const d=getAudData(CA);if(!d.tasks[CS])d.tasks[CS]=[];d.tasks[CS].push({desc,assignee:document.getElementById('t-assign').value,done:false});await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();document.getElementById('audit-header-compact').innerHTML=renderStepper();toast('Tâche créée ✓');});}
function showAddControlModal_LEGACY_REMOVED(){/* doublon retiré */}
async function removeControl(i){const d=getAudData(CA);d.controls[CS].splice(i,1);await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();}

// Setters Process — adaptés à globalIdx (index dans d.controls[4] complet)
async function setTestNature(i,val){const d=getAudData(CA);if(d.controls[4]&&d.controls[4][i]){d.controls[4][i].testNature=val;await saveAuditData(CA);}}
async function setSampleSize(i,val){const d=getAudData(CA);if(d.controls[4]&&d.controls[4][i]){d.controls[4][i].sampleSize=val?parseInt(val):null;await saveAuditData(CA);}}
async function setSampleMethod(i,val){const d=getAudData(CA);if(d.controls[4]&&d.controls[4][i]){d.controls[4][i].sampleMethod=val;await saveAuditData(CA);}}
async function setTestComment(i,val){const d=getAudData(CA);if(d.controls[4]&&d.controls[4][i]){d.controls[4][i].testComment=val;await saveAuditData(CA);}}
async function setTestResult(i,val){const d=getAudData(CA);if(d.controls[4]&&d.controls[4][i]){d.controls[4][i].result=val;await saveAuditData(CA);document.getElementById('det-content').innerHTML=renderDetContent();}}
async function setFinding(i,val){const d=getAudData(CA);if(d.controls[4]&&d.controls[4][i]){d.controls[4][i].finding=val;await saveAuditData(CA);}}

// Nouveaux setters Process façon BU (population/sample/anomalies + extrapolation)
async function setProcessTestField(i, field, val) {
  var d = getAudData(CA);
  if (d.controls[4] && d.controls[4][i]) {
    d.controls[4][i][field] = val;
    await saveAuditData(CA);
    document.getElementById('det-content').innerHTML = renderDetContent();
  }
}
async function setProcessTestSubField(i, group, sub, val) {
  var d = getAudData(CA);
  if (d.controls[4] && d.controls[4][i]) {
    if (!d.controls[4][i][group]) d.controls[4][i][group] = {count:'', value:''};
    d.controls[4][i][group][sub] = val;
    await saveAuditData(CA);
    document.getElementById('det-content').innerHTML = renderDetContent();
  }
}
async function setProcessIssueDescription(i, val) {
  var d = getAudData(CA);
  if (!d.controls[4] || !d.controls[4][i]) return;
  var ctrl = d.controls[4][i];
  if (!Array.isArray(d.issues)) d.issues = [];
  // Trouver l'issue Operating existante pour ce contrôle
  var issueIdx = d.issues.findIndex(function(iss){
    return iss.source === 'operating' && iss.controlId === ctrl.id;
  });
  var trimmed = (val || '').trim();
  if (trimmed) {
    // Créer ou mettre à jour
    if (issueIdx >= 0) {
      d.issues[issueIdx].description = val;
    } else {
      d.issues.push({
        id: 'iss_'+Date.now()+'_'+Math.floor(Math.random()*100000),
        source: 'operating',
        controlId: ctrl.id,
        wcgwId: ctrl.wcgwId || null,
        title: ctrl.name || '',
        description: val,
        createdAt: new Date().toISOString(),
      });
    }
  } else {
    // Supprimer l'issue si description vidée
    if (issueIdx >= 0) d.issues.splice(issueIdx, 1);
  }
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
}
function showAddFindingModal() { showFindingModal(null); }
function showEditFindingModal(idx) {
  var d = getAudData(CA);
  var f = (d.findings||[])[idx];
  if (!f) return;
  showFindingModal({idx: idx, finding: f});
}

// Helper : un contrôle est "problématique" pour un finding si :
// - design === 'existing' ET finalized ET (anomalies > 0 OU result === 'fail') (ancien modèle ou nouveau)
// On enlève la condition clef parce que l'utilisateur peut vouloir documenter
// un finding sur un contrôle Non-Key aussi (et plusieurs audits récents oublient
// de marquer Key sur les contrôles).
function _isCtrlFailedExisting(c) {
  if (!c || c.design !== 'existing' || !c.finalized) return false;
  // Nouveau modèle : on regarde le compteur d'anomalies du test
  if (c.anomalies && c.anomalies.count !== '' && Number(c.anomalies.count) > 0) return true;
  // Ancien modèle : c.result === 'fail'
  if (c.result === 'fail') return true;
  return false;
}

function showFindingModal(existing) {
  var d = getAudData(CA);
  var step5c = d.controls[4]||[];
  // Liste des contrôles "à traiter" : fail (test finalisé) + target
  var failedCtrls = step5c.filter(_isCtrlFailedExisting);
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
async function finalizeTest(i) {
  var d = getAudData(CA);
  if (!d.controls[4] || !d.controls[4][i]) return;
  var ctrl = d.controls[4][i];
  if (!ctrl.testNature) { toast('Renseignez la procédure de test'); return; }
  if (ctrl.testStatus !== 'fait') { toast('Le statut du test doit être "fait"'); return; }
  var hasAnomalies = ctrl.anomalies && ctrl.anomalies.count !== '' && Number(ctrl.anomalies.count) > 0;
  if (hasAnomalies) {
    var issue = (d.issues||[]).find(function(iss){return iss.source==='operating' && iss.controlId===ctrl.id;});
    if (!issue || !issue.description || !issue.description.trim()) {
      toast('Documentez l\'issue (description) puisque des anomalies ont été identifiées');
      return;
    }
  }
  ctrl.finalized = true;
  addHist('edit', 'Test finalisé — "' + ctrl.name + '"' + (hasAnomalies?' (anomalies remontées)':''));
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Test "' + ctrl.name + '" finalisé ✓');
}
async function unfinalizeTest(i) {
  var d = getAudData(CA);
  if (!d.controls[4] || !d.controls[4][i]) return;
  var ctrl = d.controls[4][i];
  ctrl.finalized = false;
  addHist('edit', 'Test rouvert — "' + ctrl.name + '"');
  await saveAuditData(CA);
  document.getElementById('det-content').innerHTML = renderDetContent();
  toast('Test "' + ctrl.name + '" rouvert');
}
function setMaturity(key){const d=getAudData(CA);if(!d.maturity)d.maturity={level:'',notes:'',saved:false};d.maturity.level=key;d.maturity.saved=false;document.getElementById('det-content').innerHTML=renderDetContent();}
async function saveMaturity(){const d=getAudData(CA);if(!d.maturity?.level){toast('Veuillez sélectionner un niveau');return;}d.maturity.notes=document.getElementById('maturity-notes')?.value||'';d.maturity.saved=true;addHist('edit',`Maturité définie : ${d.maturity.level}`);await saveAuditData(CA);toast('Évaluation sauvegardée ✓');document.getElementById('det-content').innerHTML=renderDetContent();}

function buildControlList(ctrls){if(!ctrls||!ctrls.length)return'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun contrôle identifié.</div>';var h='<div class="ch"><span>Contrôle</span><span>Owner</span><span>Fréquence</span><span>Clef ?</span><span>Design</span><span></span></div>';ctrls.forEach(function(ctrl,ci){h+='<div class="cr"><span style="font-weight:500">'+ctrl.name+'</span><span style="color:var(--text-2)">'+ctrl.owner+'</span><span style="color:var(--text-2)">'+ctrl.freq+'</span><span><span class="badge '+(ctrl.clef?'bps':'bpl')+'">'+(ctrl.clef?'Oui':'Non')+'</span></span><span><span class="badge '+(ctrl.design==='existing'?'bdn':'btg')+'">'+(ctrl.design==='existing'?'Existing':'Target')+'</span></span><button class="bd" style="font-size:10px;padding:2px 6px" onclick="removeControl('+ci+')">X</button></div>';});return h;}
function buildTargetList(targets){if(!targets||!targets.length)return'<div style="font-size:12px;color:var(--text-3);padding:.5rem">Aucun contrôle target.</div>';return targets.map(function(ctrl){return'<div class="fr"><div class="fh"><span class="badge btg">Target</span><div class="ft">'+ctrl.name+'</div></div><div style="font-size:11px;color:var(--red)">Contrôle non existant — à définir par '+ctrl.owner+'.</div></div>';}).join('');}
function buildExecTable(kc){
  if (!kc || !kc.length) return '<div style="font-size:11px;color:var(--text-3);padding:.5rem;font-style:italic">Aucun contrôle clef existant à tester.</div>';
  var d = getAudData(CA);
  var wcgwList = (d.wcgw && d.wcgw[4]) || [];
  // Liste des contrôles globaux pour retrouver le vrai index dans d.controls[4]
  var allCtrls = (d.controls && d.controls[4]) || [];
  var html = '';
  kc.forEach(function(ctrl, displayIdx){
    // Index global dans d.controls[4] (pour les setters existants)
    var globalIdx = allCtrls.indexOf(ctrl);

    var dis = ctrl.finalized ? 'disabled' : '';
    var ctrlCode = ctrl.code || ('CTRL-'+(globalIdx+1));
    var wcgwLinked = wcgwList.find(function(w){return w.id === ctrl.wcgwId;});
    var wcgwBadge = wcgwLinked
      ? '<span class="badge bpl" style="font-size:9px;padding:1px 5px">'+(wcgwLinked.code||'')+' — '+wcgwLinked.title+'</span>'
      : '<span style="font-size:10px;color:#854F0B;font-style:italic">Pas de WCGW lié</span>';
    var details = [];
    if (ctrl.owner) details.push('Owner : '+ctrl.owner);
    if (ctrl.freq) details.push('Fréquence : '+ctrl.freq);
    if (ctrl.nature) details.push('Nature : '+ctrl.nature);

    // Initialiser les structures sample/population/anomalies (modèle BU)
    if (!ctrl.population) ctrl.population = {count:'', value:''};
    if (!ctrl.sample) ctrl.sample = {count:'', value:''};
    if (!ctrl.anomalies) ctrl.anomalies = {count:'', value:''};
    if (!ctrl.testStatus) ctrl.testStatus = 'à faire';
    if (!ctrl.selectionMethod) ctrl.selectionMethod = '';

    var status = ctrl.testStatus;
    var statusColor = status==='fait' ? '#085041' : status==='en cours' ? '#0C447C' : '#854F0B';
    var statusBg = status==='fait' ? '#E1F5EE' : status==='en cours' ? '#E6F1FB' : '#FAEEDA';

    var hasAnomalies = (ctrl.anomalies.count !== '' && Number(ctrl.anomalies.count) > 0);
    var rowBorder = hasAnomalies ? 'border:1px solid #E24B4A' : 'border:.5px solid var(--border)';

    // Issue Operating inline pour ce contrôle (au plus 1 par contrôle)
    var issue = (d.issues||[]).find(function(iss){
      return iss.source==='operating' && iss.controlId===ctrl.id;
    });
    var issueDesc = issue ? (issue.description||'') : '';
    var hasIssue = !!(issueDesc && issueDesc.trim());

    var extrap = _computeExtrapolation(ctrl);

    html += '<div style="'+rowBorder+';border-radius:6px;padding:12px;margin-bottom:10px;background:'+(hasAnomalies?'#FFF8F8':(ctrl.finalized?'#fafafa':'#fff'))+'">';

    // En-tête : code + nom + WCGW lié + badges
    html += '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">';
    html += '<div style="flex:1">';
    html += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;flex-wrap:wrap">';
    html += '<span style="background:#EEEDFE;color:#3C3489;font-size:9px;padding:2px 7px;border-radius:3px;font-family:monospace;letter-spacing:.4px">'+ctrlCode+'</span>';
    html += '<span style="background:'+statusBg+';color:'+statusColor+';font-size:9px;padding:2px 7px;border-radius:3px;font-weight:500">'+status+'</span>';
    if (hasAnomalies) html += '<span style="background:#FCEBEB;color:#A32D2D;font-size:9px;padding:2px 7px;border-radius:3px;font-weight:500">⚠ ANOMALIES</span>';
    if (hasIssue) html += '<span style="background:#EEEDFE;color:#3C3489;font-size:9px;padding:2px 7px;border-radius:3px;font-weight:500">ISSUE</span>';
    if (ctrl.finalized) html += '<span class="badge bdn" style="font-size:9px;padding:2px 7px;border-radius:3px">Finalisé</span>';
    html += '</div>';
    html += '<div style="font-size:12px;font-weight:500">'+(''+(ctrl.name||'')).replace(/</g,'&lt;')+'</div>';
    if (ctrl.description) html += '<div style="font-size:10px;color:var(--text-3);margin-top:2px;font-style:italic">'+(''+ctrl.description).replace(/</g,'&lt;')+'</div>';
    html += '<div style="font-size:10px;color:var(--text-2);margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
    html += wcgwBadge;
    if (details.length) html += '<span>·</span><span>'+details.join(' · ')+'</span>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // Statut + Méthode de sélection
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
    html += '<div>';
    html += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Statut du test</label>';
    html += '<select onchange="setProcessTestField('+globalIdx+',\'testStatus\',this.value)" '+dis+' style="width:100%;font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px;background:'+statusBg+';color:'+statusColor+';font-weight:500">';
    ['à faire','en cours','fait'].forEach(function(s){
      html += '<option'+(ctrl.testStatus===s?' selected':'')+'>'+s+'</option>';
    });
    html += '</select>';
    html += '</div>';
    html += '<div>';
    html += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Méthode de sélection</label>';
    html += '<select onchange="setProcessTestField('+globalIdx+',\'selectionMethod\',this.value)" '+dis+' style="width:100%;font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px;background:#fff">';
    html += '<option value=""'+(!ctrl.selectionMethod?' selected':'')+'>— Choisir —</option>';
    html += '<option'+(ctrl.selectionMethod==='Coverage'?' selected':'')+'>Coverage</option>';
    html += '<option'+(ctrl.selectionMethod==='Aléatoire'?' selected':'')+'>Aléatoire</option>';
    html += '<option'+(ctrl.selectionMethod==='Mix'?' selected':'')+'>Mix</option>';
    html += '</select>';
    html += '</div>';
    html += '</div>';

    // Procédure de test (testNature)
    html += '<div style="margin-bottom:8px">';
    html += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Procédure de test</label>';
    html += '<textarea onchange="setTestNature('+globalIdx+',this.value)" '+dis+' placeholder="Décrivez la procédure de test..." style="width:100%;min-height:50px;font-size:11px;padding:6px;border:1px solid var(--border);border-radius:3px;font-family:inherit;box-sizing:border-box">'+(ctrl.testNature||'').replace(/</g,'&lt;')+'</textarea>';
    html += '</div>';

    // Tableau Population/Sample/Anomalies (Nombre + Valeur €)
    html += '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px">';
    html += '<thead><tr style="background:#f5f5f0">';
    html += '<th style="text-align:left;padding:5px 8px;font-size:9px;color:var(--text-3);font-weight:500;text-transform:uppercase;letter-spacing:.3px;border:.5px solid var(--border)"></th>';
    html += '<th style="text-align:right;padding:5px 8px;font-size:9px;color:var(--text-3);font-weight:500;border:.5px solid var(--border)">Population</th>';
    html += '<th style="text-align:right;padding:5px 8px;font-size:9px;color:var(--text-3);font-weight:500;border:.5px solid var(--border)">Échantillon testé</th>';
    html += '<th style="text-align:right;padding:5px 8px;font-size:9px;color:var(--text-3);font-weight:500;border:.5px solid var(--border)">Anomalies</th>';
    html += '</tr></thead><tbody>';
    // Ligne Nombre
    html += '<tr>';
    html += '<td style="padding:5px 8px;color:var(--text-3);border:.5px solid var(--border)">Nombre</td>';
    ['population','sample','anomalies'].forEach(function(field){
      var val = ctrl[field].count;
      html += '<td style="padding:3px 5px;border:.5px solid var(--border)">';
      html += '<input type="number" min="0" '+dis+' value="'+_escAttr(val)+'" placeholder="0" onchange="setProcessTestSubField('+globalIdx+',\''+field+'\',\'count\',this.value)" style="width:100%;font-size:11px;padding:4px 6px;border:1px solid var(--border);border-radius:3px;text-align:right;box-sizing:border-box"/>';
      html += '</td>';
    });
    html += '</tr>';
    // Ligne Valeur
    html += '<tr>';
    html += '<td style="padding:5px 8px;color:var(--text-3);border:.5px solid var(--border)">Valeur (€)</td>';
    ['population','sample','anomalies'].forEach(function(field){
      var val = ctrl[field].value;
      html += '<td style="padding:3px 5px;border:.5px solid var(--border)">';
      html += '<input type="number" min="0" step="0.01" '+dis+' value="'+_escAttr(val)+'" placeholder="(facultatif)" onchange="setProcessTestSubField('+globalIdx+',\''+field+'\',\'value\',this.value)" style="width:100%;font-size:11px;padding:4px 6px;border:1px solid var(--border);border-radius:3px;text-align:right;box-sizing:border-box"/>';
      html += '</td>';
    });
    html += '</tr>';
    html += '</tbody></table>';

    // Extrapolation auto
    html += '<div style="background:'+(extrap.applicable?'#EEEDFE':'#F1EFE8')+';border-radius:4px;padding:8px 10px;margin-bottom:8px">';
    html += '<div style="font-size:10px;color:'+(extrap.applicable?'#3C3489':'#5F5E5A')+';font-weight:600;margin-bottom:3px;text-transform:uppercase;letter-spacing:.3px">Extrapolation auto</div>';
    if (!extrap.applicable) {
      html += '<div style="font-size:11px;color:var(--text-3);font-style:italic">'+extrap.reason+'</div>';
    } else if (extrap.reason) {
      html += '<div style="font-size:11px;color:#3C3489">'+extrap.reason+'</div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:11px;color:#3C3489">';
      html += '<div><span style="font-weight:500">'+_fmtNum(extrap.countExtrapolated)+'</span> cas potentiellement impactés</div>';
      if (extrap.valueExtrapolated !== null) {
        html += '<div><span style="font-weight:500">'+_fmtEur(extrap.valueExtrapolated)+'</span> d\'impact estimé</div>';
      } else {
        html += '<div style="color:var(--text-3);font-style:italic">Saisissez les valeurs (€) pour estimer l\'impact financier</div>';
      }
      html += '</div>';
    }
    html += '</div>';

    // Issue description (remplace l'ancien Pass/Fail + commentaire)
    html += '<div style="margin-bottom:6px">';
    html += '<label style="font-size:9px;color:var(--text-3);display:block;margin-bottom:2px">Issue description <span style="font-style:italic">(remontée dans le rapport — laisser vide si pas d\'anomalie)</span></label>';
    html += '<textarea onchange="setProcessIssueDescription('+globalIdx+',this.value)" '+dis+' placeholder="Détail des anomalies trouvées, contexte, ce qui sera remonté dans le rapport..." style="width:100%;min-height:60px;font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:3px;resize:vertical;font-family:inherit;box-sizing:border-box">'+issueDesc.replace(/</g,'&lt;')+'</textarea>';
    html += '</div>';

    // Bouton finaliser
    if (!ctrl.finalized) {
      html += '<div style="display:flex;justify-content:flex-end;margin-top:8px">';
      html += '<button class="bp" style="font-size:11px;padding:5px 12px" onclick="finalizeTest('+globalIdx+')">Finaliser le test</button>';
      html += '</div>';
    } else {
      html += '<div style="display:flex;justify-content:flex-end;margin-top:8px">';
      html += '<button class="bs" style="font-size:11px;padding:5px 12px" onclick="unfinalizeTest('+globalIdx+')">Rouvrir</button>';
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

    // Migration douce : si un ancien doc n'a pas d'id, on lui en crée un (basé sur itemId/name)
    // pour que les boutons puissent le retrouver. Le saveAuditData() suivant le persistera.
    if (!f.id) {
      f.id = 'doc_'+(f.itemId || (f.name||'unknown').replace(/[^a-zA-Z0-9]/g,'')) + '_' + fi;
    }

    // Boutons action : bouton "Marquer revu" seulement pour admin si pas déjà revu
    var reviewBtn = '';
    if (isAdmin && reviewStatus!=='reviewed') {
      reviewBtn = '<button class="bp" style="font-size:10px;padding:2px 7px" onclick="markDocReviewed(\''+f.id+'\')">Marquer comme revu</button>';
    } else if (isAdmin && reviewStatus==='reviewed') {
      reviewBtn = '<button class="bs" style="font-size:10px;padding:2px 7px" onclick="unmarkDocReviewed(\''+f.id+'\')">Annuler revue</button>';
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

// ════════════════════════════════════════════════════════════════════
//  v71 : BIBLIOTHÈQUE D'ENTRETIENS (CRUD)
//  - Modale plein-écran pour gérer les entretiens d'un audit
//  - Stockage : audit.interviews dans attachments_json
//  - Modèle :
//    {
//      id, intervieweName, intervieweRole, interviewDate,
//      script, relatedSubProcessIds[], createdAt, analyzedAt
//    }
// ════════════════════════════════════════════════════════════════════

// Helper : initiales colorées (style Material) pour avatar
function _intervInitials(name) {
  if (!name) return '?';
  var parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
}

// Helper : couleur déterministe à partir du nom
function _intervColor(name) {
  var palette = ['#3C3489', '#0E7490', '#085041', '#854F0B', '#BE185D', '#7C3AED', '#1F2937'];
  var hash = 0;
  for (var i = 0; i < (name||'').length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

// Affichage de la bibliothèque (modale plein écran)
function showInterviewsLibrary() {
  var d = getAudData(CA);
  if (!Array.isArray(d.interviews)) d.interviews = [];

  var sps = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) ? d.kickoffPrep.subProcesses : [];
  var spById = {};
  sps.forEach(function(sp){ spById[sp.id] = sp; });

  // Tri : plus récent en premier
  var itvs = d.interviews.slice().sort(function(a, b){
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  var totalAnalyzed = itvs.filter(function(i){return !!i.analyzedAt;}).length;

  var body = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">';
  body += '<div style="font-size:11px;color:var(--text-3)">'+itvs.length+' entretien'+(itvs.length>1?'s':'')+' · '+totalAnalyzed+' analysé'+(totalAnalyzed>1?'s':'')+'</div>';
  body += '<button class="bp" style="font-size:11px;padding:6px 12px" onclick="showInterviewModal()">+ Ajouter un entretien</button>';
  body += '</div>';

  if (!itvs.length) {
    body += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:30px;text-align:center;border:1px dashed var(--border);border-radius:6px">Aucun entretien dans la bibliothèque. Clique « + Ajouter un entretien » pour commencer.</div>';
  } else {
    body += '<div style="display:flex;flex-direction:column;gap:6px">';
    itvs.forEach(function(itv){
      var idx = d.interviews.indexOf(itv);
      var initials = _intervInitials(itv.intervieweName);
      var color = _intervColor(itv.intervieweName);
      var nbWords = itv.script ? itv.script.trim().split(/\s+/).filter(Boolean).length : 0;
      var dateStr = itv.interviewDate ? new Date(itv.interviewDate).toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'}) : '?';
      var role = itv.intervieweRole || '';

      body += '<div style="background:#fff;border:.5px solid var(--border);border-radius:4px;padding:10px 12px;display:flex;align-items:center;gap:10px;font-size:11px">';
      // Avatar initiales
      body += '<div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:'+color+';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:500;font-size:11px">'+initials+'</div>';
      // Info
      body += '<div style="flex:1;min-width:0">';
      body += '<div style="font-weight:500;color:var(--text-1);font-size:12px">'+(itv.intervieweName || '(sans nom)').replace(/</g,'&lt;');
      if (role) body += ' · <span style="font-weight:400;color:var(--text-2);font-size:11px">'+role.replace(/</g,'&lt;')+'</span>';
      body += '</div>';
      body += '<div style="font-size:9px;color:var(--text-3);margin-top:3px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">';
      body += '<span>📅 '+dateStr+'</span>';
      body += '<span>📝 '+nbWords+' mots</span>';
      // Tags SP
      var spIds = itv.relatedSubProcessIds || [];
      spIds.forEach(function(spId){
        var sp = spById[spId];
        if (sp) {
          body += '<span style="background:#F5FBF8;color:#085041;border:.5px solid #A6E2CD;padding:1px 6px;border-radius:2px;font-weight:500">'+(sp.name||'').replace(/</g,'&lt;')+'</span>';
        }
      });
      // Statut analyse
      if (itv.analyzedAt) {
        var analyzedDate = new Date(itv.analyzedAt).toLocaleDateString('fr-FR', {day:'2-digit',month:'short'});
        body += '<span style="color:#085041;font-style:italic">✓ analysé · '+analyzedDate+'</span>';
      } else {
        body += '<span style="color:var(--text-3);font-style:italic">non analysé</span>';
      }
      body += '</div>';
      body += '</div>';
      // Actions
      body += '<div style="display:flex;gap:4px;flex-shrink:0">';
      body += '<button class="bs" style="font-size:11px;padding:4px 8px" onclick="showInterviewModal('+idx+',true)" title="Voir/Éditer">✎</button>';
      body += '<button class="bd" style="font-size:11px;padding:4px 8px" onclick="deleteInterview('+idx+')" title="Supprimer">🗑</button>';
      body += '</div>';
      body += '</div>';
    });
    body += '</div>';
  }

  showModal_interviews_list(body);
}

// Wrapper utilisant openModal (la modale globale d'AuditFlow)
function showModal_interviews_list(body) {
  openModal(
    '📋 Bibliothèque d\'entretiens',
    body,
    null,
    {hideOk: true, cancelLabel: 'Fermer', wide: true}
  );
}

// Modale d'ajout/édition d'un entretien
function showInterviewModal(idx, isEdit) {
  var d = getAudData(CA);
  if (!Array.isArray(d.interviews)) d.interviews = [];
  var existing = (idx !== undefined && idx !== null) ? d.interviews[idx] : null;

  var sps = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) ? d.kickoffPrep.subProcesses : [];

  var name = existing ? (existing.intervieweName || '') : '';
  var role = existing ? (existing.intervieweRole || '') : '';
  var date = existing ? (existing.interviewDate || '') : new Date().toISOString().substring(0, 10);
  var script = existing ? (existing.script || '') : '';
  var spIds = existing ? (existing.relatedSubProcessIds || []) : [];

  var body = '';
  body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">';
  body += '<div>';
  body += '<label style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;display:block;margin-bottom:3px">Nom de la personne *</label>';
  body += '<input id="itv-name" type="text" value="'+name.replace(/"/g,'&quot;')+'" placeholder="ex : Marc Dupont" style="width:100%;font-size:11px;padding:5px 8px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
  body += '</div>';
  body += '<div>';
  body += '<label style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;display:block;margin-bottom:3px">Rôle / Fonction</label>';
  body += '<input id="itv-role" type="text" value="'+role.replace(/"/g,'&quot;')+'" placeholder="ex : Trésorier" style="width:100%;font-size:11px;padding:5px 8px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box"/>';
  body += '</div>';
  body += '</div>';

  body += '<div style="margin-bottom:10px">';
  body += '<label style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;display:block;margin-bottom:3px">Date de l\'entretien</label>';
  body += '<input id="itv-date" type="date" value="'+date+'" style="font-size:11px;padding:5px 8px;border:.5px solid var(--border);border-radius:3px"/>';
  body += '</div>';

  // SP discutés (multi-select checkboxes)
  if (sps.length > 0) {
    body += '<div style="margin-bottom:10px">';
    body += '<label style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;display:block;margin-bottom:3px">Sous-processus discutés (cocher ceux abordés)</label>';
    body += '<div style="display:flex;flex-wrap:wrap;gap:5px;padding:6px;border:.5px solid var(--border);border-radius:3px;background:#fafafa">';
    sps.forEach(function(sp){
      var checked = spIds.indexOf(sp.id) >= 0 ? 'checked' : '';
      body += '<label style="display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:3px 8px;background:#fff;border:.5px solid var(--border);border-radius:3px;cursor:pointer">';
      body += '<input type="checkbox" class="itv-sp" data-sp-id="'+sp.id+'" '+checked+' style="margin:0"/>';
      body += '<span>'+(''+sp.name).replace(/</g,'&lt;')+'</span>';
      body += '</label>';
    });
    body += '</div>';
    body += '</div>';
  } else {
    body += '<div style="font-size:10px;color:var(--text-3);font-style:italic;background:#fafafa;padding:6px 8px;border-radius:3px;margin-bottom:10px">Aucun sous-processus défini en étape 2 — tu pourras les associer plus tard.</div>';
  }

  body += '<div style="margin-bottom:10px">';
  body += '<label style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:500;display:block;margin-bottom:3px">Script de l\'entretien *</label>';
  body += '<textarea id="itv-script" placeholder="Colle ici la transcription Teams (Recap), ton compte-rendu Word, ou tes notes manuscrites mises au propre…" style="width:100%;min-height:240px;font-size:11px;padding:8px 10px;border:.5px solid var(--border);border-radius:3px;box-sizing:border-box;resize:vertical;font-family:inherit;line-height:1.5">'+script.replace(/</g,'&lt;')+'</textarea>';
  body += '<div style="font-size:9px;color:var(--text-3);font-style:italic;margin-top:3px"><span id="itv-script-count">'+(script.trim().split(/\s+/).filter(Boolean).length)+'</span> mots — tu pourras analyser ce script avec Copilot plus tard</div>';
  body += '</div>';

  var idxAttr = (idx !== undefined && idx !== null) ? idx : -1;
  // Utilise openModal global d'AuditFlow ; le bouton OK déclenche saveInterview
  openModal(
    existing ? '📋 Éditer l\'entretien' : '📋 Ajouter un entretien',
    body,
    function() { return saveInterview(idxAttr); },
    {wide: true, cancelLabel: 'Annuler'}
  );

  // Compteur de mots dynamique (après ouverture de la modale)
  setTimeout(function() {
    var ta = document.getElementById('itv-script');
    var counter = document.getElementById('itv-script-count');
    if (ta && counter) {
      ta.addEventListener('input', function(){
        counter.textContent = ta.value.trim().split(/\s+/).filter(Boolean).length;
      });
    }
  }, 50);

  // Personnaliser le label du bouton OK
  setTimeout(function() {
    var okBtn = document.getElementById('mok');
    if (okBtn) okBtn.textContent = existing ? 'Enregistrer' : 'Ajouter';
  }, 50);
}

async function saveInterview(idx) {
  try {
    var nameEl = document.getElementById('itv-name');
    var roleEl = document.getElementById('itv-role');
    var dateEl = document.getElementById('itv-date');
    var scriptEl = document.getElementById('itv-script');
    if (!nameEl || !scriptEl) {
      toast('Erreur : formulaire introuvable');
      return;
    }
    var name = (nameEl.value || '').trim();
    var role = roleEl ? (roleEl.value || '').trim() : '';
    var date = dateEl ? (dateEl.value || '').trim() : '';
    var script = (scriptEl.value || '').trim();
    var spIds = [];
    document.querySelectorAll('.itv-sp:checked').forEach(function(cb){
      spIds.push(cb.getAttribute('data-sp-id'));
    });

    // Validation : on toast et on return SANS throw (pour ne pas casser le flow)
    // Mais alors la modale va se fermer... il faut bloquer la fermeture autrement.
    // Solution : on ne throw pas ; on toast + return false ; mais openModal ferme quand même.
    // Donc il faut throw, mais l'erreur sera silencée par le try/catch dans openModal? Non, ça
    // remontera et ça loggera dans la console.
    if (!name) {
      toast('Indique le nom de la personne');
      // Empêcher fermeture de la modale en throw
      throw new Error('Validation : nom requis');
    }
    if (!script) {
      toast('Le script de l\'entretien ne peut pas être vide');
      throw new Error('Validation : script requis');
    }

    var d = getAudData(CA);
    if (!Array.isArray(d.interviews)) d.interviews = [];

    if (idx !== undefined && idx !== null && idx >= 0 && d.interviews[idx]) {
      // Édition
      var itv = d.interviews[idx];
      itv.intervieweName = name;
      itv.intervieweRole = role;
      itv.interviewDate = date;
      itv.script = script;
      itv.relatedSubProcessIds = spIds;
      addHist('edit', 'Entretien modifié — ' + name);
    } else {
      // Création
      var newItv = {
        id: 'itv_' + Date.now() + '_' + Math.floor(Math.random()*100000),
        intervieweName: name,
        intervieweRole: role,
        interviewDate: date,
        script: script,
        relatedSubProcessIds: spIds,
        createdAt: new Date().toISOString(),
        analyzedAt: null,
      };
      d.interviews.push(newItv);
      addHist('create', 'Entretien ajouté — ' + name);
    }

    await saveAuditData(CA);
    // Re-render le contenu pour mettre à jour le compteur dans la top bar
    var vc = document.getElementById('vc');
    if (vc) vc.innerHTML = V['audit-detail']();
    toast('✓ Entretien sauvegardé');
    // openModal va fermer la modale automatiquement après ce return (closeModal appelé après onOk)
    // Réouvrir la liste après un court délai
    setTimeout(function() { showInterviewsLibrary(); }, 150);
  } catch (e) {
    // Ne pas re-throw pour les erreurs de validation (déjà toast)
    if (e && e.message && e.message.indexOf('Validation') === 0) {
      throw e; // empêche fermeture de la modale
    }
    console.error('[saveInterview] Erreur:', e);
    toast('✗ Erreur sauvegarde : ' + (e.message || e));
    throw e; // empêcher la fermeture de la modale aussi en cas d'erreur réelle
  }
}

async function deleteInterview(idx) {
  var d = getAudData(CA);
  if (!Array.isArray(d.interviews)) return;
  var itv = d.interviews[idx];
  if (!itv) return;
  if (!confirm('Supprimer définitivement l\'entretien avec « '+itv.intervieweName+' » ?')) return;
  d.interviews.splice(idx, 1);
  addHist('delete', 'Entretien supprimé — ' + itv.intervieweName);
  await saveAuditData(CA);
  // Re-render top bar puis la liste
  document.getElementById('vc').innerHTML = V['audit-detail']();
  setTimeout(function() { showInterviewsLibrary(); }, 50);
  toast('✓ Entretien supprimé');
}


// ════════════════════════════════════════════════════════════════════
//  v72 : ANALYSE D'ENTRETIENS VIA COPILOT
//  Workflow : sélection entretiens → mode → copy prompt → coller dans
//  Copilot M365 → coller JSON retour → preview → import dans narratif
// ════════════════════════════════════════════════════════════════════

// État éphémère de la modale d'analyse
var _analyzeState = null;

function showAnalyzeInterviewsModal() {
  var fc = _fcGetCurrent();
  if (!fc) { toast('Aucun flowchart actif'); return; }

  var d = getAudData(CA);
  var allItvs = d.interviews || [];
  if (!allItvs.length) {
    toast('Bibliothèque d\'entretiens vide. Ajoute d\'abord un entretien.');
    return;
  }

  // Pré-sélection : entretiens qui mentionnent le SP du flowchart courant
  var preSelectedIds = {};
  if (fc.subProcessId) {
    allItvs.forEach(function(itv){
      if ((itv.relatedSubProcessIds || []).indexOf(fc.subProcessId) >= 0) {
        preSelectedIds[itv.id] = true;
      }
    });
  }
  // Si aucune pré-sélection, sélectionner tous les non-analysés
  if (Object.keys(preSelectedIds).length === 0) {
    allItvs.forEach(function(itv){
      if (!itv.analyzedAt) preSelectedIds[itv.id] = true;
    });
  }

  // État initial
  _analyzeState = {
    target: 'flowchart',
    selectedIds: preSelectedIds,
    mode: (fc.narrative && fc.narrative.trim()) ? 'enrich' : 'replace',
    fcId: fc.id,
  };

  _renderAnalyzeStep1();
}

// v73 : variante depuis l'étape ITW/Narratif (cible = narratif consolidé de l'audit)
function showAnalyzeInterviewsModalForAudit() {
  try {
    var d = getAudData(CA);
    var allItvs = d.interviews || [];
    if (!allItvs.length) {
      toast('Bibliothèque d\'entretiens vide. Ajoute d\'abord un entretien.');
      return;
    }

    // Pré-sélection : tous les entretiens non analysés
    var preSelectedIds = {};
    allItvs.forEach(function(itv){
      if (!itv.analyzedAt) preSelectedIds[itv.id] = true;
    });
    // Si tous sont déjà analysés, on sélectionne quand même tout pour permettre re-analyse
    if (Object.keys(preSelectedIds).length === 0) {
      allItvs.forEach(function(itv){ preSelectedIds[itv.id] = true; });
    }

    var hasNarrative = !!(d.consolidatedNarrative && d.consolidatedNarrative.trim());

    _analyzeState = {
      target: 'audit',
      selectedIds: preSelectedIds,
      mode: hasNarrative ? 'enrich' : 'replace',
      fcId: null,
    };

    _renderAnalyzeStep1();
  } catch (e) {
    console.error('[v75] ERREUR dans showAnalyzeInterviewsModalForAudit:', e);
    toast('Erreur : '+(e.message||e));
  }
}

// ─── ÉTAPE 1 : sélection entretiens + mode + copy prompt ────────
function _renderAnalyzeStep1() {
  try {
    var d = getAudData(CA);
    var isAuditTarget = _analyzeState && _analyzeState.target === 'audit';
    var fc = isAuditTarget ? null : _fcGetCurrent();
    if (!isAuditTarget && !fc) {
      console.warn('[v75] Pas de cible (audit ou flowchart), abandon');
      return;
    }
  var allItvs = d.interviews || [];
  var sps = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) ? d.kickoffPrep.subProcesses : [];
  var spById = {};
  sps.forEach(function(sp){ spById[sp.id] = sp; });
  var spForFc = (!isAuditTarget && fc && fc.subProcessId) ? spById[fc.subProcessId] : null;

  // Trier : SP-related en haut (uniquement en mode flowchart), puis non-analysés, puis analysés
  var related = [], unrelatedUnanalyzed = [], unrelatedAnalyzed = [];
  allItvs.forEach(function(itv){
    var isRelated = !isAuditTarget && fc && fc.subProcessId && (itv.relatedSubProcessIds || []).indexOf(fc.subProcessId) >= 0;
    if (isRelated) related.push(itv);
    else if (!itv.analyzedAt) unrelatedUnanalyzed.push(itv);
    else unrelatedAnalyzed.push(itv);
  });
  var sortedItvs = related.concat(unrelatedUnanalyzed).concat(unrelatedAnalyzed);

  var nbSelected = Object.keys(_analyzeState.selectedIds).filter(function(id){return _analyzeState.selectedIds[id];}).length;
  var hasNarrative = isAuditTarget
    ? !!(d.consolidatedNarrative && d.consolidatedNarrative.trim())
    : !!(fc && fc.narrative && fc.narrative.trim());

  var body = '';

  // Wrapper avec max-height et scroll, padding propre
  body += '<div style="max-height:65vh;overflow-y:auto;padding:0 2px">';

  // Section 1 : sélection entretiens
  body += '<div style="margin-bottom:16px">';
  body += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">';
  body += '<label style="font-size:11px;color:var(--text-1);font-weight:600">1. Entretiens à analyser</label>';
  body += '<span style="font-size:10px;color:var(--text-3)">'+nbSelected+' / '+allItvs.length+' sélectionné'+(nbSelected>1?'s':'')+'</span>';
  body += '</div>';

  if (!sortedItvs.length) {
    body += '<div style="font-size:11px;color:var(--text-3);font-style:italic;padding:14px;text-align:center;border:1px dashed var(--border);border-radius:4px">Bibliothèque vide. Ajoute d\'abord un entretien.</div>';
  } else {
    body += '<div style="border:.5px solid var(--border);border-radius:4px;background:#fafafa;padding:6px;display:flex;flex-direction:column;gap:4px">';
    sortedItvs.forEach(function(itv){
      var isSelected = !!_analyzeState.selectedIds[itv.id];
      var initials = _intervInitials(itv.intervieweName);
      var color = _intervColor(itv.intervieweName);
      var nbWords = itv.script ? itv.script.trim().split(/\s+/).filter(Boolean).length : 0;
      var dateStr = itv.interviewDate ? new Date(itv.interviewDate).toLocaleDateString('fr-FR', {day:'2-digit',month:'short'}) : '?';
      var isRelated = fc && fc.subProcessId && (itv.relatedSubProcessIds || []).indexOf(fc.subProcessId) >= 0;
      var alreadyAnalyzed = !!itv.analyzedAt;

      // Layout grid : checkbox 16px / avatar 28px / contenu auto / status auto
      var bg = isSelected ? '#EEEDFE' : '#fff';
      var brd = isSelected ? '#CECBF6' : 'var(--border)';
      body += '<label style="display:grid;grid-template-columns:18px 28px 1fr;gap:10px;align-items:center;padding:8px 10px;background:'+bg+';border:.5px solid '+brd+';border-radius:3px;cursor:pointer">';
      body += '<input type="checkbox" '+(isSelected?'checked':'')+' onchange="_toggleAnalyzeItv(\''+itv.id+'\',this.checked)" style="margin:0;cursor:pointer"/>';
      body += '<div style="width:28px;height:28px;border-radius:50%;background:'+color+';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:500;font-size:10px">'+initials+'</div>';
      body += '<div style="min-width:0;font-size:11px">';
      body += '<div style="color:var(--text-1);font-weight:500;display:flex;flex-wrap:wrap;gap:6px;align-items:baseline">';
      body += '<span>'+(itv.intervieweName||'').replace(/</g,'&lt;')+'</span>';
      if (itv.intervieweRole) body += '<span style="font-weight:400;color:var(--text-2);font-size:10px">· '+itv.intervieweRole.replace(/</g,'&lt;')+'</span>';
      body += '</div>';
      body += '<div style="font-size:9px;color:var(--text-3);margin-top:2px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">';
      body += '<span>📅 '+dateStr+'</span>';
      body += '<span>📝 '+nbWords+' mots</span>';
      if (isRelated) body += '<span style="color:#3C3489;background:#EEEDFE;padding:1px 6px;border-radius:2px;font-weight:500">📌 mentionne ce SP</span>';
      if (alreadyAnalyzed) body += '<span style="color:#085041;font-style:italic">✓ déjà analysé</span>';
      body += '</div>';
      body += '</div>';
      body += '</label>';
    });
    body += '</div>';
  }
  body += '</div>';

  // Section 2 : mode
  body += '<div style="margin-bottom:16px">';
  body += '<div style="font-size:11px;color:var(--text-1);font-weight:600;margin-bottom:8px">2. Mode</div>';
  body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
  // Replace
  var replaceActive = _analyzeState.mode === 'replace';
  body += '<div onclick="_setAnalyzeMode(\'replace\')" style="padding:10px 12px;border:1px solid '+(replaceActive?'#3C3489':'var(--border)')+';border-radius:4px;background:'+(replaceActive?'#EEEDFE':'#fff')+';cursor:pointer;box-sizing:border-box;min-width:0">';
  body += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">';
  body += '<input type="radio" name="analyze-mode" value="replace" '+(replaceActive?'checked':'')+' onclick="event.stopPropagation();_setAnalyzeMode(\'replace\')" style="margin:0;flex-shrink:0;width:auto;cursor:pointer"/>';
  body += '<span style="font-size:11px;font-weight:500;color:'+(replaceActive?'#3C3489':'var(--text-2)')+'">↻ Remplacer</span>';
  body += '</div>';
  body += '<div style="font-size:10px;color:var(--text-3);font-style:italic;padding-left:22px">Le narratif existant sera écrasé</div>';
  body += '</div>';
  // Enrich
  var enrichActive = _analyzeState.mode === 'enrich';
  var enrichDisabled = !hasNarrative;
  var enrichClick = enrichDisabled ? '' : 'onclick="_setAnalyzeMode(\'enrich\')"';
  body += '<div '+enrichClick+' style="padding:10px 12px;border:1px solid '+(enrichActive?'#3C3489':'var(--border)')+';border-radius:4px;background:'+(enrichActive?'#EEEDFE':'#fff')+';cursor:'+(enrichDisabled?'not-allowed':'pointer')+';box-sizing:border-box;min-width:0;opacity:'+(enrichDisabled?'0.5':'1')+'">';
  body += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">';
  body += '<input type="radio" name="analyze-mode" value="enrich" '+(enrichActive?'checked':'')+' '+(enrichDisabled?'disabled':'onclick="event.stopPropagation();_setAnalyzeMode(\'enrich\')"')+' style="margin:0;flex-shrink:0;width:auto;cursor:'+(enrichDisabled?'not-allowed':'pointer')+'"/>';
  body += '<span style="font-size:11px;font-weight:500;color:'+(enrichActive?'#3C3489':'var(--text-2)')+'">+ Enrichir</span>';
  body += '</div>';
  body += '<div style="font-size:10px;color:var(--text-3);font-style:italic;padding-left:22px">Compléter, signaler divergences</div>';
  body += '</div>';
  body += '</div>';
  if (!hasNarrative) {
    body += '<div style="font-size:10px;color:var(--text-3);font-style:italic;margin-top:6px">Mode Enrichir disponible uniquement si un narratif existe déjà</div>';
  }
  body += '</div>';

  // Section 3 : contexte injecté
  body += '<div style="margin-bottom:14px;background:#EEEDFE;border:.5px solid #CECBF6;border-radius:4px;padding:10px 12px;font-size:11px;color:#3C3489;line-height:1.6">';
  body += '<div style="font-weight:600;margin-bottom:5px">📦 Contexte injecté dans le prompt</div>';
  body += '<div style="margin-left:0">';
  var auditObj = AUDIT_PLAN.find(function(x){return x.id===CA;});
  body += '<div>• Audit · <strong style="font-weight:500">'+(auditObj?(auditObj.titre||auditObj.id):CA).replace(/</g,'&lt;')+'</strong></div>';
  if (isAuditTarget) {
    body += '<div>• Cible : <strong style="font-weight:500">narratif consolidé de l\'audit</strong> (toutes sections SP)</div>';
  } else if (spForFc) {
    body += '<div>• Sous-processus focus : <strong style="font-weight:500">'+spForFc.name.replace(/</g,'&lt;')+'</strong></div>';
  }
  if (sps.length) {
    var spNamesShort = sps.map(function(sp){return sp.name;}).join(', ');
    if (spNamesShort.length > 80) spNamesShort = spNamesShort.substring(0, 78) + '…';
    body += '<div style="word-break:break-word">• '+sps.length+' SP existants : '+spNamesShort.replace(/</g,'&lt;')+'</div>';
  }
  var auditRisks = d.auditRisks || [];
  if (auditRisks.length) body += '<div>• '+auditRisks.length+' risque(s) URD attaché(s)</div>';
  if (hasNarrative) {
    var narLen = isAuditTarget ? d.consolidatedNarrative.length : fc.narrative.length;
    body += '<div>• Narratif actuel ('+narLen+' caractères)</div>';
  }
  body += '<div style="margin-top:4px"><strong style="font-weight:600">→ '+nbSelected+' entretien(s) sélectionné(s)</strong></div>';
  body += '</div>';
  body += '</div>';

  body += '</div>'; // end scroll wrapper

  // Footer fixe (en dehors du scroll)
  body += '<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;padding-top:12px;margin-top:6px;border-top:.5px solid var(--border)">';
  body += '<div style="font-size:10px;color:var(--text-3);font-style:italic">Étape 1/2 — Génération du prompt</div>';
  body += '<div style="display:flex;gap:6px">';
  body += '<button class="bs" onclick="closeModal()">Annuler</button>';
  if (nbSelected > 0) {
    body += '<button class="bp" onclick="_copyAnalyzePrompt()" style="font-weight:500">📋 Copier le prompt</button>';
  } else {
    body += '<button class="bp" disabled style="opacity:.5;cursor:not-allowed">📋 Copier le prompt</button>';
  }
  body += '</div>';
  body += '</div>';

  var modalTitle = isAuditTarget
    ? '🤖 Analyser entretiens · Narratif consolidé'
    : '🤖 Analyser entretiens · '+(spForFc?spForFc.name:fc.label||'Flowchart');
  openModal(modalTitle, body, null, {hideOk:true, cancelLabel:'', wide:true});
  // Cacher le footer par défaut (on a notre propre footer custom)
  setTimeout(function() {
    var footer = document.querySelector('#modal .mf');
    if (footer) footer.style.display = 'none';
  }, 50);
  } catch (e) {
    console.error('[v75] ERREUR dans _renderAnalyzeStep1:', e);
    toast('Erreur affichage modale : '+(e.message||e));
  }
}

function _toggleAnalyzeItv(itvId, checked) {
  if (!_analyzeState) return;
  if (checked) _analyzeState.selectedIds[itvId] = true;
  else delete _analyzeState.selectedIds[itvId];
  _renderAnalyzeStep1();
  // Réafficher le footer caché
  setTimeout(function() {
    var footer = document.querySelector('#modal .mf');
    if (footer) footer.style.display = 'none';
  }, 50);
}

function _setAnalyzeMode(mode) {
  if (!_analyzeState) return;
  _analyzeState.mode = mode;
  _renderAnalyzeStep1();
  setTimeout(function() {
    var footer = document.querySelector('#modal .mf');
    if (footer) footer.style.display = 'none';
  }, 50);
}

// ─── Construction du prompt complet ─────────────────────────────
function _buildAnalyzePrompt() {
  var d = getAudData(CA);
  var isAuditTarget = _analyzeState && _analyzeState.target === 'audit';
  var fc = isAuditTarget ? null : _fcGetCurrent();
  var auditObj = AUDIT_PLAN.find(function(x){return x.id===CA;});
  var sps = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) ? d.kickoffPrep.subProcesses : [];
  var spForFc = (!isAuditTarget && fc && fc.subProcessId) ? sps.find(function(x){return x.id===fc.subProcessId;}) : null;

  // Entretiens sélectionnés
  var selectedItvs = (d.interviews || []).filter(function(itv){return _analyzeState.selectedIds[itv.id];});

  // Risques URD
  var auditRisks = d.auditRisks || [];

  var p = '';
  p += '# AUDIT INTERNE — ANALYSE D\'ENTRETIENS\n\n';
  p += 'Tu es un assistant d\'audit interne. Analyse les transcriptions d\'entretiens ci-dessous et produis un narratif structuré du processus, en JSON.\n\n';

  // Contexte audit
  p += '## CONTEXTE DE L\'AUDIT\n\n';
  p += '- **Nom de l\'audit** : '+(auditObj?(auditObj.titre||auditObj.id):CA)+'\n';
  p += '- **Type d\'audit** : '+(auditObj?(auditObj.type||'Process'):'Process')+'\n';
  if (isAuditTarget) {
    p += '- **Cible** : narratif consolidé de l\'audit (toutes sections sous-processus combinées)\n';
  } else if (spForFc) {
    p += '- **Sous-processus focus** : '+spForFc.name+' (id: '+spForFc.id+')\n';
    if (spForFc.description) p += '  - Description : '+spForFc.description+'\n';
  }
  if (sps.length > 0) {
    p += '- **Sous-processus déjà définis dans cet audit** (essaie de matcher en priorité avec ceux-ci) :\n';
    sps.forEach(function(sp){
      p += '  - `'+sp.id+'` : '+sp.name+(sp.description?' — '+sp.description:'')+'\n';
    });
  }
  if (auditRisks.length > 0) {
    p += '- **Risques URD attachés à l\'audit** :\n';
    auditRisks.forEach(function(r){
      p += '  - '+(r.code||r.id)+' : '+(r.name||r.title||'')+'\n';
    });
  }

  // Narratif existant si mode enrich
  if (_analyzeState.mode === 'enrich') {
    var currentNar = isAuditTarget ? (d.consolidatedNarrative || '') : (fc ? (fc.narrative || '') : '');
    if (currentNar.trim()) {
      p += '\n## NARRATIF ACTUEL (à enrichir)\n\n';
      p += '```\n'+currentNar+'\n```\n';
      p += '\n**Important** : Tu dois compléter/affiner ce narratif avec les nouveaux entretiens. Si une information du nouveau script contredit le narratif actuel, signale explicitement la divergence avec ⚠️ DIVERGENCE.\n';
    }
  }

  // Instructions
  p += '\n## INSTRUCTIONS\n\n';
  p += '1. Identifie quel(s) sous-processus est/sont décrit(s) dans les entretiens. Essaie de matcher avec les SP existants ci-dessus (utilise leur `id`). Si un sous-processus mentionné ne correspond à aucun existant, propose-le comme nouveau (matchedExistingId = null).\n';
  p += '2. Pour chaque sous-processus, écris un narratif **chronologique et fluide** (paragraphes, pas listes à puces) qui décrit :\n';
  p += '   - Les étapes du processus (qui fait quoi, quand, sur quel système)\n';
  p += '   - Les décisions et critères (seuils, validations)\n';
  p += '   - Les **WCGW** potentiels repérés. Format : `⚠ WCGW : [scénario à risque]`\n';
  p += '   - Les **contrôles existants** mentionnés. Format : `✓ CTRL Existant : [nom du contrôle] (Acteur : qui · Fréquence : quand · Quoi : description · Preuves : documents/traces)`\n';
  p += '   - Les **contrôles cibles** (recommandations prospectives, à mettre en place dans une logique d\'amélioration). Format : `⚑ CTRL Cible : [nom proposé] (Acteur : qui · Fréquence : quand · Quoi : description)`\n';
  p += '3. **DESIGN ISSUES** (problèmes de conception du dispositif de contrôle). Pendant l\'analyse, identifie 2 catégories de défaillances et signale-les à la fois inline dans le narratif ET de manière structurée dans le bloc JSON `designIssues` :\n';
  p += '   - **Contrôle MANQUANT** = un contrôle devrait exister à un endroit du processus pour mitiger un WCGW, mais il n\'existe pas. Format inline : `⚠ DESIGN ISSUE — CTRL Manquant : [description du gap : quel contrôle, pour mitiger quel risque, pourquoi c\'est un problème]`\n';
  p += '   - **Contrôle INSUFFISANT** = un contrôle existe mais sa conception (design) le rend inefficace ou limité. Format inline : `⚠ DESIGN ISSUE — CTRL Insuffisant : [nom du contrôle existant] — [pourquoi le design est insuffisant : seuil trop élevé, dépendance d\'une seule personne, pas de séparation des tâches, fréquence trop faible, pas de preuve écrite, etc.]`\n';
  p += '   IMPORTANT : Ne confonds PAS `⚑ CTRL Cible` (recommandation prospective générique) avec `⚠ DESIGN ISSUE — CTRL Manquant` (constat factuel d\'un gap qui devrait être un finding d\'audit). CTRL Cible = "il serait bien d\'avoir X". DESIGN ISSUE Manquant = "il est anormal qu\'il n\'y ait pas de contrôle ici, c\'est une défaillance".\n';
  p += '4. Si plusieurs intervenants sont en désaccord sur un point factuel (ex : un seuil), signale avec `⚠️ DIVERGENCE : [Intervenant A] indique X, [Intervenant B] indique Y. À clarifier.`\n';
  p += '5. Le narratif doit être en **français professionnel d\'audit**, ton neutre, sans jugement.\n';

  // ── v75 : ROOT CAUSE ──────────────────────────────────────
  p += '\n## ROOT CAUSE DES DESIGN ISSUES\n\n';
  p += 'Pour chaque Design Issue (manquant ou insuffisant) que tu identifies, infère **la cause profonde** (root cause) à partir des éléments des entretiens. Catégorise selon le référentiel suivant (utilise l\'`id` exact dans le JSON) :\n\n';
  p += '| ID | Catégorie | Quand l\'utiliser |\n';
  p += '|---|---|---|\n';
  p += '| `awareness` | Lack of awareness / Training | Personnel pas formé, procédure pas connue, nouveaux arrivants, manque de sensibilisation |\n';
  p += '| `process` | Inadequate process design | Process pas pensé pour ce cas, étapes manquantes, workflow incomplet |\n';
  p += '| `resources` | Insufficient resources | Pas assez de personnel, pas de budget, pas d\'outil, charge trop élevée |\n';
  p += '| `oversight` | Inadequate supervision / Oversight | Pas de revue managériale, contrôle de second niveau absent, pas de pilotage |\n';
  p += '| `tooling` | Inadequate IT systems / Tooling | Système ne supporte pas le contrôle, pas d\'automatisation possible, outils inadaptés |\n';
  p += '| `sod` | Lack of segregation of duties | Une seule personne fait toute la chaîne, pas de séparation des tâches |\n';
  p += '| `policy` | Inadequate policies / Standards | Pas de politique écrite, standards flous, règles non documentées |\n';
  p += '| `culture` | Cultural / Behavioral | Tolérance aux écarts, pression résultats, contournements habituels, "on a toujours fait comme ça" |\n';
  p += '| `external` | External constraints | Réglementation, fournisseur, contrainte client, dépendance externe |\n';
  p += '| `tbd` | À déterminer | À utiliser UNIQUEMENT si les éléments des entretiens ne permettent pas de conclure avec une confiance raisonnable |\n\n';
  p += '**Pour chaque Design Issue, tu DOIS proposer :**\n';
  p += '- une `rootCauseCategory` (l\'`id` parmi les 10 ci-dessus)\n';
  p += '- une `rootCauseExplanation` : 1-3 phrases qui justifient cette catégorisation à partir des éléments concrets des entretiens (cite les éléments factuels)\n';
  p += 'Si tu hésites entre 2 catégories, choisis celle qui a le plus de poids et explique-le. Utilise `tbd` UNIQUEMENT si les entretiens ne donnent vraiment aucun élément.\n';

  // Format de sortie
  p += '\n## FORMAT DE SORTIE (JSON STRICT)\n\n';
  p += 'Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après. Format :\n\n';
  p += '```json\n';
  p += '{\n';
  p += '  "subProcesses": [\n';
  p += '    {\n';
  p += '      "name": "Nom du sous-processus",\n';
  p += '      "matchedExistingId": "sp_xxx" ou null,\n';
  p += '      "narrative": "Texte narratif chronologique avec ⚠ WCGW, ✓ CTRL Existant, ⚑ CTRL Cible, ⚠ DESIGN ISSUE — CTRL Manquant, ⚠ DESIGN ISSUE — CTRL Insuffisant, et ⚠️ DIVERGENCE inline."\n';
  p += '    }\n';
  p += '  ],\n';
  p += '  "designIssues": [\n';
  p += '    {\n';
  p += '      "subtype": "missing" ou "weak",\n';
  p += '      "title": "Titre court (5-10 mots) de la défaillance",\n';
  p += '      "description": "Description détaillée : quel est le gap/la faiblesse de design, quel risque ça expose, pourquoi c\'est un problème (1-3 phrases)",\n';
  p += '      "controlName": "Nom du contrôle concerné (vide si manquant et qu\'on ne peut pas nommer)",\n';
  p += '      "relatedSpId": "sp_xxx" du sous-processus concerné, ou null si nouveau SP,\n';
  p += '      "rootCauseCategory": "awareness | process | resources | oversight | tooling | sod | policy | culture | external | tbd",\n';
  p += '      "rootCauseExplanation": "Justification factuelle de la catégorisation (1-3 phrases qui citent des éléments concrets des entretiens)"\n';
  p += '    }\n';
  p += '  ]\n';
  p += '}\n';
  p += '```\n';
  p += '\nNote : Le tableau `designIssues` peut être vide `[]` si aucune défaillance de design n\'est repérée. Chaque DESIGN ISSUE inline dans le narratif DOIT avoir une entrée structurée correspondante dans `designIssues`. **Chaque entrée DOIT avoir une `rootCauseCategory` et une `rootCauseExplanation`** (utilise `tbd` si vraiment indéterminable).\n';

  // Scripts d'entretiens
  p += '\n## TRANSCRIPTIONS D\'ENTRETIENS À ANALYSER\n';
  selectedItvs.forEach(function(itv, i){
    var dateStr = itv.interviewDate ? new Date(itv.interviewDate).toLocaleDateString('fr-FR') : '';
    p += '\n### Entretien '+(i+1)+' — '+itv.intervieweName+(itv.intervieweRole?' ('+itv.intervieweRole+')':'')+(dateStr?' · '+dateStr:'')+'\n\n';
    p += '```\n'+itv.script+'\n```\n';
  });

  return p;
}

async function _copyAnalyzePrompt() {
  if (!_analyzeState) return;
  var nbSelected = Object.keys(_analyzeState.selectedIds).filter(function(id){return _analyzeState.selectedIds[id];}).length;
  if (nbSelected === 0) { toast('Sélectionne au moins un entretien'); return; }

  var prompt = _buildAnalyzePrompt();
  try {
    await navigator.clipboard.writeText(prompt);
    toast('✓ Prompt copié — colle-le dans Copilot Chat (Teams/Word/M365)');
    // Passer à l'étape 2 (saisie du JSON retour)
    setTimeout(function() { _renderAnalyzeStep2(); }, 800);
  } catch (e) {
    // Fallback : afficher dans une textarea
    alert('Impossible de copier automatiquement. Le prompt va s\'afficher, copie-le manuellement.');
    _renderAnalyzeStep2(prompt);
  }
}

// ─── ÉTAPE 2 : coller le JSON retour de Copilot ───────────────
function _renderAnalyzeStep2(promptToShow) {
  var body = '';

  // Scroll wrapper
  body += '<div style="max-height:65vh;overflow-y:auto;padding:0 2px">';

  body += '<div style="background:#FAEEDA;border:.5px solid #FAC775;color:#854F0B;padding:10px 12px;border-radius:4px;margin-bottom:14px;font-size:11px;line-height:1.5">';
  body += '<div style="font-weight:600;margin-bottom:3px">📝 Prochaine étape</div>';
  body += '<div>Ouvre <strong>Copilot Chat</strong> (Teams, Word ou app M365), colle le prompt, attends la réponse JSON, puis colle-la ci-dessous.</div>';
  body += '</div>';

  // Si on doit afficher le prompt manuellement
  if (promptToShow) {
    body += '<div style="margin-bottom:14px">';
    body += '<label style="font-size:11px;color:var(--text-1);font-weight:600;display:block;margin-bottom:6px">Prompt à copier (clique pour sélectionner tout)</label>';
    body += '<textarea readonly onclick="this.select()" style="width:100%;min-height:120px;font-size:10px;padding:8px 10px;border:.5px solid var(--border);border-radius:4px;box-sizing:border-box;font-family:monospace;background:#fafafa">'+promptToShow.replace(/</g,'&lt;')+'</textarea>';
    body += '</div>';
  }

  body += '<div style="margin-bottom:14px">';
  body += '<label style="font-size:11px;color:var(--text-1);font-weight:600;display:block;margin-bottom:6px">Réponse de Copilot</label>';
  body += '<textarea id="analyze-json-input" placeholder=\'Colle ici le JSON renvoyé par Copilot. Format attendu : {"subProcesses": [...]}\' style="width:100%;min-height:160px;font-size:10px;padding:8px 10px;border:.5px solid var(--border);border-radius:4px;box-sizing:border-box;font-family:monospace;line-height:1.5"></textarea>';
  body += '<div id="analyze-parse-status" style="font-size:10px;color:var(--text-3);font-style:italic;margin-top:5px">Le JSON sera validé automatiquement à la saisie</div>';
  body += '</div>';

  body += '</div>'; // end scroll wrapper

  // Footer fixe
  body += '<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;padding-top:12px;margin-top:6px;border-top:.5px solid var(--border)">';
  body += '<div style="font-size:10px;color:var(--text-3);font-style:italic">Étape 2/2 — Import du résultat</div>';
  body += '<div style="display:flex;gap:6px">';
  body += '<button class="bs" onclick="_renderAnalyzeStep1()">← Retour</button>';
  body += '<button class="bs" onclick="closeModal()">Annuler</button>';
  body += '<button class="bp" onclick="_validateAndPreviewJson()" style="font-weight:500">Aperçu →</button>';
  body += '</div>';
  body += '</div>';

  openModal('🤖 Importer la réponse Copilot', body, null, {hideOk:true, cancelLabel:'', wide:true});
  setTimeout(function() {
    var footer = document.querySelector('#modal .mf');
    if (footer) footer.style.display = 'none';
    // Auto-validation au paste
    var ta = document.getElementById('analyze-json-input');
    if (ta) {
      ta.addEventListener('input', function(){
        var status = document.getElementById('analyze-parse-status');
        if (!status) return;
        var v = ta.value.trim();
        if (!v) { status.textContent = 'Le JSON sera validé automatiquement à la saisie'; status.style.color = 'var(--text-3)'; return; }
        try {
          var parsed = _extractJson(v);
          if (parsed && Array.isArray(parsed.subProcesses)) {
            status.textContent = '✓ JSON valide · '+parsed.subProcesses.length+' sous-processus détecté(s)';
            status.style.color = '#085041';
          } else {
            status.textContent = '⚠ JSON valide mais structure incorrecte (manque subProcesses[])';
            status.style.color = '#854F0B';
          }
        } catch (e) {
          status.textContent = '✗ JSON invalide : '+e.message;
          status.style.color = '#993C1D';
        }
      });
    }
  }, 50);
}

// Extraction du JSON même si entouré de markdown ```json ```
function _extractJson(text) {
  var s = (text || '').trim();
  // Retirer les fences ```json ```
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  // Si pas commencer par { trouver le 1er {
  var firstBrace = s.indexOf('{');
  var lastBrace = s.lastIndexOf('}');
  if (firstBrace > 0 && lastBrace > firstBrace) {
    s = s.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(s);
}

function _validateAndPreviewJson() {
  var ta = document.getElementById('analyze-json-input');
  if (!ta) return;
  var v = ta.value.trim();
  if (!v) { toast('Colle d\'abord le JSON de Copilot'); return; }

  var parsed;
  try {
    parsed = _extractJson(v);
  } catch (e) {
    toast('JSON invalide : '+e.message);
    return;
  }

  if (!parsed || !Array.isArray(parsed.subProcesses) || !parsed.subProcesses.length) {
    toast('JSON sans subProcesses[] valide');
    return;
  }

  _analyzeState.parsedResult = parsed;
  _renderAnalyzePreview();
}

// ─── ÉTAPE 3 : preview avant import ─────────────────────────────
function _renderAnalyzePreview() {
  var fc = _fcGetCurrent();
  if (!fc || !_analyzeState || !_analyzeState.parsedResult) return;
  var d = getAudData(CA);
  var sps = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) ? d.kickoffPrep.subProcesses : [];
  var spById = {};
  sps.forEach(function(sp){ spById[sp.id] = sp; });

  var result = _analyzeState.parsedResult;
  var spForFc = fc.subProcessId ? spById[fc.subProcessId] : null;

  var body = '';

  // Scroll wrapper
  body += '<div style="max-height:65vh;overflow-y:auto;padding:0 2px">';

  body += '<div style="background:#E1F5EE;border:.5px solid #A6E2CD;color:#085041;padding:10px 12px;border-radius:4px;margin-bottom:14px;font-size:11px;line-height:1.5">';
  body += '<div style="font-weight:600;margin-bottom:3px">✓ Aperçu du résultat IA</div>';
  body += '<div>Vérifie le contenu avant de l\'importer dans le narratif du flowchart.</div>';
  body += '</div>';

  result.subProcesses.forEach(function(spr, i){
    var matchedSp = spr.matchedExistingId ? spById[spr.matchedExistingId] : null;
    var isCurrentSp = matchedSp && matchedSp.id === fc.subProcessId;
    var isUnmatched = !matchedSp;

    var headerColor = isCurrentSp ? '#3C3489' : (isUnmatched ? '#FAC775' : 'var(--border)');
    body += '<div style="background:#fff;border:1px solid '+headerColor+';border-radius:4px;padding:12px 14px;margin-bottom:10px">';
    // Header avec nom + badge
    body += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px;flex-wrap:wrap">';
    body += '<div style="flex:1;min-width:0">';
    body += '<div style="font-size:12px;font-weight:600;color:var(--text-1);margin-bottom:4px">'+(spr.name||'(sans nom)').replace(/</g,'&lt;')+'</div>';
    if (isCurrentSp) {
      body += '<div style="font-size:10px;color:#3C3489;background:#EEEDFE;border:.5px solid #CECBF6;padding:2px 8px;border-radius:3px;display:inline-block;font-weight:500">↻ SP du flowchart courant</div>';
    } else if (matchedSp) {
      body += '<div style="font-size:10px;color:var(--text-2);background:#fafafa;border:.5px solid var(--border);padding:2px 8px;border-radius:3px;display:inline-block">↻ '+matchedSp.name.replace(/</g,'&lt;')+' (autre SP de l\'audit)</div>';
    } else {
      body += '<div style="font-size:10px;color:#854F0B;background:#FAEEDA;border:.5px solid #FAC775;padding:2px 8px;border-radius:3px;display:inline-block;font-weight:500">+ Nouveau SP (validation requise)</div>';
    }
    body += '</div>';
    body += '</div>';
    // Narratif preview
    body += '<div style="font-size:11px;line-height:1.6;color:var(--text-2);white-space:pre-wrap;background:#fafafa;padding:10px 12px;border-radius:3px;max-height:200px;overflow-y:auto;border:.5px solid var(--border)">'+_highlightNarrative(spr.narrative||'')+'</div>';
    body += '</div>';
  });

  body += '</div>'; // end scroll wrapper

  // Footer fixe
  body += '<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;padding-top:12px;margin-top:6px;border-top:.5px solid var(--border)">';
  body += '<div style="font-size:10px;color:var(--text-3);font-style:italic">'+result.subProcesses.length+' sous-processus à importer · seul le SP courant sera appliqué au narratif</div>';
  body += '<div style="display:flex;gap:6px;flex-shrink:0">';
  body += '<button class="bs" onclick="_renderAnalyzeStep2()">← Retour</button>';
  body += '<button class="bs" onclick="closeModal()">Annuler</button>';
  body += '<button class="bp" onclick="_doImportAnalysis()" style="font-weight:500">✓ Importer dans le narratif</button>';
  body += '</div>';
  body += '</div>';

  openModal('🤖 Aperçu de l\'analyse IA', body, null, {hideOk:true, cancelLabel:'', wide:true});
  setTimeout(function() {
    var footer = document.querySelector('#modal .mf');
    if (footer) footer.style.display = 'none';
  }, 50);
}

// Highlight des marqueurs WCGW/CTRL/DIVERGENCE pour la preview
function _highlightNarrative(text) {
  var s = (text||'').replace(/</g,'&lt;');
  // v74 : Design Issues en 1er (couleur rouge sombre / orange foncé pour visibilité)
  s = s.replace(/(⚠\s*DESIGN ISSUE\s*[—\-–]\s*CTRL Manquant\s*:[^\n]+?(?=\.\s|\n|$)\.?)/g, '<span style="background:#FCE7E5;color:#7F1D1D;padding:2px 6px;border-radius:2px;font-weight:600;border:.5px solid #F8B4B4">$1</span>');
  s = s.replace(/(⚠\s*DESIGN ISSUE\s*[—\-–]\s*CTRL Insuffisant\s*:[^\n]+?(?=\.\s|\n|$)\.?)/g, '<span style="background:#FFEDD5;color:#9A3412;padding:2px 6px;border-radius:2px;font-weight:600;border:.5px solid #FDBA74">$1</span>');
  // Marqueurs existants
  s = s.replace(/(⚠️\s*DIVERGENCE\s*:[^\n.]+[.])/g, '<span style="background:#FFF4D9;color:#854F0B;padding:1px 5px;border-radius:2px;font-weight:500">$1</span>');
  s = s.replace(/(⚠\s*WCGW\s*:[^\n.]+[.])/g, '<span style="background:#FCEBEB;color:#993C1D;padding:1px 5px;border-radius:2px;font-weight:500">$1</span>');
  s = s.replace(/(✓\s*CTRL Existant\s*:[^\n.]+[.])/g, '<span style="background:#F5FBF8;color:#085041;padding:1px 5px;border-radius:2px;font-weight:500">$1</span>');
  s = s.replace(/(⚑\s*CTRL Cible\s*:[^\n.]+[.])/g, '<span style="background:#FFFAF0;color:#854F0B;padding:1px 5px;border-radius:2px;font-weight:500">$1</span>');
  return s;
}

// ─── ÉTAPE 4 : import effectif ─────────────────────────────────
async function _doImportAnalysis() {
  if (!_analyzeState || !_analyzeState.parsedResult) return;
  var d = getAudData(CA);
  var sps = (d.kickoffPrep && Array.isArray(d.kickoffPrep.subProcesses)) ? d.kickoffPrep.subProcesses : [];
  var spById = {};
  sps.forEach(function(sp){ spById[sp.id] = sp; });

  var isAuditTarget = _analyzeState.target === 'audit';
  var fc = isAuditTarget ? null : _fcGetCurrent();
  if (!isAuditTarget && !fc) return;

  var result = _analyzeState.parsedResult;
  var selectedItvIds = Object.keys(_analyzeState.selectedIds).filter(function(id){return _analyzeState.selectedIds[id];});

  if (isAuditTarget) {
    // ─── Cible : narratif consolidé de l'audit ───
    // Confirmation si narratif existe et mode = replace
    if (_analyzeState.mode === 'replace' && d.consolidatedNarrative && d.consolidatedNarrative.trim()) {
      if (!confirm('Le narratif consolidé actuel sera entièrement remplacé. Continuer ?')) return;
    }

    // Construire le narratif consolidé : sections `## [Nom du SP]` pour chaque SP du résultat
    var newNarrative = '';
    result.subProcesses.forEach(function(spr){
      // Privilégier le nom du SP existant matché, sinon le nom proposé
      var spName = spr.matchedExistingId && spById[spr.matchedExistingId]
        ? spById[spr.matchedExistingId].name
        : (spr.name || '(sans nom)');
      newNarrative += '## ' + spName + '\n\n';
      newNarrative += (spr.narrative || '').trim() + '\n\n';
    });
    newNarrative = newNarrative.trim();

    d.consolidatedNarrative = newNarrative;

    // v74 : créer automatiquement les Design Issues détectées par Copilot
    var nbDesignIssuesCreated = 0;
    if (Array.isArray(result.designIssues) && result.designIssues.length > 0) {
      _ensureIssues(d);
      result.designIssues.forEach(function(di){
        // Validation des champs minimum
        if (!di || (!di.title && !di.description)) return;
        var subtype = (di.subtype === 'missing' || di.subtype === 'weak') ? di.subtype : 'weak';
        var title = (di.title || '').trim() || (subtype === 'missing' ? 'Contrôle manquant' : 'Contrôle insuffisant');
        var description = (di.description || '').trim();
        // Résoudre l'ID du SP si fourni (et qu'il existe)
        var spId = di.relatedSpId && spById[di.relatedSpId] ? di.relatedSpId : null;

        // v75 : root cause IA (validée par l'auditeur ensuite)
        var rcCat = di.rootCauseCategory && _getRootCauseCategory(di.rootCauseCategory) ? di.rootCauseCategory : 'tbd';
        var rcExpl = (di.rootCauseExplanation || '').trim();

        d.issues.push({
          id: 'iss_' + Date.now() + '_' + Math.floor(Math.random()*100000) + '_' + nbDesignIssuesCreated,
          source: 'design',
          subtype: subtype, // 'missing' ou 'weak'
          title: title,
          description: description,
          controlName: (di.controlName || '').trim(),
          relatedSpId: spId,
          // v75 : root cause
          rootCauseCategory: rcCat,
          rootCauseExplanation: rcExpl,
          aiGenerated: true,
          validationStatus: 'pending', // 'pending' (IA, à valider) ou 'validated' (validée par l'auditeur)
          createdAt: new Date().toISOString(),
        });
        nbDesignIssuesCreated++;
      });
    }

    // Historique au niveau de l'audit (dans attachments.narrativeHistory)
    if (!d.attachments) d.attachments = {};
    if (!Array.isArray(d.attachments.narrativeHistory)) d.attachments.narrativeHistory = [];
    d.attachments.narrativeHistory.push({
      id: 'an_' + Date.now() + '_' + Math.floor(Math.random()*100000),
      analyzedAt: new Date().toISOString(),
      interviewIds: selectedItvIds,
      mode: _analyzeState.mode,
      nbInterviews: selectedItvIds.length,
      nbSubProcesses: result.subProcesses.length,
      nbDesignIssues: nbDesignIssuesCreated,
      target: 'audit',
    });
  } else {
    // ─── Cible : flowchart (mode legacy, conservé pour compatibilité) ───
    // Trouver le SP "courant" dans le résultat
    var currentSpResult = null;
    if (fc.subProcessId) {
      currentSpResult = result.subProcesses.find(function(spr){ return spr.matchedExistingId === fc.subProcessId; });
      if (!currentSpResult) currentSpResult = result.subProcesses[0];
    } else {
      currentSpResult = result.subProcesses[0];
    }

    if (_analyzeState.mode === 'replace' && fc.narrative && fc.narrative.trim()) {
      if (!confirm('Le narratif actuel sera entièrement remplacé. Continuer ?')) return;
    }

    if (!Array.isArray(fc.narrativeHistory)) fc.narrativeHistory = [];

    if (currentSpResult && currentSpResult.narrative) {
      fc.narrative = currentSpResult.narrative;
    }

    fc.narrativeHistory.push({
      id: 'an_' + Date.now() + '_' + Math.floor(Math.random()*100000),
      analyzedAt: new Date().toISOString(),
      interviewIds: selectedItvIds,
      mode: _analyzeState.mode,
      nbInterviews: selectedItvIds.length,
      nbSubProcesses: result.subProcesses.length,
      target: 'flowchart',
    });
  }

  // Marquer les entretiens comme analysés (commun aux deux cibles)
  selectedItvIds.forEach(function(itvId){
    var itv = (d.interviews || []).find(function(i){return i.id === itvId;});
    if (itv) itv.analyzedAt = new Date().toISOString();
  });

  // Identifier les SPs non matchés à proposer en création
  var unmatched = result.subProcesses.filter(function(spr){return !spr.matchedExistingId;});

  await saveAuditData(CA);

  closeModal();
  document.getElementById('det-content').innerHTML = renderDetContent();
  // v74 : toast avec count des Design Issues
  var nbDIs = (result && Array.isArray(result.designIssues)) ? result.designIssues.length : 0;
  if (isAuditTarget) {
    var msg = '✓ Narratif consolidé importé';
    if (nbDIs > 0) msg += ' · ' + nbDIs + ' Design Issue' + (nbDIs > 1 ? 's' : '') + ' créée' + (nbDIs > 1 ? 's' : '') + ' (à valider)';
    toast(msg);
  } else {
    toast('✓ Narratif importé');
  }

  // Si SPs non matchés : proposer à l'auditeur slot par slot
  if (unmatched.length > 0) {
    setTimeout(function() {
      _askToCreateNewSps(unmatched, 0);
    }, 800);
  }

  _analyzeState = null;
}

// Demander slot par slot à l'auditeur s'il veut créer les nouveaux SPs
function _askToCreateNewSps(unmatched, idx) {
  if (idx >= unmatched.length) return;
  var spr = unmatched[idx];
  var msg = 'Copilot a détecté un sous-processus qui n\'existe pas dans cet audit :\n\n';
  msg += '« '+spr.name+' »\n\n';
  msg += 'Veux-tu le créer en étape 2 (Processus Couverts) ?';

  if (confirm(msg)) {
    var d = getAudData(CA);
    if (!d.kickoffPrep) d.kickoffPrep = {};
    if (!Array.isArray(d.kickoffPrep.subProcesses)) d.kickoffPrep.subProcesses = [];
    d.kickoffPrep.subProcesses.push({
      id: 'sp_' + Date.now() + '_' + Math.floor(Math.random()*100000),
      name: spr.name,
      description: '',
    });
    saveAuditData(CA);
    toast('✓ Sous-processus "'+spr.name+'" créé en étape 2');
  }

  // Passer au suivant
  setTimeout(function() { _askToCreateNewSps(unmatched, idx + 1); }, 300);
}

