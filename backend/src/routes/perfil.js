import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";

export const perfilRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const SELECT_PERFIL =
  "id_perfil, nombres, primer_apellido, segundo_apellido, apodo, mostrar_apodo, correo, rol_plataforma, foto_perfil_url, semestre, carrera:id_carrera(nombre)";

// GET /perfil/me
perfilRouter.get("/me", requireAuth, async (req, res) => {
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
perfilRouter.post("/me/foto", requireAuth, upload.single("foto"), async (req, res) => {
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