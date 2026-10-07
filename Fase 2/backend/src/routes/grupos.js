import { Router } from "express";
import { requireAuth, requireCuentaActiva } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import {
  SELECT_GRUPO,
  calcularRol,
  errorConStatus,
  obtenerContextoGrupo,
  puedeGestionar,
  puedeVerPosts,
} from "../services/grupoService.js";

export const gruposRouter = Router();

const CATEGORIAS = ["interes", "academico", "promocion"];
const SELECT_MIEMBRO =
  "id_perfil, es_colaborador, estado, unido_en, perfil:id_perfil(nombres, primer_apellido, apodo, mostrar_apodo, foto_perfil_url)";

function responderError(res, error) {
  if (!error.status) console.error(error);
  res
    .status(error.status ?? 500)
    .json({ error: error.status ? error.message : "Error interno del servidor" });
}

// Valida nombre/descripcion. Con parcial=true (PATCH) los campos ausentes se ignoran.
function validarDatosGrupo({ nombre, descripcion }, parcial) {
  const datos = {};
  if (nombre !== undefined || !parcial) {
    if (typeof nombre !== "string" || nombre.trim().length < 3 || nombre.trim().length > 80) {
      throw errorConStatus("nombre debe tener entre 3 y 80 caracteres", 400);
    }
    datos.nombre = nombre.trim();
  }
  if (descripcion !== undefined) {
    if (descripcion !== null && typeof descripcion !== "string") {
      throw errorConStatus("descripcion debe ser texto", 400);
    }
    const limpia = descripcion?.trim() ?? "";
    if (limpia.length > 500) {
      throw errorConStatus("descripcion admite hasta 500 caracteres", 400);
    }
    datos.descripcion = limpia === "" ? null : limpia;
  }
  return datos;
}

async function contarMiembros(idGrupo) {
  const { count, error } = await supabaseAdmin
    .from("grupo_miembro")
    .select("id_perfil", { count: "exact", head: true })
    .eq("id_grupo", idGrupo)
    .eq("estado", "activo");

  if (error) throw errorConStatus("No se pudo contar los miembros", 500);
  return count;
}

async function responderDetalle(res, { grupo, membresia, rol }) {
  res.json({
    ...grupo,
    cantidad_miembros: await contarMiembros(grupo.id_grupo),
    mi_estado: membresia?.estado ?? null,
    mi_rol: rol,
  });
}

// Membresía de OTRO usuario (el objetivo de una acción de gestión).
async function obtenerMembresiaObjetivo(idGrupo, idPerfil) {
  const { data, error } = await supabaseAdmin
    .from("grupo_miembro")
    .select("id_perfil, es_colaborador, estado")
    .eq("id_grupo", idGrupo)
    .eq("id_perfil", idPerfil)
    .maybeSingle();

  if (error || !data) throw errorConStatus("Ese usuario no pertenece al grupo", 404);
  return data;
}

async function actualizarMembresia(grupo, idPerfil, cambios) {
  const { data, error } = await supabaseAdmin
    .from("grupo_miembro")
    .update(cambios)
    .eq("id_grupo", grupo.id_grupo)
    .eq("id_perfil", idPerfil)
    .select(SELECT_MIEMBRO)
    .single();

  if (error || !data) throw errorConStatus("No se pudo actualizar la membresía", 500);
  return { ...data, rol: calcularRol(grupo, data, data.id_perfil) };
}

// GET /grupos?categoria=interes&q=dragones
gruposRouter.get("/", requireAuth, async (req, res) => {
  const { categoria, q } = req.query;
  if (categoria !== undefined && !CATEGORIAS.includes(categoria)) {
    return res.status(400).json({ error: "categoria inválida" });
  }

  // Las membresías vienen embebidas para calcular la cantidad de miembros y mi rol
  // en una sola consulta (suficiente para el volumen del MVP).
  let consulta = supabaseAdmin
    .from("grupo")
    .select(`${SELECT_GRUPO}, grupo_miembro(id_perfil, es_colaborador, estado)`)
    .eq("estado", "activo")
    .order("creado_en", { ascending: false });

  if (categoria) consulta = consulta.eq("categoria", categoria);
  if (typeof q === "string" && q.trim()) consulta = consulta.ilike("nombre", `%${q.trim()}%`);

  const { data, error } = await consulta;
  if (error) {
    return res.status(500).json({ error: "No se pudieron obtener los grupos" });
  }

  const idPerfil = req.usuario.id_perfil;
  const grupos = data.map(({ grupo_miembro: membresias, ...grupo }) => {
    const miMembresia = membresias.find((m) => m.id_perfil === idPerfil) ?? null;
    return {
      ...grupo,
      cantidad_miembros: membresias.filter((m) => m.estado === "activo").length,
      mi_estado: miMembresia?.estado ?? null,
      mi_rol: calcularRol(grupo, miMembresia, idPerfil),
    };
  });

  res.json(grupos);
});

