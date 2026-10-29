import { Router } from "express";
import { requireAuth, requireCuentaActiva, requireRol } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import {
  SELECT_PUBLICACION_FEED,
  enriquecerPublicaciones,
  responderError,
  validarContenido,
} from "../services/feedService.js";
import { errorConStatus } from "../services/grupoService.js";

export const feedRouter = Router();

const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 50;

// GET /feed/para-ti?limite=20&antes=<creado_en de la última publicación recibida>
//
// "Para Ti" = publicaciones de los grupos donde soy miembro ACTIVO (incluye los que creé),
// de más nueva a más antigua. Los grupos suspendidos/eliminados y las publicaciones eliminadas
// no aparecen. Paginación por cursor: se pide `antes` = `siguiente` de la respuesta anterior.
// Se usa el cursor (y no "página N") para que publicaciones nuevas no corran la lista y repitan ítems.
feedRouter.get("/para-ti", requireAuth, async (req, res) => {
  try {
    const idPerfil = req.usuario.id_perfil;

    const limite = Math.min(
      Math.max(parseInt(req.query.limite, 10) || LIMITE_POR_DEFECTO, 1),
      LIMITE_MAXIMO
    );

    const { antes } = req.query;
    if (antes !== undefined && (typeof antes !== "string" || Number.isNaN(Date.parse(antes)))) {
      throw errorConStatus("antes debe ser una fecha válida (el creado_en de la última publicación)", 400);
    }

    // 1) Grupos activos en los que participo activamente.
    const { data: membresias, error: errorMembresias } = await supabaseAdmin
      .from("grupo_miembro")
      .select("id_grupo, grupo!inner(estado)")
      .eq("id_perfil", idPerfil)
      .eq("estado", "activo")
      .eq("grupo.estado", "activo");

    if (errorMembresias) throw errorConStatus("No se pudieron obtener tus grupos", 500);

    const idsGrupos = membresias.map((m) => m.id_grupo);
    if (idsGrupos.length === 0) {
      // `sin_grupos` permite a la app mostrar "únete a un grupo" en vez de un feed vacío sin explicación.
      return res.json({ publicaciones: [], siguiente: null, sin_grupos: true });
    }

    // 2) Publicaciones de esos grupos.
    let consulta = supabaseAdmin
      .from("publicacion")
      .select(SELECT_PUBLICACION_FEED)
      .eq("tipo", "grupo")
      .eq("estado", "activa")
      .in("id_grupo", idsGrupos)
      .order("creado_en", { ascending: false })
      .limit(limite);

    if (antes) consulta = consulta.lt("creado_en", antes);

    const { data, error } = await consulta;
    if (error) throw errorConStatus("No se pudo obtener el feed", 500);

    // 3) Me gusta y comentarios de la página (2 consultas en total).
    const publicaciones = await enriquecerPublicaciones(data, idPerfil);

    // Si llegó una página incompleta, ya no hay más: la app deja de pedir.
    const siguiente = data.length === limite ? data[data.length - 1].creado_en : null;

    res.json({ publicaciones, siguiente, sin_grupos: false });
  } catch (error) {
    responderError(res, error);
  }
});

// GET /feed/anuncios?limite=20&antes=<creado_en del último anuncio recibido>
//
// Anuncios institucionales (tipo='anuncio'), visibles para todos los usuarios. Misma paginación por
// cursor que "Para Ti". No depende de grupos, así que no hay `sin_grupos`.
feedRouter.get("/anuncios", requireAuth, async (req, res) => {
  try {
    const limite = Math.min(
      Math.max(parseInt(req.query.limite, 10) || LIMITE_POR_DEFECTO, 1),
      LIMITE_MAXIMO
    );

    const { antes } = req.query;
    if (antes !== undefined && (typeof antes !== "string" || Number.isNaN(Date.parse(antes)))) {
      throw errorConStatus("antes debe ser una fecha válida (el creado_en del último anuncio)", 400);
    }

    let consulta = supabaseAdmin
      .from("publicacion")
      .select(SELECT_PUBLICACION_FEED)
      .eq("tipo", "anuncio")
      .eq("estado", "activa")
      .order("creado_en", { ascending: false })
      .limit(limite);

    if (antes) consulta = consulta.lt("creado_en", antes);

    const { data, error } = await consulta;
    if (error) {
      console.error("feed anuncios:", error);
      throw errorConStatus("No se pudieron obtener los anuncios", 500);
    }

    const publicaciones = await enriquecerPublicaciones(data, req.usuario.id_perfil);
    const siguiente = data.length === limite ? data[data.length - 1].creado_en : null;

    res.json({ publicaciones, siguiente });
  } catch (error) {
    responderError(res, error);
  }
});

// POST /feed/anuncios { contenido }  — solo administradores.
// id_sede lo completa el trigger trg_publicacion_anuncio_heredar_sede; id_grupo queda nulo.
// El rol se lee del JWT: si le quitan el rol a un administrador, su token sigue valiendo hasta que expire.
feedRouter.post(
  "/anuncios",
  requireAuth,
  requireCuentaActiva,
  requireRol("administrador"),
  async (req, res) => {
    try {
      const contenido = validarContenido(req.body.contenido);

      const { data, error } = await supabaseAdmin
        .from("publicacion")
        .insert({ id_perfil_autor: req.usuario.id_perfil, tipo: "anuncio", contenido })
        .select(SELECT_PUBLICACION_FEED)
        .single();

      if (error || !data) {
        console.error("crear anuncio:", error);
        throw errorConStatus("No se pudo publicar el anuncio", 500);
      }

      const [anuncio] = await enriquecerPublicaciones([data], req.usuario.id_perfil);
      res.status(201).json(anuncio);
    } catch (error) {
      responderError(res, error);
    }
  }
);