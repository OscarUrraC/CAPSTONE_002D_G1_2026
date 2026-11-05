import { API_URL } from "../config";
import { File } from "expo-file-system";

export async function obtenerPerfil(token) {
  const respuesta = await fetch(`${API_URL}/perfil/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(data.error ?? "Error al obtener el perfil");
  }
  return data;
}

// PATCH /perfil/me { apodo, mostrar_apodo }
export async function actualizarPerfil(token, cambios) {
  const respuesta = await fetch(`${API_URL}/perfil/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(cambios),
  });

  const data = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(data.error ?? "Error al actualizar el perfil");
  }
  return data;
}

export async function subirFotoPerfil(token, imagenUri) {
  const formData = new FormData();
  formData.append("foto", new File(imagenUri));

  const respuesta = await fetch(`${API_URL}/perfil/me/foto`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(data.error ?? "Error al subir la foto");
  }
  return data;
}

// Helper para los endpoints de grupos y reportes: agrega el token, serializa el body
// y lanza Error con el mensaje del backend, igual que las funciones de arriba.
async function peticion(token, ruta, { method = "GET", body, mensajeError }) {
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu conexión y la IP en config.js");
  }

  // Si el servidor responde algo que no es JSON (por ejemplo la página "Cannot GET ..." de Express
  // cuando la ruta no existe o el backend no se reinició), se avisa con un mensaje claro.
  const data = await respuesta.json().catch(() => null);
  if (data === null) {
    throw new Error(`El servidor respondió algo inesperado (HTTP ${respuesta.status}) en ${ruta}. ¿Reiniciaste el backend?`);
  }
  if (!respuesta.ok) {
    throw new Error(data.error ?? mensajeError);
  }
  return data;
}

// ---------- Grupos ----------

// GET /grupos?categoria=&q=
export function listarGrupos(token, { categoria, q } = {}) {
  const params = new URLSearchParams();
  if (categoria) params.append("categoria", categoria);
  if (q?.trim()) params.append("q", q.trim());
  const query = params.toString() ? `?${params}` : "";
  return peticion(token, `/grupos${query}`, { mensajeError: "Error al obtener los grupos" });
}

// POST /grupos { nombre, descripcion, categoria, ingreso_limitado }
export function crearGrupo(token, datos) {
  return peticion(token, "/grupos", { method: "POST", body: datos, mensajeError: "Error al crear el grupo" });
}

export function obtenerGrupo(token, idGrupo) {
  return peticion(token, `/grupos/${idGrupo}`, { mensajeError: "Error al obtener el grupo" });
}

// PATCH /grupos/:id { nombre, descripcion }
export function editarGrupo(token, idGrupo, cambios) {
  return peticion(token, `/grupos/${idGrupo}`, { method: "PATCH", body: cambios, mensajeError: "Error al editar el grupo" });
}

export function unirseAGrupo(token, idGrupo) {
  return peticion(token, `/grupos/${idGrupo}/unirse`, { method: "POST", mensajeError: "Error al unirse al grupo" });
}

// También cancela una solicitud pendiente.
export function salirDeGrupo(token, idGrupo) {
  return peticion(token, `/grupos/${idGrupo}/membresia`, { method: "DELETE", mensajeError: "Error al salir del grupo" });
}

// ---------- Miembros ----------

export function listarMiembros(token, idGrupo) {
  return peticion(token, `/grupos/${idGrupo}/miembros`, { mensajeError: "Error al obtener los miembros" });
}

// estado: "activo" (aprobar solicitud) | "expulsado"
export function cambiarEstadoMiembro(token, idGrupo, idPerfil, estado) {
  return peticion(token, `/grupos/${idGrupo}/miembros/${idPerfil}`, {
    method: "PATCH",
    body: { estado },
    mensajeError: "Error al actualizar el miembro",
  });
}

export function rechazarSolicitud(token, idGrupo, idPerfil) {
  return peticion(token, `/grupos/${idGrupo}/miembros/${idPerfil}`, {
    method: "DELETE",
    mensajeError: "Error al rechazar la solicitud",
  });
}

// Solo el moderador: el backend responde 403 a cualquier otro.
export function cambiarRango(token, idGrupo, idPerfil, esColaborador) {
  return peticion(token, `/grupos/${idGrupo}/miembros/${idPerfil}/rango`, {
    method: "PATCH",
    body: { es_colaborador: esColaborador },
    mensajeError: "Error al cambiar el rango",
  });
}

// ---------- Publicaciones ----------

export function listarPublicaciones(token, idGrupo) {
  return peticion(token, `/grupos/${idGrupo}/publicaciones`, { mensajeError: "Error al obtener las publicaciones" });
}

