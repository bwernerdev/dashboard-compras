// Janela "Contratos": a planilha CONTROLE DE CONTRATOS (anexo opcional da importação) numa janela
// em tela cheia por cima do dashboard, com as abas da planilha (Contratos, Pequeno porte, ME,
// Inativos). Não usa os filtros globais do dashboard. App da equipe e painel publicado.
import { el, substituir } from '../ui/dom.js';
import { cartao, linhaDeCartoes, bloco } from '../ui/cartoes.js';
import { criarTabela } from '../ui/tabela.js';
import { listaDeMarcar } from '../ui/filtros.js';
import * as fmt from '../ui/formatos.js';
import { lerEscolha, salvarPreferencia } from '../preferencias.js';
import {
  ABAS, statusDoContrato, prazoDias, resumoContratos, contarPor, fimDoContrato, PRAZO_AVISO_DIAS,
} from '../contratos/dados.js';

const CHAVE_ABA = 'contratos-aba';
/** Recortes de cada aba (status e responsável), enquanto a página estiver aberta. */
const recortes = new Map();

const CLASSE_STATUS = {
  ATIVO: 'sla-bom', 'EM RENOVAÇÃO': 'contrato-aviso', 'VAI ENCERRAR': 'contrato-aviso', VENCIDO: 'sla-fora', INATIVO: 'contrato-inativo',
};

/** Status com marca de cor e texto (nunca só a cor). */
function seloStatus(r) {
  const st = statusDoContrato(r);
  if (!st) return '-';
  const classe = CLASSE_STATUS[st];
  return classe ? el('span', { class: 'marca-prio' }, el('span', { class: `marca-prio-cor ${classe}`, 'aria-hidden': 'true' }), st) : st;
}

/** Prazo em dias com marca: fim já passou (vermelho) ou vence em até 30 dias (amarelo). */
function seloPrazo(p) {
  if (p === null) return '-';
  const classe = p < 0 ? 'sla-fora' : p <= PRAZO_AVISO_DIAS ? 'contrato-aviso' : null;
  const texto = fmt.inteiro(p);
  return classe ? el('span', { class: 'marca-prio' }, el('span', { class: `marca-prio-cor ${classe}`, 'aria-hidden': 'true' }), texto) : texto;
}

const textoOuNumero = (formatar) => (v) => (typeof v === 'number' ? formatar(v) : String(v));
/**
 * Colunas de controle: começam ocultas na tela (botão "Colunas" mostra; o Excel leva todas).
 * Os números do contrato (Projuris e ME) aparecem (pedido da equipe, 17/11/2026).
 */
const OCULTAS_PADRAO = new Set(['ifrs16', 'minuta', 'item', 'servicoLocacao']);
const CLASSES_TEXTO = {
  objeto: 'texto-longo', fornecedor: 'texto-medio', observacao: 'texto-medio', encerramento: 'texto-medio', setor: 'texto-medio',
  statusDemanda: 'texto-medio',
};

/** Coluna da tabela a partir de um campo lido da planilha ({ id, rotulo, tipo? }). */
function colunaDoCampo(c) {
  const base = { id: c.id, rotulo: c.rotulo, valor: (r) => r[c.id] ?? null, ocultaPadrao: OCULTAS_PADRAO.has(c.id) };
  if (c.id === 'status') return { ...base, valor: statusDoContrato, exibir: seloStatus };
  if (c.tipo === 'data') return { ...base, tipo: 'data', centro: true };
  // Valor às vezes é texto ("Conforme proposta"): encolhe com reticências como as colunas de texto.
  if (c.tipo === 'moeda') {
    return { ...base, num: true, formato: textoOuNumero(fmt.moedaCentavos), formatoExcel: 'moeda', classe: () => 'texto-medio' };
  }
  if (c.tipo === 'codigo') return { ...base, formato: String };
  if (CLASSES_TEXTO[c.id]) return { ...base, classe: () => CLASSES_TEXTO[c.id] };
  return base;
}

