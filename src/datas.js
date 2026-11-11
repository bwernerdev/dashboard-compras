// Datas como número de série do Excel (sistema 1900): 1 = 01/01/1900, 46337 = 11/11/2026.
// Trabalhar em série evita fuso horário e reproduz DIAS e DIATRABALHOTOTAL do Excel.

const EPOCA_UNIX = 25569; // série de 01/01/1970
const MS_DIA = 86400000;

/** Série do dia (sem hora) de uma data local do JavaScript. */
export function serieDeData(data) {
  return Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()) / MS_DIA + EPOCA_UNIX;
}

/** Série de hoje no relógio do computador (o HOJE() da planilha). */
export function hojeSerie(agora = new Date()) {
  return serieDeData(agora);
}

/** Série a partir de ano, mês (1-12) e dia. */
export function serie(ano, mes, dia) {
  return Date.UTC(ano, mes - 1, dia) / MS_DIA + EPOCA_UNIX;
}

/** { ano, mes, dia } de uma série. Série 0 = 00/01/1900, como no Excel. */
export function partesDaSerie(s) {
  const n = Math.floor(s);
  if (n === 0) return { ano: 1900, mes: 1, dia: 0 };
  // O Excel conta 29/02/1900 (dia 60), que não existe: abaixo disso, um dia a menos.
  const ajuste = n < 61 ? 1 : 0;
  const d = new Date((n - EPOCA_UNIX + ajuste) * MS_DIA);
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

/** "dd/mm/aaaa" -> série, ou null. */
export function serieDeTexto(texto) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*$/.exec(String(texto ?? ''));
  if (!m) return null;
  const base = serie(Number(m[3]), Number(m[2]), Number(m[1]));
  const horas = m[4] ? (Number(m[4]) * 3600 + Number(m[5]) * 60 + Number(m[6] ?? 0)) / 86400 : 0;
  return base + horas;
}

/** Série -> "dd/mm/aaaa". */
export function formatarSerie(s) {
  if (s === null || s === undefined || s === '') return '';
  const { ano, mes, dia } = partesDaSerie(s);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

/** Dia da semana no sistema do Excel: 0 = domingo ... 6 = sábado. Série 0 é sábado. */
export function diaDaSemana(s) {
  return (Math.floor(s) + 6) % 7;
}

/** Valor de célula vazia em conta: o Excel trata célula vazia como 0. */
const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v));

/** DIAS(fim; início) do Excel: diferença entre as partes inteiras. */
export function dias(fim, inicio) {
  return Math.floor(num(fim)) - Math.floor(num(inicio));
}

/**
 * DIATRABALHOTOTAL(início; fim) do Excel, sem feriados: conta seg-sex,
 * incluindo os dois extremos; negativo se início > fim.
 */
export function diasUteis(inicio, fim) {
  let a = Math.floor(num(inicio));
  let b = Math.floor(num(fim));
  if (a > b) return -diasUteis(b, a);
  const total = b - a + 1;
  const semanas = Math.floor(total / 7);
  let n = semanas * 5;
  let d = a + semanas * 7;
  for (; d <= b; d++) {
    const dow = diaDaSemana(d);
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}
