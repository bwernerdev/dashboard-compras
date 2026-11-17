// Lê a planilha CONTROLE DE CONTRATOS (.xlsx) escolhida na importação. Só no app da equipe
// (usa o leitor de xlsx); o painel recebe o resultado pronto, dentro dos dados.
import { abrirPasta, lerAbaInteira } from '../leitor/xlsx.js';
import { ABAS, lerBlocosDaAba, normalizarCabecalho } from './dados.js';

/**
 * Retorna { abas: { [id]: [{ titulo, campos, linhas }] (quadros da aba) }, meta: { tipo: 'contratos', arquivo, linhas, duracaoMs } }.
 * Aba que falta na planilha fica de fora. Sem nenhuma das abas: erro com mensagem para a tela.
 */
export async function lerContratos(arquivo) {
  const inicio = Date.now();
  let pasta;
  try {
    pasta = await abrirPasta(arquivo);
  } catch {
    throw new Error('O arquivo não é um .xlsx válido.');
  }
  const abas = {};
  for (const a of ABAS) {
    const aba = pasta.abas.find((x) => normalizarCabecalho(x.nome) === normalizarCabecalho(a.nome));
    if (!aba) continue;
    const blocos = lerBlocosDaAba(await lerAbaInteira(pasta, aba.nome), a.id);
    if (blocos.length) abas[a.id] = blocos;
  }
  if (!Object.keys(abas).length) {
    throw new Error(`Não parece a planilha de contratos: faltam as abas ${ABAS.map((a) => `"${a.nome}"`).join(', ')}.`);
  }
  return {
    abas,
    meta: {
      tipo: 'contratos',
      arquivo: arquivo.name ?? null,
      linhas: Object.values(abas).flat().reduce((s, b) => s + b.linhas.length, 0),
      duracaoMs: Date.now() - inicio,
    },
  };
}
