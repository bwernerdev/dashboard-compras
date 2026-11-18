// "Gerar painel": baixa o painel-compras.html e abre como arquivo e dentro de um quadro isolado
// (igual à pré-visualização do SharePoint: iframe sandbox, srcdoc, sem armazenamento nem download).
import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { arquivoBase, arquivoFollowUp, arquivoContratos, COMPRADOR } from './ajuda/bases.js';
import { abrirPasta, lerAbaInteira } from '../src/leitor/xlsx.js';

const TELAS = ['Status', 'Entrega', 'Regional', 'Spend', 'Saving', 'Atendimento', 'Organograma'];
const cartao = (raiz, rotulo) => raiz.locator('.tela > .cartoes > .cartao', { has: raiz.locator('.cartao-rotulo', { hasText: rotulo }) }).locator('.cartao-valor');

async function gerarPainel(page, info) {
  await page.goto('./');
  await expect(page.locator('#acao-painel')).toBeDisabled();
  await page.locator('input[data-tipo="base"]').setInputFiles(await arquivoBase());
  await expect(cartao(page, 'SCs em aberto')).toBeVisible();
  await page.locator('#acao-importar').click();
  await page.locator('dialog input[data-tipo="followUp"]').setInputFiles(await arquivoFollowUp());
  await expect(page.locator('dialog .arquivo[data-tipo="followUp"] .arquivo-status')).toContainText('3 linhas');
  await page.locator('dialog input[data-tipo="contratos"]').setInputFiles(await arquivoContratos());
  await expect(page.locator('dialog .arquivo[data-tipo="contratos"] .arquivo-status')).toContainText('7 linhas');
  await page.locator('dialog').getByRole('button', { name: 'Fechar' }).last().click();
  await page.getByRole('button', { name: 'Exportar', exact: true }).click(); // Gerar painel fica no menu Exportar
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Gerar painel' }).click()]);
  expect(download.suggestedFilename()).toBe('painel-compras.html');
  await expect(page.getByRole('heading', { name: 'Painel gerado' })).toBeVisible();
  await expect(page.getByText('Leva também a planilha de contratos')).toBeVisible();
  // Com extensão .html (o download.path() não tem), senão o navegador abre como texto.
  const caminho = info.outputPath('painel-compras.html');
  await download.saveAs(caminho);
  return { caminho, html: await readFile(caminho, 'utf8') };
}

