// Tela Regional: SCs em aberto (sem pedido e não canceladas), dias úteis em aberto e SLA.
// Substitui a aba "Regional" (e cobre a "Atendimento") da planilha antiga, com os dias corrigidos.
import { el, icone } from '../ui/dom.js';
import { estaAtendida, marcarAtendida } from '../atendidas.js';
import { cartao, linhaDeCartoes, bloco } from '../ui/cartoes.js';
import { barras, barraSegmentada } from '../ui/graficos.js';
import { criarTabela } from '../ui/tabela.js';
import * as fmt from '../ui/formatos.js';
import { seloDoStatus, marcaDaPrioridade } from '../ui/cores-planilha.js';
import {
  itensEmAberto, resumoEmAberto, porFaixaDeDias, emAbertoPor, faixaDe, FAIXAS_DIAS,
  recortarPorStatus, itensPorStatus, ehPendencia, ehRegularizacao,
} from '../analise.js';
import { listaDeMarcar } from '../ui/filtros.js';

// Seleções locais da tela (não são filtros globais: só recortam a lista de SCs).
const local = { faixa: null, sla: 'todos', status: new Set(), agrupar: 'regional', mostrarAtendidas: false };

// "Atendida" (olho / duplo clique tira a SC da lista): só no app da equipe. O painel publicado
// não chama ligarAtendidas e mostra a lista inteira.
let atendidasLigadas = false;
export function ligarAtendidas() { atendidasLigadas = true; }

const SLA_OPCOES = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'Fora do Prazo', rotulo: 'Fora do prazo' },
  { id: 'No Prazo', rotulo: 'No prazo' },
  { id: 'sem', rotulo: 'Sem prazo' },
];

// Sem "Dias em aberto", "SLA", "Prazo máx." e "Item" (pedido da equipe, 11/11/2026): o recorte
// de SLA acima da lista continua valendo.
const COLUNAS_SCS = [
  { id: 'aprov', rotulo: 'Dias da aprovação', num: true, centro: true, valor: (r) => r.diasDaAprovacao, formato: fmt.inteiro, titulo: 'Dias corridos desde a criação' },
  // Regularização: linha toda em vermelho (classeLinha); o texto escondido diz o mesmo ao leitor de tela.
  // semDuploClique: a equipe dá dois cliques no número para copiar; ali não oculta a SC.
  { id: 'sc', rotulo: 'SC', semDuploClique: true, valor: (r) => r.sc, exibir: (r) => (ehRegularizacao(r) ? [r.sc, el('span', { class: 'so-leitor' }, ' (regularização)')] : r.sc) },
  { id: 'data', rotulo: 'Data', tipo: 'data', valor: (r) => r.data },
  { id: 'prioridade', rotulo: 'Prioridade', valor: (r) => r.prioridade, exibir: (r) => marcaDaPrioridade(r.prioridade) },
  { id: 'status', rotulo: 'Status', valor: (r) => r.status, exibir: (r) => seloDoStatus(r.status) },
  { id: 'descricao', rotulo: 'Produto', valor: (r) => r.descricao, classe: () => 'texto-longo' },
  { id: 'codigo', rotulo: 'Código', valor: (r) => r.codigoProduto },
  { id: 'qtd', rotulo: 'Qtd.', num: true, centro: true, valor: (r) => r.qtdSolicitacao, formato: fmt.inteiro },
  { id: 'solicitante', rotulo: 'Solicitante', valor: (r) => r.solicitante },
  { id: 'filial', rotulo: 'Filial', valor: (r) => r.filial },
  { id: 'nomeFilial', rotulo: 'Nome da filial', valor: (r) => r.nomeFilial },
  { id: 'comprador', rotulo: 'Comprador', valor: (r) => r.comprador ?? '-' },
  { id: 'regional', rotulo: 'Regional', valor: (r) => r.regional },
];

