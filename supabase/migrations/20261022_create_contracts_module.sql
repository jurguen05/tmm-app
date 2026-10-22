-- ==============================================================================
-- Migration: 20261022_create_contracts_module.sql
-- Description: Creates Unified Contacts (Party Model), contracts, rates, and movements
-- Safe & Idempotent: Can be run multiple times safely.
-- ==============================================================================

-- 1. Table: contacts (Unified Directory for Investors and Originators)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  country VARCHAR(100),       -- País de residencia / fiscal
  tax_id VARCHAR(50),         -- DNI / CUIT / CUIL / Tax ID / Pasaporte
  address TEXT,               -- Domicilio fiscal / residencia
  payout_info TEXT,           -- CBU, Alias bancario, Billetera USDT o cuenta de destino
  is_investor BOOLEAN DEFAULT true,
  is_originator BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Cuenta de acceso (opcional)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar columna country y restricción única en user_id si ya existe la tabla
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS country VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id) WHERE user_id IS NOT NULL;

-- Migración segura si existían tablas previas de investors u originators
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'investors') THEN
    INSERT INTO contacts (id, name, email, phone, tax_id, address, payout_info, is_investor, user_id, notes, created_at, updated_at)
    SELECT id, name, email, phone, tax_id, address, payout_info, true, user_id, notes, created_at, updated_at
    FROM investors
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'originators') THEN
    INSERT INTO contacts (id, name, email, phone, tax_id, payout_info, is_originator, notes, created_at, updated_at)
    SELECT id, name, email, phone, tax_id, payout_info, true, notes, created_at, updated_at
    FROM originators
    ON CONFLICT (id) DO UPDATE SET is_originator = true;
  END IF;

  -- Backfill de usuarios existentes en auth.users y profiles al directorio único de contactos
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    INSERT INTO contacts (user_id, name, email, is_investor, is_originator, created_at, updated_at)
    SELECT 
      p.id,
      COALESCE(
        NULLIF(u.raw_user_meta_data->>'full_name', ''),
        NULLIF(u.raw_user_meta_data->>'name', ''),
        NULLIF(split_part(u.email, '@', 1), ''),
        'Team Member'
      ) AS name,
      u.email,
      (p.role_id = 2) AS is_investor,
      false AS is_originator,
      NOW(),
      NOW()
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN contacts c ON c.user_id = p.id
    WHERE c.id IS NULL;
  END IF;
END $$;

