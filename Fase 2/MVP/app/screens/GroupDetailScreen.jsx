import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Modal,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import {
  obtenerGrupo,
  editarGrupo,
  unirseAGrupo,
  salirDeGrupo,
  listarPublicaciones,
  crearPublicacion,
  eliminarPublicacion,
} from "../services/api";
import { etiquetaCategoria } from "./GroupsScreen";
import ReportarModal from "../components/ReportarModal";
import AccionesPublicacion from "../components/AccionesPublicacion";

// Misma regla que ProfileScreen para mostrar el nombre.
export function nombreParaMostrar(autor) {
  return autor.mostrar_apodo && autor.apodo ? autor.apodo : autor.nombres;
}

function formatearFecha(iso) {
  return new Date(iso).toLocaleString("es-CL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GroupDetailScreen({ route, navigation }) {
  const { idGrupo } = route.params;
  const { token, perfil } = useAuth();
  const [grupo, setGrupo] = useState(null);
  const [publicaciones, setPublicaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [contenido, setContenido] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [objetivoReporte, setObjetivoReporte] = useState(null);

  // Solo para mostrar u ocultar botones: el backend vuelve a validar cada acción.
  const gestiona = grupo?.mi_rol === "moderador" || grupo?.mi_rol === "colaborador";
  const puedeVer = grupo !== null && (!grupo.ingreso_limitado || grupo.mi_rol !== null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await obtenerGrupo(token, idGrupo);
      setGrupo(datos);
      const visible = !datos.ingreso_limitado || datos.mi_rol !== null;
      setPublicaciones(visible ? await listarPublicaciones(token, idGrupo) : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [token, idGrupo]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: grupo?.nombre ?? "Grupo",
      headerRight: () =>
        grupo && (
          <Pressable onPress={() => setMenuAbierto(true)} hitSlop={12}>
            <Text style={estilos.textoBotonOpciones}>⋮</Text>
          </Pressable>
        ),
    });
  }, [navigation, grupo]);

  async function cambiarMembresia(accion) {
    setProcesando(true);
    setError(null);
    try {
      await accion(token, idGrupo);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  }

  function confirmarSalida() {
    const aviso = grupo.mi_rol === "colaborador" ? " Perderás tu rango de colaborador." : "";
    Alert.alert("Salir del grupo", `¿Seguro que quieres salir?${aviso}`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: () => cambiarMembresia(salirDeGrupo) },
    ]);
  }

  async function publicar() {
    setPublicando(true);
    setError(null);
    try {
      const nueva = await crearPublicacion(token, idGrupo, contenido);
      setPublicaciones((actuales) => [nueva, ...actuales]);
      setContenido("");
    } catch (e) {
      setError(e.message);
    } finally {
      setPublicando(false);
    }
  }

  function confirmarEliminar(publicacion) {
    Alert.alert("Eliminar publicación", "Esta acción no se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminarPublicacion(token, idGrupo, publicacion.id_publicacion);
            setPublicaciones((actuales) =>
              actuales.filter((p) => p.id_publicacion !== publicacion.id_publicacion)
            );
          } catch (e) {
            setError(e.message);
          }
        },
      },
    ]);
  }

  function opcionesPublicacion(publicacion) {
    const esMia = publicacion.autor.id_perfil === perfil.id_perfil;
    const botones = [];
    if (esMia || gestiona) {
      botones.push({ text: "Eliminar", style: "destructive", onPress: () => confirmarEliminar(publicacion) });
    }
    if (!esMia) {
      botones.push({
        text: "Reportar",
        onPress: () => setObjetivoReporte({ id_publicacion: publicacion.id_publicacion }),
      });
    }
    botones.push({ text: "Cancelar", style: "cancel" });
    Alert.alert("Publicación", undefined, botones);
  }

  function irAMiembros() {
    setMenuAbierto(false);
    navigation.navigate("MiembrosGrupo", { idGrupo });
  }

  function abrirEdicion() {
    setMenuAbierto(false);
    setEditando(true);
  }

  function reportarGrupo() {
    setMenuAbierto(false);
    setObjetivoReporte({ id_grupo: idGrupo });
  }

  function renderBotonMembresia() {
    if (procesando) return <ActivityIndicator />;
    if (grupo.mi_rol === "moderador") return null;
    if (grupo.mi_estado === "expulsado") {
      return <Text style={estilos.aviso}>Fuiste expulsado de este grupo.</Text>;
    }
    if (grupo.mi_estado === "pendiente_aprobacion") {
      return (
        <>
          <Text style={estilos.aviso}>Tu solicitud está pendiente de aprobación.</Text>
          <Pressable style={estilos.botonSecundario} onPress={() => cambiarMembresia(salirDeGrupo)}>
            <Text style={estilos.textoBotonSecundario}>Cancelar solicitud</Text>
          </Pressable>
        </>
      );
    }
    if (grupo.mi_estado === "activo") {
      return (
        <Pressable style={estilos.botonSecundario} onPress={confirmarSalida}>
          <Text style={estilos.textoBotonSecundario}>Salir del grupo</Text>
        </Pressable>
      );
    }
    return (
      <Pressable style={estilos.boton} onPress={() => cambiarMembresia(unirseAGrupo)}>
        <Text style={estilos.textoBoton}>
          {grupo.ingreso_limitado ? "Solicitar unirse" : "Unirse"}
        </Text>
      </Pressable>
    );
  }

  if (!grupo) {
    return (
      <View style={estilos.centrado}>
        {error ? <Text style={estilos.error}>{error}</Text> : <ActivityIndicator size="large" />}
      </View>
    );
  }

  return (
    <View style={estilos.contenedor}>
      <FlatList
        data={publicaciones}
        keyExtractor={(p) => p.id_publicacion}
        refreshing={cargando}
        onRefresh={cargar}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={estilos.lista}
        ListHeaderComponent={
          <View style={estilos.cabecera}>
            {grupo.descripcion && <Text style={estilos.descripcion}>{grupo.descripcion}</Text>}
            <Text style={estilos.detalle}>
              {etiquetaCategoria(grupo.categoria)} · {grupo.cantidad_miembros}{" "}
              {grupo.cantidad_miembros === 1 ? "miembro" : "miembros"}
              {grupo.ingreso_limitado ? " · Ingreso limitado" : ""}
            </Text>
            {(grupo.mi_rol === "moderador" || grupo.mi_rol === "colaborador") && (
              <Text style={estilos.insignia}>
                {grupo.mi_rol === "moderador" ? "Eres el moderador" : "Eres colaborador"}
              </Text>
            )}

            {renderBotonMembresia()}

            {error && <Text style={estilos.error}>{error}</Text>}

            {grupo.mi_rol !== null && (
              <View style={estilos.cajaPublicar}>
                <TextInput
                  style={estilos.inputPublicar}
                  value={contenido}
                  onChangeText={setContenido}
                  placeholder="¿Qué quieres compartir con el grupo?"
                  multiline
                  maxLength={1000}
                />
                <View style={estilos.filaPublicar}>
                  <Text style={estilos.contador}>{contenido.length}/1000</Text>
                  {publicando ? (
                    <ActivityIndicator />
                  ) : (
                    <Pressable
                      style={[estilos.botonPublicar, !contenido.trim() && estilos.botonDeshabilitado]}
                      onPress={publicar}
                      disabled={!contenido.trim()}
                    >
                      <Text style={estilos.textoBoton}>Publicar</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {!puedeVer && (
              <Text style={estilos.textoVacio}>
                Este grupo es de ingreso limitado. Solicita unirte para ver sus publicaciones.
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          puedeVer && !cargando && <Text style={estilos.textoVacio}>Aún no hay publicaciones.</Text>
        }
        renderItem={({ item }) => (
          <TarjetaPublicacion
            publicacion={item}
            onOpciones={() => opcionesPublicacion(item)}
            interactivo={grupo.mi_rol !== null}
            onAbrir={() =>
              navigation.navigate("DetallePublicacion", { idPublicacion: item.id_publicacion })
            }
          />
        )}
      />

      {/* Menú del grupo, se abre con los 3 puntos del header */}
      <Modal
        visible={menuAbierto}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuAbierto(false)}
      >
        <Pressable style={estilos.fondoModal} onPress={() => setMenuAbierto(false)}>
          <View style={estilos.menu}>
            {gestiona && (
              <Pressable style={estilos.opcionMenu} onPress={abrirEdicion}>
                <Text style={estilos.textoOpcionMenu}>Editar grupo</Text>
              </Pressable>
            )}
            {puedeVer && (
              <Pressable style={estilos.opcionMenu} onPress={irAMiembros}>
                <Text style={estilos.textoOpcionMenu}>
                  {gestiona ? "Gestionar miembros" : "Ver miembros"}
                </Text>
              </Pressable>
            )}
            {grupo.mi_rol !== "moderador" && (
              <Pressable style={estilos.opcionMenu} onPress={reportarGrupo}>
                <Text style={[estilos.textoOpcionMenu, estilos.textoOpcionPeligro]}>Reportar grupo</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>

      <ModalEditarGrupo
        grupo={grupo}
        visible={editando}
        onCerrar={() => setEditando(false)}
        onGuardado={(actualizado) => {
          setGrupo(actualizado);
          setEditando(false);
        }}
      />

      <ReportarModal objetivo={objetivoReporte} onCerrar={() => setObjetivoReporte(null)} />
    </View>
  );
}

function TarjetaPublicacion({ publicacion, onOpciones, onAbrir, interactivo }) {
  const { autor } = publicacion;
  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.filaAutor}>
        {autor.foto_perfil_url ? (
          <Image source={{ uri: autor.foto_perfil_url }} style={estilos.foto} />
        ) : (
          <View style={[estilos.foto, estilos.fotoVacia]} />
        )}
        <View style={estilos.datosAutor}>
          <Text style={estilos.nombreAutor}>{nombreParaMostrar(autor)}</Text>
          <Text style={estilos.fecha}>{formatearFecha(publicacion.creado_en)}</Text>
        </View>
        <Pressable onPress={onOpciones} hitSlop={12} style={estilos.botonOpcionesPost}>
          <Text style={estilos.textoOpcionesPost}>⋮</Text>
        </Pressable>
      </View>
      <Pressable onPress={onAbrir}>
        <Text style={estilos.contenido}>{publicacion.contenido}</Text>
      </Pressable>
      {/* Módulo Feeds: me gusta y comentarios (solo lectura si no soy miembro del grupo). */}
      <AccionesPublicacion
        publicacion={publicacion}
        interactivo={interactivo}
        onAbrirComentarios={onAbrir}
      />
    </View>
  );
}

// Edita el "post principal" del grupo: nombre y descripción.
function ModalEditarGrupo({ grupo, visible, onCerrar, onGuardado }) {
  const { token } = useAuth();
  const [nombre, setNombre] = useState(grupo.nombre);
  const [descripcion, setDescripcion] = useState(grupo.descripcion ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  // Al abrir, parte desde los valores actuales del grupo.
  useEffect(() => {
    if (!visible) return;
    setNombre(grupo.nombre);
    setDescripcion(grupo.descripcion ?? "");
    setError(null);
  }, [visible]);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      onGuardado(await editarGrupo(token, grupo.id_grupo, { nombre, descripcion }));
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      {/* ScrollView: con el teclado abierto en pantallas chicas se puede llegar a los botones */}
      <ScrollView contentContainerStyle={estilos.contenedorModal} keyboardShouldPersistTaps="handled">
        <Text style={estilos.tituloModal}>Editar grupo</Text>

        <Text style={estilos.etiqueta}>Nombre</Text>
        <TextInput style={estilos.input} value={nombre} onChangeText={setNombre} maxLength={80} />

        <Text style={estilos.etiqueta}>Descripción</Text>
        <TextInput
          style={[estilos.input, estilos.inputMultilinea]}
          value={descripcion}
          onChangeText={setDescripcion}
          multiline
          maxLength={500}
        />

        {error && <Text style={estilos.error}>{error}</Text>}

        {guardando ? (
          <ActivityIndicator size="large" />
        ) : (
          <>
            <Pressable style={estilos.boton} onPress={guardar}>
              <Text style={estilos.textoBoton}>Guardar</Text>
            </Pressable>
            <Pressable style={estilos.botonSecundario} onPress={onCerrar}>
              <Text style={estilos.textoBotonSecundario}>Cancelar</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "white" },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  lista: { padding: 16, gap: 12 },
  cabecera: { gap: 10, marginBottom: 4 },
  descripcion: { fontSize: 15, color: "#374151" },
  detalle: { fontSize: 12, color: "#6b7280" },
  insignia: { alignSelf: "flex-start", fontSize: 12, color: "#2563eb", backgroundColor: "#dbeafe", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  aviso: { color: "#6b7280", textAlign: "center" },
  boton: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8 },
  textoBoton: { color: "white", textAlign: "center", fontWeight: "600" },
  botonSecundario: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db" },
  textoBotonSecundario: { color: "#374151", textAlign: "center" },
  botonDeshabilitado: { opacity: 0.5 },
  cajaPublicar: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 12, gap: 8 },
  inputPublicar: { minHeight: 60, textAlignVertical: "top" },
  filaPublicar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  contador: { fontSize: 12, color: "#9ca3af" },
  botonPublicar: { backgroundColor: "#2563eb", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  tarjeta: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 14, gap: 8 },
  filaAutor: { flexDirection: "row", alignItems: "center", gap: 10 },
  foto: { width: 36, height: 36, borderRadius: 18 },
  fotoVacia: { backgroundColor: "#e5e7eb" },
  datosAutor: { flex: 1 },
  nombreAutor: { fontWeight: "600", color: "#111827" },
  fecha: { fontSize: 12, color: "#9ca3af" },
  botonOpcionesPost: { padding: 4 },
  textoOpcionesPost: { fontSize: 20, color: "#6b7280" },
  contenido: { fontSize: 15, color: "#111827" },
  textoVacio: { color: "#9ca3af", textAlign: "center", marginTop: 24 },
  error: { color: "red", textAlign: "center" },
  textoBotonOpciones: { fontSize: 24, fontWeight: "bold", color: "#374151", paddingHorizontal: 8 },
  fondoModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-start", alignItems: "flex-end" },
  menu: { backgroundColor: "white", borderRadius: 8, marginTop: 70, marginRight: 16, minWidth: 200, elevation: 4 },
  opcionMenu: { padding: 14 },
  textoOpcionMenu: { fontSize: 15, color: "#111827" },
  textoOpcionPeligro: { color: "#dc2626" },
  contenedorModal: { flexGrow: 1, padding: 24, gap: 12, paddingTop: 48 },
  tituloModal: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  etiqueta: { fontSize: 14, color: "#374151" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12 },
  inputMultilinea: { minHeight: 90, textAlignVertical: "top" },
});
