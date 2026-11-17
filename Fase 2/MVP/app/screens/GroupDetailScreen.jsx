import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, Modal, Image, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { obtenerGrupo, editarGrupo, unirseAGrupo, salirDeGrupo, listarPublicaciones, crearPublicacion } from "../services/api";
import { etiquetaCategoria } from "./GroupsScreen";
import ReportarModal from "../components/ReportarModal";
import MenuAcciones from "../components/MenuAcciones";
import TarjetaFeed from "../components/TarjetaFeed";
import useAccionesPublicacion from "../hooks/useAccionesPublicacion";
import * as ImagePicker from "expo-image-picker";

// Misma regla que ProfileScreen para mostrar el nombre.
// Se mantiene exportada: GroupMembersScreen la importa de aquí.
export function nombreParaMostrar(autor) {
  return autor.mostrar_apodo && autor.apodo ? autor.apodo : autor.nombres;
}

export default function GroupDetailScreen({ route, navigation }) {
  const { idGrupo } = route.params;
  const { token } = useAuth();
  const [grupo, setGrupo] = useState(null);
  const [publicaciones, setPublicaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [contenido, setContenido] = useState("");
  const [imagenes, setImagenes] = useState([]);
  const [publicando, setPublicando] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [objetivoReporte, setObjetivoReporte] = useState(null); // solo para reportar el grupo

  // Reportar, sancionar y eliminar publicaciones: el hook lo resuelve igual que en el feed.
  const { abrirMenu, modales } = useAccionesPublicacion({
    onQuitada: (p) => setPublicaciones((actuales) => actuales.filter((x) => x.id_publicacion !== p.id_publicacion)),
  });

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

  async function elegirImagenes() {
    const disponibles = 4 - imagenes.length;
    if (disponibles <= 0) return;
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: disponibles,
      quality: 0.8, // recomprime a JPEG: baja el peso y evita problemas con HEIC
    });
    if (resultado.canceled) return;
    setImagenes((actuales) => [...actuales, ...resultado.assets.map((a) => a.uri)].slice(0, 4));
  }

  function quitarImagen(uri) {
    setImagenes((actuales) => actuales.filter((u) => u !== uri));
  }

  async function publicar() {
    setPublicando(true);
    setError(null);
    try {
      const nueva = await crearPublicacion(token, idGrupo, contenido, imagenes);
      setContenido("");
      setImagenes([]);
      if (nueva.en_revision) {
        Alert.alert(
          "Publicación en revisión",
          "Tu publicación necesita ser revisada por un administrador antes de aparecer en el grupo."
        );
      } else {
        setPublicaciones((actuales) => [nueva, ...actuales]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setPublicando(false);
    }
  }

  // Opciones del ⋮ del header: las del grupo (las de cada publicación las maneja el hook).
  function opcionesGrupo() {
    const lista = [];
    if (gestiona) {
      lista.push({ texto: "Editar grupo", onPress: () => setEditando(true) });
    }
    if (puedeVer) {
      lista.push({
        texto: gestiona ? "Gestionar miembros" : "Ver miembros",
        onPress: () => navigation.navigate("MiembrosGrupo", { idGrupo }),
      });
    }
    if (grupo.mi_rol !== "moderador") {
      lista.push({ texto: "Reportar grupo", peligro: true, onPress: () => setObjetivoReporte({ id_grupo: idGrupo }) });
    }
    return lista;
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
                {imagenes.length > 0 && (
                  <ScrollView horizontal contentContainerStyle={estilos.filaMiniaturas}>
                    {imagenes.map((uri) => (
                      <View key={uri}>
                        <Image source={{ uri }} style={estilos.miniatura} />
                        <Pressable
                          style={estilos.quitarMiniatura}
                          onPress={() => quitarImagen(uri)}
                          hitSlop={8}
                        >
                          <Text style={estilos.textoQuitar}>✕</Text>
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                )}
                <View style={estilos.filaPublicar}>
                  <Text style={estilos.contador}>{contenido.length}/1000</Text>
                  <Pressable
                    style={[estilos.botonImagen, (imagenes.length >= 4 || publicando) && estilos.botonDeshabilitado]}
                    onPress={elegirImagenes}
                    disabled={imagenes.length >= 4 || publicando}
                  >
                    <Text style={estilos.textoBotonSecundario}>Imagen ({imagenes.length}/4)</Text>
                  </Pressable>
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
          <TarjetaFeed
            publicacion={item}
            mostrarGrupo={false}
            interactivo={grupo.mi_rol !== null}
            onOpciones={() => abrirMenu(item)}
            onAbrir={() =>
              navigation.navigate("DetallePublicacion", { idPublicacion: item.id_publicacion })
            }
          />
        )}
      />

      {/* Menú del grupo, se abre con los 3 puntos del header */}
      <MenuAcciones visible={menuAbierto} opciones={opcionesGrupo()} onCerrar={() => setMenuAbierto(false)} />

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

      {/* Menú, reporte y sanción de las publicaciones */}
      {modales}
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
  filaMiniaturas: { gap: 8, paddingVertical: 4 },
  miniatura: { width: 72, height: 72, borderRadius: 8 },
  quitarMiniatura: { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  textoQuitar: { color: "white", fontSize: 11 },
  filaPublicar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  contador: { fontSize: 12, color: "#9ca3af" },
  botonPublicar: { backgroundColor: "#2563eb", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  textoVacio: { color: "#9ca3af", textAlign: "center", marginTop: 24 },
  error: { color: "red", textAlign: "center" },
  textoBotonOpciones: { fontSize: 24, fontWeight: "bold", color: "#374151", paddingHorizontal: 8 },
  contenedorModal: { flexGrow: 1, padding: 24, gap: 12, paddingTop: 48 },
  tituloModal: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  etiqueta: { fontSize: 14, color: "#374151" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12 },
  inputMultilinea: { minHeight: 90, textAlignVertical: "top" },
});