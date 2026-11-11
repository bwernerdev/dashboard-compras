// Confere as regras do app com o DASHBOARD COMPRAS 2026.xlsm.
// Lê as abas Base e Follow-UP da planilha (dados colados + colunas calculadas),
// recalcula cada linha com src/regras.js e compara coluna a coluna.
// Também compara os totais das tabelas dinâmicas Saving e sc p Compr.
// Uso: npm run conferir -- "DASHBOARD COMPRAS 2026.xlsm"

import { openAsBlob } from 'node:fs';
import { importar } from '../src/importar.js';
import { criarConfig } from '../src/config/index.js';
import { diasUteis, formatarSerie } from '../src/datas.js';
import { abrirPasta, lerAbaInteira } from '../src/leitor/xlsx.js';

const caminho = process.argv[2] ?? 'DASHBOARD COMPRAS 2026.xlsm';
const blob = await openAsBlob(caminho);
const cfg = criarConfig();
let falhas = 0;

const traco = (v) => (v === null || v === undefined ? '-' : v);
const normal = (v) => {
  if (v === null || v === undefined || v === '' || v === '-') return '-';
  if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6);
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) return String(Math.round(Number(v) * 1e6) / 1e6);
  return String(v);
};

function comparar(titulo, registros, pares) {
  console.log(`\n== ${titulo}: ${registros.length} linhas`);
  for (const [coluna, campo, ajuste = (v) => v] of pares) {
    const erros = [];
    for (const r of registros) {
      const esperado = normal(r.planilha[coluna]);
      const obtido = normal(ajuste(r[campo], r));
      if (esperado !== obtido) erros.push({ sc: r.sc, esperado, obtido });
    }
    const ok = erros.length === 0;
    if (!ok) falhas++;
    console.log(`${ok ? 'OK   ' : 'DIFERE'} ${coluna.padEnd(30)} ${ok ? '' : `${erros.length} linhas, ex.: ${JSON.stringify(erros.slice(0, 3))}`}`);
  }
}

// Data do último recálculo da planilha: HOJE() = criação + "Dias da Aprovação".
async function hojeDaPlanilha(aba) {
  const amostra = await importar('base', blob, cfg, { aba, filtrar: false, extras: ['Dias da Aprovação'], hoje: 0 });
  const r = amostra.registros.find((x) => typeof x.planilha['Dias da Aprovação'] === 'number');
  return Math.floor(r.criacao) + r.planilha['Dias da Aprovação'];
}

const hoje = await hojeDaPlanilha('Base');
console.log(`HOJE() no último recálculo da planilha: ${formatarSerie(hoje)}`);
console.log(`Método dos dias úteis: DIATRABALHOTOTAL(0; hoje) = ${diasUteis(0, hoje)} (a planilha mostra 33098 nas linhas quebradas)`);

// ---- Aba Base ----
const colunasBase = ['SC', 'Filial Corr.', 'Nm Fil Corr.', 'Comprador Ajustado Completo', 'Comprador ',
  'Dias da Aprovação', 'Contrato?', 'Saving Real', 'Regional', 'Filial Ajust', 'Ano OF', 'Mês OF'];
const base = await importar('base', blob, cfg, { aba: 'Base', filtrar: false, extras: colunasBase, hoje });
comparar('Base (colunas sem o erro de referência)', base.registros, [
  ['SC', 'sc'],
  ['Filial Corr.', 'filial'],
  ['Nm Fil Corr.', 'nomeFilial'],
  ['Comprador Ajustado Completo', 'compradorCompleto'],
  ['Comprador ', 'comprador', traco],
  ['Dias da Aprovação', 'diasDaAprovacao'],
  ['Contrato?', 'temContrato'],
  ['Saving Real', 'savingReal'],
  ['Regional', 'regional'],
  ['Filial Ajust', 'nomeFilial'],
  ['Ano OF', 'anoPedido'],
  ['Mês OF', 'mesPedido'],
]);

// ---- Aba Follow-UP ----
const colunasFu = ['SC', 'OF', 'Filial Corr.', 'Nm Fil Corr.', 'Comprador Ajustado Completo', 'Regional', 'Filial Ajust'];
const fu = await importar('followUp', blob, cfg, { aba: 'Follow-UP', filtrar: false, extras: colunasFu, hoje });
comparar('Follow-UP', fu.registros, [
  ['SC', 'sc'],
  ['OF', 'of'],
  ['Filial Corr.', 'filial'],
  ['Nm Fil Corr.', 'nomeFilial'],
  ['Comprador Ajustado Completo', 'compradorCompleto'],
  ['Regional', 'regional'],
  ['Filial Ajust', 'nomeFilial'],
]);

