// Aviso interno: la bandeja le dice a las pestañas cuántas notificaciones no leídas hay.
const oyentes = new Set();

export function suscribirNoLeidas(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export function publicarNoLeidas(cantidad) {
  oyentes.forEach((oyente) => oyente(cantidad));
}