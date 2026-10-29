// (publicar anuncio, solo administradores).
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";
import { crearAnuncio } from "../services/api";

const MAX = 1000;

export default function NewAnnouncementScreen({ navigation }) {
  const { token, perfil } = useAuth();
  const [contenido, setContenido] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (perfil.rol_plataforma !== "administrador") {
    return (
      <View style={estilos.centrado}>
        <Text>Solo los administradores pueden publicar anuncios.</Text>
      </View>
    );
  }

  const puedeEnviar = contenido.trim().length > 0 && !enviando;

  async function publicar() {
    if (!puedeEnviar) return;
    setEnviando(true);
    try {
      await crearAnuncio(token, contenido.trim());
      // Vuelve al feed y le pide recargarse (FeedScreen escucha el parámetro "recargar").
      navigation.popTo("FeedInicio", { recargar: Date.now() });
    } catch (e) {
      Alert.alert("No se pudo publicar", e.message);
      setEnviando(false);
    }
  }

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.etiqueta}>Comunicado oficial</Text>
      <TextInput
        style={estilos.input}
        value={contenido}
        onChangeText={setContenido}
        maxLength={MAX}
        multiline
        placeholder="Escribe el anuncio para todos los estudiantes"
        autoFocus
      />
      <Text style={estilos.contador}>{contenido.length}/{MAX}</Text>

      <Pressable style={[estilos.boton, !puedeEnviar && estilos.botonDeshabilitado]} onPress={publicar} disabled={!puedeEnviar}>
        <Text style={estilos.textoBoton}>{enviando ? "Publicando..." : "Publicar anuncio"}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#f9fafb", padding: 16, gap: 8 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  etiqueta: { fontWeight: "600", color: "#374151" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, backgroundColor: "white", minHeight: 160, textAlignVertical: "top" },
  contador: { color: "#9ca3af", textAlign: "right", fontSize: 12 },
  boton: { backgroundColor: "#2563eb", padding: 16, borderRadius: 8, alignItems: "center", marginTop: 8 },
  botonDeshabilitado: { opacity: 0.5 },
  textoBoton: { color: "white", fontWeight: "600" },
});