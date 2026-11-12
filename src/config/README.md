# src/config — tabelas de apoio

| Arquivo | Conteúdo |
|---|---|
| `padrao.js` | `CONFIG_PADRAO`: filiais (código → filial ajustada, nome, regional, aprovador GA passado pela equipe em 12/11/2026; sem nome: 716, 892, 555), compradores (nome → apelido). Copiado da aba `Base Analitico` do `.xlsm` em 11/11/2026 |
| `index.js` | `criarConfig(config)`: monta as buscas no estilo PROCV (primeira ocorrência, sem diferenciar maiúsculas); `aprovadorGA(código)` (nome do nível 1 do pré-pedido, campo `aprovadorGA` da filial; configuração salva sem o campo usa o do padrão); `normalizarCodigoFilial` |

- Mudou o de-para na planilha antiga ou entrou filial/comprador novo: editar `padrao.js` (ordem importa) e rodar `npm run conferir`.
- A edição pela interface (salva no navegador) entra na fase 2; ela passa o objeto editado para `criarConfig`.
- Dados internos (nomes de filiais e compradores): ficam visíveis, o repositório é público desde 12/11/2026 (decisão do usuário).
