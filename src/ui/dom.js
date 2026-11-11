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

let contador = 0;
export const novoId = (prefixo = 'id') => `${prefixo}-${++contador}`;
