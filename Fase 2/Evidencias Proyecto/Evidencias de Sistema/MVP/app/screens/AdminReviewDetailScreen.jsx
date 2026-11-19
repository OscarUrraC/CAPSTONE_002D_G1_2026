import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";
import { obtenerRevisionIA, decidirRevisionIA } from "../services/api";
import { formatearFecha } from "../utils/formato";
import { ETIQUETAS_CATEGORIA, MOTIVOS_REVISION, DECISIONES_REVISION } from "../utils/moderacion";
import SancionarModal from "../components/SancionarModal";

const ESTADOS_CUENTA = { activa: "Activa", sancionada: "Sancionada", baneada: "Baneada" };

function nombre(persona) {
  if (!persona) return "—";
  return [persona.nombres, persona.primer_apellido, persona.segundo_apellido].filter(Boolean).join(" ");
}

// Mayor puntaje de una categoría entre el texto y las imágenes, y de cuál viene.
function mejorPuntaje(puntajes, categoria) {
  let mejor = { valor: puntajes?.texto?.[categoria] ?? 0, origen: "texto" };
  for (const imagen of puntajes?.imagenes ?? []) {
    const valor = imagen.puntajes?.[categoria] ?? 0;
    if (valor > mejor.valor) mejor = { valor, origen: `imagen ${imagen.orden + 1}` };
  }
  return mejor;
}

