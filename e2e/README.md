# e2e — testes no navegador (Playwright)

`npm run test:e2e`: gera o build (`dist/`), sobe `vite preview` em `127.0.0.1:4187` e roda no Chrome instalado (`playwright.config.js` na raiz). Só dados fictícios.

| Arquivo | Conteúdo |
|---|---|
| `app.spec.js` | Fluxo completo: tela vazia e arquivo errado, Regional (cartões, período, faixa, filtro por clique), filtro pela lista, Compradores, Saving, bases salvas após recarregar, CSV, configuração (editar SLA, restaurar padrão), tema |
| `painel.spec.js` | "Gerar painel": baixa `painel-compras.html`; aberto como arquivo (só Regional e Saving, números iguais, sem pré-pedido nem nome completo nos dados) e num iframe `sandbox` com `srcdoc` como o SharePoint (aviso, sem CSV, sem Imprimir, sem erro) |
| `ajuda/bases.js` | Monta `base.xlsx` e `Follow-Up.xlsx` fictícios em memória (com `tests/ajuda/xlsx-ficticio.js`); datas relativas a hoje; filiais e comprador tirados da configuração padrão para o app aceitar as linhas |
