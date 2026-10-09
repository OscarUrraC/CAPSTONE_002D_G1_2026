// Lógica PURA (sin base de datos) para convertir los comentarios de una publicación,
// que llegan "planos" desde la BD, en el árbol que consume la app.
//
// Convención de la tabla `comentario` (documentada en docs/feeds-modulo.md):
//   - Comentario de primer nivel: id_comentario_padre = null y id_comentario_raiz = null.
//   - Respuesta: id_comentario_padre = comentario al que se responde (puede ser otra respuesta)
//                id_comentario_raiz  = comentario de primer nivel del que cuelga todo el hilo.
// La app muestra solo 2 niveles (comentario -> respuestas); si alguien responde a una respuesta,
// queda en el mismo nivel pero con "en_respuesta_a" para saber a quién se contestó.

// Fila plana (ya mapeada por la ruta) -> forma pública de un comentario activo.
function aVistaActiva(fila, porId) {
  const padre = fila.id_comentario_padre ? porId.get(fila.id_comentario_padre) : null;
  // Solo se muestra "en respuesta a" cuando el padre es otra respuesta (no el comentario raíz,
  // porque eso ya se ve por la indentación) y sigue activo (no filtramos autores de eliminados).
  const respondeAOtraRespuesta =
    padre && padre.id_comentario !== fila.id_comentario_raiz && padre.estado === "activo";

  return {
    id_comentario: fila.id_comentario,
    id_comentario_padre: fila.id_comentario_padre,
    contenido: fila.contenido,
    creado_en: fila.creado_en,
    autor: fila.autor,
    cantidad_me_gusta: fila.cantidad_me_gusta,
    me_gusta_mio: fila.me_gusta_mio,
    puede_eliminar: fila.puede_eliminar,
    en_respuesta_a: respondeAOtraRespuesta ? padre.autor : null,
    eliminado: false,
  };
}

// Un comentario eliminado NUNCA expone contenido ni autor: solo existe para no romper el hilo.
function aVistaEliminada(fila) {
  return {
    id_comentario: fila.id_comentario,
    id_comentario_padre: fila.id_comentario_padre,
    creado_en: fila.creado_en,
    eliminado: true,
  };
}

/**
 * @param {Array} filas  Comentarios planos de UNA publicación, en cualquier orden. Cada fila:
 *   { id_comentario, id_comentario_padre, id_comentario_raiz, estado: 'activo'|'eliminado',
 *     contenido, creado_en, autor, cantidad_me_gusta, me_gusta_mio, puede_eliminar }
 * @returns {{ comentarios: Array, total: number }}
 *   comentarios: primer nivel (más recientes primero), cada uno con `respuestas`
 *                (más antiguas primero) y `cantidad_respuestas`.
 *   total: cantidad de comentarios ACTIVOS (primer nivel + respuestas), para el contador del post.
 */
export function armarArbolComentarios(filas) {
  const porId = new Map(filas.map((f) => [f.id_comentario, f]));
  const porFecha = (a, b) => new Date(a.creado_en) - new Date(b.creado_en);

  const respuestasPorRaiz = new Map();
  const primerNivel = [];

  for (const fila of filas) {
    if (!fila.id_comentario_raiz) {
      primerNivel.push(fila);
    } else {
      const lista = respuestasPorRaiz.get(fila.id_comentario_raiz) ?? [];
      lista.push(fila);
      respuestasPorRaiz.set(fila.id_comentario_raiz, lista);
    }
  }

  let total = 0;
  const comentarios = [];

  for (const raiz of primerNivel) {
    // Las respuestas eliminadas se omiten (no tienen hijos propios en pantalla: todas cuelgan de la raíz).
    const respuestas = (respuestasPorRaiz.get(raiz.id_comentario) ?? [])
      .filter((r) => r.estado === "activo")
      .sort(porFecha)
      .map((r) => aVistaActiva(r, porId));

    total += respuestas.length;

    if (raiz.estado === "activo") {
      total += 1;
      comentarios.push({
        ...aVistaActiva(raiz, porId),
        respuestas,
        cantidad_respuestas: respuestas.length,
      });
    } else if (respuestas.length > 0) {
      // Raíz eliminada pero con respuestas activas: se deja un marcador para conservar el hilo.
      comentarios.push({ ...aVistaEliminada(raiz), respuestas, cantidad_respuestas: respuestas.length });
    }
    // Raíz eliminada sin respuestas activas: no se muestra.
  }

  comentarios.sort((a, b) => porFecha(b, a)); // primer nivel: más recientes primero
  return { comentarios, total };
}
