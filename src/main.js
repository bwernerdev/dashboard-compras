// Casca do app: topo (abas, período, ações), barra de filtros e a tela ativa.
// Estado: bases importadas (registros calculados + brutos para recalcular), filtros e configuração.

import { importarNoWorker } from './importacao.js';
import { criarConfig, CONFIG_PADRAO } from './config/index.js';
import { hojeSerie, formatarSerie } from './datas.js';
import { aplicarFiltros, opcoesDosFiltros, FILTROS, filtroValeNaTela } from './analise.js';
import {
  brutosDe, recalcular, salvarImportacao, lerImportacoes, lerConfig, salvarConfig, apagarConfig,
  lerPreferencia, salvarPreferencia,
} from './memoria.js';
import { el, substituir } from './ui/dom.js';
import { esconderDica } from './ui/dica.js';
import { barraDeFiltros } from './ui/filtros.js';
import { caixasDeImportacao } from './telas/importacao.js';
import { abrirConfiguracao } from './telas/configuracao.js';
import { telaRegional, reiniciarRegional } from './telas/regional.js';
import { telaCompradores } from './telas/compradores.js';
import { telaSaving } from './telas/saving.js';

const TELAS = [
  { id: 'regional', rotulo: 'Regional', desenhar: telaRegional },
  { id: 'compradores', rotulo: 'Compradores', desenhar: telaCompradores },
  { id: 'saving', rotulo: 'Saving', desenhar: telaSaving },
];

const configSalva = lerConfig();
const estado = {
  config: configSalva ?? CONFIG_PADRAO,
  personalizada: !!configSalva,
  cfg: criarConfig(configSalva ?? CONFIG_PADRAO),
  hoje: hojeSerie(),
  base: null, // { registros, brutos, meta, salvoEm }
  followUp: null,
  aba: TELAS.some((t) => t.id === lerPreferencia('aba')) ? lerPreferencia('aba') : 'regional',
  selecao: {},
  opcoes: null,
};

const raiz = {
  periodo: document.getElementById('periodo'),
  abas: document.getElementById('abas'),
  filtros: document.getElementById('filtros'),
  conteudo: document.getElementById('conteudo'),
  filtrosImpressao: document.getElementById('filtros-impressao'),
};

// ---------- Dados ----------

function definirBase(tipo, dados) {
  estado[tipo] = dados;
  if (tipo === 'base') {
    estado.opcoes = opcoesDosFiltros(dados.registros);
    // Mantém só seleções que ainda existem nas bases novas.
    for (const [id, valores] of Object.entries(estado.selecao)) {
      estado.selecao[id] = new Set([...valores].filter((v) => estado.opcoes[id]?.includes(v)));
    }
  }
}

async function importar(tipo, arquivo, aoAvancar) {
  const hoje = hojeSerie();
  const resultado = await importarNoWorker(tipo, arquivo, { hoje, config: estado.config, aoAvancar });
  const dados = { registros: resultado.registros, brutos: brutosDe(tipo, resultado.registros), meta: resultado.meta, salvoEm: Date.now() };
  estado.hoje = hoje;
  if (tipo === 'base') reiniciarRegional();
  definirBase(tipo, dados);
  salvarImportacao(tipo, resultado.registros, resultado.meta);
  desenharTudo();
  return dados;
}

/** Recalcula as bases guardadas (config nova ou outro dia). Retorna códigos de filial sem linhas. */
function recalcularTudo() {
  estado.hoje = hojeSerie();
  for (const tipo of ['base', 'followUp']) {
    const d = estado[tipo];
    if (d) definirBase(tipo, { ...d, registros: recalcular(tipo, d.brutos, estado.cfg, estado.hoje) });
  }
}

async function restaurar() {
  const salvas = await lerImportacoes();
  for (const tipo of ['base', 'followUp']) {
    const s = salvas[tipo];
    if (s?.brutos) definirBase(tipo, { brutos: s.brutos, meta: s.meta, salvoEm: s.salvoEm, registros: recalcular(tipo, s.brutos, estado.cfg, estado.hoje) });
  }
}