// Detalle de un contenido retenido: una publicación (tipo "publicacion") o un comentario (tipo "comentario").
export default function AdminReviewDetailScreen({ route, navigation }) {
  const { idObjetivo, tipo } = route.params;
  const esComentario = tipo === "comentario";
  const etiqueta = esComentario ? "comentario" : "publicación";
  const { token } = useAuth();

  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [objetivoSancion, setObjetivoSancion] = useState(null);

  async function cargar() {
    setError(null);
    try {
      setDetalle(await obtenerRevisionIA(token, idObjetivo, tipo));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
  }, [idObjetivo, tipo]);

  if (!detalle) {
    return (
      <View style={estilos.centrado}>
        {error ? (
          <>
            <Text style={estilos.error}>{error}</Text>
            <Pressable style={estilos.botonPrimario} onPress={cargar}>
              <Text style={estilos.textoBoton}>Reintentar</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" />
        )}
      </View>
    );
  }

  const { revision, autor, imagenes, umbrales, contexto } = detalle;
  const objetivo = esComentario ? detalle.comentario : detalle.publicacion;
  const pendiente = revision.decision === null;

  // Solo las categorías relevantes: las que se marcaron o tienen un puntaje apreciable.
  const filas = Object.keys(ETIQUETAS_CATEGORIA)
    .map((categoria) => ({
      categoria,
      ...mejorPuntaje(revision.puntajes, categoria),
      umbral: umbrales[categoria],
      marcada: revision.categorias_marcadas.includes(categoria),
    }))
    .filter((f) => f.marcada || f.valor >= 0.05)
    .sort((a, b) => b.valor - a.valor);

  async function decidir(decision) {
    setEnviando(true);
    try {
      await decidirRevisionIA(token, idObjetivo, { decision }, tipo);
    } catch (e) {
      Alert.alert("No se pudo registrar la decisión", e.message);
      setEnviando(false);
      return;
    }
    navigation.goBack(); // la cola se recarga sola al recuperar el foco
    Alert.alert(
      decision === "aprobada" ? "Aprobado" : "Rechazado",
      decision === "aprobada" ? "Ya es visible en el grupo." : "Se eliminó y se avisó al autor."
    );
  }

  function confirmar(decision) {
    const aprobar = decision === "aprobada";
    Alert.alert(
      aprobar ? `Aprobar ${etiqueta}` : `Negar ${etiqueta}`,
      aprobar
        ? `Se publicará el ${etiqueta} en el grupo.`.replace("el publicación", "la publicación")
        : "Se eliminará y se avisará al autor. No se aplica ninguna sanción.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: aprobar ? "Aprobar" : "Negar", style: aprobar ? "default" : "destructive", onPress: () => decidir(decision) },
      ]
    );
  }

  return (
    <View style={estilos.contenedor}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        {esComentario && contexto?.publicacion && (
          <>
            <Text style={estilos.seccion}>Publicación original</Text>
            <View style={estilos.caja}>
              <Text style={estilos.pequeno}>
                {contexto.publicacion.grupo ? `en ${contexto.publicacion.grupo.nombre} · ` : ""}
                {nombre(contexto.publicacion.autor)}
              </Text>
              <Text style={estilos.texto} numberOfLines={4}>
                {contexto.publicacion.contenido}
              </Text>
            </View>
          </>
        )}

        {esComentario && contexto?.padre && (
          <>
            <Text style={estilos.seccion}>Responde a</Text>
            <View style={estilos.caja}>
              <Text style={estilos.pequeno}>{nombre(contexto.padre.autor)}</Text>
              <Text style={estilos.texto}>{contexto.padre.contenido}</Text>
            </View>
          </>
        )}

        <Text style={estilos.seccion}>{esComentario ? "Comentario retenido" : "Publicación"}</Text>
        <View style={[estilos.caja, esComentario && estilos.cajaRetenida]}>
          {!esComentario && objetivo.grupo && <Text style={estilos.pequeno}>en {objetivo.grupo.nombre}</Text>}
          <Text style={estilos.texto}>{objetivo.contenido}</Text>
          <Text style={estilos.pequeno}>Intento de publicación: {formatearFecha(objetivo.creado_en)}</Text>
        </View>

        {imagenes.length > 0 && (
          <>
            <Text style={estilos.seccion}>Imágenes ({imagenes.length})</Text>
            <ScrollView horizontal contentContainerStyle={estilos.filaImagenes}>
              {imagenes.map((i) =>
                i.url ? (
                  <Image key={i.orden} source={{ uri: i.url }} style={estilos.imagen} resizeMode="contain" />
                ) : (
                  <View key={i.orden} style={[estilos.imagen, estilos.imagenVacia]}>
                    <Text style={estilos.pequeno}>No se pudo cargar</Text>
                  </View>
                )
              )}
            </ScrollView>
          </>
        )}

        <Text style={estilos.seccion}>Autor</Text>
        <View style={estilos.caja}>
          <Text style={estilos.textoNegrita}>{autor.nombre_completo}</Text>
          <Text style={estilos.pequeno}>{autor.correo}</Text>
          <Text style={estilos.pequeno}>
            Cuenta: {ESTADOS_CUENTA[autor.estado_cuenta] ?? autor.estado_cuenta} · Sanciones previas: {autor.sanciones_previas}
          </Text>
        </View>

        <Text style={estilos.seccion}>Por qué se retuvo</Text>
        <View style={estilos.caja}>
          <Text style={estilos.textoNegrita}>{MOTIVOS_REVISION[revision.motivo] ?? revision.motivo}</Text>
          {revision.puntajes === null || filas.length === 0 ? (
            <Text style={estilos.pequeno}>
              {revision.motivo === "error_api"
                ? "El filtro no pudo evaluar este contenido: revísalo manualmente."
                : "No hay puntajes relevantes que mostrar."}
            </Text>
          ) : (
            filas.map((f) => (
              <View key={f.categoria} style={estilos.filaPuntaje}>
                <Text style={[estilos.categoria, f.marcada && estilos.categoriaMarcada]}>
                  {ETIQUETAS_CATEGORIA[f.categoria]}
                  <Text style={estilos.pequeno}> · {f.origen}</Text>
                </Text>
                <Text style={[estilos.puntaje, f.marcada && estilos.categoriaMarcada]}>
                  {f.valor.toFixed(2)} / {f.umbral != null ? f.umbral.toFixed(2) : "—"}
                </Text>
              </View>
            ))
          )}
          <Text style={estilos.pequeno}>Puntaje / umbral actual. En rojo, lo que superó el umbral al momento de publicar.</Text>
        </View>

        {pendiente ? (
          <>
            <Text style={estilos.seccion}>Decidir</Text>
            {enviando ? (
              <ActivityIndicator size="large" />
            ) : (
              <>
                <Pressable style={estilos.botonAprobar} onPress={() => confirmar("aprobada")}>
                  <Text style={estilos.textoBoton}>Aprobar y publicar</Text>
                </Pressable>
                <Pressable style={estilos.botonNegar} onPress={() => confirmar("rechazada")}>
                  <Text style={estilos.textoNegar}>Negar (sin sanción)</Text>
                </Pressable>
                <Pressable style={estilos.botonSancionar} onPress={() => setObjetivoSancion({})}>
                  <Text style={estilos.textoBoton}>Sancionar al autor</Text>
                </Pressable>
              </>
            )}
          </>
        ) : (
          <>
            <Text style={estilos.seccion}>Resolución</Text>
            <View style={estilos.caja}>
              <Text style={estilos.textoNegrita}>{DECISIONES_REVISION[revision.decision] ?? revision.decision}</Text>
              {revision.revisado_en && <Text style={estilos.pequeno}>El {formatearFecha(revision.revisado_en)}</Text>}
            </View>
          </>
        )}
      </ScrollView>

      {/* Reutiliza el modal de sanción directa, pero la decisión se registra por la revisión de IA. */}
      <SancionarModal
        objetivo={objetivoSancion}
        onCerrar={() => setObjetivoSancion(null)}
        onListo={() => navigation.goBack()}
        enviar={(datos) =>
          decidirRevisionIA(
            token,
            idObjetivo,
            {
              decision: "sancionada",
              tipo_sancion: datos.tipo_sancion,
              dias: datos.dias,
              comentario: datos.comentario,
            },
            tipo
          )
        }
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "white" },
  contenido: { padding: 16, gap: 10, paddingBottom: 40 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
  seccion: { fontSize: 15, fontWeight: "bold", color: "#374151", marginTop: 10 },
  caja: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, gap: 4 },
  cajaRetenida: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  texto: { fontSize: 15, color: "#111827" },
  textoNegrita: { fontSize: 15, fontWeight: "600", color: "#111827" },
  pequeno: { fontSize: 12, color: "#6b7280", fontWeight: "normal" },
  filaImagenes: { gap: 8 },
  imagen: { width: 220, height: 220, borderRadius: 8, backgroundColor: "#f3f4f6" },
  imagenVacia: { justifyContent: "center", alignItems: "center" },
  filaPuntaje: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  categoria: { flex: 1, fontSize: 14, color: "#374151" },
  puntaje: { fontSize: 14, color: "#374151", fontVariant: ["tabular-nums"] },
  categoriaMarcada: { color: "#b91c1c", fontWeight: "700" },
  botonAprobar: { backgroundColor: "#16a34a", padding: 16, borderRadius: 8 },
  botonNegar: { borderWidth: 1, borderColor: "#dc2626", padding: 16, borderRadius: 8 },
  botonSancionar: { backgroundColor: "#dc2626", padding: 16, borderRadius: 8 },
  botonPrimario: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8 },
  textoBoton: { color: "white", textAlign: "center", fontWeight: "600" },
  textoNegar: { color: "#dc2626", textAlign: "center", fontWeight: "600" },
  error: { color: "red", textAlign: "center" },
});