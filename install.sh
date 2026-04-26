#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════
#  install.sh — Script d'installation rapide AuditFlow Extensions
#
#  À exécuter depuis la racine du repo AuditFlow (où sont js/, css/, etc.).
#  Ce script copie les fichiers et affiche les étapes manuelles restantes.
# ════════════════════════════════════════════════════════════════════════════

set -e

# Couleurs pour la lisibilité
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Vérifier qu'on est bien à la racine d'AuditFlow
if [ ! -d "js" ] || [ ! -f "index.html" ]; then
  echo -e "${YELLOW}ERREUR: ce script doit être exécuté depuis la racine du repo AuditFlow${NC}"
  echo "  (le dossier qui contient index.html et le sous-dossier js/)"
  exit 1
fi

PKG_DIR="$(dirname "$0")/.."

echo -e "${BLUE}=== AuditFlow Extensions — Installation ===${NC}"
echo

# Étape 1 — Copier les fichiers JS
echo -e "${BLUE}[1/3]${NC} Copie de control-library.js..."
cp "$PKG_DIR/js/control-library.js" js/
echo -e "  ${GREEN}OK${NC}: js/control-library.js"

# Étape 2 — Copier le CSV à la racine (temporairement, pour l'import SP)
echo -e "${BLUE}[2/3]${NC} Copie du CSV..."
cp "$PKG_DIR/data/auditflow_control_library.csv" ./
echo -e "  ${GREEN}OK${NC}: auditflow_control_library.csv (à supprimer après import)"

# Étape 3 — Vérifier l'inclusion dans index.html
echo -e "${BLUE}[3/3]${NC} Vérification de index.html..."
if grep -q "control-library.js" index.html; then
  echo -e "  ${GREEN}OK${NC}: index.html contient déjà la référence à control-library.js"
else
  echo -e "  ${YELLOW}À FAIRE${NC}: ajouter manuellement dans index.html, après graph.js et avant views.js :"
  echo
  echo '    <script src="js/control-library.js"></script>'
  echo
fi

echo
echo -e "${GREEN}=== Étapes manuelles restantes ===${NC}"
echo
echo "1. Modifier js/data.js : remplacer les lignes 132-146 (let PROCESSES = [...])"
echo "   par le contenu de scripts/patch_data.js"
echo
echo "2. Modifier js/views.js : ajouter le bouton 'Importer depuis la bibliothèque'"
echo "   dans la vue audit-detail étape 5 (voir docs/INTEGRATION.md)"
echo
echo "3. Commit et push :"
echo "     git add js/control-library.js js/data.js js/views.js index.html"
echo "     git commit -m 'feat: bibliothèque de contrôles + table de mapping'"
echo "     git push"
echo
echo "4. Une fois déployé sur Azure, ouvrir AuditFlow + console (F12) et exécuter :"
echo "     await setupControlLibraryList();"
echo "     const csv = await fetch('/auditflow_control_library.csv').then(r => r.text());"
echo "     await importControlLibraryFromCSV(csv);"
echo
echo "5. Tester sur un audit OTC ou Cybersecurity → bouton 'Importer depuis la bibliothèque'"
echo
echo "Documentation complète : docs/"
echo "  - README.md         vue d'ensemble"
echo "  - scripts/install.md guide pas-à-pas détaillé"
echo "  - docs/INTEGRATION.md intégration views.js"
echo "  - docs/MAPPING.md   table de mapping"
echo "  - docs/SECURITY.md  patch sécurité (recommandé)"
echo "  - docs/ROADMAP.md   évolutions futures"
echo
