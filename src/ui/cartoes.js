// Cartões de indicador (stat tiles): rótulo, valor e detalhe.
import { el } from './dom.js';
import { ligarDicaTexto } from './dica.js';

/**
 * tom: 'bom' | 'alerta' | 'critico' | null — sempre acompanhado de texto, nunca só a cor.
 * variacao: resultado de `variacao()` (linha "+5 desde 10/11") ou null.
 */
export function cartao({ rotulo, valor, detalhe = null, tom = null, variacao: v = null }) {
  return el('div', { class: `cartao${tom ? ` cartao-${tom}` : ''}` },
    el('div', { class: 'cartao-rotulo' }, rotulo),
    el('div', { class: 'cartao-valor' }, valor),
    detalhe ? el('div', { class: 'cartao-detalhe' }, detalhe) : null,
    v ? el('div', { class: `cartao-variacao variacao-${v.tom}`, title: `Comparado com a base do ME de ${v.rotulo}` },
      el('span', { 'aria-hidden': 'true' }, v.seta), ` ${v.texto}`) : null);
}

/**
 * Variação desde a base anterior (pedido da equipe, 12/11/2026). diferença = atual - anterior.
 * formato: formata o valor absoluto da diferença. melhor: 'menor' | 'maior' | null (sem cor).
 * O sinal (+/−) vai no texto; a cor só reforça.
 */
export function variacao({ atual, anterior, rotulo, formato, melhor = null }) {
  if (atual === null || atual === undefined || anterior === null || anterior === undefined || !rotulo) return null;
  const dif = atual - anterior;
  if (Math.abs(dif) < 1e-9) return { seta: '=', texto: `igual a ${rotulo}`, tom: 'neutro', rotulo };
  const tom = !melhor ? 'neutro' : ((dif < 0) === (melhor === 'menor') ? 'melhor' : 'pior');
  return { seta: dif > 0 ? '▲' : '▼', texto: `${dif > 0 ? '+' : '−'}${formato(Math.abs(dif))} desde ${rotulo}`, tom, rotulo };
}

/** Atalho das telas: comparar(ctx.anteriores?.rotulo, resumo, resumoAnterior)('campo', formato, melhor). */
export const comparar = (rotulo, atual, anterior) => (campo, formato, melhor = null) => (anterior
  ? variacao({ atual: atual[campo], anterior: anterior[campo], rotulo, formato, melhor })
  : null);

/** Diferença de percentual em pontos percentuais. */
export const pontos = (d) => `${(d * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`;

export const linhaDeCartoes = (...cartoes) => el('div', { class: 'cartoes' }, cartoes);

/**
 * Bloco com título, subtítulo opcional (uma frase curta), ações à direita do título (botões) e conteúdo.
 * ajuda: texto longo de como ler/usar, num botão "?" ao lado do título (dica no hover e no foco).
 */
export function bloco({ titulo, subtitulo = null, ajuda = null, classe = '', acoes = null }, ...conteudo) {
  let botaoAjuda = null;
  if (ajuda) {
    botaoAjuda = el('button', { type: 'button', class: 'botao-ajuda', 'aria-label': `Ajuda: ${ajuda}` }, '?');
    ligarDicaTexto(botaoAjuda, ajuda);
  }
  return el('section', { class: `bloco ${classe}`.trim() },
    el('header', { class: 'bloco-cabecalho' },
      el('div', { class: 'bloco-titulos' },
        el('div', { class: 'bloco-titulo-linha' }, el('h2', {}, titulo), botaoAjuda),
        subtitulo ? el('p', { class: 'bloco-subtitulo' }, subtitulo) : null),
      acoes ? el('div', { class: 'bloco-acoes' }, acoes) : null),
    conteudo);
}
