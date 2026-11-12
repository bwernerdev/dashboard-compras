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
    abertoAtual.aoFechar?.();
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

/**
 * Botão + lista de marcar (seleção múltipla). Usado na barra de filtros e nos recortes das telas.
 * id: data-filtro; rotulo; valores: [valor]; rotuloValor?(v) -> texto da opção; resumoValor?(v) ->
 * texto no botão com 1 marcado (padrão: rotuloValor); selecionados: Set (alterado no lugar; vazio =
 * todos); aoMudar(novoSet) a cada marcação. Marcar não fecha a lista; Esc/clique fora fecha.
 *
 * Como o filtro do Excel (pedido da equipe, 12/11/2026): sem filtro, "Todos" e todas as opções
 * aparecem marcados. Desmarcar uma opção tira só ela; desmarcar "Todos" desmarca tudo para marcar
 * só as que interessam (enquanto nada estiver marcado, o filtro não muda); marcar "Todos" volta a
 * todas. Marcar todas uma a uma também vira "Todos".
 */
export function listaDeMarcar({ id, rotulo, valores, rotuloValor = (v) => v, resumoValor = rotuloValor, selecionados, aoMudar }) {
  const idPainel = novoId('filtro');
  const valorBotao = el('span', { class: 'filtro-valor' });
  const botao = el('button', {
    type: 'button', class: 'filtro-botao', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': idPainel,
  }, el('span', { class: 'filtro-nome' }, rotulo), valorBotao);

  // nenhum: "Todos" desmarcado e nada marcado ainda (só na lista; o filtro continua como estava).
  let nenhum = false;
  let termo = '';
  const todos = () => !nenhum && selecionados.size === 0;
  const marcado = (v) => !nenhum && (selecionados.size === 0 || selecionados.has(v));

  const resumo = () => {
    if (nenhum) return 'Marque uma opção';
    if (!selecionados.size) return 'Todos';
    if (selecionados.size === 1) return resumoValor([...selecionados][0]);
    return `${selecionados.size} selecionados`;
  };
  const mostrar = () => {
    valorBotao.textContent = resumo();
    botao.classList.toggle('ativo', selecionados.size > 0 || nenhum);
  };
  const lista = el('div', { class: 'filtro-lista', role: 'group', 'aria-label': rotulo });

  function desenharLista() {
    const t = termo.toLowerCase();
    // Redesenhar troca as caixas: devolve o foco à mesma opção (uso pelo teclado).
    const foco = lista.contains(document.activeElement) ? document.activeElement.value : null;
    substituir(lista,
      el('label', { class: 'filtro-opcao filtro-todos' },
        el('input', { type: 'checkbox', checked: todos(), value: '(todos)', onchange: alternarTodos }),
        el('span', {}, 'Todos')),
      valores
        .filter((v) => !t || String(rotuloValor(v)).toLowerCase().includes(t))
        .map((v) => el('label', { class: 'filtro-opcao' },
          el('input', { type: 'checkbox', checked: marcado(v), value: v, onchange: () => alternar(v) }),
          el('span', {}, rotuloValor(v)))));
    if (foco !== null) [...lista.querySelectorAll('input')].find((i) => i.value === foco)?.focus();
  }

  /** Só a lista e o botão (o filtro não muda). */
  const redesenhar = () => { mostrar(); desenharLista(); };
  const mudou = () => { redesenhar(); aoMudar(new Set(selecionados)); };

  function alternarTodos() {
    if (todos()) { nenhum = true; redesenhar(); return; }
    nenhum = false;
    selecionados.clear();
    mudou();
  }

  function alternar(v) {
    if (nenhum) {
      nenhum = false;
      selecionados.clear();
      selecionados.add(v);
    } else if (selecionados.size === 0) {
      for (const x of valores) if (x !== v) selecionados.add(x); // todos menos o desmarcado
      if (!selecionados.size) { nenhum = true; redesenhar(); return; }
    } else if (selecionados.has(v)) {
      selecionados.delete(v);
      // Desmarcou a última: lista vazia esperando uma marcação; o filtro volta a Todos.
      if (!selecionados.size) { nenhum = true; redesenhar(); aoMudar(new Set()); return; }
    } else {
      selecionados.add(v);
      if (valores.every((x) => selecionados.has(x))) selecionados.clear(); // marcou todas = Todos
    }
    mudou();
  }

  desenharLista();

  const painel = el('div', { class: 'filtro-painel', id: idPainel, hidden: true },
    valores.length > 8 ? el('input', {
      type: 'search', class: 'campo', placeholder: `Procurar ${rotulo.toLowerCase()}`,
      'aria-label': `Procurar ${rotulo}`, oninput: (ev) => { termo = ev.target.value; desenharLista(); },
    }) : null,
    lista);

  // Fechou sem marcar nada: volta a mostrar o filtro que vale (Todos).
  const aoFechar = () => { if (nenhum) { nenhum = false; redesenhar(); } };

  const raiz = el('div', { class: 'filtro', dataset: { filtro: id } }, botao, painel);
  botao.addEventListener('click', () => {
    const estavaAberto = abertoAtual?.raiz === raiz;
    fecharAberto();
    if (!estavaAberto) {
      painel.hidden = false;
      botao.setAttribute('aria-expanded', 'true');
      abertoAtual = { raiz, painel, botao, aoFechar };
      (painel.querySelector('input[type="search"]') ?? painel.querySelector('input'))?.focus();
    }
  });
  mostrar();
  return raiz;
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

  const itens = visiveis.map((f) => listaDeMarcar({
    id: f.id,
    rotulo: f.rotulo,
    valores: opcoes[f.id] ?? [],
    rotuloValor: f.rotuloValor,
    selecionados: atual[f.id],
    aoMudar: (novo) => { atualizarLimpar(); aoMudar(f.id, novo); },
  }));
  atualizarLimpar();

  return el('div', { class: 'barra-filtros', role: 'region', 'aria-label': 'Filtros' },
    el('span', { class: 'barra-filtros-titulo' }, 'Filtros'), itens, limpar);
}
