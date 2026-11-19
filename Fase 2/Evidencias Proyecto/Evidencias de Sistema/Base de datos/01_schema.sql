-- =====================================================================
-- Connectboard - Esquema de la base de datos (PostgreSQL / Supabase)
-- Generado desde el proyecto Supabase del MVP. Ejecutar UNA VEZ, en un
-- proyecto Supabase NUEVO y vacío, desde el SQL Editor.
-- Orden: 01_schema.sql y luego 02_seed.sql.
-- =====================================================================

-- ---------- Tipos enumerados ----------
CREATE TYPE public.categoria_grupo AS ENUM ('interes', 'academico', 'promocion');
CREATE TYPE public.estado_comentario AS ENUM ('activo', 'eliminado', 'en_revision');
CREATE TYPE public.estado_cuenta AS ENUM ('activa', 'sancionada', 'baneada');
CREATE TYPE public.estado_evento AS ENUM ('activo', 'cancelado');
CREATE TYPE public.estado_grupo AS ENUM ('activo', 'suspendido', 'eliminado');
CREATE TYPE public.estado_membresia AS ENUM ('activo', 'pendiente_aprobacion', 'expulsado', 'abandonado');
CREATE TYPE public.estado_publicacion AS ENUM ('activa', 'eliminada', 'en_revision');
CREATE TYPE public.estado_reporte AS ENUM ('pendiente', 'sin_infraccion', 'infraccion');
CREATE TYPE public.plataforma_dispositivo AS ENUM ('ios', 'android');
CREATE TYPE public.rol_plataforma AS ENUM ('estudiante', 'administrador');
CREATE TYPE public.tipo_notificacion AS ENUM ('evento_1dia', 'evento_3horas', 'evento_inicio', 'evento_reprogramado', 'evento_cancelado', 'evento_marcado', 'reporte_resuelto', 'sancion_aplicada', 'contenido_eliminado');
CREATE TYPE public.tipo_publicacion AS ENUM ('grupo', 'anuncio');
CREATE TYPE public.tipo_sancion AS ENUM ('temporal', 'baneo', 'escalado');

-- ---------- Tablas ----------
CREATE TABLE public.sede (
  id_sede uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sede_pkey PRIMARY KEY (id_sede),
  CONSTRAINT sede_nombre_unico UNIQUE (nombre)
);

CREATE TABLE public.carrera (
  id_carrera uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  codigo text,
  id_sede uuid NOT NULL REFERENCES public.sede(id_sede),
  CONSTRAINT carrera_pkey PRIMARY KEY (id_carrera),
  CONSTRAINT carrera_sede_codigo_unico UNIQUE (id_sede, codigo),
  CONSTRAINT carrera_sede_nombre_unico UNIQUE (id_sede, nombre)
);

-- id_sede tiene como valor por defecto la sede San Andrés (mismo UUID que en 02_seed.sql).
CREATE TABLE public.perfil (
  id_perfil uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombres text NOT NULL,
  primer_apellido text NOT NULL,
  segundo_apellido text,
  apodo text,
  mostrar_apodo boolean NOT NULL DEFAULT false,
  correo text NOT NULL,
  fecha_nacimiento date NOT NULL,
  foto_perfil_url text,
  id_carrera uuid REFERENCES public.carrera(id_carrera),
  rol_plataforma public.rol_plataforma NOT NULL DEFAULT 'estudiante',
  estado_cuenta public.estado_cuenta NOT NULL DEFAULT 'activa',
  sancion_hasta timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  semestre smallint,
  id_sede uuid NOT NULL DEFAULT '4cf46acd-2f48-4201-808c-980ff88e4c5d' REFERENCES public.sede(id_sede),
  CONSTRAINT perfil_pkey PRIMARY KEY (id_perfil),
  CONSTRAINT perfil_correo_key UNIQUE (correo),
  CONSTRAINT perfil_sancionada_requiere_fecha CHECK (estado_cuenta <> 'sancionada' OR sancion_hasta IS NOT NULL),
  CONSTRAINT perfil_semestre_check CHECK (semestre IS NULL OR (semestre >= 1 AND semestre <= 20))
);

CREATE TABLE public.grupo (
  id_grupo uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  categoria public.categoria_grupo NOT NULL,
  ingreso_limitado boolean NOT NULL DEFAULT false,
  id_perfil_creador uuid NOT NULL REFERENCES public.perfil(id_perfil),
  creado_en timestamptz NOT NULL DEFAULT now(),
  estado public.estado_grupo NOT NULL DEFAULT 'activo',
  eliminado_por uuid REFERENCES public.perfil(id_perfil),
  eliminado_en timestamptz,
  motivo_eliminacion text,
  id_sede uuid NOT NULL REFERENCES public.sede(id_sede),
  CONSTRAINT grupo_pkey PRIMARY KEY (id_grupo),
  CONSTRAINT grupo_eliminador_par_completo CHECK ((eliminado_por IS NULL) = (eliminado_en IS NULL)),
  CONSTRAINT grupo_motivo_requiere_eliminador CHECK (eliminado_por IS NOT NULL OR motivo_eliminacion IS NULL)
);

CREATE TABLE public.grupo_miembro (
  id_grupo uuid NOT NULL REFERENCES public.grupo(id_grupo) ON DELETE CASCADE,
  id_perfil uuid NOT NULL REFERENCES public.perfil(id_perfil) ON DELETE CASCADE,
  es_colaborador boolean NOT NULL DEFAULT false,
  estado public.estado_membresia NOT NULL DEFAULT 'activo',
  unido_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grupo_miembro_pkey PRIMARY KEY (id_grupo, id_perfil)
);

CREATE TABLE public.publicacion (
  id_publicacion uuid NOT NULL DEFAULT gen_random_uuid(),
  id_perfil_autor uuid NOT NULL REFERENCES public.perfil(id_perfil),
  id_grupo uuid REFERENCES public.grupo(id_grupo) ON DELETE CASCADE,
  tipo public.tipo_publicacion NOT NULL,
  contenido text NOT NULL,
  estado public.estado_publicacion NOT NULL DEFAULT 'activa',
  creado_en timestamptz NOT NULL DEFAULT now(),
  eliminado_por uuid REFERENCES public.perfil(id_perfil),
  eliminado_en timestamptz,
  motivo_eliminacion text,
  id_sede uuid REFERENCES public.sede(id_sede),
  CONSTRAINT publicacion_pkey PRIMARY KEY (id_publicacion),
  CONSTRAINT publicacion_contenido_longitud CHECK (char_length(contenido) >= 1 AND char_length(contenido) <= 1000),
  CONSTRAINT publicacion_eliminador_par_completo CHECK ((eliminado_por IS NULL) = (eliminado_en IS NULL)),
  CONSTRAINT publicacion_motivo_requiere_eliminador CHECK (eliminado_por IS NOT NULL OR motivo_eliminacion IS NULL),
  CONSTRAINT publicacion_sede_coherente CHECK ((tipo = 'anuncio') = (id_sede IS NOT NULL)),
  CONSTRAINT tipo_grupo_coherente CHECK ((tipo = 'anuncio' AND id_grupo IS NULL) OR (tipo = 'grupo' AND id_grupo IS NOT NULL))
);

