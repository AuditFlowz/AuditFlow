// ════════════════════════════════════════════════════════════════════════════
//  control-library.js v8 — Picker simple avec dropdown cycle
//
//  Logique minimaliste :
//   - L'auditeur ouvre la modale
//   - Choisit un cycle dans un dropdown ("Tous", "Order-to-Cash", "P2P"...)
//   - Filtre par mot-clé si besoin
//   - Coche les contrôles voulus, importe
//
//  Aucune dépendance à AUDIT_PLAN, PROCESSES, ou bridge complexe.
// ════════════════════════════════════════════════════════════════════════════

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
  // ─── Vérifications minimales ────────────────────────────────────────────
  if (typeof CONTROLS_LIBRARY === 'undefined' || !Array.isArray(CONTROLS_LIBRARY) || CONTROLS_LIBRARY.length === 0) {
    if (typeof toast === 'function') toast('Bibliothèque vide ou non chargée');
    return;
  }

  // Fallback : si auditId est tombé, utiliser CA (audit courant)
  let realAuditId = auditId || (typeof window.CA !== 'undefined' ? window.CA : null);
  if (!realAuditId) {
    if (typeof toast === 'function') toast('Audit introuvable');
    return;
  }

  // ─── Données ────────────────────────────────────────────────────────────
  const allControls = CONTROLS_LIBRARY.filter(c => !c.archived);
  const allCycles = [...new Set(allControls.map(c => c.domain))].filter(Boolean).sort();

  // ─── Construction de la modale ──────────────────────────────────────────
  const ov = document.createElement('div');
  ov.id = 'cl-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px';

  const cycleOptions = ['<option value="">— Tous les cycles —</option>']
    .concat(allCycles.map(c => `<option value="${clEsc(c)}">${clEsc(c)} (${allControls.filter(x => x.domain === c).length})</option>`))
    .join('');

  ov.innerHTML = `
    <div style="background:#fff;border-radius:8px;max-width:900px;width:100%;max-height:85vh;display:flex;flex-direction:column">
      <div style="padding:14px 18px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:15px;font-weight:600">Importer depuis la bibliothèque</div>
        <button onclick="document.getElementById('cl-ov').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#999">×</button>
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid #eee;display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#fafafa">
        <label style="font-size:12px;color:#444;font-weight:500">Cycle :</label>
        <select id="cl-cycle" style="padding:6px 10px;border:1px solid #ccc;border-radius:4px;font-size:12px;min-width:220px;cursor:pointer">
          ${cycleOptions}
        </select>
        <input id="cl-kw" placeholder="Filtrer par mot-clé..."
          style="flex:1;min-width:180px;padding:6px 10px;border:1px solid #ccc;border-radius:4px;font-size:12px"/>
        <label style="font-size:12px;display:flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap">
          <input type="checkbox" id="cl-key"/> Clés uniquement
        </label>
      </div>
      <div style="padding:8px 16px;border-bottom:1px solid #eee;display:flex;gap:8px;background:#f5f5f5">
        <button id="cl-tick" type="button"
          style="padding:4px 10px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;font-size:11px">
          Tout cocher
        </button>
        <button id="cl-untick" type="button"
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

  // ─── Rendu de la liste ──────────────────────────────────────────────────
  const render = () => {
    const cycle = document.getElementById('cl-cycle').value;
    const kw = document.getElementById('cl-kw').value.toLowerCase().trim();
    const keyOnly = document.getElementById('cl-key').checked;

    let rows = allControls;
    if (cycle) rows = rows.filter(c => c.domain === cycle);
    if (keyOnly) rows = rows.filter(c => c.key === true);
    if (kw) {
      rows = rows.filter(c =>
        ((c.name || '') + ' ' + (c.description || '') + ' ' + (c.domain || '') + ' ' + (c.wcgwTypical || ''))
          .toLowerCase().includes(kw)
      );
    }

    const grouped = {};
    rows.forEach(r => {
      const k = r.domain || '(sans cycle)';
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(r);
    });

    let html = '';
    Object.keys(grouped).sort().forEach(g => {
      html += `<div style="background:#E1F5EE;color:#085041;padding:6px 14px;font-size:11px;font-weight:600;border-top:0.5px solid #ddd">
        ${clEsc(g)} (${grouped[g].length})
      </div>`;
      grouped[g].forEach(r => {
        const isAuto = (r.nature || '').toLowerCase().includes('it-dependent');
        html += `<label style="display:flex;gap:10px;padding:9px 14px;border-bottom:1px solid #f0f0f0;cursor:pointer;align-items:flex-start"
          onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background=''">
          <input type="checkbox" class="cl-pk" data-id="${clEsc(r.id)}" style="margin-top:3px"/>
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
      html = '<div style="padding:40px;text-align:center;color:#999;font-size:13px">Aucun contrôle ne correspond aux filtres</div>';
    }
    document.getElementById('cl-list').innerHTML = html;

    const upd = () => {
      const n = document.querySelectorAll('.cl-pk:checked').length;
      const r = document.querySelectorAll('.cl-pk').length;
      document.getElementById('cl-cnt').textContent = `${r} affiché${r>1?'s':''} · ${n} sélectionné${n>1?'s':''}`;
    };
    upd();
    document.querySelectorAll('.cl-pk').forEach(cb => cb.addEventListener('change', upd));
  };

  document.getElementById('cl-cycle').addEventListener('change', render);
  document.getElementById('cl-kw').addEventListener('input', render);
  document.getElementById('cl-key').addEventListener('change', render);

  document.getElementById('cl-tick').addEventListener('click', () => {
    document.querySelectorAll('.cl-pk').forEach(cb => cb.checked = true);
    const n = document.querySelectorAll('.cl-pk:checked').length;
    const r = document.querySelectorAll('.cl-pk').length;
    document.getElementById('cl-cnt').textContent = `${r} affiché${r>1?'s':''} · ${n} sélectionné${n>1?'s':''}`;
  });
  document.getElementById('cl-untick').addEventListener('click', () => {
    document.querySelectorAll('.cl-pk').forEach(cb => cb.checked = false);
    const r = document.querySelectorAll('.cl-pk').length;
    document.getElementById('cl-cnt').textContent = `${r} affiché${r>1?'s':''} · 0 sélectionné`;
  });

  document.getElementById('cl-ok').addEventListener('click', async () => {
    const picks = Array.from(document.querySelectorAll('.cl-pk:checked')).map(i => i.dataset.id);
    if (picks.length === 0) {
      if (typeof toast === 'function') toast('Aucun contrôle sélectionné');
      return;
    }

    if (typeof AUD_DATA === 'undefined' || !AUD_DATA[realAuditId]) {
      if (typeof toast === 'function') toast('Données audit introuvables');
      return;
    }
    const d = AUD_DATA[realAuditId];

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

    if (typeof saveAuditData === 'function') await saveAuditData(realAuditId);
    if (typeof addHist === 'function') addHist(realAuditId, `${added} contrôle(s) importé(s) depuis la bibliothèque`);

    document.getElementById('cl-ov').remove();
    if (typeof toast === 'function') toast(`${added} contrôle(s) importé(s) ✓`);

    const detContent = document.getElementById('det-content');
    if (detContent && typeof renderDetContent === 'function') {
      detContent.innerHTML = renderDetContent();
    }
  });

  render();
}

// ─── IMPORT EN MASSE (admin) ───────────────────────────────────────────────

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
