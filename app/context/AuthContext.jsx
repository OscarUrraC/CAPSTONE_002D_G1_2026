import { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { obtenerPerfil } from "../services/api";

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

  async function iniciarSesion(nuevoToken, nuevoPerfil) {
    await SecureStore.setItemAsync(CLAVE_TOKEN, nuevoToken);
    setToken(nuevoToken);
    setPerfil(nuevoPerfil);
  }

  async function cerrarSesion() {
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