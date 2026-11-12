// Casca comum ao app da equipe (main.js) e ao painel publicado (painel/painel.js):
// abas, barra de filtros globais, tela ativa, tema e impressão.
// Não importa configuração nem regras de importação: entra no painel publicado.
import { el, substituir } from './dom.js';
import { esconderDica } from './dica.js';
import { barraDeFiltros } from './filtros.js';
import { aplicarFiltros, opcoesDosFiltros, FILTROS, filtroValeNaTela } from '../analise.js';
import { lerPreferencia, salvarPreferencia } from '../preferencias.js';
import { diasUteis } from '../datas.js';

/**
 * Dias úteis entre a execução do relatório no ME e hoje, sem contar o dia da execução
 * (0 = hoje, 1 = ontem). Base com 2 ou mais fica marcada no topo (pedido da equipe, 12/11/2026).
 */
export function diasDesdeABase(execucao, hoje) {
  if (!execucao || !hoje) return 0;
  return Math.max(0, diasUteis(execucao, hoje) - 1);
}
export const BASE_ANTIGA_DIAS = 2;

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
 * ctx de cada tela: { registros, followUp (null sem a base Follow-Up), anteriores, redesenhar, filtrar,
 * limparFiltros (null sem filtro ativo; botão dos estados vazios), historico (pontos anteriores, null com filtro) }.
 * anteriores: { registros (base anterior, mesmos filtros), rotulo ('10/11') } ou null; só o app da
 * equipe guarda a base anterior (variação nos cartões), o painel não.
 * Os filtros globais valem para as duas bases; as opções vêm só da base principal.
 */
export function criarNavegador({ telas, raiz, abaInicial, telaVazia, aoTrocarAba, chaveFiltros }) {
  const estado = {
    aba: telas.some((t) => t.id === abaInicial) ? abaInicial : telas[0].id,
    selecao: chaveFiltros ? lerSelecao(chaveFiltros) : {},
    registros: null,
    followUp: null,
    anteriores: null,
    historico: null,
    opcoes: null,
  };
  let pedido = 0;
  let entrar = false; // troca de aba: a tela nova entra com fade curto (classe `entrando`)

  // Altura da faixa de filtros (fixa no topo ao rolar): as tabelas descontam dela para caber na janela.
  // Mede ao desenhar os filtros, ao mudar a janela e quando a faixa muda de altura (quebra de linha).
  // O topo também fica fixo (compacto ao rolar, ligarTopoCompacto): a faixa de filtros para logo abaixo
  // dele (--altura-topo) e as tabelas descontam o topo compacto (~48 px) mais a faixa.
  const topo = document.querySelector('.topo');
  const medirTopo = () => {
    const raizDoc = document.documentElement;
    const alturaTopo = topo?.offsetHeight ?? 0;
    raizDoc.style.setProperty('--altura-topo', `${alturaTopo}px`);
    const topoCompacto = raizDoc.classList.contains('topo-compacto') ? alturaTopo : 48;
    raizDoc.style.setProperty('--topo-fixo', `${raiz.filtros.offsetHeight + topoCompacto}px`);
  };
  window.addEventListener('resize', medirTopo);
  const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(medirTopo) : null;
  observador?.observe(raiz.filtros);
  if (topo) observador?.observe(topo);

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

  /** historico: pontos de bases de dias anteriores ({ dia, status, aberto }), sem filtros. */
  function definirHistorico(pontos) {
    estado.historico = pontos?.length ? pontos : null;
  }

  /** anteriores: { registros, rotulo } ou null. */
  function definirAnteriores(anteriores) {
    estado.anteriores = anteriores ?? null;
  }

  function trocarAba(id) {
    if (estado.aba === id) return;
    estado.aba = id;
    aoTrocarAba?.(id);
    entrar = true;
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
      aoLimpar: limparFiltros,
    }));
  }

  function limparFiltros() {
    estado.selecao = {};
    guardarSelecao();
    desenharFiltros();
    desenharTela();
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
      anteriores: estado.anteriores
        ? { registros: aplicarFiltros(estado.anteriores.registros, estado.selecao, estado.aba), rotulo: estado.anteriores.rotulo }
        : null,
      redesenhar: desenharTela,
      /** Registros com todos os filtros menos um (ex.: comparação de períodos ignora "Mês do pedido"). */
      registrosSem: (idFiltro) => aplicarFiltros(estado.registros, { ...estado.selecao, [idFiltro]: new Set() }, estado.aba),
      limparFiltros: Object.values(estado.selecao).some((v) => v?.size) ? limparFiltros : null,
      // Mini gráficos: o histórico guarda só os totais; com filtro que vale nesta tela, não aparece.
      historico: FILTROS.some((f) => filtroValeNaTela(f, estado.aba) && estado.selecao[f.id]?.size) ? null : estado.historico,
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
    if (entrar) {
      entrar = false;
      raiz.conteudo.firstElementChild?.classList.add('entrando');
    }
  }

  function desenhar() {
    desenharAbas();
    desenharFiltros();
    desenharTela();
  }

  return { estado, definirRegistros, definirFollowUp, definirAnteriores, definirHistorico, desenhar, desenharTela, observador };
}

/**
 * Topo compacto ao rolar (pedido da equipe, 12/11/2026): passou de 140 px, o topo vira uma faixa fina
 * (emblema pequeno, título, abas); volta inteiro perto do começo (< 40 px). Ao encolher, a rolagem
 * desconta a altura que sumiu, para a página não pular.
 */
export function ligarTopoCompacto() {
  const topo = document.querySelector('.topo');
  if (!topo) return;
  const raizDoc = document.documentElement;
  let pendente = false;
  const avaliar = () => {
    pendente = false;
    const compacto = raizDoc.classList.contains('topo-compacto');
    if (!compacto && window.scrollY > 140) {
      const antes = topo.offsetHeight;
      raizDoc.classList.add('topo-compacto');
      window.scrollBy(0, topo.offsetHeight - antes);
    } else if (compacto && window.scrollY < 40) {
      raizDoc.classList.remove('topo-compacto');
    }
  };
  window.addEventListener('scroll', () => {
    if (pendente) return;
    pendente = true;
    setTimeout(avaliar, 0);
  }, { passive: true });
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
