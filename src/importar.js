// Importação de um relatório do ME: lê o arquivo por fluxo, descarta as filiais
// fora do de-para, converte os tipos e aplica as regras. Roda no worker e no Node.

import { abrirPasta, lerAba, lerAbaInteira, CelulaErro } from './leitor/xlsx.js';
import { ESQUEMAS } from './esquema.js';
import { CALCULAR } from './regras.js';
import { normalizarCodigoFilial } from './config/index.js';
import { serieDeTexto } from './datas.js';

function converter(valor, tipo) {
  if (valor === undefined || valor === null) return null;
  if (valor instanceof CelulaErro) return tipo === 'bruto' ? String(valor) : null;
  switch (tipo) {
    case 'texto':
      return String(valor);
    case 'numero': {
      if (typeof valor === 'number') return valor;
      if (valor === '') return null;
      const n = Number(String(valor).replace(/\./g, '').replace(',', '.'));
      return Number.isNaN(n) ? null : n;
    }
    case 'data':
      if (typeof valor === 'number') return valor;
      return serieDeTexto(valor);
    default:
      return valor;
  }
}

/** Filtros da aba "Dados Gerais" (período, data de execução). */
async function lerDadosGerais(pasta) {
  const linhas = await lerAbaInteira(pasta, 'Dados Gerais');
  const filtros = {};
  for (const l of linhas ?? []) {
    if (!l || l[0] === undefined || l[0] === 'Nome do filtro') continue;
    const valor = l[1] === undefined ? '' : String(l[1]);
    // A lista de filiais pode ter milhares de códigos: guarda só o começo.
    filtros[String(l[0])] = valor.length > 120 ? `${valor.slice(0, 117)}...` : valor;
  }
  return {
    filtros,
    inicio: serieDeTexto(filtros['Data Inicio']),
    fim: serieDeTexto(filtros['Data Fim']),
    execucao: serieDeTexto(filtros['Data de Execução do Relatório']),
  };
}

/**
 * Importa um arquivo.
 * tipo: 'base' | 'followUp'. cfg: resultado de criarConfig(). hoje: série do dia.
 * aoAvancar(fração 0..1, fase) informa o progresso.
 * Para conferência com a planilha antiga (scripts/conferir-xlsm.mjs):
 *   aba: outra aba com as mesmas colunas; filtrar: false mantém todas as filiais;
 *   extras: nomes de colunas a mais, gravados em registro.planilha.
 */
export async function importar(tipo, arquivo, cfg, {
  hoje, aoAvancar, sinal, aba, filtrar = true, extras = [],
} = {}) {
  const esquema = ESQUEMAS[tipo];
  if (!esquema) throw new Error(`Tipo de importação desconhecido: ${tipo}`);
  const calcular = CALCULAR[tipo];
  const inicio = Date.now();

  aoAvancar?.(0, 'Abrindo arquivo');
  const pasta = await abrirPasta(arquivo);
  const dadosGerais = await lerDadosGerais(pasta);
  aoAvancar?.(0, 'Carregando textos');
  await pasta.strings();

  const chaves = Object.keys(esquema.colunas);
  const tipos = chaves.map((k) => esquema.colunas[k][1]);
  let indices = null;
  let iCodigo = -1;
  const registros = [];
  let lidas = 0;
  let descartadas = 0;

  let indicesExtras = [];

  await lerAba(pasta, aba ?? esquema.aba, {
    sinal,
    aoAvancar: (f) => aoAvancar?.(f, 'Lendo linhas'),
    aoCabecalho(cabecalho) {
      const posicao = new Map();
      cabecalho.forEach((nome, i) => { if (!posicao.has(nome)) posicao.set(nome, i); });
      cabecalho.forEach((nome, i) => { if (!posicao.has(nome.trim())) posicao.set(nome.trim(), i); });
      indicesExtras = extras.map((nome) => {
        if (!posicao.has(nome)) throw new Error(`Coluna extra "${nome}" não encontrada.`);
        return posicao.get(nome);
      });
      const faltando = [];
      indices = chaves.map((k) => {
        const i = posicao.get(esquema.colunas[k][0]);
        if (i === undefined) faltando.push(esquema.colunas[k][0]);
        return i;
      });
      if (faltando.length) {
        throw new Error(`O arquivo não parece ser o relatório "${esquema.rotulo}". Colunas que faltam: ${faltando.join(', ')}.`);
      }
      iCodigo = indices[chaves.indexOf('codigoFilial')];
      return [...indices, ...indicesExtras];
    },
    aoLinha(valores) {
      if (valores[iCodigo] === undefined) return; // linha sem dado (formatação, linha em branco)
      lidas++;
      if (filtrar && !cfg.codigosFiliais.has(normalizarCodigoFilial(valores[iCodigo]))) { descartadas++; return; }
      const r = {};
      for (let k = 0; k < chaves.length; k++) {
        r[chaves[k]] = converter(valores[indices[k]], tipos[k]);
      }
      const registro = calcular(r, cfg, hoje);
      if (extras.length) {
        registro.planilha = {};
        extras.forEach((nome, k) => { registro.planilha[nome] = valores[indicesExtras[k]] ?? null; });
      }
      registros.push(registro);
    },
  });

  aoAvancar?.(1, 'Concluído');
  return {
    tipo,
    registros,
    meta: {
      arquivo: arquivo.name ?? null,
      lidas,
      mantidas: registros.length,
      descartadas,
      dadosGerais,
      hoje,
      duracaoMs: Date.now() - inicio,
    },
  };
}
