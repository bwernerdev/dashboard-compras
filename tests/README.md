# tests — testes unitários

`npm test` (`node --test tests/*.test.js`). Só dados fictícios: nada da empresa nos testes.

| Arquivo | Cobre |
|---|---|
| `datas.test.js` | Série do Excel, dia da semana, DIAS, DIATRABALHOTOTAL (inclusive o 33098 da planilha antiga) |
| `regras.test.js` | Cada regra de `src/regras.js`: filial, comprador, dias em aberto, SLA (fora só com mais de 30 dias úteis, qualquer prioridade), Saving Real em texto pt-BR, tempos por etapa, Follow-Up |
| `leitor.test.js` | Leitor de xlsx: tipos de célula, XML picado em pedaços, filtro de colunas, xlsx completo, mensagens de erro |
| `importar.test.js` | Importação ponta a ponta com xlsx fictício: filtro de filial, conversão de tipos, Dados Gerais, coluna faltando, cancelamento |
| `bases.test.js` | Fluxo de dados do app (`src/bases.js`) com as bases fictícias do e2e, armazenamento e vista falsos: importar (cópia, histórico, uma por tipo), base anterior de outro dia, Follow-Up e Contratos, Reimportar pela cópia (vencida pede a caixa), restaurar ao abrir, aviso de filial nova, virada do dia |
| `analise.test.js` | Agregações e filtros das telas (`src/analise.js`, inclusive `ehPendencia`, `ehRegularizacao`, spend, status e entregas), memória (`brutosDe`, `recalcular`), `validarConfig`, `nomeProprio` (nome em caixa alta para exibir) |
| `painel.test.js` | Dados do painel publicado (`src/painel/dados.js`): só campos públicos, detalhe só de SC em aberto, versão, compactar/descompactar; texto do "Copiar tabela" (`gerarTsv`) |
| `fronteira-painel.test.js` | Percorre os imports a partir de `src/painel/painel.js` e falha se o painel publicado alcançar `src/config/`, `importar.js`, `importacao*.js`, `memoria.js` ou as telas internas (Compradores, Configuração, Importação); mostra o caminho de imports que entrou |
| `atendidas.test.js` | SCs atendidas (`src/atendidas.js`): marcar, desmarcar, guardar, vencer em 120 dias, armazenamento estragado (localStorage de mentira) |
| `preferencias.test.js` | Estado lembrado das telas (`src/preferencias.js`): `lerJson`, `lerEscolha` (só opções válidas), `lerConjunto`, armazenamento bloqueado |
| `tabela-ordem.test.js` | Ordenação das tabelas (`ordenarLinhas`): texto com número e acento em pt-BR, número como número, vazios no fim nas duas direções, empate estável, valor lido uma vez por linha |
| `tabela-xlsx.test.js` | "Exportar Excel" (`src/ui/tabela-xlsx.js`): a planilha abre no leitor do app, número e data como número, % e R$ com formato do Excel, sem coluna de controle, cabeçalho congelado com filtro, nome de aba aceito pelo Excel |
| `contratos.test.js` | Planilha de contratos (`src/contratos/`): cabeçalho abaixo do título, quadros com título, Renovações ignorada, vencimento da aba ME, prazo, cartões (sem INATIVO), filial ajustada, abas que faltam e arquivo errado |
| `cores-planilha.test.js` | Cores da planilha antiga por status, prioridade e % saving; status separados no gráfico |
| `contraste.test.js` | Contraste WCAG dos tokens (`src/styles/tokens.css`) nos dois temas: texto e selos >= 4,5:1, borda de campo >= 3:1 sobre `surface`, `surface-2` e `bg`. O `../giro-estoque` tem o mesmo teste |
| `ajuda/` | Gerador de `.xlsx` em memória para os testes (também usado pelo `e2e/`) |

Testes no navegador: `npm run test:e2e` (ver `e2e/`).

A conferência com a planilha real não é teste automático (usa dados internos): `npm run conferir` (ver `scripts/`).
