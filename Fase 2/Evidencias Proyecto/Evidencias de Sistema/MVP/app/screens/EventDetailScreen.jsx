// (detalle, marcar y acciones de administrador).
import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { obtenerEvento, marcarEvento, desmarcarEvento, cancelarEvento, contarNotificacionesNoLeidas } from "../services/api";
import { formatearFechaEvento } from "../utils/formato";
import { publicarNoLeidas } from "../utils/notificaciones";

export default function EventDetailScreen({ route, navigation }) {
  const { idEvento } = route.params;
  const { token, perfil } = useAuth();
  const [evento, setEvento] = useState(null);
  const [error, setError] = useState(null);
  const [enCurso, setEnCurso] = useState(false);
  const [cancelando, setCancelando] = useState(false); // muestra el cuadro del motivo
  const [motivo, setMotivo] = useState("");

  const esAdmin = perfil.rol_plataforma === "administrador";

  const cargar = useCallback(async () => {
    try {
      setEvento(await obtenerEvento(token, idEvento));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [token, idEvento]);

  // Recarga al volver del formulario de edición.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

    async function alternarMarca() {
    if (enCurso) return;
    setEnCurso(true);
    try {
      const respuesta = evento.marcado
        ? await desmarcarEvento(token, idEvento)
        : await marcarEvento(token, idEvento);
      setEvento((actual) => ({ ...actual, marcado: respuesta.marcado }));

      // Al marcar se crea un aviso de confirmación: se actualiza el contador de la pestaña Notificaciones.
      if (respuesta.marcado) {
        contarNotificacionesNoLeidas(token)
          .then((datos) => publicarNoLeidas(datos.no_leidas))
          .catch(() => {});
      }
    } catch (e) {
      Alert.alert("No se pudo actualizar", e.message);
    } finally {
      setEnCurso(false);
    }
  }

  async function confirmarCancelacion() {
    if (enCurso) return;
    setEnCurso(true);
    try {
      await cancelarEvento(token, idEvento, motivo.trim() || undefined);
      setCancelando(false);
      setMotivo("");
      await cargar();
    } catch (e) {
      Alert.alert("No se pudo cancelar", e.message);
    } finally {
      setEnCurso(false);
    }
  }

  if (error && !evento) {
    return (
      <View style={estilos.centrado}>
        <Text style={estilos.error}>{error}</Text>
        <Pressable style={estilos.boton} onPress={cargar}>
          <Text style={estilos.textoBoton}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (!evento) {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const cancelado = evento.estado === "cancelado";
  const yaOcurrio = new Date(evento.fecha_evento).getTime() <= Date.now();
  const vigente = !cancelado && !yaOcurrio;

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      {cancelado && (
        <View style={estilos.avisoCancelado}>
          <Text style={estilos.tituloAviso}>Este evento fue cancelado</Text>
          {evento.motivo_cancelacion ? <Text style={estilos.textoAviso}>{evento.motivo_cancelacion}</Text> : null}
        </View>
      )}

      <Text style={estilos.titulo}>{evento.titulo}</Text>
      <Text style={estilos.fecha}>{formatearFechaEvento(evento.fecha_evento)}</Text>
      {evento.fecha_evento_original ? (
        <Text style={estilos.reprogramado}>
          Reprogramado (antes: {formatearFechaEvento(evento.fecha_evento_original)})
        </Text>
      ) : null}
      {evento.ubicacion ? <Text style={estilos.ubicacion}>📍 {evento.ubicacion}</Text> : null}
      {evento.descripcion ? <Text style={estilos.descripcion}>{evento.descripcion}</Text> : null}

      {vigente && (
        <View style={estilos.bloque}>
          <Pressable
            style={[estilos.boton, evento.marcado && estilos.botonSecundario, enCurso && estilos.botonDeshabilitado]}
            onPress={alternarMarca}
            disabled={enCurso}
          >
            <Text style={[estilos.textoBoton, evento.marcado && estilos.textoBotonSecundario]}>
              {evento.marcado ? "Quitar aviso" : "🔔 Avísame"}
            </Text>
          </Pressable>
          <Text style={estilos.ayuda}>
            {evento.marcado
              ? "Te avisaremos 1 día antes, 3 horas antes y a la hora de inicio."
              : "Márcalo para recibir recordatorios de este evento."}
          </Text>
        </View>
      )}

      {esAdmin && vigente && (
        <View style={estilos.bloque}>
          <Text style={estilos.subtitulo}>Administración</Text>
          <Pressable
            style={[estilos.boton, estilos.botonSecundario]}
            onPress={() => navigation.navigate("FormularioEvento", { idEvento })}
          >
            <Text style={estilos.textoBotonSecundario}>Editar o reprogramar</Text>
          </Pressable>

          {!cancelando ? (
            <Pressable style={[estilos.boton, estilos.botonPeligro]} onPress={() => setCancelando(true)}>
              <Text style={estilos.textoBoton}>Cancelar evento</Text>
            </Pressable>
          ) : (
            <View style={estilos.bloque}>
              <TextInput
                style={estilos.input}
                placeholder="Motivo (opcional)"
                value={motivo}
                onChangeText={setMotivo}
                maxLength={500}
                multiline
              />
              <Pressable
                style={[estilos.boton, estilos.botonPeligro, enCurso && estilos.botonDeshabilitado]}
                onPress={confirmarCancelacion}
                disabled={enCurso}
              >
                <Text style={estilos.textoBoton}>Confirmar cancelación</Text>
              </Pressable>
              <Pressable onPress={() => { setCancelando(false); setMotivo(""); }}>
                <Text style={estilos.enlace}>Volver</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#f9fafb" },
  contenido: { padding: 16, gap: 8 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
  avisoCancelado: { backgroundColor: "#fee2e2", borderRadius: 8, padding: 12, gap: 4, marginBottom: 8 },
  tituloAviso: { color: "#b91c1c", fontWeight: "700" },
  textoAviso: { color: "#7f1d1d" },
  titulo: { fontSize: 22, fontWeight: "bold", color: "#111827" },
  fecha: { fontSize: 16, color: "#374151", textTransform: "capitalize" },
  reprogramado: { color: "#b45309", fontWeight: "600" },
  ubicacion: { fontSize: 15, color: "#6b7280" },
  descripcion: { fontSize: 15, color: "#111827", marginTop: 8 },
  bloque: { gap: 8, marginTop: 16 },
  subtitulo: { fontWeight: "700", color: "#6b7280" },
  ayuda: { color: "#6b7280", fontSize: 13, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, backgroundColor: "white", minHeight: 60 },
  boton: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center" },
  botonSecundario: { backgroundColor: "white", borderWidth: 1, borderColor: "#2563eb" },
  botonPeligro: { backgroundColor: "#dc2626" },
  botonDeshabilitado: { opacity: 0.5 },
  textoBoton: { color: "white", fontWeight: "600" },
  textoBotonSecundario: { color: "#2563eb", fontWeight: "600" },
  enlace: { color: "#2563eb", textAlign: "center", fontWeight: "600" },
  error: { color: "red", textAlign: "center" },
});