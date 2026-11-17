// Colunas ocultas de uma tabela (ui/tabela.js): botão "Colunas" (lista de marcar), lembrado por `nomeArquivo`.
// Colunas ocultas só saem da tela: CSV e "Copiar tabela" continuam com todas.
import { el } from './dom.js';
import { lerConjunto, salvarConjunto } from '../preferencias.js';
import { listaDeMarcar } from './filtros.js';

/**
 * `escolher`: mostra o botão "Colunas" (sem ele, nenhuma coluna fica oculta).
 * `aoMudar`: chamado depois de aplicar (a tabela refaz o encaixe na largura).
 * Devolve { estilo (<style>), botao (ou null), oculta(id), aplicar() }.
 */
export function criarColunasOcultas({ colunas, idTabela, indice, nomeArquivo, escolher, aoMudar }) {
  const chave = `colunas-ocultas:${nomeArquivo}`;
  const escolhiveis = colunas.filter((c) => !c.controle);
  const estilo = el('style');
  let ocultas = new Set(escolher ? [...lerConjunto(chave)].filter((id) => escolhiveis.some((c) => c.id === id)) : []);

  function aplicar() {
    estilo.textContent = colunas.filter((c) => ocultas.has(c.id))
      .map((c) => `[data-tabela="${idTabela}"] .c-${indice.get(c)} { display: none; }`).join(' ');
    aoMudar();
  }

  // Lista de marcar: marcado = visível; nada marcado na lista = todas (como os filtros).
  const visiveis = new Set(ocultas.size ? escolhiveis.map((c) => c.id).filter((id) => !ocultas.has(id)) : []);
  const botao = escolher ? listaDeMarcar({
    id: 'colunas', rotulo: 'Colunas', valores: escolhiveis.map((c) => c.id),
    rotuloValor: (id) => escolhiveis.find((c) => c.id === id).rotulo,
    resumoVarios: (n) => { const k = escolhiveis.length - n; return k === 1 ? '1 oculta' : `${k} ocultas`; },
    selecionados: visiveis,
    aoMudar: (novo) => {
      ocultas = new Set(novo.size ? escolhiveis.map((c) => c.id).filter((id) => !novo.has(id)) : []);
      salvarConjunto(chave, ocultas);
      aplicar();
    },
  }) : null;

  return { estilo, botao, oculta: (id) => ocultas.has(id), aplicar };
}
