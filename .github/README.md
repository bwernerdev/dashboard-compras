# .github — automação do repositório

| Arquivo | Conteúdo |
|---|---|
| `workflows/pages.yml` | A cada push na `main`: `npm ci`, `npm run build` (gera também o modelo do painel) e publica `dist/` no GitHub Pages |
