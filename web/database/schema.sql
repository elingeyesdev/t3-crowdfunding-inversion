-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- Full-text search trigrams
CREATE EXTENSION IF NOT EXISTS "btree_gin";    -- GIN index support for scalars

-- =============================================================================
-- UTILITY: Auto-update updated_at trigger function
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- LEVEL 0: No dependencies (catalog tables)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: roles
-- Description: System role catalog (entrepreneur, investor, admin)
-- -----------------------------------------------------------------------------
CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(50)  NOT NULL UNIQUE,
    display_name    VARCHAR(100) NOT NULL,
    description     TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'Catálogo de roles del sistema. Tabla inmutable en producción.';

-- -----------------------------------------------------------------------------
-- Table: categories
-- Description: Campaign category catalog
-- -----------------------------------------------------------------------------
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
CREATE INDEX idx_categories_is_active ON categories (is_active) WHERE is_active = true;
CREATE INDEX idx_categories_sort_order ON categories (sort_order);

COMMENT ON TABLE categories IS 'Catálogo de categorías para campañas.';

-- -----------------------------------------------------------------------------
-- Table: notification_types
-- Description: Notification type catalog with templates
-- -----------------------------------------------------------------------------
CREATE TABLE notification_types (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code              VARCHAR(50)  NOT NULL UNIQUE,
    name              VARCHAR(100) NOT NULL,
    description       TEXT,
    template          TEXT,
    category          VARCHAR(30)  NOT NULL DEFAULT 'system'
                      CHECK (category IN ('system', 'campaign', 'investment', 'reward', 'message', 'admin', 'marketing')),
    default_channels  JSONB        NOT NULL DEFAULT '["in_app"]',
    is_active         BOOLEAN      NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_types_code ON notification_types (code);
CREATE INDEX idx_notification_types_category ON notification_types (category);

COMMENT ON TABLE notification_types IS 'Catálogo de tipos de notificación con templates.';

-- =============================================================================
-- LEVEL 1: Depends on Level 0
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: users
-- Description: Central authentication table. Auth data ONLY, no profile data.
-- -----------------------------------------------------------------------------
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
CREATE INDEX idx_users_created_at ON users (created_at);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE users IS 'Tabla central de autenticación. Solo datos de acceso, NO de perfil.';

-- =============================================================================
-- LEVEL 2: Depends on users
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: user_roles
-- Description: Many-to-many pivot table between users and roles
-- -----------------------------------------------------------------------------
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

COMMENT ON TABLE user_roles IS 'Relación N:M entre usuarios y roles. Un usuario puede tener múltiples roles.';

-- -----------------------------------------------------------------------------
-- Table: entrepreneur_profiles
-- Description: Extended profile for entrepreneurs with verification data
-- -----------------------------------------------------------------------------
CREATE TABLE entrepreneur_profiles (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                         UUID           NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    first_name                      VARCHAR(100)   NOT NULL,
    last_name                       VARCHAR(100)   NOT NULL,
    display_name                    VARCHAR(150)   UNIQUE,
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
CREATE INDEX idx_entrepreneur_profiles_display_name ON entrepreneur_profiles (display_name);
CREATE INDEX idx_entrepreneur_profiles_identity_verified ON entrepreneur_profiles (identity_verified);
CREATE INDEX idx_entrepreneur_profiles_company_name ON entrepreneur_profiles (company_name) WHERE company_name IS NOT NULL;

CREATE TRIGGER trg_entrepreneur_profiles_updated_at
    BEFORE UPDATE ON entrepreneur_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE entrepreneur_profiles IS 'Perfil extendido de emprendedores. Datos de negocio y verificación.';

-- -----------------------------------------------------------------------------
-- Table: investor_profiles
-- Description: Extended profile for investors with KYC and preferences
-- -----------------------------------------------------------------------------
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
    avatar_url                  VARCHAR(512),
    cover_url                   VARCHAR(512),
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
CREATE INDEX idx_investor_profiles_investor_type ON investor_profiles (investor_type);
CREATE INDEX idx_investor_profiles_identity_verified ON investor_profiles (identity_verified);

CREATE TRIGGER trg_investor_profiles_updated_at
    BEFORE UPDATE ON investor_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE investor_profiles IS 'Perfil extendido de inversores. Datos KYC y preferencias.';

-- -----------------------------------------------------------------------------
-- Table: admin_profiles
-- Description: Admin profile with granular permissions and access levels
-- -----------------------------------------------------------------------------
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
    is_active               BOOLEAN       NOT NULL DEFAULT true,
    last_action_at          TIMESTAMPTZ,
    metadata                JSONB         DEFAULT '{}',
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_profiles_user_id ON admin_profiles (user_id);
CREATE INDEX idx_admin_profiles_access_level ON admin_profiles (access_level);
CREATE INDEX idx_admin_profiles_is_active ON admin_profiles (is_active) WHERE is_active = true;

CREATE TRIGGER trg_admin_profiles_updated_at
    BEFORE UPDATE ON admin_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE admin_profiles IS 'Perfil de administradores con permisos granulares y nivel de acceso.';

-- -----------------------------------------------------------------------------
-- Table: conversations
-- Description: Conversations between users (messaging module)
-- -----------------------------------------------------------------------------
CREATE TABLE conversations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject             VARCHAR(255),
    campaign_id         UUID,  -- FK added after campaigns table is created
    conversation_type   VARCHAR(20)  NOT NULL DEFAULT 'direct'
                        CHECK (conversation_type IN ('direct', 'support', 'campaign_inquiry')),
    status              VARCHAR(20)  NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived', 'closed')),
    last_message_at     TIMESTAMPTZ,
    message_count       INTEGER      NOT NULL DEFAULT 0,
    metadata            JSONB        DEFAULT '{}',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_status ON conversations (status);
CREATE INDEX idx_conversations_last_message_at ON conversations (last_message_at DESC);
CREATE INDEX idx_conversations_conversation_type ON conversations (conversation_type);

CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE conversations IS 'Conversaciones entre usuarios (emprendedor-inversor, usuario-admin).';

-- =============================================================================
-- LEVEL 3: Depends on users + catalogs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: campaigns
-- Description: Core business table — each campaign has a full lifecycle
-- -----------------------------------------------------------------------------
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

-- Standard indexes
CREATE INDEX idx_campaigns_slug ON campaigns (slug);
CREATE INDEX idx_campaigns_creator_id ON campaigns (creator_id);
CREATE INDEX idx_campaigns_category_id ON campaigns (category_id);
CREATE INDEX idx_campaigns_status ON campaigns (status);
CREATE INDEX idx_campaigns_campaign_type ON campaigns (campaign_type);
CREATE INDEX idx_campaigns_created_at ON campaigns (created_at DESC);
CREATE INDEX idx_campaigns_end_date ON campaigns (end_date);

-- Composite indexes for common queries
CREATE INDEX idx_campaigns_status_type ON campaigns (status, campaign_type);
CREATE INDEX idx_campaigns_status_featured ON campaigns (status, is_featured) WHERE is_featured = true;
CREATE INDEX idx_campaigns_creator_status ON campaigns (creator_id, status);

-- Partial indexes for hot queries
CREATE INDEX idx_campaigns_published ON campaigns (published_at DESC) WHERE status = 'published';
CREATE INDEX idx_campaigns_active ON campaigns (end_date) WHERE status IN ('published', 'funded');

-- Full-text search index on title
CREATE INDEX idx_campaigns_title_trgm ON campaigns USING GIN (title gin_trgm_ops);

CREATE TRIGGER trg_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE campaigns IS 'Tabla central del negocio. Cada campaña tiene un ciclo de vida completo.';

-- Add FK from conversations to campaigns (deferred)
ALTER TABLE conversations
    ADD CONSTRAINT fk_conversations_campaign_id
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX idx_conversations_campaign_id ON conversations (campaign_id) WHERE campaign_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Table: conversation_participants
-- Description: Participants in each conversation
-- -----------------------------------------------------------------------------
CREATE TABLE conversation_participants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                VARCHAR(20) NOT NULL DEFAULT 'member'
                        CHECK (role IN ('owner', 'member', 'admin')),
    last_read_at        TIMESTAMPTZ,
    is_muted            BOOLEAN     NOT NULL DEFAULT false,
    joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (conversation_id, user_id)
);

CREATE INDEX idx_conversation_participants_conversation_id ON conversation_participants (conversation_id);
CREATE INDEX idx_conversation_participants_user_id ON conversation_participants (user_id);

COMMENT ON TABLE conversation_participants IS 'Participantes de cada conversación. Soporte para grupos.';

-- -----------------------------------------------------------------------------
-- Table: notifications
-- Description: User notifications — multi-channel support
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type_id         UUID         NOT NULL REFERENCES notification_types(id) ON DELETE RESTRICT,
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
    sent_at         TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_reference ON notifications (reference_type, reference_id) WHERE reference_type IS NOT NULL;
CREATE INDEX idx_notifications_created_at ON notifications (created_at DESC);
CREATE INDEX idx_notifications_channel ON notifications (channel);

COMMENT ON TABLE notifications IS 'Notificaciones de usuarios. Soporte multi-canal (in_app, email, push, sms).';

-- -----------------------------------------------------------------------------
-- Table: audit_logs
-- Description: Immutable system audit log — append-only, never delete
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50)  NOT NULL,
    entity_id       UUID,
    old_values      JSONB,
    new_values      JSONB,
    ip_address      INET,
    user_agent      TEXT,
    request_id      VARCHAR(100),
    session_id      VARCHAR(255),
    severity        VARCHAR(10)  NOT NULL DEFAULT 'info'
                    CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    metadata        JSONB        DEFAULT '{}',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- NOTE: No updated_at — this table is append-only by design
