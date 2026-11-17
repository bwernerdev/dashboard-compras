// Planilha de contratos (anexo opcional, janela Contratos): leitura das abas e contas dos cartões.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lerBlocosDaAba, prazoDias, resumoContratos, contarPor, filialAjustadaDoContrato, normalizarCabecalho, statusDoContrato,
} from '../src/contratos/dados.js';
import { lerContratos } from '../src/contratos/ler.js';
import { abasDeContratos, criarContratosFicticios } from './ajuda/contratos-ficticio.js';
import { criarXlsx } from './ajuda/xlsx-ficticio.js';

const HOJE = 46343;
const aba = (nome) => abasDeContratos(HOJE).find((a) => a.nome === nome).linhas;

test('Contratos: cabeçalho abaixo do título, filial sem espaço, texto limpo, total e "-" fora', () => {
  const [q] = lerBlocosDaAba(aba('Contratos'), 'contratos');
  assert.equal(q.titulo, null);
  assert.deepEqual(q.campos.map((c) => c.id), ['filial', 'resp', 'cnpj', 'fornecedor', 'objeto', 'setor', 'projuris', 'contratoMe',
    'status', 'valor', 'inicio', 'fim', 'observacao', 'statusDemanda']); // "Prazo Venc. (dias)" é refeito, não lido
  assert.equal(q.linhas.length, 4);
  assert.equal(q.linhas[0].filial, '30.570');
  assert.equal(q.linhas[0].fornecedor, 'FORNECEDOR A LTDA');
  assert.equal(q.linhas[3].setor, null);
  assert.equal(q.linhas[3].valor, null);
  assert.equal(q.linhas[3].inicio, '01/01/2025'); // data digitada como texto fica como veio
  assert.deepEqual(q.campos.find((c) => c.id === 'fim'), { id: 'fim', rotulo: 'Fim', tipo: 'data' });
});

test('ME: a coluna "Prazo Venc. (dias)" é a data do vencimento', () => {
  const [q] = lerBlocosDaAba(aba('ME'), 'me');
  assert.ok(q.campos.some((c) => c.id === 'vencimento' && c.tipo === 'data'));
  assert.equal(q.linhas[0].vencimento, HOJE + 20);
  assert.equal(prazoDias(q.linhas[0], HOJE), 20);
});

test('quadros: cada cabeçalho abre um, título da linha acima, coluna desconhecida com o nome da planilha', () => {
  const quadros = lerBlocosDaAba(aba('Renovações'), 'contratos');
  assert.equal(quadros.length, 2);
  assert.equal(quadros[0].titulo, null);
  assert.equal(quadros[0].linhas.length, 1); // "Total Redução:" sai
  assert.equal(quadros[1].titulo, 'Renovação segundo semestre 2099');
  assert.deepEqual(quadros[1].campos.slice(0, 2).map((c) => c.id), ['filial', 'fornecedor']);
  assert.deepEqual(quadros[1].campos.find((c) => c.id === 'c_colunanova'), { id: 'c_colunanova', rotulo: 'Coluna Nova' });
  assert.equal(quadros[1].linhas[0].filial, '570');
});

test('aba sem "Fornecedor" não tem quadro', () => {
  assert.deepEqual(lerBlocosDaAba([['ATIVO'], ['INATIVO']], 'contratos'), []);
});

test('prazo, status e cartões: vencem em até 30 dias e fim já passou (sem INATIVO)', () => {
  const [q] = lerBlocosDaAba(aba('Contratos'), 'contratos');
  assert.deepEqual(q.linhas.map((r) => prazoDias(r, HOJE)), [10, 200, -5, -40]);
  assert.equal(statusDoContrato(q.linhas[3]), 'VENCIDO');
  assert.deepEqual(resumoContratos(q.linhas, HOJE), { total: 4, ativos: 2, emRenovacao: 1, vencem: 1, vencidos: 2 });
  const [pp] = lerBlocosDaAba(aba('Pequeno Porte'), 'pequenoPorte');
  assert.equal(resumoContratos(pp.linhas, HOJE).vencidos, 0); // INATIVO não conta
  assert.deepEqual([...contarPor(q.linhas, 'status')], [['ATIVO', 2], ['EM RENOVAÇÃO', 1], ['VENCIDO', 1]]);
});

test('filial ajustada do contrato e cabeçalho normalizado', () => {
  assert.equal(filialAjustadaDoContrato('30.603'), '603');
  assert.equal(filialAjustadaDoContrato('178.356'), '356');
  assert.equal(filialAjustadaDoContrato(null), null);
  assert.equal(normalizarCabecalho('Prazo Venc. (dias)'), 'prazovencdias');
  assert.equal(normalizarCabecalho('Serviço/ Locação'), 'servicolocacao');
});

test('lerContratos: lê as quatro abas do .xlsx e ignora as outras (Renovações, Dados)', async () => {
  const arquivo = await criarContratosFicticios(HOJE);
  const r = await lerContratos(Object.assign(arquivo, { name: 'CONTROLE DE CONTRATOS.xlsx' }));
  assert.deepEqual(Object.keys(r.abas), ['contratos', 'pequenoPorte', 'me', 'inativos']);
  assert.equal(r.meta.tipo, 'contratos');
  assert.equal(r.meta.arquivo, 'CONTROLE DE CONTRATOS.xlsx');
  assert.equal(r.meta.linhas, 4 + 1 + 1 + 1);
});

test('lerContratos: planilha sem as abas ou arquivo que não é xlsx dão mensagem clara', async () => {
  await assert.rejects(lerContratos(await criarXlsx([{ nome: 'Outra', linhas: [['a']] }])), /Não parece a planilha de contratos/);
  await assert.rejects(lerContratos(new Blob(['nada'])), /não é um \.xlsx válido/);
});
