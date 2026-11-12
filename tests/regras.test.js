import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarConfig, normalizarCodigoFilial } from '../src/config/index.js';
import {
  calcularLinhaBase, calcularLinhaFollowUp, extrairNumero, savingReal, numeroExcel, ehServico, PRAZO_SLA_DIAS,
} from '../src/regras.js';
import { serie, diasUteis } from '../src/datas.js';

// Configuração fictícia.
const cfg = criarConfig({
  filiais: [
    { codigo: '30999', ajustada: '999', nome: 'Filial Teste', regional: 'Regional A' },
    { codigo: '30998', ajustada: '999', nome: 'Nome Repetido', regional: 'Regional B' },
    { codigo: '178111', ajustada: '111', nome: 'Outra', regional: 'Regional B' },
  ],
  compradores: [
    { nome: 'Fulano de Tal', apelido: 'Fulano' },
    { nome: 'Pendente', apelido: 'Pendente' },
  ],
});

const HOJE = serie(2026, 11, 11); // quarta-feira

/** Linha fictícia de SC em aberto; sobrescreva o que o teste precisar. */
function linha(extra = {}) {
  return {
    solicitacao: 'FDS-1234567',
    criacao: serie(2026, 11, 3) + 0.4,
    codigoFilial: '30.999',
    unidade: 'UN',
    status: 'Em Cotação',
    prioridade: 'NORMAL',
    selecionadoPor: 'FDS - Fulano de Tal',
    qtdSolicitacao: 2,
    dataPedido: null,
    numeroPedido: null,
    dataCancelamento: null,
    dataCotacao: serie(2026, 11, 5),
    dataPrePedido: null,
    numeroCotacao: '555',
    contrato: null,
    saving: null,
    totalPedidoComImpostos: null,
    ...extra,
  };
}

test('código da filial: tira ponto, aceita número', () => {
  assert.equal(normalizarCodigoFilial('30.999'), '30999');
  assert.equal(normalizarCodigoFilial(178111), '178111');
  assert.ok(cfg.codigosFiliais.has('30999'));
});

test('SC e OF: EXT(texto; 5; 7)', () => {
  assert.equal(extrairNumero('FDS-1234567'), '1234567');
  assert.equal(extrairNumero('FDS-12345678'), '1234567');
  assert.equal(extrairNumero(null), null);
});

test('filial, nome e regional pelo de-para (PROCV: primeira ocorrência)', () => {
  const r = calcularLinhaBase(linha({ codigoFilial: '30.998' }), cfg, HOJE);
  assert.equal(r.filial, '999');
  assert.equal(r.nomeFilial, 'Filial Teste'); // a 2ª linha com 999 é ignorada, como no PROCV
  assert.equal(r.regional, 'Regional A');
  const fora = calcularLinhaBase(linha({ codigoFilial: '11.111' }), cfg, HOJE);
  assert.equal(fora.filial, null);
});

test('comprador: tira "FDS - ", vazio vira Pendente, sem apelido vira null ("-")', () => {
  assert.equal(calcularLinhaBase(linha(), cfg, HOJE).comprador, 'Fulano');
  const pend = calcularLinhaBase(linha({ selecionadoPor: null }), cfg, HOJE);
  assert.equal(pend.compradorCompleto, 'Pendente');
  assert.equal(pend.comprador, 'Pendente');
  const outro = calcularLinhaBase(linha({ selecionadoPor: 'FDS - Ciclano Silva' }), cfg, HOJE);
  assert.equal(outro.compradorCompleto, 'Ciclano Silva');
  assert.equal(outro.comprador, null);
});

test('SC em aberto: dias úteis desde a criação, horas = dias x 8,8, SLA no prazo', () => {
  const r = calcularLinhaBase(linha(), cfg, HOJE);
  assert.equal(r.diasEmAberto, 7);
  assert.ok(Math.abs(r.horasEmAberto - 61.6) < 1e-9);
  assert.equal(r.data, linha().criacao);
  assert.equal(r.servico, 'NÃO');
  assert.equal(r.sla, 'No Prazo');
  assert.equal(r.diasDaAprovacao, 8);
});

test('SLA: só fica fora com mais de 30 dias úteis em aberto, qualquer prioridade', () => {
  assert.equal(PRAZO_SLA_DIAS, 30);
  // Criação com exatamente n dias úteis em aberto até HOJE (contando os dois extremos).
  const criadaHa = (n) => { let d = HOJE; while (diasUteis(d, HOJE) < n) d--; return d + 0.4; };
  for (const prioridade of ['NORMAL', 'URGENTE', 'EMERGENCIAL', 'XYZ']) {
    const no30 = calcularLinhaBase(linha({ prioridade, criacao: criadaHa(30) }), cfg, HOJE);
    const no31 = calcularLinhaBase(linha({ prioridade, criacao: criadaHa(31) }), cfg, HOJE);
    assert.deepEqual([no30.diasEmAberto, no30.sla], [30, 'No Prazo'], prioridade);
    assert.deepEqual([no31.diasEmAberto, no31.sla], [31, 'Fora do Prazo'], prioridade);
  }
  const serv = calcularLinhaBase(linha({ prioridade: 'URGENTE', unidade: 'serv' }), cfg, HOJE);
  assert.deepEqual([serv.servico, serv.sla], ['SIM', 'No Prazo']); // 7 dias: antes estourava o urgente
});

