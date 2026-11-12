// Agregações e filtros das telas (src/analise.js), memória (src/memoria.js), validação da
// configuração e CSV. Dados fictícios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aplicarFiltros, opcoesDosFiltros, chaveMes, rotuloMes, itensEmAberto, resumoEmAberto, porFaixaDeDias,
  faixaDe, emAbertoPor, recortarPorStatus, itensPorStatus, ehPendencia, ehRegularizacao, scsPorCompradorStatus, prePedidosPorCompradorRegional, participacaoCompradores,
  pctSaving, resumoSaving, savingPorFilial, savingPorComprador, savingPorMes,
} from '../src/analise.js';
import { brutosDe, recalcular } from '../src/memoria.js';
import { validarConfig } from '../src/telas/configuracao.js';
import { gerarCsv } from '../src/ui/tabela.js';
import { criarConfig, CONFIG_PADRAO } from '../src/config/index.js';
import { calcularLinhaBase } from '../src/regras.js';
import { serie } from '../src/datas.js';

/** Registro já calculado, só com os campos que as telas usam. */
const reg = (x) => ({
  solicitacao: 'FDS-1', sc: 1, status: 'Em Pedido', comprador: 'Ana', regional: 'Sul', nomeFilial: 'Alfa',
  prioridade: 'NORMAL', temContrato: 'não', diasEmAberto: null, sla: null, numeroPrePedido: null,
  totalPedidoComImpostos: null, savingReal: 0, anoPedido: null, mesPedido: null, ...x,
});

test('chaveMes e rotuloMes', () => {
  assert.equal(chaveMes(reg({ anoPedido: 2026, mesPedido: 3 })), '2026-03');
  assert.equal(chaveMes(reg({})), null);
  assert.equal(rotuloMes('2026-11'), 'nov/2026');
  assert.equal(rotuloMes(null), '-');
});

test('aplicarFiltros: vazio = todos; vários filtros = E; mês só no Saving', () => {
  const regs = [
    reg({ regional: 'Sul', comprador: 'Ana', anoPedido: 2026, mesPedido: 10 }),
    reg({ regional: 'Sul', comprador: 'Bia', anoPedido: 2026, mesPedido: 11 }),
    reg({ regional: 'Norte', comprador: null }),
  ];
  assert.equal(aplicarFiltros(regs, {}, 'regional').length, 3);
  assert.equal(aplicarFiltros(regs, { regional: new Set() }, 'regional').length, 3);
  assert.equal(aplicarFiltros(regs, { regional: new Set(['Sul']) }, 'regional').length, 2);
  assert.equal(aplicarFiltros(regs, { regional: new Set(['Sul']), comprador: new Set(['Bia']) }, 'regional').length, 1);
  assert.equal(aplicarFiltros(regs, { comprador: new Set(['-']) }, 'regional').length, 1, 'sem comprador vira "-"');
  assert.equal(aplicarFiltros(regs, { mes: new Set(['2026-10']) }, 'regional').length, 3, 'mês não vale na Regional');
  assert.equal(aplicarFiltros(regs, { mes: new Set(['2026-10']) }, 'saving').length, 1);
});

test('recorte por status: vários status, vazio = todos; pendências', () => {
  const regs = [
    reg({ status: 'Em pendências de compra' }), reg({ status: 'EM PENDÊNCIAS DE CONTRATO' }),
    reg({ status: 'Em Pré-Pedido' }), reg({ status: 'Em Cotação' }), reg({ status: null }),
  ];
  assert.equal(recortarPorStatus(regs, new Set()).length, 5);
  assert.equal(recortarPorStatus(regs, undefined).length, 5);
  assert.deepEqual(recortarPorStatus(regs, new Set(['Em Cotação', 'Em Pré-Pedido'])).map((r) => r.status), ['Em Pré-Pedido', 'Em Cotação']);
  assert.equal(recortarPorStatus(regs, new Set(['-'])).length, 1);
  assert.deepEqual(regs.filter(ehPendencia).map((r) => r.status), ['Em pendências de compra', 'EM PENDÊNCIAS DE CONTRATO']);
  assert.equal(ehPendencia(reg({ status: 'Em Pedido' })), false);
});

