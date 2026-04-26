// ════════════════════════════════════════════════════════════════════════════
//  Patch — js/data.js
//  Ajoute les process manquants à l'Audit Universe pour qu'il s'aligne
//  avec la bibliothèque de contrôles.
// ════════════════════════════════════════════════════════════════════════════

// REMPLACER la définition actuelle de PROCESSES (lignes 132-146) par :

let PROCESSES=[
  // ─── Governance ────────────────────────────────────────────────────────
  {id:'p1', dom:'Governance', proc:'Acquisitions', risk:3, riskLevel:'eleve', archived:false,
    y26:{l:'SBS Integration',e:'sbs'}, y27:{l:'Product Strat.',e:'both'}},
  {id:'p2', dom:'Governance', proc:'Compliance', risk:1, riskLevel:'faible', archived:false,
    y28:{l:'Compliance / IP',e:'grp'}},

  // ─── Edition ───────────────────────────────────────────────────────────
  {id:'p3', dom:'Edition', proc:'Products & Portfolio', risk:2, riskLevel:'modere', archived:false,
    y27:{l:'Product Strat.',e:'both'}},
  {id:'p5', dom:'Edition', proc:'Product Development', risk:2, riskLevel:'modere', archived:false,
    y26:{l:'E2E Cross PL',e:'74s'}, y27:{l:'Product Devt',e:'74s'}},

  // ─── Deployment ────────────────────────────────────────────────────────
  {id:'p6', dom:'Deployment', proc:'Product Deployment', risk:2, riskLevel:'modere', archived:false,
    y27:{l:'Product Deployment',e:'74s'}},
  {id:'p7', dom:'Deployment', proc:'Product Quality & Support', risk:2, riskLevel:'modere', archived:false,
    y27:{l:'Support',e:'74s'}},

  // ─── Distribution ──────────────────────────────────────────────────────
  {id:'p8',  dom:'Distribution', proc:'Go-to-Market', risk:1, riskLevel:'faible', archived:false,
    y26:{l:'GTM',e:'74s'}, y28:{l:'GTM',e:'74s'}},
  {id:'p9',  dom:'Distribution', proc:'Sales & Services', risk:1, riskLevel:'faible', archived:false,
    y27:{l:'Sales',e:'both'}},
  {id:'p10', dom:'Distribution', proc:'Customer Experience', risk:2, riskLevel:'modere', archived:false,
    y26:{l:'Customer Success',e:'74s'}},

  // ─── Support — Finance ─────────────────────────────────────────────────
  {id:'p11', dom:'Support', proc:'OTC', risk:1, riskLevel:'faible', archived:false,
    y28:{l:'OTC',e:'grp'}},
  {id:'p12', dom:'Support', proc:'Treasury & Tax', risk:1, riskLevel:'faible', archived:false,
    y26:{l:'Cash',e:'grp'}},
  {id:'p15', dom:'Support', proc:'Budget / Forecast', risk:1, riskLevel:'faible', archived:false},

  // ─── NOUVEAUX PROCESS ─────────────────────────────────────────────────
  {id:'p16', dom:'Support', proc:'Finance - Accounting and Tax', risk:2, riskLevel:'modere', archived:false},
  {id:'p17', dom:'Support', proc:'Purchasing and Third Party Management', risk:2, riskLevel:'modere', archived:false},
  {id:'p18', dom:'Support', proc:'HR - Talent Acquisition', risk:1, riskLevel:'faible', archived:false},
  {id:'p19', dom:'Support', proc:'HR - Payroll', risk:2, riskLevel:'modere', archived:false},

  // ─── Support — IT ──────────────────────────────────────────────────────
  {id:'p13', dom:'Support', proc:'Cybersecurity & Data', risk:3, riskLevel:'critique', archived:false,
    y27:{l:'Cybersecurity',e:'grp'}},
];

// ════════════════════════════════════════════════════════════════════════════
//  Notes :
//
//  - Les nouveaux process p16-p19 sont volontairement sans entrée y26/y27/y28
//    (= pas encore planifiés dans le plan pluriannuel). À toi d'ajouter
//    {l:'...', e:'...'} si tu veux les inscrire au plan.
//
//  - Niveaux de risque suggérés (à ajuster selon ta cartographie réelle) :
//      p16 Finance - Accounting and Tax    = modéré (risques fiscaux + closing)
//      p17 Purchasing and 3rd Party Mgmt   = modéré (Sapin 2 + tiers)
//      p18 HR - Talent Acquisition         = faible
//      p19 HR - Payroll                    = modéré (URSSAF + sensible)
//
//  - "Treasury & Tax" (p12) reste tel quel pour la rétrocompatibilité avec
//    tes audits existants. Si tu veux le scinder un jour (Treasury seul d'un
//    côté, Tax côté p16), le mapping dans control-library.js le gère déjà.
//
// ════════════════════════════════════════════════════════════════════════════
