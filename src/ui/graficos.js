// Gráficos em HTML/CSS (sem biblioteca), no padrão da skill de visualização:
// barras finas (<= 16 px) com ponta arredondada e base reta, 2 px de folga entre segmentos,
// valor na ponta em cor de texto, legenda sempre que houver 2+ séries, dica no hover/foco.
// Cada gráfico tem uma tabela com os mesmos números na tela (a dica nunca é o único acesso).

import { el } from './dom.js';
import { ligarDica } from './dica.js';

/**
 * Barras horizontais de uma série.
 * itens: [{ id, rotulo, valor, detalhe? }]; formato(valor) -> texto.
 * aoClicar(id) opcional: cada barra vira botão (filtra); selecionado: id realçado.
 */
export function barras({ itens, formato, aoClicar, selecionado = null, rotuloSerie = '' }) {
  const max = Math.max(0, ...itens.map((i) => i.valor));
  const lista = el('div', { class: 'grafico-barras', role: 'list' });
  for (const item of itens) {
    const largura = max > 0 ? (item.valor / max) * 100 : 0;
    const linha = el(aoClicar ? 'button' : 'div', {
      class: `gb-linha${selecionado === item.id ? ' selecionada' : ''}${selecionado && selecionado !== item.id ? ' apagada' : ''}`,
      role: aoClicar ? null : 'listitem',
      type: aoClicar ? 'button' : null,
      tabindex: aoClicar ? null : '0',
      'aria-pressed': aoClicar ? String(selecionado === item.id) : null,
      'aria-label': `${item.rotulo}: ${formato(item.valor)}${rotuloSerie ? ` ${rotuloSerie}` : ''}`,
      onclick: aoClicar ? () => aoClicar(item.id) : null,
    },
    el('span', { class: 'gb-rotulo' }, item.rotulo),
    el('span', { class: 'gb-trilho' },
      el('span', { class: 'gb-barra', style: { width: `${largura}%` } }),
      el('span', { class: 'gb-valor' }, formato(item.valor))));
    ligarDica(linha, item.rotulo, () => [
      { valor: formato(item.valor), rotulo: rotuloSerie },
      ...(item.detalhe ?? []),
    ]);
    lista.append(linha);
  }
  return lista;
}

/**
 * Barras horizontais empilhadas.
 * series: [{ id, rotulo, cor }] em ordem fixa (a cor acompanha a série, nunca a posição);
 * categorias: [{ rotulo, partes: { idSerie: valor }, total }].
 */
export function barrasEmpilhadas({ series, categorias, formato }) {
  const max = Math.max(0, ...categorias.map((c) => series.reduce((s, x) => s + (c.partes[x.id] ?? 0), 0)));
  const legenda = el('ul', { class: 'legenda', 'aria-label': 'Legenda' },
    series.map((s) => el('li', {}, el('span', { class: 'legenda-chave', style: { background: s.cor } }), s.rotulo)));

  const lista = el('div', { class: 'grafico-barras', role: 'list' });
  for (const c of categorias) {
    const soma = series.reduce((s, x) => s + (c.partes[x.id] ?? 0), 0);
    const trilho = el('span', { class: 'gb-trilho' });
    const pilha = el('span', { class: 'gb-pilha', style: { width: `${max > 0 ? (soma / max) * 100 : 0}%` } });
    for (const s of series) {
      const v = c.partes[s.id] ?? 0;
      if (v > 0) pilha.append(el('span', { class: 'gb-segmento', style: { flexGrow: String(v), background: s.cor } }));
    }
    trilho.append(pilha, el('span', { class: 'gb-valor' }, formato(c.total ?? soma)));
    const linha = el('div', {
      class: 'gb-linha', role: 'listitem', tabindex: '0',
      'aria-label': `${c.rotulo}: ${series.filter((s) => c.partes[s.id]).map((s) => `${s.rotulo} ${formato(c.partes[s.id])}`).join(', ')}`,
    }, el('span', { class: 'gb-rotulo' }, c.rotulo), trilho);
    ligarDica(linha, c.rotulo, () => series.filter((s) => c.partes[s.id])
      .map((s) => ({ valor: formato(c.partes[s.id]), rotulo: s.rotulo, cor: s.cor })));
    lista.append(linha);
  }
  return el('div', {}, legenda, lista);
}

/** Colunas verticais de uma série (ex.: por mês). itens: [{ rotulo, valor, detalhe? }]. */
export function colunas({ itens, formato, rotuloSerie = '' }) {
  const max = Math.max(0, ...itens.map((i) => i.valor));
  return el('div', { class: 'grafico-colunas', role: 'list' },
    itens.map((item) => {
      const coluna = el('div', {
        class: 'gc-coluna', role: 'listitem', tabindex: '0',
        'aria-label': `${item.rotulo}: ${formato(item.valor)} ${rotuloSerie}`,
      },
      el('span', { class: 'gc-valor' }, formato(item.valor)),
      el('span', { class: 'gc-area' }, el('span', { class: 'gc-barra', style: { height: `${max > 0 ? (item.valor / max) * 100 : 0}%` } })),
      el('span', { class: 'gc-rotulo' }, item.rotulo));
      ligarDica(coluna, item.rotulo, () => [{ valor: formato(item.valor), rotulo: rotuloSerie }, ...(item.detalhe ?? [])]);
      return coluna;
    }));
}

/**
 * Barra segmentada fina (8 px) para célula de tabela: partes de um todo, sem texto.
 * partes: [{ valor, cor, rotulo }]. Os números ficam nas colunas vizinhas.
 */
export function barraSegmentada(partes, titulo) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  const barra = el('span', {
    class: 'segmentada', role: 'img', tabindex: '0',
    'aria-label': `${titulo}: ${partes.map((p) => `${p.rotulo} ${p.valor}`).join(', ')}`,
  }, partes.filter((p) => p.valor > 0).map((p) => el('span', { style: { flexGrow: String(p.valor), background: p.cor } })));
  if (total === 0) barra.classList.add('vazia');
  ligarDica(barra, titulo, () => partes.map((p) => ({
    valor: `${p.valor} (${total ? Math.round((p.valor / total) * 100) : 0}%)`, rotulo: p.rotulo, cor: p.cor,
  })));
  return barra;
}
