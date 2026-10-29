import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";
import { obtenerFeedParaTi, obtenerFeedAnuncios } from "../services/api";
import TarjetaFeed from "../components/TarjetaFeed";

const TAMANO_PAGINA = 20;

const MODOS = [
  { clave: "para-ti", titulo: "Para Ti" },
  { clave: "anuncios", titulo: "Anuncios" },
];
const OBTENER = { "para-ti": obtenerFeedParaTi, anuncios: obtenerFeedAnuncios };

// Inicio: dos feeds. "Para Ti" = publicaciones de mis grupos. "Anuncios" = comunicados institucionales.
export default function FeedScreen({ navigation, route }) {
  const { token, perfil } = useAuth();
  const [modo, setModo] = useState("para-ti");
  const [publicaciones, setPublicaciones] = useState([]);
  const [siguiente, setSiguiente] = useState(null); // cursor de la próxima página (null = no hay más)
  const [sinGrupos, setSinGrupos] = useState(false);
  const [cargando, setCargando] = useState(true); // primera carga y pull-to-refresh
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(null);
  const pidiendoMas = useRef(false); // evita pedir la misma página dos veces seguidas
  const lista = useRef(null);
  const modoRef = useRef(modo); // el modo vigente, para descartar respuestas de un feed que ya cerré
  modoRef.current = modo;

  const cargarInicial = useCallback(async () => {
    const modoPedido = modo;
    setCargando(true);
    setError(null);
    try {
      const datos = await OBTENER[modoPedido](token, { limite: TAMANO_PAGINA });
      if (modoRef.current !== modoPedido) return;
      setPublicaciones(datos.publicaciones);
      setSiguiente(datos.siguiente);
      setSinGrupos(datos.sin_grupos ?? false);
    } catch (e) {
      if (modoRef.current === modoPedido) setError(e.message);
    } finally {
      if (modoRef.current === modoPedido) setCargando(false);
    }
  }, [token, modo]);

  const cargarMas = useCallback(async () => {
    if (!siguiente || pidiendoMas.current) return;
    const modoPedido = modo;
    pidiendoMas.current = true;
    setCargandoMas(true);
    try {
      const datos = await OBTENER[modoPedido](token, { limite: TAMANO_PAGINA, antes: siguiente });
      if (modoRef.current !== modoPedido) return;
      // Por seguridad se descartan repetidas (si alguien publicó justo entre dos páginas).
      setPublicaciones((actuales) => {
        const ya = new Set(actuales.map((p) => p.id_publicacion));
        return [...actuales, ...datos.publicaciones.filter((p) => !ya.has(p.id_publicacion))];
      });
      setSiguiente(datos.siguiente);
    } catch (e) {
      if (modoRef.current === modoPedido) setError(e.message);
    } finally {
      pidiendoMas.current = false;
      setCargandoMas(false);
    }
  }, [token, siguiente, modo]);

  // Carga al abrir la app y cada vez que cambia el modo (cargarInicial cambia con él).
  useEffect(() => {
    cargarInicial();
  }, [cargarInicial]);

  // Al tocar la pestaña "Inicio" se recarga el feed activo y vuelve arriba. Así, si te acabas de unir
  // a un grupo en la pestaña Grupos, sus publicaciones aparecen. Volver desde una publicación NO
  // dispara esto (por eso no se pierde tu posición al leer comentarios).
  useEffect(() => {
    const pestanas = navigation.getParent();
    return pestanas?.addListener("tabPress", () => {
      lista.current?.scrollToOffset({ offset: 0, animated: true });
      cargarInicial();
    });
  }, [navigation, cargarInicial]);

  // "Nuevo anuncio" vuelve con popTo("FeedInicio", { recargar }): se recarga el feed y sube al inicio.
  const ultimaRecarga = useRef(null);
  const recargar = route.params?.recargar;
  useEffect(() => {
    if (!recargar || recargar === ultimaRecarga.current) return;
    ultimaRecarga.current = recargar;
    lista.current?.scrollToOffset({ offset: 0, animated: false });
    cargarInicial();
  }, [recargar, cargarInicial]);

  function cambiarModo(nuevo) {
    if (nuevo === modo) return;
    // Se vacía la lista para no mostrar un instante las publicaciones del otro feed.
    setPublicaciones([]);
    setSiguiente(null);
    setSinGrupos(false);
    setError(null);
    pidiendoMas.current = false;
    setModo(nuevo);
  }

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

  function renderCabecera() {
    const puedePublicar = modo === "anuncios" && perfil.rol_plataforma === "administrador";
    return (
      <View style={estilos.cabecera}>
        <View style={estilos.selector}>
          {MODOS.map((m) => {
            const activo = m.clave === modo;
            return (
              <Pressable
                key={m.clave}
                style={[estilos.opcion, activo && estilos.opcionActiva]}
                onPress={() => cambiarModo(m.clave)}
              >
                <Text style={[estilos.textoOpcion, activo && estilos.textoOpcionActivo]}>{m.titulo}</Text>
              </Pressable>
            );
          })}
        </View>
        {puedePublicar && (
          <Pressable style={estilos.botonPublicar} onPress={() => navigation.navigate("NuevoAnuncio")}>
            <Text style={estilos.textoBoton}>Publicar anuncio</Text>
          </Pressable>
        )}
      </View>
    );
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
    if (modo === "anuncios") {
      return (
        <View style={estilos.vacio}>
          <Text style={estilos.tituloVacio}>Aún no hay anuncios</Text>
          <Text style={estilos.textoVacio}>Los comunicados de la institución aparecerán aquí.</Text>
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
      ListHeaderComponent={renderCabecera}
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
  cabecera: { gap: 12 },
  botonPublicar: { backgroundColor: "#2563eb", paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  contenedor: { flex: 1, backgroundColor: "#f9fafb" },
  lista: { padding: 16, gap: 12, flexGrow: 1 },
  pie: { marginVertical: 16 },
  cabecera: { gap: 12 },
  selector: { flexDirection: "row", backgroundColor: "#e5e7eb", borderRadius: 8, padding: 3 },
  opcion: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: "center" },
  opcionActiva: { backgroundColor: "white" },
  textoOpcion: { color: "#6b7280", fontWeight: "600" },
  textoOpcionActivo: { color: "#111827" },
  botonPublicar: { backgroundColor: "#2563eb", paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  vacio: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12, marginTop: 60 },
  tituloVacio: { fontSize: 18, fontWeight: "bold" },
  textoVacio: { color: "#6b7280", textAlign: "center" },
  error: { color: "red", textAlign: "center" },
  boton: { backgroundColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  textoBoton: { color: "white", fontWeight: "600" },
});