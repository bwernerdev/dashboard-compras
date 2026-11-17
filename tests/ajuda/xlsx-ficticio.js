// Monta um .xlsx mínimo em memória para os testes (dados fictícios, nada da empresa).

import { criarZip, letraDaColuna as letra } from '../../src/ui/tabela-xlsx.js';

export { criarZip };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
