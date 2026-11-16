import { Router } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { errorConStatus } from "../services/grupoService.js";
import { responderError, validarUuid } from "../services/feedService.js";
import { SELECT_PERSONA, errorDeRpc, nombreCompleto, validarSancionDirecta } from "../services/adminService.js";
import { obtenerUmbrales } from "../services/moderacionIA.js";

// Se monta dentro de /admin/moderacion: ya hereda requireAuth + requireRol("administrador") de admin.js.
export const adminModeracionRouter = Router();

const BUCKET = "publicaciones";
const URL_VIGENCIA_SEG = 3600;
const LIMITE_FILAS = 100;

// Categorías de omni-moderation-latest. Las de solo texto devuelven 0 al evaluar una imagen.
const CATEGORIAS = [
  { categoria: "harassment", imagenes: false },
  { categoria: "harassment/threatening", imagenes: false },
  { categoria: "hate", imagenes: false },
  { categoria: "hate/threatening", imagenes: false },
  { categoria: "illicit", imagenes: false },
  { categoria: "illicit/violent", imagenes: false },
  { categoria: "self-harm", imagenes: true },
  { categoria: "self-harm/intent", imagenes: true },
  { categoria: "self-harm/instructions", imagenes: true },
  { categoria: "sexual", imagenes: true },
  { categoria: "sexual/minors", imagenes: false },
  { categoria: "violence", imagenes: true },
  { categoria: "violence/graphic", imagenes: true },
];
const NOMBRES_CATEGORIAS = CATEGORIAS.map((c) => c.categoria);

function vistaPrevia(texto) {
  return texto.length > 140 ? `${texto.slice(0, 140)}…` : texto;
}

// GET /admin/moderacion?estado=pendiente|resueltas  ->  { items: [...] }
// Publicaciones y comentarios retenidos en una sola lista.
// Pendientes: el más antiguo primero (cola). Resueltas: el más reciente primero.
adminModeracionRouter.get("/", async (req, res) => {
  try {
    const estado = req.query.estado ?? "pendiente";
    if (!["pendiente", "resueltas"].includes(estado)) {
      throw errorConStatus("estado debe ser pendiente o resueltas", 400);
    }
    const pendientes = estado === "pendiente";

    let consulta = supabaseAdmin
      .from("moderacion_resultado")
      .select(
        `id_publicacion, id_comentario, motivo, categorias_marcadas, creado_en, decision, revisado_en,
         publicacion:id_publicacion(id_publicacion, contenido, estado, grupo:id_grupo(id_grupo, nombre), autor:id_perfil_autor(${SELECT_PERSONA}), publicacion_imagen(count)),
         comentario:id_comentario(id_comentario, contenido, estado, autor:id_perfil_autor(${SELECT_PERSONA}), publicacion:id_publicacion(id_publicacion, grupo:id_grupo(id_grupo, nombre)))`
      );
    consulta = pendientes ? consulta.is("decision", null) : consulta.not("decision", "is", null);

    const { data, error } = await consulta
      .order(pendientes ? "creado_en" : "revisado_en", { ascending: pendientes })
      .limit(LIMITE_FILAS);
    if (error) {
      console.error("admin/moderacion listar:", error);
      throw errorConStatus("No se pudo obtener la cola de revisión", 500);
    }

    const items = data.map((fila) => {
      const esComentario = fila.id_comentario !== null;
      const objetivo = esComentario ? fila.comentario : fila.publicacion;
      return {
        tipo_objetivo: esComentario ? "comentario" : "publicacion",
        id_objetivo: fila.id_comentario ?? fila.id_publicacion,
        motivo: fila.motivo,
        categorias_marcadas: fila.categorias_marcadas,
        creado_en: fila.creado_en,
        decision: fila.decision,
        revisado_en: fila.revisado_en,
        vista_previa: vistaPrevia(objetivo.contenido),
        cantidad_imagenes: esComentario ? 0 : objetivo.publicacion_imagen?.[0]?.count ?? 0,
        grupo: esComentario ? objetivo.publicacion?.grupo : objetivo.grupo,
        autor: { ...objetivo.autor, nombre_completo: nombreCompleto(objetivo.autor) },
      };
    });

    res.json({ items });
  } catch (error) {
    responderError(res, error);
  }
});

// GET /admin/moderacion/umbrales  ->  { umbrales: [{ categoria, umbral, aplica_a_imagenes }] }
// (va antes de "/:id" para que Express no lo confunda con un id)
adminModeracionRouter.get("/umbrales", async (req, res) => {
  try {
    const umbrales = await obtenerUmbrales();
    res.json({
      umbrales: CATEGORIAS.map(({ categoria, imagenes }) => ({
        categoria,
        umbral: umbrales[categoria] ?? null,
        aplica_a_imagenes: imagenes,
      })),
    });
  } catch (error) {
    console.error("admin/moderacion umbrales:", error);
    responderError(res, errorConStatus("No se pudieron obtener los umbrales", 500));
  }
});

