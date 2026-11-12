# src/telas — telas e diálogos

Cada tela recebe `ctx = { registros (já filtrados), followUp (Follow-Up já filtrado, ou null sem a base), filtrar(idFiltro, valor), redesenhar() }` e devolve um elemento. Conta nenhuma aqui: tudo vem de `../analise.js`.

Telas públicas (vão também para o painel) ficam em `publicas.js`, na ordem das abas visíveis da planilha: Status, Entrega, Regional, Spend, Saving, Atendimento, Organograma. O app da equipe põe Compradores (interna) depois da Regional.

| Arquivo | Conteúdo |
|---|---|
| `publicas.js` | `TELAS_PUBLICAS` (ordem das abas, usada pelo app e pelo painel) e `reiniciarTelas` (zera os recortes locais ao importar). Não pode importar `compradores.js`, `config/`, `importar.js` nem `memoria.js` |
| `status.js` | Tela Status (aba Status): todas as SCs do período; cartões (SCs, em aberto, em pedido, canceladas), SCs distintas por status (barra clicável recorta a lista) com tabela, lista agrupada por SC com recorte por Status (lista de marcar) e pesquisa (cobre a segmentação Solicitante) |
| `entrega.js` | Tela Entrega (aba Entrega, base Follow-Up): OFs distintas por status de entrega (Não entregue, Parcial, Entregue; cor fixa + texto), OFs por filial x status (barras empilhadas), lista agrupada por SC e OF (fornecedor, CNPJ) com recorte por status. Sem Follow-Up: aviso |
| `regional.js` | Tela Regional (SCs em aberto): cartões (SLA por SC, como o Atendimento), SCs por faixa de dias úteis (clique recorta a lista), tabela por regional/filial com SCs no prazo/fora e barra de SLA (clique filtra o painel), lista de itens em aberto agrupada por SC (dados da SC só na 1ª linha, como a tabela dinâmica da aba Regional) com recorte por Status (lista de marcar, vários status de uma vez, com contagem; marcar atualiza só a lista; atalho "Só pendências" = pendências de compra e contrato, que no ME ficam sem comprador, em "Pendente"). Sem recorte de SLA (tirado a pedido da equipe; o SLA fica nos cartões e na tabela por regional). Botão "Tela cheia" (lista cobre a janela; Esc volta; lembrada no navegador). SC de regularização com a linha toda em vermelho, sem legenda (app e painel). Olho "atendida" à esquerda de cada SC (ou duplo clique na linha, fora da coluna SC, onde dois cliques copiam o número) recolhe a SC numa linha só (Dias da aprovação e SC, como na planilha), sem aviso; olho riscado expande; ligado só no app (`ligarAtendidas`), não no painel. Substitui as abas Regional e Atendimento. Lista de SCs: 200 SCs por página, cabe na largura, botão "Colunas"; tela cheia só pelo botão (não abre sozinha nem fica salva) |
| `compradores.js` | Tela "SCs por Comprador" (id `compradores`; aba sc p Compr). Período De/Até pela criação da SC (`recortarPeriodo`, salvo no navegador, chave `periodo-compradores`): SCs distintas por comprador x status (barras empilhadas + tabela), pré-pedidos por comprador x regional (vazio conta 1, como na planilha), participação e SLA. `corDoStatus`: cor fixa por status |
| `spend.js` | Tela Spend (aba Spend): spend (pedido c/ impostos) por filial com % do total e OFs distintas (barras no lugar da pizza), por mês do pedido. Filtro "Mês do pedido" vale aqui |
| `saving.js` | Tela Saving: total comprado, economia, % saving (2 casas), por filial, por mês do pedido e por comprador. Filtro "Mês do pedido" vale aqui |
| `atendimento.js` | Tela Atendimento (aba Atendimento): itens em aberto agrupados por SC (dados da SC só na 1ª linha, como a Regional), da mais antiga para a mais nova, com SLA (marca + texto; fora = mais de 30 dias úteis); recorte Todos / Fora do prazo / No prazo. Cartões de SLA contam SCs (SC fora = algum item fora) |
| `organograma.js` | Tela Organograma (aba Organograma): árvore de cima para baixo com linhas (listas aninhadas `org-nivel`/`org-ramo`), líderes em cartão baixo, equipe com as filiais de cada comprador; foto (ou iniciais). Dados em `ARVORE`. Só o organograma, sem contagem de SCs |
| `organograma-fotos.js` | `FOTOS`: fotos da aba Organograma da planilha, 96 x 96 px JPEG em data URI (entram no painel), por nome |
| `importacao.js` | Caixas "Base" e "Follow-Up" (escolher/arrastar, progresso, erro). Na tela vazia e no diálogo "Atualizar bases". Os `input[data-tipo]` são usados pelo e2e |
| `configuracao.js` | Diálogo "Configuração": edita filiais e compradores; `validarConfig`; "Restaurar padrão". Salva no navegador |

Cartões de Status, Regional e Atendimento mostram a variação desde a base anterior (`ctx.anteriores`, só no app). Subtítulo dos blocos em uma frase; detalhes no `ajuda` (botão "?").

Seleções locais das telas (faixa, status, agrupar, SLA) ficam em cada módulo e zeram ao importar outra base (`reiniciarTelas`).
