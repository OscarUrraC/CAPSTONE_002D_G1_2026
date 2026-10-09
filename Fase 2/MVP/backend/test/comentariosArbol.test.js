import { test } from "node:test";
import assert from "node:assert/strict";
import { armarArbolComentarios } from "../src/services/comentariosArbol.js";

// Fábrica de filas planas como las entrega la ruta.
let contador = 0;
function fila(id, { padre = null, raiz = null, estado = "activo", minuto = contador++, autor } = {}) {
  return {
    id_comentario: id,
    id_comentario_padre: padre,
    id_comentario_raiz: raiz,
    estado,
    contenido: `texto ${id}`,
    creado_en: new Date(Date.UTC(2026, 9, 7, 12, minuto)).toISOString(),
    autor: autor ?? { id_perfil: `p-${id}`, nombres: `Autor ${id}` },
    cantidad_me_gusta: 0,
    me_gusta_mio: false,
    puede_eliminar: false,
  };
}

test("sin comentarios devuelve lista vacía y total 0", () => {
  assert.deepEqual(armarArbolComentarios([]), { comentarios: [], total: 0 });
});

test("primer nivel: más recientes primero; respuestas: más antiguas primero", () => {
  const { comentarios, total } = armarArbolComentarios([
    fila("a", { minuto: 1 }),
    fila("b", { minuto: 5 }),
    fila("a2", { padre: "a", raiz: "a", minuto: 9 }),
    fila("a1", { padre: "a", raiz: "a", minuto: 3 }),
  ]);

  assert.deepEqual(comentarios.map((c) => c.id_comentario), ["b", "a"]);
  assert.deepEqual(comentarios[1].respuestas.map((r) => r.id_comentario), ["a1", "a2"]);
  assert.equal(comentarios[1].cantidad_respuestas, 2);
  assert.equal(total, 4);
});

test("respuesta a una respuesta: queda en el mismo nivel e indica a quién responde", () => {
  const autorR1 = { id_perfil: "p-r1", nombres: "Ana" };
  const { comentarios } = armarArbolComentarios([
    fila("a", { minuto: 1 }),
    fila("r1", { padre: "a", raiz: "a", minuto: 2, autor: autorR1 }),
    fila("r2", { padre: "r1", raiz: "a", minuto: 3 }),
  ]);

  const [r1, r2] = comentarios[0].respuestas;
  assert.equal(r1.en_respuesta_a, null, "responder al comentario raíz no necesita etiqueta");
  assert.deepEqual(r2.en_respuesta_a, autorR1);
});

test("comentario eliminado NO expone contenido ni autor", () => {
  const { comentarios } = armarArbolComentarios([
    fila("a", { estado: "eliminado", minuto: 1 }),
    fila("r1", { padre: "a", raiz: "a", minuto: 2 }),
  ]);

  const raiz = comentarios[0];
  assert.equal(raiz.eliminado, true);
  assert.equal("contenido" in raiz, false);
  assert.equal("autor" in raiz, false);
  assert.equal(raiz.respuestas.length, 1, "el hilo se conserva si hay respuestas activas");
});

test("raíz eliminada sin respuestas activas no aparece", () => {
  const { comentarios, total } = armarArbolComentarios([
    fila("a", { estado: "eliminado", minuto: 1 }),
    fila("r1", { padre: "a", raiz: "a", estado: "eliminado", minuto: 2 }),
  ]);
  assert.deepEqual(comentarios, []);
  assert.equal(total, 0);
});

test("respuestas eliminadas se omiten y no cuentan en el total", () => {
  const { comentarios, total } = armarArbolComentarios([
    fila("a", { minuto: 1 }),
    fila("r1", { padre: "a", raiz: "a", estado: "eliminado", minuto: 2 }),
    fila("r2", { padre: "a", raiz: "a", minuto: 3 }),
  ]);
  assert.deepEqual(comentarios[0].respuestas.map((r) => r.id_comentario), ["r2"]);
  assert.equal(total, 2);
});

test("respuesta a una respuesta eliminada: no se muestra etiqueta de autor", () => {
  const { comentarios } = armarArbolComentarios([
    fila("a", { minuto: 1 }),
    fila("r1", { padre: "a", raiz: "a", estado: "eliminado", minuto: 2 }),
    fila("r2", { padre: "r1", raiz: "a", minuto: 3 }),
  ]);
  assert.equal(comentarios[0].respuestas[0].en_respuesta_a, null);
});

test("respuesta huérfana (su raíz no está en la lista) se ignora sin romper", () => {
  const { comentarios, total } = armarArbolComentarios([
    fila("r1", { padre: "x", raiz: "x", minuto: 1 }),
  ]);
  assert.deepEqual(comentarios, []);
  assert.equal(total, 0);
});
