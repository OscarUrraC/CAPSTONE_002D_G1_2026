import { supabaseAdmin } from "../config/supabase.js";

const URL_EXPO = "https://exp.host/--/api/v2/push/send";
const TAMANO_LOTE = 100; // máximo que acepta Expo por petición
// Igual que la tolerancia de los recordatorios: un aviso con más de 30 min ya no sirve como push.
const MAX_ANTIGUEDAD_MS = 30 * 60 * 1000;
// Confirmación de quien acaba de tocar "Avísame": ya está mirando la app.
const TIPOS_SIN_PUSH = ["evento_marcado"];

// Devuelve las notificaciones a "no enviadas" para reintentar en la próxima vuelta.
async function liberarReclamadas(ids) {
  if (ids.length === 0) return;
  const { error } = await supabaseAdmin
    .from("notificacion")
    .update({ push_enviado_en: null })
    .in("id_notificacion", ids);
  if (error) console.error("push: no se pudieron liberar las notificaciones:", error);
}

// Envía como push las notificaciones que aún no se enviaron. Nunca lanza. Devuelve cuántas reclamó.
export async function enviarPushPendientes() {
  try {
    const desde = new Date(Date.now() - MAX_ANTIGUEDAD_MS).toISOString();

       // 1) Solo se reclaman los avisos de quienes tienen algún celular registrado: si no, el aviso
    //    se consumiría sin enviarse. Los demás quedan pendientes hasta que venza la antigüedad máxima.
    const { data: conDispositivo, error: errorIds } = await supabaseAdmin
      .from("dispositivo")
      .select("id_perfil");
    if (errorIds) {
      console.error("push: no se pudieron listar los dispositivos:", errorIds);
      return 0;
    }
    const perfilesConToken = [...new Set(conDispositivo.map((d) => d.id_perfil))];
    if (perfilesConToken.length === 0) return 0;

    // El update es atómico: dos procesos no mandan el mismo aviso dos veces.
    const { data: reclamadas, error } = await supabaseAdmin
      .from("notificacion")
      .update({ push_enviado_en: new Date().toISOString() })
      .is("push_enviado_en", null)
      .gte("creado_en", desde)
      .in("id_perfil", perfilesConToken)
      .not("tipo", "in", `(${TIPOS_SIN_PUSH.join(",")})`)
      .select("id_notificacion, id_perfil, tipo, titulo, cuerpo, id_evento");
    if (error) {
      console.error("push: no se pudieron reclamar las notificaciones:", error);
      return 0;
    }
    if (!reclamadas || reclamadas.length === 0) return 0;

    // 2) Todos los celulares de cada destinatario (puede tener más de uno).
    const idsPerfil = [...new Set(reclamadas.map((n) => n.id_perfil))];
    const { data: dispositivos, error: errorDisp } = await supabaseAdmin
      .from("dispositivo")
      .select("id_perfil, push_token")
      .in("id_perfil", idsPerfil);
    if (errorDisp) {
      console.error("push: no se pudieron obtener los dispositivos:", errorDisp);
      await liberarReclamadas(reclamadas.map((n) => n.id_notificacion));
      return 0;
    }

    // 3) Un mensaje por (notificación, dispositivo).
    const mensajes = [];
    for (const n of reclamadas) {
      for (const d of dispositivos.filter((x) => x.id_perfil === n.id_perfil)) {
        mensajes.push({
          idNotificacion: n.id_notificacion,
          cuerpoExpo: {
            to: d.push_token,
            title: n.titulo,
            body: n.cuerpo,
            channelId: "default", // el canal que crea la app
            sound: "default",
            data: { id_notificacion: n.id_notificacion, tipo: n.tipo, id_evento: n.id_evento },
          },
        });
      }
    }

    // 4) Envío por lotes de 100.
    const tokensMuertos = new Set();
    for (let i = 0; i < mensajes.length; i += TAMANO_LOTE) {
      const lote = mensajes.slice(i, i + TAMANO_LOTE);
      try {
        const respuesta = await fetch(URL_EXPO, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(lote.map((m) => m.cuerpoExpo)),
        });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

        const { data: tickets } = await respuesta.json();
        // Expo responde un ticket por mensaje, en el mismo orden.
        tickets.forEach((ticket, j) => {
          if (ticket.status !== "error") return;
          if (ticket.details?.error === "DeviceNotRegistered") {
            tokensMuertos.add(lote[j].cuerpoExpo.to);
          } else {
            console.error("push: Expo rechazó un mensaje:", ticket.message, ticket.details);
          }
        });
      } catch (e) {
        // Fallo de red o de Expo: se libera lo de este lote para reintentar.
        console.error("push: falló el envío de un lote:", e.message);
        await liberarReclamadas([...new Set(lote.map((m) => m.idNotificacion))]);
      }
    }

    // 5) Un token que Expo declara muerto (app desinstalada) se borra; cualquier otro error no.
    if (tokensMuertos.size > 0) {
      const { error: errorBorrar } = await supabaseAdmin
        .from("dispositivo")
        .delete()
        .in("push_token", [...tokensMuertos]);
      if (errorBorrar) console.error("push: no se pudieron borrar tokens muertos:", errorBorrar);
    }

    return reclamadas.length;
  } catch (error) {
    console.error("push: error inesperado:", error);
    return 0;
  }
}