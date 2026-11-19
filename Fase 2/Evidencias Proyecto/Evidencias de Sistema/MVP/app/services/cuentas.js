import * as SecureStore from "expo-secure-store";

// Una clave por cuenta + una clave índice con los ids.
// Las claves de SecureStore solo admiten letras, números, ".", "-" y "_" (un UUID sirve).
const CLAVE_INDICE = "connectboard_cuentas_indice";
const claveCuenta = (id) => `connectboard_cuenta_${id}`;

async function leerIndice() {
  try {
    const crudo = await SecureStore.getItemAsync(CLAVE_INDICE);
    return crudo ? JSON.parse(crudo) : [];
  } catch {
    return [];
  }
}

// Devuelve [{ id_perfil, correo, nombres, primer_apellido, rol_plataforma, token }, ...]
export async function listarCuentas() {
  if (!__DEV__) return [];
  const ids = await leerIndice();
  const cuentas = [];
  for (const id of ids) {
    try {
      const crudo = await SecureStore.getItemAsync(claveCuenta(id));
      if (crudo) cuentas.push(JSON.parse(crudo));
    } catch {
      // una cuenta ilegible se ignora, no rompe la lista
    }
  }
  return cuentas;
}

export async function guardarCuenta(token, perfil) {
  if (!__DEV__) return;
  const cuenta = {
    id_perfil: perfil.id_perfil,
    correo: perfil.correo,
    nombres: perfil.nombres,
    primer_apellido: perfil.primer_apellido,
    rol_plataforma: perfil.rol_plataforma,
    token,
  };
  await SecureStore.setItemAsync(claveCuenta(cuenta.id_perfil), JSON.stringify(cuenta));
  const ids = await leerIndice();
  if (!ids.includes(cuenta.id_perfil)) {
    await SecureStore.setItemAsync(CLAVE_INDICE, JSON.stringify([...ids, cuenta.id_perfil]));
  }
}

export async function quitarCuenta(idPerfil) {
  if (!__DEV__) return;
  await SecureStore.deleteItemAsync(claveCuenta(idPerfil));
  const ids = await leerIndice();
  await SecureStore.setItemAsync(CLAVE_INDICE, JSON.stringify(ids.filter((id) => id !== idPerfil)));
}