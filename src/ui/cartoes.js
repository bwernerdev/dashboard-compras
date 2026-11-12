// Cartões de indicador (stat tiles): rótulo, valor e detalhe.
import { el, icone as desenharIcone } from './dom.js';
import { ligarDicaTexto } from './dica.js';

/**
 * tom: 'bom' | 'alerta' | 'critico' | null — sempre acompanhado de texto, nunca só a cor.
 * variacao: resultado de `variacao()` (linha "+5 desde 10/11") ou null.
 * icone: nome de um ícone de `dom.js` (decorativo, no canto; a cor acompanha o tom).
 * serie: valores das últimas bases (o último é o atual) para o mini gráfico; decorativo (os números
 * estão no cartão e na variação).
 */
export function cartao({ rotulo, valor, detalhe = null, tom = null, variacao: v = null, icone = null, serie = null }) {
  return el('div', { class: `cartao${tom ? ` cartao-${tom}` : ''}` },
    el('div', { class: 'cartao-topo' },
      el('div', { class: 'cartao-rotulo' }, rotulo),
      icone ? el('span', { class: 'cartao-icone' }, desenharIcone(icone, 18)) : null),
    el('div', { class: 'cartao-valor' }, valor),
    serie ? miniGrafico(serie) : null,
    detalhe ? el('div', { class: 'cartao-detalhe' }, detalhe) : null,
    v ? el('div', { class: `cartao-variacao variacao-${v.tom}`, title: v.ligacao === 'x' ? `Comparado com ${v.rotulo}` : `Comparado com a base do ME de ${v.rotulo}` },
      el('span', { 'aria-hidden': 'true' }, v.seta), ` ${v.texto}`) : null);
}

/**
 * Variação desde a base anterior (pedido da equipe, 12/11/2026). diferença = atual - anterior.
 * formato: formata o valor absoluto da diferença. melhor: 'menor' | 'maior' | null (sem cor).
 * O sinal (+/−) vai no texto; a cor só reforça.
 */
export function variacao({ atual, anterior, rotulo, formato, melhor = null, ligacao = 'desde' }) {
  if (atual === null || atual === undefined || anterior === null || anterior === undefined || !rotulo) return null;
  const dif = atual - anterior;
  if (Math.abs(dif) < 1e-9) return { seta: '=', texto: `igual a ${rotulo}`, tom: 'neutro', rotulo, ligacao };
  const tom = !melhor ? 'neutro' : ((dif < 0) === (melhor === 'menor') ? 'melhor' : 'pior');
  return { seta: dif > 0 ? '▲' : '▼', texto: `${dif > 0 ? '+' : '−'}${formato(Math.abs(dif))} ${ligacao} ${rotulo}`, tom, rotulo, ligacao };
}

/** Linha fina com os valores das últimas bases (SVG decorativo, escala do menor ao maior). */
function miniGrafico(valores) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const L = 120;
  const A = 24;
  const min = Math.min(...valores);
  const amplitude = Math.max(...valores) - min || 1;
  const pontos = valores.map((v, i) => `${(i / (valores.length - 1)) * L},${A - 2 - ((v - min) / amplitude) * (A - 4)}`).join(' ');
  for (const [a, x] of Object.entries({ viewBox: `0 0 ${L} ${A}`, preserveAspectRatio: 'none', class: 'cartao-serie', 'aria-hidden': 'true' })) svg.setAttribute(a, x);
  const linha = document.createElementNS(ns, 'polyline');
  linha.setAttribute('points', pontos);
  linha.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(linha);
  return svg;
}

/**
 * Valores do mini gráfico: pontos do histórico (bases de dias anteriores) + o valor atual.
 * Menos de 2 pontos (ou com filtro: historico null) = sem gráfico.
 */
export function serieDe(historico, campo, atual) {
  if (!historico?.length || atual === null || atual === undefined) return null;
  const valores = historico.map(campo).filter((v) => typeof v === 'number' && Number.isFinite(v));
  return valores.length ? [...valores, atual] : null;
}

/** Atalho das telas: comparar(ctx.anteriores?.rotulo, resumo, resumoAnterior)('campo', formato, melhor). */
export const comparar = (rotulo, atual, anterior) => (campo, formato, melhor = null) => (anterior
  ? variacao({ atual: atual[campo], anterior: anterior[campo], rotulo, formato, melhor })
  : null);

/**
 * Variação relativa (ex.: "+12% x 01/10 a 12/10"), para valores em R$. Sem base (anterior 0): null.
 */
export function variacaoRelativa({ atual, anterior, rotulo, melhor = null }) {
  if (!anterior || atual === null || atual === undefined) return null;
  return variacao({
    atual: atual / anterior - 1, anterior: 0, rotulo, melhor, ligacao: 'x',
    formato: (d) => `${(d * 100).toLocaleString('pt-BR', { maximumFractionDigits: d < 0.1 ? 1 : 0 })}%`,
  });
}

/** Diferença de percentual em pontos percentuais. */
export const pontos = (d) => `${(d * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`;

export const linhaDeCartoes = (...cartoes) => el('div', { class: 'cartoes' }, cartoes);

/** Esqueleto da tela (cartões e dois blocos) enquanto os dados abrem. */
export function esqueleto(texto = 'Carregando os dados...') {
  const peca = (classe) => el('div', { class: `esqueleto-peca ${classe}` });
  return el('div', { class: 'esqueleto', 'aria-busy': 'true' },
    el('p', { class: 'so-leitor', role: 'status' }, texto),
    el('div', { class: 'esqueleto-linha' }, [1, 2, 3, 4].map(() => peca('esqueleto-cartao'))),
    el('div', { class: 'grade-2' }, peca('esqueleto-bloco'), peca('esqueleto-bloco')));
}

/**
 * Estado vazio: ícone, texto e, quando há filtros ativos, o botão "Limpar filtros"
 * (ctx.limparFiltros vem da casca; null sem filtro ativo).
 */
export function estadoVazio(texto, ctx = null, { icone = 'filtro', acao = null } = {}) {
  const botao = acao ?? (ctx?.limparFiltros
    ? { rotulo: 'Limpar filtros', aoClicar: ctx.limparFiltros }
    : null);
  return el('div', { class: 'estado-vazio' },
    el('span', { class: 'estado-vazio-icone' }, desenharIcone(icone, 22)),
    el('p', {}, texto),
    botao ? el('button', { type: 'button', class: 'botao botao-sec botao-pequeno', onclick: botao.aoClicar }, botao.rotulo) : null);
}

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
