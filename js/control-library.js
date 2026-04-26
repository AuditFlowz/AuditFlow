// ════════════════════════════════════════════════════════════════════════════
//  control-library.js — Bibliothèque de contrôles AuditFlow (v4 final)
//
//  S'appuie sur la variable globale CONTROLS_LIBRARY chargée par graph.js
//  depuis la liste SharePoint AF_ControlsLibrary.
//
//  Fonctionnalités :
//   - Modale d'import avec pré-cochage par mots-clés (synonymes inclus)
//   - Tri intelligent : cycles pertinents en haut
//   - Filtre "cycles pertinents uniquement" coché par défaut
//   - Fonction d'import en masse depuis CSV (booléens convertis correctement)
// ════════════════════════════════════════════════════════════════════════════

const CL_SYNONYMS = {
  'otc': ['order-to-cash', 'order to cash'],
  'p2p': ['procure-to-pay', 'procure to pay', 'purchasing'],
  'rtr': ['record-to-report', 'record to report'],
  'r2r': ['record-to-report', 'record to report'],
  'h2r': ['human resources', 'hr'],
  'fa': ['fixed assets'],
  'cybersecurity': ['it - access management', 'it - data', 'access', 'data'],
  'data': ['it - data'],
  'access': ['it - access management'],
  'purchasing': ['procure-to-pay'],
  'third': ['procure-to-pay'],
  'party': ['procure-to-pay'],
  'accounting': ['record-to-report', 'fixed assets', 'r&d'],
  'tax': ['record-to-report'],
  'treasury': ['treasury'],
  'finance': ['record-to-report', 'order-to-cash', 'procure-to-pay',
              'treasury', 'fixed assets', 'r&d', 'payroll'],
  'payroll': ['payroll'],
  'talent': ['human resources'],
  'hr': ['human resources', 'payroll'],
};

// ════════════════════════════════════════════════════════════════════════════
//  BRIDGE — Mapping exact entre process AuditFlow et cycles bibliothèque
//
//  Clé : nom EXACT du process tel que défini dans PROCESSES (champ .proc)
//  Valeur : tableau des domaines biblio applicables (champ .domain des contrôles)
//
//  Si un process n'est pas listé ici, le système retombe sur le matching
//  par synonymes/mots-clés (CL_SYNONYMS ci-dessus).
//
//  Process avec liste vide = pas de bibliothèque → l'IA peut suggérer (cas 3).
// ════════════════════════════════════════════════════════════════════════════
const CL_PROCESS_BRIDGE = {
  // ─── Finance ────────────────────────────────────────────────────────────
  'Finance - OTC':                       ['Order-to-Cash'],
  'Finance - Treasury':                  ['Treasury'],
  'Finance - Accounting & Tax':          ['Record-to-Report', 'Fixed Assets', 'R&D'],
  'Finance - Budget/Forecast':           [],

  // ─── Achats ─────────────────────────────────────────────────────────────
  'Purchasing & Third Party Mgt':        ['Procure-to-Pay'],

  // ─── RH ─────────────────────────────────────────────────────────────────
  'HR - Payroll':                        ['Payroll'],
  'HR - Talent Acquisition':             ['Human Resources'],

  // ─── IT ─────────────────────────────────────────────────────────────────
  'IT - Cybersecurity & Data':           ['IT - Access Management', 'IT - Data'],
  'IT - Structure':                      ['IT - Access Management', 'IT - Data'],

  // ─── Edition / Distribution / Deployment ───────────────────────────────
  'Product Dev':                         ['R&D'],
  'Product Deployment (On Prem / SaaS)': ['IT - Access Management', 'IT - Data'],
  'Renewals':                            ['Order-to-Cash'],
  'Sales':                               ['Order-to-Cash'],

  // ─── Process spécifiques (pas de biblio standard, IA recommandée) ──────
  'Acquisitions & Integration':          [],
  'Product Roadmap':                     [],
  'Cust Support':                        [],
  'Customer Success':                    [],
  'Sales Enablement':                    [],
  'Marketing (Corp, GTM)':               [],
  'ESG':                                 [],
  'Compliance':                          [],
};

function clEsc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function clMapFrequency(f) {
  const map = { 'Day': 'Mensuel', 'Week': 'Mensuel', 'Month': 'Mensuel',
                'Quarter': 'Trimestriel', 'Year': 'Annuel' };
  return map[f] || 'Ad hoc';
}

