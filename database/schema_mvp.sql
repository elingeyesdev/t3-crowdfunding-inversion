CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Auto-update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TABLE 1: roles
-- =============================================================================
CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(50)  NOT NULL UNIQUE,
    display_name    VARCHAR(100) NOT NULL,
    description     TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE 2: users
-- =============================================================================
CREATE TABLE users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                   VARCHAR(255) NOT NULL UNIQUE,
    password_hash           VARCHAR(255) NOT NULL,
    phone                   VARCHAR(20)  UNIQUE,
    email_verified          BOOLEAN      NOT NULL DEFAULT false,
    phone_verified          BOOLEAN      NOT NULL DEFAULT false,
    is_active               BOOLEAN      NOT NULL DEFAULT true,
    last_login_at           TIMESTAMPTZ,
    last_login_ip           INET,
    failed_login_attempts   INTEGER      NOT NULL DEFAULT 0,
    locked_until            TIMESTAMPTZ,
    avatar_url              VARCHAR(512),
    preferred_language      VARCHAR(5)   NOT NULL DEFAULT 'es',
    timezone                VARCHAR(50)  NOT NULL DEFAULT 'America/Bogota',
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_is_active ON users (is_active) WHERE is_active = true;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE 3: user_roles
-- =============================================================================
CREATE TABLE user_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID         NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    assigned_by UUID         REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles (user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles (role_id);

-- =============================================================================
-- TABLE 4: entrepreneur_profiles
-- =============================================================================
CREATE TABLE entrepreneur_profiles (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                         UUID           NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    first_name                      VARCHAR(100)   NOT NULL,
    last_name                       VARCHAR(100)   NOT NULL,
    display_name                    VARCHAR(150),
    bio                             TEXT,
    company_name                    VARCHAR(200),
    website                         VARCHAR(512),
    linkedin_url                    VARCHAR(512),
    address_line                    VARCHAR(255),
    city                            VARCHAR(100),
    state                           VARCHAR(100),
    country                         VARCHAR(100),
    postal_code                     VARCHAR(20),
    bank_account_number             VARCHAR(100),
    bank_name                       VARCHAR(200),
    avatar_url                      VARCHAR(512),
    cover_url                       VARCHAR(512),
    identity_verified               BOOLEAN        NOT NULL DEFAULT false,
    identity_verified_at            TIMESTAMPTZ,
    kyc_status                      VARCHAR(20)    NOT NULL DEFAULT 'unverified'
                                    CHECK (kyc_status IN ('unverified', 'pending', 'approved', 'rejected')),
    kyc_rejection_reason            TEXT,
    verification_documents          JSONB          DEFAULT '[]',
    total_campaigns                 INTEGER        NOT NULL DEFAULT 0,
    total_raised                    NUMERIC(15,2)  NOT NULL DEFAULT 0,
    rating                          NUMERIC(3,2)   CHECK (rating >= 0 AND rating <= 5),
    created_at                      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entrepreneur_profiles_user_id ON entrepreneur_profiles (user_id);

CREATE TRIGGER trg_entrepreneur_profiles_updated_at
    BEFORE UPDATE ON entrepreneur_profiles FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE 5: investor_profiles
-- =============================================================================
CREATE TABLE investor_profiles (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID           NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    first_name                  VARCHAR(100)   NOT NULL,
    last_name                   VARCHAR(100)   NOT NULL,
    display_name                VARCHAR(150),
    bio                         TEXT,
    investor_type               VARCHAR(30)    NOT NULL DEFAULT 'individual'
                                CHECK (investor_type IN ('individual', 'institutional', 'angel')),
    accredited                  BOOLEAN        NOT NULL DEFAULT false,
    tax_id                      VARCHAR(50),
    address_line1               VARCHAR(255),
    address_line2               VARCHAR(255),
    city                        VARCHAR(100),
    state                       VARCHAR(100),
    country                     VARCHAR(100),
    postal_code                 VARCHAR(20),
    preferred_categories        JSONB          DEFAULT '[]',
    min_investment              NUMERIC(12,2),
    max_investment              NUMERIC(12,2),
    identity_verified           BOOLEAN        NOT NULL DEFAULT false,
    identity_verified_at        TIMESTAMPTZ,
    verification_documents      JSONB          DEFAULT '[]',
    total_investments           INTEGER        NOT NULL DEFAULT 0,
    total_invested              NUMERIC(15,2)  NOT NULL DEFAULT 0,
    metadata                    JSONB          DEFAULT '{}',
    created_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_investor_profiles_user_id ON investor_profiles (user_id);

CREATE TRIGGER trg_investor_profiles_updated_at
    BEFORE UPDATE ON investor_profiles FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE 6: admin_profiles
-- =============================================================================
CREATE TABLE admin_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    first_name              VARCHAR(100)  NOT NULL,
    last_name               VARCHAR(100)  NOT NULL,
    employee_id             VARCHAR(50)   UNIQUE,
    department              VARCHAR(100),
    access_level            VARCHAR(20)   NOT NULL DEFAULT 'moderator'
                            CHECK (access_level IN ('super_admin', 'admin', 'moderator', 'support')),
    permissions             JSONB         NOT NULL DEFAULT '[]',
    can_approve_campaigns   BOOLEAN       NOT NULL DEFAULT false,
    can_manage_users        BOOLEAN       NOT NULL DEFAULT false,
    can_manage_finances     BOOLEAN       NOT NULL DEFAULT false,
    is_active               BOOLEAN       NOT NULL DEFAULT true,
    last_action_at          TIMESTAMPTZ,
    metadata                JSONB         DEFAULT '{}',
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_profiles_user_id ON admin_profiles (user_id);

CREATE TRIGGER trg_admin_profiles_updated_at
    BEFORE UPDATE ON admin_profiles FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE 7: categories
-- =============================================================================
CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    display_name    VARCHAR(150) NOT NULL,
    description     TEXT,
    icon            VARCHAR(100),
    color           VARCHAR(7),
    slug            VARCHAR(150) NOT NULL UNIQUE,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    campaign_count  INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories (slug);

-- =============================================================================
-- TABLE 8: campaigns
-- =============================================================================
CREATE TABLE campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id          UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_id         UUID           NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    title               VARCHAR(255)   NOT NULL,
    slug                VARCHAR(300)   NOT NULL UNIQUE,
    subtitle            VARCHAR(500),
    description         TEXT           NOT NULL,
    short_description   VARCHAR(500),
    campaign_type       VARCHAR(20)    NOT NULL DEFAULT 'reward'
                        CHECK (campaign_type IN ('donation', 'reward', 'equity')),
    status              VARCHAR(20)    NOT NULL DEFAULT 'draft'
                        CHECK (status IN (
                            'draft', 'pending_review', 'in_review', 'approved',
                            'rejected', 'published', 'funded', 'partially_funded',
                            'failed', 'cancelled', 'completed', 'suspended'
                        )),
    goal_amount         NUMERIC(15,2)  NOT NULL CHECK (goal_amount > 0),
    min_investment      NUMERIC(12,2)  NOT NULL DEFAULT 1.00 CHECK (min_investment > 0),
    max_investment      NUMERIC(12,2),
    current_amount      NUMERIC(15,2)  NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
    investor_count      INTEGER        NOT NULL DEFAULT 0 CHECK (investor_count >= 0),
    currency            VARCHAR(3)     NOT NULL DEFAULT 'BOB',
    start_date          TIMESTAMPTZ,
    end_date            TIMESTAMPTZ,
    funded_at           TIMESTAMPTZ,
    cover_image_url     VARCHAR(512),
    video_url           VARCHAR(512),
    location            VARCHAR(200),
    tags                JSONB          DEFAULT '[]',
    risks_and_challenges TEXT,
    faq                 JSONB          DEFAULT '[]',
    social_links        JSONB          DEFAULT '{}',
    is_featured         BOOLEAN        NOT NULL DEFAULT false,
    featured_at         TIMESTAMPTZ,
    view_count          INTEGER        NOT NULL DEFAULT 0,
    share_count         INTEGER        NOT NULL DEFAULT 0,
    metadata            JSONB          DEFAULT '{}',
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    published_at        TIMESTAMPTZ
);

CREATE INDEX idx_campaigns_slug ON campaigns (slug);
CREATE INDEX idx_campaigns_creator_id ON campaigns (creator_id);
CREATE INDEX idx_campaigns_category_id ON campaigns (category_id);
CREATE INDEX idx_campaigns_status ON campaigns (status);
CREATE INDEX idx_campaigns_campaign_type ON campaigns (campaign_type);
CREATE INDEX idx_campaigns_status_type ON campaigns (status, campaign_type);
CREATE INDEX idx_campaigns_published ON campaigns (published_at DESC) WHERE status = 'published';
CREATE INDEX idx_campaigns_title_trgm ON campaigns USING GIN (title gin_trgm_ops);

CREATE TRIGGER trg_campaigns_updated_at
    BEFORE UPDATE ON campaigns FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE 9: reward_tiers
-- =============================================================================
CREATE TABLE reward_tiers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID           NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    title               VARCHAR(200)   NOT NULL,
    description         TEXT           NOT NULL,
    amount              NUMERIC(12,2)  NOT NULL CHECK (amount > 0),
    currency            VARCHAR(3)     NOT NULL DEFAULT 'BOB',
    max_claims          INTEGER,
    current_claims      INTEGER        NOT NULL DEFAULT 0 CHECK (current_claims >= 0),
    estimated_delivery  DATE,
    includes_shipping   BOOLEAN        NOT NULL DEFAULT false,
    shipping_details    TEXT,
    image_url           VARCHAR(512),
    items               JSONB          DEFAULT '[]',
    sort_order          INTEGER        NOT NULL DEFAULT 0,
    is_active           BOOLEAN        NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reward_tiers_campaign_id ON reward_tiers (campaign_id);

CREATE TRIGGER trg_reward_tiers_updated_at
    BEFORE UPDATE ON reward_tiers FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE 10: investments
-- =============================================================================
CREATE TABLE investments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID           NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
    investor_id         UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reward_tier_id      UUID           REFERENCES reward_tiers(id) ON DELETE SET NULL,
    amount              NUMERIC(12,2)  NOT NULL CHECK (amount > 0),
    currency            VARCHAR(3)     NOT NULL DEFAULT 'BOB',
    status              VARCHAR(20)    NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                            'pending', 'processing', 'completed', 'failed',
                            'refunded', 'partially_refunded', 'cancelled'
                        )),
    payment_method      VARCHAR(30),
    payment_intent_id   VARCHAR(255),
    is_anonymous        BOOLEAN        NOT NULL DEFAULT false,
    message             TEXT,
    refund_reason       TEXT,
    refunded_amount     NUMERIC(12,2)  DEFAULT 0,
    refunded_at         TIMESTAMPTZ,
    ip_address          INET,
    user_agent          TEXT,
    metadata            JSONB          DEFAULT '{}',
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_investments_campaign_id ON investments (campaign_id);
CREATE INDEX idx_investments_investor_id ON investments (investor_id);
CREATE INDEX idx_investments_status ON investments (status);
CREATE INDEX idx_investments_campaign_status ON investments (campaign_id, status);
CREATE INDEX idx_investments_completed ON investments (campaign_id, amount) WHERE status = 'completed';

