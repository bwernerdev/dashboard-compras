// App da equipe: topo (abas, período, ações), barra de filtros e a tela ativa.
// Estado: bases importadas (registros calculados + brutos para recalcular), anexo de contratos e configuração.
// Abas, filtros, tema e impressão vêm da casca comum (ui/casca.js), a mesma do painel publicado.

import { importarNoWorker } from './importacao.js';
import { criarConfig, CONFIG_PADRAO, atualizarConfigSalva } from './config/index.js';
import { hojeSerie, formatarSerie } from './datas.js';
import {
  brutosDe, recalcular, salvarImportacao, salvarAnterior, salvarHistorico, juntarAoHistorico, lerImportacoes, lerConfig, salvarConfig, apagarConfig,
  salvarContratos, salvarCopia, apagarCopia, copiaValida,
} from './memoria.js';
import { copiarParaMemoria } from './leitor/arquivo.js';
import { lerContratos } from './contratos/ler.js';
import { filialAjustadaDoContrato } from './contratos/dados.js';
import { abrirContratos } from './telas/contratos.js';
import { resumoStatus, resumoEmAberto, itensEmAberto } from './analise.js';
import { lerPreferencia, salvarPreferencia } from './preferencias.js';
import { el } from './ui/dom.js';
import { ligarMenu } from './ui/menu.js';
import { esqueleto } from './ui/cartoes.js';
import { criarNavegador, ligarTema, ligarImpressao, ligarTopoCompacto, diasDesdeABase, BASE_ANTIGA_DIAS } from './ui/casca.js';
import { aplicarMarca } from './ui/marca.js';
import { baixar } from './ui/tabela-exportar.js';
import { caixasDeImportacao } from './telas/importacao.js';
import { abrirConfiguracao } from './telas/configuracao.js';
import { TELAS_PUBLICAS, reiniciarTelas } from './telas/publicas.js';
import { ligarAtendidas } from './telas/regional.js';
import { telaCompradores, filtrosCompradores } from './telas/compradores.js';
import { gerarPainel, NOME_DO_ARQUIVO } from './painel/gerar.js';

ligarAtendidas(); // olho "atendida" na lista de SCs: só no app da equipe, não no painel publicado

// Ordem das abas da planilha antiga; SCs por Comprador (interna) depois da Regional. As internas
// não vão para o painel. A aba Hoje saiu em 12/11/2026 (pedido da equipe).
const TELAS = [...TELAS_PUBLICAS.flatMap((t) => (t.id === 'regional'
  ? [t, { id: 'compradores', rotulo: 'SCs por Comprador', desenhar: telaCompradores, filtrosExtras: filtrosCompradores }]
  : [t]))];

const configSalva = atualizarConfigSalva(lerConfig());
const estado = {
  config: configSalva ?? CONFIG_PADRAO,
  personalizada: !!configSalva,
  cfg: criarConfig(configSalva ?? CONFIG_PADRAO),
  hoje: hojeSerie(),
  base: null, // { registros, brutos, meta, salvoEm }
  followUp: null,
  anterior: null, // base de outro dia do ME { brutos, meta, salvoEm }: variação nos cartões
  historico: [], // [{ dia, status, aberto }]: mini gráficos dos cartões (ver memoria.js)
  contratos: null, // anexo opcional (CONTROLE DE CONTRATOS): { abas, meta, salvoEm }, janela Contratos
  copias: {}, // { arquivo, salvoEm }: cópia do último arquivo de Base e Follow-Up (memoria.js, vale 8 h): "Reimportar bases" lê de novo
  carregando: true, // lendo as bases salvas ao abrir: esqueleto no lugar da tela de importação
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
  // Aba salva que não existe mais (ex.: Hoje) volta para a Regional.
  abaInicial: TELAS.some((t) => t.id === lerPreferencia('aba')) ? lerPreferencia('aba') : 'regional',
  aoTrocarAba: (id) => salvarPreferencia('aba', id),
  chaveFiltros: 'filtros',
  telaVazia: () => (estado.carregando ? esqueleto('Abrindo as bases salvas...') : el('div', { class: 'boas-vindas' },
    el('h2', {}, 'Importe as bases do ME'),
    el('p', { class: 'texto-fraco' },
      'Use o favorito do navegador para baixar as duas bases e escolha os arquivos abaixo. ',
      'Tudo é lido e calculado neste computador; nada é enviado.'),
    caixasDeImportacao({ estado, aoImportar: importar }))),
});

