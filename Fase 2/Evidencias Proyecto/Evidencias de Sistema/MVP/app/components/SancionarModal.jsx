import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { sancionarDirecto } from "../services/api";
import { descargarYCompartirInforme } from "../utils/informe";

const OPCIONES = [
  {
    valor: "temporal",
    titulo: "Sanción temporal",
    ayuda: "Se elimina el contenido. El autor puede entrar y leer, pero no interactuar durante el plazo.",
  },
  {
    valor: "baneo",
    titulo: "Baneo permanente",
    ayuda: "Se elimina el contenido, se banea la cuenta y se oculta todo lo suyo.",
  },
  {
    valor: "escalar",
    titulo: "Escalar a la institución",
    ayuda: "Baneo permanente y un informe PDF para las autoridades de la universidad.",
  },
];

// objetivo: { id_publicacion } | { id_comentario } para abrirlo, o null para mantenerlo cerrado.
// onListo se llama cuando la sanción ya se aplicó (para que la pantalla recargue su contenido).
// enviar (opcional): reemplaza la llamada a sancionarDirecto; recibe los datos y devuelve { id_sancion, ... }.
export default function SancionarModal({ objetivo, onCerrar, onListo, enviar }) {
  const { token } = useAuth();
  const visible = objetivo !== null;

  const [tipo, setTipo] = useState(null);
  const [dias, setDias] = useState("");
  const [comentario, setComentario] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  // Cada vez que se abre se limpia el formulario.
  useEffect(() => {
    if (!visible) return;
    setTipo(null);
    setDias("");
    setComentario("");
    setConfirmando(false);
    setEnviando(false);
    setError(null);
  }, [visible]);

  function validar() {
    if (!tipo) return "Elige el tipo de sanción.";
    if (tipo === "temporal") {
      const n = Number(dias);
      if (!Number.isInteger(n) || n < 1 || n > 365) return "Los días deben ser un número entero entre 1 y 365.";
    }
    return null;
  }

  function pasarAConfirmacion() {
    const mensaje = validar();
    if (mensaje) {
      setError(mensaje);
      return;
    }
    setError(null);
    setConfirmando(true);
  }

  async function aplicar() {
    setEnviando(true);
    setError(null);

    const datos = {
      ...objetivo,
      tipo_sancion: tipo,
      ...(tipo === "temporal" && { dias: Number(dias) }),
      ...(comentario.trim() && { comentario: comentario.trim() }),
    };
    let r;
    try {
      r = await (enviar ? enviar(datos) : sancionarDirecto(token, datos));
    } catch (e) {
      setError(e.message);
      setConfirmando(false);
      setEnviando(false);
      return;
    }

    onCerrar();
    onListo?.(r);

    let aviso = null;
    if (tipo === "escalar" && r.id_sancion) {
      // En iOS el menú de compartir no se puede abrir mientras el modal termina de cerrarse.
      await new Promise((ok) => setTimeout(ok, 600));
      try {
        await descargarYCompartirInforme(token, r.id_sancion);
      } catch (e) {
        aviso = `No se pudo generar el informe (${e.message}). Podrás descargarlo desde Moderación.`;
      }
    }
    Alert.alert("Sanción aplicada", aviso ?? "El contenido fue eliminado y la sanción quedó registrada.");
  }

  const opcion = OPCIONES.find((o) => o.valor === tipo);
  const resumen =
    tipo === "temporal" ? `${opcion.titulo} de ${Number(dias)} día(s)` : opcion?.titulo;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <KeyboardAvoidingView style={estilos.fondo} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={estilos.hoja}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={estilos.contenido}>
            <Text style={estilos.titulo}>Sancionar al autor</Text>

            {confirmando ? (
              <>
                <Text style={estilos.texto}>
                  Vas a aplicar: <Text style={estilos.negrita}>{resumen}</Text>.
                </Text>
                <Text style={estilos.texto}>{opcion.ayuda}</Text>
                <Text style={estilos.advertencia}>Esta acción no se puede deshacer.</Text>

                {enviando ? (
                  <ActivityIndicator size="large" />
                ) : (
                  <>
                    <Pressable style={estilos.botonPeligro} onPress={aplicar}>
                      <Text style={estilos.textoBoton}>Aplicar sanción</Text>
                    </Pressable>
                    <Pressable style={estilos.botonSecundario} onPress={() => setConfirmando(false)}>
                      <Text style={estilos.textoSecundario}>Volver</Text>
                    </Pressable>
                  </>
                )}
              </>
            ) : (
              <>
                {OPCIONES.map((o) => (
                  <Pressable
                    key={o.valor}
                    style={[estilos.opcion, tipo === o.valor && estilos.opcionActiva]}
                    onPress={() => setTipo(o.valor)}
                  >
                    <Text style={[estilos.negrita, tipo === o.valor && estilos.textoActivo]}>{o.titulo}</Text>
                    <Text style={estilos.ayuda}>{o.ayuda}</Text>
                  </Pressable>
                ))}

                {tipo === "temporal" && (
                  <TextInput
                    style={estilos.input}
                    value={dias}
                    onChangeText={setDias}
                    placeholder="Días de sanción (1 a 365)"
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                )}

                <Text style={estilos.etiqueta}>Comentario interno (opcional)</Text>
                <TextInput
                  style={[estilos.input, estilos.inputMultilinea]}
                  value={comentario}
                  onChangeText={setComentario}
                  placeholder="Queda registrado junto a la sanción"
                  multiline
                  maxLength={500}
                />

                {error && <Text style={estilos.error}>{error}</Text>}

                <Pressable style={[estilos.botonPeligro, !tipo && estilos.botonDeshabilitado]} onPress={pasarAConfirmacion} disabled={!tipo}>
                  <Text style={estilos.textoBoton}>Continuar</Text>
                </Pressable>
                <Pressable style={estilos.botonSecundario} onPress={onCerrar}>
                  <Text style={estilos.textoSecundario}>Cancelar</Text>
                </Pressable>
              </>
            )}

            {confirmando && error && <Text style={estilos.error}>{error}</Text>}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" },
  hoja: { backgroundColor: "white", borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "90%" },
  contenido: { padding: 24, gap: 10 },
  titulo: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  texto: { color: "#374151", fontSize: 15 },
  negrita: { fontWeight: "600", color: "#111827" },
  advertencia: { color: "#b91c1c", fontWeight: "600" },
  etiqueta: { fontSize: 14, color: "#374151", marginTop: 4 },
  ayuda: { fontSize: 12, color: "#6b7280" },
  opcion: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, padding: 12, gap: 2 },
  opcionActiva: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  textoActivo: { color: "#dc2626" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12 },
  inputMultilinea: { minHeight: 70, textAlignVertical: "top" },
  botonPeligro: { backgroundColor: "#dc2626", padding: 16, borderRadius: 8, marginTop: 8 },
  botonDeshabilitado: { opacity: 0.5 },
  textoBoton: { color: "white", textAlign: "center", fontWeight: "600" },
  botonSecundario: { padding: 12 },
  textoSecundario: { color: "#6b7280", textAlign: "center" },
  error: { color: "red", textAlign: "center" },
});