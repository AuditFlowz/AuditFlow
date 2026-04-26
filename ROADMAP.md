# Roadmap — Évolutions possibles

Ce document liste les évolutions identifiées lors de la conception de la bibliothèque,
classées par priorité et complexité. Aucune n'est requise pour que la version
actuelle fonctionne — ce sont des pistes d'amélioration progressive.

## Court terme (1-2 semaines)

### Sécurité — appliquer le patch SECURITY.md
**Effort** : 1 jour
**Impact** : élimine les passwords en clair, ferme la principale vulnérabilité XSS,
ajoute la CSP. Voir `docs/SECURITY.md`.

### Tag "Manuel" sur les contrôles créés manuellement
**Effort** : 30 minutes
**Impact** : visibilité immédiate sur l'origine de chaque contrôle. Voir
`docs/INTEGRATION.md` section "Affichage du tag".

### Bouton "Mettre à jour ce contrôle depuis la bibliothèque"
**Effort** : 2 heures
**Impact** : si un contrôle de la bibliothèque est mis à jour (ex : nouvelle
procédure de test), permettre à l'auditeur de récupérer la nouvelle version sur
ses contrôles existants. Pré-requis : ajouter une colonne `updated_at` au CSV et
au schéma SP.

### Préchargement de la bibliothèque au démarrage
**Effort** : 5 minutes
**Impact** : la modale s'ouvre instantanément au premier clic. Voir
`docs/INTEGRATION.md` section "Préchargement".

## Moyen terme (1-3 mois)

### Intégration IA — suggestion de contrôles
**Effort** : 2-3 jours
**Impact** : pour les process **sans mapping** (Product Development, GTM, etc.),
l'IA suggère 5-10 contrôles spécifiques au contexte. Voir `js/ai-example.js` pour
le squelette. Architecture recommandée :
- Azure Function `/api/ai` qui proxy l'API Anthropic
- Clé API dans Azure Application Settings (jamais côté client)
- Bouton "✨ Suggérer des contrôles avec l'IA" à côté du bouton bibliothèque
- L'IA s'appuie sur la bibliothèque existante comme contexte (few-shot)

### Intégration IA — reformulation de findings
**Effort** : 1 jour
**Impact** : transformer des notes brutes en findings bien rédigés (Constat / Risque
/ Recommandation). Le cas d'usage le plus rentable car utilisé à chaque audit.

### Intégration IA — brouillon de rapport d'audit
**Effort** : 2 jours
**Impact** : à partir des findings, management responses et maturité, génération
automatique d'un draft de rapport structuré. Économie : 4-6 heures par audit.

### Templates d'audit récurrents
**Effort** : 1 semaine
**Impact** : permettre à un auditeur de cloner un audit précédent (avec ses contrôles
testés et ses procédures) pour démarrer rapidement un audit récurrent (ex : OTC
audité tous les ans). Aujourd'hui, chaque audit redémarre vide.

### Bibliothèque de programmes de travail (workpapers)
**Effort** : 2 semaines
**Impact** : étendre le concept de "bibliothèque" au-delà des contrôles vers les
programmes de travail complets (questionnaires d'entretien, schémas de flowchart
type, modèles de notes de revue). Très utile pour les nouveaux auditeurs.

## Moyen-long terme (3-6 mois)

### Cartographie des risques dynamique
**Effort** : 3-4 semaines
**Impact** : Le `RISK_UNIVERSE` actuel est statique. Le rendre dynamique avec
heatmap interactif, scoring qui pondère l'allocation des audits sur 3-5 ans, et
calcul automatique de la fréquence d'audit recommandée selon le risque résiduel.
C'est ce que les outils enterprise (TeamMate+, AuditBoard) font, devenu standard.

### Gestion de capacité auditeurs
**Effort** : 2 semaines
**Impact** : ajouter une vue "Selma a 87 jours-homme prévus en 2026, capacité 180".
Alertes de surcharge, équilibrage du plan annuel. Aujourd'hui pas de visibilité.

### Portail Management Responses
**Effort** : 3-4 semaines
**Impact** : permettre aux audités (Finance, IT, RH) de mettre à jour eux-mêmes
le statut de leurs plans d'action sans passer par les auditeurs. Avec relances
automatiques par email et escalade.

