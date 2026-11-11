// Leitor mínimo de .zip (o .xlsx é um zip) com acesso direto às partes.
// Lê só o diretório central e descompacta cada parte por fluxo, com o
// DecompressionStream nativo do navegador/Node: nada de carregar o arquivo inteiro.

const ASSINATURA_FIM = 0x06054b50;
const ASSINATURA_CENTRAL = 0x02014b50;
const ASSINATURA_LOCAL = 0x04034b50;

async function bytes(blob, inicio, fim) {
  return new DataView(await blob.slice(inicio, fim).arrayBuffer());
}

/** Abre um zip a partir de um Blob/File. Retorna { blob, partes: Map<nome, info> }. */
export async function abrirZip(blob) {
  const tamanho = blob.size;
  const tamCauda = Math.min(tamanho, 22 + 0xffff);
  const cauda = await bytes(blob, tamanho - tamCauda, tamanho);
  let fim = -1;
  for (let i = tamCauda - 22; i >= 0; i--) {
    if (cauda.getUint32(i, true) === ASSINATURA_FIM) { fim = i; break; }
  }
  if (fim < 0) throw new Error('O arquivo não é um .xlsx válido.');

  const quantidade = cauda.getUint16(fim + 10, true);
  const tamCentral = cauda.getUint32(fim + 12, true);
  const inicioCentral = cauda.getUint32(fim + 16, true);
  if (quantidade === 0xffff || inicioCentral === 0xffffffff) {
    throw new Error('Arquivo grande demais para o leitor (zip64). Avise o suporte do painel.');
  }

  const central = await bytes(blob, inicioCentral, inicioCentral + tamCentral);
  const partes = new Map();
  const decoder = new TextDecoder();
  let p = 0;
  for (let i = 0; i < quantidade; i++) {
    if (central.getUint32(p, true) !== ASSINATURA_CENTRAL) throw new Error('O arquivo .xlsx está corrompido.');
    const metodo = central.getUint16(p + 10, true);
    const tamCompactado = central.getUint32(p + 20, true);
    const tamOriginal = central.getUint32(p + 24, true);
    const tamNome = central.getUint16(p + 28, true);
    const tamExtra = central.getUint16(p + 30, true);
    const tamComentario = central.getUint16(p + 32, true);
    const deslocamento = central.getUint32(p + 42, true);
    const nome = decoder.decode(new Uint8Array(central.buffer, central.byteOffset + p + 46, tamNome));
    partes.set(nome, { nome, metodo, tamCompactado, tamOriginal, deslocamento });
    p += 46 + tamNome + tamExtra + tamComentario;
  }
  return { blob, partes };
}

/**
 * Fluxo de bytes descompactados de uma parte.
 * aoAvancar(fração 0..1) é chamado conforme os bytes compactados são lidos.
 */
export async function fluxoDaParte(zip, nome, aoAvancar) {
  const parte = zip.partes.get(nome);
  if (!parte) throw new Error(`Parte "${nome}" não encontrada no arquivo.`);
  const cab = await bytes(zip.blob, parte.deslocamento, parte.deslocamento + 30);
  if (cab.getUint32(0, true) !== ASSINATURA_LOCAL) throw new Error('O arquivo .xlsx está corrompido.');
  const inicio = parte.deslocamento + 30 + cab.getUint16(26, true) + cab.getUint16(28, true);
  let fluxo = zip.blob.slice(inicio, inicio + parte.tamCompactado).stream();

  if (aoAvancar && parte.tamCompactado > 0) {
    let lidos = 0;
    fluxo = fluxo.pipeThrough(new TransformStream({
      transform(pedaco, ctrl) {
        lidos += pedaco.byteLength;
        aoAvancar(lidos / parte.tamCompactado);
        ctrl.enqueue(pedaco);
      },
    }));
  }
  if (parte.metodo === 0) return fluxo;
  if (parte.metodo === 8) return fluxo.pipeThrough(new DecompressionStream('deflate-raw'));
  throw new Error(`Compressão ${parte.metodo} não suportada em "${nome}".`);
}

/** Texto (UTF-8) inteiro de uma parte pequena. */
export async function textoDaParte(zip, nome) {
  return new Response(await fluxoDaParte(zip, nome)).text();
}
