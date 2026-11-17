// Densidade das tabelas (todas de uma vez): "Compacta" tira respiro das linhas. Lembrada no navegador.
import { el } from './dom.js';
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
  for (const b of document.querySelectorAll('.botao-densidade')) b.setAttribute('aria-pressed', String(compacta));
}

/** Botão "Compacta" da barra da tabela (aplica a densidade salva na primeira tabela). */
export function botaoDensidade() {
  lerDensidade();
  return el('button', {
    type: 'button', class: 'botao botao-sec botao-pequeno botao-densidade', 'aria-pressed': String(ehCompacta()),
    title: 'Linhas mais baixas: cabem mais na tela (vale para todas as tabelas, lembrado neste navegador)',
    onclick: trocarDensidade,
  }, 'Compacta');
}
