// Larguras das colunas de uma tabela (ui/tabela.js): arrastar a borda do cabeçalho, setas, autoajuste
// com dois cliques, "Larguras originais", e o encaixe na largura da área (caberNaLargura).
import { el } from './dom.js';
import { lerJson, salvarJson } from '../preferencias.js';

const MIN_LARGURA = 40;
const LARGURA_MINIMA_TEXTO = 56;

/** Larguras salvas ({ idColuna: px }); armazenamento bloqueado, estragado ou valor inválido = nenhuma. */
function lerLarguras(chave) {
  const obj = lerJson(chave, {});
  return new Map(Object.entries(obj).filter(([, px]) => Number.isFinite(px) && px > 0));
}

/**
 * Larguras ajustadas pela pessoa, lembradas por `nomeArquivo`.
 * `aoMudar`: chamado depois de aplicar (a tabela refaz o encaixe na largura).
 * Devolve { larguras (Map id -> px), estilo (<style>), botao ("Larguras originais"), alca(coluna),
 * aplicar(), ultimaAjustada() }.
 */
export function criarLarguras({ colunas, idTabela, indice, nomeArquivo, cabeca, corpo, aoMudar }) {
  const chave = `larguras:${nomeArquivo}`;
  const larguras = lerLarguras(chave);
  const estilo = el('style');
  let ultimaAjustada = null; // a que a pessoa acabou de mudar não encolhe no "caber na largura"

  /** Regras de largura fixa (uma por coluna ajustada), só desta tabela. */
  function aplicar() {
    estilo.textContent = colunas.filter((c) => larguras.has(c.id)).map((c) => {
      const w = larguras.get(c.id);
      return `[data-tabela="${idTabela}"] .c-${indice.get(c)} { width: ${w}px; min-width: ${w}px; max-width: ${w}px; overflow: hidden; text-overflow: ellipsis; }`;
    }).join(' ');
    botao.hidden = !larguras.size;
    aoMudar();
  }

  function mudar(c, px) {
    ultimaAjustada = px === null ? null : c.id;
    if (px === null) larguras.delete(c.id);
    else larguras.set(c.id, Math.max(MIN_LARGURA, Math.round(px)));
    aplicar();
  }

  const guardar = () => salvarJson(chave, Object.fromEntries(larguras));

  /** Largura que cabe o maior conteúdo da coluna na página atual (cabeçalho numa linha só). */
  function larguraDoConteudo(c) {
    const classe = `c-${indice.get(c)}`;
    const faixa = document.createRange();
    const medir = (no) => {
      faixa.selectNodeContents(no);
      const est = getComputedStyle(no);
      return faixa.getBoundingClientRect().width + parseFloat(est.paddingLeft) + parseFloat(est.paddingRight);
    };
    let maior = 0;
    for (const td of corpo.querySelectorAll(`td.${classe}`)) if (td.childNodes.length) maior = Math.max(maior, medir(td));
    const botaoTh = cabeca.querySelector(`th.${classe} .th-botao`);
    if (botaoTh) {
      botaoTh.style.whiteSpace = 'nowrap';
      maior = Math.max(maior, medir(botaoTh));
      botaoTh.style.whiteSpace = '';
    }
    return Math.ceil(maior) + 2; // borda e arredondamento: sem reticências por 1 px
  }

  /** Borda direita do cabeçalho: arrastar, setas (10 px; Shift = 50 px), dois cliques = autoajuste. */
  function alca(c) {
    const th = () => elemento.parentElement;
    const atual = () => larguras.get(c.id) ?? th().getBoundingClientRect().width;
    const elemento = el('span', {
      class: 'th-alca', role: 'separator', 'aria-orientation': 'vertical', tabindex: '0',
      'aria-label': `Largura da coluna ${c.rotulo}: arraste ou use as setas; dois cliques ajustam ao conteúdo`,
      title: 'Arraste para mudar a largura. Dois cliques: ajusta ao conteúdo.',
      onclick: (ev) => ev.stopPropagation(),
      ondblclick: (ev) => { ev.stopPropagation(); mudar(c, larguraDoConteudo(c)); guardar(); },
      onkeydown: (ev) => {
        if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
        ev.preventDefault();
        const passo = (ev.shiftKey ? 50 : 10) * (ev.key === 'ArrowLeft' ? -1 : 1);
        mudar(c, atual() + passo);
        guardar();
      },
      onpointerdown: (ev) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        const inicioX = ev.clientX;
        const inicioL = atual();
        elemento.setPointerCapture(ev.pointerId);
        elemento.classList.add('arrastando');
        const mover = (e) => mudar(c, inicioL + e.clientX - inicioX);
        const soltar = () => {
          elemento.removeEventListener('pointermove', mover);
          elemento.classList.remove('arrastando');
          guardar();
        };
        elemento.addEventListener('pointermove', mover);
        elemento.addEventListener('pointerup', soltar, { once: true });
        elemento.addEventListener('pointercancel', soltar, { once: true });
      },
    });
    return elemento;
  }

  // Item do menu "⋯" da tabela (só aparece com alguma largura ajustada).
  const botao = el('button', {
    type: 'button', class: 'menu-item', role: 'menuitem', title: 'Volta todas as colunas à largura automática',
    onclick: () => { larguras.clear(); aplicar(); guardar(); },
  }, 'Larguras originais');

  return { larguras, estilo, botao, alca, aplicar, ultimaAjustada: () => ultimaAjustada };
}

