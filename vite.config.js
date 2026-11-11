import { defineConfig } from 'vite';

// Caminhos relativos: o app precisa abrir em subpasta e, na fase 3, como arquivo local.
export default defineConfig({
  base: './',
  worker: { format: 'es' },
});
