# Dashboard de Compras

Painel da equipe de Suprimentos que vai substituir o `DASHBOARD COMPRAS 2026.xlsm`.

**Status:** fase 1 concluída: o app já lê as duas bases do ME e calcula tudo igual à planilha (com o erro de dias em aberto corrigido). As telas finais entram na fase 2. Ver `PROJETO.md`.

## Como vai funcionar
1. O favorito do ME baixa a `base.xlsx` e o `Follow-Up.xlsx` (todas as filiais).
2. Quem atualiza abre o app e arrasta as duas bases. O app separa as 26 filiais do painel e calcula tudo em poucos segundos, sem enviar nada para fora do computador.
3. O app gera um único arquivo `.html` com os dados já processados, que é anexado na Intranet. Se a Intranet não aceitar `.html`, gera um `.xlsx` enxuto no lugar.
4. A equipe abre esse arquivo: telas Regional, Compradores e Saving, com filtros e exportação para Excel/PDF.

## Hoje (fase 1)
`npm run dev` abre a tela de importação: escolha ou arraste as duas bases e confira o resumo (linhas, período, SCs em aberto, SLA, Spend, Economia) e a lista das SCs em aberto.

## Pastas
| Pasta | Conteúdo |
|---|---|
| (raiz) | Documentação (`PROJETO.md`, `CLAUDE.md`), entrada do app (`index.html`), `teste-intranet.html` e as planilhas locais (não versionadas) |
| `src/` | Código do app (leitor, regras, configuração, tela) |
| `tests/` | Testes automáticos com dados fictícios |
| `scripts/` | Medição de tempo e conferência com a planilha antiga |

Cada pasta tem o seu `README.md` com o mapa dos arquivos.
