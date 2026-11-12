// Tela Entrega: OFs do Follow-Up com o status de entrega. Substitui a aba "Entrega" da planilha
// antiga (SC > OF > Data pedido > Filial > ... > Fornecedor > CNPJ > Status Entrega).
// Usa ctx.followUp (base Follow-Up, com os mesmos filtros globais); sem Follow-Up, avisa.
import { el } from '../ui/dom.js';
import { cartao, linhaDeCartoes, bloco, estadoVazio } from '../ui/cartoes.js';
import { barras, barrasEmpilhadas } from '../ui/graficos.js';
import { criarTabela } from '../ui/tabela.js';
import { listaDeMarcar } from '../ui/filtros.js';
import { lerConjunto, salvarConjunto } from '../preferencias.js';
import * as fmt from '../ui/formatos.js';
import { entregasPorStatus, recortarPor } from '../analise.js';

// Recorte de Status salvo neste navegador (pedido da equipe, 12/11/2026), inclusive ao importar outra base.
const CHAVE_STATUS = 'entrega-status';
const local = { status: lerConjunto(CHAVE_STATUS) };
const guardarStatus = () => salvarConjunto(CHAVE_STATUS, local.status);

/** Cor fixa por status de entrega (estado: falta, parcial, entregue), sempre com o texto ao lado. */
const COR = new Map([
  ['NÃO ENTREGUE', 'var(--st-critico)'],
  ['ENTREGUE PARCIAL', 'var(--graf-cotacao)'],
  ['ENTREGUE', 'var(--st-bom)'],
]);
const corDe = (s) => COR.get(String(s).toUpperCase()) ?? 'var(--serie-outros)';

function marcaEntrega(status) {
  if (!status) return '-';
  return el('span', { class: 'marca-prio' },
    el('span', { class: 'marca-prio-cor', style: { background: corDe(status) }, 'aria-hidden': 'true' }), status);
}

const COLUNAS = [
  { id: 'sc', rotulo: 'SC', valor: (r) => r.sc },
  { id: 'of', rotulo: 'OF', valor: (r) => r.of },
  { id: 'dataPedido', rotulo: 'Data do pedido', tipo: 'data', valor: (r) => r.dataPedido },
  { id: 'filial', rotulo: 'Filial', valor: (r) => r.filial },
  { id: 'nomeFilial', rotulo: 'Nome da filial', valor: (r) => r.nomeFilial, classe: () => 'texto-medio' },
  { id: 'solicitante', rotulo: 'Solicitante', valor: (r) => r.solicitante, classe: () => 'texto-medio' },
  { id: 'comprador', rotulo: 'Comprador', valor: (r) => r.comprador ?? '-' },
  { id: 'codigo', rotulo: 'Código', valor: (r) => r.codigoProduto },
  { id: 'descricao', rotulo: 'Produto', valor: (r) => r.descricao, classe: () => 'texto-longo' },
  { id: 'fornecedor', rotulo: 'Fornecedor', valor: (r) => r.fornecedor, classe: () => 'texto-medio' },
  { id: 'cnpj', rotulo: 'CNPJ', valor: (r) => r.cnpj },
  { id: 'statusEntrega', rotulo: 'Status da entrega', valor: (r) => r.statusEntrega, exibir: (r) => marcaEntrega(r.statusEntrega) },
];

/** OFs distintas por filial x status de entrega (gráfico empilhado). */
function ofsPorFilial(regs, status) {
  const grupos = new Map();
  for (const r of regs) {
    const k = r.nomeFilial || '-';
    const g = grupos.get(k) ?? { rotulo: k, porStatus: new Map(), todas: new Set() };
    const s = r.statusEntrega || '-';
    if (!g.porStatus.has(s)) g.porStatus.set(s, new Set());
    g.porStatus.get(s).add(r.numeroPedido);
    g.todas.add(r.numeroPedido);
    grupos.set(k, g);
  }
  return [...grupos.values()].map((g) => ({
    rotulo: g.rotulo,
    partes: Object.fromEntries(status.map((s) => [s, g.porStatus.get(s)?.size ?? 0])),
    total: g.todas.size,
  })).sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}

