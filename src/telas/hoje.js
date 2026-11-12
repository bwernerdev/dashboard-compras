// Tela Hoje (só no app da equipe; pedido da equipe, 12/11/2026): o que pede ação no dia, em listas
// curtas de SCs. Compara com a base anterior quando houver (ctx.anteriores). Clique numa SC abre o
// detalhe ao lado. As contas ficam em analise.js (resumoDoDia).
import { PRAZO_SLA_DIAS } from '../regras.js';
import { el } from '../ui/dom.js';
import { cartao, linhaDeCartoes, bloco, estadoVazio } from '../ui/cartoes.js';
import { criarTabela } from '../ui/tabela.js';
import { cliqueDeDetalhe } from '../ui/detalhe.js';
import * as fmt from '../ui/formatos.js';
import { marcaDaPrioridade } from '../ui/cores-planilha.js';
import { itensEmAberto, resumoDoDia } from '../analise.js';

const COLUNAS = [
  { id: 'sc', rotulo: 'SC', semDuploClique: true, valor: (s) => s.sc },
  { id: 'dias', rotulo: 'Dias úteis', num: true, valor: (s) => s.dias, formato: fmt.inteiro },
  { id: 'nomeFilial', rotulo: 'Filial', valor: (s) => s.nomeFilial, classe: () => 'texto-medio' },
  { id: 'prioridade', rotulo: 'Prioridade', valor: (s) => s.prioridade, exibir: (s) => marcaDaPrioridade(s.prioridade) },
  { id: 'comprador', rotulo: 'Comprador', valor: (s) => s.comprador ?? '-' },
  { id: 'itens', rotulo: 'Itens', num: true, valor: (s) => s.itens, formato: fmt.inteiro },
];

export function telaHoje(ctx) {
  const abertos = itensEmAberto(ctx.registros);
  if (!abertos.length) return estadoVazio('Nenhuma SC em aberto com os filtros atuais.', ctx);
  const anterior = ctx.anteriores;
  const dia = resumoDoDia(abertos, anterior ? itensEmAberto(anterior.registros) : null, PRAZO_SLA_DIAS);
  const desde = anterior ? `desde a base de ${anterior.rotulo}` : '';
  const detalhe = cliqueDeDetalhe((s) => ctx.registros.filter((r) => r.solicitacao === s.solicitacao));

  const lista = (id, titulo, subtitulo, scs, vazio) => bloco({ titulo: `${titulo} (${fmt.inteiro(scs.length)})`, subtitulo },
    criarTabela({
      titulo, linhas: scs, colunas: COLUNAS, pesquisa: false, porPagina: 10, ordem: { coluna: 'dias', desc: true },
      nomeArquivo: `hoje-${id}.csv`, vazio, aoClicarLinha: detalhe.aoClicarLinha,
    }).elemento);

  return el('div', { class: 'tela' },
    linhaDeCartoes(
      cartao({ icone: 'alerta', rotulo: 'Viraram fora do prazo', valor: fmt.inteiro(dia.viraramFora.length), tom: dia.viraramFora.length ? 'critico' : null, detalhe: anterior ? `SCs ${desde}` : `No 1º dia fora (${PRAZO_SLA_DIAS + 1} dias úteis)` }),
      cartao({ icone: 'relogio', rotulo: 'Vencem em até 2 dias úteis', valor: fmt.inteiro(dia.vencendo.length), tom: dia.vencendo.length ? 'alerta' : null, detalhe: `Com ${PRAZO_SLA_DIAS - 1} ou ${PRAZO_SLA_DIAS} dias úteis` }),
      cartao({ icone: 'usuario', rotulo: 'Sem comprador', valor: fmt.inteiro(dia.semComprador.length), detalhe: 'SCs em "Pendente" ou sem comprador' }),
      cartao({ icone: 'documento', rotulo: 'SCs novas', valor: fmt.inteiro(dia.novas.length), detalhe: anterior ? `Em aberto que não estavam em ${anterior.rotulo}` : 'Com até 1 dia útil' }),
    ),
    el('div', { class: 'grade-2' },
      lista('fora', 'Viraram fora do prazo', anterior ? `Passaram de ${PRAZO_SLA_DIAS} dias úteis ${desde}. Clique numa SC para ver os itens.` : `No 1º dia fora (${PRAZO_SLA_DIAS + 1} dias úteis). Clique numa SC para ver os itens.`, dia.viraramFora, 'Nenhuma SC virou fora do prazo.'),
      lista('vencendo', 'Vencem em até 2 dias úteis', 'Ainda no prazo: dá para agir antes de estourar.', dia.vencendo, 'Nenhuma SC perto do limite.'),
      lista('sem-comprador', 'Sem comprador', 'Pendências de compra e contrato ficam em "Pendente" no ME.', dia.semComprador, 'Todas as SCs têm comprador.'),
      lista('novas', 'SCs novas', anterior ? `Em aberto agora e não em ${anterior.rotulo}.` : 'Criadas há até 1 dia útil.', dia.novas, 'Nenhuma SC nova.')));
}
