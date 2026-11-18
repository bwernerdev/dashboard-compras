// Cópia do arquivo escolhido para a memória, numa leitura só e em sequência, com progresso.
// Usada pela tela antes de mandar o arquivo ao worker (src/main.js) e por src/importar.js.

/**
 * Copia o arquivo inteiro para a memória, numa leitura em sequência, antes de abrir.
 * O leitor de zip pula entre partes do arquivo (fim, diretório, cabeçalho de cada parte): direto
 * de uma pasta de rede, cada pulo é uma ida e volta ao servidor e a importação parecia parada em
 * "Abrindo arquivo". Lido de uma vez, com progresso, o resto roda na memória.
 */
export async function copiarParaMemoria(arquivo, { aoAvancar, sinal } = {}) {
  const total = arquivo.size;
  const pedacos = [];
  let lidos = 0;
  const leitor = arquivo.stream().getReader();
  try {
    for (;;) {
      if (sinal?.aborted) throw new DOMException('Importação cancelada.', 'AbortError');
      const { done, value } = await leitor.read();
      if (done) break;
      pedacos.push(value);
      lidos += value.byteLength;
      aoAvancar?.(total ? lidos / total : 1);
    }
  } finally {
    leitor.releaseLock();
  }
  // Mantém o nome (meta.arquivo, textos da tela); sem nome (Node, testes), um Blob.
  return arquivo.name ? new File(pedacos, arquivo.name, { type: arquivo.type }) : new Blob(pedacos);
}

