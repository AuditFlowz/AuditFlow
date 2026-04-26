# Table de mapping — Audit Universe ↔ Bibliothèque de contrôles

## Pourquoi un mapping ?

L'**Audit Universe AuditFlow** est organisé selon votre structure organisationnelle
(par fonction : Finance / HR / IT / Distribution / etc.).

La **bibliothèque de contrôles** est organisée selon les **cycles métier standards**
issus des référentiels professionnels (P2P, OTC, RTR, etc.).

Une table de mapping fait le pont entre les deux mondes, ce qui permet :
- de garder vos noms internes dans l'audit (ce qui colle à votre organisation réelle)
- de garder les noms standards dans la bibliothèque (ce qui colle aux référentiels et facilite les mises à jour futures)
- de gérer le cas où un process audit couvre plusieurs cycles (ex : Finance - Accounting and Tax → RTR + Fixed Assets + R&D)

## Mapping en vigueur

Défini dans `js/control-library.js`, constante `PROCESS_MAPPING` :

| Process audit (id, nom) | Cycles bibliothèque mappés | Nb contrôles |
|---|---|---|
| `p11` OTC | Order-to-Cash | 15 |
| `p12` Treasury & Tax | Treasury | 13 |
| `p13` Cybersecurity & Data | IT - Access Management, IT - Data | 28 |
| `p16` Finance - Accounting and Tax | Record-to-Report, Fixed Assets, R&D | 37 |
| `p17` Purchasing and Third Party Management | Procure-to-Pay | 15 |
| `p18` HR - Talent Acquisition | Human Resources | 12 |
| `p19` HR - Payroll | Payroll | 13 |

**Total : 7 process audit avec mapping, 133 contrôles disponibles.**

## Process sans mapping

Les process suivants n'ont pas de correspondance dans la bibliothèque parce qu'ils
sont **spécifiques à votre industrie SaaS** ou à votre organisation, et que les
référentiels publics ne les couvrent pas. Les auditeurs créent leurs contrôles
manuellement pour ces process.

| Process audit | Raison |
|---|---|
| `p1` Acquisitions | M&A — spécifique opération par opération |
| `p2` Compliance | Périmètre dépend du contexte |
| `p3` Products & Portfolio | Spécifique software |
| `p5` Product Development | Spécifique software / agile |
| `p6` Product Deployment | Spécifique software / SaaS |
| `p7` Product Quality & Support | Spécifique software |
| `p8` Go-to-Market | Spécifique software / GTM |
| `p9` Sales & Services | Spécifique modèle commercial |
| `p10` Customer Experience | Spécifique CSM SaaS |
| `p15` Budget / Forecast | FP&A spécifique |

## Comportement en l'absence de mapping

Si un audit est ouvert sur un process **sans mapping** (ex : Product Development,
`p5`), la modale d'import :
1. Affiche un bandeau orange : *"Aucune correspondance bibliothèque pour le process X"*
2. Affiche **toutes les pills de cycle décochées** par défaut (rien de pré-sélectionné)
3. Permet quand même à l'auditeur de cocher des cycles s'il veut piocher quelques
   contrôles génériques (ex: pour un audit Product Deployment, il peut quand même
   importer 2-3 contrôles d'IT - Access Management qui s'appliquent au déploiement)

Pour ces process, les auditeurs s'appuient principalement sur **"+ Nouveau contrôle"**
pour créer leurs contrôles spécifiques.

## Modifier le mapping

### Cas 1 — Ajouter un cycle à un process existant

Exemple : tu décides que le process `p13` Cybersecurity & Data doit aussi pouvoir
piocher dans Record-to-Report (pour la partie audit logging des écritures).

Modifier `control-library.js` :

```javascript
const PROCESS_MAPPING = {
  // ...
  'p13': ['IT - Access Management', 'IT - Data', 'Record-to-Report'],
  // ...
};
```

Commit et push. Les auditeurs verront 14 contrôles supplémentaires apparaître dans
leur modale d'import sur le process Cybersecurity.

### Cas 2 — Ajouter un nouveau process audit avec mapping

Exemple : tu ajoutes le process `p20` Finance - Tax distinct (séparé de p12 et p16).

1. Dans `js/data.js`, ajouter le process :
```javascript
{id:'p20', dom:'Support', proc:'Finance - Tax', risk:2, riskLevel:'modere', archived:false},
```

2. Dans `js/control-library.js`, ajouter au mapping :
```javascript
'p20': ['Record-to-Report'],  // ou une bibliothèque Tax dédiée si créée plus tard
```

### Cas 3 — Retirer un mapping

Exemple : tu décides que `p18` HR - Talent Acquisition n'a finalement aucune
correspondance pertinente avec la bibliothèque HR (parce que ta lib HR est trop
focalisée RH France et toi tu fais du HR US).

Soit retirer la ligne du mapping (le process tombe dans la catégorie "sans mapping"),
soit pointer vers un sous-ensemble plus restreint si on l'avait scindé en HR-FR
et HR-US.

## Faire évoluer la table vers une UI admin

Aujourd'hui, le mapping est en **dur dans le code JS**. C'est suffisant tant que
votre Audit Universe est stable et que les modifications de mapping sont rares.

À terme, on peut migrer la table vers une **liste SharePoint** (`AF_ProcessMapping`)
éditable depuis l'interface admin d'AuditFlow. Estimation : 2 demi-journées de dev.

## Stats utiles

Une fois la bibliothèque chargée, depuis la console :

```javascript
// Combien de process audit ont au moins un cycle mappé ?
Object.keys(PROCESS_MAPPING).length;
// → 7

// Combien de cycles biblio sont effectivement utilisés ?
new Set(Object.values(PROCESS_MAPPING).flat()).size;
// → 10 (tous)

// Quels process audit pointent vers Order-to-Cash ?
Object.entries(PROCESS_MAPPING)
  .filter(([k, v]) => v.includes('Order-to-Cash'))
  .map(([k]) => k);
// → ['p11']

// Pour chaque process audit, combien de contrôles disponibles ?
Object.entries(PROCESS_MAPPING).map(([pid, cycles]) => ({
  pid,
  cycles,
  count: CTRL_LIB.data.filter(c => cycles.includes(c.process)).length
}));
```
