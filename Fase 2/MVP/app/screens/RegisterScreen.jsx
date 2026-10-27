import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
  Modal,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useAuth } from "../context/AuthContext";
import { obtenerCarreras, registrar } from "../services/api";

const CORREO_INSTITUCIONAL = /^[^\s@]+@duocuc\.cl$/i;

// "20020514" -> "2002-05-14" a medida que el usuario escribe.
function aplicarMascaraFecha(texto) {
  const digitos = texto.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 4) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 4)}-${digitos.slice(4)}`;
  return `${digitos.slice(0, 4)}-${digitos.slice(4, 6)}-${digitos.slice(6)}`;
}

function fechaValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  // El roundtrip atrapa fechas imposibles como 2005-02-31, que JS "corrige" sola.
  return (
    !Number.isNaN(fecha.getTime()) &&
    fecha.toISOString().slice(0, 10) === valor &&
    fecha <= new Date() &&
    fecha.getUTCFullYear() >= 1900
  );
}

// Solo para UX: el backend valida de nuevo y es el que manda.
function validar(v) {
  const errores = {};
  if (!v.nombres.trim()) errores.nombres = "Ingresa tus nombres";
  if (!v.primerApellido.trim()) errores.primerApellido = "Ingresa tu primer apellido";
  if (!CORREO_INSTITUCIONAL.test(v.correo.trim())) errores.correo = "Usa tu correo institucional @duocuc.cl";
  if (v.password.length < 8) errores.password = "Mínimo 8 caracteres";
  else if (v.password !== v.confirmacion) errores.confirmacion = "Las contraseñas no coinciden";
  if (!fechaValida(v.fechaNacimiento)) errores.fechaNacimiento = "Usa el formato AAAA-MM-DD con una fecha válida";
  if (!v.idCarrera) errores.idCarrera = "Selecciona tu carrera";
  const semestre = Number(v.semestre);
  if (!Number.isInteger(semestre) || semestre < 1 || semestre > 20) {
    errores.semestre = "Ingresa un número entre 1 y 20";
  }
  return errores;
}

const VALORES_INICIALES = {
  nombres: "",
  primerApellido: "",
  segundoApellido: "",
  correo: "",
  password: "",
  confirmacion: "",
  fechaNacimiento: "",
  idCarrera: null,
  semestre: "",
};

function Campo({ etiqueta, error, ...propsInput }) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput style={[estilos.input, error && estilos.inputConError]} {...propsInput} />
      {error && <Text style={estilos.textoError}>{error}</Text>}
    </View>
  );
}

export default function RegisterScreen() {
  const { iniciarSesion } = useAuth();
  const alturaCabecera = useHeaderHeight();

  const [valores, setValores] = useState(VALORES_INICIALES);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  const [carreras, setCarreras] = useState(null); // null = cargando
  const [errorCarreras, setErrorCarreras] = useState(null);
  const [modalCarrera, setModalCarrera] = useState(false);

  const cargarCarreras = useCallback(async () => {
    setErrorCarreras(null);
    setCarreras(null);
    try {
      setCarreras(await obtenerCarreras());
    } catch (e) {
      setErrorCarreras(e.message);
      setCarreras([]);
    }
  }, []);

  useEffect(() => {
    cargarCarreras();
  }, [cargarCarreras]);

  function cambiar(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
    // Al corregir un campo, se le quita su error para no dejar un mensaje viejo en pantalla.
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  const carreraElegida = carreras?.find((c) => c.id_carrera === valores.idCarrera);

  async function enviar() {
    const erroresNuevos = validar(valores);
    setErrores(erroresNuevos);
    if (Object.keys(erroresNuevos).length > 0) return;

    setEnviando(true);
    setErrorGeneral(null);
    try {
      const { token, perfil } = await registrar({
        correo: valores.correo.trim().toLowerCase(),
        password: valores.password,
        nombres: valores.nombres.trim(),
        primer_apellido: valores.primerApellido.trim(),
        segundo_apellido: valores.segundoApellido.trim() || undefined,
        fecha_nacimiento: valores.fechaNacimiento,
        id_carrera: valores.idCarrera,
        semestre: Number(valores.semestre),
      });
      await iniciarSesion(token, perfil);
    } catch (e) {
      setErrorGeneral(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.contenedor} behavior="padding" keyboardVerticalOffset={alturaCabecera}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Campo
          etiqueta="Nombres"
          value={valores.nombres}
          onChangeText={(t) => cambiar("nombres", t)}
          error={errores.nombres}
          autoCapitalize="words"
        />
        <Campo
          etiqueta="Primer apellido"
          value={valores.primerApellido}
          onChangeText={(t) => cambiar("primerApellido", t)}
          error={errores.primerApellido}
          autoCapitalize="words"
        />
        <Campo
          etiqueta="Segundo apellido (opcional)"
          value={valores.segundoApellido}
          onChangeText={(t) => cambiar("segundoApellido", t)}
          autoCapitalize="words"
        />
        <Campo
          etiqueta="Correo institucional"
          value={valores.correo}
          onChangeText={(t) => cambiar("correo", t)}
          error={errores.correo}
          placeholder="correo@duocuc.cl"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <Campo
          etiqueta="Contraseña"
          value={valores.password}
          onChangeText={(t) => cambiar("password", t)}
          error={errores.password}
          placeholder="Mínimo 8 caracteres"
          autoCapitalize="none"
          secureTextEntry={!verPassword}
        />
        <Campo
          etiqueta="Repite la contraseña"
          value={valores.confirmacion}
          onChangeText={(t) => cambiar("confirmacion", t)}
          error={errores.confirmacion}
          autoCapitalize="none"
          secureTextEntry={!verPassword}
        />
        <Pressable onPress={() => setVerPassword((v) => !v)} hitSlop={8}>
          <Text style={estilos.enlace}>{verPassword ? "Ocultar contraseñas" : "Mostrar contraseñas"}</Text>
        </Pressable>

        <Campo
          etiqueta="Fecha de nacimiento"
          value={valores.fechaNacimiento}
          onChangeText={(t) => cambiar("fechaNacimiento", aplicarMascaraFecha(t))}
          error={errores.fechaNacimiento}
          placeholder="AAAA-MM-DD"
          keyboardType="number-pad"
          maxLength={10}
        />

        <View style={estilos.campo}>
          <Text style={estilos.etiqueta}>Carrera</Text>
          <Pressable
            style={[estilos.input, estilos.selector, errores.idCarrera && estilos.inputConError]}
            onPress={() => setModalCarrera(true)}
            disabled={carreras === null}
          >
            <Text style={carreraElegida ? estilos.textoSelector : estilos.placeholderSelector}>
              {carreras === null ? "Cargando carreras..." : carreraElegida?.nombre ?? "Selecciona tu carrera"}
            </Text>
          </Pressable>
          {errores.idCarrera && <Text style={estilos.textoError}>{errores.idCarrera}</Text>}
          {errorCarreras && (
            <Pressable onPress={cargarCarreras} hitSlop={8}>
              <Text style={estilos.textoError}>{errorCarreras}. Toca para reintentar.</Text>
            </Pressable>
          )}
        </View>

        <Campo
          etiqueta="Semestre"
          value={valores.semestre}
          onChangeText={(t) => cambiar("semestre", t.replace(/\D/g, "").slice(0, 2))}
          error={errores.semestre}
          placeholder="Ej: 3"
          keyboardType="number-pad"
          maxLength={2}
        />

        {errorGeneral && <Text style={estilos.errorGeneral}>{errorGeneral}</Text>}

        {enviando ? (
          <ActivityIndicator size="large" />
        ) : (
          <Pressable style={estilos.boton} onPress={enviar}>
            <Text style={estilos.textoBoton}>Crear cuenta</Text>
          </Pressable>
        )}
      </ScrollView>

      <Modal visible={modalCarrera} transparent animationType="slide" onRequestClose={() => setModalCarrera(false)}>
        <Pressable style={estilos.fondoModal} onPress={() => setModalCarrera(false)}>
          {/* El Pressable interior evita que tocar dentro de la hoja cierre el modal */}
          <Pressable style={estilos.hoja} onPress={() => {}}>
            <Text style={estilos.tituloModal}>Selecciona tu carrera</Text>
            <FlatList
              data={carreras ?? []}
              keyExtractor={(c) => c.id_carrera}
              ListEmptyComponent={<Text style={estilos.vacio}>No hay carreras disponibles</Text>}
              renderItem={({ item }) => (
                <Pressable
                  style={estilos.opcion}
                  onPress={() => {
                    cambiar("idCarrera", item.id_carrera);
                    setModalCarrera(false);
                  }}
                >
                  <Text style={estilos.textoOpcion}>{item.nombre}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1 },
  contenido: { padding: 20, gap: 14, paddingBottom: 40 },
  campo: { gap: 4 },
  etiqueta: { fontWeight: "600", color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inputConError: { borderColor: "#dc2626" },
  textoError: { color: "#dc2626", fontSize: 12 },
  errorGeneral: { color: "#dc2626", textAlign: "center" },
  enlace: { color: "#2563eb", fontWeight: "600" },
  selector: { justifyContent: "center" },
  textoSelector: { fontSize: 16, color: "#111827" },
  placeholderSelector: { fontSize: 16, color: "#9ca3af" },
  boton: { backgroundColor: "#2563eb", padding: 16, borderRadius: 8, marginTop: 6 },
  textoBoton: { color: "white", textAlign: "center", fontWeight: "600" },
  fondoModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  hoja: {
    backgroundColor: "white",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "70%",
  },
  tituloModal: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  opcion: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  textoOpcion: { fontSize: 16 },
  vacio: { textAlign: "center", color: "#6b7280", paddingVertical: 16 },
});