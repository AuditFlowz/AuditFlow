// ════════════════════════════════════════════════════════════════════════════
//  audit-report-generator.js — Génération du Audit Report (PowerPoint)
//
//  Utilise PptxGenJS (chargée via CDN dans index.html, expose `PptxGenJS` global)
//
//  Source des données :
//   - AUDIT_PLAN[id]      → titre, type, processIds, auditeurs, etc.
//   - PROCESSES           → noms des process
//   - RISK_UNIVERSE       → risques liés au process
//   - AUD_DATA[id].kickoffPrep → interviews, planning (étape 1)
//   - AUD_DATA[id].findings    → findings articulés (étape 7)
//   - AUD_DATA[id].controls    → contrôles testés (étape 5/6)
//   - AUD_DATA[id].mgtResp     → management responses (étape 9)
//   - AUD_DATA[id].maturity    → maturité du process
//   - TM (Team Members)        → noms des auditeurs
// ════════════════════════════════════════════════════════════════════════════

// ─── Couleurs ──────────────────────────────────────────────────────────────
const AR_COLORS = {
  navy:      "2D2E83",
  red:       "C8102E",
  yellow:    "F2A900",
  pink:      "D74894",
  purple:    "722F66",
  white:     "FFFFFF",
  grayLight: "F2F2F2",
  grayMed:   "BFBFBF",
  textDark:  "222222",
  textGray:  "555555",
  lavender:  "EEEDFE",
};

// ─── Logos embarqués (base64) ──────────────────────────────────────────────
const AR_LOGO_74S = 'data:image/jpeg;base64,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';
const AR_LOGO_AXWSBS = 'data:image/jpeg;base64,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';

// ─── Helpers ───────────────────────────────────────────────────────────────

// Footer commun à toutes les slides (logos)
function ar_addFooter(pres, slide) {
  // Logo 74Software (bas-gauche)
  slide.addImage({
    data: AR_LOGO_74S,
    x: 0.3, y: 6.95,
    w: 1.3, h: 0.4,
  });
  // Logos Axway + SBS combinés (bas-droite)
  slide.addImage({
    data: AR_LOGO_AXWSBS,
    x: 11.0, y: 6.95,
    w: 2.0, h: 0.4,
  });
}

// Bandeau de titre standard pour slides intérieures
function ar_addTitleBar(pres, slide, mainTitle, subTitle) {
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.7,
    fill: {color: AR_COLORS.navy}, line: {type: "none"},
  });
  slide.addText(mainTitle, {
    x: 0.3, y: 0, w: 12, h: 0.7,
    fontSize: 28, bold: true, color: AR_COLORS.white,
    fontFace: "Calibri", valign: "middle",
  });
  if (subTitle) {
    slide.addText(subTitle, {
      x: 0.3, y: 0.75, w: 12, h: 0.6,
      fontSize: 22, color: AR_COLORS.navy,
      fontFace: "Calibri", valign: "middle",
    });
  }
}

// Format date for display
function ar_fmtDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().slice(0, 10);
  } catch (e) {
    return dateStr;
  }
}

// Initiales depuis le nom
function ar_initials(name) {
  if (!name) return '??';
  return name.split(/[ .]/).filter(Boolean).map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
}

// Format probabilité × impact pour affichage
function ar_riskLabel(probability, impact) {
  const probs = {rare:'Rare', unlikely:'Unlikely', possible:'Possible', probable:'Probable/Certain'};
  const imps  = {minor:'Minor', limited:'Limited', major:'Major', severe:'Severe'};
  if (!probability || !impact) return '—';
  return (probs[probability]||probability) + ' × ' + (imps[impact]||impact);
}

// Couleur de cellule pour la matrice de risque
// Probability axis: rare=0, unlikely=1, possible=2, probable=3
// Impact axis: minor=0, limited=1, major=2, severe=3
function ar_riskColor(probability, impact) {
  const probMap = {rare:0, unlikely:1, possible:2, probable:3};
  const impMap  = {minor:0, limited:1, major:2, severe:3};
  const p = probMap[probability];
  const i = impMap[impact];
  if (p === undefined || i === undefined) return AR_COLORS.grayLight;
  // Score 0-6 => green, yellow, orange, red
  const score = p + i;
  if (score <= 1) return "C6EFCE"; // green
  if (score <= 3) return "FFEB9C"; // yellow
  if (score <= 4) return "FFC7CE"; // light red
  return "F4B084"; // dark red
}

// ─── EXPORT PRINCIPAL ──────────────────────────────────────────────────────