// ---------- Dados ----------

function definirBase(tipo, dados) {
  estado[tipo] = dados;
  if (tipo === 'base') {
    nav.definirRegistros(dados.registros);
    nav.definirPeriodo(dados.meta?.dadosGerais);
  }
  else nav.definirFollowUp(dados.registros);
}

// ---------- Base anterior (variação nos cartões) ----------

/** Dia do ME da base: a anterior só troca quando chega base de outro dia (reimportar no mesmo dia mantém). */
const diaDaBase = (meta) => Math.floor(meta?.dadosGerais?.execucao ?? meta?.hoje ?? 0);

/** Recalcula a base anterior com o "hoje" dela: os cartões comparam com o que se via naquele dia. */
function definirAnterior() {
  const a = estado.anterior;
  nav.definirAnteriores(a ? {
    registros: recalcular('base', a.brutos, estado.cfg, a.meta?.hoje ?? diaDaBase(a.meta)),
    rotulo: formatarSerie(diaDaBase(a.meta)).slice(0, 5),
  } : null);
}

// ---------- Histórico (mini gráficos) ----------

/** Resumos da base inteira (sem filtros) do dia do ME: o que os mini gráficos mostram. */
const pontoDe = (meta, registros) => ({ dia: diaDaBase(meta), status: resumoStatus(registros), aberto: resumoEmAberto(itensEmAberto(registros)) });

/** As telas recebem só os dias antes da base atual; o valor atual vem da própria tela. */
function definirHistorico() {
  const hoje = estado.base ? diaDaBase(estado.base.meta) : Infinity;
  nav.definirHistorico(estado.historico.filter((p) => p.dia < hoje));
}

function guardarPonto(meta, registros) {
  estado.historico = juntarAoHistorico(estado.historico, pontoDe(meta, registros));
  salvarHistorico(estado.historico);
  definirHistorico();
}

/** Anexo de contratos: lido aqui mesmo (arquivo pequeno), sem worker e sem regras. */
async function importarContratos(arquivo) {
  const lidos = await lerContratos(arquivo);
  estado.contratos = { ...lidos, salvoEm: Date.now() };
  salvarContratos(lidos);
  desenharTudo();
  return estado.contratos;
}

/** Guarda a cópia do arquivo importado (Base e Follow-Up), na página e no navegador. */
function lembrarArquivo(tipo, arquivo) {
  if (tipo === 'contratos' || arquivo === estado.copias[tipo]?.arquivo) return; // reimportou a mesma cópia: vale o horário dela
  estado.copias[tipo] = { arquivo, salvoEm: Date.now() };
  salvarCopia(tipo, estado.copias[tipo]);
}

/**
 * Importa um arquivo escolhido (clique ou arrastar) ou a cópia guardada (Reimportar). Primeiro copia o
 * arquivo para a memória numa leitura só ("Copiando o arquivo": pasta de rede no Citrix ficava lenta
 * com o leitor pulando entre partes); a cópia vai ao worker e fica guardada para "Reimportar bases".
 */
async function importar(tipo, arquivo, aoAvancar, sinal) {
  // Uma importação por tipo: a caixa da tela vazia, a do diálogo e o Reimportar não correm juntas
  // (a que terminasse por último venceria, mesmo sendo o arquivo mais antigo).
  if (importando.has(tipo)) throw new Error(`Já há uma importação de ${ROTULOS[tipo] ?? 'Contratos'} em andamento: espere ela terminar ou cancele.`);
  importando.add(tipo);
  try {
    const copia = arquivo === estado.copias[tipo]?.arquivo ? arquivo
      : await copiarParaMemoria(arquivo, { sinal, aoAvancar: (f) => aoAvancar?.(f, 'Copiando o arquivo') });
    const dados = await importarSemLembrar(tipo, copia, aoAvancar, sinal);
    lembrarArquivo(tipo, copia);
    return dados;
  } finally {
    importando.delete(tipo);
  }
}

