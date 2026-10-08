

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.carrera (
  id_carrera uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  codigo text UNIQUE,
  CONSTRAINT carrera_pkey PRIMARY KEY (id_carrera)
);
CREATE TABLE public.motivo_reporte (
  id_motivo_reporte uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  CONSTRAINT motivo_reporte_pkey PRIMARY KEY (id_motivo_reporte)
);
CREATE TABLE public.perfil (
  id_perfil uuid NOT NULL,
  nombres text NOT NULL,
  primer_apellido text NOT NULL,
  segundo_apellido text,
  apodo text,
  mostrar_apodo boolean NOT NULL DEFAULT false,
  correo text NOT NULL UNIQUE,
  fecha_nacimiento date NOT NULL,
  foto_perfil_url text,
  id_carrera uuid,
  rol_plataforma USER-DEFINED NOT NULL DEFAULT 'estudiante'::rol_plataforma,
  estado_cuenta USER-DEFINED NOT NULL DEFAULT 'activa'::estado_cuenta,
  sancion_hasta timestamp with time zone,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  semestre smallint CHECK (semestre IS NULL OR semestre >= 1 AND semestre <= 20),
  CONSTRAINT perfil_pkey PRIMARY KEY (id_perfil),
  CONSTRAINT perfil_id_perfil_fkey FOREIGN KEY (id_perfil) REFERENCES auth.users(id),
  CONSTRAINT perfil_id_carrera_fkey FOREIGN KEY (id_carrera) REFERENCES public.carrera(id_carrera)
);
CREATE TABLE public.dispositivo (
  id_dispositivo uuid NOT NULL DEFAULT gen_random_uuid(),
  id_perfil uuid NOT NULL,
  push_token text NOT NULL UNIQUE,
  plataforma USER-DEFINED NOT NULL,
  actualizado_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT dispositivo_pkey PRIMARY KEY (id_dispositivo),
  CONSTRAINT dispositivo_id_perfil_fkey FOREIGN KEY (id_perfil) REFERENCES public.perfil(id_perfil)
);
CREATE TABLE public.grupo (
  id_grupo uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  categoria USER-DEFINED NOT NULL,
  ingreso_limitado boolean NOT NULL DEFAULT false,
  id_perfil_creador uuid NOT NULL,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT grupo_pkey PRIMARY KEY (id_grupo),
  CONSTRAINT grupo_id_perfil_creador_fkey FOREIGN KEY (id_perfil_creador) REFERENCES public.perfil(id_perfil)
);
CREATE TABLE public.grupo_miembro (
  id_grupo uuid NOT NULL,
  id_perfil uuid NOT NULL,
  es_colaborador boolean NOT NULL DEFAULT false,
  estado USER-DEFINED NOT NULL DEFAULT 'activo'::estado_membresia,
  unido_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT grupo_miembro_pkey PRIMARY KEY (id_grupo, id_perfil),
  CONSTRAINT grupo_miembro_id_grupo_fkey FOREIGN KEY (id_grupo) REFERENCES public.grupo(id_grupo),
  CONSTRAINT grupo_miembro_id_perfil_fkey FOREIGN KEY (id_perfil) REFERENCES public.perfil(id_perfil)
);
CREATE TABLE public.publicacion (
  id_publicacion uuid NOT NULL DEFAULT gen_random_uuid(),
  id_perfil_autor uuid NOT NULL,
  id_grupo uuid,
  tipo USER-DEFINED NOT NULL,
  contenido text NOT NULL CHECK (char_length(contenido) >= 1 AND char_length(contenido) <= 1000),
  estado USER-DEFINED NOT NULL DEFAULT 'activa'::estado_publicacion,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT publicacion_pkey PRIMARY KEY (id_publicacion),
  CONSTRAINT publicacion_id_perfil_autor_fkey FOREIGN KEY (id_perfil_autor) REFERENCES public.perfil(id_perfil),
  CONSTRAINT publicacion_id_grupo_fkey FOREIGN KEY (id_grupo) REFERENCES public.grupo(id_grupo)
);
CREATE TABLE public.publicacion_imagen (
  id_publicacion_imagen uuid NOT NULL DEFAULT gen_random_uuid(),
  id_publicacion uuid NOT NULL,
  imagen_url text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT publicacion_imagen_pkey PRIMARY KEY (id_publicacion_imagen),
  CONSTRAINT publicacion_imagen_id_publicacion_fkey FOREIGN KEY (id_publicacion) REFERENCES public.publicacion(id_publicacion)
);
CREATE TABLE public.me_gusta (
  id_publicacion uuid NOT NULL,
  id_perfil uuid NOT NULL,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT me_gusta_pkey PRIMARY KEY (id_publicacion, id_perfil),
  CONSTRAINT me_gusta_id_publicacion_fkey FOREIGN KEY (id_publicacion) REFERENCES public.publicacion(id_publicacion),
  CONSTRAINT me_gusta_id_perfil_fkey FOREIGN KEY (id_perfil) REFERENCES public.perfil(id_perfil)
);
CREATE TABLE public.comentario (
  id_comentario uuid NOT NULL DEFAULT gen_random_uuid(),
  id_publicacion uuid NOT NULL,
  id_perfil_autor uuid NOT NULL,
  contenido text NOT NULL CHECK (char_length(contenido) >= 1 AND char_length(contenido) <= 1000),
  estado USER-DEFINED NOT NULL DEFAULT 'activo'::estado_comentario,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  id_comentario_padre uuid,
  id_comentario_raiz uuid,
  CONSTRAINT comentario_pkey PRIMARY KEY (id_comentario),
  CONSTRAINT comentario_id_publicacion_fkey FOREIGN KEY (id_publicacion) REFERENCES public.publicacion(id_publicacion),
  CONSTRAINT comentario_id_perfil_autor_fkey FOREIGN KEY (id_perfil_autor) REFERENCES public.perfil(id_perfil),
  CONSTRAINT comentario_id_comentario_padre_fkey FOREIGN KEY (id_comentario_padre) REFERENCES public.comentario(id_comentario),
  CONSTRAINT comentario_id_comentario_raiz_fkey FOREIGN KEY (id_comentario_raiz) REFERENCES public.comentario(id_comentario)
);
CREATE TABLE public.reporte (
  id_reporte uuid NOT NULL DEFAULT gen_random_uuid(),
  id_perfil_denunciante uuid NOT NULL,
  id_publicacion uuid,
  id_comentario uuid,
  id_motivo_reporte uuid NOT NULL,
  detalle text,
  estado USER-DEFINED NOT NULL DEFAULT 'pendiente'::estado_reporte,
  id_perfil_resolutor uuid,
  resuelto_en timestamp with time zone,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  id_grupo uuid,
  CONSTRAINT reporte_pkey PRIMARY KEY (id_reporte),
  CONSTRAINT reporte_id_perfil_denunciante_fkey FOREIGN KEY (id_perfil_denunciante) REFERENCES public.perfil(id_perfil),
  CONSTRAINT reporte_id_publicacion_fkey FOREIGN KEY (id_publicacion) REFERENCES public.publicacion(id_publicacion),
  CONSTRAINT reporte_id_comentario_fkey FOREIGN KEY (id_comentario) REFERENCES public.comentario(id_comentario),
  CONSTRAINT reporte_id_motivo_reporte_fkey FOREIGN KEY (id_motivo_reporte) REFERENCES public.motivo_reporte(id_motivo_reporte),
  CONSTRAINT reporte_id_perfil_resolutor_fkey FOREIGN KEY (id_perfil_resolutor) REFERENCES public.perfil(id_perfil),
  CONSTRAINT reporte_id_grupo_fkey FOREIGN KEY (id_grupo) REFERENCES public.grupo(id_grupo)
);
CREATE TABLE public.sancion (
  id_sancion uuid NOT NULL DEFAULT gen_random_uuid(),
  id_perfil_sancionado uuid NOT NULL,
  id_reporte uuid,
  id_perfil_admin uuid NOT NULL,
  tipo USER-DEFINED NOT NULL,
  sancion_hasta timestamp with time zone,
  comentario_administrador text,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sancion_pkey PRIMARY KEY (id_sancion),
  CONSTRAINT sancion_id_perfil_sancionado_fkey FOREIGN KEY (id_perfil_sancionado) REFERENCES public.perfil(id_perfil),
  CONSTRAINT sancion_id_reporte_fkey FOREIGN KEY (id_reporte) REFERENCES public.reporte(id_reporte),
  CONSTRAINT sancion_id_perfil_admin_fkey FOREIGN KEY (id_perfil_admin) REFERENCES public.perfil(id_perfil)
);
CREATE TABLE public.sancion_evidencia (
  id_sancion_evidencia uuid NOT NULL DEFAULT gen_random_uuid(),
  id_sancion uuid NOT NULL,
  id_publicacion uuid,
  id_comentario uuid,
  id_perfil_autor_snapshot uuid NOT NULL,
  nombre_autor_snapshot text NOT NULL,
  contenido_snapshot text NOT NULL,
  creado_en_original timestamp with time zone NOT NULL,
  orden integer NOT NULL,
  CONSTRAINT sancion_evidencia_pkey PRIMARY KEY (id_sancion_evidencia),
  CONSTRAINT sancion_evidencia_id_sancion_fkey FOREIGN KEY (id_sancion) REFERENCES public.sancion(id_sancion),
  CONSTRAINT sancion_evidencia_id_publicacion_fkey FOREIGN KEY (id_publicacion) REFERENCES public.publicacion(id_publicacion),
  CONSTRAINT sancion_evidencia_id_comentario_fkey FOREIGN KEY (id_comentario) REFERENCES public.comentario(id_comentario),
  CONSTRAINT sancion_evidencia_id_perfil_autor_snapshot_fkey FOREIGN KEY (id_perfil_autor_snapshot) REFERENCES public.perfil(id_perfil)
);
CREATE TABLE public.evento (
  id_evento uuid NOT NULL DEFAULT gen_random_uuid(),
  id_perfil_creador uuid NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  ubicacion text,
  fecha_evento timestamp with time zone NOT NULL,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  estado USER-DEFINED NOT NULL DEFAULT 'activo'::estado_evento,
  fecha_evento_original timestamp with time zone,
  CONSTRAINT evento_pkey PRIMARY KEY (id_evento),
  CONSTRAINT evento_id_perfil_creador_fkey FOREIGN KEY (id_perfil_creador) REFERENCES public.perfil(id_perfil)
);
CREATE TABLE public.evento_notificacion (
  id_evento uuid NOT NULL,
  id_perfil uuid NOT NULL,
  notif_1dia_enviada boolean NOT NULL DEFAULT false,
  notif_3horas_enviada boolean NOT NULL DEFAULT false,
  notif_1hora_enviada boolean NOT NULL DEFAULT false,
  marcado_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT evento_notificacion_pkey PRIMARY KEY (id_evento, id_perfil),
  CONSTRAINT evento_notificacion_id_evento_fkey FOREIGN KEY (id_evento) REFERENCES public.evento(id_evento),
  CONSTRAINT evento_notificacion_id_perfil_fkey FOREIGN KEY (id_perfil) REFERENCES public.perfil(id_perfil)
);
CREATE TABLE public.comentario_me_gusta (
  id_comentario uuid NOT NULL,
  id_perfil uuid NOT NULL,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT comentario_me_gusta_pkey PRIMARY KEY (id_comentario, id_perfil),
  CONSTRAINT comentario_me_gusta_id_perfil_fkey FOREIGN KEY (id_perfil) REFERENCES public.perfil(id_perfil),
  CONSTRAINT comentario_me_gusta_id_comentario_fkey FOREIGN KEY (id_comentario) REFERENCES public.comentario(id_comentario)
);


                                                                                                                    |