async function generateAuditReportPptx(auditId) {
  // 1. Vérifier PptxGenJS chargé
  if (typeof PptxGenJS === 'undefined') {
    if (typeof toast === 'function') toast('PptxGenJS non chargé. Rechargez la page.');
    return;
  }

  // 2. Récupérer les données globales
  const _AUDIT_PLAN = (typeof AUDIT_PLAN !== "undefined") ? AUDIT_PLAN : [];
  const _CA = (typeof CA !== "undefined") ? CA : null;
  const _PROCESSES = (typeof PROCESSES !== "undefined") ? PROCESSES : [];
  const _RISK_UNIVERSE = (typeof RISK_UNIVERSE !== "undefined") ? RISK_UNIVERSE : [];
  const _TM = (typeof TM !== "undefined") ? TM : {};

  let realAuditId = auditId;
  let ap = _AUDIT_PLAN.find(a => a.id === realAuditId);
  if (!ap && _CA) {
    realAuditId = _CA;
    ap = _AUDIT_PLAN.find(a => a.id === realAuditId);
    console.log('[AUDIT_REPORT] Fallback sur CA:', realAuditId);
  }
  if (!ap) {
    console.error('[AUDIT_REPORT] Audit introuvable. auditId=', auditId, 'CA=', _CA);
    if (typeof toast === 'function') toast('Audit introuvable');
    return;
  }
  auditId = realAuditId;

  const d = AUD_DATA && AUD_DATA[auditId] ? AUD_DATA[auditId] : {};
  const prep = d.kickoffPrep || {};
  const interviews = Array.isArray(prep.interviews) ? prep.interviews : [];
  const planning = prep.planning || {};
  const findings = Array.isArray(d.findings) ? d.findings : [];
  const controls = (d.controls && d.controls[4]) || [];
  const mgtResp = Array.isArray(d.mgtResp) ? d.mgtResp : [];
  const maturity = d.maturity || null;

  // Récupérer le nom du process
  const procIds = Array.isArray(ap.processIds) && ap.processIds.length ? ap.processIds : (ap.processId ? [ap.processId] : []);
  const procNames = procIds.map(id => {
    const p = _PROCESSES.find(x => x.id === id);
    return p ? p.proc : null;
  }).filter(Boolean);
  const processName = procNames.join(' / ') || ap.titre || '—';

  // Récupérer les auditeurs
  const auditeurIds = Array.isArray(ap.auditeurs) ? ap.auditeurs : [];
  const auditeurs = auditeurIds.map(id => {
    const tm = _TM && _TM[id];
    return tm ? {name: tm.name, role: tm.role || 'Auditor'} : null;
  }).filter(Boolean);

  // Date du rapport
  const today = new Date();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const reportDate = monthNames[today.getMonth()] + ' ' + today.getFullYear();

  // Tests realisés (controls existing + finalized)
  const testedControls = controls.filter(c => c.clef && c.design === 'existing' && c.finalized);
  const failedTests = testedControls.filter(c => c.result === 'fail');
  const passedTests = testedControls.filter(c => c.result === 'pass');

  // Maturité label
  const maturityLabels = {
    unsatisfactory: {label: 'Unsatisfactory', color: AR_COLORS.red},
    major: {label: 'Major improvements', color: 'E97132'},
    some:  {label: 'Some improvements',  color: AR_COLORS.yellow},
    effective: {label: 'Effective', color: '548235'},
  };
  const matInfo = maturity && maturityLabels[maturity] ? maturityLabels[maturity] : null;

  // Titre court
  const auditTitleShort = ap.titre || processName;

  // 3. Construire le pptx
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 1 — COVER PAGE
  // ════════════════════════════════════════════════════════════════════
  const s1 = pres.addSlide();

  // Bandeau bleu marine + accents rouge/jaune
  s1.addShape(pres.ShapeType.rect, {
    x: 0, y: 2.7, w: 11, h: 1.8,
    fill: {color: AR_COLORS.navy}, line: {type: "none"},
  });
  s1.addShape(pres.ShapeType.rect, {
    x: 11, y: 2.7, w: 0.7, h: 1.8,
    fill: {color: AR_COLORS.red}, line: {type: "none"},
  });
  s1.addShape(pres.ShapeType.rect, {
    x: 11.7, y: 2.7, w: 0.7, h: 1.8,
    fill: {color: AR_COLORS.yellow}, line: {type: "none"},
  });

  s1.addText(processName, {
    x: 0.5, y: 2.9, w: 10.4, h: 0.7,
    fontSize: 36, bold: true, color: AR_COLORS.white,
    fontFace: "Calibri", align: "left",
  });
  s1.addText("Audit Report", {
    x: 0.5, y: 3.65, w: 10.4, h: 0.6,
    fontSize: 28, color: AR_COLORS.white,
    fontFace: "Calibri", align: "left",
  });

  // Date en bas centré
  s1.addText("Internal Audit – " + reportDate, {
    x: 0, y: 6.35, w: 13.33, h: 0.5,
    fontSize: 16, color: AR_COLORS.textDark,
    fontFace: "Calibri", align: "center", italic: true,
  });

  ar_addFooter(pres, s1);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 2 — AGENDA (5 sections numérotées)
  // ════════════════════════════════════════════════════════════════════
  const s2 = pres.addSlide();
  ar_addTitleBar(pres, s2, "Introduction", "Agenda");

  const agendaSections = [
    {num: '1', label: 'General'},
    {num: '2', label: 'Executive Summary'},
    {num: '3', label: 'Detailed Findings'},
    {num: '4', label: 'Testing Details'},
    {num: '5', label: 'Appendix'},
  ];
  // 2 columns layout
  agendaSections.forEach((sec, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.8 + col * 6.0;
    const y = 1.8 + row * 1.4;
    // Numéro encadré bleu
    s2.addShape(pres.ShapeType.rect, {
      x: x, y: y, w: 0.8, h: 0.8,
      fill: {color: AR_COLORS.navy}, line: {type: "none"},
    });
    s2.addText(sec.num, {
      x: x, y: y, w: 0.8, h: 0.8,
      fontSize: 36, bold: true, color: AR_COLORS.white,
      fontFace: "Calibri", align: "center", valign: "middle",
    });
    // Label
    s2.addText(sec.label, {
      x: x + 1.0, y: y, w: 5.0, h: 0.8,
      fontSize: 20, color: AR_COLORS.textDark,
      fontFace: "Calibri", valign: "middle",
    });
  });
  ar_addFooter(pres, s2);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 3 — OBJECTIVES & METHODOLOGY (same as Kick Off, 2 columns)
  // ════════════════════════════════════════════════════════════════════
  const s3 = pres.addSlide();
  ar_addTitleBar(pres, s3, "Introduction", "Objectives & Methodology");

  // Colonne gauche : Objectives en lavande
  s3.addShape(pres.ShapeType.rect, {
    x: 0.5, y: 1.6, w: 5.0, h: 5.1,
    fill: {color: AR_COLORS.lavender}, line: {type: "none"},
  });
  s3.addShape(pres.ShapeType.ellipse, {
    x: 0.7, y: 1.85, w: 0.4, h: 0.4,
    fill: {color: AR_COLORS.navy}, line: {type: "none"},
  });
  s3.addText("1", {
    x: 0.7, y: 1.85, w: 0.4, h: 0.4,
    fontSize: 16, bold: true, color: AR_COLORS.white,
    fontFace: "Calibri", align: "center", valign: "middle",
  });
  s3.addText("Objectives", {
    x: 1.2, y: 1.78, w: 4, h: 0.5,
    fontSize: 20, bold: true, color: AR_COLORS.navy, fontFace: "Calibri",
  });
  s3.addText(
    "Provide the Audit Committee, Executive Management, and the audited departments with reasonable assurance that the control environment ensures proper management of the risks faced by the Group:",
    { x: 0.7, y: 2.5, w: 4.6, h: 1.5, fontSize: 12, color: AR_COLORS.textDark, fontFace: "Calibri" }
  );
  s3.addText([
    { text: "Economic", options: { bullet: { code: "25CF" }, fontSize: 13, bold: true, color: AR_COLORS.navy, fontFace: "Calibri", paraSpaceAfter: 4 } },
    { text: "Legal & Regulatory", options: { bullet: { code: "25CF" }, fontSize: 13, bold: true, color: AR_COLORS.navy, fontFace: "Calibri", paraSpaceAfter: 4 } },
    { text: "Reputational", options: { bullet: { code: "25CF" }, fontSize: 13, bold: true, color: AR_COLORS.navy, fontFace: "Calibri", paraSpaceAfter: 4 } },
    { text: "Operational", options: { bullet: { code: "25CF" }, fontSize: 13, bold: true, color: AR_COLORS.navy, fontFace: "Calibri" } },
  ], { x: 1.0, y: 4.2, w: 4.3, h: 2.3 });

  // Colonne droite : Methodology
  s3.addShape(pres.ShapeType.rect, {
    x: 5.8, y: 1.6, w: 7.1, h: 5.1,
    fill: {color: AR_COLORS.white}, line: {color: AR_COLORS.grayMed, width: 0.5},
  });
  s3.addShape(pres.ShapeType.ellipse, {
    x: 6.0, y: 1.85, w: 0.4, h: 0.4,
    fill: {color: AR_COLORS.navy}, line: {type: "none"},
  });
  s3.addText("2", {
    x: 6.0, y: 1.85, w: 0.4, h: 0.4,
    fontSize: 16, bold: true, color: AR_COLORS.white,
    fontFace: "Calibri", align: "center", valign: "middle",
  });
  s3.addText("Methodology", {
    x: 6.5, y: 1.78, w: 6, h: 0.5,
    fontSize: 20, bold: true, color: AR_COLORS.navy, fontFace: "Calibri",
  });
  s3.addText(
    "The audit was performed in accordance with international standards set by the Institute of Internal Auditors (IIA), structured in 3 stages:",
    { x: 6.0, y: 2.5, w: 6.8, h: 0.7, fontSize: 12, italic: true, color: AR_COLORS.textGray, fontFace: "Calibri" }
  );
  const methSteps = [
    {title: "Understanding", desc: "Risk Matrix, Controls Matrix, Flowcharts via interviews"},
    {title: "Testing", desc: "Document reviews and data analysis on key controls"},
    {title: "Assessment", desc: "Inherent risks + key controls + overall process"},
  ];
  methSteps.forEach((step, i) => {
    const y = 3.4 + i * 1.05;
    s3.addShape(pres.ShapeType.rect, {
      x: 6.0, y: y, w: 0.6, h: 0.85,
      fill: {color: AR_COLORS.navy}, line: {type: "none"},
    });
    s3.addText((i + 1).toString(), {
      x: 6.0, y: y, w: 0.6, h: 0.85,
      fontSize: 22, bold: true, color: AR_COLORS.white,
      fontFace: "Calibri", align: "center", valign: "middle",
    });
    s3.addText(step.title, {
      x: 6.8, y: y, w: 5.9, h: 0.4,
      fontSize: 15, bold: true, color: AR_COLORS.navy, fontFace: "Calibri",
    });
    s3.addText(step.desc, {
      x: 6.8, y: y + 0.4, w: 5.9, h: 0.5,
      fontSize: 11, color: AR_COLORS.textDark, fontFace: "Calibri",
    });
  });
  ar_addFooter(pres, s3);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 4 — ENGAGEMENT TIMELINE (avec dates réelles si dispo)
  // ════════════════════════════════════════════════════════════════════
  const s4 = pres.addSlide();
  ar_addTitleBar(pres, s4, "Introduction", "Engagement Timeline");
  s4.addText("The audit was conducted over 6 phases:", {
    x: 0.5, y: 1.6, w: 12, h: 0.4,
    fontSize: 14, color: AR_COLORS.textDark, fontFace: "Calibri",
  });
  s4.addShape(pres.ShapeType.line, {
    x: 0.7, y: 2.6, w: 11.9, h: 0,
    line: {color: AR_COLORS.grayMed, width: 2},
  });
  const phases = [
    {label: "Preparation", desc: "Mapping of existing processes and risks.", color: AR_COLORS.navy, dateKey: null},
    {label: "Kick Off", desc: "Discussion with management:\n• Key risks\n• Stakeholders\n• Team availability", color: AR_COLORS.pink, dateKey: 'kickOff'},
    {label: "Interviews", desc: "Interviews with operational staff responsible for the processes.", color: AR_COLORS.navy, dateKey: 'interviews'},
    {label: "Work Pgm.", desc: "Based on interviews, narratives and Key Findings will be defined to test/analyze.", color: AR_COLORS.navy, dateKey: null},
    {label: "Docs Review", desc: "Collection of documentation to conclude on procedures.", color: AR_COLORS.navy, dateKey: 'testing'},
    {label: "Audit Report", desc: "Presentation of identified Findings and recommendations.", color: AR_COLORS.navy, dateKey: 'report'},
  ];
  phases.forEach((p, i) => {
    const x = 0.7 + i * 2.1;
    s4.addShape(pres.ShapeType.ellipse, {
      x: x, y: 2.4, w: 0.4, h: 0.4,
      fill: {color: p.color}, line: {color: AR_COLORS.white, width: 2},
    });
    s4.addShape(pres.ShapeType.rect, {
      x: x - 0.4, y: 2.95, w: 1.7, h: 0.45,
      fill: {color: p.color}, line: {type: "none"},
    });
    s4.addText(p.label, {
      x: x - 0.4, y: 2.95, w: 1.7, h: 0.45,
      fontSize: 12, bold: true, color: AR_COLORS.white,
      fontFace: "Calibri", align: "center", valign: "middle",
    });
    // Date si dispo
    if (p.dateKey && planning[p.dateKey]) {
      s4.addText("(" + ar_fmtDate(planning[p.dateKey]) + ")", {
        x: x - 0.4, y: 3.45, w: 1.85, h: 0.3,
        fontSize: 9, italic: true, color: AR_COLORS.textGray,
        fontFace: "Calibri", align: "center",
      });
    }
    s4.addText(p.desc, {
      x: x - 0.4, y: 3.8, w: 1.85, h: 2.5,
      fontSize: 9, color: AR_COLORS.textDark,
      fontFace: "Calibri", valign: "top",
    });
  });
  ar_addFooter(pres, s4);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 5 — INTERVIEWEES / CONTRIBUTORS
  // ════════════════════════════════════════════════════════════════════
  const s5 = pres.addSlide();
  ar_addTitleBar(pres, s5, "Introduction", "Interviewees / Contributors");

  const itwHeader = [
    {text: "Interviewee", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.navy}, valign: "middle"}},
    {text: "Job Title / Department", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.navy}, valign: "middle"}},
    {text: "Email", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.navy}, valign: "middle"}},
  ];
  let itwRows;
  if (interviews.length) {
    itwRows = [itwHeader].concat(interviews.map(itw => [
      {text: itw.contact || '—', options: {valign: "middle", color: AR_COLORS.textDark}},
      {text: itw.dept || '—', options: {valign: "middle", color: AR_COLORS.textDark}},
      {text: itw.email || '—', options: {valign: "middle", color: AR_COLORS.textDark, fontSize: 10}},
    ]));
  } else {
    itwRows = [itwHeader, [{text: '—'}, {text: '—'}, {text: '—'}]];
  }
  s5.addTable(itwRows, {
    x: 0.5, y: 1.6, w: 12.3,
    fontSize: 12, fontFace: "Calibri",
    border: {type: "solid", pt: 0.5, color: AR_COLORS.grayMed},
    rowH: 0.5,
    colW: [3.5, 4.5, 4.3],
  });
  ar_addFooter(pres, s5);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 6 — EXECUTIVE SUMMARY - FINDINGS
  // ════════════════════════════════════════════════════════════════════
  const s6 = pres.addSlide();
  ar_addTitleBar(pres, s6, "Executive Summary - Findings", null);

  // Phrase d'intro : utilise le texte saisi par l'auditeur, sinon fallback générique
  const userHeader = (d.execSummaryHeader || '').trim();
  const introText = userHeader || `The audit of the ${processName} process identified ${findings.length} finding${findings.length>1?'s':''}.`;

  // Combiner intro + maturité dans un seul bloc de texte
  const introParts = [
    {text: introText, options: {fontSize: 12, color: AR_COLORS.textDark, fontFace: "Calibri"}},
  ];
  if (matInfo) {
    introParts.push(
      {text: ' Overall Process Maturity: ', options: {bold: true, fontSize: 12, color: AR_COLORS.textDark, fontFace: "Calibri"}},
      {text: matInfo.label, options: {bold: true, fontSize: 12, color: matInfo.color, fontFace: "Calibri"}},
    );
  }
  s6.addText(introParts, {
    x: 0.5, y: 1.0, w: 12.3, h: 1.0,
    valign: "top",
  });

  // Tableau des findings
  const fHeader = [
    {text: "Finding", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.grayMed}, valign: "middle"}},
    {text: "Associated Risk", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.grayMed}, valign: "middle"}},
    {text: "Risk Level", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.grayMed}, valign: "middle"}},
  ];
  let fRows;
  if (findings.length) {
    fRows = [fHeader].concat(findings.map((f, i) => {
      const fillColor = ar_riskColor(f.probability, f.impact);
      const shortDesc = f.descExec || (f.desc && f.desc.length<200 ? f.desc : '');
      return [
        {text: (i+1)+'. '+(f.title||'—') + (shortDesc?'\n'+shortDesc:''),
         options: {valign: "middle", color: AR_COLORS.textDark, fontSize: 11}},
        {text: f.potentialRisk || '—', options: {valign: "middle", color: AR_COLORS.textDark, fontSize: 11}},
        {text: ar_riskLabel(f.probability, f.impact),
         options: {valign: "middle", align: "center", color: AR_COLORS.textDark, fontSize: 10, bold: true, fill: {color: fillColor}}},
      ];
    }));
  } else {
    fRows = [fHeader, [{text: 'No finding identified'}, {text: '—'}, {text: '—'}]];
  }
  s6.addTable(fRows, {
    x: 0.5, y: 2.1, w: 12.3,
    fontSize: 11, fontFace: "Calibri",
    border: {type: "solid", pt: 0.5, color: AR_COLORS.grayMed},
    rowH: findings.length > 4 ? 0.6 : 0.85,
    colW: [6.0, 4.3, 2.0],
  });
  ar_addFooter(pres, s6);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 7 — EXECUTIVE SUMMARY - MANAGEMENT RESPONSES
  // ════════════════════════════════════════════════════════════════════
  const s7 = pres.addSlide();
  ar_addTitleBar(pres, s7, "Executive Summary - Management Responses", null);

  const mrHeader = [
    {text: "Finding", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.grayMed}, valign: "middle"}},
    {text: "Management Response", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.grayMed}, valign: "middle"}},
    {text: "Owner / Date", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.grayMed}, valign: "middle"}},
  ];
  let mrRows;
  if (findings.length) {
    mrRows = [mrHeader].concat(findings.map((f, i) => {
      const resp = mgtResp.find(r => r.findingId === f.id) || {};
      const ownerDate = (resp.owner || '—') + (resp.year ? ' / ' + resp.year + (resp.quarter ? ' ' + resp.quarter : '') : '');
      return [
        {text: (i+1)+'. '+(f.title||'—'), options: {valign: "middle", color: AR_COLORS.textDark, fontSize: 11, bold: true}},
        {text: resp.action || '—', options: {valign: "middle", color: AR_COLORS.textDark, fontSize: 11}},
        {text: ownerDate, options: {valign: "middle", color: AR_COLORS.textDark, fontSize: 10, align: "center"}},
      ];
    }));
  } else {
    mrRows = [mrHeader, [{text: '—'}, {text: '—'}, {text: '—'}]];
  }
  s7.addTable(mrRows, {
    x: 0.5, y: 1.6, w: 12.3,
    fontSize: 11, fontFace: "Calibri",
    border: {type: "solid", pt: 0.5, color: AR_COLORS.grayMed},
    rowH: 0.7,
    colW: [4.0, 6.0, 2.3],
  });
  ar_addFooter(pres, s7);

  // ════════════════════════════════════════════════════════════════════
  // SLIDES 8...N — DETAILED FINDINGS (1 slide per finding)
  // ════════════════════════════════════════════════════════════════════
  findings.forEach((f, i) => {
    const sf = pres.addSlide();
    ar_addTitleBar(pres, sf, "Findings", (i+1) + " – " + (f.title || 'Finding'));

    // Bandeau violet décoratif (comme dans le template)
    sf.addShape(pres.ShapeType.rect, {
      x: 0.4, y: 1.55, w: 12.5, h: 0.18,
      fill: {color: AR_COLORS.purple}, line: {type: "none"},
    });

    // Tableau de détails du finding
    const findingDetailRows = [
      [
        {text: "Finding", options: {bold: true, color: AR_COLORS.textDark, fill: {color: AR_COLORS.grayLight}, valign: "top"}},
        {text: [
          {text: (f.title||'') + '\n', options: {bold: true, fontSize: 13, color: AR_COLORS.textDark, fontFace: "Calibri"}},
          {text: f.descDetailed || f.desc || '—', options: {fontSize: 11, color: AR_COLORS.textDark, fontFace: "Calibri"}},
         ], options: {valign: "top"}},
      ],
      [
        {text: "Potential Risk", options: {bold: true, color: AR_COLORS.textDark, fill: {color: AR_COLORS.grayLight}, valign: "top"}},
        {text: f.potentialRisk || '—', options: {valign: "top", color: AR_COLORS.textDark, fontSize: 11}},
      ],
      [
        {text: "Owner", options: {bold: true, color: AR_COLORS.textDark, fill: {color: AR_COLORS.grayLight}, valign: "top"}},
        {text: f.owner || '—', options: {valign: "top", color: AR_COLORS.textDark, fontSize: 11}},
      ],
      [
        {text: "Risk Level", options: {bold: true, color: AR_COLORS.textDark, fill: {color: AR_COLORS.grayLight}, valign: "top"}},
        {text: ar_riskLabel(f.probability, f.impact),
         options: {valign: "top", color: AR_COLORS.textDark, fontSize: 11, fill: {color: ar_riskColor(f.probability, f.impact)}}},
      ],
    ];
    sf.addTable(findingDetailRows, {
      x: 0.4, y: 1.85, w: 12.5,
      fontSize: 11, fontFace: "Calibri",
      border: {type: "solid", pt: 0.5, color: AR_COLORS.grayMed},
      rowH: [2.5, 0.8, 0.5, 0.5],
      colW: [1.7, 10.8],
    });

    ar_addFooter(pres, sf);
  });

  // ════════════════════════════════════════════════════════════════════
  // SLIDE — TESTING STRATEGY
  // ════════════════════════════════════════════════════════════════════
  const sT = pres.addSlide();
  ar_addTitleBar(pres, sT, "Testing Strategy", null);
  sT.addText("We conducted the following analyses and test batteries to verify that the processes described by the operational teams were properly followed.", {
    x: 0.5, y: 1.05, w: 12.3, h: 0.5,
    fontSize: 12, color: AR_COLORS.textDark, fontFace: "Calibri",
  });

  const tHeader = [
    {text: "Test Name", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.navy}, valign: "middle"}},
    {text: "Test Description", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.navy}, valign: "middle"}},
    {text: "Result", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.navy}, valign: "middle", align: "center"}},
    {text: "Linked Finding", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.navy}, valign: "middle"}},
  ];
  let tRows;
  if (testedControls.length) {
    tRows = [tHeader].concat(testedControls.map((c) => {
      // Find linked finding
      const linkedFinding = findings.find(f => (f.controlIds||[]).includes(c.id));
      const linkedFindingIdx = linkedFinding ? findings.indexOf(linkedFinding)+1 : null;
      const resultColor = c.result === 'pass' ? '548235' : AR_COLORS.red;
      const resultText = c.result === 'pass' ? 'PASS' : c.result === 'fail' ? 'Fail' : '—';
      return [
        {text: c.name || '—', options: {valign: "middle", color: AR_COLORS.textDark, fontSize: 11, bold: true}},
        {text: c.testNature || '—', options: {valign: "middle", color: AR_COLORS.textDark, fontSize: 10}},
        {text: resultText, options: {valign: "middle", align: "center", color: resultColor, fontSize: 11, bold: true}},
        {text: linkedFindingIdx ? 'Finding '+linkedFindingIdx : (c.result === 'fail' ? '⚠ to link' : 'N/A'),
         options: {valign: "middle", color: AR_COLORS.textGray, fontSize: 10}},
      ];
    }));
  } else {
    tRows = [tHeader, [{text: 'No test recorded'}, {text: '—'}, {text: '—'}, {text: '—'}]];
  }
  sT.addTable(tRows, {
    x: 0.4, y: 1.7, w: 12.5,
    fontSize: 11, fontFace: "Calibri",
    border: {type: "solid", pt: 0.5, color: AR_COLORS.grayMed},
    rowH: testedControls.length > 5 ? 0.5 : 0.7,
    colW: [3.0, 6.5, 1.5, 1.5],
  });
  ar_addFooter(pres, sT);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE — APPENDIX DIVIDER
  // ════════════════════════════════════════════════════════════════════
  const sAd = pres.addSlide();
  // Page de garde simple pour l'appendix
  sAd.addShape(pres.ShapeType.rect, {
    x: 0, y: 2.7, w: 11, h: 1.8,
    fill: {color: AR_COLORS.navy}, line: {type: "none"},
  });
  sAd.addShape(pres.ShapeType.rect, {
    x: 11, y: 2.7, w: 0.7, h: 1.8,
    fill: {color: AR_COLORS.red}, line: {type: "none"},
  });
  sAd.addShape(pres.ShapeType.rect, {
    x: 11.7, y: 2.7, w: 0.7, h: 1.8,
    fill: {color: AR_COLORS.yellow}, line: {type: "none"},
  });
  sAd.addText("Appendix", {
    x: 0.5, y: 2.9, w: 10.4, h: 1.4,
    fontSize: 48, bold: true, color: AR_COLORS.white,
    fontFace: "Calibri", align: "left", valign: "middle",
  });
  ar_addFooter(pres, sAd);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE — APPENDIX 1 : RISK VALUATION MATRIX
  // ════════════════════════════════════════════════════════════════════
  const sA1 = pres.addSlide();
  ar_addTitleBar(pres, sA1, "Appendix 1", "Risk valuation matrix");
  sA1.addText("Risks are assessed based on inherent impact and likelihood. This evaluation is theoretical, performed prior to considering the control environment.", {
    x: 0.5, y: 1.5, w: 12.3, h: 0.6,
    fontSize: 11, italic: true, color: AR_COLORS.textGray, fontFace: "Calibri",
  });
  const riskRows = [
    [
      {text: "IMPACT", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.navy}, align: "center"}},
      {text: "Minor", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.navy}, align: "center"}},
      {text: "Limited", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.navy}, align: "center"}},
      {text: "Major", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.navy}, align: "center"}},
      {text: "Severe", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.navy}, align: "center"}},
    ],
    [
      {text: "Financial", options: {bold: true, fill: {color: AR_COLORS.grayLight}}},
      {text: "Revenue: <3M or <1%", options: {fontSize: 9}},
      {text: "Revenue: 3-6M or 1-2%", options: {fontSize: 9}},
      {text: "Revenue: 6-32M or 2-10%", options: {fontSize: 9}},
      {text: "Revenue: >32M or >10%", options: {fontSize: 9}},
    ],
    [
      {text: "Legal/regulatory", options: {bold: true, fill: {color: AR_COLORS.grayLight}}},
      {text: "Minor breach", options: {fontSize: 9}},
      {text: "Fines <100K€", options: {fontSize: 9}},
      {text: "Fines 100K-1M€", options: {fontSize: 9}},
      {text: "Fines >1M€", options: {fontSize: 9}},
    ],
    [
      {text: "Reputational", options: {bold: true, fill: {color: AR_COLORS.grayLight}}},
      {text: "Internal exposure", options: {fontSize: 9}},
      {text: "Limited external", options: {fontSize: 9}},
      {text: "Significant external", options: {fontSize: 9}},
      {text: "Extensive external", options: {fontSize: 9}},
    ],
    [
      {text: "Operational", options: {bold: true, fill: {color: AR_COLORS.grayLight}}},
      {text: "Minor effects", options: {fontSize: 9}},
      {text: "Limited effects", options: {fontSize: 9}},
      {text: "Major effects", options: {fontSize: 9}},
      {text: "Severe effects", options: {fontSize: 9}},
    ],
  ];
  sA1.addTable(riskRows, {
    x: 0.4, y: 2.3, w: 12.5,
    fontSize: 10, fontFace: "Calibri",
    border: {type: "solid", pt: 0.5, color: AR_COLORS.grayMed},
    rowH: [0.4, 0.65, 0.65, 0.65, 0.55],
    colW: [1.7, 2.7, 2.7, 2.7, 2.7],
  });
  sA1.addText("Likelihood: Rare → Unlikely → Possible → Probable / Certain", {
    x: 0.5, y: 6.2, w: 12, h: 0.4,
    fontSize: 11, italic: true, color: AR_COLORS.navy, fontFace: "Calibri",
  });
  ar_addFooter(pres, sA1);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE — APPENDIX 2 : PROCESS VALUATION MATRIX (Maturity)
  // ════════════════════════════════════════════════════════════════════
  const sA2 = pres.addSlide();
  ar_addTitleBar(pres, sA2, "Appendix 2", "Process valuation matrix");
  sA2.addText("Overall Processes are evaluated across 4 levels (Effective → Unsatisfactory) based on the audit findings described in the report.", {
    x: 0.5, y: 1.5, w: 12.3, h: 0.6,
    fontSize: 12, italic: true, color: AR_COLORS.textGray, fontFace: "Calibri",
  });
  const matRows = [
    [
      {text: "Level", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.navy}}},
      {text: "Definition", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.navy}}},
      {text: "Measurement", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.navy}}},
    ],
    [
      {text: "Unsatisfactory", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.red}}},
      {text: "Inadequate controls creating critical risks requiring immediate action.", options: {fontSize: 11}},
      {text: "Several Critical findings OR mix of Critical + Significant.", options: {fontSize: 11}},
    ],
    [
      {text: "Major improvements", options: {bold: true, color: AR_COLORS.white, fill: {color: "E97132"}}},
      {text: "Significant control weaknesses requiring management action.", options: {fontSize: 11}},
      {text: "Several Significant findings OR mix of Significant + Moderate.", options: {fontSize: 11}},
    ],
    [
      {text: "Some improvements", options: {bold: true, color: AR_COLORS.white, fill: {color: AR_COLORS.yellow}}},
      {text: "Minor weaknesses with limited impact.", options: {fontSize: 11}},
      {text: "Only a few Moderate findings.", options: {fontSize: 11}},
    ],
    [
      {text: "Effective", options: {bold: true, color: AR_COLORS.white, fill: {color: "548235"}}},
      {text: "Adequate and effective controls; only minor adjustments needed.", options: {fontSize: 11}},
      {text: "No findings above Moderate.", options: {fontSize: 11}},
    ],
  ];
  sA2.addTable(matRows, {
    x: 0.5, y: 2.3, w: 12.3,
    fontSize: 12, fontFace: "Calibri",
    border: {type: "solid", pt: 0.5, color: AR_COLORS.grayMed},
    rowH: [0.45, 0.7, 0.7, 0.7, 0.7],
    colW: [2.5, 5.4, 4.4],
  });
  ar_addFooter(pres, sA2);

  // ─── Téléchargement ─────────────────────────────────────────────────
  const cleanTitle = (ap.titre || 'audit').replace(/[^a-zA-Z0-9_-]/g, '_');
  const todayStr = new Date().toISOString().slice(0, 10);
  const fileName = `AuditReport_${cleanTitle}_${todayStr}.pptx`;

  try {
    await pres.writeFile({fileName: fileName});
    if (typeof toast === 'function') toast(`Audit Report généré ✓`);
    if (typeof addHist === 'function') addHist(auditId, `Audit Report généré (${fileName})`);
  } catch (err) {
    console.error('[AUDIT_REPORT] Erreur génération :', err);
    if (typeof toast === 'function') toast('Erreur lors de la génération');
  }
}
