// Fluxo completo no navegador com bases fictícias (e2e/ajuda/bases.js).
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { arquivoBase, arquivoFollowUp, FILIAL_A, FILIAL_B, COMPRADOR } from './ajuda/bases.js';

const valorDoCartao = (page, rotulo) => page.locator('.cartao', { has: page.locator('.cartao-rotulo', { hasText: rotulo }) }).locator('.cartao-valor');

// A lista de SCs da Regional abre em tela cheia na 1ª vez (cobre abas e cartões). Nos demais
// testes ela começa fora da tela cheia; o teste da tela cheia usa o padrão.
test.beforeEach(async ({ page }) => {
  if (test.info().title.startsWith('lista de SCs em tela cheia')) return;
  await page.addInitScript(() => {
    const chave = 'dashboard-compras:lista-tela-cheia-2';
    if (localStorage.getItem(chave) === null) localStorage.setItem(chave, 'nao');
  });
});

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
  // Regularização: linha vermelha (sem legenda, a pedido da equipe).
  await expect(linhas.nth(2)).toHaveClass(/linha-regularizacao/);
  await expect(linhas.nth(0)).not.toHaveClass(/linha-regularizacao/);
  await expect(lista.locator('.legenda-lista')).toHaveCount(0);

  // Status: atalho "Só pendências".
  await lista.getByRole('button', { name: 'Só pendências' }).click();
  await expect(lista.locator('.tabela-contagem')).toHaveText('1 SC, 1 item');
  await expect(lista.locator('[data-filtro="status"] .filtro-valor')).toHaveText('Em pendências de compra');

  // Status: marcar as duas = Todos; a lista de marcar continua aberta.
  await lista.locator('[data-filtro="status"] .filtro-botao').click();
  await lista.getByRole('checkbox', { name: /^Em Cotação/ }).check();
  await expect(lista.locator('.tabela-contagem')).toHaveText('2 SCs, 3 itens');
  await expect(lista.locator('[data-filtro="status"] .filtro-valor')).toHaveText('Todos');
  await expect(lista.getByRole('checkbox', { name: 'Todos', exact: true })).toBeChecked();
  // Desmarcar uma tira só ela (como no Excel).
  await lista.getByRole('checkbox', { name: /^Em pendências de compra/ }).uncheck();
  await expect(lista.locator('.tabela-contagem')).toHaveText('2 SCs, 2 itens');
  await expect(lista.getByRole('checkbox', { name: 'Todos', exact: true })).not.toBeChecked();
  await lista.getByRole('checkbox', { name: 'Todos', exact: true }).check();
  await expect(lista.locator('.tabela-contagem')).toHaveText('2 SCs, 3 itens');
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

test('olho e duplo clique recolhem SC atendida numa linha; desfazer e expandir', async ({ page }) => {
  await importarBase(page);
  const lista = page.locator('.bloco', { hasText: 'Itens agrupados por SC' });
  const contagem = lista.locator('.tabela-contagem');
  const linhas = lista.locator('tbody tr');
  await expect(contagem).toHaveText('2 SCs, 3 itens');
  await expect(linhas).toHaveCount(3);

  // Olho: a SC 1000002 (2 itens) vira uma linha só com Dias da aprovação e SC, como na planilha.
  await lista.getByRole('button', { name: 'Marcar SC 1000002 como atendida (recolher)' }).click();
  await expect(contagem).toHaveText('2 SCs (1 atendida), 3 itens');
  await expect(linhas).toHaveCount(2);
  const recolhida = lista.locator('tbody tr.grupo-recolhido');
  await expect(recolhida.locator('td').nth(2)).toHaveText('1000002');
  await expect(recolhida.locator('td').nth(1)).not.toHaveText('');
  await expect(recolhida.locator('td').nth(5)).toHaveText(''); // status e o resto vazios
  await expect(lista.locator('.aviso-atendida')).toHaveCount(0); // sem aviso
  await expect(valorDoCartao(page, 'SCs em aberto')).toHaveText('2');

  // Olho riscado expande.
  await lista.getByRole('button', { name: 'Expandir SC 1000002 (desmarcar atendida)' }).click();
  await expect(linhas).toHaveCount(3);
  await expect(contagem).toHaveText('2 SCs, 3 itens');

  // Dois cliques no número da SC só selecionam (para copiar): a SC fica.
  const linhaSc = lista.locator('tbody tr', { hasText: '1000001' });
  await linhaSc.locator('td').nth(2).dblclick();
  await expect(contagem).toHaveText('2 SCs, 3 itens');
  await expect(page.evaluate(() => getSelection().toString())).resolves.toContain('1000001');
  // Dois cliques fora do número recolhem (a SC 1000001 tem 1 item: a linha fica, só com Dias e SC).
  await linhaSc.locator('td').nth(6).dblclick();
  await expect(contagem).toHaveText('2 SCs (1 atendida), 3 itens');
  await expect(lista.locator('tbody tr.grupo-recolhido')).toHaveCount(1);

  // Fica salvo no navegador.
  await page.reload();
  await expect(contagem).toHaveText('2 SCs (1 atendida), 3 itens');

  // Olho riscado expande de novo.
  await lista.getByRole('button', { name: 'Expandir SC 1000001 (desmarcar atendida)' }).click();
  await expect(lista.locator('tbody tr.grupo-recolhido')).toHaveCount(0);
  await expect(contagem).toHaveText('2 SCs, 3 itens');

  // CSV não leva a coluna do olho.
  const [download] = await Promise.all([page.waitForEvent('download'), lista.getByRole('button', { name: 'Exportar CSV' }).click()]);
  expect((await readFile(await download.path(), 'utf8')).startsWith('﻿Dias da aprovação;')).toBe(true);
});

