import { Router } from "express";
import { requireAuth, requireCuentaActiva } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { errorConStatus, obtenerContextoGrupo, puedeVerPosts } from "../services/grupoService.js";

export const reportesRouter = Router();

function responderError(res, error) {
  if (!error.status) console.error(error);
  res
    .status(error.status ?? 500)
    .json({ error: error.status ? error.message : "Error interno del servidor" });
}

// Valida que el usuario pueda ver lo que reporta y que no sea suyo.
async function validarObjetivo({ id_publicacion, id_grupo, id_comentario }, idPerfil) {
  if (id_publicacion) {
    const { data: publicacion, error } = await supabaseAdmin
      .from("publicacion")
      .select("id_publicacion, id_grupo, id_perfil_autor")
      .eq("id_publicacion", id_publicacion)
      .eq("tipo", "grupo")
      .eq("estado", "activa")
      .maybeSingle();

    if (error || !publicacion) throw errorConStatus("Publicación no encontrada", 404);
    if (publicacion.id_perfil_autor === idPerfil) {
      throw errorConStatus("No puedes reportar tu propia publicación", 400);
    }

    const { grupo, rol } = await obtenerContextoGrupo(publicacion.id_grupo, idPerfil);
    if (!puedeVerPosts(grupo, rol)) throw errorConStatus("Publicación no encontrada", 404);
    return;
  }

  if (id_comentario) {
    const { data: comentario, error } = await supabaseAdmin
      .from("comentario")
      .select("id_comentario, id_perfil_autor, publicacion:id_publicacion(id_grupo)")
      .eq("id_comentario", id_comentario)
      .eq("estado", "activo")
      .maybeSingle();

    if (error || !comentario) throw errorConStatus("Comentario no encontrado", 404);
    if (comentario.id_perfil_autor === idPerfil) {
      throw errorConStatus("No puedes reportar tu propio comentario", 400);
    }

    const { grupo, rol } = await obtenerContextoGrupo(comentario.publicacion.id_grupo, idPerfil);
    if (!puedeVerPosts(grupo, rol)) throw errorConStatus("Comentario no encontrado", 404);
    return;
  }

  const { grupo } = await obtenerContextoGrupo(id_grupo, idPerfil);
  if (grupo.id_perfil_creador === idPerfil) {
    throw errorConStatus("No puedes reportar tu propio grupo", 400);
  }
}

// GET /reportes/motivos — catálogo para el formulario de reporte
reportesRouter.get("/motivos", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("motivo_reporte")
    .select("id_motivo_reporte, nombre")
    .order("nombre", { ascending: true });

  if (error) {
    return res.status(500).json({ error: "No se pudieron obtener los motivos" });
  }

  res.json(data);
});

// POST /reportes { id_publicacion | id_grupo, id_motivo_reporte, detalle }
// Queda en estado 'pendiente' (default de la tabla) hasta que un administrador lo resuelva.
reportesRouter.post("/", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const { id_publicacion, id_grupo, id_comentario, id_motivo_reporte, detalle } = req.body;

    const objetivos = [id_publicacion, id_grupo, id_comentario].filter(Boolean);
    if (objetivos.length !== 1) {
      throw errorConStatus("Indica exactamente uno: id_publicacion, id_grupo o id_comentario", 400);
    }
    if (typeof id_motivo_reporte !== "string" || !id_motivo_reporte) {
      throw errorConStatus("Falta id_motivo_reporte", 400);
    }
    if (detalle !== undefined && detalle !== null && typeof detalle !== "string") {
      throw errorConStatus("detalle debe ser texto", 400);
    }
    const detalleLimpio = detalle?.trim() ?? "";
    if (detalleLimpio.length > 500) {
      throw errorConStatus("detalle admite hasta 500 caracteres", 400);
    }

    const idPerfil = req.usuario.id_perfil;
    await validarObjetivo({ id_publicacion, id_grupo, id_comentario }, idPerfil);

    const { data, error } = await supabaseAdmin
      .from("reporte")
      .insert({
        id_perfil_denunciante: idPerfil,
        id_publicacion: id_publicacion ?? null,
        id_grupo: id_grupo ?? null,
        id_comentario: id_comentario ?? null,
        id_motivo_reporte,
        detalle: detalleLimpio === "" ? null : detalleLimpio,
      })
      .select("id_reporte, estado, creado_en")
      .single();

    if (error?.code === "23505") throw errorConStatus("Ya reportaste esto", 409);
    if (error?.code === "23503" || error?.code === "22P02") {
      throw errorConStatus("Motivo de reporte inválido", 400);
    }
    if (error || !data) throw errorConStatus("No se pudo registrar el reporte", 500);

    res.status(201).json(data);
  } catch (error) {
    responderError(res, error);
  }
});
