import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../config/supabase.js";

// Verifica el token y consulta el perfil en la BD en CADA petición.
// Así un baneo o un cambio de rol surten efecto de inmediato, sin esperar a que venza el JWT (7 días).
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Falta el token de autenticación" });
  }

  let payload;
  try {
    payload = jwt.verify(header.slice("Bearer ".length), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }

  const { data: perfil, error } = await supabaseAdmin
    .from("perfil")
    .select("rol_plataforma, estado_cuenta, sancion_hasta")
    .eq("id_perfil", payload.id_perfil)
    .maybeSingle();

  if (error) {
    console.error("requireAuth/perfil:", error);
    return res.status(500).json({ error: "No se pudo verificar la sesión" });
  }
  if (!perfil) {
    return res.status(401).json({ error: "Perfil no encontrado" });
  }

  // Baneo permanente: ni siquiera puede leer.
  if (perfil.estado_cuenta === "baneada") {
    return res.status(403).json({ error: "Tu cuenta está baneada" });
  }

  let estadoCuenta = perfil.estado_cuenta;
  let sancionHasta = perfil.sancion_hasta;

  // Sanción temporal ya vencida: se normaliza la cuenta para que la BD no quede mintiendo.
  // El .eq/.lt hace que solo se actualice si sigue vencida (por si un admin la renovó justo ahora).
  if (estadoCuenta === "sancionada" && sancionHasta && new Date(sancionHasta) <= new Date()) {
    const { error: errorLimpieza } = await supabaseAdmin
      .from("perfil")
      .update({ estado_cuenta: "activa", sancion_hasta: null })
      .eq("id_perfil", payload.id_perfil)
      .eq("estado_cuenta", "sancionada")
      .lte("sancion_hasta", new Date().toISOString());
    if (errorLimpieza) console.error("requireAuth/limpiar sanción vencida:", errorLimpieza);
    estadoCuenta = "activa";
    sancionHasta = null;
  }

  // El rol sale de la BD, no del token: si le quitan el rol de administrador, deja de ser admin ya.
  req.usuario = { ...payload, rol_plataforma: perfil.rol_plataforma };
  req.estadoCuenta = { estado_cuenta: estadoCuenta, sancion_hasta: sancionHasta };
  next();
}

// Uso: router.get("/x", requireAuth, requireRol("administrador"), handler)
// Lee el rol que requireAuth dejó en req.usuario (ya viene de la BD).
export function requireRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol_plataforma)) {
      return res.status(403).json({ error: "No tienes permisos para esta acción" });
    }
    next();
  };
}

// Bloquea las acciones de escritura a cuentas con sanción vigente.
// Debe ir DESPUÉS de requireAuth (usa lo que este ya consultó, sin otra consulta a la BD).
export function requireCuentaActiva(req, res, next) { 
  if (!req.estadoCuenta) { 
    return res.status(500).json({ error: "Error interno del servidor" });
  }

  const { estado_cuenta: estado, sancion_hasta: hasta } = req.estadoCuenta;

  // Sin fecha de término, la sanción se trata como indefinida.
  const sancionVigente = estado === "sancionada" && (!hasta || new Date(hasta) > new Date());

  if (sancionVigente) {//REGLA DE NEGOCIO: La cuenta debe estar activa para poder realizar acciones de escritura. Si la cuenta está sancionada, no podrá realizar dichas acciones.
    const cuando = hasta ? ` hasta el ${new Date(hasta).toLocaleDateString("es-CL")}` : "";
    return res.status(403).json({ error: `Tu cuenta tiene una sanción vigente${cuando}` });
  }

  next();
}