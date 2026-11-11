// Dados do painel publicado (src/painel/dados.js) e texto do "Copiar tabela" (gerarTsv). Dados fictícios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarDadosDoPainel, registrosDoPainel, compactar, descompactar, CAMPOS_PUBLICOS, VERSAO } from '../src/painel/dados.js';
import { gerarTsv } from '../src/ui/tabela.js';

const aberto = {
  solicitacao: 'SC-1', regional: 'Sul', nomeFilial: 'Filial A', comprador: 'Ana', prioridade: 'Normal',
  temContrato: false, status: 'Em aberto', diasEmAberto: 9, sla: 'No prazo', totalPedidoComImpostos: null,
  savingReal: null, anoPedido: null, mesPedido: null,
  sc: 'SC-1', item: 1, data: 46000, diasDaAprovacao: 8, slaMax: 10, descricao: 'Parafuso', codigoProduto: 'P1',
  qtdSolicitacao: 4, solicitante: 'Beto', filial: '101',
  // Campos que não podem ir para o painel:
  numeroPrePedido: 'PRE-9', descricaoFilial: 'Descrição interna', nomeCompletoComprador: 'Ana Interna', email: 'x@y',
};
const fechado = {
  ...aberto, solicitacao: 'SC-2', sc: 'SC-2', status: 'Pedido', diasEmAberto: null, sla: null,
  totalPedidoComImpostos: 1000, savingReal: 50.5, anoPedido: 2026, mesPedido: 3, descricao: 'Detalhe de pedido fechado',
};
const meta = { arquivo: 'base.xlsx', dadosGerais: { inicio: 45900, fim: 46000, execucao: 46001 } };

test('montarDadosDoPainel leva só os campos públicos', () => {
  const d = montarDadosDoPainel({ registros: [aberto, fechado], meta, hoje: 46001, geradoEm: '2026-11-11T12:00:00.000Z' });
  assert.equal(d.versao, VERSAO);
  assert.deepEqual(d.campos, CAMPOS_PUBLICOS);
  assert.deepEqual(d.periodo, { inicio: 45900, fim: 46000, execucao: 46001 });
  for (const proibido of ['numeroPrePedido', 'descricaoFilial', 'nomeCompletoComprador', 'email']) {
    assert.ok(!d.campos.includes(proibido), proibido);
  }
  const texto = JSON.stringify(d);
  for (const valor of ['PRE-9', 'Descrição interna', 'Ana Interna', 'x@y']) assert.ok(!texto.includes(valor), valor);
});

test('detalhe do item só nas SCs em aberto', () => {
  const d = montarDadosDoPainel({ registros: [aberto, fechado], meta, hoje: 46001, geradoEm: 'x' });
  const [a, f] = registrosDoPainel(d);
  assert.equal(a.descricao, 'Parafuso');
  assert.equal(a.solicitante, 'Beto');
  assert.equal(f.descricao, null);
  assert.equal(f.solicitante, null);
  assert.equal(f.savingReal, 50.5); // saving continua
  assert.equal(f.comprador, 'Ana');
});

test('registrosDoPainel recusa versão desconhecida', () => {
  assert.throws(() => registrosDoPainel({ versao: 99, campos: [], linhas: [] }), /Versão/);
});

test('compactar e descompactar devolvem o mesmo objeto (acentos e muitas linhas)', async () => {
  const linhas = Array.from({ length: 50000 }, (_, i) => ({ ...aberto, solicitacao: `SC-${i}`, descricao: `Item ç ã é ${i}` }));
  const d = montarDadosDoPainel({ registros: linhas, meta, hoje: 46001, geradoEm: 'x' });
  const texto = await compactar(d);
  assert.match(texto, /^[A-Za-z0-9+/=]+$/);
  assert.deepEqual(await descompactar(`\n  ${texto}\n`), d);
});

test('gerarTsv: tabulação, vírgula decimal, data e quebras de linha', () => {
  const colunas = [
    { rotulo: 'Nome', valor: (l) => l.nome },
    { rotulo: 'Valor', valor: (l) => l.v },
    { rotulo: 'Data', valor: (l) => l.d, tipo: 'data' },
  ];
  const tsv = gerarTsv(colunas, [{ nome: 'A\tB\nC', v: 1234.5, d: 46000 }, { nome: 'Z', v: null, d: null }]);
  const [cab, l1, l2] = tsv.split('\r\n');
  assert.equal(cab, 'Nome\tValor\tData');
  assert.equal(l1, 'A B C\t1234,5\t09/12/2025');
  assert.equal(l2, 'Z\t\t');
});
