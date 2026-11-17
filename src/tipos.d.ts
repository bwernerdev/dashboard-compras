// Tipos só para a checagem (`npm run tipos`, TypeScript em JSDoc): não entram no build.
// Os campos saem do próprio código, sem lista repetida: colunas lidas = `esquema.js`;
// registro calculado = retorno de `calcularLinhaBase`/`calcularLinhaFollowUp` (`regras.js`).
// Assim um nome de campo errado (r.statusPrepedido) vira erro em `regras.js`, `analise.js` e `painel/dados.js`.
import type { BASE, FOLLOW_UP } from './esquema.js';
import type { calcularLinhaBase, calcularLinhaFollowUp } from './regras.js';
import type { criarConfig } from './config/index.js';

/** Tipo da coluna no esquema -> valor lido: data é série do Excel (número); vazio = null. */
type ValorDe<T> = T extends readonly [string, 'numero' | 'data'] ? number | null
  : T extends readonly [string, 'texto'] ? string | null
  : unknown;
type LinhaDe<C> = { [K in keyof C]: ValorDe<C[K]> };

/** Linha da base como sai do leitor (antes das regras). */
export type LinhaBase = LinhaDe<typeof BASE.colunas>;
/** Linha do Follow-Up como sai do leitor. */
export type LinhaFollowUp = LinhaDe<typeof FOLLOW_UP.colunas>;
/** Registro da base com as colunas calculadas (o que as telas recebem). */
export type Registro = ReturnType<typeof calcularLinhaBase>;
/** Registro do Follow-Up com as colunas calculadas. */
export type RegistroFollowUp = ReturnType<typeof calcularLinhaFollowUp>;
/** Configuração (de-para) que as regras consultam. */
export type Config = ReturnType<typeof criarConfig>;
/** Linha de qualquer das duas bases (filtros globais e recortes que servem às duas). */
export type Linha = Partial<Registro & RegistroFollowUp>;
