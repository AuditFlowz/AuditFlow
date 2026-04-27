// ════════════════════════════════════════════════════════════════════════════
//  kickoff-generator.js — Génération du Kick Off Presentation (PowerPoint)
//
//  Utilise PptxGenJS (chargée via CDN dans index.html, expose `PptxGenJS` global)
//
//  Source des données :
//   - AUDIT_PLAN[id]      → titre, type, processIds, auditeurs, etc.
//   - PROCESSES           → noms des process
//   - RISK_UNIVERSE       → risques liés au process
//   - AUD_DATA[id].kickoffPrep → scope, interviews, planning (étape 1)
//   - TM (Team Members)   → noms des auditeurs
// ════════════════════════════════════════════════════════════════════════════

// ─── Couleurs ──────────────────────────────────────────────────────────────
const KO_COLORS = {
  navy:      "2D2E83",
  red:       "C8102E",
  yellow:    "F2A900",
  pink:      "D74894",
  white:     "FFFFFF",
  grayLight: "F2F2F2",
  grayMed:   "BFBFBF",
  textDark:  "222222",
  textGray:  "555555",
  lavender:  "EEEDFE",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

// Footer commun à toutes les slides (placeholders logos)
function ko_addFooter(pres, slide) {
  // Logo 74Software (placeholder bas-gauche)
  slide.addShape(pres.ShapeType.rect, {
    x: 0.3, y: 6.95, w: 1.0, h: 0.4,
    line: {color: KO_COLORS.navy, width: 1},
    fill: {color: KO_COLORS.white},
  });
  slide.addText("74Software", {
    x: 0.3, y: 6.95, w: 1.0, h: 0.4,
    fontSize: 11, bold: true, color: KO_COLORS.navy,
    fontFace: "Calibri", align: "center", valign: "middle",
  });
  // Placeholders Axway+SBS bas-droite
  slide.addText("axway · SBS", {
    x: 11.4, y: 6.95, w: 1.6, h: 0.4,
    fontSize: 11, color: KO_COLORS.textGray,
    fontFace: "Calibri", align: "right", valign: "middle",
    italic: true,
  });
}

// Bandeau de titre standard pour slides intérieures
function ko_addTitleBar(pres, slide, mainTitle, subTitle) {
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.7,
    fill: {color: KO_COLORS.navy}, line: {type: "none"},
  });
  slide.addText(mainTitle, {
    x: 0.3, y: 0, w: 12, h: 0.7,
    fontSize: 28, bold: true, color: KO_COLORS.white,
    fontFace: "Calibri", valign: "middle",
  });
  slide.addText(subTitle, {
    x: 0.3, y: 0.75, w: 12, h: 0.6,
    fontSize: 22, color: KO_COLORS.navy,
    fontFace: "Calibri", valign: "middle",
  });
}

// Format de date pour affichage en français
function ko_fmtDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  } catch (e) {
    return dateStr;
  }
}

// Initiales depuis "P. Massard" → "PM", "Marie Dupont" → "MD"
function ko_initials(name) {
  if (!name) return '??';
  return name.split(/[ .]/).filter(Boolean).map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
}

// ─── EXPORT PRINCIPAL ──────────────────────────────────────────────────────