function aplicarConfig(config, personalizada) {
  const codigosAntes = estado.cfg.codigosFiliais;
  estado.config = config;
  estado.personalizada = personalizada;
  estado.cfg = criarConfig(config);
  recalcularTudo();
  desenharTudo();
  const novas = [...estado.cfg.codigosFiliais].filter((c) => !codigosAntes.has(c));
  return novas.length && estado.base
    ? `Filial nova no de-para (${novas.join(', ')}): importe a Base de novo para trazer as linhas dela.`
    : null;
}

// ---------- Desenho ----------

function desenharPeriodo() {
  const m = estado.base?.meta;
  if (!m) { raiz.periodo.hidden = true; return; }
  const g = m.dadosGerais;
  const partes = [g.inicio ? `${formatarSerie(g.inicio)} a ${formatarSerie(g.fim)}` : 'Período não informado'];
  if (g.execucao) partes.push(`ME de ${formatarSerie(g.execucao)}`);
  raiz.periodo.textContent = partes.join(' · ');
  raiz.periodo.title = m.hoje !== estado.hoje ? 'Dias em aberto e SLA recalculados para hoje.' : '';
  raiz.periodo.hidden = false;
}

function desenharAbas() {
  substituir(raiz.abas, TELAS.map((t) => el('button', {
    type: 'button', role: 'tab', id: `aba-${t.id}`, 'aria-selected': String(estado.aba === t.id),
    'aria-controls': 'conteudo', tabindex: estado.aba === t.id ? '0' : '-1', class: 'aba',
    onclick: () => trocarAba(t.id),
  }, t.rotulo)));
}

raiz.abas.addEventListener('keydown', (ev) => {
  const i = TELAS.findIndex((t) => t.id === estado.aba);
  let j = null;
  if (ev.key === 'ArrowRight') j = (i + 1) % TELAS.length;
  else if (ev.key === 'ArrowLeft') j = (i + TELAS.length - 1) % TELAS.length;
  else if (ev.key === 'Home') j = 0;
  else if (ev.key === 'End') j = TELAS.length - 1;
  if (j === null) return;
  ev.preventDefault();
  trocarAba(TELAS[j].id);
  document.getElementById(`aba-${TELAS[j].id}`)?.focus();
});

function trocarAba(id) {
  if (estado.aba === id) return;
  estado.aba = id;
  salvarPreferencia('aba', id);
  desenharTudo();
}

function desenharFiltros() {
  if (!estado.base) { substituir(raiz.filtros); raiz.filtros.hidden = true; return; }
  raiz.filtros.hidden = false;
  substituir(raiz.filtros, barraDeFiltros({
    tela: estado.aba,
    selecao: estado.selecao,
    opcoes: estado.opcoes,
    aoMudar: (id, valores) => { estado.selecao[id] = valores; agendarTela(); },
    aoLimpar: () => { estado.selecao = {}; desenharFiltros(); desenharTela(); },
  }));
}

/** Filtros ativos em texto (para impressão). */
function descreverFiltros() {
  const ativos = FILTROS.filter((f) => filtroValeNaTela(f, estado.aba) && estado.selecao[f.id]?.size);
  if (!ativos.length) return 'Filtros: nenhum (todas as filiais do de-para).';
  return `Filtros: ${ativos.map((f) => `${f.rotulo} = ${[...estado.selecao[f.id]].map((v) => (f.rotuloValor ? f.rotuloValor(v) : v)).join(', ')}`).join('; ')}.`;
}

let pedidoTela = 0;
function agendarTela() {
  // setTimeout (não requestAnimationFrame): continua funcionando com a aba em segundo plano.
  clearTimeout(pedidoTela);
  pedidoTela = setTimeout(desenharTela, 0);
}

