// ════════════════════════════════════════════════════════════════════════════
//  doc-viewer.js — Visionneuse de documents intégrée
//
//  Stratégie par format :
//   - PDF       → PDF.js (lib externe, fetch + render canvas)
//   - Images    → fetch + <img>
//   - Texte/MD/CSV/JSON → fetch + <pre>
//   - Office (DOCX/XLSX/PPTX) → fallback iframe Office Online (avec webUrl SP)
//
//  Le contenu binaire est récupéré via Graph (driveId + itemId), comme pour
//  les photos team. Pas de dépendance au navigateur authentifié SharePoint.
// ════════════════════════════════════════════════════════════════════════════

// État global de la visionneuse
var DV_STATE = {
  pdfDoc: null,
  currentPage: 1,
  zoom: 1.0,
  fileName: '',
  webUrl: '',
};

// Lazy-load PDF.js depuis CDN (au premier ouverture PDF)
var DV_PDFJS_LOADED = false;
function dvLoadPdfJs() {
  if (DV_PDFJS_LOADED) return Promise.resolve();
  return new Promise(function(resolve, reject){
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = function(){
      // Configurer le worker
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        DV_PDFJS_LOADED = true;
        resolve();
      } else {
        reject(new Error('PDF.js failed to load'));
      }
    };
    s.onerror = function(){ reject(new Error('PDF.js CDN unreachable')); };
    document.head.appendChild(s);
  });
}

// Détecter le type d'un fichier d'après son extension
function dvGetFileKind(fileName) {
  var ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['png','jpg','jpeg','gif','webp','bmp','svg'].indexOf(ext) >= 0) return 'image';
  if (['txt','md','csv','json','log','xml','yml','yaml'].indexOf(ext) >= 0) return 'text';
  if (['docx','doc','xlsx','xls','pptx','ppt'].indexOf(ext) >= 0) return 'office';
  if (['mp4','webm','ogg'].indexOf(ext) >= 0) return 'video';
  if (['mp3','wav'].indexOf(ext) >= 0) return 'audio';
  return 'unknown';
}

// Couleur du badge selon le type
function dvKindBadge(kind, fileName) {
  var ext = (fileName.split('.').pop() || '').toUpperCase();
  if (kind === 'pdf') return {bg:'#FAECE7', fg:'#993C1D', label:'PDF'};
  if (kind === 'image') return {bg:'#E1F5EE', fg:'#0F6E56', label:ext};
  if (kind === 'office') {
    if (ext.indexOf('XL')===0) return {bg:'#EAF3DE', fg:'#3B6D11', label:ext};
    if (ext.indexOf('PPT')===0) return {bg:'#FBEAF0', fg:'#993556', label:ext};
    return {bg:'#E6F1FB', fg:'#0C447C', label:ext};
  }
  if (kind === 'text') return {bg:'#F1EFE8', fg:'#5F5E5A', label:ext};
  return {bg:'#F1EFE8', fg:'#5F5E5A', label:ext||'?'};
}

// Récupérer le contenu binaire via Graph (Blob)
async function dvFetchBlob(driveId, itemId) {
  if (typeof getGraphToken !== 'function') throw new Error('Graph non initialisé');
  var token = await getGraphToken();
  var res = await fetch('https://graph.microsoft.com/v1.0/drives/'+driveId+'/items/'+itemId+'/content', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token },
  });
  if (!res.ok) throw new Error('Fetch failed: '+res.status);
  return await res.blob();
}

