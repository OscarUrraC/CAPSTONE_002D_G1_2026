import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import AccionesPublicacion from "./AccionesPublicacion";
import { formatearFecha, nombreParaMostrar } from "../utils/formato";
import ImagenesPublicacion from "./PublicacionImagenes";

// Publicación dentro de un feed o lista.
// onAbrir: abre la pantalla de comentarios. onAbrirGrupo: abre el detalle del grupo.
// onOpciones: abre el menú de acciones (el ⋮ solo se muestra si hay alguna acción permitida).
// mostrarGrupo: false cuando la lista ya es de un solo grupo y repetir "en <grupo>" sobra.
export default function TarjetaFeed({ publicacion, onAbrir, onAbrirGrupo, onOpciones, mostrarGrupo = true, interactivo = true }) {
  const { autor, grupo, permisos } = publicacion;
  const hayAcciones = !!permisos && (permisos.eliminar || permisos.reportar || permisos.sancionar);

  return (
    <View style={estilos.tarjeta}>
      {mostrarGrupo && grupo && (
        <Pressable onPress={onAbrirGrupo} hitSlop={6}>
          <Text style={estilos.grupo}>en {grupo.nombre}</Text>
        </Pressable>
      )}

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
        {onOpciones && hayAcciones && (
          <Pressable onPress={onOpciones} hitSlop={12} style={estilos.botonOpciones}>
            <Text style={estilos.textoOpciones}>⋮</Text>
          </Pressable>
        )}
      </View>

      <Pressable onPress={onAbrir}>
        <Text style={estilos.contenido}>{publicacion.contenido}</Text>
      </Pressable>

      <ImagenesPublicacion imagenes={publicacion.imagenes} />
      <AccionesPublicacion publicacion={publicacion} interactivo={interactivo} onAbrirComentarios={onAbrir} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 14, gap: 8, backgroundColor: "white" },
  grupo: { fontSize: 12, color: "#2563eb", fontWeight: "600" },
  filaAutor: { flexDirection: "row", alignItems: "center", gap: 10 },
  foto: { width: 36, height: 36, borderRadius: 18 },
  fotoVacia: { backgroundColor: "#e5e7eb" },
  datosAutor: { flex: 1 },
  nombreAutor: { fontWeight: "600", color: "#111827" },
  fecha: { fontSize: 12, color: "#9ca3af" },
  botonOpciones: { padding: 4 },
  textoOpciones: { fontSize: 20, color: "#6b7280" },
  contenido: { fontSize: 15, color: "#111827" },
});