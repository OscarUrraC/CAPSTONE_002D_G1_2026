import { View, Text, StyleSheet } from "react-native";

export default function FeedScreen() {
  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo}>Feed</Text>
      <Text style={estilos.texto}>Próximamente — módulo a cargo de Javier.</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  titulo: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  texto: { color: "#6b7280" },
});