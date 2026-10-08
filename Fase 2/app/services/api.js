import { API_URL } from "../config";
import { File } from "expo-file-system/next";

export async function loginDemo(cuenta) {
  const respuesta = await fetch(`${API_URL}/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cuenta }),
  });

  const data = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(data.error ?? "Error al iniciar sesión");
  }
  return data; // { token, perfil }
}

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
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined && { "Content-Type": "application/json" }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await respuesta.json();
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

export function crearPublicacion(token, idGrupo, contenido) {
  return peticion(token, `/grupos/${idGrupo}/publicaciones`, {
    method: "POST",
    body: { contenido },
    mensajeError: "Error al publicar",
  });
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