// Convertir un blob en data URL (pour les images)
function dvBlobToDataUrl(blob) {
  return new Promise(function(resolve, reject){
    var r = new FileReader();
    r.onloadend = function(){ resolve(r.result); };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Convertir un blob en texte (pour TXT/MD/CSV/JSON)
function dvBlobToText(blob) {
  return new Promise(function(resolve, reject){
    var r = new FileReader();
    r.onloadend = function(){ resolve(r.result); };
    r.onerror = reject;
    r.readAsText(blob);
  });
}

// Échapper HTML pour affichage texte brut
function dvEscapeHtml(s) {
  return String(s||'').replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

// ─── EXPORT PRINCIPAL ──────────────────────────────────────────────────────
async function openDocViewer(doc) {
  if (!doc || !doc.driveId || !doc.itemId) {
    if (typeof toast === 'function') toast('Document sans référence SharePoint');
    return;
  }

  DV_STATE.fileName = doc.name || 'fichier';
  DV_STATE.webUrl = doc.url || '';
  DV_STATE.pdfDoc = null;
  DV_STATE.currentPage = 1;
  DV_STATE.zoom = 1.0;

  // Construire l'overlay
  var existing = document.getElementById('dv-overlay');
  if (existing) existing.remove();

  var kind = dvGetFileKind(DV_STATE.fileName);
  var badge = dvKindBadge(kind, DV_STATE.fileName);
  var overlay = document.createElement('div');
  overlay.id = 'dv-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:24px';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:8px;width:100%;max-width:1100px;height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <div style="padding:12px 18px;border-bottom:.5px solid #e5e5e5;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;background:${badge.bg};color:${badge.fg};border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600">${badge.label}</div>
          <div>
            <div style="font-size:13px;font-weight:500;color:#222">${dvEscapeHtml(DV_STATE.fileName)}</div>
            <div id="dv-subtitle" style="font-size:11px;color:#666"></div>
          </div>
        </div>
        <div style="display:flex;gap:6px">
          ${DV_STATE.webUrl ? '<button class="bs" style="font-size:11px;padding:4px 10px" onclick="window.open(\''+DV_STATE.webUrl.replace(/'/g,"\\'")+'\',\'_blank\')">↗ Ouvrir dans onglet</button>' : ''}
          <button class="bs" style="font-size:11px;padding:4px 10px" onclick="dvDownload()">⬇ Télécharger</button>
          <button class="bd" style="font-size:11px;padding:4px 10px" onclick="dvClose()">✕ Fermer</button>
        </div>
      </div>
      <div id="dv-toolbar" style="padding:8px 16px;border-bottom:.5px solid #e5e5e5;background:#fafafa;display:none;align-items:center;justify-content:center;gap:14px;font-size:11px;color:#444;flex-shrink:0"></div>
      <div id="dv-body" style="flex:1;overflow:auto;background:#f3f3f3;display:flex;align-items:center;justify-content:center;padding:18px">
        <div style="color:#666;font-size:13px;font-style:italic">Chargement du document...</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Cliquer en dehors → fermer
  overlay.addEventListener('click', function(e){
    if (e.target === overlay) dvClose();
  });
  // Échap → fermer
  document.addEventListener('keydown', dvKeyHandler);

  // Charger selon le type
  try {
    if (kind === 'pdf') {
      await dvRenderPdf(doc);
    } else if (kind === 'image') {
      await dvRenderImage(doc);
    } else if (kind === 'text') {
      await dvRenderText(doc);
    } else if (kind === 'office') {
      await dvRenderOffice(doc);
    } else if (kind === 'video') {
      await dvRenderVideo(doc);
    } else if (kind === 'audio') {
      await dvRenderAudio(doc);
    } else {
      dvRenderUnsupported(doc);
    }
  } catch(e) {
    console.error('[DV] Erreur:', e);
    var body = document.getElementById('dv-body');
    if (body) body.innerHTML = '<div style="color:#A32D2D;font-size:13px;text-align:center;padding:2rem">'
      +'<div style="margin-bottom:8px">⚠ Erreur lors du chargement</div>'
      +'<div style="font-size:11px;color:#666">'+dvEscapeHtml(e.message)+'</div>'
      +(DV_STATE.webUrl?'<div style="margin-top:14px"><button class="bs" onclick="window.open(\''+DV_STATE.webUrl.replace(/'/g,"\\'")+'\',\'_blank\')">↗ Ouvrir dans SharePoint</button></div>':'')
      +'</div>';
  }
}

function dvKeyHandler(e) {
  if (e.key === 'Escape') dvClose();
  if (DV_STATE.pdfDoc) {
    if (e.key === 'ArrowLeft') dvPdfPrev();
    if (e.key === 'ArrowRight') dvPdfNext();
  }
}

function dvClose() {
  document.removeEventListener('keydown', dvKeyHandler);
  var ov = document.getElementById('dv-overlay');
  if (ov) ov.remove();
  DV_STATE.pdfDoc = null;
}

async function dvDownload() {
  // Re-fetch le blob et déclenche le téléchargement
  // Un peu wasteful (déjà téléchargé) mais évite de cacher des Mo de blob
  if (DV_STATE.webUrl) {
    window.open(DV_STATE.webUrl, '_blank');
    return;
  }
  if (typeof toast === 'function') toast('Téléchargement non disponible');
}

// ─── PDF ───────────────────────────────────────────────────────────────────
async function dvRenderPdf(doc) {
  await dvLoadPdfJs();
  var blob = await dvFetchBlob(doc.driveId, doc.itemId);
  var arrayBuf = await blob.arrayBuffer();
  DV_STATE.pdfDoc = await window.pdfjsLib.getDocument({data: arrayBuf}).promise;
  DV_STATE.currentPage = 1;

  var body = document.getElementById('dv-body');
  body.innerHTML = '<canvas id="dv-pdf-canvas" style="background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.15);max-width:100%;display:block"></canvas>';
  body.style.display = 'flex';
  body.style.alignItems = 'flex-start';
  body.style.justifyContent = 'center';
  body.style.padding = '18px';

  // Toolbar
  var tb = document.getElementById('dv-toolbar');
  tb.innerHTML = `
    <button class="bs" style="font-size:11px;padding:3px 9px" onclick="dvPdfPrev()">◀</button>
    <span>Page <strong id="dv-pdf-page">1</strong> / ${DV_STATE.pdfDoc.numPages}</span>
    <button class="bs" style="font-size:11px;padding:3px 9px" onclick="dvPdfNext()">▶</button>
    <span style="color:#bbb;margin:0 6px">|</span>
    <button class="bs" style="font-size:11px;padding:3px 9px" onclick="dvPdfZoom(-0.2)">−</button>
    <span><span id="dv-pdf-zoom">100</span>%</span>
    <button class="bs" style="font-size:11px;padding:3px 9px" onclick="dvPdfZoom(0.2)">+</button>
    <button class="bs" style="font-size:11px;padding:3px 9px;margin-left:6px" onclick="dvPdfFit()">↔ Ajuster</button>
  `;
  tb.style.display = 'flex';

  document.getElementById('dv-subtitle').textContent = DV_STATE.pdfDoc.numPages + ' pages';

  await dvPdfRenderPage();
}

async function dvPdfRenderPage() {
  if (!DV_STATE.pdfDoc) return;
  var page = await DV_STATE.pdfDoc.getPage(DV_STATE.currentPage);
  var canvas = document.getElementById('dv-pdf-canvas');
  if (!canvas) return;
  var viewport = page.getViewport({scale: DV_STATE.zoom * 1.5});
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = (viewport.width / 1.5) + 'px';
  canvas.style.height = (viewport.height / 1.5) + 'px';
  await page.render({canvasContext: canvas.getContext('2d'), viewport: viewport}).promise;
  var pgEl = document.getElementById('dv-pdf-page');
  if (pgEl) pgEl.textContent = DV_STATE.currentPage;
  var zEl = document.getElementById('dv-pdf-zoom');
  if (zEl) zEl.textContent = Math.round(DV_STATE.zoom*100);
}

function dvPdfPrev() {
  if (!DV_STATE.pdfDoc || DV_STATE.currentPage<=1) return;
  DV_STATE.currentPage--;
  dvPdfRenderPage();
}
function dvPdfNext() {
  if (!DV_STATE.pdfDoc || DV_STATE.currentPage>=DV_STATE.pdfDoc.numPages) return;
  DV_STATE.currentPage++;
  dvPdfRenderPage();
}
function dvPdfZoom(delta) {
  DV_STATE.zoom = Math.max(0.5, Math.min(3.0, DV_STATE.zoom + delta));
  dvPdfRenderPage();
}
function dvPdfFit() {
  DV_STATE.zoom = 1.0;
  dvPdfRenderPage();
}

// ─── IMAGE ─────────────────────────────────────────────────────────────────
async function dvRenderImage(doc) {
  var blob = await dvFetchBlob(doc.driveId, doc.itemId);
  var dataUrl = await dvBlobToDataUrl(blob);
  var body = document.getElementById('dv-body');
  body.innerHTML = '<img src="'+dataUrl+'" style="max-width:100%;max-height:100%;object-fit:contain;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.15)"/>';
  // Subtitle = taille
  var sizeKb = Math.round(blob.size/1024);
  document.getElementById('dv-subtitle').textContent = sizeKb<1024 ? sizeKb+' Ko' : (sizeKb/1024).toFixed(1)+' Mo';
}

// ─── TEXTE / MD / CSV / JSON ───────────────────────────────────────────────
async function dvRenderText(doc) {
  var blob = await dvFetchBlob(doc.driveId, doc.itemId);
  var text = await dvBlobToText(blob);
  // Truncate si très gros
  var maxChars = 500000;
  var truncated = false;
  if (text.length > maxChars) {
    text = text.substring(0, maxChars);
    truncated = true;
  }
  var body = document.getElementById('dv-body');
  body.style.alignItems = 'flex-start';
  body.style.justifyContent = 'flex-start';
  body.innerHTML = '<pre style="background:#fff;padding:18px;width:100%;font-size:12px;font-family:Consolas,Monaco,monospace;line-height:1.5;color:#222;white-space:pre-wrap;word-wrap:break-word;border-radius:4px;box-shadow:0 4px 20px rgba(0,0,0,.1);margin:0">'+dvEscapeHtml(text)+(truncated?'\n\n[... fichier tronqué à 500 000 caractères ...]':'')+'</pre>';
  document.getElementById('dv-subtitle').textContent = (text.length/1024).toFixed(1)+' Ko'+(truncated?' (tronqué)':'');
}

// ─── OFFICE (DOCX/XLSX/PPTX) ───────────────────────────────────────────────
// Solution : on utilise l'API Graph "driveItem: preview" qui retourne un
// getUrl pré-authentifié vers onedrive.com/embed — cette URL est embeddable
// (pas de X-Frame-Options bloquant comme sur SharePoint direct).
// Doc : https://learn.microsoft.com/en-us/graph/api/driveitem-preview
async function dvRenderOffice(doc) {
  var body = document.getElementById('dv-body');
  document.getElementById('dv-subtitle').textContent = 'Office Online';

  // Affichage temporaire pendant le chargement du preview
  body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:13px">Chargement de l\'aperçu…</div>';
  body.style.padding = '0';

  // Fallback si on n'a pas les infos nécessaires
  if (!doc.driveId || !doc.itemId) {
    dvRenderOfficeFallback(body, 'Identifiants Graph manquants pour cet item.');
    return;
  }

  try {
    if (typeof getGraphToken !== 'function') throw new Error('Graph non initialisé');
    var token = await getGraphToken();
    var res = await fetch(
      'https://graph.microsoft.com/v1.0/drives/' + doc.driveId + '/items/' + doc.itemId + '/preview',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );
    if (!res.ok) {
      var errText = await res.text();
      throw new Error('Graph preview ' + res.status + ': ' + errText.slice(0, 200));
    }
    var data = await res.json();
    var embedUrl = data.getUrl;
    if (!embedUrl) throw new Error('Aucun getUrl retourné par Graph');

    // Ajouter ?nb=true pour supprimer la bannière "Open in Office"
    embedUrl += (embedUrl.indexOf('?') >= 0 ? '&' : '?') + 'nb=true';

    body.innerHTML = '<iframe src="' + embedUrl.replace(/"/g, '&quot;') + '" '
      + 'style="width:100%;height:100%;border:none;background:#fff" '
      + 'allow="clipboard-read; clipboard-write" '
      + 'sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>';
  } catch (e) {
    console.warn('[dvRenderOffice] preview API failed:', e);
    dvRenderOfficeFallback(body, e.message || 'Erreur inconnue');
  }
}

// Fallback : afficher un bouton "Ouvrir dans onglet" + "Télécharger" quand
// l'aperçu intégré n'a pas pu être généré.
function dvRenderOfficeFallback(body, errorMsg) {
  body.style.padding = '2rem';
  var html = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:#444;gap:14px">';
  html += '<div style="font-size:48px;opacity:.4">📄</div>';
  html += '<div style="font-size:14px;font-weight:500">Aperçu intégré indisponible</div>';
  html += '<div style="font-size:12px;color:#777;max-width:420px">Le document peut être ouvert directement dans Office Online ou téléchargé.</div>';
  html += '<div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;justify-content:center">';
  if (DV_STATE.webUrl) {
    html += '<button class="bp" onclick="window.open(\'' + DV_STATE.webUrl.replace(/'/g, "\\'") + '\',\'_blank\')">↗ Ouvrir dans Office Online</button>';
  }
  html += '<button class="bs" onclick="dvDownload()">⬇ Télécharger</button>';
  html += '</div>';
  if (errorMsg) {
    html += '<details style="margin-top:14px;font-size:11px;color:#999"><summary style="cursor:pointer">Détails techniques</summary><div style="margin-top:6px;font-family:monospace;text-align:left;padding:8px;background:#f5f5f5;border-radius:4px">' + errorMsg.replace(/</g, '&lt;') + '</div></details>';
  }
  html += '</div>';
  body.innerHTML = html;
}

// ─── VIDEO ─────────────────────────────────────────────────────────────────
async function dvRenderVideo(doc) {
  var blob = await dvFetchBlob(doc.driveId, doc.itemId);
  var url = URL.createObjectURL(blob);
  var body = document.getElementById('dv-body');
  body.innerHTML = '<video controls src="'+url+'" style="max-width:100%;max-height:100%;background:#000"></video>';
}

// ─── AUDIO ─────────────────────────────────────────────────────────────────
async function dvRenderAudio(doc) {
  var blob = await dvFetchBlob(doc.driveId, doc.itemId);
  var url = URL.createObjectURL(blob);
  var body = document.getElementById('dv-body');
  body.innerHTML = '<audio controls src="'+url+'" style="width:80%"></audio>';
}

// ─── UNSUPPORTED ───────────────────────────────────────────────────────────
function dvRenderUnsupported(doc) {
  var body = document.getElementById('dv-body');
  body.innerHTML = '<div style="color:#666;font-size:13px;text-align:center;padding:2rem">'
    +'<div style="margin-bottom:8px">Format non supporté pour l\'aperçu intégré</div>'
    +'<div style="font-size:11px;color:#888;margin-bottom:14px">Utilisez le bouton « Ouvrir dans onglet » ou « Télécharger ».</div>'
    +'</div>';
}