// POST /grupos { nombre, descripcion, categoria, ingreso_limitado }
gruposRouter.post("/", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const datos = validarDatosGrupo(req.body, false);
    const { categoria, ingreso_limitado = false } = req.body;
    if (!CATEGORIAS.includes(categoria)) {
      throw errorConStatus("categoria inválida", 400);
    }
    if (typeof ingreso_limitado !== "boolean") {
      throw errorConStatus("ingreso_limitado debe ser true/false", 400);
    }

    const idPerfil = req.usuario.id_perfil;
    const { data: grupo, error } = await supabaseAdmin
      .from("grupo")
      .insert({ ...datos, categoria, ingreso_limitado, id_perfil_creador: idPerfil })
      .select(SELECT_GRUPO)
      .single();

    if (error || !grupo) throw errorConStatus("No se pudo crear el grupo", 500);

    // El creador también queda como fila en grupo_miembro (así cuenta como miembro).
    // supabase-js no ofrece transacciones: si esta inserción falla, se deshace el grupo a mano.
    const { error: errorMiembro } = await supabaseAdmin
      .from("grupo_miembro")
      .insert({ id_grupo: grupo.id_grupo, id_perfil: idPerfil, estado: "activo" });

    if (errorMiembro) {
      await supabaseAdmin.from("grupo").delete().eq("id_grupo", grupo.id_grupo);
      throw errorConStatus("No se pudo crear el grupo", 500);
    }

    res.status(201).json({ ...grupo, cantidad_miembros: 1, mi_estado: "activo", mi_rol: "moderador" });
  } catch (error) {
    responderError(res, error);
  }
});

// GET /grupos/:id
gruposRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const contexto = await obtenerContextoGrupo(req.params.id, req.usuario.id_perfil);
    await responderDetalle(res, contexto);
  } catch (error) {
    responderError(res, error);
  }
});

// PATCH /grupos/:id { nombre, descripcion } — el "post principal" del grupo
gruposRouter.patch("/:id", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const contexto = await obtenerContextoGrupo(req.params.id, req.usuario.id_perfil);
    if (!puedeGestionar(contexto.rol)) {
      throw errorConStatus("Solo el moderador o un colaborador puede editar el grupo", 403);
    }

    const cambios = validarDatosGrupo(req.body, true);
    if (Object.keys(cambios).length === 0) {
      throw errorConStatus("No hay cambios para guardar", 400);
    }

    const { data: grupo, error } = await supabaseAdmin
      .from("grupo")
      .update(cambios)
      .eq("id_grupo", contexto.grupo.id_grupo)
      .select(SELECT_GRUPO)
      .single();

    if (error || !grupo) throw errorConStatus("No se pudo actualizar el grupo", 500);

    await responderDetalle(res, { ...contexto, grupo });
  } catch (error) {
    responderError(res, error);
  }
});

// POST /grupos/:id/unirse — grupo abierto: queda activo; ingreso limitado: queda pendiente
gruposRouter.post("/:id/unirse", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const idPerfil = req.usuario.id_perfil;
    const { grupo, membresia } = await obtenerContextoGrupo(req.params.id, idPerfil);

    if (membresia?.estado === "expulsado") {
      throw errorConStatus("Fuiste expulsado de este grupo", 403);
    }
    if (membresia || grupo.id_perfil_creador === idPerfil) {
      throw errorConStatus("Ya eres miembro o tienes una solicitud pendiente", 409);
    }

    const estado = grupo.ingreso_limitado ? "pendiente_aprobacion" : "activo";
    const { error } = await supabaseAdmin
      .from("grupo_miembro")
      .insert({ id_grupo: grupo.id_grupo, id_perfil: idPerfil, estado });

    // 23505 = la PK (id_grupo, id_perfil) ya existe (doble toque simultáneo)
    if (error?.code === "23505") {
      throw errorConStatus("Ya eres miembro o tienes una solicitud pendiente", 409);
    }
    if (error) throw errorConStatus("No se pudo unir al grupo", 500);

    res.status(201).json({ mi_estado: estado, mi_rol: estado === "activo" ? "miembro" : null });
  } catch (error) {
    responderError(res, error);
  }
});

