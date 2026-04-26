const MO=['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
const STEPS=[
  {s:'Scope & Preparation',ph:1},{s:'Work Program',ph:1},{s:'Audit Kick Off',ph:1},
  {s:'Interview / Flowcharts',ph:2},{s:'WCGW / Contrôles / Test Strategy',ph:2},{s:'Testings',ph:2},
  {s:'Report',ph:3},{s:'Report Restitution',ph:3},{s:'Management Responses',ph:3},
  {s:'Exec. Committee Report',ph:3}
];
// Étapes "clés" qui nécessitent un workflow de revue (finalisation + revue par admin)
// Les autres étapes gardent le fonctionnement simple (juste "Valider l'étape")
const KEY_STEPS = [2, 4, 5, 6, 8]; // Kick Off, Test Strategy, Testings, Report, Mgt Responses

// ══════════════════════════════════════════════════════════════
//  DOCUMENTS ATTENDUS PAR ÉTAPE (référentiel global - en dur)
//  CS = step index (0-based)
// ══════════════════════════════════════════════════════════════
const EXPECTED_DOCS_BY_STEP = {
  0: ['Audit Plan', 'Audit Charter'],
  1: ['Work Program', 'Audit Notice'],
  2: ['Mémo de Kick-Off', 'Présentation de cadrage', 'Liste des participants'],
  3: ['Comptes-rendus d\'interview', 'Flowcharts du process', 'Liste des participants'],
  4: ['Risk & Control Matrix (RCM)', 'Test Strategy', 'Sample selection'],
  5: ['Test results', 'Working papers'],
  6: ['Rapport d\'audit (draft)', 'Rapport d\'audit (final)'],
  7: ['Compte-rendu de restitution', 'Présentation de restitution'],
  8: ['Tableau des Management Responses'],
  9: ['Closing memo', 'Présentation Comité d\'audit'],
};

// ══════════════════════════════════════════════════════════════
//  RISK UNIVERSE : hiérarchie des risques du Groupe
//  Format: [{id, level:'group'|'operational', parentId, title, description,
//           probability:'Rare'|'Unlikely'|'Possible'|'Certain',
//           impact:'Minor'|'Limited'|'Major'|'Severe',
//           impactTypes:['Réputation','Financier','Legal','Operations']}]
// ══════════════════════════════════════════════════════════════
var RISK_UNIVERSE = [];

// Valeurs autorisées
var RISK_PROBABILITIES = ['Rare', 'Unlikely', 'Possible', 'Certain'];
var RISK_IMPACTS = ['Minor', 'Limited', 'Major', 'Severe'];
var RISK_IMPACT_TYPES = ['Réputation', 'Financier', 'Legal', 'Operations'];

// Couleurs par niveau d'impact (pour l'affichage)
var RISK_IMPACT_COLORS = {
  'Minor':   {bg:'#D1FAE5', color:'#065F46'},  // vert
  'Limited': {bg:'#FEF3C7', color:'#854F0B'},  // jaune
  'Major':   {bg:'#FED7AA', color:'#9A3412'},  // orange
  'Severe':  {bg:'#FECACA', color:'#991B1B'},  // rouge
};

// ══════════════════════════════════════════════════════════════
//  PRODUCT LINES : [{id, name, society:'SBS'|'AXW', countries:[], description}]
// ══════════════════════════════════════════════════════════════
var PRODUCT_LINES = [];

// ══════════════════════════════════════════════════════════════
//  CONTROLS LIBRARY : Référentiel de contrôles standards (COSO, COBIT, ITGC...)
//  [{id, framework, domain, code, name, description, wcgwTypical, nature,
//    frequency, key, designDefault, ownerType, testProcedures, appliesToDomains, archived}]
// ══════════════════════════════════════════════════════════════
var CONTROLS_LIBRARY = [];

// Frameworks supportés (référentiels)
var CONTROL_FRAMEWORKS = ['COSO 2013', 'COBIT 2019', 'ITGC', 'SOX', 'ISO 27001', 'RGPD', 'NIST CSF', 'Custom'];

// Domaines de contrôles standard (catégorisation transversale)
var CONTROL_DOMAINS = [
  'Financial Reporting',
  'IT General Controls',
  'Cyber Security',
  'Access Management',
  'Change Management',
  'Procurement',
  'Human Resources',
  'Compliance & Legal',
  'Operations',
  'Data Privacy',
  'Vendor Management',
  'Business Continuity',
];

// Catégories par défaut pour les missions "Other" (non-audit)
// Les utilisateurs peuvent en ajouter de nouvelles à la volée dans le formulaire
var OTHER_CATEGORIES_DEFAULT = [
  'Reporting Comité Audit',
  'Compliance',
  'Risk Management',
  'Autre mission',
];

// Couleurs par catégorie (pour les badges et le Gantt)
// Si une catégorie n'est pas listée, couleur par défaut "orange"
var OTHER_CATEGORY_COLORS = {
  'Reporting Comité Audit':     {bg:'#E0E7FF', color:'#3730A3', gantt:'#6366F1'},
  'Compliance':                 {bg:'#FEF3C7', color:'#854F0B', gantt:'#F59E0B'},
  'Risk Management':            {bg:'#DBEAFE', color:'#1E40AF', gantt:'#3B82F6'},
  'Autre mission':              {bg:'#F3F4F6', color:'#374151', gantt:'#6B7280'},
  // Anciennes catégories conservées pour compat (si déjà utilisées)
  'Sapin 2 - Cartographie':     {bg:'#FEF3C7', color:'#854F0B', gantt:'#F59E0B'},
  'URD - Facteurs de risques':  {bg:'#DBEAFE', color:'#1E40AF', gantt:'#3B82F6'},
  'Comité d\'audit':             {bg:'#E0E7FF', color:'#3730A3', gantt:'#6366F1'},
  'Formation / Conférence':     {bg:'#F3E8FF', color:'#6B21A8', gantt:'#A855F7'},
  'Revue du plan d\'audit':      {bg:'#CFFAFE', color:'#155E75', gantt:'#06B6D4'},
  'Autre':                       {bg:'#F3F4F6', color:'#374151', gantt:'#6B7280'},
};

// Obtenir toutes les catégories connues (défaut + celles utilisées dans AUDIT_PLAN)
function getAllOtherCategories() {
  var set = new Set(OTHER_CATEGORIES_DEFAULT);
  if (typeof AUDIT_PLAN !== 'undefined') {
    AUDIT_PLAN.forEach(function(a){
      if (a.type==='Other' && a.categorie) set.add(a.categorie);
    });
  }
  return Array.from(set).sort(function(a,b){
    return a.localeCompare(b, 'fr', {sensitivity:'base'});
  });
}

// Obtenir les couleurs d'une catégorie (avec fallback)
function getOtherCategoryColors(cat) {
  return OTHER_CATEGORY_COLORS[cat] || {bg:'#FED7AA', color:'#9A3412', gantt:'#F97316'};
}
const PRCT={'Préparation':10,'Exécution':50,'Revue':80,'Clôturé':100,'Fait':100,'Planifié':0,'Restitution':90};
const BMAP={'Préparation':'bp2','Exécution':'be','Revue':'br2','Clôturé':'bdn','Fait':'bdn','Planifié':'bpl','Restitution':'br2','En retard':'blt','En cours':'be','Non démarré':'bpl'};
const GC=['#AFA9EC','#85B7EB','#5DCAA5','#EF9F27','#F0997B','#97C459','#AFA9EC','#85B7EB','#5DCAA5','#EF9F27'];
var AVC={pm:'background:#CECBF6;color:#3C3489',sh:'background:#9FE1CB;color:#085041',ne:'background:#B5D4F4;color:#0C447C'};
var TM={pm:{name:'Philippe M.',short:'PM',role:'admin',title:'Directeur Audit Interne'},sh:{name:'Selma H.',short:'SH',role:'auditeur',title:'Auditrice'},ne:{name:'Nisrine E.',short:'NE',role:'auditeur',title:'Auditrice'}};
const RS={1:'<span style="color:var(--green)">★</span>',2:'<span style="color:var(--amber)">★★</span>',3:'<span style="color:var(--red)">★★★</span>'};
const ENT={sbs:'<span class="badge bsbs">SBS</span>',axw:'<span class="badge baxw">AXW</span>','74s':'<span class="badge bpc">74S</span>',both:'<span class="badge" style="background:var(--amber-lt);color:#633806">SBS/AXW</span>',grp:'<span class="badge bgrp">Groupe</span>'};

let CU=null,CV='dashboard',CA=null,CS=0,CT='roles';

// L'authentification passe par Microsoft Entra ID (MSAL).
// Aucun mot de passe n'est stocké côté application.
var USERS=[
  {id:'pm',name:'Philippe M.',email:'pmassard@74software.com',role:'admin',status:'actif',organization_id:'00000000-0000-0000-0000-000000000001'},
  {id:'sh',name:'Selma H.',email:'shentabli@74software.com',role:'auditeur',status:'actif',organization_id:'00000000-0000-0000-0000-000000000001'},
  {id:'ne',name:'Nisrine E.',email:'nechah@74software.com',role:'auditeur',status:'actif',organization_id:'00000000-0000-0000-0000-000000000001'},
  {id:'superadmin',name:'Super Admin',email:'pmassard.fr@gmail.com',role:'superadmin',status:'actif',organization_id:'00000000-0000-0000-0000-000000000000'},
];
let PENDING=[];
let HISTORY_LOG=[];

let AUDIT_PLAN=[
  {id:'ap1',type:'Process',domaine:'Edition',process:'Product Development',processId:'p5',titre:'Product Development 2025',annee:2025,auditeurs:['sh'],statut:'En cours'},
  {id:'ap2',type:'Process',domaine:'Deployment',process:'Product Deployment',processId:'p6',titre:'Product Deployment 2025',annee:2025,auditeurs:['ne'],statut:'En cours'},
  {id:'ap3',type:'Process',domaine:'Support',process:'Budget / Forecast',processId:'p15',titre:'Budget / Forecast 2025',annee:2025,auditeurs:['sh'],statut:'Planifié'},
  {id:'ap4',type:'BU',entite:'SBS',region:'AMEE',pays:['Maroc','Tunisie','Cameroun'],titre:'BU Maroc/Afrique 2025',annee:2025,auditeurs:['sh'],statut:'Clôturé'},
  {id:'ap5',type:'BU',entite:'SBS',region:'AMEE',pays:['Liban'],titre:'BU Lebanon 2025',annee:2025,auditeurs:['ne'],statut:'En cours'},
  {id:'ap6',type:'BU',entite:'SBS',region:'Europe',pays:['UK'],titre:'BU UK SBS 2025',annee:2025,auditeurs:['sh','ne'],statut:'Planifié'},
  {id:'ap7',type:'Process',domaine:'Distribution',process:'Go-to-Market',processId:'p8',titre:'GTM Audit 2026',annee:2026,auditeurs:['sh'],statut:'En cours'},
  {id:'ap8',type:'Process',domaine:'Support',process:'Cybersecurity & Data',processId:'p13',titre:'Cybersecurity Audit 2026',annee:2026,auditeurs:['ne'],statut:'Planifié'},
  {id:'ap9',type:'BU',entite:'SBS',region:'AMEE',pays:['Liban'],titre:'BU Lebanon 2026',annee:2026,auditeurs:['sh'],statut:'Planifié'},
  {id:'ap10',type:'BU',entite:'AXWAY',region:'Europe',pays:['Romania'],titre:'BU Romania 2026',annee:2026,auditeurs:['ne'],statut:'Clôturé'},
  {id:'ap11',type:'Process',domaine:'Edition',process:'Product Development',processId:'p5',titre:'E2E Cross PL 2026',annee:2026,auditeurs:['sh','ne'],statut:'En cours'},
];

let PROCESSES=[
  {id:'p1',dom:'Governance',proc:'Acquisitions',risk:3,riskLevel:'eleve',archived:false,y26:{l:'SBS Integration',e:'sbs'},y27:{l:'Product Strat.',e:'both'}},
  {id:'p2',dom:'Governance',proc:'Compliance',risk:1,riskLevel:'faible',archived:false,y28:{l:'Compliance / IP',e:'grp'}},
  {id:'p3',dom:'Edition',proc:'Products & Portfolio',risk:2,riskLevel:'modere',archived:false,y27:{l:'Product Strat.',e:'both'}},
  {id:'p5',dom:'Edition',proc:'Product Development',risk:2,riskLevel:'modere',archived:false,y26:{l:'E2E Cross PL',e:'74s'},y27:{l:'Product Devt',e:'74s'},y28:{l:'Research Tax Credit',e:'grp'}},
  {id:'p6',dom:'Deployment',proc:'Product Deployment',risk:2,riskLevel:'modere',archived:false,y27:{l:'Product Deployment',e:'74s'}},
  {id:'p7',dom:'Deployment',proc:'Product Quality & Support',risk:2,riskLevel:'modere',archived:false,y27:{l:'Support',e:'74s'}},
  {id:'p8',dom:'Distribution',proc:'Go-to-Market',risk:1,riskLevel:'faible',archived:false,y26:{l:'GTM',e:'74s'},y28:{l:'GTM',e:'74s'}},
  {id:'p9',dom:'Distribution',proc:'Sales & Services',risk:1,riskLevel:'faible',archived:false,y27:{l:'Sales',e:'both'}},
  {id:'p10',dom:'Distribution',proc:'Customer Experience',risk:2,riskLevel:'modere',archived:false,y26:{l:'Customer Success',e:'74s'}},
  {id:'p11',dom:'Support',proc:'OTC',risk:1,riskLevel:'faible',archived:false,y28:{l:'OTC',e:'grp'}},
  {id:'p12',dom:'Support',proc:'Treasury & Tax',risk:1,riskLevel:'faible',archived:false,y26:{l:'Cash',e:'grp'},y28:{l:'Research Tax Credit',e:'grp'}},
  {id:'p13',dom:'Support',proc:'Cybersecurity & Data',risk:3,riskLevel:'critique',archived:false,y27:{l:'Cybersecurity',e:'grp'}},
  {id:'p15',dom:'Support',proc:'Budget / Forecast',risk:1,riskLevel:'faible',archived:false},
];

let ACTIONS=[
  {id:'ac1',title:"Contrôles d'accès SI",audit:'Cybersecurity',resp:'Nisrine E.',dept:'IT / Sécurité',ent:'Groupe',year:2025,quarter:'Q4',status:'En retard',pct:30,fromFinding:false},
  {id:'ac2',title:'Séparation des tâches OTC',audit:'OTC',resp:'Selma H.',dept:'Finance',ent:'Groupe',year:2025,quarter:'Q4',status:'En retard',pct:10,fromFinding:false},
  {id:'ac3',title:'Mise à jour procédure achats',audit:'P2P',resp:'Nisrine E.',dept:'Procurement',ent:'Groupe',year:2026,quarter:'Q1',status:'En cours',pct:60,fromFinding:false},
];

let AUD_DATA={};

function getAudData(id){if(!AUD_DATA[id])AUD_DATA[id]={tasks:{},controls:{},findings:[],mgtResp:[],docs:[],notes:''};return AUD_DATA[id];}

function getAudits(){
  return AUDIT_PLAN.map(ap=>{
    var s = ap.statut||'Planifié';
    var base = s.includes('|') ? s.split('|')[0] : s;
    var step = 0;
    if(s.includes('|')) step = parseInt(s.split('|')[1]);
    else if(base==='Clôturé') step = 10;
    else if(base==='En cours') step = 2;
    return {
      id:ap.id, name:ap.titre, type:ap.type,
      ent:ap.type==='BU'?ap.entite:'74S',
      start:0, dur:ap.annee===2025?6:3,
      status:s, step:step,
      assignedTo:ap.auditeurs||[],
      planRef:ap.id
    };
  });
}
