// Ordenação das tabelas (src/ui/tabela.js, ordenarLinhas): a mesma regra de antes, mais rápida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordenarLinhas } from '../src/ui/tabela.js';

const col = (campo) => ({ id: campo, valor: (l) => l[campo] });
const nomes = (linhas) => linhas.map((l) => l.n);

test('ordenarLinhas: texto com número ("2" antes de "10") e acento como no pt-BR', () => {
  const linhas = [{ n: 'a', v: '10' }, { n: 'b', v: '2' }, { n: 'c', v: 'Ébano' }, { n: 'd', v: 'abacaxi' }];
  assert.deepEqual(nomes(ordenarLinhas(linhas, col('v'), false)), ['b', 'a', 'd', 'c']);
  assert.deepEqual(nomes(ordenarLinhas(linhas, col('v'), true)), ['c', 'd', 'a', 'b']);
});

test('ordenarLinhas: números como número; vazios sempre no fim, nas duas direções', () => {
  const linhas = [{ n: 'a', v: 5 }, { n: 'b', v: null }, { n: 'c', v: 30 }, { n: 'd', v: '' }, { n: 'e', v: 4 }];
  assert.deepEqual(nomes(ordenarLinhas(linhas, col('v'), false)), ['e', 'a', 'c', 'b', 'd']);
  assert.deepEqual(nomes(ordenarLinhas(linhas, col('v'), true)), ['c', 'a', 'e', 'b', 'd']);
});

test('ordenarLinhas: empate mantém a ordem de antes e não altera o array original', () => {
  const linhas = [{ n: 'a', v: 1 }, { n: 'b', v: 0 }, { n: 'c', v: 1 }, { n: 'd', v: 1 }];
  const copia = [...linhas];
  assert.deepEqual(nomes(ordenarLinhas(linhas, col('v'), true)), ['a', 'c', 'd', 'b']);
  assert.deepEqual(nomes(ordenarLinhas(linhas, col('v'), false)), ['b', 'a', 'c', 'd']);
  assert.deepEqual(linhas, copia);
});

test('ordenarLinhas: valor lido uma vez por linha (12 mil itens)', () => {
  let leituras = 0;
  const linhas = Array.from({ length: 12000 }, (_, i) => ({ n: i, v: String((i * 7919) % 12000) }));
  const contada = { id: 'v', valor: (l) => { leituras++; return l.v; } };
  const ordenadas = ordenarLinhas(linhas, contada, true);
  assert.equal(leituras, 12000);
  assert.equal(ordenadas[0].v, '11999');
  assert.equal(ordenadas.at(-1).v, '0');
});