// DELETE /grupos/:id/membresia — salir del grupo o cancelar la solicitud pendiente.
gruposRouter.delete("/:id/membresia", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const idPerfil = req.usuario.id_perfil;
    const { grupo, membresia, rol } = await obtenerContextoGrupo(req.params.id, idPerfil);

    if (rol === "moderador") {
      throw errorConStatus("El moderador no puede salir de su propio grupo", 400);
    }
    if (!membresia) throw errorConStatus("No perteneces a este grupo", 404);
    // Si se borrara la fila de un expulsado, podría volver a unirse.
    if (membresia.estado === "expulsado") {
      throw errorConStatus("Fuiste expulsado de este grupo", 403);
    }

    const { error } = await supabaseAdmin
      .from("grupo_miembro")
      .delete()
      .eq("id_grupo", grupo.id_grupo)
      .eq("id_perfil", idPerfil);

    if (error) throw errorConStatus("No se pudo salir del grupo", 500);

    res.json({ mi_estado: null, mi_rol: null });
  } catch (error) {
    responderError(res, error);
  }
});

// GET /grupos/:id/miembros — quien gestiona ve además las solicitudes pendientes
gruposRouter.get("/:id/miembros", requireAuth, async (req, res) => {
  try {
    const { grupo, rol } = await obtenerContextoGrupo(req.params.id, req.usuario.id_perfil);
    if (!puedeVerPosts(grupo, rol)) {
      throw errorConStatus("Grupo de ingreso limitado: únete para ver a sus miembros", 403);
    }

    const estadosVisibles = puedeGestionar(rol) ? ["activo", "pendiente_aprobacion"] : ["activo"];
    const { data, error } = await supabaseAdmin
      .from("grupo_miembro")
      .select(SELECT_MIEMBRO)
      .eq("id_grupo", grupo.id_grupo)
      .in("estado", estadosVisibles)
      .order("unido_en", { ascending: true });

    if (error) throw errorConStatus("No se pudieron obtener los miembros", 500);

    res.json(data.map((m) => ({ ...m, rol: calcularRol(grupo, m, m.id_perfil) })));
  } catch (error) {
    responderError(res, error);
  }
});

// PATCH /grupos/:id/miembros/:idPerfil { estado: "activo" | "expulsado" }
// "activo" aprueba una solicitud pendiente; "expulsado" expulsa a un miembro activo.
gruposRouter.patch("/:id/miembros/:idPerfil", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const { grupo, rol } = await obtenerContextoGrupo(req.params.id, req.usuario.id_perfil);
    if (!puedeGestionar(rol)) {
      throw errorConStatus("Solo el moderador o un colaborador puede gestionar miembros", 403);
    }

    const { estado } = req.body;
    if (estado !== "activo" && estado !== "expulsado") {
      throw errorConStatus("estado debe ser 'activo' o 'expulsado'", 400);
    }

    const idObjetivo = req.params.idPerfil;
    if (idObjetivo === req.usuario.id_perfil) {
      throw errorConStatus("No puedes cambiar tu propia membresía", 400);
    }
    if (idObjetivo === grupo.id_perfil_creador) {
      throw errorConStatus("No se puede modificar la membresía del moderador", 403);
    }
    const objetivo = await obtenerMembresiaObjetivo(grupo.id_grupo, idObjetivo);

    let cambios;
    if (estado === "activo") {
      if (objetivo.estado !== "pendiente_aprobacion") {
        throw errorConStatus("Ese usuario no tiene una solicitud pendiente", 409);
      }
      cambios = { estado: "activo" };
    } else {
      if (objetivo.estado !== "activo") {
        throw errorConStatus("Solo se puede expulsar a miembros activos", 409);
      }
      // Expulsar a un colaborador equivale a quitarle el rango: solo el moderador puede.
      if (objetivo.es_colaborador && rol !== "moderador") {
        throw errorConStatus("Solo el moderador puede expulsar a un colaborador", 403);
      }
      cambios = { estado: "expulsado", es_colaborador: false };
    }

    res.json(await actualizarMembresia(grupo, idObjetivo, cambios));
  } catch (error) {
    responderError(res, error);
  }
});

// DELETE /grupos/:id/miembros/:idPerfil — rechazar una solicitud pendiente
gruposRouter.delete("/:id/miembros/:idPerfil", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const { grupo, rol } = await obtenerContextoGrupo(req.params.id, req.usuario.id_perfil);
    if (!puedeGestionar(rol)) {
      throw errorConStatus("Solo el moderador o un colaborador puede gestionar solicitudes", 403);
    }

    const objetivo = await obtenerMembresiaObjetivo(grupo.id_grupo, req.params.idPerfil);
    if (objetivo.estado !== "pendiente_aprobacion") {
      throw errorConStatus("Ese usuario no tiene una solicitud pendiente", 409);
    }

    const { error } = await supabaseAdmin
      .from("grupo_miembro")
      .delete()
      .eq("id_grupo", grupo.id_grupo)
      .eq("id_perfil", objetivo.id_perfil);

    if (error) throw errorConStatus("No se pudo rechazar la solicitud", 500);

    res.json({ ok: true });
  } catch (error) {
    responderError(res, error);
  }
});

