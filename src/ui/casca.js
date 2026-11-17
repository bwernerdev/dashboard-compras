// Casca comum ao app da equipe (main.js) e ao painel publicado (painel/painel.js):
// abas, barra de filtros globais, tela ativa, tema e impressão.
// Não importa configuração nem regras de importação: entra no painel publicado.
import { el, substituir, icone } from './dom.js';
import { esconderDica } from './dica.js';
import { esqueleto } from './cartoes.js';
import { barraDeFiltros } from './filtros.js';
import { aplicarFiltros, opcoesDosFiltros, FILTROS, filtroValeNaTela } from '../analise.js';
import { salvarPreferencia, lerJson, salvarJson } from '../preferencias.js';
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
 * limparFiltros (null sem filtro ativo; botão dos estados vazios), historico (pontos anteriores, null com filtro),
 * periodo ({ inicio, fim } do relatório do ME, séries do Excel, ou null) }.
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
    periodo: null,
    opcoes: null,
  };
  let pedido = 0;
  let entrar = false; // troca de aba: a tela nova entra com fade curto (classe `entrando`)
  // Tempo do último desenho de cada tela (ms). Tela que demorou (Status com a base cheia: ~400 ms)
  // mostra o esqueleto antes de desenhar, para a aba responder no clique; nos filtros, a tela atual
  // fica apagada enquanto redesenha. Antes do 1º desenho, base grande conta como pesada.
  const custo = new Map();
  const TELA_PESADA_MS = 80;
  const pesada = (id) => (custo.get(id) ?? ((estado.registros?.length ?? 0) > 3000 ? TELA_PESADA_MS : 0)) >= TELA_PESADA_MS;
  /**
   * Depois que o navegador pintar (esqueleto, aba marcada). O requestAnimationFrame não dispara com a
   * janela em segundo plano: a reserva de 50 ms garante o desenho. Só o último pedido vale.
   */
  let rodada = 0;
  const depoisDePintar = (fn) => {
    clearTimeout(pedido);
    const vez = ++rodada;
    const ir = () => {
      if (vez !== rodada) return;
      rodada++; // a outra via (quadro ou reserva) não desenha de novo
      pedido = setTimeout(fn, 0);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(ir);
    setTimeout(ir, 50);
  };

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
    salvarJson(chaveFiltros, Object.fromEntries(ativos));
  }

  function definirFollowUp(registros) {
    estado.followUp = registros ?? null;
  }

  /** historico: pontos de bases de dias anteriores ({ dia, status, aberto }), sem filtros. */
  function definirHistorico(pontos) {
    estado.historico = pontos?.length ? pontos : null;
  }

  /** periodo: { inicio, fim } do relatório do ME (séries do Excel) ou null. */
  function definirPeriodo(periodo) {
    estado.periodo = periodo?.inicio && periodo?.fim ? { inicio: periodo.inicio, fim: periodo.fim } : null;
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
    if (estado.registros && pesada(id)) {
      desenharAbas();
      desenharFiltros();
      substituir(raiz.conteudo, esqueleto('Montando a tela...'));
      depoisDePintar(desenharTela);
      return;
    }
    rodada++; // desenho pendente de uma tela pesada não vale mais
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
    if (estado.registros && pesada(estado.aba)) {
      raiz.conteudo.firstElementChild?.classList.add('atualizando');
      raiz.conteudo.setAttribute('aria-busy', 'true');
      depoisDePintar(desenharTela);
      return;
    }
    rodada++;
    pedido = setTimeout(desenharTela, 0);
  }

  function desenharTela() {
    esconderDica();
    raiz.conteudo.setAttribute('aria-labelledby', `aba-${estado.aba}`);
    if (!estado.registros) { substituir(raiz.conteudo, telaVazia()); return; }
    const tela = telas.find((t) => t.id === estado.aba);
    const inicio = performance.now();
    if (raiz.filtrosImpressao) raiz.filtrosImpressao.textContent = descreverFiltros(estado.selecao, estado.aba);
    substituir(raiz.conteudo, tela.desenhar({
      registros: aplicarFiltros(estado.registros, estado.selecao, estado.aba),
      followUp: estado.followUp ? aplicarFiltros(estado.followUp, estado.selecao, estado.aba) : null,
      anteriores: estado.anteriores
        ? { registros: aplicarFiltros(estado.anteriores.registros, estado.selecao, estado.aba), rotulo: estado.anteriores.rotulo }
        : null,
      periodo: estado.periodo,
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
    custo.set(tela.id, performance.now() - inicio);
    raiz.conteudo.removeAttribute('aria-busy');
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

  return { estado, definirRegistros, definirFollowUp, definirAnteriores, definirHistorico, definirPeriodo, desenhar, desenharTela, observador };
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

/**
 * Botão de tema claro/escuro (html[data-theme]); a escolha fica no navegador quando dá.
 * Só ícone (pedido da equipe, 17/11/2026): lua no tema claro, sol no escuro; o nome fica no
 * aria-label e no title ("Tema escuro"/"Tema claro").
 */
export function ligarTema(botao) {
  const mostrar = () => {
    const escuro = document.documentElement.dataset.theme === 'dark';
    const nome = escuro ? 'Tema claro' : 'Tema escuro';
    botao.setAttribute('aria-pressed', String(escuro));
    botao.setAttribute('aria-label', nome);
    botao.title = nome;
    substituir(botao, icone(escuro ? 'sol' : 'lua', 16));
  };
  botao.addEventListener('click', () => {
    const novo = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = novo;
    salvarPreferencia('tema', novo);
    mostrar();
  });
  mostrar();
}

/**
 * Botão Imprimir: imprime sempre no tema claro (papel branco). Com a classe `botao-icone` (painel
 * publicado) vira só o ícone da impressora; no app fica com texto, dentro do menu Exportar.
 */
export function ligarImpressao(botao) {
  if (botao.classList.contains('botao-icone')) substituir(botao, icone('impressora', 16));
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
  const salvo = lerJson(chave, {});
  return Object.fromEntries(FILTROS.filter((f) => Array.isArray(salvo[f.id]) && salvo[f.id].length)
    .map((f) => [f.id, new Set(salvo[f.id])]));
}
