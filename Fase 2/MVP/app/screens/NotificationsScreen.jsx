import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { listarNotificaciones, marcarNotificacionLeida, marcarTodasLeidas } from "../services/api";
import { publicarNoLeidas } from "../utils/notificaciones";

const TAMANO_PAGINA = 20;

const ICONOS = {
  evento_marcado: "✅",
  evento_1dia: "📅",
  evento_3horas: "⏰",
  evento_inicio: "🔔",
  evento_reprogramado: "🔄",
  evento_cancelado: "❌",
};

function hace(iso) {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `hace ${dias} d`;
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

// Bandeja de notificaciones: recordatorios y cambios de los eventos que marqué.
export default function NotificacionesScreen({ navigation }) {
  const { token } = useAuth();
  const [notificaciones, setNotificaciones] = useState([]);
  const [siguiente, setSiguiente] = useState(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(true); // solo la primera vez
  const [refrescando, setRefrescando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const datos = await listarNotificaciones(token, { limite: TAMANO_PAGINA });
      setNotificaciones(datos.notificaciones);
      setSiguiente(datos.siguiente);
      setNoLeidas(datos.no_leidas);
      publicarNoLeidas(datos.no_leidas);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [token]);

  // Se recarga cada vez que se abre la pestaña, así siempre ves lo último.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  async function cargarMas() {
    if (!siguiente || cargandoMas) return;
    setCargandoMas(true);
    try {
      const datos = await listarNotificaciones(token, { limite: TAMANO_PAGINA, antes: siguiente });
      setNotificaciones((actuales) => {
        const ya = new Set(actuales.map((n) => n.id_notificacion));
        return [...actuales, ...datos.notificaciones.filter((n) => !ya.has(n.id_notificacion))];
      });
      setSiguiente(datos.siguiente);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargandoMas(false);
    }
  }

  function abrir(item) {
    if (!item.leida_en) {
      // Se marca como leída al instante; si el servidor falla, la próxima recarga lo corrige.
      const nuevoTotal = Math.max(0, noLeidas - 1);
      setNotificaciones((actuales) =>
        actuales.map((n) =>
          n.id_notificacion === item.id_notificacion ? { ...n, leida_en: new Date().toISOString() } : n
        )
      );
      setNoLeidas(nuevoTotal);
      publicarNoLeidas(nuevoTotal);
      marcarNotificacionLeida(token, item.id_notificacion).catch(() => {});
    }

    if (item.id_evento) {
      navigation.navigate("Eventos", { screen: "DetalleEvento", params: { idEvento: item.id_evento } });
    }
  }

  function leerTodas() {
    const ahora = new Date().toISOString();
    setNotificaciones((actuales) => actuales.map((n) => (n.leida_en ? n : { ...n, leida_en: ahora })));
    setNoLeidas(0);
    publicarNoLeidas(0);
    marcarTodasLeidas(token).catch(() => {});
  }

  function renderVacio() {
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
        <Text style={estilos.tituloVacio}>No tienes notificaciones</Text>
        <Text style={estilos.textoVacio}>Marca un evento con "Avísame" y te avisaremos aquí.</Text>
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
      data={notificaciones}
      keyExtractor={(n) => n.id_notificacion}
      refreshing={refrescando}
      onRefresh={refrescar}
      onEndReached={cargarMas}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        noLeidas > 0 ? (
          <Pressable onPress={leerTodas}>
            <Text style={estilos.leerTodas}>Marcar todas como leídas ({noLeidas})</Text>
          </Pressable>
        ) : null
      }
      ListEmptyComponent={renderVacio}
      ListFooterComponent={cargandoMas ? <ActivityIndicator style={estilos.pie} /> : null}
      renderItem={({ item }) => {
        const noLeida = !item.leida_en;
        return (
          <Pressable style={[estilos.tarjeta, noLeida && estilos.tarjetaNoLeida]} onPress={() => abrir(item)}>
            <Text style={estilos.icono}>{ICONOS[item.tipo] ?? "🔔"}</Text>
            <View style={estilos.texto}>
              <Text style={[estilos.titulo, noLeida && estilos.tituloNoLeida]}>{item.titulo}</Text>
              <Text style={estilos.cuerpo}>{item.cuerpo}</Text>
              <Text style={estilos.hace}>{hace(item.creado_en)}</Text>
            </View>
            {noLeida && <View style={estilos.punto} />}
          </Pressable>
        );
      }}
    />
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#f9fafb" },
  centrado: { flex: 1, justifyContent: "center" },
  lista: { padding: 16, gap: 10, flexGrow: 1 },
  pie: { marginVertical: 16 },
  leerTodas: { color: "#2563eb", fontWeight: "600", textAlign: "right", marginBottom: 4 },
  tarjeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "white",
  },
  tarjetaNoLeida: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  icono: { fontSize: 24 },
  texto: { flex: 1, gap: 2 },
  titulo: { fontSize: 15, color: "#111827" },
  tituloNoLeida: { fontWeight: "700" },
  cuerpo: { color: "#374151" },
  hace: { color: "#9ca3af", fontSize: 12 },
  punto: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#2563eb" },
  vacio: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12, marginTop: 60 },
  tituloVacio: { fontSize: 18, fontWeight: "bold" },
  textoVacio: { color: "#6b7280", textAlign: "center" },
  error: { color: "red", textAlign: "center" },
  boton: { backgroundColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  textoBoton: { color: "white", fontWeight: "600" },
});