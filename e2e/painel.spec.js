// "Gerar painel": baixa o painel-compras.html e abre como arquivo e dentro de um quadro isolado
// (igual à pré-visualização do SharePoint: iframe sandbox, srcdoc, sem armazenamento nem download).
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { arquivoBase, COMPRADOR } from './ajuda/bases.js';

const cartao = (raiz, rotulo) => raiz.locator('.cartao', { has: raiz.locator('.cartao-rotulo', { hasText: rotulo }) }).locator('.cartao-valor');

async function gerarPainel(page, info) {
  await page.goto('./');
  await expect(page.locator('#acao-painel')).toBeDisabled();
  await page.locator('input[data-tipo="base"]').setInputFiles(await arquivoBase());
  await expect(cartao(page, 'SCs em aberto')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#acao-painel').click()]);
  expect(download.suggestedFilename()).toBe('painel-compras.html');
  await expect(page.getByRole('heading', { name: 'Painel gerado' })).toBeVisible();
  // Com extensão .html (o download.path() não tem), senão o navegador abre como texto.
  const caminho = info.outputPath('painel-compras.html');
  await download.saveAs(caminho);
  return { caminho, html: await readFile(caminho, 'utf8') };
}

test('painel aberto como arquivo: só Regional e Saving, sem dados internos', async ({ page, context }, info) => {
  const { caminho, html } = await gerarPainel(page, info);
  expect(html).not.toContain('__DADOS_DO_PAINEL__');

  const painel = await context.newPage();
  const erros = [];
  painel.on('pageerror', (e) => erros.push(e.message));
  await painel.goto(pathToFileURL(caminho).href);
  await expect(painel.getByRole('tab')).toHaveText(['Regional', 'Saving']);
  await expect(cartao(painel, 'SCs em aberto')).toHaveText('2');
  await expect(painel.locator('#periodo')).toContainText('dados de');
  await expect(painel.locator('#aviso-quadro')).toBeHidden();
  await expect(painel.locator('#acao-imprimir')).toBeVisible();
  await expect(painel.getByRole('button', { name: 'Exportar CSV' }).first()).toBeVisible();

  await painel.getByRole('tab', { name: 'Saving' }).click();
  await expect(cartao(painel, '% Saving')).toHaveText('10,00%');

  // Dados embutidos: só campos públicos; nada de pré-pedido nem de-para.
  const dados = await painel.evaluate(async () => {
    const b = Uint8Array.from(atob(document.getElementById('dados').textContent.trim()), (c) => c.charCodeAt(0));
    return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  });
  expect(dados).not.toContain('PP-1');
  expect(dados).not.toContain('numeroPrePedido');
  if (COMPRADOR.nome && COMPRADOR.nome !== COMPRADOR.apelido) expect(dados).not.toContain(COMPRADOR.nome);
  expect(erros).toEqual([]);
});

test('painel no quadro isolado do SharePoint: aviso, sem CSV e sem imprimir, telas funcionam', async ({ page, context }, info) => {
  const { html } = await gerarPainel(page, info);
  const host = await context.newPage();
  const erros = [];
  host.on('pageerror', (e) => erros.push(e.message));
  await host.setContent('<iframe id="q" sandbox="allow-scripts" style="width:1200px;height:900px;border:0"></iframe>');
  await host.locator('#q').evaluate((f, h) => { f.srcdoc = h; }, html);
  const quadro = host.frameLocator('#q');
  await expect(quadro.getByRole('tab')).toHaveText(['Regional', 'Saving']);
  await expect(cartao(quadro, 'SCs em aberto')).toHaveText('2');
  await expect(quadro.locator('#aviso-quadro')).toBeVisible();
  await expect(quadro.locator('#acao-imprimir')).toBeHidden();
  await expect(quadro.getByRole('button', { name: 'Exportar CSV' })).toHaveCount(0);
  await expect(quadro.getByRole('button', { name: 'Copiar tabela' }).first()).toBeVisible();

  // Tema e filtros funcionam sem armazenamento.
  await quadro.locator('#acao-tema').click();
  await quadro.getByRole('tab', { name: 'Saving' }).click();
  await expect(cartao(quadro, '% Saving')).toHaveText('10,00%');
  expect(erros).toEqual([]);
});
