import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { listarMotivosReporte, crearReporte } from "../services/api";

// objetivo: { id_publicacion } | { id_grupo } para abrirlo, o null para mantenerlo cerrado.
export default function ReportarModal({ objetivo, onCerrar }) {
  const { token } = useAuth();
  const [motivos, setMotivos] = useState([]);
  const [idMotivo, setIdMotivo] = useState(null);
  const [detalle, setDetalle] = useState("");
  const [cargandoMotivos, setCargandoMotivos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState(null);

  const visible = objetivo !== null;

  // Cada vez que se abre se limpia el formulario; los motivos se piden solo la primera vez.
  useEffect(() => {
    if (!visible) return;
    setIdMotivo(null);
    setDetalle("");
    setEnviado(false);
    setError(null);
    if (motivos.length > 0) return;

    setCargandoMotivos(true);
    listarMotivosReporte(token)
      .then(setMotivos)
      .catch((e) => setError(e.message))
      .finally(() => setCargandoMotivos(false));
  }, [visible]);

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      await crearReporte(token, { ...objetivo, id_motivo_reporte: idMotivo, detalle });
      setEnviado(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  const titulo = objetivo?.id_grupo ? "Reportar grupo" : "Reportar publicación";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <KeyboardAvoidingView
        style={estilos.fondo}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={estilos.hoja}>
          <Text style={estilos.titulo}>{titulo}</Text>

          {enviado ? (
            <>
              <Text style={estilos.texto}>
                Gracias. Un administrador revisará tu reporte.
              </Text>
              <Pressable style={estilos.boton} onPress={onCerrar}>
                <Text style={estilos.textoBoton}>Cerrar</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={estilos.etiqueta}>¿Cuál es el motivo?</Text>
              {cargandoMotivos ? (
                <ActivityIndicator />
              ) : (
                motivos.map((motivo) => {
                  const seleccionado = idMotivo === motivo.id_motivo_reporte;
                  return (
                    <Pressable
                      key={motivo.id_motivo_reporte}
                      style={[estilos.opcion, seleccionado && estilos.opcionSeleccionada]}
                      onPress={() => setIdMotivo(motivo.id_motivo_reporte)}
                    >
                      <Text style={[estilos.textoOpcion, seleccionado && estilos.textoOpcionSeleccionada]}>
                        {motivo.nombre}
                      </Text>
                    </Pressable>
                  );
                })
              )}

              <Text style={estilos.etiqueta}>Detalle (opcional)</Text>
              <TextInput
                style={estilos.input}
                value={detalle}
                onChangeText={setDetalle}
                placeholder="Cuéntanos qué pasó"
                multiline
                maxLength={500}
              />

              {error && <Text style={estilos.error}>{error}</Text>}

              {enviando ? (
                <ActivityIndicator size="large" />
              ) : (
                <>
                  <Pressable
                    style={[estilos.boton, !idMotivo && estilos.botonDeshabilitado]}
                    onPress={enviar}
                    disabled={!idMotivo}
                  >
                    <Text style={estilos.textoBoton}>Enviar reporte</Text>
                  </Pressable>
                  <Pressable style={estilos.botonSecundario} onPress={onCerrar}>
                    <Text style={estilos.textoBotonSecundario}>Cancelar</Text>
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" },
  hoja: { backgroundColor: "white", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, gap: 10 },
  titulo: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  texto: { color: "#374151" },
  etiqueta: { fontSize: 14, color: "#374151", marginTop: 4 },
  opcion: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12 },
  opcionSeleccionada: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  textoOpcion: { color: "#111827" },
  textoOpcionSeleccionada: { color: "#dc2626", fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, minHeight: 70, textAlignVertical: "top" },
  boton: { backgroundColor: "#dc2626", padding: 16, borderRadius: 8, marginTop: 8 },
  botonDeshabilitado: { opacity: 0.5 },
  textoBoton: { color: "white", textAlign: "center", fontWeight: "600" },
  botonSecundario: { padding: 12 },
  textoBotonSecundario: { color: "#6b7280", textAlign: "center" },
  error: { color: "red", textAlign: "center" },
});