function openControlLibraryPicker(auditId) {
  if (typeof CONTROLS_LIBRARY === 'undefined' || !Array.isArray(CONTROLS_LIBRARY) || CONTROLS_LIBRARY.length === 0) {
    if (typeof toast === 'function') toast('Bibliothèque vide ou non chargée');
    return;
  }

  const ap = (window.AUDIT_PLAN || []).find(a => a.id === auditId);
  if (!ap) {
    if (typeof toast === 'function') toast('Audit introuvable');
    return;
  }

  const proc = (window.PROCESSES || []).find(p => p.id === ap.processId);
  const procName = proc ? proc.proc : (ap.titre || '');

  // ── PRIORITÉ 1 : Bridge exact (mapping en dur) ──────────────────────────
  // Si le process est dans la table CL_PROCESS_BRIDGE, on utilise son mapping
  let matchingDomains = new Set();
  let matchSource = 'fallback';

  if (procName && CL_PROCESS_BRIDGE.hasOwnProperty(procName)) {
    const mapped = CL_PROCESS_BRIDGE[procName];
    mapped.forEach(d => matchingDomains.add(d));
    matchSource = mapped.length > 0 ? 'bridge' : 'bridge-empty';
  } else {
    // ── PRIORITÉ 2 : Fallback par synonymes/mots-clés ─────────────────────
    const baseKeywords = procName.toLowerCase()
      .replace(/[\-&\(\)\/]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2);
    const allKeywords = new Set(baseKeywords);
    baseKeywords.forEach(k => {
      if (CL_SYNONYMS[k]) CL_SYNONYMS[k].forEach(s => allKeywords.add(s.toLowerCase()));
    });
    const keywords = Array.from(allKeywords);

    CONTROLS_LIBRARY.forEach(c => {
      if (c.archived) return;
      const domLower = (c.domain || '').toLowerCase();
      if (keywords.some(k => domLower.includes(k))) {
        matchingDomains.add(c.domain);
      }
    });
    matchSource = matchingDomains.size > 0 ? 'synonyms' : 'none';
  }

  const allDomains = [...new Set(CONTROLS_LIBRARY.filter(c => !c.archived).map(c => c.domain))];
  const sortedDomains = [
    ...allDomains.filter(d => matchingDomains.has(d)),
    ...allDomains.filter(d => !matchingDomains.has(d)).sort(),
  ];

  const candidates = CONTROLS_LIBRARY.filter(c => !c.archived);

  const preChecked = new Set(
    candidates.filter(c => matchingDomains.has(c.domain)).map(c => c.id)
  );

  const ov = document.createElement('div');
  ov.id = 'cl-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:8px;max-width:900px;width:100%;max-height:85vh;display:flex;flex-direction:column">
      <div style="padding:14px 18px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:15px;font-weight:600">Importer depuis la bibliothèque</div>
        <button onclick="document.getElementById('cl-ov').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#999">×</button>
      </div>
      <div style="background:#E1F5EE;color:#085041;padding:8px 12px;font-size:12px">
        <strong>${clEsc(procName)}</strong> · ${candidates.length} contrôles · ${preChecked.size} pré-cochés
        ${matchingDomains.size > 0
          ? '<br>Cycles pertinents : <strong>' + clEsc([...matchingDomains].join(', ')) + '</strong>'
          : (matchSource === 'bridge-empty'
              ? '<br><em>Aucun cycle bibliothèque ne couvre ce process — tous les contrôles sont affichés. L\'IA peut suggérer des contrôles spécifiques.</em>'
              : '<br><em>Process non reconnu — affichage de tous les contrôles disponibles.</em>')
        }
      </div>
      <div style="padding:10px 16px;border-bottom:1px solid #eee;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input id="cl-kw" placeholder="Filtrer par mot-clé..."
          style="flex:1;min-width:180px;padding:5px 9px;border:1px solid #ccc;border-radius:4px;font-size:12px"/>
        <label style="font-size:12px;display:flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap">
          <input type="checkbox" id="cl-key"/> Clés uniquement
        </label>
        <label style="font-size:12px;display:flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap">
          <input type="checkbox" id="cl-rel" ${matchingDomains.size > 0 ? 'checked' : ''}/> Cycles pertinents seulement
        </label>
        <button id="cl-all" type="button"
          style="padding:4px 10px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;font-size:11px">
          Tout cocher
        </button>
        <button id="cl-none" type="button"
          style="padding:4px 10px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;font-size:11px">
          Tout décocher
        </button>
      </div>
      <div id="cl-list" style="flex:1;overflow:auto"></div>
      <div style="padding:12px 16px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center">
        <span id="cl-cnt" style="font-size:13px;color:#666"></span>
        <div style="display:flex;gap:8px">
          <button onclick="document.getElementById('cl-ov').remove()"
            style="padding:6px 14px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;font-size:13px">
            Annuler
          </button>
          <button id="cl-ok"
            style="padding:6px 14px;border:none;background:#085041;color:#fff;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500">
            Importer la sélection
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(ov);

  const render = () => {
    const kw = document.getElementById('cl-kw').value.toLowerCase().trim();
    const keyOnly = document.getElementById('cl-key').checked;
    const relOnly = document.getElementById('cl-rel').checked;

    let rows = candidates;
    if (relOnly && matchingDomains.size > 0) {
      rows = rows.filter(c => matchingDomains.has(c.domain));
    }
    if (keyOnly) rows = rows.filter(c => c.key);
    if (kw) {
      rows = rows.filter(c =>
        ((c.name || '') + ' ' + (c.description || '') + ' ' + (c.domain || '') + ' ' + (c.wcgwTypical || ''))
          .toLowerCase().includes(kw)
      );
    }

    const grouped = {};
    rows.forEach(r => {
      const k = r.domain || '(sans domaine)';
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(r);
    });

    let html = '';
    sortedDomains.forEach(g => {
      if (!grouped[g]) return;
      const isRel = matchingDomains.has(g);
      html += `<div style="background:${isRel ? '#E1F5EE' : '#f5f5f5'};color:${isRel ? '#085041' : '#333'};padding:6px 14px;font-size:11px;font-weight:600;border-top:0.5px solid #ddd">
        ${clEsc(g)} (${grouped[g].length})${isRel ? ' ★' : ''}
      </div>`;
      grouped[g].forEach(r => {
        const ck = preChecked.has(r.id) ? 'checked' : '';
        const isAuto = (r.nature || '').toLowerCase().includes('it-dependent');
        html += `<label style="display:flex;gap:10px;padding:9px 14px;border-bottom:1px solid #f0f0f0;cursor:pointer;align-items:flex-start"
          onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background=''">
          <input type="checkbox" class="cl-pk" data-id="${clEsc(r.id)}" ${ck} style="margin-top:3px"/>
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;color:#999;font-family:monospace">${clEsc(r.code || r.id)}</div>
            <div style="font-size:13px;font-weight:500;color:#222;margin-top:1px">${clEsc(r.name)}</div>
            ${r.description ? `<div style="font-size:11px;color:#666;margin-top:2px">${clEsc(r.description)}</div>` : ''}
            <div style="margin-top:5px;display:flex;gap:5px;flex-wrap:wrap">
              ${r.key ? '<span style="background:#FAEEDA;color:#854F0B;padding:1px 7px;border-radius:10px;font-size:10px">Clé</span>' : ''}
              ${isAuto ? '<span style="background:#EEEDFE;color:#3C3489;padding:1px 7px;border-radius:10px;font-size:10px">IT-Dep</span>' : '<span style="background:#F1EFE8;color:#444;padding:1px 7px;border-radius:10px;font-size:10px">Manuel</span>'}
              ${r.frequency ? `<span style="background:#E6F1FB;color:#0C447C;padding:1px 7px;border-radius:10px;font-size:10px">${clEsc(r.frequency)}</span>` : ''}
              ${r.framework ? `<span style="background:#F1EFE8;color:#444;padding:1px 7px;border-radius:10px;font-size:10px">${clEsc(r.framework)}</span>` : ''}
            </div>
          </div>
        </label>`;
      });
    });

    if (rows.length === 0) {
      html = '<div style="padding:40px;text-align:center;color:#999;font-size:13px">Aucun contrôle ne correspond aux critères</div>';
    }
    document.getElementById('cl-list').innerHTML = html;

    const upd = () => {
      const n = document.querySelectorAll('.cl-pk:checked').length;
      const r = document.querySelectorAll('.cl-pk').length;
      document.getElementById('cl-cnt').textContent = `${r} affichés · ${n} sélectionnés`;
    };
    upd();
    document.querySelectorAll('.cl-pk').forEach(cb => cb.addEventListener('change', upd));
  };

  document.getElementById('cl-kw').addEventListener('input', render);
  document.getElementById('cl-key').addEventListener('change', render);
  document.getElementById('cl-rel').addEventListener('change', render);

  document.getElementById('cl-all').addEventListener('click', () => {
    document.querySelectorAll('.cl-pk').forEach(cb => cb.checked = true);
    const n = document.querySelectorAll('.cl-pk:checked').length;
    const r = document.querySelectorAll('.cl-pk').length;
    document.getElementById('cl-cnt').textContent = `${r} affichés · ${n} sélectionnés`;
  });
  document.getElementById('cl-none').addEventListener('click', () => {
    document.querySelectorAll('.cl-pk').forEach(cb => cb.checked = false);
    const r = document.querySelectorAll('.cl-pk').length;
    document.getElementById('cl-cnt').textContent = `${r} affichés · 0 sélectionnés`;
  });

  document.getElementById('cl-ok').addEventListener('click', async () => {
    const picks = Array.from(document.querySelectorAll('.cl-pk:checked')).map(i => i.dataset.id);
    if (picks.length === 0) {
      if (typeof toast === 'function') toast('Aucun contrôle sélectionné');
      return;
    }

    const d = AUD_DATA[auditId];
    if (!d) { if (typeof toast === 'function') toast('Données audit introuvables'); return; }

    // L'étape "Tests d'audit" correspond à la clé STRING '4' (CS courant)
    const stepKey = String((typeof window.CS !== 'undefined' && window.CS !== null) ? window.CS : 4);
    if (!d.controls) d.controls = {};
    if (!d.controls[stepKey]) d.controls[stepKey] = [];

    let added = 0;
    picks.forEach(id => {
      const src = CONTROLS_LIBRARY.find(c => c.id === id);
      if (!src) return;
      if (d.controls[stepKey].some(c => c.libraryRef === src.id)) return;

      d.controls[stepKey].push({
        name: src.name,
        owner: src.ownerType || 'Finance',
        freq: clMapFrequency(src.frequency),
        clef: src.key === true,
        design: (src.designDefault || 'Existing').toLowerCase(),
        result: null,
        testNature: '',
        finding: '',
        libraryRef: src.id,
        libraryFramework: src.framework,
        libraryDomain: src.domain,
        libraryWcgw: src.wcgwTypical,
        libraryTestProcedures: src.testProcedures,
        addedFromLib: true,
        addedAt: new Date().toISOString(),
      });
      added++;
    });

    if (added === 0) {
      if (typeof toast === 'function') toast('Tous les contrôles sélectionnés sont déjà importés');
      return;
    }

    if (typeof saveAuditData === 'function') await saveAuditData(auditId);
    if (typeof addHist === 'function') addHist(auditId, `${added} contrôle(s) importé(s) depuis la bibliothèque`);

    document.getElementById('cl-ov').remove();
    if (typeof toast === 'function') toast(`${added} contrôle(s) importé(s) ✓`);

    const detContent = document.getElementById('det-content');
    if (detContent && typeof renderDetContent === 'function') {
      detContent.innerHTML = renderDetContent();
    }
  });

  render();
}

