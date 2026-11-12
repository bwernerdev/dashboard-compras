# src/styles — CSS em camadas

| Arquivo | Conteúdo |
|---|---|
| `tokens.css` | Todos os tokens (cores, tipografia, espaço, raio, sombra) e o tema escuro (`html[data-theme="dark"]`, só redefine tokens). Inclui a paleta dos gráficos (`--serie-1..7`, validada) e os status `--st-bom`/`--st-critico` (só SLA) |
| `base.css` | Reset, topo, abas, faixa de filtros (fixa ao rolar), página, grades (`grade-2`, `grade-2-3`, `pilha`), utilitários (`so-leitor`, `so-impressao`, `texto-fraco`) |
| `componentes.css` | Botões, campos, chip, alternador, cartões, blocos, filtros, gráficos, dica, selos de SLA, tabela, diálogos, caixas de importação |
| `impressao.css` | Botão "Imprimir": A4 deitado, sem controles, filtros ativos em texto no topo (o app troca para o tema claro ao imprimir) |

Padrão visual do `giro-estoque`: Segoe UI, azul `#2f5bd3`, cinzas neutros, raio 6/8 px. Cor e tamanho só por token. Tipografia: uma família (`--font-body`), tamanhos só da escala `--fs-2xs`..`--fs-2xl` (11 a 26 px; nada em px/rem solto), pesos 400/600/700 (Segoe UI não tem 650). Hierarquia: título do topo `--fs-xl`, título de bloco `--fs-lg`, texto `--fs-md`, tabelas e controles `--fs-sm`, rótulos `--fs-xs`. O tema escolhido fica no navegador; sem escolha, segue o sistema (script no `<head>` do `index.html`).
