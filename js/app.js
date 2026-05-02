// ═══════════════════════════════════════════════════════════
//  app.js — Auth SSO Microsoft uniquement (Entra ID)
//  - Plus de login invité
//  - Token Graph obtenu AVANT chargement des données
//  - Vérification liste utilisateurs autorisés (SharePoint)
// ═══════════════════════════════════════════════════════════

// ── Point d'entrée principal ────────────────────────────────
window.addEventListener('DOMContentLoaded', initLogin);

async function initLogin() {
  // Afficher écran de chargement
  showLoadingScreen('Connexion en cours...');

  // 0. Si on revient d'une redirection MSAL, capturer le token d'abord
  // (handleGraphRedirect est défini dans graph.js)
  try {
    if (typeof handleGraphRedirect === 'function') {
      await handleGraphRedirect();
    }
  } catch(e) {
    console.warn('[App] handleGraphRedirect error:', e.message);
  }

  // 1. Session locale encore active ?
  var saved = sessionStorage.getItem('af_user');
  if (saved) {
    try {
      CU = JSON.parse(saved);
      await bootstrapApp();
      return;
    } catch(e) {
      sessionStorage.removeItem('af_user');
    }
  }

  // 2. Session SSO Azure SWA active ?
  var ssoUser = await checkSSOSession();
  if (!ssoUser) {
    // Pas connecté → redirection vers Microsoft
    // (normalement géré par staticwebapp.config.json, mais au cas où)
    window.location.href = '/.auth/login/aad?post_login_redirect_uri=' + encodeURIComponent(window.location.href);
    return;
  }

  CU = ssoUser;
  sessionStorage.setItem('af_user', JSON.stringify(CU));
  await bootstrapApp();
}

// ── Bootstrap : token Graph → vérif accès → chargement ──────
async function bootstrapApp() {
  try {
    // 1. Obtenir le token Graph AVANT tout
    showLoadingScreen('Connexion à SharePoint...');
    var token = await getGraphToken();

    // Si getGraphToken a lancé une redirection vers Microsoft, la page est en
    // train de partir — on ne fait rien de plus, on attend que ça charge.
    if (sessionStorage.getItem('af_graph_redirect_pending') === '1' && !token) {
      // La redirection est en cours, ne rien faire
      showLoadingScreen('Redirection vers Microsoft...');
      return;
    }

    if (!token) {
      showErrorScreen(
        'Impossible de se connecter à SharePoint',
        'Le token Microsoft Graph n\'a pas pu être obtenu. Essayez de vous reconnecter.',
        true
      );
      return;
    }

    // Nettoyer le flag de redirection si on a un token
    sessionStorage.removeItem('af_graph_redirect_pending');
    console.log('[App] Token Graph prêt ✓');

    // 2. Charger la liste des utilisateurs autorisés
    showLoadingScreen('Vérification des accès...');
    var authorizedUsers = await loadAuthorizedUsers();

    // 3. Vérifier que l'utilisateur est autorisé
    var authorized = authorizedUsers.find(function(u) {
      return u.email && u.email.toLowerCase() === CU.email.toLowerCase()
             && u.status === 'actif';
    });

    if (!authorized) {
      showUnauthorizedScreen(CU.email);
      return;
    }

    // 4. Mettre à jour CU avec les infos de SharePoint (rôle, nom exact, etc.)
    CU.role = authorized.role || 'auditeur';
    CU.name = authorized.name || CU.name;
    CU.initials = authorized.initials || CU.initials;
    sessionStorage.setItem('af_user', JSON.stringify(CU));

    // 5. Charger toutes les données (avec retry si rien n'arrive)
    showLoadingScreen('Chargement des données...');
    await loadAllData();

    // Sécurité : si le premier chargement semble vide, re-tenter une fois
    // (parfois le token n'est pas encore "réchauffé" au premier appel)
    if (!AUDIT_PLAN || AUDIT_PLAN.length === 0) {
      if (!PROCESSES || PROCESSES.length === 0) {
        console.log('[App] Premier chargement vide, nouvelle tentative...');
        await new Promise(function(r){ setTimeout(r, 500); });
        await loadAllData();
      }
    }

    // 6. Lancer l'appli
    launchApp();

  } catch(e) {
    console.error('[App] Bootstrap error:', e);
    showErrorScreen(
      'Erreur au démarrage',
      e.message || 'Une erreur est survenue.',
      true
    );
  }
}