CREATE INDEX idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_severity ON audit_logs (severity) WHERE severity IN ('error', 'critical');
CREATE INDEX idx_audit_logs_request_id ON audit_logs (request_id) WHERE request_id IS NOT NULL;

COMMENT ON TABLE audit_logs IS 'Registro inmutable de acciones del sistema. Append-only, nunca borrar.';

-- =============================================================================
-- LEVEL 4: Depends on campaigns
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: campaign_media
-- Description: Campaign multimedia gallery
-- -----------------------------------------------------------------------------
CREATE TABLE campaign_media (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID         NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    media_type      VARCHAR(20)  NOT NULL
                    CHECK (media_type IN ('image', 'video', 'document', 'presentation')),
    url             VARCHAR(512) NOT NULL,
    thumbnail_url   VARCHAR(512),
    title           VARCHAR(200),
    description     TEXT,
    mime_type       VARCHAR(100),
    file_size_bytes BIGINT,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    is_primary      BOOLEAN      NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaign_media_campaign_id ON campaign_media (campaign_id);
CREATE INDEX idx_campaign_media_media_type ON campaign_media (media_type);

COMMENT ON TABLE campaign_media IS 'Galería multimedia de la campaña.';

-- -----------------------------------------------------------------------------
-- Table: campaign_updates
-- Description: Updates published by entrepreneur during campaign lifecycle
-- -----------------------------------------------------------------------------
CREATE TABLE campaign_updates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID         NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    author_id       UUID         REFERENCES users(id) ON DELETE SET NULL,
    title           VARCHAR(255) NOT NULL,
    content         TEXT         NOT NULL,
    is_public       BOOLEAN      NOT NULL DEFAULT true,
    attachments     JSONB        DEFAULT '[]',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaign_updates_campaign_id ON campaign_updates (campaign_id);
CREATE INDEX idx_campaign_updates_created_at ON campaign_updates (created_at DESC);
CREATE INDEX idx_campaign_updates_is_public ON campaign_updates (campaign_id, is_public) WHERE is_public = true;

CREATE TRIGGER trg_campaign_updates_updated_at
    BEFORE UPDATE ON campaign_updates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE campaign_updates IS 'Actualizaciones del emprendedor durante la vida de la campaña.';

-- -----------------------------------------------------------------------------
-- Table: campaign_reviews
-- Description: Admin reviews of campaigns — full decision history
-- -----------------------------------------------------------------------------
CREATE TABLE campaign_reviews (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id                 UUID         NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    reviewer_id                 UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    decision                    VARCHAR(20)  NOT NULL
                                CHECK (decision IN ('approved', 'rejected', 'changes_requested')),
    feedback                    TEXT,
    internal_notes              TEXT,
    checklist                   JSONB        DEFAULT '{}',
    review_duration_minutes     INTEGER,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaign_reviews_campaign_id ON campaign_reviews (campaign_id);
CREATE INDEX idx_campaign_reviews_reviewer_id ON campaign_reviews (reviewer_id);
CREATE INDEX idx_campaign_reviews_decision ON campaign_reviews (decision);
CREATE INDEX idx_campaign_reviews_created_at ON campaign_reviews (created_at DESC);

COMMENT ON TABLE campaign_reviews IS 'Revisiones de campañas por administradores.';

-- -----------------------------------------------------------------------------
-- Table: campaign_status_history
-- Description: Immutable record of every campaign status change
-- -----------------------------------------------------------------------------
CREATE TABLE campaign_status_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    from_status     VARCHAR(20),
    to_status       VARCHAR(20) NOT NULL,
    changed_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    reason          TEXT,
    metadata        JSONB       DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaign_status_history_campaign_id ON campaign_status_history (campaign_id);
CREATE INDEX idx_campaign_status_history_to_status ON campaign_status_history (to_status);
CREATE INDEX idx_campaign_status_history_created_at ON campaign_status_history (created_at DESC);

COMMENT ON TABLE campaign_status_history IS 'Historial inmutable de cambios de estado de campañas.';

-- -----------------------------------------------------------------------------
-- Table: campaign_followers
-- Description: Users following campaigns for updates
-- -----------------------------------------------------------------------------
CREATE TABLE campaign_followers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notify_updates  BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, user_id)
);

