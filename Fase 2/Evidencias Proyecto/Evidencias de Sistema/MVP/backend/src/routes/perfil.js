import { Router } from "express";
import multer from "multer";
import { requireAuth, requireCuentaActiva } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { SELECT_AUTOR, enriquecerPublicaciones, responderError } from "../services/feedService.js";
import { errorConStatus } from "../services/grupoService.js";

export const perfilRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const SELECT_PERFIL =
  "id_perfil, nombres, primer_apellido, segundo_apellido, apodo, mostrar_apodo, correo, rol_plataforma, foto_perfil_url, semestre, carrera:id_carrera(nombre)";

// GET /perfil/me
perfilRouter.get("/me", requireAuth, requireCuentaActiva, async (req, res) => {
  const { data: perfil, error } = await supabaseAdmin
    .from("perfil")
    .select(SELECT_PERFIL)
    .eq("id_perfil", req.usuario.id_perfil)
    .single();

  if (error || !perfil) {
    return res.status(404).json({ error: "Perfil no encontrado" });
  }

  res.json(perfil);
});

const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 50;

// Se pide el estado y el tipo de ingreso del grupo para decidir en JS qué publicaciones se pueden mostrar.
const SELECT_PUBLICACION_PERFIL = `id_publicacion, id_grupo, tipo, contenido, creado_en, autor:id_perfil_autor(${SELECT_AUTOR}), grupo:id_grupo(id_grupo, nombre, categoria, estado, ingreso_limitado)`;

// GET /perfil/me/publicaciones?limite=20&antes=<creado_en de la última publicación recibida>
//
// Mis publicaciones en grupos, de más nueva a más antigua (paginación por cursor, igual que los feeds).
// Misma regla de visibilidad que obtenerPublicacionVisible: el grupo debe estar activo y, si es de
// ingreso limitado, debo seguir siendo miembro activo. Los anuncios no se incluyen.
perfilRouter.get("/me/publicaciones", requireAuth, async (req, res) => {
  try {
    const idPerfil = req.usuario.id_perfil;

    const limite = Math.min(
      Math.max(parseInt(req.query.limite, 10) || LIMITE_POR_DEFECTO, 1),
      LIMITE_MAXIMO
    );

    const { antes } = req.query;
    if (antes !== undefined && (typeof antes !== "string" || Number.isNaN(Date.parse(antes)))) {
      throw errorConStatus("antes debe ser una fecha válida (el creado_en de la última publicación)", 400);
    }

    const { data: membresias, error: errorMembresias } = await supabaseAdmin
      .from("grupo_miembro")
      .select("id_grupo")
      .eq("id_perfil", idPerfil)
      .eq("estado", "activo");
    if (errorMembresias) throw errorConStatus("No se pudieron obtener tus grupos", 500);
    const misGrupos = new Set(membresias.map((m) => m.id_grupo));

    let consulta = supabaseAdmin
      .from("publicacion")
      .select(SELECT_PUBLICACION_PERFIL)
      .eq("id_perfil_autor", idPerfil)
      .eq("tipo", "grupo")
      .eq("estado", "activa")
      .order("creado_en", { ascending: false })
      .limit(limite);
    if (antes) consulta = consulta.lt("creado_en", antes);

    const { data, error } = await consulta;
    if (error) {
      console.error("perfil publicaciones:", error);
      throw errorConStatus("No se pudieron obtener tus publicaciones", 500);
    }

    const visibles = data.filter(
      (p) => p.grupo?.estado === "activo" && (!p.grupo.ingreso_limitado || misGrupos.has(p.id_grupo))
    );
    const enriquecidas = await enriquecerPublicaciones(visibles, req.usuario);

    // puede_interactuar: en un grupo abierto que dejé puedo ver mi publicación pero no dar me gusta.
    const publicaciones = enriquecidas.map((p) => ({ ...p, puede_interactuar: misGrupos.has(p.id_grupo) }));

    // El cursor sale de la página sin filtrar: una página con ocultas igual puede tener más detrás.
    const siguiente = data.length === limite ? data[data.length - 1].creado_en : null;

    res.json({ publicaciones, siguiente });
  } catch (error) {
    responderError(res, error);
  }
});

// PATCH /perfil/me { apodo, mostrar_apodo }
// semestre NO se edita aquí: ese dato viene de la universidad, no lo decide el usuario.
perfilRouter.patch("/me", requireAuth, async (req, res) => {
  const { apodo, mostrar_apodo } = req.body;

  if (apodo !== undefined && apodo !== null && typeof apodo !== "string") {
    return res.status(400).json({ error: "apodo debe ser texto" });
  }
  if (mostrar_apodo !== undefined && typeof mostrar_apodo !== "boolean") {
    return res.status(400).json({ error: "mostrar_apodo debe ser true/false" });
  }

  const cambios = {};
  if (apodo !== undefined) cambios.apodo = apodo === "" ? null : apodo;
  if (mostrar_apodo !== undefined) cambios.mostrar_apodo = mostrar_apodo;

  const { data: perfil, error } = await supabaseAdmin
    .from("perfil")
    .update(cambios)
    .eq("id_perfil", req.usuario.id_perfil)
    .select(SELECT_PERFIL)
    .single();

  if (error || !perfil) {
    return res.status(500).json({ error: "No se pudo actualizar el perfil" });
  }

  res.json(perfil);
});

// POST /perfil/me/foto  (multipart/form-data, campo "foto")
perfilRouter.post("/me/foto", requireAuth, requireCuentaActiva, upload.single("foto"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Falta el archivo (campo 'foto')" });
  }

  const extension = (req.file.originalname.split(".").pop() || "jpg").toLowerCase();
  // Nombre único por subida (no solo por usuario), así: (1) la URL pública cambia
  // cada vez, evitando el caching de <Image>, y (2) podemos borrar el archivo viejo
  // sin confundirlo con el nuevo.
  const nombreNuevo = `${req.usuario.id_perfil}-${Date.now()}.${extension}`;

  // Busca y borra cualquier foto anterior de este usuario antes de subir la nueva.
  const { data: archivosExistentes } = await supabaseAdmin.storage
    .from("perfil-fotos")
    .list("", { search: req.usuario.id_perfil });

  if (archivosExistentes && archivosExistentes.length > 0) {
    const rutasABorrar = archivosExistentes.map((archivo) => archivo.name);
    await supabaseAdmin.storage.from("perfil-fotos").remove(rutasABorrar);
  }

  const { error: errorSubida } = await supabaseAdmin.storage
    .from("perfil-fotos")
    .upload(nombreNuevo, req.file.buffer, {
      contentType: req.file.mimetype,
    });

  if (errorSubida) {
    console.error("Error subiendo a Supabase Storage:", errorSubida);
    return res.status(500).json({ error: "No se pudo subir la foto" });
  }

  const { data: urlPublica } = supabaseAdmin.storage
    .from("perfil-fotos")
    .getPublicUrl(nombreNuevo);

  const { data: perfil, error: errorUpdate } = await supabaseAdmin
    .from("perfil")
    .update({ foto_perfil_url: urlPublica.publicUrl })
    .eq("id_perfil", req.usuario.id_perfil)
    .select(SELECT_PERFIL)
    .single();

  if (errorUpdate || !perfil) {
    return res.status(500).json({ error: "Foto subida, pero no se pudo actualizar el perfil" });
  }

  res.json(perfil);
});