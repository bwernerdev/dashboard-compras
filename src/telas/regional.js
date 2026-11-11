// Tela Regional: SCs em aberto (sem pedido e não canceladas), dias úteis em aberto e SLA.
// Substitui a aba "Regional" (e cobre a "Atendimento") da planilha antiga, com os dias corrigidos.
import { el } from '../ui/dom.js';
import { cartao, linhaDeCartoes, bloco } from '../ui/cartoes.js';
import { barras, barraSegmentada } from '../ui/graficos.js';
import { criarTabela } from '../ui/tabela.js';
import * as fmt from '../ui/formatos.js';
import {
  itensEmAberto, resumoEmAberto, porFaixaDeDias, emAbertoPor, faixaDe, FAIXAS_DIAS,
} from '../analise.js';
import { ERRO_ND } from '../regras.js';

// Seleções locais da tela (não são filtros globais: só recortam a lista de SCs).
const local = { faixa: null, sla: 'todos', agrupar: 'regional' };

const SLA_OPCOES = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'Fora do Prazo', rotulo: 'Fora do prazo' },
  { id: 'No Prazo', rotulo: 'No prazo' },
  { id: 'sem', rotulo: 'Sem prazo' },
];

function seloSla(sla) {
  if (sla === 'No Prazo') return el('span', { class: 'selo-status bom' }, el('span', { 'aria-hidden': 'true' }, '✓'), ' No prazo');
  if (sla === 'Fora do Prazo') return el('span', { class: 'selo-status critico' }, el('span', { 'aria-hidden': 'true' }, '!'), ' Fora do prazo');
  if (sla === ERRO_ND) return el('span', { class: 'selo-status neutro', title: 'Prioridade sem linha na tabela de SLA' }, '#N/D');
  return el('span', { class: 'texto-fraco' }, '-');
}

const COLUNAS_SCS = [
  { id: 'dias', rotulo: 'Dias em aberto', num: true, valor: (r) => r.diasEmAberto, formato: fmt.inteiro, titulo: 'Dias úteis (seg–sex) desde a criação da SC' },
  { id: 'aprov', rotulo: 'Dias da aprovação', num: true, valor: (r) => r.diasDaAprovacao, formato: fmt.inteiro, titulo: 'Dias corridos desde a criação' },
  { id: 'sc', rotulo: 'SC', valor: (r) => r.sc },
  { id: 'item', rotulo: 'Item', num: true, valor: (r) => r.item, formato: fmt.inteiro },
  { id: 'data', rotulo: 'Data', tipo: 'data', valor: (r) => r.data },
  { id: 'prioridade', rotulo: 'Prioridade', valor: (r) => r.prioridade },
  { id: 'status', rotulo: 'Status', valor: (r) => r.status },
  { id: 'sla', rotulo: 'SLA', valor: (r) => r.sla, exibir: (r) => seloSla(r.sla) },
  { id: 'max', rotulo: 'Prazo máx.', num: true, valor: (r) => (typeof r.slaMax === 'number' ? r.slaMax : null), formato: fmt.inteiro },
  { id: 'descricao', rotulo: 'Produto', valor: (r) => r.descricao, classe: () => 'texto-longo' },
  { id: 'codigo', rotulo: 'Código', valor: (r) => r.codigoProduto },
  { id: 'qtd', rotulo: 'Qtd.', num: true, valor: (r) => r.qtdSolicitacao, formato: fmt.inteiro },
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

  let lista = abertos;
  if (local.faixa) lista = lista.filter((r) => faixaDe(r.diasEmAberto) === local.faixa);
  if (local.sla === 'sem') lista = lista.filter((r) => r.sla !== 'No Prazo' && r.sla !== 'Fora do Prazo');
  else if (local.sla !== 'todos') lista = lista.filter((r) => r.sla === local.sla);

  const recortes = el('div', { class: 'recortes' },
    el('label', { class: 'recorte' }, 'SLA ',
      el('select', {
        class: 'campo', onchange: (ev) => { local.sla = ev.target.value; ctx.redesenhar(); },
      }, SLA_OPCOES.map((o) => el('option', { value: o.id, selected: local.sla === o.id }, o.rotulo)))),
    local.faixa ? el('button', {
      type: 'button', class: 'chip', onclick: () => { local.faixa = null; ctx.redesenhar(); },
      'aria-label': `Remover recorte ${FAIXAS_DIAS.find((f) => f.id === local.faixa).rotulo}`,
    }, FAIXAS_DIAS.find((f) => f.id === local.faixa).rotulo, el('span', { 'aria-hidden': 'true' }, ' ✕')) : null);

  const blocoLista = bloco(
    { titulo: 'SCs em aberto', subtitulo: 'Um item por linha, da mais antiga para a mais nova.' },
    recortes,
    criarTabela({
      titulo: 'SCs em aberto',
      linhas: lista,
      colunas: COLUNAS_SCS,
      ordem: { coluna: 'dias', desc: true },
      nomeArquivo: 'scs-em-aberto.csv',
      vazio: 'Nenhuma SC com esse recorte.',
    }).elemento,
  );

  return el('div', { class: 'tela' }, cartoes, el('div', { class: 'grade-2 grade-2-3' }, graficoFaixas, blocoGrupos), blocoLista);
}

/** Zera as seleções locais (ao trocar de bases). */
export function reiniciarRegional() {
  local.faixa = null;
  local.sla = 'todos';
}