CREATE INDEX idx_campaign_followers_campaign_id ON campaign_followers (campaign_id);
CREATE INDEX idx_campaign_followers_user_id ON campaign_followers (user_id);

COMMENT ON TABLE campaign_followers IS 'Usuarios que siguen una campaña para recibir actualizaciones.';

-- -----------------------------------------------------------------------------
-- Table: reward_tiers
-- Description: Reward levels defined by entrepreneur for their campaign
-- -----------------------------------------------------------------------------
CREATE TABLE reward_tiers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID           NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    title               VARCHAR(200)   NOT NULL,
    description         TEXT           NOT NULL,
    amount              NUMERIC(12,2)  CHECK (amount > 0),
    currency            VARCHAR(3)     NOT NULL DEFAULT 'BOB',
    max_claims          INTEGER,
    current_claims      INTEGER        NOT NULL DEFAULT 0 CHECK (current_claims >= 0),
    estimated_delivery  DATE,
    includes_shipping   BOOLEAN        NOT NULL DEFAULT false,
    shipping_details    TEXT,
    image_url           VARCHAR(512),
    expires_at          TIMESTAMPTZ,
    items               JSONB          DEFAULT '[]',
    sort_order          INTEGER        NOT NULL DEFAULT 0,
    is_active           BOOLEAN        NOT NULL DEFAULT true,
    min_percentage      NUMERIC(5,2)   NOT NULL DEFAULT 0
                        CHECK (min_percentage >= 0 AND min_percentage <= 100),
    max_percentage      NUMERIC(5,2)   NOT NULL DEFAULT 100
                        CHECK (max_percentage >= 0 AND max_percentage <= 100),
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    UNIQUE (id, campaign_id)
);

