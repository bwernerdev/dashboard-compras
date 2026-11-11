// Ponte entre a tela e o worker de importação.

let worker = null;
let proximoId = 1;
const pendentes = new Map();

function obterWorker() {
  if (!worker) {
    worker = new Worker(new URL('./importacao.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (ev) => {
      const { id, evento } = ev.data;
      const p = pendentes.get(id);
      if (!p) return;
      if (evento === 'progresso') p.aoAvancar?.(ev.data.fracao, ev.data.fase);
      else {
        pendentes.delete(id);
        if (evento === 'ok') p.resolver(ev.data.resultado);
        else p.rejeitar(new Error(ev.data.mensagem));
      }
    };
  }
  return worker;
}

/** Importa um arquivo no worker. Retorna { tipo, registros, meta }. */
export function importarNoWorker(tipo, arquivo, { hoje, config, aoAvancar } = {}) {
  return new Promise((resolver, rejeitar) => {
    const id = proximoId++;
    pendentes.set(id, { resolver, rejeitar, aoAvancar });
    obterWorker().postMessage({ id, tipo, arquivo, hoje, config });
  });
}
