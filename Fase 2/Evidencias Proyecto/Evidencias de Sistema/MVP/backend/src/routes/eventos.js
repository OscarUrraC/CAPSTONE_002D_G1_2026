
import { Router } from "express";
import { requireAuth, requireCuentaActiva, requireRol } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { errorConStatus } from "../services/grupoService.js";
import { esAdministrador, responderError, validarUuid } from "../services/feedService.js";
import { notificarCambioEvento, notificarMarcaEvento } from "../services/notificacionesService.js";

export const eventosRouter = Router();

const HORA_MS = 60 * 60 * 1000;
const MAX_TITULO = 150;
const MAX_DESCRIPCION = 1000;
const MAX_UBICACION = 200;
const MAX_MOTIVO = 500;

const SELECT_EVENTO =
  "id_evento, titulo, descripcion, ubicacion, fecha_evento, estado, fecha_evento_original, creado_en, cancelado_en, motivo_cancelacion";

// Recordatorios: 1 día antes, 3 horas antes y a la hora de inicio.
// Si un momento ya pasó al marcar o reprogramar, queda como "enviado": avisar tarde no sirve.
export function banderasIniciales(fechaEvento, ahora = new Date()) {
  const inicio = new Date(fechaEvento).getTime();
  const t = ahora.getTime();
  return {
    notif_1dia_enviada: inicio - 24 * HORA_MS <= t,
    notif_3horas_enviada: inicio - 3 * HORA_MS <= t,
    notif_inicio_enviada: inicio <= t,
  };
}

// ---------- Validaciones ----------

// undefined/null/"" -> null; si viene algo, debe ser texto dentro del máximo.
function textoOpcional(valor, campo, max) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "string") throw errorConStatus(`${campo} debe ser texto`, 400);
  const limpio = valor.trim();
  if (limpio.length > max) {
    throw errorConStatus(`${campo} no puede superar los ${max} caracteres`, 400);
  }
  return limpio === "" ? null : limpio;
}

function tituloValido(valor) {
  const limpio = textoOpcional(valor, "titulo", MAX_TITULO);
  if (!limpio) throw errorConStatus("titulo es obligatorio", 400);
  return limpio;
}

// Devuelve la fecha en ISO (UTC). La app debe enviar una fecha ISO 8601 (new Date().toISOString()).
function fechaFutura(valor) {
  if (typeof valor !== "string" || Number.isNaN(Date.parse(valor))) {
    throw errorConStatus("fecha_evento debe ser una fecha válida (ISO 8601)", 400);
  }
  const fecha = new Date(valor);
  if (fecha.getTime() <= Date.now()) {
    throw errorConStatus("La fecha del evento debe ser futura", 400);
  }
  return fecha.toISOString();
}

// ---------- Consultas auxiliares ----------

async function buscarEvento(idEvento) {
  validarUuid(idEvento, "Evento no encontrado");
  const { data, error } = await supabaseAdmin
    .from("evento")
    .select(SELECT_EVENTO)
    .eq("id_evento", idEvento)
    .maybeSingle();

  if (error) throw errorConStatus("No se pudo obtener el evento", 500);
  if (!data) throw errorConStatus("Evento no encontrado", 404);
  return data;
}

// Ids de eventos que YO tengo marcados (marca vigente = desmarcado_en nulo).
async function eventosMarcados(idPerfil, ids) {
  if (ids.length === 0) return new Set();
  const { data, error } = await supabaseAdmin
    .from("evento_notificacion")
    .select("id_evento")
    .eq("id_perfil", idPerfil)
    .is("desmarcado_en", null)
    .in("id_evento", ids);

  if (error) throw errorConStatus("No se pudieron obtener tus eventos marcados", 500);
  return new Set(data.map((f) => f.id_evento));
}

// ---------- Estudiantes y administradores: ver ----------

// GET /eventos -> { eventos: [{ ...evento, marcado }] }
// Eventos próximos (fecha futura), del más cercano al más lejano. Incluye los cancelados que aún
// no llegan a su fecha, con estado "cancelado", para que quien los marcó vea que ya no se hará.
eventosRouter.get("/", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("evento")
      .select(SELECT_EVENTO)
      .gte("fecha_evento", new Date().toISOString())
      .order("fecha_evento", { ascending: true })
      .limit(100);

    if (error) {
      console.error("listar eventos:", error);
      throw errorConStatus("No se pudieron obtener los eventos", 500);
    }

    const marcados = await eventosMarcados(
      req.usuario.id_perfil,
      data.map((e) => e.id_evento)
    );

    res.json({ eventos: data.map((e) => ({ ...e, marcado: marcados.has(e.id_evento) })) });
  } catch (error) {
    responderError(res, error);
  }
});