CREATE INDEX idx_reward_tiers_campaign_id ON reward_tiers (campaign_id);
CREATE INDEX idx_reward_tiers_amount ON reward_tiers (campaign_id, amount);
CREATE INDEX idx_reward_tiers_is_active ON reward_tiers (campaign_id, is_active) WHERE is_active = true;
CREATE INDEX idx_reward_tiers_percentage ON reward_tiers (campaign_id, min_percentage, max_percentage) WHERE is_active = true;

CREATE TRIGGER trg_reward_tiers_updated_at
    BEFORE UPDATE ON reward_tiers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE reward_tiers IS 'Niveles de recompensa de campañas.';

-- =============================================================================
-- LEVEL 5: Depends on campaigns + users
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: investments
-- Description: Each monetary contribution from an investor to a campaign
-- -----------------------------------------------------------------------------
CREATE TABLE investments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID           NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
    investor_id         UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reward_tier_id      UUID,
    amount              NUMERIC(12,2)  NOT NULL CHECK (amount > 0),
    currency            VARCHAR(3)     NOT NULL DEFAULT 'BOB',
    status              VARCHAR(20)    NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                            'pending', 'processing', 'completed', 'failed',
                            'refunded', 'partially_refunded', 'cancelled'
                        )),
    payment_method      VARCHAR(30),
    is_anonymous        BOOLEAN        NOT NULL DEFAULT false,
    refund_reason       TEXT,
    refunded_amount     NUMERIC(12,2)  DEFAULT 0,
    refunded_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    FOREIGN KEY (reward_tier_id, campaign_id) REFERENCES reward_tiers(id, campaign_id) ON DELETE SET NULL
);