CREATE TABLE public.publicacion_imagen (
  id_publicacion_imagen uuid NOT NULL DEFAULT gen_random_uuid(),
  id_publicacion uuid NOT NULL REFERENCES public.publicacion(id_publicacion) ON DELETE CASCADE,
  imagen_url text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  creado_en timestamptz NOT NULL DEFAULT now(),
  estado_moderacion text,
  motivo_moderacion text,
  proveedor_moderacion text,
  moderado_en timestamptz,
  CONSTRAINT publicacion_imagen_pkey PRIMARY KEY (id_publicacion_imagen),
  CONSTRAINT publicacion_imagen_orden_unico UNIQUE (id_publicacion, orden),
  CONSTRAINT publicacion_imagen_estado_moderacion_check CHECK (estado_moderacion IN ('pendiente', 'aprobada', 'rechazada'))
);

CREATE TABLE public.comentario (
  id_comentario uuid NOT NULL DEFAULT gen_random_uuid(),
  id_publicacion uuid NOT NULL REFERENCES public.publicacion(id_publicacion) ON DELETE CASCADE,
  id_perfil_autor uuid NOT NULL REFERENCES public.perfil(id_perfil),
  contenido text NOT NULL,
  estado public.estado_comentario NOT NULL DEFAULT 'activo',
  creado_en timestamptz NOT NULL DEFAULT now(),
  id_comentario_padre uuid REFERENCES public.comentario(id_comentario),
  id_comentario_raiz uuid REFERENCES public.comentario(id_comentario),
  eliminado_por uuid REFERENCES public.perfil(id_perfil),
  eliminado_en timestamptz,
  motivo_eliminacion text,
  CONSTRAINT comentario_pkey PRIMARY KEY (id_comentario),
  CONSTRAINT comentario_contenido_longitud CHECK (char_length(contenido) >= 1 AND char_length(contenido) <= 1000),
  CONSTRAINT comentario_eliminador_par_completo CHECK ((eliminado_por IS NULL) = (eliminado_en IS NULL)),
  CONSTRAINT comentario_hilo_coherente CHECK ((id_comentario_padre IS NULL AND id_comentario_raiz IS NULL) OR (id_comentario_padre IS NOT NULL AND id_comentario_raiz IS NOT NULL)),
  CONSTRAINT comentario_motivo_requiere_eliminador CHECK (eliminado_por IS NOT NULL OR motivo_eliminacion IS NULL),
  CONSTRAINT comentario_no_autoreferencia CHECK (id_comentario_padre IS NULL OR id_comentario_padre <> id_comentario)
);

CREATE TABLE public.me_gusta (
  id_publicacion uuid NOT NULL REFERENCES public.publicacion(id_publicacion) ON DELETE CASCADE,
  id_perfil uuid NOT NULL REFERENCES public.perfil(id_perfil) ON DELETE CASCADE,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT me_gusta_pkey PRIMARY KEY (id_publicacion, id_perfil)
);

CREATE TABLE public.comentario_me_gusta (
  id_comentario uuid NOT NULL REFERENCES public.comentario(id_comentario) ON DELETE CASCADE,
  id_perfil uuid NOT NULL REFERENCES public.perfil(id_perfil),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comentario_me_gusta_pkey PRIMARY KEY (id_comentario, id_perfil)
);

CREATE TABLE public.evento (
  id_evento uuid NOT NULL DEFAULT gen_random_uuid(),
  id_perfil_creador uuid NOT NULL REFERENCES public.perfil(id_perfil),
  titulo text NOT NULL,
  descripcion text,
  ubicacion text,
  fecha_evento timestamptz NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  estado public.estado_evento NOT NULL DEFAULT 'activo',
  fecha_evento_original timestamptz,
  id_sede uuid NOT NULL REFERENCES public.sede(id_sede),
  cancelado_por uuid REFERENCES public.perfil(id_perfil),
  cancelado_en timestamptz,
  motivo_cancelacion text,
  CONSTRAINT evento_pkey PRIMARY KEY (id_evento),
  CONSTRAINT evento_cancelacion_coherente CHECK ((estado = 'cancelado') = (cancelado_en IS NOT NULL)),
  CONSTRAINT evento_cancelador_par_completo CHECK ((cancelado_por IS NULL) = (cancelado_en IS NULL)),
  CONSTRAINT evento_motivo_requiere_cancelador CHECK (cancelado_por IS NOT NULL OR motivo_cancelacion IS NULL)
);

CREATE TABLE public.evento_notificacion (
  id_evento uuid NOT NULL REFERENCES public.evento(id_evento) ON DELETE CASCADE,
  id_perfil uuid NOT NULL REFERENCES public.perfil(id_perfil) ON DELETE CASCADE,
  notif_1dia_enviada boolean NOT NULL DEFAULT false,
  notif_3horas_enviada boolean NOT NULL DEFAULT false,
  marcado_en timestamptz NOT NULL DEFAULT now(),
  desmarcado_en timestamptz,
  notif_inicio_enviada boolean NOT NULL DEFAULT false,
  CONSTRAINT evento_notificacion_pkey PRIMARY KEY (id_evento, id_perfil)
);

CREATE TABLE public.notificacion (
  id_notificacion uuid NOT NULL DEFAULT gen_random_uuid(),
  id_perfil uuid NOT NULL REFERENCES public.perfil(id_perfil) ON DELETE CASCADE,
  tipo public.tipo_notificacion NOT NULL,
  titulo text NOT NULL,
  cuerpo text NOT NULL,
  id_evento uuid REFERENCES public.evento(id_evento) ON DELETE CASCADE,
  creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  leida_en timestamptz,
  push_enviado_en timestamptz,
  CONSTRAINT notificacion_pkey PRIMARY KEY (id_notificacion)
);

CREATE TABLE public.dispositivo (
  id_dispositivo uuid NOT NULL DEFAULT gen_random_uuid(),
  id_perfil uuid NOT NULL REFERENCES public.perfil(id_perfil) ON DELETE CASCADE,
  push_token text NOT NULL,
  plataforma public.plataforma_dispositivo NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispositivo_pkey PRIMARY KEY (id_dispositivo),
  CONSTRAINT dispositivo_push_token_key UNIQUE (push_token)
);

CREATE TABLE public.motivo_reporte (
  id_motivo_reporte uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  CONSTRAINT motivo_reporte_pkey PRIMARY KEY (id_motivo_reporte)
);

