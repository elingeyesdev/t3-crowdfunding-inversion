-- ============================================================
-- SEED DEMO: Ingesta de datos realistas para equipo09
-- Contraseña de todos los usuarios semilla: Seed2024!
-- ============================================================

-- ------------------------------------------------------------
-- 0. Tablas faltantes del módulo de comentarios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_comments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    author_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT        NOT NULL CHECK (char_length(content) > 0),
    likes_count INTEGER     NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
    is_deleted  BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comment_likes (
    comment_id UUID        NOT NULL REFERENCES campaign_comments(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_comments_campaign ON campaign_comments (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_comments_created  ON campaign_comments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user         ON comment_likes (user_id);

-- Notification types adicionales
INSERT INTO notification_types (code, name, description, category, template, default_channels) VALUES
  ('investment_received',  'Inversión Recibida',      'Al emprendedor cuando recibe una inversión',          'investment', 'Tu campaña {{campaign}} recibió Bs. {{amount}}',              '["in_app"]'),
  ('campaign_funded',      'Campaña Financiada',      'La campaña alcanzó su meta',                         'campaign',   'Tu campaña {{campaign}} alcanzó su meta de financiamiento',   '["in_app"]'),
  ('investment_confirmed', 'Inversión Confirmada',    'Confirmación de inversión al inversor',               'investment', 'Tu inversión de Bs. {{amount}} en {{campaign}} fue confirmada','["in_app"]'),
  ('reward_pending',       'Recompensa Pendiente',    'Aviso de recompensa por recibir',                    'reward',     'Tienes una recompensa pendiente en {{campaign}}',              '["in_app"]'),
  ('campaign_update',      'Actualización Campaña',   'El emprendedor publicó una actualización',            'campaign',   '{{campaign}} tiene una nueva actualización',                  '["in_app"]')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SEED PRINCIPAL
-- ============================================================
DO $$
DECLARE
  r_entrepreneur UUID; r_investor UUID;
  nt_inv UUID; nt_funded UUID; nt_conf UUID;

  cat_tech UUID; cat_edu  UUID; cat_env  UUID; cat_food UUID;
  cat_health UUID; cat_fin UUID; cat_agri UUID; cat_art  UUID;
  cat_comm UUID; cat_social UUID;

  pwd TEXT := '$2b$12$FkaeWaq4n7vws.HRGAlTWuNUs7Wkm0pjSFPvY3NQerBi735Wgni2m';

  -- Emprendedores
  u_maria UUID; u_carlos UUID; u_ana UUID; u_roberto UUID; u_valentina UUID;
  -- Inversores
  u_diego UUID; u_sofia UUID; u_juan UUID; u_camila UUID;
  u_andres UUID; u_pat UUID; u_miguel UUID; u_lucia UUID;

  -- Campañas
  c_mindapp UUID; c_codekids UUID; c_solar UUID; c_riego UUID; c_sabores UUID;
  c_pagorural UUID; c_clinica UUID; c_festival UUID; c_biblio UUID; c_vivienda UUID;

  -- Reward tiers
  rt_m1 UUID; rt_m2 UUID; rt_m3 UUID;
  rt_c1 UUID; rt_c2 UUID; rt_c3 UUID;
  rt_s1 UUID; rt_s2 UUID; rt_s3 UUID;
  rt_sb1 UUID; rt_sb2 UUID;
  rt_cl1 UUID; rt_cl2 UUID;
  rt_f1 UUID; rt_f2 UUID;
  rt_b1 UUID; rt_b2 UUID;

  inv UUID; com UUID;
BEGIN
  -- Refs
  SELECT id INTO r_entrepreneur FROM roles WHERE name = 'entrepreneur';
  SELECT id INTO r_investor     FROM roles WHERE name = 'investor';
  SELECT id INTO nt_inv     FROM notification_types WHERE code = 'investment_received';
  SELECT id INTO nt_funded  FROM notification_types WHERE code = 'campaign_funded';
  SELECT id INTO nt_conf    FROM notification_types WHERE code = 'investment_confirmed';
  SELECT id INTO cat_tech   FROM categories WHERE name = 'technology';
  SELECT id INTO cat_edu    FROM categories WHERE name = 'education';
  SELECT id INTO cat_env    FROM categories WHERE name = 'environment';
  SELECT id INTO cat_food   FROM categories WHERE name = 'food';
  SELECT id INTO cat_health FROM categories WHERE name = 'health';
  SELECT id INTO cat_fin    FROM categories WHERE name = 'fintech';
  SELECT id INTO cat_agri   FROM categories WHERE name = 'agriculture';
  SELECT id INTO cat_art    FROM categories WHERE name = 'art';
  SELECT id INTO cat_comm   FROM categories WHERE name = 'community';
  SELECT id INTO cat_social FROM categories WHERE name = 'social_impact';

  -- ============================================================
  -- EMPRENDEDORES
  -- ============================================================

  INSERT INTO users (email, password_hash, email_verified, is_active)
  VALUES ('mquispe@startup.bo', pwd, true, true) RETURNING id INTO u_maria;
  INSERT INTO user_roles (user_id, role_id) VALUES (u_maria, r_entrepreneur);
  INSERT INTO entrepreneur_profiles (user_id, first_name, last_name, display_name, bio, company_name, city, country, kyc_status, identity_verified, total_campaigns, avatar_url, cover_url)
  VALUES (u_maria, 'María Fernanda', 'Quispe Mamani', 'MindTech Bolivia',
    'Ingeniera de sistemas con 8 años en startups de impacto social. Especializada en salud digital y EdTech para comunidades vulnerables de Bolivia.',
    'MindTech Bolivia S.R.L.', 'La Paz', 'Bolivia', 'approved', true, 2,
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&h=400&fit=crop');

  INSERT INTO users (email, password_hash, email_verified, is_active)
  VALUES ('cmamani@agroboli.bo', pwd, true, true) RETURNING id INTO u_carlos;
  INSERT INTO user_roles (user_id, role_id) VALUES (u_carlos, r_entrepreneur);
  INSERT INTO entrepreneur_profiles (user_id, first_name, last_name, display_name, bio, company_name, city, country, kyc_status, identity_verified, total_campaigns, avatar_url, cover_url)
  VALUES (u_carlos, 'Carlos', 'Mamani Condori', 'AgroBolivia',
    'Agrónomo y activista medioambiental. 12 años trabajando con comunidades rurales del altiplano en proyectos de soberanía alimentaria y energía renovable.',
    'AgroBolivia Consultores', 'Oruro', 'Bolivia', 'approved', true, 3,
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1200&h=400&fit=crop');

  INSERT INTO users (email, password_hash, email_verified, is_active)
  VALUES ('atorrez@sabores.bo', pwd, true, true) RETURNING id INTO u_ana;
  INSERT INTO user_roles (user_id, role_id) VALUES (u_ana, r_entrepreneur);
  INSERT INTO entrepreneur_profiles (user_id, first_name, last_name, display_name, bio, company_name, city, country, kyc_status, identity_verified, total_campaigns, avatar_url, cover_url)
  VALUES (u_ana, 'Ana Lucía', 'Torrez Vásquez', 'Sabores de Bolivia',
    'Chef y gestora cultural. Defensora de la gastronomía boliviana patrimonial. Organizo eventos que fusionan tradición culinaria con emprendimiento.',
    'Sabores de Bolivia S.R.L.', 'La Paz', 'Bolivia', 'approved', true, 2,
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&h=400&fit=crop');

  INSERT INTO users (email, password_hash, email_verified, is_active)
  VALUES ('rsalazar@fintech.bo', pwd, true, true) RETURNING id INTO u_roberto;
  INSERT INTO user_roles (user_id, role_id) VALUES (u_roberto, r_entrepreneur);
  INSERT INTO entrepreneur_profiles (user_id, first_name, last_name, display_name, bio, company_name, city, country, kyc_status, identity_verified, total_campaigns, avatar_url, cover_url)
  VALUES (u_roberto, 'Roberto', 'Salazar Vaca', 'PagoRural',
    'Economista y desarrollador. Creo soluciones financieras para los 2.5 millones de bolivianos sin acceso a banca tradicional. Exbecario del MIT Media Lab.',
    'PagoRural Technologies', 'Santa Cruz', 'Bolivia', 'approved', true, 1,
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1200&h=400&fit=crop');

  INSERT INTO users (email, password_hash, email_verified, is_active)
  VALUES ('vcruz@salud.bo', pwd, true, true) RETURNING id INTO u_valentina;
  INSERT INTO user_roles (user_id, role_id) VALUES (u_valentina, r_entrepreneur);
  INSERT INTO entrepreneur_profiles (user_id, first_name, last_name, display_name, bio, company_name, city, country, kyc_status, identity_verified, total_campaigns, avatar_url, cover_url)
  VALUES (u_valentina, 'Valentina', 'Cruz Flores', 'SaludComunitaria',
    'Médica rural con 10 años de experiencia en zonas de difícil acceso. Fundadora de la red de clínicas móviles más grande del altiplano boliviano.',
    'SaludComunitaria Bolivia', 'El Alto', 'Bolivia', 'approved', true, 2,
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&h=400&fit=crop');

  -- ============================================================
  -- INVERSORES
  -- ============================================================

  INSERT INTO users (email, password_hash, email_verified, is_active)
  VALUES ('dvargas@inversiones.bo', pwd, true, true) RETURNING id INTO u_diego;
  INSERT INTO user_roles (user_id, role_id) VALUES (u_diego, r_investor);
  INSERT INTO investor_profiles (user_id, first_name, last_name, display_name, bio, investor_type, accredited, city, country, max_investment, identity_verified)
  VALUES (u_diego, 'Diego', 'Vargas Romero', 'Diego Vargas',
    'Empresario con 20 años de experiencia. Invierto en startups de impacto social en Bolivia y Latinoamérica.',
    'angel', true, 'La Paz', 'Bolivia', 150000, true);

  INSERT INTO users (email, password_hash, email_verified, is_active)
  VALUES ('smendoza@gmail.com', pwd, true, true) RETURNING id INTO u_sofia;
  INSERT INTO user_roles (user_id, role_id) VALUES (u_sofia, r_investor);
  INSERT INTO investor_profiles (user_id, first_name, last_name, display_name, bio, investor_type, city, country, max_investment, identity_verified)
  VALUES (u_sofia, 'Sofía', 'Mendoza Ríos', 'Sofía Mendoza',
    'Consultora de gestión. Me apasionan los proyectos de educación y tecnología con impacto en comunidades rurales.',
    'individual', 'Cochabamba', 'Bolivia', 50000, true);

  INSERT INTO users (email, password_hash, email_verified, is_active)
  VALUES ('jpflores@capital.bo', pwd, true, true) RETURNING id INTO u_juan;
  INSERT INTO user_roles (user_id, role_id) VALUES (u_juan, r_investor);
  INSERT INTO investor_profiles (user_id, first_name, last_name, display_name, bio, investor_type, accredited, city, country, max_investment, identity_verified)
  VALUES (u_juan, 'Juan Pablo', 'Flores Arce', 'JP Capital',
    'Director de un fondo de inversión social. Busco oportunidades con retorno financiero y alto impacto medioambiental.',
    'institutional', true, 'Santa Cruz', 'Bolivia', 250000, true);

  INSERT INTO users (email, password_hash, email_verified, is_active)
  VALUES ('crojas@inversor.bo', pwd, true, true) RETURNING id INTO u_camila;
  INSERT INTO user_roles (user_id, role_id) VALUES (u_camila, r_investor);
  INSERT INTO investor_profiles (user_id, first_name, last_name, display_name, bio, investor_type, city, country, max_investment, identity_verified)
  VALUES (u_camila, 'Camila', 'Rojas Herrera', 'Camila Rojas',
    'Arquitecta reconvertida en inversora. Me enfoco en proyectos de vivienda sostenible y desarrollo comunitario.',
    'individual', 'La Paz', 'Bolivia', 40000, true);

  INSERT INTO users (email, password_hash, email_verified, is_active)
  VALUES ('agutierrez@angel.bo', pwd, true, true) RETURNING id INTO u_andres;
  INSERT INTO user_roles (user_id, role_id) VALUES (u_andres, r_investor);
  INSERT INTO investor_profiles (user_id, first_name, last_name, display_name, bio, investor_type, accredited, city, country, max_investment, identity_verified)
  VALUES (u_andres, 'Andrés', 'Gutiérrez Paz', 'Andrés G.',
    'Exemprendedor exitoso. Ahora apoyo a la siguiente generación de emprendedores bolivianos.',
    'angel', true, 'La Paz', 'Bolivia', 100000, true);

  INSERT INTO users (email, password_hash, email_verified, is_active)
  VALUES ('pvasquez@inversiones.bo', pwd, true, true) RETURNING id INTO u_pat;
  INSERT INTO user_roles (user_id, role_id) VALUES (u_pat, r_investor);
  INSERT INTO investor_profiles (user_id, first_name, last_name, display_name, bio, investor_type, city, country, max_investment, identity_verified)
  VALUES (u_pat, 'Patricia', 'Vásquez Torrico', 'Patricia V.',
    'Contadora pública. Diversifico mis ahorros invirtiendo en proyectos locales con impacto en salud y educación.',
    'individual', 'Cochabamba', 'Bolivia', 35000, false);

  INSERT INTO users (email, password_hash, email_verified, is_active)
  VALUES ('maperez@gmail.com', pwd, true, true) RETURNING id INTO u_miguel;
  INSERT INTO user_roles (user_id, role_id) VALUES (u_miguel, r_investor);
  INSERT INTO investor_profiles (user_id, first_name, last_name, display_name, bio, investor_type, city, country, max_investment, identity_verified)
  VALUES (u_miguel, 'Miguel Ángel', 'Pérez Solíz', 'Miguel Pérez',
    'Docente universitario. Invierto en proyectos de educación y cultura que generan cambio social real.',
    'individual', 'Sucre', 'Bolivia', 30000, false);

  INSERT INTO users (email, password_hash, email_verified, is_active)
  VALUES ('lherrera@inversiones.bo', pwd, true, true) RETURNING id INTO u_lucia;
  INSERT INTO user_roles (user_id, role_id) VALUES (u_lucia, r_investor);
  INSERT INTO investor_profiles (user_id, first_name, last_name, display_name, bio, investor_type, city, country, max_investment, identity_verified)
  VALUES (u_lucia, 'Lucía', 'Herrera Campos', 'Lucía Herrera',
    'Nutricionista y emprendedora. Me interesan los proyectos de alimentación saludable, salud comunitaria y medioambiente.',
    'individual', 'El Alto', 'Bolivia', 45000, true);

  -- ============================================================
  -- CAMPAÑAS
  -- ============================================================

  -- 1. MindApp (published, ~35%)
  INSERT INTO campaigns (creator_id, category_id, title, slug, subtitle, description, short_description,
    campaign_type, status, goal_amount, min_investment, currency, start_date, end_date,
    cover_image_url, is_featured, published_at)
  VALUES (u_maria, cat_tech,
    'MindApp — Salud Mental para Adolescentes',
    'mindapp-salud-mental-adolescentes',
    'La primera app boliviana de bienestar emocional con IA para jóvenes de 13 a 19 años',
    E'## El Problema\nBolivia tiene una de las tasas más altas de depresión adolescente en Latinoamérica y menos de 200 psicólogos disponibles para más de 1 millón de jóvenes. Los tiempos de espera son de 3 a 6 meses.\n\n## Nuestra Solución\nMindApp combina terapia cognitivo-conductual basada en evidencia, meditación guiada e inteligencia artificial para detectar señales tempranas de crisis emocional.\n\n## Resultados del piloto\n- 500 estudiantes en 3 colegios de La Paz\n- 78% reportaron mejora en bienestar en 30 días\n- Alianza firmada con el Ministerio de Educación\n\n## Uso de fondos\n- 40% Desarrollo IA y backend\n- 30% Contenido clínico y psicólogos\n- 20% Marketing y adquisición de usuarios\n- 10% Legal y operaciones',
    'App boliviana de bienestar emocional con IA para adolescentes. 78% de mejora en el piloto con 500 jóvenes.',
    'reward', 'published', 45000, 450, 'BOB',
    NOW() - INTERVAL '45 days', NOW() + INTERVAL '45 days',
    'https://images.unsplash.com/photo-1512314889357-e157c22f938d?w=800',
    true, NOW() - INTERVAL '45 days')
  RETURNING id INTO c_mindapp;

  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_mindapp, 'Simpatizante Digital', 'Acceso anticipado a MindApp por 1 año + sticker exclusivo + nombre en créditos.', 450, 'BOB', 100, '2025-06-30', false, 1, 1, 9) RETURNING id INTO rt_m1;
  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_mindapp, 'Embajador MindApp', 'Acceso vitalicio + workshops mensuales + badge Cofundador en perfil.', 4500, 'BOB', 30, '2025-06-30', false, 2, 10, 29) RETURNING id INTO rt_m2;
  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_mindapp, 'Cofundador MindApp', 'Todo lo anterior + reunión mensual con equipo fundador + mención en medios.', 13500, 'BOB', 5, '2025-06-30', false, 3, 30, 100) RETURNING id INTO rt_m3;

  INSERT INTO campaign_updates (campaign_id, author_id, title, content, is_public, attachments) VALUES
  (c_mindapp, u_maria, '¡Superamos el 30% de financiamiento!',
   'Querida comunidad: cruzamos el umbral del 30%. Esta semana terminamos la integración del módulo de IA. Los beta testers reportaron 82% de satisfacción. ¡Seguimos!', true,
   '[{"url":"https://images.unsplash.com/photo-1512314889357-e157c22f938d?w=800&fit=crop","type":"image","caption":"Primeras capturas del prototipo funcional de MindApp"}]'),
  (c_mindapp, u_maria, 'Alianza con 3 colegios nuevos',
   'Firmamos convenios con tres nuevos colegios: 1,200 nuevos usuarios potenciales. El lanzamiento oficial está programado para julio. ¡Gracias por ser parte de este cambio!', true,
   '[{"url":"https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&fit=crop","type":"image","caption":"Estudiantes del Colegio Bolívar probando la app durante el piloto"}]');

  -- 2. CodeKids (funded, 100%)
  INSERT INTO campaigns (creator_id, category_id, title, slug, subtitle, description, short_description,
    campaign_type, status, goal_amount, min_investment, currency, start_date, end_date, funded_at,
    cover_image_url, published_at)
  VALUES (u_maria, cat_edu,
    'CodeKids Bolivia — Programación para Niños Rurales',
    'codekids-bolivia-programacion-ninos-rurales',
    'Llevamos educación en código a 5,000 niños de comunidades rurales que nunca tocaron una computadora',
    E'## La brecha digital rural\nEl 72% de las escuelas rurales no tienen acceso a internet y el 90% carece de computadoras.\n\n## CodeKids: Aprender sin internet\nPlataforma offline-first con lecciones de programación visual. Los maestros reciben formación de 20 horas.\n\n## Resultados del piloto\n- 340 niños formados, 60% niñas\n- 94% de maestros mantiene el programa activo tras 6 meses\n- Costo por niño: Bs. 85\n\n## Este financiamiento permitirá\n1. Adquirir 200 tablets\n2. Capacitar a 50 maestros rurales\n3. Expandir a 20 escuelas en 4 departamentos\n4. Producir materiales en quechua y aymara',
    'Plataforma offline de programación visual para niños rurales bolivianos. ¡60% niñas, 94% retención!',
    'reward', 'funded', 30000, 300, 'BOB',
    NOW() - INTERVAL '90 days', NOW() + INTERVAL '10 days', NOW() - INTERVAL '15 days',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800',
    NOW() - INTERVAL '90 days')
  RETURNING id INTO c_codekids;

  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_codekids, 'Padrino Digital', 'Financia la educación de 1 niño por un año + diploma digital.', 300, 'BOB', 80, '2025-03-31', false, 1, 1, 9) RETURNING id INTO rt_c1;
  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_codekids, 'Mentor CodeKids', '10 niños financiados + visita virtual a una escuela + kit de recuerdos enviado a casa.', 3000, 'BOB', 15, '2025-03-31', true, 2, 10, 29) RETURNING id INTO rt_c2;
  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_codekids, 'Fundador CodeKids', 'Financia una escuela completa + placa en aula + viaje de voluntariado.', 9000, 'BOB', 3, '2025-05-31', true, 3, 30, 100) RETURNING id INTO rt_c3;

  INSERT INTO campaign_updates (campaign_id, author_id, title, content, is_public, attachments) VALUES
  (c_codekids, u_maria, '¡META ALCANZADA! Gracias por financiar el futuro',
   '¡LO LOGRAMOS! 17 inversores increíbles y Bs. 30,000 en 75 días. Ya compramos las tablets y empezamos la formación de maestros. En marzo arrancamos con las primeras 20 escuelas.', true,
   '[{"url":"https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&fit=crop","type":"image","caption":"¡Equipo CodeKids Bolivia celebrando la meta alcanzada!"}]'),
  (c_codekids, u_maria, 'Primeras tablets entregadas — Día histórico',
   'Entregamos las primeras 50 tablets en Potosí. Ver las caras de los niños tocando por primera vez una pantalla fue emocionante. ¡El futuro de Bolivia está en estas aulas!', true,
   '[{"url":"https://images.unsplash.com/photo-1544717684-1d638fc12e03?w=800&fit=crop","type":"image","caption":"Niños recibiendo sus tablets en la Unidad Educativa Los Andes"}]');

  -- 3. SolarCoop (published, ~35%)
  INSERT INTO campaigns (creator_id, category_id, title, slug, subtitle, description, short_description,
    campaign_type, status, goal_amount, min_investment, currency, start_date, end_date,
    cover_image_url, is_featured, published_at)
  VALUES (u_carlos, cat_env,
    'SolarCoop — Energía Solar para 200 Familias Rurales',
    'solarcoop-energia-solar-200-familias-rurales',
    'Cooperativa de energía renovable que lleva electricidad limpia al Chapare cochabambino',
    E'## El desafío energético\nEl 35% de las comunidades rurales del Chapare no tiene electricidad. Las familias gastan Bs. 120/mes en velas y kerosene.\n\n## SolarCoop: Modelo cooperativo\nMicro-red solar comunitaria con baterías de respaldo para 200 familias. Cada familia paga Bs. 25/mes (80% menos).\n\n## Impacto proyectado\n- 1,000 personas con electricidad 24/7\n- 45 toneladas de CO2 menos al año\n- 8 empleos locales permanentes',
    'Micro-red solar cooperativa para 200 familias del Chapare. 80% de ahorro y cero emisiones.',
    'reward', 'published', 80000, 800, 'BOB',
    NOW() - INTERVAL '30 days', NOW() + INTERVAL '60 days',
    'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800',
    true, NOW() - INTERVAL '30 days')
  RETURNING id INTO c_solar;

  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_solar, 'Familia Solar', 'Electrifica el hogar de 1 familia + diploma de Padrino Energético.', 800, 'BOB', 120, '2025-09-30', false, 1, 1, 9) RETURNING id INTO rt_s1;
  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_solar, 'Colector Solar', '10 familias financiadas + visita virtual + informe de impacto ambiental.', 8000, 'BOB', 20, '2025-09-30', false, 2, 10, 29) RETURNING id INTO rt_s2;
  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_solar, 'Socio Fundador Cooperativa', 'Placa en panel central + participación en asamblea anual + reporte de retorno social.', 24000, 'BOB', 3, '2025-09-30', false, 3, 30, 100) RETURNING id INTO rt_s3;

  INSERT INTO campaign_updates (campaign_id, author_id, title, content, is_public, attachments) VALUES
  (c_solar, u_carlos, 'Permiso Municipal aprobado — ¡Avanzamos!',
   'Recibimos la resolución municipal que nos autoriza a instalar la micro-red en Ucuchi y Villa Libertad. El estudio de suelos confirmó que el terreno es apto. ¡Cada boliviano conta!', true,
   '[{"url":"https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&fit=crop","type":"image","caption":"Terreno aprobado para la instalación de 120 paneles solares comunitarios"}]');

  -- 4. AgroRiego (published, ~36%, donation)
  INSERT INTO campaigns (creator_id, category_id, title, slug, subtitle, description, short_description,
    campaign_type, status, goal_amount, min_investment, currency, start_date, end_date,
    cover_image_url, published_at)
  VALUES (u_carlos, cat_agri,
    'AgroRiego — Riego Inteligente para el Altiplano',
    'agrorriego-riego-inteligente-altiplano',
    'Sensores IoT y riego por goteo para 80 familias agricultoras del altiplano paceño',
    E'## La crisis hídrica del altiplano\nEl cambio climático redujo 30% las precipitaciones. Los agricultores pierden el 40% de sus cultivos por sequía o riego ineficiente.\n\n## Sistema AgroRiego\nSensores de humedad del suelo conectados a app móvil. El sistema activa el riego automáticamente, reduciendo consumo de agua 60%.\n\n## Resultados piloto 2023\n- 12 familias en Patacamaya\n- +35% rendimiento de quinoa\n- -62% consumo de agua\n- Recuperación en 14 meses',
    'Riego por goteo con IoT para 80 familias del altiplano. +35% de rendimiento y -62% de agua consumida.',
    'donation', 'published', 55000, 550, 'BOB',
    NOW() - INTERVAL '20 days', NOW() + INTERVAL '70 days',
    'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=800',
    NOW() - INTERVAL '20 days')
  RETURNING id INTO c_riego;

  INSERT INTO campaign_updates (campaign_id, author_id, title, content, is_public, attachments) VALUES
  (c_riego, u_carlos, 'Sensores calibrados — Demo este sábado',
   'El equipo técnico terminó la calibración de los 80 sensores. Este sábado hacemos demo en vivo desde Patacamaya. ¡Los invitamos!', true,
   '[{"url":"https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=800&fit=crop","type":"image","caption":"Sistema de riego inteligente en campo piloto, Cochabamba"},{"url":"https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&fit=crop","type":"image","caption":"Sensor de humedad de suelo instalado en parcela de papa nativa"}]');

  -- 5. Sabores Bolivia (funded, 100%)
  INSERT INTO campaigns (creator_id, category_id, title, slug, subtitle, description, short_description,
    campaign_type, status, goal_amount, min_investment, currency, start_date, end_date, funded_at,
    cover_image_url, published_at)
  VALUES (u_ana, cat_food,
    'Sabores Bolivia — Restaurante de Cocina Patrimonial',
    'sabores-bolivia-restaurante-cocina-patrimonial',
    'Rescatamos 200 recetas bolivianas del siglo XX para crear el restaurante más auténtico de La Paz',
    E'## Nuestra historia\nHeredé el libro de recetas de mi abuela: 200 platos de la cocina boliviana que están desapareciendo. Mi sueño es que el mundo los pruebe.\n\n## El Restaurante\nNo es un restaurante convencional. Es una experiencia: conoce la historia de cada ingrediente, su origen geográfico y la comunidad productora. Trabajamos con 15 comunidades agricultoras.\n\n## Proyección financiera\n- Ticket promedio: Bs. 280\n- Break-even en mes 8\n- Retorno para inversores: 12% anual',
    'Restaurante de 7 tiempos con recetas bolivianas patrimoniales del siglo XX. Historia, sabor e impacto.',
    'reward', 'funded', 25000, 250, 'BOB',
    NOW() - INTERVAL '120 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
    NOW() - INTERVAL '120 days')
  RETURNING id INTO c_sabores;

  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_sabores, 'Mesa para 2', 'Cena de 7 tiempos para 2 personas + botella de singani + copia del libro de recetas.', 500, 'BOB', 30, '2025-02-28', false, 1, 1, 19) RETURNING id INTO rt_sb1;
  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_sabores, 'Socio Gastronómico', '10% descuento permanente + invitación a eventos privados + placa con tu nombre.', 5000, 'BOB', 5, '2025-02-28', false, 2, 20, 100) RETURNING id INTO rt_sb2;

  INSERT INTO campaign_updates (campaign_id, author_id, title, content, is_public, attachments) VALUES
  (c_sabores, u_ana, '¡Financiado! Firmamos contrato de arrendamiento',
   '¡Logramos los Bs. 25,000! Esta semana firmamos el local en la calle Comercio. Obras en enero, apertura en marzo. ¡Nos vemos en la mesa!', true,
   '[{"url":"https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&fit=crop","type":"image","caption":"El local en la Sopocachi que será Sabores Bolivia"}]'),
  (c_sabores, u_ana, 'Remodelación en marcha — Fotos del avance',
   'La cocina abierta está instalada y la decoración con textiles aymaras quedó increíble. El chef Carlos Rojas ya está probando las recetas de la abuela. Abrimos el 15 de marzo.', true,
   '[{"url":"https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&fit=crop","type":"image","caption":"Semana 2 — paredes y piso de cerámica artesanal terminados"},{"url":"https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&fit=crop","type":"image","caption":"Instalación de la cocina industrial con horno de barro"}]');

  -- 6. PagoRural (published, 25%)
  INSERT INTO campaigns (creator_id, category_id, title, slug, subtitle, description, short_description,
    campaign_type, status, goal_amount, min_investment, currency, start_date, end_date,
    cover_image_url, published_at)
  VALUES (u_roberto, cat_fin,
    'PagoRural — Billetera Digital para Zonas sin Internet',
    'pagorural-billetera-digital-zonas-sin-internet',
    'Pagos peer-to-peer por SMS y USSD para 2.5 millones de bolivianos sin cuenta bancaria',
    E'## El problema\nEl 45% de bolivianos adultos no tiene cuenta bancaria. En zonas rurales: 72%.\n\n## PagoRural\nFunciona con cualquier celular básico usando SMS y USSD. Sin internet, sin smartphone.\n\n## Tracción\n- 8,500 usuarios activos en piloto\n- 23,000 transacciones/mes\n- Alianza con BancoSol y 3 cooperativas\n- Premio Nacional de Innovación Financiera 2024',
    'Pagos por SMS sin internet para 2.5 millones de bolivianos sin cuenta bancaria. Premio Nacional 2024.',
    'reward', 'published', 60000, 600, 'BOB',
    NOW() - INTERVAL '15 days', NOW() + INTERVAL '75 days',
    'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800',
    NOW() - INTERVAL '15 days')
  RETURNING id INTO c_pagorural;

  INSERT INTO campaign_updates (campaign_id, author_id, title, content, is_public, attachments) VALUES
  (c_pagorural, u_roberto, 'BancoSol confirmó la integración definitiva',
   'Firmamos el acuerdo con BancoSol para integrar PagoRural en sus 150 agencias. Desde mayo: depósitos y retiros en todo el país. ¡El futuro financiero de Bolivia se construye hoy!', true,
   '[{"url":"https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&fit=crop","type":"image","caption":"Demo de PagoRural en dispositivo básico con cobertura 2G"},{"url":"https://images.unsplash.com/photo-1601597111158-2fceff292cdc?w=800&fit=crop","type":"image","caption":"Reunión de integración con equipo técnico de BancoSol"}]');

  -- 7. Clínica Móvil Sierra (published, 57%)
  INSERT INTO campaigns (creator_id, category_id, title, slug, subtitle, description, short_description,
    campaign_type, status, goal_amount, min_investment, currency, start_date, end_date,
    cover_image_url, is_featured, published_at)
  VALUES (u_valentina, cat_health,
    'Clínica Móvil Sierra — Salud para 15 Comunidades Remotas',
    'clinica-movil-sierra-salud-15-comunidades-remotas',
    'Unidad médica 4x4 con telemedicina, laboratorio básico y farmacia para el altiplano norte de La Paz',
    E'## La emergencia sanitaria rural\nEn 15 comunidades del altiplano norte, el médico más cercano está a 4 horas. Mortalidad infantil el doble del promedio nacional.\n\n## La Clínica Móvil\n- Laboratorio básico (hemograma, glucemia)\n- Ecógrafo portátil para control prenatal\n- Farmacia con 80 medicamentos esenciales\n- Telemedicina para consultar con especialistas\n- Energía solar 100% autónoma\n\n## Resultados nov-2024\n847 consultas, 23 controles prenatales, 6 partos asistidos, 12 casos de anemia detectados.',
    'Camioneta médica con laboratorio, ecógrafo y telemedicina para 15 comunidades sin acceso a salud.',
    'reward', 'published', 70000, 700, 'BOB',
    NOW() - INTERVAL '25 days', NOW() + INTERVAL '65 days',
    'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800',
    true, NOW() - INTERVAL '25 days')
  RETURNING id INTO c_clinica;

  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_clinica, 'Ciudadano Saludable', 'Financia 1 mes de consultas en una comunidad + certificado + mención en la clínica.', 700, 'BOB', 60, '2025-08-31', false, 1, 1, 29) RETURNING id INTO rt_cl1;
  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_clinica, 'Padrino de la Clínica', '1 año de consultas + visita a la ruta + informe semestral + placa en el vehículo.', 21000, 'BOB', 3, '2025-08-31', false, 2, 30, 100) RETURNING id INTO rt_cl2;

  INSERT INTO campaign_updates (campaign_id, author_id, title, content, is_public, attachments) VALUES
  (c_clinica, u_valentina, 'Ecógrafo llegó — Primera embarazada atendida',
   'Con el financiamiento parcial adquirimos el ecógrafo portátil Vscan Air. Realizamos el primer control prenatal de Doña Juana, 7 meses. Su bebé está sano. Ese momento resume por qué hacemos esto.', true,
   '[{"url":"https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800&fit=crop","type":"image","caption":"Nuevo ecógrafo portátil Mindray — listo para comunidades rurales"}]'),
  (c_clinica, u_valentina, 'Ruta de noviembre: 847 consultas en 20 días',
   '847 consultas, 23 controles prenatales, 6 partos asistidos. Sin la clínica móvil, esos casos nunca habrían sido detectados. ¡Gracias por salvar vidas reales!', true,
   '[{"url":"https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800&fit=crop","type":"image","caption":"Equipo médico atendiendo en la comunidad de Parotani (Cochabamba)"},{"url":"https://images.unsplash.com/photo-1593053272360-8dc07e6a9f29?w=800&fit=crop","type":"image","caption":"Registro diario de noviembre — 847 consultas en 20 comunidades"}]');

  -- 8. Festival Andino (published, 40%)
  INSERT INTO campaigns (creator_id, category_id, title, slug, subtitle, description, short_description,
    campaign_type, status, goal_amount, min_investment, currency, start_date, end_date,
    cover_image_url, published_at)
  VALUES (u_ana, cat_art,
    'Festival de Música Andina — Oruro 2025',
    'festival-musica-andina-oruro-2025',
    'El festival que celebra la riqueza musical andina con 30 agrupaciones de Bolivia, Perú y Chile',
    E'## La música andina está en riesgo\nGéneros únicos como la tarkeada, el siku y el huayno boliviano están desapareciendo. Los músicos tradicionales envejecen sin transmitir su saber.\n\n## Festival Andino Oruro 2025\nTres días. 30 agrupaciones internacionales. Entrada libre días 1 y 2.\n\n## Legado\n- 15 canciones en peligro de extinción grabadas profesionalmente\n- Documental de 45 minutos para distribución internacional\n- Plataforma digital de archivo musical andino',
    'Festival de 3 días con 30 agrupaciones + grabación profesional + documental. Oruro, agosto 2025.',
    'reward', 'published', 20000, 200, 'BOB',
    NOW() - INTERVAL '10 days', NOW() + INTERVAL '80 days',
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    NOW() - INTERVAL '10 days')
  RETURNING id INTO c_festival;

  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_festival, 'Espectador Andino', 'Entrada VIP al concierto de gala para 2 personas + disco compilatorio firmado + pulsera exclusiva.', 200, 'BOB', 80, '2025-08-15', true, 1, 1, 29) RETURNING id INTO rt_f1;
  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_festival, 'Mecenas Cultural', 'Todo lo anterior + meet & greet + nombre en créditos del disco y documental + kit cultural.', 6000, 'BOB', 5, '2025-08-15', true, 2, 30, 100) RETURNING id INTO rt_f2;

  -- 9. Biblioteca El Alto (funded, 100%, donation)
  INSERT INTO campaigns (creator_id, category_id, title, slug, subtitle, description, short_description,
    campaign_type, status, goal_amount, min_investment, currency, start_date, end_date, funded_at,
    cover_image_url, published_at)
  VALUES (u_valentina, cat_comm,
    'Biblioteca Comunitaria El Alto — Zona Digital',
    'biblioteca-comunitaria-el-alto-zona-digital',
    '3,000 libros y 20 computadoras para 500 niños del barrio Santiago II de El Alto',
    E'## Sin biblioteca en 5 km a la redonda\n12,000 habitantes y ninguna biblioteca. Los niños estudian con libros fotocopiados. El 40% abandona la secundaria.\n\n## El Proyecto\n- 3,000 libros nuevos\n- 20 computadoras con internet satelital\n- Zona de lectura + sala de talleres para 30 personas\n- Horario extendido 7:00 AM — 8:00 PM\n- 200 títulos en aymara\n\n## Sostenibilidad\nCoordinador pagado por el municipio (convenio ya firmado) + voluntarios universitarios.',
    'Biblioteca con 3,000 libros y 20 computadoras para 500 niños de El Alto. Municipio co-financia operación.',
    'donation', 'funded', 15000, 150, 'BOB',
    NOW() - INTERVAL '60 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days',
    'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800',
    NOW() - INTERVAL '60 days')
  RETURNING id INTO c_biblio;

  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_biblio, 'Donante Lector', 'Tu nombre en el mural de donantes + 5 libros elegidos por los niños enviados a tu casa.', 150, 'BOB', 60, '2025-04-30', true, 1, 1, 19) RETURNING id INTO rt_b1;
  INSERT INTO reward_tiers (campaign_id, title, description, amount, currency, max_claims, estimated_delivery, includes_shipping, sort_order, min_percentage, max_percentage)
  VALUES (c_biblio, 'Fundador de la Biblioteca', 'Placa en la sala + visita guiada con los niños + carta firmada por los estudiantes.', 3000, 'BOB', 3, '2025-04-30', true, 2, 20, 100) RETURNING id INTO rt_b2;

  INSERT INTO campaign_updates (campaign_id, author_id, title, content, is_public, attachments) VALUES
  (c_biblio, u_valentina, '¡Meta alcanzada! Inauguramos el 15 de enero',
   '¡En 55 días recaudamos los Bs. 15,000! Los libros están en camino. El municipio confirmó la partida. Inauguración el 15 de enero a las 10:00 AM. ¡Todos están invitados!', true,
   '[{"url":"https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&fit=crop","type":"image","caption":"Estantes listos con 1,200 libros donados y comprados"},{"url":"https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&fit=crop","type":"image","caption":"Niños del barrio explorando los libros antes de la inauguración oficial"}]');

  -- 10. Vivienda Digna Chapare (completed)
  INSERT INTO campaigns (creator_id, category_id, title, slug, subtitle, description, short_description,
    campaign_type, status, goal_amount, current_amount, min_investment, currency,
    start_date, end_date, funded_at, cover_image_url, published_at)
  VALUES (u_carlos, cat_social,
    'Vivienda Digna Chapare — 10 Casas para Familias Vulnerables',
    'vivienda-digna-chapare-10-casas-familias-vulnerables',
    'Construimos 10 viviendas de material noble para familias en emergencia habitacional',
    E'## La crisis post-inundaciones 2022\n85 familias del Chapare sin hogar. 15 de las más vulnerables quedaron fuera de los programas estatales.\n\n## Vivienda Digna\n10 viviendas de 50m² con diseño bioclimático:\n- 2 dormitorios, sala, cocina y baño\n- Techo de hormigón resistente a inundaciones\n- Huerto familiar de 20m²\n- Letrina ecológica con biodigestor\n\n## Resultado\nProyecto completado en diciembre 2024. Las 10 familias ya habitan sus nuevos hogares.',
    'Construimos 10 viviendas para familias vulnerables del Chapare. Proyecto completado en diciembre 2024.',
    'donation', 'completed', 50000, 50000, 500, 'BOB',
    NOW() - INTERVAL '180 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '60 days',
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800',
    NOW() - INTERVAL '180 days')
  RETURNING id INTO c_vivienda;

  INSERT INTO campaign_updates (campaign_id, author_id, title, content, is_public, attachments) VALUES
  (c_vivienda, u_carlos, '¡Proyecto Completado! Las familias entraron a sus hogares',
   '¡Es con enorme emoción que comunicamos que las 10 familias ya habitan sus viviendas! 6 meses, 25 albañiles locales, 43 inversores. Gracias a todos por construir este sueño.', true,
   '[{"url":"https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&fit=crop","type":"image","caption":"Las 10 familias frente a sus nuevas viviendas en el Chapare"},{"url":"https://images.unsplash.com/photo-1448630360428-65456885c650?w=800&fit=crop","type":"image","caption":"Vista panorámica del conjunto habitacional terminado"}]'),
  (c_vivienda, u_carlos, 'Fotos finales: así quedaron las viviendas',
   'Doña Rosa, mamá soltera de 4 hijos, nos dijo: "Por primera vez en 30 años tengo un techo que no me da miedo cuando llueve". Eso lo dice todo.', true,
   '[{"url":"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&fit=crop","type":"image","caption":"Fachada terminada — Vivienda modelo N° 3, adobe y madera nativa"},{"url":"https://images.unsplash.com/photo-1600566753376-12c8ab8e17a9?w=800&fit=crop","type":"image","caption":"Interior sala-comedor con acabados artesanales"},{"url":"https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&fit=crop","type":"image","caption":"Cocina con ventana panorámica al jardín comunitario"}]');

  -- ============================================================
  -- INVERSIONES (triggers actualizan current_amount automáticamente)
  -- ============================================================

  -- MindApp (goal 45,000 → ~15,800 BOB)
  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_mindapp, u_diego, rt_m2, 9000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 9000, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_mindapp, u_sofia, rt_m2, 5000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 5000, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_mindapp, u_juan, rt_m1, 1800, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 1800, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  -- CodeKids (goal 30,000 → 100% funded)
  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_codekids, u_diego, rt_c3, 9000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 9000, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'shipped');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_codekids, u_miguel, rt_c3, 9000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 9000, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'shipped');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_codekids, u_lucia, rt_c2, 4500, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 4500, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_codekids, u_camila, rt_c2, 4500, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 4500, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_codekids, u_sofia, rt_c2, 3000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 3000, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  -- SolarCoop (goal 80,000 → ~28,000)
  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_solar, u_juan, rt_s2, 16000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 16000, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_solar, u_andres, rt_s2, 8000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 8000, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_solar, u_camila, rt_s1, 4000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 4000, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  -- AgroRiego (goal 55,000 → ~20,000, donation)
  INSERT INTO investments (campaign_id, investor_id, amount, currency, status)
  VALUES (c_riego, u_juan, 12000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 12000, 'BOB', 'completed');

  INSERT INTO investments (campaign_id, investor_id, amount, currency, status)
  VALUES (c_riego, u_pat, 8000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 8000, 'BOB', 'completed');

  -- Sabores Bolivia (goal 25,000 → 100% funded)
  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_sabores, u_juan, rt_sb2, 7500, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 7500, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'delivered');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_sabores, u_pat, rt_sb2, 7500, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 7500, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'delivered');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_sabores, u_miguel, rt_sb1, 5000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 5000, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'delivered');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_sabores, u_andres, rt_sb1, 5000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 5000, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'delivered');

  -- PagoRural (goal 60,000 → 25%)
  INSERT INTO investments (campaign_id, investor_id, amount, currency, status)
  VALUES (c_pagorural, u_diego, 10000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 10000, 'BOB', 'completed');

  INSERT INTO investments (campaign_id, investor_id, amount, currency, status)
  VALUES (c_pagorural, u_andres, 5000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 5000, 'BOB', 'completed');

  -- Clínica Móvil (goal 70,000 → ~57%)
  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_clinica, u_juan, rt_cl2, 21000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 21000, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_clinica, u_diego, rt_cl1, 9800, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 9800, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_clinica, u_lucia, rt_cl1, 7000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 7000, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_clinica, u_sofia, rt_cl1, 2100, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 2100, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  -- Festival Andino (goal 20,000 → 40%)
  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_festival, u_miguel, rt_f1, 4000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 4000, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_festival, u_pat, rt_f1, 2400, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 2400, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  INSERT INTO investments (campaign_id, investor_id, reward_tier_id, amount, currency, status)
  VALUES (c_festival, u_camila, rt_f1, 1600, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 1600, 'BOB', 'completed');
  INSERT INTO reward_claims (investment_id, status) VALUES (inv, 'pending');

  -- Biblioteca El Alto (goal 15,000 → 100% funded, donation)
  INSERT INTO investments (campaign_id, investor_id, amount, currency, status)
  VALUES (c_biblio, u_diego, 5000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 5000, 'BOB', 'completed');

  INSERT INTO investments (campaign_id, investor_id, amount, currency, status)
  VALUES (c_biblio, u_sofia, 3000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 3000, 'BOB', 'completed');

  INSERT INTO investments (campaign_id, investor_id, amount, currency, status)
  VALUES (c_biblio, u_lucia, 3000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 3000, 'BOB', 'completed');

  INSERT INTO investments (campaign_id, investor_id, amount, currency, status)
  VALUES (c_biblio, u_camila, 2000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 2000, 'BOB', 'completed');

  INSERT INTO investments (campaign_id, investor_id, amount, currency, status)
  VALUES (c_biblio, u_juan, 2000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 2000, 'BOB', 'completed');

  -- Vivienda Digna (completada, current_amount ya seteado en INSERT)
  INSERT INTO investments (campaign_id, investor_id, amount, currency, status)
  VALUES (c_vivienda, u_juan, 15000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 15000, 'BOB', 'completed');

  INSERT INTO investments (campaign_id, investor_id, amount, currency, status)
  VALUES (c_vivienda, u_andres, 12000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 12000, 'BOB', 'completed');

  INSERT INTO investments (campaign_id, investor_id, amount, currency, status)
  VALUES (c_vivienda, u_diego, 10000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 10000, 'BOB', 'completed');

  INSERT INTO investments (campaign_id, investor_id, amount, currency, status)
  VALUES (c_vivienda, u_pat, 8000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 8000, 'BOB', 'completed');

  INSERT INTO investments (campaign_id, investor_id, amount, currency, status)
  VALUES (c_vivienda, u_lucia, 5000, 'BOB', 'completed') RETURNING id INTO inv;
  INSERT INTO transactions (investment_id, transaction_type, amount, currency, status) VALUES (inv, 'payment', 5000, 'BOB', 'completed');

  -- ============================================================
  -- ACTUALIZAR ESTADO DE CAMPAÑAS FINANCIADAS
  -- ============================================================
  UPDATE campaigns SET status = 'funded', funded_at = NOW() - INTERVAL '15 days' WHERE id = c_codekids;
  UPDATE campaigns SET status = 'funded', funded_at = NOW() - INTERVAL '30 days' WHERE id = c_sabores;
  UPDATE campaigns SET status = 'funded', funded_at = NOW() - INTERVAL '5 days'  WHERE id = c_biblio;

  -- ============================================================
  -- TOTALES DE INVERSORES
  -- ============================================================
  UPDATE investor_profiles SET
    total_investments = (SELECT COUNT(*)         FROM investments WHERE investor_id = u_diego  AND status='completed'),
    total_invested    = (SELECT COALESCE(SUM(amount),0) FROM investments WHERE investor_id = u_diego  AND status='completed')
  WHERE user_id = u_diego;
  UPDATE investor_profiles SET
    total_investments = (SELECT COUNT(*)         FROM investments WHERE investor_id = u_sofia  AND status='completed'),
    total_invested    = (SELECT COALESCE(SUM(amount),0) FROM investments WHERE investor_id = u_sofia  AND status='completed')
  WHERE user_id = u_sofia;
  UPDATE investor_profiles SET
    total_investments = (SELECT COUNT(*)         FROM investments WHERE investor_id = u_juan   AND status='completed'),
    total_invested    = (SELECT COALESCE(SUM(amount),0) FROM investments WHERE investor_id = u_juan   AND status='completed')
  WHERE user_id = u_juan;
  UPDATE investor_profiles SET
    total_investments = (SELECT COUNT(*)         FROM investments WHERE investor_id = u_camila AND status='completed'),
    total_invested    = (SELECT COALESCE(SUM(amount),0) FROM investments WHERE investor_id = u_camila AND status='completed')
  WHERE user_id = u_camila;
  UPDATE investor_profiles SET
    total_investments = (SELECT COUNT(*)         FROM investments WHERE investor_id = u_andres AND status='completed'),
    total_invested    = (SELECT COALESCE(SUM(amount),0) FROM investments WHERE investor_id = u_andres AND status='completed')
  WHERE user_id = u_andres;
  UPDATE investor_profiles SET
    total_investments = (SELECT COUNT(*)         FROM investments WHERE investor_id = u_pat    AND status='completed'),
    total_invested    = (SELECT COALESCE(SUM(amount),0) FROM investments WHERE investor_id = u_pat    AND status='completed')
  WHERE user_id = u_pat;
  UPDATE investor_profiles SET
    total_investments = (SELECT COUNT(*)         FROM investments WHERE investor_id = u_miguel AND status='completed'),
    total_invested    = (SELECT COALESCE(SUM(amount),0) FROM investments WHERE investor_id = u_miguel AND status='completed')
  WHERE user_id = u_miguel;
  UPDATE investor_profiles SET
    total_investments = (SELECT COUNT(*)         FROM investments WHERE investor_id = u_lucia  AND status='completed'),
    total_invested    = (SELECT COALESCE(SUM(amount),0) FROM investments WHERE investor_id = u_lucia  AND status='completed')
  WHERE user_id = u_lucia;

  -- ============================================================
  -- TOTALES DE EMPRENDEDORES
  -- ============================================================
  UPDATE entrepreneur_profiles SET
    total_raised = (SELECT COALESCE(SUM(i.amount),0) FROM investments i JOIN campaigns c ON i.campaign_id=c.id WHERE c.creator_id=u_maria     AND i.status='completed')
  WHERE user_id = u_maria;
  UPDATE entrepreneur_profiles SET
    total_raised = (SELECT COALESCE(SUM(i.amount),0) FROM investments i JOIN campaigns c ON i.campaign_id=c.id WHERE c.creator_id=u_carlos    AND i.status='completed')
  WHERE user_id = u_carlos;
  UPDATE entrepreneur_profiles SET
    total_raised = (SELECT COALESCE(SUM(i.amount),0) FROM investments i JOIN campaigns c ON i.campaign_id=c.id WHERE c.creator_id=u_ana       AND i.status='completed')
  WHERE user_id = u_ana;
  UPDATE entrepreneur_profiles SET
    total_raised = (SELECT COALESCE(SUM(i.amount),0) FROM investments i JOIN campaigns c ON i.campaign_id=c.id WHERE c.creator_id=u_roberto   AND i.status='completed')
  WHERE user_id = u_roberto;
  UPDATE entrepreneur_profiles SET
    total_raised = (SELECT COALESCE(SUM(i.amount),0) FROM investments i JOIN campaigns c ON i.campaign_id=c.id WHERE c.creator_id=u_valentina AND i.status='completed')
  WHERE user_id = u_valentina;

  -- ============================================================
  -- COMENTARIOS
  -- ============================================================

  -- MindApp
  INSERT INTO campaign_comments (campaign_id, author_id, content, likes_count, created_at) VALUES
  (c_mindapp, u_diego, 'La salud mental adolescente en Bolivia está completamente desatendida. Esta app puede ser un cambio de paradigma real. Invertí porque creo en el equipo y en el impacto. ¡Éxito María!', 8, NOW() - INTERVAL '40 days'),
  (c_mindapp, u_sofia, '¿La app estará disponible en Cochabamba desde el lanzamiento o primero solo La Paz? Quiero recomendarla a un colegio donde tengo contactos.', 3, NOW() - INTERVAL '35 days'),
  (c_mindapp, u_maria, '¡Hola Sofía! Sí, el lanzamiento será nacional desde el primer día. Si quieres podemos coordinar una presentación en ese colegio. ¡Escríbeme!', 5, NOW() - INTERVAL '34 days'),
  (c_mindapp, u_pat,   '¿Cómo cuidan la privacidad de los datos de los adolescentes? Es un tema muy sensible antes de recomendarla.', 12, NOW() - INTERVAL '20 days'),
  (c_mindapp, u_juan,  'Proyecto sólido. El piloto con 500 estudiantes y 78% de satisfacción son datos concretos que hablan por sí solos.', 7, NOW() - INTERVAL '10 days');

  -- CodeKids
  INSERT INTO campaign_comments (campaign_id, author_id, content, likes_count, created_at) VALUES
  (c_codekids, u_miguel, 'Soy docente y trabajé 5 años en escuelas rurales. La brecha digital que describe María es 100% real. Este proyecto ataca el problema correcto.', 15, NOW() - INTERVAL '80 days'),
  (c_codekids, u_lucia,  '¿Tienen materiales en aymara además de quechua? En El Alto muchas familias hablan principalmente aymara.', 6, NOW() - INTERVAL '75 days'),
  (c_codekids, u_maria,  '¡Gran pregunta Lucía! Sí, tenemos materiales en los tres idiomas: español, quechua y aymara. Los de aymara los desarrollamos con la UMSA.', 9, NOW() - INTERVAL '74 days'),
  (c_codekids, u_camila, 'Que el 60% de participantes sean niñas fue lo que me convenció. Bolivia necesita más mujeres en tecnología desde la infancia.', 18, NOW() - INTERVAL '50 days');

  -- SolarCoop
  INSERT INTO campaign_comments (campaign_id, author_id, content, likes_count, created_at) VALUES
  (c_solar, u_andres, 'El modelo cooperativo es clave. No es caridad, es propiedad colectiva. Las familias son dueñas y eso cambia la dinámica de mantenimiento.', 11, NOW() - INTERVAL '25 days'),
  (c_solar, u_juan,   '¿Cuál es el plan de contingencia si las baterías fallan? Sería catastrófico en plena temporada de frío del altiplano.', 9, NOW() - INTERVAL '22 days'),
  (c_solar, u_carlos, 'Excelente pregunta Juan Pablo. Tenemos mantenimiento preventivo mensual + stock de emergencia en el almacén de la cooperativa + generador municipal de respaldo.', 7, NOW() - INTERVAL '21 days'),
  (c_solar, u_sofia,  'Las familias del Chapare llevan décadas siendo olvidadas por las empresas eléctricas. Este proyecto demuestra que hay otras formas de hacer las cosas.', 5, NOW() - INTERVAL '15 days');

  -- Sabores Bolivia
  INSERT INTO campaign_comments (campaign_id, author_id, content, likes_count, created_at) VALUES
  (c_sabores, u_andres, 'La cocina boliviana es extraordinaria y está subestimada a nivel internacional. Un restaurante que rescate esas recetas puede ser un éxito enorme. Invertí con gusto.', 14, NOW() - INTERVAL '110 days'),
  (c_sabores, u_miguel, '¿Harán eventos privados para empresas? Estoy pensando en cenas corporativas para clientes.', 3, NOW() - INTERVAL '100 days'),
  (c_sabores, u_ana,    '¡Por supuesto Miguel! Hasta 40 personas con menú personalizado. Escríbeme cuando quieras.', 4, NOW() - INTERVAL '99 days'),
  (c_sabores, u_lucia,  'Fui la semana pasada a la semana blanda. El sararaos fue lo mejor que probé en años. ¡Vayan todos!', 22, NOW() - INTERVAL '25 days');

  -- Clínica Móvil
  INSERT INTO campaign_comments (campaign_id, author_id, content, likes_count, created_at) VALUES
  (c_clinica, u_juan,      'Conocí a Valentina en un congreso de innovación social. Su trabajo es increíble. Cuando vi este proyecto no dudé ni un segundo en invertir.', 19, NOW() - INTERVAL '23 days'),
  (c_clinica, u_camila,    'La mortalidad infantil en esas comunidades es una vergüenza nacional. Mientras llega el cambio estructural, esto salva vidas hoy.', 16, NOW() - INTERVAL '20 days'),
  (c_clinica, u_miguel,    '¿La telemedicina funciona con médicos del Hospital de Clínicas o tienen su propia red de especialistas?', 5, NOW() - INTERVAL '18 days'),
  (c_clinica, u_valentina, '¡Hola Miguel! Tenemos convenio con el Hospital de Clínicas. Además, 3 especialistas (cardiólogo, pediatra, obstetra) hacen guardias virtuales voluntarias de 4 horas semanales.', 8, NOW() - INTERVAL '17 days'),
  (c_clinica, u_sofia,     'Hice mi inversión hoy. No es mucho pero quiero ser parte de algo tan necesario. Ojalá más bolivianos vean este proyecto.', 10, NOW() - INTERVAL '5 days');

  -- PagoRural
  INSERT INTO campaign_comments (campaign_id, author_id, content, likes_count, created_at) VALUES
  (c_pagorural, u_diego,   'El modelo USSD para pagos rurales ya funcionó en África con M-Pesa. Bolivia tiene la oportunidad de replicar ese éxito. La alianza con BancoSol fue el factor decisivo.', 13, NOW() - INTERVAL '12 days'),
  (c_pagorural, u_lucia,   '¿Cómo previenen el fraude y la suplantación de identidad en transacciones por SMS? Eso me preocupa para usuarios con poca educación financiera.', 8, NOW() - INTERVAL '10 days'),
  (c_pagorural, u_roberto, 'PIN de 4 dígitos + confirmación por llamada automática para transacciones mayores a Bs. 500. La tasa de fraude en el piloto fue 0.003%. También tenemos módulo de educación financiera integrado.', 6, NOW() - INTERVAL '9 days');

  -- Biblioteca El Alto
  INSERT INTO campaign_comments (campaign_id, author_id, content, likes_count, created_at) VALUES
  (c_biblio, u_miguel,    'Crecí en El Alto y sé exactamente de qué habla Valentina. La falta de espacios de estudio marca profundamente el futuro de los niños.', 24, NOW() - INTERVAL '55 days'),
  (c_biblio, u_camila,    '¿Habrá sección de libros en aymara? Una biblioteca en El Alto debería reflejar la identidad cultural de sus vecinos.', 11, NOW() - INTERVAL '50 days'),
  (c_biblio, u_valentina, '¡Sí Camila! Tenemos 200 títulos en aymara donados por el Centro Cultural Aymara. Los letreros serán bilingüas desde el primer día.', 9, NOW() - INTERVAL '49 days'),
  (c_biblio, u_sofia,     '¡Qué proyecto tan hermoso! La educación es la única inversión que nadie puede robarte. Pequeña donación de mi parte, con mucho corazón.', 17, NOW() - INTERVAL '30 days');

  -- Vivienda Digna
  INSERT INTO campaign_comments (campaign_id, author_id, content, likes_count, created_at) VALUES
  (c_vivienda, u_andres, 'Carlos lleva años en proyectos de impacto real. Este de vivienda es la culminación de su compromiso. Invertí sin dudar.', 16, NOW() - INTERVAL '170 days'),
  (c_vivienda, u_pat,    'El diseño bioclimático con huerto familiar es un detalle que marca la diferencia. No es solo una casa, es un sistema de vida sostenible.', 8, NOW() - INTERVAL '150 days'),
  (c_vivienda, u_lucia,  'Ver la foto de las familias con sus llaves me hizo llorar. Gracias Carlos por completar lo que prometiste. Esto no es tan común.', 31, NOW() - INTERVAL '28 days'),
  (c_vivienda, u_juan,   'Proyecto ejecutado a tiempo y con resultados concretos. Este es el estándar al que todos los proyectos de crowdfunding deberían aspirar.', 20, NOW() - INTERVAL '25 days');

  -- Festival Andino
  INSERT INTO campaign_comments (campaign_id, author_id, content, likes_count, created_at) VALUES
  (c_festival, u_miguel, 'La tarkeada y el siku son géneros que muy poca gente fuera de Bolivia conoce. Este festival puede llevarlos al mundo. Voy a ir con mis estudiantes.', 7, NOW() - INTERVAL '8 days'),
  (c_festival, u_camila, '¿Habrá transmisión en vivo para quienes no podemos viajar a Oruro?', 4, NOW() - INTERVAL '6 days'),
  (c_festival, u_ana,    '¡Sí Camila! El concierto de gala irá en vivo por YouTube. Los días 1 y 2 también publicaremos los mejores momentos en tiempo real. ¡Espero que lo disfruten!', 6, NOW() - INTERVAL '5 days');

  -- ============================================================
  -- LIKES (usuarios que tienen más de 10 likes en un comentario)
  -- ============================================================
  INSERT INTO comment_likes (comment_id, user_id)
  SELECT cc.id, u.id
  FROM campaign_comments cc
  CROSS JOIN (
    SELECT id FROM users
    WHERE email IN ('dvargas@inversiones.bo','smendoza@gmail.com','jpflores@capital.bo','crojas@inversor.bo','agutierrez@angel.bo')
  ) u
  WHERE cc.likes_count > 10
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- NOTIFICACIONES
  -- ============================================================
  INSERT INTO notifications (user_id, type_id, title, body, action_url, reference_type, reference_id)
  SELECT c.creator_id, nt_inv,
    'Recibiste una inversión en "' || c.title || '"',
    'Bs. ' || i.amount || ' de un inversor confirmado en tu campaña.',
    '/entrepreneur/campaigns/' || c.id::TEXT,
    'investment', i.id
  FROM investments i JOIN campaigns c ON i.campaign_id = c.id WHERE i.status = 'completed';

  INSERT INTO notifications (user_id, type_id, title, body, action_url, reference_type, reference_id)
  SELECT i.investor_id, nt_conf,
    'Tu inversión en "' || c.title || '" fue confirmada',
    'Tu inversión de Bs. ' || i.amount || ' fue procesada exitosamente.',
    '/investor/investments',
    'investment', i.id
  FROM investments i JOIN campaigns c ON i.campaign_id = c.id WHERE i.status = 'completed';

  INSERT INTO notifications (user_id, type_id, title, body, action_url, reference_type, reference_id)
  VALUES
  (u_maria,     nt_funded, '¡CodeKids Bolivia alcanzó su meta!',      'Tu campaña fue financiada al 100%. ¡Puedes iniciar la ejecución!', '/entrepreneur/campaigns/', 'campaign', c_codekids),
  (u_ana,       nt_funded, '¡Sabores Bolivia alcanzó su meta!',        'Tu campaña fue financiada al 100%. ¡Puedes iniciar la ejecución!', '/entrepreneur/campaigns/', 'campaign', c_sabores),
  (u_valentina, nt_funded, '¡Biblioteca El Alto alcanzó su meta!',     'Tu campaña fue financiada al 100%. ¡Puedes iniciar la ejecución!', '/entrepreneur/campaigns/', 'campaign', c_biblio);

  RAISE NOTICE 'Seed demo completado exitosamente.';