function tabelaGrupos(grupos, rotuloGrupo, aoClicar) {
  return criarTabela({
    titulo: `SCs em aberto por ${rotuloGrupo.toLowerCase()}`,
    linhas: grupos,
    pesquisa: false,
    porPagina: 30,
    ordem: { coluna: 'scs', desc: true },
    nomeArquivo: `scs-em-aberto-por-${rotuloGrupo.toLowerCase()}.csv`,
    aoClicarLinha: (g) => aoClicar(g.chave),
    colunas: [
      { id: 'chave', rotulo: rotuloGrupo, valor: (g) => g.chave },
      { id: 'scs', rotulo: 'SCs', num: true, valor: (g) => g.scs, formato: fmt.inteiro },
      { id: 'itens', rotulo: 'Itens', num: true, valor: (g) => g.itens, formato: fmt.inteiro },
      { id: 'noPrazo', rotulo: 'No prazo', num: true, valor: (g) => g.noPrazo, formato: fmt.inteiro },
      { id: 'fora', rotulo: 'Fora do prazo', num: true, valor: (g) => g.fora, formato: fmt.inteiro },
      {
        id: 'barra', rotulo: 'SLA', valor: (g) => g.pctNoPrazo, formato: fmt.pct,
        exibir: (g) => el('span', { class: 'celula-sla' },
          barraSegmentada([
            { valor: g.noPrazo, cor: 'var(--st-bom)', rotulo: 'No prazo' },
            { valor: g.fora, cor: 'var(--st-critico)', rotulo: 'Fora do prazo' },
          ], g.chave),
          el('span', {}, fmt.pct(g.pctNoPrazo))),
      },
      { id: 'media', rotulo: 'Média de dias', num: true, valor: (g) => g.mediaDias, formato: fmt.decimal },
      { id: 'max', rotulo: 'Mais antiga', num: true, valor: (g) => g.maxDias, formato: fmt.inteiro },
    ],
  }).elemento;
}

