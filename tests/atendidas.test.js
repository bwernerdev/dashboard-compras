import { test } from 'node:test';
import assert from 'node:assert/strict';

// localStorage de mentira (o Node não tem por padrão).
const guardado = new Map();
globalThis.localStorage = {
  getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
  setItem: (k, v) => guardado.set(k, String(v)),
};
const { estaAtendida, marcarAtendida, esquecerCache } = await import('../src/atendidas.js');
const CHAVE = 'dashboard-compras:scs-atendidas';

test('marca, desmarca e guarda no navegador', () => {
  guardado.clear(); esquecerCache();
  assert.equal(estaAtendida('900001'), false);
  marcarAtendida('900001');
  marcarAtendida(900002); // número vira texto
  assert.equal(estaAtendida('900001'), true);
  assert.equal(estaAtendida('900002'), true);
  esquecerCache(); // relê do armazenamento
  assert.equal(estaAtendida('900001'), true);
  marcarAtendida('900001', false);
  esquecerCache();
  assert.equal(estaAtendida('900001'), false);
  assert.deepEqual(Object.keys(JSON.parse(guardado.get(CHAVE))), ['900002']);
});

test('marca com mais de 120 dias vence; armazenamento estragado não quebra', () => {
  guardado.clear(); esquecerCache();
  guardado.set(CHAVE, JSON.stringify({ velha: Date.now() - 121 * 864e5, nova: Date.now(), ruim: 'x' }));
  assert.equal(estaAtendida('velha'), false);
  assert.equal(estaAtendida('nova'), true);
  assert.equal(estaAtendida('ruim'), false);

  guardado.set(CHAVE, '{nao é json'); esquecerCache();
  assert.equal(estaAtendida('nova'), false);
  marcarAtendida('outra');
  assert.equal(estaAtendida('outra'), true);
});
