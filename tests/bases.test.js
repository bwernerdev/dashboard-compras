// Fluxo de dados do app (src/bases.js) em Node, com bases fictícias (e2e/ajuda/bases.js):
// importar, base anterior, histórico, cópias para "Reimportar bases", restaurar ao abrir,
// configuração e virada do dia. Armazenamento e vista são falsos; a importação é a de verdade
// (importar.js), sem worker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarBases, diaDaBase } from '../src/bases.js';
import { importar } from '../src/importar.js';
import { criarConfig, CONFIG_PADRAO } from '../src/config/index.js';
import { VALIDADE_COPIA_MS } from '../src/memoria.js';
import { lerContratos } from '../src/contratos/ler.js';
import { serie, hojeSerie } from '../src/datas.js';
import { arquivoBase, arquivoBaseAnterior, arquivoFollowUp, arquivoContratos } from '../e2e/ajuda/bases.js';

const paraFile = ({ name, buffer }) => new File([buffer], name);

/** Armazenamento em memória com o registro das chamadas (no lugar do IndexedDB e do localStorage). */
function armazenamentoFalso(salvas = {}) {
  const chamadas = [];
  const anotar = (nome) => (...args) => { chamadas.push([nome, ...args]); return Promise.resolve(true); };
  return {
    chamadas,
    nomes: () => chamadas.map(([n]) => n),
    salvarImportacao: anotar('salvarImportacao'),
    salvarAnterior: anotar('salvarAnterior'),
    salvarHistorico: anotar('salvarHistorico'),
    salvarContratos: anotar('salvarContratos'),
    salvarCopia: anotar('salvarCopia'),
    apagarCopia: anotar('apagarCopia'),
    salvarConfig: anotar('salvarConfig'),
    apagarConfig: anotar('apagarConfig'),
    lerImportacoes: async () => salvas,
  };
}

/** Vista que só guarda o que recebeu. */
function vistaFalsa() {
  const v = { bases: {}, anteriores: null, historico: null, desenhos: 0, reinicios: 0 };
  return Object.assign(v, {
    definirBase: (tipo, dados) => { v.bases[tipo] = dados; },
    definirAnteriores: (a) => { v.anteriores = a; },
    definirHistorico: (p) => { v.historico = p; },
    reiniciarTelas: () => { v.reinicios++; },
    desenhar: () => { v.desenhos++; },
  });
}

/** Importação de verdade, direto (o app usa o worker, que chama a mesma função). */
const importarArquivo = (tipo, arquivo, { hoje, config, aoAvancar, sinal }) =>
  importar(tipo, arquivo, criarConfig(config), { hoje, aoAvancar, sinal, copiar: false });

function montar({ salvas, hoje = hojeSerie, configSalva = null } = {}) {
  const armazenamento = armazenamentoFalso(salvas);
  const vista = vistaFalsa();
  const bases = criarBases({ vista, configSalva, armazenamento, importarArquivo, lerContratosDe: lerContratos, hoje });
  return { bases, vista, armazenamento };
}

test('importar Base: copia, calcula, guarda, avisa a tela e lembra a cópia', async () => {
  const { bases, vista, armazenamento } = montar();
  const fases = [];
  const dados = await bases.importar('base', paraFile(await arquivoBase()), (_f, fase) => fases.push(fase));
  assert.equal(fases[0], 'Copiando o arquivo');
  assert.equal(dados.registros.length, 4); // a linha de outra filial sai
  assert.equal(vista.bases.base, bases.estado.base);
  assert.equal(vista.reinicios, 1);
  assert.ok(vista.desenhos >= 1);
  assert.deepEqual(armazenamento.nomes(), ['salvarHistorico', 'salvarImportacao', 'salvarCopia']);
  assert.equal(bases.estado.historico.length, 1);
  assert.equal(bases.estado.copias.base.arquivo.name, 'base.xlsx');
  assert.equal(bases.estado.anterior, null); // primeira base: sem anterior
});

test('base de outro dia do ME vira a anterior; reimportar no mesmo dia mantém', async () => {
  const { bases, vista, armazenamento } = montar();
  await bases.importar('base', paraFile(await arquivoBaseAnterior())); // ME de 10/11/2026
  await bases.importar('base', paraFile(await arquivoBase())); // ME de 11/11/2026
  assert.equal(diaDaBase(bases.estado.anterior.meta), serie(2026, 11, 10));
  assert.equal(vista.anteriores.rotulo, '10/11');
  assert.equal(vista.anteriores.registros.length, 5); // a anterior tem uma SC a mais
  assert.equal(armazenamento.nomes().filter((n) => n === 'salvarAnterior').length, 1);
  // Histórico: um ponto por dia do ME; a tela só recebe os dias antes da base atual.
  assert.deepEqual(bases.estado.historico.map((p) => p.dia), [serie(2026, 11, 10), serie(2026, 11, 11)]);
  assert.deepEqual(vista.historico.map((p) => p.dia), [serie(2026, 11, 10)]);
  await bases.importar('base', paraFile(await arquivoBase())); // mesmo dia de novo
  assert.equal(diaDaBase(bases.estado.anterior.meta), serie(2026, 11, 10));
  assert.equal(bases.estado.historico.length, 2);
});

test('duas importações do mesmo tipo ao mesmo tempo: a segunda é recusada', async () => {
  const { bases } = montar();
  const arquivo = paraFile(await arquivoBase());
  const primeira = bases.importar('base', arquivo);
  await assert.rejects(bases.importar('base', arquivo), /Já há uma importação de Base em andamento/);
  await primeira;
});

