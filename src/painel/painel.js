// Painel publicado (o arquivo painel-compras.html): só consulta. Lê os dados embutidos na página,
// mostra as telas públicas (as abas visíveis da planilha antiga, telas/publicas.js) com os filtros globais e se adapta ao quadro isolado
// do SharePoint (PROJETO.md, seção 7): sem "Exportar Excel" e sem imprimir lá dentro; "Copiar tabela" funciona.
// Os números ficam congelados na data em que o painel foi gerado.
//
// Não importar daqui nada de config/, importar.js, memoria.js nem telas internas: tudo o que este
// arquivo importa vai para dentro do painel, que qualquer pessoa da Intranet pode ler.

import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/componentes.css';
import '../styles/impressao.css';
import { descompactar, registrosDoPainel, followUpDoPainel, contratosDoPainel } from './dados.js';
import { abrirContratos } from '../telas/contratos.js';
import { filialAjustadaDoContrato } from '../contratos/dados.js';
import { criarNavegador, ligarTema, ligarImpressao, ligarTopoCompacto, diasDesdeABase, BASE_ANTIGA_DIAS } from '../ui/casca.js';
import { aplicarMarca } from '../ui/marca.js';
import { definirExportacao } from '../ui/tabela-exportar.js';
import { el, substituir } from '../ui/dom.js';
import { lerPreferencia, salvarPreferencia } from '../preferencias.js';
import { formatarSerie, hojeSerie } from '../datas.js';
import { TELAS_PUBLICAS } from '../telas/publicas.js';
import { esqueleto } from '../ui/cartoes.js';

/** Dentro de um quadro (pré-visualização do SharePoint): download, imprimir e janelas novas bloqueados. */
const noQuadro = (() => {
  try { return window.top !== window; } catch { return true; }
})();

const raiz = {
  periodo: document.getElementById('periodo'),
  abas: document.getElementById('abas'),
  filtros: document.getElementById('filtros'),
  conteudo: document.getElementById('conteudo'),
  filtrosImpressao: document.getElementById('filtros-impressao'),
};

definirExportacao({ arquivo: !noQuadro });
document.getElementById('aviso-quadro').hidden = !noQuadro;
const botaoImprimir = document.getElementById('acao-imprimir');
if (noQuadro) botaoImprimir.hidden = true;
else ligarImpressao(botaoImprimir);
aplicarMarca();
ligarTopoCompacto();
ligarTema(document.getElementById('acao-tema'));

function mostrarPeriodo(dados) {
  const partes = [];
  if (dados.periodo?.inicio) partes.push(`${formatarSerie(dados.periodo.inicio)} a ${formatarSerie(dados.periodo.fim)}`);
  partes.push(`dados de ${new Date(dados.geradoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`);
  // Painel antigo na Intranet: avisa quem lê (o selo fica amarelo, o texto diz quanto).
  const atraso = diasDesdeABase(dados.periodo?.execucao ?? dados.hoje, hojeSerie());
  const antigo = atraso >= BASE_ANTIGA_DIAS;
  if (antigo) partes.push(`${atraso} dias úteis atrás`);
  raiz.periodo.classList.toggle('selo-alerta', antigo);
  raiz.periodo.textContent = partes.join(' · ');
  raiz.periodo.dataset.curto = antigo ? `Dados de ${atraso} dias úteis atrás` : ''; // topo compacto (base.css)
  raiz.periodo.title = 'Dias em aberto e SLA calculados na data em que o painel foi gerado.';
  raiz.periodo.hidden = false;
}

/** Botão Contratos: só se o painel foi gerado com a planilha. Nome da filial pelos próprios registros. */
function ligarContratos(contratos, registros) {
  const botao = document.getElementById('acao-contratos');
  if (!contratos || !botao) return;
  const nomes = new Map(registros.map((r) => [r.filial, r.nomeFilial]));
  botao.hidden = false;
  botao.addEventListener('click', () => abrirContratos({
    contratos, hoje: hojeSerie(), nomeDaFilial: (filial) => nomes.get(filialAjustadaDoContrato(filial))?.trim() || null,
  }));
}

async function iniciar() {
  substituir(raiz.conteudo, esqueleto('Abrindo os dados do painel...'));
  // Qualquer erro até a primeira tela (dados, versão, desenho) vira aviso: senão o esqueleto ficava para sempre.
  try {
    const dados = await descompactar(document.getElementById('dados').textContent);
    const registros = registrosDoPainel(dados);
    const nav = criarNavegador({
      telas: TELAS_PUBLICAS,
      raiz,
      abaInicial: lerPreferencia('aba-painel') ?? 'regional',
      aoTrocarAba: (id) => salvarPreferencia('aba-painel', id),
      chaveFiltros: 'filtros-painel',
      telaVazia: () => el('div', { class: 'estado-vazio' }, 'O painel não tem linhas.'),
    });
    nav.definirRegistros(registros);
    ligarContratos(contratosDoPainel(dados), registros);
    nav.definirFollowUp(followUpDoPainel(dados));
    nav.definirPeriodo(dados.periodo);
    mostrarPeriodo(dados);
    nav.desenhar();
  } catch (erro) {
    substituir(raiz.conteudo, el('div', { class: 'estado-vazio' }, `Não foi possível abrir os dados do painel (${erro?.message ?? erro}). Gere o painel de novo no app.`));
  }
}

iniciar();
