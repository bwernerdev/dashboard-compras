# dashboard — mapa rápido

App web (Vite, JS puro, sem framework) que substitui o `DASHBOARD COMPRAS 2026.xlsm`: lê `base.xlsx` e `Follow-Up.xlsx` exportados do ME (favorito do navegador baixa as duas), aplica as regras de Compras no navegador e vai gerar um painel leve para a equipe de Suprimentos (anexado na Intranet).

Status: fase 1 (leitor + regras + testes) concluída; próxima é a fase 2 (telas Regional, Compradores, Saving). Decisões, regras de negócio e fases: `PROJETO.md`.

## Comandos (PowerShell: `npm.cmd`; instalar com `npm.cmd install --cache ./.npm-cache`)
- `npm run dev`: servidor Vite. No preview do app: configuração `dashboard` em `../.claude/launch.json` (porta 5180).
- `npm test`: testes unitários (`node --test tests/*.test.js`), só dados fictícios.
- `npm run medir`: tempo de importação das bases reais da raiz (meta 20 s; hoje ~3 s).
- `npm run conferir`: recalcula a planilha antiga com `src/regras.js` e compara tudo (linhas e tabelas dinâmicas). Rodar sempre que mexer em regra ou config.
- `npm run build`: gera `dist/`.

## Pastas (cada uma tem `README.md` com o mapa dos arquivos)
| Pasta | Conteúdo |
|---|---|
| `src/` | App: importação, regras, tela |
| `src/leitor/` | Leitor de `.xlsx` por fluxo (zip + XML, sem dependência) |
| `src/config/` | De-para de filiais, compradores e SLA |
| `src/styles/` | CSS (tokens, tema escuro) |
| `tests/`, `tests/ajuda/` | Testes unitários e gerador de xlsx fictício |
| `scripts/` | `medir.mjs`, `conferir-xlsm.mjs` |
| `node_modules/`, `dist/`, `.npm-cache/` | Gerados/ignorados: não ler nem editar |

## Arquivos na raiz
| Arquivo | Conteúdo |
|---|---|
| `PROJETO.md` | Diagnóstico da planilha, erro encontrado, regras, decisões, telas, fases, perguntas |
| `README.md` | Visão para quem usa e mapa das pastas |
| `index.html`, `vite.config.js` (`base: './'`), `package.json` | Entrada e build |
| `teste-intranet.html` | Página mínima para testar se a Intranet aceita/abre `.html` (antes da fase 3) |
| `.claude/launch.json` | Preview quando a sessão abre direto nesta pasta |
| `*.xlsx`, `*.xlsm` | Bases e planilha antiga: só locais, nunca versionar (`.gitignore`). Para olhar: `npm run medir`/`conferir` ou `openpyxl` com `read_only=True` |

## Repositório
PRIVADO `github.com/bwernerdev/dashboard-compras` (branch `main`). Nunca tornar público: regras e nomes de filiais/compradores são internos. `gh` portátil: `../RPA/ferramentas/gh/bin/gh.exe` com `GH_CONFIG_DIR=../RPA/ferramentas/gh-config`.

## Convenções
- Cada pasta tem um `README.md` com o mapa dos seus arquivos. Criou pasta: crie o README. Mudou arquivo: atualize o README da pasta.
- Textos de interface e documentação em português do Brasil.
- Seguir o padrão do `../giro-estoque` (tokens CSS, `node --test`, Playwright na fase 2).
- Regras de negócio só em `src/regras.js`; a UI não as reimplementa. Mudou regra: teste em `tests/regras.test.js`, `npm run conferir` e `PROJETO.md` seção 3.
- Fidelidade à planilha antiga: célula vazia = 0 em conta; `""` não é vazia; comparação de texto sem maiúsculas; texto > número. Única correção aprovada: o erro de referência (PROJETO.md seção 2).
- Testes só com dados fictícios. Dados reais só em scripts locais.
- Sessões usam as skills do caveman: respostas terse (`caveman`), exploração ampla com `caveman-explore`.
