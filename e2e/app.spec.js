// Fluxo completo no navegador com bases fictícias (e2e/ajuda/bases.js).
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { arquivoBase, arquivoFollowUp, FILIAL_A, FILIAL_B, COMPRADOR } from './ajuda/bases.js';

const valorDoCartao = (page, rotulo) => page.locator('.cartao', { has: page.locator('.cartao-rotulo', { hasText: rotulo }) }).locator('.cartao-valor');

async function importarBase(page) {
  await page.goto('./');
  await page.locator('input[data-tipo="base"]').setInputFiles(await arquivoBase());
  await expect(valorDoCartao(page, 'SCs em aberto')).toBeVisible();
}

test('sem bases mostra a importação; arquivo errado mostra o motivo', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Importe as bases do ME' })).toBeVisible();
  await expect(page.locator('#filtros')).toBeHidden();
  await page.locator('input[data-tipo="base"]').setInputFiles(await arquivoFollowUp());
  await expect(page.locator('.arquivo[data-tipo="base"] .arquivo-status')).toContainText('não parece ser o relatório');
});

test('Regional: cartões, período, faixa e filtro por clique', async ({ page }) => {
  await importarBase(page);
  await expect(page.locator('#periodo')).toContainText('12/09/2026 a 11/11/2026');
  await expect(valorDoCartao(page, 'SCs em aberto')).toHaveText('2');
  await expect(page.locator('.cartao', { hasText: 'SCs em aberto' }).locator('.cartao-detalhe')).toContainText('3 itens');
  await expect(valorDoCartao(page, 'Itens fora do prazo')).toHaveText('2');
  await expect(valorDoCartao(page, 'SLA no prazo')).toHaveText('33,3%');

  // Lista agrupada por SC: dados da SC só na 1ª linha (como a tabela dinâmica da planilha).
  const lista = page.locator('.bloco', { hasText: 'Itens agrupados por SC' });
  await expect(lista.locator('.tabela-contagem')).toHaveText('2 SCs, 3 itens');
  const linhas = lista.locator('tbody tr');
  await expect(lista.locator('thead th')).toHaveText(['Atendida', /^Dias da aprovação/, 'SC', 'Data', 'Prioridade', 'Status', 'Produto', 'Código', 'Qtd.', 'Solicitante', 'Filial', 'Nome da filial', 'Comprador', 'Regional']);
  await expect(linhas.nth(0).locator('td').nth(2)).toHaveText('1000002');
  await expect(linhas.nth(1).locator('td').nth(2)).toHaveText('');
  await expect(linhas.nth(1)).toContainText('Em pendências de compra');
  await expect(linhas.nth(2).locator('td').nth(2)).toHaveText('1000001 (regularização)');
  // Regularização: linha vermelha + legenda.
  await expect(linhas.nth(2)).toHaveClass(/linha-regularizacao/);
  await expect(linhas.nth(0)).not.toHaveClass(/linha-regularizacao/);
  await expect(lista.locator('.legenda-lista')).toContainText('SC de regularização (1 SC em aberto)');

  // Status: atalho "Só pendências".
  await lista.getByRole('button', { name: 'Só pendências' }).click();
  await expect(lista.locator('.tabela-contagem')).toHaveText('1 SC, 1 item');
  await expect(lista.locator('[data-filtro="status"] .filtro-valor')).toHaveText('Em pendências de compra');

  // Status: vários de uma vez; a lista de marcar continua aberta.
  await lista.locator('[data-filtro="status"] .filtro-botao').click();
  await lista.getByRole('checkbox', { name: /^Em Cotação/ }).check();
  await expect(lista.locator('.tabela-contagem')).toHaveText('2 SCs, 3 itens');
  await expect(lista.locator('[data-filtro="status"] .filtro-valor')).toHaveText('2 selecionados');
  await expect(lista.getByRole('checkbox', { name: /^Em Cotação/ })).toBeVisible();
  await lista.getByRole('checkbox', { name: /^Em pendências de compra/ }).uncheck();
  await expect(lista.locator('.tabela-contagem')).toHaveText('2 SCs, 2 itens');
  await lista.locator('[data-filtro="status"]').getByRole('button', { name: 'Todos' }).click();
  await page.keyboard.press('Escape');

  // Faixa "Até 5 dias" recorta a lista.
  await page.getByRole('button', { name: /^Até 5 dias/ }).click();
  await expect(page.locator('.recortes .chip')).toContainText('Até 5 dias');
  await expect(lista.locator('.tabela-contagem')).toHaveText('1 SC, 1 item');

  // Clique na linha da regional filtra o painel inteiro.
  await page.locator('tr.clicavel', { hasText: FILIAL_A.regional }).click();
  await expect(page.locator('[data-filtro="regional"] .filtro-valor')).toHaveText(FILIAL_A.regional);
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.locator('[data-filtro="regional"] .filtro-valor')).toHaveText('Todos');
});

