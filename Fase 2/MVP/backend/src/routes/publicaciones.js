import { Router } from "express";
import { requireAuth, requireCuentaActiva } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { errorConStatus } from "../services/grupoService.js";
import {
  SELECT_AUTOR,
  contarMeGustaPublicacion,
  enriquecerPublicaciones,
  esAdministrador,
  obtenerPublicacionVisible,
  responderError,
  validarContenido,
  validarUuid,
} from "../services/feedService.js";
import { armarArbolComentarios } from "../services/comentariosArbol.js";

export const publicacionesRouter = Router();

// Tope de comentarios que se cargan de una vez por publicación (suficiente para el MVP).
const LIMITE_COMENTARIOS = 500;

const SELECT_COMENTARIO = `id_comentario, id_comentario_padre, id_comentario_raiz, contenido, estado, creado_en, id_perfil_autor, autor:id_perfil_autor(${SELECT_AUTOR}), comentario_me_gusta(count)`;

// Fila de la BD -> fila plana que entiende armarArbolComentarios.
function aFilaComentario(fila, { idPerfil, misLikes, puedeModerar, esAdmin }) {
  return {
    id_comentario: fila.id_comentario,
    id_comentario_padre: fila.id_comentario_padre,
    id_comentario_raiz: fila.id_comentario_raiz,
    estado: fila.estado,
    contenido: fila.contenido,
    creado_en: fila.creado_en,
    autor: fila.autor,
    cantidad_me_gusta: fila.comentario_me_gusta?.[0]?.count ?? 0,
    me_gusta_mio: misLikes.has(fila.id_comentario),
    // Solo para mostrar/ocultar el botón: DELETE /comentarios/:id vuelve a validar.
    puede_eliminar: fila.id_perfil_autor === idPerfil || puedeModerar || esAdmin,
  };
}

// GET /publicaciones/:id — detalle de una publicación (la pantalla de comentarios la necesita).
publicacionesRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const { publicacion, rol, puedeInteractuar } = await obtenerPublicacionVisible(
      req.params.id,
      req.usuario
    );
    const [enriquecida] = await enriquecerPublicaciones([publicacion], req.usuario.id_perfil);
    res.json({ ...enriquecida, mi_rol: rol, puede_interactuar: puedeInteractuar });
  } catch (error) {
    responderError(res, error);
  }
});

// POST /publicaciones/:id/me-gusta — idempotente: si ya tenía me gusta, responde igual (no es error).
publicacionesRouter.post("/:id/me-gusta", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const { publicacion, puedeInteractuar } = await obtenerPublicacionVisible(req.params.id, req.usuario);
    if (!puedeInteractuar) {
      throw errorConStatus("Solo los miembros activos del grupo pueden dar me gusta", 403);
    }

    const { error } = await supabaseAdmin
      .from("me_gusta")
      .insert({ id_publicacion: publicacion.id_publicacion, id_perfil: req.usuario.id_perfil });

    // 23505 = la PK (id_publicacion, id_perfil) ya existe: doble toque o petición repetida.
    if (error && error.code !== "23505") throw errorConStatus("No se pudo dar me gusta", 500);

    res.json({
      me_gusta_mio: true,
      cantidad_me_gusta: await contarMeGustaPublicacion(publicacion.id_publicacion),
    });
  } catch (error) {
    responderError(res, error);
  }
});

// DELETE /publicaciones/:id/me-gusta — idempotente. Quitar un me gusta es un "toggle", no un dato
// de negocio con trazabilidad (CLAUDE.md protege grupos, membresías, publicaciones, comentarios, etc.).
publicacionesRouter.delete("/:id/me-gusta", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    // Aquí basta con poder VER la publicación: quien dejó el grupo igual puede retirar su me gusta.
    const { publicacion } = await obtenerPublicacionVisible(req.params.id, req.usuario);

    const { error } = await supabaseAdmin
      .from("me_gusta")
      .delete()
      .eq("id_publicacion", publicacion.id_publicacion)
      .eq("id_perfil", req.usuario.id_perfil);

    if (error) throw errorConStatus("No se pudo quitar el me gusta", 500);

    res.json({
      me_gusta_mio: false,
      cantidad_me_gusta: await contarMeGustaPublicacion(publicacion.id_publicacion),
    });
  } catch (error) {
    responderError(res, error);
  }
});