// ════════════════════════════════════════════════════════════════════════════
//  IMPORT EN MASSE — pour charger un CSV de contrôles dans SharePoint
//  Usage console (admin) :
//    const csv = await fetch('/auditflow_control_library_axway.csv').then(r => r.text());
//    await importControlsFromCSV(csv);
// ════════════════════════════════════════════════════════════════════════════

async function importControlsFromCSV(csvText) {
  if (typeof createItem !== 'function') {
    console.error('[CTRL_LIB] Fonction createItem non disponible');
    return;
  }

  const parseLine = (line) => {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
      else { cur += c; }
    }
    out.push(cur);
    return out;
  };

  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) { console.error('[CTRL_LIB] CSV vide'); return; }

  const headers = parseLine(lines[0]);
  console.log(`[CTRL_LIB] Import de ${lines.length - 1} contrôles...`);

  let imported = 0, errors = 0;
  for (let i = 1; i < lines.length; i++) {
    const fields = parseLine(lines[i]);
    if (fields.length !== headers.length) { errors++; continue; }
    const row = {};
    headers.forEach((h, idx) => row[h] = fields[idx]);

    // SharePoint attend de vrais booléens pour 'key' et 'archived'
    if ('key' in row) row.key = (String(row.key).toLowerCase() === 'true');
    if ('archived' in row) row.archived = (String(row.archived).toLowerCase() === 'true');

    try {
      await createItem('AF_ControlsLibrary', row);
      imported++;
      if (imported % 10 === 0) console.log(`[CTRL_LIB]   ${imported}/${lines.length - 1}...`);
    } catch (e) {
      console.warn(`[CTRL_LIB] Erreur ${row.code || row.af_id}:`, e.message);
      errors++;
    }
  }

  console.log(`[CTRL_LIB] ✓ Import terminé : ${imported} OK, ${errors} erreurs`);
}
