# src — código do app

| Arquivo / pasta | Conteúdo |
|---|---|
| `main.js` | Tela da fase 1: escolher/arrastar as duas bases, progresso, cartões de resumo e prévia das SCs em aberto |
| `importacao.js` | Ponte tela ↔ worker (`importarNoWorker`) |
| `importacao.worker.js` | Worker: roda `importar` fora da thread da tela e manda o progresso |
| `importar.js` | Importação de um relatório: lê por fluxo, descarta filiais fora do de-para, converte tipos, aplica `regras.js`. Roda no worker e no Node (scripts e testes) |
| `esquema.js` | Colunas lidas de cada relatório (`BASE`, `FOLLOW_UP`), pelo nome do cabeçalho, com o tipo |
| `regras.js` | **Única** implementação das regras de negócio (colunas calculadas da planilha antiga). Ver `PROJETO.md`, seção 3 |
| `datas.js` | Datas como série do Excel; `dias` (DIAS) e `diasUteis` (DIATRABALHOTOTAL, sem feriados) |
| `leitor/` | Leitor de `.xlsx` por fluxo (zip + XML) |
| `config/` | De-para de filiais, apelidos de compradores e tabela de SLA |
| `styles/` | CSS |

## Convenções
- Regra nova ou alterada: só em `regras.js`, com teste em `tests/regras.test.js` e nota no `PROJETO.md`.
- Registro importado = colunas do `esquema.js` (nomes em camelCase) + colunas calculadas. "-" e "" da planilha viram `null`; `#N/D` vira `ERRO_ND`.
- Datas sempre em série do Excel (número). Para mostrar: `formatarSerie`.
