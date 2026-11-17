// "Exportar Excel" das tabelas (ui/tabela.js): planilha do Excel de verdade, sem dependência.
// Número fica número, data fica data (dd/mm/aaaa no Excel em pt-BR), % e R$ com o formato do Excel
// (pelo `formato` da coluna ou `formatoExcel: 'pct' | 'moeda'`), texto nas strings compartilhadas.
// Cabeçalho em negrito, congelado e com filtro; largura de cada coluna pelo maior texto.
// `criarZip` também monta os .xlsx fictícios dos testes (tests/ajuda/xlsx-ficticio.js).
import { exportaveis } from './tabela-exportar.js';
import * as fmt from './formatos.js';

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Deflate nativo (CompressionStream); sem ele, guarda sem compactar (método 0). */
async function compactar(bytes) {
  if (typeof CompressionStream === 'undefined') return { metodo: 0, dados: bytes };
  const fluxo = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return { metodo: 8, dados: new Uint8Array(await new Response(fluxo).arrayBuffer()) };
}

/** Data e hora no formato do zip (MS-DOS). */
function dataDos(d) {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    data: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Zip com as partes dadas ({ caminho: texto }). Retorna um Blob. */
export async function criarZip(partes) {
  const enc = new TextEncoder();
  const { hora, data } = dataDos(new Date());
  const locais = [];
  const centrais = [];
  let deslocamento = 0;
  for (const [nome, texto] of Object.entries(partes)) {
    const nomeB = enc.encode(nome);
    const original = enc.encode(texto);
    const { metodo, dados } = await compactar(original);
    const crc = crc32(original);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, metodo, true);
    local.setUint16(10, hora, true);
    local.setUint16(12, data, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, dados.length, true);
    local.setUint32(22, original.length, true);
    local.setUint16(26, nomeB.length, true);
    locais.push(new Uint8Array(local.buffer), nomeB, dados);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(10, metodo, true);
    central.setUint16(12, hora, true);
    central.setUint16(14, data, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, dados.length, true);
    central.setUint32(24, original.length, true);
    central.setUint16(28, nomeB.length, true);
    central.setUint32(42, deslocamento, true);
    centrais.push(new Uint8Array(central.buffer), nomeB);

    deslocamento += 30 + nomeB.length + dados.length;
  }
  const quantidade = Object.keys(partes).length;
  const tamCentral = centrais.reduce((s, b) => s + b.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, quantidade, true);
  fim.setUint16(10, quantidade, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, deslocamento, true);
  return new Blob([...locais, ...centrais, new Uint8Array(fim.buffer)]);
}

/** Texto seguro para XML: escapa & < > " e tira caracteres de controle que o Excel recusa. */
// eslint-disable-next-line no-control-regex
const CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
const esc = (s) => String(s).replace(CONTROLE, '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Letra da coluna: 0 = A, 25 = Z, 26 = AA. */
export function letraDaColuna(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Nome de aba aceito pelo Excel: até 31 caracteres, sem : \ / ? * [ ]. */
const nomeDeAba = (s) => String(s || 'Planilha').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Planilha';

// Estilos (cellXfs): 0 normal, 1 cabeçalho em negrito, 2 data, 3 inteiro, 4 decimal, 5 % com 2 casas,
// 6 R$ com centavos (formato 164, próprio; o Excel mostra com os separadores do computador).
const ESTILO = { cabecalho: 1, data: 2, inteiro: 3, decimal: 4, pct: 5, moeda: 6 };

/** Formato do Excel pelo formato da tela: % e R$ ficam número com o formato certo. */
const FORMATO_EXCEL = new Map([
  [fmt.pct, 'pct'], [fmt.pctFino, 'pct'], [fmt.moeda, 'moeda'], [fmt.moedaCentavos, 'moeda'], [fmt.moedaCompacta, 'moeda'],
]);
const formatoExcel = (coluna) => coluna.formatoExcel ?? FORMATO_EXCEL.get(coluna.formato);
const ESTILOS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/></numFmts>'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'
  + '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="7">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
  + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const CABECALHO_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const TIPO_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/**
 * Planilha .xlsx (Blob) com as colunas exportáveis e as linhas dadas, um item por linha.
 * Data (coluna `tipo: 'data'`, série do Excel) vira data; % e R$ viram número com formato; número vira
 * número; vazio fica sem célula.
 */
export async function gerarXlsx(todas, linhas, { aba = 'Planilha' } = {}) {
  const colunas = exportaveis(todas);
  const strings = [];
  const indice = new Map();
  const idString = (s) => {
    if (!indice.has(s)) { indice.set(s, strings.length); strings.push(s); }
    return indice.get(s);
  };
  const larguras = colunas.map((c) => String(c.rotulo).length + 4); // + espaço da seta do filtro

  const celula = (ref, v, coluna, i) => {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return '';
      const especial = coluna.tipo === 'data' ? 'data' : formatoExcel(coluna);
      const estilo = especial ? ESTILO[especial] : Number.isInteger(v) ? ESTILO.inteiro : ESTILO.decimal;
      const largura = especial === 'data' ? 12 : especial === 'pct' ? 10
        : String(Math.round(v * 100) / 100).length + (especial === 'moeda' ? 8 : 3);
      larguras[i] = Math.max(larguras[i], largura);
      return `<c r="${ref}" s="${estilo}"><v>${v}</v></c>`;
    }
    const texto = String(v);
    larguras[i] = Math.max(larguras[i], texto.length + 1);
    return `<c r="${ref}" t="s"><v>${idString(texto)}</v></c>`;
  };

  const letras = colunas.map((_, i) => letraDaColuna(i));
  const cabecalho = `<row r="1">${colunas.map((c, i) => `<c r="${letras[i]}1" t="s" s="${ESTILO.cabecalho}"><v>${idString(String(c.rotulo))}</v></c>`).join('')}</row>`;
  const corpo = linhas.map((l, n) => {
    const r = n + 2;
    return `<row r="${r}">${colunas.map((c, i) => celula(`${letras[i]}${r}`, c.valor(l), c, i)).join('')}</row>`;
  }).join('');

  const ultima = letras[letras.length - 1] ?? 'A';
  const area = `A1:${ultima}${linhas.length + 1}`;
  const cols = colunas.map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(8, larguras[i]))}" customWidth="1"/>`).join('');
  const nome = nomeDeAba(aba);

  return criarZip({
    '[Content_Types].xml': `${CABECALHO_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
      + '</Types>',
    '_rels/.rels': `${CABECALHO_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="${TIPO_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${CABECALHO_XML}<workbook ${NS}><sheets><sheet name="${esc(nome)}" sheetId="1" r:id="rId1"/></sheets>`
      + `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${esc(nome.replace(/'/g, "''"))}'!$A$1:$${ultima}$${linhas.length + 1}</definedName></definedNames>`
      + '</workbook>',
    'xl/_rels/workbook.xml.rels': `${CABECALHO_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="${TIPO_REL}/worksheet" Target="worksheets/sheet1.xml"/>`
      + `<Relationship Id="rId2" Type="${TIPO_REL}/styles" Target="styles.xml"/>`
      + `<Relationship Id="rId3" Type="${TIPO_REL}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `${CABECALHO_XML}<worksheet ${NS}><dimension ref="${area}"/>`
      + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
      + '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>'
      + `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${cabecalho}${corpo}</sheetData>`
      + `<autoFilter ref="${area}"/></worksheet>`,
    'xl/styles.xml': ESTILOS,
    'xl/sharedStrings.xml': `${CABECALHO_XML}<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">`
      + `${strings.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`,
  });
}
