// Tela Compradores: substitui a aba "sc p Compr".
// SCs distintas por comprador x status, pré-pedidos por comprador x regional e participação/SLA.
import { el } from '../ui/dom.js';
import { cartao, linhaDeCartoes, bloco } from '../ui/cartoes.js';
import { barrasEmpilhadas } from '../ui/graficos.js';
import { criarTabela } from '../ui/tabela.js';
import * as fmt from '../ui/formatos.js';
import {
  scsPorCompradorStatus, prePedidosPorCompradorRegional, participacaoCompradores, OUTROS,
  itensEmAberto, resumoEmAberto,
} from '../analise.js';
import { PENDENTE } from '../regras.js';
import { corDoStatusNoGrafico } from '../ui/cores-planilha.js';

/** Cor fixa por status: a mesma da planilha antiga (ui/cores-planilha.js). */
export const corDoStatus = (s) => (s === OUTROS ? 'var(--serie-outros)' : corDoStatusNoGrafico(s));

const destacarPendente = (linha) => (linha.comprador === PENDENTE ? 'linha-destaque' : '');

export function telaCompradores(ctx) {
  const regs = ctx.registros;
  if (!regs.length) return el('div', { class: 'estado-vazio' }, 'Nenhuma linha com os filtros atuais.');

  const porStatus = scsPorCompradorStatus(regs);
  const pre = prePedidosPorCompradorRegional(regs);
  const part = participacaoCompradores(regs);
  const pendente = porStatus.linhas.find((l) => l.comprador === PENDENTE);
  const aberto = resumoEmAberto(itensEmAberto(regs));

  const cartoes = linhaDeCartoes(
    cartao({ rotulo: 'SCs no período', valor: fmt.inteiro(porStatus.totalGeral), detalhe: `${fmt.inteiro(porStatus.linhas.length)} compradores (inclui "-" e Pendente)` }),
    cartao({
      rotulo: 'SCs sem comprador (Pendente)', valor: fmt.inteiro(pendente?.total ?? 0), tom: pendente?.total ? 'alerta' : null,
      detalhe: 'Itens sem "Selecionado por" no ME',
    }),
    cartao({ rotulo: 'Pré-pedidos', valor: fmt.inteiro(pre.totalGeral), detalhe: 'Distintos, como na planilha (SC sem pré-pedido conta 1)' }),
    cartao({
      rotulo: 'Itens em aberto fora do prazo', valor: fmt.inteiro(aberto.fora), tom: aberto.fora ? 'critico' : null,
      detalhe: `${fmt.pct(aberto.pctNoPrazo)} dos itens em aberto no prazo`,
    }),
  );

  const series = porStatus.status.map((s) => ({ id: s, rotulo: s, cor: corDoStatus(s) }));
  const grafico = bloco(
    { titulo: 'SCs por comprador e status', subtitulo: 'SCs distintas. Uma SC com itens em status diferentes aparece em cada status, mas conta uma vez no total.' },
    barrasEmpilhadas({
      series,
      categorias: porStatus.linhas.map((l) => ({ rotulo: l.comprador, partes: l.porStatus, total: l.total })),
      formato: fmt.inteiro,
    }),
    criarTabela({
      titulo: 'SCs por comprador e status',
      linhas: porStatus.linhas,
      pesquisa: false,
      ordem: { coluna: 'total', desc: true },
      nomeArquivo: 'scs-por-comprador-e-status.csv',
      colunas: [
        { id: 'comprador', rotulo: 'Comprador', valor: (l) => l.comprador, classe: destacarPendente },
        ...porStatus.status.map((s) => ({
          id: `s-${s}`, rotulo: s, num: true, valor: (l) => l.porStatus[s] || null, formato: fmt.inteiro, classe: destacarPendente,
        })),
        { id: 'total', rotulo: 'Total', num: true, valor: (l) => l.total, formato: fmt.inteiro, classe: destacarPendente },
      ],
      rodape: () => ['Total geral', ...porStatus.status.map((s) => fmt.inteiro(porStatus.totaisStatus[s])), fmt.inteiro(porStatus.totalGeral)],
    }).elemento,
  );

  const prePedidos = bloco(
    { titulo: 'Pré-pedidos por comprador e regional', subtitulo: 'Números de pré-pedido distintos. Como na planilha, as SCs sem pré-pedido contam como 1 em cada grupo.' },
    criarTabela({
      titulo: 'Pré-pedidos por comprador e regional',
      linhas: pre.linhas,
      pesquisa: false,
      ordem: { coluna: 'total', desc: true },
      nomeArquivo: 'pre-pedidos-por-comprador-e-regional.csv',
      colunas: [
        { id: 'comprador', rotulo: 'Comprador', valor: (l) => l.comprador },
        ...pre.regionais.map((r) => ({ id: `r-${r}`, rotulo: r, num: true, valor: (l) => l.porRegional[r] || null, formato: fmt.inteiro })),
        { id: 'total', rotulo: 'Total', num: true, valor: (l) => l.total, formato: fmt.inteiro },
      ],
      rodape: () => ['Total geral', ...pre.regionais.map((r) => fmt.inteiro(pre.totaisRegional[r])), fmt.inteiro(pre.totalGeral)],
    }).elemento,
  );

  const participacao = bloco(
    { titulo: 'Participação e SLA por comprador', subtitulo: 'Participação = itens de SC do comprador ÷ itens de SC do período (como "% sc\'s atendidas" da planilha).' },
    criarTabela({
      titulo: 'Participação e SLA por comprador',
      linhas: part,
      pesquisa: false,
      ordem: { coluna: 'itens', desc: true },
      nomeArquivo: 'participacao-por-comprador.csv',
      colunas: [
        { id: 'comprador', rotulo: 'Comprador', valor: (l) => l.comprador, classe: destacarPendente },
        { id: 'itens', rotulo: 'Itens', num: true, valor: (l) => l.itens, formato: fmt.inteiro },
        { id: 'part', rotulo: '% do total', num: true, valor: (l) => l.participacao, formato: fmt.pct },
        { id: 'abertas', rotulo: 'Em aberto', num: true, valor: (l) => l.abertas, formato: fmt.inteiro },
        { id: 'noPrazo', rotulo: 'No prazo', num: true, valor: (l) => l.noPrazo, formato: fmt.inteiro },
        { id: 'fora', rotulo: 'Fora do prazo', num: true, valor: (l) => l.fora, formato: fmt.inteiro },
        { id: 'pct', rotulo: '% no prazo', num: true, valor: (l) => l.pctNoPrazo, formato: fmt.pct },
      ],
    }).elemento,
  );

  return el('div', { class: 'tela' }, cartoes, grafico, el('div', { class: 'grade-2' }, prePedidos, participacao));
}
