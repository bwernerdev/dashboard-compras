# src — código do app

| Arquivo / pasta | Conteúdo |
|---|---|
| `assets/` | Imagens: emblema da Controladoria (`marca.webp`). Mapa em `assets/README.md` |
| `main.js` | App da equipe: estado (bases, config), período, ações do topo (Atualizar bases, Gerar painel, Configuração, Imprimir, tema). Abas, filtros e tela vêm de `ui/casca.js`. Recalcula ao mudar config ou virar o dia. Troca a base anterior quando chega base de outro dia do ME; selo do período em amarelo com base de 2+ dias úteis. Aba salva que não existe mais (Hoje, removida) abre a Regional. Guarda um ponto do histórico (`pontoDe`) a cada base de outro dia para os mini gráficos |
| `analise.js` | Filtros globais (`FILTROS`, `aplicarFiltros`) e agregações puras das telas (SCs em aberto, faixas de dias, pendências e regularização (`ehPendencia`, `ehRegularizacao`), comprador x status, pré-pedidos, saving, spend por filial, SCs por status, OFs por status de entrega, itens aguardando aprovação do pré-pedido (`aguardandoAprovacao`), períodos da comparação (`periodosDePedido`)). Sem DOM. Usado também pelo `scripts/conferir-xlsm.mjs` |
| `memoria.js` | Memória local do app da equipe: última importação de cada base no IndexedDB (só colunas do ME; `recalcular` refaz os campos calculados) e configuração no localStorage. Guarda também a base anterior (`salvarAnterior`, tipo `base-anterior`) para a variação nos cartões e o histórico (`salvarHistorico`, `juntarAoHistorico`: até 30 pontos, tipo `historico`) para os mini gráficos |
| `atendidas.js` | SCs marcadas como atendidas (olho/duplo clique na lista da Regional): `estaAtendida`, `marcarAtendida`. No localStorage deste navegador, por Solicitação; vence em 120 dias. Só o app da equipe liga (`ligarAtendidas`) |
| `preferencias.js` | Aba, tema, tela cheia, larguras de coluna e recortes de Status (`lerConjunto`/`salvarConjunto`) no localStorage, com try/catch (no quadro do SharePoint não há armazenamento). Usado pelo app e pelo painel |
| `painel/` | Painel publicado (`painel-compras.html`): dados públicos, entrada, modelo e geração. Ver `painel/README.md` |
| `importacao.js` | Ponte tela ↔ worker (`importarNoWorker`) |
| `importacao.worker.js` | Worker: roda `importar` fora da thread da tela e manda o progresso |
| `importar.js` | Importação de um relatório: lê por fluxo, descarta filiais fora do de-para, converte tipos, aplica `regras.js`. Roda no worker e no Node (scripts e testes) |
| `esquema.js` | Colunas lidas de cada relatório (`BASE`, `FOLLOW_UP`), pelo nome do cabeçalho, com o tipo |
| `regras.js` | **Única** implementação das regras de negócio (colunas calculadas da planilha antiga). Ver `PROJETO.md`, seção 3 |
| `datas.js` | Datas como série do Excel; `dias` (DIAS) e `diasUteis` (DIATRABALHOTOTAL, sem feriados) |
| `telas/` | As telas e os diálogos (importação, configuração) |
| `ui/` | Componentes sem regra de negócio: DOM, formatos, tabela, gráficos, filtros, cartões, dica |
| `leitor/` | Leitor de `.xlsx` por fluxo (zip + XML) |
| `config/` | De-para de filiais e apelidos de compradores (padrão) |
| `styles/` | CSS em camadas |

## Convenções
- Regra nova ou alterada: só em `regras.js`, com teste em `tests/regras.test.js` e nota no `PROJETO.md`.
- Conta das telas (agrupar, contar, somar): só em `analise.js`, com teste em `tests/analise.test.js`. As telas só montam DOM.
- Registro importado = colunas do `esquema.js` (nomes em camelCase) + colunas calculadas. "-" e "" da planilha viram `null`; `#N/D` vira `ERRO_ND`.
- Contagem de SC = distinta por "Solicitação de Compra"; contagem de itens = linhas.
- Datas sempre em série do Excel (número). Para mostrar: `formatarSerie` ou `ui/formatos.js`.
- Texto das bases entra no DOM só como texto (`ui/dom.js`, sem `innerHTML`).
- Tudo o que `painel/painel.js` importa vai para dentro do painel público: `ui/`, `analise.js`, `datas.js`, `preferencias.js`, `telas/publicas.js` e as telas que ele lista não podem importar `config/`, `memoria.js` nem `importar.js`.