| ------------------------------------------------------------------------------------------------------------------------------- |

| CREATE UNIQUE INDEX comentario_me_gusta_pkey ON public.comentario_me_gusta USING btree (id_comentario, id_perfil);              |

| CREATE INDEX idx_comentario_me_gusta_id_perfil ON public.comentario_me_gusta USING btree (id_perfil);                           |

| CREATE UNIQUE INDEX perfil_pkey ON public.perfil USING btree (id_perfil);                                                       |

| CREATE UNIQUE INDEX perfil_correo_key ON public.perfil USING btree (correo);                                                    |

| CREATE INDEX idx_perfil_id_carrera ON public.perfil USING btree (id_carrera);                                                   |

| CREATE UNIQUE INDEX carrera_pkey ON public.carrera USING btree (id_carrera);                                                    |

| CREATE UNIQUE INDEX carrera_codigo_key ON public.carrera USING btree (codigo);                                                  |

| CREATE UNIQUE INDEX carrera_nombre_unico ON public.carrera USING btree (nombre);                                                |

| CREATE UNIQUE INDEX motivo_reporte_pkey ON public.motivo_reporte USING btree (id_motivo_reporte);                               |

| CREATE UNIQUE INDEX dispositivo_pkey ON public.dispositivo USING btree (id_dispositivo);                                        |

