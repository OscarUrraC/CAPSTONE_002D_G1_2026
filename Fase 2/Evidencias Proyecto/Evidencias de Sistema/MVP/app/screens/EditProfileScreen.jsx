import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../context/AuthContext";
import { actualizarPerfil, subirFotoPerfil } from "../services/api";

export default function EditProfileScreen({ navigation }) {
  const { token, perfil, setPerfil } = useAuth();

  const [apodo, setApodo] = useState(perfil.apodo ?? "");
  const [mostrarApodo, setMostrarApodo] = useState(perfil.mostrar_apodo);
  const [fotoUriLocal, setFotoUriLocal] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function elegirFoto() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tus fotos para cambiar la foto de perfil.");
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!resultado.canceled) {
      setFotoUriLocal(resultado.assets[0].uri);
    }
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      let perfilActualizado = await actualizarPerfil(token, {
        apodo,
        mostrar_apodo: mostrarApodo,
      });

      if (fotoUriLocal) {
        perfilActualizado = await subirFotoPerfil(token, fotoUriLocal);
      }

      setPerfil(perfilActualizado);
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  const fotoAMostrar = fotoUriLocal ?? perfil.foto_perfil_url;

  return (
    <View style={estilos.contenedor}>
      <Pressable onPress={elegirFoto} style={estilos.contenedorFoto}>
        {fotoAMostrar ? (
          <Image source={{ uri: fotoAMostrar }} style={estilos.foto} />
        ) : (
          <View style={[estilos.foto, estilos.fotoVacia]}>
            <Text style={estilos.textoFotoVacia}>Sin foto</Text>
          </View>
        )}
        <Text style={estilos.textoCambiarFoto}>Cambiar foto</Text>
      </Pressable>

      <Text style={estilos.etiqueta}>Apodo</Text>
      <TextInput style={estilos.input} value={apodo} onChangeText={setApodo} placeholder="Ej: Cami" />

      <View style={estilos.filaSwitch}>
        <Text style={estilos.etiqueta}>Mostrar apodo en vez de mi nombre</Text>
        <Switch value={mostrarApodo} onValueChange={setMostrarApodo} />
      </View>

      {error && <Text style={estilos.error}>{error}</Text>}

      {guardando ? (
        <ActivityIndicator size="large" />
      ) : (
        <>
          <Pressable style={estilos.boton} onPress={guardar}>
            <Text style={estilos.textoBoton}>Guardar</Text>
          </Pressable>
          <Pressable style={estilos.botonSecundario} onPress={() => navigation.goBack()}>
            <Text style={estilos.textoBotonSecundario}>Cancelar</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, padding: 24, gap: 12 },
  contenedorFoto: { alignItems: "center", marginBottom: 8 },
  foto: { width: 100, height: 100, borderRadius: 50 },
  fotoVacia: { backgroundColor: "#e5e7eb", justifyContent: "center", alignItems: "center" },
  textoFotoVacia: { color: "#6b7280", fontSize: 12 },
  textoCambiarFoto: { color: "#2563eb", marginTop: 8, fontWeight: "600" },
  etiqueta: { fontSize: 14, color: "#374151" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12 },
  filaSwitch: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  boton: { backgroundColor: "#2563eb", padding: 16, borderRadius: 8, marginTop: 24 },
  textoBoton: { color: "white", textAlign: "center", fontWeight: "600" },
  botonSecundario: { padding: 16, borderRadius: 8, marginTop: 8 },
  textoBotonSecundario: { color: "#6b7280", textAlign: "center" },
  error: { color: "red", textAlign: "center", marginTop: 8 },
});