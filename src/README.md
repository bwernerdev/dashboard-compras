# src — código do app

| Arquivo / pasta | Conteúdo |
|---|---|
| `main.js` | Casca do app: topo (abas Regional/Compradores/Saving, período, Atualizar bases, Configuração, Imprimir, tema), barra de filtros, tela ativa. Guarda o estado (bases, filtros, config) e recalcula ao mudar config ou virar o dia |
| `analise.js` | Filtros globais (`FILTROS`, `aplicarFiltros`) e agregações puras das telas (SCs em aberto, faixas de dias, comprador x status, pré-pedidos, participação, saving). Sem DOM. Usado também pelo `scripts/conferir-xlsm.mjs` |
| `memoria.js` | Memória local: última importação de cada base no IndexedDB (só colunas do ME; `recalcular` refaz os campos calculados), configuração e preferências no localStorage |
| `importacao.js` | Ponte tela ↔ worker (`importarNoWorker`) |
| `importacao.worker.js` | Worker: roda `importar` fora da thread da tela e manda o progresso |
| `importar.js` | Importação de um relatório: lê por fluxo, descarta filiais fora do de-para, converte tipos, aplica `regras.js`. Roda no worker e no Node (scripts e testes) |
| `esquema.js` | Colunas lidas de cada relatório (`BASE`, `FOLLOW_UP`), pelo nome do cabeçalho, com o tipo |
| `regras.js` | **Única** implementação das regras de negócio (colunas calculadas da planilha antiga). Ver `PROJETO.md`, seção 3 |
| `datas.js` | Datas como série do Excel; `dias` (DIAS) e `diasUteis` (DIATRABALHOTOTAL, sem feriados) |
| `telas/` | As telas e os diálogos (importação, configuração) |
| `ui/` | Componentes sem regra de negócio: DOM, formatos, tabela, gráficos, filtros, cartões, dica |
| `leitor/` | Leitor de `.xlsx` por fluxo (zip + XML) |
| `config/` | De-para de filiais, apelidos de compradores e tabela de SLA (padrão) |
| `styles/` | CSS em camadas |

## Convenções
- Regra nova ou alterada: só em `regras.js`, com teste em `tests/regras.test.js` e nota no `PROJETO.md`.
- Conta das telas (agrupar, contar, somar): só em `analise.js`, com teste em `tests/analise.test.js`. As telas só montam DOM.
- Registro importado = colunas do `esquema.js` (nomes em camelCase) + colunas calculadas. "-" e "" da planilha viram `null`; `#N/D` vira `ERRO_ND`.
- Contagem de SC = distinta por "Solicitação de Compra"; contagem de itens = linhas.
- Datas sempre em série do Excel (número). Para mostrar: `formatarSerie` ou `ui/formatos.js`.
- Texto das bases entra no DOM só como texto (`ui/dom.js`, sem `innerHTML`).