END $$;

-- ============================================================
-- RESUMEN
-- ============================================================
SELECT 'Usuarios'       AS entidad, COUNT(*)::TEXT AS total FROM users
UNION ALL SELECT 'Emprendedores',   COUNT(*)::TEXT FROM entrepreneur_profiles
UNION ALL SELECT 'Inversores',      COUNT(*)::TEXT FROM investor_profiles
UNION ALL SELECT 'Campañas',        COUNT(*)::TEXT FROM campaigns
UNION ALL SELECT 'Reward Tiers',    COUNT(*)::TEXT FROM reward_tiers
UNION ALL SELECT 'Inversiones',     COUNT(*)::TEXT FROM investments
UNION ALL SELECT 'Transacciones',   COUNT(*)::TEXT FROM transactions
UNION ALL SELECT 'Reward Claims',   COUNT(*)::TEXT FROM reward_claims
UNION ALL SELECT 'Comentarios',     COUNT(*)::TEXT FROM campaign_comments
UNION ALL SELECT 'Notificaciones',  COUNT(*)::TEXT FROM notifications;

SELECT title,
       status,
       goal_amount,
       current_amount,
       ROUND((current_amount / NULLIF(goal_amount, 0)) * 100, 1) AS pct,
       investor_count
FROM campaigns
ORDER BY current_amount DESC;
