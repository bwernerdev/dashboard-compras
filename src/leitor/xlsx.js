// Leitura de .xlsx/.xlsm por fluxo: abre o zip, carrega as strings compartilhadas
// e percorre o XML da aba linha a linha, montando só as colunas pedidas.
// Fórmulas: usa o valor gravado (<v>), como o Excel mostra.

import { abrirZip, fluxoDaParte, textoDaParte } from './zip.js';

/** Célula com erro do Excel (#N/D, #VALOR! ...). */
export class CelulaErro {
  constructor(codigo) { this.codigo = codigo; }
  toString() { return this.codigo; }
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Decodifica entidades XML e os escapes _xHHHH_ que o Excel usa para caracteres de controle. */
export function decodificarXml(s) {
  if (s.indexOf('&') !== -1) {
    s = s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e) => (e[0] === '#'
      ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : ENTIDADES[e]));
  }
  if (s.indexOf('_x') !== -1) {
    s = s.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return s;
}

/** Junta o texto de todos os <t> (texto rico vem em vários), ignorando a fonética <rPh>. */
function textoDosT(xml) {
  if (xml.indexOf('<rPh') !== -1) xml = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let saida = '';
  let p = 0;
  while ((p = xml.indexOf('<t', p)) !== -1) {
    const c = xml.charCodeAt(p + 2);
    if (c !== 62 && c !== 32 && c !== 47) { p += 2; continue; } // não é <t>, <t ...> nem <t/>
    const gt = xml.indexOf('>', p);
    if (xml.charCodeAt(gt - 1) === 47) { p = gt + 1; continue; }
    const fim = xml.indexOf('</t>', gt);
    saida += xml.slice(gt + 1, fim);
    p = fim + 4;
  }
  return decodificarXml(saida);
}

/** Lista de strings de xl/sharedStrings.xml, na ordem do índice. */
export function lerStringsCompartilhadas(xml) {
  const lista = [];
  let p = 0;
  while ((p = xml.indexOf('<si', p)) !== -1) {
    const gt = xml.indexOf('>', p);
    if (xml.charCodeAt(gt - 1) === 47) { lista.push(''); p = gt + 1; continue; }
    const fim = xml.indexOf('</si>', gt);
    lista.push(textoDosT(xml.slice(gt + 1, fim)));
    p = fim + 5;
  }
  return lista;
}

/** "A" -> 0, "Z" -> 25, "AA" -> 26. */
export function indiceColuna(letras) {
  let n = 0;
  for (let i = 0; i < letras.length; i++) n = n * 26 + (letras.charCodeAt(i) - 64);
  return n - 1;
}

/**
 * Recebe o XML da aba em pedaços de qualquer tamanho e chama aoLinha(valores, número)
 * para cada <row> completa. valores[i] = valor da coluna i (vazio = undefined).
 */
export class LeitorDeLinhas {
  constructor(strings, aoLinha) {
    this.strings = strings;
    this.aoLinha = aoLinha;
    this.buf = '';
    this.ultimaLinha = 0;
    this.querColuna = null; // null = todas
  }

  /** Limita a leitura às colunas indicadas (índices 0-based). */
  definirColunas(indices) {
    const max = Math.max(-1, ...indices);
    this.querColuna = new Uint8Array(max + 1);
    for (const i of indices) this.querColuna[i] = 1;
  }

  empurrar(texto) {
    this.buf += texto;
    this.processar();
  }

  terminar() {
    this.processar();
    this.buf = '';
  }

  processar() {
    const b = this.buf;
    let pos = 0;
    for (;;) {
      const s = b.indexOf('<row', pos);
      if (s === -1) { this.buf = b.slice(Math.max(pos, b.length - 4)); return; }
      if (s + 4 >= b.length) { this.buf = b.slice(s); return; }
      const c = b.charCodeAt(s + 4);
      if (c !== 32 && c !== 62 && c !== 47) { pos = s + 4; continue; } // <rowBreaks> etc.
      const gt = b.indexOf('>', s);
      if (gt === -1) { this.buf = b.slice(s); return; }
      if (b.charCodeAt(gt - 1) === 47) { // <row .../> sem células
        this.numeroDaLinha(b, s, gt);
        pos = gt + 1;
        continue;
      }
      const fim = b.indexOf('</row>', gt);
      if (fim === -1) { this.buf = b.slice(s); return; }
      this.linha(b, s, gt, fim);
      pos = fim + 6;
    }
  }

  numeroDaLinha(b, s, gt) {
    const i = b.indexOf(' r="', s);
    const n = i !== -1 && i < gt ? parseInt(b.slice(i + 4, b.indexOf('"', i + 4)), 10) : this.ultimaLinha + 1;
    this.ultimaLinha = n;
    return n;
  }