test('lista de SCs em tela cheia: abre assim na 1ª vez, Esc (depois da lista de marcar), botão e lembrada', async ({ page }) => {
  await importarBase(page);
  const lista = page.locator('.bloco', { hasText: 'Itens agrupados por SC' });
  await expect(lista).toHaveClass(/tela-cheia/); // padrão do app da equipe
  const caixa = await lista.boundingBox();
  const janela = page.viewportSize();
  expect(Math.round(caixa.width)).toBe(janela.width);
  expect(Math.round(caixa.height)).toBe(janela.height);
  // Tabela de borda a borda: sem margem à esquerda, à direita e embaixo.
  const rolagem = await lista.locator('.tabela-rolagem').boundingBox();
  expect(Math.round(rolagem.x)).toBe(0);
  expect(Math.round(rolagem.x + rolagem.width)).toBe(janela.width);
  expect(Math.round(rolagem.y + rolagem.height)).toBe(janela.height);

  // Esc com a lista de Status aberta fecha só a lista; o próximo Esc sai da tela cheia.
  await lista.locator('[data-filtro="status"] .filtro-botao').click();
  await page.keyboard.press('Escape');
  await expect(lista.locator('[data-filtro="status"] .filtro-painel')).toBeHidden();
  await expect(lista).toHaveClass(/tela-cheia/);
  await page.keyboard.press('Escape');
  await expect(lista).not.toHaveClass(/tela-cheia/);

  await page.reload(); // a escolha fica lembrada neste navegador
  await expect(lista).not.toHaveClass(/tela-cheia/);
  await lista.getByRole('button', { name: 'Tela cheia' }).click();
  await expect(lista).toHaveClass(/tela-cheia/);
  await page.reload();
  await expect(lista).toHaveClass(/tela-cheia/);
});

test('lista de SCs: cabe na largura e oculta colunas (lembrado)', async ({ page }) => {
  // Larguras salvas largas (como no navegador da equipe): a lista passaria da janela.
  await page.addInitScript(() => localStorage.setItem('dashboard-compras:larguras:scs-em-aberto.csv',
    JSON.stringify({ descricao: 600, solicitante: 400, nomeFilial: 300 })));
  await importarBase(page);
  const lista = page.locator('.bloco', { hasText: 'Itens agrupados por SC' });
  const rolagem = lista.locator('.tabela-rolagem');
  const semRolarParaOLado = async () => rolagem.evaluate((r) => r.scrollWidth <= r.clientWidth + 1);
  await expect.poll(semRolarParaOLado).toBe(true);

  const coluna = lista.locator('thead th', { hasText: 'Solicitante' });
  await expect(coluna).toBeVisible();
  await lista.locator('[data-filtro="colunas"] .filtro-botao').click();
  await lista.locator('[data-filtro="colunas"] label', { hasText: 'Solicitante' }).click();
  await expect(coluna).toBeHidden();
  await expect(lista.locator('[data-filtro="colunas"] .filtro-valor')).toHaveText('1 oculta');
  await page.reload();
  await expect(coluna).toBeHidden();
  await expect(lista.locator('[data-filtro="colunas"] .filtro-valor')).toHaveText('1 oculta');
});

test('filtros globais ficam salvos no navegador', async ({ page }) => {
  await importarBase(page);
  const filtro = page.locator('[data-filtro="prioridade"]');
  await filtro.locator('.filtro-botao').click();
  await filtro.getByLabel('Todos').uncheck();
  await filtro.getByLabel('URGENTE').check();
  await page.keyboard.press('Escape');
  await expect(filtro.locator('.filtro-valor')).toHaveText('URGENTE');
  await page.reload();
  await expect(filtro.locator('.filtro-valor')).toHaveText('URGENTE');
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await page.reload();
  await expect(filtro.locator('.filtro-valor')).toHaveText('Todos');
});