// PUT /admin/moderacion/umbrales { umbrales: { "harassment": 0.85, ... } }
// Solo se envían las categorías que cambian. Cada valor va entre 0 y 1 (con 2 decimales).
adminModeracionRouter.put("/umbrales", async (req, res) => {
  try {
    const { umbrales } = req.body ?? {};
    if (!umbrales || typeof umbrales !== "object" || Array.isArray(umbrales) || Object.keys(umbrales).length === 0) {
      throw errorConStatus("umbrales debe ser un objeto { categoria: valor }", 400);
    }

    const filas = Object.entries(umbrales).map(([categoria, valor]) => {
      if (!NOMBRES_CATEGORIAS.includes(categoria)) {
        throw errorConStatus(`Categoría desconocida: ${categoria}`, 400);
      }
      if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0 || valor > 1) {
        throw errorConStatus(`El umbral de ${categoria} debe ser un número entre 0 y 1`, 400);
      }
      return {
        id_categoria_moderacion: categoria,
        umbral: Math.round(valor * 100) / 100,
        actualizado_por: req.usuario.id_perfil, // siempre el de la sesión
        actualizado_en: new Date().toISOString(),
      };
    });

    // Un solo upsert: o se guardan todos o ninguno.
    const { error } = await supabaseAdmin
      .from("moderacion_umbral")
      .upsert(filas, { onConflict: "id_categoria_moderacion" });
    if (error) {
      console.error("admin/moderacion guardar umbrales:", error);
      throw errorConStatus("No se pudieron guardar los umbrales", 500);
    }

    console.log(`moderación: admin ${req.usuario.id_perfil} cambió umbrales:`, Object.fromEntries(filas.map((f) => [f.id_categoria_moderacion, f.umbral])));

    const actuales = await obtenerUmbrales();
    res.json({ umbrales: actuales });
  } catch (error) {
    responderError(res, error);
  }
});

// Cuántas sanciones tiene el autor (para mostrarlas junto a su nombre).
async function contarSancionesPrevias(idPerfil) {
  const { count } = await supabaseAdmin
    .from("sancion")
    .select("id_sancion", { count: "exact", head: true })
    .eq("id_perfil_sancionado", idPerfil);
  return count ?? 0;
}

// GET /admin/moderacion/comentarios/:id — detalle de un comentario retenido, con su contexto.
adminModeracionRouter.get("/comentarios/:id", async (req, res) => {
  try {
    validarUuid(req.params.id, "Comentario no encontrado");

    const { data: revision, error } = await supabaseAdmin
      .from("moderacion_resultado")
      .select("id_comentario, puntajes, categorias_marcadas, motivo, creado_en, decision, revisado_en")
      .eq("id_comentario", req.params.id)
      .maybeSingle();
    if (error) throw errorConStatus("No se pudo obtener la revisión", 500);
    if (!revision) throw errorConStatus("Comentario no encontrado", 404);

    const { data: comentario, error: errorComentario } = await supabaseAdmin
      .from("comentario")
      .select(
        `id_comentario, id_comentario_padre, contenido, estado, creado_en, autor:id_perfil_autor(${SELECT_PERSONA}),
         publicacion:id_publicacion(id_publicacion, contenido, grupo:id_grupo(id_grupo, nombre), autor:id_perfil_autor(${SELECT_PERSONA}))`
      )
      .eq("id_comentario", req.params.id)
      .maybeSingle();
    if (errorComentario || !comentario) throw errorConStatus("No se pudo obtener el comentario", 500);

    // Si es una respuesta, también el comentario al que responde.
    let padre = null;
    if (comentario.id_comentario_padre) {
      const { data } = await supabaseAdmin
        .from("comentario")
        .select(`id_comentario, contenido, estado, autor:id_perfil_autor(${SELECT_PERSONA})`)
        .eq("id_comentario", comentario.id_comentario_padre)
        .maybeSingle();
      padre = data;
    }

    const [sancionesPrevias, umbrales] = await Promise.all([
      contarSancionesPrevias(comentario.autor.id_perfil),
      obtenerUmbrales(),
    ]);

    const { autor, publicacion, ...resto } = comentario;
    res.json({
      revision,
      comentario: resto,
      contexto: { publicacion, padre },
      autor: { ...autor, nombre_completo: nombreCompleto(autor), sanciones_previas: sancionesPrevias },
      imagenes: [],
      umbrales,
    });
  } catch (error) {
    responderError(res, error);
  }
});

