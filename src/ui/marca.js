// Identidade visual: logo completo da Controladoria Administrativa CDs (com Seara e o texto; pedido
// da equipe, 13/11/2026) à esquerda do topo (ocupa as duas linhas: título e abas) e como ícone da aba
// do navegador. Vem do Boletim Informativo - CDs MI (a mesma versão usada no Teams; a do giro-estoque
// é outra arte), sem as margens transparentes. Fundo transparente nos dois temas; no escuro usa
// marca-escuro.webp (texto e azul-escuro da arte clareados, senão somem no fundo escuro). Entra
// embutido (data URI) para o painel continuar sendo um arquivo só.
import MARCA from '../assets/marca.webp?inline';
import MARCA_ESCURO from '../assets/marca-escuro.webp?inline';
import { el } from './dom.js';

export function aplicarMarca() {
  const topo = document.querySelector('.topo');
  if (topo && !topo.querySelector('.topo-emblema')) {
    topo.prepend(
      el('img', { class: 'topo-emblema topo-emblema-claro', src: MARCA, alt: '', width: '88', height: '80' }),
      el('img', { class: 'topo-emblema topo-emblema-escuro', src: MARCA_ESCURO, alt: '', width: '88', height: '80' }),
    );
  }
  if (!document.querySelector('link[rel="icon"]')) {
    document.head.append(el('link', { rel: 'icon', type: 'image/webp', href: MARCA }));
  }
}
