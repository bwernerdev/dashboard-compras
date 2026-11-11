# src/telas — telas e diálogos

Cada tela recebe `ctx = { registros (já filtrados), filtrar(idFiltro, valor), redesenhar() }` e devolve um elemento. Conta nenhuma aqui: tudo vem de `../analise.js`.

| Arquivo | Conteúdo |
|---|---|
| `regional.js` | Tela Regional (SCs em aberto): cartões, SCs por faixa de dias úteis (clique recorta a lista), tabela por regional/filial com barra de SLA (clique filtra o painel), lista de itens em aberto com recorte por SLA. Substitui as abas Regional e Atendimento |
| `compradores.js` | Tela Compradores (aba sc p Compr): SCs distintas por comprador x status (barras empilhadas + tabela), pré-pedidos por comprador x regional, participação e SLA. `corDoStatus`: cor fixa por status |
| `saving.js` | Tela Saving (abas Saving e Spend): total comprado, economia, % saving (2 casas), por filial, por mês do pedido e por comprador. O filtro "Mês do pedido" só aparece aqui |
| `importacao.js` | Caixas "Base" e "Follow-Up" (escolher/arrastar, progresso, erro). Na tela vazia e no diálogo "Atualizar bases". Os `input[data-tipo]` são usados pelo e2e |
| `configuracao.js` | Diálogo "Configuração": edita filiais, compradores e SLA; `validarConfig`; "Restaurar padrão". Salva no navegador |

Seleções locais da Regional (faixa, SLA, agrupar) ficam no módulo e zeram ao importar outra base (`reiniciarRegional`).