test('largura da coluna: arrastar, setas, autoajuste com dois cliques, lembrada e "Larguras originais"', async ({ page }) => {
  await importarBase(page);
  const lista = page.locator('.bloco', { hasText: 'Itens agrupados por SC' });
  const th = lista.locator('thead th', { hasText: 'Produto' });
  const alca = th.locator('.th-alca');
  const largura = async () => Math.round((await th.boundingBox()).width);
  const antes = await largura();

  // Arrastar a borda alarga; não reordena a lista.
  await alca.hover(); // rola até a borda (fora da tela o mouse não chega nela)
  const caixa = await alca.boundingBox();
  await page.mouse.move(caixa.x + 3, caixa.y + caixa.height / 2);
  await page.mouse.down();
  await page.mouse.move(caixa.x + 123, caixa.y + caixa.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(await largura()).toBe(antes + 120);
  await expect(lista.locator('thead th', { hasText: 'Dias da aprovação' })).toHaveAttribute('aria-sort', 'descending');

  // Setas com o foco na borda: 10 px (Shift: 50).
  await alca.focus();
  await page.keyboard.press('Shift+ArrowLeft');
  expect(await largura()).toBe(antes + 70);

  // Lembrada ao recarregar; "Larguras originais" volta ao automático.
  await page.reload();
  expect(await largura()).toBe(antes + 70);
  await lista.getByRole('button', { name: 'Larguras originais' }).click();
  expect(await largura()).toBe(antes);
  await expect(lista.getByRole('button', { name: 'Larguras originais' })).toBeHidden();

  // Estreita com reticências; dois cliques na borda ajustam ao conteúdo (nada cortado).
  const cortadas = () => lista.locator('tbody td.c-6').evaluateAll((tds) => tds.filter((td) => td.scrollWidth > td.clientWidth + 1).length);
  await alca.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowLeft');
  expect(await largura()).toBe(40);
  expect(await cortadas()).toBeGreaterThan(0);
  await alca.dblclick();
  expect(await cortadas()).toBe(0);
  expect(await largura()).toBeGreaterThan(40);
  await expect(lista.locator('thead th', { hasText: 'Dias da aprovação' })).toHaveAttribute('aria-sort', 'descending');
});

test('filtro global pela lista; Esc fecha', async ({ page }) => {
  await importarBase(page);
  const prioridade = page.locator('[data-filtro="prioridade"]');
  await prioridade.locator('.filtro-botao').click();
  // Sem filtro: Todos e todas as opções marcadas, como no Excel.
  await expect(prioridade.getByRole('checkbox', { name: 'Todos' })).toBeChecked();
  await expect(prioridade.getByRole('checkbox', { name: 'URGENTE' })).toBeChecked();
  // Desmarcar Todos limpa a lista sem mudar os números; marcar uma opção filtra por ela.
  await prioridade.getByRole('checkbox', { name: 'Todos' }).uncheck();
  await expect(prioridade.getByRole('checkbox', { name: 'URGENTE' })).not.toBeChecked();
  await expect(prioridade.locator('.filtro-valor')).toHaveText('Marque uma opção');
  await expect(valorDoCartao(page, 'SCs em aberto')).toHaveText('2');
  await prioridade.getByRole('checkbox', { name: 'URGENTE' }).check();
  await expect(valorDoCartao(page, 'SCs em aberto')).toHaveText('1');
  await expect(prioridade.getByRole('checkbox', { name: 'URGENTE' })).toBeVisible(); // lista continua aberta
  // Todos volta a todas.
  await prioridade.getByRole('checkbox', { name: 'Todos' }).check();
  await expect(valorDoCartao(page, 'SCs em aberto')).toHaveText('2');
  await expect(prioridade.locator('.filtro-valor')).toHaveText('Todos');
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

test('abas na ordem da planilha; Status, Spend, Atendimento e Organograma', async ({ page }) => {
  await importarBase(page);
  await expect(page.getByRole('tab')).toHaveText(['Status', 'Entrega', 'Regional', 'Compradores', 'Spend', 'Saving', 'Atendimento', 'Organograma']);
  await expect(page.getByRole('tab', { name: 'Regional' })).toHaveAttribute('aria-selected', 'true'); // aba inicial

  await page.getByRole('tab', { name: 'Status' }).click();
  await expect(valorDoCartao(page, 'SCs no período')).toHaveText('3'); // filial fora do de-para descartada
  await expect(valorDoCartao(page, 'SCs em aberto')).toHaveText('2');
  await expect(valorDoCartao(page, 'SCs em pedido')).toHaveText('1');
  const lista = page.locator('.bloco', { hasText: 'Lista de SCs' });
  await expect(lista.locator('.tabela-contagem')).toHaveText('3 SCs, 4 itens');
  await page.getByRole('button', { name: /^Em Pedido: 1 SCs/ }).click(); // barra recorta a lista
  await expect(lista.locator('.tabela-contagem')).toHaveText('1 SC, 1 item');
  await expect(lista.locator('tbody tr').first()).toContainText('1000003');

  await page.getByRole('tab', { name: 'Spend' }).click();
  await expect(page.locator('[data-filtro="mes"]')).toBeVisible();
  await expect(valorDoCartao(page, 'OFs')).toHaveText('1');
  const spend = page.getByRole('table', { name: 'Spend por filial' });
  await expect(spend.locator('tbody tr').first()).toContainText(FILIAL_B.nome.trim());
  await expect(spend.locator('tbody tr').first()).toContainText('100%');

  await page.getByRole('tab', { name: 'Atendimento' }).click();
  await expect(valorDoCartao(page, 'Itens em aberto')).toHaveText('3');
  // Itens da mesma SC juntos: 2 SCs, 3 itens; a SC com 2 itens mostra o número só na 1ª linha.
  const atendimento = page.locator('.bloco', { hasText: 'Itens agrupados por SC, da mais antiga' });
  await expect(atendimento.locator('.tabela-contagem')).toHaveText('2 SCs, 3 itens');
  await expect(atendimento.locator('tbody tr.grupo-inicio')).toHaveCount(2);
  await expect(valorDoCartao(page, 'Fora do prazo')).toHaveText('2');
  await page.getByRole('button', { name: 'No prazo', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Itens em aberto' }).locator('tbody tr')).toHaveCount(1);

  await page.getByRole('tab', { name: 'Organograma' }).click();
  await expect(page.getByRole('heading', { name: "Organograma Suprimentos CD's" })).toBeVisible();
  await expect(page.locator('.org-no')).toHaveCount(8); // árvore: 4 líderes + 3 compradores + assessoria
  await expect(page.locator('.org-filiais')).toHaveCount(3);
  await expect(page.locator('img.org-foto')).toHaveCount(7); // fotos da planilha; Erico sem foto lá: iniciais
  await expect(page.locator('#conteudo')).not.toContainText('SCs em aberto'); // só o organograma
});

test('Entrega: sem Follow-Up avisa; com Follow-Up mostra OFs por status', async ({ page }) => {
  await importarBase(page);
  await page.getByRole('tab', { name: 'Entrega' }).click();
  await expect(page.locator('.estado-vazio')).toContainText('Sem a base Follow-Up');

  await page.locator('#acao-importar').click();
  await page.locator('dialog input[data-tipo="followUp"]').setInputFiles(await arquivoFollowUp());
  await expect(page.locator('dialog .arquivo[data-tipo="followUp"] .arquivo-status')).toContainText('3 linhas');
  await page.locator('dialog').getByRole('button', { name: 'Fechar' }).last().click();

  await expect(valorDoCartao(page, /^OFs$/)).toHaveText('2');
  await expect(valorDoCartao(page, 'OFs não entregues')).toHaveText('1');
  await expect(valorDoCartao(page, 'OFs entregues em parte')).toHaveText('1');
  const lista = page.locator('.bloco', { hasText: 'Lista de OFs' });
  await expect(lista.locator('.tabela-contagem')).toHaveText('2 OFs, 3 itens');

  // Filtro global vale para o Follow-Up também.
  await page.locator('[data-filtro="regional"] .filtro-botao').click();
  await page.locator('[data-filtro="regional"]').getByRole('checkbox', { name: 'Todos' }).uncheck();
  await page.getByRole('checkbox', { name: FILIAL_B.regional }).check();
  await expect(valorDoCartao(page, /^OFs$/)).toHaveText('1');
  await page.keyboard.press('Escape');
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

test('configuração: editar o de-para recalcula; restaurar padrão volta', async ({ page }) => {
  await importarBase(page);
  page.on('dialog', (d) => d.accept());
  const conteudo = page.locator('#conteudo');
  await page.getByRole('button', { name: 'Configuração' }).click();
  await expect(page.getByRole('dialog').getByLabel(/SLA/)).toHaveCount(0); // prazo do SLA é fixo (30 dias úteis)
  await page.getByLabel('Filiais, linha 1, Regional').fill('Regional Editada');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(conteudo.getByText('Regional Editada').first()).toBeVisible();

  await page.reload();
  await expect(conteudo.getByText('Regional Editada').first()).toBeVisible(); // config salva

  await page.getByRole('button', { name: 'Configuração' }).click();
  await page.getByRole('button', { name: 'Restaurar padrão' }).click();
  await expect(conteudo.getByText('Regional Editada')).toHaveCount(0);
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
