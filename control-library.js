// ════════════════════════════════════════════════════════════════════════════
//  control-library.js — Bibliothèque de contrôles AuditFlow (v2)
//
//  Gère le catalogue de 133 contrôles répartis sur 10 cycles métier standards
//  (P2P, OTC, RTR, Treasury, Payroll, HR, R&D, IT-Access, IT-Data, Fixed Assets).
//
//  Utilise une table de mapping pour lier les process de l'Audit Universe
//  AuditFlow (organisés par fonction Finance / HR / IT) aux process biblio
//  (organisés par cycle métier standard).
// ════════════════════════════════════════════════════════════════════════════

window.CTRL_LIB = window.CTRL_LIB || {
  data: [],
  loaded: false,
  loading: false,
};

// ════════════════════════════════════════════════════════════════════════════
//  TABLE DE MAPPING — Audit Universe ↔ Bibliothèque
//  Clé : id du process dans PROCESSES (ex: 'p11')
//  Valeur : tableau des noms de process biblio applicables (1..N)
// ════════════════════════════════════════════════════════════════════════════
const PROCESS_MAPPING = {
  'p11': ['Order-to-Cash'],                              // OTC
  'p12': ['Treasury'],                                   // Treasury & Tax
  'p13': ['IT - Access Management', 'IT - Data'],        // Cybersecurity & Data
  'p16': ['Record-to-Report', 'Fixed Assets', 'R&D'],    // Finance - Accounting and Tax
  'p17': ['Procure-to-Pay'],                             // Purchasing and Third Party Management
  'p18': ['Human Resources'],                            // HR - Talent Acquisition
  'p19': ['Payroll'],                                    // HR - Payroll
  // Process spécifiques industrie SaaS sans mapping (gérés manuellement) :
  // p1 Acquisitions, p2 Compliance, p3 Products & Portfolio,
  // p5 Product Development, p6 Product Deployment, p7 Product Quality & Support,
  // p8 Go-to-Market, p9 Sales & Services, p10 Customer Experience, p15 Budget / Forecast
};

function getMappedLibProcesses(processId) {
  return PROCESS_MAPPING[processId] || [];
}

function hasLibrarySupport(processId) {
  return getMappedLibProcesses(processId).length > 0;
}

// ════════════════════════════════════════════════════════════════════════════
//  SCHÉMA SHAREPOINT
// ════════════════════════════════════════════════════════════════════════════
const AF_CTRL_LIB_SCHEMA = {
  listName: 'AF_ControlLibrary',
  columns: [
    { name: 'control_id',          text: {} },
    { name: 'process',             text: {} },
    { name: 'sub_process',         text: {} },
    { name: 'risk_id',             text: {} },
    { name: 'risk_title',          text: {} },
    { name: 'risk_description',    text: { allowMultipleLines: true } },
    { name: 'wcgw',                text: { allowMultipleLines: true } },
    { name: 'control_id_ref',      text: {} },
    { name: 'control_title',       text: {} },
    { name: 'control_description', text: { allowMultipleLines: true } },
    { name: 'control_type',        text: {} },
    { name: 'control_nature',      text: {} },
    { name: 'frequency',           text: {} },
    { name: 'assertion',           text: {} },
    { name: 'owner_function',      text: {} },
    { name: 'key_control',         text: {} },
    { name: 'automation',          text: {} },
    { name: 'evidence_expected',   text: { allowMultipleLines: true } },
    { name: 'test_procedure',      text: { allowMultipleLines: true } },
    { name: 'referential_mapping', text: {} },
  ]
};

// ════════════════════════════════════════════════════════════════════════════
//  CHARGEMENT
// ════════════════════════════════════════════════════════════════════════════

async function loadControlLibrary(forceReload) {
  if (CTRL_LIB.loading) return;
  if (CTRL_LIB.loaded && !forceReload) return CTRL_LIB.data;
  CTRL_LIB.loading = true;
  try {
    if (typeof graphFetch !== 'function' || !AUDITFLOW_CONFIG.siteId) {
      console.warn('[CTRL_LIB] Graph non initialisé');
      CTRL_LIB.data = [];
    } else {
      const url = `/sites/${AUDITFLOW_CONFIG.siteId}/lists/${AF_CTRL_LIB_SCHEMA.listName}/items?expand=fields&top=999`;
      const res = await graphFetch(url);
      CTRL_LIB.data = (res.value || []).map(it => it.fields).filter(f => f && f.control_id);
      console.log(`[CTRL_LIB] ${CTRL_LIB.data.length} contrôles chargés`);
    }
    CTRL_LIB.loaded = true;
  } catch (e) {
    console.error('[CTRL_LIB] Erreur chargement:', e);
    CTRL_LIB.data = [];
  } finally {
    CTRL_LIB.loading = false;
  }
  return CTRL_LIB.data;
}

