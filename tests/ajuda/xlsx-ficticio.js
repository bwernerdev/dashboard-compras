// Monta um .xlsx mínimo em memória para os testes (dados fictícios, nada da empresa).

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

async function compactar(bytes) {
  const fluxo = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** Zip com as partes dadas ({ caminho: texto }), compactadas com deflate. */
export async function criarZip(partes) {
  const enc = new TextEncoder();
  const locais = [];
  const centrais = [];
  let deslocamento = 0;
  for (const [nome, texto] of Object.entries(partes)) {
    const nomeB = enc.encode(nome);
    const dados = enc.encode(texto);
    const comp = await compactar(dados);
    const crc = crc32(dados);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, 8, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, comp.length, true);
    local.setUint32(22, dados.length, true);
    local.setUint16(26, nomeB.length, true);
    locais.push(new Uint8Array(local.buffer), nomeB, comp);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(10, 8, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, comp.length, true);
    central.setUint32(24, dados.length, true);
    central.setUint16(28, nomeB.length, true);
    central.setUint32(42, deslocamento, true);
    centrais.push(new Uint8Array(central.buffer), nomeB);

    deslocamento += 30 + nomeB.length + comp.length;
  }
  const tamCentral = centrais.reduce((s, b) => s + b.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, Object.keys(partes).length, true);
  fim.setUint16(10, Object.keys(partes).length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, deslocamento, true);
  return new Blob([...locais, ...centrais, new Uint8Array(fim.buffer)]);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function letra(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/**
 * .xlsx com as abas dadas: [{ nome, linhas: [[valor, ...], ...] }].
 * Texto vai para as strings compartilhadas; número fica como número; null/undefined = célula ausente.
 */
export async function criarXlsx(abas) {
  const strings = [];
  const indice = new Map();
  const idString = (s) => {
    if (!indice.has(s)) { indice.set(s, strings.length); strings.push(s); }
    return indice.get(s);
  };

  const partes = {};
  abas.forEach((aba, a) => {
    const linhas = aba.linhas.map((linha, l) => {
      const celulas = linha.map((v, c) => {
        if (v === null || v === undefined) return '';
        const ref = `${letra(c)}${l + 1}`;
        if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
        return `<c r="${ref}" t="s"><v>${idString(String(v))}</v></c>`;
      }).join('');
      return `<row r="${l + 1}">${celulas}</row>`;
    }).join('');
    partes[`xl/worksheets/sheet${a + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>${linhas}</sheetData></worksheet>`;
  });

  partes['xl/workbook.xml'] = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns:r="r"><sheets>${
    abas.map((aba, a) => `<sheet name="${esc(aba.nome)}" sheetId="${a + 1}" r:id="rId${a + 1}"/>`).join('')}</sheets></workbook>`;
  partes['xl/_rels/workbook.xml.rels'] = `<?xml version="1.0" encoding="UTF-8"?><Relationships>${
    abas.map((_, a) => `<Relationship Id="rId${a + 1}" Type="http://x/worksheet" Target="worksheets/sheet${a + 1}.xml"/>`).join('')
  }<Relationship Id="rIdS" Type="http://x/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
  partes['xl/sharedStrings.xml'] = `<?xml version="1.0" encoding="UTF-8"?><sst>${
    strings.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`;
  return criarZip(partes);
}
