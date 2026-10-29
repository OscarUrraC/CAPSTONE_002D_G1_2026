import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";
import { crearEvento, editarEvento, obtenerEvento } from "../services/api";
import { formatearFechaEvento } from "../utils/formato";
import SelectorFechaHora from "../components/SelectorFechaHora";

// Al crear, el formulario parte con mañana a las 10:00.
function fechaPorDefecto() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

// Sin params = nuevo evento. Con { idEvento } = editar (cambiar la fecha reprograma el evento).
export default function EventFormScreen({ route, navigation }) {
  const idEvento = route.params?.idEvento;
  const editando = Boolean(idEvento);
  const { token, perfil } = useAuth();

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [inicio, setInicio] = useState(fechaPorDefecto);
  const [original, setOriginal] = useState(null); // valores al abrir, para detectar cambios
  const [cargando, setCargando] = useState(editando);
  const [guardando, setGuardando] = useState(false);

  const esAdmin = perfil.rol_plataforma === "administrador";

  useEffect(() => {
    navigation.setOptions({ title: editando ? "Editar evento" : "Nuevo evento" });
  }, [navigation, editando]);

  useEffect(() => {
    if (!editando) return;
    obtenerEvento(token, idEvento)
      .then((e) => {
        const fecha = new Date(e.fecha_evento);
        fecha.setSeconds(0, 0);
        setTitulo(e.titulo);
        setDescripcion(e.descripcion ?? "");
        setUbicacion(e.ubicacion ?? "");
        setInicio(fecha);
        setOriginal({
          titulo: e.titulo,
          descripcion: e.descripcion ?? "",
          ubicacion: e.ubicacion ?? "",
          inicio: fecha.getTime(),
        });
      })
      .catch((e) => {
        Alert.alert("No se pudo cargar el evento", e.message);
        navigation.goBack();
      })
      .finally(() => setCargando(false));
  }, [editando, token, idEvento, navigation]);

  if (!esAdmin) {
    return (
      <View style={estilos.centrado}>
        <Text>Solo los administradores pueden gestionar eventos.</Text>
      </View>
    );
  }

  if (cargando) {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const cambioFecha = editando && original && inicio.getTime() !== original.inicio;

  async function guardar() {
    if (guardando) return;

    if (!titulo.trim()) {
      Alert.alert("Falta el título", "Escribe un título para el evento.");
      return;
    }
    // La fecha solo se valida si es nueva o la cambiaste (editar otros datos de un evento vigente no la toca).
    if ((!editando || cambioFecha) && inicio.getTime() <= Date.now()) {
      Alert.alert("Fecha pasada", "La fecha y hora del evento deben ser futuras.");
      return;
    }

    // Editando sin tocar nada: no hay nada que enviar.
    if (
      editando &&
      original &&
      titulo.trim() === original.titulo &&
      descripcion.trim() === original.descripcion &&
      ubicacion.trim() === original.ubicacion &&
      !cambioFecha
    ) {
      navigation.goBack();
      return;
    }

    setGuardando(true);
    try {
      const datos = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        ubicacion: ubicacion.trim(),
      };
      // En edición, la fecha se envía solo si cambió: así no se reprograma sin querer.
      if (!editando || cambioFecha) datos.fecha_evento = inicio.toISOString();

      if (editando) await editarEvento(token, idEvento, datos);
      else await crearEvento(token, datos);
      navigation.goBack(); // la lista y el detalle se recargan solos al volver a verse
    } catch (e) {
      Alert.alert("No se pudo guardar", e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      <Text style={estilos.etiqueta}>Título *</Text>
      <TextInput style={estilos.input} value={titulo} onChangeText={setTitulo} maxLength={150} placeholder="Ej: Feria de emprendimiento" />

      <Text style={estilos.etiqueta}>Fecha y hora de inicio *</Text>
      <SelectorFechaHora valor={inicio} onCambio={setInicio} />
      <Text style={estilos.resumen}>🗓 {formatearFechaEvento(inicio.toISOString())}</Text>

      {cambioFecha && (
        <Text style={estilos.aviso}>
          Cambiaste la fecha u hora: el evento quedará como reprogramado y los avisos de quienes lo marcaron se reiniciarán.
        </Text>
      )}

      <Text style={estilos.etiqueta}>Ubicación</Text>
      <TextInput style={estilos.input} value={ubicacion} onChangeText={setUbicacion} maxLength={200} placeholder="Ej: Auditorio principal" />

      <Text style={estilos.etiqueta}>Descripción</Text>
      <TextInput
        style={[estilos.input, estilos.inputLargo]}
        value={descripcion}
        onChangeText={setDescripcion}
        maxLength={1000}
        multiline
        placeholder="Detalles de la actividad"
      />

      <Pressable style={[estilos.boton, guardando && estilos.botonDeshabilitado]} onPress={guardar} disabled={guardando}>
        <Text style={estilos.textoBoton}>{guardando ? "Guardando..." : editando ? "Guardar cambios" : "Publicar evento"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#f9fafb" },
  contenido: { padding: 16, gap: 6 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  etiqueta: { fontWeight: "600", color: "#374151", marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, backgroundColor: "white" },
  inputLargo: { minHeight: 100, textAlignVertical: "top" },
  resumen: { color: "#2563eb", fontWeight: "600", textTransform: "capitalize", marginTop: 4 },
  aviso: { color: "#b45309", fontSize: 13 },
  boton: { backgroundColor: "#2563eb", padding: 16, borderRadius: 8, alignItems: "center", marginTop: 20 },
  botonDeshabilitado: { opacity: 0.5 },
  textoBoton: { color: "white", fontWeight: "600" },
});