import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../config/supabase.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Falta el token de autenticación" });
  }

  const token = header.slice("Bearer ".length);

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

// Uso: router.get("/x", requireAuth, requireRol("administrador"), handler)
// Todavía no se usa: queda lista para las rutas /admin del futuro dashboard de moderación.
export function requireRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol_plataforma)) {
      return res.status(403).json({ error: "No tienes permisos para esta acción" });
    }
    next();
  };
}

// Bloquea las acciones de escritura a cuentas baneadas o con sanción vigente.
// Consulta la BD y no el JWT, porque el estado puede cambiar después del login.
export async function requireCuentaActiva(req, res, next) {
  const { data: perfil, error } = await supabaseAdmin
    .from("perfil")
    .select("estado_cuenta, sancion_hasta")
    .eq("id_perfil", req.usuario.id_perfil)
    .single();

  if (error || !perfil) {
    return res.status(401).json({ error: "Perfil no encontrado" });
  }

  if (perfil.estado_cuenta === "baneada") {
    return res.status(403).json({ error: "Tu cuenta está baneada" });
  }

  // Si una sanción no tiene fecha de término, se trata como indefinida.
  const sancionVigente =
    perfil.estado_cuenta === "sancionada" &&
    (!perfil.sancion_hasta || new Date(perfil.sancion_hasta) > new Date());

  if (sancionVigente) {
    return res.status(403).json({ error: "Tu cuenta tiene una sanción vigente" });
  }

  next();
}