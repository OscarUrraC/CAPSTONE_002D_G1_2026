// Utilidades de presentación del módulo Feeds.
// Se duplican a propósito (son 2 funciones de 3 líneas) en vez de importarlas desde
// GroupDetailScreen: importar una pantalla desde un componente genera dependencias circulares.

// Misma regla que ProfileScreen y GroupDetailScreen para mostrar el nombre.
export function nombreParaMostrar(autor) {
  return autor.mostrar_apodo && autor.apodo ? autor.apodo : autor.nombres;
}

export function formatearFecha(iso) {
  return new Date(iso).toLocaleString("es-CL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Fecha larga para eventos: "jueves, 5 de noviembre, 18:30".
export function formatearFechaEvento(iso) {
  return new Date(iso).toLocaleString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "2026-11-05" + "18:30" (hora local del teléfono) -> ISO UTC. Devuelve null si no es válida.
export function camposAIso(fecha, hora) {
  const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim());
  const h = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
  if (!f || !h) return null;

  const anio = Number(f[1]);
  const mes = Number(f[2]);
  const dia = Number(f[3]);
  const horas = Number(h[1]);
  const minutos = Number(h[2]);

  const d = new Date(anio, mes - 1, dia, horas, minutos);
  // Date "corrige" valores imposibles (31 de febrero, 25:00): si algo cambió, la entrada era inválida.
  if (
    d.getFullYear() !== anio ||
    d.getMonth() !== mes - 1 ||
    d.getDate() !== dia ||
    d.getHours() !== horas ||
    d.getMinutes() !== minutos
  ) {
    return null;
  }
  return d.toISOString();
}

// ISO -> { fecha: "2026-11-05", hora: "18:30" } en hora local, para rellenar el formulario al editar.
export function isoACampos(iso) {
  const d = new Date(iso);
  const dos = (n) => String(n).padStart(2, "0");
  return {
    fecha: `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`,
    hora: `${dos(d.getHours())}:${dos(d.getMinutes())}`,
  };
}