// GET /eventos/:id
eventosRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const evento = await buscarEvento(req.params.id);
    const marcados = await eventosMarcados(req.usuario.id_perfil, [evento.id_evento]);
    res.json({
      ...evento,
      marcado: marcados.has(evento.id_evento),
      puede_gestionar: esAdministrador(req.usuario), // solo para mostrar/ocultar botones
    });
  } catch (error) {
    responderError(res, error);
  }
});

// ---------- Administradores: crear, reprogramar, cancelar ----------

// POST /eventos { titulo, descripcion?, ubicacion?, fecha_evento }
// id_sede lo completa el trigger trg_evento_heredar_sede.
eventosRouter.post(
  "/",
  requireAuth,
  requireCuentaActiva,
  requireRol("administrador"),
  async (req, res) => {
    try {
      const fila = {
        id_perfil_creador: req.usuario.id_perfil,
        titulo: tituloValido(req.body.titulo),
        descripcion: textoOpcional(req.body.descripcion, "descripcion", MAX_DESCRIPCION),
        ubicacion: textoOpcional(req.body.ubicacion, "ubicacion", MAX_UBICACION),
        fecha_evento: fechaFutura(req.body.fecha_evento),
      };

      const { data, error } = await supabaseAdmin
        .from("evento")
        .insert(fila)
        .select(SELECT_EVENTO)
        .single();

      if (error || !data) {
        console.error("crear evento:", error);
        throw errorConStatus("No se pudo publicar el evento", 500);
      }

      res.status(201).json({ ...data, marcado: false });
    } catch (error) {
      responderError(res, error);
    }
  }
);

// PATCH /eventos/:id { titulo?, descripcion?, ubicacion?, fecha_evento? }
// Cambiar fecha_evento = reprogramar: guarda la fecha original la primera vez, reinicia los
// recordatorios de quienes ya marcaron el evento y les crea un aviso en su bandeja.
eventosRouter.patch(
  "/:id",
  requireAuth,
  requireCuentaActiva,
  requireRol("administrador"),
  async (req, res) => {
    try {
      const evento = await buscarEvento(req.params.id);
      if (evento.estado === "cancelado") {
        throw errorConStatus("No se puede editar un evento cancelado", 409);
      }
      if (new Date(evento.fecha_evento).getTime() <= Date.now()) {
        throw errorConStatus("El evento ya ocurrió y no se puede editar", 409);
      }

      const { titulo, descripcion, ubicacion, fecha_evento } = req.body;
      const cambios = {};
      if (titulo !== undefined) cambios.titulo = tituloValido(titulo);
      if (descripcion !== undefined) {
        cambios.descripcion = textoOpcional(descripcion, "descripcion", MAX_DESCRIPCION);
      }
      if (ubicacion !== undefined) {
        cambios.ubicacion = textoOpcional(ubicacion, "ubicacion", MAX_UBICACION);
      }

      let reprogramado = false;
      if (fecha_evento !== undefined) {
        const nueva = fechaFutura(fecha_evento);
        if (new Date(nueva).getTime() !== new Date(evento.fecha_evento).getTime()) {
          cambios.fecha_evento = nueva;
          if (!evento.fecha_evento_original) cambios.fecha_evento_original = evento.fecha_evento;
          reprogramado = true;
        }
      }

      if (Object.keys(cambios).length === 0) {
        throw errorConStatus("No hay cambios para guardar", 400);
      }

      const { data, error } = await supabaseAdmin
        .from("evento")
        .update(cambios)
        .eq("id_evento", evento.id_evento)
        .select(SELECT_EVENTO)
        .single();

      if (error || !data) {
        console.error("editar evento:", error);
        throw errorConStatus("No se pudo editar el evento", 500);
      }

      if (reprogramado) {
        const { error: errorMarcas } = await supabaseAdmin
          .from("evento_notificacion")
          .update(banderasIniciales(data.fecha_evento))
          .eq("id_evento", data.id_evento)
          .is("desmarcado_en", null);
        if (errorMarcas) {
          console.error("reprogramar: no se reiniciaron los recordatorios:", errorMarcas);
        }
        await notificarCambioEvento(data, "evento_reprogramado");
      }

      res.json(data);
    } catch (error) {
      responderError(res, error);
    }
  }
);

