import { supabaseAdmin } from "../config/supabase.js";

const HORA_MS = 60 * 60 * 1000;
const MINUTO_MS = 60 * 1000;
const INTERVALO_MS = MINUTO_MS; // cada cuánto se revisan los recordatorios
// Si el servidor estuvo caído, un recordatorio se manda hasta 30 min tarde; pasado eso ya no sirve.
const TOLERANCIA_MS = 30 * MINUTO_MS;

// Cada recordatorio usa su bandera de evento_notificacion para no repetirse.
const RECORDATORIOS = [
  { columna: "notif_1dia_enviada", tipo: "evento_1dia", antesMs: 24 * HORA_MS },
  { columna: "notif_3horas_enviada", tipo: "evento_3horas", antesMs: 3 * HORA_MS },
  { columna: "notif_inicio_enviada", tipo: "evento_inicio", antesMs: 0 },
];

// ["a", "b", "c"] -> "a, b y c"
function unirLista(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

// Los textos no llevan horas: el servidor no conoce la zona horaria del estudiante.
// La hora exacta se ve en el detalle del evento, al que se llega tocando el aviso.
// extra.momentos (solo evento_marcado): los recordatorios que quedan pendientes, ej. ["3 horas antes", "cuando comience"].
function textosNotificacion(tipo, evento, extra = {}) {
  const nombre = `"${evento.titulo}"`;
  switch (tipo) {
    case "evento_marcado": {
      const lista = unirLista(extra.momentos ?? []);
      return {
        titulo: "Recordatorio activado",
        cuerpo: lista ? `Te avisaremos de ${nombre} ${lista}.` : `Marcaste ${nombre}.`,
      };
    }
    case "evento_1dia":
      return { titulo: "Falta 1 día para un evento", cuerpo: `${nombre} comienza en 1 día.` };
    case "evento_3horas":
      return { titulo: "Faltan 3 horas para un evento", cuerpo: `${nombre} comienza en 3 horas.` };
    case "evento_inicio":
      return {
        titulo: "Tu evento comienza ahora",
        cuerpo: evento.ubicacion ? `${nombre} está comenzando en ${evento.ubicacion}.` : `${nombre} está comenzando.`,
      };
    case "evento_reprogramado":
      return { titulo: "Evento reprogramado", cuerpo: `${nombre} cambió de fecha. Revisa el nuevo horario.` };
    case "evento_cancelado":
      return {
        titulo: "Evento cancelado",
        cuerpo: evento.motivo_cancelacion
          ? `${nombre} fue cancelado. Motivo: ${evento.motivo_cancelacion}`
          : `${nombre} fue cancelado.`,
      };
    default:
      throw new Error(`Tipo de notificación desconocido: ${tipo}`);
  }
}

// Crea el aviso de un recordatorio para todos los que marcaron el evento y aún no lo recibieron.
async function enviarRecordatorio(evento, { columna, tipo }) {
  // 1) Se "reclaman" las marcas: el update es atómico, así que si dos procesos corren a la vez
  //    cada marca la gana uno solo. Devuelve únicamente los perfiles que este proceso reclamó.
  const { data: reclamadas, error } = await supabaseAdmin
    .from("evento_notificacion")
    .update({ [columna]: true })
    .eq("id_evento", evento.id_evento)
    .is("desmarcado_en", null)
    .eq(columna, false)
    .select("id_perfil");

  if (error) {
    console.error(`recordatorio ${tipo}: no se pudieron reclamar las marcas:`, error);
    return 0;
  }
  if (!reclamadas || reclamadas.length === 0) return 0;

  // 2) Se crean los avisos.
  const textos = textosNotificacion(tipo, evento);
  const filas = reclamadas.map(({ id_perfil }) => ({
    id_perfil,
    tipo,
    id_evento: evento.id_evento,
    ...textos,
  }));

  const { error: errorInsert } = await supabaseAdmin.from("notificacion").insert(filas);
  if (errorInsert) {
    console.error(`recordatorio ${tipo}: no se pudieron crear los avisos:`, errorInsert);
    // 3) Se devuelve la bandera a "no enviado" para reintentar en la próxima vuelta.
    await supabaseAdmin
      .from("evento_notificacion")
      .update({ [columna]: false })
      .eq("id_evento", evento.id_evento)
      .in("id_perfil", reclamadas.map((r) => r.id_perfil));
    return 0;
  }

  return filas.length;
}

// Revisa los 3 momentos (1 día, 3 horas, inicio) y crea los avisos que toquen. Devuelve cuántos creó.
export async function procesarRecordatorios(ahora = new Date()) {
  const t = ahora.getTime();
  let creadas = 0;

  for (const recordatorio of RECORDATORIOS) {
    // Un recordatorio "toca" cuando fecha_evento - antes <= ahora, y deja de servir pasada la tolerancia.
    const desde = new Date(t + recordatorio.antesMs - TOLERANCIA_MS).toISOString();
    const hasta = new Date(t + recordatorio.antesMs).toISOString();

    const { data: eventos, error } = await supabaseAdmin
      .from("evento")
      .select("id_evento, titulo, ubicacion")
      .eq("estado", "activo")
      .gte("fecha_evento", desde)
      .lte("fecha_evento", hasta);

    if (error) {
      console.error(`recordatorio ${recordatorio.tipo}: no se pudieron buscar eventos:`, error);
      continue;
    }

    for (const evento of eventos) {
      creadas += await enviarRecordatorio(evento, recordatorio);
    }
  }

  return creadas;
}

// Avisa a quienes marcaron el evento que se reprogramó o se canceló. Nunca lanza error: si falla,
// se registra en consola y la acción del administrador (editar/cancelar) igual queda hecha.
export async function notificarCambioEvento(evento, tipo) {
  try {
    const { data: marcas, error } = await supabaseAdmin
      .from("evento_notificacion")
      .select("id_perfil")
      .eq("id_evento", evento.id_evento)
      .is("desmarcado_en", null);
    if (error) throw error;
    if (marcas.length === 0) return 0;

    const textos = textosNotificacion(tipo, evento);
    const filas = marcas.map(({ id_perfil }) => ({
      id_perfil,
      tipo,
      id_evento: evento.id_evento,
      ...textos,
    }));

    const { error: errorInsert } = await supabaseAdmin.from("notificacion").insert(filas);
    if (errorInsert) throw errorInsert;
    return filas.length;
  } catch (error) {
    console.error(`notificar ${tipo}:`, error);
    return 0;
  }
}

// Confirmación inmediata para quien acaba de marcar un evento con "Avísame".
// momentos: los recordatorios que realmente quedan pendientes, ej. ["3 horas antes", "cuando comience"].
// Nunca lanza error: si falla, la marca del evento igual queda registrada.
export async function notificarMarcaEvento(evento, idPerfil, momentos) {
  try {
    const { error } = await supabaseAdmin.from("notificacion").insert({
      id_perfil: idPerfil,
      tipo: "evento_marcado",
      id_evento: evento.id_evento,
      ...textosNotificacion("evento_marcado", evento, { momentos }),
    });
    if (error) throw error;
  } catch (error) {
    console.error("notificar marca de evento:", error);
  }
}

let vueltaEnCurso = false;

// Arranca la revisión periódica de recordatorios. Se puede apagar con NOTIF_PLANIFICADOR=off en el .env.
export function iniciarPlanificador() {
  if (process.env.NOTIF_PLANIFICADOR === "off") {
    console.log("Planificador de recordatorios desactivado (NOTIF_PLANIFICADOR=off)");
    return;
  }

  async function vuelta() {
    if (vueltaEnCurso) return; // no se solapan dos vueltas
    vueltaEnCurso = true;
    try {
      const creadas = await procesarRecordatorios();
      if (creadas > 0) console.log(`Recordatorios: ${creadas} notificación(es) creada(s)`);
    } catch (error) {
      console.error("planificador de recordatorios:", error);
    } finally {
      vueltaEnCurso = false;
    }
  }

  vuelta(); // una pasada al arrancar
  setInterval(vuelta, INTERVALO_MS);
  console.log("Planificador de recordatorios activo (cada 60 s)");
}