CREATE TABLE public.reporte (
  id_reporte uuid NOT NULL DEFAULT gen_random_uuid(),
  id_perfil_denunciante uuid NOT NULL REFERENCES public.perfil(id_perfil),
  id_publicacion uuid REFERENCES public.publicacion(id_publicacion) ON DELETE CASCADE,
  id_comentario uuid REFERENCES public.comentario(id_comentario) ON DELETE CASCADE,
  id_motivo_reporte uuid NOT NULL REFERENCES public.motivo_reporte(id_motivo_reporte),
  detalle text,
  estado public.estado_reporte NOT NULL DEFAULT 'pendiente',
  id_perfil_resolutor uuid REFERENCES public.perfil(id_perfil),
  resuelto_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  id_grupo uuid REFERENCES public.grupo(id_grupo),
  CONSTRAINT reporte_pkey PRIMARY KEY (id_reporte),
  CONSTRAINT reporte_resolucion_coherente CHECK (
    (estado = 'pendiente' AND id_perfil_resolutor IS NULL AND resuelto_en IS NULL)
    OR (estado <> 'pendiente' AND id_perfil_resolutor IS NOT NULL AND resuelto_en IS NOT NULL)),
  CONSTRAINT reporte_un_objetivo CHECK (num_nonnulls(id_publicacion, id_comentario, id_grupo) = 1)
);

CREATE TABLE public.sancion (
  id_sancion uuid NOT NULL DEFAULT gen_random_uuid(),
  id_perfil_sancionado uuid NOT NULL REFERENCES public.perfil(id_perfil),
  id_reporte uuid REFERENCES public.reporte(id_reporte),
  id_perfil_admin uuid NOT NULL REFERENCES public.perfil(id_perfil),
  tipo public.tipo_sancion NOT NULL,
  sancion_hasta timestamptz,
  comentario_administrador text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sancion_pkey PRIMARY KEY (id_sancion),
  CONSTRAINT sancion_temporal_requiere_fecha CHECK (tipo <> 'temporal' OR sancion_hasta IS NOT NULL)
);

CREATE TABLE public.sancion_evidencia (
  id_sancion_evidencia uuid NOT NULL DEFAULT gen_random_uuid(),
  id_sancion uuid NOT NULL REFERENCES public.sancion(id_sancion) ON DELETE CASCADE,
  id_publicacion uuid REFERENCES public.publicacion(id_publicacion),
  id_comentario uuid REFERENCES public.comentario(id_comentario),
  id_perfil_autor_snapshot uuid NOT NULL REFERENCES public.perfil(id_perfil),
  nombre_autor_snapshot text NOT NULL,
  contenido_snapshot text NOT NULL,
  creado_en_original timestamptz NOT NULL,
  orden integer NOT NULL,
  CONSTRAINT sancion_evidencia_pkey PRIMARY KEY (id_sancion_evidencia),
  CONSTRAINT sancion_evidencia_orden_unico UNIQUE (id_sancion, orden),
  CONSTRAINT evidencia_objetivo_coherente CHECK (
    (id_publicacion IS NOT NULL AND id_comentario IS NULL)
    OR (id_publicacion IS NULL AND id_comentario IS NOT NULL))
);

CREATE TABLE public.moderacion_umbral (
  id_categoria_moderacion text NOT NULL,
  umbral numeric(3,2) NOT NULL,
  actualizado_por uuid REFERENCES public.perfil(id_perfil) ON DELETE SET NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT moderacion_umbral_pkey PRIMARY KEY (id_categoria_moderacion),
  CONSTRAINT moderacion_umbral_categoria_valida CHECK (id_categoria_moderacion IN (
    'harassment', 'harassment/threatening', 'hate', 'hate/threatening', 'illicit', 'illicit/violent',
    'self-harm', 'self-harm/intent', 'self-harm/instructions', 'sexual', 'sexual/minors',
    'violence', 'violence/graphic')),
  CONSTRAINT moderacion_umbral_umbral_check CHECK (umbral >= 0 AND umbral <= 1)
);

CREATE TABLE public.moderacion_resultado (
  id_moderacion_resultado uuid NOT NULL DEFAULT gen_random_uuid(),
  id_publicacion uuid REFERENCES public.publicacion(id_publicacion) ON DELETE CASCADE,
  id_comentario uuid REFERENCES public.comentario(id_comentario) ON DELETE CASCADE,
  puntajes jsonb NOT NULL,
  categorias_marcadas text[] NOT NULL DEFAULT '{}',
  motivo text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  decision text,
  revisado_por uuid REFERENCES public.perfil(id_perfil) ON DELETE SET NULL,
  revisado_en timestamptz,
  CONSTRAINT moderacion_resultado_pkey PRIMARY KEY (id_moderacion_resultado),
  CONSTRAINT moderacion_resultado_decision_check CHECK (decision IN ('aprobada', 'rechazada', 'sancionada')),
  CONSTRAINT moderacion_resultado_decision_completa CHECK ((decision IS NULL) = (revisado_en IS NULL)),
  CONSTRAINT moderacion_resultado_motivo_check CHECK (motivo IN ('umbral', 'error_api')),
  CONSTRAINT moderacion_resultado_un_objetivo CHECK (num_nonnulls(id_publicacion, id_comentario) = 1)
);