// imagenes: lista de URIs locales (máx. 4). Siempre va como multipart; el backend acepta ambos.
export async function crearPublicacion(token, idGrupo, contenido, imagenes = []) {
  const formData = new FormData();
  formData.append("contenido", contenido);
  for (const uri of imagenes) formData.append("imagenes", new File(uri));

  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}/grupos/${idGrupo}/publicaciones`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(data.error ?? "Error al publicar");
  return data;
}


export function eliminarPublicacion(token, idGrupo, idPublicacion) {
  return peticion(token, `/grupos/${idGrupo}/publicaciones/${idPublicacion}`, {
    method: "DELETE",
    mensajeError: "Error al eliminar la publicación",
  });
}

// ---------- Reportes ----------

export function listarMotivosReporte(token) {
  return peticion(token, "/reportes/motivos", { mensajeError: "Error al obtener los motivos" });
}

// reporte: { id_publicacion | id_grupo, id_motivo_reporte, detalle }
export function crearReporte(token, reporte) {
  return peticion(token, "/reportes", { method: "POST", body: reporte, mensajeError: "Error al enviar el reporte" });
}

// ---------- Feed, me gusta y comentarios (módulo Feeds) ----------

// GET /feed/para-ti?limite=&antes=  ->  { publicaciones, siguiente, sin_grupos }
// `antes` es el `siguiente` de la respuesta anterior (cursor). URLSearchParams codifica el "+"
// de la zona horaria (si no, el servidor lo leería como espacio y rechazaría la fecha).
export function obtenerFeedParaTi(token, { antes, limite } = {}) {
  const params = new URLSearchParams();
  if (antes) params.append("antes", antes);
  if (limite) params.append("limite", String(limite));
  const query = params.toString() ? `?${params}` : "";
  return peticion(token, `/feed/para-ti${query}`, { mensajeError: "Error al obtener tu feed" });
}

export function obtenerPublicacion(token, idPublicacion) {
  return peticion(token, `/publicaciones/${idPublicacion}`, { mensajeError: "Error al obtener la publicación" });
}

// Ambas responden { me_gusta_mio, cantidad_me_gusta } con el valor real del servidor.
export function darMeGustaPublicacion(token, idPublicacion) {
  return peticion(token, `/publicaciones/${idPublicacion}/me-gusta`, {
    method: "POST",
    mensajeError: "No se pudo dar me gusta",
  });
}

export function quitarMeGustaPublicacion(token, idPublicacion) {
  return peticion(token, `/publicaciones/${idPublicacion}/me-gusta`, {
    method: "DELETE",
    mensajeError: "No se pudo quitar el me gusta",
  });
}

// -> { comentarios: [{ ...comentario, respuestas: [...] }], total }
export function listarComentarios(token, idPublicacion) {
  return peticion(token, `/publicaciones/${idPublicacion}/comentarios`, {
    mensajeError: "Error al obtener los comentarios",
  });
}

// idComentarioPadre opcional: con él, el comentario es una respuesta.
export function crearComentario(token, idPublicacion, contenido, idComentarioPadre) {
  return peticion(token, `/publicaciones/${idPublicacion}/comentarios`, {
    method: "POST",
    body: { contenido, ...(idComentarioPadre && { id_comentario_padre: idComentarioPadre }) },
    mensajeError: "No se pudo publicar el comentario",
  });
}

export function darMeGustaComentario(token, idComentario) {
  return peticion(token, `/comentarios/${idComentario}/me-gusta`, {
    method: "POST",
    mensajeError: "No se pudo dar me gusta",
  });
}

export function quitarMeGustaComentario(token, idComentario) {
  return peticion(token, `/comentarios/${idComentario}/me-gusta`, {
    method: "DELETE",
    mensajeError: "No se pudo quitar el me gusta",
  });
}

export function eliminarComentario(token, idComentario) {
  return peticion(token, `/comentarios/${idComentario}`, {
    method: "DELETE",
    mensajeError: "No se pudo eliminar el comentario",
  });
}

// ---------- Anuncios ----------

// GET /feed/anuncios?limite=&antes=  ->  { publicaciones, siguiente }
export function obtenerFeedAnuncios(token, { antes, limite } = {}) {
  const params = new URLSearchParams();
  if (antes) params.append("antes", antes);
  if (limite) params.append("limite", String(limite));
  const query = params.toString() ? `?${params}` : "";
  return peticion(token, `/feed/anuncios${query}`, { mensajeError: "Error al obtener los anuncios" });
}

// Solo administradores: el backend responde 403 a cualquier otro.
export function crearAnuncio(token, contenido) {
  return peticion(token, "/feed/anuncios", {
    method: "POST",
    body: { contenido },
    mensajeError: "No se pudo publicar el anuncio",
  });
}

// ---------- Registro y login real ----------

async function postJson(ruta, cuerpo, mensajePorDefecto) {
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    // fetch solo lanza excepción cuando no hay conexión con el servidor
    throw new Error("No se pudo conectar con el servidor. Revisa tu conexión y la IP en config.js");
  }
  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(data.error ?? mensajePorDefecto);
  return data;
}

// POST /auth/registro -> { token, perfil }
export function registrar(datos) {
  return postJson("/auth/registro", datos, "No se pudo crear la cuenta");
}

// POST /auth/login -> { token, perfil }
export function login(correo, password) {
  return postJson("/auth/login", { correo, password }, "No se pudo iniciar sesión");
}

// GET /auth/carreras (público: se usa antes de tener sesión)
export async function obtenerCarreras() {
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}/auth/carreras`);
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(data.error ?? "No se pudieron cargar las carreras");
  return data;
}