test('itensPorStatus: ordem do processo, outros no fim', () => {
  const regs = [reg({ status: 'Zeta' }), reg({ status: 'Em pendências de compra' }), reg({ status: 'Em Pré-Pedido' }), reg({ status: 'Em Pré-Pedido' })];
  assert.deepEqual(itensPorStatus(regs), [
    { status: 'Em Pré-Pedido', itens: 2 }, { status: 'Em pendências de compra', itens: 1 }, { status: 'Zeta', itens: 1 },
  ]);
});

test('opcoesDosFiltros: ordem alfabética, "-" por último', () => {
  const o = opcoesDosFiltros([reg({ comprador: 'Bia' }), reg({ comprador: null }), reg({ comprador: 'Ana' })]);
  assert.deepEqual(o.comprador, ['Ana', 'Bia', '-']);
  assert.deepEqual(o.mes, ['-']);
});

test('faixas de dias', () => {
  assert.equal(faixaDe(0), 'ate5');
  assert.equal(faixaDe(5), 'ate5');
  assert.equal(faixaDe(6), '6a10');
  assert.equal(faixaDe(30), '16a30');
  assert.equal(faixaDe(31), 'mais30');
});

test('resumoEmAberto: SCs distintas, SLA, média e máximo', () => {
  const regs = [
    reg({ solicitacao: 'S1', diasEmAberto: 2, sla: 'No Prazo' }),
    reg({ solicitacao: 'S1', diasEmAberto: 2, sla: 'No Prazo' }),
    reg({ solicitacao: 'S2', diasEmAberto: 20, sla: 'Fora do Prazo' }),
    reg({ solicitacao: 'S3', diasEmAberto: 8, sla: null }),
    reg({ solicitacao: 'S4', diasEmAberto: null }), // tem pedido: não está em aberto
  ];
  const abertos = itensEmAberto(regs);
  assert.equal(abertos.length, 4);
  const r = resumoEmAberto(abertos);
  assert.deepEqual({ ...r }, {
    scs: 3, itens: 4, noPrazo: 2, fora: 1, semPrazo: 1, pctNoPrazo: 2 / 3, mediaDias: 8, maxDias: 20,
  });
  assert.deepEqual(porFaixaDeDias(abertos).map((f) => [f.id, f.scs, f.itens]),
    [['ate5', 1, 2], ['6a10', 1, 1], ['11a15', 0, 0], ['16a30', 1, 1], ['mais30', 0, 0]]);
  const vazio = resumoEmAberto([]);
  assert.equal(vazio.pctNoPrazo, null);
  assert.equal(vazio.mediaDias, null);
});

test('emAbertoPor: agrupa, "-" para vazio, ordena por SCs', () => {
  const g = emAbertoPor([
    reg({ solicitacao: 'S1', regional: 'Sul', diasEmAberto: 1 }),
    reg({ solicitacao: 'S2', regional: 'Norte', diasEmAberto: 1 }),
    reg({ solicitacao: 'S3', regional: 'Norte', diasEmAberto: 1 }),
    reg({ solicitacao: 'S4', regional: null, diasEmAberto: 1 }),
  ], 'regional');
  assert.deepEqual(g.map((x) => [x.chave, x.scs]), [['Norte', 2], ['-', 1], ['Sul', 1]]);
});

