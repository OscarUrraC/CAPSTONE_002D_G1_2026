import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import AccionesPublicacion from "./AccionesPublicacion";
import { formatearFecha, nombreParaMostrar } from "../utils/formato";

// Publicación dentro del feed Para Ti: muestra de qué grupo viene (el feed mezcla varios).
// onAbrir: abre la pantalla de comentarios. onAbrirGrupo: abre el detalle del grupo.
export default function TarjetaFeed({ publicacion, onAbrir, onAbrirGrupo }) {
  const { autor, grupo } = publicacion;

  return (
    <View style={estilos.tarjeta}>
      {grupo && (
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
      </View>

      <Pressable onPress={onAbrir}>
        <Text style={estilos.contenido}>{publicacion.contenido}</Text>
      </Pressable>

      {/* Dentro del feed siempre soy miembro del grupo, por eso es interactivo. */}
      <AccionesPublicacion publicacion={publicacion} interactivo onAbrirComentarios={onAbrir} />
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
  contenido: { fontSize: 15, color: "#111827" },
});
