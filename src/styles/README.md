# src/styles — CSS em camadas

| Arquivo | Conteúdo |
|---|---|
| `tokens.css` | Todos os tokens (cores, tipografia, espaço, raio, sombra) e o tema escuro (`html[data-theme="dark"]`, só redefine tokens). Inclui a paleta dos gráficos (`--serie-1..7`, validada) e os status `--st-bom`/`--st-critico` (só SLA) |
| `base.css` | Reset, topo, abas, faixa de filtros (fixa ao rolar), topo fixo e compacto ao rolar (`html.topo-compacto`), página, grades (`grade-2`, `grade-2-3`, `pilha`), utilitários (`so-leitor`, `so-impressao`, `texto-fraco`) |
| `componentes.css` | Botões, campos, chip, alternador, cartões, blocos, filtros, gráficos, dica, selos de SLA, tabela, diálogos, caixas de importação, densidade compacta, painel de detalhe (`detalhe-sc`), mini gráfico dos cartões (`cartao-serie`), barras com gradiente e animação `crescer` |
| `impressao.css` | Botão "Imprimir": A4 deitado, sem controles, filtros ativos em texto no topo (o app troca para o tema claro ao imprimir) |

Padrão visual do `giro-estoque`: Segoe UI, azul `#2f5bd3`, cinzas neutros, raio 6/8 px (12 px em cartões, blocos e estados vazios: `--r-lg`). Cor e tamanho só por token. Tipografia: uma família (`--font-body`), tamanhos só da escala `--fs-2xs`..`--fs-3xl` (11 a 30 px; `--fs-3xl` só no número dos cartões; nada em px/rem solto), pesos 400/600/700 (Segoe UI não tem 650). Hierarquia: título do topo `--fs-xl`, título de bloco `--fs-lg`, texto `--fs-md`, tabelas e controles `--fs-sm` (ações do topo, seletores de filtro e botões pequenos com 28 px de altura; abas `--fs-md`), rótulos `--fs-xs`. O tema escolhido fica no navegador; sem escolha, segue o sistema (script no `<head>` do `index.html`).
