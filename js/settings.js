// ─────────────────────────────────────────────────────────────
//  AuditFlow SaaS — settings.js
//  Page Paramètres de l'organisation
//
//  Fonctionnalités :
//    - Logo (upload → base64, stocké en JSONB dans af_org_config)
//    - Nom de l'organisation
//    - Couleur principale (CSS custom property)
//    - Informations : secteur, taille, pays siège, site web
//    - Sauvegarde instantanée dans af_org_config.settings (JSONB)
//    - Application immédiate du logo et de la couleur dans l'UI
//
//  Accès : tous les rôles sauf superadmin (qui gère via admin.js)
//  Navigation : V['settings'] + I['settings']
// ─────────────────────────────────────────────────────────────

// ── Données en mémoire ────────────────────────────────────────
var _settings = {
  org_name:    '',
  logo_b64:    '',       // image en base64
  color:       '#534AB7', // couleur principale (défaut = purple AuditFlow)
  secteur:     '',
  taille:      '',
  pays:        '',
  site_web:    '',
};

// Clé localStorage scopée par utilisateur connecté.
// Évite que sur un poste partagé, les paramètres d'un user soient appliqués
// à un autre. Si CU n'est pas dispo (cas anormal), on utilise une clé générique.
function _settingsKey() {
  var email = (typeof CU !== 'undefined' && CU && CU.email) ? CU.email : 'anonymous';
  return 'af_settings:' + email;
}

