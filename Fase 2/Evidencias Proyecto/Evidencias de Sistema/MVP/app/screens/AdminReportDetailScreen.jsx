import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, StyleSheet } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useAuth } from "../context/AuthContext";
import { obtenerDetalleReporte, resolverReporte } from "../services/api";
import { formatearFecha } from "../utils/formato";
import { descargarYCompartirInforme } from "../utils/informe";
const TIPOS = { publicacion: "Publicación", comentario: "Comentario", grupo: "Grupo" };
const ESTADOS_REPORTE = { pendiente: "Pendiente", sin_infraccion: "Sin infracción", infraccion: "Infracción" };
const ESTADOS_CUENTA = { activa: "Activa", sancionada: "Sancionada", baneada: "Baneada" };
const TIPOS_SANCION = { temporal: "Temporal", baneo: "Baneo permanente", escalado: "Escalado a la institución" };

function nombre(persona) {
  if (!persona) return "—";
  return [persona.nombres, persona.primer_apellido, persona.segundo_apellido].filter(Boolean).join(" ");
}

export default function AdminReportDetailScreen({ route, navigation }) {
  const { idReporte } = route.params;
  const { token } = useAuth();
  const alturaCabecera = useHeaderHeight();

  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState(null);

  // Formulario de resolución
  const [resolucion, setResolucion] = useState(null); // "sin_infraccion" | "infraccion" | "escalar"
  const [tipoSancion, setTipoSancion] = useState(null); // "temporal" | "baneo"
  const [dias, setDias] = useState("");
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [descargando, setDescargando] = useState(false);

  async function cargar() {
    setError(null);
    try {
      setDetalle(await obtenerDetalleReporte(token, idReporte));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
  }, [idReporte]);

  if (!detalle) {
    return (
      <View style={estilos.centrado}>
        {error ? (
          <>
            <Text style={estilos.error}>{error}</Text>
            <Pressable style={estilos.boton} onPress={cargar}>
              <Text style={estilos.textoBoton}>Reintentar</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" />
        )}
      </View>
    );
  }

  const { objetivo, autor, reportes, contexto, sancion } = detalle;
  const tipo = objetivo.tipo;
  const esGrupo = tipo === "grupo";
  const pendiente = detalle.reporte.estado === "pendiente";
  const yaEliminado = objetivo.estado === "eliminada" || objetivo.estado === "eliminado";

  const opciones = [
    {
      valor: "sin_infraccion",
      titulo: "Sin infracción",
      ayuda: "Se descarta el reporte y se avisa a quienes reportaron.",
    },
    {
      valor: "infraccion",
      titulo: "Infracción",
      ayuda: esGrupo ? "El grupo se elimina." : "El contenido se elimina y se sanciona al autor (temporal o baneo permanente).",
    },
    ...(esGrupo
      ? []
      : [
          {
            valor: "escalar",
            titulo: "Escalar a la institución",
            ayuda: "Baneo permanente. Se oculta todo el contenido del autor y se registra el caso para informar a la universidad.",
          },
        ]),
  ];

  // Valida el formulario y arma lo que se envía al backend y el resumen para confirmar.
  function construir() {
    if (!resolucion) return { error: "Elige una resolución." };

    const datos = { resolucion };
    if (comentario.trim()) datos.comentario = comentario.trim();

    if (resolucion === "sin_infraccion") {
      return { datos, resumen: "Sin infracción: se descarta el reporte." };
    }
    if (resolucion === "escalar") {
            return {datos, resumen: "Escalar: se banea permanentemente al autor, se oculta todo su contenido y sus grupos, y se le saca de los demás grupos. El caso queda registrado para informar a la universidad.",
      };
    }
    if (esGrupo) {
      return { datos, resumen: "Infracción: el grupo será eliminado." };
    }

    if (!tipoSancion) return { error: "Elige el tipo de sanción." };
    datos.tipo_sancion = tipoSancion;
    if (tipoSancion === "baneo") {
      return { datos, resumen: "Infracción: se banea permanentemente al autor, se oculta todo su contenido y sus grupos, y se le saca de los demás grupos." };
    }
    const n = Number(dias);
    if (!Number.isInteger(n) || n < 1 || n > 365) {
      return { error: "Los días deben ser un número entero entre 1 y 365." };
    }
    datos.dias = n;
    return { datos, resumen: `Infracción: se elimina el contenido y se sanciona al autor por ${n} día(s).` };
  }

  function confirmar() {
    const r = construir();
    if (r.error) {
      Alert.alert("Revisa el formulario", r.error);
      return;
    }
    Alert.alert("Confirmar resolución", `${r.resumen}\n\nEsta acción no se puede deshacer.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Resolver", style: "destructive", onPress: () => enviar(r.datos) },
    ]);
  }

    async function enviar(datos) {
    setEnviando(true);
    let r;
    try {
      r = await resolverReporte(token, idReporte, datos);
    } catch (e) {
      Alert.alert("No se pudo resolver", e.message);
      setEnviando(false);
      return;
    }

    // Escalar: el informe se genera y se ofrece al instante. Si falla, el caso igual quedó resuelto
    // y el informe se puede volver a descargar desde el detalle del caso.
    let avisoInforme = null;
    if (datos.resolucion === "escalar" && r.id_sancion) {
      try {
        await descargarYCompartirInforme(token, r.id_sancion);
      } catch (e) {
        avisoInforme = `No se pudo generar el informe (${e.message}). Puedes descargarlo desde el detalle del caso.`;
      }
    }

    navigation.goBack(); // la lista se recarga sola al recuperar el foco
    Alert.alert(
      "Caso resuelto",
      [`Se resolvieron ${r.reportes_resueltos} reporte(s).`, avisoInforme].filter(Boolean).join("\n\n")
    );
  }

  async function descargarInforme() {
    setDescargando(true);
    try {
      await descargarYCompartirInforme(token, sancion.id_sancion);
    } catch (e) {
      Alert.alert("No se pudo descargar el informe", e.message);
    } finally {
      setDescargando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.contenedor} behavior="padding" keyboardVerticalOffset={alturaCabecera}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        {/* Contenido reportado */}
        <Text style={estilos.seccion}>{TIPOS[tipo]} reportado</Text>
        {yaEliminado && <Text style={estilos.avisoEliminado}>Este contenido ya está eliminado.</Text>}

        {tipo === "publicacion" && (
          <View style={estilos.caja}>
            {objetivo.grupo && <Text style={estilos.pequeno}>en {objetivo.grupo.nombre}</Text>}
            <Text style={estilos.texto}>{objetivo.contenido}</Text>
          </View>
        )}

        {tipo === "comentario" && (
          <>
            {contexto?.publicacion && (
              <View style={estilos.caja}>
                <Text style={estilos.pequeno}>Publicación original · {nombre(contexto.publicacion.autor)}</Text>
                <Text style={estilos.texto} numberOfLines={4}>
                  {contexto.publicacion.contenido}
                </Text>
              </View>
            )}
            {(contexto?.hilo ?? []).map((c, i, arr) => {
              const reportado = i === arr.length - 1;
              return (
                <View key={c.id_comentario} style={[estilos.caja, reportado && estilos.cajaReportada]}>
                  <Text style={estilos.pequeno}>
                    {reportado ? "Comentario reportado" : "Comentario anterior"} · {nombre(c.autor)}
                  </Text>
                  <Text style={estilos.texto}>{c.contenido}</Text>
                </View>
              );
            })}
          </>
        )}

        {tipo === "grupo" && (
          <View style={estilos.caja}>
            <Text style={estilos.textoNegrita}>{objetivo.nombre}</Text>
            {!!objetivo.descripcion && <Text style={estilos.texto}>{objetivo.descripcion}</Text>}
          </View>
        )}

        {/* Autor */}
        <Text style={estilos.seccion}>{esGrupo ? "Creador" : "Autor"}</Text>
        <View style={estilos.caja}>
          <Text style={estilos.textoNegrita}>{autor?.nombre_completo ?? "—"}</Text>
          <Text style={estilos.pequeno}>{autor?.correo}</Text>
          <Text style={estilos.pequeno}>
            Cuenta: {ESTADOS_CUENTA[autor?.estado_cuenta] ?? autor?.estado_cuenta} · Sanciones previas:{" "}
            {autor?.sanciones_previas ?? 0}
          </Text>
        </View>

        {/* Reportes */}
        <Text style={estilos.seccion}>Reportes ({reportes.length})</Text>
        {reportes.map((r) => (
          <View key={r.id_reporte} style={estilos.caja}>
            <Text style={estilos.textoNegrita}>{r.motivo?.nombre ?? "Sin motivo"}</Text>
            <Text style={estilos.pequeno}>
              {nombre(r.denunciante)} · {formatearFecha(r.creado_en)}
              {r.estado !== "pendiente" ? ` · ${ESTADOS_REPORTE[r.estado]}` : ""}
            </Text>
            {!!r.detalle && <Text style={estilos.texto}>{r.detalle}</Text>}
          </View>
        ))}

        {/* Resolución */}
        {pendiente ? (
          <>
            <Text style={estilos.seccion}>Resolver</Text>
            {opciones.map((o) => (
              <Pressable
                key={o.valor}
                style={[estilos.opcion, resolucion === o.valor && estilos.opcionActiva]}
                onPress={() => setResolucion(o.valor)}
              >
                <Text style={[estilos.textoNegrita, resolucion === o.valor && estilos.textoActivo]}>{o.titulo}</Text>
                <Text style={estilos.pequeno}>{o.ayuda}</Text>
              </Pressable>
            ))}

            {resolucion === "infraccion" && !esGrupo && (
              <>
                <Text style={estilos.etiqueta}>Sanción al autor</Text>
                <View style={estilos.fila}>
                  {[
                    { valor: "temporal", texto: "Temporal" },
                    { valor: "baneo", texto: "Baneo permanente" },
                  ].map((s) => (
                    <Pressable
                      key={s.valor}
                      style={[estilos.chip, tipoSancion === s.valor && estilos.chipActivo]}
                      onPress={() => setTipoSancion(s.valor)}
                    >
                      <Text style={[estilos.textoChip, tipoSancion === s.valor && estilos.textoActivo]}>{s.texto}</Text>
                    </Pressable>
                  ))}
                </View>
                {tipoSancion === "temporal" && (
                  <TextInput
                    style={estilos.input}
                    value={dias}
                    onChangeText={setDias}
                    placeholder="Días de sanción (1 a 365)"
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                )}
              </>
            )}

            <Text style={estilos.etiqueta}>Comentario interno (opcional)</Text>
            <TextInput
              style={[estilos.input, estilos.inputMultilinea]}
              value={comentario}
              onChangeText={setComentario}
              placeholder="Queda registrado junto a la sanción"
              multiline
              maxLength={500}
            />

            {enviando ? (
              <ActivityIndicator size="large" />
            ) : (
              <Pressable style={[estilos.boton, !resolucion && estilos.botonDeshabilitado]} onPress={confirmar} disabled={!resolucion}>
                <Text style={estilos.textoBoton}>Resolver caso</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Text style={estilos.seccion}>Resolución</Text>
            <View style={estilos.caja}>
              <Text style={estilos.textoNegrita}>{ESTADOS_REPORTE[detalle.reporte.estado]}</Text>
              {detalle.reporte.resuelto_en && (
                <Text style={estilos.pequeno}>Resuelto el {formatearFecha(detalle.reporte.resuelto_en)}</Text>
              )}
              {sancion && (
                <Text style={estilos.texto}>
                  Sanción: {TIPOS_SANCION[sancion.tipo] ?? sancion.tipo}
                  {sancion.sancion_hasta ? ` hasta ${formatearFecha(sancion.sancion_hasta)}` : ""}
                  {sancion.comentario_administrador ? `\nComentario: ${sancion.comentario_administrador}` : ""}
                </Text>
              )}
            </View>

            {sancion?.tipo === "escalado" &&
              (descargando ? (
                <ActivityIndicator size="large" />
              ) : (
                <Pressable style={estilos.botonInforme} onPress={descargarInforme}>
                  <Text style={estilos.textoBoton}>Descargar informe PDF</Text>
                </Pressable>
              ))}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "white" },
  contenido: { padding: 16, gap: 10, paddingBottom: 40 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
  seccion: { fontSize: 15, fontWeight: "bold", color: "#374151", marginTop: 10 },
  caja: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, gap: 4 },
  cajaReportada: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  texto: { fontSize: 15, color: "#111827" },
  textoNegrita: { fontSize: 15, fontWeight: "600", color: "#111827" },
  pequeno: { fontSize: 12, color: "#6b7280" },
  avisoEliminado: { fontSize: 12, color: "#b45309", fontWeight: "600" },
  etiqueta: { fontSize: 14, color: "#374151", marginTop: 6 },
  opcion: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, padding: 12, gap: 2 },
  opcionActiva: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  textoActivo: { color: "#1d4ed8" },
  fila: { flexDirection: "row", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipActivo: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  textoChip: { color: "#374151", fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12 },
  inputMultilinea: { minHeight: 70, textAlignVertical: "top" },
  boton: { backgroundColor: "#dc2626", padding: 16, borderRadius: 8, marginTop: 8 },
  botonDeshabilitado: { opacity: 0.5 },
  textoBoton: { color: "white", textAlign: "center", fontWeight: "600" },
  error: { color: "red", textAlign: "center" },
  botonInforme: { backgroundColor: "#2563eb", padding: 16, borderRadius: 8, marginTop: 8 },
});