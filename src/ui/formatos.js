// Formatação pt-BR dos números do painel.
import { formatarSerie } from '../datas.js';

const fInteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const fDecimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fMoedaCentavos = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fMoedaCompacta = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
});
const fPct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

const vazio = (v) => v === null || v === undefined || Number.isNaN(v);

export const inteiro = (v) => (vazio(v) ? '-' : fInteiro.format(v));
export const decimal = (v) => (vazio(v) ? '-' : fDecimal.format(v));
export const moeda = (v) => (vazio(v) ? '-' : fMoeda.format(v));
export const moedaCentavos = (v) => (vazio(v) ? '-' : fMoedaCentavos.format(v));
/** R$ 1,2 mi — para cartões e eixos; o valor exato fica na tabela. */
export const moedaCompacta = (v) => (vazio(v) ? '-' : fMoedaCompacta.format(v));
export const pct = (v) => (vazio(v) ? '-' : fPct.format(v));
const fPctFino = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** % saving costuma ser < 1%: sempre 2 casas (0,03%). */
export const pctFino = (v) => (vazio(v) ? '-' : fPctFino.format(v));
export const data = (serie) => (vazio(serie) || serie === '' ? '-' : formatarSerie(serie));
// Partículas que ficam minúsculas no meio do nome (Ezequias da Silva).
const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
/**
 * Nome em CAIXA ALTA (como vem do ME/de-para) para exibição: "EZEQUIAS DA SILVA" -> "Ezequias da Silva".
 * Texto que já tem minúscula fica como está. Só para mostrar: filtro, pesquisa e Excel usam o original.
 */
export function nomeProprio(v) {
  const s = String(v ?? '');
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().split(/(\s+)/).map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('');
}
export const texto = (v) => (v === null || v === undefined || v === '' ? '-' : String(v));
