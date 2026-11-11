// Dica flutuante única (tooltip) para gráficos: aparece no hover e no foco do teclado.
// Só complementa: todo valor também está na tabela ao lado do gráfico.
import { el, substituir } from './dom.js';

let caixa = null;

function obterCaixa() {
  if (!caixa) {
    caixa = el('div', { class: 'dica', role: 'tooltip', hidden: true });
    document.body.append(caixa);
  }
  return caixa;
}

/**
 * Liga a dica a um elemento. conteudo(): [{ valor, rotulo, cor? }] — o valor vem em destaque.
 */
export function ligarDica(alvo, titulo, conteudo) {
  const mostrar = (x, y) => {
    const c = obterCaixa();
    substituir(c,
      el('div', { class: 'dica-titulo' }, titulo),
      conteudo().map((l) => el('div', { class: 'dica-linha' },
        l.cor ? el('span', { class: 'dica-chave', style: { background: l.cor } }) : null,
        el('strong', {}, l.valor),
        el('span', {}, l.rotulo))));
    c.hidden = false;
    const larg = c.offsetWidth;
    const alt = c.offsetHeight;
    const esquerda = Math.min(Math.max(8, x + 14), window.innerWidth - larg - 8);
    const topo = y + 14 + alt > window.innerHeight ? y - alt - 10 : y + 14;
    c.style.left = `${esquerda}px`;
    c.style.top = `${Math.max(8, topo)}px`;
  };
  const esconder = () => { if (caixa) caixa.hidden = true; };
  alvo.addEventListener('pointermove', (ev) => mostrar(ev.clientX, ev.clientY));
  alvo.addEventListener('pointerleave', esconder);
  alvo.addEventListener('focus', () => {
    const r = alvo.getBoundingClientRect();
    mostrar(r.left + r.width / 2, r.bottom);
  });
  alvo.addEventListener('blur', esconder);
}

export function esconderDica() {
  if (caixa) caixa.hidden = true;
}
