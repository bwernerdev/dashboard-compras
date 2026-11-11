# src/config — tabelas de apoio

| Arquivo | Conteúdo |
|---|---|
| `padrao.js` | `CONFIG_PADRAO`: filiais (código → filial ajustada, nome, regional), compradores (nome → apelido) e SLA (prioridade × serviço → mín/máx). Copiado das abas `Base Analitico` e `sla` do `.xlsm` em 11/11/2026 |
| `index.js` | `criarConfig(config)`: monta as buscas no estilo PROCV (primeira ocorrência, sem diferenciar maiúsculas); `normalizarCodigoFilial` |

- Mudou o de-para na planilha antiga ou entrou filial/comprador novo: editar `padrao.js` (ordem importa) e rodar `npm run conferir`.
- A edição pela interface (salva no navegador) entra na fase 2; ela passa o objeto editado para `criarConfig`.
- Dados internos (nomes de filiais e compradores): o repositório é privado.
