-- MySQL 8.0+ Schema for Crowdfunding Platform
-- Generated for Hostinger deployment

CREATE DATABASE IF NOT EXISTS crowdfunding CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE crowdfunding;

-- ============================================
-- ROLES & AUTHENTICATION
-- ============================================

CREATE TABLE roles (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  phone VARCHAR(20),
  timezone VARCHAR(50) DEFAULT 'America/La_Paz',
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  preferred_language VARCHAR(10) DEFAULT 'es',
  oauth_provider VARCHAR(20),
  oauth_provider_id VARCHAR(255),
  avatar_url TEXT,
  last_login_at TIMESTAMP NULL,
  last_login_ip VARCHAR(45),
  failed_login_attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_oauth (oauth_provider, oauth_provider_id),
  KEY idx_email (email),
  KEY idx_oauth_provider (oauth_provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_roles (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  role_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_role (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ADMIN & KYC
-- ============================================

CREATE TABLE admin_profiles (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  access_level ENUM('admin', 'super_admin') DEFAULT 'admin',
  can_approve_campaigns BOOLEAN DEFAULT FALSE,
  can_manage_users BOOLEAN DEFAULT FALSE,
  can_manage_finances BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_access_level (access_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CATEGORIES & CAMPAIGNS
-- ============================================

CREATE TABLE categories (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(100),
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon_url VARCHAR(500),
  color VARCHAR(10),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_active_sort (is_active, sort_order),
  KEY idx_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaigns (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  creator_id VARCHAR(36) NOT NULL,
  category_id VARCHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  subtitle VARCHAR(255),
  description LONGTEXT,
  short_description TEXT,
  campaign_type VARCHAR(50) DEFAULT 'donation',
  status VARCHAR(50) DEFAULT 'draft',
  goal_amount DECIMAL(15, 2) NOT NULL,
  current_amount DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'BOB',
  min_investment DECIMAL(15, 2),
  max_investment DECIMAL(15, 2),
  investor_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  cover_image_url TEXT,
  video_url TEXT,
  location VARCHAR(255),
  start_date TIMESTAMP NULL,
  end_date TIMESTAMP NULL,
  funded_at TIMESTAMP NULL,
  published_at TIMESTAMP NULL,
  is_featured BOOLEAN DEFAULT FALSE,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  KEY idx_creator (creator_id),
  KEY idx_status (status),
  KEY idx_category (category_id),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_updates (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  campaign_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(36) NOT NULL,
  title VARCHAR(200),
  content LONGTEXT,
  is_public BOOLEAN DEFAULT TRUE,
  attachments JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_status_history (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  campaign_id VARCHAR(36) NOT NULL,
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  changed_by VARCHAR(36),
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_campaign (campaign_id),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_reviews (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  campaign_id VARCHAR(36) NOT NULL,
  reviewer_id VARCHAR(36),
  decision VARCHAR(50),
  feedback LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_documents (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  campaign_id VARCHAR(36) NOT NULL,
  file_url TEXT NOT NULL,
  original_name VARCHAR(255),
  mime_type VARCHAR(100),
  file_size_bytes BIGINT,
  justification TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  reviewer_notes TEXT,
  reviewed_by VARCHAR(36),
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- PROFILES: ENTREPRENEUR & INVESTOR
-- ============================================

CREATE TABLE entrepreneur_profiles (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  display_name VARCHAR(100),
  bio TEXT,
  company_name VARCHAR(255),
  website VARCHAR(500),
  linkedin_url VARCHAR(500),
  address_line VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  bank_account_number VARCHAR(50),
  bank_name VARCHAR(100),
  avatar_url TEXT,
  cover_url TEXT,
  kyc_status VARCHAR(50) DEFAULT 'pending',
  identity_verified BOOLEAN DEFAULT FALSE,
  identity_verified_at TIMESTAMP NULL,
  kyc_rejection_reason TEXT,
  verification_documents JSON,
  total_campaigns INT DEFAULT 0,
  total_raised DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_kyc_status (kyc_status),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE investor_profiles (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  display_name VARCHAR(100),
  bio TEXT,
  investor_type VARCHAR(50) DEFAULT 'individual',
  tax_id VARCHAR(100),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  avatar_url TEXT,
  cover_url TEXT,
  preferred_categories JSON,
  min_investment DECIMAL(15, 2),
  max_investment DECIMAL(15, 2),
  total_investments INT DEFAULT 0,
  total_invested DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INVESTMENTS & REWARDS
-- ============================================

CREATE TABLE reward_tiers (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  campaign_id VARCHAR(36) NOT NULL,
  title VARCHAR(200),
  description LONGTEXT,
  amount DECIMAL(15, 2),
  currency VARCHAR(10) DEFAULT 'BOB',
  min_percentage DECIMAL(5, 2) DEFAULT 0,
  max_percentage DECIMAL(5, 2) DEFAULT 100,
  max_claims INT,
  current_claims INT DEFAULT 0,
  estimated_delivery DATE,
  includes_shipping BOOLEAN DEFAULT FALSE,
  shipping_details TEXT,
  image_url TEXT,
  expires_at TIMESTAMP NULL,
  items JSON,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  KEY idx_campaign (campaign_id),
  KEY idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE investments (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  campaign_id VARCHAR(36) NOT NULL,
  investor_id VARCHAR(36) NOT NULL,
  reward_tier_id VARCHAR(36),
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'BOB',
  status VARCHAR(50) DEFAULT 'pending',
  is_anonymous BOOLEAN DEFAULT FALSE,
  refunded_amount DECIMAL(15, 2) DEFAULT 0,
  refund_reason VARCHAR(255),
  refunded_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE RESTRICT,
  FOREIGN KEY (investor_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (reward_tier_id) REFERENCES reward_tiers(id) ON DELETE SET NULL,
  KEY idx_investor (investor_id),
  KEY idx_campaign (campaign_id),
  KEY idx_status (status),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reward_claims (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  investment_id VARCHAR(36) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'pending',
  tracking_number VARCHAR(100),
  tracking_url TEXT,
  notes TEXT,
  shipped_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (investment_id) REFERENCES investments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE transactions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  investment_id VARCHAR(36),
  transaction_type VARCHAR(50),
  amount DECIMAL(15, 2),
  status VARCHAR(50) DEFAULT 'pending',
  reference_number VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (investment_id) REFERENCES investments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE capital_transactions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(50),
  amount DECIMAL(15, 2),
  previous_max DECIMAL(15, 2),
  new_max DECIMAL(15, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_user (user_id),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CHAT & NOTIFICATIONS
-- ============================================

CREATE TABLE conversations (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  campaign_id VARCHAR(36),
  subject VARCHAR(255),
  conversation_type VARCHAR(50) DEFAULT 'direct',
  status VARCHAR(50) DEFAULT 'active',
  message_count INT DEFAULT 0,
  last_message_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  KEY idx_status (status),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE conversation_participants (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  conversation_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  last_read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_conv (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  conversation_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  content LONGTEXT,
  message_type VARCHAR(50) DEFAULT 'text',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_conversation (conversation_id),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notification_types (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  type_id VARCHAR(36),
  title VARCHAR(200),
  body TEXT,
  channel VARCHAR(50) DEFAULT 'in_app',
  reference_type VARCHAR(50),
  reference_id VARCHAR(36),
  action_url TEXT,
  data JSON,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (type_id) REFERENCES notification_types(id) ON DELETE SET NULL,
  KEY idx_user_read (user_id, is_read),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- COMMENTS
-- ============================================

CREATE TABLE campaign_comments (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  campaign_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(36) NOT NULL,
  content LONGTEXT,
  likes_count INT DEFAULT 0,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_campaign (campaign_id),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comment_likes (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  comment_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_comment_user (comment_id, user_id),
  FOREIGN KEY (comment_id) REFERENCES campaign_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SEED: Roles & Notification Types
-- ============================================

INSERT IGNORE INTO roles (id, name, description) VALUES
('role-investor', 'investor', 'Usuario que realiza donaciones/inversiones'),
('role-entrepreneur', 'entrepreneur', 'Usuario que crea campañas'),
('role-admin', 'admin', 'Administrador'),
('role-super-admin', 'super_admin', 'Super Administrador');

INSERT IGNORE INTO notification_types (id, code, name) VALUES
('nt-investment', 'investment_received', 'Nueva inversión'),
('nt-campaign-approved', 'campaign_approved', 'Campaña aprobada'),
('nt-campaign-rejected', 'campaign_rejected', 'Campaña rechazada'),
('nt-message', 'new_message', 'Nuevo mensaje'),
('nt-campaign-funded', 'campaign_funded', 'Campaña financiada');
