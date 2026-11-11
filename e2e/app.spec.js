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

  // Faixa "Até 5 dias" recorta a lista.
  await page.getByRole('button', { name: /^Até 5 dias/ }).click();
  await expect(page.locator('.recortes .chip')).toContainText('Até 5 dias');
  await expect(page.locator('.bloco', { hasText: 'Um item por linha' }).locator('.tabela-contagem')).toHaveText('1 linha');

  // Clique na linha da regional filtra o painel inteiro.
  await page.locator('tr.clicavel', { hasText: FILIAL_A.regional }).click();
  await expect(page.locator('[data-filtro="regional"] .filtro-valor')).toHaveText(FILIAL_A.regional);
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.locator('[data-filtro="regional"] .filtro-valor')).toHaveText('Todos');
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
  const bloco = page.locator('.bloco', { hasText: 'Um item por linha' });
  const [download] = await Promise.all([page.waitForEvent('download'), bloco.getByRole('button', { name: 'Exportar CSV' }).click()]);
  expect(download.suggestedFilename()).toBe('scs-em-aberto.csv');
  const texto = await readFile(await download.path(), 'utf8');
  expect(texto.startsWith('﻿Dias em aberto;Dias da aprovação;SC;')).toBe(true);
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
