// Agregações e filtros das telas (src/analise.js), memória (src/memoria.js), validação da
// configuração e CSV. Dados fictícios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aplicarFiltros, opcoesDosFiltros, chaveMes, rotuloMes, itensEmAberto, resumoEmAberto, porFaixaDeDias,
  faixaDe, emAbertoPor, recortarPorStatus, itensPorStatus, ehPendencia, ehRegularizacao, scsPorStatus, resumoStatus, periodosDePedido, spendPorFilial, resumoSpend, entregasPorStatus, recortarPor, scsPorCompradorStatus, prePedidosPorCompradorRegional, aguardandoAprovacao,
  pctSaving, resumoSaving, savingPorFilial, savingPorComprador, savingPorMes,
} from '../src/analise.js';
import { brutosDe, recalcular, juntarAoHistorico } from '../src/memoria.js';
import { validarConfig, lerConfigExportada } from '../src/telas/configuracao.js';
import { recortarPeriodo } from '../src/telas/compradores.js';
import { gerarCsv } from '../src/ui/tabela.js';
import { criarConfig, CONFIG_PADRAO } from '../src/config/index.js';
import { calcularLinhaBase } from '../src/regras.js';
import { serie } from '../src/datas.js';
import { variacao, variacaoRelativa, comparar, pontos, serieDe } from '../src/ui/cartoes.js';
import { diasDesdeABase } from '../src/ui/casca.js';

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
    scs: 3, scsNoPrazo: 1, scsFora: 1, scsSemPrazo: 1, pctScsNoPrazo: 1 / 2,
    itens: 4, noPrazo: 2, fora: 1, semPrazo: 1, pctNoPrazo: 2 / 3, mediaDias: 8, maxDias: 20,
  });
  // SC com itens no prazo, fora e sem prazo conta uma vez, como fora.
  const mista = resumoEmAberto([
    reg({ solicitacao: 'S9', diasEmAberto: 31, sla: 'No Prazo' }),
    reg({ solicitacao: 'S9', diasEmAberto: 31, sla: 'Fora do Prazo' }),
    reg({ solicitacao: 'S9', diasEmAberto: 31, sla: null }),
  ]);
  assert.deepEqual([mista.scsNoPrazo, mista.scsFora, mista.scsSemPrazo, mista.fora], [0, 1, 0, 1]);
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
    reg({ comprador: null, regional: 'Oeste', numeroPrePedido: 'P9' }), // "-" (fora do de-para): fora, como na planilha
    reg({ comprador: 'Pendente', regional: 'Sul', numeroPrePedido: 'P8' }), // Pendente: fora, como na planilha
  ]);
  assert.deepEqual(r.regionais, ['Norte', 'Sul']);
  assert.deepEqual(r.linhas.map((l) => [l.comprador, l.porRegional.Norte, l.porRegional.Sul, l.total]),
    [['Ana', 1, 1, 2], ['Bia', 0, 2, 2]]);
  assert.equal(r.totalGeral, 4, 'P1, P2, P3 e o vazio');
  assert.deepEqual(r.totaisRegional, { Norte: 1, Sul: 3 }, 'Sul: P1, P3 e o vazio');
  assert.equal(prePedidosPorCompradorRegional([reg({ numeroPrePedido: null })]).totalGeral, 0);
});