test('painel aberto como arquivo: telas públicas (sem Compradores), sem dados internos', async ({ page, context }, info) => {
  const { caminho, html } = await gerarPainel(page, info);
  expect(html).not.toContain('__DADOS_DO_PAINEL__');

  const painel = await context.newPage();
  const erros = [];
  painel.on('pageerror', (e) => erros.push(e.message));
  await painel.goto(pathToFileURL(caminho).href);
  await expect(painel.getByRole('tab')).toHaveText(TELAS);
  await expect(cartao(painel, 'SCs em aberto')).toHaveText('2');
  await expect(painel.locator('#periodo')).toContainText('dados de');
  // Emblema embutido no arquivo (data URI): aparece sem rede e também é o ícone da aba.
  await expect(painel.locator('.topo-emblema').locator('visible=true')).toBeVisible();
  expect(await painel.locator('.topo-emblema').locator('visible=true').evaluate((img) => img.src.startsWith('data:image/webp') && img.naturalWidth > 0)).toBe(true);
  await expect(painel.locator('link[rel="icon"]')).toHaveCount(1);
  await expect(painel.locator('#aviso-quadro')).toBeHidden();
  await expect(painel.locator('#acao-imprimir')).toBeVisible();
  await expect(painel.getByRole('button', { name: 'Exportar Excel' }).first()).toBeVisible();
  await expect(painel.getByRole('button', { name: /Exportar CSV|Exportar \.xlsx/ })).toHaveCount(0);
  await expect(painel.locator('.olho')).toHaveCount(0); // "atendida" é só do app da equipe

  // Contratos (anexo): mesmo botão e mesma janela do app.
  await painel.locator('#acao-contratos').click();
  const janela = painel.getByRole('dialog', { name: 'Contratos' });
  await expect(janela.getByRole('tab')).toHaveText(['Contratos 4', 'Pequeno porte 1', 'ME 1', 'Inativos 1']);
  await expect(janela.locator('tbody tr', { hasText: 'FORNECEDOR A' })).toContainText('Itajaí - HUB');
  await janela.getByRole('button', { name: 'Fechar' }).click();
  await expect(janela).toBeHidden();

  // Atendimento: "Exportar Excel" baixa uma planilha do Excel com os itens em aberto, um por linha.
  await painel.getByRole('tab', { name: 'Atendimento' }).click();
  const [planilha] = await Promise.all([painel.waitForEvent('download'), painel.getByRole('button', { name: 'Exportar Excel' }).click()]);
  expect(planilha.suggestedFilename()).toBe('atendimento.xlsx');
  const pasta = await abrirPasta(new Blob([await readFile(await planilha.path())]));
  expect(pasta.abas.map((a) => a.nome)).toEqual(['Atendimento']);
  const linhas = await lerAbaInteira(pasta, 'Atendimento');
  expect(linhas[0]).toEqual(['Dias em aberto', 'SC', 'Nome da filial', 'Regional', 'Filial', 'Solicitante', 'SLA', 'Produto', 'Status', 'Status Pré-Pedido', 'Comprador']);
  expect(linhas.length - 1).toBe(Number((await painel.locator('.tabela-contagem').textContent()).match(/(\d+) ite/)[1]));
  expect(typeof linhas[1][0]).toBe('number');

  await painel.getByRole('tab', { name: 'Saving' }).click();
  await expect(cartao(painel, '% Saving')).toHaveText('10,00%');
  await painel.getByRole('tab', { name: 'Entrega' }).click();
  await expect(cartao(painel, 'OFs não entregues')).toHaveText('1');
  await painel.getByRole('tab', { name: 'Status' }).click();
  await expect(cartao(painel, 'SCs no período')).toHaveText('3');
  await expect(painel.locator('.cartao', { has: painel.locator('.cartao-rotulo', { hasText: 'SCs no período' }) }).locator('.cartao-detalhe')).toHaveText('4 itens · 12/09/2026 a 11/11/2026');

  // Dados embutidos: só campos públicos; nada de pré-pedido nem de-para.
  const dados = await painel.evaluate(async () => {
    const b = Uint8Array.from(atob(document.getElementById('dados').textContent.trim()), (c) => c.charCodeAt(0));
    return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  });
  expect(dados).not.toContain('PP-1');
  expect(dados).not.toContain('numeroPrePedido');
  if (COMPRADOR.nome && COMPRADOR.nome !== COMPRADOR.apelido) expect(dados).not.toContain(COMPRADOR.nome);
  expect(erros).toEqual([]);

  // Dados de outra versão: aviso no lugar do esqueleto (o erro vem depois de descompactar).
  const outraVersao = gzipSync(JSON.stringify({ versao: 0 })).toString('base64');
  const caminhoRuim = info.outputPath('painel-outra-versao.html');
  await writeFile(caminhoRuim, html.replace(/(<script id="dados" type="text\/plain">)[^<]*(<\/script>)/, (_, a, b) => `${a}${outraVersao}${b}`));
  await painel.goto(pathToFileURL(caminhoRuim).href);
  await expect(painel.locator('#conteudo .estado-vazio')).toContainText('Não foi possível abrir os dados do painel (Versão de dados desconhecida: 0)');
  expect(erros).toEqual([]);
});

test('painel no quadro isolado do SharePoint: aviso, sem Exportar Excel e sem imprimir, telas funcionam', async ({ page, context }, info) => {
  const { html } = await gerarPainel(page, info);
  const host = await context.newPage();
  const erros = [];
  host.on('pageerror', (e) => erros.push(e.message));
  await host.setContent('<iframe id="q" sandbox="allow-scripts" style="width:1200px;height:900px;border:0"></iframe>');
  await host.locator('#q').evaluate((f, h) => { f.srcdoc = h; }, html);
  const quadro = host.frameLocator('#q');
  await expect(quadro.getByRole('tab')).toHaveText(TELAS);
  await expect(cartao(quadro, 'SCs em aberto')).toHaveText('2');
  await expect(quadro.locator('#aviso-quadro')).toBeVisible();
  await expect(quadro.locator('#acao-imprimir')).toBeHidden();
  await expect(quadro.getByRole('button', { name: 'Exportar Excel' })).toHaveCount(0);
  await quadro.getByRole('tab', { name: 'Atendimento' }).click();
  await expect(quadro.getByRole('button', { name: 'Copiar tabela', exact: true })).toBeVisible();
  await expect(quadro.getByRole('button', { name: 'Exportar Excel' })).toHaveCount(0);
  await expect(quadro.getByRole('button', { name: 'Copiar tabela' }).first()).toBeVisible();

  // Contratos abrem na janela também dentro do quadro (sem Exportar Excel lá dentro).
  await quadro.locator('#acao-contratos').click();
  await expect(quadro.getByRole('dialog', { name: 'Contratos' }).getByRole('tab')).toHaveCount(4);
  await expect(quadro.getByRole('dialog', { name: 'Contratos' }).getByRole('button', { name: 'Exportar Excel' })).toHaveCount(0);
  await quadro.getByRole('dialog', { name: 'Contratos' }).getByRole('button', { name: 'Fechar' }).click();

  // Tema e filtros funcionam sem armazenamento.
  await quadro.locator('#acao-tema').click();
  await quadro.getByRole('tab', { name: 'Saving' }).click();
  await expect(cartao(quadro, '% Saving')).toHaveText('10,00%');
  await quadro.getByRole('tab', { name: 'Spend' }).click();
  await expect(cartao(quadro, 'OFs')).toHaveText('1');
  expect(erros).toEqual([]);
});
