import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { lerJson, salvarJson, lerEscolha, lerConjunto, salvarConjunto, salvarPreferencia } from '../src/preferencias.js';

// localStorage de mentira (o Node não tem um por padrão).
const guardado = new Map();
globalThis.localStorage = {
  getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
  setItem: (k, v) => guardado.set(k, String(v)),
};
beforeEach(() => guardado.clear());

test('lerJson: ausente ou estragado = padrão; salvo volta igual', () => {
  assert.deepEqual(lerJson('x', { a: 1 }), { a: 1 });
  salvarPreferencia('x', '{estragado');
  assert.deepEqual(lerJson('x', []), []);
  salvarJson('x', { de: 1, ate: 2 });
  assert.deepEqual(lerJson('x', {}), { de: 1, ate: 2 });
});

test('lerEscolha: só vale uma das opções', () => {
  assert.equal(lerEscolha('sla', ['todos', 'No Prazo'], 'todos'), 'todos');
  salvarPreferencia('sla', 'No Prazo');
  assert.equal(lerEscolha('sla', ['todos', 'No Prazo'], 'todos'), 'No Prazo');
  salvarPreferencia('sla', 'removida');
  assert.equal(lerEscolha('sla', ['todos', 'No Prazo'], 'todos'), 'todos');
});

test('lerConjunto: só textos; formato errado = vazio', () => {
  salvarConjunto('st', new Set(['Pendente', 'Em Pedido']));
  assert.deepEqual([...lerConjunto('st')], ['Pendente', 'Em Pedido']);
  salvarJson('st', ['A', 3, null]);
  assert.deepEqual([...lerConjunto('st')], ['A']);
  salvarJson('st', { a: 1 });
  assert.equal(lerConjunto('st').size, 0);
});

test('armazenamento bloqueado: tudo vira padrão, salvar não quebra', () => {
  const original = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  try {
    assert.equal(lerEscolha('a', ['x'], 'x'), 'x');
    assert.deepEqual(lerJson('a', {}), {});
    salvarJson('a', { b: 1 });
  } finally { globalThis.localStorage = original; }
});
