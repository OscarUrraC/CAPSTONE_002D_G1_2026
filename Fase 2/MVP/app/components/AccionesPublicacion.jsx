import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";
import { darMeGustaPublicacion, quitarMeGustaPublicacion } from "../services/api";
import { emitirPublicacion, suscribirPublicacion } from "../utils/eventosPublicacion";

// Barra "♥ 12   💬 3" de una publicación. La usan el feed Para Ti, el detalle de grupo y la
// pantalla de comentarios, así que el comportamiento (me gusta inmediato, sincronización) es el mismo.
//
// publicacion: { id_publicacion, me_gusta_mio, cantidad_me_gusta, cantidad_comentarios }
// interactivo: false = solo muestra los contadores (por ejemplo, no soy miembro del grupo).
// onAbrirComentarios: si se entrega, el botón de comentarios es tocable.
export default function AccionesPublicacion({ publicacion, interactivo = true, onAbrirComentarios }) {
  const { token } = useAuth();
  const [meGusta, setMeGusta] = useState(publicacion.me_gusta_mio ?? false);
  const [cantidadMeGusta, setCantidadMeGusta] = useState(publicacion.cantidad_me_gusta ?? 0);
  const [cantidadComentarios, setCantidadComentarios] = useState(publicacion.cantidad_comentarios ?? 0);
  const enCurso = useRef(false);

  // Si la lista se recarga y llegan datos nuevos, se reflejan.
  useEffect(() => {
    setMeGusta(publicacion.me_gusta_mio ?? false);
    setCantidadMeGusta(publicacion.cantidad_me_gusta ?? 0);
    setCantidadComentarios(publicacion.cantidad_comentarios ?? 0);
  }, [publicacion.me_gusta_mio, publicacion.cantidad_me_gusta, publicacion.cantidad_comentarios]);

  // Si otra pantalla cambia esta misma publicación (ej: comenté en el detalle), me actualizo.
  useEffect(() => {
    return suscribirPublicacion((cambios) => {
      if (cambios.id_publicacion !== publicacion.id_publicacion) return;
      if (cambios.me_gusta_mio !== undefined) setMeGusta(cambios.me_gusta_mio);
      if (cambios.cantidad_me_gusta !== undefined) setCantidadMeGusta(cambios.cantidad_me_gusta);
      if (cambios.cantidad_comentarios !== undefined) setCantidadComentarios(cambios.cantidad_comentarios);
    });
  }, [publicacion.id_publicacion]);

  async function alternarMeGusta() {
    if (!interactivo || enCurso.current) return; // enCurso evita dobles toques mientras responde el servidor
    enCurso.current = true;

    const anterior = { meGusta, cantidadMeGusta };
    const quiereDarMeGusta = !meGusta;

    // Actualización inmediata (optimista): la persona ve el cambio sin esperar a la red.
    setMeGusta(quiereDarMeGusta);
    setCantidadMeGusta((n) => Math.max(0, n + (quiereDarMeGusta ? 1 : -1)));

    try {
      const accion = quiereDarMeGusta ? darMeGustaPublicacion : quitarMeGustaPublicacion;
      const real = await accion(token, publicacion.id_publicacion);
      // El servidor manda la verdad (por si alguien más dio me gusta mientras tanto).
      emitirPublicacion({
        id_publicacion: publicacion.id_publicacion,
        me_gusta_mio: real.me_gusta_mio,
        cantidad_me_gusta: real.cantidad_me_gusta,
      });
    } catch (e) {
      // Si falló, se vuelve al estado anterior.
      setMeGusta(anterior.meGusta);
      setCantidadMeGusta(anterior.cantidadMeGusta);
      Alert.alert("No se pudo completar", e.message);
    } finally {
      enCurso.current = false;
    }
  }

  const etiquetaComentarios = `💬 ${cantidadComentarios}`;

  return (
    <View style={estilos.fila}>
      <Pressable
        onPress={alternarMeGusta}
        disabled={!interactivo}
        hitSlop={8}
        style={estilos.accion}
        accessibilityRole="button"
        accessibilityLabel={meGusta ? "Quitar me gusta" : "Dar me gusta"}
      >
        <Text style={[estilos.texto, meGusta && estilos.textoActivo]}>
          {meGusta ? "♥" : "♡"} {cantidadMeGusta}
        </Text>
      </Pressable>

      {onAbrirComentarios ? (
        <Pressable
          onPress={onAbrirComentarios}
          hitSlop={8}
          style={estilos.accion}
          accessibilityRole="button"
          accessibilityLabel="Ver comentarios"
        >
          <Text style={estilos.texto}>{etiquetaComentarios}</Text>
        </Pressable>
      ) : (
        <Text style={estilos.texto}>{etiquetaComentarios}</Text>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", gap: 20, paddingTop: 4 },
  accion: { paddingVertical: 2 },
  texto: { fontSize: 15, color: "#6b7280" },
  textoActivo: { color: "#dc2626", fontWeight: "600" },
});
