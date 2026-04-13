async function initLogin(){
  var saved = sessionStorage.getItem('af_user');
  if(saved){
    try {
      CU = JSON.parse(saved);
      await loadAllData();
      launchApp();
      return;
    } catch(e) {
      sessionStorage.removeItem('af_user');
    }
  }
  document.getElementById('ls').style.display='flex';
  document.getElementById('app').style.display='none';
  document.getElementById('li-btn').onclick=doLogin;
  document.getElementById('li-pw').onkeydown=function(e){if(e.key==='Enter')doLogin();};
  document.getElementById('li-em').onkeydown=function(e){if(e.key==='Enter')document.getElementById('li-pw').focus();};
  document.getElementById('li-pw').oninput=validatePwd;
  document.getElementById('li-pw').onfocus=function(){document.getElementById('pw-rules').style.display='block';};
}

function togglePwd(){
  var inp=document.getElementById('li-pw');
  inp.type=inp.type==='password'?'text':'password';
}

function validatePwd(){
  var v=document.getElementById('li-pw').value;
  var rLen=v.length>=8;
  var rMaj=/[A-Z]/.test(v);
  var rSpec=/[^a-zA-Z0-9]/.test(v);
  var set=function(id,ok){var el=document.getElementById(id);el.style.color=ok?'var(--green)':'var(--text-3)';el.textContent=(ok?'✓ ':'✗ ')+el.textContent.slice(2);};
  set('r-len',rLen); set('r-maj',rMaj); set('r-spec',rSpec);
}

async function doLogin(){
  var email=document.getElementById('li-em').value.trim().toLowerCase();
  var pwd=document.getElementById('li-pw').value;
  var errEl=document.getElementById('li-err');
  if(pwd.length<8||!/[A-Z]/.test(pwd)||!/[^a-zA-Z0-9]/.test(pwd)){
    errEl.textContent='Le mot de passe doit contenir 8 caractères min., 1 majuscule et 1 caractère spécial.';
    errEl.style.display='block';
    return;
  }
  var user = USERS.find(function(u){
    return u.email.toLowerCase()===email &&
           (u.pwd===pwd || pwd===AUDITFLOW_CONFIG.demoPassword) &&
           u.status==='actif';
  });
  if(!user){
    errEl.textContent='Email ou mot de passe incorrect.';
    errEl.style.display='block';
    document.getElementById('li-pw').value='';
    return;
  }
  errEl.style.display='none';
  CU={id:user.id, name:user.name, email:user.email, role:user.role,
      initials:user.initials||'?', status:'actif', organization_id:user.organization_id};
  sessionStorage.setItem('af_user', JSON.stringify(CU));
  await launchApp();
}

async function launchApp(){
  if(!AUDIT_PLAN || AUDIT_PLAN.length===0){
    try { await loadAllData(); } catch(e){ console.warn('Data load failed:', e); }
  }
  document.getElementById('ls').style.display='none';
  document.getElementById('app').style.display='flex';

  // Support rôle superadmin
  var app = document.getElementById('app');
  app.classList.remove('is-admin','is-superadmin');
  if(CU.role==='admin')      app.classList.add('is-admin');
  if(CU.role==='superadmin') app.classList.add('is-admin','is-superadmin');

  const tid=Object.keys(TM).find(k=>TM[k].name===CU.name)||'pm';
  document.getElementById('uav').textContent=CU.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  if(AVC[tid])document.getElementById('uav').style.cssText=AVC[tid]+';width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600';
  document.getElementById('uname').textContent=CU.name;
  document.getElementById('urole').textContent=
    CU.role==='superadmin' ? 'Super Admin' :
    CU.role==='admin'      ? 'Admin / Directeur' : 'Auditrice';

  // Afficher/masquer section Super Admin dans sidebar
  var saSection = document.getElementById('nav-superadmin-section');
  if(saSection) saSection.style.display = CU.role==='superadmin' ? '' : 'none';

  document.getElementById('lbtn').onclick=function(){
    app.classList.remove('is-admin','is-superadmin');
    CU=null;
    sessionStorage.removeItem('af_user');
    document.getElementById('li-em').value='';
    document.getElementById('li-pw').value='';
    document.getElementById('li-err').style.display='none';
    initLogin();
  };
  document.querySelectorAll('.nav[data-view]').forEach(n=>n.addEventListener('click',()=>nav(n.dataset.view)));

  // Superadmin → dashboard direct, pas de wizard
  if(CU.role==='superadmin'){
    nav('dashboard');
    return;
  }

  // Appliquer les paramètres org (logo, couleur)
  if(typeof settingsApplyOnLoad === 'function'){
    await settingsApplyOnLoad();
  }

  // Vérifier si le wizard doit s'afficher
  var configured = await checkIfOrgIsConfigured(CU.organization_id);
  if(!configured){
    initWizard();
  } else {
    nav('dashboard');
  }
}

function nav(view){
  CV=view;
  document.querySelectorAll('.nav[data-view]').forEach(n=>n.classList.remove('active'));
  const a=document.getElementById('nav-'+view);if(a)a.classList.add('active');
  const c=document.getElementById('vc');
  c.innerHTML='<div class="loading"><div class="sp"></div>Chargement...</div>';
  setTimeout(()=>{try{c.innerHTML=V[view]?V[view]():'<div class="content">Vue introuvable.</div>';if(I[view])I[view]();}catch(e){c.innerHTML=`<div class="content" style="color:var(--red)">Erreur : ${e.message}</div>`;console.error(e);}},50);
}

function openModal(title,body,onOk){
  document.getElementById('mtitle').textContent=title;
  document.getElementById('mbody').innerHTML=body;
  document.getElementById('modal').classList.add('show');
  document.getElementById('mok').onclick=async function(){
    await onOk();
    closeModal();
  };
}
function closeModal(){document.getElementById('modal').classList.remove('show');}
function toast(msg){const e=document.getElementById('toast');e.textContent=msg;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500);}
function addHist(type,msg){
  var entry={type:type,msg:msg,user:CU?CU.name:'—',date:new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})};
  HISTORY_LOG.unshift(entry);
  addHistoryDB(type,msg,CU?CU.name:'—').catch(function(e){console.warn('History save failed:',e);});
}

function badge(s){
  var base = s.includes('|') ? s.split('|')[0] : s;
  return `<span class="badge ${BMAP[base]||'bpl'}">${base}</span>`;
}
function pbar(s){
  var pct = 0;
  if(typeof s === 'number') pct = s;
  else if(s.includes('|')){
    var parts = s.split('|');
    var idx = parseInt(parts[1]);
    pct = Math.min(100, (idx + 1) * 10);
  } else {
    pct = PRCT[s]||0;
  }
  return `<div class="pbar"><div class="pfill" style="width:${pct}%"></div></div>`;
}
function avEl(id,sz){const m=TM[id];if(!m)return'';return `<div class="avsm" style="${AVC[id]||''};width:${sz}px;height:${sz}px;font-size:${sz*.4}px">${m.short}</div>`}

window.addEventListener('DOMContentLoaded',initLogin);

// Vérification wizard
async function checkIfOrgIsConfigured(organization_id){
  if(!organization_id){ return true; }
  try {
    var res = await getSB()
      .from('af_org_config')
      .select('is_configured')
      .eq('organization_id', organization_id)
      .maybeSingle();
    if(res.error){ console.warn('[Wizard]', res.error.message); return true; }
    return res.data !== null && res.data.is_configured === true;
  } catch(e){ return true; }
}
