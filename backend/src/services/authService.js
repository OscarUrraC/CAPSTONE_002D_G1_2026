import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../config/supabase.js";

// MVP temporal: mientras no esté resuelto el login con Google (pendiente de
// confirmar con la universidad si se puede integrar con sus sistemas),
// solo existen estas 2 cuentas de demostración, creadas a mano en la BD.
const CORREOS_DEMO = {
  estudiante: "estudiante.demo@duocuc.cl",
  administrador: "admin.demo@duocuc.cl",
};

export async function loginDemo(cuenta) {
  const correo = CORREOS_DEMO[cuenta];
  if (!correo) {
    const error = new Error("Cuenta demo inválida");
    error.status = 400;
    throw error;
  }

  const { data: perfil, error } = await supabaseAdmin
    .from("perfil")
    .select("id_perfil, nombres, primer_apellido, segundo_apellido, apodo, correo, rol_plataforma, estado_cuenta")
    .eq("correo", correo)
    .single();

  if (error || !perfil) {
    const err = new Error("No se encontró el perfil demo. ¿Se corrió el seed de datos?");
    err.status = 500;
    throw err;
  }

  // JWT propio del backend (no el de Supabase): el backend centraliza toda
  // la lógica, la app nunca depende del proveedor de auth que haya detrás.
  const token = jwt.sign(
    {
      id_perfil: perfil.id_perfil,
      rol_plataforma: perfil.rol_plataforma,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" } // simplificado para el MVP
  );

  return { token, perfil };
}