import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { loginDemo } from "../services/api";

export default function LoginScreen({ onLogin }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  async function entrarComo(cuenta) {
    setCargando(true);
    setError(null);
    try {
      const { token, perfil } = await loginDemo(cuenta);
      onLogin(token, perfil);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo}>Connectboard</Text>
      <Text style={estilos.subtitulo}>
        Login demo (MVP) — el login con Google todavía no está implementado
      </Text>

      {cargando ? (
        <ActivityIndicator size="large" />
      ) : (
        <>
          <Pressable style={estilos.boton} onPress={() => entrarComo("estudiante")}>
            <Text style={estilos.textoBoton}>Entrar como Estudiante Demo</Text>
          </Pressable>

          <Pressable style={estilos.boton} onPress={() => entrarComo("administrador")}>
            <Text style={estilos.textoBoton}>Entrar como Administrador Demo</Text>
          </Pressable>
        </>
      )}

      {error && <Text style={estilos.error}>{error}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  titulo: { fontSize: 28, fontWeight: "bold", textAlign: "center" },
  subtitulo: { textAlign: "center", color: "#666", marginBottom: 16 },
  boton: { backgroundColor: "#2563eb", padding: 16, borderRadius: 8 },
  textoBoton: { color: "white", textAlign: "center", fontWeight: "600" },
  error: { color: "red", textAlign: "center", marginTop: 12 },
});