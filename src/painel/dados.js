// Dados que vão DENTRO do painel publicado (PROJETO.md, seção 4.7): só os campos que as telas
// públicas (Regional e Saving) usam. Nada da configuração (de-para, nomes completos), nada de
// pré-pedido (tela Compradores, interna). Detalhes do item só para SCs em aberto (lista da Regional).
// Formato: { versao, geradoEm, hoje, periodo, arquivo, campos, linhas } em JSON, gzip, base64.
// Roda no navegador e no Node (testes).

export const VERSAO = 1;

/** Campos de toda linha: filtros, contagens e saving. */
const CAMPOS_BASE = [
  'solicitacao', 'regional', 'nomeFilial', 'comprador', 'prioridade', 'temContrato', 'status',
  'diasEmAberto', 'sla', 'totalPedidoComImpostos', 'savingReal', 'anoPedido', 'mesPedido',
];

/** Campos só das SCs em aberto (colunas da lista da tela Regional). */
const CAMPOS_DETALHE = [
  'sc', 'item', 'data', 'diasDaAprovacao', 'slaMax', 'descricao', 'codigoProduto', 'qtdSolicitacao',
  'solicitante', 'filial',
];

export const CAMPOS_PUBLICOS = [...CAMPOS_BASE, ...CAMPOS_DETALHE];

const valorOuNulo = (v) => (v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? null : v);

/** Monta o objeto de dados do painel a partir dos registros calculados do app. */
export function montarDadosDoPainel({ registros, meta, hoje, geradoEm }) {
  const g = meta?.dadosGerais ?? {};
  return {
    versao: VERSAO,
    geradoEm,
    hoje,
    periodo: { inicio: g.inicio ?? null, fim: g.fim ?? null, execucao: g.execucao ?? null },
    arquivo: meta?.arquivo ?? null,
    campos: CAMPOS_PUBLICOS,
    linhas: registros.map((r) => {
      const aberto = r.diasEmAberto !== null && r.diasEmAberto !== undefined;
      return [
        ...CAMPOS_BASE.map((c) => valorOuNulo(r[c])),
        ...CAMPOS_DETALHE.map((c) => (aberto ? valorOuNulo(r[c]) : null)),
      ];
    }),
  };
}

/** Registros (objetos) de volta, para as telas. */
export function registrosDoPainel(dados) {
  if (dados?.versao !== VERSAO) throw new Error(`Versão de dados desconhecida: ${dados?.versao}`);
  const { campos } = dados;
  return dados.linhas.map((linha) => {
    const r = {};
    for (let i = 0; i < campos.length; i++) r[campos[i]] = linha[i];
    return r;
  });
}

function paraBase64(bytes) {
  let texto = '';
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(texto);
}

/** Objeto -> JSON -> gzip -> base64. */
export async function compactar(objeto) {
  const json = new TextEncoder().encode(JSON.stringify(objeto));
  const fluxo = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  return paraBase64(new Uint8Array(await new Response(fluxo).arrayBuffer()));
}

/** base64 -> gzip -> JSON -> objeto. */
export async function descompactar(base64) {
  const bytes = Uint8Array.from(atob(base64.trim()), (c) => c.charCodeAt(0));
  const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(fluxo).text());
}