| CREATE UNIQUE INDEX dispositivo_push_token_key ON public.dispositivo USING btree (push_token);                                  |

| CREATE INDEX idx_dispositivo_id_perfil ON public.dispositivo USING btree (id_perfil);                                           |

| CREATE UNIQUE INDEX grupo_pkey ON public.grupo USING btree (id_grupo);                                                          |

| CREATE INDEX idx_grupo_id_perfil_creador ON public.grupo USING btree (id_perfil_creador);                                       |

| CREATE UNIQUE INDEX grupo_miembro_pkey ON public.grupo_miembro USING btree (id_grupo, id_perfil);                               |

| CREATE INDEX idx_grupo_miembro_id_perfil ON public.grupo_miembro USING btree (id_perfil);                                       |

| CREATE UNIQUE INDEX publicacion_imagen_pkey ON public.publicacion_imagen USING btree (id_publicacion_imagen);                   |

| CREATE INDEX idx_publicacion_imagen_id_publicacion ON public.publicacion_imagen USING btree (id_publicacion);                   |

| CREATE UNIQUE INDEX publicacion_imagen_orden_unico ON public.publicacion_imagen USING btree (id_publicacion, orden);            |

| CREATE UNIQUE INDEX me_gusta_pkey ON public.me_gusta USING btree (id_publicacion, id_perfil);                                   |

