import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  SectionList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import {
  obtenerGrupo,
  listarMiembros,
  cambiarEstadoMiembro,
  rechazarSolicitud,
  cambiarRango,
} from "../services/api";
import { nombreParaMostrar } from "./GroupDetailScreen";

const ETIQUETA_ROL = { moderador: "Moderador", colaborador: "Colaborador" };

export default function GroupMembersScreen({ route }) {
  const { idGrupo } = route.params;
  const { token, perfil } = useAuth();
  const [miRol, setMiRol] = useState(null);
  const [miembros, setMiembros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(null); // id_perfil con una acción en curso
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [grupo, lista] = await Promise.all([
        obtenerGrupo(token, idGrupo),
        listarMiembros(token, idGrupo),
      ]);
      setMiRol(grupo.mi_rol);
      setMiembros(lista);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [token, idGrupo]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const gestiona = miRol === "moderador" || miRol === "colaborador";
  const pendientes = miembros.filter((m) => m.estado === "pendiente_aprobacion");
  const activos = miembros.filter((m) => m.estado === "activo");

  async function ejecutar(idPerfil, accion) {
    setProcesando(idPerfil);
    setError(null);
    try {
      await accion();
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(null);
    }
  }

  // Misma regla que el backend (solo para mostrar el botón): nadie actúa sobre el moderador
  // ni sobre sí mismo, y el colaborador solo sobre miembros sin rango.
  function tieneAcciones(miembro) {
    if (miembro.rol === "moderador" || miembro.id_perfil === perfil.id_perfil) return false;
    if (miRol === "moderador") return true;
    return miRol === "colaborador" && !miembro.es_colaborador;
  }

  function confirmarExpulsion(miembro, nombre) {
    Alert.alert("Expulsar miembro", `${nombre} no podrá volver a unirse al grupo.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Expulsar",
        style: "destructive",
        onPress: () =>
          ejecutar(miembro.id_perfil, () =>
            cambiarEstadoMiembro(token, idGrupo, miembro.id_perfil, "expulsado")
          ),
      },
    ]);
  }

  function opcionesMiembro(miembro) {
    const nombre = nombreParaMostrar(miembro.perfil);
    const botones = [];
    // Solo el moderador otorga o quita rangos.
    if (miRol === "moderador") {
      botones.push({
        text: miembro.es_colaborador ? "Quitar rango de colaborador" : "Hacer colaborador",
        onPress: () =>
          ejecutar(miembro.id_perfil, () =>
            cambiarRango(token, idGrupo, miembro.id_perfil, !miembro.es_colaborador)
          ),
      });
    }
    botones.push({ text: "Expulsar", style: "destructive", onPress: () => confirmarExpulsion(miembro, nombre) });
    botones.push({ text: "Cancelar", style: "cancel" });
    Alert.alert(nombre, undefined, botones);
  }

  const secciones = [
    ...(gestiona && pendientes.length > 0
      ? [{ clave: "pendientes", titulo: `Solicitudes pendientes (${pendientes.length})`, data: pendientes }]
      : []),
    { clave: "activos", titulo: `Miembros (${activos.length})`, data: activos },
  ];

  function renderAcciones(item, section) {
    if (procesando === item.id_perfil) return <ActivityIndicator />;

    if (section.clave === "pendientes") {
      return (
        <View style={estilos.filaBotones}>
          <Pressable
            style={estilos.botonAprobar}
            onPress={() =>
              ejecutar(item.id_perfil, () => cambiarEstadoMiembro(token, idGrupo, item.id_perfil, "activo"))
            }
          >
            <Text style={estilos.textoBotonAprobar}>Aprobar</Text>
          </Pressable>
          <Pressable
            style={estilos.botonRechazar}
            onPress={() => ejecutar(item.id_perfil, () => rechazarSolicitud(token, idGrupo, item.id_perfil))}
          >
            <Text style={estilos.textoBotonRechazar}>Rechazar</Text>
          </Pressable>
        </View>
      );
    }

    if (gestiona && tieneAcciones(item)) {
      return (
        <Pressable onPress={() => opcionesMiembro(item)} hitSlop={12} style={estilos.botonOpciones}>
          <Text style={estilos.textoOpciones}>⋮</Text>
        </Pressable>
      );
    }

    return null;
  }

  return (
    <View style={estilos.contenedor}>
      {error && <Text style={estilos.error}>{error}</Text>}
      <SectionList
        sections={secciones}
        keyExtractor={(m) => m.id_perfil}
        refreshing={cargando}
        onRefresh={cargar}
        contentContainerStyle={estilos.lista}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={estilos.tituloSeccion}>{section.titulo}</Text>
        )}
        renderItem={({ item, section }) => {
          const etiqueta = ETIQUETA_ROL[item.rol];
          const esYo = item.id_perfil === perfil.id_perfil;
          return (
            <View style={estilos.fila}>
              {item.perfil.foto_perfil_url ? (
                <Image source={{ uri: item.perfil.foto_perfil_url }} style={estilos.foto} />
              ) : (
                <View style={[estilos.foto, estilos.fotoVacia]} />
              )}
              <View style={estilos.datos}>
                <Text style={estilos.nombre}>
                  {nombreParaMostrar(item.perfil)}
                  {esYo ? " (tú)" : ""}
                </Text>
                {etiqueta && <Text style={estilos.insignia}>{etiqueta}</Text>}
              </View>
              {renderAcciones(item, section)}
            </View>
          );
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "white" },
  lista: { padding: 16 },
  tituloSeccion: { fontSize: 13, fontWeight: "bold", color: "#6b7280", marginTop: 16, marginBottom: 8, textTransform: "uppercase" },
  fila: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  foto: { width: 40, height: 40, borderRadius: 20 },
  fotoVacia: { backgroundColor: "#e5e7eb" },
  datos: { flex: 1, gap: 2 },
  nombre: { fontSize: 15, color: "#111827" },
  insignia: { alignSelf: "flex-start", fontSize: 11, color: "#2563eb", backgroundColor: "#dbeafe", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  filaBotones: { flexDirection: "row", gap: 8 },
  botonAprobar: { backgroundColor: "#2563eb", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  textoBotonAprobar: { color: "white", fontWeight: "600", fontSize: 13 },
  botonRechazar: { borderWidth: 1, borderColor: "#d1d5db", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  textoBotonRechazar: { color: "#374151", fontSize: 13 },
  botonOpciones: { padding: 4 },
  textoOpciones: { fontSize: 20, color: "#6b7280" },
  error: { color: "red", textAlign: "center", marginTop: 12, marginHorizontal: 16 },
});
