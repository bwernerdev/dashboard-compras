# Dashboard de Compras

Painel da equipe de Suprimentos que vai substituir o `DASHBOARD COMPRAS 2026.xlsm`.

**Status:** fase 3 concluída. O app lê as duas bases do ME e mostra as telas Regional, Compradores e Saving, com filtros, exportação CSV e impressão. O botão "Gerar painel" cria o arquivo para a Intranet. Ver `PROJETO.md`.

## Como funciona
1. O favorito do ME baixa a `base.xlsx` e o `Follow-Up.xlsx` (todas as filiais).
2. Quem atualiza abre o app e arrasta as duas bases. O app separa as 26 filiais do painel e calcula tudo em poucos segundos, sem enviar nada para fora do computador.
3. "Gerar painel" baixa um único `painel-compras.html` só com as telas públicas (Regional e Saving) e os dados que elas usam.
4. Esse arquivo vai para a pasta do OneDrive/SharePoint com o mesmo nome ("Substituir"). O link "Pessoas da empresa" fica cadastrado na Intranet e não muda.
5. Quem abre pela Intranet vê o painel dentro do SharePoint, com filtros e "Copiar tabela". Para imprimir ou exportar CSV: baixar o arquivo e abrir no computador.

## Uso
`npm run dev` abre o app da equipe. Na primeira vez, escolha ou arraste a `base.xlsx` (o Follow-Up é opcional por enquanto). A base fica salva neste navegador: ao abrir de novo, o painel já aparece, com os dias recalculados para hoje. "Atualizar bases" troca os arquivos; "Configuração" edita filiais, compradores e SLA; "Gerar painel" baixa o arquivo para publicar.

## Pastas
| Pasta | Conteúdo |
|---|---|
| (raiz) | Documentação (`PROJETO.md`, `CLAUDE.md`), entrada do app (`index.html`), build do painel (`vite.painel.config.js`), `teste-intranet.html` e as planilhas locais (não versionadas) |
| `src/` | Código do app (leitor, regras, configuração, telas, componentes, CSS) e do painel publicado (`src/painel/`) |
| `tests/` | Testes unitários com dados fictícios |
| `e2e/` | Testes no navegador (Playwright) com dados fictícios |
| `scripts/` | Medição de tempo e conferência com a planilha antiga |

Cada pasta tem o seu `README.md` com o mapa dos arquivos.
