import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { listarCasosModeracion } from "../services/api";

const TIPOS = { publicacion: "Publicación", comentario: "Comentario", grupo: "Grupo" };
const RESOLUCIONES = { sin_infraccion: "Sin infracción", infraccion: "Infracción" };

// Lista de casos de moderación: un caso = un contenido reportado (con todos sus reportes).
export default function AdminReportsScreen({ navigation }) {
  const { token } = useAuth();
  const [estado, setEstado] = useState("pendiente"); // "pendiente" | "resueltos"
  const [casos, setCasos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0); // al subirlo se vuelve a cargar (pull to refresh)

  // Se recarga cada vez que la pantalla vuelve a estar en foco: así, al volver del detalle
  // tras resolver un caso, la lista ya no lo muestra como pendiente.
  useFocusEffect(
    useCallback(() => {
      let vigente = true; // evita que una respuesta lenta pise a una más nueva al cambiar de pestaña
      setCargando(true);
      setError(null);
      listarCasosModeracion(token, estado)
        .then((r) => vigente && setCasos(r.casos))
        .catch((e) => vigente && setError(e.message))
        .finally(() => vigente && setCargando(false));
      return () => {
        vigente = false;
      };
    }, [token, estado, version])
  );

  function abrir(caso) {
    navigation.navigate("AdminReporteDetalle", { idReporte: caso.id_reporte_principal });
  }

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.accesos}>
        <Pressable style={estilos.acceso} onPress={() => navigation.navigate("AdminRevisionIA")}>
          <Text style={estilos.textoAcceso}>Revisión por IA</Text>
        </Pressable>
        <Pressable style={estilos.acceso} onPress={() => navigation.navigate("AdminUmbrales")}>
          <Text style={estilos.textoAcceso}>Umbrales</Text>
        </Pressable>
      </View>
      <View style={estilos.pestanas}>
        {[
          { valor: "pendiente", texto: "Pendientes" },
          { valor: "resueltos", texto: "Resueltos" },
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
        data={casos}
        keyExtractor={(c) => `${c.tipo_objetivo}:${c.id_objetivo}`}
        refreshing={cargando}
        onRefresh={() => setVersion((v) => v + 1)}
        contentContainerStyle={estilos.lista}
        ListEmptyComponent={
          !cargando &&
          !error && (
            <Text style={estilos.textoVacio}>
              {estado === "pendiente" ? "No hay reportes pendientes." : "Aún no hay reportes resueltos."}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable style={estilos.tarjeta} onPress={() => abrir(item)}>
            <View style={estilos.filaSuperior}>
              <Text style={estilos.tipo}>{TIPOS[item.tipo_objetivo]}</Text>
              <Text style={estilos.contador}>
                {item.cantidad_reportes} {item.cantidad_reportes === 1 ? "reporte" : "reportes"}
              </Text>
            </View>
            <Text style={estilos.vista} numberOfLines={3}>
              {item.vista_previa ?? "(sin contenido)"}
            </Text>
            <Text style={estilos.autor}>
              {item.tipo_objetivo === "grupo" ? "Creador: " : "Autor: "}
              {item.autor?.nombre_completo ?? "—"}
            </Text>
            {estado === "resueltos" && (
              <Text style={estilos.resolucion}>
                {RESOLUCIONES[item.reportes[0].estado] ?? item.reportes[0].estado}
              </Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "white" },
  accesos: { flexDirection: "row", gap: 8, padding: 12, paddingBottom: 0 },
  acceso: { flex: 1, borderWidth: 1, borderColor: "#2563eb", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  textoAcceso: { color: "#2563eb", fontWeight: "600" },
  pestanas: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  pestana: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  pestanaActiva: { borderBottomColor: "#2563eb" },
  textoPestana: { color: "#6b7280", fontWeight: "600" },
  textoPestanaActiva: { color: "#2563eb" },
  lista: { padding: 16, gap: 12 },
  tarjeta: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 14, gap: 6 },
  filaSuperior: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tipo: { fontSize: 12, fontWeight: "700", color: "#2563eb", textTransform: "uppercase" },
  contador: { fontSize: 12, fontWeight: "600", color: "#dc2626" },
  vista: { fontSize: 15, color: "#111827" },
  autor: { fontSize: 12, color: "#6b7280" },
  resolucion: { fontSize: 12, fontWeight: "600", color: "#374151" },
  textoVacio: { color: "#9ca3af", textAlign: "center", marginTop: 40 },
  bloqueError: { padding: 16, alignItems: "center", gap: 8 },
  error: { color: "red", textAlign: "center" },
  reintentar: { color: "#2563eb", fontWeight: "600" },
});