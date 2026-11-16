import { Router } from "express";
import { requireAuth, requireRol } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { errorConStatus } from "../services/grupoService.js";
import { responderError, validarUuid } from "../services/feedService.js";
import { SELECT_PERSONA, SELECT_REPORTE, agruparReportes, autorDelObjetivo, errorDeRpc, nombreCompleto, tipoObjetivo, validarResolucion, validarSancionDirecta } from "../services/adminService.js";
import { construirPdf, obtenerDatosInforme } from "../services/informeService.js";
import { adminModeracionRouter } from "./adminModeracion.js";

export const adminRouter = Router();

// Todo /admin exige sesión válida y rol de administrador (el rol sale de la BD, no del token).
adminRouter.use(requireAuth, requireRol("administrador"));
adminRouter.use("/moderacion", adminModeracionRouter);

const LIMITE_FILAS = 300;

// GET /admin/reportes?estado=pendiente|resueltos
adminRouter.get("/reportes", async (req, res) => {
  try {
    const estado = req.query.estado ?? "pendiente";
    if (!["pendiente", "resueltos"].includes(estado)) {
      throw errorConStatus("estado debe ser pendiente o resueltos", 400);
    }
    const pendientes = estado === "pendiente";

    let consulta = supabaseAdmin.from("reporte").select(SELECT_REPORTE);
    consulta = pendientes ? consulta.eq("estado", "pendiente") : consulta.neq("estado", "pendiente");

    const { data, error } = await consulta.order("creado_en", { ascending: true }).limit(LIMITE_FILAS);
    if (error) {
      console.error("admin/listar reportes:", error);
      throw errorConStatus("No se pudieron obtener los reportes", 500);
    }

    res.json({ casos: agruparReportes(data, { pendientes }) });
  } catch (error) {
    responderError(res, error);
  }
});

// Hilo de un comentario, de la raíz al comentario reportado (hay a lo más 3 niveles).
async function obtenerHilo(idComentario) {
  const hilo = [];
  let actual = idComentario;
  for (let i = 0; i < 4 && actual; i++) {
    const { data, error } = await supabaseAdmin
      .from("comentario")
      .select(`id_comentario, id_comentario_padre, id_publicacion, contenido, estado, creado_en, autor:id_perfil_autor(${SELECT_PERSONA})`)
      .eq("id_comentario", actual)
      .maybeSingle();
    if (error) throw errorConStatus("No se pudo obtener el hilo", 500);
    if (!data) break;
    hilo.unshift(data);
    actual = data.id_comentario_padre;
  }
  return hilo;
}

// GET /admin/reportes/:id — todo lo que el administrador necesita para decidir.
adminRouter.get("/reportes/:id", async (req, res) => {
  try {
    validarUuid(req.params.id, "Reporte no encontrado");

    const { data: reporte, error } = await supabaseAdmin
      .from("reporte")
      .select(SELECT_REPORTE)
      .eq("id_reporte", req.params.id)
      .maybeSingle();
    if (error) throw errorConStatus("No se pudo obtener el reporte", 500);
    if (!reporte) throw errorConStatus("Reporte no encontrado", 404);

    const tipo = tipoObjetivo(reporte);
    const columna = { publicacion: "id_publicacion", comentario: "id_comentario", grupo: "id_grupo" }[tipo];

    // Todos los reportes sobre el mismo contenido, con quién denunció y por qué.
    const { data: reportes, error: errorReportes } = await supabaseAdmin
      .from("reporte")
      .select(`id_reporte, estado, detalle, creado_en, resuelto_en, motivo:id_motivo_reporte(nombre), denunciante:id_perfil_denunciante(${SELECT_PERSONA})`)
      .eq(columna, reporte[columna])
      .order("creado_en", { ascending: true });
    if (errorReportes) throw errorConStatus("No se pudieron obtener los reportes del contenido", 500);

    const autor = autorDelObjetivo(reporte);

    // Contexto según el tipo de contenido.
    let contexto = null;
    if (tipo === "comentario") {
      const hilo = await obtenerHilo(reporte.id_comentario);
      let publicacion = null;
      if (hilo[0]) {
        const { data } = await supabaseAdmin
          .from("publicacion")
          .select(`id_publicacion, contenido, estado, creado_en, grupo:id_grupo(id_grupo, nombre), autor:id_perfil_autor(${SELECT_PERSONA})`)
          .eq("id_publicacion", hilo[0].id_publicacion)
          .maybeSingle();
        publicacion = data;
      }
      contexto = { publicacion, hilo };
    }

    // Sanciones: cantidad de previas del autor y la de este caso (si ya se resolvió).
    const idsReportes = reportes.map((r) => r.id_reporte);
    const [previas, deEsteCaso] = await Promise.all([
      autor
        ? supabaseAdmin.from("sancion").select("id_sancion", { count: "exact", head: true }).eq("id_perfil_sancionado", autor.id_perfil)
        : { count: 0 },
      supabaseAdmin
        .from("sancion")
        .select("id_sancion, tipo, sancion_hasta, comentario_administrador, creado_en")
        .in("id_reporte", idsReportes),
    ]);

    res.json({
      reporte: {
        id_reporte: reporte.id_reporte,
        estado: reporte.estado,
        creado_en: reporte.creado_en,
        resuelto_en: reporte.resuelto_en,
      },
      objetivo: { tipo, ...reporte[tipo] },
      autor: autor ? { ...autor, nombre_completo: nombreCompleto(autor), sanciones_previas: previas.count ?? 0 } : null,
      reportes,
      contexto,
      sancion: deEsteCaso.data?.[0] ?? null,
    });
  } catch (error) {
    responderError(res, error);
  }
});

