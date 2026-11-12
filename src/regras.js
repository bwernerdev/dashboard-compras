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

/** Nível de aprovação do Status Pré-Pedido ("APROVAÇÃO NÍVEL 2" -> '2', sem acento/maiúscula), ou null. */
export function nivelDeAprovacao(status) {
  const norm = texto(status).trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ');
  return norm.match(/^APROVACAO NIVEL (\d+)$/)?.[1] ?? null;
}

/**
 * Status Pré-Pedido (coluna AI da base) com os níveis de aprovação traduzidos (pedido da equipe):
 * "APROVAÇÃO NÍVEL 1" -> "Ag. aprovação GA"; NÍVEL 2 e 3 -> "Ag. aprovação Corporativo".
 * Nível 1 com aprovador GA configurado para a filial (Configuração > Filiais): "Ag. aprovação <nome>".
 * Outros status ficam como vêm do ME; vazio vira null. Não existe na planilha antiga.
 */
export function aprovacaoPrePedido(status, aprovadorGA = null) {
  const t = texto(status).trim();
  if (t === '' || t === '-') return null;
  const nivel = nivelDeAprovacao(t);
  const nome = texto(aprovadorGA).trim();
  if (nivel === '1') return `Ag. aprovação ${nome || 'GA'}`;
  if (nivel === '2' || nivel === '3') return 'Ag. aprovação Corporativo';
  return t;
}

/** Serviço: Unidade UR, SER ou SERV. */
export function ehServico(unidade) {
  return ['UR', 'SER', 'SERV'].some((u) => igual(unidade, u)) ? 'SIM' : 'NÃO';
}

/**
 * SLA (pedido da equipe, 12/11/2026; substitui a tabela por prioridade e serviço da aba `sla`):
 * item em aberto só fica "Fora do Prazo" com mais de 30 dias úteis em aberto, qualquer prioridade.
 */
export const PRAZO_SLA_DIAS = 30;

const STATUS_SEM_SLA = ['Cancelado', 'Em Pedido', 'Em Pré-Pedido'];

/** "No Prazo" / "Fora do Prazo"; null se o item não está em aberto ou o status não conta SLA. */
export function situacaoSla(status, diasEmAberto) {
  if (diasEmAberto === null || diasEmAberto === undefined) return null;
  if (STATUS_SEM_SLA.some((s) => igual(status, s))) return null;
  return diasEmAberto > PRAZO_SLA_DIAS ? 'Fora do Prazo' : 'No Prazo';
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
    servico: ehServico(r.unidade),
    sla: situacaoSla(r.status, diasEmAberto),
    aprovacao: aprovacaoPrePedido(r.statusPrePedido, cfg.aprovadorGA?.(r.codigoFilial)),
    savingReal: savingReal(r.saving, r.qtdSolicitacao),
    ...anoMesPedido(r.numeroPedido, r.dataPedido),
    ...temposPorEtapa(r, hoje),
  };
}

/**
 * Linha do Follow-Up -> registro com as colunas calculadas da aba Follow-UP.
 * Fora da planilha (para os filtros globais e a tela Entrega): `comprador` (apelido do de-para,
 * pelo nome com 40 caracteres como na Base; sem apelido, o nome da planilha) e `temContrato`.
 */
export function calcularLinhaFollowUp(r, cfg, hoje) {
  const filial = dadosDaFilial(cfg, r.codigoFilial);
  const compradorCompleto = nomeComprador(r.selecionadoPor, 30);
  const completo40 = nomeComprador(r.selecionadoPor, 40);
  return {
    ...r,
    sc: extrairNumero(r.solicitacao),
    of: extrairNumero(r.numeroPedido),
    ...filial,
    compradorCompleto: compradorCompleto === '' ? null : compradorCompleto,
    comprador: cfg.apelidoComprador(completo40 === '' ? PENDENTE : completo40) ?? (compradorCompleto || PENDENTE),
    temContrato: preenchida(r.contrato) ? 'sim' : 'não',
    diasDaAprovacao: dias(hoje, r.criacao),
  };
}

export const CALCULAR = { base: calcularLinhaBase, followUp: calcularLinhaFollowUp };