// POST /eventos/:id/cancelar { motivo? }
// Cancela el evento y avisa en la bandeja a quienes lo habían marcado.
eventosRouter.post(
  "/:id/cancelar",
  requireAuth,
  requireCuentaActiva,
  requireRol("administrador"),
  async (req, res) => {
    try {
      const evento = await buscarEvento(req.params.id);
      if (evento.estado === "cancelado") {
        throw errorConStatus("El evento ya está cancelado", 409);
      }

      const { data, error } = await supabaseAdmin
        .from("evento")
        .update({
          estado: "cancelado",
          cancelado_por: req.usuario.id_perfil,
          cancelado_en: new Date().toISOString(),
          motivo_cancelacion: textoOpcional(req.body?.motivo, "motivo", MAX_MOTIVO),
        })
        .eq("id_evento", evento.id_evento)
        .select(SELECT_EVENTO)
        .single();

      if (error || !data) {
        console.error("cancelar evento:", error);
        throw errorConStatus("No se pudo cancelar el evento", 500);
      }

      await notificarCambioEvento(data, "evento_cancelado");

      res.json(data);
    } catch (error) {
      responderError(res, error);
    }
  }
);

// ---------- Estudiantes: marcar / desmarcar para recibir recordatorios ----------

// PUT /eventos/:id/marca -> { marcado: true }. Idempotente.
// PUT /eventos/:id/marca -> { marcado: true }. Idempotente.
// Al marcar por primera vez se crea un aviso de confirmación en la bandeja de notificaciones.
eventosRouter.put("/:id/marca", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    const evento = await buscarEvento(req.params.id);
    if (evento.estado !== "activo") {
      throw errorConStatus("Este evento fue cancelado", 409);
    }
    if (new Date(evento.fecha_evento).getTime() <= Date.now()) {
      throw errorConStatus("Este evento ya ocurrió", 409);
    }

    const idPerfil = req.usuario.id_perfil;
    const yaMarcado = await eventosMarcados(idPerfil, [evento.id_evento]);
    if (yaMarcado.has(evento.id_evento)) return res.json({ marcado: true });

    const banderas = banderasIniciales(evento.fecha_evento);

    // upsert: si el estudiante ya había marcado y desmarcado, la fila existe y se reactiva.
    const { error } = await supabaseAdmin.from("evento_notificacion").upsert(
      {
        id_evento: evento.id_evento,
        id_perfil: idPerfil,
        marcado_en: new Date().toISOString(),
        desmarcado_en: null,
        ...banderas,
      },
      { onConflict: "id_evento,id_perfil" }
    );

    if (error) {
      console.error("marcar evento:", error);
      throw errorConStatus("No se pudo marcar el evento", 500);
    }

    // Solo se nombran los recordatorios que de verdad quedan por llegar.
    const momentos = [
      !banderas.notif_1dia_enviada && "1 día antes",
      !banderas.notif_3horas_enviada && "3 horas antes",
      !banderas.notif_inicio_enviada && "cuando comience",
    ].filter(Boolean);
    await notificarMarcaEvento(evento, idPerfil, momentos);

    res.json({ marcado: true });
  } catch (error) {
    responderError(res, error);
  }
});

// DELETE /eventos/:id/marca -> { marcado: false }. Idempotente. Conserva la fila (desmarcado_en).
eventosRouter.delete("/:id/marca", requireAuth, requireCuentaActiva, async (req, res) => {
  try {
    validarUuid(req.params.id, "Evento no encontrado");

    const { error } = await supabaseAdmin
      .from("evento_notificacion")
      .update({ desmarcado_en: new Date().toISOString() })
      .eq("id_evento", req.params.id)
      .eq("id_perfil", req.usuario.id_perfil)
      .is("desmarcado_en", null);

    if (error) {
      console.error("desmarcar evento:", error);
      throw errorConStatus("No se pudo desmarcar el evento", 500);
    }

    res.json({ marcado: false });
  } catch (error) {
    responderError(res, error);
  }
});