test('scsPorCompradorStatus: distintas por status e no total; status desconhecido vai para Outros', () => {
  const r = scsPorCompradorStatus([
    reg({ solicitacao: 'S1', comprador: 'Ana', status: 'Em Pedido' }),
    reg({ solicitacao: 'S1', comprador: 'Ana', status: 'Em Cotação' }),
    reg({ solicitacao: 'S2', comprador: 'Ana', status: 'Em Pedido' }),
    reg({ solicitacao: 'S3', comprador: null, status: 'Status Novo' }),
  ]);
  assert.deepEqual(r.status, ['Em Pedido', 'Em Cotação', 'Outros']);
  const ana = r.linhas.find((l) => l.comprador === 'Ana');
  assert.deepEqual(ana.porStatus, { 'Em Pedido': 2, 'Em Cotação': 1, Outros: 0 });
  assert.equal(ana.total, 2, 'S1 em dois status conta uma vez');
  assert.equal(r.linhas.find((l) => l.comprador === '-').porStatus.Outros, 1);
  assert.equal(r.totalGeral, 3);
  assert.deepEqual(r.totaisStatus, { 'Em Pedido': 2, 'Em Cotação': 1, Outros: 1 });
});

test('prePedidosPorCompradorRegional: distintos, vazio conta 1 como na planilha (DISTINCTCOUNT)', () => {
  const r = prePedidosPorCompradorRegional([
    reg({ comprador: 'Ana', regional: 'Sul', numeroPrePedido: 'P1' }),
    reg({ comprador: 'Ana', regional: 'Sul', numeroPrePedido: 'P1' }),
    reg({ comprador: 'Ana', regional: 'Norte', numeroPrePedido: 'P2' }),
    reg({ comprador: 'Bia', regional: 'Sul', numeroPrePedido: 'P3' }),
    reg({ comprador: 'Bia', regional: 'Sul', numeroPrePedido: null }), // vazio: +1 em Bia/Sul e Bia
    reg({ comprador: 'Bia', regional: 'Leste', numeroPrePedido: '' }), // Leste sem pré-pedido real: não vira coluna
    reg({ comprador: 'Caio', regional: 'Sul', numeroPrePedido: null }), // sem pré-pedido real: não vira linha
  ]);
  assert.deepEqual(r.regionais, ['Norte', 'Sul']);
  assert.deepEqual(r.linhas.map((l) => [l.comprador, l.porRegional.Norte, l.porRegional.Sul, l.total]),
    [['Ana', 1, 1, 2], ['Bia', 0, 2, 2]]);
  assert.equal(r.totalGeral, 4, 'P1, P2, P3 e o vazio');
  assert.deepEqual(r.totaisRegional, { Norte: 1, Sul: 3 }, 'Sul: P1, P3 e o vazio');
  assert.equal(prePedidosPorCompradorRegional([reg({ numeroPrePedido: null })]).totalGeral, 0);
});

test('participacaoCompradores: % das linhas de SC e SLA em aberto', () => {
  const p = participacaoCompradores([
    reg({ comprador: 'Ana', solicitacao: 'S1', diasEmAberto: 3, sla: 'No Prazo' }),
    reg({ comprador: 'Ana', solicitacao: 'S2', diasEmAberto: 30, sla: 'Fora do Prazo' }),
    reg({ comprador: 'Bia', solicitacao: 'S3' }),
    reg({ comprador: 'Bia', solicitacao: 'S4', sc: null }),
  ]);
  assert.deepEqual(p.map((x) => [x.comprador, x.itens, x.participacao, x.abertas, x.noPrazo, x.fora, x.pctNoPrazo]),
    [['Ana', 2, 2 / 3, 2, 1, 1, 0.5], ['Bia', 1, 1 / 3, 0, 0, 0, null]]);
});

test('saving: % = economia ÷ (total + economia); por filial, comprador e mês', () => {
  assert.equal(pctSaving(90, 10), 0.1);
  assert.equal(pctSaving(0, 0), null);
  const regs = [
    reg({ nomeFilial: 'Alfa', comprador: 'Ana', totalPedidoComImpostos: 90, savingReal: 10, anoPedido: 2026, mesPedido: 10 }),
    reg({ nomeFilial: 'Alfa', comprador: 'Bia', totalPedidoComImpostos: 100, savingReal: 0, anoPedido: 2026, mesPedido: 9 }),
    reg({ nomeFilial: 'Beta', comprador: 'Bia', totalPedidoComImpostos: null, savingReal: 0 }),
  ];
  assert.deepEqual({ ...resumoSaving(regs) }, { chave: 'total', total: 190, economia: 10, itensComSaving: 1, pct: 0.05 });
  assert.deepEqual(savingPorFilial(regs).map((g) => [g.chave, g.total]), [['Alfa', 190], ['Beta', 0]]);
  assert.deepEqual(savingPorComprador(regs).map((g) => g.chave), ['Ana', 'Bia']);
  assert.deepEqual(savingPorMes(regs).map((g) => [g.chave, g.economia]), [['2026-09', 0], ['2026-10', 10]]);
  assert.equal(resumoSaving([]).pct, null);
});

