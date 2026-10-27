import { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { obtenerPerfil } from "../services/api";
import { guardarCuenta } from "../services/cuentas";

const CLAVE_TOKEN = "connectboard_token";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);

  useEffect(() => {
    async function restaurarSesion() {
      const tokenGuardado = await SecureStore.getItemAsync(CLAVE_TOKEN);
      if (tokenGuardado) {
        try {
          const perfilRecuperado = await obtenerPerfil(tokenGuardado);
          setToken(tokenGuardado);
          setPerfil(perfilRecuperado);
        } catch {
          await SecureStore.deleteItemAsync(CLAVE_TOKEN);
        }
      }
      setVerificandoSesion(false);
    }
    restaurarSesion();
  }, []);

  async function iniciarSesion(nuevoToken, perfilParcial) {
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

    setToken(nuevoToken);
    setPerfil(perfilCompleto);
  }

  async function cerrarSesion() {
    // Borra solo el token activo; las cuentas guardadas para cambio rápido se conservan.
    await SecureStore.deleteItemAsync(CLAVE_TOKEN);
    setToken(null);
    setPerfil(null);
  }

  return (
    <AuthContext.Provider
      value={{ token, perfil, setPerfil, verificandoSesion, iniciarSesion, cerrarSesion }}
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