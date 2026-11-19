import { errorConStatus } from "./grupoService.js";

// Persona tal como la ve un administrador: identidad real (nombre y correo), no el apodo.
export const SELECT_PERSONA = [
  "id_perfil",
  "nombres",
  "primer_apellido",
  "segundo_apellido",
  "apodo",
  "correo",
  "estado_cuenta",
  "sancion_hasta",
].join(", ");

// Un reporte con el contenido reportado y su autor.
export const SELECT_REPORTE = [
  "id_reporte, estado, detalle, creado_en, resuelto_en, id_publicacion, id_comentario, id_grupo",
  "motivo:id_motivo_reporte(nombre)",
  `publicacion:id_publicacion(id_publicacion, contenido, estado, creado_en, grupo:id_grupo(id_grupo, nombre), autor:id_perfil_autor(${SELECT_PERSONA}))`,
  `comentario:id_comentario(id_comentario, contenido, estado, creado_en, autor:id_perfil_autor(${SELECT_PERSONA}))`,
  `grupo:id_grupo(id_grupo, nombre, descripcion, estado, creador:id_perfil_creador(${SELECT_PERSONA}))`,
].join(", ");

export function nombreCompleto(persona) {
  if (!persona) return null;
  return [persona.nombres, persona.primer_apellido, persona.segundo_apellido].filter(Boolean).join(" ");
}

export function tipoObjetivo(fila) {
  if (fila.id_publicacion) return "publicacion";
  if (fila.id_comentario) return "comentario";
  return "grupo";
}

// Autor del contenido reportado (para un grupo, su creador).
export function autorDelObjetivo(fila) {
  const tipo = tipoObjetivo(fila);
  const objeto = fila[tipo];
  return tipo === "grupo" ? objeto?.creador : objeto?.autor;
}

function personaParaAdmin(persona) {
  if (!persona) return null;
  return { ...persona, nombre_completo: nombreCompleto(persona) };
}

/**
 * Agrupa filas de reporte por contenido reportado: varios estudiantes que reportan lo mismo
 * son UN solo caso para el administrador. Las filas deben venir de más antigua a más nueva.
 */
export function agruparReportes(filas, { pendientes = true } = {}) {
  const casos = new Map();

  for (const fila of filas) {
    const tipo = tipoObjetivo(fila);
    const idObjetivo = fila.id_publicacion ?? fila.id_comentario ?? fila.id_grupo;
    const clave = `${tipo}:${idObjetivo}`;

    let caso = casos.get(clave);
    if (!caso) {
      const objeto = fila[tipo];
      const texto = tipo === "grupo" ? objeto?.nombre : objeto?.contenido;
      caso = {
        tipo_objetivo: tipo,
        id_objetivo: idObjetivo,
        estado_objetivo: objeto?.estado ?? null,
        vista_previa: texto ? (texto.length > 140 ? `${texto.slice(0, 140)}…` : texto) : null,
        autor: personaParaAdmin(autorDelObjetivo(fila)),
        reportes: [],
      };
      casos.set(clave, caso);
    }

    caso.reportes.push({
      id_reporte: fila.id_reporte,
      estado: fila.estado,
      motivo: fila.motivo?.nombre ?? null,
      detalle: fila.detalle,
      creado_en: fila.creado_en,
      resuelto_en: fila.resuelto_en,
    });
  }

    // El orden de las filas depende del listado; "reportes[0]" siempre debe ser el más antiguo.
  for (const caso of casos.values()) {
    caso.reportes.sort((a, b) => a.creado_en.localeCompare(b.creado_en));
  }

  const resultado = [...casos.values()].map((caso) => ({
    ...caso,
    cantidad_reportes: caso.reportes.length,
    // El más antiguo: con él se resuelve el caso (la función resuelve todos los del mismo contenido).
    id_reporte_principal: caso.reportes[0].id_reporte,
    primer_reporte: caso.reportes[0].creado_en,
    ultimo_resuelto: caso.reportes.reduce((max, r) => (r.resuelto_en && r.resuelto_en > (max ?? "") ? r.resuelto_en : max), null),
  }));

  resultado.sort((a, b) =>
    pendientes
      ? b.cantidad_reportes - a.cantidad_reportes || a.primer_reporte.localeCompare(b.primer_reporte)
      : (b.ultimo_resuelto ?? "").localeCompare(a.ultimo_resuelto ?? "")
  );
  return resultado;
}

// Validación de lo que llega del cliente. La función de Postgres valida de nuevo (rangos y reglas).
export function validarResolucion(body) {
  const { resolucion, tipo_sancion, dias, comentario } = body ?? {};

  if (!["sin_infraccion", "infraccion", "escalar"].includes(resolucion)) {
    throw errorConStatus("resolucion debe ser sin_infraccion, infraccion o escalar", 400);
  }
  if (tipo_sancion != null && !["temporal", "baneo"].includes(tipo_sancion)) {
    throw errorConStatus("tipo_sancion debe ser temporal o baneo", 400);
  }

  let diasNumero = null;
  if (dias != null) {
    diasNumero = Number(dias);
    if (!Number.isInteger(diasNumero)) throw errorConStatus("dias debe ser un número entero", 400);
  }

  if (comentario != null && typeof comentario !== "string") {
    throw errorConStatus("comentario debe ser texto", 400);
  }
  const comentarioLimpio = comentario?.trim() ?? "";
  if (comentarioLimpio.length > 500) {
    throw errorConStatus("comentario admite hasta 500 caracteres", 400);
  }

  return {
    p_resolucion: resolucion,
    p_tipo_sancion: tipo_sancion ?? null,
    p_dias: diasNumero,
    p_comentario: comentarioLimpio === "" ? null : comentarioLimpio,
  };
}

// Validación de una sanción directa (sin reporte previo): sobre una publicación o un comentario.
export function validarSancionDirecta(body) {
  const { id_publicacion, id_comentario, tipo_sancion, dias, comentario } = body ?? {};

  if ([id_publicacion, id_comentario].filter(Boolean).length !== 1) {
    throw errorConStatus("Indica exactamente una publicación o un comentario", 400);
  }
  if (!["temporal", "baneo", "escalar"].includes(tipo_sancion)) {
    throw errorConStatus("tipo_sancion debe ser temporal, baneo o escalar", 400);
  }

  let diasNumero = null;
  if (dias != null) {
    diasNumero = Number(dias);
    if (!Number.isInteger(diasNumero)) throw errorConStatus("dias debe ser un número entero", 400);
  }

  if (comentario != null && typeof comentario !== "string") {
    throw errorConStatus("comentario debe ser texto", 400);
  }
  const comentarioLimpio = comentario?.trim() ?? "";
  if (comentarioLimpio.length > 500) {
    throw errorConStatus("comentario admite hasta 500 caracteres", 400);
  }

  return {
    p_id_publicacion: id_publicacion ?? null,
    p_id_comentario: id_comentario ?? null,
    p_tipo_sancion: tipo_sancion,
    p_dias: diasNumero,
    p_comentario: comentarioLimpio === "" ? null : comentarioLimpio,
  };
}

// Traduce los errores que lanza fn_resolver_reporte (códigos SQLSTATE) a respuestas HTTP.
const STATUS_POR_CODIGO = { 22023: 400, 42501: 403, P0002: 404, P0001: 409 };

export function errorDeRpc(error, mensajePorDefecto) {
  const status = STATUS_POR_CODIGO[error?.code];
  if (status) return errorConStatus(error.message, status);
  console.error("rpc:", error);
  return errorConStatus(mensajePorDefecto, 500);
}