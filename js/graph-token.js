// ═══════════════════════════════════════════════════════════
//  graph-token.js — Obtenir le token Graph via MSAL
//  Charge MSAL silencieusement et acquiert un token
//  pour Microsoft Graph API
// ═══════════════════════════════════════════════════════════

var _msalApp = null;
var _graphToken = null;

async function initMSAL() {
  if (_msalApp) return _msalApp;

  // Charger MSAL depuis CDN si pas déjà chargé
  if (!window.msal) {
    await new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  _msalApp = new msal.PublicClientApplication({
    auth: {
      clientId: AUDITFLOW_CONFIG.clientId,
      authority: 'https://login.microsoftonline.com/' + AUDITFLOW_CONFIG.tenantId,
      redirectUri: AUDITFLOW_CONFIG.appUrl + '/',
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false,
    }
  });

  await _msalApp.initialize();
  return _msalApp;
}

async function getGraphToken() {
  // Retourner le token en cache si encore valide
  if (_graphToken && _graphToken.exp > Date.now() + 60000) {
    return _graphToken.token;
  }

  try {
    var msalApp = await initMSAL();

    // Récupérer le compte connecté via SSO Azure SWA
    var accounts = msalApp.getAllAccounts();
    var account = accounts[0];

    if (!account) {
      // Essayer de récupérer depuis /.auth/me
      var res = await fetch('/.auth/me');
      var data = await res.json();
      var cp = data && data.clientPrincipal;
      if (!cp) {
        console.warn('[MSAL] No account found');
        return null;
      }
      // Forcer un login silencieux avec le hint email
      try {
        var loginResp = await msalApp.ssoSilent({
          loginHint: cp.userDetails,
          scopes: ['Sites.ReadWrite.All', 'Files.ReadWrite', 'User.Read']
        });
        account = loginResp.account;
      } catch(e) {
        console.warn('[MSAL] SSO silent failed:', e.message);
        return null;
      }
    }

    // Acquérir le token silencieusement
    var tokenResp = await msalApp.acquireTokenSilent({
      account: account,
      scopes: ['Sites.ReadWrite.All', 'Files.ReadWrite', 'User.Read'],
    });

    _graphToken = {
      token: tokenResp.accessToken,
      exp: tokenResp.expiresOn ? tokenResp.expiresOn.getTime() : Date.now() + 3500000
    };

    console.log('[MSAL] Token acquired ✓');
    return _graphToken.token;

  } catch(e) {
    console.warn('[MSAL] Token error:', e.message);
    return null;
  }
}
