# src — código do app

| Arquivo / pasta | Conteúdo |
|---|---|
| `assets/` | Imagens: logo da Controladoria (`marca.webp`). Mapa em `assets/README.md` |
| `main.js` | App da equipe: estado (bases, config), período, ações do topo (Atualizar bases, Contratos, menu Exportar com Gerar painel e Imprimir (`ui/menu.js`; "Gerando painel..." aparece no botão Exportar), Configuração, tema só com ícone). Abas, filtros e tela vêm de `ui/casca.js`. Recalcula ao mudar config ou virar o dia. Troca a base anterior quando chega base de outro dia do ME; selo do período em amarelo com base de 2+ dias úteis. Aba salva que não existe mais (Hoje, removida) abre a Regional. Guarda um ponto do histórico (`pontoDe`) a cada base de outro dia para os mini gráficos |
| `analise.js` | Filtros globais (`FILTROS`, `aplicarFiltros`) e agregações puras das telas (SCs em aberto, faixas de dias, pendências e regularização (`ehPendencia`, `ehRegularizacao`), comprador x status, pré-pedidos, saving, spend por filial, SCs por status, OFs por status de entrega, itens aguardando aprovação do pré-pedido (`aguardandoAprovacao`), recorte por período De/Até (`recortarPeriodo`, SCs por Comprador), períodos da comparação (`periodosDePedido`)). Sem DOM. Usado também pelo `scripts/conferir-xlsm.mjs` |
| `memoria.js` | Memória local do app da equipe: última importação de cada base no IndexedDB (só colunas do ME; `recalcular` refaz os campos calculados) e configuração no localStorage. Guarda também a base anterior (`salvarAnterior`, tipo `base-anterior`) para a variação nos cartões e o histórico (`salvarHistorico`, `juntarAoHistorico`: até 30 pontos, tipo `historico`) para os mini gráficos. Anexo de contratos já lido: `salvarContratos` (tipo `contratos`). Cópia do último arquivo de Base e Follow-Up (`salvarCopia`, tipo `arquivo-<tipo>`, ~83 + 11 MB, trocada a cada importação; vale 8 horas, `copiaValida`, e a vencida é apagada ao abrir o app) para "Reimportar bases" |
| `atendidas.js` | SCs marcadas como atendidas (olho/duplo clique na lista da Regional): `estaAtendida`, `marcarAtendida`. No localStorage deste navegador, por Solicitação; vence em 120 dias. Só o app da equipe liga (`ligarAtendidas`) |
| `preferencias.js` | Estado lembrado no localStorage (aba, tema, filtros, larguras e colunas das tabelas, recortes das telas): `lerPreferencia`/`salvarPreferencia` (texto), `lerEscolha` (alternadores: só vale opção válida), `lerConjunto`/`salvarConjunto` (recortes de Status), `lerJson`/`salvarJson` (objetos). Com try/catch: inválido, estragado ou sem armazenamento (quadro do SharePoint) = padrão. Usado pelo app e pelo painel |
| `painel/` | Painel publicado (`painel-compras.html`): dados públicos, entrada, modelo e geração. Ver `painel/README.md` |
| `importacao.js` | Ponte tela ↔ worker (`importarNoWorker`) |
| `importacao.worker.js` | Worker: roda `importar` fora da thread da tela e manda o progresso |
| `importar.js` | Importação de um relatório: copia o arquivo para a memória (`leitor/arquivo.js`; `copiar: false` no worker, que já recebe a cópia da tela), lê por fluxo, descarta filiais fora do de-para, converte tipos, aplica `regras.js`. Roda no worker e no Node (scripts e testes) |
| `esquema.js` | Colunas lidas de cada relatório (`BASE`, `FOLLOW_UP`), pelo nome do cabeçalho, com o tipo (`@type {const}`: viram os tipos dos registros) |
| `tipos.d.ts` | Só para `npm run tipos` (não entra no build): `LinhaBase`/`LinhaFollowUp` (de `esquema.js`), `Registro`/`RegistroFollowUp` (retorno de `calcularLinhaBase`/`calcularLinhaFollowUp`), `Linha` (qualquer das duas), `Config`. Usados em JSDoc em `regras.js`, `analise.js` e `painel/dados.js` (`// @ts-check`) |
| `regras.js` | **Única** implementação das regras de negócio (colunas calculadas da planilha antiga). Ver `PROJETO.md`, seção 3 |
| `datas.js` | Datas como série do Excel; `dias` (DIAS) e `diasUteis` (DIATRABALHOTOTAL, sem feriados) |
| `telas/` | As telas e os diálogos (importação, configuração) |
| `ui/` | Componentes sem regra de negócio: DOM, formatos, tabela, gráficos, filtros, cartões, dica |
| `leitor/` | Leitor de `.xlsx` por fluxo (zip + XML) |
| `contratos/` | Planilha de contratos (anexo opcional): `dados.js` (abas, colunas, prazo, cartões; entra no painel) e `ler.js` (lê o .xlsx; só no app). Ver `contratos/README.md` |
| `config/` | De-para de filiais e apelidos de compradores (padrão) |
| `styles/` | CSS em camadas |

## Convenções
- Regra nova ou alterada: só em `regras.js`, com teste em `tests/regras.test.js` e nota no `PROJETO.md`.
- Campo calculado novo: entra sozinho no tipo `Registro` (retorno de `calcularLinhaBase`); `npm run tipos` acusa nome errado em `regras.js`, `analise.js` e `painel/dados.js`.
- Conta das telas (agrupar, contar, somar): só em `analise.js`, com teste em `tests/analise.test.js`. As telas só montam DOM.
- Registro importado = colunas do `esquema.js` (nomes em camelCase) + colunas calculadas. "-" e "" da planilha viram `null`; `#N/D` vira `ERRO_ND`.
- Contagem de SC = distinta por "Solicitação de Compra"; contagem de itens = linhas.
- Datas sempre em série do Excel (número). Para mostrar: `formatarSerie` ou `ui/formatos.js`.
- Texto das bases entra no DOM só como texto (`ui/dom.js`, sem `innerHTML`).
- Tudo o que `painel/painel.js` importa vai para dentro do painel público: `ui/`, `analise.js`, `datas.js`, `preferencias.js`, `telas/publicas.js` e as telas que ele lista não podem importar `config/`, `memoria.js` nem `importar.js`.