/**
 * Caber na largura: se as colunas passam da largura da área, as `encolhivel(c)` encolhem na
 * proporção (com reticências) para a tabela caber sem rolar para o lado. Refaz ao mudar a janela
 * (ResizeObserver) e quando a tabela pede (`pedir`). Inativo: `pedir` não faz nada.
 * Devolve { rolagem (div em volta da tabela), estilo (<style>, depois das larguras salvas), pedir() }.
 */
export function criarAjuste({ ativo, colunas, idTabela, indice, tabela, cabeca, visivel, encolhivel }) {
  const rolagem = el('div', { class: 'tabela-rolagem' }, tabela);
  const estilo = el('style');
  let pendente = false;

  function pedir() {
    if (!ativo || pendente) return;
    pendente = true;
    // Microtarefa: roda depois de a tela pôr a tabela no documento (e funciona com a aba em segundo plano).
    queueMicrotask(() => { pendente = false; caber(); });
  }

  /** Mede as colunas sem ajuste; se passam da área, encolhe as de texto na proporção. */
  function caber() {
    estilo.textContent = '';
    if (!rolagem.isConnected) return;
    const disponivel = rolagem.clientWidth;
    if (!disponivel || tabela.offsetWidth <= disponivel + 1) return;
    const medidas = colunas.filter(visivel).map((c) => {
      const th = cabeca.querySelector(`th.c-${indice.get(c)}`);
      const largura = th ? th.getBoundingClientRect().width : 0;
      return { c, largura, encolhe: encolhivel(c) && largura > LARGURA_MINIMA_TEXTO };
    });
    const fixa = medidas.filter((m) => !m.encolhe).reduce((s, m) => s + m.largura, 0);
    const encolhiveis = medidas.filter((m) => m.encolhe);
    const soma = encolhiveis.reduce((s, m) => s + m.largura, 0);
    if (!soma) return;
    const fator = Math.max(0, disponivel - fixa - 2) / soma;
    estilo.textContent = encolhiveis.map(({ c, largura }) => {
      const w = Math.max(LARGURA_MINIMA_TEXTO, Math.floor(largura * fator));
      return `[data-tabela="${idTabela}"] .c-${indice.get(c)} { width: ${w}px; min-width: 0; max-width: ${w}px; overflow: hidden; text-overflow: ellipsis; }`;
    }).join(' ');
  }

  if (ativo && typeof ResizeObserver === 'function') {
    let larguraAnterior = 0;
    const observador = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      if (w !== larguraAnterior) { larguraAnterior = w; pedir(); }
    });
    observador.observe(rolagem);
    rolagem.observadorLargura = observador; // referência viva enquanto a tabela existir
  }

  return { rolagem, estilo, pedir };
}
