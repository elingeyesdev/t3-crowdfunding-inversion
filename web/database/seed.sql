-- =============================================================================
-- CROWDFUNDING PLATFORM — SEED DATA
-- =============================================================================
-- Run this AFTER schema.sql
-- Contains: roles, categories, notification_types, sample admin user
-- =============================================================================

-- =============================================================================
-- 1. ROLES
-- =============================================================================
INSERT INTO roles (name, display_name, description) VALUES
    ('entrepreneur', 'Emprendedor', 'Puede crear y gestionar campañas de crowdfunding'),
    ('investor', 'Inversor', 'Puede invertir en campañas y recibir recompensas'),
    ('admin', 'Administrador', 'Puede revisar campañas, moderar contenido y gestionar la plataforma');

-- =============================================================================
-- 2. CATEGORIES
-- =============================================================================
INSERT INTO categories (name, display_name, description, icon, color, slug, sort_order) VALUES
    ('technology',       'Tecnología',           'Proyectos de software, hardware, apps y gadgets',                   'cpu',            '#3B82F6', 'technology',       1),
    ('health',           'Salud y Bienestar',    'Dispositivos médicos, apps de salud y bienestar',                   'heart-pulse',    '#EF4444', 'health',           2),
    ('education',        'Educación',            'Plataformas educativas, cursos y herramientas de aprendizaje',      'graduation-cap', '#8B5CF6', 'education',        3),
    ('environment',      'Medio Ambiente',       'Proyectos de sostenibilidad, energía limpia y conservación',        'leaf',           '#10B981', 'environment',      4),
    ('art',              'Arte y Cultura',       'Proyectos artísticos, música, cine y expresión cultural',           'palette',        '#F59E0B', 'art',              5),
    ('social_impact',    'Impacto Social',       'Emprendimientos con impacto social positivo',                       'users',          '#06B6D4', 'social-impact',    6),
    ('food',             'Alimentos y Bebidas',  'Productos alimenticios, restaurantes y gastronomía',                'utensils',       '#F97316', 'food',             7),
    ('fashion',          'Moda y Diseño',        'Ropa, accesorios, joyería y diseño textil',                         'shirt',          '#EC4899', 'fashion',          8),
    ('gaming',           'Videojuegos',          'Videojuegos, eSports y entretenimiento interactivo',                'gamepad-2',      '#6366F1', 'gaming',           9),
    ('real_estate',      'Bienes Raíces',        'Proyectos inmobiliarios y de construcción',                         'building',       '#78716C', 'real-estate',      10),
    ('fintech',          'Fintech',              'Servicios financieros, pagos, blockchain y criptomonedas',          'wallet',         '#14B8A6', 'fintech',          11),
    ('agriculture',      'Agricultura',          'Agrotecnología, cultivos y producción agrícola',                    'sprout',         '#84CC16', 'agriculture',      12),
    ('mobility',         'Movilidad',            'Transporte, vehículos eléctricos y logística',                      'car',            '#0EA5E9', 'mobility',         13),
    ('media',            'Medios y Comunicación', 'Periodismo, podcasts, streaming y medios digitales',               'radio',          '#A855F7', 'media',            14),
    ('community',        'Comunidad',            'Proyectos comunitarios, cooperativas y espacios compartidos',       'home',           '#F43F5E', 'community',        15);

