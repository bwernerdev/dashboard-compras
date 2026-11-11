// Montagem de DOM sem innerHTML: textos das bases (nomes, descrições) entram sempre como texto.

/**
 * el('div', { class: 'x', onclick: fn, 'aria-label': 'y' }, filho1, 'texto', [filhos])
 * Atributo null/undefined/false é ignorado; true vira atributo vazio.
 */
export function el(tag, atributos = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos ?? {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (nome.startsWith('on') && typeof valor === 'function') no.addEventListener(nome.slice(2), valor);
    else if (nome === 'style' && typeof valor === 'object') Object.assign(no.style, valor);
    else if (nome === 'dataset') Object.assign(no.dataset, valor);
    else no.setAttribute(nome, valor === true ? '' : String(valor));
  }
  anexar(no, filhos);
  return no;
}

function anexar(no, filhos) {
  for (const f of filhos) {
    if (f === null || f === undefined || f === false) continue;
    if (Array.isArray(f)) anexar(no, f);
    else no.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
}

/** Troca todo o conteúdo de um nó. */
export function substituir(no, ...filhos) {
  no.replaceChildren();
  anexar(no, filhos);
  return no;
}

// Ícones de traço (24x24, cor do texto). Decorativos: o botão leva o nome em aria-label.
const ICONES = {
  olho: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'],
  'olho-fechado': [
    'M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.5',
    'M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6',
    'M9.9 9.9a3 3 0 0 0 4.2 4.2',
    'M3 3l18 18',
  ],
};

export function icone(nome) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [a, v] of Object.entries({
    viewBox: '0 0 24 24', width: '16', height: '16', fill: 'none', stroke: 'currentColor',
    'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false',
  })) svg.setAttribute(a, v);
  for (const d of ICONES[nome]) {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

let contador = 0;
export const novoId = (prefixo = 'id') => `${prefixo}-${++contador}`;
