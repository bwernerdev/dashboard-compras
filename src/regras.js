// Regras de negócio do painel: cópia fiel das colunas calculadas das abas
// `Base` e `Follow-UP` do DASHBOARD COMPRAS 2026.xlsm (PROJETO.md, seção 3).
// Única exceção aprovada: a planilha lia as datas de outra linha (PROJETO.md, seção 2);
// aqui cada linha usa os próprios dados, com o mesmo método.
//
// Semântica do Excel preservada:
// - célula vazia (null) vale 0 em conta e é "vazia" em ÉCÉL.VAZIA;
// - texto vazio ("") NÃO é célula vazia, mas é igual a "" em comparações;
// - comparação de texto ignora maiúsculas/minúsculas;
// - texto comparado com número é sempre maior (por isso "" <= 15 é FALSO).
// "-" e "" da planilha viram null; #N/D vira a constante ERRO_ND.

import { dias, diasUteis, partesDaSerie } from './datas.js';

export const ERRO_ND = '#N/D';
export const PENDENTE = 'Pendente';

const vazia = (v) => v === null || v === undefined; // ÉCÉL.VAZIA
const preenchida = (v) => !(v === null || v === undefined || v === ''); // valor <> ""
const igual = (a, b) => String(a ?? '').toUpperCase() === String(b ?? '').toUpperCase();
const texto = (v) => (v === null || v === undefined ? '' : String(v));

/** EXT(texto; 5; 7): "FDS-7652633" -> "7652633". */
export function extrairNumero(valor) {
  const s = texto(valor).slice(4, 11);
  return s === '' ? null : s;
}

/** Nome do comprador sem o prefixo "FDS - " (EXT(...; 7; tamanho)). */
export function nomeComprador(selecionadoPor, tamanho) {
  return texto(selecionadoPor).slice(6, 6 + tamanho);
}

/** Filial ajustada, nome e regional pelo de-para. Fora do de-para: null (a planilha mostra "-"). */
export function dadosDaFilial(cfg, codigoFilial) {
  const ajustada = cfg.filialAjustada(codigoFilial);
  if (ajustada === null) return { filial: null, nomeFilial: null, regional: null };
  const dados = cfg.dadosFilial(ajustada);
  return { filial: ajustada, nomeFilial: dados?.nome ?? null, regional: dados?.regional ?? null };
}

/** Serviço: Unidade UR, SER ou SERV. */
export function ehServico(unidade) {
  return ['UR', 'SER', 'SERV'].some((u) => igual(unidade, u)) ? 'SIM' : 'NÃO';
}

const STATUS_SEM_SLA = ['Cancelado', 'Em Pedido', 'Em Pré-Pedido'];

/** Prazos mín./máx. do SLA; null quando o status não conta SLA; ERRO_ND sem linha na tabela. */
export function prazoSla(cfg, status, prioridade, servico) {
  if (STATUS_SEM_SLA.some((s) => igual(status, s))) return { min: null, max: null };
  const p = cfg.prazoSla(prioridade, servico);
  return p ? { min: p.min, max: p.max } : { min: ERRO_ND, max: ERRO_ND };
}

/** SE(OU(min="";max="");"";SE(diasEmAberto<=max;"No Prazo";"Fora do Prazo")). */
export function situacaoSla(diasEmAberto, min, max) {
  if (min === ERRO_ND || max === ERRO_ND) return ERRO_ND;
  if (min === null || max === null) return null;
  // Sem dias em aberto a célula é "" (texto), e texto > número no Excel.
  if (diasEmAberto === null) return 'Fora do Prazo';
  return diasEmAberto <= max ? 'No Prazo' : 'Fora do Prazo';
}

/**
 * Número como o Excel em pt-BR converte numa conta: vazio = 0; texto "1.234,56" = 1234.56;
 * texto que não é número (inclusive "") = NaN (#VALOR!).
 */
export function numeroExcel(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (s === '' || !/^-?[\d.]*,?\d*$/.test(s)) return NaN;
  return Number(s.replace(/\./g, '').replace(',', '.'));
}

/**
 * Saving Real = SEERRO(Saving x Quantidade da solicitação; "0") (como hoje).
 * O ME manda o Saving como texto "268,93"; o Excel converte. Erro vira "0" (conta como 0).
 */