// ════════════════════════════════════════════════════════════════════════════
//  REQUÊTE / FILTRAGE
// ════════════════════════════════════════════════════════════════════════════

function ctrlLibByProcess(processName) {
  return CTRL_LIB.data.filter(c => (c.process || '').toLowerCase() === (processName || '').toLowerCase());
}

function ctrlLibByAuditProcess(processId) {
  const mapped = getMappedLibProcesses(processId);
  if (mapped.length === 0) return [];
  return CTRL_LIB.data.filter(c => mapped.includes(c.process));
}

function ctrlLibProcessList() {
  const set = new Set();
  CTRL_LIB.data.forEach(c => { if (c.process) set.add(c.process); });
  return Array.from(set).sort();
}

function ctrlLibSearch(opts) {
  opts = opts || {};
  let rows = CTRL_LIB.data;
  if (opts.processes && opts.processes.length > 0) {
    rows = rows.filter(c => opts.processes.includes(c.process));
  } else if (opts.process) {
    rows = rows.filter(c => c.process === opts.process);
  }
  if (opts.subProcess) rows = rows.filter(c => c.sub_process === opts.subProcess);
  if (opts.keyOnly)    rows = rows.filter(c => (c.key_control || '').toLowerCase() === 'oui');
  if (opts.keyword) {
    const k = opts.keyword.toLowerCase();
    rows = rows.filter(c =>
      (c.control_title || '').toLowerCase().includes(k) ||
      (c.risk_title || '').toLowerCase().includes(k) ||
      (c.control_description || '').toLowerCase().includes(k)
    );
  }
  return rows;
}

// ════════════════════════════════════════════════════════════════════════════
//  MODALE D'IMPORT — pré-filtrée selon le process de l'audit
// ════════════════════════════════════════════════════════════════════════════

async function openControlLibraryPicker(auditId) {
  await loadControlLibrary();
  const ap = (window.AUDIT_PLAN || []).find(a => a.id === auditId);
  if (!ap) { toast && toast('Audit introuvable'); return; }

  const mappedProcesses = getMappedLibProcesses(ap.processId);
  const allProcesses = ctrlLibProcessList();
  const initialFilter = mappedProcesses.length > 0 ? mappedProcesses : allProcesses;

  const auditProcessObj = (window.PROCESSES || []).find(p => p.id === ap.processId);
  const auditProcessName = auditProcessObj ? auditProcessObj.proc : (ap.process || 'inconnu');

  const banner = mappedProcesses.length === 0
    ? `<div style="background:#FAEEDA;color:#854F0B;padding:8px 12px;font-size:12px;border-bottom:1px solid #eee">
         <strong>Aucune correspondance bibliothèque</strong> pour le process "${esc(auditProcessName)}".
         Tous les contrôles sont affichés — utilisez le filtre ou créez vos contrôles manuellement.
       </div>`
    : `<div style="background:#E1F5EE;color:#085041;padding:8px 12px;font-size:12px;border-bottom:1px solid #eee">
         Process audit <strong>${esc(auditProcessName)}</strong> →
         ${mappedProcesses.length} cycle(s) biblio applicable(s) :
         <strong>${esc(mappedProcesses.join(', '))}</strong>
       </div>`;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:900px;max-height:85vh;display:flex;flex-direction:column">
      <div class="modal-head">
        <h3>Importer depuis la bibliothèque de contrôles</h3>
        <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">×</button>
      </div>
      ${banner}
      <div style="padding:12px 16px;display:flex;gap:12px;flex-wrap:wrap;border-bottom:1px solid #eee;align-items:center">
        <div style="display:flex;flex-wrap:wrap;gap:6px;flex:1;min-width:280px" id="cl-process-pills">
          ${allProcesses.map(p => {
            const active = initialFilter.includes(p);
            return `<label class="cl-pill" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:12px;font-size:11px;border:0.5px solid ${active ? '#085041' : '#ddd'};background:${active ? '#E1F5EE' : '#fff'};color:${active ? '#085041' : '#666'}">
              <input type="checkbox" class="cl-proc-pill" value="${esc(p)}" ${active ? 'checked' : ''} style="display:none"/>
              ${esc(p)}
            </label>`;
          }).join('')}
        </div>
        <input id="cl-keyword" type="text" placeholder="Mot-clé" style="width:140px"/>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;white-space:nowrap">
          <input id="cl-keyonly" type="checkbox"/> Clés uniquement
        </label>
      </div>
      <div id="cl-results" style="flex:1;overflow:auto;padding:0"></div>
      <div style="padding:12px 16px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center">
        <span id="cl-count" style="font-size:13px;color:#666"></span>
        <div style="display:flex;gap:8px">
          <button onclick="this.closest('.modal-backdrop').remove()">Annuler</button>
          <button class="primary" onclick="ctrlLibConfirmImport('${esc(auditId)}')">Importer la sélection</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const refresh = () => {
    const checkedProcs = Array.from(document.querySelectorAll('.cl-proc-pill:checked')).map(i => i.value);
    document.querySelectorAll('.cl-proc-pill').forEach(cb => {
      const label = cb.parentElement;
      if (cb.checked) {
        label.style.border = '0.5px solid #085041';
        label.style.background = '#E1F5EE';
        label.style.color = '#085041';
      } else {
        label.style.border = '0.5px solid #ddd';
        label.style.background = '#fff';
        label.style.color = '#666';
      }
    });
    ctrlLibRenderResults({
      processes: checkedProcs,
      keyword: document.getElementById('cl-keyword').value,
      keyOnly: document.getElementById('cl-keyonly').checked,
    });
  };

  document.querySelectorAll('.cl-proc-pill').forEach(cb => cb.addEventListener('change', refresh));
  document.getElementById('cl-keyword').addEventListener('input', refresh);
  document.getElementById('cl-keyonly').addEventListener('change', refresh);
  refresh();
}