/** Colunas de um quadro: as da planilha, mais "Nome da filial" (depois de Filial) e "Prazo (dias)" (depois de Status). */
function colunasDoQuadro(quadro, { hoje, nomeDaFilial }) {
  const temFim = quadro.linhas.some((r) => fimDoContrato(r) !== null);
  return quadro.campos.flatMap((c) => {
    const col = colunaDoCampo(c);
    if (c.id === 'filial' && nomeDaFilial) {
      return [col, { id: 'nomeFilial', rotulo: 'Nome da filial', valor: (r) => nomeDaFilial(r.filial), classe: () => 'texto-medio' }];
    }
    if (c.id === 'status' && temFim) {
      return [col, {
        id: 'prazo', rotulo: 'Prazo (dias)', num: true, valor: (r) => prazoDias(r, hoje), exibir: (r) => seloPrazo(prazoDias(r, hoje)),
        titulo: 'Dias corridos de hoje até o fim (na aba ME, o vencimento). Negativo: já passou.',
      }];
    }
    return [col];
  });
}

function cartoesDaAba(linhas, hoje, rotuloTotal) {
  const r = resumoContratos(linhas, hoje);
  return linhaDeCartoes(
    cartao({ icone: 'documento', rotulo: rotuloTotal, valor: fmt.inteiro(r.total) }),
    cartao({ icone: 'check', rotulo: 'Ativos', valor: fmt.inteiro(r.ativos), detalhe: r.emRenovacao ? `${fmt.inteiro(r.emRenovacao)} em renovação` : null }),
    cartao({
      icone: 'relogio', rotulo: `Vencem em até ${PRAZO_AVISO_DIAS} dias`, valor: fmt.inteiro(r.vencem), tom: r.vencem ? 'alerta' : null,
      detalhe: 'Pelo fim do contrato, sem os inativos',
    }),
    cartao({
      icone: 'alerta', rotulo: 'Fim já passou', valor: fmt.inteiro(r.vencidos), tom: r.vencidos ? 'critico' : null,
      detalhe: 'Fim antes de hoje e status diferente de INATIVO',
    }),
  );
}

/** Aba (Contratos, Pequeno porte, ME, Inativos): cartões, recortes e lista. */
function desenharAba(aba, quadro, opcoes) {
  const local = recortes.get(aba.id) ?? { status: new Set(), resp: new Set() };
  recortes.set(aba.id, local);
  const temResp = quadro.campos.some((c) => c.id === 'resp');
  const recortar = () => quadro.linhas.filter((r) => (!local.status.size || local.status.has(statusDoContrato(r) ?? '(vazio)'))
    && (!local.resp.size || local.resp.has(r.resp ?? '(vazio)')));

  let tabela = null;
  const lista = (id, rotulo, campo) => {
    const contagem = contarPor(quadro.linhas, campo);
    return listaDeMarcar({
      id: `contratos-${id}`, rotulo, valores: [...contagem.keys()],
      rotuloValor: (v) => `${v} (${fmt.inteiro(contagem.get(v))})`, resumoValor: (v) => v,
      selecionados: local[id], aoMudar: () => tabela.atualizar(recortar()),
    });
  };
  const temStatus = quadro.campos.some((c) => c.id === 'status');
  const filtros = el('div', { class: 'recortes' },
    temStatus ? lista('status', 'Status', 'status') : null,
    temResp ? lista('resp', 'Responsável', 'resp') : null);

  const colunas = colunasDoQuadro(quadro, opcoes);
  tabela = criarTabela({
    titulo: aba.rotulo,
    linhas: recortar(),
    colunas,
    ordem: colunas.some((c) => c.id === 'prazo') ? { coluna: 'prazo', desc: false } : null,
    nomeArquivo: `contratos-${aba.id}.csv`,
    xlsx: aba.rotulo,
    caberNaLargura: true,
    escolherColunas: true,
    vazio: 'Nenhum contrato com esse recorte.',
  });
  const temFim = colunas.some((c) => c.id === 'prazo');
  return el('div', { class: 'tela' },
    temFim && aba.id !== 'inativos' ? cartoesDaAba(quadro.linhas, opcoes.hoje, aba.id === 'me' ? 'Contratos ME' : 'Contratos') : null,
    bloco({
      titulo: aba.rotulo,
      subtitulo: temFim ? 'Ordenada pelo prazo: o que vence primeiro fica no topo.' : null,
      ajuda: 'Pesquise por fornecedor, CNPJ, objeto ou filial. Clique no cabeçalho para ordenar. "Colunas" esconde colunas da tela; Excel e "Copiar tabela" trazem todas.',
    }, filtros, tabela.elemento));
}

