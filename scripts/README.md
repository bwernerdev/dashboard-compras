# scripts — ferramentas de linha de comando (Node 24)

| Script | Comando | O que faz |
|---|---|---|
| `medir.mjs` | `npm run medir -- base.xlsx Follow-Up.xlsx` | Importa as bases reais e mostra linhas lidas/mantidas, período, tempo (meta: 20 s) e memória |
| `conferir-xlsm.mjs` | `npm run conferir -- "DASHBOARD COMPRAS 2026.xlsm"` | Recalcula as abas `Base` e `Follow-UP` da planilha antiga com `src/regras.js` e compara coluna a coluna; compara também as tabelas dinâmicas Spend, Saving e sc p Compr. Sai com código 1 se algo diferir |

Sem argumentos, procuram os arquivos com o nome padrão na raiz do projeto. As planilhas não vão para o git.

`conferir-xlsm.mjs`: a tabela Saving da planilha estava filtrada por segmentação (Comprador = Thayane, Contrato? = não) em 11/11/2026; se o filtro mudar, ajuste `FILTRO_SAVING` no script.
