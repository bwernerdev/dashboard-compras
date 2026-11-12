// App da equipe: topo (abas, período, ações), barra de filtros e a tela ativa.
// Estado: bases importadas (registros calculados + brutos para recalcular) e configuração.
// Abas, filtros, tema e impressão vêm da casca comum (ui/casca.js), a mesma do painel publicado.

import { importarNoWorker } from './importacao.js';
import { criarConfig, CONFIG_PADRAO } from './config/index.js';
import { hojeSerie, formatarSerie } from './datas.js';
import { brutosDe, recalcular, salvarImportacao, lerImportacoes, lerConfig, salvarConfig, apagarConfig } from './memoria.js';
import { lerPreferencia, salvarPreferencia } from './preferencias.js';
import { el } from './ui/dom.js';
import { criarNavegador, ligarTema, ligarImpressao } from './ui/casca.js';
import { aplicarMarca } from './ui/marca.js';
import { baixar } from './ui/tabela.js';
import { caixasDeImportacao } from './telas/importacao.js';
import { abrirConfiguracao } from './telas/configuracao.js';
import { TELAS_PUBLICAS, reiniciarTelas } from './telas/publicas.js';
import { ligarAtendidas } from './telas/regional.js';
import { telaCompradores } from './telas/compradores.js';
import { gerarPainel, NOME_DO_ARQUIVO } from './painel/gerar.js';

ligarAtendidas(); // olho "atendida" na lista de SCs: só no app da equipe, não no painel publicado

// Ordem das abas da planilha antiga; Compradores (interna, não vai para o painel) depois da Regional.
const TELAS = TELAS_PUBLICAS.flatMap((t) => (t.id === 'regional'
  ? [t, { id: 'compradores', rotulo: 'Compradores', desenhar: telaCompradores }]
  : [t]));

const configSalva = lerConfig();
const estado = {
  config: configSalva ?? CONFIG_PADRAO,
  personalizada: !!configSalva,
  cfg: criarConfig(configSalva ?? CONFIG_PADRAO),
  hoje: hojeSerie(),
  base: null, // { registros, brutos, meta, salvoEm }
  followUp: null,
};

const raiz = {
  periodo: document.getElementById('periodo'),
  abas: document.getElementById('abas'),
  filtros: document.getElementById('filtros'),
  conteudo: document.getElementById('conteudo'),
  filtrosImpressao: document.getElementById('filtros-impressao'),
};

const nav = criarNavegador({
  telas: TELAS,
  raiz,
  abaInicial: lerPreferencia('aba') ?? 'regional',
  aoTrocarAba: (id) => salvarPreferencia('aba', id),
  telaVazia: () => el('div', { class: 'boas-vindas' },
    el('h2', {}, 'Importe as bases do ME'),
    el('p', { class: 'texto-fraco' },
      'Use o favorito do navegador para baixar as duas bases e escolha os arquivos abaixo. ',
      'Tudo é lido e calculado neste computador; nada é enviado.'),
    caixasDeImportacao({ estado, aoImportar: importar })),
});

// ---------- Dados ----------

function definirBase(tipo, dados) {
  estado[tipo] = dados;
  if (tipo === 'base') nav.definirRegistros(dados.registros);
  else nav.definirFollowUp(dados.registros);
}

async function importar(tipo, arquivo, aoAvancar) {
  const hoje = hojeSerie();
  const resultado = await importarNoWorker(tipo, arquivo, { hoje, config: estado.config, aoAvancar });
  const dados = { registros: resultado.registros, brutos: brutosDe(tipo, resultado.registros), meta: resultado.meta, salvoEm: Date.now() };
  estado.hoje = hoje;
  if (tipo === 'base' || tipo === 'followUp') reiniciarTelas();
  definirBase(tipo, dados);
  salvarImportacao(tipo, resultado.registros, resultado.meta);
  desenharTudo();
  return dados;
}

/** Recalcula as bases guardadas (config nova ou outro dia). */
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