  linha(b, s, gt, fim) {
    const numero = this.numeroDaLinha(b, s, gt);
    const quer = this.querColuna;
    const valores = [];
    let proxima = 0;
    let p = gt + 1;
    for (;;) {
      p = b.indexOf('<c', p);
      if (p === -1 || p >= fim) break;
      const c = b.charCodeAt(p + 2);
      if (c !== 32 && c !== 62 && c !== 47) { p += 2; continue; }
      const tagFim = b.indexOf('>', p);
      // Atributos procurados só dentro da tag: buscar no buffer todo ficaria quadrático.
      const tag = b.slice(p + 2, tagFim);

      let col = proxima;
      const ir = tag.indexOf(' r="');
      if (ir !== -1) {
        let q = ir + 4;
        while (tag.charCodeAt(q) >= 65 && tag.charCodeAt(q) <= 90) q++;
        col = indiceColuna(tag.slice(ir + 4, q));
      }
      proxima = col + 1;

      if (b.charCodeAt(tagFim - 1) === 47) { p = tagFim + 1; continue; } // <c .../> vazia
      const fecha = b.indexOf('</c>', tagFim);
      if (quer !== null && quer[col] !== 1) { p = fecha + 4; continue; }

      let tipo = '';
      const it = tag.indexOf(' t="');
      if (it !== -1) tipo = tag.slice(it + 4, tag.indexOf('"', it + 4));

      let valor;
      if (tipo === 'inlineStr') {
        valor = textoDosT(b.slice(tagFim + 1, fecha));
      } else {
        const iv = b.indexOf('<v>', tagFim);
        if (iv !== -1 && iv < fecha) {
          const bruto = b.slice(iv + 3, b.indexOf('</v>', iv));
          switch (tipo) {
            case 's': valor = this.strings[Number(bruto)]; break;
            case 'str': valor = decodificarXml(bruto); break;
            case 'b': valor = bruto === '1'; break;
            case 'e': valor = new CelulaErro(bruto); break;
            case 'd': valor = bruto; break;
            default: valor = Number(bruto);
          }
        }
      }
      if (valor !== undefined) valores[col] = valor;
      p = fecha + 4;
    }
    this.aoLinha(valores, numero);
  }
}

function atributos(texto) {
  const o = {};
  for (const m of texto.matchAll(/([\w:]+)="([^"]*)"/g)) o[m[1]] = m[2];
  return o;
}

function resolverCaminho(alvo) {
  if (alvo.startsWith('/')) return alvo.slice(1);
  const partes = ['xl'];
  for (const p of alvo.split('/')) {
    if (p === '..') partes.pop();
    else if (p !== '.') partes.push(p);
  }
  return partes.join('/');
}

/** Abre uma pasta de trabalho: lista de abas e strings compartilhadas (carregadas sob demanda). */
export async function abrirPasta(blob) {
  const zip = await abrirZip(blob);
  const wbXml = await textoDaParte(zip, 'xl/workbook.xml');
  const relsXml = await textoDaParte(zip, 'xl/_rels/workbook.xml.rels');

  const rels = new Map();
  let caminhoStrings = null;
  for (const m of relsXml.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const a = atributos(m[1]);
    const alvo = resolverCaminho(a.Target);
    rels.set(a.Id, alvo);
    if (/\/sharedStrings$/.test(a.Type)) caminhoStrings = alvo;
  }

  const abas = [];
  for (const m of wbXml.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const a = atributos(m[1]);
    const idRel = Object.keys(a).find((k) => /(^|:)id$/.test(k));
    abas.push({ nome: decodificarXml(a.name), caminho: rels.get(a[idRel]) });
  }

  let strings = null;
  return {
    zip,
    abas,
    async strings() {
      if (strings === null) {
        strings = caminhoStrings && zip.partes.has(caminhoStrings)
          ? lerStringsCompartilhadas(await textoDaParte(zip, caminhoStrings))
          : [];
      }
      return strings;
    },
  };
}

/**
 * Percorre uma aba. A primeira linha com conteúdo é o cabeçalho:
 * aoCabecalho(nomes) devolve os índices de coluna a ler (ou null = todas).
 * aoLinha(valores, número) recebe as demais linhas.
 */
export async function lerAba(pasta, nomeAba, { aoCabecalho, aoLinha, aoAvancar, sinal } = {}) {
  const aba = pasta.abas.find((a) => a.nome === nomeAba);
  if (!aba) {
    throw new Error(`Aba "${nomeAba}" não encontrada. Abas do arquivo: ${pasta.abas.map((a) => a.nome).join(', ')}.`);
  }
  const strings = await pasta.strings();
  let cabecalho = null;
  const leitor = new LeitorDeLinhas(strings, (valores, numero) => {
    if (cabecalho === null) {
      cabecalho = Array.from(valores, (v) => (v === undefined || v === null ? '' : String(v)));
      const colunas = aoCabecalho ? aoCabecalho(cabecalho) : null;
      if (colunas) leitor.definirColunas(colunas);
      return;
    }
    aoLinha?.(valores, numero);
  });

  const fluxo = (await fluxoDaParte(pasta.zip, aba.caminho, aoAvancar)).pipeThrough(new TextDecoderStream());
  const leitura = fluxo.getReader();
  for (;;) {
    const { done, value } = await leitura.read();
    if (done) break;
    if (sinal?.aborted) {
      await leitura.cancel();
      throw new DOMException('Importação cancelada.', 'AbortError');
    }
    leitor.empurrar(value);
  }
  leitor.terminar();
  if (cabecalho === null) throw new Error(`A aba "${nomeAba}" está vazia.`);
}

/**
 * Lê uma aba pequena inteira como matriz de valores (sem tratar cabeçalho).
 * linhas[n - 1] = linha n da planilha; linhas vazias ficam como buraco (undefined).
 */
export async function lerAbaInteira(pasta, nomeAba) {
  const aba = pasta.abas.find((a) => a.nome === nomeAba);
  if (!aba) return null;
  const linhas = [];
  const leitor = new LeitorDeLinhas(await pasta.strings(), (valores, numero) => { linhas[numero - 1] = valores; });
  leitor.empurrar(await textoDaParte(pasta.zip, aba.caminho));
  leitor.terminar();
  return linhas;
}
