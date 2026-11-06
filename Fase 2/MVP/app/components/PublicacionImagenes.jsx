import { View, Image, StyleSheet } from "react-native";

export default function ImagenesPublicacion({ imagenes }) {
  if (!imagenes?.length) return null;
  const unica = imagenes.length === 1;
  return (
    <View style={estilos.fila}>
      {imagenes.map((img) => (
        <Image
          key={img.orden}
          source={{ uri: img.url }}
          style={unica ? estilos.unica : estilos.varias}
          resizeMode="cover"
        />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  unica: { width: "100%", height: 220, borderRadius: 8, backgroundColor: "#e5e7eb" },
  varias: { width: "48.5%", height: 140, borderRadius: 8, backgroundColor: "#e5e7eb" },
});