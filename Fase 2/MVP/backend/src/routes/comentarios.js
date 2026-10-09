import { Router } from "express";
import { requireAuth, requireCuentaActiva } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { errorConStatus } from "../services/grupoService.js";
import {
  contarMeGustaComentario,
  esAdministrador,
  obtenerComentarioVisible,
  responderError,
} from "../services/feedService.js";

export const comentariosRouter = Router();

// POST /comentarios/:id/me-gusta — idempotente.
comentariosRouter.post("/:id/me-gusta", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const { comentario, puedeInteractuar } = await obtenerComentarioVisible(req.params.id, req.usuario);
    if (!puedeInteractuar) {
      throw errorConStatus("Solo los miembros activos del grupo pueden dar me gusta", 403);
    }

    const { error } = await supabaseAdmin
      .from("comentario_me_gusta")
      .insert({ id_comentario: comentario.id_comentario, id_perfil: req.usuario.id_perfil });

    // 23505 = ya tenía me gusta (PK compuesta): no es un error para el usuario.
    if (error && error.code !== "23505") throw errorConStatus("No se pudo dar me gusta", 500);

    res.json({
      me_gusta_mio: true,
      cantidad_me_gusta: await contarMeGustaComentario(comentario.id_comentario),
    });
  } catch (error) {
    responderError(res, error);
  }
});

// DELETE /comentarios/:id/me-gusta — idempotente.
comentariosRouter.delete("/:id/me-gusta", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const { comentario } = await obtenerComentarioVisible(req.params.id, req.usuario);

    const { error } = await supabaseAdmin
      .from("comentario_me_gusta")
      .delete()
      .eq("id_comentario", comentario.id_comentario)
      .eq("id_perfil", req.usuario.id_perfil);

    if (error) throw errorConStatus("No se pudo quitar el me gusta", 500);

    res.json({
      me_gusta_mio: false,
      cantidad_me_gusta: await contarMeGustaComentario(comentario.id_comentario),
    });
  } catch (error) {
    responderError(res, error);
  }
});

// DELETE /comentarios/:id { motivo? } — borrado SUAVE (estado = 'eliminado'), nunca DELETE físico.
// Puede eliminar: el autor, el moderador/colaborador del grupo, o un administrador de la plataforma.
// Guarda quién, cuándo y (opcional) por qué, como exige el principio de trazabilidad de CLAUDE.md.
// REQUIERE la migración docs/migraciones/001_feeds_trazabilidad_comentarios.sql.
comentariosRouter.delete("/:id", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const { comentario, puedeModerar } = await obtenerComentarioVisible(req.params.id, req.usuario);

    const esAutor = comentario.id_perfil_autor === req.usuario.id_perfil;
    if (!esAutor && !puedeModerar && !esAdministrador(req.usuario)) {
      throw errorConStatus("Solo el autor, el moderador o un colaborador puede eliminar este comentario", 403);
    }

    const motivo = typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";
    if (motivo.length > 200) {
      throw errorConStatus("motivo admite hasta 200 caracteres", 400);
    }

    const { data, error } = await supabaseAdmin
      .from("comentario")
      .update({
        estado: "eliminado",
        eliminado_por: req.usuario.id_perfil,
        eliminado_en: new Date().toISOString(),
        motivo_eliminacion: motivo === "" ? null : motivo,
      })
      .eq("id_comentario", comentario.id_comentario)
      .eq("estado", "activo") // si dos personas lo eliminan a la vez, solo la primera queda registrada
      .select("id_comentario")
      .maybeSingle();

    if (error) throw errorConStatus("No se pudo eliminar el comentario", 500);
    if (!data) throw errorConStatus("Comentario no encontrado", 404);

    res.json({ ok: true });
  } catch (error) {
    responderError(res, error);
  }
});