// ── Vérifier session SSO Azure SWA (/.auth/me) ──────────────
async function checkSSOSession() {
  try {
    var res = await fetch('/.auth/me');
    if (!res.ok) return null;
    var data = await res.json();
    var cp = data && data.clientPrincipal;
    if (!cp || !cp.userDetails) return null;

    var email = cp.userDetails.toLowerCase();
    var displayName = email.split('@')[0].replace(/\./g, ' ');
    // Capitaliser chaque mot
    displayName = displayName.split(' ').map(function(w) {
      return w ? w[0].toUpperCase() + w.slice(1) : '';
    }).join(' ');

    return {
      id:       cp.userId || email,
      name:     displayName,
      email:    email,
      role:     'auditeur', // sera écrasé par bootstrapApp avec la valeur SharePoint
      initials: displayName.split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2),
      status:   'actif',
      source:   'sso',
    };
  } catch(e) {
    return null;
  }
}

// ── Écrans de chargement / erreur ───────────────────────────
function showLoadingScreen(msg) {
  var app = document.getElementById('app');
  if (app) app.style.display = 'none';

  var loader = document.getElementById('af-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'af-loader';
    loader.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;background:#0F0E1A;color:#fff;font-family:system-ui,sans-serif;z-index:9999;';
    loader.innerHTML = '<div style="width:48px;height:48px;border:4px solid rgba(255,255,255,0.1);border-top-color:#5B4CF5;border-radius:50%;animation:spin 1s linear infinite"></div><div id="af-loader-msg" style="font-size:14px;color:rgba(255,255,255,0.7)"></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(loader);
  }
  var msgEl = document.getElementById('af-loader-msg');
  if (msgEl) msgEl.textContent = msg || 'Chargement...';
  loader.style.display = 'flex';
}

function hideLoadingScreen() {
  var loader = document.getElementById('af-loader');
  if (loader) loader.style.display = 'none';
}

function showErrorScreen(title, msg, showRetry) {
  hideLoadingScreen();
  var app = document.getElementById('app');
  if (app) app.style.display = 'none';

  var err = document.getElementById('af-error');
  if (err) err.remove();

  err = document.createElement('div');
  err.id = 'af-error';
  err.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0F0E1A;color:#fff;font-family:system-ui,sans-serif;z-index:9999;padding:20px;';
  err.innerHTML =
    '<div style="max-width:480px;text-align:center;background:#1C1A2E;padding:32px;border-radius:12px;border:1px solid rgba(255,255,255,0.1)">' +
    '<div style="font-size:48px;margin-bottom:16px">⚠️</div>' +
    '<div style="font-size:18px;font-weight:600;margin-bottom:12px">' + title + '</div>' +
    '<div style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:24px;line-height:1.5">' + msg + '</div>' +
    (showRetry ?
      '<button onclick="location.reload()" style="background:#5B4CF5;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;margin-right:8px">Réessayer</button>' +
      '<button onclick="window.location.href=\'/.auth/logout?post_logout_redirect_uri=/\'" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.2);padding:10px 20px;border-radius:6px;font-size:14px;cursor:pointer">Se déconnecter</button>'
      : '') +
    '</div>';
  document.body.appendChild(err);
}

function showUnauthorizedScreen(email) {
  showErrorScreen(
    'Accès refusé',
    'Votre compte <strong>' + email + '</strong> n\'est pas autorisé à accéder à AuditFlow.<br><br>Contactez l\'administrateur de l\'application pour demander un accès.',
    false
  );
  // Ajouter bouton de déconnexion après
  setTimeout(function() {
    var err = document.getElementById('af-error');
    if (err && !err.querySelector('button')) {
      var btn = document.createElement('button');
      btn.textContent = 'Se déconnecter';
      btn.style.cssText = 'background:#5B4CF5;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;margin-top:16px';
      btn.onclick = function() {
        window.location.href = '/.auth/logout?post_logout_redirect_uri=/';
      };
      err.querySelector('div').appendChild(btn);
    }
  }, 100);
}

