// Dados que vão DENTRO do painel publicado (PROJETO.md, seção 4.7): só os campos que as telas
// públicas (telas/publicas.js) usam. Nada da configuração (de-para, nomes completos), nada de
// pré-pedido (tela Compradores, interna). Alguns campos só para SCs em aberto (Regional, Atendimento).
// Formato: { versao, geradoEm, hoje, periodo, arquivo, campos, linhas, followUp: { campos, linhas } | null }
// em JSON, gzip, base64. Roda no navegador e no Node (testes).

// 2: sem item e slaMax; 3: + categoria (linha vermelha de regularização);
// 4: telas Status, Entrega, Spend, Atendimento (detalhe em toda linha, numeroPedido, slaMax, Follow-Up);
// 5: sem slaMax (SLA com prazo único de 30 dias úteis, 12/11/2026)
export const VERSAO = 5;

/** Campos de toda linha: filtros, contagens, saving, spend e a lista da tela Status. */
const CAMPOS_BASE = [
  'solicitacao', 'regional', 'nomeFilial', 'comprador', 'prioridade', 'temContrato', 'status',
  'diasEmAberto', 'sla', 'totalPedidoComImpostos', 'savingReal', 'anoPedido', 'mesPedido',
  'numeroPedido', 'sc', 'data', 'descricao', 'solicitante', 'filial', 'categoria',
];

/** Campos só das SCs em aberto (listas das telas Regional e Atendimento). */
const CAMPOS_DETALHE = ['diasDaAprovacao', 'codigoProduto', 'qtdSolicitacao'];

export const CAMPOS_PUBLICOS = [...CAMPOS_BASE, ...CAMPOS_DETALHE];

/** Campos do Follow-Up (tela Entrega e filtros globais). */
export const CAMPOS_FOLLOW_UP = [
  'solicitacao', 'sc', 'numeroPedido', 'of', 'dataPedido', 'filial', 'nomeFilial', 'regional',
  'solicitante', 'comprador', 'prioridade', 'temContrato', 'codigoProduto', 'descricao',
  'fornecedor', 'cnpj', 'statusEntrega',
];

const valorOuNulo = (v) => (v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? null : v);

/** Monta o objeto de dados do painel a partir dos registros calculados do app. */
export function montarDadosDoPainel({ registros, followUp = null, meta, hoje, geradoEm }) {
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
    followUp: followUp ? {
      campos: CAMPOS_FOLLOW_UP,
      linhas: followUp.map((r) => CAMPOS_FOLLOW_UP.map((c) => valorOuNulo(r[c]))),
    } : null,
  };
}

const paraObjetos = ({ campos, linhas }) => linhas.map((linha) => {
  const r = {};
  for (let i = 0; i < campos.length; i++) r[campos[i]] = linha[i];
  return r;
});

/** Registros (objetos) de volta, para as telas. */
export function registrosDoPainel(dados) {
  if (dados?.versao !== VERSAO) throw new Error(`Versão de dados desconhecida: ${dados?.versao}`);
  return paraObjetos(dados);
}

/** Registros do Follow-Up, ou null se o painel foi gerado sem ele. */
export const followUpDoPainel = (dados) => (dados.followUp ? paraObjetos(dados.followUp) : null);

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
