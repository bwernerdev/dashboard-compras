// Cores da planilha antiga (formatação condicional): status, prioridade e % de saving.
// Reavaliado em 11/11/2026 para ficar coerente no app:
// - Tabelas: Status e % Saving como selo com o fundo exato da planilha (texto preto, ou branco no
//   azul-escuro). Prioridade como marca quadrada + texto, para não se confundir com o status
//   (amarelo e vermelho aparecem nas duas colunas da planilha com sentidos diferentes).
// - Gráfico: as cores de fundo da planilha são claras demais para barras. Usa a mesma família de
//   cor de cada status, em tons validados para os dois temas (tokens --graf-*).
// Tokens em ../styles/tokens.css, classes em ../styles/componentes.css.
// Comparação sem maiúsculas, como o "É igual a" do Excel.
import { el } from './dom.js';

const chave = (v) => String(v ?? '').trim().toLowerCase();

const STATUS = new Map([
  ['em pedido', 'pedido'],
  ['em pré-pedido', 'pre-pedido'],
  ['em cotação', 'cotacao'],
  ['em pendências de compra', 'pend-compra'],
  ['em pendências de contrato', 'pend-contrato'],
  ['sel. comprador', 'sel-comprador'],
  ['cancelado', 'cancelado'],
]);
/** Status que a planilha pinta (Sel. Comprador não tem cor lá). */
const STATUS_COM_COR = new Set(['pedido', 'pre-pedido', 'cotacao', 'pend-compra', 'pend-contrato', 'cancelado']);

const PRIORIDADE = new Map([['normal', 'normal'], ['urgente', 'urgente'], ['emergencial', 'emergencial']]);

/** Chave de cor do status, ou null. */
export const chaveDoStatus = (status) => STATUS.get(chave(status)) ?? null;

/** Chave de cor da prioridade, ou null. */
export const chaveDaPrioridade = (prioridade) => PRIORIDADE.get(chave(prioridade)) ?? null;

/** % saving: "-" ou abaixo de 0,1% = 'baixo'; 6% ou mais = 'bom'; no meio, sem cor (null). */
export function chaveDoSaving(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct) || pct < 0.001) return 'baixo';
  return pct >= 0.06 ? 'bom' : null;
}

/** Selo do status com o fundo da planilha; status sem cor lá sai como texto. */
export function seloDoStatus(status) {
  const k = chaveDoStatus(status);
  if (!k || !STATUS_COM_COR.has(k)) return status || '-';
  return el('span', { class: `selo-pl pl-${k}` }, status);
}

/** Prioridade: marca quadrada na cor da planilha + texto. */
export function marcaDaPrioridade(prioridade) {
  const k = chaveDaPrioridade(prioridade);
  if (!k) return prioridade || '-';
  return el('span', { class: 'marca-prio' }, el('span', { class: `marca-prio-cor prio-${k}`, 'aria-hidden': 'true' }), prioridade);
}

/** % saving com o fundo da planilha quando ela pinta. */
export function seloDoSaving(pct, texto) {
  const k = chaveDoSaving(pct);
  return k ? el('span', { class: `selo-pl pl-saving-${k}` }, texto) : texto;
}

/** Cor do status no gráfico (mesma família da planilha, tons validados por tema). */
export function corDoStatusNoGrafico(status) {
  const k = chaveDoStatus(status);
  return k ? `var(--graf-${k})` : 'var(--serie-outros)';
}
