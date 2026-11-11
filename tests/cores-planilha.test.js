// Cores da planilha antiga (src/ui/cores-planilha.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classeDoStatus, classeDaPrioridade, classeDoSaving, corDoStatusNoGrafico } from '../src/ui/cores-planilha.js';

test('status: mesma classe da planilha, sem maiúsculas', () => {
  assert.equal(classeDoStatus('Em Cotação'), 'cel-cotacao');
  assert.equal(classeDoStatus('EM PEDIDO'), 'cel-pedido');
  assert.equal(classeDoStatus('Em pendências de compra'), 'cel-pendencia');
  assert.equal(classeDoStatus('Em pendências de contrato'), 'cel-pendencia');
  assert.equal(classeDoStatus('Em Pré-Pedido'), 'cel-pre-pedido');
  assert.equal(classeDoStatus('Cancelado'), 'cel-cancelado');
  assert.equal(classeDoStatus('Sel. Comprador'), '');
  assert.equal(classeDoStatus(null), '');
});

test('prioridade', () => {
  assert.equal(classeDaPrioridade('NORMAL'), 'cel-normal');
  assert.equal(classeDaPrioridade('urgente'), 'cel-urgente');
  assert.equal(classeDaPrioridade('EMERGENCIAL'), 'cel-emergencial');
  assert.equal(classeDaPrioridade('OUTRA'), '');
});

test('% saving: "-" ou < 0,1% amarelo; >= 6% verde; meio sem cor', () => {
  assert.equal(classeDoSaving(null), 'cel-saving-baixo');
  assert.equal(classeDoSaving(0.0009), 'cel-saving-baixo');
  assert.equal(classeDoSaving(0.001), '');
  assert.equal(classeDoSaving(0.0599), '');
  assert.equal(classeDoSaving(0.06), 'cel-saving-bom');
});

test('gráfico: pendência de contrato separada da de compra', () => {
  assert.equal(corDoStatusNoGrafico('Em Cotação'), 'var(--pl-cotacao)');
  assert.notEqual(corDoStatusNoGrafico('Em pendências de contrato'), corDoStatusNoGrafico('Em pendências de compra'));
  assert.equal(corDoStatusNoGrafico('Sel. Comprador'), 'var(--serie-7)');
  assert.equal(corDoStatusNoGrafico('Outro'), 'var(--serie-outros)');
});
