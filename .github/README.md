# .github — automação do repositório

| Arquivo | Conteúdo |
|---|---|
| `workflows/pages.yml` | A cada push na `main`: `npm ci`, `npm run lint`, `npm run tipos`, `npm test`, `npm run build` (gera também o modelo do painel), e2e (`npx playwright test`, Chrome do runner, fuso de São Paulo) e só então publica `dist/` no GitHub Pages. Falhou algo: nada é publicado e os rastros do e2e ficam 7 dias como artefato `e2e-rastros` |
