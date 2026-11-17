// Preferências pequenas deste navegador (aba, tema, recortes das telas). Sem dependências: entra também
// no painel publicado, onde o armazenamento pode estar bloqueado (quadro do SharePoint) e tudo vira padrão.
// Estado lembrado das telas: escolha única (`lerEscolha`), conjunto de textos (`lerConjunto`) ou
// objeto/lista (`lerJson`). Salvo inválido, estragado ou ausente = padrão.

export function lerPreferencia(nome, padrao = null) {
  try { return localStorage.getItem(`dashboard-compras:${nome}`) ?? padrao; } catch { return padrao; }
}

export function salvarPreferencia(nome, valor) {
  try { localStorage.setItem(`dashboard-compras:${nome}`, valor); } catch { /* sem armazenamento */ }
}

/** Valor salvo como JSON; ausente, estragado ou `null` = `padrao`. Quem lê valida o formato. */
export function lerJson(nome, padrao) {
  try { return JSON.parse(lerPreferencia(nome, 'null')) ?? padrao; } catch { return padrao; }
}

export function salvarJson(nome, valor) { salvarPreferencia(nome, JSON.stringify(valor)); }

/** Escolha entre opções fixas (alternadores): o salvo só vale se ainda for uma das `validas`. */
export function lerEscolha(nome, validas, padrao) {
  const v = lerPreferencia(nome);
  return validas.includes(v) ? v : padrao;
}

/** Conjunto de textos salvo como lista JSON (recortes de Status das telas). Inválido ou ausente: vazio. */
export function lerConjunto(nome) {
  const v = lerJson(nome, []);
  return new Set(Array.isArray(v) ? v.filter((s) => typeof s === 'string') : []);
}

export function salvarConjunto(nome, conjunto) { salvarJson(nome, [...conjunto]); }
