// ============================================================
// AUDITFLOW — MODE DÉMO avec login ID/Mot de passe
// ============================================================

const DEMO_USERS = [
  { id:'pm', name:'Philippe M.', email:'pmassard@74Software.com', password:'audit2025', role:'admin',    initials:'PM', title:'Directeur Audit Interne' },
  { id:'sh', name:'Selma H.',    email:'shentabli@74Software.com',      password:'audit2025', role:'auditeur', initials:'SH', title:'Auditrice' },
  { id:'ne', name:'Nisrine E.',  email:'nechah@74Software.com',       password:'audit2025', role:'auditeur', initials:'NE', title:'Auditrice' },
];

const AV_CSS = {
  pm: 'background:#CECBF6;color:#3C3489',
  sh: 'background:#9FE1CB;color:#085041',
  ne: 'background:#B5D4F4;color:#0C447C',
};

let currentView = 'dashboard';

async function initApp() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';

  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('login-password').addEventListener('keydown', e => { if(e.key==='Enter') handleLogin(); });
  document.getElementById('login-email').addEventListener('keydown', e => { if(e.key==='Enter') handleLogin(); });

  // Pré-remplit avec Philippe pour la démo
  document.getElementById('login-email').value = 'philippe.massard@groupe.com';
  document.getElementById('login-password').value = 'audit2025';
}

function handleLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');

  const user = DEMO_USERS.find(u => u.email.toLowerCase() === email && u.password === password);

  if (!user) {
    errEl.textContent = 'Email ou mot de passe incorrect.';
    errEl.style.display = 'block';
    document.getElementById('login-password').value = '';
    return;
  }

  errEl.style.display = 'none';
  STATE.user = { ...user };
  launchApp(user);
}

function launchApp(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  if (user.role === 'admin') document.getElementById('app').classList.add('is-admin');

  // Sidebar user chip
  const avEl = document.getElementById('user-av');
  avEl.textContent = user.initials;
  avEl.style.cssText = `${AV_CSS[user.id]};width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600`;
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-role').textContent = user.title;

  // Bandeau démo discret
  const banner = document.createElement('div');
  banner.id = 'demo-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#534AB7;color:#fff;text-align:center;font-size:11px;padding:5px;z-index:9999;font-family:sans-serif;letter-spacing:.02em';
  banner.innerHTML = '◆ Mode démo &nbsp;·&nbsp; AuditFlow v1.0 &nbsp;·&nbsp; Connecté en tant que ' + user.name;
  document.body.appendChild(banner);
  document.getElementById('app').style.paddingTop = '27px';

  // Déconnexion
  document.getElementById('logout-btn').onclick = () => {
    document.getElementById('app').classList.remove('is-admin');
    document.getElementById('app').style.display = 'none';
    document.getElementById('app').style.paddingTop = '0';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    const b = document.getElementById('demo-banner');
    if (b) b.remove();
    STATE.user = null;
  };

  // Navigation sidebar
  document.querySelectorAll('.nav[data-view]').forEach(nav => {
    nav.addEventListener('click', () => navigate(nav.dataset.view));
  });

  navigate('dashboard');
}

function navigate(view) {
  currentView = view;
  document.querySelectorAll('.nav[data-view]').forEach(n => n.classList.remove('active'));
  const activeNav = document.getElementById(`nav-${view}`);
  if (activeNav) activeNav.classList.add('active');
  const container = document.getElementById('view-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div>Chargement...</div>';
  setTimeout(() => {
    try {
      const html = VIEWS[view] ? VIEWS[view]() : `<div class="content"><p>Vue introuvable.</p></div>`;
      container.innerHTML = html;
      if (VIEWS_INIT[view]) VIEWS_INIT[view]();
    } catch(e) {
      container.innerHTML = `<div class="content"><p style="color:#A32D2D">Erreur : ${e.message}</p></div>`;
      console.error(e);
    }
  }, 50);
}

function openModal(title, bodyHTML, onConfirm) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-confirm').onclick = () => { onConfirm(); closeModal(); };
  document.getElementById('modal-cancel').onclick = closeModal;
  document.getElementById('modal-close').onclick = closeModal;
}

function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function addHistory(type, msg) {
  STATE.history.unshift({ type, msg, user: STATE.user?.name || 'Philippe M.', date: new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }) });
}

function getAuditTasks(audit) {
  if (!STATE.tasks[audit.id]) STATE.tasks[audit.id] = defaultTasks(audit.id, audit.assignedTo || ['sh']);
  return STATE.tasks[audit.id];
}

window.addEventListener('DOMContentLoaded', initApp);
