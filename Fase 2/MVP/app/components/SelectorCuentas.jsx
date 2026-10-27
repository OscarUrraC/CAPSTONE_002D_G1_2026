import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { listarCuentas, quitarCuenta } from "../services/cuentas";
import { obtenerPerfil } from "../services/api";

// Recibe onEntrar(token, perfil) y onError(mensaje) desde la pantalla de login.
export default function SelectorCuentas({ onEntrar, onError }) {
  const [cuentas, setCuentas] = useState([]);

  // Se recarga cada vez que la pantalla gana foco (por ejemplo, tras cerrar sesión).
  useFocusEffect(
    useCallback(() => {
      listarCuentas().then(setCuentas);
    }, [])
  );

  async function entrar(cuenta) {
    try {
      // Validar el token ANTES de entrar: si venció, obtenerPerfil lanza error.
      const perfil = await obtenerPerfil(cuenta.token);
      // Se mezclan los datos guardados con los frescos para no perder rol_plataforma
      // si GET /perfil/me no lo incluye.
      await onEntrar(cuenta.token, { ...cuenta, ...perfil });
    } catch {
      onError(`La sesión de ${cuenta.correo} venció. Inicia sesión con su contraseña.`);
    }
  }

  function confirmarQuitar(cuenta) {
    Alert.alert("Quitar cuenta", `¿Quitar ${cuenta.correo} de este dispositivo?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar",
        style: "destructive",
        onPress: async () => {
          await quitarCuenta(cuenta.id_perfil);
          setCuentas(await listarCuentas());
        },
      },
    ]);
  }

  if (cuentas.length === 0) return null;

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo}>Cuentas en este dispositivo</Text>
      {cuentas.map((c) => (
        <Pressable
          key={c.id_perfil}
          style={estilos.fila}
          onPress={() => entrar(c)}
          onLongPress={() => confirmarQuitar(c)}
        >
          <View style={estilos.datos}>
            <Text style={estilos.nombre}>
              {c.nombres} {c.primer_apellido}
            </Text>
            <Text style={estilos.correo}>{c.correo}</Text>
          </View>
          {c.rol_plataforma === "administrador" && <Text style={estilos.etiqueta}>Administrador</Text>}
        </Pressable>
      ))}
      <Text style={estilos.ayuda}>Mantén presionada una cuenta para quitarla.</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: 8 },
  titulo: { textAlign: "center", color: "#9ca3af", fontSize: 12 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
  },
  datos: { flex: 1 },
  nombre: { fontSize: 16, fontWeight: "600", color: "#111827" },
  correo: { fontSize: 13, color: "#6b7280" },
  etiqueta: { color: "#b45309", fontWeight: "600", fontSize: 12, marginLeft: 8 },
  ayuda: { textAlign: "center", color: "#9ca3af", fontSize: 11 },
});