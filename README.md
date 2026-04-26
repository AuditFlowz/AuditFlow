# AuditFlow — Bibliothèque de contrôles & extensions

Extension fonctionnelle pour [AuditFlow](../) ajoutant :
- Une bibliothèque de **133 contrôles** standards répartis sur **10 cycles** métier (P2P, OTC, RTR, Treasury, Payroll, HR, R&D, IT-Access, IT-Data, Fixed Assets)
- Une **table de mapping** entre les process de l'Audit Universe AuditFlow et les cycles standards
- Une **modale d'import** intégrée à l'étape "Tests d'audit" qui pré-filtre intelligemment selon le process audité
- Un cadre pour intégrer une **IA générative** (génération de findings, brouillons de rapport, suggestion de contrôles)
- Un patch de **sécurité** pour éliminer les mots de passe en clair et durcir l'application

## Structure du package

```
auditflow-extensions/
├── README.md                  ← ce fichier
├── CHANGELOG.md               ← journal des modifications
│
├── js/
│   ├── control-library.js     ← module principal (à inclure dans index.html)
│   └── ai-example.js          ← squelette d'intégration IA (cas d'usage commentés)
│
├── data/
│   └── auditflow_control_library.csv   ← 133 contrôles (20 colonnes)
│
├── scripts/
│   ├── patch_data.js                   ← patch à appliquer dans js/data.js
│   └── install.md                      ← guide d'installation pas-à-pas
│
└── docs/
    ├── SECURITY.md            ← patch sécurité (mots de passe, XSS, CSP)
    ├── MAPPING.md             ← documentation de la table de mapping
    ├── INTEGRATION.md         ← intégration dans views.js
    └── ROADMAP.md             ← évolutions futures (IA, refactor, mobile)
```

## Installation rapide

### 1. Cloner ou télécharger ce package dans ton repo AuditFlow

```bash
# Depuis la racine de ton repo AuditFlow
cp -r auditflow-extensions/js/* ./js/
cp auditflow-extensions/data/auditflow_control_library.csv ./
```

### 2. Référencer le module dans `index.html`

Ajouter dans `<head>` ou avant `</body>`, **après `graph.js` et avant `views.js`** :

```html
<script src="js/control-library.js"></script>
```

### 3. Appliquer le patch `data.js`

Suivre les instructions dans `scripts/patch_data.js` (remplacer les lignes 132-146 de `js/data.js`).

### 4. Créer la liste SharePoint et importer le CSV (admin, une seule fois)

Depuis la console du navigateur après connexion à AuditFlow :

```javascript
await setupControlLibraryList();
const csv = await fetch('/auditflow_control_library.csv').then(r => r.text());
await importControlLibraryFromCSV(csv);
```

### 5. Ajouter le bouton dans `views.js`

Voir `docs/INTEGRATION.md` pour le code exact à insérer dans la vue `audit-detail` étape 5.

## Comment ça marche

### Pour les auditeurs

1. L'auditeur ouvre un audit (ex: "OTC 2026")
2. À l'étape 5 "Tests d'audit", il clique **"Importer depuis la bibliothèque"**
3. Une modale s'ouvre, **pré-filtrée sur le process de l'audit** (ex: Order-to-Cash → 15 contrôles affichés)
4. Filtres avancés : pills colorées par cycle, recherche par mot-clé, contrôles clés uniquement
5. Multi-sélection puis import → les contrôles arrivent pré-remplis dans l'audit
6. Le bouton **"+ Nouveau contrôle"** (existant) reste disponible pour créer des contrôles manuels

### Pour les admins

- Modifier la **table de mapping** (`PROCESS_MAPPING` dans `control-library.js`) pour ajuster les correspondances
- Modifier le **CSV** dans Excel pour amender la bibliothèque, puis ré-importer
- Ajouter de nouveaux **process à l'Audit Universe** dans `data.js` et étendre le mapping

## Référentiels couverts

Les 133 contrôles sont mappés vers les principaux référentiels :
- COSO Internal Control Framework
- SOX (Sarbanes-Oxley)
- AFA / Sapin 2 (anti-corruption France)
- NIST SP 800-53 (cybersécurité)
- ISO 27001 / 27002 (sécurité de l'information)
- RGPD (données personnelles)
- ANSSI (sécurité infrastructure)
- IFRS (IAS 16, 21, 36, 38, IFRS 9, 10, 15)
- Code du Travail (RH France)
- CIR / BOFIP (Crédit Impôt Recherche)

## Compatibilité

- AuditFlow v1.x (build avec `app.js`, `data.js`, `graph.js`, `views.js`)
- Microsoft Graph API (SharePoint Lists)
- Azure Static Web Apps + Microsoft Entra ID

## Licence

Usage interne. Les contrôles sont rédigés à partir de référentiels publics (NIST, ISO,
COSO, AFA) et de bonnes pratiques d'audit. À ne pas redistribuer commercialement
sans révision juridique préalable.

## Auteur

Conçu pour le département Audit Interne — itération en collaboration avec Claude (Anthropic).
