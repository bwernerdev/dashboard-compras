import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importar } from '../src/importar.js';
import { criarConfig, CONFIG_PADRAO } from '../src/config/index.js';
import { BASE, FOLLOW_UP } from '../src/esquema.js';
import { serie } from '../src/datas.js';
import { criarXlsx } from './ajuda/xlsx-ficticio.js';

const cfg = criarConfig({
  filiais: [{ codigo: '30999', ajustada: '999', nome: 'Filial Teste', regional: 'Regional A' }],
  compradores: [{ nome: 'Fulano de Tal', apelido: 'Fulano' }],
  sla: CONFIG_PADRAO.sla,
});
const HOJE = serie(2026, 11, 11);

const DADOS_GERAIS = {
  nome: 'Dados Gerais',
  linhas: [
    ['Nome do filtro', 'Valor do Filtro'],
    ['Filial', 'Todos(as)'],
    ['Data Inicio', '12/09/2026'],
    ['Data Fim', '11/11/2026'],
    ['Data de Execução do Relatório', '11/11/2026'],
  ],
};

/** Monta o Relatório com todas as colunas do esquema, em ordem embaralhada, mais uma coluna ignorada. */
function relatorio(esquema, linhas) {
  const cabecalho = ['Coluna Ignorada', ...Object.values(esquema.colunas).map(([nome]) => nome).reverse()];
  const chaves = Object.keys(esquema.colunas).reverse();
  return {
    nome: 'Relatório',
    linhas: [cabecalho, ...linhas.map((l) => ['lixo', ...chaves.map((k) => l[k] ?? null)])],
  };
}

test('base: descarta outras filiais, converte tipos e aplica as regras', async () => {
  const blob = await criarXlsx([DADOS_GERAIS, relatorio(BASE, [
    {
      solicitacao: 'FDS-1234567', codigoFilial: '30.999', criacao: serie(2026, 11, 3) + 0.3, status: 'Em Cotação',
      prioridade: 'NORMAL', unidade: 'UN', selecionadoPor: 'FDS - Fulano de Tal', qtdSolicitacao: 3, saving: '2,50',
      requisicaoMe: 111, item: 1,
    },
    { solicitacao: 'FDS-7777777', codigoFilial: '10.001', criacao: serie(2026, 11, 3) },
    {
      solicitacao: 'FDS-2345678', codigoFilial: 30999, criacao: '01/10/2026', status: 'Em Pedido',
      numeroPedido: 'FDS-7000001', dataPedido: serie(2026, 10, 2), totalPedidoComImpostos: 1500.5, item: '2',
    },
  ])]);

  const progresso = [];
  const r = await importar('base', blob, cfg, { hoje: HOJE, aoAvancar: (f, fase) => progresso.push([f, fase]) });
  assert.equal(r.meta.lidas, 3);
  assert.equal(r.meta.mantidas, 2);
  assert.equal(r.meta.descartadas, 1);
  assert.equal(r.meta.dadosGerais.inicio, serie(2026, 9, 12));
  assert.equal(r.meta.dadosGerais.fim, HOJE);
  assert.deepEqual(progresso.at(-1), [1, 'Concluído']);

  const [a, b] = r.registros;
  assert.equal(a.sc, '1234567');
  assert.equal(a.nomeFilial, 'Filial Teste');
  assert.equal(a.comprador, 'Fulano');
  assert.equal(a.diasEmAberto, 7);
  assert.equal(a.sla, 'No Prazo');
  assert.equal(a.savingReal, 7.5);
  assert.equal(a.requisicaoMe, 111);

  assert.equal(b.criacao, serie(2026, 10, 1)); // data em texto convertida
  assert.equal(b.item, 2); // número em texto convertido
  assert.equal(b.diasEmAberto, null);
  assert.equal(b.totalPedidoComImpostos, 1500.5);
  assert.equal(b.compradorCompleto, 'Pendente'); // sem "Selecionado por"
  assert.equal(b.comprador, null); // esta config não tem apelido para Pendente: planilha mostraria "-"
});

test('follow-up: lê o relatório e calcula SC/OF', async () => {
  const blob = await criarXlsx([DADOS_GERAIS, relatorio(FOLLOW_UP, [
    { solicitacao: 'FDS-1234567', numeroPedido: 'FDS-7654321', codigoFilial: '30.999', statusEntrega: 'NÃO ENTREGUE' },
  ])]);
  const r = await importar('followUp', blob, cfg, { hoje: HOJE });
  assert.equal(r.registros.length, 1);
  assert.equal(r.registros[0].of, '7654321');
  assert.equal(r.registros[0].statusEntrega, 'NÃO ENTREGUE');
});

test('arquivo trocado: avisa quais colunas faltam', async () => {
  const blob = await criarXlsx([DADOS_GERAIS, relatorio(FOLLOW_UP, [])]);
  await assert.rejects(importar('base', blob, cfg, { hoje: HOJE }), /relatório "Base \(Relatório de Requisição\)".*Colunas que faltam: .*Item/);
});

test('cancelamento pelo sinal', async () => {
  const blob = await criarXlsx([DADOS_GERAIS, relatorio(BASE, [{ codigoFilial: '30999' }])]);
  const ctrl = new AbortController();
  ctrl.abort();
  await assert.rejects(importar('base', blob, cfg, { hoje: HOJE, sinal: ctrl.signal }), /cancelada/);
});
