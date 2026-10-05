import { useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
} from "react-native";
import { useAuth } from "../context/AuthContext";

export default function ProfileScreen({ navigation }) {
  const { perfil, cerrarSesion } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const nombreParaMostrar =
    perfil.mostrar_apodo && perfil.apodo ? perfil.apodo : perfil.nombres;

  function irAEditar() {
    setMenuAbierto(false);
    navigation.navigate("EditarPerfil");
  }

  function salir() {
    setMenuAbierto(false);
    cerrarSesion();
  }

  return (
    <View style={estilos.contenedor}>
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

        <Pressable onPress={() => setMenuAbierto(true)} style={estilos.botonOpciones}>
          <Text style={estilos.textoBotonOpciones}>⋮</Text>
        </Pressable>
      </View>

      <View style={estilos.divisor} />

      {/* Cuerpo: placeholder — acá van las publicaciones del perfil cuando exista el Feed */}
      <ScrollView style={estilos.cuerpo} contentContainerStyle={estilos.cuerpoContenido}>
        <Text style={estilos.textoPlaceholder}>Aún no hay publicaciones.</Text>
      </ScrollView>

      <View style={estilos.divisor} />

      {/* Menú de opciones, se abre con los 3 puntos */}
      <Modal
        visible={menuAbierto}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuAbierto(false)}
      >
        <Pressable style={estilos.fondoModal} onPress={() => setMenuAbierto(false)}>
          <View style={estilos.menu}>
            <Pressable style={estilos.opcionMenu} onPress={irAEditar}>
              <Text style={estilos.textoOpcionMenu}>Editar perfil</Text>
            </Pressable>
            <View style={estilos.separadorMenu} />
            <Pressable style={estilos.opcionMenu} onPress={salir}>
              <Text style={[estilos.textoOpcionMenu, estilos.textoOpcionPeligro]}>Cerrar sesión</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "white" },
  encabezado: { flexDirection: "row", alignItems: "center", padding: 20, gap: 16 },
  foto: { width: 64, height: 64, borderRadius: 32 },
  fotoVacia: { backgroundColor: "#e5e7eb" },
  datosEncabezado: { flex: 1 },
  nombre: { fontSize: 18, fontWeight: "bold" },
  detalle: { fontSize: 13, color: "#4b5563" },
  botonOpciones: { padding: 8 },
  textoBotonOpciones: { fontSize: 24, fontWeight: "bold", color: "#374151" },
  divisor: { height: 2, backgroundColor: "#111827" },
  cuerpo: { flex: 1 },
  cuerpoContenido: { padding: 20 },
  textoPlaceholder: { color: "#9ca3af", textAlign: "center", marginTop: 40 },
  fondoModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-start", alignItems: "flex-end" },
  menu: { backgroundColor: "white", borderRadius: 8, marginTop: 70, marginRight: 16, minWidth: 180, elevation: 4 },
  opcionMenu: { padding: 14 },
  textoOpcionMenu: { fontSize: 15, color: "#111827" },
  textoOpcionPeligro: { color: "#dc2626" },
  separadorMenu: { height: 1, backgroundColor: "#e5e7eb" },
});