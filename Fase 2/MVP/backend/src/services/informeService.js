import PDFDocument from "pdfkit";
import { supabaseAdmin } from "../config/supabase.js";
import { errorConStatus } from "./grupoService.js";
import { nombreCompleto } from "./adminService.js";

// ---------- Datos ----------

/**
 * Reúne todo lo que lleva el informe de una sanción escalada.
 * Los denunciantes NO se identifican: solo se cuenta cuántos reportes hubo y por qué motivos.
 */
export async function obtenerDatosInforme(idSancion) {
  const { data: sancion, error } = await supabaseAdmin
    .from("sancion")
    .select("id_sancion, tipo, creado_en, comentario_administrador, id_reporte, id_perfil_sancionado, id_perfil_admin")
    .eq("id_sancion", idSancion)
    .maybeSingle();
  if (error) throw errorConStatus("No se pudo obtener la sanción", 500);
  if (!sancion) throw errorConStatus("Sanción no encontrada", 404);
  if (sancion.tipo !== "escalado") {
    throw errorConStatus("Solo las sanciones escaladas tienen informe", 409);
  }

  const { data: personas, error: errorPersonas } = await supabaseAdmin
    .from("perfil")
    .select("id_perfil, nombres, primer_apellido, segundo_apellido, correo, semestre, creado_en, carrera:id_carrera(nombre)")
    .in("id_perfil", [sancion.id_perfil_sancionado, sancion.id_perfil_admin]);
  if (errorPersonas) throw errorConStatus("No se pudieron obtener los datos del infractor", 500);

  const infractor = personas.find((p) => p.id_perfil === sancion.id_perfil_sancionado);
  const admin = personas.find((p) => p.id_perfil === sancion.id_perfil_admin);
  if (!infractor) throw errorConStatus("No se encontró al infractor", 404);

  const { data: evidencia, error: errorEvidencia } = await supabaseAdmin
    .from("sancion_evidencia")
    .select("id_publicacion, id_comentario, nombre_autor_snapshot, contenido_snapshot, creado_en_original, orden")
    .eq("id_sancion", idSancion)
    .order("orden", { ascending: true });
  if (errorEvidencia) throw errorConStatus("No se pudo obtener la evidencia", 500);

  // Sanciones anteriores del mismo usuario (sin contar esta).
  const { count: sancionesPrevias, error: errorPrevias } = await supabaseAdmin
    .from("sancion")
    .select("id_sancion", { count: "exact", head: true })
    .eq("id_perfil_sancionado", sancion.id_perfil_sancionado)
    .neq("id_sancion", idSancion);
  if (errorPrevias) throw errorConStatus("No se pudieron contar las sanciones previas", 500);

  // Reportes sobre el contenido específico (solo cantidad y motivos).
  let reportes = { total: 0, motivos: [], primero: null };
  if (sancion.id_reporte) {
    const { data: principal } = await supabaseAdmin
      .from("reporte")
      .select("id_publicacion, id_comentario")
      .eq("id_reporte", sancion.id_reporte)
      .maybeSingle();

    if (principal) {
      const columna = esComentario ? "id_comentario" : "id_publicacion";
      const { data: filas, error: errorReportes } = await supabaseAdmin
        .from("reporte")
        .select("creado_en, motivo:id_motivo_reporte(nombre)")
        .eq(columna, principal[columna])
        .order("creado_en", { ascending: true });
      if (errorReportes) throw errorConStatus("No se pudieron obtener los reportes", 500);

      const porMotivo = new Map();
      for (const fila of filas) {
        const nombreMotivo = fila.motivo?.nombre ?? "Sin motivo";
        porMotivo.set(nombreMotivo, (porMotivo.get(nombreMotivo) ?? 0) + 1);
      }
      reportes = {
        total: filas.length,
        motivos: [...porMotivo.entries()].map(([motivo, cantidad]) => ({ motivo, cantidad })),
        primero: filas[0]?.creado_en ?? null,
      };
    }
  }

  // Grupo donde ocurrió (la evidencia de orden 0 siempre es una publicación).
  let grupo = null;
  const idPublicacion = evidencia.find((e) => e.id_publicacion)?.id_publicacion;
  if (idPublicacion) {
    const { data } = await supabaseAdmin
      .from("publicacion")
      .select("grupo:id_grupo(nombre)")
      .eq("id_publicacion", idPublicacion)
      .maybeSingle();
    grupo = data?.grupo?.nombre ?? null;
  }

  return {
    sancion,
    admin: admin ? nombreCompleto(admin) : "—",
    infractor: {
      nombre: nombreCompleto(infractor),
      correo: infractor.correo,
      carrera: infractor.carrera?.nombre ?? "Sin carrera registrada",
      semestre: infractor.semestre,
      registrado_en: infractor.creado_en,
      sanciones_previas: sancionesPrevias ?? 0,
    },
    evidencia,
    esComentario: evidencia.some((e) => e.id_comentario),
    reportes,
    grupo,
  };
}

