// Identidade visual: logo completo da Controladoria Administrativa CDs (com Seara e o texto; pedido
// da equipe, 13/11/2026) à esquerda do topo (ocupa as duas linhas: título e abas) e como ícone da aba
// do navegador. Vem de ../giro-estoque/assets/images/logo-controladoria-cds.webp, sem as margens
// transparentes. Entra embutido (data URI) para o painel continuar sendo um arquivo só.
import MARCA from '../assets/marca.webp?inline';
import { el } from './dom.js';

export function aplicarMarca() {
  const topo = document.querySelector('.topo');
  if (topo && !topo.querySelector('.topo-emblema')) {
    topo.prepend(el('img', { class: 'topo-emblema', src: MARCA, alt: '', width: '91', height: '80' }));
  }
  if (!document.querySelector('link[rel="icon"]')) {
    document.head.append(el('link', { rel: 'icon', type: 'image/webp', href: MARCA }));
  }
}
