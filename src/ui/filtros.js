// Barra de filtros globais: uma linha acima de tudo; cada filtro abre uma lista de marcar.
// Os filtros valem para todos os números da tela (cartões, gráficos e tabelas).
// Marcar uma opção atualiza a barra no lugar (a lista continua aberta) e avisa o app.
import { el, substituir, novoId } from './dom.js';
import { FILTROS, filtroValeNaTela } from '../analise.js';

let abertoAtual = null;

function fecharAberto() {
  if (abertoAtual) {
    abertoAtual.painel.hidden = true;
    abertoAtual.botao.setAttribute('aria-expanded', 'false');
    abertoAtual = null;
  }
}

document.addEventListener('pointerdown', (ev) => {
  if (abertoAtual && !abertoAtual.raiz.contains(ev.target)) fecharAberto();
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && abertoAtual) {
    const { botao } = abertoAtual;
    fecharAberto();
    botao.focus();
  }
});

const nomeDoValor = (f, v) => (f.rotuloValor ? f.rotuloValor(v) : v);

function resumoSelecao(f, selecionados) {
  if (!selecionados.size) return 'Todos';
  if (selecionados.size === 1) return nomeDoValor(f, [...selecionados][0]);
  return `${selecionados.size} selecionados`;
}

/**
 * Monta a barra. selecao: { idFiltro: Set }; opcoes: { idFiltro: [valores] }.
 * aoMudar(idFiltro, novoSet) a cada marcação; aoLimpar() no "Limpar filtros".
 */
export function barraDeFiltros({ tela, selecao, opcoes, aoMudar, aoLimpar }) {
  const visiveis = FILTROS.filter((f) => filtroValeNaTela(f, tela));
  const atual = Object.fromEntries(visiveis.map((f) => [f.id, new Set(selecao[f.id] ?? [])]));

  const limpar = el('button', { type: 'button', class: 'botao botao-link', onclick: aoLimpar }, 'Limpar filtros');
  const atualizarLimpar = () => { limpar.hidden = !visiveis.some((f) => atual[f.id].size); };

  const itens = visiveis.map((f) => {
    const selecionados = atual[f.id];
    const idPainel = novoId('filtro');
    const valorBotao = el('span', { class: 'filtro-valor' });
    const botao = el('button', {
      type: 'button', class: 'filtro-botao', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': idPainel,
    }, el('span', { class: 'filtro-nome' }, f.rotulo), valorBotao);
    const botaoTodos = el('button', { type: 'button', class: 'botao botao-sec botao-pequeno' }, 'Todos');

    const mudou = () => {
      valorBotao.textContent = resumoSelecao(f, selecionados);
      botao.classList.toggle('ativo', selecionados.size > 0);
      botaoTodos.disabled = selecionados.size === 0;
      atualizarLimpar();
      aoMudar(f.id, new Set(selecionados));
    };

    const valores = opcoes[f.id] ?? [];
    const lista = el('div', { class: 'filtro-lista', role: 'group', 'aria-label': f.rotulo });
    const desenharLista = (termo = '') => {
      const t = termo.toLowerCase();
      substituir(lista, valores
        .filter((v) => !t || nomeDoValor(f, v).toLowerCase().includes(t))
        .map((v) => el('label', { class: 'filtro-opcao' },
          el('input', {
            type: 'checkbox', checked: selecionados.has(v), value: v,
            onchange: (ev) => {
              if (ev.target.checked) selecionados.add(v); else selecionados.delete(v);
              mudou();
            },
          }),
          el('span', {}, nomeDoValor(f, v)))));
    };
    desenharLista();
    botaoTodos.addEventListener('click', () => {
      selecionados.clear();
      for (const c of lista.querySelectorAll('input')) c.checked = false;
      mudou();
    });

    const painel = el('div', { class: 'filtro-painel', id: idPainel, hidden: true },
      valores.length > 8 ? el('input', {
        type: 'search', class: 'campo', placeholder: `Procurar ${f.rotulo.toLowerCase()}`,
        'aria-label': `Procurar ${f.rotulo}`, oninput: (ev) => desenharLista(ev.target.value),
      }) : null,
      lista,
      el('div', { class: 'filtro-acoes' }, botaoTodos));

    const raiz = el('div', { class: 'filtro', dataset: { filtro: f.id } }, botao, painel);
    botao.addEventListener('click', () => {
      const estavaAberto = abertoAtual?.raiz === raiz;
      fecharAberto();
      if (!estavaAberto) {
        painel.hidden = false;
        botao.setAttribute('aria-expanded', 'true');
        abertoAtual = { raiz, painel, botao };
        (painel.querySelector('input[type="search"]') ?? painel.querySelector('input'))?.focus();
      }
    });
    valorBotao.textContent = resumoSelecao(f, selecionados);
    botao.classList.toggle('ativo', selecionados.size > 0);
    botaoTodos.disabled = selecionados.size === 0;
    return raiz;
  });
  atualizarLimpar();

  return el('div', { class: 'barra-filtros', role: 'region', 'aria-label': 'Filtros' },
    el('span', { class: 'barra-filtros-titulo' }, 'Filtros'), itens, limpar);
}
