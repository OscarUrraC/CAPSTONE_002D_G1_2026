-- =====================================================================
-- Connectboard - Datos iniciales (ejecutar DESPUÉS de 01_schema.sql)
-- Sede, carreras, motivos de reporte y umbrales de moderación.
-- El UUID de la sede debe coincidir con el valor por defecto de perfil.id_sede.
-- =====================================================================

INSERT INTO public.sede (id_sede, nombre) VALUES
  ('4cf46acd-2f48-4201-808c-980ff88e4c5d', 'San Andrés');

INSERT INTO public.carrera (nombre, codigo, id_sede) VALUES
  ('Animación Digital', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Comunicación Audiovisual', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Diseño Gráfico', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Diseño Industrial e Innovación en Productos', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Gastronomía Internacional', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Ilustración para Contextos Globales', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Ingeniería en Administración Mención Finanzas', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Ingeniería en Comercio Exterior', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Ingeniería en Construcción', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Ingeniería en Electricidad y Automatización Industrial', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Ingeniería en Gestión Logística', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Ingeniería en Informática', 'ICINF', '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Ingeniería en Mantenimiento Industrial', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Ingeniería en Maquinaria y Vehículos Pesados', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Ingeniería en Marketing Digital', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Ingeniería en Mecánica Automotriz y Autotrónica', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Ingeniería en Prevención de Riesgos', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Ingeniería en Redes y Telecomunicaciones', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Ingeniería en Sonido', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Publicidad', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Técnico en Desabolladura y Pintura Automotriz', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Técnico en Enfermería', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d'),
  ('Técnico en Odontología', NULL, '4cf46acd-2f48-4201-808c-980ff88e4c5d');

INSERT INTO public.motivo_reporte (nombre) VALUES
  ('Spam'),
  ('Acoso o intimidación'),
  ('Contenido inapropiado'),
  ('Discurso de odio'),
  ('Información falsa'),
  ('Otro');

INSERT INTO public.moderacion_umbral (id_categoria_moderacion, umbral) VALUES
  ('harassment', 0.85),
  ('harassment/threatening', 0.60),
  ('hate', 0.80),
  ('hate/threatening', 0.60),
  ('illicit', 0.80),
  ('illicit/violent', 0.60),
  ('self-harm', 0.50),
  ('self-harm/instructions', 0.40),
  ('self-harm/intent', 0.40),
  ('sexual', 0.80),
  ('sexual/minors', 0.30),
  ('violence', 0.80),
  ('violence/graphic', 0.70);
