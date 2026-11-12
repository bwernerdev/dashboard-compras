// Bases fictícias para o e2e: mesmas colunas do ME, poucas linhas, datas relativas a hoje.
// Filiais e comprador vêm da configuração padrão (para o app aceitar as linhas); nenhum dado real.
import { criarXlsx } from '../../tests/ajuda/xlsx-ficticio.js';
import { BASE, FOLLOW_UP } from '../../src/esquema.js';
import { CONFIG_PADRAO } from '../../src/config/index.js';
import { hojeSerie } from '../../src/datas.js';

const HOJE = hojeSerie();

/** Duas filiais de regionais diferentes e o primeiro comprador do de-para. */
const regionais = [...new Set(CONFIG_PADRAO.filiais.map((f) => f.regional))];
export const FILIAL_A = CONFIG_PADRAO.filiais.find((f) => f.regional === regionais[0]);
export const FILIAL_B = CONFIG_PADRAO.filiais.find((f) => f.regional === regionais[1]);
export const COMPRADOR = CONFIG_PADRAO.compradores[0];

const DADOS_GERAIS = {
  nome: 'Dados Gerais',
  linhas: [
    ['Nome do filtro', 'Valor do Filtro'],
    ['Data Inicio', '12/09/2026'],
    ['Data Fim', '11/11/2026'],
    ['Data de Execução do Relatório', '11/11/2026'],
  ],
};

function relatorio(esquema, linhas) {
  const chaves = Object.keys(esquema.colunas);
  return {
    nome: 'Relatório',
    linhas: [chaves.map((k) => esquema.colunas[k][0]), ...linhas.map((l) => chaves.map((k) => l[k] ?? null))],
  };
}

const linha = (x) => ({
  item: 1, unidade: 'UN', qtdSolicitacao: 1, selecionadoPor: `FDS - ${COMPRADOR.nome}`, empresa: 'Empresa Teste',
  descricao: 'PRODUTO TESTE', codigoProduto: 'P-1', solicitante: 'Solicitante Teste', ...x,
});

/**
 * Base: 3 SCs, 4 itens nas filiais do de-para + 1 linha de outra filial (descartada).
 * Em aberto: SC 1000001 (NORMAL, REGULARIZAÇÃO, 1 dia: no prazo) e SC 1000002 (URGENTE, 2 itens, ~70 dias: fora;
 * item 2 em pendência de compra).
 * Com pedido: SC 1000003 (total 900, saving 10 x 10 = 100, pré-pedido PP-1).
 */
export const LINHAS_BASE = [
  linha({ solicitacao: 'FDS-1000001', codigoFilial: FILIAL_A.codigo, criacao: HOJE - 1, prioridade: 'NORMAL', status: 'Em Cotação', categoria: 'REGULARIZAÇÃO' }),
  linha({ solicitacao: 'FDS-1000002', codigoFilial: FILIAL_A.codigo, criacao: HOJE - 100, prioridade: 'URGENTE', status: 'Em Cotação' }),
  linha({ solicitacao: 'FDS-1000002', item: 2, codigoFilial: FILIAL_A.codigo, criacao: HOJE - 100, prioridade: 'URGENTE', status: 'Em pendências de compra' }),
  linha({
    solicitacao: 'FDS-1000003', codigoFilial: FILIAL_B.codigo, criacao: HOJE - 20, prioridade: 'NORMAL', status: 'Em Pedido',
    numeroPedido: 'OF-1', dataPedido: HOJE - 10, totalPedidoComImpostos: 900, saving: '10,00', qtdSolicitacao: 10, numeroPrePedido: 'PP-1',
  }),
  linha({ solicitacao: 'FDS-1000004', codigoFilial: '99999', criacao: HOJE - 5, prioridade: 'NORMAL', status: 'Em Cotação' }),
];

const paraBuffer = async (blob) => Buffer.from(await blob.arrayBuffer());

export async function arquivoBase() {
  return { name: 'base.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await paraBuffer(await criarXlsx([DADOS_GERAIS, relatorio(BASE, LINHAS_BASE)])) };
}

export async function arquivoFollowUp() {
  return { name: 'Follow-Up.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await paraBuffer(await criarXlsx([DADOS_GERAIS, relatorio(FOLLOW_UP, [])])) };
}
