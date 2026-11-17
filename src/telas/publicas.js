// Telas públicas: as abas visíveis da planilha antiga, na mesma ordem. Entram no app da equipe e
// no painel publicado. Nada aqui pode importar config/, importar.js, memoria.js nem a tela
// Compradores (interna): tudo vai para dentro do painel.
import { telaStatus, reiniciarStatus } from './status.js';
import { telaEntrega, reiniciarEntrega } from './entrega.js';
import { telaRegional, reiniciarRegional } from './regional.js';
import { telaSpend } from './spend.js';
import { telaSaving } from './saving.js';
import { telaAtendimento, reiniciarAtendimento } from './atendimento.js';
import { telaOrganograma } from './organograma.js';

export const TELAS_PUBLICAS = [
  { id: 'status', rotulo: 'Status', desenhar: telaStatus },
  { id: 'entrega', rotulo: 'Entrega', desenhar: telaEntrega },
  { id: 'regional', rotulo: 'Regional', desenhar: telaRegional },
  { id: 'spend', rotulo: 'Spend', desenhar: telaSpend },
  { id: 'saving', rotulo: 'Saving', desenhar: telaSaving },
  { id: 'atendimento', rotulo: 'Atendimento', desenhar: telaAtendimento },
  // Sem filtros: a árvore não muda com eles (a faixa some nesta aba; pedido da equipe, 17/11/2026).
  { id: 'organograma', rotulo: 'Organograma', desenhar: telaOrganograma, semFiltros: true },
];

/** Zera os recortes locais das telas (ao trocar de bases). */
export function reiniciarTelas() {
  reiniciarStatus();
  reiniciarEntrega();
  reiniciarRegional();
  reiniciarAtendimento();
}
