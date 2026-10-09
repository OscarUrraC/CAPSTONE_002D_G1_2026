import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";
import { obtenerFeedParaTi } from "../services/api";
import TarjetaFeed from "../components/TarjetaFeed";

const TAMANO_PAGINA = 20;

// Feed "Para Ti": publicaciones de los grupos donde soy miembro activo, de más nueva a más antigua.
export default function FeedScreen({ navigation }) {
  const { token } = useAuth();
  const [publicaciones, setPublicaciones] = useState([]);
  const [siguiente, setSiguiente] = useState(null); // cursor de la próxima página (null = no hay más)
  const [sinGrupos, setSinGrupos] = useState(false);
  const [cargando, setCargando] = useState(true); // primera carga y pull-to-refresh
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(null);
  const pidiendoMas = useRef(false); // evita pedir la misma página dos veces seguidas
  const lista = useRef(null);

  const cargarInicial = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await obtenerFeedParaTi(token, { limite: TAMANO_PAGINA });
      setPublicaciones(datos.publicaciones);
      setSiguiente(datos.siguiente);
      setSinGrupos(datos.sin_grupos);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [token]);

  const cargarMas = useCallback(async () => {
    if (!siguiente || pidiendoMas.current) return;
    pidiendoMas.current = true;
    setCargandoMas(true);
    try {
      const datos = await obtenerFeedParaTi(token, { limite: TAMANO_PAGINA, antes: siguiente });
      // Por seguridad se descartan repetidas (si alguien publicó justo entre dos páginas).
      setPublicaciones((actuales) => {
        const ya = new Set(actuales.map((p) => p.id_publicacion));
        return [...actuales, ...datos.publicaciones.filter((p) => !ya.has(p.id_publicacion))];
      });
      setSiguiente(datos.siguiente);
    } catch (e) {
      setError(e.message);
    } finally {
      pidiendoMas.current = false;
      setCargandoMas(false);
    }
  }, [token, siguiente]);

  // Primera carga al abrir la app.
  useEffect(() => {
    cargarInicial();
  }, [cargarInicial]);

  // Al tocar la pestaña "Inicio" se recarga y vuelve arriba. Así, si te acabas de unir a un grupo
  // en la pestaña Grupos, sus publicaciones aparecen. Volver desde una publicación NO dispara esto
  // (por eso no se pierde tu posición al leer comentarios).
  useEffect(() => {
    const pestanas = navigation.getParent();
    return pestanas?.addListener("tabPress", () => {
      lista.current?.scrollToOffset({ offset: 0, animated: true });
      cargarInicial();
    });
  }, [navigation, cargarInicial]);

  function abrirPublicacion(publicacion) {
    navigation.navigate("DetallePublicacion", { idPublicacion: publicacion.id_publicacion });
  }

  function abrirGrupo(publicacion) {
    // Navega a la pestaña Grupos, a la pantalla de detalle de ese grupo.
    navigation.navigate("Grupos", {
      screen: "DetalleGrupo",
      params: { idGrupo: publicacion.id_grupo },
    });
  }

  function renderVacio() {
    if (cargando) return null;
    if (error && publicaciones.length === 0) {
      return (
        <View style={estilos.vacio}>
          <Text style={estilos.error}>{error}</Text>
          <Pressable style={estilos.boton} onPress={cargarInicial}>
            <Text style={estilos.textoBoton}>Reintentar</Text>
          </Pressable>
        </View>
      );
    }
    if (sinGrupos) {
      return (
        <View style={estilos.vacio}>
          <Text style={estilos.tituloVacio}>Tu feed está vacío</Text>
          <Text style={estilos.textoVacio}>Únete a un grupo para ver sus publicaciones aquí.</Text>
          <Pressable style={estilos.boton} onPress={() => navigation.navigate("Grupos")}>
            <Text style={estilos.textoBoton}>Explorar grupos</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={estilos.vacio}>
        <Text style={estilos.tituloVacio}>Aún no hay publicaciones</Text>
        <Text style={estilos.textoVacio}>Cuando alguien publique en tus grupos, lo verás aquí.</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={lista}
      style={estilos.contenedor}
      contentContainerStyle={estilos.lista}
      data={publicaciones}
      keyExtractor={(p) => p.id_publicacion}
      refreshing={cargando}
      onRefresh={cargarInicial}
      onEndReached={cargarMas}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={renderVacio}
      ListFooterComponent={cargandoMas ? <ActivityIndicator style={estilos.pie} /> : null}
      renderItem={({ item }) => (
        <TarjetaFeed
          publicacion={item}
          onAbrir={() => abrirPublicacion(item)}
          onAbrirGrupo={() => abrirGrupo(item)}
        />
      )}
    />
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#f9fafb" },
  lista: { padding: 16, gap: 12, flexGrow: 1 },
  pie: { marginVertical: 16 },
  vacio: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12, marginTop: 60 },
  tituloVacio: { fontSize: 18, fontWeight: "bold" },
  textoVacio: { color: "#6b7280", textAlign: "center" },
  error: { color: "red", textAlign: "center" },
  boton: { backgroundColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  textoBoton: { color: "white", fontWeight: "600" },
});
