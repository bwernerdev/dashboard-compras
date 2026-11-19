// Fronteira do painel publicado: o painel (src/painel/painel.js, entrada de vite.painel.config.js)
// não pode alcançar, por nenhum caminho de import, o que é só da equipe: o de-para (src/config/),
// a importação (importar.js, importacao*.js), a memória local (memoria.js) nem a tela SCs por
// Comprador. O repositório é público e o painel vai para a Intranet; antes só a disciplina nos imports
// garantia isso. Lê os imports estáticos do código-fonte (sem build).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRADA = resolve(raiz, 'src/painel/painel.js');

const PROIBIDOS = [
  /^src\/config\//,
  /^src\/importar\.js$/,
  /^src\/importacao(\.worker)?\.js$/,
  /^src\/memoria\.js$/,
  /^src\/telas\/compradores\.js$/,
  /^src\/telas\/configuracao\.js$/,
  /^src\/telas\/importacao\.js$/,
];

/** Imports relativos de um arquivo (estáticos, export ... from e import() literal), sem ?raw/?inline. */
function importsDe(arquivo) {
  // Sem comentários: o JSDoc tem import('./tipos') só de tipo, que não entra no build.
  const codigo = readFileSync(arquivo, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const caminhos = [...codigo.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => m[1].split('?')[0]);
  return caminhos.map((c) => resolve(dirname(arquivo), c));
}

/** Todos os arquivos alcançados a partir da entrada, com o caminho de imports até cada um. */
function alcancados(entrada) {
  const vistos = new Map([[entrada, [entrada]]]);
  const fila = [entrada];
  while (fila.length) {
    const atual = fila.shift();
    if (!/\.m?js$/.test(atual)) continue; // .html, .webp, .css: sem imports
    for (const proximo of importsDe(atual)) {
      if (vistos.has(proximo)) continue;
      assert.ok(existsSync(proximo), `import quebrado em ${relative(raiz, atual)}: ${relative(raiz, proximo)}`);
      vistos.set(proximo, [...vistos.get(atual), proximo]);
      fila.push(proximo);
    }
  }
  return vistos;
}

const rel = (c) => relative(raiz, c).replaceAll('\\', '/');

test('painel publicado não alcança config, importação, memória nem telas internas', () => {
  const vistos = alcancados(ENTRADA);
  const proibidos = [...vistos].filter(([c]) => PROIBIDOS.some((p) => p.test(rel(c))));
  assert.deepEqual(proibidos.map(([, caminho]) => caminho.map(rel).join(' -> ')), []);
  // Sanidade: o percurso achou o painel de verdade (telas públicas e dados).
  const arquivos = new Set([...vistos.keys()].map(rel));
  for (const esperado of ['src/telas/publicas.js', 'src/painel/dados.js', 'src/ui/casca.js']) {
    assert.ok(arquivos.has(esperado), `${esperado} deveria estar no painel`);
  }
});

test('a verificação pega um import proibido (o app da equipe alcança o de-para)', () => {
  const app = [...alcancados(resolve(raiz, 'src/main.js')).keys()].map(rel);
  assert.ok(app.some((c) => PROIBIDOS[0].test(c)), 'src/main.js deveria alcançar src/config/');
});