function desenharTudo() {
  desenharPeriodo();
  botaoPainel.disabled = !estado.base;
  nav.desenhar();
}

// ---------- Ações do topo ----------

function abrirDialogo({ id, titulo, corpo }) {
  const dialogo = el('dialog', { class: 'dialogo', 'aria-labelledby': id });
  const fechar = () => { dialogo.close(); dialogo.remove(); };
  dialogo.append(
    el('header', { class: 'dialogo-cabecalho' },
      el('h2', { id }, titulo),
      el('button', { type: 'button', class: 'botao botao-link', onclick: fechar, 'aria-label': 'Fechar' }, '✕')),
    ...corpo,
    el('footer', { class: 'dialogo-rodape' }, el('span', { class: 'espaco' }), el('button', { type: 'button', class: 'botao', onclick: fechar }, 'Fechar')));
  dialogo.addEventListener('cancel', (ev) => { ev.preventDefault(); fechar(); });
  document.body.append(dialogo);
  dialogo.showModal();
}

function abrirImportacao() {
  abrirDialogo({
    id: 'titulo-importar',
    titulo: 'Atualizar bases',
    corpo: [
      el('p', { class: 'texto-fraco' }, 'Escolha os arquivos novos baixados do ME. A base anterior é substituída.'),
      caixasDeImportacao({ estado, aoImportar: importar }),
    ],
  });
}

const tamanho = (bytes) => (bytes >= 1048576
  ? `${(bytes / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
  : `${Math.ceil(bytes / 1024).toLocaleString('pt-BR')} KB`);

async function gerarEBaixarPainel() {
  if (!estado.base) return;
  botaoPainel.disabled = true;
  const textoAntes = botaoPainel.textContent;
  botaoPainel.textContent = 'Gerando...';
  try {
    const html = await gerarPainel({
      registros: estado.base.registros, followUp: estado.followUp?.registros ?? null, meta: estado.base.meta, hoje: estado.hoje,
    });
    baixar(NOME_DO_ARQUIVO, html, 'text/html;charset=utf-8');
    abrirDialogo({
      id: 'titulo-painel',
      titulo: 'Painel gerado',
      corpo: [
        el('p', {}, `Baixado: ${NOME_DO_ARQUIVO} (${tamanho(new Blob([html]).size)}), com as telas ${TELAS_PUBLICAS.map((t) => t.rotulo).join(', ')} e os dados de hoje.`),
        estado.followUp ? null : el('p', { class: 'texto-fraco' }, 'Sem a base Follow-Up: a tela Entrega do painel fica vazia. Importe o Follow-Up e gere de novo.'),
        el('ol', { class: 'lista-passos' },
          el('li', {}, 'Abra a pasta do painel no OneDrive/SharePoint.'),
          el('li', {}, `Envie o arquivo e escolha "Substituir" (mesmo nome, ${NOME_DO_ARQUIVO}).`),
          el('li', {}, 'O link da Intranet continua o mesmo; quem abrir vê os números novos.')),
        el('p', { class: 'texto-fraco' }, 'O painel não leva a tela Compradores, a configuração nem pré-pedidos.'),
      ],
    });
  } catch (erro) {
    abrirDialogo({ id: 'titulo-painel', titulo: 'Não foi possível gerar o painel', corpo: [el('p', {}, erro.message)] });
  } finally {
    botaoPainel.textContent = textoAntes;
    botaoPainel.disabled = !estado.base;
  }
}

const botaoPainel = document.getElementById('acao-painel');
botaoPainel.addEventListener('click', gerarEBaixarPainel);
document.getElementById('acao-importar').addEventListener('click', abrirImportacao);
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
ligarImpressao(document.getElementById('acao-imprimir'));
aplicarMarca();
ligarTema(document.getElementById('acao-tema'));

// Virou o dia com a página aberta: recalcula dias em aberto e SLA.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && hojeSerie() !== estado.hoje && estado.base) {
    recalcularTudo();
    desenharTudo();
  }
});

desenharTudo();
restaurar().then(() => { if (estado.base) desenharTudo(); });
