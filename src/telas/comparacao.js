// Bloco "Comparação de períodos" das telas Spend e Saving (pedido da equipe, 12/11/2026): o trecho do
// mês (ou trimestre) do último pedido contra o mesmo trecho do anterior. Ignora o filtro "Mês do
// pedido" (senão não haveria o que comparar); os outros filtros valem. Público (vai no painel).
import { el } from '../ui/dom.js';
import { linhaDeCartoes, bloco } from '../ui/cartoes.js';
import { formatarSerie } from '../datas.js';
import { lerPreferencia, salvarPreferencia } from '../preferencias.js';
import { periodosDePedido } from '../analise.js';

const local = { tipo: lerPreferencia('comparacao-periodo') === 'tri' ? 'tri' : 'mes' };
const OPCOES = [['mes', 'Mês x anterior'], ['tri', 'Trimestre x anterior']];
const diaMes = (s) => formatarSerie(s).slice(0, 5);
const trecho = (p) => `${diaMes(p.inicio)} a ${diaMes(p.fim)}`;

/**
 * cartoesDe(atuais, anteriores, rotuloAnterior): cartões da tela com a variação (variacao/variacaoRelativa
 * de ui/cartoes.js, ligação "x"). Sem pedido com data: null (o bloco não aparece).
 */
export function blocoComparacao(ctx, cartoesDe) {
  const p = periodosDePedido(ctx.registrosSem ? ctx.registrosSem('mes') : ctx.registros, local.tipo);
  if (!p) return null;
  const alternar = el('div', { class: 'alternador', role: 'group', 'aria-label': 'Período da comparação' },
    OPCOES.map(([id, rotulo]) => el('button', {
      type: 'button', class: 'alternador-opcao', 'aria-pressed': String(local.tipo === id),
      onclick: () => { local.tipo = id; salvarPreferencia('comparacao-periodo', id); ctx.redesenhar(); },
    }, rotulo)));
  return bloco(
    {
      titulo: 'Comparação de períodos',
      subtitulo: `${trecho(p.atual)} x ${trecho(p.anterior)}, pela data do pedido.`,
      ajuda: 'Compara o trecho do mês (ou trimestre) do último pedido com o mesmo número de dias do anterior: um mês pela metade não é comparado com um mês inteiro. Ignora o filtro "Mês do pedido"; os outros filtros valem.',
      acoes: alternar,
    },
    linhaDeCartoes(...cartoesDe(p.atual.registros, p.anterior.registros, trecho(p.anterior))));
}