export function telaEntrega(ctx) {
  if (!ctx.followUp) {
    return estadoVazio('Sem a base Follow-Up. No app da equipe: "Atualizar bases", escolha o Follow-Up.xlsx (e gere o painel de novo).',
      null, { icone: 'caminhao' });
  }
  const regs = ctx.followUp;
  if (!regs.length) return estadoVazio('Nenhuma OF com os filtros atuais.', ctx);

  const porStatus = entregasPorStatus(regs);
  const doStatus = new Map(porStatus.map((s) => [s.status, s]));
  const ofs = new Set(regs.map((r) => r.numeroPedido)).size;
  const conta = (s) => doStatus.get(s)?.ofs ?? 0;

  const cartoes = linhaDeCartoes(
    cartao({ icone: 'carrinho', rotulo: 'OFs', valor: fmt.inteiro(ofs), detalhe: `${fmt.inteiro(regs.length)} itens` }),
    cartao({ icone: 'caminhao', rotulo: 'OFs não entregues', valor: fmt.inteiro(conta('NÃO ENTREGUE')), tom: conta('NÃO ENTREGUE') ? 'critico' : null, detalhe: `${fmt.inteiro(doStatus.get('NÃO ENTREGUE')?.itens ?? 0)} itens` }),
    cartao({ icone: 'parcial', rotulo: 'OFs entregues em parte', valor: fmt.inteiro(conta('ENTREGUE PARCIAL')), detalhe: `${fmt.inteiro(doStatus.get('ENTREGUE PARCIAL')?.itens ?? 0)} itens` }),
    cartao({ icone: 'check', rotulo: 'OFs entregues', valor: fmt.inteiro(conta('ENTREGUE')), detalhe: `${fmt.inteiro(doStatus.get('ENTREGUE')?.itens ?? 0)} itens` }),
  );

  const status = porStatus.map((s) => s.status);
  const grafico = bloco(
    { titulo: 'OFs por status de entrega', subtitulo: 'OFs distintas. Clique numa barra para recortar a lista.',
      ajuda: 'Uma OF com itens em status diferentes conta em cada um deles.' },
    barras({
      itens: porStatus.map((s) => ({ id: s.status, rotulo: s.status, valor: s.ofs, detalhe: [{ valor: fmt.inteiro(s.itens), rotulo: 'itens' }] })),
      formato: fmt.inteiro,
      rotuloSerie: 'OFs',
      selecionado: local.status.size === 1 ? [...local.status][0] : null,
      aoClicar: (s) => { local.status = local.status.size === 1 && local.status.has(s) ? new Set() : new Set([s]); guardarStatus(); ctx.redesenhar(); },
    }),
    criarTabela({
      titulo: 'OFs por status de entrega', linhas: porStatus, pesquisa: false, nomeArquivo: 'ofs-por-status-de-entrega.csv',
      colunas: [
        { id: 'status', rotulo: 'Status da entrega', valor: (s) => s.status, exibir: (s) => marcaEntrega(s.status) },
        { id: 'ofs', rotulo: 'OFs', num: true, valor: (s) => s.ofs, formato: fmt.inteiro },
        { id: 'itens', rotulo: 'Itens', num: true, valor: (s) => s.itens, formato: fmt.inteiro },
      ],
      rodape: () => ['Total geral', fmt.inteiro(ofs), fmt.inteiro(regs.length)],
    }).elemento,
  );

  const filiais = bloco(
    { titulo: 'OFs por filial', subtitulo: 'OFs distintas por status de entrega.' },
    barrasEmpilhadas({
      series: status.map((s) => ({ id: s, rotulo: s, cor: corDe(s) })),
      categorias: ofsPorFilial(regs, status),
      formato: fmt.inteiro,
    }),
  );

  const valores = [...status, ...[...local.status].filter((s) => !doStatus.has(s))];
  const recortar = () => recortarPor(regs, 'statusEntrega', local.status);
  let tabela = null;
  const filtroStatus = listaDeMarcar({
    id: 'status-entrega',
    rotulo: 'Status da entrega',
    valores,
    rotuloValor: (s) => `${s} (${fmt.inteiro(doStatus.get(s)?.ofs ?? 0)} OFs)`,
    resumoValor: (s) => s,
    selecionados: local.status,
    aoMudar: () => { guardarStatus(); tabela.atualizar(recortar()); },
  });

  tabela = criarTabela({
    titulo: 'OFs',
    linhas: recortar(),
    colunas: COLUNAS,
    ordem: { coluna: 'dataPedido', desc: false },
    grupo: {
      chave: (r) => `${r.solicitacao}|${r.numeroPedido}`,
      colunas: ['sc', 'of', 'dataPedido', 'filial', 'nomeFilial', 'solicitante', 'comprador', 'fornecedor', 'cnpj'],
      nome: ['OF', 'OFs'],
    },
    nomeArquivo: 'entregas.csv',
    vazio: 'Nenhuma OF com esse recorte.',
  });

  const lista = bloco(
    { titulo: 'Lista de OFs', subtitulo: 'Itens agrupados por SC e OF, do pedido mais antigo para o mais novo.',
      ajuda: 'Pesquise por SC, OF, produto ou fornecedor.' },
    el('div', { class: 'recortes' }, filtroStatus),
    tabela.elemento,
  );

  return el('div', { class: 'tela' }, cartoes, el('div', { class: 'grade-2' }, grafico, filiais), lista);
}

/** O recorte de Status fica salvo no navegador: não zera ao trocar de bases. */
export function reiniciarEntrega() { /* nada a zerar */ }
