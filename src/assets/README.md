# src/assets — imagens do app

| Arquivo | Conteúdo |
|---|---|
| `marca.webp` | Logo completo da Controladoria Administrativa CDs (com Seara e o texto; 264 x 240 px, fundo transparente, exibido com 76 px de altura), tirado do "Boletim Informativo - CDs MI" (mesma arte usada no Teams; a do `giro-estoque` é outra versão), sem as margens transparentes. Pedido da equipe em 13/11/2026 (antes: só o emblema, sem o texto). Topo no tema claro e ícone da aba |
| `marca-escuro.webp` | O mesmo logo para o tema escuro: texto e azul-escuro da arte clareados (gerado do `marca.webp` com PIL), senão somem no fundo escuro. Só no topo, no tema escuro |

Os dois são usados por `src/ui/marca.js` (embutidos, no app e no painel); o CSS (`styles/base.css`) mostra um ou outro conforme o tema.
