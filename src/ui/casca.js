// Casca comum ao app da equipe (main.js) e ao painel publicado (painel/painel.js):
// abas, barra de filtros globais, tela ativa, tema e impressão.
// Não importa configuração nem regras de importação: entra no painel publicado.
import { el, substituir } from './dom.js';
import { esconderDica } from './dica.js';
import { barraDeFiltros } from './filtros.js';
import { aplicarFiltros, opcoesDosFiltros, FILTROS, filtroValeNaTela } from '../analise.js';
import { lerPreferencia, salvarPreferencia } from '../preferencias.js';

/** Filtros ativos em texto (linha que sai na impressão). */
export function descreverFiltros(selecao, tela) {
  const ativos = FILTROS.filter((f) => filtroValeNaTela(f, tela) && selecao[f.id]?.size);
  if (!ativos.length) return 'Filtros: nenhum (todas as filiais do painel).';
  return `Filtros: ${ativos.map((f) => `${f.rotulo} = ${[...selecao[f.id]].map((v) => (f.rotuloValor ? f.rotuloValor(v) : v)).join(', ')}`).join('; ')}.`;
}

/**
 * Controla abas, filtros e tela.
 * telas: [{ id, rotulo, desenhar(ctx) }]; raiz: { abas, filtros, conteudo, filtrosImpressao };
 * telaVazia(): conteúdo quando não há registros; aoTrocarAba(id) opcional.
 * chaveFiltros: preferência onde a seleção dos filtros globais fica salva neste navegador (volta na
 * próxima vez que abrir; pedido da equipe, 12/11/2026). Sem ela, os filtros começam vazios.
 * ctx de cada tela: { registros, followUp (null sem a base Follow-Up), redesenhar, filtrar }.
 * Os filtros globais valem para as duas bases; as opções vêm só da base principal.
 */
