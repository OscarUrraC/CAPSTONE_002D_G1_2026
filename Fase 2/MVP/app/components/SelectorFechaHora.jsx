import { Platform, View, Text, Pressable, StyleSheet } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";

// Une la parte elegida (fecha u hora) con el resto de la fecha actual.
function combinar(base, elegido, modo) {
  const nuevo = new Date(base);
  if (modo === "date") {
    nuevo.setFullYear(elegido.getFullYear(), elegido.getMonth(), elegido.getDate());
  } else {
    nuevo.setHours(elegido.getHours(), elegido.getMinutes(), 0, 0);
  }
  return nuevo;
}

function textoFecha(d) {
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function textoHora(d) {
  return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// Selector de fecha y hora. valor: Date. onCambio(nuevaFecha: Date).
// Android: campos tocables que abren el diálogo nativo. iOS: selectores compactos nativos.
export default function SelectorFechaHora({ valor, onCambio }) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0); // permite elegir el día de hoy (la hora se valida al guardar)

  function abrirAndroid(modo) {
    DateTimePickerAndroid.open({
      value: valor,
      mode: modo,
      is24Hour: true,
      minimumDate: modo === "date" ? hoy : undefined,
      // Solo se llama al confirmar. Si el usuario cancela, no pasa nada.
      onValueChange: (evento, seleccion) => {
        if (!seleccion) return;
        onCambio(combinar(valor, seleccion, modo));
      },
    });
  }

  if (Platform.OS === "android") {
    return (
      <View style={estilos.fila}>
        <Pressable style={estilos.campo} onPress={() => abrirAndroid("date")}>
          <Text style={estilos.etiqueta}>Fecha</Text>
          <Text style={estilos.valor}>📅 {textoFecha(valor)}</Text>
        </Pressable>
        <Pressable style={[estilos.campo, estilos.campoHora]} onPress={() => abrirAndroid("time")}>
          <Text style={estilos.etiqueta}>Hora</Text>
          <Text style={estilos.valor}>🕒 {textoHora(valor)}</Text>
        </Pressable>
      </View>
    );
  }

  // iOS
  return (
    <View style={estilos.fila}>
      <View style={estilos.campoIos}>
        <Text style={estilos.etiqueta}>Fecha</Text>
        <DateTimePicker
          value={valor}
          mode="date"
          display="compact"
          locale="es-CL"
          minimumDate={hoy}
          onValueChange={(evento, seleccion) => seleccion && onCambio(combinar(valor, seleccion, "date"))}
        />
      </View>
      <View style={estilos.campoIos}>
        <Text style={estilos.etiqueta}>Hora</Text>
        <DateTimePicker
          value={valor}
          mode="time"
          display="compact"
          locale="es-CL"
          onValueChange={(evento, seleccion) => seleccion && onCambio(combinar(valor, seleccion, "time"))}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", gap: 12 },
  campo: { flex: 2, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, backgroundColor: "white", gap: 2 },
  campoHora: { flex: 1.3 },
  campoIos: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 8, backgroundColor: "white", gap: 4, alignItems: "flex-start" },
  etiqueta: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  valor: { fontSize: 15, color: "#111827", textTransform: "capitalize" },
});