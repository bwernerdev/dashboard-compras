// "Gerar painel" (app da equipe): junta o modelo pronto (modelo.gerado.html, saído de
// `npm run build:painel`) com os dados públicos compactados. Resultado: um .html único.
import modelo from './modelo.gerado.html?raw';
import { montarDadosDoPainel, compactar } from './dados.js';

export const NOME_DO_ARQUIVO = 'painel-compras.html';
const MARCA = '__DADOS_DO_PAINEL__';

/** Texto do painel-compras.html com os registros calculados de hoje. */
export async function gerarPainel({ registros, followUp = null, meta, hoje }) {
  if (!modelo.includes(MARCA)) throw new Error('Modelo do painel sem a marca de dados: rode npm run build:painel.');
  const dados = await compactar(montarDadosDoPainel({ registros, followUp, meta, hoje, geradoEm: new Date().toISOString() }));
  return modelo.replace(MARCA, () => dados);
}
