# Guide d'installation — AuditFlow Extensions

Suivre les étapes dans l'ordre. Compter ~30 minutes en tout (dont 3 minutes pour
l'import du CSV vers SharePoint).

## Prérequis

- AuditFlow déployé et fonctionnel
- Compte admin sur le site SharePoint Axway (`AuditInterne27`)
- Accès en écriture au repo Git du projet
- Les variables `AUDITFLOW_CONFIG.siteId` et `AUDITFLOW_CONFIG.driveId` doivent être
  remplies au moins une fois (cela se fait automatiquement à la première connexion)

## Étape 1 — Copier les fichiers du package

Depuis la racine de ton clone du repo AuditFlow :

```bash
cp auditflow-extensions/js/control-library.js   js/
cp auditflow-extensions/data/auditflow_control_library.csv   .
```

(le CSV à la racine est temporaire — il sera importé puis pourra être supprimé)

## Étape 2 — Modifier `index.html`

Localiser la zone d'inclusion des scripts dans `index.html`. Ajouter **après**
`<script src="js/graph.js"></script>` et **avant** `<script src="js/views.js"></script>` :

```html
<script src="js/control-library.js"></script>
```

L'ordre est important : `control-library.js` utilise `graphFetch` défini dans
`graph.js` et expose des fonctions (`openControlLibraryPicker`) appelées depuis
`views.js`.

## Étape 3 — Appliquer le patch sur `data.js`

Ouvrir `js/data.js`, repérer la définition de `let PROCESSES = [...]` (lignes 132-146).
Remplacer toute cette définition par le contenu de `scripts/patch_data.js` (entre les
balises de section).

Cela ajoute 4 nouveaux process à l'Audit Universe :
- `p16` Finance - Accounting and Tax
- `p17` Purchasing and Third Party Management
- `p18` HR - Talent Acquisition
- `p19` HR - Payroll

Les niveaux de risque (`risk` et `riskLevel`) suggérés peuvent être ajustés selon
votre cartographie. Les entrées `y26/y27/y28` sont vides — à compléter selon votre
plan pluriannuel.

## Étape 4 — Modifier `views.js` pour ajouter le bouton d'import

Voir `docs/INTEGRATION.md` pour le code exact à insérer dans la vue `audit-detail`
étape 5 "Tests d'audit".

En résumé : trouver le bouton "+ Nouveau contrôle" existant et ajouter à côté :

```javascript
'<button class="btn-secondary" onclick="openControlLibraryPicker(\''+CA+'\')">'+
  'Importer depuis la bibliothèque'+
'</button>'
```

## Étape 5 — Commit et déployer

```bash
git add js/control-library.js js/data.js js/views.js index.html
git commit -m "feat: bibliothèque de contrôles + table de mapping process"
git push
```

Attendre le déploiement Azure Static Web Apps (~2 min).

## Étape 6 — Créer la liste SharePoint et importer le CSV

⚠️ **À faire une seule fois par un admin**. Cette opération crée la liste
SharePoint `AF_ControlLibrary` et y pousse les 133 contrôles. Compter ~3 minutes.

1. Ouvrir AuditFlow et se connecter
2. Ouvrir la console du navigateur (F12)
3. Vérifier que Graph est initialisé :

```javascript
console.log(AUDITFLOW_CONFIG.siteId);
// doit afficher un GUID — si null, naviguer dans l'app pour déclencher l'init
```

4. Créer la liste :

```javascript
await setupControlLibraryList();
// → "[CTRL_LIB] Liste créée: <id>"
```

5. Importer le CSV :

```javascript
const csv = await fetch('/auditflow_control_library.csv').then(r => r.text());
await importControlLibraryFromCSV(csv);
// → suivre la progression dans la console (10/133, 20/133, ...)
// → "[CTRL_LIB] Import terminé: 133 OK, 0 erreurs"
```

6. Vérifier :

```javascript
await loadControlLibrary(true);
console.log(`${CTRL_LIB.data.length} contrôles chargés`);
// → "133 contrôles chargés"
```

## Étape 7 — Tester end-to-end

1. Naviguer vers un audit existant sur OTC (process `p11`) ou Cybersecurity (`p13`)
2. Aller à l'étape 5 "Tests d'audit"
3. Cliquer "Importer depuis la bibliothèque"
4. La modale doit s'ouvrir avec un bandeau vert "Process audit OTC → 1 cycle biblio applicable : Order-to-Cash"
5. Cocher 2-3 contrôles, cliquer "Importer la sélection"
6. Vérifier que les contrôles apparaissent dans l'audit avec le tag "Bibliothèque"
7. Tester un audit sur Product Development (`p5`) → bandeau orange "Aucune correspondance bibliothèque" et tous les process disponibles

## Étape 8 — Nettoyer

```bash
# Le CSV à la racine n'est plus nécessaire après import
rm auditflow_control_library.csv
git add -A
git commit -m "chore: clean CSV after import"
git push
```

## Rollback en cas de problème

### Désactiver l'import sans tout casser

Commenter la ligne dans `index.html` :

```html
<!-- <script src="js/control-library.js"></script> -->
```

Le bouton "Importer depuis la bibliothèque" affichera une erreur dans la console
mais ne cassera pas l'app. Les contrôles déjà importés dans des audits restent
intacts (ils sont stockés dans `AUD_DATA.controls[4]`, indépendamment de la lib).

### Supprimer la liste SharePoint

Depuis SharePoint → site AuditInterne27 → Contenu du site → AF_ControlLibrary →
Paramètres → Supprimer cette liste.

### Annuler le patch `data.js`

Restaurer la version Git précédente :

```bash
git checkout HEAD~1 -- js/data.js
```

⚠️ **Attention** : si des audits ont déjà été créés sur les nouveaux process (`p16`-`p19`),
le rollback du `data.js` les rendra invisibles (le `processId` ne matchera plus).
Vérifier avant rollback :

```javascript
AUDIT_PLAN.filter(a => ['p16','p17','p18','p19'].includes(a.processId))
```

## FAQ

**Q : Puis-je modifier les contrôles de la bibliothèque après import ?**
R : Oui. Soit directement dans SharePoint (interface web AF_ControlLibrary), soit en
ré-éditant le CSV et en relançant l'import (qui fait des INSERT, pas des UPDATE —
il faut donc vider la liste SP avant, ou implémenter un upsert).

**Q : Et si je veux ajouter de nouveaux contrôles à la bibliothèque ?**
R : Trois options :
1. Ajouter des lignes au CSV et ré-importer (après avoir vidé la liste SP)
2. Ajouter directement dans l'interface web SharePoint (formulaire de création)
3. Implémenter un bouton admin dans AuditFlow (à coder, ~50 lignes)

**Q : Le mapping process est-il modifiable ?**
R : Oui, c'est juste un objet JS dans `control-library.js` (constante `PROCESS_MAPPING`).
Modifier puis recommiter. À terme, à externaliser dans une liste SP pour le rendre
modifiable depuis l'interface.

**Q : Combien de temps pour qu'un nouvel auditeur soit autonome ?**
R : Quelques minutes. La modale est self-explanatory et le tag "Bibliothèque" sur
les contrôles importés est explicite. Une démo de 5 minutes en équipe suffit.
