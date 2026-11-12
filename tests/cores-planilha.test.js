// Cores da planilha antiga (src/ui/cores-planilha.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaveDoStatus, chaveDaPrioridade, chaveDoSaving, corDoStatusNoGrafico, classeDaLinhaSc } from '../src/ui/cores-planilha.js';

test('status: chave de cor, sem maiúsculas', () => {
  assert.equal(chaveDoStatus('Em Cotação'), 'cotacao');
  assert.equal(chaveDoStatus('EM PEDIDO'), 'pedido');
  assert.equal(chaveDoStatus('Em pendências de compra'), 'pend-compra');
  assert.equal(chaveDoStatus('Em pendências de contrato'), 'pend-contrato');
  assert.equal(chaveDoStatus('Em Pré-Pedido'), 'pre-pedido');
  assert.equal(chaveDoStatus('Cancelado'), 'cancelado');
  assert.equal(chaveDoStatus('Sel. Comprador'), 'sel-comprador');
  assert.equal(chaveDoStatus(null), null);
});

test('prioridade', () => {
  assert.equal(chaveDaPrioridade('NORMAL'), 'normal');
  assert.equal(chaveDaPrioridade('urgente'), 'urgente');
  assert.equal(chaveDaPrioridade('EMERGENCIAL'), 'emergencial');
  assert.equal(chaveDaPrioridade('OUTRA'), null);
});

test('% saving: "-" ou < 0,1% baixo; >= 6% bom; meio sem cor', () => {
  assert.equal(chaveDoSaving(null), 'baixo');
  assert.equal(chaveDoSaving(0.0009), 'baixo');
  assert.equal(chaveDoSaving(0.001), null);
  assert.equal(chaveDoSaving(0.0599), null);
  assert.equal(chaveDoSaving(0.06), 'bom');
});

test('gráfico: cada status com a sua cor; desconhecido em "outros"', () => {
  assert.equal(corDoStatusNoGrafico('Em Cotação'), 'var(--graf-cotacao)');
  assert.notEqual(corDoStatusNoGrafico('Em pendências de contrato'), corDoStatusNoGrafico('Em pendências de compra'));
  assert.equal(corDoStatusNoGrafico('Outro'), 'var(--serie-outros)');
});

test('classe da linha: regularização (linha vermelha) e emergencial (faixa), juntas ou não', () => {
  assert.equal(classeDaLinhaSc({ prioridade: 'NORMAL', categoria: 'MATERIAL' }), '');
  assert.equal(classeDaLinhaSc({ prioridade: ' Emergencial ', categoria: null }), 'linha-emergencial');
  assert.equal(classeDaLinhaSc({ prioridade: 'URGENTE', categoria: 'REGULARIZAÇÃO' }), 'linha-regularizacao');
  assert.equal(classeDaLinhaSc({ prioridade: 'EMERGENCIAL', categoria: 'Regularizacao' }), 'linha-regularizacao linha-emergencial');
});
