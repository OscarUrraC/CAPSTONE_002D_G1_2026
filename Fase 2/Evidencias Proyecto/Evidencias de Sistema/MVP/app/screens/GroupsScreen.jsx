import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Modal,
  ScrollView,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { listarGrupos, crearGrupo } from "../services/api";

export const CATEGORIAS = [
  { valor: "interes", etiqueta: "Interés" },
  { valor: "academico", etiqueta: "Académico" },
  { valor: "promocion", etiqueta: "Promoción" },
];

export function etiquetaCategoria(valor) {
  return CATEGORIAS.find((c) => c.valor === valor)?.etiqueta ?? valor;
}

// Texto de la insignia según mi relación con el grupo (null = no mostrar).
function etiquetaMiEstado(grupo) {
  if (grupo.mi_rol === "moderador") return "Moderador";
  if (grupo.mi_rol === "colaborador") return "Colaborador";
  if (grupo.mi_rol === "miembro") return "Miembro";
  if (grupo.mi_estado === "pendiente_aprobacion") return "Solicitud pendiente";
  if (grupo.mi_estado === "expulsado") return "Expulsado";
  return null;
}

export default function GruposScreen({ navigation }) {
  const { token } = useAuth();
  const [grupos, setGrupos] = useState([]);
  const [categoria, setCategoria] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setGrupos(await listarGrupos(token, { categoria, q: busquedaAplicada }));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [token, categoria, busquedaAplicada]);

  // Recarga al volver a esta pantalla (por ejemplo, después de unirse o salir de un grupo).
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  function irAlGrupo(idGrupo) {
    navigation.navigate("DetalleGrupo", { idGrupo });
  }

  function alCrear(grupo) {
    setCreando(false);
    irAlGrupo(grupo.id_grupo);
  }

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.barraSuperior}>
        <TextInput
          style={estilos.buscador}
          value={busqueda}
          onChangeText={setBusqueda}
          onSubmitEditing={() => setBusquedaAplicada(busqueda)}
          placeholder="Buscar grupos..."
          returnKeyType="search"
        />
        <Pressable style={estilos.botonCrear} onPress={() => setCreando(true)}>
          <Text style={estilos.textoBotonCrear}>+ Crear</Text>
        </Pressable>
      </View>

      <View style={estilos.filaChips}>
        <Chip etiqueta="Todos" activo={categoria === null} onPress={() => setCategoria(null)} />
        {CATEGORIAS.map((c) => (
          <Chip
            key={c.valor}
            etiqueta={c.etiqueta}
            activo={categoria === c.valor}
            onPress={() => setCategoria(c.valor)}
          />
        ))}
      </View>

      {error && <Text style={estilos.error}>{error}</Text>}

      <FlatList
        data={grupos}
        keyExtractor={(grupo) => grupo.id_grupo}
        refreshing={cargando}
        onRefresh={cargar}
        contentContainerStyle={estilos.lista}
        ListEmptyComponent={
          !cargando && <Text style={estilos.textoVacio}>No hay grupos todavía. ¡Crea el primero!</Text>
        }
        renderItem={({ item }) => {
          const insignia = etiquetaMiEstado(item);
          return (
            <Pressable style={estilos.tarjeta} onPress={() => irAlGrupo(item.id_grupo)}>
              <View style={estilos.filaTitulo}>
                <Text style={estilos.nombreGrupo} numberOfLines={1}>{item.nombre}</Text>
                {insignia && <Text style={estilos.insignia}>{insignia}</Text>}
              </View>
              {item.descripcion && (
                <Text style={estilos.descripcion} numberOfLines={2}>{item.descripcion}</Text>
              )}
              <Text style={estilos.detalle}>
                {etiquetaCategoria(item.categoria)} · {item.cantidad_miembros}{" "}
                {item.cantidad_miembros === 1 ? "miembro" : "miembros"}
                {item.ingreso_limitado ? " · Ingreso limitado" : ""}
              </Text>
            </Pressable>
          );
        }}
      />

      <ModalCrearGrupo visible={creando} onCerrar={() => setCreando(false)} onCreado={alCrear} />
    </View>
  );
}

function Chip({ etiqueta, activo, onPress }) {
  return (
    <Pressable style={[estilos.chip, activo && estilos.chipActivo]} onPress={onPress}>
      <Text style={[estilos.textoChip, activo && estilos.textoChipActivo]}>{etiqueta}</Text>
    </Pressable>
  );
}

