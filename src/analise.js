// Filtros e agregações das telas. Funções puras (sem DOM): testadas em tests/analise.test.js.
// Contagens de SC são DISTINTAS por "Solicitação de Compra", como a contagem distinta
// do modelo de dados da planilha antiga; contagem de itens = linhas.

import { serie, partesDaSerie } from './datas.js';
import { PENDENTE } from './regras.js';

const SEM_VALOR = '-';
const nomeOuTraco = (v) => (v === null || v === undefined || v === '' ? SEM_VALOR : String(v));

/** Mês do pedido como "aaaa-mm" (ou null sem pedido). */
export function chaveMes(r) {
  return r.anoPedido ? `${r.anoPedido}-${String(r.mesPedido).padStart(2, '0')}` : null;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function rotuloMes(chave) {
  if (!chave) return SEM_VALOR;
  const [ano, mes] = chave.split('-');
  return `${MESES[Number(mes) - 1]}/${ano}`;
}

/**
 * Filtros globais. telas: em quais telas o filtro vale (ausente = todas).
 * "Mês do pedido" só faz sentido onde há pedido (Saving e Spend).
 */
export const FILTROS = [
  { id: 'regional', rotulo: 'Regional', valor: (r) => nomeOuTraco(r.regional) },
  { id: 'filial', rotulo: 'Filial', valor: (r) => nomeOuTraco(r.nomeFilial) },
  { id: 'comprador', rotulo: 'Comprador', valor: (r) => nomeOuTraco(r.comprador) },
  { id: 'prioridade', rotulo: 'Prioridade', valor: (r) => nomeOuTraco(r.prioridade) },
  { id: 'contrato', rotulo: 'Contrato?', valor: (r) => nomeOuTraco(r.temContrato) },
  { id: 'mes', rotulo: 'Mês do pedido', valor: (r) => chaveMes(r) ?? SEM_VALOR, rotuloValor: rotuloMes, telas: ['saving', 'spend'] },
];

export const filtroValeNaTela = (f, tela) => !f.telas || f.telas.includes(tela);

/**
 * Aplica os filtros ativos. selecao: { idFiltro: Set de valores } (vazio/ausente = todos).
 */
export function aplicarFiltros(registros, selecao, tela) {
  const ativos = FILTROS.filter((f) => filtroValeNaTela(f, tela) && selecao[f.id]?.size);
  if (!ativos.length) return registros;
  return registros.filter((r) => ativos.every((f) => selecao[f.id].has(f.valor(r))));
}

/** Valores possíveis de cada filtro (para montar as listas), em ordem. */
export function opcoesDosFiltros(registros) {
  const opcoes = {};
  for (const f of FILTROS) {
    const valores = new Set(registros.map(f.valor));
    opcoes[f.id] = [...valores].sort((a, b) => (a === SEM_VALOR) - (b === SEM_VALOR) || a.localeCompare(b, 'pt-BR'));
  }
  return opcoes;
}

// ---------- Regional (SCs em aberto) ----------

/** Itens em aberto: sem pedido e não cancelados (têm dias em aberto). */
export const itensEmAberto = (registros) => registros.filter((r) => r.diasEmAberto !== null);

export const FAIXAS_DIAS = [
  { id: 'ate5', rotulo: 'Até 5 dias', ate: 5 },
  { id: '6a10', rotulo: '6 a 10 dias', ate: 10 },
  { id: '11a15', rotulo: '11 a 15 dias', ate: 15 },
  { id: '16a30', rotulo: '16 a 30 dias', ate: 30 },
  { id: 'mais30', rotulo: 'Mais de 30 dias', ate: Infinity },
];
export const faixaDe = (dias) => FAIXAS_DIAS.find((f) => dias <= f.ate).id;

const distintas = (linhas) => new Set(linhas.map((r) => r.solicitacao)).size;

// ---------- Hoje (o que pede ação; só no app da equipe) ----------

/** SCs em aberto (uma por Solicitação): dados da 1ª linha, maior número de dias e SLA da SC. */
export function scsEmAberto(abertos) {
  const grupos = new Map();
  for (const r of abertos) {
    if (!grupos.has(r.solicitacao)) grupos.set(r.solicitacao, []);
    grupos.get(r.solicitacao).push(r);
  }
  return [...grupos].map(([solicitacao, linhas]) => {
    const r = linhas[0];
    const fora = linhas.some((x) => x.sla === 'Fora do Prazo');
    return {
      solicitacao, sc: r.sc, nomeFilial: r.nomeFilial, filial: r.filial, regional: r.regional,
      comprador: linhas.find((x) => x.comprador)?.comprador ?? null, prioridade: r.prioridade,
      dias: Math.max(...linhas.map((x) => x.diasEmAberto ?? 0)),
      sla: fora ? 'Fora do Prazo' : (linhas.some((x) => x.sla === 'No Prazo') ? 'No Prazo' : null),
      itens: linhas.length,
    };
  }).sort((a, b) => b.dias - a.dias || String(a.sc).localeCompare(String(b.sc), 'pt-BR', { numeric: true }));
}

/**
 * Aba Hoje (pedido da equipe, 12/11/2026). abertos: itens em aberto de agora; anteriores: itens em
 * aberto da base anterior (outro dia do ME) ou null.
 * - viraramFora: SCs fora do prazo que não estavam fora na base anterior (sem anterior: no 1º dia fora, prazo + 1).
 * - vencendo: SCs ainda no prazo a até 2 dias úteis do limite (prazo - 1 ou prazo).
 * - semComprador: SCs sem comprador ou em "Pendente" (pendências de compra e contrato no ME).
 * - novas: SCs que não estavam em aberto na base anterior (sem anterior: com até 1 dia útil).
 */
export function resumoDoDia(abertos, anteriores, prazo) {
  const scs = scsEmAberto(abertos);
  const antes = anteriores ? new Map(scsEmAberto(anteriores).map((s) => [s.solicitacao, s])) : null;
  return {
    viraramFora: scs.filter((s) => s.sla === 'Fora do Prazo'
      && (antes ? antes.get(s.solicitacao)?.sla !== 'Fora do Prazo' : s.dias === prazo + 1)),
    vencendo: scs.filter((s) => s.sla === 'No Prazo' && s.dias >= prazo - 1 && s.dias <= prazo),
    semComprador: scs.filter((s) => !s.comprador || mesmoTexto(s.comprador, '-') || mesmoTexto(s.comprador, 'Pendente')),
    novas: scs.filter((s) => (antes ? !antes.has(s.solicitacao) : s.dias <= 1)),
  };
}

/** Cartões da tela Status: SCs distintas no período, em aberto, em pedido e canceladas. */
export function resumoStatus(registros) {
  const doStatus = new Map(scsPorStatus(registros).map((s) => [s.status, s.scs]));
  return {
    scs: distintas(registros),
    itens: registros.length,
    abertas: distintas(registros.filter((r) => r.diasEmAberto !== null && r.diasEmAberto !== undefined)),
    emPedido: doStatus.get('Em Pedido') ?? 0,
    canceladas: doStatus.get('Cancelado') ?? 0,
  };
}

/** Cartões das telas Regional, Atendimento e SCs por Comprador (contagens por item e por SC). */
export function resumoEmAberto(abertos) {
  const noPrazo = abertos.filter((r) => r.sla === 'No Prazo').length;
  const fora = abertos.filter((r) => r.sla === 'Fora do Prazo').length;
  const dias = abertos.map((r) => r.diasEmAberto);
  // Por SC (Atendimento): fora = algum item fora; no prazo = algum no prazo e nenhum fora; o resto, sem prazo.
  const slaDaSc = new Map();
  for (const r of abertos) {
    const atual = slaDaSc.get(r.solicitacao);
    if (r.sla === 'Fora do Prazo' || atual === 'Fora do Prazo') slaDaSc.set(r.solicitacao, 'Fora do Prazo');
    else if (r.sla === 'No Prazo' || atual === 'No Prazo') slaDaSc.set(r.solicitacao, 'No Prazo');
    else slaDaSc.set(r.solicitacao, null);
  }
  const scsCom = (sla) => [...slaDaSc.values()].filter((v) => v === sla).length;
  const scsNoPrazo = scsCom('No Prazo');
  const scsFora = scsCom('Fora do Prazo');
  return {
    scs: distintas(abertos),
    scsNoPrazo,
    scsFora,
    scsSemPrazo: slaDaSc.size - scsNoPrazo - scsFora,
    pctScsNoPrazo: scsNoPrazo + scsFora ? scsNoPrazo / (scsNoPrazo + scsFora) : null,
    itens: abertos.length,
    noPrazo,
    fora,
    semPrazo: abertos.length - noPrazo - fora,
    pctNoPrazo: noPrazo + fora ? noPrazo / (noPrazo + fora) : null,
    mediaDias: dias.length ? dias.reduce((s, d) => s + d, 0) / dias.length : null,
    maxDias: dias.length ? Math.max(...dias) : null,
  };
}

/** SCs e itens por faixa de dias úteis em aberto. */
export function porFaixaDeDias(abertos) {
  return FAIXAS_DIAS.map((f) => {
    const linhas = abertos.filter((r) => faixaDe(r.diasEmAberto) === f.id);
    return { ...f, scs: distintas(linhas), itens: linhas.length };
  });
}

/** Agrupa e resume (SCs, SLA, média de dias) por um campo; ordena por SCs. */
export function emAbertoPor(abertos, campo) {
  const grupos = new Map();
  for (const r of abertos) {
    const k = nomeOuTraco(r[campo]);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(r);
  }
  return [...grupos].map(([chave, linhas]) => ({ chave, ...resumoEmAberto(linhas) }))
    .sort((a, b) => b.scs - a.scs || a.chave.localeCompare(b.chave, 'pt-BR'));
}

/**
 * Status do acompanhamento diário. No ME esses itens nunca têm "Selecionado por",
 * então ficam no comprador "Pendente".
 */
export const STATUS_PENDENCIAS = ['Em pendências de compra', 'Em pendências de contrato'];
const mesmoTexto = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
export const ehPendencia = (r) => STATUS_PENDENCIAS.some((s) => mesmoTexto(r.status, s));

/**
 * SC de regularização ("Categoria solicitação" = REGULARIZAÇÃO no ME): compra já feita, SC aberta
 * depois. A categoria vale para a SC inteira. Sem diferenciar maiúsculas nem acento.
 */
export const ehRegularizacao = (r) => String(r.categoria ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().toLowerCase().startsWith('regularizacao');

/** Recorta por status. selecionados: Set de status (vazio/ausente = todos). */
export function recortarPorStatus(registros, selecionados) {
  if (!selecionados?.size) return registros;
  return registros.filter((r) => selecionados.has(nomeOuTraco(r.status)));
}

/** Itens por status, na ordem do processo (STATUS_SC), outros status no fim em ordem alfabética. */
export function itensPorStatus(registros) {
  const contagem = new Map();
  for (const r of registros) {
    const s = nomeOuTraco(r.status);
    contagem.set(s, (contagem.get(s) ?? 0) + 1);
  }
  const posicao = (s) => { const i = STATUS_SC.indexOf(s); return i < 0 ? STATUS_SC.length : i; };
  return [...contagem].map(([status, itens]) => ({ status, itens }))
    .sort((a, b) => posicao(a.status) - posicao(b.status) || a.status.localeCompare(b.status, 'pt-BR'));
}

// ---------- Compradores (aba sc p Compr) ----------

/** Ordem fixa dos status (processo) e cor por status: a cor segue o status, nunca a posição. */
export const STATUS_SC = [
  'Em Pedido', 'Em Pré-Pedido', 'Em Cotação', 'Em pendências de compra',
  'Em pendências de contrato', 'Sel. Comprador', 'Cancelado',
];
export const OUTROS = 'Outros';
const statusDoGrafico = (s) => (STATUS_SC.includes(s) ? s : OUTROS);

/**
 * SCs distintas por comprador x status (tabela dinâmica 3 da aba sc p Compr).
 * total = SCs distintas do comprador (uma SC com itens em dois status conta uma vez).
 */
export function scsPorCompradorStatus(registros) {
  const porComprador = new Map();
  const statusVistos = new Set();
  for (const r of registros) {
    const c = nomeOuTraco(r.comprador);
    const s = statusDoGrafico(r.status);
    statusVistos.add(s);
    if (!porComprador.has(c)) porComprador.set(c, { todas: new Set(), porStatus: new Map() });
    const g = porComprador.get(c);
    g.todas.add(r.solicitacao);
    if (!g.porStatus.has(s)) g.porStatus.set(s, new Set());
    g.porStatus.get(s).add(r.solicitacao);
  }
  const status = [...STATUS_SC, OUTROS].filter((s) => statusVistos.has(s));
  const linhas = [...porComprador].map(([comprador, g]) => ({
    comprador,
    porStatus: Object.fromEntries(status.map((s) => [s, g.porStatus.get(s)?.size ?? 0])),
    total: g.todas.size,
  })).sort((a, b) => b.total - a.total || a.comprador.localeCompare(b.comprador, 'pt-BR'));
  const totalGeral = new Set(registros.map((r) => r.solicitacao)).size;
  const totaisStatus = Object.fromEntries(status.map((s) => [s, new Set(
    registros.filter((r) => statusDoGrafico(r.status) === s).map((r) => r.solicitacao),
  ).size]));
  return { status, linhas, totaisStatus, totalGeral };
}

const temPrePedido = (r) => r.numeroPrePedido !== null && r.numeroPrePedido !== undefined && r.numeroPrePedido !== '';
const VAZIO = Symbol('vazio');

/**
 * Pré-pedidos distintos por comprador x regional (tabela dinâmica 1 da aba sc p Compr).
 * Igual à planilha (decisão de 11/11/2026): a contagem distinta do modelo de dados (DISTINCTCOUNT)
 * conta o pré-pedido VAZIO como um valor, então todo grupo com alguma SC sem pré-pedido soma 1.
 * Só os compradores do de-para, como a tabela da planilha (conferido em 12/11/2026: ela mostra só
 * Thayane, Vitor e Bruno W.; "-" (comprador fora do de-para) e Pendente ficam de fora, mesmo com
 * pré-pedido). Só aparecem compradores e regionais com pelo menos um pré-pedido de verdade.
 */
export function prePedidosPorCompradorRegional(registros) {
  const doDePara = (r) => { const c = nomeOuTraco(r.comprador); return c !== SEM_VALOR && c !== PENDENTE; };
  const comPre = registros.filter((r) => temPrePedido(r) && doDePara(r));
  const compradores = new Set(comPre.map((r) => nomeOuTraco(r.comprador)));
  const regionais = [...new Set(comPre.map((r) => nomeOuTraco(r.regional)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const valor = (r) => (temPrePedido(r) ? r.numeroPrePedido : VAZIO);
  const porComprador = new Map();
  for (const r of registros) {
    const c = nomeOuTraco(r.comprador);
    if (!compradores.has(c)) continue;
    if (!porComprador.has(c)) porComprador.set(c, { todos: new Set(), porRegional: new Map() });
    const g = porComprador.get(c);
    g.todos.add(valor(r));
    const reg = nomeOuTraco(r.regional);
    if (!g.porRegional.has(reg)) g.porRegional.set(reg, new Set());
    g.porRegional.get(reg).add(valor(r));
  }
  const linhas = [...porComprador].map(([comprador, g]) => ({
    comprador,
    porRegional: Object.fromEntries(regionais.map((x) => [x, g.porRegional.get(x)?.size ?? 0])),
    total: g.todos.size,
  })).sort((a, b) => b.total - a.total || a.comprador.localeCompare(b.comprador, 'pt-BR'));
  const doPainel = registros.filter((r) => compradores.has(nomeOuTraco(r.comprador)));
  const totaisRegional = Object.fromEntries(regionais.map((x) => [x,
    new Set(doPainel.filter((r) => nomeOuTraco(r.regional) === x).map(valor)).size]));
  return { regionais, linhas, totaisRegional, totalGeral: comPre.length ? new Set(doPainel.map(valor)).size : 0 };
}

// ---------- Saving ----------

/** % Saving = economia ÷ (total comprado + economia), como na planilha. */
export const pctSaving = (total, economia) => (total + economia ? economia / (total + economia) : null);

/** Total comprado (pedido c/ impostos) e economia (Saving Real) agrupados por uma função de chave. */
export function savingPor(registros, chaveDe) {
  const grupos = new Map();
  for (const r of registros) {
    const k = chaveDe(r);
    const g = grupos.get(k) ?? { chave: k, total: 0, economia: 0, itensComSaving: 0 };
    g.total += r.totalPedidoComImpostos ?? 0;
    g.economia += r.savingReal;
    if (r.savingReal) g.itensComSaving++;
    grupos.set(k, g);
  }
  return [...grupos.values()].map((g) => ({ ...g, pct: pctSaving(g.total, g.economia) }));
}

export function resumoSaving(registros) {
  const [g] = savingPor(registros, () => 'total');
  return g ?? { chave: 'total', total: 0, economia: 0, itensComSaving: 0, pct: null };
}

export const savingPorFilial = (registros) => savingPor(registros, (r) => nomeOuTraco(r.nomeFilial))
  .sort((a, b) => b.total - a.total);

export const savingPorComprador = (registros) => savingPor(registros, (r) => nomeOuTraco(r.comprador))
  .sort((a, b) => b.economia - a.economia || b.total - a.total);

/** Por mês do pedido, em ordem cronológica (só linhas com pedido). */
export const savingPorMes = (registros) => savingPor(registros.filter((r) => chaveMes(r)), chaveMes)
  .sort((a, b) => a.chave.localeCompare(b.chave));

/** SCs distintas e itens por status (tela Status), na mesma ordem de `itensPorStatus`. */
export function scsPorStatus(registros) {
  const scs = new Map();
  for (const r of registros) {
    const s = nomeOuTraco(r.status);
    if (!scs.has(s)) scs.set(s, new Set());
    scs.get(s).add(r.solicitacao);
  }
  return itensPorStatus(registros).map((g) => ({ ...g, scs: scs.get(g.status).size }));
}

// ---------- Spend (aba Spend) ----------

/**
 * Valor das OFs (pedido c/ impostos) por filial e % do total, do maior para o menor, como as
 * tabelas dinâmicas da aba Spend (filial "-" fica de fora). Soma toda linha com valor, mesmo sem
 * número de pedido (há linhas assim na base, e a planilha soma). ofs = pedidos distintos.
 */
export function spendPorFilial(registros) {
  const grupos = new Map();
  for (const r of registros) {
    if (!r.nomeFilial || (!r.numeroPedido && !r.totalPedidoComImpostos)) continue;
    const g = grupos.get(r.nomeFilial) ?? { chave: r.nomeFilial, valor: 0, pedidos: new Set() };
    g.valor += r.totalPedidoComImpostos ?? 0;
    if (r.numeroPedido) g.pedidos.add(r.numeroPedido);
    grupos.set(r.nomeFilial, g);
  }
  const total = [...grupos.values()].reduce((s, g) => s + g.valor, 0);
  return [...grupos.values()]
    .map(({ chave, valor, pedidos }) => ({ chave, valor, ofs: pedidos.size, pct: total ? valor / total : null }))
    .sort((a, b) => b.valor - a.valor || a.chave.localeCompare(b.chave, 'pt-BR'));
}

/**
 * Períodos para comparar em Spend e Saving (pedido da equipe, 12/11/2026), pela data do pedido.
 * tipo 'mes' | 'tri'. Atual: do 1º dia do mês (ou trimestre) do último pedido até o dia dele.
 * Anterior: o mesmo trecho do mês (ou trimestre) anterior, com o mesmo número de dias desde o
 * início, sem passar do fim dele. Assim um mês pela metade não é comparado com um mês inteiro.
 * Sem pedido com data: null.
 */
export function periodosDePedido(registros, tipo = 'mes') {
  const comPedido = registros.filter((r) => r.numeroPedido && Number.isFinite(r.dataPedido) && r.dataPedido > 0);
  if (!comPedido.length) return null;
  const fim = Math.floor(Math.max(...comPedido.map((r) => r.dataPedido)));
  const { ano, mes } = partesDaSerie(fim);
  const meses = tipo === 'tri' ? 3 : 1;
  const mesInicio = tipo === 'tri' ? Math.floor((mes - 1) / 3) * 3 + 1 : mes;
  const inicio = serie(ano, mesInicio, 1);
  const inicioAnt = serie(ano, mesInicio - meses, 1); // mês 0 ou negativo = ano anterior (Date.UTC)
  const fimAnt = Math.min(inicioAnt + (fim - inicio), inicio - 1);
  const entre = (a, b) => comPedido.filter((r) => Math.floor(r.dataPedido) >= a && Math.floor(r.dataPedido) <= b);
  return {
    atual: { inicio, fim, registros: entre(inicio, fim) },
    anterior: { inicio: inicioAnt, fim: fimAnt, registros: entre(inicioAnt, fimAnt) },
  };
}

export function resumoSpend(registros) {
  const filiais = spendPorFilial(registros);
  const ofs = new Set(registros.filter((r) => r.nomeFilial && r.numeroPedido).map((r) => r.numeroPedido)).size;
  // ofs: distintas no total (a mesma OF em duas filiais conta uma vez)
  return { total: filiais.reduce((s, g) => s + g.valor, 0), ofs, filiais: filiais.length, maior: filiais[0] ?? null };
}

// ---------- Entrega (aba Entrega, base Follow-Up) ----------

/** Status de entrega na ordem do acompanhamento: o que falta entregar primeiro. */
export const STATUS_ENTREGA = ['NÃO ENTREGUE', 'ENTREGUE PARCIAL', 'ENTREGUE'];

/** OFs distintas e itens por status de entrega (outros status no fim, em ordem alfabética). */
export function entregasPorStatus(registros) {
  const grupos = new Map();
  for (const r of registros) {
    const s = nomeOuTraco(r.statusEntrega);
    const g = grupos.get(s) ?? { status: s, itens: 0, pedidos: new Set() };
    g.itens++;
    g.pedidos.add(r.numeroPedido);
    grupos.set(s, g);
  }
  const posicao = (s) => { const i = STATUS_ENTREGA.indexOf(s.toUpperCase()); return i < 0 ? STATUS_ENTREGA.length : i; };
  return [...grupos.values()].map(({ status, itens, pedidos }) => ({ status, itens, ofs: pedidos.size }))
    .sort((a, b) => posicao(a.status) - posicao(b.status) || a.status.localeCompare(b.status, 'pt-BR'));
}

/** Recorta pelo valor de um campo. selecionados: Set (vazio/ausente = todos). */
export function recortarPor(registros, campo, selecionados) {
  if (!selecionados?.size) return registros;
  return registros.filter((r) => selecionados.has(nomeOuTraco(r[campo])));
}
