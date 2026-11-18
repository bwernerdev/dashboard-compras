// Ponte entre a tela e o worker de importação.

let worker = null;
let proximoId = 1;
const pendentes = new Map();

const cancelada = () => new DOMException('Importação cancelada.', 'AbortError');

/** Worker caiu (erro ao carregar o script, erro fora do try, mensagem que não chega): nada fica esperando. */
function falharTodas(mensagem) {
  const lista = [...pendentes.values()];
  pendentes.clear();
  worker?.terminate();
  worker = null;
  for (const p of lista) p.rejeitar(new Error(mensagem));
}

function obterWorker() {
  if (!worker) {
    worker = new Worker(new URL('./importacao.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (ev) => {
      const { id, evento } = ev.data;
      const p = pendentes.get(id);
      if (!p) return; // cancelada: o worker ainda pode mandar progresso ou o fim
      if (evento === 'progresso') p.aoAvancar?.(ev.data.fracao, ev.data.fase);
      else {
        pendentes.delete(id);
        if (evento === 'ok') p.resolver(ev.data.resultado);
        else p.rejeitar(new Error(ev.data.mensagem));
      }
    };
    worker.onerror = (ev) => {
      ev.preventDefault();
      falharTodas(`A leitura parou (${ev.message || 'erro no leitor'}). Tente de novo; se repetir, recarregue a página.`);
    };
    worker.onmessageerror = () => falharTodas('A leitura parou (resposta do leitor ilegível). Tente de novo.');
  }
  return worker;
}

/**
 * Importa um arquivo no worker. Retorna { tipo, registros, meta }.
 * sinal (AbortSignal): cancela; a promessa rejeita na hora com AbortError. Sem outra importação em
 * andamento, o worker é encerrado (mesmo travado); com outra, ele recebe o pedido de cancelar esta.
 */
export function importarNoWorker(tipo, arquivo, { hoje, config, aoAvancar, sinal } = {}) {
  return new Promise((resolver, rejeitar) => {
    if (sinal?.aborted) { rejeitar(cancelada()); return; }
    const id = proximoId++;
    const aoCancelar = () => {
      if (!pendentes.delete(id)) return;
      if (pendentes.size === 0) { worker?.terminate(); worker = null; }
      else worker?.postMessage({ cancelar: id });
      rejeitar(cancelada());
    };
    const fim = (acao) => (valor) => { sinal?.removeEventListener('abort', aoCancelar); acao(valor); };
    pendentes.set(id, { resolver: fim(resolver), rejeitar: fim(rejeitar), aoAvancar });
    sinal?.addEventListener('abort', aoCancelar, { once: true });
    obterWorker().postMessage({ id, tipo, arquivo, hoje, config });
  });
}