-- =============================================================================
-- 3. NOTIFICATION TYPES
-- =============================================================================
INSERT INTO notification_types (code, name, description, template, category, default_channels) VALUES
    -- System notifications
    ('welcome',                     'Bienvenida',                           'Mensaje de bienvenida al registrarse',                                 'Bienvenido a la plataforma, {{user_name}}. ¡Estamos felices de tenerte!',                          'system',       '["in_app", "email"]'),
    ('email_verified',              'Email Verificado',                     'Confirmación de verificación de email',                                'Tu email ha sido verificado exitosamente.',                                                         'system',       '["in_app"]'),
    ('password_changed',            'Contraseña Cambiada',                  'Notificación de cambio de contraseña',                                 'Tu contraseña fue actualizada. Si no realizaste este cambio, contacta soporte.',                    'system',       '["in_app", "email"]'),
    ('account_suspended',           'Cuenta Suspendida',                    'Notificación de suspensión de cuenta',                                 'Tu cuenta ha sido suspendida. Motivo: {{reason}}. Contacta soporte para más información.',          'system',       '["in_app", "email"]'),
    
    -- Campaign notifications
    ('campaign_submitted',          'Campaña Enviada a Revisión',           'La campaña fue enviada para revisión',                                 'Tu campaña "{{campaign_title}}" ha sido enviada a revisión.',                                       'campaign',     '["in_app", "email"]'),
    ('campaign_approved',           'Campaña Aprobada',                     'La campaña fue aprobada por un admin',                                 '¡Tu campaña "{{campaign_title}}" ha sido aprobada! Ya puedes publicarla.',                          'campaign',     '["in_app", "email", "push"]'),
    ('campaign_rejected',           'Campaña Rechazada',                    'La campaña fue rechazada por un admin',                                'Tu campaña "{{campaign_title}}" necesita cambios. Revisa el feedback del equipo.',                  'campaign',     '["in_app", "email"]'),
    ('campaign_published',          'Campaña Publicada',                    'La campaña fue publicada exitosamente',                                '¡Tu campaña "{{campaign_title}}" está en vivo! Compártela para alcanzar tu meta.',                  'campaign',     '["in_app", "email", "push"]'),
    ('campaign_finalized',          'Campaña Finalizada',                   'La campaña fue finalizada por su creador o por vencimiento',           'Tu campaña "{{campaign_title}}" ha sido finalizada y ya no recibirá nuevas inversiones.',            'campaign',     '["in_app", "email"]'),
    ('campaign_funded',             'Campaña Financiada',                   'La campaña alcanzó su meta',                                           '🎉 ¡Felicidades! Tu campaña "{{campaign_title}}" alcanzó su meta de {{goal_amount}}.',              'campaign',     '["in_app", "email", "push"]'),
    ('campaign_failed',             'Campaña No Financiada',                'La campaña no alcanzó su meta',                                        'Tu campaña "{{campaign_title}}" no alcanzó su meta antes de la fecha límite.',                      'campaign',     '["in_app", "email"]'),
    ('campaign_update',             'Actualización de Campaña',             'El emprendedor publicó una actualización',                              'Nueva actualización en "{{campaign_title}}": {{update_title}}',                                     'campaign',     '["in_app", "push"]'),
    ('campaign_ending_soon',        'Campaña por Terminar',                 'La campaña termina pronto',                                            '⏰ La campaña "{{campaign_title}}" termina en {{days_remaining}} días.',                             'campaign',     '["in_app", "email", "push"]'),
    
    -- Investment notifications
    ('investment_received',         'Inversión Recibida',                   'Se recibió una nueva inversión en tu campaña',                          '💰 Recibiste una inversión de {{amount}} {{currency}} en "{{campaign_title}}".',                     'investment',   '["in_app", "email", "push"]'),
    ('investment_confirmed',        'Inversión Confirmada',                 'La inversión fue procesada exitosamente',                               'Tu inversión de {{amount}} {{currency}} en "{{campaign_title}}" fue procesada exitosamente.',       'investment',   '["in_app", "email"]'),
    ('investment_failed',           'Inversión Fallida',                    'El procesamiento de la inversión falló',                               'Hubo un problema al procesar tu inversión en "{{campaign_title}}". Intenta nuevamente.',            'investment',   '["in_app", "email"]'),
    ('refund_processed',            'Reembolso Procesado',                  'Se procesó un reembolso',                                              'Tu reembolso de {{amount}} {{currency}} de "{{campaign_title}}" fue procesado.',                    'investment',   '["in_app", "email"]'),
    
    -- Reward notifications
    ('reward_shipped',              'Recompensa Enviada',                   'La recompensa fue enviada',                                            '📦 Tu recompensa de "{{campaign_title}}" ha sido enviada. Tracking: {{tracking_number}}',           'reward',       '["in_app", "email", "push"]'),
    ('reward_delivered',            'Recompensa Entregada',                 'La recompensa fue entregada',                                          '✅ Tu recompensa de "{{campaign_title}}" fue entregada exitosamente.',                               'reward',       '["in_app"]'),
    
    -- Message notifications
    ('new_message',                 'Nuevo Mensaje',                        'Se recibió un nuevo mensaje',                                          'Tienes un nuevo mensaje de {{sender_name}}.',                                                       'message',      '["in_app", "push"]'),

    -- KYC notifications
    ('kyc_approved',                'KYC Aprobado',                         'La verificación KYC fue aprobada',                                     'Tu verificación KYC fue aprobada. Ya puedes operar sin restricciones.',                              'system',       '["in_app", "email"]'),
    ('kyc_rejected',                'KYC Rechazado',                        'La verificación KYC fue rechazada',                                    'Tu verificación KYC fue rechazada. Revisa los documentos y vuelve a intentar.',                     'system',       '["in_app", "email"]'),
    
    -- Admin notifications
    ('new_campaign_to_review',      'Nueva Campaña para Revisión',          'Una campaña necesita ser revisada',                                    'Hay una nueva campaña pendiente de revisión: "{{campaign_title}}".',                                'admin',        '["in_app", "email"]');

