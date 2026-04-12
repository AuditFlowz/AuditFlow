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
-- NOTE: On référence af_users(id) au lieu de auth.users(id) car l'application
-- utilise une table d'utilisateurs personnalisée (af_users) pour le login.
CREATE TABLE IF NOT EXISTS organization_members (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    user_id text REFERENCES af_users(id) ON DELETE CASCADE,
    role text, -- 'owner', 'admin', 'auditor', 'viewer'
    joined_at timestamptz DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- 3. Ajout de la colonne organization_id aux tables existantes (nullable temporairement)
ALTER TABLE af_audit_plan ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE af_processes ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE af_users ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE af_audit_data ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE af_actions ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE af_history ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- 4. Création d'une organisation par défaut pour les données existantes
INSERT INTO organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Organisation par défaut - 74SW')
ON CONFLICT (id) DO NOTHING;

-- 5. Mise à jour des données existantes avec l'organisation par défaut
UPDATE af_audit_plan SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE af_processes SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE af_users SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE af_audit_data SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE af_actions SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE af_history SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- 6. Création des liens dans organization_members pour les utilisateurs existants
INSERT INTO organization_members (organization_id, user_id, role)
SELECT organization_id, id, 'owner' FROM af_users
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 7. Passage des colonnes en NOT NULL
ALTER TABLE af_audit_plan ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE af_processes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE af_users ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE af_audit_data ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE af_actions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE af_history ALTER COLUMN organization_id SET NOT NULL;

-- 8. Activation de Row Level Security (RLS) et création des politiques
-- NOTE: Étant donné que nous n'utilisons pas Supabase Auth (auth.uid()), la RLS basée sur SQL
-- ne fonctionnera pas par défaut. Cependant, nous l'activons au cas où l'application
-- migrerait vers Supabase Auth à l'avenir. Pour l'instant, l'isolation est gérée
-- par le filtrage manuel dans db.js.

ALTER TABLE af_audit_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE af_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE af_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE af_audit_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE af_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE af_history ENABLE ROW LEVEL SECURITY;

-- Les politiques SQL sont commentées car auth.uid() n'est pas utilisé actuellement.
/*
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
*/
