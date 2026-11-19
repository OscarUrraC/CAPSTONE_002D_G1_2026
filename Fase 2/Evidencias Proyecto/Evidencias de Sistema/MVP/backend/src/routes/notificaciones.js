import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { errorConStatus } from "../services/grupoService.js";
import { responderError, validarUuid } from "../services/feedService.js";

export const notificacionesRouter = Router();

const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 50;
const SELECT_NOTIFICACION = "id_notificacion, tipo, titulo, cuerpo, id_evento, creado_en, leida_en";

async function contarNoLeidas(idPerfil) {
  const { count, error } = await supabaseAdmin
    .from("notificacion")
    .select("id_notificacion", { count: "exact", head: true })
    .eq("id_perfil", idPerfil)
    .is("leida_en", null);

  if (error) {
    console.error("contar notificaciones:", error);
    throw errorConStatus("No se pudieron contar las notificaciones", 500);
  }
  return count ?? 0;
}

// GET /notificaciones?limite=20&antes=<creado_en>
// -> { notificaciones, siguiente, no_leidas }. De más nueva a más antigua, paginado por cursor.
notificacionesRouter.get("/", requireAuth, async (req, res) => {
  try {
    const limite = Math.min(
      Math.max(parseInt(req.query.limite, 10) || LIMITE_POR_DEFECTO, 1),
      LIMITE_MAXIMO
    );

    const { antes } = req.query;
    if (antes !== undefined && (typeof antes !== "string" || Number.isNaN(Date.parse(antes)))) {
      throw errorConStatus("antes debe ser una fecha válida (el creado_en de la última notificación)", 400);
    }

    const idPerfil = req.usuario.id_perfil;
    let consulta = supabaseAdmin
      .from("notificacion")
      .select(SELECT_NOTIFICACION)
      .eq("id_perfil", idPerfil)
      .order("creado_en", { ascending: false })
      .limit(limite);

    if (antes) consulta = consulta.lt("creado_en", antes);

    const { data, error } = await consulta;
    if (error) {
      console.error("listar notificaciones:", error);
      throw errorConStatus("No se pudieron obtener las notificaciones", 500);
    }

    const siguiente = data.length === limite ? data[data.length - 1].creado_en : null;
    res.json({ notificaciones: data, siguiente, no_leidas: await contarNoLeidas(idPerfil) });
  } catch (error) {
    responderError(res, error);
  }
});

// GET /notificaciones/no-leidas -> { no_leidas }  (para el contador de la pestaña)
notificacionesRouter.get("/no-leidas", requireAuth, async (req, res) => {
  try {
    res.json({ no_leidas: await contarNoLeidas(req.usuario.id_perfil) });
  } catch (error) {
    responderError(res, error);
  }
});

// POST /notificaciones/leer-todas -> { no_leidas: 0 }
// Marcar como leído solo toca la bandeja propia, por eso basta requireAuth.
notificacionesRouter.post("/leer-todas", requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("notificacion")
      .update({ leida_en: new Date().toISOString() })
      .eq("id_perfil", req.usuario.id_perfil)
      .is("leida_en", null);

    if (error) {
      console.error("leer todas:", error);
      throw errorConStatus("No se pudieron marcar las notificaciones como leídas", 500);
    }

    res.json({ no_leidas: 0 });
  } catch (error) {
    responderError(res, error);
  }
});

// POST /notificaciones/:id/leer -> { no_leidas }. Idempotente; solo funciona con notificaciones propias.
notificacionesRouter.post("/:id/leer", requireAuth, async (req, res) => {
  try {
    validarUuid(req.params.id, "Notificación no encontrada");
    const idPerfil = req.usuario.id_perfil;

    const { data: existente, error } = await supabaseAdmin
      .from("notificacion")
      .select("id_notificacion, leida_en")
      .eq("id_notificacion", req.params.id)
      .eq("id_perfil", idPerfil)
      .maybeSingle();

    if (error) throw errorConStatus("No se pudo obtener la notificación", 500);
    if (!existente) throw errorConStatus("Notificación no encontrada", 404);

    if (!existente.leida_en) {
      const { error: errorUpdate } = await supabaseAdmin
        .from("notificacion")
        .update({ leida_en: new Date().toISOString() })
        .eq("id_notificacion", existente.id_notificacion)
        .eq("id_perfil", idPerfil);

      if (errorUpdate) {
        console.error("leer notificación:", errorUpdate);
        throw errorConStatus("No se pudo marcar la notificación como leída", 500);
      }
    }

    res.json({ no_leidas: await contarNoLeidas(idPerfil) });
  } catch (error) {
    responderError(res, error);
  }
});