/**
 * Abre a janela. contratos: { abas: { [id]: [quadro] }, meta: { arquivo }, salvoEm? }; mostra o 1º quadro de cada aba.
 * hoje: série do Excel (prazo). nomeDaFilial(filial) -> nome do de-para ou null (opcional).
 */
export function abrirContratos({ contratos, hoje, nomeDaFilial = null }) {
  const abas = ABAS.filter((a) => contratos.abas[a.id]?.length);
  let atual = lerEscolha(CHAVE_ABA, abas.map((a) => a.id), abas[0]?.id);
  const opcoes = { hoje, nomeDaFilial };

  const conteudo = el('div', { class: 'janela-conteudo' });
  const lista = el('div', { class: 'abas janela-abas', role: 'tablist', 'aria-label': 'Abas da planilha de contratos' });
  const linhasDaAba = (a) => contratos.abas[a.id][0].linhas.length;

  function desenhar() {
    substituir(lista, abas.map((a) => el('button', {
      type: 'button', role: 'tab', class: 'aba', id: `contratos-aba-${a.id}`, 'aria-selected': String(a.id === atual),
      'aria-controls': 'contratos-conteudo', tabindex: a.id === atual ? '0' : '-1',
      onclick: () => { atual = a.id; salvarPreferencia(CHAVE_ABA, a.id); desenhar(); },
      onkeydown: (ev) => {
        const i = abas.findIndex((x) => x.id === atual);
        const novo = ev.key === 'ArrowRight' ? abas[(i + 1) % abas.length] : ev.key === 'ArrowLeft' ? abas[(i - 1 + abas.length) % abas.length] : null;
        if (!novo) return;
        ev.preventDefault();
        atual = novo.id;
        salvarPreferencia(CHAVE_ABA, atual);
        desenhar();
        lista.querySelector(`#contratos-aba-${atual}`)?.focus();
      },
    }, a.rotulo, el('span', { class: 'aba-contagem' }, ` ${fmt.inteiro(linhasDaAba(a))}`))));
    const aba = abas.find((a) => a.id === atual);
    substituir(conteudo, desenharAba(aba, contratos.abas[aba.id][0], opcoes));
    conteudo.setAttribute('aria-labelledby', `contratos-aba-${aba.id}`);
  }

  const quando = contratos.salvoEm ? new Date(contratos.salvoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;
  const dialogo = el('dialog', { class: 'dialogo janela', 'aria-labelledby': 'titulo-contratos' });
  const fechar = () => { dialogo.close(); dialogo.remove(); };
  conteudo.id = 'contratos-conteudo';
  conteudo.setAttribute('role', 'tabpanel');
  dialogo.append(
    el('header', { class: 'dialogo-cabecalho janela-cabecalho' },
      el('div', { class: 'janela-titulo' },
        el('h2', { id: 'titulo-contratos' }, 'Contratos'),
        el('span', { class: 'texto-fraco' }, [contratos.meta?.arquivo, quando ? `importado em ${quando}` : null, `prazo contado até ${fmt.data(hoje)}`].filter(Boolean).join(' · '))),
      el('button', { type: 'button', class: 'botao botao-link', onclick: fechar, 'aria-label': 'Fechar' }, '✕')),
    lista,
    conteudo);
  // Esc com uma lista de marcar aberta fecha só a lista.
  dialogo.addEventListener('cancel', (ev) => {
    ev.preventDefault();
    if (!dialogo.querySelector('.filtro-painel:not([hidden])')) fechar();
  });
  document.body.append(dialogo);
  desenhar();
  dialogo.showModal();
  return { dialogo, fechar };
}
