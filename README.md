# Dashboard de Compras

Painel da equipe de Suprimentos que vai substituir o `DASHBOARD COMPRAS 2026.xlsm`.

**Status:** em desenho. Ainda não há app para usar. Ver `PROJETO.md`.

## Como vai funcionar
1. Quem atualiza exporta do ME a `base.xlsx` e o `Follow-Up.xlsx`.
2. Abre o app, importa as duas bases e clica em **Gerar painel**.
3. O app gera um único arquivo `.html` com os dados já processados, que é anexado na Intranet. Se a Intranet não aceitar `.html`, gera um `.xlsx` enxuto no lugar.
4. A equipe abre esse arquivo: telas Regional, Compradores e Saving, com filtros e exportação para Excel/PDF.

## Pastas
| Pasta | Conteúdo |
|---|---|
| (raiz) | Documentação do projeto (`PROJETO.md`, `CLAUDE.md`), `teste-intranet.html` (teste de anexo na Intranet) e as planilhas locais (não versionadas) |

As próximas pastas (`src/`, `tests/`, `e2e/`, `scripts/`) entram na fase 1, cada uma com o seu `README.md`.
