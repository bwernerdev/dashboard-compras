// Densidade das tabelas (todas de uma vez): "Linhas compactas" (menu "⋯" de cada tabela) tira respiro
// das linhas. Lembrada no navegador.
import { el, icone } from './dom.js';
import { lerPreferencia, salvarPreferencia } from '../preferencias.js';

const CLASSE_COMPACTA = 'densidade-compacta';
let densidadeLida = false;
const ehCompacta = () => document.documentElement.classList.contains(CLASSE_COMPACTA);

function lerDensidade() {
  if (densidadeLida) return;
  densidadeLida = true;
  document.documentElement.classList.toggle(CLASSE_COMPACTA, lerPreferencia('densidade') === 'compacta');
}

function trocarDensidade() {
  const compacta = !ehCompacta();
  document.documentElement.classList.toggle(CLASSE_COMPACTA, compacta);
  salvarPreferencia('densidade', compacta ? 'compacta' : 'confortavel');
  for (const b of document.querySelectorAll('.item-densidade')) b.setAttribute('aria-checked', String(compacta));
}

/** Item "Linhas compactas" do menu da tabela (aplica a densidade salva na primeira tabela). */
export function itemDensidade() {
  lerDensidade();
  return el('button', {
    type: 'button', class: 'menu-item item-densidade', role: 'menuitemcheckbox', 'aria-checked': String(ehCompacta()),
    title: 'Linhas mais baixas: cabem mais na tela (vale para todas as tabelas, lembrado neste navegador)',
    onclick: trocarDensidade,
  }, el('span', { class: 'menu-marca' }, icone('check', 14)), 'Linhas compactas');
}