function ModalCrearGrupo({ visible, onCerrar, onCreado }) {
  const { token } = useAuth();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("interes");
  const [ingresoLimitado, setIngresoLimitado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  function limpiarYCerrar() {
    setNombre("");
    setDescripcion("");
    setCategoria("interes");
    setIngresoLimitado(false);
    setError(null);
    onCerrar();
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const grupo = await crearGrupo(token, {
        nombre,
        descripcion,
        categoria,
        ingreso_limitado: ingresoLimitado,
      });
      setNombre("");
      setDescripcion("");
      setCategoria("interes");
      setIngresoLimitado(false);
      onCreado(grupo);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={limpiarYCerrar}>
      {/* ScrollView: con el teclado abierto en pantallas chicas se puede llegar a los botones */}
      <ScrollView contentContainerStyle={estilos.contenedorModal} keyboardShouldPersistTaps="handled">
        <Text style={estilos.tituloModal}>Crear grupo</Text>

        <Text style={estilos.etiqueta}>Nombre</Text>
        <TextInput
          style={estilos.input}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Ej: ¿Quién juega Calabozos y Dragones?"
          maxLength={80}
        />

        <Text style={estilos.etiqueta}>Descripción (opcional)</Text>
        <TextInput
          style={[estilos.input, estilos.inputMultilinea]}
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="¿De qué trata el grupo?"
          multiline
          maxLength={500}
        />

        <Text style={estilos.etiqueta}>Categoría</Text>
        <View style={estilos.filaChips}>
          {CATEGORIAS.map((c) => (
            <Chip
              key={c.valor}
              etiqueta={c.etiqueta}
              activo={categoria === c.valor}
              onPress={() => setCategoria(c.valor)}
            />
          ))}
        </View>

        <View style={estilos.filaSwitch}>
          <Text style={estilos.etiqueta}>Ingreso limitado (aprobar solicitudes)</Text>
          <Switch value={ingresoLimitado} onValueChange={setIngresoLimitado} />
        </View>

        {error && <Text style={estilos.error}>{error}</Text>}

        {guardando ? (
          <ActivityIndicator size="large" />
        ) : (
          <>
            <Pressable style={estilos.boton} onPress={guardar}>
              <Text style={estilos.textoBoton}>Crear</Text>
            </Pressable>
            <Pressable style={estilos.botonSecundario} onPress={limpiarYCerrar}>
              <Text style={estilos.textoBotonSecundario}>Cancelar</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "white" },
  barraSuperior: { flexDirection: "row", gap: 8, padding: 16, paddingBottom: 8 },
  buscador: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12 },
  botonCrear: { backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 14, justifyContent: "center" },
  textoBotonCrear: { color: "white", fontWeight: "600" },
  filaChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  chipActivo: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  textoChip: { color: "#374151", fontSize: 13 },
  textoChipActivo: { color: "white", fontWeight: "600" },
  lista: { padding: 16, gap: 12 },
  tarjeta: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 14, gap: 4 },
  filaTitulo: { flexDirection: "row", alignItems: "center", gap: 8 },
  nombreGrupo: { flex: 1, fontSize: 16, fontWeight: "bold", color: "#111827" },
  insignia: { fontSize: 11, color: "#2563eb", backgroundColor: "#dbeafe", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  descripcion: { color: "#4b5563" },
  detalle: { fontSize: 12, color: "#6b7280" },
  textoVacio: { color: "#9ca3af", textAlign: "center", marginTop: 40 },
  error: { color: "red", textAlign: "center", marginHorizontal: 16, marginTop: 8 },
  contenedorModal: { flexGrow: 1, padding: 24, gap: 12, paddingTop: 48 },
  tituloModal: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  etiqueta: { fontSize: 14, color: "#374151" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12 },
  inputMultilinea: { minHeight: 90, textAlignVertical: "top" },
  filaSwitch: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  boton: { backgroundColor: "#2563eb", padding: 16, borderRadius: 8, marginTop: 24 },
  textoBoton: { color: "white", textAlign: "center", fontWeight: "600" },
  botonSecundario: { padding: 16, borderRadius: 8 },
  textoBotonSecundario: { color: "#6b7280", textAlign: "center" },
});
