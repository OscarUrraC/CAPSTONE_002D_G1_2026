// PUNTO DE EXTENSIÓN: aquí se conecta el filtro de imágenes.
// Recibe { buffer, mimetype } y debe devolver:
//   { resultado: "aprobada" | "rechazada" | "pendiente", motivo, proveedor }
// - "rechazada": el post se rechaza y la imagen no se guarda.
// - "pendiente": se guarda pero NO se muestra hasta que alguien la apruebe.
// Mientras no haya filtro real, aprueba todo.
export async function moderarImagen({ buffer, mimetype }) {
  return { resultado: "aprobada", motivo: null, proveedor: "ninguno" };
}