test('SLA: status Cancelado / Em Pedido / Em Pré-Pedido não conta', () => {
  for (const status of ['Cancelado', 'Em Pedido', 'Em Pré-Pedido']) {
    assert.equal(calcularLinhaBase(linha({ status }), cfg, HOJE).sla, null, status);
  }
});

test('com pedido: sem dias em aberto e sem SLA', () => {
  const r = calcularLinhaBase(linha({ numeroPedido: 'FDS-7000001', dataPedido: serie(2026, 11, 6) }), cfg, HOJE);
  assert.equal(r.diasEmAberto, null);
  assert.equal(r.horasEmAberto, null);
  assert.equal(r.data, serie(2026, 11, 6));
  assert.equal(r.sla, null);
  assert.deepEqual([r.anoPedido, r.mesPedido], [2026, 11]);
});

test('cancelada: sem dias em aberto; tempo até o cancelamento', () => {
  const r = calcularLinhaBase(linha({ status: 'Cancelado', dataCancelamento: serie(2026, 11, 10) }), cfg, HOJE);
  assert.equal(r.diasEmAberto, null);
  assert.equal(r.cancelado, 7);
});

test('Contrato?: sim quando Nº Contrato preenchido', () => {
  assert.equal(calcularLinhaBase(linha({ contrato: '842719' }), cfg, HOJE).temContrato, 'sim');
  assert.equal(calcularLinhaBase(linha({ contrato: '' }), cfg, HOJE).temContrato, 'não');
});

test('Saving Real: Saving x quantidade da solicitação; texto pt-BR convertido; erro = 0', () => {
  assert.equal(savingReal('268,93', 1), 268.93);
  assert.equal(savingReal('1.234,5', 2), 2469);
  assert.equal(savingReal(3, 2), 6);
  assert.equal(savingReal(null, 5), 0);
  assert.equal(savingReal('', 5), 0);
  assert.equal(savingReal('abc', 5), 0);
  assert.ok(Number.isNaN(numeroExcel('')));
});

test('Ano/Mês OF: só com número de pedido', () => {
  const r = calcularLinhaBase(linha(), cfg, HOJE);
  assert.deepEqual([r.anoPedido, r.mesPedido], [null, null]);
});

test('tempos por etapa', () => {
  const criacao = serie(2026, 11, 2);
  const r = calcularLinhaBase(linha({
    criacao,
    status: 'Em Pedido',
    dataCotacao: serie(2026, 11, 3),
    dataPrePedido: serie(2026, 11, 5),
    dataPedido: serie(2026, 11, 6),
    numeroPedido: 'FDS-7000001',
    contrato: '123',
  }), cfg, HOJE);
  assert.equal(r.pendenciaCompra, 1); // cotação - criação
  assert.equal(r.emCotacao, 2); // pré-pedido - cotação
  assert.equal(r.emPrePedido, 3); // pré-pedido - criação
  assert.equal(r.emPedido, 1); // pedido - pré-pedido
  assert.equal(r.pendenciaContrato, 3); // contrato + Em Pedido: pré-pedido - criação
  assert.equal(r.cancelado, null);

  const cot = calcularLinhaBase(linha({ status: 'Em Cotação', dataCotacao: serie(2026, 11, 9) }), cfg, HOJE);
  assert.equal(cot.emCotacao, 2); // ainda em cotação: hoje - cotação
  const pend = calcularLinhaBase(linha({ status: 'Em pendências de compra', numeroCotacao: null }), cfg, HOJE);
  assert.equal(pend.pendenciaCompra, 8); // hoje - criação
});

test('serviço: UR, SER e SERV (sem diferenciar maiúsculas)', () => {
  assert.equal(ehServico('ur'), 'SIM');
  assert.equal(ehServico('SER'), 'SIM');
  assert.equal(ehServico('UN'), 'NÃO');
  assert.equal(ehServico(null), 'NÃO');
});

test('Follow-Up: SC, OF, filial e comprador com 30 caracteres', () => {
  const r = calcularLinhaFollowUp({
    solicitacao: 'FDS-1234567',
    numeroPedido: 'FDS-7654321',
    codigoFilial: '178.111',
    selecionadoPor: 'FDS - Nome Muito Comprido de Comprador Fictício',
    criacao: serie(2026, 11, 1),
  }, cfg, HOJE);
  assert.equal(r.sc, '1234567');
  assert.equal(r.of, '7654321');
  assert.equal(r.nomeFilial, 'Outra');
  assert.equal(r.compradorCompleto, 'Nome Muito Comprido de Comprad');
  assert.equal(r.compradorCompleto.length, 30);
  assert.equal(r.diasDaAprovacao, 10);
  // Fora do de-para: comprador = nome da planilha; sem contrato.
  assert.equal(r.comprador, 'Nome Muito Comprido de Comprad');
  assert.equal(r.temContrato, 'não');
});

test('Follow-Up: comprador do de-para vira apelido; sem "Selecionado por" é Pendente', () => {
  const r = calcularLinhaFollowUp({ solicitacao: 'FDS-1', selecionadoPor: 'FDS - Fulano de Tal', contrato: 'CT-9' }, cfg, HOJE);
  assert.equal(r.comprador, 'Fulano');
  assert.equal(r.temContrato, 'sim');
  assert.equal(calcularLinhaFollowUp({ solicitacao: 'FDS-2' }, cfg, HOJE).comprador, 'Pendente');
});
