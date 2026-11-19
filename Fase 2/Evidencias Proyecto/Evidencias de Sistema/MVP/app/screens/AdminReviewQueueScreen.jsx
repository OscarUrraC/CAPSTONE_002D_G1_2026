import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { listarRevisionesIA } from "../services/api";
import { formatearFecha } from "../utils/formato";
import { ETIQUETAS_CATEGORIA, MOTIVOS_REVISION, DECISIONES_REVISION } from "../utils/moderacion";

const TIPOS = { publicacion: "Publicación", comentario: "Comentario" };

// Cola de publicaciones y comentarios que el filtro de IA retuvo antes de publicarse.
export default function AdminReviewQueueScreen({ navigation }) {
  const { token } = useAuth();
  const [estado, setEstado] = useState("pendiente"); // "pendiente" | "resueltas"
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  // Se recarga al volver del detalle: lo que ya se decidió sale de Pendientes.
  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      setCargando(true);
      setError(null);
      listarRevisionesIA(token, estado)
        .then((r) => vigente && setItems(r.items))
        .catch((e) => vigente && setError(e.message))
        .finally(() => vigente && setCargando(false));
      return () => {
        vigente = false;
      };
    }, [token, estado, version])
  );

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.pestanas}>
        {[
          { valor: "pendiente", texto: "Pendientes" },
          { valor: "resueltas", texto: "Resueltas" },
        ].map((p) => (
          <Pressable
            key={p.valor}
            style={[estilos.pestana, estado === p.valor && estilos.pestanaActiva]}
            onPress={() => setEstado(p.valor)}
          >
            <Text style={[estilos.textoPestana, estado === p.valor && estilos.textoPestanaActiva]}>{p.texto}</Text>
          </Pressable>
        ))}
      </View>

      {error && (
        <View style={estilos.bloqueError}>
          <Text style={estilos.error}>{error}</Text>
          <Pressable onPress={() => setVersion((v) => v + 1)}>
            <Text style={estilos.reintentar}>Reintentar</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(i) => `${i.tipo_objetivo}:${i.id_objetivo}`}
        refreshing={cargando}
        onRefresh={() => setVersion((v) => v + 1)}
        contentContainerStyle={estilos.lista}
        ListEmptyComponent={
          !cargando &&
          !error && (
            <Text style={estilos.textoVacio}>
              {estado === "pendiente" ? "No hay contenido pendiente de revisión." : "Aún no hay revisiones resueltas."}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={estilos.tarjeta}
            onPress={() =>
              navigation.navigate("AdminRevisionDetalle", { idObjetivo: item.id_objetivo, tipo: item.tipo_objetivo })
            }
          >
            <View style={estilos.filaSuperior}>
              <Text style={estilos.tipo}>{TIPOS[item.tipo_objetivo]}</Text>
              <Text style={estilos.fecha}>{formatearFecha(item.creado_en)}</Text>
            </View>
            <Text style={estilos.grupo} numberOfLines={1}>
              en {item.grupo?.nombre ?? "—"}
            </Text>

            <Text style={estilos.vista} numberOfLines={3}>
              {item.vista_previa}
            </Text>
            <Text style={estilos.autor}>Autor: {item.autor?.nombre_completo ?? "—"}</Text>

            <View style={estilos.etiquetas}>
              {item.motivo === "error_api" ? (
                <Text style={estilos.etiquetaAviso}>{MOTIVOS_REVISION.error_api}</Text>
              ) : (
                item.categorias_marcadas.map((c) => (
                  <Text key={c} style={estilos.etiqueta}>
                    {ETIQUETAS_CATEGORIA[c] ?? c}
                  </Text>
                ))
              )}
              {item.cantidad_imagenes > 0 && (
                <Text style={estilos.etiquetaNeutra}>
                  {item.cantidad_imagenes} {item.cantidad_imagenes === 1 ? "imagen" : "imágenes"}
                </Text>
              )}
            </View>

            {estado === "resueltas" && (
              <Text style={estilos.resolucion}>{DECISIONES_REVISION[item.decision] ?? item.decision}</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "white" },
  pestanas: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  pestana: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  pestanaActiva: { borderBottomColor: "#2563eb" },
  textoPestana: { color: "#6b7280", fontWeight: "600" },
  textoPestanaActiva: { color: "#2563eb" },
  lista: { padding: 16, gap: 12 },
  tarjeta: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 14, gap: 6 },
  filaSuperior: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  tipo: { fontSize: 12, fontWeight: "700", color: "#2563eb", textTransform: "uppercase" },
  grupo: { fontSize: 12, color: "#6b7280" },
  fecha: { fontSize: 12, color: "#9ca3af" },
  vista: { fontSize: 15, color: "#111827" },
  autor: { fontSize: 12, color: "#6b7280" },
  etiquetas: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  etiqueta: { fontSize: 12, fontWeight: "600", color: "#b91c1c", backgroundColor: "#fee2e2", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
  etiquetaAviso: { fontSize: 12, fontWeight: "600", color: "#b45309", backgroundColor: "#fef3c7", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
  etiquetaNeutra: { fontSize: 12, color: "#374151", backgroundColor: "#f3f4f6", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
  resolucion: { fontSize: 12, fontWeight: "600", color: "#374151" },
  textoVacio: { color: "#9ca3af", textAlign: "center", marginTop: 40 },
  bloqueError: { padding: 16, alignItems: "center", gap: 8 },
  error: { color: "red", textAlign: "center" },
  reintentar: { color: "#2563eb", fontWeight: "600" },
});