export function criarNavegador({ telas, raiz, abaInicial, telaVazia, aoTrocarAba, chaveFiltros }) {
  const estado = {
    aba: telas.some((t) => t.id === abaInicial) ? abaInicial : telas[0].id,
    selecao: chaveFiltros ? lerSelecao(chaveFiltros) : {},
    registros: null,
    followUp: null,
    opcoes: null,
  };
  let pedido = 0;

  // Altura da faixa de filtros (fixa no topo ao rolar): as tabelas descontam dela para caber na janela.
  // Mede ao desenhar os filtros, ao mudar a janela e quando a faixa muda de altura (quebra de linha).
  const medirTopo = () => document.documentElement.style.setProperty('--topo-fixo', `${raiz.filtros.offsetHeight}px`);
  window.addEventListener('resize', medirTopo);
  const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(medirTopo) : null;
  observador?.observe(raiz.filtros);

  function definirRegistros(registros) {
    estado.registros = registros;
    estado.opcoes = registros ? opcoesDosFiltros(registros) : null;
    // Mantém só as seleções que ainda existem nos dados novos.
    for (const [id, valores] of Object.entries(estado.selecao)) {
      estado.selecao[id] = new Set([...valores].filter((v) => estado.opcoes?.[id]?.includes(v)));
    }
  }

  /** Só filtros com algo marcado; Set vira lista. */
  function guardarSelecao() {
    if (!chaveFiltros) return;
    const ativos = Object.entries(estado.selecao).filter(([, v]) => v?.size).map(([id, v]) => [id, [...v]]);
    salvarPreferencia(chaveFiltros, JSON.stringify(Object.fromEntries(ativos)));
  }

  function definirFollowUp(registros) {
    estado.followUp = registros ?? null;
  }

  function trocarAba(id) {
    if (estado.aba === id) return;
    estado.aba = id;
    aoTrocarAba?.(id);
    desenhar();
  }

  function desenharAbas() {
    substituir(raiz.abas, telas.map((t) => el('button', {
      type: 'button', role: 'tab', id: `aba-${t.id}`, 'aria-selected': String(estado.aba === t.id),
      'aria-controls': raiz.conteudo.id, tabindex: estado.aba === t.id ? '0' : '-1', class: 'aba',
      onclick: () => trocarAba(t.id),
    }, t.rotulo)));
  }

  raiz.abas.addEventListener('keydown', (ev) => {
    const i = telas.findIndex((t) => t.id === estado.aba);
    let j = null;
    if (ev.key === 'ArrowRight') j = (i + 1) % telas.length;
    else if (ev.key === 'ArrowLeft') j = (i + telas.length - 1) % telas.length;
    else if (ev.key === 'Home') j = 0;
    else if (ev.key === 'End') j = telas.length - 1;
    if (j === null) return;
    ev.preventDefault();
    trocarAba(telas[j].id);
    document.getElementById(`aba-${telas[j].id}`)?.focus();
  });

  function desenharFiltros() {
    if (!estado.registros) { substituir(raiz.filtros); raiz.filtros.hidden = true; medirTopo(); return; }
    raiz.filtros.hidden = false;
    queueMicrotask(medirTopo);
    substituir(raiz.filtros, barraDeFiltros({
      tela: estado.aba,
      selecao: estado.selecao,
      opcoes: estado.opcoes,
      aoMudar: (id, valores) => { estado.selecao[id] = valores; guardarSelecao(); agendarTela(); },
      aoLimpar: () => { estado.selecao = {}; guardarSelecao(); desenharFiltros(); desenharTela(); },
    }));
  }

  // setTimeout (não requestAnimationFrame): continua funcionando com a aba em segundo plano.
  function agendarTela() {
    clearTimeout(pedido);
    pedido = setTimeout(desenharTela, 0);
  }

  function desenharTela() {
    esconderDica();
    raiz.conteudo.setAttribute('aria-labelledby', `aba-${estado.aba}`);
    if (!estado.registros) { substituir(raiz.conteudo, telaVazia()); return; }
    const tela = telas.find((t) => t.id === estado.aba);
    if (raiz.filtrosImpressao) raiz.filtrosImpressao.textContent = descreverFiltros(estado.selecao, estado.aba);
    substituir(raiz.conteudo, tela.desenhar({
      registros: aplicarFiltros(estado.registros, estado.selecao, estado.aba),
      followUp: estado.followUp ? aplicarFiltros(estado.followUp, estado.selecao, estado.aba) : null,
      redesenhar: desenharTela,
      filtrar(idFiltro, valor) {
        const atual = estado.selecao[idFiltro];
        const jaEra = atual?.size === 1 && atual.has(valor);
        estado.selecao[idFiltro] = jaEra ? new Set() : new Set([valor]);
        guardarSelecao();
        desenharFiltros();
        desenharTela();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    }));
  }

  function desenhar() {
    desenharAbas();
    desenharFiltros();
    desenharTela();
  }

  return { estado, definirRegistros, definirFollowUp, desenhar, desenharTela, observador };
}

/** Botão de tema claro/escuro (html[data-theme]); a escolha fica no navegador quando dá. */
export function ligarTema(botao) {
  const mostrar = () => {
    const escuro = document.documentElement.dataset.theme === 'dark';
    botao.setAttribute('aria-pressed', String(escuro));
    botao.textContent = escuro ? 'Tema claro' : 'Tema escuro';
  };
  botao.addEventListener('click', () => {
    const novo = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = novo;
    salvarPreferencia('tema', novo);
    mostrar();
  });
  mostrar();
}

/** Botão Imprimir: imprime sempre no tema claro (papel branco). */
export function ligarImpressao(botao) {
  botao.addEventListener('click', () => window.print());
  let temaAntes = null;
  window.addEventListener('beforeprint', () => {
    temaAntes = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = 'light';
  });
  window.addEventListener('afterprint', () => {
    if (temaAntes) document.documentElement.dataset.theme = temaAntes;
    temaAntes = null;
  });
}

/** Seleção salva ({ idFiltro: [valores] }) -> { idFiltro: Set }; só filtros conhecidos. Estragada = nenhuma. */
function lerSelecao(chave) {
  try {
    const salvo = JSON.parse(lerPreferencia(chave, '{}')) ?? {};
    return Object.fromEntries(FILTROS.filter((f) => Array.isArray(salvo[f.id]) && salvo[f.id].length)
      .map((f) => [f.id, new Set(salvo[f.id])]));
  } catch { return {}; }
}
