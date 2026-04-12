-- Migration pour le support multi-entreprises (multi-tenant)

-- Extension pour générer des UUID si nécessaire
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Création de la table des organisations
CREATE TABLE IF NOT EXISTS organizations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Création de la table pour lier les utilisateurs aux organisations
CREATE TABLE IF NOT EXISTS organization_members (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text, -- 'owner', 'admin', 'auditor', 'viewer'
    joined_at timestamptz DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- 3. Ajout de la colonne organization_id aux tables existantes
-- Note: Pour les tables existantes, nous autorisons NULL temporairement si elles contiennent déjà des données,
-- ou nous devrions spécifier une organisation par défaut.
-- Pour respecter la consigne "NOT NULL", voici la démarche :

ALTER TABLE af_audit_plan ADD COLUMN organization_id uuid REFERENCES organizations(id) NOT NULL;
ALTER TABLE af_processes ADD COLUMN organization_id uuid REFERENCES organizations(id) NOT NULL;
ALTER TABLE af_users ADD COLUMN organization_id uuid REFERENCES organizations(id) NOT NULL;
ALTER TABLE af_audit_data ADD COLUMN organization_id uuid REFERENCES organizations(id) NOT NULL;
ALTER TABLE af_actions ADD COLUMN organization_id uuid REFERENCES organizations(id) NOT NULL;
ALTER TABLE af_history ADD COLUMN organization_id uuid REFERENCES organizations(id) NOT NULL;

-- 4. Activation de Row Level Security (RLS) et création des politiques
-- Ces politiques supposent que l'utilisateur est connecté via Supabase Auth.

-- Activation RLS
ALTER TABLE af_audit_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE af_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE af_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE af_audit_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE af_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE af_history ENABLE ROW LEVEL SECURITY;

-- Politiques RLS (un utilisateur ne voit que les données de son organisation)
-- On utilise une sous-requête sur organization_members pour vérifier l'appartenance.

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name
             FROM information_schema.tables
             WHERE table_name IN ('af_audit_plan', 'af_processes', 'af_users', 'af_audit_data', 'af_actions', 'af_history')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', t);
        EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I
                        USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
                        WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))', t);
    END LOOP;
END $$;