// ── Vue HTML ──────────────────────────────────────────────────
V['settings'] = function(){
  return `
  <div class="content">

    <div class="sth" style="margin-bottom:1.25rem;">
      <div>
        <div style="font-size:16px; font-weight:600;">Paramètres</div>
        <div style="font-size:12px; color:var(--text-3); margin-top:2px;">
          Personnalisation de votre organisation
        </div>
      </div>
      <button class="bp" id="settings-save-btn" onclick="settingsSave()">
        Enregistrer
      </button>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; max-width:900px;">

      <!-- Colonne gauche : Identité visuelle -->
      <div class="card" style="padding:1.25rem;">
        <div style="font-size:13px; font-weight:600; margin-bottom:1rem;
                    padding-bottom:.5rem; border-bottom:.5px solid var(--border);">
          Identité visuelle
        </div>

        <!-- Logo -->
        <div style="margin-bottom:1.25rem;">
          <label class="f-lbl" style="display:block; margin-bottom:8px;">
            Logo de l'organisation
          </label>

          <!-- Aperçu du logo -->
          <div id="settings-logo-preview"
            style="width:120px; height:80px; border:.5px solid var(--border);
                   border-radius:var(--radius); display:flex; align-items:center;
                   justify-content:center; background:var(--bg); margin-bottom:8px;
                   overflow:hidden;">
            <span style="font-size:11px; color:var(--text-3);" id="settings-logo-placeholder">
              Aucun logo
            </span>
          </div>

          <div style="display:flex; gap:7px; align-items:center;">
            <label class="bp" style="cursor:pointer; font-size:11px; padding:5px 10px;">
              Choisir une image
              <input type="file" id="settings-logo-input" accept="image/*"
                style="display:none;" onchange="settingsHandleLogo(this)">
            </label>
            <button class="bs" onclick="settingsRemoveLogo()"
              style="font-size:11px; padding:5px 10px; color:var(--red);">
              Supprimer
            </button>
          </div>
          <div style="font-size:10px; color:var(--text-3); margin-top:5px;">
            PNG, JPG ou SVG · Max 500 Ko · Recommandé : fond transparent
          </div>
        </div>

        <!-- Couleur principale -->
        <div style="margin-bottom:1.25rem;">
          <label class="f-lbl" style="display:block; margin-bottom:8px;">
            Couleur principale
          </label>
          <div style="display:flex; align-items:center; gap:10px;">
            <input type="color" id="settings-color"
              style="width:44px; height:36px; border:.5px solid var(--border);
                     border-radius:var(--radius); cursor:pointer; padding:2px;"
              oninput="settingsPreviewColor(this.value)">
            <input type="text" id="settings-color-hex" class="f-inp"
              style="width:110px; font-size:12px; font-family:monospace;"
              placeholder="#534AB7" maxlength="7"
              oninput="settingsSyncColorFromHex(this.value)">
            <div style="display:flex; gap:5px;">
              ${['#534AB7','#1D9E75','#378ADD','#854F0B','#A32D2D','#1a1a18'].map(function(c){
                return `<div onclick="settingsPickColor('${c}')"
                  style="width:20px;height:20px;border-radius:50%;background:${c};
                         cursor:pointer;border:.5px solid var(--border);flex-shrink:0;"
                  title="${c}"></div>`;
              }).join('')}
            </div>
          </div>
          <div style="margin-top:8px; font-size:11px; color:var(--text-3);">
            Aperçu :
            <span id="settings-color-sample"
              style="display:inline-block; padding:2px 10px; border-radius:20px;
                     font-size:11px; font-weight:500; color:#fff; margin-left:4px;">
              AuditFlow
            </span>
          </div>
        </div>

        <!-- Nom de l'organisation -->
        <div>
          <label class="f-lbl">Nom de l'organisation</label>
          <input type="text" id="settings-org-name" class="f-inp"
            style="width:100%; margin-top:4px;"
            placeholder="ex : Groupe Meridian SA">
        </div>
      </div>

      <!-- Colonne droite : Informations -->
      <div class="card" style="padding:1.25rem;">
        <div style="font-size:13px; font-weight:600; margin-bottom:1rem;
                    padding-bottom:.5rem; border-bottom:.5px solid var(--border);">
          Informations générales
        </div>

        <div style="display:flex; flex-direction:column; gap:1rem;">

          <div>
            <label class="f-lbl">Secteur d'activité</label>
            <select id="settings-secteur" class="f-inp" style="width:100%; margin-top:4px;">
              <option value="">— Sélectionner —</option>
              <option value="banque_finance">Banque / Finance / Assurance</option>
              <option value="industrie">Industrie / Fabrication</option>
              <option value="retail">Commerce / Retail / Distribution</option>
              <option value="sante_pharma">Santé / Pharma</option>
              <option value="energie">Énergie / Utilities</option>
              <option value="tech_telecoms">Tech / Télécoms / IT</option>
              <option value="services_pro">Services professionnels</option>
              <option value="btp">BTP / Immobilier</option>
              <option value="agroalimentaire">Agroalimentaire</option>
              <option value="secteur_public">Secteur public / Collectivités</option>
              <option value="ong">ONG / Association</option>
              <option value="autre">Autre</option>
            </select>
          </div>

          <div>
            <label class="f-lbl">Taille de l'organisation</label>
            <select id="settings-taille" class="f-inp" style="width:100%; margin-top:4px;">
              <option value="">— Sélectionner —</option>
              <option value="tpe">TPE — moins de 50 employés</option>
              <option value="pme">PME — 50 à 499 employés</option>
              <option value="eti">ETI — 500 à 4 999 employés</option>
              <option value="ge">Grande entreprise — 5 000+</option>
            </select>
          </div>

          <div>
            <label class="f-lbl">Pays du siège social</label>
            <input type="text" id="settings-pays" class="f-inp"
              style="width:100%; margin-top:4px;"
              placeholder="ex : France">
          </div>

          <div>
            <label class="f-lbl">Site web</label>
            <input type="url" id="settings-site" class="f-inp"
              style="width:100%; margin-top:4px;"
              placeholder="ex : https://www.entreprise.com">
          </div>

        </div>
      </div>

    </div>

    <!-- Aperçu sidebar -->
    <div class="card" style="max-width:900px; margin-top:1rem; padding:1.25rem;">
      <div style="font-size:13px; font-weight:600; margin-bottom:.75rem;">
        Aperçu dans la sidebar
      </div>
      <div style="display:flex; align-items:center; gap:10px;
                  background:var(--bg-card); border-radius:var(--radius);
                  padding:.75rem 1rem; width:220px;">
        <div id="settings-sidebar-preview"
          style="width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
        </div>
        <span style="font-size:13px; font-weight:600;" id="settings-sidebar-name">
          AuditFlow
        </span>
      </div>
    </div>

  </div>`;
};