// ---------- Eventos ----------

// -> { eventos: [{ id_evento, titulo, descripcion, ubicacion, fecha_evento, estado, marcado, ... }] }
export function listarEventos(token) {
  return peticion(token, "/eventos", { mensajeError: "Error al obtener los eventos" });
}

// -> { ...evento, marcado, puede_gestionar }
export function obtenerEvento(token, idEvento) {
  return peticion(token, `/eventos/${idEvento}`, { mensajeError: "Error al obtener el evento" });
}

// Solo administradores. datos: { titulo, descripcion?, ubicacion?, fecha_evento (ISO) }
export function crearEvento(token, datos) {
  return peticion(token, "/eventos", { method: "POST", body: datos, mensajeError: "No se pudo publicar el evento" });
}

// Solo administradores. Si cambia fecha_evento, el evento queda reprogramado.
export function editarEvento(token, idEvento, cambios) {
  return peticion(token, `/eventos/${idEvento}`, { method: "PATCH", body: cambios, mensajeError: "No se pudo editar el evento" });
}

// Solo administradores.
export function cancelarEvento(token, idEvento, motivo) {
  return peticion(token, `/eventos/${idEvento}/cancelar`, {
    method: "POST",
    body: { motivo },
    mensajeError: "No se pudo cancelar el evento",
  });
}

// -> { marcado: true | false }
export function marcarEvento(token, idEvento) {
  return peticion(token, `/eventos/${idEvento}/marca`, { method: "PUT", mensajeError: "No se pudo marcar el evento" });
}

export function desmarcarEvento(token, idEvento) {
  return peticion(token, `/eventos/${idEvento}/marca`, { method: "DELETE", mensajeError: "No se pudo desmarcar el evento" });
}

// ---------- Notificaciones (bandeja dentro de la app) ----------

// -> { notificaciones: [{ id_notificacion, tipo, titulo, cuerpo, id_evento, creado_en, leida_en }], siguiente, no_leidas }
export function listarNotificaciones(token, { antes, limite } = {}) {
  const params = new URLSearchParams();
  if (antes) params.append("antes", antes);
  if (limite) params.append("limite", String(limite));
  const query = params.toString() ? `?${params}` : "";
  return peticion(token, `/notificaciones${query}`, { mensajeError: "Error al obtener las notificaciones" });
}

// -> { no_leidas }
export function contarNotificacionesNoLeidas(token) {
  return peticion(token, "/notificaciones/no-leidas", { mensajeError: "Error al contar las notificaciones" });
}

// -> { no_leidas }
export function marcarNotificacionLeida(token, idNotificacion) {
  return peticion(token, `/notificaciones/${idNotificacion}/leer`, {
    method: "POST",
    mensajeError: "No se pudo marcar la notificación como leída",
  });
}

// -> { no_leidas: 0 }
export function marcarTodasLeidas(token) {
  return peticion(token, "/notificaciones/leer-todas", {
    method: "POST",
    mensajeError: "No se pudieron marcar las notificaciones como leídas",
  });
}

// ---------- Dispositivos (push) ----------

export function registrarDispositivo(token, pushToken, plataforma) {
  return peticion(token, "/dispositivos", {
    method: "POST",
    body: { push_token: pushToken, plataforma },
    mensajeError: "No se pudo registrar el dispositivo",
  });
}

export function eliminarDispositivo(token, pushToken) {
  return peticion(token, "/dispositivos", {
    method: "DELETE",
    body: { push_token: pushToken },
    mensajeError: "No se pudo eliminar el dispositivo",
  });
}