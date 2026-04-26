# AuditFlow — Patch sécurité

Ce document liste les modifications à appliquer pour éliminer les risques de
sécurité identifiés. Chaque section précise le fichier, la ligne, et le
remplacement à effectuer.

---

## 1. Supprimer tous les mots de passe en clair

### `js/data.js` (lignes 108-114)

**AVANT :**
```javascript
var USERS=[
  {id:'pm',name:'Philippe M.',email:'pmassard@74software.com',role:'admin',status:'actif',pwd:'Audit1234!',organization_id:'...'},
  {id:'sh',name:'Selma H.',email:'shentabli@74software.com',role:'auditeur',status:'actif',pwd:'Audit1234!',organization_id:'...'},
  {id:'ne',name:'Nisrine E.',email:'nechah@74software.com',role:'auditeur',status:'actif',pwd:'Audit1234!',organization_id:'...'},
  {id:'superadmin',name:'Super Admin',email:'pmassard.fr@gmail.com',role:'superadmin',status:'actif',pwd:'Audit1234!',organization_id:'...'},
];
```

**APRÈS :**
```javascript
// L'auth passe par Microsoft Entra ID (Azure SWA /.auth/me).
// Aucun mot de passe stocké côté application.
var USERS=[
  {id:'pm',name:'Philippe M.',email:'pmassard@74software.com',role:'admin',status:'actif',organization_id:'...'},
  {id:'sh',name:'Selma H.',email:'shentabli@74software.com',role:'auditeur',status:'actif',organization_id:'...'},
  {id:'ne',name:'Nisrine E.',email:'nechah@74software.com',role:'auditeur',status:'actif',organization_id:'...'},
  {id:'superadmin',name:'Super Admin',email:'pmassard.fr@gmail.com',role:'superadmin',status:'actif',organization_id:'...'},
];
```

### `config.js` (ligne 10)

**Supprimer entièrement :**
```javascript
demoPassword: 'Audit1234!',
```

### `js/graph.js`

- ligne 256 : retirer `{name:'pwd',text:{}}` de la définition du schéma SharePoint
- lignes 360, 559, 635, 643 : retirer toute référence à `pwd` dans les mappings

### `LIRE_MOI.md`

- Supprimer la colonne `pwd text` du SQL Supabase
- Supprimer la section "Connexion par défaut" qui expose `Audit1234!`
- Remplacer par une note disant que l'auth est gérée par Microsoft Entra ID

---

## 2. Nettoyer les secrets de tenant Microsoft

`config.js` contient le `tenantId` et `clientId` Axway. Ce ne sont pas des
secrets cryptographiques, mais ils identifient l'organisation et empêchent
de réutiliser le code pour un autre client. À externaliser en variables
d'environnement Azure SWA :

```javascript
// config.js
const AUDITFLOW_CONFIG = {
  clientId:    window.__AF_CLIENT_ID__    || '',
  tenantId:    window.__AF_TENANT_ID__    || '',
  siteUrl:     window.__AF_SITE_URL__     || '',
  appUrl:      window.location.origin,
};
```

Et dans Azure SWA, configurer les variables au build via
`staticwebapp.config.json` ou un script d'injection.

---

## 3. Sanitiser les innerHTML pour bloquer le XSS

Le code utilise massivement `innerHTML` avec interpolation directe de données
utilisateur (titres d'audit, noms de findings, descriptions, etc.). Exemple
typique dans `views.js` :

```javascript
'<td style="font-weight:500;font-size:11px">'+ap.titre+'</td>'
```

Si un utilisateur saisit un titre `<img src=x onerror="alert(document.cookie)">`,
le code s'exécute. À tester chez toi.

**Ajouter un helper d'échappement** au début de `app.js` :

```javascript
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

Et l'utiliser systématiquement pour toute donnée venant de la base ou de
l'utilisateur :

```javascript
'<td>'+esc(ap.titre)+'</td>'
```

Tu as déjà `_escQ` dans views.js (ligne 4712) mais elle n'échappe que les
apostrophes — c'est insuffisant.

---

## 4. Renforcer la Content Security Policy (CSP)

Dans `staticwebapp.config.json`, la section `globalHeaders` n'a pas de CSP.
Ajouter :

```json
"globalHeaders": {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://login.microsoftonline.com; connect-src 'self' https://graph.microsoft.com https://login.microsoftonline.com https://*.sharepoint.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-ancestors 'none';"
}
```

Note : `'unsafe-inline'` reste nécessaire tant que le code utilise des
`onclick="..."` inline. Pour aller plus loin, migrer vers des
`addEventListener` (gros chantier).

---

## 5. Row Level Security (RLS) côté Supabase

Le LIRE_MOI.md dit "Rendez le bucket public (ou configurez les politiques RLS)".
**Ne JAMAIS rendre le bucket public** : tes papiers de travail seraient
indexables. Configurer RLS dès le départ :

```sql
-- Activer RLS sur toutes les tables
alter table af_users      enable row level security;
alter table af_audit_plan enable row level security;
alter table af_audit_data enable row level security;
alter table af_processes  enable row level security;
alter table af_actions    enable row level security;
alter table af_history    enable row level security;

-- Exemple de policy : un utilisateur voit uniquement les données de son organisation
create policy "org_isolation" on af_audit_plan
  for all using (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );
```

Pour le bucket Storage `auditflow-docs`, créer une policy qui n'autorise
l'accès qu'aux fichiers du bon `organization_id` (préfixer les chemins).

---

## 6. Audit logging des actions sensibles

Tu as déjà `addHist()` qui logge dans `af_history`. Étendre pour logger
systématiquement :
- les changements de rôle (`changeRole` dans views.js)
- les suppressions (audits, findings, contrôles)
- les exports PDF (qui exporte quoi quand)
- les accès aux documents sensibles

Ces logs deviennent eux-mêmes la preuve d'audit demandée par les
commissaires aux comptes.

---

## 7. Rotation du token Graph

Dans `graph.js`, le token est stocké dans `sessionStorage`. C'est correct
(scope tab, pas de persistance disque), mais :
- ajouter un timer de refresh à 50 min (le token Microsoft expire à 60 min)
- en cas d'erreur 401, invalider et redemander automatiquement
- ne JAMAIS stocker le token dans `localStorage`

---

## Checklist de mise en œuvre

- [ ] Retirer tous les `pwd` du code et des schémas (data.js, graph.js, config.js, LIRE_MOI.md)
- [ ] Forcer la rotation du mot de passe `Audit1234!` partout où il a pu être réutilisé
- [ ] Externaliser clientId/tenantId en variables d'environnement
- [ ] Ajouter le helper `esc()` et l'appliquer aux interpolations user-data
- [ ] Ajouter la CSP dans staticwebapp.config.json
- [ ] Activer RLS Supabase si la version Supabase est utilisée
- [ ] Ne jamais rendre le bucket Storage public
- [ ] Étendre l'audit logging
- [ ] Auditer une fois la sécurité refondue (test XSS manuel sur les champs libres)