// ── Init — chargement des paramètres existants ────────────────
I['settings'] = async function(){
  await settingsLoad();
};

// ── Chargement depuis localStorage (SharePoint à venir) ──────
async function settingsLoad(){
  try {
    var stored = localStorage.getItem(_settingsKey());
    var data = stored ? JSON.parse(stored) : null;
    if(data){
      if(data.settings){
        _settings = Object.assign(_settings, data.settings);
      }
      if(data.org_name_override){
        _settings.org_name = data.org_name_override;
      }
    }

    settingsRestoreUI();

  } catch(e){
    console.warn('[Settings] exception:', e.message);
    settingsRestoreUI();
  }
}

// ── Restaurer l'UI avec les valeurs chargées ──────────────────
function settingsRestoreUI(){
  // Nom
  var nameEl = document.getElementById('settings-org-name');
  if(nameEl) nameEl.value = _settings.org_name || (CU && CU.name) || '';

  // Couleur
  var color = _settings.color || '#534AB7';
  var colorEl    = document.getElementById('settings-color');
  var colorHexEl = document.getElementById('settings-color-hex');
  if(colorEl)    colorEl.value    = color;
  if(colorHexEl) colorHexEl.value = color;
  settingsPreviewColor(color);

  // Secteur / taille / pays / site
  var sectEl = document.getElementById('settings-secteur');
  var tailEl = document.getElementById('settings-taille');
  var paysEl = document.getElementById('settings-pays');
  var siteEl = document.getElementById('settings-site');
  if(sectEl) sectEl.value = _settings.secteur  || '';
  if(tailEl) tailEl.value = _settings.taille   || '';
  if(paysEl) paysEl.value = _settings.pays     || '';
  if(siteEl) siteEl.value = _settings.site_web || '';

  // Logo
  if(_settings.logo_b64){
    settingsShowLogoPreview(_settings.logo_b64);
  }

  // Aperçu sidebar
  settingsUpdateSidebarPreview();
}

// ── Gestion du logo ───────────────────────────────────────────
function settingsHandleLogo(input){
  var file = input.files[0];
  if(!file) return;

  if(file.size > 500 * 1024){
    toast('Image trop lourde — max 500 Ko.');
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e){
    _settings.logo_b64 = e.target.result; // data:image/...;base64,...
    settingsShowLogoPreview(_settings.logo_b64);
    settingsUpdateSidebarPreview();
  };
  reader.readAsDataURL(file);
}

function settingsShowLogoPreview(src){
  var preview     = document.getElementById('settings-logo-preview');
  var placeholder = document.getElementById('settings-logo-placeholder');
  if(!preview) return;

  var existing = preview.querySelector('img');
  if(existing) existing.remove();
  if(placeholder) placeholder.style.display = 'none';

  var img = document.createElement('img');
  img.src = src;
  img.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain;';
  preview.appendChild(img);
}

function settingsRemoveLogo(){
  _settings.logo_b64 = '';
  var preview     = document.getElementById('settings-logo-preview');
  var placeholder = document.getElementById('settings-logo-placeholder');
  if(preview){
    var img = preview.querySelector('img');
    if(img) img.remove();
  }
  if(placeholder) placeholder.style.display = '';
  settingsUpdateSidebarPreview();
}