/** ctx: { registros (já filtrados), filtrar(idFiltro, valor), redesenhar() } */
export function telaRegional(ctx) {
  const abertos = itensEmAberto(ctx.registros);
  const resumo = resumoEmAberto(abertos);

  if (!abertos.length) {
    return el('div', { class: 'estado-vazio' }, 'Nenhuma SC em aberto com os filtros atuais.');
  }

  const cartoes = linhaDeCartoes(
    cartao({ rotulo: 'SCs em aberto', valor: fmt.inteiro(resumo.scs), detalhe: `${fmt.inteiro(resumo.itens)} itens sem pedido e não cancelados` }),
    cartao({
      rotulo: 'SLA no prazo', valor: fmt.pct(resumo.pctNoPrazo),
      detalhe: `${fmt.inteiro(resumo.noPrazo)} itens no prazo, ${fmt.inteiro(resumo.fora)} fora`,
    }),
    cartao({
      rotulo: 'Itens fora do prazo', valor: fmt.inteiro(resumo.fora), tom: resumo.fora ? 'critico' : null,
      detalhe: resumo.semPrazo ? `${fmt.inteiro(resumo.semPrazo)} sem prazo definido` : 'Dias em aberto acima do prazo máximo do SLA',
    }),
    cartao({ rotulo: 'Média de dias em aberto', valor: fmt.decimal(resumo.mediaDias), detalhe: `Mais antiga: ${fmt.inteiro(resumo.maxDias)} dias úteis` }),
  );

  const faixas = porFaixaDeDias(abertos);
  const graficoFaixas = bloco(
    { titulo: 'SCs em aberto por tempo', subtitulo: 'Dias úteis desde a criação. Clique numa faixa para filtrar a lista abaixo.' },
    barras({
      itens: faixas.map((f) => ({ id: f.id, rotulo: f.rotulo, valor: f.scs, detalhe: [{ valor: fmt.inteiro(f.itens), rotulo: 'itens' }] })),
      formato: fmt.inteiro,
      rotuloSerie: 'SCs',
      selecionado: local.faixa,
      aoClicar: (id) => { local.faixa = local.faixa === id ? null : id; ctx.redesenhar(); },
    }),
  );

  const rotuloGrupo = local.agrupar === 'regional' ? 'Regional' : 'Filial';
  const grupos = emAbertoPor(abertos, local.agrupar === 'regional' ? 'regional' : 'nomeFilial');
  const alternar = el('div', { class: 'alternador', role: 'group', 'aria-label': 'Agrupar por' },
    [['regional', 'Regional'], ['filial', 'Filial']].map(([id, rotulo]) => el('button', {
      type: 'button', class: 'alternador-opcao', 'aria-pressed': String(local.agrupar === id),
      onclick: () => { local.agrupar = id; ctx.redesenhar(); },
    }, rotulo)));
  const blocoGrupos = bloco(
    { titulo: `Por ${rotuloGrupo.toLowerCase()}`, subtitulo: 'Clique numa linha para filtrar o painel inteiro.' },
    alternar,
    tabelaGrupos(grupos, rotuloGrupo, (valor) => ctx.filtrar(local.agrupar === 'regional' ? 'regional' : 'filial', valor)),
  );

  // Status: lista de marcar (vários de uma vez), cada um com o número de itens em aberto.
  const porStatus = itensPorStatus(abertos);
  const itensDoStatus = new Map(porStatus.map((s) => [s.status, s.itens]));
  // Status marcado que os filtros globais zeraram continua na lista (com 0) para poder desmarcar.
  const valoresStatus = [...porStatus.map((s) => s.status), ...[...local.status].filter((s) => !itensDoStatus.has(s))];
  const statusPendencia = valoresStatus.filter((s) => ehPendencia({ status: s }));

  const recortar = () => {
    let lista = recortarPorStatus(abertos, local.status);
    if (atendidasLigadas && !local.mostrarAtendidas) lista = lista.filter((r) => !estaAtendida(r.solicitacao));
    if (local.faixa) lista = lista.filter((r) => faixaDe(r.diasEmAberto) === local.faixa);
    if (local.sla === 'sem') lista = lista.filter((r) => r.sla !== 'No Prazo' && r.sla !== 'Fora do Prazo');
    else if (local.sla !== 'todos') lista = lista.filter((r) => r.sla === local.sla);
    return lista;
  };
  const vazio = () => ([...local.status].some((s) => ehPendencia({ status: s }))
    ? 'Nenhum item com esse recorte. Pendências ficam no comprador "Pendente" (o ME não preenche "Selecionado por"): confira o filtro Comprador.'
    : 'Nenhuma SC com esse recorte.');

  const soPendencias = () => local.status.size === statusPendencia.length && statusPendencia.every((s) => local.status.has(s));
  const atalho = el('button', {
    type: 'button', class: 'botao botao-sec botao-pequeno',
    onclick: () => { local.status = new Set(statusPendencia); ctx.redesenhar(); },
  }, 'Só pendências');
  atalho.hidden = !statusPendencia.length || soPendencias();

  // Marcar status atualiza só a lista: a lista de marcar continua aberta.
  let tabela = null;
  const filtroStatus = listaDeMarcar({
    id: 'status',
    rotulo: 'Status',
    valores: valoresStatus,
    rotuloValor: (s) => `${s} (${fmt.inteiro(itensDoStatus.get(s) ?? 0)})`,
    resumoValor: (s) => s,
    selecionados: local.status,
    aoMudar: () => { tabela.atualizar(recortar()); atalho.hidden = !statusPendencia.length || soPendencias(); },
  });

  // Atendidas: o olho (ou duplo clique na linha) tira a SC da lista; "Mostrar atendidas" traz
  // de volta, apagadas, com o olho riscado para desfazer. Cartões e gráficos não mudam.
  const scsAbertas = [...new Set(abertos.map((r) => r.solicitacao))];
  const botaoAtendidas = el('button', {
    type: 'button', class: 'botao botao-sec botao-pequeno', 'aria-pressed': String(local.mostrarAtendidas),
    onclick: () => {
      local.mostrarAtendidas = !local.mostrarAtendidas;
      botaoAtendidas.setAttribute('aria-pressed', String(local.mostrarAtendidas));
      aviso.replaceChildren();
      atualizarLista();
    },
  });
  const aviso = el('span', { class: 'aviso-atendida', role: 'status' });
  let ultimaMarcada = null;
  const botaoDesfazer = el('button', {
    type: 'button', class: 'botao-link',
    onclick: () => { if (ultimaMarcada) alternarAtendida(ultimaMarcada, false); },
  }, 'Desfazer');

  function atualizarLista() {
    const n = scsAbertas.filter(estaAtendida).length;
    botaoAtendidas.textContent = local.mostrarAtendidas ? `Ocultar atendidas (${fmt.inteiro(n)})` : `Mostrar atendidas (${fmt.inteiro(n)})`;
    botaoAtendidas.hidden = !n && !local.mostrarAtendidas;
    tabela?.atualizar(recortar(), { manterPagina: true });
  }

  /** r: um item da SC (a marca vale para a SC inteira, chave `solicitacao`). */
  function alternarAtendida(r, atendida) {
    marcarAtendida(r.solicitacao, atendida);
    ultimaMarcada = atendida ? r : null;
    aviso.replaceChildren(...(atendida
      ? [`SC ${r.sc} marcada como atendida${local.mostrarAtendidas ? '' : ' e oculta'}. `, botaoDesfazer]
      : [`SC ${r.sc} voltou para a lista.`]));
    atualizarLista();
  }

  const colunas = atendidasLigadas ? [{
    id: 'olho', rotulo: 'Atendida', controle: true, valor: (r) => r.solicitacao,
    exibir: (r) => {
      const atendida = estaAtendida(r.solicitacao);
      const rotulo = atendida ? `Voltar a SC ${r.sc} para a lista` : `Marcar SC ${r.sc} como atendida (ocultar)`;
      return el('button', {
        type: 'button', class: 'olho', 'aria-label': rotulo, title: rotulo,
        onclick: (e) => { e.stopPropagation(); alternarAtendida(r, !atendida); },
      }, icone(atendida ? 'olho-fechado' : 'olho'));
    },
  }, ...COLUNAS_SCS] : COLUNAS_SCS;

  const recortes = el('div', { class: 'recortes' },
    filtroStatus,
    atalho,
    atendidasLigadas ? botaoAtendidas : null,
    el('label', { class: 'recorte' }, 'SLA ',
      el('select', {
        class: 'campo', onchange: (ev) => { local.sla = ev.target.value; ctx.redesenhar(); },
      }, SLA_OPCOES.map((o) => el('option', { value: o.id, selected: local.sla === o.id }, o.rotulo)))),
    local.faixa ? el('button', {
      type: 'button', class: 'chip', onclick: () => { local.faixa = null; ctx.redesenhar(); },
      'aria-label': `Remover recorte ${FAIXAS_DIAS.find((f) => f.id === local.faixa).rotulo}`,
    }, FAIXAS_DIAS.find((f) => f.id === local.faixa).rotulo, el('span', { 'aria-hidden': 'true' }, ' ✕')) : null);

  tabela = criarTabela({
    titulo: 'SCs em aberto',
    linhas: recortar(),
    colunas,
    ordem: { coluna: 'aprov', desc: true },
    // Como a tabela dinâmica da aba Regional: dados da SC só na 1ª linha, itens embaixo.
    grupo: { chave: (r) => r.solicitacao, colunas: ['olho', 'aprov', 'sc', 'data', 'prioridade'], nome: ['SC', 'SCs'] },
    nomeArquivo: 'scs-em-aberto.csv',
    vazio,
    classeLinha: (r) => [
      ehRegularizacao(r) ? 'linha-regularizacao' : '',
      atendidasLigadas && estaAtendida(r.solicitacao) ? 'linha-atendida' : '',
    ].join(' ').trim(),
    aoDuploClique: atendidasLigadas ? (r) => alternarAtendida(r, !estaAtendida(r.solicitacao)) : null,
  });
  if (atendidasLigadas) atualizarLista();
  const blocoLista = bloco(
    {
      titulo: 'SCs em aberto',
      subtitulo: atendidasLigadas
        ? 'Itens agrupados por SC, da mais antiga para a mais nova. Já atendeu? Clique no olho ou dê dois cliques na linha (fora do número da SC) para tirar a SC da lista (fica salvo neste navegador). CSV e "Copiar tabela" trazem um item por linha.'
        : 'Itens agrupados por SC, da mais antiga para a mais nova. CSV e "Copiar tabela" trazem um item por linha.',
    },
    recortes,
    legendaRegularizacao(abertos),
    atendidasLigadas ? aviso : null,
    tabela.elemento,
  );

  return el('div', { class: 'tela' }, cartoes, el('div', { class: 'grade-2 grade-2-3' }, graficoFaixas, blocoGrupos), blocoLista);
}

/** Legenda da linha vermelha (cor nunca sozinha): só quando há SC de regularização em aberto. */
function legendaRegularizacao(abertos) {
  const scs = new Set(abertos.filter(ehRegularizacao).map((r) => r.solicitacao)).size;
  if (!scs) return null;
  return el('p', { class: 'legenda-lista' },
    el('span', { class: 'legenda-regularizacao', 'aria-hidden': 'true' }),
    `Linha vermelha: SC de regularização (${fmt.inteiro(scs)} ${scs === 1 ? 'SC' : 'SCs'} em aberto)`);
}

/** Zera as seleções locais (ao trocar de bases). */
export function reiniciarRegional() {
  local.faixa = null;
  local.sla = 'todos';
  local.status = new Set();
  local.mostrarAtendidas = false;
}