-- 2. Table: contracts
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number VARCHAR(50) UNIQUE NOT NULL,
  investor_name VARCHAR(255) NOT NULL,
  investor_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  originator_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  initial_amount NUMERIC(15, 2) NOT NULL CHECK (initial_amount > 0),
  cutoff_day SMALLINT NOT NULL CHECK (cutoff_day BETWEEN 1 AND 31),
  payout_frequency VARCHAR(30) DEFAULT 'ON_DEMAND' NOT NULL CHECK (payout_frequency IN ('MONTHLY', 'BIMONTHLY', 'SEMIANNUAL', 'ANNUAL', 'ON_DEMAND')),
  status VARCHAR(20) DEFAULT 'Open' NOT NULL CHECK (status IN ('Open', 'Closed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar columnas si contracts ya existía
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS investor_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS originator_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS payout_frequency VARCHAR(30) DEFAULT 'ON_DEMAND';

-- 3. Table: contract_rates (Rate history over time)
CREATE TABLE IF NOT EXISTS contract_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  investor_annual_rate NUMERIC(6, 4) NOT NULL CHECK (investor_annual_rate >= 0),
  originator_annual_rate NUMERIC(6, 4) DEFAULT 0 CHECK (originator_annual_rate >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table: contract_movements
CREATE TABLE IF NOT EXISTS contract_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  movement_type VARCHAR(30) NOT NULL CHECK (
    movement_type IN (
      'CAPITAL_DEPOSIT',
      'CAPITAL_WITHDRAWAL',
      'INTEREST_WITHDRAWAL'
    )
  ),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  movement_date DATE NOT NULL,
  lockup_until DATE,
  agreed_withdrawal BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_tax_id ON contacts(tax_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_investor_id ON contracts(investor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_originator_id ON contracts(originator_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contract_rates_contract ON contract_rates(contract_id, effective_date);
CREATE INDEX IF NOT EXISTS idx_contract_movements_contract ON contract_movements(contract_id, movement_date);

-- Clean Architecture: No database triggers for business logic.
-- Contract status and lockup advisories are calculated directly in the application layer.
DROP TRIGGER IF EXISTS trg_set_lockup_date ON contract_movements;
DROP FUNCTION IF EXISTS trg_set_contract_movement_lockup();
DROP TRIGGER IF EXISTS trg_sync_contract_status ON contract_movements;
DROP FUNCTION IF EXISTS trg_update_contract_status_on_movement();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_movements ENABLE ROW LEVEL SECURITY;

-- Helper check: Is user an operator/admin (role_id = 1)?
CREATE OR REPLACE FUNCTION is_operator()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role_id = 1
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. Contacts policies
DROP POLICY IF EXISTS "Operators full access on contacts" ON contacts;
CREATE POLICY "Operators full access on contacts"
  ON contacts FOR ALL
  TO authenticated
  USING (is_operator())
  WITH CHECK (is_operator());

DROP POLICY IF EXISTS "Users view own contact profile" ON contacts;
CREATE POLICY "Users view own contact profile"
  ON contacts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2. Contracts policies:
-- Operators can read/write everything
DROP POLICY IF EXISTS "Operators full access on contracts" ON contracts;
CREATE POLICY "Operators full access on contracts"
  ON contracts FOR ALL
  TO authenticated
  USING (is_operator())
  WITH CHECK (is_operator());

-- Non-operators view contracts where they are the investor OR the originator
DROP POLICY IF EXISTS "Contacts view own contracts as investor or originator" ON contracts;
CREATE POLICY "Contacts view own contracts as investor or originator"
  ON contracts FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.user_id = auth.uid()
        AND (contacts.id = contracts.investor_id OR contacts.id = contracts.originator_id)
    )
  );

-- 3. Contract Rates policies
DROP POLICY IF EXISTS "Operators full access on contract_rates" ON contract_rates;
CREATE POLICY "Operators full access on contract_rates"
  ON contract_rates FOR ALL
  TO authenticated
  USING (is_operator())
  WITH CHECK (is_operator());

DROP POLICY IF EXISTS "Contacts view rates of their contracts" ON contract_rates;
CREATE POLICY "Contacts view rates of their contracts"
  ON contract_rates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = contract_rates.contract_id AND (
        contracts.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM contacts
          WHERE contacts.user_id = auth.uid()
            AND (contacts.id = contracts.investor_id OR contacts.id = contracts.originator_id)
        )
      )
    )
  );

-- 4. Contract Movements policies
DROP POLICY IF EXISTS "Operators full access on contract_movements" ON contract_movements;
CREATE POLICY "Operators full access on contract_movements"
  ON contract_movements FOR ALL
  TO authenticated
  USING (is_operator())
  WITH CHECK (is_operator());

DROP POLICY IF EXISTS "Contacts view movements of their contracts" ON contract_movements;
CREATE POLICY "Contacts view movements of their contracts"
  ON contract_movements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = contract_movements.contract_id AND (
        contracts.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM contacts
          WHERE contacts.user_id = auth.uid()
            AND (contacts.id = contracts.investor_id OR contacts.id = contracts.originator_id)
        )
      )
    )
  );

-- ==============================================================================
-- 5. Table: invitations (Private Invitation-Only Onboarding)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(255),
  name VARCHAR(255),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  role_id INT NOT NULL DEFAULT 2, -- 2: Investor Portal, 1: Operator
  is_investor BOOLEAN DEFAULT true,
  is_originator BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Expired')),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage invitations" ON invitations;
CREATE POLICY "Operators manage invitations"
  ON invitations FOR ALL
  TO authenticated
  USING (is_operator())
  WITH CHECK (is_operator());

DROP POLICY IF EXISTS "Public can view pending invitation by token" ON invitations;
CREATE POLICY "Public can view pending invitation by token"
  ON invitations FOR SELECT
  TO anon, authenticated
  USING (status = 'Pending' AND expires_at > NOW());

DROP POLICY IF EXISTS "Public can update pending invitation on acceptance" ON invitations;
CREATE POLICY "Public can update pending invitation on acceptance"
  ON invitations FOR UPDATE
  TO anon, authenticated
  USING (status = 'Pending')
  WITH CHECK (status = 'Accepted');