// POST /admin/reportes/:id/resolver
//   { resolucion: "sin_infraccion" | "infraccion" | "escalar",
//     tipo_sancion?: "temporal" | "baneo", dias?: 1..365, comentario?: string (<= 500) }
// Todo ocurre dentro de una función de Postgres (atómica).
adminRouter.post("/reportes/:id/resolver", async (req, res) => {
  try {
    validarUuid(req.params.id, "Reporte no encontrado");
    const parametros = validarResolucion(req.body);

    const { data, error } = await supabaseAdmin.rpc("fn_resolver_reporte", {
      p_id_reporte: req.params.id,
      p_id_admin: req.usuario.id_perfil, // siempre el de la sesión, nunca del body
      ...parametros,
    });
    if (error) throw errorDeRpc(error, "No se pudo resolver el reporte");

    res.json(data);
  } catch (error) {
    responderError(res, error);
  }
});

// GET /admin/sanciones/:id/informe
// PDF del incidente de una sanción escalada. Se genera cada vez que se pide (no se guarda nada en el
// servidor) y solo lo pueden pedir administradores, por el router.use de arriba.
adminRouter.get("/sanciones/:id/informe", async (req, res) => {
  try {
    validarUuid(req.params.id, "Sanción no encontrada");
    const datos = await obtenerDatosInforme(req.params.id);

    console.log(`informe: admin ${req.usuario.id_perfil} descargó el informe de la sanción ${req.params.id}`);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="informe-${req.params.id.slice(0, 8)}.pdf"`);
    res.setHeader("Cache-Control", "no-store");
    construirPdf(datos).pipe(res);
  } catch (error) {
    responderError(res, error);
  }
});

// POST /admin/sanciones
//   { id_publicacion | id_comentario, tipo_sancion: "temporal" | "baneo" | "escalar", dias?, comentario? }
// Sanción directa de un administrador sobre el autor de un contenido, sin reporte previo.
// Si el contenido tiene reportes pendientes, la función responde 409 y se resuelve desde Moderación.
adminRouter.post("/sanciones", async (req, res) => {
  try {
    const parametros = validarSancionDirecta(req.body);
    if (parametros.p_id_publicacion) validarUuid(parametros.p_id_publicacion, "Contenido no encontrado");
    if (parametros.p_id_comentario) validarUuid(parametros.p_id_comentario, "Contenido no encontrado");

    const { data, error } = await supabaseAdmin.rpc("fn_sancionar_directo", {
      p_id_admin: req.usuario.id_perfil, // siempre el de la sesión, nunca del body
      ...parametros,
    });
    if (error) throw errorDeRpc(error, "No se pudo aplicar la sanción");

    res.status(201).json(data);
  } catch (error) {
    responderError(res, error);
  }
});