-- =============================================================================
-- 4. SAMPLE SUPER ADMIN (Uncomment and customize for your environment)
-- =============================================================================
-- WARNING: Change the password_hash to a real bcrypt hash in production!
-- Example bcrypt hash for "Admin123!" (DO NOT USE IN PRODUCTION):
-- $2b$12$LJ3UlGHhoIFG8.0wH5AtNeDCX1FJCb8jZ4MKj3cEmJV1q6L.kD.yG

/*
-- Create admin user
INSERT INTO users (id, email, password_hash, email_verified, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@crowdfunding.com',
    '$2b$12$LJ3UlGHhoIFG8.0wH5AtNeDCX1FJCb8jZ4MKj3cEmJV1q6L.kD.yG', -- CHANGE THIS!
    true,
    true
);

-- Assign admin role
INSERT INTO user_roles (user_id, role_id)
SELECT 
    'a0000000-0000-0000-0000-000000000001',
    id
FROM roles WHERE name = 'admin';

-- Create admin profile
INSERT INTO admin_profiles (user_id, first_name, last_name, employee_id, department, access_level, can_approve_campaigns, can_manage_users, can_manage_finances)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Super',
    'Admin',
    'EMP-001',
    'Platform Management',
    'super_admin',
    true,
    true,
    true
);
*/

-- =============================================================================
-- 5. VERIFICATION QUERIES
-- =============================================================================

-- Verify all tables were created
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    
    RAISE NOTICE '✅ Total tables created: %', table_count;
    
    IF table_count < 23 THEN
        RAISE WARNING '⚠️ Expected 23 tables, found %. Some tables may be missing.', table_count;
    ELSE
        RAISE NOTICE '✅ All 23 tables created successfully!';
    END IF;
END $$;

-- Verify seed data counts
DO $$
DECLARE
    role_count INTEGER;
    category_count INTEGER;
    notif_type_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO role_count FROM roles;
    SELECT COUNT(*) INTO category_count FROM categories;
    SELECT COUNT(*) INTO notif_type_count FROM notification_types;
    
    RAISE NOTICE '✅ Roles inserted: %', role_count;
    RAISE NOTICE '✅ Categories inserted: %', category_count;
    RAISE NOTICE '✅ Notification types inserted: %', notif_type_count;
END $$;

-- =============================================================================
-- SEED DATA COMPLETE
-- =============================================================================
