// Cartões de indicador (stat tiles): rótulo, valor e detalhe.
import { el } from './dom.js';

/** tom: 'bom' | 'alerta' | 'critico' | null — sempre acompanhado de texto, nunca só a cor. */
export function cartao({ rotulo, valor, detalhe = null, tom = null }) {
  return el('div', { class: `cartao${tom ? ` cartao-${tom}` : ''}` },
    el('div', { class: 'cartao-rotulo' }, rotulo),
    el('div', { class: 'cartao-valor' }, valor),
    detalhe ? el('div', { class: 'cartao-detalhe' }, detalhe) : null);
}

export const linhaDeCartoes = (...cartoes) => el('div', { class: 'cartoes' }, cartoes);

/** Bloco com título, subtítulo opcional e conteúdo (gráfico ou tabela). */
export function bloco({ titulo, subtitulo = null, classe = '' }, ...conteudo) {
  return el('section', { class: `bloco ${classe}`.trim() },
    el('header', { class: 'bloco-cabecalho' },
      el('h2', {}, titulo),
      subtitulo ? el('p', { class: 'bloco-subtitulo' }, subtitulo) : null),
    conteudo);
}
