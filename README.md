# Dashboard de Compras

Painel da equipe de Suprimentos que vai substituir o `DASHBOARD COMPRAS 2026.xlsm`.

**Status:** fase 4 concluída. O app lê as duas bases do ME e mostra as telas Status, Entrega, Regional, SCs por Comprador, Spend, Saving, Atendimento e Organograma, com filtros, "Exportar Excel" em toda tabela e impressão. O botão "Gerar painel" cria o arquivo para a Intranet. Ver `PROJETO.md`.

## Como funciona
1. O favorito do ME baixa a `base.xlsx` e o `Follow-Up.xlsx` (todas as filiais).
2. Quem atualiza abre o app e arrasta as duas bases. O app separa as 26 filiais do painel e calcula tudo em poucos segundos, sem enviar nada para fora do computador.
3. "Gerar painel" baixa um único `painel-compras.html` só com as telas públicas (as abas visíveis da planilha, sem Compradores) e os dados que elas usam.
4. Esse arquivo vai para a pasta do OneDrive/SharePoint com o mesmo nome ("Substituir"). O link "Pessoas da empresa" fica cadastrado na Intranet e não muda.
5. Quem abre pela Intranet vê o painel dentro do SharePoint, com filtros e "Copiar tabela". Para imprimir ou exportar para o Excel: baixar o arquivo e abrir no computador.

## Uso
A equipe abre o app em https://bwernerdev.github.io/dashboard-compras/ (ou `npm run dev` neste computador). Na primeira vez, escolha ou arraste a `base.xlsx` e o `Follow-Up.xlsx` (sem ele, a aba Entrega fica vazia). Cada caixa (Base, Follow-Up, Contratos) abre na pasta de onde aquele arquivo foi importado da última vez (Chrome e Edge). As bases ficam salvas só neste navegador: ao abrir de novo, o app já aparece, com os dias recalculados para hoje. "Atualizar bases" troca os arquivos; "Configuração" edita filiais (com o aprovador GA do pré-pedido) e compradores, e exporta/importa o arquivo para passar à equipe (o SLA é fixo: 30 dias úteis); "Gerar painel" baixa o arquivo para publicar. Opcional: a planilha `CONTROLE DE CONTRATOS.xlsx` (caixa "Contratos (anexo)") abre no botão **Contratos**, numa janela separada do dashboard, e vai também para o painel.

## Pastas
| Pasta | Conteúdo |
|---|---|
| (raiz) | Documentação (`PROJETO.md`, `CLAUDE.md`), entrada do app (`index.html`), build do painel (`vite.painel.config.js`), lint e tipos (`eslint.config.js`, `tsconfig.json`), `teste-intranet.html` e as planilhas locais (não versionadas) |
| `src/` | Código do app (leitor, regras, configuração, telas, componentes, CSS) e do painel publicado (`src/painel/`) |
| `tests/` | Testes unitários com dados fictícios |
| `e2e/` | Testes no navegador (Playwright) com dados fictícios |
| `scripts/` | Medição de tempo e conferência com a planilha antiga |

Cada pasta tem o seu `README.md` com o mapa dos arquivos.
