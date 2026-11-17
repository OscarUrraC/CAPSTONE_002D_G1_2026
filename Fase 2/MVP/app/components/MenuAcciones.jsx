import { Modal, View, Text, Pressable, StyleSheet } from "react-native";

// Hoja inferior con una lista de acciones. Es el único menú de la app para publicaciones y comentarios.
// opciones: [{ texto, peligro?, onPress }]
export default function MenuAcciones({ visible, opciones, onCerrar }) {
  function elegir(opcion) {
    onCerrar();
    // Se espera a que el modal termine de cerrarse: en iOS un Alert abierto durante el cierre no aparece.
    setTimeout(opcion.onPress, 300);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={estilos.fondo} onPress={onCerrar}>
        {/* El Pressable interno con onPress vacío evita que tocar la hoja la cierre. */}
        <Pressable style={estilos.hoja} onPress={() => {}}>
          {opciones.map((o) => (
            <Pressable key={o.texto} style={estilos.opcion} onPress={() => elegir(o)}>
              <Text style={[estilos.texto, o.peligro && estilos.textoPeligro]}>{o.texto}</Text>
            </Pressable>
          ))}
          <Pressable style={[estilos.opcion, estilos.cancelar]} onPress={onCerrar}>
            <Text style={estilos.textoCancelar}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" },
  hoja: { backgroundColor: "white", borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 8, paddingBottom: 32 },
  opcion: { paddingVertical: 16, paddingHorizontal: 24 },
  texto: { fontSize: 16, color: "#111827" },
  textoPeligro: { color: "#dc2626" },
  cancelar: { borderTopWidth: 1, borderTopColor: "#e5e7eb", marginTop: 4 },
  textoCancelar: { fontSize: 16, color: "#6b7280", textAlign: "center" },
});