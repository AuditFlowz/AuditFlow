// ════════════════════════════════════════════════════════════════════════════
//  /api/ai/index.js — Azure Function proxy vers Azure OpenAI
//
//  Reçoit une requête POST {action, payload} du front-end, appelle Azure
//  OpenAI avec la clé stockée côté serveur (Application Settings), et
//  retourne la réponse au front.
//
//  Variables d'environnement attendues (Configuration → Application Settings) :
//   - AZURE_OPENAI_ENDPOINT   : https://openai-rfp-instance.openai.azure.com/
//   - AZURE_OPENAI_API_KEY    : la clé secrète (Manage keys → Key 1 ou Key 2)
//   - AZURE_OPENAI_DEPLOYMENT : RFP-gpt-4
//   - AZURE_OPENAI_API_VERSION: 2024-08-01-preview (par défaut si absent)
// ════════════════════════════════════════════════════════════════════════════

module.exports = async function (context, req) {
  // CORS — Azure SWA gère normalement automatiquement, mais on protège
  context.res = {
    headers: { 'Content-Type': 'application/json' }
  };

  if (req.method !== 'POST') {
    context.res.status = 405;
    context.res.body = { error: 'Method not allowed, use POST' };
    return;
  }

  const ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
  const API_KEY = process.env.AZURE_OPENAI_API_KEY;
  const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'RFP-gpt-4';
  const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';

  if (!ENDPOINT || !API_KEY) {
    context.res.status = 500;
    context.res.body = { error: 'Azure OpenAI non configuré (endpoint ou clé manquant)' };
    return;
  }

  const { action, payload } = req.body || {};
  if (!action || !payload) {
    context.res.status = 400;
    context.res.body = { error: 'Body invalide : {action, payload} requis' };
    return;
  }

  // Construire les messages selon l'action demandée
  let messages;
  let maxTokens = 1500;
  let temperature = 0.3;

  switch (action) {
    case 'reformulateFinding':
      messages = buildReformulationPrompt(payload);
      maxTokens = 800;
      temperature = 0.2;
      break;

    case 'suggestControls':
      messages = buildControlSuggestionPrompt(payload);
      maxTokens = 2500;
      temperature = 0.4;
      break;

    default:
      context.res.status = 400;
      context.res.body = { error: `Action inconnue: ${action}` };
      return;
  }

  // Appel à Azure OpenAI
  const url = `${ENDPOINT.replace(/\/$/, '')}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': API_KEY,
      },
      body: JSON.stringify({
        messages,
        max_tokens: maxTokens,
        temperature,
        top_p: 0.95,
      })
    });

    if (!response.ok) {
      const err = await response.text();
      context.log.error('Azure OpenAI error:', response.status, err);
      context.res.status = response.status;
      context.res.body = { error: 'Erreur Azure OpenAI', detail: err };
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    context.res.status = 200;
    context.res.body = {
      action,
      content,
      usage: data.usage,
    };
  } catch (e) {
    context.log.error('AI call exception:', e);
    context.res.status = 500;
    context.res.body = { error: 'Exception lors de l\'appel IA', detail: e.message };
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  PROMPTS — un par cas d'usage
// ════════════════════════════════════════════════════════════════════════════

function buildReformulationPrompt(payload) {
  const { rawText, context: ctx } = payload;
  const auditContext = ctx ? `\n\nContexte de l'audit :\n- Process audité : ${ctx.process || 'n/a'}\n- Entité : ${ctx.entity || 'n/a'}` : '';

  return [
    {
      role: 'system',
      content: `Tu es un auditeur interne senior chez Axway/74Software, éditeur de logiciels B2B SaaS.
Ton rôle est de transformer les notes brutes d'un auditeur en finding d'audit professionnel et structuré.

Format attendu (Markdown léger) :

**Constat**
[Description factuelle de ce qui a été observé, en 2-4 phrases. Ton neutre et précis. Pas de jugement de valeur.]

**Risque**
[Description du risque que cette situation engendre. Inclure le type de risque (financier, opérationnel, conformité, réputationnel) et son impact potentiel.]

**Recommandation**
[Action concrète et réaliste pour adresser le constat. Utiliser un verbe d'action (mettre en place, formaliser, automatiser, etc.). Préciser le responsable suggéré si pertinent.]

Règles :
- Reste strictement dans le scope du constat fourni, ne pas extrapoler ni inventer
- Utiliser un français corporate clair, sans anglicismes inutiles
- Pas de phrases creuses ("il convient de", "il est recommandé que")
- Si le texte source est trop vague, le signaler dans le Constat sans inventer
- Ne JAMAIS inclure de mention "Note d'auditeur" ou autre méta-commentaire
- Pas de Markdown autre que le **gras** sur les 3 sections`
    },
    {
      role: 'user',
      content: `Voici les notes brutes à reformuler :${auditContext}

---
${rawText}
---

Produis le finding structuré.`
    }
  ];
}

function buildControlSuggestionPrompt(payload) {
  const { processName, context: ctx } = payload;
  const industryContext = `Axway/74Software est un éditeur de logiciels B2B (intégration, API management, MFT, sécurité). Modèle SaaS et on-premise. Clients enterprise (banques, télécoms, industries).`;

  return [
    {
      role: 'system',
      content: `Tu es un auditeur interne senior spécialisé en évaluation des risques et contrôles internes.
Ton rôle est de proposer un ensemble de contrôles d'audit pour un process donné, adaptés au contexte métier.

Tu dois retourner UNIQUEMENT un JSON valide, sans texte avant ou après, au format suivant :

{
  "controls": [
    {
      "name": "Titre court du contrôle (max 80 caractères)",
      "description": "Description détaillée du contrôle (1-2 phrases)",
      "wcgw": "Le risque que ce contrôle adresse (What Could Go Wrong)",
      "frequency": "Mensuel | Trimestriel | Annuel | Ad hoc",
      "nature": "Manual | IT-Dependent",
      "key": true | false,
      "owner": "Fonction propriétaire suggérée (ex: Finance, IT, RH, Direction)",
      "testProcedure": "Procédure de test concrète pour l'audit (1-2 phrases)"
    }
  ]
}

Règles :
- Génère exactement 8 contrôles
- Mélange contrôles préventifs et détectifs
- Identifie 3-4 contrôles "clés" (key: true), les autres en false
- Procédures de test : concrètes, échantillonnables, vérifiables (pas de généralités)
- Adapte au contexte SaaS B2B (pas de contrôles industriels ou retail non pertinents)
- WCGW : un risque concret, pas une généralité
- Pas de markdown, pas de commentaire, JSON strict uniquement`
    },
    {
      role: 'user',
      content: `Process à auditer : ${processName}

Contexte de l'entreprise : ${industryContext}
${ctx?.entity ? `Entité auditée : ${ctx.entity}` : ''}

Génère 8 contrôles pertinents pour ce process.`
    }
  ];
}
