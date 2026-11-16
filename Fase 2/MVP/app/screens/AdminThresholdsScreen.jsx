import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useAuth } from "../context/AuthContext";
import { obtenerUmbralesModeracion, guardarUmbralesModeracion } from "../services/api";
import { ETIQUETAS_CATEGORIA } from "../utils/moderacion";

// Panel de umbrales: cada categoría retiene el contenido cuando su puntaje alcanza o supera el valor.
export default function AdminThresholdsScreen() {
  const { token } = useAuth();
  const alturaCabecera = useHeaderHeight();

  const [categorias, setCategorias] = useState([]); // [{ categoria, umbral, aplica_a_imagenes }]
  const [valores, setValores] = useState({}); // texto que se está editando por categoría
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await obtenerUmbralesModeracion(token);
      setCategorias(r.umbrales);
      setValores(Object.fromEntries(r.umbrales.map((u) => [u.categoria, u.umbral == null ? "" : String(u.umbral)])));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  async function guardar() {
    // Solo se envían las categorías que cambiaron.
    const cambios = {};
    for (const u of categorias) {
      const n = Number(String(valores[u.categoria]).replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || n > 1) {
        Alert.alert("Revisa los valores", `El umbral de "${ETIQUETAS_CATEGORIA[u.categoria]}" debe ser un número entre 0 y 1.`);
        return;
      }
      if (Math.round(n * 100) / 100 !== u.umbral) cambios[u.categoria] = n;
    }
    if (Object.keys(cambios).length === 0) {
      Alert.alert("Sin cambios", "No modificaste ningún umbral.");
      return;
    }

    setGuardando(true);
    try {
      await guardarUmbralesModeracion(token, cambios);
      await cargar();
      Alert.alert("Umbrales guardados", "Los cambios se aplican a las próximas publicaciones.");
    } catch (e) {
      Alert.alert("No se pudieron guardar", e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando && categorias.length === 0) {
    return (
      <View style={estilos.centrado}>
        {error ? (
          <>
            <Text style={estilos.error}>{error}</Text>
            <Pressable style={estilos.boton} onPress={cargar}>
              <Text style={estilos.textoBoton}>Reintentar</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" />
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={estilos.contenedor} behavior="padding" keyboardVerticalOffset={alturaCabecera}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Text style={estilos.explicacion}>
          Una publicación se retiene para revisión cuando el puntaje de alguna categoría alcanza o supera su umbral
          (de 0 a 1). Un umbral más bajo es más estricto; 1 prácticamente desactiva la categoría.
        </Text>

        {error && <Text style={estilos.error}>{error}</Text>}

        {categorias.map((u) => (
          <View key={u.categoria} style={estilos.fila}>
            <View style={estilos.datos}>
              <Text style={estilos.nombre}>{ETIQUETAS_CATEGORIA[u.categoria] ?? u.categoria}</Text>
              <Text style={estilos.ayuda}>{u.aplica_a_imagenes ? "Texto e imágenes" : "Solo texto"}</Text>
            </View>
            <TextInput
              style={estilos.input}
              value={valores[u.categoria] ?? ""}
              onChangeText={(t) => setValores((v) => ({ ...v, [u.categoria]: t }))}
              keyboardType="decimal-pad"
              maxLength={4}
            />
          </View>
        ))}

        {guardando ? (
          <ActivityIndicator size="large" />
        ) : (
          <Pressable style={estilos.boton} onPress={guardar}>
            <Text style={estilos.textoBoton}>Guardar cambios</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "white" },
  contenido: { padding: 16, gap: 10, paddingBottom: 40 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
  explicacion: { fontSize: 13, color: "#6b7280", marginBottom: 6 },
  fila: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12 },
  datos: { flex: 1 },
  nombre: { fontSize: 15, fontWeight: "600", color: "#111827" },
  ayuda: { fontSize: 12, color: "#6b7280" },
  input: { width: 72, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 10, textAlign: "center" },
  boton: { backgroundColor: "#2563eb", padding: 16, borderRadius: 8, marginTop: 8 },
  textoBoton: { color: "white", textAlign: "center", fontWeight: "600" },
  error: { color: "red", textAlign: "center" },
});