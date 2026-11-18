import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

// Versão mostrada no rodapé dos diálogos (ex.: "Atualizar bases"): data e hora do build e commit.
// Serve para conferir se o navegador já está com a versão publicada (cache).
function versao() {
  let commit = 'local';
  try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* sem git */ }
  const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  return `${quando} (${commit})`;
}

// Caminhos relativos: o app precisa abrir em subpasta e, na fase 3, como arquivo local.
export default defineConfig({
  base: './',
  worker: { format: 'es' },
  define: { __VERSAO__: JSON.stringify(versao()) },
});
