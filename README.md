# Dashboard de Compras

Painel da equipe de Suprimentos que vai substituir o `DASHBOARD COMPRAS 2026.xlsm`.

**Status:** fase 2 concluída: o app lê as duas bases do ME e mostra as telas Regional, Compradores e Saving, com filtros, exportação CSV e impressão. Falta a fase 3 (arquivo para a Intranet). Ver `PROJETO.md`.

## Como vai funcionar
1. O favorito do ME baixa a `base.xlsx` e o `Follow-Up.xlsx` (todas as filiais).
2. Quem atualiza abre o app e arrasta as duas bases. O app separa as 26 filiais do painel e calcula tudo em poucos segundos, sem enviar nada para fora do computador.
3. O app gera um único arquivo `.html` com os dados já processados, que é anexado na Intranet. Se a Intranet não aceitar `.html`, gera um `.xlsx` enxuto no lugar.
4. A equipe abre esse arquivo: telas Regional, Compradores e Saving, com filtros e exportação para Excel/PDF.

## Hoje (fase 2)
`npm run dev` abre o painel. Na primeira vez, escolha ou arraste a `base.xlsx` (o Follow-Up é opcional por enquanto). A base fica salva neste navegador: ao abrir de novo, o painel já aparece, com os dias recalculados para hoje. "Atualizar bases" troca os arquivos; "Configuração" edita filiais, compradores e SLA.

## Pastas
| Pasta | Conteúdo |
|---|---|
| (raiz) | Documentação (`PROJETO.md`, `CLAUDE.md`), entrada do app (`index.html`), `teste-intranet.html` e as planilhas locais (não versionadas) |
| `src/` | Código do app (leitor, regras, configuração, telas, componentes, CSS) |
| `tests/` | Testes unitários com dados fictícios |
| `e2e/` | Testes no navegador (Playwright) com dados fictícios |
| `scripts/` | Medição de tempo e conferência com a planilha antiga |

Cada pasta tem o seu `README.md` com o mapa dos arquivos.
