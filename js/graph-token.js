// ═══════════════════════════════════════════════════════════
//  graph-token.js — Token Microsoft Graph via MSAL
//  MSAL est chargé directement depuis index.html
// ═══════════════════════════════════════════════════════════

var _msalApp = null;
var _graphToken = null;

async function initMSAL() {
  if (_msalApp) return _msalApp;

  _msalApp = new window.msal.PublicClientApplication({
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

  // Gérer le retour de redirection MSAL si présent
  try {
    await _msalApp.handleRedirectPromise();
  } catch(e) {
    console.warn('[MSAL] handleRedirectPromise:', e.message);
  }

  return _msalApp;
}

async function getGraphToken() {
  if (_graphToken && _graphToken.exp > Date.now() + 60000) {
    return _graphToken.token;
  }

  try {
    var msalApp = await initMSAL();
    var accounts = msalApp.getAllAccounts();
    var account = accounts[0];

    if (!account) {
      // Essayer SSO silencieux avec le hint de /.auth/me
      try {
        var res = await fetch('/.auth/me');
        var data = await res.json();
        var email = data && data.clientPrincipal && data.clientPrincipal.userDetails;
        if (email) {
          var loginResp = await msalApp.ssoSilent({
            loginHint: email,
            scopes: ['Sites.ReadWrite.All', 'Files.ReadWrite', 'User.Read'],
          });
          account = loginResp.account;
        }
      } catch(e) {
        console.warn('[MSAL] SSO silent failed:', e.message);
        return null;
      }
    }

    if (!account) return null;

    var tokenResp = await msalApp.acquireTokenSilent({
      account: account,
      scopes: ['Sites.ReadWrite.All', 'Files.ReadWrite', 'User.Read'],
    });

    _graphToken = {
      token: tokenResp.accessToken,
      exp: tokenResp.expiresOn ? tokenResp.expiresOn.getTime() : Date.now() + 3500000,
    };

    console.log('[MSAL] Token Graph acquis ✓');
    return _graphToken.token;

  } catch(e) {
    console.warn('[MSAL] getGraphToken error:', e.message);
    return null;
  }
}
