// Confere as regras do app com o DASHBOARD COMPRAS 2026.xlsm.
// Lê as abas Base e Follow-UP da planilha (dados colados + colunas calculadas),
// recalcula cada linha com src/regras.js e compara coluna a coluna.
// Também compara as tabelas dinâmicas Spend, Saving e sc p Compr usando src/analise.js (as telas).
// Uso: npm run conferir -- "DASHBOARD COMPRAS 2026.xlsm"

import { openAsBlob } from 'node:fs';
import { importar } from '../src/importar.js';
import { criarConfig } from '../src/config/index.js';
import { diasUteis, formatarSerie } from '../src/datas.js';
import { abrirPasta, lerAbaInteira } from '../src/leitor/xlsx.js';
import {
  aplicarFiltros, savingPorFilial, spendPorFilial, scsPorCompradorStatus, prePedidosPorCompradorRegional, OUTROS,
} from '../src/analise.js';

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

// Spend: soma do pedido c/ impostos por filial (O5:P17), com a função da tela Spend.
{
  const porFilial = new Map(spendPorFilial(base.registros).map((g) => [g.chave, { total: g.valor }]));
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

// As tabelas abaixo usam as MESMAS funções das telas (src/analise.js).

// Saving: por filial, Total Comprado (soma pedido c/ impostos) e Economia (soma Saving Real) (D5:F10).
// Na planilha de 11/11/2026 as segmentações filtravam Comprador = Thayane e Contrato? = não.
// Se a planilha for salva com outro filtro, ajuste FILTRO_SAVING.
const FILTRO_SAVING = { comprador: new Set(['Thayane']), contrato: new Set(['não']) };
{
  const linhas = await lerAbaInteira(pasta, 'Saving');
  const calc = new Map(savingPorFilial(aplicarFiltros(base.registros, FILTRO_SAVING, 'saving')).map((g) => [g.chave, g]));
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

const abaCompr = await lerAbaInteira(pasta, 'sc p Compr');

// sc p Compr, tabela 3: SCs distintas por comprador x status (C56:L64), com o total distinto.
{
  const cab = abaCompr[56];
  const calc = scsPorCompradorStatus(base.registros);
  const statusDaColuna = (s) => (s === '(vazio)' ? OUTROS : s);
  console.log('\n== Tabela dinâmica sc p Compr (SCs distintas por comprador x status)');
  for (const l of abaCompr.slice(57, 64)) {
    const comprador = l[2];
    if (comprador === undefined || comprador === '(vazio)') continue;
    const total = { comprador: 'Total Geral', porStatus: calc.totaisStatus, total: calc.totalGeral };
    const linha = comprador === 'Total Geral' ? total : calc.linhas.find((x) => x.comprador === String(comprador));
    const difs = [];
    const explicadas = [];
    for (let c = 3; c <= 11; c++) {
      const coluna = cab[c];
      const esperado = l[c] ?? 0;
      const obtido = coluna === 'Total Geral' ? (linha?.total ?? 0) : (linha?.porStatus[statusDaColuna(coluna)] ?? 0);
      if (esperado === obtido) continue;
      // Linha vazia da tabela Base (sem SC, sem status; comprador "-" pela fórmula): a contagem
      // distinta do modelo de dados conta o vazio como 1 SC. O app não lê linha sem filial.
      if ((comprador === '-' || comprador === 'Total Geral') && (coluna === '(vazio)' || coluna === 'Total Geral') && esperado === obtido + 1) explicadas.push(`${coluna}: ${esperado} x ${obtido}`);
      else difs.push(`${coluna}: ${esperado} x ${obtido}`);
    }
    if (difs.length) falhas++;
    const situacao = difs.length ? 'DIFERE' : explicadas.length ? 'OK*  ' : 'OK   ';
    console.log(`${situacao} ${String(comprador).padEnd(10)} ${[...difs, ...explicadas.map((e) => `${e} (*linha vazia da planilha)`)].join('; ')}`);
  }
}

// sc p Compr, tabela 1: pré-pedidos distintos por comprador e regional (C5:D18).
{
  const calc = prePedidosPorCompradorRegional(base.registros);
  const regionais = new Set(calc.regionais);
  // Como a planilha, o vazio conta como um pré-pedido em cada grupo com SC sem pré-pedido.
  console.log('\n== Tabela dinâmica sc p Compr (pré-pedidos distintos por comprador e regional)');
  let atual = null;
  for (const l of abaCompr.slice(5, 19)) {
    const rotulo = l?.[2];
    if (rotulo === undefined || rotulo === null || rotulo === '') continue;
    const esperado = l[3] ?? 0;
    let obtido;
    if (regionais.has(String(rotulo)) && atual) obtido = atual.porRegional[String(rotulo)] ?? 0;
    else {
      atual = calc.linhas.find((x) => x.comprador === String(rotulo));
      obtido = atual?.total ?? 0;
    }
    const ok = esperado === obtido;
    if (!ok) falhas++;
    console.log(`${ok ? 'OK   ' : 'DIFERE'} ${regionais.has(String(rotulo)) ? '  ' : ''}${String(rotulo).padEnd(16)} ${esperado} x ${obtido}`);
  }
  // Comprador que o app mostra e a planilha não (ex.: "-" ou Pendente): também é diferença.
  const naPlanilha = new Set(abaCompr.slice(5, 19).map((l) => l?.[2]).filter((v) => v !== undefined && v !== null && v !== '').map(String));
  for (const l of calc.linhas.filter((x) => !naPlanilha.has(x.comprador))) {
    falhas++;
    console.log(`DIFERE ${l.comprador.padEnd(16)} só no app (${l.total})`);
  }
}

console.log(falhas ? `\n${falhas} conferência(s) com diferença.` : '\nTudo confere.');
process.exitCode = falhas ? 1 : 0;