CREATE TRIGGER trg_investments_updated_at
    BEFORE UPDATE ON investments FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE 11: transactions
-- =============================================================================
CREATE TABLE transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id           UUID           NOT NULL REFERENCES investments(id) ON DELETE RESTRICT,
    transaction_type        VARCHAR(30)    NOT NULL
                            CHECK (transaction_type IN (
                                'payment', 'refund', 'partial_refund',
                                'payout', 'fee', 'adjustment'
                            )),
    amount                  NUMERIC(12,2)  NOT NULL,
    currency                VARCHAR(3)     NOT NULL DEFAULT 'BOB',
    fee_amount              NUMERIC(10,2)  DEFAULT 0,
    net_amount              NUMERIC(12,2),
    status                  VARCHAR(20)    NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reversed')),
    payment_gateway         VARCHAR(50),
    gateway_transaction_id  VARCHAR(255),
    gateway_response        JSONB,
    description             TEXT,
    processed_at            TIMESTAMPTZ,
    metadata                JSONB          DEFAULT '{}',
    created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_investment_id ON transactions (investment_id);
CREATE INDEX idx_transactions_status ON transactions (status);
CREATE INDEX idx_transactions_gateway_id ON transactions (gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE 12: notifications (simplified — no notification_types FK in MVP)
-- =============================================================================
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    body            TEXT         NOT NULL,
    channel         VARCHAR(20)  NOT NULL DEFAULT 'in_app'
                    CHECK (channel IN ('in_app', 'email', 'push', 'sms')),
    is_read         BOOLEAN      NOT NULL DEFAULT false,
    read_at         TIMESTAMPTZ,
    action_url      VARCHAR(512),
    reference_type  VARCHAR(50),
    reference_id    UUID,
    data            JSONB        DEFAULT '{}',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, is_read) WHERE is_read = false;

-- =============================================================================
-- MVP SCHEMA COMPLETE — 12 TABLES
-- =============================================================================