// PATCH /grupos/:id/miembros/:idPerfil/rango { es_colaborador } — SOLO el moderador otorga rangos
gruposRouter.patch("/:id/miembros/:idPerfil/rango", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const { grupo, rol } = await obtenerContextoGrupo(req.params.id, req.usuario.id_perfil);
    if (rol !== "moderador") {
      throw errorConStatus("Solo el moderador puede otorgar o quitar rangos", 403);
    }

    const { es_colaborador } = req.body;
    if (typeof es_colaborador !== "boolean") {
      throw errorConStatus("es_colaborador debe ser true/false", 400);
    }

    const idObjetivo = req.params.idPerfil;
    if (idObjetivo === grupo.id_perfil_creador) {
      throw errorConStatus("El moderador no necesita rango de colaborador", 400);
    }
    const objetivo = await obtenerMembresiaObjetivo(grupo.id_grupo, idObjetivo);
    if (objetivo.estado !== "activo") {
      throw errorConStatus("Solo se puede cambiar el rango de miembros activos", 409);
    }

    res.json(await actualizarMembresia(grupo, idObjetivo, { es_colaborador }));
  } catch (error) {
    responderError(res, error);
  }
});

const SELECT_PUBLICACION =
  "id_publicacion, id_grupo, contenido, creado_en, autor:id_perfil_autor(id_perfil, nombres, primer_apellido, apodo, mostrar_apodo, foto_perfil_url)";

// GET /grupos/:id/publicaciones — más recientes primero.
// Solo tipo 'grupo': los 'anuncio' son institucionales y los publica la administración.
gruposRouter.get("/:id/publicaciones", requireAuth, async (req, res) => {
  try {
    const { grupo, rol } = await obtenerContextoGrupo(req.params.id, req.usuario.id_perfil);
    if (!puedeVerPosts(grupo, rol)) {
      throw errorConStatus("Grupo de ingreso limitado: únete para ver sus publicaciones", 403);
    }

    const { data, error } = await supabaseAdmin
      .from("publicacion")
      .select(SELECT_PUBLICACION)
      .eq("id_grupo", grupo.id_grupo)
      .eq("tipo", "grupo")
      .eq("estado", "activa")
      .order("creado_en", { ascending: false });

    if (error) throw errorConStatus("No se pudieron obtener las publicaciones", 500);

    res.json(data);
  } catch (error) {
    responderError(res, error);
  }
});

// POST /grupos/:id/publicaciones { contenido } — solo miembros activos
gruposRouter.post("/:id/publicaciones", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const { grupo, rol } = await obtenerContextoGrupo(req.params.id, req.usuario.id_perfil);
    if (rol === null) {
      throw errorConStatus("Solo los miembros activos pueden publicar", 403);
    }

    const { contenido } = req.body;
    const limpio = typeof contenido === "string" ? contenido.trim() : "";
    // Mismo rango que el CHECK de la tabla publicacion.
    if (limpio.length < 1 || limpio.length > 1000) {
      throw errorConStatus("contenido debe tener entre 1 y 1000 caracteres", 400);
    }

    const { data, error } = await supabaseAdmin
      .from("publicacion")
      .insert({
        id_perfil_autor: req.usuario.id_perfil,
        id_grupo: grupo.id_grupo,
        tipo: "grupo",
        contenido: limpio,
      })
      .select(SELECT_PUBLICACION)
      .single();

    if (error || !data) throw errorConStatus("No se pudo publicar", 500);

    res.status(201).json(data);
  } catch (error) {
    responderError(res, error);
  }
});

// DELETE /grupos/:id/publicaciones/:idPublicacion — borrado suave (estado = 'eliminada').
// Puede hacerlo el autor, o el moderador / un colaborador.
gruposRouter.delete("/:id/publicaciones/:idPublicacion", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const { grupo, rol } = await obtenerContextoGrupo(req.params.id, req.usuario.id_perfil);

    const { data: publicacion, error } = await supabaseAdmin
      .from("publicacion")
      .select("id_publicacion, id_perfil_autor")
      .eq("id_publicacion", req.params.idPublicacion)
      .eq("id_grupo", grupo.id_grupo)
      .eq("tipo", "grupo")
      .eq("estado", "activa")
      .maybeSingle();

    if (error || !publicacion) throw errorConStatus("Publicación no encontrada", 404);

    const esAutor = publicacion.id_perfil_autor === req.usuario.id_perfil;
    if (!esAutor && !puedeGestionar(rol)) {
      throw errorConStatus("Solo el autor, el moderador o un colaborador puede eliminar esta publicación", 403);
    }

    const { error: errorUpdate } = await supabaseAdmin
      .from("publicacion")
      .update({ estado: "eliminada" })
      .eq("id_publicacion", publicacion.id_publicacion);

    if (errorUpdate) throw errorConStatus("No se pudo eliminar la publicación", 500);

    res.json({ ok: true });
  } catch (error) {
    responderError(res, error);
  }
});