-- Standard indexes
CREATE INDEX idx_investments_campaign_id ON investments (campaign_id);
CREATE INDEX idx_investments_investor_id ON investments (investor_id);
CREATE INDEX idx_investments_status ON investments (status);
CREATE INDEX idx_investments_reward_tier_id ON investments (reward_tier_id) WHERE reward_tier_id IS NOT NULL;
CREATE INDEX idx_investments_created_at ON investments (created_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_investments_campaign_status ON investments (campaign_id, status);
CREATE INDEX idx_investments_investor_status ON investments (investor_id, status);

-- Partial index for completed investments (financial reporting)
CREATE INDEX idx_investments_completed ON investments (campaign_id, amount) WHERE status = 'completed';

CREATE TRIGGER trg_investments_updated_at
    BEFORE UPDATE ON investments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE investments IS 'Cada aporte monetario de un inversor a una campaña.';

-- -----------------------------------------------------------------------------
-- Table: messages
-- Description: Messages within conversations — supports attachments and threading
-- -----------------------------------------------------------------------------
CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID         NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id           UUID         REFERENCES users(id) ON DELETE SET NULL,
    parent_message_id   UUID         REFERENCES messages(id) ON DELETE SET NULL,
    content             TEXT         NOT NULL,
    message_type        VARCHAR(20)  NOT NULL DEFAULT 'text'
                        CHECK (message_type IN ('text', 'image', 'file', 'system')),
    attachments         JSONB        DEFAULT '[]',
    is_edited           BOOLEAN      NOT NULL DEFAULT false,
    edited_at           TIMESTAMPTZ,
    is_deleted          BOOLEAN      NOT NULL DEFAULT false,
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX idx_messages_sender_id ON messages (sender_id);
CREATE INDEX idx_messages_parent_message_id ON messages (parent_message_id) WHERE parent_message_id IS NOT NULL;
CREATE INDEX idx_messages_created_at ON messages (created_at DESC);
CREATE INDEX idx_messages_conversation_active ON messages (conversation_id, created_at DESC) WHERE is_deleted = false;

COMMENT ON TABLE messages IS 'Mensajes dentro de conversaciones. Soporte para adjuntos y threading.';

-- =============================================================================
-- LEVEL 6: Depends on investments + reward_tiers
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: transactions
-- Description: Financial ledger — every monetary movement, auditable
-- -----------------------------------------------------------------------------
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
    base_amount             NUMERIC(12,2),
    base_currency           VARCHAR(3),
    exchange_rate           NUMERIC(10,6),
    fee_amount              NUMERIC(10,2)  DEFAULT 0,
    platform_fee            NUMERIC(12,2)  DEFAULT 0,
    provider_fee            NUMERIC(12,2)  DEFAULT 0,
    net_amount              NUMERIC(12,2),
    payout_id               UUID, -- FK to be added after payouts table
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
CREATE INDEX idx_transactions_transaction_type ON transactions (transaction_type);
CREATE INDEX idx_transactions_status ON transactions (status);
CREATE INDEX idx_transactions_gateway_id ON transactions (gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;
CREATE INDEX idx_transactions_created_at ON transactions (created_at DESC);
CREATE INDEX idx_transactions_processed_at ON transactions (processed_at DESC) WHERE processed_at IS NOT NULL;

-- Composite index for financial reporting
CREATE INDEX idx_transactions_type_status ON transactions (transaction_type, status);

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE transactions IS 'Registro contable de cada movimiento financiero. Auditable y reconciliable.';

-- -----------------------------------------------------------------------------
-- Table: reward_claims
-- Description: Claimed rewards by investors — delivery tracking
-- -----------------------------------------------------------------------------
CREATE TABLE reward_claims (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id       UUID         NOT NULL UNIQUE REFERENCES investments(id) ON DELETE CASCADE,
    status              VARCHAR(20)  NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'issue_reported')),
    shipping_address    JSONB,
    tracking_number     VARCHAR(200),
    tracking_url        VARCHAR(512),
    shipped_at          TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reward_claims_investment_id ON reward_claims (investment_id);
CREATE INDEX idx_reward_claims_status ON reward_claims (status);

CREATE TRIGGER trg_reward_claims_updated_at
    BEFORE UPDATE ON reward_claims
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE reward_claims IS 'Recompensas reclamadas por inversores con tracking de entrega.';

-- =============================================================================
-- VIEWS (Optional but useful for API)
-- =============================================================================

-- View: Active published campaigns with category info
CREATE OR REPLACE VIEW v_published_campaigns AS
SELECT
    c.id,
    c.title,
    c.slug,
    c.short_description,
    c.campaign_type,
    c.goal_amount,
    c.current_amount,
    c.investor_count,
    c.currency,
    c.cover_image_url,
    c.start_date,
    c.end_date,
    c.is_featured,
    c.view_count,
    c.location,
    c.tags,
    c.published_at,
    cat.display_name AS category_name,
    cat.slug AS category_slug,
    cat.icon AS category_icon,
    cat.color AS category_color,
    CASE
        WHEN c.goal_amount > 0 THEN ROUND((c.current_amount / c.goal_amount) * 100, 1)
        ELSE 0
    END AS funding_percentage,
    CASE
        WHEN c.end_date IS NOT NULL THEN EXTRACT(DAY FROM (c.end_date - NOW()))::INTEGER
        ELSE NULL
    END AS days_remaining
FROM campaigns c
JOIN categories cat ON c.category_id = cat.id
WHERE c.status = 'published';

COMMENT ON VIEW v_published_campaigns IS 'Vista de campañas publicadas con información de categoría y progreso.';

-- View: Investment summary per campaign
CREATE OR REPLACE VIEW v_campaign_investment_summary AS
SELECT
    c.id AS campaign_id,
    c.title,
    c.slug,
    c.goal_amount,
    c.current_amount,
    c.investor_count,
    COUNT(DISTINCT i.id) AS total_investments,
    COUNT(DISTINCT i.investor_id) AS unique_investors,
    COALESCE(SUM(CASE WHEN i.status = 'completed' THEN i.amount ELSE 0 END), 0) AS confirmed_amount,
    COALESCE(SUM(CASE WHEN i.status = 'pending' THEN i.amount ELSE 0 END), 0) AS pending_amount,
    COALESCE(SUM(CASE WHEN i.status = 'refunded' THEN i.amount ELSE 0 END), 0) AS refunded_amount,
    COALESCE(AVG(CASE WHEN i.status = 'completed' THEN i.amount END), 0) AS avg_investment
FROM campaigns c
LEFT JOIN investments i ON c.id = i.campaign_id
GROUP BY c.id, c.title, c.slug, c.goal_amount, c.current_amount, c.investor_count;

COMMENT ON VIEW v_campaign_investment_summary IS 'Resumen de inversiones por campaña para dashboards.';

-- =============================================================================
-- NEW FINTECH TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: payouts
-- Description: Desembolsos de fondos a creadores de campañas
-- -----------------------------------------------------------------------------
CREATE TABLE payouts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID           NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
    amount              NUMERIC(12,2)  NOT NULL CHECK (amount > 0),
    currency            VARCHAR(3)     NOT NULL DEFAULT 'BOB',
    status              VARCHAR(20)    NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    processed_at        TIMESTAMPTZ,
    metadata            JSONB          DEFAULT '{}',
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payouts_campaign_id ON payouts (campaign_id);
CREATE INDEX idx_payouts_status ON payouts (status);

CREATE TRIGGER trg_payouts_updated_at
    BEFORE UPDATE ON payouts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE payouts IS 'Desembolsos financieros hacia los creadores de campañas.';

-- Add FK from transactions to payouts
ALTER TABLE transactions
    ADD CONSTRAINT fk_transactions_payout_id
    FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE SET NULL;

-- =============================================================================
-- FUNCTIONS AND TRIGGERS (FINTECH LEVEL)
-- =============================================================================

-- 1. Permisos Admin JSONB
CREATE OR REPLACE FUNCTION admin_has_permission(p_admin_id UUID, p_permission VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    SELECT (permissions ? p_permission) INTO v_has_permission
    FROM admin_profiles
    WHERE id = p_admin_id AND is_active = true;
    
    RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Inmutabilidad de audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_audit_log_modification
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

-- Revoke permissions for extra safety
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;

-- 4. Sincronización automática de campañas (current_amount, investor_count)
CREATE OR REPLACE FUNCTION sync_campaign_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT or UPDATE where status becomes 'completed'
    IF (TG_OP = 'INSERT' AND NEW.status = 'completed') OR
       (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN
        
        UPDATE campaigns 
        SET current_amount = current_amount + NEW.amount,
            investor_count = (SELECT COUNT(DISTINCT investor_id) FROM investments WHERE campaign_id = NEW.campaign_id AND status = 'completed')
        WHERE id = NEW.campaign_id;
        
    -- Handle UPDATE where status changes FROM 'completed'
    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status != 'completed') THEN
        
        UPDATE campaigns 
        SET current_amount = current_amount - OLD.amount,
            investor_count = (SELECT COUNT(DISTINCT investor_id) FROM investments WHERE campaign_id = OLD.campaign_id AND status = 'completed')
        WHERE id = OLD.campaign_id;

    -- Handle DELETE of a completed investment
    ELSIF (TG_OP = 'DELETE' AND OLD.status = 'completed') THEN
        
        UPDATE campaigns 
        SET current_amount = current_amount - OLD.amount,
            investor_count = (SELECT COUNT(DISTINCT investor_id) FROM investments WHERE campaign_id = OLD.campaign_id AND status = 'completed')
        WHERE id = OLD.campaign_id;
    END IF;

    RETURN NULL; -- AFTER trigger
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_campaign_totals
    AFTER INSERT OR UPDATE OR DELETE ON investments
    FOR EACH ROW
    EXECUTE FUNCTION sync_campaign_totals();

-- 5. Sincronización de reward_tiers.current_claims vía reward_claims
-- El trigger vive en reward_claims (fuente de verdad), no en investments.
-- Así current_claims refleja registros físicos existentes, no el estado de la inversión.
CREATE OR REPLACE FUNCTION fn_sync_reward_tier_claims()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE reward_tiers
        SET current_claims = current_claims + 1
        WHERE id = (SELECT reward_tier_id FROM investments WHERE id = NEW.investment_id);

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE reward_tiers
        SET current_claims = GREATEST(current_claims - 1, 0)
        WHERE id = (SELECT reward_tier_id FROM investments WHERE id = OLD.investment_id);
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_reward_tier_claims
    AFTER INSERT OR DELETE ON reward_claims
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_reward_tier_claims();

-- 6. Sincronización automática de categories (campaign_count)
CREATE OR REPLACE FUNCTION sync_category_campaigns()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE categories SET campaign_count = campaign_count + 1 WHERE id = NEW.category_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.category_id != NEW.category_id THEN
        UPDATE categories SET campaign_count = campaign_count - 1 WHERE id = OLD.category_id;
        UPDATE categories SET campaign_count = campaign_count + 1 WHERE id = NEW.category_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE categories SET campaign_count = campaign_count - 1 WHERE id = OLD.category_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_category_campaigns
    AFTER INSERT OR UPDATE OR DELETE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION sync_category_campaigns();