test('Follow-Up e Contratos', async () => {
  const { bases, vista, armazenamento } = montar();
  await bases.importar('followUp', paraFile(await arquivoFollowUp()));
  assert.equal(vista.bases.followUp.registros.length, 3);
  const contratos = await bases.importar('contratos', paraFile(await arquivoContratos()));
  assert.ok(contratos.abas);
  assert.equal(bases.estado.contratos, contratos);
  assert.equal(bases.estado.copias.contratos, undefined); // contratos não guardam cópia
  assert.ok(armazenamento.nomes().includes('salvarContratos'));
});

test('Reimportar bases: lê a cópia guardada; sem cópia ou vencida, pede a caixa', async () => {
  const { bases, armazenamento } = montar();
  assert.deepEqual(await bases.reimportarBases(() => {}), ['Base: escolha o arquivo de novo pela caixa em "Atualizar bases".']);
  await bases.importar('base', paraFile(await arquivoBase()));
  const copia = bases.estado.copias.base.arquivo;
  const avisos = [];
  const linhas = await bases.reimportarBases((t) => avisos.push(t));
  assert.deepEqual(linhas, ['Base: base.xlsx, 4 linhas das filiais do de-para.']);
  assert.ok(avisos.some((t) => t.startsWith('Base: Abrindo arquivo')));
  assert.equal(bases.estado.copias.base.arquivo, copia); // a mesma cópia, sem copiar de novo
  // Vencida: apaga e pede a caixa.
  bases.estado.copias.base.salvoEm = Date.now() - VALIDADE_COPIA_MS - 1000;
  assert.deepEqual(await bases.reimportarBases(() => {}), ['Base: a cópia do arquivo vale 8 horas e venceu: escolha o arquivo de novo pela caixa em "Atualizar bases".']);
  assert.equal(bases.estado.copias.base, undefined);
  assert.ok(armazenamento.chamadas.some(([n, tipo]) => n === 'apagarCopia' && tipo === 'base'));
});

test('restaurar ao abrir: bases, cópias válidas, anterior e histórico montado', async () => {
  // Primeiro uma sessão "antiga" importa duas bases; os dados salvos viram o que o navegador guardou.
  const antes = montar();
  await antes.bases.importar('base', paraFile(await arquivoBaseAnterior()));
  const anterior = antes.bases.estado.base;
  await antes.bases.importar('base', paraFile(await arquivoBase()));
  const atual = antes.bases.estado.base;
  const copia = { arquivo: new File(['x'], 'base.xlsx'), salvoEm: Date.now() };
  const salvas = {
    base: { brutos: atual.brutos, meta: atual.meta, salvoEm: atual.salvoEm },
    'base-anterior': { brutos: anterior.brutos, meta: anterior.meta, salvoEm: anterior.salvoEm },
    'arquivo-base': copia,
    'arquivo-followUp': { arquivo: new File(['x'], 'Follow-Up.xlsx'), salvoEm: Date.now() - VALIDADE_COPIA_MS - 1 },
  };
  const { bases, vista, armazenamento } = montar({ salvas });
  await bases.restaurar();
  assert.equal(vista.bases.base.registros.length, 4);
  assert.equal(bases.estado.copias.base.arquivo, copia.arquivo);
  assert.equal(bases.estado.copias.followUp, undefined); // vencida: não volta
  assert.ok(armazenamento.chamadas.some(([n, tipo]) => n === 'apagarCopia' && tipo === 'followUp'));
  assert.equal(vista.anteriores.rotulo, '10/11');
  // Sem histórico salvo: monta com a anterior e a atual.
  assert.deepEqual(bases.estado.historico.map((p) => p.dia), [serie(2026, 11, 10), serie(2026, 11, 11)]);
});

test('configuração: filial nova avisa para reimportar; restaurar padrão apaga a editada', async () => {
  const { bases, armazenamento } = montar();
  assert.equal(bases.salvarConfig(CONFIG_PADRAO), null); // sem base: nada a avisar
  await bases.importar('base', paraFile(await arquivoBase()));
  const nova = { ...CONFIG_PADRAO, filiais: [...CONFIG_PADRAO.filiais, { codigo: '30998', ajustada: '998', nome: 'Nova', regional: 'R' }] };
  assert.match(bases.salvarConfig(nova), /Filial nova no de-para \(30998\)/);
  assert.equal(bases.estado.personalizada, true);
  assert.equal(bases.restaurarPadrao(), null);
  assert.equal(bases.estado.personalizada, false);
  assert.deepEqual(armazenamento.nomes().filter((n) => n.includes('Config')), ['salvarConfig', 'salvarConfig', 'apagarConfig']);
});

test('virou o dia com a página aberta: recalcula dias em aberto; mesmo dia não faz nada', async () => {
  let dia = hojeSerie();
  const { bases, vista } = montar({ hoje: () => dia });
  assert.equal(bases.virouODia(), false); // sem base
  await bases.importar('base', paraFile(await arquivoBase()));
  assert.equal(bases.virouODia(), false);
  const dias = (regs) => regs.find((r) => r.solicitacao === 'FDS-1000001').diasEmAberto;
  const antes = dias(vista.bases.base.registros);
  dia += 7; // uma semana depois: 5 dias úteis a mais
  assert.equal(bases.virouODia(), true);
  assert.equal(bases.estado.hoje, dia);
  assert.equal(dias(vista.bases.base.registros), antes + 5);
});