// ---------- PDF ----------

const ZONA = "America/Santiago";
const MARGEN = 50;

export function formatearFechaHora(valor) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-CL", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// El PDF usa la fuente estándar Helvetica, que solo cubre caracteres latinos (tildes y ñ incluidas).
// Emojis y otros símbolos se reemplazan por una marca explícita en vez de salir como basura.
export function textoSeguro(texto) {
  return String(texto ?? "").replace(
    /[^\u0020-\u007E\u00A0-\u00FF\n\u2013\u2014\u2018\u2019\u201C\u201D\u2026\u20AC]+/g,
    "[símbolo]"
  );
}

function titulo(doc, texto) {
  doc.moveDown(0.8);
  if (doc.y > doc.page.height - 120) doc.addPage();
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text(texto);
  const y = doc.y + 2;
  doc.moveTo(MARGEN, y).lineTo(doc.page.width - MARGEN, y).lineWidth(0.5).strokeColor("#9ca3af").stroke();
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(10).fillColor("#111827");
}

function fila(doc, etiqueta, valor) {
  doc.font("Helvetica-Bold").text(`${etiqueta}: `, { continued: true });
  doc.font("Helvetica").text(textoSeguro(valor));
}

// Bloque de texto citado (contenido de un usuario), con barra lateral de color.
function cita(doc, { cabecera, texto, color }) {
  const ancho = doc.page.width - MARGEN * 2 - 14;
  doc.font("Helvetica-Bold").fontSize(9);
  const alturaCabecera = doc.heightOfString(textoSeguro(cabecera), { width: ancho });
  doc.font("Helvetica").fontSize(10);
  const alturaTexto = doc.heightOfString(textoSeguro(texto), { width: ancho });
  const alto = alturaCabecera + alturaTexto + 10;

  if (doc.y + alto > doc.page.height - 70) doc.addPage();

  const y = doc.y;
  doc.rect(MARGEN, y, 3, alto).fill(color);
  doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9).text(textoSeguro(cabecera), MARGEN + 12, y + 2, { width: ancho });
  doc.fillColor("#111827").font("Helvetica").fontSize(10).text(textoSeguro(texto), MARGEN + 12, doc.y + 2, { width: ancho });
  doc.x = MARGEN;
  doc.y = y + alto + 8;
}

/**
 * Construye el informe y devuelve el documento (un stream): quien lo llama lo conecta a la respuesta HTTP.
 * No se guarda en ningún lado; se genera cada vez que se pide.
 */