test('recortarPeriodo: SCs pela criação, pré-pedidos pela data do pré-pedido', () => {
  const regs = [
    reg({ solicitacao: 'S1', criacao: 46300, dataPrePedido: 46338.6, numeroPrePedido: 'P1' }), // SC antiga, pré-pedido hoje
    reg({ solicitacao: 'S2', criacao: 46338, dataPrePedido: null, numeroPrePedido: null }), // SC de hoje, sem pré-pedido
    reg({ solicitacao: 'S3', criacao: 46337, dataPrePedido: 46337, numeroPrePedido: 'P3' }),
  ];
  const hoje = { de: 46338, ate: 46338 };
  assert.deepEqual(recortarPeriodo(regs, hoje).map((r) => r.solicitacao), ['S2']);
  assert.deepEqual(recortarPeriodo(regs, hoje, 'dataPrePedido').map((r) => r.solicitacao), ['S1']);
  assert.equal(recortarPeriodo(regs, { de: null, ate: null }, 'dataPrePedido'), regs, 'sem período: tudo, como a planilha');
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
  const erros = validarConfig(c);
  assert.equal(erros.length, 4, erros.join('\n'));
  assert.ok(erros.some((e) => e.includes('código repetido')));
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

test('scsPorStatus: SCs distintas e itens por status', () => {
  const regs = [
    { solicitacao: 'S1', status: 'Em Cotação' }, { solicitacao: 'S1', status: 'Em Cotação' },
    { solicitacao: 'S2', status: 'Em Cotação' }, { solicitacao: 'S2', status: 'Em Pedido' },
  ];
  assert.deepEqual(scsPorStatus(regs), [
    { status: 'Em Pedido', itens: 1, scs: 1 },
    { status: 'Em Cotação', itens: 3, scs: 2 },
  ]);
});

test('spendPorFilial: valor por filial (com ou sem nº de pedido, como a planilha), % do total, sem filial "-"', () => {
  const regs = [
    { nomeFilial: 'A', numeroPedido: 'OF-1', totalPedidoComImpostos: 100 },
    { nomeFilial: 'A', numeroPedido: 'OF-1', totalPedidoComImpostos: 50 },
    { nomeFilial: 'B', numeroPedido: 'OF-2', totalPedidoComImpostos: 300 },
    { nomeFilial: 'B', numeroPedido: null, totalPedidoComImpostos: 50 },
    { nomeFilial: 'C', numeroPedido: null, totalPedidoComImpostos: null },
    { nomeFilial: null, numeroPedido: 'OF-3', totalPedidoComImpostos: 999 },
  ];
  assert.deepEqual(spendPorFilial(regs), [
    { chave: 'B', valor: 350, ofs: 1, pct: 0.7 },
    { chave: 'A', valor: 150, ofs: 1, pct: 0.3 },
  ]);
  const r = resumoSpend(regs);
  assert.equal(r.total, 500);
  assert.equal(r.ofs, 2);
  assert.equal(r.filiais, 2);
  assert.equal(r.maior.chave, 'B');
  assert.deepEqual(spendPorFilial([]), []);
});

test('entregasPorStatus: OFs distintas e itens, na ordem do acompanhamento; recortarPor', () => {
  const regs = [
    { numeroPedido: 'OF-1', statusEntrega: 'ENTREGUE' },
    { numeroPedido: 'OF-2', statusEntrega: 'NÃO ENTREGUE' },
    { numeroPedido: 'OF-2', statusEntrega: 'NÃO ENTREGUE' },
    { numeroPedido: 'OF-3', statusEntrega: 'ENTREGUE PARCIAL' },
  ];
  assert.deepEqual(entregasPorStatus(regs), [
    { status: 'NÃO ENTREGUE', itens: 2, ofs: 1 },
    { status: 'ENTREGUE PARCIAL', itens: 1, ofs: 1 },
    { status: 'ENTREGUE', itens: 1, ofs: 1 },
  ]);
  assert.equal(recortarPor(regs, 'statusEntrega', new Set(['ENTREGUE'])).length, 1);
  assert.equal(recortarPor(regs, 'statusEntrega', new Set()).length, 4);
});

test('resumoStatus: SCs distintas no período, em aberto, em pedido e canceladas', () => {
  const regs = [
    reg({ solicitacao: 'S1', status: 'Em Pedido', diasEmAberto: null }),
    reg({ solicitacao: 'S1', status: 'Em Cotação', diasEmAberto: 3 }),
    reg({ solicitacao: 'S2', status: 'Cancelado', diasEmAberto: null }),
  ];
  assert.deepEqual(resumoStatus(regs), { scs: 2, itens: 3, abertas: 1, emPedido: 1, canceladas: 1 });
});

test('variacao: sinal no texto, tom pelo lado melhor, igual e sem base anterior', () => {
  const inteiro = (n) => String(n);
  assert.deepEqual(variacao({ atual: 47, anterior: 42, rotulo: '10/11', formato: inteiro, melhor: 'menor' }),
    { seta: '▲', texto: '+5 desde 10/11', tom: 'pior', rotulo: '10/11', ligacao: 'desde' });
  assert.equal(variacao({ atual: 40, anterior: 42, rotulo: '10/11', formato: inteiro, melhor: 'menor' }).tom, 'melhor');
  assert.equal(variacao({ atual: 40, anterior: 42, rotulo: '10/11', formato: inteiro }).texto, '−2 desde 10/11');
  assert.equal(variacao({ atual: 40, anterior: 42, rotulo: '10/11', formato: inteiro }).tom, 'neutro');
  assert.equal(variacao({ atual: 3, anterior: 3, rotulo: '10/11', formato: inteiro }).texto, 'igual a 10/11');
  assert.equal(variacao({ atual: 3, anterior: null, rotulo: '10/11', formato: inteiro }), null);
  assert.equal(comparar(undefined, { a: 1 }, null)('a', inteiro), null);
  assert.equal(comparar('10/11', { a: 0.9 }, { a: 0.85 })('a', pontos, 'maior').texto, '+5 p.p. desde 10/11');
});

test('diasDesdeABase: dias úteis desde a execução do ME, sem contar o dia dela', () => {
  const qua = serie(2026, 11, 11); // quarta
  assert.equal(diasDesdeABase(qua, qua), 0);
  assert.equal(diasDesdeABase(qua, serie(2026, 11, 12)), 1);
  assert.equal(diasDesdeABase(qua, serie(2026, 11, 13)), 2);
  assert.equal(diasDesdeABase(serie(2026, 11, 13), serie(2026, 11, 16)), 1); // sexta -> segunda
  assert.equal(diasDesdeABase(null, qua), 0);
});

test('periodosDePedido: mesmo trecho do mês/trimestre anterior, sem passar do fim', () => {
  const p = (sc, d) => reg({ solicitacao: sc, numeroPedido: `OF-${sc}`, dataPedido: d });
  const regs = [p('a', serie(2026, 11, 12)), p('b', serie(2026, 11, 2)), p('c', serie(2026, 10, 12)), p('d', serie(2026, 10, 13)), p('e', serie(2026, 9, 30)), reg({ solicitacao: 'x' })];
  const m = periodosDePedido(regs, 'mes');
  assert.deepEqual([m.atual.inicio, m.atual.fim, m.anterior.inicio, m.anterior.fim], [serie(2026, 11, 1), serie(2026, 11, 12), serie(2026, 10, 1), serie(2026, 10, 12)]);
  assert.deepEqual(m.atual.registros.map((r) => r.solicitacao), ['a', 'b']);
  assert.deepEqual(m.anterior.registros.map((r) => r.solicitacao), ['c']);
  const t = periodosDePedido(regs, 'tri');
  assert.deepEqual([t.atual.inicio, t.anterior.inicio, t.anterior.fim], [serie(2026, 10, 1), serie(2026, 7, 1), serie(2026, 8, 12)]);
  // 31/03 -> fevereiro termina antes: o anterior para no último dia dele.
  const mar = periodosDePedido([p('f', serie(2026, 3, 31))], 'mes');
  assert.equal(mar.anterior.fim, serie(2026, 2, 28));
  // janeiro compara com dezembro do ano anterior
  assert.equal(periodosDePedido([p('g', serie(2026, 1, 5))], 'mes').anterior.inicio, serie(2025, 12, 1));
  assert.equal(periodosDePedido([reg({ solicitacao: 'y' })], 'mes'), null);
});

test('histórico dos mini gráficos: um ponto por dia, em ordem, no máximo 30; série só com 2+ pontos', () => {
  let h = [];
  for (let d = 1; d <= 35; d++) h = juntarAoHistorico(h, { dia: d, v: d });
  assert.equal(h.length, 30);
  assert.equal(h[0].dia, 6);
  h = juntarAoHistorico(h, { dia: 20, v: 99 });
  assert.equal(h.filter((p) => p.dia === 20).length, 1);
  assert.equal(h.find((p) => p.dia === 20).v, 99);
  assert.deepEqual(serieDe([{ v: 1 }, { v: 2 }], (p) => p.v, 3), [1, 2, 3]);
  assert.equal(serieDe(null, (p) => p.v, 3), null);
  assert.equal(serieDe([], (p) => p.v, 3), null);
});

test('variacaoRelativa: % do anterior, ligação "x", sem base = null', () => {
  assert.equal(variacaoRelativa({ atual: 112, anterior: 100, rotulo: '01/10 a 12/10' }).texto, '+12% x 01/10 a 12/10');
  assert.equal(variacaoRelativa({ atual: 95, anterior: 100, rotulo: 'out', melhor: 'maior' }).tom, 'pior');
  assert.equal(variacaoRelativa({ atual: 5, anterior: 0, rotulo: 'out' }), null);
});

test('aguardando aprovação: Status Pré-Pedido traduzido começa com "Ag. aprovação"', () => {
  const regs = [
    { aprovacao: 'Ag. aprovação Beltrano' }, { aprovacao: 'Ag. aprovação Corporativo' }, { aprovacao: 'Ag. aprovação GA' },
    { aprovacao: 'INCONSISTÊNCIA DE INTEGRAÇÃO' }, { aprovacao: null }, {},
  ];
  assert.deepEqual(regs.map(aguardandoAprovacao), [true, true, true, false, false, false]);
});

test('importar configuração: só campos conhecidos, como texto; arquivo inválido dá erro', () => {
  const ok = lerConfigExportada(JSON.stringify({
    filiais: [{ codigo: 30999, ajustada: '999', nome: 'Teste', regional: 'R', aprovadorGA: 'Beltrano', extra: 'x' }],
    compradores: [{ nome: 'Fulano de Tal', apelido: 'Fulano' }],
  }));
  assert.deepEqual(ok.config.filiais, [{ codigo: '30999', ajustada: '999', nome: 'Teste', regional: 'R', descricao: '', aprovadorGA: 'Beltrano' }]);
  assert.deepEqual(ok.config.compradores, [{ nome: 'Fulano de Tal', apelido: 'Fulano' }]);
  assert.ok(lerConfigExportada('não é json').erros.length);
  assert.ok(lerConfigExportada('{"filiais": []}').erros.length);
  assert.ok(lerConfigExportada('{"filiais": [{"codigo": ""}], "compradores": []}').erros.length);
});
