import { useCallback, useRef, useState } from "react";
import { View, Text, Image, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { obtenerMisPublicaciones } from "../services/api";
import TarjetaFeed from "../components/TarjetaFeed";
import MenuAcciones from "../components/MenuAcciones";
import useAccionesPublicacion from "../hooks/useAccionesPublicacion";

const TAMANO_PAGINA = 20;

export default function ProfileScreen({ navigation }) {
  const { token, perfil, cerrarSesion } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [publicaciones, setPublicaciones] = useState([]);
  const [siguiente, setSiguiente] = useState(null); // cursor de la próxima página (null = no hay más)
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(null);
  const pidiendoMas = useRef(false); // evita pedir la misma página dos veces seguidas

  // Eliminar o sancionar una publicación mía desde aquí (o desde cualquier pantalla) la saca de la lista.
  const { abrirMenu, modales } = useAccionesPublicacion({
    onQuitada: (p) => setPublicaciones((actuales) => actuales.filter((x) => x.id_publicacion !== p.id_publicacion)),
  });

  const nombreParaMostrar =
    perfil.mostrar_apodo && perfil.apodo ? perfil.apodo : perfil.nombres;

  const cargarInicial = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await obtenerMisPublicaciones(token, { limite: TAMANO_PAGINA });
      setPublicaciones(datos.publicaciones);
      setSiguiente(datos.siguiente);
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
      const datos = await obtenerMisPublicaciones(token, { limite: TAMANO_PAGINA, antes: siguiente });
      // Por seguridad se descartan repetidas (si algo cambió entre dos páginas).
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

  // Se recarga cada vez que la pantalla toma foco (al volver de editar el perfil o de una publicación).
  useFocusEffect(
    useCallback(() => {
      cargarInicial();
    }, [cargarInicial])
  );

    const opcionesMenu = [
    { texto: "Editar perfil", onPress: () => navigation.navigate("EditarPerfil") },
    { texto: "Normas de la comunidad", onPress: () => navigation.navigate("Normas") },
    { texto: "Cerrar sesión", peligro: true, onPress: cerrarSesion },
  ];

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
    return (
      <View>
        {/* Encabezado: foto a la izquierda, datos al centro, 3 puntos a la derecha */}
        <View style={estilos.encabezado}>
          {perfil.foto_perfil_url ? (
            <Image source={{ uri: perfil.foto_perfil_url }} style={estilos.foto} />
          ) : (
            <View style={[estilos.foto, estilos.fotoVacia]} />
          )}

          <View style={estilos.datosEncabezado}>
            <Text style={estilos.nombre}>{nombreParaMostrar}</Text>
            <Text style={estilos.detalle}>{perfil.carrera?.nombre ?? "Sin carrera asignada"}</Text>
            <Text style={estilos.detalle}>
              {perfil.semestre ? `Semestre ${perfil.semestre}` : "Sin semestre asignado"}
            </Text>
          </View>

          <Pressable onPress={() => setMenuAbierto(true)} style={estilos.botonOpciones} hitSlop={8}>
            <Text style={estilos.textoBotonOpciones}>⋮</Text>
          </Pressable>
        </View>

        <View style={estilos.divisor} />
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
    return <Text style={estilos.textoPlaceholder}>Aún no has publicado en ningún grupo.</Text>;
  }

  return (
    <View style={estilos.contenedor}>
      <FlatList
        data={publicaciones}
        keyExtractor={(p) => p.id_publicacion}
        refreshing={cargando}
        onRefresh={cargarInicial}
        onEndReached={cargarMas}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={renderCabecera}
        ListEmptyComponent={renderVacio}
        ListFooterComponent={cargandoMas ? <ActivityIndicator style={estilos.pie} /> : null}
        ItemSeparatorComponent={() => <View style={estilos.separador} />}
        contentContainerStyle={estilos.lista}
        renderItem={({ item }) => (
          <View style={estilos.tarjeta}>
            <TarjetaFeed
              publicacion={item}
              interactivo={item.puede_interactuar}
              onAbrir={() => abrirPublicacion(item)}
              onAbrirGrupo={() => abrirGrupo(item)}
              onOpciones={() => abrirMenu(item)}
            />
          </View>
        )}
      />

      {/* Menú del perfil, se abre con los 3 puntos del encabezado */}
      <MenuAcciones visible={menuAbierto} opciones={opcionesMenu} onCerrar={() => setMenuAbierto(false)} />

      {/* Menú, reporte y sanción de las publicaciones */}
      {modales}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "white" },
  lista: { flexGrow: 1, paddingBottom: 16 },
  encabezado: { flexDirection: "row", alignItems: "center", padding: 20, gap: 16 },
  foto: { width: 64, height: 64, borderRadius: 32 },
  fotoVacia: { backgroundColor: "#e5e7eb" },
  datosEncabezado: { flex: 1 },
  nombre: { fontSize: 18, fontWeight: "bold" },
  detalle: { fontSize: 13, color: "#4b5563" },
  botonOpciones: { padding: 8 },
  textoBotonOpciones: { fontSize: 24, fontWeight: "bold", color: "#374151" },
  divisor: { height: 2, backgroundColor: "#111827", marginBottom: 16 },
  tarjeta: { marginHorizontal: 16 },
  separador: { height: 12 },
  pie: { marginVertical: 16 },
  vacio: { alignItems: "center", padding: 24, gap: 12 },
  textoPlaceholder: { color: "#9ca3af", textAlign: "center", marginTop: 40 },
  error: { color: "red", textAlign: "center" },
  boton: { backgroundColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  textoBoton: { color: "white", fontWeight: "600" },
});