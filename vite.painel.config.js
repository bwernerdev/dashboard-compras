// Build do modelo do painel publicado (fase 3): empacota src/painel/painel.js (JS + CSS) num
// script único e encaixa tudo em src/painel/modelo.html. Resultado: src/painel/modelo.gerado.html,
// que o app importa (?raw) e completa com os dados na hora de "Gerar painel".
// Roda antes do dev e do build (package.json: predev, prebuild). Não versionar o gerado.
import { defineConfig } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pasta = fileURLToPath(new URL('./src/painel/', import.meta.url));

function montarModelo() {
  return {
    name: 'montar-modelo-do-painel',
    generateBundle: {
      order: 'post',
      handler(_opcoes, bundle) {
        const arquivos = Object.values(bundle);
        const js = arquivos.filter((a) => a.type === 'chunk').map((a) => a.code).join('\n');
        const css = arquivos.filter((a) => a.type === 'asset' && a.fileName.endsWith('.css')).map((a) => String(a.source)).join('\n');
        if (!js) throw new Error('Build do painel sem JS.');
        if (!css) throw new Error('Build do painel sem CSS.');
        const modelo = readFileSync(`${pasta}modelo.html`, 'utf8');
        for (const marca of ['/*CSS*/', '/*JS*/', '__DADOS_DO_PAINEL__']) {
          if (modelo.split(marca).length !== 2) throw new Error(`modelo.html precisa ter ${marca} uma vez.`);
        }
        // Texto "</script" ou "</style" dentro do código fecharia a tag antes da hora.
        const html = modelo
          .replace('/*CSS*/', () => css.replace(/<\/style/gi, '<\\/style'))
          .replace('/*JS*/', () => js.replace(/<\/script/gi, '<\\/script'));
        writeFileSync(`${pasta}modelo.gerado.html`, html);
        for (const nome of Object.keys(bundle)) delete bundle[nome];
      },
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [montarModelo()],
  build: {
    outDir: '.painel-build',
    emptyOutDir: true,
    minify: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/painel/painel.js',
      formats: ['iife'],
      name: 'PainelCompras',
      fileName: () => 'painel.js',
      cssFileName: 'painel',
    },
  },
});
