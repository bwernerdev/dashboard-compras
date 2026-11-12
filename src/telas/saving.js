// Tela Saving: total comprado (pedido c/ impostos), economia (Saving Real) e % saving.
// Substitui as abas "Saving" e "Spend". % Saving = economia ÷ (total + economia), como na planilha.
import { el } from '../ui/dom.js';
import { cartao, linhaDeCartoes, bloco, estadoVazio } from '../ui/cartoes.js';
import { barras } from '../ui/graficos.js';
import { criarTabela } from '../ui/tabela.js';
import * as fmt from '../ui/formatos.js';
import { seloDoSaving } from '../ui/cores-planilha.js';
import {
  resumoSaving, savingPorFilial, savingPorComprador, savingPorMes, rotuloMes, pctSaving,
} from '../analise.js';

const somar = (linhas, campo) => linhas.reduce((s, l) => s + l[campo], 0);

function colunasSaving(rotulo) {
  return [
    { id: 'chave', rotulo, valor: (g) => g.chave },
    { id: 'total', rotulo: 'Total comprado', num: true, valor: (g) => g.total, formato: fmt.moedaCentavos },
    { id: 'economia', rotulo: 'Economia', num: true, valor: (g) => g.economia, formato: fmt.moedaCentavos },
    { id: 'pct', rotulo: '% Saving', num: true, valor: (g) => g.pct, formato: fmt.pctFino, exibir: (g) => seloDoSaving(g.pct, fmt.pctFino(g.pct)) },
    { id: 'itens', rotulo: 'Itens com saving', num: true, valor: (g) => g.itensComSaving, formato: fmt.inteiro },
  ];
}

const rodapeSaving = (rotulo) => (linhas) => {
  const total = somar(linhas, 'total');
  const economia = somar(linhas, 'economia');
  return [rotulo, fmt.moedaCentavos(total), fmt.moedaCentavos(economia), fmt.pctFino(pctSaving(total, economia)), fmt.inteiro(somar(linhas, 'itensComSaving'))];
};

export function telaSaving(ctx) {
  const regs = ctx.registros;
  if (!regs.length) return estadoVazio('Nenhuma linha com os filtros atuais.', ctx);

  const r = resumoSaving(regs);
  const porFilial = savingPorFilial(regs);
  const porComprador = savingPorComprador(regs);
  const porMes = savingPorMes(regs);

  const cartoes = linhaDeCartoes(
    cartao({ icone: 'carrinho', rotulo: 'Total comprado', valor: fmt.moedaCompacta(r.total), detalhe: `${fmt.moedaCentavos(r.total)} em pedidos c/ impostos` }),
    cartao({ icone: 'moeda', rotulo: 'Economia', valor: fmt.moedaCompacta(r.economia), detalhe: fmt.moedaCentavos(r.economia) }),
    cartao({ icone: 'porcentagem', rotulo: '% Saving', valor: fmt.pctFino(r.pct), detalhe: 'Economia ÷ (total comprado + economia)' }),
    cartao({ icone: 'lista', rotulo: 'Itens com saving', valor: fmt.inteiro(r.itensComSaving), detalhe: `de ${fmt.inteiro(regs.length)} itens` }),
  );

  const filiais = bloco(
    { titulo: 'Economia por filial' },
    barras({
      itens: [...porFilial].sort((a, b) => b.economia - a.economia).map((g) => ({
        id: g.chave, rotulo: g.chave, valor: g.economia,
        detalhe: [{ valor: fmt.moeda(g.total), rotulo: 'total comprado' }, { valor: fmt.pctFino(g.pct), rotulo: 'saving' }],
      })),
      formato: fmt.moedaCompacta,
      rotuloSerie: 'de economia',
      aoClicar: (filial) => ctx.filtrar('filial', filial),
    }),
    criarTabela({
      titulo: 'Saving por filial', linhas: porFilial, pesquisa: false, ordem: { coluna: 'total', desc: true },
      nomeArquivo: 'saving-por-filial.csv', colunas: colunasSaving('Filial'), rodape: rodapeSaving('Total geral'),
      aoClicarLinha: (g) => ctx.filtrar('filial', g.chave),
    }).elemento,
  );

  const meses = bloco(
    { titulo: 'Economia por mês do pedido' },
    // Barras deitadas, como Spend por mês (poucos meses não esticam o gráfico).
    porMes.length ? barras({
      itens: porMes.map((g) => ({
        id: g.chave, rotulo: rotuloMes(g.chave), valor: g.economia,
        detalhe: [{ valor: fmt.moeda(g.total), rotulo: 'total comprado' }, { valor: fmt.pctFino(g.pct), rotulo: 'saving' }],
      })),
      formato: fmt.moedaCompacta,
      rotuloSerie: 'de economia',
    }) : el('p', { class: 'texto-fraco' }, 'Sem pedidos no recorte.'),
    criarTabela({
      titulo: 'Saving por mês do pedido',
      linhas: porMes.map((g) => ({ ...g, chave: rotuloMes(g.chave), ordem: g.chave })),
      pesquisa: false, nomeArquivo: 'saving-por-mes.csv',
      colunas: [{ ...colunasSaving('Mês')[0], valor: (g) => g.chave }, ...colunasSaving('Mês').slice(1)],
      rodape: rodapeSaving('Total geral'),
    }).elemento,
  );

  const compradores = bloco(
    { titulo: 'Saving por comprador' },
    criarTabela({
      titulo: 'Saving por comprador', linhas: porComprador, pesquisa: false, ordem: { coluna: 'economia', desc: true },
      nomeArquivo: 'saving-por-comprador.csv', colunas: colunasSaving('Comprador'), rodape: rodapeSaving('Total geral'),
      aoClicarLinha: (g) => ctx.filtrar('comprador', g.chave),
    }).elemento,
  );

  return el('div', { class: 'tela' }, cartoes, el('div', { class: 'grade-2' }, filiais, el('div', { class: 'pilha' }, meses, compradores)));
}
