# Changelog

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [1.0.0] — 2026-04-26

### Ajouts

- **Bibliothèque de contrôles** : 133 contrôles standards répartis sur 10 cycles
  métier (P2P, OTC, RTR, Treasury, Payroll, HR, R&D, IT-Access, IT-Data, Fixed Assets)
- **Module `control-library.js`** : chargement depuis SharePoint, modale d'import
  multi-sélection avec filtres (process, mot-clé, contrôles clés)
- **Table de mapping `PROCESS_MAPPING`** : pont entre l'Audit Universe AuditFlow
  (organisation par fonction) et la bibliothèque (organisation par cycle standard)
- **Patch `data.js`** : ajout de 4 nouveaux process à l'Audit Universe (`p16`-`p19`)
  - `p16` Finance - Accounting and Tax
  - `p17` Purchasing and Third Party Management
  - `p18` HR - Talent Acquisition
  - `p19` HR - Payroll
- **Squelette d'intégration IA** (`ai-example.js`) avec 4 cas d'usage commentés :
  reformulation de findings, suggestion de WCGW/contrôles, génération de rapport,
  synthèse comité d'audit
- **Patch sécurité** (`SECURITY.md`) : suppression des passwords en clair, helper
  d'échappement XSS, CSP, RLS Supabase si applicable
- **Documentation complète** : README, INTEGRATION, MAPPING, ROADMAP, install guide

### Caractéristiques par contrôle (20 colonnes)

- Identification : `control_id`, `process`, `sub_process`
- Risque : `risk_id`, `risk_title`, `risk_description`, `wcgw`
- Contrôle : `control_id_ref`, `control_title`, `control_description`
- Caractéristiques : `control_type` (Préventif/Détectif), `control_nature`
  (Manuel/Auto), `frequency`, `assertion`, `owner_function`, `key_control`,
  `automation`
- Test : `evidence_expected`, `test_procedure`
- Référentiels : `referential_mapping` (COSO, SOX, AFA Sapin 2, NIST SP 800-53,
  ISO 27001, RGPD, ANSSI, IFRS, Code du Travail, CIR/BOFIP)

### Référentiels couverts

- COSO Internal Control Framework
- SOX (Sarbanes-Oxley)
- AFA / Sapin 2 (anti-corruption France)
- NIST SP 800-53 Rev. 5 (cybersécurité)
- ISO 27001:2022 / 27002 (sécurité de l'information)
- RGPD (données personnelles)
- ANSSI (sécurité infrastructure)
- IFRS (IAS 16, 21, 36, 38, IFRS 9, 10, 15)
- Code du Travail (RH France)
- CIR / BOFIP (Crédit Impôt Recherche)

### Process avec mapping bibliothèque (7)

- `p11` OTC → Order-to-Cash (15 contrôles)
- `p12` Treasury & Tax → Treasury (13 contrôles)
- `p13` Cybersecurity & Data → IT - Access Mgmt + IT - Data (28 contrôles)
- `p16` Finance - Accounting and Tax → Record-to-Report + Fixed Assets + R&D (37 contrôles)
- `p17` Purchasing and Third Party Mgmt → Procure-to-Pay (15 contrôles)
- `p18` HR - Talent Acquisition → Human Resources (12 contrôles)
- `p19` HR - Payroll → Payroll (13 contrôles)

### Process gérés manuellement (10)

Spécifiques à l'industrie SaaS / Axway :
`p1` Acquisitions, `p2` Compliance, `p3` Products & Portfolio, `p5` Product
Development, `p6` Product Deployment, `p7` Product Quality & Support,
`p8` Go-to-Market, `p9` Sales & Services, `p10` Customer Experience,
`p15` Budget / Forecast.

### À venir

Voir `docs/ROADMAP.md` pour les évolutions identifiées (intégration IA,
templates d'audit, cartographie dynamique des risques, mode mobile, etc.).
