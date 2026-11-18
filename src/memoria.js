// Memória local do navegador: última importação de cada base (IndexedDB) e configuração editada
// (localStorage). Nada sai do computador. Guarda só as colunas lidas do ME ("brutos"); ao abrir,
// os campos calculados são refeitos com a configuração atual e a data de hoje.

import { ESQUEMAS } from './esquema.js';
import { CALCULAR } from './regras.js';
import { normalizarCodigoFilial } from './config/index.js';

const BANCO = 'dashboard-compras';
const LOJA = 'importacoes';
const CHAVE_CONFIG = 'dashboard-compras:config';

/** Só as colunas do esquema (sem os campos calculados). */
export function brutosDe(tipo, registros) {
  const chaves = Object.keys(ESQUEMAS[tipo].colunas);
  return registros.map((r) => {
    const b = {};
    for (const k of chaves) b[k] = r[k];
    return b;
  });
}

/**
 * Refaz os campos calculados com outra configuração e/ou outro "hoje".
 * Linhas de filiais que saíram do de-para são descartadas; filiais novas só entram reimportando.
 */
export function recalcular(tipo, brutos, cfg, hoje) {
  const calcular = CALCULAR[tipo];
  const registros = [];
  for (const b of brutos) {
    if (!cfg.codigosFiliais.has(normalizarCodigoFilial(b.codigoFilial))) continue;
    registros.push(calcular({ ...b }, cfg, hoje));
  }
  return registros;
}

// ---------- IndexedDB ----------

function abrirBanco() {
  return new Promise((resolver, rejeitar) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA, { keyPath: 'tipo' });
    req.onsuccess = () => resolver(req.result);
    req.onerror = () => rejeitar(req.error);
  });
}

async function transacao(modo, acao) {
  const banco = await abrirBanco();
  try {
    return await new Promise((resolver, rejeitar) => {
      const tx = banco.transaction(LOJA, modo);
      const req = acao(tx.objectStore(LOJA));
      tx.oncomplete = () => resolver(req?.result);
      tx.onerror = () => rejeitar(tx.error);
      tx.onabort = () => rejeitar(tx.error);
    });
  } finally {
    banco.close();
  }
}

/** Grava { tipo, brutos, meta, salvoEm }. Falha de armazenamento não impede o uso. */
export async function salvarImportacao(tipo, registros, meta) {
  try {
    await transacao('readwrite', (loja) => loja.put({ tipo, brutos: brutosDe(tipo, registros), meta, salvoEm: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

/** Quanto tempo a cópia do arquivo vale (pedido da equipe, 18/11/2026: algumas horas, um dia de trabalho). */
export const VALIDADE_COPIA_MS = 8 * 60 * 60 * 1000;

/** A cópia { arquivo, salvoEm } ainda vale em `agora`? */
export function copiaValida(copia, agora = Date.now()) {
  return Boolean(copia?.arquivo) && typeof copia.salvoEm === 'number' && agora - copia.salvoEm < VALIDADE_COPIA_MS;
}

/**
 * Cópia do último arquivo importado de cada tipo (Base e Follow-Up, o .xlsx como veio), para "Reimportar
 * bases" ler de novo sem escolher o arquivo (filial nova no de-para). Tipo 'arquivo-<tipo>' com
 * { arquivo, salvoEm }. Ocupa o tamanho do arquivo (~83 MB a Base, ~11 MB o Follow-Up), é trocada a cada
 * importação e vale 8 horas (`VALIDADE_COPIA_MS`; vencida, `apagarCopia` ao abrir o app). Também apaga a
 * referência ao arquivo da versão de 17/11/2026 ('alca-<tipo>'), que não é mais usada.
 */
export async function salvarCopia(tipo, { arquivo, salvoEm }) {
  try {
    await transacao('readwrite', (loja) => {
      loja.delete(`alca-${tipo}`);
      return loja.put({ tipo: `arquivo-${tipo}`, arquivo, salvoEm });
    });
    return true;
  } catch {
    return false; // sem espaço ou navegador bloqueando: a cópia fica só enquanto a página estiver aberta
  }
}

/** Apaga a cópia do arquivo deste tipo (vencida). */
export async function apagarCopia(tipo) {
  try {
    await transacao('readwrite', (loja) => loja.delete(`arquivo-${tipo}`));
  } catch { /* sem armazenamento */ }
}

/** Anexo de contratos (planilha CONTROLE DE CONTRATOS já lida): { abas, meta }. Tipo 'contratos' na mesma loja. */
export async function salvarContratos({ abas, meta }) {
  try {
    await transacao('readwrite', (loja) => loja.put({ tipo: 'contratos', abas, meta, salvoEm: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Base anterior (outro dia do ME), para a variação nos cartões: { brutos, meta, salvoEm } já em brutos.
 * Fica na mesma loja, com tipo 'base-anterior'.
 */
export async function salvarAnterior(anterior) {
  try {
    await transacao('readwrite', (loja) => loja.put({ tipo: 'base-anterior', ...anterior }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Histórico curto para os mini gráficos dos cartões: [{ dia, status, aberto }] (resumos da base
 * inteira, sem filtros), um ponto por dia do ME, no máximo 30. Tipo 'historico' na mesma loja.
 */
export async function salvarHistorico(pontos) {
  try {
    await transacao('readwrite', (loja) => loja.put({ tipo: 'historico', pontos }));
    return true;
  } catch {
    return false;
  }
}

/** Junta o ponto do dia (troca se já houver o mesmo dia), em ordem, e guarda só os últimos `max`. */
export function juntarAoHistorico(pontos, ponto, max = 30) {
  return [...(pontos ?? []).filter((p) => p.dia !== ponto.dia), ponto].sort((a, b) => a.dia - b.dia).slice(-max);
}

/** { base?, followUp?, 'base-anterior'?, historico?, contratos?, 'arquivo-<tipo>'? } com { brutos, meta, salvoEm }; vazio se não houver nada ou o navegador bloquear. */
export async function lerImportacoes() {
  try {
    const todas = await transacao('readonly', (loja) => loja.getAll());
    return Object.fromEntries((todas ?? []).map((i) => [i.tipo, i]));
  } catch {
    return {};
  }
}

// ---------- Configuração (localStorage) ----------

export function lerConfig() {
  try {
    const texto = localStorage.getItem(CHAVE_CONFIG);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

export function salvarConfig(config) {
  try {
    localStorage.setItem(CHAVE_CONFIG, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export function apagarConfig() {
  try { localStorage.removeItem(CHAVE_CONFIG); } catch { /* sem armazenamento */ }
}
