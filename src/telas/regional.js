// Tela Regional: SCs em aberto (sem pedido e não canceladas), dias úteis em aberto e SLA.
// Substitui a aba "Regional" (e cobre a "Atendimento") da planilha antiga, com os dias corrigidos.
import { PRAZO_SLA_DIAS } from '../regras.js';
import { el, icone } from '../ui/dom.js';
import { estaAtendida, marcarAtendida } from '../atendidas.js';
import { cartao, linhaDeCartoes, bloco, comparar, pontos, serieDe, estadoVazio } from '../ui/cartoes.js';
import { barras, barraSegmentada } from '../ui/graficos.js';
import { criarTabela } from '../ui/tabela.js';
import { cliqueDeDetalhe } from '../ui/detalhe.js';
import * as fmt from '../ui/formatos.js';
import { seloDoStatus, marcaDaPrioridade, classeDaLinhaSc } from '../ui/cores-planilha.js';
import {
  itensEmAberto, resumoEmAberto, porFaixaDeDias, emAbertoPor, faixaDe, FAIXAS_DIAS,
  recortarPorStatus, itensPorStatus, ehPendencia, ehRegularizacao,
} from '../analise.js';
import { listaDeMarcar } from '../ui/filtros.js';
import { lerConjunto, salvarConjunto } from '../preferencias.js';

// Seleções locais da tela (não são filtros globais: só recortam a lista de SCs).
// O recorte de Status fica salvo neste navegador (pedido da equipe, 12/11/2026), inclusive ao
// importar outra base; faixa e agrupar não.
const CHAVE_STATUS = 'regional-status';
const local = { faixa: null, status: lerConjunto(CHAVE_STATUS), agrupar: 'regional' };
const guardarStatus = () => salvarConjunto(CHAVE_STATUS, local.status);

// Lista de SCs em tela cheia (cobre a janela; Esc ou o botão volta). Só quando a pessoa clica em
// "Tela cheia": abrir o app ou importar a base mostra sempre a tela normal (pedido da equipe,
// 12/11/2026). Vale até sair, recarregar ou importar; não fica salva no navegador.
let telaCheia = false;
let sairDaTelaCheia = null;
document.addEventListener('keydown', (ev) => {
  // Esc fecha antes uma lista de marcar aberta (Status, filtros); só depois sai da tela cheia.
  if (ev.key !== 'Escape' || !sairDaTelaCheia || document.querySelector('.filtro-painel:not([hidden])')) return;
  sairDaTelaCheia();
}, true); // captura: roda antes do Esc da lista de marcar, que fecharia a lista primeiro

// "Atendida" (olho / duplo clique recolhe a SC numa linha): só no app da equipe. O painel publicado
// não chama ligarAtendidas e mostra a lista inteira.
let atendidasLigadas = false;
export function ligarAtendidas() { atendidasLigadas = true; }