-- ---------- Índices ----------
CREATE INDEX idx_comentario_me_gusta_id_perfil ON public.comentario_me_gusta (id_perfil);
CREATE INDEX notificacion_perfil_creado_idx ON public.notificacion (id_perfil, creado_en DESC);
CREATE INDEX notificacion_no_leidas_idx ON public.notificacion (id_perfil) WHERE leida_en IS NULL;
CREATE INDEX idx_moderacion_resultado_pendientes ON public.moderacion_resultado (creado_en) WHERE decision IS NULL;
CREATE UNIQUE INDEX uq_moderacion_resultado_publicacion ON public.moderacion_resultado (id_publicacion) WHERE id_publicacion IS NOT NULL;
CREATE UNIQUE INDEX uq_moderacion_resultado_comentario ON public.moderacion_resultado (id_comentario) WHERE id_comentario IS NOT NULL;
CREATE INDEX idx_perfil_id_carrera ON public.perfil (id_carrera);
CREATE INDEX perfil_id_sede_idx ON public.perfil (id_sede);
CREATE INDEX idx_dispositivo_id_perfil ON public.dispositivo (id_perfil);
CREATE INDEX idx_grupo_miembro_id_perfil ON public.grupo_miembro (id_perfil);
CREATE INDEX idx_me_gusta_id_perfil ON public.me_gusta (id_perfil);
CREATE INDEX idx_sancion_evidencia_id_sancion ON public.sancion_evidencia (id_sancion);
CREATE INDEX idx_sancion_evidencia_id_publicacion ON public.sancion_evidencia (id_publicacion);
CREATE INDEX idx_sancion_evidencia_id_comentario ON public.sancion_evidencia (id_comentario);
CREATE INDEX idx_sancion_evidencia_id_perfil_autor_snapshot ON public.sancion_evidencia (id_perfil_autor_snapshot);
CREATE INDEX idx_sancion_id_perfil_sancionado ON public.sancion (id_perfil_sancionado);
CREATE INDEX idx_sancion_id_reporte ON public.sancion (id_reporte);
CREATE INDEX idx_sancion_id_perfil_admin ON public.sancion (id_perfil_admin);
CREATE INDEX idx_comentario_id_publicacion ON public.comentario (id_publicacion);
CREATE INDEX idx_comentario_id_perfil_autor ON public.comentario (id_perfil_autor);
CREATE INDEX idx_comentario_id_comentario_padre ON public.comentario (id_comentario_padre);
CREATE INDEX idx_comentario_id_comentario_raiz ON public.comentario (id_comentario_raiz);
CREATE INDEX idx_comentario_en_revision ON public.comentario (creado_en) WHERE estado = 'en_revision';
CREATE INDEX idx_reporte_id_perfil_denunciante ON public.reporte (id_perfil_denunciante);
CREATE INDEX idx_reporte_id_publicacion ON public.reporte (id_publicacion);
CREATE INDEX idx_reporte_id_comentario ON public.reporte (id_comentario);
CREATE INDEX idx_reporte_id_motivo_reporte ON public.reporte (id_motivo_reporte);
CREATE INDEX idx_reporte_id_perfil_resolutor ON public.reporte (id_perfil_resolutor);
CREATE INDEX idx_reporte_id_grupo ON public.reporte (id_grupo);
CREATE UNIQUE INDEX reporte_pendiente_unico_publicacion ON public.reporte (id_perfil_denunciante, id_publicacion) WHERE estado = 'pendiente' AND id_publicacion IS NOT NULL;
CREATE UNIQUE INDEX reporte_pendiente_unico_grupo ON public.reporte (id_perfil_denunciante, id_grupo) WHERE estado = 'pendiente' AND id_grupo IS NOT NULL;
CREATE UNIQUE INDEX reporte_pendiente_unico_comentario ON public.reporte (id_perfil_denunciante, id_comentario) WHERE estado = 'pendiente' AND id_comentario IS NOT NULL;
CREATE INDEX idx_reporte_estado ON public.reporte (estado, creado_en);
CREATE INDEX idx_grupo_id_perfil_creador ON public.grupo (id_perfil_creador);
CREATE INDEX grupo_id_sede_idx ON public.grupo (id_sede);
CREATE INDEX idx_evento_notificacion_id_perfil ON public.evento_notificacion (id_perfil);
CREATE INDEX idx_evento_notificacion_activos ON public.evento_notificacion (id_evento) WHERE desmarcado_en IS NULL;
CREATE INDEX idx_publicacion_id_perfil_autor ON public.publicacion (id_perfil_autor);
CREATE INDEX idx_publicacion_id_grupo ON public.publicacion (id_grupo);
CREATE INDEX publicacion_id_sede_idx ON public.publicacion (id_sede) WHERE id_sede IS NOT NULL;
CREATE INDEX idx_publicacion_en_revision ON public.publicacion (creado_en) WHERE estado = 'en_revision';
CREATE INDEX idx_evento_id_perfil_creador ON public.evento (id_perfil_creador);
CREATE INDEX evento_id_sede_idx ON public.evento (id_sede);
CREATE INDEX idx_evento_sede_fecha ON public.evento (id_sede, fecha_evento);
CREATE INDEX idx_publicacion_imagen_id_publicacion ON public.publicacion_imagen (id_publicacion);

-- ---------- Funciones y triggers ----------
CREATE OR REPLACE FUNCTION public.fn_heredar_sede_del_creador()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.id_sede is null then
    select p.id_sede into new.id_sede
    from perfil p
    where p.id_perfil = (to_jsonb(new) ->> tg_argv[0])::uuid;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_validar_hilo_comentario()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  padre_de_padre uuid;
  raiz_del_padre uuid;
  padre_del_abuelo uuid;
BEGIN
  IF NEW.id_comentario_padre IS NULL THEN
    NEW.id_comentario_raiz := NULL;
    RETURN NEW;
  END IF;

  SELECT p.id_comentario_padre, p.id_comentario_raiz, gp.id_comentario_padre
    INTO padre_de_padre, raiz_del_padre, padre_del_abuelo
  FROM public.comentario p
  LEFT JOIN public.comentario gp ON gp.id_comentario = p.id_comentario_padre
  WHERE p.id_comentario = NEW.id_comentario_padre;

  IF padre_de_padre IS NULL THEN
    -- el padre es un comentario raíz (nivel 1) -> este nuevo comentario es nivel 2
    NEW.id_comentario_raiz := NEW.id_comentario_padre;
  ELSIF padre_del_abuelo IS NULL THEN
    -- el padre es nivel 2 (su padre es raíz) -> este nuevo comentario es nivel 3, permitido
    NEW.id_comentario_raiz := raiz_del_padre;
  ELSE
    RAISE EXCEPTION 'No se puede responder directamente a un comentario de nivel 3; la respuesta debe adjuntarse al comentario de nivel 2 con una mención al autor en el texto.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validar_hilo_comentario BEFORE INSERT OR UPDATE OF id_comentario_padre ON public.comentario FOR EACH ROW EXECUTE FUNCTION fn_validar_hilo_comentario();
CREATE TRIGGER trg_grupo_heredar_sede BEFORE INSERT ON public.grupo FOR EACH ROW EXECUTE FUNCTION fn_heredar_sede_del_creador('id_perfil_creador');
CREATE TRIGGER trg_evento_heredar_sede BEFORE INSERT ON public.evento FOR EACH ROW EXECUTE FUNCTION fn_heredar_sede_del_creador('id_perfil_creador');
CREATE TRIGGER trg_publicacion_anuncio_heredar_sede BEFORE INSERT ON public.publicacion FOR EACH ROW WHEN (new.tipo = 'anuncio') EXECUTE FUNCTION fn_heredar_sede_del_creador('id_perfil_autor');

