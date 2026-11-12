// Tela Status: todas as SCs do período (abertas, em pedido e canceladas) por status.
// Substitui a aba "Status" da planilha antiga (tabela dinâmica SC > Status > Produto > ...).
import { el } from '../ui/dom.js';
import { cartao, linhaDeCartoes, bloco } from '../ui/cartoes.js';
import { barras } from '../ui/graficos.js';
import { criarTabela } from '../ui/tabela.js';
import { listaDeMarcar } from '../ui/filtros.js';
import * as fmt from '../ui/formatos.js';
import { seloDoStatus, marcaDaPrioridade } from '../ui/cores-planilha.js';
import { scsPorStatus, recortarPorStatus, ehRegularizacao } from '../analise.js';

// Recorte local (não é filtro global): status marcados na lista ou na barra do gráfico.
const local = { status: new Set() };

const COLUNAS = [
  { id: 'sc', rotulo: 'SC', valor: (r) => r.sc, exibir: (r) => (ehRegularizacao(r) ? [r.sc, el('span', { class: 'so-leitor' }, ' (regularização)')] : r.sc) },
  { id: 'status', rotulo: 'Status', valor: (r) => r.status, exibir: (r) => seloDoStatus(r.status) },
  { id: 'prioridade', rotulo: 'Prioridade', valor: (r) => r.prioridade, exibir: (r) => marcaDaPrioridade(r.prioridade) },
  { id: 'descricao', rotulo: 'Produto', valor: (r) => r.descricao, classe: () => 'texto-longo' },
  { id: 'solicitante', rotulo: 'Solicitante', valor: (r) => r.solicitante, classe: () => 'texto-medio' },
  { id: 'data', rotulo: 'Data', tipo: 'data', valor: (r) => r.data },
  { id: 'dias', rotulo: 'Dias em aberto', num: true, centro: true, valor: (r) => r.diasEmAberto, formato: fmt.inteiro, titulo: 'Dias úteis; "-" = já tem pedido ou foi cancelada' },
  { id: 'filial', rotulo: 'Filial', valor: (r) => r.filial },
  { id: 'nomeFilial', rotulo: 'Nome da filial', valor: (r) => r.nomeFilial, classe: () => 'texto-medio' },
  { id: 'comprador', rotulo: 'Comprador', valor: (r) => r.comprador ?? '-' },
];

export function telaStatus(ctx) {
  const regs = ctx.registros;
  if (!regs.length) return el('div', { class: 'estado-vazio' }, 'Nenhuma linha com os filtros atuais.');

  const porStatus = scsPorStatus(regs);
  const doStatus = new Map(porStatus.map((s) => [s.status, s]));
  const scs = new Set(regs.map((r) => r.solicitacao)).size;
  const conta = (nome) => doStatus.get(nome)?.scs ?? 0;
  const abertas = new Set(regs.filter((r) => r.diasEmAberto !== null && r.diasEmAberto !== undefined).map((r) => r.solicitacao)).size;

  const cartoes = linhaDeCartoes(
    cartao({ rotulo: 'SCs no período', valor: fmt.inteiro(scs), detalhe: `${fmt.inteiro(regs.length)} itens` }),
    cartao({ rotulo: 'SCs em aberto', valor: fmt.inteiro(abertas), detalhe: 'Com item sem pedido e não cancelado' }),
    cartao({ rotulo: 'SCs em pedido', valor: fmt.inteiro(conta('Em Pedido')), detalhe: 'Com item no status Em Pedido' }),
    cartao({ rotulo: 'SCs canceladas', valor: fmt.inteiro(conta('Cancelado')), detalhe: 'Com item no status Cancelado' }),
  );

  // Status marcado que os filtros globais zeraram continua na lista (com 0) para poder desmarcar.
  const valores = [...porStatus.map((s) => s.status), ...[...local.status].filter((s) => !doStatus.has(s))];
  const recortar = () => recortarPorStatus(regs, local.status);
  let tabela = null;

  const grafico = bloco(
    { titulo: 'SCs por status', subtitulo: 'SCs distintas: uma SC com itens em status diferentes conta em cada um. Clique numa barra para recortar a lista.' },
    barras({
      itens: porStatus.map((s) => ({ id: s.status, rotulo: s.status, valor: s.scs, detalhe: [{ valor: fmt.inteiro(s.itens), rotulo: 'itens' }] })),
      formato: fmt.inteiro,
      rotuloSerie: 'SCs',
      selecionado: local.status.size === 1 ? [...local.status][0] : null,
      aoClicar: (s) => { local.status = local.status.size === 1 && local.status.has(s) ? new Set() : new Set([s]); ctx.redesenhar(); },
    }),
    criarTabela({
      titulo: 'SCs por status', linhas: porStatus, pesquisa: false, nomeArquivo: 'scs-por-status.csv',
      colunas: [
        { id: 'status', rotulo: 'Status', valor: (s) => s.status, exibir: (s) => seloDoStatus(s.status) },
        { id: 'scs', rotulo: 'SCs', num: true, valor: (s) => s.scs, formato: fmt.inteiro },
        { id: 'itens', rotulo: 'Itens', num: true, valor: (s) => s.itens, formato: fmt.inteiro },
      ],
      rodape: () => ['Total geral', fmt.inteiro(scs), fmt.inteiro(regs.length)],
    }).elemento,
  );

  const filtroStatus = listaDeMarcar({
    id: 'status-sc',
    rotulo: 'Status',
    valores,
    rotuloValor: (s) => `${s} (${fmt.inteiro(doStatus.get(s)?.scs ?? 0)} SCs)`,
    resumoValor: (s) => s,
    selecionados: local.status,
    aoMudar: () => tabela.atualizar(recortar()),
  });

  tabela = criarTabela({
    titulo: 'SCs por status',
    linhas: recortar(),
    colunas: COLUNAS,
    ordem: { coluna: 'sc', desc: true },
    grupo: { chave: (r) => r.solicitacao, colunas: ['sc', 'solicitante', 'filial', 'nomeFilial'], nome: ['SC', 'SCs'] },
    classeLinha: (r) => (ehRegularizacao(r) ? 'linha-regularizacao' : ''),
    nomeArquivo: 'scs-status.csv',
    vazio: 'Nenhuma SC com esse recorte.',
  });

  const lista = bloco(
    { titulo: 'Lista de SCs', subtitulo: 'Itens agrupados por SC. Pesquise por SC, produto, solicitante ou filial.' },
    el('div', { class: 'recortes' }, filtroStatus),
    tabela.elemento,
  );

  return el('div', { class: 'tela' }, cartoes, grafico, lista);
}

/** Zera o recorte local (ao trocar de bases). */
export function reiniciarStatus() { local.status = new Set(); }