// GET /admin/moderacion/:id — detalle de una publicación retenida.
adminModeracionRouter.get("/:id", async (req, res) => {
  try {
    validarUuid(req.params.id, "Publicación no encontrada");

    const { data: revision, error } = await supabaseAdmin
      .from("moderacion_resultado")
      .select("id_publicacion, puntajes, categorias_marcadas, motivo, creado_en, decision, revisado_en")
      .eq("id_publicacion", req.params.id)
      .maybeSingle();
    if (error) throw errorConStatus("No se pudo obtener la revisión", 500);
    if (!revision) throw errorConStatus("Publicación no encontrada", 404);

    const [{ data: publicacion, error: errorPub }, { data: imagenes, error: errorImg }] = await Promise.all([
      supabaseAdmin
        .from("publicacion")
        .select(`id_publicacion, contenido, estado, creado_en, grupo:id_grupo(id_grupo, nombre), autor:id_perfil_autor(${SELECT_PERSONA})`)
        .eq("id_publicacion", req.params.id)
        .maybeSingle(),
      supabaseAdmin
        .from("publicacion_imagen")
        .select("imagen_url, orden, estado_moderacion")
        .eq("id_publicacion", req.params.id)
        .order("orden", { ascending: true }),
    ]);
    if (errorPub || errorImg || !publicacion) throw errorConStatus("No se pudo obtener la publicación", 500);

    // URLs firmadas de TODAS las imágenes (también las pendientes). Si la firma falla, el panel
    // sigue funcionando sin imágenes y el error queda en el log.
    let imagenesConUrl = [];
    if (imagenes.length > 0) {
      const { data: firmadas, error: errorFirma } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrls(imagenes.map((i) => i.imagen_url), URL_VIGENCIA_SEG);
      if (errorFirma) console.error("admin/moderacion firma:", errorFirma);
      const urls = new Map((firmadas ?? []).filter((f) => f.signedUrl).map((f) => [f.path, f.signedUrl]));
      imagenesConUrl = imagenes.map((i) => ({
        orden: i.orden,
        estado_moderacion: i.estado_moderacion,
        url: urls.get(i.imagen_url) ?? null,
      }));
    }

    const [sancionesPrevias, umbrales] = await Promise.all([
      contarSancionesPrevias(publicacion.autor.id_perfil),
      obtenerUmbrales(),
    ]);

    res.json({
      revision,
      publicacion: { ...publicacion, autor: undefined },
      autor: { ...publicacion.autor, nombre_completo: nombreCompleto(publicacion.autor), sanciones_previas: sancionesPrevias },
      imagenes: imagenesConUrl,
      umbrales, // para que el panel muestre cada puntaje junto a su umbral actual
    });
  } catch (error) {
    responderError(res, error);
  }
});

// Handler común de las decisiones (publicación o comentario).
//   { decision: "aprobada" | "rechazada" | "sancionada",
//     tipo_sancion?: "temporal" | "baneo" | "escalar",   // obligatorio con "sancionada"
//     dias?: 1..365, comentario?: string (<= 500) }
// Todo ocurre dentro de una función de Postgres (atómica).
function rutaDecision({ funcion, parametroId, noEncontrado }) {
  return async (req, res) => {
    try {
      validarUuid(req.params.id, noEncontrado);

      const { decision } = req.body ?? {};
      if (!["aprobada", "rechazada", "sancionada"].includes(decision)) {
        throw errorConStatus("decision debe ser aprobada, rechazada o sancionada", 400);
      }

      // Para sancionar se reutiliza la validación de la sanción directa (el id solo sirve para
      // cumplir su regla de "exactamente un contenido"); si no, no hay nada más que validar.
      let sancion = { p_tipo_sancion: null, p_dias: null, p_comentario: null };
      if (decision === "sancionada") {
        const { p_tipo_sancion, p_dias, p_comentario } = validarSancionDirecta({
          id_publicacion: req.params.id,
          tipo_sancion: req.body.tipo_sancion,
          dias: req.body.dias,
          comentario: req.body.comentario,
        });
        sancion = { p_tipo_sancion, p_dias, p_comentario };
      }

      const { data, error } = await supabaseAdmin.rpc(funcion, {
        p_id_admin: req.usuario.id_perfil, // siempre el de la sesión, nunca del body
        [parametroId]: req.params.id,
        p_decision: decision,
        ...sancion,
      });
      if (error) throw errorDeRpc(error, "No se pudo registrar la decisión");

      res.json(data);
    } catch (error) {
      responderError(res, error);
    }
  };
}

// POST /admin/moderacion/comentarios/:id/decision
adminModeracionRouter.post(
  "/comentarios/:id/decision",
  rutaDecision({ funcion: "fn_revisar_comentario", parametroId: "p_id_comentario", noEncontrado: "Comentario no encontrado" })
);

// POST /admin/moderacion/:id/decision  (publicación)
adminModeracionRouter.post(
  "/:id/decision",
  rutaDecision({ funcion: "fn_revisar_publicacion", parametroId: "p_id_publicacion", noEncontrado: "Publicación no encontrada" })
);