async function generateKickoffPptx(auditId) {
  // 1. Vérifier PptxGenJS chargé
  if (typeof PptxGenJS === 'undefined') {
    if (typeof toast === 'function') toast('PptxGenJS non chargé. Rechargez la page.');
    return;
  }

  // 2. Récupérer les données
  const ap = (window.AUDIT_PLAN || []).find(a => a.id === auditId);
  if (!ap) { if (typeof toast === 'function') toast('Audit introuvable'); return; }

  const d = AUD_DATA && AUD_DATA[auditId] ? AUD_DATA[auditId] : {};
  const prep = d.kickoffPrep || {};
  const subProcesses = Array.isArray(prep.subProcesses) ? prep.subProcesses : [];
  const interviews = Array.isArray(prep.interviews) ? prep.interviews : [];
  const planning = prep.planning || {};

  // Récupérer le nom du process
  const procIds = Array.isArray(ap.processIds) && ap.processIds.length ? ap.processIds : (ap.processId ? [ap.processId] : []);
  const procNames = procIds.map(id => {
    const p = (window.PROCESSES || []).find(x => x.id === id);
    return p ? p.proc : null;
  }).filter(Boolean);
  const processName = procNames.join(' / ') || ap.titre || '—';

  // Récupérer les risques liés
  const allRisks = (window.RISK_UNIVERSE || []);
  const linkedRisks = allRisks.filter(r => {
    if (!Array.isArray(r.processIds)) return false;
    return r.processIds.some(pid => procIds.includes(pid));
  });

  // Récupérer les auditeurs
  const auditeurIds = Array.isArray(ap.auditeurs) ? ap.auditeurs : [];
  const auditeurs = auditeurIds.map(id => {
    const tm = (window.TM || []).find(t => t.id === id);
    return tm ? {name: tm.name, role: tm.role || 'Auditor'} : null;
  }).filter(Boolean);

  // Titre court (pour bandeau)
  const auditTitleShort = `${processName} – ${ap.annee || new Date().getFullYear()}`;

  // 3. Construire le pptx
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 1 — PAGE DE GARDE
  // ════════════════════════════════════════════════════════════════════
  const s1 = pres.addSlide();
  s1.addText("Internal Audit Department", {
    x: 0, y: 0.4, w: 13.33, h: 0.5,
    fontSize: 16, color: KO_COLORS.textDark,
    fontFace: "Calibri", align: "center", italic: true,
  });
  // Bandeau bleu marine + accents rouge/jaune
  s1.addShape(pres.ShapeType.rect, {
    x: 0, y: 2.6, w: 11, h: 2.3,
    fill: {color: KO_COLORS.navy}, line: {type: "none"},
  });
  s1.addShape(pres.ShapeType.rect, {
    x: 11, y: 2.6, w: 0.7, h: 2.3,
    fill: {color: KO_COLORS.red}, line: {type: "none"},
  });
  s1.addShape(pres.ShapeType.rect, {
    x: 11.7, y: 2.6, w: 0.7, h: 2.3,
    fill: {color: KO_COLORS.yellow}, line: {type: "none"},
  });
  s1.addText(auditTitleShort, {
    x: 0.5, y: 2.9, w: 10.4, h: 0.9,
    fontSize: 40, bold: true, color: KO_COLORS.white,
    fontFace: "Calibri", align: "center",
  });
  s1.addText("Kick Off Meeting", {
    x: 0.5, y: 3.85, w: 10.4, h: 0.7,
    fontSize: 30, color: KO_COLORS.white,
    fontFace: "Calibri", align: "center",
  });
  ko_addFooter(pres, s1);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 2 — AGENDA
  // ════════════════════════════════════════════════════════════════════
  const s2 = pres.addSlide();
  ko_addTitleBar(pres, s2, auditTitleShort, "Meeting agenda");
  const agendaItems = [
    "Objectives and methodology",
    "Mission timeline",
    "Audit scope",
    "Interviews",
    "Key deadlines",
    "Team",
    "Appendices",
  ];
  s2.addText(
    agendaItems.map(t => ({text: t, options: {bullet: true, fontSize: 18, color: KO_COLORS.textDark, fontFace: "Calibri"}})),
    { x: 0.6, y: 1.6, w: 10, h: 4.5, paraSpaceAfter: 8 }
  );
  ko_addFooter(pres, s2);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 3 — OBJECTIVES & METHODOLOGY (version aérée 2 colonnes)
  // ════════════════════════════════════════════════════════════════════
  const s3 = pres.addSlide();
  ko_addTitleBar(pres, s3, auditTitleShort, "Objectives & Methodology");

  // Colonne gauche : Objectives en lavande
  s3.addShape(pres.ShapeType.rect, {
    x: 0.5, y: 1.6, w: 5.0, h: 5.1,
    fill: {color: KO_COLORS.lavender}, line: {type: "none"},
  });
  s3.addShape(pres.ShapeType.ellipse, {
    x: 0.7, y: 1.85, w: 0.4, h: 0.4,
    fill: {color: KO_COLORS.navy}, line: {type: "none"},
  });
  s3.addText("1", {
    x: 0.7, y: 1.85, w: 0.4, h: 0.4,
    fontSize: 16, bold: true, color: KO_COLORS.white,
    fontFace: "Calibri", align: "center", valign: "middle",
  });
  s3.addText("Objectives", {
    x: 1.2, y: 1.78, w: 4, h: 0.5,
    fontSize: 20, bold: true, color: KO_COLORS.navy, fontFace: "Calibri",
  });
  s3.addText(
    "Provide the Audit Committee, Executive Management, and the audited departments with reasonable assurance that the control environment ensures proper management of the risks faced by the Group:",
    { x: 0.7, y: 2.5, w: 4.6, h: 1.5, fontSize: 12, color: KO_COLORS.textDark, fontFace: "Calibri" }
  );
  s3.addText([
    { text: "Economic", options: { bullet: { code: "25CF" }, fontSize: 13, bold: true, color: KO_COLORS.navy, fontFace: "Calibri", paraSpaceAfter: 4 } },
    { text: "Legal & Regulatory", options: { bullet: { code: "25CF" }, fontSize: 13, bold: true, color: KO_COLORS.navy, fontFace: "Calibri", paraSpaceAfter: 4 } },
    { text: "Reputational", options: { bullet: { code: "25CF" }, fontSize: 13, bold: true, color: KO_COLORS.navy, fontFace: "Calibri", paraSpaceAfter: 4 } },
    { text: "Operational", options: { bullet: { code: "25CF" }, fontSize: 13, bold: true, color: KO_COLORS.navy, fontFace: "Calibri" } },
  ], { x: 1.0, y: 4.2, w: 4.3, h: 2.3 });

  // Colonne droite : Methodology
  s3.addShape(pres.ShapeType.rect, {
    x: 5.8, y: 1.6, w: 7.1, h: 5.1,
    fill: {color: KO_COLORS.white}, line: {color: KO_COLORS.grayMed, width: 0.5},
  });
  s3.addShape(pres.ShapeType.ellipse, {
    x: 6.0, y: 1.85, w: 0.4, h: 0.4,
    fill: {color: KO_COLORS.navy}, line: {type: "none"},
  });
  s3.addText("2", {
    x: 6.0, y: 1.85, w: 0.4, h: 0.4,
    fontSize: 16, bold: true, color: KO_COLORS.white,
    fontFace: "Calibri", align: "center", valign: "middle",
  });
  s3.addText("Methodology", {
    x: 6.5, y: 1.78, w: 6, h: 0.5,
    fontSize: 20, bold: true, color: KO_COLORS.navy, fontFace: "Calibri",
  });
  s3.addText(
    "The audit will be performed in accordance with international standards set by the Institute of Internal Auditors (IIA), structured in 3 stages:",
    { x: 6.0, y: 2.5, w: 6.8, h: 0.7, fontSize: 12, italic: true, color: KO_COLORS.textGray, fontFace: "Calibri" }
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
      fill: {color: KO_COLORS.navy}, line: {type: "none"},
    });
    s3.addText((i + 1).toString(), {
      x: 6.0, y: y, w: 0.6, h: 0.85,
      fontSize: 22, bold: true, color: KO_COLORS.white,
      fontFace: "Calibri", align: "center", valign: "middle",
    });
    s3.addText(step.title, {
      x: 6.8, y: y, w: 5.9, h: 0.4,
      fontSize: 15, bold: true, color: KO_COLORS.navy, fontFace: "Calibri",
    });
    s3.addText(step.desc, {
      x: 6.8, y: y + 0.4, w: 5.9, h: 0.5,
      fontSize: 11, color: KO_COLORS.textDark, fontFace: "Calibri",
    });
  });
  ko_addFooter(pres, s3);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 4 — ENGAGEMENT TIMELINE
  // ════════════════════════════════════════════════════════════════════
  const s4 = pres.addSlide();
  ko_addTitleBar(pres, s4, auditTitleShort, "Engagement Timeline");
  s4.addText("The audit will be conducted over 6 phases:", {
    x: 0.5, y: 1.6, w: 12, h: 0.4,
    fontSize: 14, color: KO_COLORS.textDark, fontFace: "Calibri",
  });
  s4.addShape(pres.ShapeType.line, {
    x: 0.7, y: 2.6, w: 11.9, h: 0,
    line: {color: KO_COLORS.grayMed, width: 2},
  });
  const phases = [
    {label: "Preparation", desc: "Mapping of existing processes and risks.", color: KO_COLORS.navy},
    {label: "Kick Off", desc: "Discussion with management:\n• Key risks\n• Stakeholders\n• Team availability", color: KO_COLORS.pink},
    {label: "Interviews", desc: "Interviews with operational staff responsible for the processes.", color: KO_COLORS.navy},
    {label: "Work Pgm.", desc: "Based on interviews, narratives and Key Findings will be defined to test/analyze.", color: KO_COLORS.navy},
    {label: "Docs Review", desc: "Collection of documentation related to tested findings to conclude on procedures.", color: KO_COLORS.navy},
    {label: "Audit Report", desc: "Presentation of identified Findings and recommendations.", color: KO_COLORS.navy},
  ];
  phases.forEach((p, i) => {
    const x = 0.7 + i * 2.1;
    s4.addShape(pres.ShapeType.ellipse, {
      x: x, y: 2.4, w: 0.4, h: 0.4,
      fill: {color: p.color}, line: {color: KO_COLORS.white, width: 2},
    });
    s4.addShape(pres.ShapeType.rect, {
      x: x - 0.4, y: 2.95, w: 1.7, h: 0.45,
      fill: {color: p.color}, line: {type: "none"},
    });
    s4.addText(p.label, {
      x: x - 0.4, y: 2.95, w: 1.7, h: 0.45,
      fontSize: 12, bold: true, color: KO_COLORS.white,
      fontFace: "Calibri", align: "center", valign: "middle",
    });
    s4.addText(p.desc, {
      x: x - 0.4, y: 3.55, w: 1.85, h: 2.5,
      fontSize: 9, color: KO_COLORS.textDark,
      fontFace: "Calibri", valign: "top",
    });
  });
  ko_addFooter(pres, s4);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 5 — AUDIT SCOPE (sous-processus en tableau)
  // ════════════════════════════════════════════════════════════════════
  const s5 = pres.addSlide();
  ko_addTitleBar(pres, s5, auditTitleShort, "Audit Scope");

  s5.addText("Process audited: " + processName, {
    x: 0.5, y: 1.55, w: 12.3, h: 0.4,
    fontSize: 13, bold: true, color: KO_COLORS.navy, fontFace: "Calibri",
  });

  // Tableau des sous-processus
  const subHeader = [
    {text: "Sub-process", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.navy}, valign: "middle"}},
    {text: "Description", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.navy}, valign: "middle"}},
    {text: "Owner(s)", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.navy}, valign: "middle"}},
  ];
  let subRows;
  if (subProcesses.length) {
    subRows = [subHeader].concat(subProcesses.map(sp => {
      const ownerText = sp.email
        ? `${sp.owners || '—'}\n${sp.email}`
        : (sp.owners || '—');
      return [
        {text: sp.name || '—', options: {bold: true, valign: "middle", color: KO_COLORS.textDark}},
        {text: sp.description || '—', options: {valign: "middle", color: KO_COLORS.textDark, fontSize: 11}},
        {text: ownerText, options: {valign: "middle", color: KO_COLORS.textDark, fontSize: 11}},
      ];
    }));
  } else {
    subRows = [subHeader,
      [{text: '—', options: {valign: "middle"}}, {text: '—', options: {valign: "middle"}}, {text: '—', options: {valign: "middle"}}],
    ];
  }
  // Hauteur de ligne adaptée au nombre de sous-processus
  const rowHeight = subProcesses.length > 4 ? 0.55 : 0.75;
  s5.addTable(subRows, {
    x: 0.5, y: 2.05, w: 12.3,
    fontSize: 12, fontFace: "Calibri",
    border: {type: "solid", pt: 0.5, color: KO_COLORS.grayMed},
    rowH: rowHeight,
    colW: [3.0, 6.3, 3.0],
  });

  // Risques liés au process (depuis Risk Universe) en bas de slide
  if (linkedRisks.length) {
    const yRisks = Math.min(2.05 + (subProcesses.length + 1) * rowHeight + 0.4, 5.7);
    s5.addText(`Key risks for this process (${linkedRisks.length}):`, {
      x: 0.5, y: yRisks, w: 12, h: 0.35,
      fontSize: 12, bold: true, color: KO_COLORS.navy, fontFace: "Calibri",
    });
    const riskParas = linkedRisks.slice(0, 4).map(r => ({
      text: r.title || r.name || '—',
      options: { bullet: true, fontSize: 11, color: KO_COLORS.textDark, fontFace: "Calibri" },
    }));
    s5.addText(riskParas, { x: 0.7, y: yRisks + 0.4, w: 12, h: 0.9 });
  }

  if (!subProcesses.length) {
    s5.addText("Sub-processes to be defined during the kick-off meeting.", {
      x: 0.5, y: 5.5, w: 12, h: 0.4,
      fontSize: 11, italic: true, color: KO_COLORS.textGray, fontFace: "Calibri",
    });
  }
  ko_addFooter(pres, s5);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 6 — INTERVIEWS (depuis kickoffPrep.interviews)
  // ════════════════════════════════════════════════════════════════════
  const s6 = pres.addSlide();
  ko_addTitleBar(pres, s6, auditTitleShort, "Interviews");

  const interviewHeader = [
    {text: "Department", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.navy}, valign: "middle"}},
    {text: "Main contact", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.navy}, valign: "middle"}},
    {text: "Email", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.navy}, valign: "middle"}},
    {text: "Timeslot", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.navy}, valign: "middle"}},
  ];
  let interviewRows;
  if (interviews.length) {
    interviewRows = [interviewHeader].concat(interviews.map(itw => [
      {text: itw.dept || '—', options: {valign: "middle"}},
      {text: itw.contact || '—', options: {valign: "middle"}},
      {text: itw.email || '—', options: {valign: "middle"}},
      {text: itw.timeslot || '—', options: {valign: "middle"}},
    ]));
  } else {
    interviewRows = [interviewHeader,
      [{text: '—', options: {valign: "middle"}}, {text: '—', options: {valign: "middle"}}, {text: '—', options: {valign: "middle"}}, {text: '—', options: {valign: "middle"}}],
      [{text: '—', options: {valign: "middle"}}, {text: '—', options: {valign: "middle"}}, {text: '—', options: {valign: "middle"}}, {text: '—', options: {valign: "middle"}}],
    ];
  }
  s6.addTable(interviewRows, {
    x: 0.5, y: 1.6, w: 12.3,
    fontSize: 12, fontFace: "Calibri",
    border: {type: "solid", pt: 0.5, color: KO_COLORS.grayMed},
    rowH: 0.45,
    colW: [2.2, 3.5, 4.0, 2.6],
  });
  if (!interviews.length) {
    s6.addText("To be completed during the kick-off meeting.", {
      x: 0.5, y: 5.5, w: 12, h: 0.4,
      fontSize: 11, italic: true, color: KO_COLORS.textGray, fontFace: "Calibri",
    });
  }
  ko_addFooter(pres, s6);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 7 — KEY DEADLINES (depuis kickoffPrep.planning)
  // ════════════════════════════════════════════════════════════════════
  const s7 = pres.addSlide();
  ko_addTitleBar(pres, s7, auditTitleShort, "Key Deadlines");

  function ko_weekOf(dateStr) {
    return dateStr ? `Week of ${ko_fmtDate(dateStr)}` : '—';
  }
  const deadlines = [
    ["Kick Off",          ko_weekOf(planning.kickOff),     "default"],
    ["Interviews",        ko_weekOf(planning.interviews),  "default"],
    ["Testing",           ko_weekOf(planning.testing),     "default"],
    ["Report",            ko_weekOf(planning.report),      "gray"],
    ["Restitution ExCom", ko_weekOf(planning.restitution), "red"],
  ];
  const deadlineRows = [
    [
      {text: "Audit milestone", options: {bold: true, color: KO_COLORS.white, fill: {color: "0E5279"}, valign: "middle"}},
      {text: "Week", options: {bold: true, color: KO_COLORS.white, fill: {color: "0E5279"}, valign: "middle"}},
    ],
  ];
  deadlines.forEach(([m, w, color]) => {
    const fill = color === "gray" ? "D9D9D9" : color === "red" ? KO_COLORS.red : null;
    const txtColor = color === "red" ? KO_COLORS.white : KO_COLORS.textDark;
    const opts = {color: txtColor, valign: "middle"};
    if (fill) opts.fill = {color: fill};
    if (color !== "default") opts.bold = true;
    deadlineRows.push([{text: m, options: opts}, {text: w, options: opts}]);
  });
  s7.addTable(deadlineRows, {
    x: 0.5, y: 1.6, w: 12.3,
    fontSize: 13, fontFace: "Calibri",
    border: {type: "solid", pt: 0.5, color: KO_COLORS.grayMed},
    rowH: 0.55,
  });
  ko_addFooter(pres, s7);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 8 — AUDIT TEAM (depuis audit.auditeurs)
  // ════════════════════════════════════════════════════════════════════
  const s8 = pres.addSlide();
  ko_addTitleBar(pres, s8, auditTitleShort, "Audit Team");

  if (!auditeurs.length) {
    s8.addText("Audit team to be defined.", {
      x: 0.5, y: 3.5, w: 12.3, h: 0.5,
      fontSize: 14, italic: true, color: KO_COLORS.textGray,
      fontFace: "Calibri", align: "center",
    });
  } else {
    const cardCount = Math.min(auditeurs.length, 3);
    const cardWidth = 4.0;
    const totalWidth = cardCount * cardWidth + (cardCount - 1) * 0.3;
    const startX = (13.33 - totalWidth) / 2;
    auditeurs.slice(0, 3).forEach((a, i) => {
      const x = startX + i * (cardWidth + 0.3);
      s8.addShape(pres.ShapeType.rect, {
        x: x, y: 1.7, w: cardWidth, h: 4,
        line: {color: KO_COLORS.grayMed, width: 0.5}, fill: {color: KO_COLORS.white},
      });
      s8.addShape(pres.ShapeType.ellipse, {
        x: x + (cardWidth - 1.2) / 2, y: 2.0, w: 1.2, h: 1.2,
        fill: {color: KO_COLORS.navy}, line: {type: "none"},
      });
      s8.addText(ko_initials(a.name), {
        x: x + (cardWidth - 1.2) / 2, y: 2.0, w: 1.2, h: 1.2,
        fontSize: 28, bold: true, color: KO_COLORS.white,
        fontFace: "Calibri", align: "center", valign: "middle",
      });
      s8.addText(a.name, {
        x: x, y: 3.4, w: cardWidth, h: 0.5,
        fontSize: 18, bold: true, color: KO_COLORS.navy,
        fontFace: "Calibri", align: "center",
      });
      s8.addText(a.role, {
        x: x, y: 3.9, w: cardWidth, h: 0.4,
        fontSize: 13, color: KO_COLORS.textGray, italic: true,
        fontFace: "Calibri", align: "center",
      });
      s8.addText([
        {text: "Experience: ", options: {bold: true, fontSize: 11, color: KO_COLORS.textDark, fontFace: "Calibri"}},
        {text: "—", options: {fontSize: 11, color: KO_COLORS.textDark, fontFace: "Calibri"}},
        {text: "\nAcademics: ", options: {bold: true, fontSize: 11, color: KO_COLORS.textDark, fontFace: "Calibri"}},
        {text: "—", options: {fontSize: 11, color: KO_COLORS.textDark, fontFace: "Calibri"}},
      ], { x: x + 0.3, y: 4.6, w: cardWidth - 0.6, h: 1.0 });
    });
  }
  ko_addFooter(pres, s8);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 9 — APPENDIX 1 : RISK ASSESSMENTS
  // ════════════════════════════════════════════════════════════════════
  const s9 = pres.addSlide();
  ko_addTitleBar(pres, s9, "Appendix 1", "Risk Assessments");
  s9.addText("Risks are assessed based on inherent impact and likelihood. This evaluation is theoretical, performed prior to considering the control environment.", {
    x: 0.5, y: 1.5, w: 12.3, h: 0.6,
    fontSize: 11, italic: true, color: KO_COLORS.textGray, fontFace: "Calibri",
  });
  const riskRows = [
    [
      {text: "IMPACT", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.navy}, align: "center"}},
      {text: "Minor", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.navy}, align: "center"}},
      {text: "Limited", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.navy}, align: "center"}},
      {text: "Major", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.navy}, align: "center"}},
      {text: "Severe", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.navy}, align: "center"}},
    ],
    [
      {text: "Financial", options: {bold: true, fill: {color: KO_COLORS.grayLight}}},
      {text: "Revenue: <3M or <1%", options: {fontSize: 9}},
      {text: "Revenue: 3-6M or 1-2%", options: {fontSize: 9}},
      {text: "Revenue: 6-32M or 2-10%", options: {fontSize: 9}},
      {text: "Revenue: >32M or >10%", options: {fontSize: 9}},
    ],
    [
      {text: "Legal/regulatory", options: {bold: true, fill: {color: KO_COLORS.grayLight}}},
      {text: "Minor breach, no fines", options: {fontSize: 9}},
      {text: "Fines <100K€", options: {fontSize: 9}},
      {text: "Fines 100K-1M€", options: {fontSize: 9}},
      {text: "Fines >1M€", options: {fontSize: 9}},
    ],
    [
      {text: "Reputational", options: {bold: true, fill: {color: KO_COLORS.grayLight}}},
      {text: "Internal exposure only", options: {fontSize: 9}},
      {text: "Limited external exposure", options: {fontSize: 9}},
      {text: "Significant external exposure", options: {fontSize: 9}},
      {text: "Extensive external exposure", options: {fontSize: 9}},
    ],
    [
      {text: "Operational", options: {bold: true, fill: {color: KO_COLORS.grayLight}}},
      {text: "Minor effects", options: {fontSize: 9}},
      {text: "Limited effects", options: {fontSize: 9}},
      {text: "Major effects", options: {fontSize: 9}},
      {text: "Severe effects", options: {fontSize: 9}},
    ],
  ];
  s9.addTable(riskRows, {
    x: 0.4, y: 2.3, w: 12.5,
    fontSize: 10, fontFace: "Calibri",
    border: {type: "solid", pt: 0.5, color: KO_COLORS.grayMed},
    rowH: [0.4, 0.65, 0.65, 0.65, 0.55],
    colW: [1.7, 2.7, 2.7, 2.7, 2.7],
  });
  s9.addText("Likelihood: Rare → Unlikely → Possible → Probable / Certain", {
    x: 0.5, y: 6.2, w: 12, h: 0.4,
    fontSize: 11, italic: true, color: KO_COLORS.navy, fontFace: "Calibri",
  });
  ko_addFooter(pres, s9);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 10 — APPENDIX 2 : KEY CONTROLS ASSESSMENTS (3 cartes)
  // ════════════════════════════════════════════════════════════════════
  const s10 = pres.addSlide();
  ko_addTitleBar(pres, s10, "Appendix 2", "Key Controls Assessments");
  s10.addText(
    "Our objective is to provide reasonable assurance on the proper design and execution of the Group's key controls. Tested controls are assessed using a Low → Critical scale, based on these 3 dimensions:",
    { x: 0.5, y: 1.6, w: 12.3, h: 0.8, fontSize: 13, color: KO_COLORS.textDark, fontFace: "Calibri" }
  );
  const dims = [
    {title: "Designed", desc: "The control addresses the risk, is timely, and is performed by the appropriate person."},
    {title: "Executed", desc: "The control is carried out in accordance with its design."},
    {title: "Documented", desc: "Evidence of control execution exists and is easily accessible."},
  ];
  dims.forEach((dim, i) => {
    const x = 0.5 + i * 4.3;
    s10.addShape(pres.ShapeType.rect, {
      x: x, y: 2.7, w: 4, h: 3.5,
      fill: {color: KO_COLORS.white}, line: {color: KO_COLORS.grayMed, width: 0.5},
    });
    s10.addShape(pres.ShapeType.rect, {
      x: x, y: 2.7, w: 4, h: 0.9,
      fill: {color: KO_COLORS.navy}, line: {type: "none"},
    });
    s10.addText(dim.title, {
      x: x, y: 2.7, w: 4, h: 0.9,
      fontSize: 22, bold: true, color: KO_COLORS.white,
      fontFace: "Calibri", align: "center", valign: "middle",
    });
    s10.addText("0" + (i + 1), {
      x: x + 0.3, y: 3.8, w: 3.4, h: 0.8,
      fontSize: 48, bold: true, color: KO_COLORS.lavender,
      fontFace: "Calibri", align: "center",
    });
    s10.addText(dim.desc, {
      x: x + 0.3, y: 4.8, w: 3.4, h: 1.4,
      fontSize: 13, color: KO_COLORS.textDark, fontFace: "Calibri",
      align: "center",
    });
  });
  s10.addShape(pres.ShapeType.rect, {
    x: 0.5, y: 6.4, w: 12.3, h: 0.4,
    fill: {color: KO_COLORS.lavender}, line: {type: "none"},
  });
  s10.addText([
    { text: "Assessment scale: ", options: { bold: true, color: KO_COLORS.navy, fontSize: 11, fontFace: "Calibri" } },
    { text: "Low → Moderate → Significant → Critical", options: { color: KO_COLORS.navy, fontSize: 11, fontFace: "Calibri" } },
  ], {
    x: 0.5, y: 6.4, w: 12.3, h: 0.4,
    align: "center", valign: "middle",
  });
  ko_addFooter(pres, s10);

  // ════════════════════════════════════════════════════════════════════
  // SLIDE 11 — APPENDIX 3 : OVERALL PROCESSES ASSESSMENTS
  // ════════════════════════════════════════════════════════════════════
  const s11 = pres.addSlide();
  ko_addTitleBar(pres, s11, "Appendix 3", "Overall Processes Assessments");
  s11.addText("Overall Processes are evaluated across 4 levels (Effective → Unsatisfactory) based on the audit findings described in the report.", {
    x: 0.5, y: 1.5, w: 12.3, h: 0.6,
    fontSize: 12, italic: true, color: KO_COLORS.textGray, fontFace: "Calibri",
  });
  const matRows = [
    [
      {text: "Level", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.navy}}},
      {text: "Definition", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.navy}}},
      {text: "Measurement", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.navy}}},
    ],
    [
      {text: "Unsatisfactory", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.red}}},
      {text: "Inadequate controls creating critical risks requiring immediate action.", options: {fontSize: 11}},
      {text: "Several Critical findings OR mix of Critical + Significant.", options: {fontSize: 11}},
    ],
    [
      {text: "Major improvements", options: {bold: true, color: KO_COLORS.white, fill: {color: "E97132"}}},
      {text: "Significant control weaknesses requiring management action.", options: {fontSize: 11}},
      {text: "Several Significant findings OR mix of Significant + Moderate.", options: {fontSize: 11}},
    ],
    [
      {text: "Some improvements", options: {bold: true, color: KO_COLORS.white, fill: {color: KO_COLORS.yellow}}},
      {text: "Minor weaknesses with limited impact on the control environment.", options: {fontSize: 11}},
      {text: "Only a few Moderate findings.", options: {fontSize: 11}},
    ],
    [
      {text: "Effective", options: {bold: true, color: KO_COLORS.white, fill: {color: "548235"}}},
      {text: "Adequate and effective controls; only minor adjustments needed.", options: {fontSize: 11}},
      {text: "No findings above Moderate.", options: {fontSize: 11}},
    ],
  ];
  s11.addTable(matRows, {
    x: 0.5, y: 2.3, w: 12.3,
    fontSize: 12, fontFace: "Calibri",
    border: {type: "solid", pt: 0.5, color: KO_COLORS.grayMed},
    rowH: [0.45, 0.7, 0.7, 0.7, 0.7],
    colW: [2.5, 5.4, 4.4],
  });
  ko_addFooter(pres, s11);

  // ─── Téléchargement ─────────────────────────────────────────────────
  const cleanTitle = (ap.titre || 'audit').replace(/[^a-zA-Z0-9_-]/g, '_');
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `KickOff_${cleanTitle}_${today}.pptx`;

  try {
    await pres.writeFile({fileName: fileName});
    if (typeof toast === 'function') toast(`Kick Off généré ✓`);
    if (typeof addHist === 'function') addHist(auditId, `Kick Off Presentation généré (${fileName})`);
  } catch (err) {
    console.error('[KICKOFF] Erreur génération :', err);
    if (typeof toast === 'function') toast('Erreur lors de la génération');
  }
}
