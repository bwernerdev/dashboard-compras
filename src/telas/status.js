// Tela Status: todas as SCs do período (abertas, em pedido e canceladas) por status.
// Substitui a aba "Status" da planilha antiga (tabela dinâmica SC > Status > Produto > ...).
import { el } from '../ui/dom.js';
import { cartao, linhaDeCartoes, bloco, comparar, serieDe, estadoVazio } from '../ui/cartoes.js';
import { barras } from '../ui/graficos.js';
import { criarTabela } from '../ui/tabela.js';
import { cliqueDeDetalhe } from '../ui/detalhe.js';
import { listaDeMarcar } from '../ui/filtros.js';
import { lerConjunto, salvarConjunto } from '../preferencias.js';
import * as fmt from '../ui/formatos.js';
import { formatarSerie } from '../datas.js';
import { seloDoStatus, marcaDaPrioridade, classeDaLinhaSc } from '../ui/cores-planilha.js';
import { scsPorStatus, resumoStatus, recortarPorStatus, ehRegularizacao } from '../analise.js';

// Recorte local (não é filtro global): status marcados na lista ou na barra do gráfico.
// Recorte de Status salvo neste navegador (pedido da equipe, 12/11/2026), inclusive ao importar outra base.
const CHAVE_STATUS = 'status-status';
const local = { status: lerConjunto(CHAVE_STATUS) };
const guardarStatus = () => salvarConjunto(CHAVE_STATUS, local.status);

const COLUNAS = [
  { id: 'sc', rotulo: 'SC', semDuploClique: true, valor: (r) => r.sc, exibir: (r) => (ehRegularizacao(r) ? [r.sc, el('span', { class: 'so-leitor' }, ' (regularização)')] : r.sc) },
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
  if (!regs.length) return estadoVazio('Nenhuma linha com os filtros atuais.', ctx);

  const porStatus = scsPorStatus(regs);
  const doStatus = new Map(porStatus.map((s) => [s.status, s]));
  const resumo = resumoStatus(regs);
  const vs = comparar(ctx.anteriores?.rotulo, resumo, ctx.anteriores ? resumoStatus(ctx.anteriores.registros) : null);

  const cartoes = linhaDeCartoes(
    // Período do relatório do ME no rótulo (pedido da equipe, 13/11/2026).
    cartao({ icone: 'documento', rotulo: ctx.periodo ? `SCs no período ${formatarSerie(ctx.periodo.inicio)} até ${formatarSerie(ctx.periodo.fim)}` : 'SCs no período', valor: fmt.inteiro(resumo.scs), detalhe: `${fmt.inteiro(resumo.itens)} itens`, variacao: vs('scs', fmt.inteiro), serie: serieDe(ctx.historico, (p) => p.status.scs, resumo.scs) }),
    cartao({ icone: 'relogio', rotulo: 'SCs em aberto', valor: fmt.inteiro(resumo.abertas), detalhe: 'Com item sem pedido e não cancelado', variacao: vs('abertas', fmt.inteiro, 'menor'), serie: serieDe(ctx.historico, (p) => p.status.abertas, resumo.abertas) }),
    cartao({ icone: 'carrinho', rotulo: 'SCs em pedido', valor: fmt.inteiro(resumo.emPedido), detalhe: 'Com item no status Em Pedido', variacao: vs('emPedido', fmt.inteiro), serie: serieDe(ctx.historico, (p) => p.status.emPedido, resumo.emPedido) }),
    cartao({ icone: 'cancelado', rotulo: 'SCs canceladas', valor: fmt.inteiro(resumo.canceladas), detalhe: 'Com item no status Cancelado', variacao: vs('canceladas', fmt.inteiro), serie: serieDe(ctx.historico, (p) => p.status.canceladas, resumo.canceladas) }),
  );

  // Status marcado que os filtros globais zeraram continua na lista (com 0) para poder desmarcar.
  const valores = [...porStatus.map((s) => s.status), ...[...local.status].filter((s) => !doStatus.has(s))];
  const recortar = () => recortarPorStatus(regs, local.status);
  let tabela = null;

  const grafico = bloco(
    { titulo: 'SCs por status', subtitulo: 'SCs distintas. Clique numa barra para recortar a lista.',
      ajuda: 'Uma SC com itens em status diferentes conta em cada um deles.' },
    barras({
      itens: porStatus.map((s) => ({ id: s.status, rotulo: s.status, valor: s.scs, detalhe: [{ valor: fmt.inteiro(s.itens), rotulo: 'itens' }] })),
      formato: fmt.inteiro,
      rotuloSerie: 'SCs',
      selecionado: local.status.size === 1 ? [...local.status][0] : null,
      aoClicar: (s) => { local.status = local.status.size === 1 && local.status.has(s) ? new Set() : new Set([s]); guardarStatus(); ctx.redesenhar(); },
    }),
    criarTabela({
      titulo: 'SCs por status', linhas: porStatus, pesquisa: false, nomeArquivo: 'scs-por-status.csv',
      colunas: [
        { id: 'status', rotulo: 'Status', valor: (s) => s.status, exibir: (s) => seloDoStatus(s.status) },
        { id: 'scs', rotulo: 'SCs', num: true, valor: (s) => s.scs, formato: fmt.inteiro },
        { id: 'itens', rotulo: 'Itens', num: true, valor: (s) => s.itens, formato: fmt.inteiro },
      ],
      rodape: () => ['Total geral', fmt.inteiro(resumo.scs), fmt.inteiro(resumo.itens)],
    }).elemento,
  );

  const filtroStatus = listaDeMarcar({
    id: 'status-sc',
    rotulo: 'Status',
    valores,
    rotuloValor: (s) => `${s} (${fmt.inteiro(doStatus.get(s)?.scs ?? 0)} SCs)`,
    resumoValor: (s) => s,
    selecionados: local.status,
    aoMudar: () => { guardarStatus(); tabela.atualizar(recortar()); },
  });

  tabela = criarTabela({
    titulo: 'SCs por status',
    linhas: recortar(),
    colunas: COLUNAS,
    ordem: { coluna: 'sc', desc: true },
    grupo: { chave: (r) => r.solicitacao, colunas: ['sc', 'solicitante', 'filial', 'nomeFilial'], nome: ['SC', 'SCs'] },
    classeLinha: classeDaLinhaSc,
    nomeArquivo: 'scs-status.csv',
    aoClicarLinha: cliqueDeDetalhe((r) => regs.filter((x) => x.solicitacao === r.solicitacao)).aoClicarLinha,
    vazio: 'Nenhuma SC com esse recorte.',
  });

  const lista = bloco(
    { titulo: 'Lista de SCs', subtitulo: 'Itens agrupados por SC. Pesquise por SC, produto, solicitante ou filial.' },
    el('div', { class: 'recortes' }, filtroStatus),
    tabela.elemento,
  );

  return el('div', { class: 'tela' }, cartoes, grafico, lista);
}

/** O recorte de Status fica salvo no navegador: não zera ao trocar de bases. */
export function reiniciarStatus() { /* nada a zerar */ }
