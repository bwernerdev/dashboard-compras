// Tela Atendimento: itens em aberto, do mais antigo para o mais novo, com o SLA de cada um.
// Substitui a aba "Atendimento" da planilha antiga (Dias em aberto > SC > Filial > ... > Status).
import { PRAZO_SLA_DIAS } from '../regras.js';
import { el } from '../ui/dom.js';
import { cartao, linhaDeCartoes, bloco } from '../ui/cartoes.js';
import { criarTabela } from '../ui/tabela.js';
import * as fmt from '../ui/formatos.js';
import { seloDoStatus } from '../ui/cores-planilha.js';
import { itensEmAberto, resumoEmAberto, ehRegularizacao } from '../analise.js';

const local = { sla: 'todos' };

const RECORTES = [
  ['todos', 'Todos'],
  ['Fora do Prazo', 'Fora do prazo'],
  ['No Prazo', 'No prazo'],
];

/** SLA com marca de cor e texto (nunca só a cor). */
function seloSla(sla) {
  if (sla !== 'No Prazo' && sla !== 'Fora do Prazo') return sla || '-';
  return el('span', { class: 'marca-prio' },
    el('span', { class: `marca-prio-cor ${sla === 'No Prazo' ? 'sla-bom' : 'sla-fora'}`, 'aria-hidden': 'true' }), sla);
}

const COLUNAS = [
  { id: 'dias', rotulo: 'Dias em aberto', num: true, centro: true, valor: (r) => r.diasEmAberto, formato: fmt.inteiro, titulo: 'Dias úteis desde a criação (ou do pedido, se posterior)' },
  { id: 'sc', rotulo: 'SC', valor: (r) => r.sc, exibir: (r) => (ehRegularizacao(r) ? [r.sc, el('span', { class: 'so-leitor' }, ' (regularização)')] : r.sc) },
  { id: 'nomeFilial', rotulo: 'Nome da filial', valor: (r) => r.nomeFilial, classe: () => 'texto-medio' },
  { id: 'regional', rotulo: 'Regional', valor: (r) => r.regional },
  { id: 'filial', rotulo: 'Filial', valor: (r) => r.filial },
  { id: 'solicitante', rotulo: 'Solicitante', valor: (r) => r.solicitante, classe: () => 'texto-medio' },
  { id: 'sla', rotulo: 'SLA', valor: (r) => r.sla, exibir: (r) => seloSla(r.sla), titulo: `Fora do prazo: mais de ${PRAZO_SLA_DIAS} dias úteis em aberto` },
  { id: 'descricao', rotulo: 'Produto', valor: (r) => r.descricao, classe: () => 'texto-longo' },
  { id: 'status', rotulo: 'Status', valor: (r) => r.status, exibir: (r) => seloDoStatus(r.status) },
  { id: 'comprador', rotulo: 'Comprador', valor: (r) => r.comprador ?? '-' },
];

export function telaAtendimento(ctx) {
  const abertos = itensEmAberto(ctx.registros);
  if (!abertos.length) return el('div', { class: 'estado-vazio' }, 'Nenhum item em aberto com os filtros atuais.');
  const resumo = resumoEmAberto(abertos);

  const cartoes = linhaDeCartoes(
    cartao({ rotulo: 'Itens em aberto', valor: fmt.inteiro(resumo.itens), detalhe: `${fmt.inteiro(resumo.scs)} SCs` }),
    cartao({ rotulo: 'No prazo', valor: fmt.inteiro(resumo.noPrazo), detalhe: `${fmt.pct(resumo.pctNoPrazo)} dos itens com prazo` }),
    cartao({
      rotulo: 'Fora do prazo', valor: fmt.inteiro(resumo.fora), tom: resumo.fora ? 'critico' : null,
      detalhe: resumo.semPrazo ? `${fmt.inteiro(resumo.semPrazo)} sem prazo definido` : `Mais de ${PRAZO_SLA_DIAS} dias úteis em aberto`,
    }),
    cartao({ rotulo: 'Mais antigo', valor: `${fmt.inteiro(resumo.maxDias)} dias`, detalhe: `Média: ${fmt.decimal(resumo.mediaDias)} dias úteis` }),
  );

  const recortar = () => (local.sla === 'todos' ? abertos : abertos.filter((r) => r.sla === local.sla));
  const alternar = el('div', { class: 'alternador', role: 'group', 'aria-label': 'SLA' },
    RECORTES.map(([id, rotulo]) => el('button', {
      type: 'button', class: 'alternador-opcao', 'aria-pressed': String(local.sla === id),
      onclick: () => { local.sla = id; ctx.redesenhar(); },
    }, rotulo)));

  const tabela = criarTabela({
    titulo: 'Itens em aberto',
    linhas: recortar(),
    colunas: COLUNAS,
    ordem: { coluna: 'dias', desc: true },
    // Itens da mesma SC juntos, dados da SC só na 1ª linha (como a Regional; pedido da equipe, 12/11/2026).
    grupo: { chave: (r) => r.solicitacao, colunas: ['dias', 'sc', 'nomeFilial', 'regional', 'filial', 'solicitante'], nome: ['SC', 'SCs'] },
    classeLinha: (r) => (ehRegularizacao(r) ? 'linha-regularizacao' : ''),
    nomeArquivo: 'atendimento.csv',
    vazio: 'Nenhum item com esse recorte.',
  });

  return el('div', { class: 'tela' }, cartoes, bloco(
    { titulo: 'Itens em aberto', subtitulo: 'Itens agrupados por SC, da mais antiga para a mais nova. Pesquise por SC, produto, solicitante ou filial. CSV e "Copiar tabela" trazem um item por linha.' },
    alternar,
    tabela.elemento,
  ));
}

/** Zera o recorte local (ao trocar de bases). */
export function reiniciarAtendimento() { local.sla = 'todos'; }
