// Cores da planilha antiga (formatação condicional): status, prioridade e % de saving.
// A equipe reconhece pela cor, então valem nas células das tabelas e no gráfico de status.
// Tokens em ../styles/tokens.css (--pl-*), classes em ../styles/componentes.css (.cel-*).
// Comparação sem maiúsculas, como o "É igual a" do Excel.

const chave = (v) => String(v ?? '').trim().toLowerCase();

const STATUS = new Map([
  ['em pedido', 'pedido'],
  ['em cotação', 'cotacao'],
  ['em pendências de compra', 'pendencia'],
  ['em pendências de contrato', 'pendencia'],
  ['em pré-pedido', 'pre-pedido'],
  ['cancelado', 'cancelado'],
]);

const PRIORIDADE = new Map([
  ['normal', 'normal'],
  ['urgente', 'urgente'],
  ['emergencial', 'emergencial'],
]);

/** Classe da célula de status ('' quando a planilha não pinta esse status). */
export const classeDoStatus = (status) => (STATUS.has(chave(status)) ? `cel-${STATUS.get(chave(status))}` : '');

/** Classe da célula de prioridade. */
export const classeDaPrioridade = (prioridade) => (PRIORIDADE.has(chave(prioridade)) ? `cel-${PRIORIDADE.get(chave(prioridade))}` : '');

/** Classe da célula de % saving: "-" ou abaixo de 0,1% amarelo; 6% ou mais verde. */
export function classeDoSaving(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct) || pct < 0.001) return 'cel-saving-baixo';
  return pct >= 0.06 ? 'cel-saving-bom' : '';
}

/**
 * Cor do status no gráfico (barras empilhadas). Mesmas cores da planilha; pendência de contrato
 * em azul mais forte para não se confundir com a de compra (na planilha as duas são iguais).
 * Status sem cor na planilha: cor neutra da paleta.
 */
export function corDoStatusNoGrafico(status) {
  const k = chave(status);
  if (k === 'em pendências de contrato') return 'var(--pl-pendencia-forte)';
  if (STATUS.has(k)) return `var(--pl-${STATUS.get(k)})`;
  if (k === 'sel. comprador') return 'var(--serie-7)';
  return 'var(--serie-outros)';
}