// Sem "Dias em aberto", "SLA", "Prazo máx." e "Item" (pedido da equipe, 11/11/2026). O recorte
// de SLA acima da lista também saiu (12/11/2026); o SLA segue nos cartões e na tabela por regional.
const COLUNAS_SCS = [
  { id: 'aprov', rotulo: 'Dias da aprovação', num: true, centro: true, valor: (r) => r.diasDaAprovacao, formato: fmt.inteiro, titulo: 'Dias corridos desde a criação', classe: () => 'col-dias' },
  // Regularização: linha toda em vermelho (classeLinha); o texto escondido diz o mesmo ao leitor de tela.
  // semDuploClique: a equipe dá dois cliques no número para copiar; ali não oculta a SC.
  { id: 'sc', rotulo: 'SC', semDuploClique: true, valor: (r) => r.sc, exibir: (r) => (ehRegularizacao(r) ? [r.sc, el('span', { class: 'so-leitor' }, ' (regularização)')] : r.sc) },
  // "Data Aprovação" = "Data Criação solicitação" (coluna C do Relatório), pedido da equipe (12/11/2026).
  { id: 'data', rotulo: 'Data Aprovação', tipo: 'data', valor: (r) => r.criacao, titulo: 'Data Criação solicitação (base do ME)' },
  { id: 'prioridade', rotulo: 'Prioridade', valor: (r) => r.prioridade, exibir: (r) => marcaDaPrioridade(r.prioridade) },
  { id: 'status', rotulo: 'Status', valor: (r) => r.status, exibir: (r) => seloDoStatus(r.status) },
  { id: 'descricao', rotulo: 'Produto', valor: (r) => r.descricao, classe: () => 'texto-longo' },
  { id: 'codigo', rotulo: 'Código', valor: (r) => r.codigoProduto },
  { id: 'qtd', rotulo: 'Qtd.', num: true, centro: true, valor: (r) => r.qtdSolicitacao, formato: fmt.inteiro },
  { id: 'solicitante', rotulo: 'Solicitante', valor: (r) => r.solicitante, classe: () => 'texto-medio' },
  { id: 'filial', rotulo: 'Filial', valor: (r) => r.filial },
  { id: 'nomeFilial', rotulo: 'Nome da filial', valor: (r) => r.nomeFilial, classe: () => 'texto-medio' },
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
      // SLA por SC, como os cartões e o Atendimento (pedido da equipe, 12/11/2026).
      { id: 'noPrazo', rotulo: 'SCs no prazo', num: true, valor: (g) => g.scsNoPrazo, formato: fmt.inteiro },
      { id: 'fora', rotulo: 'SCs fora do prazo', num: true, valor: (g) => g.scsFora, formato: fmt.inteiro },
      {
        id: 'barra', rotulo: 'SLA', valor: (g) => g.pctScsNoPrazo, formato: fmt.pct,
        exibir: (g) => el('span', { class: 'celula-sla' },
          barraSegmentada([
            { valor: g.scsNoPrazo, cor: 'var(--st-bom)', rotulo: 'SCs no prazo' },
            { valor: g.scsFora, cor: 'var(--st-critico)', rotulo: 'SCs fora do prazo' },
          ], g.chave),
          el('span', {}, fmt.pct(g.pctScsNoPrazo))),
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

  sairDaTelaCheia = null; // a tela é refeita a cada desenho
  if (!abertos.length) {
    return estadoVazio('Nenhuma SC em aberto com os filtros atuais.', ctx);
  }

  const vs = comparar(ctx.anteriores?.rotulo, resumo, ctx.anteriores ? resumoEmAberto(itensEmAberto(ctx.anteriores.registros)) : null);
  const cartoes = linhaDeCartoes(
    cartao({ icone: 'documento', rotulo: 'SCs em aberto', valor: fmt.inteiro(resumo.scs), detalhe: `${fmt.inteiro(resumo.itens)} itens sem pedido e não cancelados`, variacao: vs('scs', fmt.inteiro, 'menor'), serie: serieDe(ctx.historico, (p) => p.aberto.scs, resumo.scs) }),
    // SLA conta SCs, como o Atendimento (SC fora = algum item fora).
    cartao({
      icone: 'check', rotulo: 'SLA no prazo', valor: fmt.pct(resumo.pctScsNoPrazo),
      detalhe: `${fmt.inteiro(resumo.scsNoPrazo)} SCs no prazo, ${fmt.inteiro(resumo.scsFora)} fora`,
      variacao: vs('pctScsNoPrazo', pontos, 'maior'),
      serie: serieDe(ctx.historico, (p) => p.aberto.pctScsNoPrazo, resumo.pctScsNoPrazo),
    }),
    cartao({
      icone: 'alerta', rotulo: 'SCs fora do prazo', valor: fmt.inteiro(resumo.scsFora), tom: resumo.scsFora ? 'critico' : null,
      detalhe: `${fmt.inteiro(resumo.fora)} itens com mais de ${PRAZO_SLA_DIAS} dias úteis${resumo.scsSemPrazo ? `; ${fmt.inteiro(resumo.scsSemPrazo)} SCs sem prazo` : ''}`,
      variacao: vs('scsFora', fmt.inteiro, 'menor'),
      serie: serieDe(ctx.historico, (p) => p.aberto.scsFora, resumo.scsFora),
    }),
    cartao({ icone: 'relogio', rotulo: 'Média de dias em aberto', valor: fmt.decimal(resumo.mediaDias), detalhe: `Mais antiga: ${fmt.inteiro(resumo.maxDias)} dias úteis`, variacao: vs('mediaDias', fmt.decimal, 'menor'), serie: serieDe(ctx.historico, (p) => p.aberto.mediaDias, resumo.mediaDias) }),
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
    if (local.faixa) lista = lista.filter((r) => faixaDe(r.diasEmAberto) === local.faixa);
    return lista;
  };
  const vazio = () => ([...local.status].some((s) => ehPendencia({ status: s }))
    ? 'Nenhum item com esse recorte. Pendências ficam no comprador "Pendente" (o ME não preenche "Selecionado por"): confira o filtro Comprador.'
    : 'Nenhuma SC com esse recorte.');

  const soPendencias = () => local.status.size === statusPendencia.length && statusPendencia.every((s) => local.status.has(s));
  const atalho = el('button', {
    type: 'button', class: 'botao botao-sec botao-pequeno',
    onclick: () => { local.status = new Set(statusPendencia); guardarStatus(); ctx.redesenhar(); },
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
    aoMudar: () => { guardarStatus(); tabela.atualizar(recortar()); atalho.hidden = !statusPendencia.length || soPendencias(); },
  });

  // Atendidas: o olho (ou duplo clique na linha) recolhe a SC numa linha só (Dias da aprovação
  // e SC), como recolher na tabela dinâmica da planilha. Olho riscado (ou duplo clique) expande.
  // Cartões e gráficos não mudam. Sem aviso nem Desfazer (pedido da equipe): o olho riscado desfaz.

  const atualizarLista = () => tabela?.atualizar(recortar(), { manterPagina: true });

  /** r: um item da SC (a marca vale para a SC inteira, chave `solicitacao`). */
  function alternarAtendida(r, atendida) {
    marcarAtendida(r.solicitacao, atendida);
    atualizarLista();
  }

  const colunas = atendidasLigadas ? [{
    id: 'olho', rotulo: 'Atendida', controle: true, valor: (r) => r.solicitacao,
    exibir: (r) => {
      const atendida = estaAtendida(r.solicitacao);
      const rotulo = atendida ? `Expandir SC ${r.sc} (desmarcar atendida)` : `Marcar SC ${r.sc} como atendida (recolher)`;
      return el('button', {
        type: 'button', class: 'olho', 'aria-label': rotulo, title: rotulo,
        onclick: (e) => { e.stopPropagation(); alternarAtendida(r, !atendida); },
      }, icone(atendida ? 'olho-fechado' : 'olho'));
    },
  }, ...COLUNAS_SCS] : COLUNAS_SCS;

  const recortes = el('div', { class: 'recortes' },
    filtroStatus,
    atalho,
    local.faixa ? el('button', {
      type: 'button', class: 'chip', onclick: () => { local.faixa = null; ctx.redesenhar(); },
      'aria-label': `Remover recorte ${FAIXAS_DIAS.find((f) => f.id === local.faixa).rotulo}`,
    }, FAIXAS_DIAS.find((f) => f.id === local.faixa).rotulo, el('span', { 'aria-hidden': 'true' }, ' ✕')) : null);

  // Clique na linha: painel lateral com a SC (espera um instante: dois cliques marcam atendida).
  const detalhe = cliqueDeDetalhe((r) => ctx.registros.filter((x) => x.solicitacao === r.solicitacao), { esperar: atendidasLigadas });
  tabela = criarTabela({
    titulo: 'SCs em aberto',
    linhas: recortar(),
    colunas,
    ordem: { coluna: 'aprov', desc: true },
    // Como a tabela dinâmica da aba Regional: dados da SC só na 1ª linha, itens embaixo.
    // Atendida: recolhida numa linha só com Dias da aprovação e SC, como na planilha.
    grupo: {
      chave: (r) => r.solicitacao, colunas: ['olho', 'aprov', 'sc', 'data', 'prioridade'], nome: ['SC', 'SCs'],
      recolhido: atendidasLigadas ? estaAtendida : null, colunasRecolhido: ['olho', 'aprov', 'sc'], nomeRecolhido: ['atendida', 'atendidas'],
    },
    nomeArquivo: 'scs-em-aberto.csv',
    // Pedido da equipe (12/11/2026): mais SCs por página, colunas cabem na largura e dá para ocultar colunas.
    porPagina: 200,
    caberNaLargura: true,
    escolherColunas: true,
    vazio,
    classeLinha: classeDaLinhaSc,
    aoClicarLinha: detalhe.aoClicarLinha,
    aoDuploClique: atendidasLigadas ? (r) => { detalhe.cancelar(); alternarAtendida(r, !estaAtendida(r.solicitacao)); } : null,
  });
  const botaoTelaCheia = el('button', { type: 'button', class: 'botao botao-sec botao-pequeno' });
  const blocoLista = bloco(
    {
      titulo: 'SCs em aberto',
      acoes: botaoTelaCheia,
      subtitulo: 'Itens agrupados por SC, da mais antiga para a mais nova.',
      ajuda: atendidasLigadas
        ? 'Já atendeu? Clique no olho ou dê dois cliques na linha (fora do número da SC) para recolher a SC numa linha só (fica salvo neste navegador). CSV e "Copiar tabela" trazem um item por linha.'
        : 'CSV e "Copiar tabela" trazem um item por linha.',
    },
    recortes,
    tabela.elemento,
  );

  const aplicarTelaCheia = (ligar) => {
    telaCheia = ligar;
    blocoLista.classList.toggle('tela-cheia', ligar);
    botaoTelaCheia.textContent = ligar ? 'Sair da tela cheia' : 'Tela cheia';
    botaoTelaCheia.setAttribute('aria-pressed', String(ligar));
    botaoTelaCheia.title = ligar ? 'Voltar ao painel (Esc)' : 'Mostrar só a lista, na janela inteira';
    // Só vale com a lista na tela (outra aba aberta: Esc não mexe na preferência).
    sairDaTelaCheia = ligar ? () => { if (blocoLista.isConnected) { aplicarTelaCheia(false); botaoTelaCheia.focus(); } } : null;
  };
  botaoTelaCheia.onclick = () => aplicarTelaCheia(!telaCheia);
  aplicarTelaCheia(telaCheia);

  return el('div', { class: 'tela' }, cartoes, el('div', { class: 'grade-2 grade-2-3' }, graficoFaixas, blocoGrupos), blocoLista);
}

/** Zera as seleções locais ao trocar de bases (o recorte de Status fica: é salvo no navegador). */
export function reiniciarRegional() {
  telaCheia = false;
  local.faixa = null;
}
