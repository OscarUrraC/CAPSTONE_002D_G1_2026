import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { login } from "../services/api";
import SelectorCuentas from "../components/SelectorCuentas";

export default function LoginScreen({ navigation }) {
  const { iniciarSesion } = useAuth();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  // Recibe la función que consigue { token, perfil }.
  async function entrar(conseguirSesion) {
    setCargando(true);
    setError(null);
    try {
      const { token, perfil } = await conseguirSesion();
      await iniciarSesion(token, perfil);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  const puedeEnviar = correo.trim() !== "" && password !== "" && !cargando;

  return (
    <KeyboardAvoidingView style={estilos.contenedor} behavior="padding">
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Text style={estilos.titulo}>Connectboard</Text>
        <Text style={estilos.subtitulo}>Inicia sesión con tu correo institucional</Text>

        <TextInput
          style={estilos.input}
          value={correo}
          onChangeText={setCorreo}
          placeholder="correo@duocuc.cl"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <View style={estilos.filaPassword}>
          <TextInput
            style={[estilos.input, estilos.inputPassword]}
            value={password}
            onChangeText={setPassword}
            placeholder="Contraseña"
            autoCapitalize="none"
            secureTextEntry={!verPassword}
          />
          <Pressable onPress={() => setVerPassword((v) => !v)} hitSlop={8}>
            <Text style={estilos.enlace}>{verPassword ? "Ocultar" : "Mostrar"}</Text>
          </Pressable>
        </View>

        {error && <Text style={estilos.error}>{error}</Text>}

        {cargando ? (
          <ActivityIndicator size="large" />
        ) : (
          <Pressable
            style={[estilos.boton, !puedeEnviar && estilos.botonDeshabilitado]}
            onPress={() => entrar(() => login(correo.trim().toLowerCase(), password))}
            disabled={!puedeEnviar}
          >
            <Text style={estilos.textoBoton}>Entrar</Text>
          </Pressable>
        )}

        <Pressable onPress={() => navigation.navigate("Registro")} hitSlop={8}>
          <Text style={estilos.enlaceCentrado}>¿No tienes cuenta? Regístrate</Text>
        </Pressable>

        {/* Solo en desarrollo: cambio rápido entre cuentas usadas en este dispositivo. */}
        {__DEV__ && (
          <View style={estilos.demo}>
            <SelectorCuentas onEntrar={iniciarSesion} onError={setError} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1 },
  contenido: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 14 },
  titulo: { fontSize: 28, fontWeight: "bold", textAlign: "center" },
  subtitulo: { textAlign: "center", color: "#666", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  filaPassword: { flexDirection: "row", alignItems: "center", gap: 12 },
  inputPassword: { flex: 1 },
  enlace: { color: "#2563eb", fontWeight: "600" },
  enlaceCentrado: { color: "#2563eb", fontWeight: "600", textAlign: "center", marginTop: 4 },
  boton: { backgroundColor: "#2563eb", padding: 16, borderRadius: 8 },
  botonDeshabilitado: { opacity: 0.5 },
  textoBoton: { color: "white", textAlign: "center", fontWeight: "600" },
  error: { color: "#dc2626", textAlign: "center" },
  demo: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
});