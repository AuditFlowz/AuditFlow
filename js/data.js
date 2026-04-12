const MO=['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
const STEPS=[
  {s:'Scope & Preparation',ph:1},{s:'Work Program',ph:1},{s:'Audit Kick Off',ph:1},
  {s:'Interviews / Process Review',ph:2},{s:'Flowcharts/Testing Strategy',ph:2},{s:'Testings',ph:2},
  {s:'Report',ph:3},{s:'Report Restitution',ph:3},{s:'Management Responses',ph:3},
  {s:'Exec. Committee Report',ph:3}
];
const PRCT={'Préparation':10,'Exécution':50,'Revue':80,'Clôturé':100,'Planifié':0,'Restitution':90};
const BMAP={'Préparation':'bp2','Exécution':'be','Revue':'br2','Clôturé':'bdn','Planifié':'bpl','Restitution':'br2','En retard':'blt','En cours':'be','Non démarré':'bpl'};
const GC=['#AFA9EC','#85B7EB','#5DCAA5','#EF9F27','#F0997B','#97C459','#AFA9EC','#85B7EB','#5DCAA5','#EF9F27'];
const AVC={pm:'background:#CECBF6;color:#3C3489',sh:'background:#9FE1CB;color:#085041',ne:'background:#B5D4F4;color:#0C447C'};
const TM={pm:{name:'Philippe M.',short:'PM',role:'admin',title:'Directeur Audit Interne'},sh:{name:'Selma H.',short:'SH',role:'auditeur',title:'Auditrice'},ne:{name:'Nisrine E.',short:'NE',role:'auditeur',title:'Auditrice'}};
const RS={1:'<span style="color:var(--green)">★</span>',2:'<span style="color:var(--amber)">★★</span>',3:'<span style="color:var(--red)">★★★</span>'};
const ENT={sbs:'<span class="badge bsbs">SBS</span>',axw:'<span class="badge baxw">AXW</span>','74s':'<span class="badge bpc">74S</span>',both:'<span class="badge" style="background:var(--amber-lt);color:#633806">SBS/AXW</span>',grp:'<span class="badge bgrp">Groupe</span>'};

let CU=null,CV='dashboard',CA=null,CS=0,CT='roles';

var USERS=[
  {id:'pm',name:'Philippe M.',email:'pmassard@74software.com',role:'admin',status:'actif',pwd:'Audit1234!',organization_id:'00000000-0000-0000-0000-000000000001'},
  {id:'sh',name:'Selma H.',email:'shentabli@74software.com',role:'auditeur',status:'actif',pwd:'Audit1234!',organization_id:'00000000-0000-0000-0000-000000000001'},
  {id:'ne',name:'Nisrine E.',email:'nechah@74software.com',role:'auditeur',status:'actif',pwd:'Audit1234!',organization_id:'00000000-0000-0000-0000-000000000001'},
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
  {id:'p1',dom:'Governance',proc:'Acquisitions',risk:3,archived:false,y26:{l:'SBS Integration',e:'sbs'},y27:{l:'Product Strat.',e:'both'}},
  {id:'p2',dom:'Governance',proc:'Compliance',risk:1,archived:false,y28:{l:'Compliance / IP',e:'grp'}},
  {id:'p3',dom:'Edition',proc:'Products & Portfolio',risk:2,archived:false,y27:{l:'Product Strat.',e:'both'}},
  {id:'p5',dom:'Edition',proc:'Product Development',risk:2,archived:false,y26:{l:'E2E Cross PL',e:'74s'},y27:{l:'Product Devt',e:'74s'},y28:{l:'Research Tax Credit',e:'grp'}},
  {id:'p6',dom:'Deployment',proc:'Product Deployment',risk:2,archived:false,y27:{l:'Product Deployment',e:'74s'}},
  {id:'p7',dom:'Deployment',proc:'Product Quality & Support',risk:2,archived:false,y27:{l:'Support',e:'74s'}},
  {id:'p8',dom:'Distribution',proc:'Go-to-Market',risk:1,archived:false,y26:{l:'GTM',e:'74s'},y28:{l:'GTM',e:'74s'}},
  {id:'p9',dom:'Distribution',proc:'Sales & Services',risk:1,archived:false,y27:{l:'Sales',e:'both'}},
  {id:'p10',dom:'Distribution',proc:'Customer Experience',risk:2,archived:false,y26:{l:'Customer Success',e:'74s'}},
  {id:'p11',dom:'Support',proc:'OTC',risk:1,archived:false,y28:{l:'OTC',e:'grp'}},
  {id:'p12',dom:'Support',proc:'Treasury & Tax',risk:1,archived:false,y26:{l:'Cash',e:'grp'},y28:{l:'Research Tax Credit',e:'grp'}},
  {id:'p13',dom:'Support',proc:'Cybersecurity & Data',risk:3,archived:false,y27:{l:'Cybersecurity',e:'grp'}},
  {id:'p15',dom:'Support',proc:'Budget / Forecast',risk:1,archived:false},
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
      id:ap.id,
      name:ap.titre,
      type:ap.type,
      ent:ap.type==='BU'?ap.entite:'74S',
      start:0,dur:ap.annee===2025?6:3,
      status:s,
      step:step,
      assignedTo:ap.auditeurs||[],
      planRef:ap.id
    };
  });
}
