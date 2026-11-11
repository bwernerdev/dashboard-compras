// Worker de importação: lê e calcula fora da thread da tela, para ela não congelar.
// Mensagem de entrada: { id, tipo: 'base' | 'followUp', arquivo: File, config?, hoje }.
// Saída: { id, evento: 'progresso', fracao, fase } | { id, evento: 'ok', resultado } | { id, evento: 'erro', mensagem }.

import { importar } from './importar.js';
import { criarConfig } from './config/index.js';

let ultimoEnvio = 0;

self.onmessage = async (ev) => {
  const { id, tipo, arquivo, config, hoje } = ev.data;
  try {
    const resultado = await importar(tipo, arquivo, criarConfig(config ?? undefined), {
      hoje,
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
  }
};
