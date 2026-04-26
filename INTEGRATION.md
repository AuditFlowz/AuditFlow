# Intégration dans `views.js` — Bouton d'import bibliothèque

## Objectif

Ajouter un bouton **"Importer depuis la bibliothèque"** à côté du bouton
**"+ Nouveau contrôle"** existant dans l'étape 5 "Tests d'audit" de la vue
`audit-detail`.

## Localisation

Dans `js/views.js`, chercher la section qui rend l'étape 5 (`controls[4]`).
La signature de la fonction se situe autour de la ligne 3113 :

```javascript
V['audit-detail'] = () => {
  // ...
  // Quelque part : rendu de l'étape 5 / Tests d'audit
};
```

Repérer le bouton existant qui ouvre la modale "Nouveau contrôle". Il ressemble
typiquement à :

```javascript
'<button onclick="openNewControlModal(\''+CA+'\')">+ Nouveau contrôle</button>'
```

(le nom exact de la fonction peut varier — `openControlModal`, `addControl`, etc.)

## Code à insérer

**Juste avant** ce bouton existant (pour qu'il soit en premier dans la rangée
d'actions) :

```javascript
'<button onclick="openControlLibraryPicker(\''+CA+'\')" '+
  'style="margin-right:8px;background:#E1F5EE;color:#085041;border:0.5px solid #5DCAA5;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px">'+
  'Importer depuis la bibliothèque'+
'</button>'+
```

Note : `CA` est la variable qui contient l'ID de l'audit courant dans le scope de la
vue `audit-detail`. Si la variable porte un autre nom dans ta version (`auditId`,
`window.CA`, etc.), adapter en conséquence.

## Style

Le style inline ci-dessus utilise les couleurs **teal** de la palette pour bien
distinguer ce bouton "import" du bouton "+ Nouveau" qui reste dans le style
existant. Tu peux aussi le styler via une classe CSS dans `app.css` :

```css
.btn-import-lib {
  background: #E1F5EE;
  color: #085041;
  border: 0.5px solid #5DCAA5;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  margin-right: 8px;
}
.btn-import-lib:hover {
  background: #C5E8DA;
}
```

Et utiliser :

```javascript
'<button class="btn-import-lib" onclick="openControlLibraryPicker(\''+CA+'\')">'+
  'Importer depuis la bibliothèque'+
'</button>'
```

## Préchargement de la bibliothèque

Pour que la modale s'ouvre instantanément la première fois, ajouter dans `app.js`
après l'initialisation Graph :

```javascript
// Précharger la bibliothèque en arrière-plan (non bloquant)
if (typeof loadControlLibrary === 'function') {
  loadControlLibrary().catch(e => console.warn('[CTRL_LIB] préchargement:', e.message));
}
```

Sans ce préchargement, la modale s'ouvre au premier clic mais avec un petit délai
(le temps que Graph récupère les 133 contrôles depuis SharePoint, environ 1 seconde).

## Affichage du tag "Bibliothèque" sur les contrôles importés

Dans la zone qui rend la liste des contrôles de l'étape 5 (`d.controls[4].forEach(...)`),
ajouter un tag visuel pour les contrôles venant de la bibliothèque. Repérer le
rendu d'une ligne de contrôle, et ajouter à côté du titre :

```javascript
(c.addedFromLib ? '<span style="background:#E1F5EE;color:#085041;padding:1px 7px;border-radius:10px;font-size:10px;margin-left:6px">Bibliothèque</span>' : '')
```

Si tu veux aussi marquer les contrôles manuels :

```javascript
(c.addedFromLib
  ? '<span style="background:#E1F5EE;color:#085041;padding:1px 7px;border-radius:10px;font-size:10px;margin-left:6px">Bibliothèque</span>'
  : '<span style="background:#FBEAF0;color:#72243E;padding:1px 7px;border-radius:10px;font-size:10px;margin-left:6px">Manuel</span>'
)
```

## Vérification du résultat

Après modification :

1. Recharger AuditFlow
2. Ouvrir un audit (idéalement sur OTC, p11)
3. Aller à l'étape 5 "Tests d'audit"
4. Vérifier la présence des 2 boutons côte à côte
5. Cliquer "Importer depuis la bibliothèque" → modale s'ouvre avec bandeau vert
6. Sélectionner 2-3 contrôles, importer → ils apparaissent dans la liste avec le tag "Bibliothèque"
7. Cliquer "+ Nouveau contrôle" → modale habituelle, créer un contrôle manuel → il apparaît avec le tag "Manuel" (si tu as ajouté ce tag)

## Comportement en cas d'erreur

Si Graph n'est pas initialisé ou si la liste SharePoint n'a pas encore été créée :
- `loadControlLibrary()` met `CTRL_LIB.data = []` et logge un warning
- La modale s'ouvre quand même mais affiche "Aucun contrôle"
- Le bouton "Annuler" referme la modale sans casser quoi que ce soit

## Que faire si tu utilises un framework de modale différent ?

Le code de `openControlLibraryPicker` crée une modale en injectant directement
dans le DOM avec la classe CSS `modal-backdrop`. Si AuditFlow utilise une autre
mécanique (Bootstrap, framework custom), adapter la fonction dans
`control-library.js` pour utiliser ta mécanique de modale.

L'API publique reste la même : appeler `openControlLibraryPicker(auditId)`.

Le markup interne de la modale (filtres, liste, footer) est encapsulé et peut
rester tel quel — c'est juste l'enveloppe (`<div class="modal-backdrop">`)
qui peut nécessiter une adaptation.
