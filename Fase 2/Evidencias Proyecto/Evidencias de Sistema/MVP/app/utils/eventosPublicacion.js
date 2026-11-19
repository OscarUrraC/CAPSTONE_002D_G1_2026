// Mini "bus de eventos" para mantener sincronizados los contadores de una publicación
// cuando aparece en varias pantallas a la vez (feed Para Ti, detalle de grupo, pantalla de comentarios).
//
// Ejemplo: das me gusta dentro de la pantalla de comentarios, vuelves al feed y el corazón
// ya aparece marcado sin recargar nada.
//
// Se evita pasar funciones por los parámetros de navegación (React Navigation advierte que no
// son serializables) y no se agrega ninguna dependencia nueva.

const oyentes = new Set();

// Devuelve la función para desuscribirse (úsala en el cleanup de useEffect).
export function suscribirPublicacion(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

// cambios: { id_publicacion, me_gusta_mio?, cantidad_me_gusta?, cantidad_comentarios? }
// Solo se aplican las claves presentes.
export function emitirPublicacion(cambios) {
  oyentes.forEach((oyente) => oyente(cambios));
}
