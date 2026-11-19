# src/config — tabelas de apoio

| Arquivo | Conteúdo |
|---|---|
| `padrao.js` | `CONFIG_PADRAO`: filiais (código → filial ajustada, nome (Itajaí separada em HUB 570, Fatiados 572 e CD 573 desde 17/11/2026; na planilha era "Itajai"), regional, aprovador GA passado pela equipe em 12/11/2026; sem nome: 716, 555), compradores (nome → apelido). Copiado da aba `Base Analitico` do `.xlsm` em 11/11/2026 |
| `index.js` | `criarConfig(config)`: monta as buscas no estilo PROCV (primeira ocorrência, sem diferenciar maiúsculas); `aprovadorGA(código)` (nome do nível 1 do pré-pedido, campo `aprovadorGA` da filial; configuração salva sem o campo usa o do padrão); `normalizarCodigoFilial`; `NOMES_ANTIGOS` (nome que mudou no padrão), `REGIONAIS_ANTIGAS` (regional que mudou: "Filiais Lili" era "Filiais Bruno"), `COMPRADORES_NOVOS` (comprador que entrou depois: Lili Beth) e `atualizarConfigSalva` (troca o nome antigo pelo novo e acrescenta o comprador novo na configuração salva no navegador; usado em `main.js`; o `conferir` volta aos nomes antigos para comparar com a planilha) |

- Mudou o de-para na planilha antiga ou entrou filial/comprador novo: editar `padrao.js` (ordem importa) e rodar `npm run conferir`.
- Mudou um nome no padrão (diferença da planilha): pôr o nome antigo em `NOMES_ANTIGOS` (filial) ou `REGIONAIS_ANTIGAS` (regional; "Filiais Bruno" virou "Filiais Lili" em 19/11/2026), para a configuração salva e o `conferir` acompanharem.
- Comprador novo no padrão (Lili Beth, 19/11/2026): pôr o nome completo também em `COMPRADORES_NOVOS`, para a configuração já salva no navegador ganhar a linha ao abrir.
- A edição pela interface (salva no navegador) entra na fase 2; ela passa o objeto editado para `criarConfig`.
- Dados internos (nomes de filiais e compradores): ficam visíveis, o repositório é público desde 12/11/2026 (decisão do usuário).
