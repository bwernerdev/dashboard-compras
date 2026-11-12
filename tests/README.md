# tests — testes unitários

`npm test` (`node --test tests/*.test.js`). Só dados fictícios: nada da empresa nos testes.

| Arquivo | Cobre |
|---|---|
| `datas.test.js` | Série do Excel, dia da semana, DIAS, DIATRABALHOTOTAL (inclusive o 33098 da planilha antiga) |
| `regras.test.js` | Cada regra de `src/regras.js`: filial, comprador, dias em aberto, SLA (fora só com mais de 30 dias úteis, qualquer prioridade), Saving Real em texto pt-BR, tempos por etapa, Follow-Up |
| `leitor.test.js` | Leitor de xlsx: tipos de célula, XML picado em pedaços, filtro de colunas, xlsx completo, mensagens de erro |
| `importar.test.js` | Importação ponta a ponta com xlsx fictício: filtro de filial, conversão de tipos, Dados Gerais, coluna faltando, cancelamento |
| `analise.test.js` | Agregações e filtros das telas (`src/analise.js`, inclusive `ehPendencia`, `ehRegularizacao`, spend, status e entregas), memória (`brutosDe`, `recalcular`), `validarConfig` e CSV |
| `painel.test.js` | Dados do painel publicado (`src/painel/dados.js`): só campos públicos, detalhe só de SC em aberto, versão, compactar/descompactar; texto do "Copiar tabela" (`gerarTsv`) |
| `atendidas.test.js` | SCs atendidas (`src/atendidas.js`): marcar, desmarcar, guardar, vencer em 120 dias, armazenamento estragado (localStorage de mentira) |
| `cores-planilha.test.js` | Cores da planilha antiga por status, prioridade e % saving; status separados no gráfico |
| `ajuda/` | Gerador de `.xlsx` em memória para os testes (também usado pelo `e2e/`) |

Testes no navegador: `npm run test:e2e` (ver `e2e/`).

A conferência com a planilha real não é teste automático (usa dados internos): `npm run conferir` (ver `scripts/`).
