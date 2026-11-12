// Tela Spend: valor das OFs (pedido c/ impostos) por filial e % do total, e por mês do pedido.
// Substitui a aba "Spend" da planilha antiga (pizza e colunas por filial, segmentações Ano/Mês,
// Comprador, Contrato e Filial: aqui são os filtros globais). Pizza virou barras ordenadas.
import { el } from '../ui/dom.js';
import { cartao, linhaDeCartoes, bloco } from '../ui/cartoes.js';
import { barras, colunas } from '../ui/graficos.js';
import { criarTabela } from '../ui/tabela.js';
import * as fmt from '../ui/formatos.js';
import { spendPorFilial, resumoSpend, savingPorMes, rotuloMes } from '../analise.js';

export function telaSpend(ctx) {
  const porFilial = spendPorFilial(ctx.registros);
  if (!porFilial.length) return el('div', { class: 'estado-vazio' }, 'Nenhum pedido com os filtros atuais.');
  const r = resumoSpend(ctx.registros);
  const porMes = savingPorMes(ctx.registros);

  const cartoes = linhaDeCartoes(
    cartao({ rotulo: 'Spend', valor: fmt.moedaCompacta(r.total), detalhe: `${fmt.moedaCentavos(r.total)} em OFs c/ impostos` }),
    cartao({ rotulo: 'OFs', valor: fmt.inteiro(r.ofs), detalhe: `Pedidos distintos em ${fmt.inteiro(r.filiais)} filiais` }),
    cartao({ rotulo: 'Média por OF', valor: fmt.moedaCompacta(r.ofs ? r.total / r.ofs : null), detalhe: 'Spend ÷ OFs' }),
    cartao({ rotulo: 'Maior filial', valor: fmt.pct(r.maior?.pct), detalhe: r.maior ? `${r.maior.chave}: ${fmt.moeda(r.maior.valor)}` : '-' }),
  );

  const filiais = bloco(
    { titulo: 'Spend por filial', subtitulo: 'Valor das OFs c/ impostos e % do total. Clique numa filial para filtrar o painel.' },
    barras({
      itens: porFilial.map((g) => ({
        id: g.chave, rotulo: g.chave, valor: g.valor,
        detalhe: [{ valor: fmt.pct(g.pct), rotulo: 'do total' }, { valor: fmt.inteiro(g.ofs), rotulo: 'OFs' }],
      })),
      formato: fmt.moedaCompacta,
      rotuloSerie: 'em OFs',
      aoClicar: (filial) => ctx.filtrar('filial', filial),
    }),
    criarTabela({
      titulo: 'Spend por filial', linhas: porFilial, pesquisa: false, ordem: { coluna: 'valor', desc: true },
      nomeArquivo: 'spend-por-filial.csv',
      colunas: [
        { id: 'chave', rotulo: 'Filial', valor: (g) => g.chave },
        { id: 'valor', rotulo: 'Spend', num: true, valor: (g) => g.valor, formato: fmt.moedaCentavos },
        { id: 'pct', rotulo: '% do total', num: true, valor: (g) => g.pct, formato: fmt.pct },
        { id: 'ofs', rotulo: 'OFs', num: true, valor: (g) => g.ofs, formato: fmt.inteiro },
      ],
      rodape: () => ['Total geral', fmt.moedaCentavos(r.total), fmt.pct(1), fmt.inteiro(r.ofs)],
      aoClicarLinha: (g) => ctx.filtrar('filial', g.chave),
    }).elemento,
  );

  const meses = bloco(
    { titulo: 'Spend por mês do pedido' },
    colunas({
      itens: porMes.map((g) => ({ rotulo: rotuloMes(g.chave), valor: g.total })),
      formato: fmt.moedaCompacta,
      rotuloSerie: 'em OFs',
    }),
    criarTabela({
      titulo: 'Spend por mês do pedido',
      linhas: porMes.map((g) => ({ mes: rotuloMes(g.chave), total: g.total })),
      pesquisa: false, nomeArquivo: 'spend-por-mes.csv',
      colunas: [
        { id: 'mes', rotulo: 'Mês', valor: (g) => g.mes },
        { id: 'total', rotulo: 'Spend', num: true, valor: (g) => g.total, formato: fmt.moedaCentavos },
      ],
    }).elemento,
  );

  return el('div', { class: 'tela' }, cartoes, el('div', { class: 'grade-2' }, filiais, meses));
}
