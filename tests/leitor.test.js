import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LeitorDeLinhas, lerStringsCompartilhadas, decodificarXml, indiceColuna, CelulaErro, abrirPasta, lerAba, lerAbaInteira,
} from '../src/leitor/xlsx.js';
import { criarXlsx, criarZip } from './ajuda/xlsx-ficticio.js';

test('índice de coluna', () => {
  assert.equal(indiceColuna('A'), 0);
  assert.equal(indiceColuna('Z'), 25);
  assert.equal(indiceColuna('AA'), 26);
  assert.equal(indiceColuna('CB'), 79);
});

test('decodifica entidades e escapes do Excel', () => {
  assert.equal(decodificarXml('a &amp; b &lt;c&gt; &#233; &#x41;'), 'a & b <c> é A');
  assert.equal(decodificarXml('linha1_x000D_linha2'), 'linha1\rlinha2');
});

test('strings compartilhadas: simples, texto rico, vazia e fonética', () => {
  const xml = '<sst><si><t>Olá</t></si><si><r><t>Tex</t></r><r><rPr/><t xml:space="preserve">to rico</t></r></si>'
    + '<si/><si><t>Kanji</t><rPh><t>fonética</t></rPh></si></sst>';
  assert.deepEqual(lerStringsCompartilhadas(xml), ['Olá', 'Texto rico', '', 'Kanji']);
});

const XML_ABA = '<worksheet><sheetData>'
  + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="s"><v>2</v></c></row>'
  + '<row r="2" spans="1:4"><c r="A2"><v>12.5</v></c><c r="B2" t="str"><v>a &amp; b</v></c>'
  + '<c r="C2" s="3"/><c r="D2" t="inlineStr"><is><t>em linha</t></is></c></row>'
  + '<row r="3"/>'
  + '<row r="4"><c r="A4" t="b"><v>1</v></c><c r="B4" t="e"><v>#N/A</v></c><c r="D4"><f>SUM(1)</f><v>7</v></c></row>'
  + '<row><c><v>1</v></c><c><v>2</v></c></row>'
  + '</sheetData><rowBreaks count="0"/></worksheet>';

function lerTudo(xml, tamanhoPedaco, colunas) {
  const linhas = [];
  // Array.from troca os buracos (colunas vazias) por undefined, para comparar.
  const leitor = new LeitorDeLinhas(['Nome', 'Valor', 'Outro'], (v, n) => linhas.push([n, Array.from(v)]));
  if (colunas) leitor.definirColunas(colunas);
  for (let i = 0; i < xml.length; i += tamanhoPedaco) leitor.empurrar(xml.slice(i, i + tamanhoPedaco));
  leitor.terminar();
  return linhas;
}

test('linhas e tipos de célula', () => {
  const linhas = lerTudo(XML_ABA, XML_ABA.length);
  assert.equal(linhas.length, 4); // <row r="3"/> não gera linha
  assert.deepEqual(linhas[0], [1, ['Nome', 'Valor', undefined, 'Outro']]);
  assert.deepEqual(linhas[1], [2, [12.5, 'a & b', undefined, 'em linha']]);
  const [n4, v4] = linhas[2];
  assert.equal(n4, 4);
  assert.equal(v4[0], true);
  assert.ok(v4[1] instanceof CelulaErro);
  assert.equal(String(v4[1]), '#N/A');
  assert.equal(v4[3], 7); // fórmula: valor gravado
  assert.deepEqual(linhas[3], [5, [1, 2]]); // sem atributo r: posição sequencial
});

test('resultado igual com o XML picado em pedaços de 1 a 7 caracteres', () => {
  const inteiro = JSON.stringify(lerTudo(XML_ABA, XML_ABA.length));
  for (let t = 1; t <= 7; t++) assert.equal(JSON.stringify(lerTudo(XML_ABA, t)), inteiro, `pedaço ${t}`);
});

test('lê só as colunas pedidas', () => {
  const linhas = lerTudo(XML_ABA, 5, [0, 3]);
  assert.deepEqual(linhas[1][1], [12.5, undefined, undefined, 'em linha']);
});

test('xlsx completo: abas, cabeçalho, colunas escolhidas e linhas', async () => {
  const blob = await criarXlsx([
    { nome: 'Dados Gerais', linhas: [['Nome do filtro', 'Valor do Filtro'], ['Data Inicio', '01/10/2026']] },
    { nome: 'Relatório', linhas: [['A', 'B', 'C'], ['x', 1, 'ç & <tag>'], [null, 2, null]] },
  ]);
  const pasta = await abrirPasta(blob);
  assert.deepEqual(pasta.abas.map((a) => a.nome), ['Dados Gerais', 'Relatório']);

  const recebidas = [];
  let cab;
  await lerAba(pasta, 'Relatório', {
    aoCabecalho: (c) => { cab = c; return [0, 2]; },
    aoLinha: (v, n) => recebidas.push([n, Array.from(v)]),
  });
  assert.deepEqual(cab, ['A', 'B', 'C']);
  assert.deepEqual(recebidas, [[2, ['x', undefined, 'ç & <tag>']], [3, []]]);

  const dg = await lerAbaInteira(pasta, 'Dados Gerais');
  assert.equal(dg[1][1], '01/10/2026');
});

test('aba inexistente e arquivo que não é xlsx dão mensagem clara', async () => {
  const pasta = await abrirPasta(await criarXlsx([{ nome: 'Plan1', linhas: [['a']] }]));
  await assert.rejects(lerAba(pasta, 'Relatório', {}), /Aba "Relatório" não encontrada.*Plan1/);
  await assert.rejects(abrirPasta(new Blob(['não é zip'])), /não é um \.xlsx válido/);
  await assert.rejects(abrirPasta(await criarZip({ 'qualquer.txt': 'x' })), /xl\/workbook\.xml/);
});
