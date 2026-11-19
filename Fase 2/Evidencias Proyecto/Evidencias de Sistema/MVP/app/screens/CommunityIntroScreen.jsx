import { View, Text, Pressable, ScrollView, StyleSheet, Platform, StatusBar } from "react-native";

const NORMAS = [
  "Trata a los demás con respeto: no acoses, intimides ni amenaces.",
  "No publiques contenido de odio, violento, sexual ni ilegal.",
  "No hagas spam ni difundas información falsa.",
  "Publica solo lo que puedas compartir con la comunidad universitaria.",
];

const CUIDADO = [
  "Publicaciones, comentarios e imágenes pasan por un filtro automático. Si algo parece infringir las normas, queda en revisión y un administrador decide si se publica.",
  "Cualquier miembro puede reportar contenido. Los administradores revisan cada reporte.",
];

const IDENTIDAD = [
  "Puedes usar un apodo en vez de tu nombre real: actívalo en Perfil → Editar perfil. Los demás estudiantes verán tu apodo.",
  "Ten presente que el apodo no te hace anónimo: tu cuenta está asociada a tu correo institucional y los administradores pueden ver quién eres.",
  "Los casos graves pueden tener consecuencias fuera de la app, porque se informa a las autoridades de la universidad con tus datos de identificación.",
];

const CONSECUENCIAS = [
  { titulo: "Suspensión temporal", texto: "No podrás publicar, comentar ni interactuar durante el período indicado, de 1 día hasta 1 año." },
  { titulo: "Baneo permanente", texto: "Tu cuenta queda bloqueada y se elimina tu contenido: publicaciones, comentarios y los grupos que hayas creado." },
  { titulo: "Casos graves", texto: "Además del baneo, se genera un informe del incidente para las autoridades de la universidad." },
];

// Margen superior manual: como introducción esta pantalla se muestra fuera de los navegadores,
// que son los que gestionan el área segura. Dentro del perfil, el encabezado del stack ya lo resuelve.
const MARGEN_INTRO = Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) + 16 : 60;

function Lista({ items }) {
  return items.map((texto) => (
    <View key={texto} style={estilos.fila}>
      <Text style={estilos.viñeta}>•</Text>
      <Text style={estilos.texto}>{texto}</Text>
    </View>
  ));
}

// Con onContinuar = introducción tras el registro. Sin él = consulta desde el perfil (el botón vuelve atrás).
export default function CommunityIntroScreen({ onContinuar, navigation }) {
  const esIntroduccion = Boolean(onContinuar);
  const accion = onContinuar ?? (() => navigation.goBack());

  return (
    <View style={estilos.contenedor}>
      <ScrollView contentContainerStyle={[estilos.contenido, { paddingTop: esIntroduccion ? MARGEN_INTRO : 16 }]}>
        {esIntroduccion && <Text style={estilos.titulo}>Bienvenido a Connectboard</Text>}
        <Text style={estilos.mision}>
          Connectboard nace para generar comunidad y un entorno de interacción entre quienes estudiamos en la
          universidad: encuentra grupos según tus intereses, entérate de los eventos y conversa con otros estudiantes.
        </Text>

        <Text style={estilos.seccion}>Normas de convivencia</Text>
        <Lista items={NORMAS} />

        <Text style={estilos.seccion}>Cómo cuidamos la comunidad</Text>
        <Lista items={CUIDADO} />

        <Text style={estilos.seccion}>Tu identidad</Text>
        <Lista items={IDENTIDAD} />

        <Text style={estilos.seccion}>Si se incumplen las normas</Text>
        {CONSECUENCIAS.map((c) => (
          <View key={c.titulo} style={estilos.tarjeta}>
            <Text style={estilos.tarjetaTitulo}>{c.titulo}</Text>
            <Text style={estilos.texto}>{c.texto}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={estilos.pie}>
        <Pressable style={estilos.boton} onPress={accion}>
          <Text style={estilos.textoBoton}>{esIntroduccion ? "Entendido, continuar" : "Volver"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "white" },
  contenido: { paddingHorizontal: 24, paddingBottom: 16, gap: 8 },
  titulo: { fontSize: 26, fontWeight: "bold", color: "#111827" },
  mision: { fontSize: 15, color: "#374151", lineHeight: 22, marginTop: 4 },
  seccion: { fontSize: 13, fontWeight: "bold", color: "#2563eb", textTransform: "uppercase", marginTop: 20 },
  fila: { flexDirection: "row", gap: 8 },
  viñeta: { fontSize: 15, color: "#6b7280" },
  texto: { flex: 1, fontSize: 15, color: "#374151", lineHeight: 21 },
  tarjeta: { backgroundColor: "#f9fafb", borderRadius: 10, padding: 12, gap: 4, borderWidth: 1, borderColor: "#e5e7eb" },
  tarjetaTitulo: { fontSize: 15, fontWeight: "bold", color: "#111827" },
  pie: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  boton: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  textoBoton: { color: "white", fontWeight: "600", fontSize: 16 },
});