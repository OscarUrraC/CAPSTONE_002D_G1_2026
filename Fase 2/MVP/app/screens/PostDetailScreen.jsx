import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useAuth } from "../context/AuthContext";
import {
  obtenerPublicacion,
  listarComentarios,
  crearComentario,
  eliminarComentario,
  darMeGustaComentario,
  quitarMeGustaComentario,
} from "../services/api";
import AccionesPublicacion from "../components/AccionesPublicacion";
import { emitirPublicacion } from "../utils/eventosPublicacion";
import { formatearFecha, nombreParaMostrar } from "../utils/formato";

// Pantalla de una publicación: el post, sus comentarios (con respuestas) y la caja para comentar.
// Se abre desde el feed Para Ti y desde el detalle de un grupo (ruta "DetallePublicacion").
export default function PostDetailScreen({ route }) {
  const { idPublicacion } = route.params;
  const { token } = useAuth();

  const [publicacion, setPublicacion] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [texto, setTexto] = useState("");
  const [objetivo, setObjetivo] = useState(null); // { id_comentario, nombre } si estoy respondiendo
  const [enviando, setEnviando] = useState(false);
  const [abiertos, setAbiertos] = useState({}); // id del comentario -> respuestas desplegadas
  const input = useRef(null);
  // Alto real de la cabecera: el KeyboardAvoidingView lo necesita para calcular cuánto subir la caja.
  const alturaCabecera = useHeaderHeight();

  // Recarga los comentarios y avisa a las demás pantallas el nuevo total (para el contador 💬).
  const cargarComentarios = useCallback(async () => {
    const { comentarios: arbol, total } = await listarComentarios(token, idPublicacion);
    setComentarios(arbol);
    emitirPublicacion({ id_publicacion: idPublicacion, cantidad_comentarios: total });
    return total;
  }, [token, idPublicacion]);

  const cargarTodo = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [datos] = await Promise.all([obtenerPublicacion(token, idPublicacion), cargarComentarios()]);
      setPublicacion(datos);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [token, idPublicacion, cargarComentarios]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  function responder(comentario, idRaiz) {
    setObjetivo({ id_comentario: comentario.id_comentario, nombre: nombreParaMostrar(comentario.autor) });
    setAbiertos((a) => ({ ...a, [idRaiz]: true })); // se despliega el hilo para ver la respuesta al enviarla
    input.current?.focus();
  }

  async function enviar() {
    setEnviando(true);
    try {
      await crearComentario(token, idPublicacion, texto, objetivo?.id_comentario);
      setTexto("");
      setObjetivo(null);
      await cargarComentarios();
    } catch (e) {
      Alert.alert("No se pudo publicar", e.message);
    } finally {
      setEnviando(false);
    }
  }

  function confirmarEliminar(comentario) {
    Alert.alert("Eliminar comentario", "Esta acción no se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminarComentario(token, comentario.id_comentario);
            if (objetivo?.id_comentario === comentario.id_comentario) setObjetivo(null);
            await cargarComentarios();
          } catch (e) {
            Alert.alert("No se pudo eliminar", e.message);
          }
        },
      },
    ]);
  }

  if (!publicacion) {
    return (
      <View style={estilos.centrado}>
        {error ? (
          <>
            <Text style={estilos.error}>{error}</Text>
            <Pressable style={estilos.boton} onPress={cargarTodo}>
              <Text style={estilos.textoBoton}>Reintentar</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" />
        )}
      </View>
    );
  }

  const puedeComentar = publicacion.puede_interactuar;

  return (
    <KeyboardAvoidingView
      style={estilos.contenedor}
      // "padding" en ambas plataformas: en Android con Expo SDK reciente (pantalla de borde a borde)
      // el sistema ya no redimensiona la ventana solo, así que sin esto el teclado tapa la caja.
      behavior="padding"
      keyboardVerticalOffset={alturaCabecera}
    >
      <FlatList
        data={comentarios}
        keyExtractor={(c) => c.id_comentario}
        refreshing={cargando}
        onRefresh={cargarTodo}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={estilos.lista}
        ListHeaderComponent={<CabeceraPublicacion publicacion={publicacion} />}
        ListEmptyComponent={
          !cargando && <Text style={estilos.textoVacio}>Aún no hay comentarios. ¡Sé el primero!</Text>
        }
        renderItem={({ item }) => (
          <HiloComentario
            comentario={item}
            abierto={!!abiertos[item.id_comentario]}
            alternar={() => setAbiertos((a) => ({ ...a, [item.id_comentario]: !a[item.id_comentario] }))}
            puedeInteractuar={puedeComentar}
            onResponder={responder}
            onEliminar={confirmarEliminar}
          />
        )}
      />

      {puedeComentar ? (
        <View style={estilos.cajaComentar}>
          {objetivo && (
            <View style={estilos.bannerRespuesta}>
              <Text style={estilos.textoBanner} numberOfLines={1}>
                Respondiendo a {objetivo.nombre}
              </Text>
              <Pressable onPress={() => setObjetivo(null)} hitSlop={10}>
                <Text style={estilos.cerrarBanner}>✕</Text>
              </Pressable>
            </View>
          )}
          <View style={estilos.filaInput}>
            <TextInput
              ref={input}
              style={estilos.input}
              value={texto}
              onChangeText={setTexto}
              placeholder={objetivo ? "Escribe tu respuesta..." : "Escribe un comentario..."}
              multiline
              maxLength={1000}
            />
            {enviando ? (
              <ActivityIndicator />
            ) : (
              <Pressable
                style={[estilos.botonEnviar, !texto.trim() && estilos.botonDeshabilitado]}
                onPress={enviar}
                disabled={!texto.trim()}
              >
                <Text style={estilos.textoBoton}>Enviar</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : (
        <Text style={estilos.avisoSoloLectura}>Únete al grupo para dar me gusta y comentar.</Text>
      )}
    </KeyboardAvoidingView>
  );
}

function Autor({ autor, fecha, pequeno }) {
  const tam = pequeno ? 28 : 36;
  return (
    <View style={estilos.filaAutor}>
      {autor.foto_perfil_url ? (
        <Image source={{ uri: autor.foto_perfil_url }} style={{ width: tam, height: tam, borderRadius: tam / 2 }} />
      ) : (
        <View style={{ width: tam, height: tam, borderRadius: tam / 2, backgroundColor: "#e5e7eb" }} />
      )}
      <View style={estilos.datosAutor}>
        <Text style={estilos.nombreAutor}>{nombreParaMostrar(autor)}</Text>
        <Text style={estilos.fecha}>{formatearFecha(fecha)}</Text>
      </View>
    </View>
  );
}

function CabeceraPublicacion({ publicacion }) {
  return (
    <View style={estilos.cabecera}>
      {publicacion.grupo && <Text style={estilos.grupo}>en {publicacion.grupo.nombre}</Text>}
      <Autor autor={publicacion.autor} fecha={publicacion.creado_en} />
      <Text style={estilos.contenidoPost}>{publicacion.contenido}</Text>
      <AccionesPublicacion publicacion={publicacion} interactivo={publicacion.puede_interactuar} />
      <Text style={estilos.tituloComentarios}>Comentarios</Text>
    </View>
  );
}

// Un comentario de primer nivel + sus respuestas (desplegables).
function HiloComentario({ comentario, abierto, alternar, puedeInteractuar, onResponder, onEliminar }) {
  const respuestas = comentario.respuestas ?? [];

  return (
    <View style={estilos.hilo}>
      <Comentario
        comentario={comentario}
        puedeInteractuar={puedeInteractuar}
        onResponder={() => onResponder(comentario, comentario.id_comentario)}
        onEliminar={() => onEliminar(comentario)}
      />

      {respuestas.length > 0 && (
        <Pressable onPress={alternar} style={estilos.verRespuestas} hitSlop={6}>
          <Text style={estilos.textoVerRespuestas}>
            {abierto
              ? "Ocultar respuestas"
              : `Ver ${respuestas.length} ${respuestas.length === 1 ? "respuesta" : "respuestas"}`}
          </Text>
        </Pressable>
      )}

      {abierto && (
        <View style={estilos.respuestas}>
          {respuestas.map((r) => (
            <Comentario
              key={r.id_comentario}
              comentario={r}
              pequeno
              puedeInteractuar={puedeInteractuar}
              onResponder={() => onResponder(r, comentario.id_comentario)}
              onEliminar={() => onEliminar(r)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function Comentario({ comentario, pequeno, puedeInteractuar, onResponder, onEliminar }) {
  // Comentario eliminado que se conserva solo porque tiene respuestas: no muestra contenido ni autor.
  if (comentario.eliminado) {
    return <Text style={estilos.eliminado}>Comentario eliminado</Text>;
  }

  return (
    <View style={estilos.comentario}>
      <Autor autor={comentario.autor} fecha={comentario.creado_en} pequeno={pequeno} />
      <Text style={estilos.contenido}>
        {comentario.en_respuesta_a && (
          <Text style={estilos.mencion}>@{nombreParaMostrar(comentario.en_respuesta_a)} </Text>
        )}
        {comentario.contenido}
      </Text>

      <View style={estilos.filaAcciones}>
        <BotonMeGustaComentario comentario={comentario} interactivo={puedeInteractuar} />
        {puedeInteractuar && (
          <Pressable onPress={onResponder} hitSlop={8}>
            <Text style={estilos.accion}>Responder</Text>
          </Pressable>
        )}
        {comentario.puede_eliminar && (
          <Pressable onPress={onEliminar} hitSlop={8}>
            <Text style={[estilos.accion, estilos.accionPeligro]}>Eliminar</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// Me gusta de un comentario: cambio inmediato y se corrige con la respuesta real del servidor.
function BotonMeGustaComentario({ comentario, interactivo }) {
  const { token } = useAuth();
  const [meGusta, setMeGusta] = useState(comentario.me_gusta_mio);
  const [cantidad, setCantidad] = useState(comentario.cantidad_me_gusta);
  const enCurso = useRef(false);

  useEffect(() => {
    setMeGusta(comentario.me_gusta_mio);
    setCantidad(comentario.cantidad_me_gusta);
  }, [comentario.me_gusta_mio, comentario.cantidad_me_gusta]);

  async function alternar() {
    if (!interactivo || enCurso.current) return;
    enCurso.current = true;

    const anterior = { meGusta, cantidad };
    const quiereDarMeGusta = !meGusta;
    setMeGusta(quiereDarMeGusta);
    setCantidad((n) => Math.max(0, n + (quiereDarMeGusta ? 1 : -1)));

    try {
      const accion = quiereDarMeGusta ? darMeGustaComentario : quitarMeGustaComentario;
      const real = await accion(token, comentario.id_comentario);
      setMeGusta(real.me_gusta_mio);
      setCantidad(real.cantidad_me_gusta);
    } catch (e) {
      setMeGusta(anterior.meGusta);
      setCantidad(anterior.cantidad);
      Alert.alert("No se pudo completar", e.message);
    } finally {
      enCurso.current = false;
    }
  }

  return (
    <Pressable onPress={alternar} disabled={!interactivo} hitSlop={8}>
      <Text style={[estilos.accion, meGusta && estilos.accionActiva]}>
        {meGusta ? "♥" : "♡"} {cantidad}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "white" },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
  lista: { padding: 16, gap: 14 },
  cabecera: { gap: 10, marginBottom: 6 },
  grupo: { fontSize: 12, color: "#2563eb", fontWeight: "600" },
  contenidoPost: { fontSize: 16, color: "#111827" },
  tituloComentarios: { fontSize: 15, fontWeight: "bold", color: "#374151", marginTop: 8 },
  filaAutor: { flexDirection: "row", alignItems: "center", gap: 10 },
  datosAutor: { flex: 1 },
  nombreAutor: { fontWeight: "600", color: "#111827" },
  fecha: { fontSize: 12, color: "#9ca3af" },
  hilo: { gap: 6 },
  comentario: { gap: 6 },
  contenido: { fontSize: 15, color: "#111827" },
  mencion: { color: "#2563eb", fontWeight: "600" },
  filaAcciones: { flexDirection: "row", gap: 18, alignItems: "center" },
  accion: { fontSize: 13, color: "#6b7280" },
  accionActiva: { color: "#dc2626", fontWeight: "600" },
  accionPeligro: { color: "#dc2626" },
  eliminado: { fontSize: 14, color: "#9ca3af", fontStyle: "italic" },
  verRespuestas: { alignSelf: "flex-start", paddingVertical: 2 },
  textoVerRespuestas: { fontSize: 13, color: "#2563eb", fontWeight: "600" },
  respuestas: { marginLeft: 18, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: "#e5e7eb", gap: 12 },
  textoVacio: { color: "#9ca3af", textAlign: "center", marginTop: 16 },
  error: { color: "red", textAlign: "center" },
  boton: { backgroundColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  textoBoton: { color: "white", fontWeight: "600", textAlign: "center" },
  cajaComentar: { borderTopWidth: 1, borderTopColor: "#e5e7eb", padding: 10, gap: 6, backgroundColor: "white" },
  bannerRespuesta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#eff6ff", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  textoBanner: { flex: 1, fontSize: 12, color: "#1d4ed8" },
  cerrarBanner: { fontSize: 14, color: "#1d4ed8", paddingLeft: 8 },
  filaInput: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, maxHeight: 110 },
  botonEnviar: { backgroundColor: "#2563eb", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  botonDeshabilitado: { opacity: 0.5 },
  avisoSoloLectura: { textAlign: "center", color: "#6b7280", padding: 14, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
});