export function savingReal(saving, qtdSolicitacao) {
  const valor = numeroExcel(saving) * numeroExcel(qtdSolicitacao);
  return Number.isNaN(valor) ? 0 : valor;
}

/** Tempo (dias corridos) em cada etapa, como as colunas Cancelado ... Em pendências de contrato. */
export function temposPorEtapa(r, hoje) {
  const st = r.status;
  return {
    cancelado: preenchida(r.dataCancelamento) ? dias(r.dataCancelamento, r.criacao) : null,
    emCotacao: igual(st, 'Em Cotação')
      ? dias(hoje, r.dataCotacao)
      : (preenchida(r.numeroCotacao) && preenchida(r.dataPrePedido) ? dias(r.dataPrePedido, r.dataCotacao) : null),
    emPedido: preenchida(r.dataPedido) ? dias(r.dataPedido, r.dataPrePedido) : null,
    pendenciaCompra: igual(st, 'Em pendências de compra')
      ? dias(hoje, r.criacao)
      : (preenchida(r.numeroCotacao) ? dias(r.dataCotacao, r.criacao) : null),
    emPrePedido: preenchida(r.dataPrePedido) ? dias(r.dataPrePedido, r.criacao) : null,
    pendenciaContrato: preenchida(r.contrato) && igual(st, 'Em Pedido')
      ? dias(r.dataPrePedido, r.criacao)
      : (igual(st, 'Em pendências de contrato') ? dias(hoje, r.criacao) : null),
  };
}

function anoMesPedido(numeroPedido, dataPedido) {
  if (!preenchida(numeroPedido)) return { anoPedido: null, mesPedido: null };
  const { ano, mes } = partesDaSerie(dataPedido ?? 0);
  return { anoPedido: ano, mesPedido: mes };
}

/**
 * Linha da base (Relatório de Requisição) -> registro com as colunas calculadas.
 * hoje: série do dia (HOJE()).
 */
export function calcularLinhaBase(r, cfg, hoje) {
  const filial = dadosDaFilial(cfg, r.codigoFilial);
  const completo = nomeComprador(r.selecionadoPor, 40);
  const compradorCompleto = completo === '' ? PENDENTE : completo;
  const comprador = cfg.apelidoComprador(compradorCompleto);

  // Data = SE(pedido < criação; criação; pedido). Vazia conta 0.
  const dataRef = (r.dataPedido ?? 0) < (r.criacao ?? 0) ? (r.criacao ?? 0) : (r.dataPedido ?? 0);
  const emAberto = vazia(r.numeroPedido) && vazia(r.dataCancelamento);
  const diasEmAberto = emAberto ? diasUteis(dataRef, hoje) : null;
  const horasEmAberto = emAberto ? diasUteis(r.criacao, hoje) * 8.8 : null;

  const servico = ehServico(r.unidade);
  const { min, max } = prazoSla(cfg, r.status, r.prioridade, servico);

  return {
    ...r,
    sc: extrairNumero(r.solicitacao),
    ...filial,
    compradorCompleto,
    comprador,
    diasDaAprovacao: dias(hoje, r.criacao),
    horasEmAberto,
    diasEmAberto,
    data: dataRef === 0 ? null : dataRef,
    temContrato: preenchida(r.contrato) ? 'sim' : 'não',
    servico,
    slaMin: min,
    slaMax: max,
    sla: situacaoSla(diasEmAberto, min, max),
    savingReal: savingReal(r.saving, r.qtdSolicitacao),
    ...anoMesPedido(r.numeroPedido, r.dataPedido),
    ...temposPorEtapa(r, hoje),
  };
}

/** Linha do Follow-Up -> registro com as colunas calculadas da aba Follow-UP. */
export function calcularLinhaFollowUp(r, cfg, hoje) {
  const filial = dadosDaFilial(cfg, r.codigoFilial);
  const compradorCompleto = nomeComprador(r.selecionadoPor, 30);
  return {
    ...r,
    sc: extrairNumero(r.solicitacao),
    of: extrairNumero(r.numeroPedido),
    ...filial,
    compradorCompleto: compradorCompleto === '' ? null : compradorCompleto,
    diasDaAprovacao: dias(hoje, r.criacao),
  };
}

export const CALCULAR = { base: calcularLinhaBase, followUp: calcularLinhaFollowUp };
