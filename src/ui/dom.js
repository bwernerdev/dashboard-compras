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
  // Cartões de indicador e estados vazios.
  documento: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5', 'M9 13h6', 'M9 17h6'],
  lista: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  relogio: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 7v5l3 2'],
  alerta: ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z', 'M12 9v4', 'M12 17h.01'],
  check: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M8 12l3 3 5-6'],
  moeda: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5', 'M12 6v2', 'M12 16v2'],
  carrinho: ['M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6', 'M9 21h.01', 'M18 21h.01'],
  caminhao: ['M3 6h11v10H3z', 'M14 10h4l3 3v3h-7', 'M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'],
  parcial: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 3v18', 'M12 8h5', 'M12 12h6', 'M12 16h5'],
  cancelado: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M15 9l-6 6', 'M9 9l6 6'],
  porcentagem: ['M19 5 5 19', 'M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  usuario: ['M20 21a8 8 0 0 0-16 0', 'M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z'],
  pacote: ['M21 8 12 3 3 8v8l9 5 9-5z', 'M3 8l9 5 9-5', 'M12 13v8'],
  predio: ['M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16', 'M16 9h2a2 2 0 0 1 2 2v10', 'M3 21h18', 'M8 7h4', 'M8 11h4', 'M8 15h4'],
  tendencia: ['M3 3v18h18', 'M7 15l4-4 3 3 5-6'],
  filtro: ['M3 5h18l-7 8v6l-4 2v-8z'],
};

export function icone(nome, tamanho = 16) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [a, v] of Object.entries({
    viewBox: '0 0 24 24', width: String(tamanho), height: String(tamanho), fill: 'none', stroke: 'currentColor',
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
