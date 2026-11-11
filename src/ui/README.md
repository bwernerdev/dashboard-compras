# src/ui — componentes de tela (sem regra de negócio)

Gráficos em HTML/CSS no padrão da skill de visualização: barras de 16 px com ponta arredondada, 2 px entre segmentos, legenda com 2+ séries, valor em cor de texto, dica no hover/foco que nunca é o único acesso (sempre há tabela com os números).

| Arquivo | Conteúdo |
|---|---|
| `dom.js` | `el(tag, atributos, ...filhos)` (texto sempre como texto), `substituir`, `novoId` |
| `formatos.js` | Números pt-BR: `inteiro`, `decimal`, `moeda`, `moedaCentavos`, `moedaCompacta`, `pct`, `pctFino` (2 casas, saving), `data`, `texto` |
| `tabela.js` | `criarTabela`: colunas `num` (à direita) ou `centro` (centralizadas), ordenar por coluna, pesquisar, paginar, linha de total, linha clicável, agrupar linhas (`grupo`: colunas do grupo só na 1ª linha, paginação por grupo; CSV repete tudo), "Copiar tabela" (`gerarTsv` + `copiarTexto`: execCommand primeiro, funciona no quadro do SharePoint), "Exportar CSV" (`gerarCsv`: `;`, vírgula decimal, BOM; desligado por `definirExportacao` no quadro). `baixar(nome, conteudo, tipo)` |
| `casca.js` | Comum ao app e ao painel: `criarNavegador` (abas com teclado, barra de filtros, tela ativa, filtro por clique), `ligarTema`, `ligarImpressao` (sempre tema claro), `descreverFiltros` |
| `graficos.js` | `barras` (clicável), `barrasEmpilhadas` (com legenda), `colunas`, `barraSegmentada` (célula de tabela) |
| `filtros.js` | Barra de filtros globais: lista de marcar por filtro; marca sem fechar; Esc/clique fora fecha; "Limpar filtros" |
| `cartoes.js` | `cartao` (indicador; `tom` sempre com texto), `linhaDeCartoes`, `bloco` (título + subtítulo + conteúdo) |
| `cores-planilha.js` | Cores da planilha antiga (formatação condicional): `seloDoStatus` e `seloDoSaving` (selo com o fundo da planilha), `marcaDaPrioridade` (marca + texto), `corDoStatusNoGrafico` (mesma família, tons validados). Tokens `--pl-*` (tabela) e `--graf-*` (gráfico) |
| `dica.js` | Dica flutuante única (`ligarDica`, `esconderDica`) |

Cores dos gráficos: tokens `--serie-1..7`, `--serie-unica`, `--st-bom`, `--st-critico` em `../styles/tokens.css`. Status, prioridade e % saving usam as cores da planilha antiga (`--pl-*`, pedido da equipe): o que a equipe já reconhece vence a paleta.
