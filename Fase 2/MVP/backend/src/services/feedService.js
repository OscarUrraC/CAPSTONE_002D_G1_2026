import { supabaseAdmin } from "../config/supabase.js";
import {
  errorConStatus,
  obtenerContextoGrupo,
  puedeGestionar,
  puedeVerPosts,
} from "./grupoService.js";

// Mismos campos de autor que ya usa grupos.js, para que la app muestre el nombre igual en todos lados.
export const SELECT_AUTOR =
  "id_perfil, nombres, primer_apellido, apodo, mostrar_apodo, foto_perfil_url";

// Publicación tal como la necesita el feed: autor + grupo al que pertenece.
export const SELECT_PUBLICACION_FEED = `id_publicacion, id_grupo, tipo, contenido, creado_en, autor:id_perfil_autor(${SELECT_AUTOR}), grupo:id_grupo(id_grupo, nombre, categoria)`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Un id mal formado haría fallar a Postgres con 22P02 (→ 500). Mejor responder 404 de entrada.
export function validarUuid(valor, mensaje = "No encontrado") {
  if (typeof valor !== "string" || !UUID.test(valor)) throw errorConStatus(mensaje, 404);
}

export function esAdministrador(usuario) {
  return usuario?.rol_plataforma === "administrador";
}

// Mismo rango que el CHECK de las tablas publicacion y comentario (1 a 1000 caracteres).
export function validarContenido(contenido) {
  const limpio = typeof contenido === "string" ? contenido.trim() : "";
  if (limpio.length < 1 || limpio.length > 1000) {
    throw errorConStatus("contenido debe tener entre 1 y 1000 caracteres", 400);
  }
  return limpio;
}

/**
 * Agrega a cada publicación: cantidad_me_gusta, cantidad_comentarios (solo activos) y me_gusta_mio.
 * Hace 2 consultas en total, sin importar cuántas publicaciones haya (no es una por tarjeta).
 */
export async function enriquecerPublicaciones(publicaciones, idPerfil) {
  if (publicaciones.length === 0) return [];
  const ids = publicaciones.map((p) => p.id_publicacion);

  const [conteos, misLikes] = await Promise.all([
    // `tabla(count)` pide el conteo de filas relacionadas; el filtro con prefijo `comentario.`
    // aplica solo al embebido, así que cuenta únicamente comentarios activos.
    supabaseAdmin
      .from("publicacion")
      .select("id_publicacion, me_gusta(count), comentario(count)")
      .in("id_publicacion", ids)
      .eq("comentario.estado", "activo"),
    supabaseAdmin
      .from("me_gusta")
      .select("id_publicacion")
      .eq("id_perfil", idPerfil)
      .in("id_publicacion", ids),
  ]);

  if (conteos.error || misLikes.error) {
    console.error("enriquecerPublicaciones:", conteos.error ?? misLikes.error);
    throw errorConStatus("No se pudieron obtener los me gusta y comentarios", 500);
  }

  const conteoPorId = new Map(
    conteos.data.map((f) => [
      f.id_publicacion,
      { likes: f.me_gusta?.[0]?.count ?? 0, comentarios: f.comentario?.[0]?.count ?? 0 },
    ])
  );
  const mios = new Set(misLikes.data.map((f) => f.id_publicacion));

  return publicaciones.map((p) => ({
    ...p,
    cantidad_me_gusta: conteoPorId.get(p.id_publicacion)?.likes ?? 0,
    cantidad_comentarios: conteoPorId.get(p.id_publicacion)?.comentarios ?? 0,
    me_gusta_mio: mios.has(p.id_publicacion),
  }));
}

/**
 * Devuelve la publicación solo si el usuario puede verla; si no, 404 (no se revela que existe).
 * Reglas (las mismas de grupos.js / reportes.js):
 *  - publicación 'grupo': el grupo debe estar activo; si es de ingreso limitado, solo miembros activos
 *    (o un administrador de la plataforma, según CLAUDE.md).
 *  - publicación 'anuncio': visible para todos.
 * `puedeInteractuar` (dar me gusta / comentar): miembro activo del grupo, o cualquiera si es anuncio.
 */
export async function obtenerPublicacionVisible(idPublicacion, usuario) {
  validarUuid(idPublicacion, "Publicación no encontrada");

  const { data: publicacion, error } = await supabaseAdmin
    .from("publicacion")
    .select(SELECT_PUBLICACION_FEED)
    .eq("id_publicacion", idPublicacion)
    .eq("estado", "activa")
    .maybeSingle();

  if (error) throw errorConStatus("No se pudo obtener la publicación", 500);
  if (!publicacion) throw errorConStatus("Publicación no encontrada", 404);

  if (publicacion.tipo === "anuncio") {
    return { publicacion, rol: null, puedeInteractuar: true, puedeModerar: esAdministrador(usuario) };
  }

  const { grupo, rol } = await obtenerContextoGrupo(publicacion.id_grupo, usuario.id_perfil);
  if (!esAdministrador(usuario) && !puedeVerPosts(grupo, rol)) {
    throw errorConStatus("Publicación no encontrada", 404);
  }

  return {
    publicacion,
    rol,
    puedeInteractuar: rol !== null,
    puedeModerar: puedeGestionar(rol) || esAdministrador(usuario),
  };
}

// Comentario activo + el contexto de su publicación (para validar permisos antes de actuar sobre él).
export async function obtenerComentarioVisible(idComentario, usuario) {
  validarUuid(idComentario, "Comentario no encontrado");

  const { data: comentario, error } = await supabaseAdmin
    .from("comentario")
    .select("id_comentario, id_publicacion, id_perfil_autor, estado")
    .eq("id_comentario", idComentario)
    .eq("estado", "activo")
    .maybeSingle();

  if (error) throw errorConStatus("No se pudo obtener el comentario", 500);
  if (!comentario) throw errorConStatus("Comentario no encontrado", 404);

  const contexto = await obtenerPublicacionVisible(comentario.id_publicacion, usuario);
  return { comentario, ...contexto };
}

export async function contarMeGustaPublicacion(idPublicacion) {
  const { count, error } = await supabaseAdmin
    .from("me_gusta")
    .select("id_perfil", { count: "exact", head: true })
    .eq("id_publicacion", idPublicacion);
  if (error) throw errorConStatus("No se pudo contar los me gusta", 500);
  return count ?? 0;
}

export async function contarMeGustaComentario(idComentario) {
  const { count, error } = await supabaseAdmin
    .from("comentario_me_gusta")
    .select("id_perfil", { count: "exact", head: true })
    .eq("id_comentario", idComentario);
  if (error) throw errorConStatus("No se pudo contar los me gusta", 500);
  return count ?? 0;
}

export function responderError(res, error) {
  if (!error.status) console.error(error);
  res
    .status(error.status ?? 500)
    .json({ error: error.status ? error.message : "Error interno del servidor" });
}
