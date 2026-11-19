import { supabaseAdmin } from "../config/supabase.js";

const URL_API = "https://api.openai.com/v1/moderations";
const MODELO = "omni-moderation-latest";
const TIMEOUT_MS = 10_000;

// { "harassment": 0.8, "sexual/minors": 0.3, ... } con lo que hay en moderacion_umbral.
export async function obtenerUmbrales() {
  const { data, error } = await supabaseAdmin
    .from("moderacion_umbral")
    .select("id_categoria_moderacion, umbral");
  if (error) throw new Error("No se pudieron leer los umbrales");
  return Object.fromEntries(data.map((f) => [f.id_categoria_moderacion, Number(f.umbral)]));
}

// Llama a la API y devuelve { categoria: puntaje }. Si la respuesta trae varios resultados,
// se queda con el puntaje MÁS ALTO de cada categoría.
async function pedirPuntajes(input) {
  const clave = process.env.OPENAI_API_KEY;
  if (!clave) throw new Error("Falta OPENAI_API_KEY en el .env");

  const respuesta = await fetch(URL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${clave}` },
    body: JSON.stringify({ model: MODELO, input }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!respuesta.ok) throw new Error(`OpenAI respondió HTTP ${respuesta.status}`);

  const data = await respuesta.json();
  const puntajes = {};
  for (const resultado of data.results ?? []) {
    for (const [categoria, puntaje] of Object.entries(resultado.category_scores ?? {})) {
      puntajes[categoria] = Math.max(puntajes[categoria] ?? 0, puntaje);
    }
  }
  return puntajes;
}

// Categorías cuyo puntaje alcanza o supera el umbral configurado.
function categoriasSobreUmbral(puntajes, umbrales) {
  return Object.entries(umbrales)
    .filter(([categoria, umbral]) => (puntajes[categoria] ?? 0) >= umbral)
    .map(([categoria]) => categoria);
}

// Devuelve { resultado: "aprobada" | "pendiente", motivo: "umbral" | "error_api" | null, categorias, puntajes }.
// Cualquier fallo (sin clave, sin red, timeout, error de la API) deja el contenido PENDIENTE:
// nada se publica sin haber pasado el filtro.
async function evaluar(input) {
  try {
    const [puntajes, umbrales] = await Promise.all([pedirPuntajes(input), obtenerUmbrales()]);
    const categorias = categoriasSobreUmbral(puntajes, umbrales);
    if (categorias.length > 0) return { resultado: "pendiente", motivo: "umbral", categorias, puntajes };
    return { resultado: "aprobada", motivo: null, categorias: [], puntajes };
  } catch (error) {
    console.error("moderación IA:", error.message);
    return { resultado: "pendiente", motivo: "error_api", categorias: [], puntajes: null };
  }
}

export function moderarTexto(texto) {
  return evaluar([{ type: "text", text: texto }]);
}

export function moderarImagenIA({ buffer, mimetype }) {
  const url = `data:${mimetype};base64,${buffer.toString("base64")}`;
  return evaluar([{ type: "image_url", image_url: { url } }]);
}