| CREATE INDEX idx_me_gusta_id_perfil ON public.me_gusta USING btree (id_perfil);                                                 |

| CREATE UNIQUE INDEX sancion_evidencia_pkey ON public.sancion_evidencia USING btree (id_sancion_evidencia);                      |

| CREATE INDEX idx_sancion_evidencia_id_sancion ON public.sancion_evidencia USING btree (id_sancion);                             |

| CREATE INDEX idx_sancion_evidencia_id_publicacion ON public.sancion_evidencia USING btree (id_publicacion);                     |

| CREATE INDEX idx_sancion_evidencia_id_comentario ON public.sancion_evidencia USING btree (id_comentario);                       |

| CREATE INDEX idx_sancion_evidencia_id_perfil_autor_snapshot ON public.sancion_evidencia USING btree (id_perfil_autor_snapshot); |

| CREATE UNIQUE INDEX sancion_evidencia_orden_unico ON public.sancion_evidencia USING btree (id_sancion, orden);                  |

| CREATE UNIQUE INDEX evento_notificacion_pkey ON public.evento_notificacion USING btree (id_evento, id_perfil);                  |

| CREATE INDEX idx_evento_notificacion_id_perfil ON public.evento_notificacion USING btree (id_perfil);                           |

| CREATE UNIQUE INDEX sancion_pkey ON public.sancion USING btree (id_sancion);                                                    |

| CREATE INDEX idx_sancion_id_perfil_sancionado ON public.sancion USING btree (id_perfil_sancionado);                             |

