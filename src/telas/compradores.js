// Tela "SCs por Comprador" (id compradores): substitui a aba "sc p Compr".
// SCs distintas por comprador x status, pré-pedidos por comprador x regional e participação/SLA.
// Período De/Até (pedido da equipe, 12/11/2026): recorta pela "Data Criação solicitação"; fica
// salvo neste navegador.
import { el } from '../ui/dom.js';
import { cartao, linhaDeCartoes, bloco, estadoVazio } from '../ui/cartoes.js';
import { barrasEmpilhadas } from '../ui/graficos.js';
import { criarTabela } from '../ui/tabela.js';
import * as fmt from '../ui/formatos.js';
import {
  scsPorCompradorStatus, prePedidosPorCompradorRegional, participacaoCompradores, OUTROS,
  itensEmAberto, resumoEmAberto,
} from '../analise.js';
import { PENDENTE } from '../regras.js';
import { corDoStatusNoGrafico } from '../ui/cores-planilha.js';
import { serie, partesDaSerie, formatarSerie } from '../datas.js';
import { lerPreferencia, salvarPreferencia } from '../preferencias.js';

// Período em série do Excel (dias inteiros); null = sem limite.
const CHAVE_PERIODO = 'periodo-compradores';
const periodo = lerPeriodo();
function lerPeriodo() {
  try {
    const p = JSON.parse(lerPreferencia(CHAVE_PERIODO, '{}')) ?? {};
    return { de: Number.isFinite(p.de) ? p.de : null, ate: Number.isFinite(p.ate) ? p.ate : null };
  } catch { return { de: null, ate: null }; }
}
const guardarPeriodo = () => salvarPreferencia(CHAVE_PERIODO, JSON.stringify(periodo));

/** Série -> "aaaa-mm-dd" (valor do campo de data) e volta. */
const paraCampo = (s) => {
  if (s === null) return '';
  const { ano, mes, dia } = partesDaSerie(s);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};
const doCampo = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? '');
  return m ? serie(Number(m[1]), Number(m[2]), Number(m[3])) : null;
};

/** Linhas com criação dentro do período (com período, linha sem data de criação sai). */
export function recortarPeriodo(regs, { de, ate }) {
  if (de === null && ate === null) return regs;
  return regs.filter((r) => {
    if (r.criacao === null || r.criacao === undefined) return false;
    const d = Math.floor(r.criacao);
    return (de === null || d >= de) && (ate === null || d <= ate);
  });
}

/** Campos De/Até e "Limpar período". Mudou: guarda e redesenha a tela. */
function barraDePeriodo(ctx) {
  const datas = ctx.registros.map((r) => r.criacao).filter((v) => Number.isFinite(v)).map(Math.floor);
  const min = datas.length ? paraCampo(Math.min(...datas)) : null;
  const max = datas.length ? paraCampo(Math.max(...datas)) : null;
  const campo = (id, rotulo) => el('label', { class: 'recorte' }, rotulo,
    el('input', {
      type: 'date', class: 'campo', value: paraCampo(periodo[id]), min, max,
      'aria-label': `Período: ${rotulo === 'De' ? 'data inicial' : 'data final'} (Data Criação solicitação)`,
      onchange: (ev) => { periodo[id] = doCampo(ev.target.value); guardarPeriodo(); ctx.redesenhar(); },
    }));
  const ativo = periodo.de !== null || periodo.ate !== null;
  return el('div', { class: 'recortes', role: 'group', 'aria-label': 'Período' },
    el('span', { class: 'recorte' }, 'Período (criação da SC):'),
    campo('de', 'De'),
    campo('ate', 'Até'),
    ativo ? el('button', {
      type: 'button', class: 'botao botao-sec botao-pequeno',
      onclick: () => { periodo.de = null; periodo.ate = null; guardarPeriodo(); ctx.redesenhar(); },
    }, 'Limpar período') : null,
    ativo && periodo.de !== null && periodo.ate !== null && periodo.de > periodo.ate
      ? el('span', { class: 'recorte', role: 'status' }, '"De" depois de "Até": nenhuma SC no período.') : null);
}
const descreverPeriodo = () => [periodo.de !== null ? `de ${formatarSerie(periodo.de)}` : '', periodo.ate !== null ? `até ${formatarSerie(periodo.ate)}` : ''].filter(Boolean).join(' ');

/** Cor fixa por status: a mesma da planilha antiga (ui/cores-planilha.js). */
export const corDoStatus = (s) => (s === OUTROS ? 'var(--serie-outros)' : corDoStatusNoGrafico(s));

const destacarPendente = (linha) => (linha.comprador === PENDENTE ? 'linha-destaque' : '');

export function telaCompradores(ctx) {
  const barra = barraDePeriodo(ctx);
  const regs = recortarPeriodo(ctx.registros, periodo);
  if (!regs.length) {
    return el('div', { class: 'tela' }, barra, estadoVazio(
      descreverPeriodo() ? `Nenhuma SC criada no período (${descreverPeriodo()}) com os filtros atuais.` : 'Nenhuma linha com os filtros atuais.', ctx));
  }

  const porStatus = scsPorCompradorStatus(regs);
  const pre = prePedidosPorCompradorRegional(regs);
  const part = participacaoCompradores(regs);
  const pendente = porStatus.linhas.find((l) => l.comprador === PENDENTE);
  const aberto = resumoEmAberto(itensEmAberto(regs));

  const cartoes = linhaDeCartoes(
    cartao({ icone: 'documento', rotulo: 'SCs no período', valor: fmt.inteiro(porStatus.totalGeral), detalhe: `${descreverPeriodo() ? `Criadas ${descreverPeriodo()}. ` : ''}${fmt.inteiro(porStatus.linhas.length)} compradores (inclui "-" e Pendente)` }),
    cartao({
      icone: 'usuario', rotulo: 'SCs sem comprador (Pendente)', valor: fmt.inteiro(pendente?.total ?? 0), tom: pendente?.total ? 'alerta' : null,
      detalhe: 'Itens sem "Selecionado por" no ME',
    }),
    cartao({ icone: 'pacote', rotulo: 'Pré-pedidos', valor: fmt.inteiro(pre.totalGeral), detalhe: 'Distintos, como na planilha (SC sem pré-pedido conta 1)' }),
    cartao({
      icone: 'alerta', rotulo: 'Itens em aberto fora do prazo', valor: fmt.inteiro(aberto.fora), tom: aberto.fora ? 'critico' : null,
      detalhe: `${fmt.pct(aberto.pctNoPrazo)} dos itens em aberto no prazo`,
    }),
  );

  const series = porStatus.status.map((s) => ({ id: s, rotulo: s, cor: corDoStatus(s) }));
  const grafico = bloco(
    { titulo: 'SCs por comprador e status', subtitulo: 'SCs distintas.',
      ajuda: 'Uma SC com itens em status diferentes aparece em cada status, mas conta uma vez no total.' },
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
    { titulo: 'Pré-pedidos por comprador e regional', subtitulo: 'Números de pré-pedido distintos.',
      ajuda: 'Como na planilha, as SCs sem pré-pedido contam como 1 em cada grupo.' },
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
    { titulo: 'Participação e SLA por comprador', subtitulo: 'Itens de SC do comprador ÷ itens de SC do período.',
      ajuda: 'Participação calculada como "% sc’s atendidas" da planilha. O SLA conta itens em aberto.' },
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

  return el('div', { class: 'tela' }, barra, cartoes, grafico, el('div', { class: 'grade-2' }, prePedidos, participacao));
}