test('memória: brutosDe guarda só as colunas do ME; recalcular refaz com outra config e outro dia', () => {
  const cfg = criarConfig(CONFIG_PADRAO);
  const codigo = CONFIG_PADRAO.filiais[0].codigo;
  const bruto = {
    solicitacao: 'FDS-123', criacao: serie(2026, 11, 2), codigoFilial: codigo, selecionadoPor: '', unidade: 'UN',
    prioridade: 'NORMAL', status: 'Em Cotação', numeroPedido: null, dataCancelamento: null, contrato: null, saving: null,
  };
  const calculado = calcularLinhaBase({ ...bruto }, cfg, serie(2026, 11, 4));
  const [b] = brutosDe('base', [calculado]);
  assert.equal(b.solicitacao, 'FDS-123');
  assert.equal('sc' in b, false, 'campo calculado não é guardado');
  assert.equal('diasEmAberto' in b, false);

  const [hoje] = recalcular('base', [b], cfg, serie(2026, 11, 4));
  const [depois] = recalcular('base', [b], cfg, serie(2026, 11, 11));
  assert.ok(depois.diasEmAberto > hoje.diasEmAberto, 'dias em aberto andam com o dia');

  const semFilial = criarConfig({ ...CONFIG_PADRAO, filiais: CONFIG_PADRAO.filiais.slice(1) });
  const restantes = recalcular('base', [b], semFilial, serie(2026, 11, 4));
  assert.equal(restantes.length, 0, 'filial removida do de-para sai da tela (códigos do padrão são únicos)');
});

test('validarConfig: aceita o padrão e aponta problemas', () => {
  assert.deepEqual(validarConfig(structuredClone(CONFIG_PADRAO)), []);
  const c = structuredClone(CONFIG_PADRAO);
  c.filiais.push({ codigo: '', ajustada: '' });
  c.filiais.push({ ...c.filiais[0] });
  c.compradores.push({ nome: 'X', apelido: '' });
  c.sla[0].min = 20;
  c.sla[1].max = NaN;
  const erros = validarConfig(c);
  assert.equal(erros.length, 6, erros.join('\n'));
  assert.ok(erros.some((e) => e.includes('código repetido')));
  assert.ok(erros.some((e) => e.includes('mínimo maior que o máximo')));
});

test('gerarCsv: ";" como separador, vírgula decimal, aspas quando preciso, BOM', () => {
  const csv = gerarCsv([
    { rotulo: 'Nome', valor: (l) => l.n },
    { rotulo: 'Valor', valor: (l) => l.v },
    { rotulo: 'Data', valor: (l) => l.d, tipo: 'data' },
  ], [{ n: 'A;B', v: 1.5, d: serie(2026, 11, 11) }, { n: 'Diz "oi"', v: null, d: null }]);
  assert.equal(csv, '﻿Nome;Valor;Data\r\n"A;B";1,5;11/11/2026\r\n"Diz ""oi""";;\r\n');
});

test('ehRegularizacao: categoria REGULARIZAÇÃO, sem maiúsculas nem acento', () => {
  assert.equal(ehRegularizacao({ categoria: 'REGULARIZAÇÃO' }), true);
  assert.equal(ehRegularizacao({ categoria: ' regularizacao ' }), true);
  assert.equal(ehRegularizacao({ categoria: 'NORMAL' }), false);
  assert.equal(ehRegularizacao({ categoria: null }), false);
  assert.equal(ehRegularizacao({}), false);
});