CREATE OR REPLACE FUNCTION public.fn_aplicar_baneo(p_id_perfil uuid, p_id_admin uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  update perfil set estado_cuenta = 'baneada', sancion_hasta = null where id_perfil = p_id_perfil;

  -- Lo retenido por el filtro de IA también se cierra: si no, un administrador podría aprobar
  -- después contenido de una cuenta baneada. Va ANTES de eliminar, porque busca por estado 'en_revision'.
  update moderacion_resultado
     set decision = 'rechazada', revisado_por = p_id_admin, revisado_en = now()
   where decision is null
     and (
       id_publicacion in (select id_publicacion from publicacion where id_perfil_autor = p_id_perfil and estado = 'en_revision')
       or id_comentario in (select id_comentario from comentario where id_perfil_autor = p_id_perfil and estado = 'en_revision')
     );

  update publicacion_imagen
     set estado_moderacion = 'rechazada', moderado_en = now()
   where estado_moderacion = 'pendiente'
     and id_publicacion in (select id_publicacion from publicacion where id_perfil_autor = p_id_perfil and estado = 'en_revision');

  update publicacion set estado = 'eliminada', eliminado_por = p_id_admin, eliminado_en = now(), motivo_eliminacion = p_motivo
   where id_perfil_autor = p_id_perfil and estado in ('activa', 'en_revision');

  update comentario set estado = 'eliminado', eliminado_por = p_id_admin, eliminado_en = now(), motivo_eliminacion = p_motivo
   where id_perfil_autor = p_id_perfil and estado in ('activo', 'en_revision');

  update grupo set estado = 'eliminado', eliminado_por = p_id_admin, eliminado_en = now(), motivo_eliminacion = p_motivo
   where id_perfil_creador = p_id_perfil and estado <> 'eliminado';

  update grupo_miembro set estado = 'expulsado'
   where id_perfil = p_id_perfil and estado in ('activo', 'pendiente_aprobacion');

  delete from me_gusta where id_perfil = p_id_perfil;
  delete from comentario_me_gusta where id_perfil = p_id_perfil;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_sancionar_directo(p_id_admin uuid, p_id_publicacion uuid, p_id_comentario uuid, p_tipo_sancion text, p_dias integer DEFAULT NULL::integer, p_comentario text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_admin_rol rol_plataforma;
  v_tipo_obj text;
  v_id_autor uuid;
  v_rol_autor rol_plataforma;
  v_estado_obj text;
  v_tipo_sancion tipo_sancion;
  v_hasta timestamptz;
  v_id_sancion uuid;
  v_frase text;
begin
  if num_nonnulls(p_id_publicacion, p_id_comentario) <> 1 then
    raise exception 'Indica exactamente una publicación o un comentario' using errcode = '22023';
  end if;
  if p_tipo_sancion is null or p_tipo_sancion not in ('temporal', 'baneo', 'escalar') then
    raise exception 'Tipo de sanción inválido' using errcode = '22023';
  end if;

  select pf.rol_plataforma into v_admin_rol from perfil pf where pf.id_perfil = p_id_admin;
  if v_admin_rol is distinct from 'administrador'::rol_plataforma then
    raise exception 'No tienes permisos para sancionar' using errcode = '42501';
  end if;

  if p_id_publicacion is not null then
    v_tipo_obj := 'publicacion';
    select pu.id_perfil_autor, pu.estado::text into v_id_autor, v_estado_obj
    from publicacion pu where pu.id_publicacion = p_id_publicacion for update;
  else
    v_tipo_obj := 'comentario';
    select co.id_perfil_autor, co.estado::text into v_id_autor, v_estado_obj
    from comentario co where co.id_comentario = p_id_comentario for update;
  end if;

  if v_id_autor is null then
    raise exception 'Contenido no encontrado' using errcode = 'P0002';
  end if;
  if v_estado_obj not in ('activa', 'activo') then
    raise exception 'El contenido ya fue eliminado' using errcode = 'P0001';
  end if;

  -- Con reportes pendientes sobre este mismo contenido, el caso se resuelve desde Moderación.
  if exists (
    select 1 from reporte r
    where r.estado = 'pendiente'
      and ((p_id_publicacion is not null and r.id_publicacion = p_id_publicacion)
        or (p_id_comentario  is not null and r.id_comentario  = p_id_comentario))
  ) then
    raise exception 'Este contenido tiene reportes pendientes: resuélvelos desde Moderación' using errcode = 'P0001';
  end if;

  v_tipo_sancion := (case p_tipo_sancion when 'escalar' then 'escalado' else p_tipo_sancion end)::tipo_sancion;

  if v_tipo_sancion = 'temporal' then
    if p_dias is null or p_dias < 1 or p_dias > 365 then
      raise exception 'La sanción temporal debe durar entre 1 y 365 días' using errcode = '22023';
    end if;
    v_hasta := now() + make_interval(days => p_dias);
  end if;

  select pf.rol_plataforma into v_rol_autor from perfil pf where pf.id_perfil = v_id_autor;
  if v_rol_autor = 'administrador'::rol_plataforma then
    raise exception 'No se puede sancionar a un administrador' using errcode = 'P0001';
  end if;

  -- Sanción sin reporte (id_reporte nulo) + evidencia (snapshot de texto).
  insert into sancion (id_perfil_sancionado, id_reporte, id_perfil_admin, tipo, sancion_hasta, comentario_administrador)
  values (v_id_autor, null, p_id_admin, v_tipo_sancion, v_hasta, nullif(btrim(p_comentario), ''))
  returning id_sancion into v_id_sancion;

  if v_tipo_obj = 'publicacion' then
    insert into sancion_evidencia (id_sancion, id_publicacion, id_perfil_autor_snapshot, nombre_autor_snapshot, contenido_snapshot, creado_en_original, orden)
    select v_id_sancion, pu.id_publicacion, pu.id_perfil_autor,
           concat_ws(' ', pf.nombres, pf.primer_apellido, pf.segundo_apellido),
           pu.contenido, pu.creado_en, 0
    from publicacion pu join perfil pf on pf.id_perfil = pu.id_perfil_autor
    where pu.id_publicacion = p_id_publicacion;
    v_frase := 'Tu publicación fue eliminada';
  else
    -- orden 0: la publicación donde ocurre (contexto)
    insert into sancion_evidencia (id_sancion, id_publicacion, id_perfil_autor_snapshot, nombre_autor_snapshot, contenido_snapshot, creado_en_original, orden)
    select v_id_sancion, pu.id_publicacion, pu.id_perfil_autor,
           concat_ws(' ', pf.nombres, pf.primer_apellido, pf.segundo_apellido),
           pu.contenido, pu.creado_en, 0
    from comentario co
    join publicacion pu on pu.id_publicacion = co.id_publicacion
    join perfil pf on pf.id_perfil = pu.id_perfil_autor
    where co.id_comentario = p_id_comentario;

    -- luego el hilo, de la raíz hasta el comentario sancionado
    with recursive cadena as (
      select c0.id_comentario, c0.id_comentario_padre, c0.id_perfil_autor, c0.contenido, c0.creado_en, 0 as nivel
      from comentario c0 where c0.id_comentario = p_id_comentario
      union all
      select c1.id_comentario, c1.id_comentario_padre, c1.id_perfil_autor, c1.contenido, c1.creado_en, cadena.nivel + 1
      from comentario c1 join cadena on c1.id_comentario = cadena.id_comentario_padre
    )
    insert into sancion_evidencia (id_sancion, id_comentario, id_perfil_autor_snapshot, nombre_autor_snapshot, contenido_snapshot, creado_en_original, orden)
    select v_id_sancion, ca.id_comentario, ca.id_perfil_autor,
           concat_ws(' ', pf.nombres, pf.primer_apellido, pf.segundo_apellido),
           ca.contenido, ca.creado_en, (row_number() over (order by ca.nivel desc))::int
    from cadena ca join perfil pf on pf.id_perfil = ca.id_perfil_autor;
    v_frase := 'Tu comentario fue eliminado';
  end if;

  -- Eliminación del contenido sancionado, con trazabilidad.
  if v_tipo_obj = 'publicacion' then
    update publicacion set estado = 'eliminada', eliminado_por = p_id_admin, eliminado_en = now(),
           motivo_eliminacion = 'Sanción directa del administrador'
    where id_publicacion = p_id_publicacion and estado = 'activa';
  else
    update comentario set estado = 'eliminado', eliminado_por = p_id_admin, eliminado_en = now(),
           motivo_eliminacion = 'Sanción directa del administrador'
    where id_comentario = p_id_comentario and estado = 'activo';
  end if;

  -- Efecto sobre la cuenta: igual que al resolver un reporte.
  if v_tipo_sancion in ('baneo', 'escalado') then
    perform fn_aplicar_baneo(v_id_autor, p_id_admin, 'Cuenta baneada por infracción de las normas');
  else
    update perfil
       set estado_cuenta = 'sancionada',
           sancion_hasta = greatest(v_hasta, case when estado_cuenta = 'sancionada' then sancion_hasta end)
     where id_perfil = v_id_autor and estado_cuenta <> 'baneada';
  end if;

  insert into notificacion (id_perfil, tipo, titulo, cuerpo)
  values (v_id_autor, 'contenido_eliminado', 'Se eliminó contenido tuyo',
          v_frase || ' por infringir las normas de la comunidad.');

  if v_tipo_sancion = 'temporal' then
    insert into notificacion (id_perfil, tipo, titulo, cuerpo)
    values (v_id_autor, 'sancion_aplicada', 'Tu cuenta fue sancionada',
            format('Tu cuenta quedó sancionada hasta el %s. Mientras tanto no podrás publicar, comentar ni dar me gusta.',
                   to_char(v_hasta at time zone 'America/Santiago', 'DD/MM/YYYY HH24:MI')));
  end if;

  return jsonb_build_object('id_sancion', v_id_sancion, 'id_perfil_afectado', v_id_autor,
                            'cuenta_baneada', v_tipo_sancion in ('baneo', 'escalado'));
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_resolver_reporte(p_id_reporte uuid, p_id_admin uuid, p_resolucion text, p_tipo_sancion text DEFAULT NULL::text, p_dias integer DEFAULT NULL::integer, p_comentario text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_admin_rol rol_plataforma;
  v_rep reporte%rowtype;
  v_ids uuid[];
  v_tipo_obj text;
  v_id_autor uuid;
  v_rol_autor rol_plataforma;
  v_motivo text;
  v_tipo_sancion tipo_sancion;
  v_hasta timestamptz;
  v_id_sancion uuid;
  v_frase text;
  v_motivo_elim text;
begin
  if p_resolucion not in ('sin_infraccion', 'infraccion', 'escalar') then
    raise exception 'Resolución inválida' using errcode = '22023';
  end if;

  select pf.rol_plataforma into v_admin_rol from perfil pf where pf.id_perfil = p_id_admin;
  if v_admin_rol is distinct from 'administrador'::rol_plataforma then
    raise exception 'No tienes permisos para resolver reportes' using errcode = '42501';
  end if;

  select * into v_rep from reporte where id_reporte = p_id_reporte for update;
  if not found then
    raise exception 'Reporte no encontrado' using errcode = 'P0002';
  end if;
  if v_rep.estado <> 'pendiente' then
    raise exception 'El reporte ya fue resuelto' using errcode = 'P0001';
  end if;

  -- Todos los reportes pendientes sobre el mismo contenido se resuelven juntos.
  select array_agg(s.id_reporte) into v_ids from (
    select r2.id_reporte from reporte r2
    where r2.estado = 'pendiente'
      and ((v_rep.id_publicacion is not null and r2.id_publicacion = v_rep.id_publicacion)
        or (v_rep.id_comentario  is not null and r2.id_comentario  = v_rep.id_comentario)
        or (v_rep.id_grupo       is not null and r2.id_grupo       = v_rep.id_grupo))
    for update of r2
  ) s;

  if v_rep.id_publicacion is not null then
    v_tipo_obj := 'publicacion';
    select pu.id_perfil_autor into v_id_autor from publicacion pu where pu.id_publicacion = v_rep.id_publicacion;
  elsif v_rep.id_comentario is not null then
    v_tipo_obj := 'comentario';
    select co.id_perfil_autor into v_id_autor from comentario co where co.id_comentario = v_rep.id_comentario;
  else
    v_tipo_obj := 'grupo';
    select g.id_perfil_creador into v_id_autor from grupo g where g.id_grupo = v_rep.id_grupo;
  end if;

  if v_id_autor is null then
    raise exception 'El contenido reportado ya no existe' using errcode = 'P0002';
  end if;

  select m.nombre into v_motivo from motivo_reporte m where m.id_motivo_reporte = v_rep.id_motivo_reporte;

  -- ---------- Sin infracción ----------
  if p_resolucion = 'sin_infraccion' then
    update reporte set estado = 'sin_infraccion', id_perfil_resolutor = p_id_admin, resuelto_en = now()
    where id_reporte = any(v_ids);

    insert into notificacion (id_perfil, tipo, titulo, cuerpo)
    select distinct r3.id_perfil_denunciante, 'reporte_resuelto'::tipo_notificacion,
           'Tu reporte fue revisado',
           'Revisamos tu reporte y no encontramos una infracción a las normas de la comunidad.'
    from reporte r3 where r3.id_reporte = any(v_ids);

    return jsonb_build_object('resolucion', p_resolucion, 'reportes_resueltos', cardinality(v_ids),
                              'id_sancion', null, 'id_perfil_afectado', v_id_autor, 'cuenta_baneada', false);
  end if;

  -- ---------- Infracción o escalamiento ----------
  if p_resolucion = 'escalar' then
    if v_tipo_obj = 'grupo' then
      raise exception 'Los reportes de grupo no se pueden escalar en esta versión' using errcode = 'P0001';
    end if;
    v_tipo_sancion := 'escalado';
  elsif p_tipo_sancion is not null then
    if p_tipo_sancion not in ('temporal', 'baneo') then
      raise exception 'Tipo de sanción inválido' using errcode = '22023';
    end if;
    v_tipo_sancion := p_tipo_sancion::tipo_sancion;
  elsif v_tipo_obj <> 'grupo' then
    raise exception 'Indica el tipo de sanción (temporal o baneo)' using errcode = '22023';
  end if;

  if v_tipo_sancion = 'temporal' then
    if p_dias is null or p_dias < 1 or p_dias > 365 then
      raise exception 'La sanción temporal debe durar entre 1 y 365 días' using errcode = '22023';
    end if;
    v_hasta := now() + make_interval(days => p_dias);
  end if;

  select pf.rol_plataforma into v_rol_autor from perfil pf where pf.id_perfil = v_id_autor;
  if v_rol_autor = 'administrador'::rol_plataforma then
    raise exception 'No se puede sancionar a un administrador' using errcode = 'P0001';
  end if;

  -- Sanción + evidencia (snapshot de texto: sobrevive aunque el contenido cambie o se elimine).
  if v_tipo_sancion is not null then
    insert into sancion (id_perfil_sancionado, id_reporte, id_perfil_admin, tipo, sancion_hasta, comentario_administrador)
    values (v_id_autor, p_id_reporte, p_id_admin, v_tipo_sancion, v_hasta, nullif(btrim(p_comentario), ''))
    returning id_sancion into v_id_sancion;

    if v_tipo_obj = 'publicacion' then
      insert into sancion_evidencia (id_sancion, id_publicacion, id_perfil_autor_snapshot, nombre_autor_snapshot, contenido_snapshot, creado_en_original, orden)
      select v_id_sancion, pu.id_publicacion, pu.id_perfil_autor,
             concat_ws(' ', pf.nombres, pf.primer_apellido, pf.segundo_apellido),
             pu.contenido, pu.creado_en, 0
      from publicacion pu join perfil pf on pf.id_perfil = pu.id_perfil_autor
      where pu.id_publicacion = v_rep.id_publicacion;

    elsif v_tipo_obj = 'comentario' then
      -- orden 0: la publicación donde ocurre (contexto)
      insert into sancion_evidencia (id_sancion, id_publicacion, id_perfil_autor_snapshot, nombre_autor_snapshot, contenido_snapshot, creado_en_original, orden)
      select v_id_sancion, pu.id_publicacion, pu.id_perfil_autor,
             concat_ws(' ', pf.nombres, pf.primer_apellido, pf.segundo_apellido),
             pu.contenido, pu.creado_en, 0
      from comentario co
      join publicacion pu on pu.id_publicacion = co.id_publicacion
      join perfil pf on pf.id_perfil = pu.id_perfil_autor
      where co.id_comentario = v_rep.id_comentario;

      -- luego el hilo, de la raíz hasta el comentario reportado
      with recursive cadena as (
        select c0.id_comentario, c0.id_comentario_padre, c0.id_perfil_autor, c0.contenido, c0.creado_en, 0 as nivel
        from comentario c0 where c0.id_comentario = v_rep.id_comentario
        union all
        select c1.id_comentario, c1.id_comentario_padre, c1.id_perfil_autor, c1.contenido, c1.creado_en, cadena.nivel + 1
        from comentario c1 join cadena on c1.id_comentario = cadena.id_comentario_padre
      )
      insert into sancion_evidencia (id_sancion, id_comentario, id_perfil_autor_snapshot, nombre_autor_snapshot, contenido_snapshot, creado_en_original, orden)
      select v_id_sancion, ca.id_comentario, ca.id_perfil_autor,
             concat_ws(' ', pf.nombres, pf.primer_apellido, pf.segundo_apellido),
             ca.contenido, ca.creado_en, (row_number() over (order by ca.nivel desc))::int
      from cadena ca join perfil pf on pf.id_perfil = ca.id_perfil_autor;
    end if;
  end if;

  -- Eliminación del contenido reportado, con trazabilidad.
  v_motivo_elim := 'Infracción de las normas: ' || coalesce(v_motivo, 'sin motivo');
  if v_tipo_obj = 'publicacion' then
    update publicacion set estado = 'eliminada', eliminado_por = p_id_admin, eliminado_en = now(), motivo_eliminacion = v_motivo_elim
    where id_publicacion = v_rep.id_publicacion and estado = 'activa';
    v_frase := 'Tu publicación fue eliminada';
  elsif v_tipo_obj = 'comentario' then
    update comentario set estado = 'eliminado', eliminado_por = p_id_admin, eliminado_en = now(), motivo_eliminacion = v_motivo_elim
    where id_comentario = v_rep.id_comentario and estado = 'activo';
    v_frase := 'Tu comentario fue eliminado';
  else
    update grupo set estado = 'eliminado', eliminado_por = p_id_admin, eliminado_en = now(), motivo_eliminacion = v_motivo_elim
    where id_grupo = v_rep.id_grupo and estado <> 'eliminado';
    v_frase := 'Tu grupo fue eliminado';
  end if;

  -- Efecto sobre la cuenta. Baneo y escalamiento son ambos baneo permanente: la cuenta queda baneada
  -- y se oculta todo lo suyo (publicaciones, comentarios, grupos que creó, membresías y me gusta).
  -- Los demás reportes pendientes contra su contenido se dejan abiertos a propósito.
  if v_tipo_sancion in ('baneo', 'escalado') then
    perform fn_aplicar_baneo(v_id_autor, p_id_admin, 'Cuenta baneada por infracción de las normas');
  elsif v_tipo_sancion = 'temporal' then
    update perfil
       set estado_cuenta = 'sancionada',
           sancion_hasta = greatest(v_hasta, case when estado_cuenta = 'sancionada' then sancion_hasta end)
     where id_perfil = v_id_autor and estado_cuenta <> 'baneada';
  end if;

  update reporte set estado = 'infraccion', id_perfil_resolutor = p_id_admin, resuelto_en = now()
  where id_reporte = any(v_ids);

  -- Avisos por la bandeja interna. Al denunciante no se le dan detalles de la sanción.
  insert into notificacion (id_perfil, tipo, titulo, cuerpo)
  select distinct r3.id_perfil_denunciante, 'reporte_resuelto'::tipo_notificacion,
         'Tu reporte fue revisado',
         'Revisamos tu reporte y se tomaron medidas sobre el contenido. Gracias por ayudar a cuidar la comunidad.'
  from reporte r3 where r3.id_reporte = any(v_ids);

  insert into notificacion (id_perfil, tipo, titulo, cuerpo)
  values (v_id_autor, 'contenido_eliminado', 'Se eliminó contenido tuyo',
          v_frase || ' por infringir las normas de la comunidad.');

  if v_tipo_sancion = 'temporal' then
    insert into notificacion (id_perfil, tipo, titulo, cuerpo)
    values (v_id_autor, 'sancion_aplicada', 'Tu cuenta fue sancionada',
            format('Tu cuenta quedó sancionada hasta el %s. Mientras tanto no podrás publicar, comentar ni dar me gusta.',
                   to_char(v_hasta at time zone 'America/Santiago', 'DD/MM/YYYY HH24:MI')));
  end if;
  -- Un baneo no genera aviso: la cuenta ya no puede iniciar sesión para leerlo.

  return jsonb_build_object('resolucion', p_resolucion, 'reportes_resueltos', cardinality(v_ids),
                            'id_sancion', v_id_sancion, 'id_perfil_afectado', v_id_autor,
                            'cuenta_baneada', coalesce(v_tipo_sancion in ('baneo', 'escalado'), false));
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_revisar_publicacion(p_id_admin uuid, p_id_publicacion uuid, p_decision text, p_tipo_sancion text DEFAULT NULL::text, p_dias integer DEFAULT NULL::integer, p_comentario text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_admin_rol rol_plataforma;
  v_id_autor uuid;
  v_estado text;
  v_resultado jsonb := '{}'::jsonb;
begin
  if p_decision is null or p_decision not in ('aprobada', 'rechazada', 'sancionada') then
    raise exception 'decision debe ser aprobada, rechazada o sancionada' using errcode = '22023';
  end if;

  select pf.rol_plataforma into v_admin_rol from perfil pf where pf.id_perfil = p_id_admin;
  if v_admin_rol is distinct from 'administrador'::rol_plataforma then
    raise exception 'No tienes permisos para revisar contenido' using errcode = '42501';
  end if;

  -- Se bloquea la publicación: si dos administradores deciden a la vez, el segundo espera y luego falla.
  select pu.id_perfil_autor, pu.estado::text into v_id_autor, v_estado
  from publicacion pu where pu.id_publicacion = p_id_publicacion for update;

  if v_id_autor is null then
    raise exception 'Publicación no encontrada' using errcode = 'P0002';
  end if;
  if v_estado <> 'en_revision' or not exists (
    select 1 from moderacion_resultado r
    where r.id_publicacion = p_id_publicacion and r.decision is null
  ) then
    raise exception 'Esta publicación no está pendiente de revisión' using errcode = 'P0001';
  end if;

  if p_decision = 'aprobada' then
    update publicacion set estado = 'activa' where id_publicacion = p_id_publicacion;
    update publicacion_imagen
       set estado_moderacion = 'aprobada', moderado_en = now()
     where id_publicacion = p_id_publicacion and estado_moderacion = 'pendiente';

  elsif p_decision = 'rechazada' then
    update publicacion
       set estado = 'eliminada', eliminado_por = p_id_admin, eliminado_en = now(),
           motivo_eliminacion = 'Rechazada en la revisión de moderación'
     where id_publicacion = p_id_publicacion;
    update publicacion_imagen
       set estado_moderacion = 'rechazada', moderado_en = now()
     where id_publicacion = p_id_publicacion and estado_moderacion = 'pendiente';

    insert into notificacion (id_perfil, tipo, titulo, cuerpo)
    values (v_id_autor, 'contenido_eliminado', 'Tu publicación no fue aprobada',
            'Tu publicación fue revisada y no se publicó por no cumplir las normas de la comunidad.');

  else
    -- ATAJO deliberado: fn_sancionar_directo solo acepta publicaciones 'activa'. Se pasa a 'activa'
    -- dentro de esta misma transacción (la fila está bloqueada, nadie ve el estado intermedio) y esa
    -- función la deja 'eliminada' con la sanción, la evidencia y las notificaciones de siempre.
    update publicacion set estado = 'activa' where id_publicacion = p_id_publicacion;
    v_resultado := fn_sancionar_directo(p_id_admin, p_id_publicacion, null, p_tipo_sancion, p_dias, p_comentario);
    update publicacion_imagen
       set estado_moderacion = 'rechazada', moderado_en = now()
     where id_publicacion = p_id_publicacion and estado_moderacion = 'pendiente';
  end if;

  update moderacion_resultado
     set decision = p_decision, revisado_por = p_id_admin, revisado_en = now()
   where id_publicacion = p_id_publicacion;

  return v_resultado || jsonb_build_object('decision', p_decision);
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_revisar_comentario(p_id_admin uuid, p_id_comentario uuid, p_decision text, p_tipo_sancion text DEFAULT NULL::text, p_dias integer DEFAULT NULL::integer, p_comentario text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_admin_rol rol_plataforma;
  v_id_autor uuid;
  v_estado text;
  v_resultado jsonb := '{}'::jsonb;
begin
  if p_decision is null or p_decision not in ('aprobada', 'rechazada', 'sancionada') then
    raise exception 'decision debe ser aprobada, rechazada o sancionada' using errcode = '22023';
  end if;

  select pf.rol_plataforma into v_admin_rol from perfil pf where pf.id_perfil = p_id_admin;
  if v_admin_rol is distinct from 'administrador'::rol_plataforma then
    raise exception 'No tienes permisos para revisar contenido' using errcode = '42501';
  end if;

  -- Se bloquea el comentario: si dos administradores deciden a la vez, el segundo espera y luego falla.
  select co.id_perfil_autor, co.estado::text into v_id_autor, v_estado
  from comentario co where co.id_comentario = p_id_comentario for update;

  if v_id_autor is null then
    raise exception 'Comentario no encontrado' using errcode = 'P0002';
  end if;
  if v_estado <> 'en_revision' or not exists (
    select 1 from moderacion_resultado r
    where r.id_comentario = p_id_comentario and r.decision is null
  ) then
    raise exception 'Este comentario no está pendiente de revisión' using errcode = 'P0001';
  end if;

  if p_decision = 'aprobada' then
    update comentario set estado = 'activo' where id_comentario = p_id_comentario;

  elsif p_decision = 'rechazada' then
    update comentario
       set estado = 'eliminado', eliminado_por = p_id_admin, eliminado_en = now(),
           motivo_eliminacion = 'Rechazado en la revisión de moderación'
     where id_comentario = p_id_comentario;

    insert into notificacion (id_perfil, tipo, titulo, cuerpo)
    values (v_id_autor, 'contenido_eliminado', 'Tu comentario no fue aprobado',
            'Tu comentario fue revisado y no se publicó por no cumplir las normas de la comunidad.');

  else
    -- ATAJO deliberado, igual que en fn_revisar_publicacion: fn_sancionar_directo solo acepta
    -- comentarios 'activo'. Se pasa a 'activo' dentro de esta transacción (la fila está bloqueada,
    -- nadie ve el estado intermedio) y esa función lo deja 'eliminado' con sanción y evidencia.
    update comentario set estado = 'activo' where id_comentario = p_id_comentario;
    v_resultado := fn_sancionar_directo(p_id_admin, null, p_id_comentario, p_tipo_sancion, p_dias, p_comentario);
  end if;

  update moderacion_resultado
     set decision = p_decision, revisado_por = p_id_admin, revisado_en = now()
   where id_comentario = p_id_comentario;

  return v_resultado || jsonb_build_object('decision', p_decision);
end;
$function$;

-- ---------- Seguridad: RLS en todas las tablas ----------
-- Sin políticas: solo el backend (clave service_role) accede a los datos.
ALTER TABLE public.sede ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_miembro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicacion_imagen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.me_gusta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentario_me_gusta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_notificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispositivo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motivo_reporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sancion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sancion_evidencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderacion_umbral ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderacion_resultado ENABLE ROW LEVEL SECURITY;

-- ---------- Almacenamiento (buckets) ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('perfil-fotos', 'perfil-fotos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
VALUES ('publicaciones', 'publicaciones', false)
ON CONFLICT (id) DO NOTHING;