// ---- Tabelas dinâmicas ----
const pasta = await abrirPasta(blob);

const porFilial = new Map();
for (const r of base.registros) {
  const k = r.nomeFilial ?? '-';
  const t = porFilial.get(k) ?? { total: 0, economia: 0 };
  t.total += r.totalPedidoComImpostos ?? 0;
  t.economia += r.savingReal;
  porFilial.set(k, t);
}

// Spend: soma do pedido c/ impostos por filial (O5:P17).
{
  const linhas = await lerAbaInteira(pasta, 'Spend');
  console.log('\n== Tabela dinâmica Spend (por filial)');
  for (const l of linhas.slice(5, 17)) {
    const filial = l?.[14];
    if (filial === undefined || filial === 'Total Geral') continue;
    const c = porFilial.get(String(filial)) ?? { total: 0 };
    const ok = Math.abs(c.total - (l[15] ?? 0)) < 0.01;
    if (!ok) falhas++;
    console.log(`${ok ? 'OK   ' : 'DIFERE'} ${String(filial).padEnd(15)} ${(l[15] ?? 0).toFixed(2)} x ${c.total.toFixed(2)}`);
  }
}

// Saving: por filial, Total Comprado (soma pedido c/ impostos) e Economia (soma Saving Real) (D5:F10).
// Na planilha de 11/11/2026 as segmentações filtravam Comprador = Thayane e Contrato? = não.
// Se a planilha for salva com outro filtro, ajuste FILTRO_SAVING.
const FILTRO_SAVING = (r) => r.comprador === 'Thayane' && r.temContrato === 'não';
{
  const linhas = await lerAbaInteira(pasta, 'Saving');
  const calc = new Map();
  for (const r of base.registros.filter(FILTRO_SAVING)) {
    const k = r.nomeFilial ?? '-';
    const t = calc.get(k) ?? { total: 0, economia: 0 };
    t.total += r.totalPedidoComImpostos ?? 0;
    t.economia += r.savingReal;
    calc.set(k, t);
  }
  console.log('\n== Tabela dinâmica Saving (por filial; Comprador = Thayane, Contrato? = não)');
  for (const l of linhas.slice(5, 10)) {
    const filial = l?.[3];
    if (filial === undefined || filial === 'Total Geral') continue;
    const c = calc.get(String(filial)) ?? { total: 0, economia: 0 };
    const ok = Math.abs(c.total - (l[4] ?? 0)) < 0.01 && Math.abs(c.economia - (l[5] ?? 0)) < 0.01;
    if (!ok) falhas++;
    console.log(`${ok ? 'OK   ' : 'DIFERE'} ${String(filial).padEnd(15)} total ${(l[4] ?? 0).toFixed(2)} x ${c.total.toFixed(2)} | economia ${(l[5] ?? 0).toFixed(2)} x ${c.economia.toFixed(2)}`);
  }
}

// sc p Compr: SCs distintas por comprador x status (C56:L64).
{
  const linhas = await lerAbaInteira(pasta, 'sc p Compr');
  const cab = linhas[56];
  const calc = new Map();
  for (const r of base.registros) {
    const k = `${r.comprador ?? '-'}|${r.status ?? ''}`;
    if (!calc.has(k)) calc.set(k, new Set());
    calc.get(k).add(r.solicitacao);
  }
  console.log('\n== Tabela dinâmica sc p Compr (SCs distintas por comprador x status)');
  for (const l of linhas.slice(57, 64)) {
    const comprador = l[2];
    if (comprador === undefined || comprador === 'Total Geral' || comprador === '(vazio)') continue;
    const difs = [];
    for (let c = 4; c <= 10; c++) {
      const status = cab[c];
      const esperado = l[c] ?? 0;
      const obtido = calc.get(`${comprador}|${status}`)?.size ?? 0;
      if (esperado !== obtido) difs.push(`${status}: ${esperado} x ${obtido}`);
    }
    if (difs.length) falhas++;
    console.log(`${difs.length ? 'DIFERE' : 'OK   '} ${String(comprador).padEnd(10)} ${difs.join('; ')}`);
  }
}

console.log(falhas ? `\n${falhas} conferência(s) com diferença.` : '\nTudo confere.');
process.exitCode = falhas ? 1 : 0;
