// Preferências pequenas deste navegador (aba, tema). Sem dependências: entra também no painel
// publicado, onde o armazenamento pode estar bloqueado (quadro do SharePoint) e tudo vira padrão.

export function lerPreferencia(nome, padrao = null) {
  try { return localStorage.getItem(`dashboard-compras:${nome}`) ?? padrao; } catch { return padrao; }
}

export function salvarPreferencia(nome, valor) {
  try { localStorage.setItem(`dashboard-compras:${nome}`, valor); } catch { /* sem armazenamento */ }
}