// ── Gestion de la couleur ─────────────────────────────────────
function settingsPreviewColor(hex){
  if(!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
  _settings.color = hex;

  var sample  = document.getElementById('settings-color-sample');
  var colorEl = document.getElementById('settings-color');
  var hexEl   = document.getElementById('settings-color-hex');

  if(sample)  { sample.style.background = hex; }
  if(colorEl) { colorEl.value = hex; }
  if(hexEl && document.activeElement !== hexEl) { hexEl.value = hex; }
}

function settingsSyncColorFromHex(val){
  if(/^#[0-9A-Fa-f]{6}$/.test(val)){
    settingsPreviewColor(val);
  }
}

function settingsPickColor(hex){
  settingsPreviewColor(hex);
  var hexEl   = document.getElementById('settings-color-hex');
  var colorEl = document.getElementById('settings-color');
  if(hexEl)   hexEl.value   = hex;
  if(colorEl) colorEl.value = hex;
}

// ── Aperçu sidebar ────────────────────────────────────────────
function settingsUpdateSidebarPreview(){
  var nameEl    = document.getElementById('settings-org-name');
  var sideImg   = document.getElementById('settings-sidebar-preview');
  var sideName  = document.getElementById('settings-sidebar-name');

  var name = (nameEl ? nameEl.value : '') || (CU && CU.name) || 'AuditFlow';
  if(sideName) sideName.textContent = name;

  if(!sideImg) return;
  sideImg.innerHTML = '';

  if(_settings.logo_b64){
    var img = document.createElement('img');
    img.src = _settings.logo_b64;
    img.style.cssText = 'width:28px;height:28px;object-fit:contain;';
    sideImg.appendChild(img);
  } else {
    // Initiales si pas de logo
    var initials = name.split(' ').map(function(w){ return w[0]; }).join('').toUpperCase().slice(0,2);
    sideImg.style.cssText = 'width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff;background:' + (_settings.color || '#534AB7');
    sideImg.textContent = initials;
  }
}

// ── Sauvegarde ────────────────────────────────────────────────
async function settingsSave(){
  var btn = document.getElementById('settings-save-btn');
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Enregistrement…'; }

  // Collecter toutes les valeurs du formulaire
  _settings.org_name  = (document.getElementById('settings-org-name')?.value  || '').trim();
  _settings.color     = document.getElementById('settings-color')?.value     || '#534AB7';
  _settings.secteur   = document.getElementById('settings-secteur')?.value   || '';
  _settings.taille    = document.getElementById('settings-taille')?.value    || '';
  _settings.pays      = document.getElementById('settings-pays')?.value      || '';
  _settings.site_web  = document.getElementById('settings-site')?.value      || '';

  try {
    var payload = {
      settings:          _settings,          // tout en JSONB
      org_name_override: _settings.org_name, // colonne dénormalisée
    };

    // Sauvegarder en localStorage
    localStorage.setItem(_settingsKey(), JSON.stringify(payload));

    // Appliquer immédiatement dans l'UI
    settingsApplyToApp();

    toast('Paramètres enregistrés ✓');
    addHist('settings', 'Paramètres organisation mis à jour');

  } catch(e){
    console.error('[Settings] save:', e);
    toast('Erreur : ' + e.message);
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = 'Enregistrer'; }
  }
}

// ── Application immédiate dans l'app ──────────────────────────
function settingsApplyToApp(){
  // Couleur principale → variable CSS globale
  if(_settings.color){
    document.documentElement.style.setProperty('--purple', _settings.color);
    // Recalculer les variantes (clair / foncé) — approximation
    document.documentElement.style.setProperty('--purple-dk', _settings.color);
    document.documentElement.style.setProperty('--purple-lt', _settings.color + '22');
  }

  // Logo dans la sidebar
  var sidebarLogo = document.querySelector('.logo img');
  if(sidebarLogo && _settings.logo_b64){
    sidebarLogo.src = _settings.logo_b64;
  }

  // Nom dans la sidebar
  if(_settings.org_name){
    var logoSpan = document.querySelector('.logo span');
    if(logoSpan) logoSpan.textContent = _settings.org_name;
  }
}

// ── Charger et appliquer les settings au démarrage ────────────
// Appelé depuis launchApp() dans app.js après connexion réussie
async function settingsApplyOnLoad(){
  try {
    var stored = localStorage.getItem(_settingsKey());
    if(stored){
      var data = JSON.parse(stored);
      if(data && data.settings){
        _settings = Object.assign(_settings, data.settings);
        settingsApplyToApp();
      }
    }
  } catch(e){
    console.warn('[Settings] applyOnLoad:', e.message);
  }
}