function ctrlLibRenderResults(opts) {
  const rows = ctrlLibSearch(opts);
  const container = document.getElementById('cl-results');
  if (!container) return;

  const groups = {};
  rows.forEach(r => {
    const key = r.process + '|' + (r.sub_process || '(sans sous-processus)');
    if (!groups[key]) groups[key] = { process: r.process, sub: r.sub_process, items: [] };
    groups[key].items.push(r);
  });

  let html = '';
  let lastProcess = null;
  Object.values(groups).forEach(g => {
    if (g.process !== lastProcess) {
      html += `<div style="background:#fff;padding:8px 12px;font-size:12px;font-weight:500;color:#333;border-bottom:0.5px solid #ddd;border-top:0.5px solid #ddd">${esc(g.process)}</div>`;
      lastProcess = g.process;
    }
    html += `<div style="background:#f5f5f5;padding:4px 12px;font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.4px;color:#888">${esc(g.sub || '(sans sous-processus)')}</div>`;
    g.items.forEach(r => {
      const isKey = (r.key_control || '').toLowerCase() === 'oui';
      const isAuto = (r.automation || '').toLowerCase() === 'auto';
      html += `
        <label style="display:flex;gap:10px;padding:10px 12px;border-bottom:1px solid #eee;cursor:pointer;align-items:flex-start" onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background=''">
          <input type="checkbox" class="cl-pick" value="${esc(r.control_id)}" style="margin-top:3px"/>
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;font-family:monospace;color:#999">${esc(r.control_id)}</div>
            <div style="font-weight:500;font-size:13px;margin-top:2px">${esc(r.control_title)}</div>
            <div style="font-size:12px;color:#666;margin-top:3px">${esc(r.control_description)}</div>
            <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
              ${isKey ? '<span style="background:#FAEEDA;color:#854F0B;padding:1px 7px;border-radius:10px;font-size:10px">Clé</span>' : ''}
              <span style="background:#E1F5EE;color:#085041;padding:1px 7px;border-radius:10px;font-size:10px">${esc(r.control_type)}</span>
              ${isAuto ? '<span style="background:#EEEDFE;color:#3C3489;padding:1px 7px;border-radius:10px;font-size:10px">Auto</span>' : ''}
              <span style="background:#F1EFE8;color:#444;padding:1px 7px;border-radius:10px;font-size:10px">${esc(r.frequency)}</span>
            </div>
          </div>
        </label>
      `;
    });
  });

  if (rows.length === 0) {
    html = '<div style="padding:40px;text-align:center;color:#999">Aucun contrôle ne correspond aux critères.</div>';
  }
  container.innerHTML = html;
  document.getElementById('cl-count').textContent = `${rows.length} contrôle(s) affiché(s)`;
}

