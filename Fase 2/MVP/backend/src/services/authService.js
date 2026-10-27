import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../config/supabase.js";

const SELECT_PERFIL =
  "id_perfil, nombres, primer_apellido, segundo_apellido, apodo, correo, rol_plataforma, estado_cuenta";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CORREO_INSTITUCIONAL = /^[^\s@]+@duocuc\.cl$/;

function crearError(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

// JWT propio del backend (no el de Supabase): el backend centraliza toda
// la lógica, la app nunca depende del proveedor de auth que haya detrás.
function emitirToken(perfil) {
  return jwt.sign(
    { id_perfil: perfil.id_perfil, rol_plataforma: perfil.rol_plataforma },
    process.env.JWT_SECRET,
    { expiresIn: "7d" } // simplificado para el MVP
  );
}

// ---------- Validaciones ----------

function textoObligatorio(valor, campo, max = 60) {
  if (typeof valor !== "string") throw crearError(400, `${campo} es obligatorio`);
  const limpio = valor.trim().replace(/\s+/g, " ");
  if (limpio.length < 1 || limpio.length > max) {
    throw crearError(400, `${campo} es obligatorio (máximo ${max} caracteres)`);
  }
  return limpio;
}

function validarFecha(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw crearError(400, "fecha_nacimiento debe tener formato AAAA-MM-DD");
  }
  const fecha = new Date(`${valor}T00:00:00Z`);
  // El segundo chequeo atrapa fechas imposibles como 2005-02-31 (JS las "corrige" sola).
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
    throw crearError(400, "fecha_nacimiento no es una fecha válida");
  }
  if (fecha > new Date()) throw crearError(400, "fecha_nacimiento no puede ser futura");
  if (fecha.getUTCFullYear() < 1900) throw crearError(400, "fecha_nacimiento no es una fecha válida");
  return valor;
}

function validarRegistro(body = {}) {
  const correo = typeof body.correo === "string" ? body.correo.trim().toLowerCase() : "";
  if (!CORREO_INSTITUCIONAL.test(correo)) {
    throw crearError(400, "Debes usar tu correo institucional @duocuc.cl");
  }

  const { password } = body;
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password) > 72) {
    throw crearError(400, "La contraseña debe tener entre 8 y 72 caracteres");
  }

  const nombres = textoObligatorio(body.nombres, "nombres");
  const primerApellido = textoObligatorio(body.primer_apellido, "primer_apellido");
  const segundoApellido =
    body.segundo_apellido == null || String(body.segundo_apellido).trim() === ""
      ? null
      : textoObligatorio(body.segundo_apellido, "segundo_apellido");

  const fechaNacimiento = validarFecha(body.fecha_nacimiento);

  if (typeof body.id_carrera !== "string" || !UUID.test(body.id_carrera)) {
    throw crearError(400, "Selecciona una carrera válida");
  }

  const semestre =
    typeof body.semestre === "string" && body.semestre.trim() !== ""
      ? Number(body.semestre)
      : body.semestre;
  if (!Number.isInteger(semestre) || semestre < 1 || semestre > 20) {
    throw crearError(400, "semestre debe ser un número entre 1 y 20");
  }

  return {
    correo,
    password,
    nombres,
    primer_apellido: primerApellido,
    segundo_apellido: segundoApellido,
    fecha_nacimiento: fechaNacimiento,
    id_carrera: body.id_carrera,
    semestre,
  };
}

// ---------- Casos de uso ----------

export async function listarCarreras() {
  const { data, error } = await supabaseAdmin
    .from("carrera")
    .select("id_carrera, nombre")
    .order("nombre", { ascending: true });
  if (error) throw crearError(500, "No se pudieron obtener las carreras");
  return data;
}

export async function registrar(body) {
  const datos = validarRegistro(body);

  const { data: carrera, error: errorCarrera } = await supabaseAdmin
    .from("carrera")
    .select("id_carrera")
    .eq("id_carrera", datos.id_carrera)
    .maybeSingle();
  if (errorCarrera) throw crearError(500, "No se pudo validar la carrera");
  if (!carrera) throw crearError(400, "La carrera seleccionada no existe");

  // Paso 1: usuario de autenticación, ya confirmado (la verificación por correo
  // se decidió no hacerla por ahora; con Google Sign-In la hará Google).
  const { data: creado, error: errorAuth } = await supabaseAdmin.auth.admin.createUser({
    email: datos.correo,
    password: datos.password,
    email_confirm: true,
  });

  if (errorAuth) {
    if (errorAuth.code === "email_exists" || errorAuth.code === "user_already_exists") {
      throw crearError(409, "Ese correo ya está registrado");
    }
    console.error("registrar/createUser:", errorAuth);
    throw crearError(500, "No se pudo crear la cuenta");
  }

  const idPerfil = creado.user.id;

  // Paso 2: perfil. rol_plataforma y estado_cuenta salen de los defaults de la BD
  // a propósito: nunca se aceptan desde el cliente.
  const { data: perfil, error: errorPerfil } = await supabaseAdmin
    .from("perfil")
    .insert({
      id_perfil: idPerfil,
      correo: datos.correo,
      nombres: datos.nombres,
      primer_apellido: datos.primer_apellido,
      segundo_apellido: datos.segundo_apellido,
      fecha_nacimiento: datos.fecha_nacimiento,
      id_carrera: datos.id_carrera,
      semestre: datos.semestre,
    })
    .select(SELECT_PERFIL)
    .single();

  if (errorPerfil || !perfil) {
    // supabase-js no tiene transacciones: se deshace el paso 1 a mano.
    const { error: errorBorrado } = await supabaseAdmin.auth.admin.deleteUser(idPerfil);
    if (errorBorrado) console.error("registrar/deleteUser (compensación):", errorBorrado);
    console.error("registrar/insert perfil:", errorPerfil);
    if (errorPerfil?.code === "23505") throw crearError(409, "Ese correo ya está registrado");
    throw crearError(500, "No se pudo crear la cuenta");
  }

  return { token: emitirToken(perfil), perfil };
}

export async function login(body = {}) {
  const correo = typeof body.correo === "string" ? body.correo.trim().toLowerCase() : "";
  const { password } = body;
  if (!correo || typeof password !== "string" || password === "") {
    throw crearError(400, "Ingresa tu correo y tu contraseña");
  }

  // Cliente descartable con la anon/publishable key. NO usar supabaseAdmin acá:
  // signInWithPassword deja la sesión del usuario en el cliente y le quitaría los permisos.
  const clienteAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await clienteAuth.auth.signInWithPassword({
    email: correo,
    password,
  });

  if (error || !data?.user) {
    if (error?.code === "invalid_credentials" || /invalid login credentials/i.test(error?.message ?? "")) {
      throw crearError(401, "Correo o contraseña incorrectos");
    }
    console.error("login/signInWithPassword:", error);
    throw crearError(500, "No se pudo iniciar sesión");
  }

  const { data: perfil, error: errorPerfil } = await supabaseAdmin
    .from("perfil")
    .select(SELECT_PERFIL)
    .eq("id_perfil", data.user.id)
    .maybeSingle();

  if (errorPerfil) throw crearError(500, "No se pudo obtener el perfil");
  // Existe en Auth pero sin perfil (p. ej. registro a medias): no se puede entrar.
  if (!perfil) throw crearError(403, "Tu cuenta no tiene un perfil completo");

  return { token: emitirToken(perfil), perfil };
}