| CREATE INDEX idx_sancion_id_reporte ON public.sancion USING btree (id_reporte);                                                 |

| CREATE INDEX idx_sancion_id_perfil_admin ON public.sancion USING btree (id_perfil_admin);                                       |

| CREATE UNIQUE INDEX reporte_pkey ON public.reporte USING btree (id_reporte);                                                    |

| CREATE INDEX idx_reporte_id_perfil_denunciante ON public.reporte USING btree (id_perfil_denunciante);                           |

| CREATE INDEX idx_reporte_id_publicacion ON public.reporte USING btree (id_publicacion);                                         |

| CREATE INDEX idx_reporte_id_comentario ON public.reporte USING btree (id_comentario);                                           |

| CREATE INDEX idx_reporte_id_motivo_reporte ON public.reporte USING btree (id_motivo_reporte);                                   |

| CREATE INDEX idx_reporte_id_perfil_resolutor ON public.reporte USING btree (id_perfil_resolutor);                               |

| CREATE UNIQUE INDEX publicacion_pkey ON public.publicacion USING btree (id_publicacion);                                        |

| CREATE INDEX idx_publicacion_id_perfil_autor ON public.publicacion USING btree (id_perfil_autor);                               |

| CREATE INDEX idx_publicacion_id_grupo ON public.publicacion USING btree (id_grupo);                                             |

| CREATE UNIQUE INDEX comentario_pkey ON public.comentario USING btree (id_comentario);                                           |

| CREATE INDEX idx_comentario_id_publicacion ON public.comentario USING btree (id_publicacion);                                   |

| CREATE INDEX idx_comentario_id_perfil_autor ON public.comentario USING btree (id_perfil_autor);                                 |

| CREATE INDEX idx_comentario_id_comentario_padre ON public.comentario USING btree (id_comentario_padre);                         |

| CREATE INDEX idx_comentario_id_comentario_raiz ON public.comentario USING btree (id_comentario_raiz);                           |

| CREATE UNIQUE INDEX evento_pkey ON public.evento USING btree (id_evento);                                                       |

| CREATE INDEX idx_evento_id_perfil_creador ON public.evento USING btree (id_perfil_creador);                                     |s 

| enum                   | valores                               |
| ---------------------- | ------------------------------------- |
| categoria_grupo        | interes, academico, promocion         |
| estado_comentario      | activo, eliminado                     |
| estado_cuenta          | activa, sancionada, baneada           |
| estado_evento          | activo, cancelado                     |
| estado_membresia       | activo, pendiente_aprobacion,expulsado|
| estado_publicacion     | activa, eliminada                     |
| estado_reporte         | pendiente, sin_infraccion, infraccion |
| plataforma_dispositivo | ios, android                          |
| rol_plataforma         | estudiante, administrador             |
| tipo_publicacion       | grupo, anuncio                        |
| tipo_sancion           | temporal, baneo, escalado             |





ALTER TABLE public.reporte
  ADD COLUMN id_grupo uuid REFERENCES public.grupo(id_grupo);

CREATE INDEX idx_reporte_id_grupo ON public.reporte(id_grupo);   

-- 1) Estado del grupo, para que el admin pueda suspenderlo más adelante
create type estado_grupo as enum ('activo', 'suspendido', 'eliminado');
alter table grupo
  add column estado estado_grupo not null default 'activo';

-- 2) Un reporte apunta a exactamente un objetivo
alter table reporte
  add constraint reporte_un_objetivo
  check (num_nonnulls(id_publicacion, id_comentario, id_grupo) = 1);

-- 3) No duplicar reportes pendientes del mismo usuario sobre lo mismo
create unique index reporte_pendiente_unico_publicacion
  on reporte (id_perfil_denunciante, id_publicacion)
  where estado = 'pendiente' and id_publicacion is not null;

create unique index reporte_pendiente_unico_grupo
  on reporte (id_perfil_denunciante, id_grupo)
  where estado = 'pendiente' and id_grupo is not null;

-- 4) Índices para consultas y para la futura cola del admin

create index idx_reporte_estado on reporte (estado, creado_en);