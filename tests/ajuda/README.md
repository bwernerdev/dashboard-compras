# tests/ajuda — apoio aos testes

| Arquivo | Conteúdo |
|---|---|
| `contratos-ficticio.js` | `abasDeContratos(hoje)` e `criarContratosFicticios(hoje)`: planilha de contratos fictícia com as 4 abas lidas e duas ignoradas (Dados; Renovações, com dois quadros), título acima do cabeçalho, linha de total. Usada em `tests/contratos.test.js` e no e2e |
| `xlsx-ficticio.js` | `criarXlsx(abas)` monta um `.xlsx` mínimo em memória (strings compartilhadas, números, células vazias); `criarZip(partes)` (vem de `src/ui/tabela-xlsx.js`, o mesmo do "Exportar .xlsx") monta um zip com deflate e CRC |
