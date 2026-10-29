// (lista de eventos próximos).
import { useCallback, useLayoutEffect, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { listarEventos } from "../services/api";
import { formatearFechaEvento } from "../utils/formato";

// Eventos institucionales próximos, del más cercano al más lejano.
export default function EventsScreen({ navigation }) {
  const { token, perfil } = useAuth();
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true); // solo la primera vez
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);

  const esAdmin = perfil.rol_plataforma === "administrador";

  const cargar = useCallback(async () => {
    try {
      const datos = await listarEventos(token);
      setEventos(datos.eventos);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [token]);

  // Se recarga cada vez que la pantalla vuelve a verse (al cambiar de pestaña o volver del detalle),
  // así lo que marqué en el detalle aparece marcado aquí sin hacer nada.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: esAdmin
        ? () => (
            <Pressable onPress={() => navigation.navigate("FormularioEvento")} hitSlop={8}>
              <Text style={estilos.nuevo}>+ Nuevo</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, esAdmin]);

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  function renderVacio() {
    if (cargando) return null;
    if (error) {
      return (
        <View style={estilos.vacio}>
          <Text style={estilos.error}>{error}</Text>
          <Pressable style={estilos.boton} onPress={cargar}>
            <Text style={estilos.textoBoton}>Reintentar</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={estilos.vacio}>
        <Text style={estilos.tituloVacio}>No hay eventos próximos</Text>
        <Text style={estilos.textoVacio}>Cuando se publique uno, lo verás aquí.</Text>
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

  return (
    <FlatList
      style={estilos.contenedor}
      contentContainerStyle={estilos.lista}
      data={eventos}
      keyExtractor={(e) => e.id_evento}
      refreshing={refrescando}
      onRefresh={refrescar}
      ListEmptyComponent={renderVacio}
      renderItem={({ item }) => {
        const cancelado = item.estado === "cancelado";
        return (
          <Pressable
            style={[estilos.tarjeta, cancelado && estilos.tarjetaCancelada]}
            onPress={() => navigation.navigate("DetalleEvento", { idEvento: item.id_evento })}
          >
            <View style={estilos.filaEtiquetas}>
              {cancelado && <Text style={estilos.etiquetaCancelado}>CANCELADO</Text>}
              {!cancelado && item.fecha_evento_original && (
                <Text style={estilos.etiquetaReprogramado}>REPROGRAMADO</Text>
              )}
              {item.marcado && !cancelado && <Text style={estilos.etiquetaMarcado}>🔔 Te avisaremos</Text>}
            </View>
            <Text style={[estilos.titulo, cancelado && estilos.tachado]}>{item.titulo}</Text>
            <Text style={estilos.fecha}>{formatearFechaEvento(item.fecha_evento)}</Text>
            {item.ubicacion ? <Text style={estilos.ubicacion}>📍 {item.ubicacion}</Text> : null}
          </Pressable>
        );
      }}
    />
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#f9fafb" },
  centrado: { flex: 1, justifyContent: "center" },
  lista: { padding: 16, gap: 12, flexGrow: 1 },
  nuevo: { color: "#2563eb", fontWeight: "600", fontSize: 16 },
  tarjeta: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 14, gap: 4, backgroundColor: "white" },
  tarjetaCancelada: { opacity: 0.6 },
  filaEtiquetas: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  etiquetaCancelado: { fontSize: 11, fontWeight: "700", color: "#b91c1c" },
  etiquetaReprogramado: { fontSize: 11, fontWeight: "700", color: "#b45309" },
  etiquetaMarcado: { fontSize: 11, fontWeight: "600", color: "#2563eb" },
  titulo: { fontSize: 16, fontWeight: "bold", color: "#111827" },
  tachado: { textDecorationLine: "line-through" },
  fecha: { color: "#374151", textTransform: "capitalize" },
  ubicacion: { color: "#6b7280" },
  vacio: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12, marginTop: 60 },
  tituloVacio: { fontSize: 18, fontWeight: "bold" },
  textoVacio: { color: "#6b7280", textAlign: "center" },
  error: { color: "red", textAlign: "center" },
  boton: { backgroundColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  textoBoton: { color: "white", fontWeight: "600" },
});