import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { errorConStatus } from "../services/grupoService.js";
import { responderError } from "../services/feedService.js";

export const dispositivosRouter = Router();

const PLATAFORMAS = ["ios", "android"];
// Los tokens de Expo tienen la forma ExponentPushToken[...] (o ExpoPushToken[...]).
const FORMATO_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

// POST /dispositivos { push_token, plataforma }
// Upsert por push_token: si otra cuenta usó antes este celular, el token pasa a la sesión actual.
dispositivosRouter.post("/", requireAuth, async (req, res) => {
  try {
    const { push_token, plataforma } = req.body ?? {};
    if (typeof push_token !== "string" || !FORMATO_TOKEN.test(push_token)) {
      throw errorConStatus("push_token no es un token de Expo válido", 400);
    }
    if (!PLATAFORMAS.includes(plataforma)) {
      throw errorConStatus("plataforma debe ser ios o android", 400);
    }

    const { error } = await supabaseAdmin.from("dispositivo").upsert(
      {
        push_token,
        plataforma,
        id_perfil: req.usuario.id_perfil, // siempre el de la sesión, nunca del body
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "push_token" }
    );
    if (error) {
      console.error("dispositivos/registrar:", error);
      throw errorConStatus("No se pudo registrar el dispositivo", 500);
    }

    res.status(204).end();
  } catch (error) {
    responderError(res, error);
  }
});

// DELETE /dispositivos { push_token }
// Solo borra el token si es de quien lo pide: nadie puede desregistrar el celular de otro.
dispositivosRouter.delete("/", requireAuth, async (req, res) => {
  try {
    const { push_token } = req.body ?? {};
    if (typeof push_token !== "string" || !push_token) {
      throw errorConStatus("push_token es obligatorio", 400);
    }

    const { error } = await supabaseAdmin
      .from("dispositivo")
      .delete()
      .eq("push_token", push_token)
      .eq("id_perfil", req.usuario.id_perfil);
    if (error) {
      console.error("dispositivos/eliminar:", error);
      throw errorConStatus("No se pudo eliminar el dispositivo", 500);
    }

    res.status(204).end();
  } catch (error) {
    responderError(res, error);
  }
});