export function construirPdf(datos) {
  const doc = new PDFDocument({
    size: "A4",
    margin: MARGEN,
    bufferPages: true,
    info: {
      Title: "Informe de incidente - Connectboard",
      Author: "Connectboard",
      Subject: "Escalamiento a la institución",
    },
  });

  const { sancion, infractor, evidencia, reportes } = datos;

  // Encabezado
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text("Informe de incidente");
  doc.font("Helvetica").fontSize(11).fillColor("#4b5563").text("Connectboard · Escalamiento a la institución");
  doc.moveDown(0.6);
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#b91c1c")
    .text("DOCUMENTO CONFIDENCIAL: contiene datos personales. Uso exclusivo de la autoridad destinataria.");
  doc.fontSize(10).fillColor("#111827");

  titulo(doc, "1. Datos del caso");
  fila(doc, "N.º de caso", sancion.id_sancion);
  fila(doc, "Fecha de la resolución", formatearFechaHora(sancion.creado_en));
  fila(doc, "Resuelto por", datos.admin);
  fila(doc, "Informe generado el", formatearFechaHora(new Date()));

  titulo(doc, "2. Datos del infractor");
  fila(doc, "Nombre", infractor.nombre);
  fila(doc, "Correo institucional", infractor.correo);
  fila(doc, "Carrera", infractor.carrera);
  fila(doc, "Semestre", infractor.semestre ?? "No registrado");
  fila(doc, "Fecha de registro en la plataforma", formatearFechaHora(infractor.registrado_en));
  fila(doc, "Sanciones previas", String(infractor.sanciones_previas));

  titulo(doc, "3. Reportes recibidos sobre este contenido");
  if (reportes.total === 0) {
        doc.text("Sanción aplicada directamente por un administrador, sin reportes previos.");
  } else {
    fila(doc, "Cantidad de reportes", String(reportes.total));
    fila(doc, "Primer reporte", formatearFechaHora(reportes.primero));
    doc.font("Helvetica-Bold").text("Motivos:");
    doc.font("Helvetica");
    for (const m of reportes.motivos) doc.text(`   • ${textoSeguro(m.motivo)}: ${m.cantidad}`);
    doc.fontSize(8).fillColor("#6b7280").text("Por protección, no se identifica a quienes reportaron.").fillColor("#111827").fontSize(10);
  }

  titulo(doc, "4. Contenido sancionado y contexto");
  if (evidencia.length === 0) {
    doc.text("No hay evidencia registrada.");
  } else if (!datos.esComentario) {
    // Publicación: la evidencia (orden 0) es el contenido sancionado.
    const e = evidencia[0];
    cita(doc, {
      cabecera: `PUBLICACIÓN SANCIONADA${datos.grupo ? ` · Grupo: ${datos.grupo}` : ""} · ${e.nombre_autor_snapshot} · ${formatearFechaHora(e.creado_en_original)}`,
      texto: e.contenido_snapshot,
      color: "#dc2626",
    });
  } else {
    // Comentario: orden 0 es la publicación donde ocurre y luego el hilo, del más antiguo al sancionado.
    const publicacion = evidencia.find((e) => e.id_publicacion);
    const hilo = evidencia.filter((e) => e.id_comentario);
    if (publicacion) {
      cita(doc, {
        cabecera: `CONTEXTO · Publicación original${datos.grupo ? ` · Grupo: ${datos.grupo}` : ""} · ${publicacion.nombre_autor_snapshot} · ${formatearFechaHora(publicacion.creado_en_original)}`,
        texto: publicacion.contenido_snapshot,
        color: "#9ca3af",
      });
    }
    hilo.forEach((e, i) => {
      const sancionado = i === hilo.length - 1;
      cita(doc, {
        cabecera: `${sancionado ? "COMENTARIO SANCIONADO" : "CONTEXTO · Comentario anterior"} · ${e.nombre_autor_snapshot} · ${formatearFechaHora(e.creado_en_original)}`,
        texto: e.contenido_snapshot,
        color: sancionado ? "#dc2626" : "#9ca3af",
      });
    });
  }

  if (sancion.comentario_administrador) {
    titulo(doc, "5. Comentario del administrador");
    doc.text(textoSeguro(sancion.comentario_administrador));
  }

  titulo(doc, `${sancion.comentario_administrador ? "6" : "5"}. Medidas aplicadas en la plataforma`);
  doc.text("• Baneo permanente de la cuenta.");
  doc.text("• Contenido del usuario oculto para los demás usuarios.");
  doc.text("• Grupos creados por el usuario ocultos y retirada de su participación en otros grupos.");

  // Pie de página en todas las páginas (esto exige bufferPages: true).
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - 40;
    // Con el margen inferior por defecto, escribir bajo él abriría una página nueva: se anula un momento.
    const margenInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#6b7280")
      .text(`Confidencial · Caso ${sancion.id_sancion.slice(0, 8)} · Página ${i - start + 1} de ${count}`, MARGEN, y, {
        width: doc.page.width - MARGEN * 2,
        align: "center",
      });
    doc.page.margins.bottom = margenInferior;
  }

  doc.end();
  return doc;
}