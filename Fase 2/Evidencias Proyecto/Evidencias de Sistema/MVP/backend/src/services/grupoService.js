import { supabaseAdmin } from "../config/supabase.js";

const SELECT_GRUPO =
  "id_grupo, nombre, descripcion, categoria, ingreso_limitado, id_perfil_creador, estado, creado_en";

function errorConStatus(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

// El rol dentro del grupo no se guarda en ninguna columna; se deriva:
// moderador = creador del grupo; colaborador/miembro = fila activa en grupo_miembro.
export function calcularRol(grupo, membresia, idPerfil) {
  if (grupo.id_perfil_creador === idPerfil) return "moderador";
  if (!membresia || membresia.estado !== "activo") return null;
  return membresia.es_colaborador ? "colaborador" : "miembro";
}

export function puedeGestionar(rol) {
  return rol === "moderador" || rol === "colaborador";
}

// En grupos abiertos cualquiera lee los posts; en los de ingreso limitado, solo los miembros activos.
export function puedeVerPosts(grupo, rol) {
  return !grupo.ingreso_limitado || rol !== null;
}

// Devuelve { grupo, membresia, rol } del usuario en el grupo.
// Lanza 404 si el grupo no existe o no está activo (suspendido/eliminado por un admin).
export async function obtenerContextoGrupo(idGrupo, idPerfil) {
  const { data: grupo, error } = await supabaseAdmin
    .from("grupo")
    .select(SELECT_GRUPO)
    .eq("id_grupo", idGrupo)
    .maybeSingle();

  if (error || !grupo || grupo.estado !== "activo") {
    throw errorConStatus("Grupo no encontrado", 404);
  }

  const { data: membresia, error: errorMembresia } = await supabaseAdmin
    .from("grupo_miembro")
    .select("id_perfil, es_colaborador, estado, unido_en")
    .eq("id_grupo", idGrupo)
    .eq("id_perfil", idPerfil)
    .maybeSingle();

  if (errorMembresia) {
    throw errorConStatus("No se pudo obtener la membresía", 500);
  }

  return { grupo, membresia, rol: calcularRol(grupo, membresia, idPerfil) };
}

export { SELECT_GRUPO, errorConStatus };