function desenharTela() {
  esconderDica();
  raiz.conteudo.setAttribute('aria-labelledby', `aba-${estado.aba}`);
  if (!estado.base) {
    substituir(raiz.conteudo, el('div', { class: 'boas-vindas' },
      el('h2', {}, 'Importe as bases do ME'),
      el('p', { class: 'texto-fraco' },
        'Use o favorito do navegador para baixar as duas bases e escolha os arquivos abaixo. ',
        'Tudo é lido e calculado neste computador; nada é enviado.'),
      caixasDeImportacao({ estado, aoImportar: importar })));
    return;
  }
  const tela = TELAS.find((t) => t.id === estado.aba);
  const registros = aplicarFiltros(estado.base.registros, estado.selecao, estado.aba);
  raiz.filtrosImpressao.textContent = descreverFiltros();
  substituir(raiz.conteudo, tela.desenhar({
    registros,
    redesenhar: desenharTela,
    filtrar(idFiltro, valor) {
      const atual = estado.selecao[idFiltro];
      const jaEra = atual?.size === 1 && atual.has(valor);
      estado.selecao[idFiltro] = jaEra ? new Set() : new Set([valor]);
      desenharFiltros();
      desenharTela();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  }));
}

function desenharTudo() {
  desenharPeriodo();
  desenharAbas();
  desenharFiltros();
  desenharTela();
}

// ---------- Ações do topo ----------

function abrirImportacao() {
  const dialogo = el('dialog', { class: 'dialogo', 'aria-labelledby': 'titulo-importar' });
  const fechar = () => { dialogo.close(); dialogo.remove(); };
  dialogo.append(
    el('header', { class: 'dialogo-cabecalho' },
      el('h2', { id: 'titulo-importar' }, 'Atualizar bases'),
      el('button', { type: 'button', class: 'botao botao-link', onclick: fechar, 'aria-label': 'Fechar' }, '✕')),
    el('p', { class: 'texto-fraco' }, 'Escolha os arquivos novos baixados do ME. A base anterior é substituída.'),
    caixasDeImportacao({ estado, aoImportar: importar }),
    el('footer', { class: 'dialogo-rodape' }, el('span', { class: 'espaco' }), el('button', { type: 'button', class: 'botao', onclick: fechar }, 'Fechar')));
  dialogo.addEventListener('cancel', (ev) => { ev.preventDefault(); fechar(); });
  document.body.append(dialogo);
  dialogo.showModal();
}

document.getElementById('acao-importar').addEventListener('click', abrirImportacao);
document.getElementById('acao-imprimir').addEventListener('click', () => window.print());
document.getElementById('acao-config').addEventListener('click', () => abrirConfiguracao({
  config: estado.config,
  personalizada: estado.personalizada,
  aoSalvar(config) {
    salvarConfig(config);
    return aplicarConfig(config, true);
  },
  aoRestaurar() {
    apagarConfig();
    return aplicarConfig(CONFIG_PADRAO, false);
  },
}));

const botaoTema = document.getElementById('acao-tema');
function mostrarTema() {
  const escuro = document.documentElement.dataset.theme === 'dark';
  botaoTema.setAttribute('aria-pressed', String(escuro));
  botaoTema.textContent = escuro ? 'Tema claro' : 'Tema escuro';
}
botaoTema.addEventListener('click', () => {
  const novo = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = novo;
  salvarPreferencia('tema', novo);
  mostrarTema();
});
mostrarTema();

// Impressão sempre no tema claro (papel branco).
let temaAntesDeImprimir = null;
window.addEventListener('beforeprint', () => {
  temaAntesDeImprimir = document.documentElement.dataset.theme;
  document.documentElement.dataset.theme = 'light';
});
window.addEventListener('afterprint', () => {
  if (temaAntesDeImprimir) document.documentElement.dataset.theme = temaAntesDeImprimir;
  temaAntesDeImprimir = null;
});

// Virou o dia com a página aberta: recalcula dias em aberto e SLA.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && hojeSerie() !== estado.hoje && estado.base) {
    recalcularTudo();
    desenharTudo();
  }
});

desenharTudo();
restaurar().then(() => { if (estado.base) desenharTudo(); });