// Carga todos los comentarios de la publicación y los arma como árbol.
async function cargarComentarios(idPublicacion, usuario, { puedeModerar }) {
  const idPerfil = usuario.id_perfil;

  const [comentarios, misLikes] = await Promise.all([
    supabaseAdmin
      .from("comentario")
      .select(SELECT_COMENTARIO)
      .eq("id_publicacion", idPublicacion)
      .order("creado_en", { ascending: true })
      .limit(LIMITE_COMENTARIOS),
    // Mis me gusta en los comentarios de ESTA publicación (join, para no mandar cientos de ids en la URL).
    supabaseAdmin
      .from("comentario_me_gusta")
      .select("id_comentario, comentario!inner(id_publicacion)")
      .eq("id_perfil", idPerfil)
      .eq("comentario.id_publicacion", idPublicacion),
  ]);

  if (comentarios.error || misLikes.error) {
    console.error("cargarComentarios:", comentarios.error ?? misLikes.error);
    throw errorConStatus("No se pudieron obtener los comentarios", 500);
  }

  const mios = new Set(misLikes.data.map((f) => f.id_comentario));
  const esAdmin = esAdministrador(usuario);

  const filas = comentarios.data.map((fila) =>
    aFilaComentario(fila, { idPerfil, misLikes: mios, puedeModerar, esAdmin })
  );

  return armarArbolComentarios(filas);
}

// GET /publicaciones/:id/comentarios -> { comentarios: [...árbol...], total }
publicacionesRouter.get("/:id/comentarios", requireAuth, async (req, res) => {
  try {
    const { publicacion, puedeModerar } = await obtenerPublicacionVisible(req.params.id, req.usuario);
    res.json(await cargarComentarios(publicacion.id_publicacion, req.usuario, { puedeModerar }));
  } catch (error) {
    responderError(res, error);
  }
});

// POST /publicaciones/:id/comentarios { contenido, id_comentario_padre? }
// Sin id_comentario_padre = comentario nuevo. Con id_comentario_padre = respuesta a ese comentario.
publicacionesRouter.post("/:id/comentarios", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const { publicacion, puedeInteractuar } = await obtenerPublicacionVisible(req.params.id, req.usuario);
    if (!puedeInteractuar) {
      throw errorConStatus("Solo los miembros activos del grupo pueden comentar", 403);
    }

    const contenido = validarContenido(req.body.contenido);
    const { id_comentario_padre } = req.body;

    let padre = null;
    let idRaiz = null;

    if (id_comentario_padre !== undefined && id_comentario_padre !== null) {
      validarUuid(id_comentario_padre, "El comentario al que respondes no existe");

      const { data, error } = await supabaseAdmin
        .from("comentario")
        .select("id_comentario, id_comentario_raiz")
        .eq("id_comentario", id_comentario_padre)
        .eq("id_publicacion", publicacion.id_publicacion) // debe ser de ESTA publicación
        .eq("estado", "activo") // no se responde a algo eliminado
        .maybeSingle();

      if (error) throw errorConStatus("No se pudo validar el comentario", 500);
      if (!data) throw errorConStatus("El comentario al que respondes no existe", 404);

      padre = data;
      // Todo el hilo cuelga del comentario de primer nivel (la raíz del padre, o el padre mismo).
      idRaiz = data.id_comentario_raiz ?? data.id_comentario;
    }

    const { data: creado, error } = await supabaseAdmin
      .from("comentario")
      .insert({
        id_publicacion: publicacion.id_publicacion,
        id_perfil_autor: req.usuario.id_perfil,
        contenido,
        id_comentario_padre: padre?.id_comentario ?? null,
        id_comentario_raiz: idRaiz,
      })
      .select(SELECT_COMENTARIO)
      .single();

    if (error || !creado) throw errorConStatus("No se pudo publicar el comentario", 500);

    res.status(201).json({
      id_comentario: creado.id_comentario,
      id_comentario_padre: creado.id_comentario_padre,
      contenido: creado.contenido,
      creado_en: creado.creado_en,
      autor: creado.autor,
      cantidad_me_gusta: 0,
      me_gusta_mio: false,
      puede_eliminar: true,
      en_respuesta_a: null,
      eliminado: false,
    });
  } catch (error) {
    responderError(res, error);
  }
});
