// Painel lateral com o detalhe de uma SC (pedido da equipe, 12/11/2026): clique numa linha das listas
// de SCs abre à direita os itens, prazos, status e comprador, sem sair da lista. Esc ou ✕ fecham.
// Usa só os campos que existirem (o painel publicado leva menos campos que o app).
import { el, substituir } from './dom.js';
import * as fmt from './formatos.js';
import { seloDoStatus, marcaDaPrioridade } from './cores-planilha.js';

let painel = null;
let origemDoFoco = null;

function obterPainel() {
  if (painel) return painel;
  painel = el('aside', { class: 'detalhe-sc', hidden: true, tabindex: '-1' });
  document.body.append(painel);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !painel.hidden) fecharDetalhe(); });
  return painel;
}

export function fecharDetalhe() {
  if (!painel || painel.hidden) return;
  painel.hidden = true;
  origemDoFoco?.focus?.();
  origemDoFoco = null;
}

const primeiro = (linhas, campo) => linhas.find((r) => r[campo] !== null && r[campo] !== undefined && r[campo] !== '')?.[campo] ?? null;

/** Abre o painel com as linhas (itens) de uma SC. */
export function abrirDetalhe(linhas) {
  if (!linhas?.length) return;
  const p = obterPainel();
  if (p.hidden) origemDoFoco = document.activeElement;
  const sc = primeiro(linhas, 'sc') ?? primeiro(linhas, 'solicitacao');
  const dias = Math.max(...linhas.map((r) => r.diasEmAberto ?? -1));
  const fora = linhas.some((r) => r.sla === 'Fora do Prazo');
  const regularizacao = /^regulariza/i.test(String(primeiro(linhas, 'categoria') ?? '').normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const fechar = el('button', { type: 'button', class: 'botao-link detalhe-fechar', 'aria-label': 'Fechar detalhe', onclick: fecharDetalhe }, '✕');
  const info = [
    ['Solicitante', primeiro(linhas, 'solicitante')],
    ['Comprador', primeiro(linhas, 'comprador') ?? '-'],
    ['Data Aprovação', fmt.data(primeiro(linhas, 'criacao'))],
    ['Dias da aprovação', fmt.inteiro(primeiro(linhas, 'diasDaAprovacao'))],
    ['Regional', primeiro(linhas, 'regional')],
  ];

  substituir(p,
    el('header', { class: 'detalhe-cabecalho' },
      el('div', {},
        el('h2', { id: 'detalhe-titulo' }, `SC ${sc}`),
        el('p', { class: 'texto-fraco' }, [primeiro(linhas, 'nomeFilial'), primeiro(linhas, 'filial')].filter(Boolean).join(' · '))),
      fechar),
    el('div', { class: 'detalhe-selos' },
      dias >= 0 ? el('span', { class: `selo-status ${fora ? 'critico' : 'bom'}` }, `${fmt.inteiro(dias)} dias úteis em aberto${fora ? ' (fora do prazo)' : ''}`)
        : el('span', { class: 'selo-status neutro' }, 'Sem item em aberto'),
      primeiro(linhas, 'prioridade') ? marcaDaPrioridade(primeiro(linhas, 'prioridade')) : null,
      regularizacao ? el('span', { class: 'selo-status critico' }, 'Regularização') : null),
    el('dl', { class: 'detalhe-info' }, info.flatMap(([rotulo, valor]) => [el('dt', {}, rotulo), el('dd', {}, fmt.texto(valor))])),
    el('h3', { class: 'detalhe-subtitulo' }, `Itens (${linhas.length})`),
    el('ul', { class: 'detalhe-itens' }, linhas.map((r) => el('li', {},
      el('div', { class: 'detalhe-item-topo' },
        el('span', { class: 'detalhe-produto' }, fmt.texto(r.descricao)),
        r.status ? seloDoStatus(r.status) : null),
      el('div', { class: 'texto-fraco' }, [
        r.codigoProduto ? `Código ${r.codigoProduto}` : null,
        r.qtdSolicitacao !== null && r.qtdSolicitacao !== undefined ? `Qtd. ${fmt.inteiro(r.qtdSolicitacao)}${r.unidade ? ` ${r.unidade}` : ''}` : null,
        r.numeroPedido ? `OF ${r.of ?? r.numeroPedido}` : null,
        r.dataPedido ? `pedido em ${fmt.data(r.dataPedido)}` : null,
      ].filter(Boolean).join(' · ') || ' ')))));
  p.setAttribute('aria-labelledby', 'detalhe-titulo');
  p.hidden = false;
  fechar.focus();
}

/**
 * Clique na linha que abre o detalhe, sem brigar com o duplo clique (atendida) nem com quem
 * seleciona texto: espera um instante; um duplo clique cancela (chamar `cancelar` no aoDuploClique).
 */
export function cliqueDeDetalhe(linhasDaSc, { esperar = false } = {}) {
  let relogio = 0;
  return {
    aoClicarLinha: (r) => {
      if (window.getSelection?.().toString()) return;
      clearTimeout(relogio);
      if (esperar) relogio = setTimeout(() => abrirDetalhe(linhasDaSc(r)), 260);
      else abrirDetalhe(linhasDaSc(r));
    },
    cancelar: () => clearTimeout(relogio),
  };
}