test('olho e duplo clique ocultam SC atendida; mostrar e desfazer', async ({ page }) => {
  await importarBase(page);
  const lista = page.locator('.bloco', { hasText: 'Itens agrupados por SC' });
  const contagem = lista.locator('.tabela-contagem');
  await expect(contagem).toHaveText('2 SCs, 3 itens');
  await expect(lista.getByRole('button', { name: /^Mostrar atendidas/ })).toBeHidden();

  // Olho: some a SC inteira (os 2 itens), cartões não mudam.
  await lista.getByRole('button', { name: 'Marcar SC 1000002 como atendida (ocultar)' }).click();
  await expect(contagem).toHaveText('1 SC, 1 item');
  await expect(lista.getByRole('status')).toContainText('SC 1000002 marcada como atendida e oculta');
  await expect(valorDoCartao(page, 'SCs em aberto')).toHaveText('2');

  // Desfazer volta.
  await lista.getByRole('button', { name: 'Desfazer' }).click();
  await expect(contagem).toHaveText('2 SCs, 3 itens');

  // Duplo clique em qualquer linha do item também oculta.
  await lista.locator('tbody tr', { hasText: '1000001' }).dblclick();
  await expect(contagem).toHaveText('1 SC, 2 itens');

  // Fica salvo no navegador.
  await page.reload();
  await expect(contagem).toHaveText('1 SC, 2 itens');

  // "Mostrar atendidas": volta apagada, olho riscado desfaz.
  await lista.getByRole('button', { name: 'Mostrar atendidas (1)' }).click();
  await expect(contagem).toHaveText('2 SCs, 3 itens');
  await expect(lista.locator('tbody tr.linha-atendida')).toHaveCount(1);
  await lista.getByRole('button', { name: 'Voltar a SC 1000001 para a lista' }).click();
  await expect(lista.locator('tbody tr.linha-atendida')).toHaveCount(0);

  // CSV não leva a coluna do olho.
  const [download] = await Promise.all([page.waitForEvent('download'), lista.getByRole('button', { name: 'Exportar CSV' }).click()]);
  expect((await readFile(await download.path(), 'utf8')).startsWith('﻿Dias da aprovação;')).toBe(true);
});

test('filtro global pela lista; Esc fecha', async ({ page }) => {
  await importarBase(page);
  await page.locator('[data-filtro="prioridade"] .filtro-botao').click();
  await page.getByRole('checkbox', { name: 'URGENTE' }).check();
  await expect(valorDoCartao(page, 'SCs em aberto')).toHaveText('1');
  await expect(page.getByRole('checkbox', { name: 'URGENTE' })).toBeVisible(); // lista continua aberta
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-filtro="prioridade"] .filtro-painel')).toBeHidden();
});

test('Compradores e Saving', async ({ page }) => {
  await importarBase(page);
  await page.getByRole('tab', { name: 'Compradores' }).click();
  await expect(valorDoCartao(page, 'SCs no período')).toHaveText('3');
  await expect(valorDoCartao(page, 'Pré-pedidos')).toHaveText('2'); // PP-1 + vazio (como na planilha)
  const tabela = page.getByRole('table', { name: 'SCs por comprador e status' });
  await expect(tabela.locator('tbody tr', { hasText: COMPRADOR.apelido }).locator('td').last()).toHaveText('3');

  await page.getByRole('tab', { name: 'Saving' }).click();
  await expect(page.locator('[data-filtro="mes"]')).toBeVisible(); // filtro só desta tela
  const economia = page.locator('.cartao', { has: page.locator('.cartao-rotulo', { hasText: /^Economia$/ }) });
  await expect(economia.locator('.cartao-detalhe')).toHaveText(/R\$\s100,00/);
  await expect(valorDoCartao(page, '% Saving')).toHaveText('10,00%');
  await expect(page.getByRole('table', { name: 'Saving por filial' }).locator('tbody tr').first()).toContainText(FILIAL_B.nome.trim());
});

test('bases ficam salvas no navegador e a aba é lembrada', async ({ page }) => {
  await importarBase(page);
  await page.getByRole('tab', { name: 'Saving' }).click();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Saving' })).toHaveAttribute('aria-selected', 'true');
  await expect(valorDoCartao(page, '% Saving')).toHaveText('10,00%');
});

test('exporta CSV para o Excel pt-BR', async ({ page }) => {
  await importarBase(page);
  const bloco = page.locator('.bloco', { hasText: 'Itens agrupados por SC' });
  const [download] = await Promise.all([page.waitForEvent('download'), bloco.getByRole('button', { name: 'Exportar CSV' }).click()]);
  expect(download.suggestedFilename()).toBe('scs-em-aberto.csv');
  const texto = await readFile(await download.path(), 'utf8');
  expect(texto.startsWith('﻿Dias da aprovação;SC;Data;Prioridade;Status;Produto;')).toBe(true);
  expect(texto.trim().split('\r\n')).toHaveLength(4); // cabeçalho + 3 itens
});

test('configuração: editar SLA recalcula; restaurar padrão volta', async ({ page }) => {
  await importarBase(page);
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Configuração' }).click();
  await page.getByLabel('SLA (dias úteis), linha 2, Máx.').fill('500');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(valorDoCartao(page, 'Itens fora do prazo')).toHaveText('0');

  await page.reload();
  await expect(valorDoCartao(page, 'Itens fora do prazo')).toHaveText('0'); // config salva

  await page.getByRole('button', { name: 'Configuração' }).click();
  await page.getByRole('button', { name: 'Restaurar padrão' }).click();
  await expect(valorDoCartao(page, 'Itens fora do prazo')).toHaveText('2');
});

test('tema escuro alterna e fica salvo', async ({ page }) => {
  await page.goto('./');
  const html = page.locator('html');
  const inicial = await html.getAttribute('data-theme');
  await page.locator('#acao-tema').click();
  const novo = inicial === 'dark' ? 'light' : 'dark';
  await expect(html).toHaveAttribute('data-theme', novo);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', novo);
});