async function ctrlLibConfirmImport(auditId) {
  const picks = Array.from(document.querySelectorAll('.cl-pick:checked')).map(i => i.value);
  if (picks.length === 0) {
    toast && toast('Aucun contrôle sélectionné');
    return;
  }
  const ap = window.AUDIT_PLAN.find(a => a.id === auditId);
  const d = window.getAudData ? window.getAudData(auditId) : null;
  if (!ap || !d) { toast && toast('Audit introuvable'); return; }

  if (!d.controls) d.controls = {};
  if (!d.controls[4]) d.controls[4] = [];

  let added = 0;
  picks.forEach(cid => {
    const src = CTRL_LIB.data.find(c => c.control_id === cid);
    if (!src) return;
    const exists = d.controls[4].some(c => c.libraryRef === src.control_id);
    if (exists) return;
    d.controls[4].push({
      id: 'ctrl_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      libraryRef: src.control_id,
      libraryProcess: src.process,
      name: src.control_title,
      desc: src.control_description,
      risk: src.risk_title,
      wcgw: src.wcgw,
      type: src.control_type,
      nature: src.control_nature,
      frequency: src.frequency,
      assertion: src.assertion,
      owner: src.owner_function,
      keyControl: (src.key_control || '').toLowerCase() === 'oui',
      testProcedure: src.test_procedure,
      evidence: src.evidence_expected,
      result: 'pending',
      finding: '',
      sample: '',
      addedFromLib: true,
      addedAt: new Date().toISOString(),
    });
    added++;
  });

  if (typeof saveAuditData === 'function') {
    await saveAuditData(auditId);
  }
  if (typeof addHist === 'function') {
    addHist(auditId, `${added} contrôle(s) importé(s) depuis la bibliothèque`);
  }
  document.querySelector('.modal-backdrop').remove();
  toast && toast(`${added} contrôle(s) importé(s)`);
  if (typeof go === 'function') go();
}

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN — Setup et import initial
// ════════════════════════════════════════════════════════════════════════════

async function setupControlLibraryList() {
  if (typeof graphFetch !== 'function' || !AUDITFLOW_CONFIG.siteId) {
    console.error('[CTRL_LIB] Graph non initialisé');
    return;
  }
  try {
    const existing = await graphFetch(`/sites/${AUDITFLOW_CONFIG.siteId}/lists?$filter=displayName eq '${AF_CTRL_LIB_SCHEMA.listName}'`);
    if (existing.value && existing.value.length > 0) {
      console.log('[CTRL_LIB] Liste déjà existante');
      return existing.value[0].id;
    }
  } catch (e) { /* ignore */ }

  const created = await graphFetch(`/sites/${AUDITFLOW_CONFIG.siteId}/lists`, {
    method: 'POST',
    body: JSON.stringify({
      displayName: AF_CTRL_LIB_SCHEMA.listName,
      columns: AF_CTRL_LIB_SCHEMA.columns,
      list: { template: 'genericList' }
    })
  });
  console.log('[CTRL_LIB] Liste créée:', created.id);
  return created.id;
}

async function importControlLibraryFromCSV(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) { console.error('[CTRL_LIB] CSV vide'); return; }

  const parseLine = (line) => {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
      else { cur += c; }
    }
    out.push(cur);
    return out;
  };

  const headers = parseLine(lines[0]);
  let imported = 0, errors = 0;
  for (let i = 1; i < lines.length; i++) {
    const fields = parseLine(lines[i]);
    if (fields.length !== headers.length) { errors++; continue; }
    const row = {};
    headers.forEach((h, idx) => row[h] = fields[idx]);
    try {
      await graphFetch(`/sites/${AUDITFLOW_CONFIG.siteId}/lists/${AF_CTRL_LIB_SCHEMA.listName}/items`, {
        method: 'POST',
        body: JSON.stringify({ fields: row })
      });
      imported++;
      if (imported % 10 === 0) console.log(`[CTRL_LIB] ${imported}/${lines.length-1}...`);
    } catch (e) {
      console.warn(`[CTRL_LIB] Erreur ${row.control_id}:`, e.message);
      errors++;
    }
  }
  console.log(`[CTRL_LIB] Import terminé: ${imported} OK, ${errors} erreurs`);
  CTRL_LIB.loaded = false;
  await loadControlLibrary(true);
}

// Helper d'échappement
if (typeof esc !== 'function') {
  window.esc = function(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
}
