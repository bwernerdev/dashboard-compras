// SCs que o comprador já atendeu e quer tirar da lista "SCs em aberto" (olho ou duplo clique).
// Fica só neste navegador. Cada marca vence em 120 dias: SC que ganha pedido sai da lista
// sozinha; a marca velha só ocuparia espaço.
import { lerPreferencia, salvarPreferencia } from './preferencias.js';

const NOME = 'scs-atendidas';
const VALIDADE_DIAS = 120;
let cache = null;

function ler() {
  if (cache) return cache;
  let obj = {};
  try { obj = JSON.parse(lerPreferencia(NOME, '{}')) ?? {}; } catch { obj = {}; }
  const limite = Date.now() - VALIDADE_DIAS * 864e5;
  cache = new Map(Object.entries(obj).filter(([, quando]) => typeof quando === 'number' && quando >= limite));
  return cache;
}

function salvar() {
  salvarPreferencia(NOME, JSON.stringify(Object.fromEntries(ler())));
}

export const estaAtendida = (sc) => ler().has(String(sc));

/** Marca (ou desmarca, com `atendida = false`) a SC como atendida. */
export function marcarAtendida(sc, atendida = true) {
  const marcas = ler();
  if (atendida) marcas.set(String(sc), Date.now());
  else marcas.delete(String(sc));
  salvar();
}

/** Só para testes: esquece o que foi lido. */
export function esquecerCache() { cache = null; }