const importando = new Set();

const ROTULOS = { base: 'Base', followUp: 'Follow-Up' };

/** Cópia guardada do último arquivo deste tipo, se ainda vale (8 h) e dá para ler; sem ela, pede a caixa. */
async function arquivoDeNovo(tipo) {
  const copia = estado.copias[tipo];
  if (copia && !copiaValida(copia)) {
    delete estado.copias[tipo];
    apagarCopia(tipo);
    throw new Error('a cópia do arquivo vale 8 horas e venceu: escolha o arquivo de novo pela caixa em "Atualizar bases"');
  }
  if (!copia) throw new Error('escolha o arquivo de novo pela caixa em "Atualizar bases"');
  try {
    await copia.arquivo.slice(0, 4).arrayBuffer(); // o navegador pode ter descartado a cópia (limpeza de dados)
  } catch {
    throw new Error('a cópia guardada do arquivo não pôde ser lida: escolha de novo pela caixa em "Atualizar bases"');
  }
  return copia.arquivo;
}

/**
 * "Reimportar bases" (Configuração): lê de novo a Base e o Follow-Up (se houver) das cópias guardadas
 * na importação, para trazer as linhas de filial nova do de-para. Devolve um texto por base.
 */
async function reimportarBases(aoAvancar) {
  const tipos = ['base', 'followUp'].filter((t) => t === 'base' || estado[t] || estado.copias[t]);
  const arquivos = [];
  const resultado = [];
  for (const tipo of tipos) {
    try {
      arquivos.push({ tipo, arquivo: await arquivoDeNovo(tipo) });
    } catch (erro) {
      resultado.push(`${ROTULOS[tipo]}: ${erro.message}.`);
    }
  }
  for (const { tipo, arquivo } of arquivos) {
    try {
      const dados = await importar(tipo, arquivo, (fracao, fase) => aoAvancar(`${ROTULOS[tipo]}: ${fase} ${Math.round(fracao * 100)}%`));
      resultado.push(`${ROTULOS[tipo]}: ${arquivo.name}, ${dados.registros.length.toLocaleString('pt-BR')} linhas das filiais do de-para.`);
    } catch (erro) {
      resultado.push(`${ROTULOS[tipo]}: ${erro.message}`);
    }
  }
  return resultado;
}

async function importarSemLembrar(tipo, arquivo, aoAvancar, sinal) {
  if (tipo === 'contratos') return importarContratos(arquivo);
  const hoje = hojeSerie();
  const resultado = await importarNoWorker(tipo, arquivo, { hoje, config: estado.config, aoAvancar, sinal });
  const dados = { registros: resultado.registros, brutos: brutosDe(tipo, resultado.registros), meta: resultado.meta, salvoEm: Date.now() };
  if (tipo === 'base' && estado.base && diaDaBase(estado.base.meta) < diaDaBase(resultado.meta)) {
    estado.anterior = { brutos: estado.base.brutos, meta: estado.base.meta, salvoEm: estado.base.salvoEm };
    salvarAnterior(estado.anterior);
    definirAnterior();
  }
  estado.hoje = hoje;
  if (tipo === 'base' || tipo === 'followUp') reiniciarTelas();
  definirBase(tipo, dados);
  if (tipo === 'base') guardarPonto(dados.meta, dados.registros);
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
  definirAnterior();
}

