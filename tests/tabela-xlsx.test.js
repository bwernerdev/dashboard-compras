// "Exportar Excel": a planilha gerada abre no leitor do próprio app (mesmo formato do ME) com os tipos certos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarXlsx, letraDaColuna } from '../src/ui/tabela-xlsx.js';
import { abrirPasta, lerAbaInteira } from '../src/leitor/xlsx.js';
import { abrirZip, textoDaParte } from '../src/leitor/zip.js';
import { serie } from '../src/datas.js';
import * as fmt from '../src/ui/formatos.js';

const COLUNAS = [
  { id: 'olho', rotulo: 'Olho', controle: true, valor: () => 'x' },
  { id: 'dias', rotulo: 'Dias', valor: (l) => l.dias },
  { id: 'nome', rotulo: 'Nome', valor: (l) => l.nome },
  { id: 'valor', rotulo: 'Valor', valor: (l) => l.valor },
  { id: 'data', rotulo: 'Data', tipo: 'data', valor: (l) => l.data },
];
const LINHAS = [
  { dias: 12, nome: 'A & B <teste> "x"', valor: 1.5, data: serie(2026, 11, 11) },
  { dias: 3, nome: 'A & B <teste> "x"', valor: null, data: null },
  { dias: null, nome: 'Linha\u0007com controle', valor: Number.NaN, data: null },
];

test('gerarXlsx: abre no leitor, um item por linha, sem coluna de controle, número e data como número', async () => {
  const pasta = await abrirPasta(await gerarXlsx(COLUNAS, LINHAS, { aba: 'Atendimento' }));
  assert.deepEqual(pasta.abas.map((a) => a.nome), ['Atendimento']);
  const linhas = await lerAbaInteira(pasta, 'Atendimento');
  assert.deepEqual(linhas[0], ['Dias', 'Nome', 'Valor', 'Data']);
  assert.deepEqual(linhas[1], [12, 'A & B <teste> "x"', 1.5, serie(2026, 11, 11)]);
  assert.equal(linhas[2][0], 3);
  assert.equal(linhas[2][2] ?? null, null);
  assert.equal(linhas[3][1], 'Linhacom controle'); // caractere de controle sai (o Excel recusa)
  assert.equal(linhas.length, 4);
});

test('gerarXlsx: cabeçalho em negrito, congelado e com filtro; data com formato de data', async () => {
  const zip = await abrirZip(await gerarXlsx(COLUNAS, LINHAS, { aba: 'Aba: com [ruins]?' }));
  const aba = await textoDaParte(zip, 'xl/worksheets/sheet1.xml');
  assert.match(aba, /<autoFilter ref="A1:D4"\/>/);
  assert.match(aba, /state="frozen"/);
  assert.match(aba, /<c r="A1" t="s" s="1">/);
  assert.match(aba, /<c r="D2" s="2"><v>\d+<\/v><\/c>/); // data
  assert.match(aba, /<c r="A2" s="3"><v>12<\/v><\/c>/); // inteiro
  assert.match(aba, /<c r="C2" s="4"><v>1.5<\/v><\/c>/); // decimal
  const livro = await textoDaParte(zip, 'xl/workbook.xml');
  assert.ok(livro.includes('name="Aba  com  ruins"'));
  assert.match(await textoDaParte(zip, '[Content_Types].xml'), /spreadsheetml\.sheet\.main\+xml/);
});

test('gerarXlsx: tabela sem linhas tem só o cabeçalho', async () => {
  const linhas = await lerAbaInteira(await abrirPasta(await gerarXlsx(COLUNAS, [], { aba: 'X' })), 'X');
  assert.deepEqual(linhas, [['Dias', 'Nome', 'Valor', 'Data']]);
});

test('gerarXlsx: % e R$ pelo formato da tela (ou formatoExcel) ficam número com formato do Excel', async () => {
  const colunas = [
    { id: 'pct', rotulo: '% Saving', valor: (l) => l.pct, formato: fmt.pctFino },
    { id: 'total', rotulo: 'Total', valor: (l) => l.total, formato: fmt.moedaCentavos },
    { id: 'contrato', rotulo: 'Valor', valor: (l) => l.contrato, formatoExcel: 'moeda', formato: String },
  ];
  const linhas = [{ pct: 0.1234, total: 1500.5, contrato: 'Conforme proposta' }, { pct: 0, total: 10, contrato: 99 }];
  const blob = await gerarXlsx(colunas, linhas, { aba: 'Saving' });
  const aba = await textoDaParte(await abrirZip(blob), 'xl/worksheets/sheet1.xml');
  assert.match(aba, /<c r="A2" s="5"><v>0.1234<\/v><\/c>/); // % (0,00%)
  assert.match(aba, /<c r="B2" s="6"><v>1500.5<\/v><\/c>/); // R$
  assert.match(aba, /<c r="C2" t="s">/); // texto continua texto
  assert.match(aba, /<c r="C3" s="6"><v>99<\/v><\/c>/);
  const estilos = await textoDaParte(await abrirZip(blob), 'xl/styles.xml');
  assert.match(estilos, /<numFmt numFmtId="164" formatCode="&quot;R\$&quot; #,##0.00"\/>/);
  assert.match(estilos, /<cellXfs count="7">/);
  assert.deepEqual((await lerAbaInteira(await abrirPasta(blob), 'Saving'))[1], [0.1234, 1500.5, 'Conforme proposta']);
});

test('letraDaColuna', () => {
  assert.deepEqual([0, 25, 26, 51, 52, 701, 702].map(letraDaColuna), ['A', 'Z', 'AA', 'AZ', 'BA', 'ZZ', 'AAA']);
});
