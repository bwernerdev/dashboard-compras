// App da equipe: topo (abas, período, ações), barra de filtros e a tela ativa.
// Os dados (bases importadas, base anterior, histórico, contratos, cópias, configuração) e o fluxo de
// importar, reimportar e restaurar ficam em bases.js, sem DOM; aqui só a tela e as ações do topo.
// Abas, filtros, tema e impressão vêm da casca comum (ui/casca.js), a mesma do painel publicado.

import { atualizarConfigSalva } from './config/index.js';
import { hojeSerie, formatarSerie } from './datas.js';
import { lerConfig } from './memoria.js';
import { criarBases } from './bases.js';
import { filialAjustadaDoContrato } from './contratos/dados.js';
import { abrirContratos } from './telas/contratos.js';
import { lerPreferencia, salvarPreferencia } from './preferencias.js';
import { el } from './ui/dom.js';
import { abrirDialogo as abrirDialogoComum, versaoDoApp } from './ui/dialogo.js';
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

let carregando = true; // lendo as bases salvas ao abrir: esqueleto no lugar da tela de importação

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
  telaVazia: () => (carregando ? esqueleto('Abrindo as bases salvas...') : el('div', { class: 'boas-vindas' },
    el('h2', {}, 'Importe as bases do ME'),
    el('p', { class: 'texto-fraco' },
      'Use o favorito do navegador para baixar as duas bases e escolha os arquivos abaixo. ',
      'Tudo é lido e calculado neste computador; nada é enviado.'),
    caixasDeImportacao({ estado, aoImportar: bases.importar }))),
});

// Os dados entram na casca (abas e filtros) por esta vista; desenhar() refaz topo e tela.
const bases = criarBases({
  configSalva: atualizarConfigSalva(lerConfig()),
  vista: {
    definirBase(tipo, dados) {
      if (tipo === 'base') {
        nav.definirRegistros(dados.registros);
        nav.definirPeriodo(dados.meta?.dadosGerais);
      } else nav.definirFollowUp(dados.registros);
    },
    definirAnteriores: (anteriores) => nav.definirAnteriores(anteriores),
    definirHistorico: (pontos) => nav.definirHistorico(pontos),
    reiniciarTelas,
    desenhar: () => desenharTudo(),
  },
});
const { estado } = bases;

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

/** Diálogo simples do topo: corpo e rodapé com a versão do app e "Fechar". */
function abrirDialogo({ id, titulo, corpo }) {
  const botaoFechar = el('button', { type: 'button', class: 'botao' }, 'Fechar');
  const { fechar } = abrirDialogoComum({ id, titulo, corpo, rodape: [versaoDoApp(), botaoFechar] });
  botaoFechar.addEventListener('click', fechar);
}

function abrirImportacao() {
  abrirDialogo({
    id: 'titulo-importar',
    titulo: 'Atualizar bases',
    corpo: [
      el('p', { class: 'texto-fraco' }, 'Escolha os arquivos novos baixados do ME. A base anterior é substituída. A planilha de contratos é opcional.'),
      caixasDeImportacao({ estado, aoImportar: bases.importar }),
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
  aoSalvar: bases.salvarConfig,
  aoReimportar: bases.reimportarBases,
  aoRestaurar: bases.restaurarPadrao,
}));
ligarImpressao(document.getElementById('acao-imprimir'));
aplicarMarca();
ligarTopoCompacto();
ligarTema(document.getElementById('acao-tema'));

// Virou o dia com a página aberta: recalcula dias em aberto e SLA.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && bases.virouODia()) desenharTudo();
});

desenharTudo();
bases.restaurar().finally(() => { carregando = false; desenharTudo(); });