async function restaurar() {
  const salvas = await lerImportacoes();
  for (const tipo of ['base', 'followUp']) {
    const s = salvas[tipo];
    if (s?.brutos) definirBase(tipo, { brutos: s.brutos, meta: s.meta, salvoEm: s.salvoEm, registros: recalcular(tipo, s.brutos, estado.cfg, estado.hoje) });
  }
  for (const tipo of ['base', 'followUp']) {
    const copia = salvas[`arquivo-${tipo}`];
    if (copiaValida(copia)) estado.copias[tipo] = { arquivo: copia.arquivo, salvoEm: copia.salvoEm };
    else if (copia) apagarCopia(tipo); // vencida (8 h): libera o espaço
  }
  if (salvas.contratos?.abas) estado.contratos = { abas: salvas.contratos.abas, meta: salvas.contratos.meta, salvoEm: salvas.contratos.salvoEm };
  const a = salvas['base-anterior'];
  if (a?.brutos && estado.base && diaDaBase(a.meta) < diaDaBase(estado.base.meta)) {
    estado.anterior = { brutos: a.brutos, meta: a.meta, salvoEm: a.salvoEm };
    definirAnterior();
  }
  // Histórico: o salvo; sem ele (ou sem o dia da base atual), monta com a anterior e a atual.
  estado.historico = salvas.historico?.pontos ?? [];
  if (estado.base && !estado.historico.some((p) => p.dia === diaDaBase(estado.base.meta))) {
    const a = estado.anterior;
    if (a && !estado.historico.some((p) => p.dia === diaDaBase(a.meta))) {
      estado.historico = juntarAoHistorico(estado.historico,
        pontoDe(a.meta, recalcular('base', a.brutos, estado.cfg, a.meta?.hoje ?? diaDaBase(a.meta))));
    }
    guardarPonto(estado.base.meta, recalcular('base', estado.base.brutos, estado.cfg, estado.base.meta?.hoje ?? estado.hoje));
  } else definirHistorico();
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
    ? `Filial nova no de-para (${novas.join(', ')}): use "Reimportar bases" na Configuração para trazer as linhas dela.`
    : null;
}

// ---------- Desenho ----------

function desenharPeriodo() {
  const m = estado.base?.meta;
  if (!m) { raiz.periodo.hidden = true; return; }
  const g = m.dadosGerais;
  const partes = [g.inicio ? `${formatarSerie(g.inicio)} a ${formatarSerie(g.fim)}` : 'Período não informado'];
  if (g.execucao) partes.push(`ME de ${formatarSerie(g.execucao)}`);
  // Base antiga: aviso em texto no próprio selo (amarelo só reforça).
  const atraso = diasDesdeABase(g.execucao, estado.hoje);
  const antiga = atraso >= BASE_ANTIGA_DIAS;
  if (antiga) partes.push(`${atraso} dias úteis atrás: atualize as bases`);
  raiz.periodo.textContent = partes.join(' · ');
  raiz.periodo.classList.toggle('selo-alerta', antiga);
  // Topo compacto (ao rolar): só o aviso curto, para as abas caberem (base.css).
  raiz.periodo.dataset.curto = antiga ? `Base de ${atraso} dias úteis atrás` : '';
  raiz.periodo.title = [antiga ? raiz.periodo.textContent : '', m.hoje !== estado.hoje ? 'Dias em aberto e SLA recalculados para hoje.' : '']
    .filter(Boolean).join('. ');
  raiz.periodo.hidden = false;
}

function desenharTudo() {
  desenharPeriodo();
  botaoPainel.disabled = !estado.base;
  botaoContratos.disabled = !estado.contratos;
  botaoContratos.title = estado.contratos ? 'Abre a planilha de contratos numa janela separada' : 'Importe a planilha de contratos em Atualizar bases';
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
    el('footer', { class: 'dialogo-rodape' },
      el('span', { class: 'espaco dialogo-versao' }, `Versão do app: ${typeof __VERSAO__ === 'string' ? __VERSAO__ : 'local'}`),
      el('button', { type: 'button', class: 'botao', onclick: fechar }, 'Fechar')));
  dialogo.addEventListener('cancel', (ev) => { ev.preventDefault(); fechar(); });
  document.body.append(dialogo);
  dialogo.showModal();
}

