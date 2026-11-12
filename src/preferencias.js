// Preferências pequenas deste navegador (aba, tema). Sem dependências: entra também no painel
// publicado, onde o armazenamento pode estar bloqueado (quadro do SharePoint) e tudo vira padrão.

export function lerPreferencia(nome, padrao = null) {
  try { return localStorage.getItem(`dashboard-compras:${nome}`) ?? padrao; } catch { return padrao; }
}

export function salvarPreferencia(nome, valor) {
  try { localStorage.setItem(`dashboard-compras:${nome}`, valor); } catch { /* sem armazenamento */ }
}

/** Conjunto de textos salvo como lista JSON (recortes de Status das telas). Inválido ou ausente: vazio. */
export function lerConjunto(nome) {
  try {
    const v = JSON.parse(lerPreferencia(nome, '[]'));
    return new Set(Array.isArray(v) ? v.filter((s) => typeof s === 'string') : []);
  } catch { return new Set(); }
}

export function salvarConjunto(nome, conjunto) { salvarPreferencia(nome, JSON.stringify([...conjunto])); }
