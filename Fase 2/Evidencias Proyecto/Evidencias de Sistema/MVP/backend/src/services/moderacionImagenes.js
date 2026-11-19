import { moderarImagenIA } from "./moderacionIA.js";

// PUNTO DE EXTENSIÓN del filtro de imágenes (contrato original de imagenesService.js):
// recibe { buffer, mimetype } y devuelve { resultado: "aprobada" | "rechazada" | "pendiente", motivo, proveedor }.
// Ahora nunca devuelve "rechazada": lo sospechoso queda "pendiente" y lo decide un administrador.
// Se agrega `puntajes` (los usa la cola de revisión; el resto del código lo ignora).
export async function moderarImagen({ buffer, mimetype }) {
  const r = await moderarImagenIA({ buffer, mimetype });

  let motivo = null;
  if (r.motivo === "umbral") motivo = `Categorías sobre el umbral: ${r.categorias.join(", ")}`;
  if (r.motivo === "error_api") motivo = "La API de moderación no respondió";

  return {
    resultado: r.resultado,
    motivo,
    proveedor: "openai-omni-moderation",
    puntajes: r.puntajes,
    categorias: r.categorias,
    causa: r.motivo, // "umbral" | "error_api" | null: lo usa la cola de revisión
  };
}