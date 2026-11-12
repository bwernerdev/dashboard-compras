import { CONFIG_PADRAO } from './padrao.js';

// Chave de busca no estilo do Excel: PROCV ignora maiúsculas/minúsculas.
const chave = (v) => (v === null || v === undefined ? '' : String(v)).toUpperCase();

/** Código da filial sem ponto e sem espaços ("30.205" -> "30205"; 30205 -> "30205"). */
export function normalizarCodigoFilial(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[.\s]/g, '');
}

function primeiraOcorrencia(lista, fnChave) {
  const mapa = new Map();
  for (const item of lista) {
    const k = fnChave(item);
    if (!mapa.has(k)) mapa.set(k, item);
  }
  return mapa;
}

const padraoPorCodigo = primeiraOcorrencia(CONFIG_PADRAO.filiais, (f) => normalizarCodigoFilial(f.codigo));

/**
 * Monta as tabelas de busca a partir da configuração (padrão ou editada).
 * Cada busca reproduz um PROCV exato da planilha: primeira linha que bate.
 */
export function criarConfig(config = CONFIG_PADRAO) {
  const filiais = config.filiais ?? [];
  const porCodigo = primeiraOcorrencia(filiais, (f) => normalizarCodigoFilial(f.codigo));
  const porAjustada = primeiraOcorrencia(filiais, (f) => chave(f.ajustada));
  const compradores = primeiraOcorrencia(config.compradores ?? [], (c) => chave(c.nome));

  return {
    original: config,
    /** Conjunto de códigos aceitos na importação (as demais filiais são descartadas). */
    codigosFiliais: new Set(porCodigo.keys()),
    /** PROCV(código; Base Analitico!A:C; 3) -> filial ajustada, ou null. */
    filialAjustada(codigo) {
      const f = porCodigo.get(normalizarCodigoFilial(codigo));
      return f ? String(f.ajustada) : null;
    },
    /** PROCV(filial ajustada; Base Analitico!C:E) -> { nome, regional }, ou null. */
    dadosFilial(ajustada) {
      const f = porAjustada.get(chave(ajustada));
      return f ? { nome: f.nome, regional: f.regional } : null;
    },
    /**
     * Aprovador GA (nível 1 do pré-pedido) da filial pelo código do ME, ou null. Não existe na planilha.
     * Configuração salva antes deste campo (linha sem `aprovadorGA`) usa o nome do padrão;
     * campo apagado na Configuração ("") fica sem nome.
     */
    aprovadorGA(codigo) {
      const k = normalizarCodigoFilial(codigo);
      const f = porCodigo.get(k);
      const nome = f && 'aprovadorGA' in f ? f.aprovadorGA : padraoPorCodigo.get(k)?.aprovadorGA;
      return String(nome ?? '').trim() || null;
    },
    /** PROCV(nome completo; Base Analitico!N:O; 2) -> apelido, ou null. */
    apelidoComprador(nome) {
      const c = compradores.get(chave(nome));
      return c ? c.apelido : null;
    },
  };
}

export { CONFIG_PADRAO };
