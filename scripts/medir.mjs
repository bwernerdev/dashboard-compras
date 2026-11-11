// Mede a importação das bases reais no Node (aproxima o tempo do navegador).
// Uso: npm run medir -- base.xlsx Follow-Up.xlsx
// Sem argumentos, procura base.xlsx e Follow-Up.xlsx na raiz do projeto.

import { openAsBlob, existsSync } from 'node:fs';
import { importar } from '../src/importar.js';
import { criarConfig } from '../src/config/index.js';
import { hojeSerie, formatarSerie } from '../src/datas.js';

const [caminhoBase = 'base.xlsx', caminhoFu = 'Follow-Up.xlsx'] = process.argv.slice(2);
const cfg = criarConfig();
const META_SEGUNDOS = 20;

for (const [tipo, caminho] of [['base', caminhoBase], ['followUp', caminhoFu]]) {
  if (!existsSync(caminho)) { console.log(`${tipo}: arquivo ${caminho} não encontrado, pulei.`); continue; }
  const r = await importar(tipo, await openAsBlob(caminho), cfg, { hoje: hojeSerie() });
  const m = r.meta;
  const g = m.dadosGerais;
  const s = m.duracaoMs / 1000;
  console.log(`${tipo.padEnd(9)} ${caminho}: ${m.lidas} linhas lidas, ${m.mantidas} mantidas, `
    + `período ${formatarSerie(g.inicio)} a ${formatarSerie(g.fim)}, ${s.toFixed(1)} s `
    + `${s <= META_SEGUNDOS ? '(dentro da meta)' : `(ACIMA da meta de ${META_SEGUNDOS} s)`}, `
    + `memória ${Math.round(process.memoryUsage().rss / 1e6)} MB`);
}
