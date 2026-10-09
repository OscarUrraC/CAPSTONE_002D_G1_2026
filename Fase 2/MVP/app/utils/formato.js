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
