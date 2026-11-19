import { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { obtenerPerfil } from "../services/api";
import { guardarCuenta } from "../services/cuentas";
import { registrarPush, desregistrarPush } from "../services/notificacionesPush";

const CLAVE_TOKEN = "connectboard_token";
// Marca "aún no vio la introducción", una por cuenta. Los UUID sirven como parte de una clave de SecureStore.
const claveIntro = (idPerfil) => `connectboard_intro_${idPerfil}`;
const AuthContext = createContext(null);

// Leer la marca nunca debe romper la sesión: ante cualquier fallo, se asume que no hay introducción pendiente.
async function leerIntroPendiente(idPerfil) {
  try {
    return (await SecureStore.getItemAsync(claveIntro(idPerfil))) === "1";
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);
  const [introPendiente, setIntroPendiente] = useState(false);

  useEffect(() => {
    async function restaurarSesion() {
      const tokenGuardado = await SecureStore.getItemAsync(CLAVE_TOKEN);
      if (tokenGuardado) {
        try {
          const perfilRecuperado = await obtenerPerfil(tokenGuardado);
          setIntroPendiente(await leerIntroPendiente(perfilRecuperado.id_perfil));
          setToken(tokenGuardado);
          setPerfil(perfilRecuperado);
          registrarPush(tokenGuardado); // sin await: no debe retrasar la apertura de la app
        } catch (e) {
          // Solo un 401 significa que la sesión ya no sirve. Un corte de red o un error 5xx
          // no deben cerrarla: se reintenta la próxima vez que se abra la app.
          if (e.status === 401) await SecureStore.deleteItemAsync(CLAVE_TOKEN);
        }
      }
      setVerificandoSesion(false);
    }
    restaurarSesion();
  }, []);

  // esRegistro=true solo lo manda la pantalla de registro: deja marcada la introducción como pendiente.
  async function iniciarSesion(nuevoToken, perfilParcial, { esRegistro = false } = {}) {
    await SecureStore.setItemAsync(CLAVE_TOKEN, nuevoToken);

    // El perfil que devuelve el login trae menos campos que GET /perfil/me
    // (sin carrera, semestre ni foto): se pide el completo para que ProfileScreen no quede a medias.
    let perfilCompleto = perfilParcial;
    try {
      perfilCompleto = await obtenerPerfil(nuevoToken);
    } catch {
      // si falla, se sigue con el parcial: la sesión es válida igual
    }

    // Solo en desarrollo (el módulo ignora la llamada en producción).
    // Un fallo aquí no debe impedir el login.
    try {
      await guardarCuenta(nuevoToken, { ...perfilParcial, ...perfilCompleto });
    } catch {
      // el selector de cuentas es solo una comodidad de desarrollo
    }

    // Se decide antes de entrar a la app, para que no se vean las pestañas un instante.
    if (esRegistro) {
      try {
        await SecureStore.setItemAsync(claveIntro(perfilCompleto.id_perfil), "1");
      } catch {
        // si no se puede guardar la marca, solo se pierde que reaparezca tras cerrar la app
      }
    }
    setIntroPendiente(esRegistro || (await leerIntroPendiente(perfilCompleto.id_perfil)));

    setToken(nuevoToken);
    setPerfil(perfilCompleto);
    registrarPush(nuevoToken);
  }

  async function completarIntroduccion() {
    setIntroPendiente(false);
    try {
      if (perfil) await SecureStore.deleteItemAsync(claveIntro(perfil.id_perfil));
    } catch {
      // si falla el borrado, la introducción reaparecería una vez más: no es grave
    }
  }

  async function cerrarSesion() {
    // Se desregistra primero: la ruta exige la sesión que se está cerrando.
    if (token) await desregistrarPush(token);
    // Borra solo el token activo; las cuentas guardadas para cambio rápido se conservan.
    await SecureStore.deleteItemAsync(CLAVE_TOKEN);
    setIntroPendiente(false);
    setToken(null);
    setPerfil(null);
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        perfil,
        setPerfil,
        verificandoSesion,
        iniciarSesion,
        cerrarSesion,
        introPendiente,
        completarIntroduccion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return contexto;
}