// ── Lancer l'application après auth ─────────────────────────
async function launchApp() {
  hideLoadingScreen();

  document.getElementById('app').style.display = 'flex';

  var app = document.getElementById('app');
  app.classList.remove('is-admin', 'is-superadmin');
  if (CU.role === 'admin')  app.classList.add('is-admin');
  if (CU.role === 'viewer') app.classList.add('is-viewer');

  // Avatar
  var initials = CU.initials || CU.name.split(' ').map(function(w){return w[0];}).join('').toUpperCase().slice(0,2);
  document.getElementById('uav').textContent = initials;
  document.getElementById('uname').textContent = CU.name;
  document.getElementById('urole').textContent =
    CU.role === 'admin'   ? 'Admin / Directeur' :
    CU.role === 'viewer'  ? 'Observateur' : 'Auditeur(rice)';

  // Badge source SSO
  var srcBadge = document.getElementById('sso-badge');
  if (srcBadge) {
    srcBadge.textContent = '🔐 Microsoft';
    srcBadge.style.display = 'block';
  }

  // Nav listeners
  document.querySelectorAll('.nav[data-view]').forEach(function(n){
    n.addEventListener('click', function(){ nav(n.dataset.view); });
  });

  // Déconnexion
  var lbtn = document.getElementById('lbtn');
  if (lbtn) lbtn.onclick = function() { doLogout(); };

  // Appliquer paramètres org
  if (typeof settingsApplyOnLoad === 'function') {
    await settingsApplyOnLoad();
  }

  nav('dashboard');
}

// ── Déconnexion ──────────────────────────────────────────────
function doLogout() {
  CU = null;
  sessionStorage.removeItem('af_user');
  sessionStorage.removeItem('af_graph_token');
  window.location.href = '/.auth/logout?post_logout_redirect_uri=/';
}

// ── Navigation ───────────────────────────────────────────────
async function nav(view) {
  CV = view;
  document.querySelectorAll('.nav[data-view]').forEach(function(n){
    n.classList.remove('active');
  });
  var a = document.getElementById('nav-' + view);
  if (a) a.classList.add('active');
  var c = document.getElementById('vc');
  c.innerHTML = '<div class="loading"><div class="sp"></div>Chargement...</div>';

  // Si les données sont vides (premier chargement raté), recharger avant d'afficher
  if (typeof loadAllData === 'function'
      && typeof AUDIT_PLAN !== 'undefined'
      && AUDIT_PLAN.length === 0
      && typeof PROCESSES !== 'undefined'
      && PROCESSES.length === 0) {
    try { await loadAllData(); } catch(e) { console.warn('[nav] reload failed:', e); }
  }

  setTimeout(function() {
    try {
      c.innerHTML = V[view] ? V[view]() : '<div class="content">Vue introuvable.</div>';
      if (I[view]) I[view]();
    } catch(e) {
      c.innerHTML = '<div class="content" style="color:var(--red)">Erreur : ' + e.message + '</div>';
      console.error(e);
    }
  }, 50);
}

// ── Helpers globaux ──────────────────────────────────────────
function openModal(title, body, onOk, opts) {
  opts = opts || {};
  document.getElementById('mtitle').textContent = title;
  document.getElementById('mbody').innerHTML = body;
  // Toggle wide class
  var modalContainer = document.querySelector('#modal .md');
  if (modalContainer) {
    if (opts.wide) modalContainer.classList.add('md-wide');
    else modalContainer.classList.remove('md-wide');
  }
  document.getElementById('modal').classList.add('show');
  document.getElementById('mok').onclick = async function() {
    await onOk();
    closeModal();
  };
}
function closeModal() { document.getElementById('modal').classList.remove('show'); }
function toast(msg) {
  var e = document.getElementById('toast');
  e.textContent = msg;
  e.classList.add('show');
  setTimeout(function(){ e.classList.remove('show'); }, 2500);
}
function addHist(type, msg) {
  var entry = {
    type: type, msg: msg,
    user: CU ? CU.name : '—',
    date: new Date().toLocaleDateString('fr-FR', {day:'numeric',month:'short',year:'numeric'}),
  };
  HISTORY_LOG.unshift(entry);
  addHistoryDB(type, msg, CU ? CU.name : '—').catch(function(e){ console.warn('History error:', e); });
}

function badge(s) {
  var base = s.includes('|') ? s.split('|')[0] : s;
  return '<span class="badge ' + (BMAP[base]||'bpl') + '">' + base + '</span>';
}
function pbar(s) {
  var pct = 0;
  if (typeof s === 'number') pct = s;
  else if (s.includes('|')) { var parts = s.split('|'); pct = Math.min(100, (parseInt(parts[1])+1)*10); }
  else { pct = PRCT[s]||0; }
  return '<div class="pbar"><div class="pfill" style="width:' + pct + '%"></div></div>';
}
function avEl(id, sz) {
  var m = TM[id];
  if (!m) return '';
  return '<div class="avsm" style="' + (AVC[id]||'') + ';width:' + sz + 'px;height:' + sz + 'px;font-size:' + (sz*.4) + 'px">' + m.short + '</div>';
}