### UI admin pour la table de mapping
**Effort** : 1 semaine
**Impact** : aujourd'hui le mapping `PROCESS_MAPPING` est en dur dans le code.
Le migrer vers une liste SP `AF_ProcessMapping` éditable depuis l'interface admin.

### Refactor de `views.js`
**Effort** : 2-3 semaines
**Impact** : `views.js` est à 4712 lignes. Le découper en modules par vue
(`dashboard.js`, `audit-detail.js`, `plan.js`, etc.) ou migrer vers Lit/Alpine/Preact.
Réduit drastiquement la dette technique et facilite la collaboration.

### Mode mobile / offline
**Effort** : 4-6 semaines
**Impact** : pour les auditeurs en mission terrain (Liban, Maroc, sites distants
Axway). Caching local, sync différée. Différenciateur fort vs concurrence.

## Long terme (6 mois+)

### Bibliothèque communautaire / multi-tenant
**Effort** : significatif
**Impact** : si AuditFlow devient un produit SaaS au-delà d'Axway, permettre à
chaque organisation d'avoir sa propre bibliothèque tout en partageant un socle
commun maintenu par Axway.

### Continuous auditing
**Effort** : significatif
**Impact** : passer d'audits périodiques à des contrôles continus sur certains
risques (transactions anormales, accès atypiques). Compétition avec Sprinto,
Hyperproof.

### Mappings entre référentiels
**Effort** : 2 semaines pour la couche data, 1 semaine pour l'UI
**Impact** : chaque contrôle de la bibliothèque a déjà un champ `referential_mapping`
(COSO / SOX / NIST / ISO 27001 / RGPD). Construire des vues croisées : "Pour notre
conformité ISO 27001, quels contrôles avons-nous ? Lesquels manquent ?". Très
demandé pour les exercices de certification.

### Intégrations tierces
**Effort** : variable
**Impact** : connecteurs vers Jira (pour les plans d'action), ServiceNow (pour
les tickets de remédiation), Slack/Teams (pour les notifications), ERP (pour
extraction de données et tests automatisés).

## Réflexions stratégiques (sans effort chiffrable)

### Faut-il devenir un produit SaaS ?

Aujourd'hui AuditFlow est un outil interne Axway. Avec la combinaison
"workflow opinionated + bibliothèque de contrôles + IA bien intégrée + prix
accessible", il y a un vrai créneau sur le marché des **petites équipes d'audit
interne** (mal servies par AuditBoard et TeamMate+ qui sont surdimensionnés).

Si oui, prévoir :
- Multi-tenancy strict (`organization_id` partout, RLS si Supabase, partition SP)
- Refonte de l'authentification (Auth0/Clerk plutôt que Entra ID seul)
- Pricing tiers
- Marketing et sales

### Faut-il s'aligner sur les Global Internal Audit Standards 2024 (IIA) ?

L'IIA a publié de nouveaux standards en 2024 qui remplacent les normes IPPF.
Vérifier que le workflow 11 étapes / 3 phases d'AuditFlow reste conforme. Cela
peut être un argument commercial fort si tu vends à des équipes certifiées IIA.

### Faut-il un dashboard "Comité d'Audit" séparé ?

Aujourd'hui le dashboard est unique et couvre les besoins de toute l'équipe.
Un dashboard exécutif (read-only, focalisé sur les KPIs de risque, les retards,
les findings critiques) destiné au CFO / au Comité d'Audit serait probablement
apprécié.

## Métriques de succès à suivre

Pour mesurer l'impact des évolutions, suivre :
- **Taux d'utilisation de la bibliothèque** : % de contrôles importés vs créés
  manuellement par audit
- **Temps moyen de complétion d'un audit** : avant/après bibliothèque, avant/après IA
- **Taux d'adoption de l'IA** : % d'audits où au moins une fonctionnalité IA a été
  utilisée
- **Satisfaction auditeurs** : sondage simple trimestriel
- **Couverture des risques** : ratio (risques cartographiés couverts par au moins
  un audit dans les 3 derniers exercices) / (total des risques cartographiés)
