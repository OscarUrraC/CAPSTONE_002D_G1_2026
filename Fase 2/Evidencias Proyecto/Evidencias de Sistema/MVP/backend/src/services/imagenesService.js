import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../config/supabase.js";
import { errorConStatus } from "./grupoService.js";
import { moderarImagen } from "./moderacionImagenes.js";

const BUCKET = "publicaciones";
const EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const URL_VIGENCIA_SEG = 3600;

// No se confía en el mimetype que envía el cliente: se mira la firma del archivo.
function detectarTipo(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

// Valida y modera TODAS las imágenes antes de subir nada; luego las sube a Storage.
// Devuelve [{ ruta, orden, moderacion }] para registrar en publicacion_imagen.
export async function procesarImagenes(archivos, idGrupo) {
  const aceptadas = [];
  for (const archivo of archivos) {
    const mimetype = detectarTipo(archivo.buffer);
    if (!mimetype) throw errorConStatus("Solo se admiten imágenes JPG, PNG o WebP", 400);

    const moderacion = await moderarImagen({ buffer: archivo.buffer, mimetype });
    if (moderacion.resultado === "rechazada") {
      throw errorConStatus("Una de las imágenes no cumple las normas de la comunidad", 422);
    }
    aceptadas.push({ archivo, mimetype, moderacion });
  }

  const subidas = [];
  try {
    for (const [orden, { archivo, mimetype, moderacion }] of aceptadas.entries()) {
      const ruta = `${idGrupo}/${randomUUID()}.${EXTENSION[mimetype]}`;
      const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(ruta, archivo.buffer, { contentType: mimetype });
      if (error) throw errorConStatus("No se pudo guardar la imagen", 500);
      subidas.push({ ruta, orden, moderacion });
    }
  } catch (e) {
    await descartarSubidas(subidas);
    throw e;
  }
  return subidas;
}

// Limpia archivos huérfanos si falla el alta del post (son archivos, no datos de negocio).
export async function descartarSubidas(subidas) {
  if (subidas.length === 0) return;
  await supabaseAdmin.storage.from(BUCKET).remove(subidas.map((s) => s.ruta));
}

export async function registrarImagenes(idPublicacion, subidas) {
  if (subidas.length === 0) return;
  const filas = subidas.map(({ ruta, orden, moderacion }) => ({
    id_publicacion: idPublicacion,
    imagen_url: ruta,
    orden,
    estado_moderacion: moderacion.resultado,
    motivo_moderacion: moderacion.motivo ?? null,
    proveedor_moderacion: moderacion.proveedor ?? null,
    moderado_en: new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin.from("publicacion_imagen").insert(filas);
  if (error) throw errorConStatus("No se pudieron registrar las imágenes", 500);
}

// Agrega `imagenes: [{ url, orden }]` a cada publicación (solo las aprobadas, con URL firmada).
// 2 consultas en total, sin importar cuántas publicaciones haya. Si Storage o la consulta fallan,
// el feed NO se cae: las publicaciones salen sin imágenes y el error queda en el log.
export async function adjuntarImagenes(publicaciones) {
  if (publicaciones.length === 0) return publicaciones;
  const sinImagenes = () => publicaciones.map((p) => ({ ...p, imagenes: [] }));

  const { data, error } = await supabaseAdmin
    .from("publicacion_imagen")
    .select("id_publicacion, imagen_url, orden")
    .in("id_publicacion", publicaciones.map((p) => p.id_publicacion))
    .eq("estado_moderacion", "aprobada")
    .order("orden", { ascending: true });

  if (error) {
    console.error("adjuntarImagenes:", error);
    return sinImagenes();
  }
  if (data.length === 0) return sinImagenes();

  const { data: firmadas, error: errorFirma } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrls(data.map((i) => i.imagen_url), URL_VIGENCIA_SEG);

  if (errorFirma) {
    console.error("adjuntarImagenes (firma):", errorFirma);
    return sinImagenes();
  }

  const urls = new Map();
  for (const f of firmadas ?? []) if (f.signedUrl) urls.set(f.path, f.signedUrl);

  const porPublicacion = new Map();
  for (const i of data) {
    const url = urls.get(i.imagen_url);
    if (!url) continue;
    if (!porPublicacion.has(i.id_publicacion)) porPublicacion.set(i.id_publicacion, []);
    porPublicacion.get(i.id_publicacion).push({ url, orden: i.orden });
  }

  return publicaciones.map((p) => ({ ...p, imagenes: porPublicacion.get(p.id_publicacion) ?? [] }));
}