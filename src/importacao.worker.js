// Worker de importação: lê e calcula fora da thread da tela, para ela não congelar.
// Mensagem de entrada: { id, tipo: 'base' | 'followUp', arquivo: File, config?, hoje } ou { cancelar: id }.
// Saída: { id, evento: 'progresso', fracao, fase } | { id, evento: 'ok', resultado } | { id, evento: 'erro', mensagem }.

import { importar } from './importar.js';
import { criarConfig } from './config/index.js';

const controles = new Map(); // id -> AbortController das importações em andamento

self.onmessage = async (ev) => {
  if (ev.data.cancelar !== undefined) { controles.get(ev.data.cancelar)?.abort(); return; }
  const { id, tipo, arquivo, config, hoje } = ev.data;
  const controle = new AbortController();
  controles.set(id, controle);
  let ultimoEnvio = 0; // por importação: Base e Follow-Up ao mesmo tempo não engolem o progresso uma da outra
  try {
    const resultado = await importar(tipo, arquivo, criarConfig(config ?? undefined), {
      hoje,
      sinal: controle.signal,
      copiar: false, // a tela já mandou a cópia na memória (src/main.js)
      aoAvancar(fracao, fase) {
        const agora = Date.now();
        if (fracao < 1 && agora - ultimoEnvio < 80) return; // no máximo ~12 avisos por segundo
        ultimoEnvio = agora;
        self.postMessage({ id, evento: 'progresso', fracao, fase });
      },
    });
    self.postMessage({ id, evento: 'ok', resultado });
  } catch (erro) {
    self.postMessage({ id, evento: 'erro', mensagem: erro?.message ?? String(erro) });
  } finally {
    controles.delete(id);
  }
};
