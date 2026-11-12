// Identidade visual: emblema da Controladoria Administrativa CDs à esquerda do topo (ocupa as duas
// linhas: título e abas) e como ícone da aba do navegador. Recortado do logo completo
// (../giro-estoque/assets/images/logo-controladoria-cds.webp) sem o texto, que fica ilegível nessa
// altura. Entra embutido (data URI) para o painel continuar sendo um arquivo só.
import MARCA from '../assets/marca.webp?inline';
import { el } from './dom.js';

export function aplicarMarca() {
  const topo = document.querySelector('.topo');
  if (topo && !topo.querySelector('.topo-emblema')) {
    topo.prepend(el('img', { class: 'topo-emblema', src: MARCA, alt: '', width: '142', height: '80' }));
  }
  if (!document.querySelector('link[rel="icon"]')) {
    document.head.append(el('link', { rel: 'icon', type: 'image/webp', href: MARCA }));
  }
}