function abrirImportacao() {
  abrirDialogo({
    id: 'titulo-importar',
    titulo: 'Atualizar bases',
    corpo: [
      el('p', { class: 'texto-fraco' }, 'Escolha os arquivos novos baixados do ME. A base anterior é substituída. A planilha de contratos é opcional.'),
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
  // O menu fecha no clique: o andamento aparece no próprio botão Exportar.
  botaoExportar.disabled = true;
  const textoAntes = botaoExportar.firstChild.textContent;
  botaoExportar.firstChild.textContent = 'Gerando painel...';
  try {
    const html = await gerarPainel({
      registros: estado.base.registros, followUp: estado.followUp?.registros ?? null, meta: estado.base.meta, hoje: estado.hoje,
      contratos: estado.contratos,
    });
    baixar(NOME_DO_ARQUIVO, html, 'text/html;charset=utf-8');
    abrirDialogo({
      id: 'titulo-painel',
      titulo: 'Painel gerado',
      corpo: [
        el('p', {}, `Baixado: ${NOME_DO_ARQUIVO} (${tamanho(new Blob([html]).size)}), com as telas ${TELAS_PUBLICAS.map((t) => t.rotulo).join(', ')} e os dados de hoje.`),
        estado.followUp ? null : el('p', { class: 'texto-fraco' }, 'Sem a base Follow-Up: a tela Entrega do painel fica vazia. Importe o Follow-Up e gere de novo.'),
        el('p', { class: 'texto-fraco' }, estado.contratos
          ? 'Leva também a planilha de contratos (botão Contratos no topo): quem abrir o painel vê os contratos.'
          : 'Sem a planilha de contratos: o painel não tem o botão Contratos.'),
        el('ol', { class: 'lista-passos' },
          el('li', {}, 'Abra a pasta do painel no OneDrive/SharePoint.'),
          el('li', {}, `Envie o arquivo e escolha "Substituir" (mesmo nome, ${NOME_DO_ARQUIVO}).`),
          el('li', {}, 'O link da Intranet continua o mesmo; quem abrir vê os números novos.')),
        el('p', { class: 'texto-fraco' }, 'O painel não leva a tela SCs por Comprador, a configuração nem pré-pedidos.'),
      ],
    });
  } catch (erro) {
    abrirDialogo({ id: 'titulo-painel', titulo: 'Não foi possível gerar o painel', corpo: [el('p', {}, erro.message)] });
  } finally {
    botaoExportar.firstChild.textContent = textoAntes;
    botaoExportar.disabled = false;
    botaoPainel.disabled = !estado.base;
  }
}

const botaoPainel = document.getElementById('acao-painel');
botaoPainel.addEventListener('click', gerarEBaixarPainel);
const botaoExportar = document.getElementById('acao-exportar');
ligarMenu(botaoExportar, document.getElementById('menu-exportar'));
const botaoContratos = document.getElementById('acao-contratos');
botaoContratos.addEventListener('click', () => estado.contratos && abrirContratos({
  contratos: estado.contratos,
  hoje: hojeSerie(),
  nomeDaFilial: (filial) => estado.cfg.dadosFilial(filialAjustadaDoContrato(filial))?.nome?.trim() || null,
}));
document.getElementById('acao-importar').addEventListener('click', abrirImportacao);
document.getElementById('acao-config').addEventListener('click', () => abrirConfiguracao({
  config: estado.config,
  personalizada: estado.personalizada,
  temBase: !!estado.base,
  aoSalvar(config) {
    salvarConfig(config);
    return aplicarConfig(config, true);
  },
  aoReimportar: reimportarBases,
  aoRestaurar() {
    apagarConfig();
    return aplicarConfig(CONFIG_PADRAO, false);
  },
}));
ligarImpressao(document.getElementById('acao-imprimir'));
aplicarMarca();
ligarTopoCompacto();
ligarTema(document.getElementById('acao-tema'));

// Virou o dia com a página aberta: recalcula dias em aberto e SLA.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && hojeSerie() !== estado.hoje && estado.base) {
    recalcularTudo();
    desenharTudo();
  }
});

desenharTudo();
restaurar().finally(() => { estado.carregando = false; desenharTudo(); });
