# dashboard — mapa rápido

App web (planejado) que substitui o `DASHBOARD COMPRAS 2026.xlsm`: lê `base.xlsx` e `Follow-Up.xlsx` exportados do ME, aplica as regras de Compras e gera um painel `.html` leve para a equipe de Suprimentos (anexado na Intranet).

Status: fase 0 (desenho) concluída; próxima é a fase 1. Decisões, regras de negócio e fases: `PROJETO.md`.

## Arquivos na raiz
| Arquivo | Conteúdo |
|---|---|
| `PROJETO.md` | Diagnóstico da planilha, erro encontrado, regras, decisões, telas, fases, perguntas em aberto |
| `README.md` | Visão para quem usa e mapa das pastas |
| `teste-intranet.html` | Página mínima para testar se a Intranet aceita/abre `.html` (fase 0); mostra se abriu direto ou baixado |
| `.gitignore` | Bloqueia planilhas (`*.xlsx`, `*.xlsm`, `*.csv`) e gerados |
| `*.xlsx`, `*.xlsm` | Bases e planilha atual: só leitura local, nunca versionar. Pesadas (até 54 MB): ler com `openpyxl` em `read_only=True` e só as colunas necessárias |

## Repositório
PRIVADO `github.com/bwernerdev/dashboard-compras` (branch `main`). Nunca tornar público: regras e nomes de filiais são internos. `gh` portátil: `../RPA/ferramentas/gh/bin/gh.exe` com `GH_CONFIG_DIR=../RPA/ferramentas/gh-config`.

## Convenções
- Cada pasta do projeto tem um `README.md` com o mapa dos seus arquivos. Criou pasta: crie o README. Mudou arquivo: atualize o README da pasta.
- Textos de interface e documentação em português do Brasil.
- Seguir o padrão do `../giro-estoque` (Vite, JS puro, tokens CSS, `node --test`, Playwright).
- Regras de negócio só em `src/rules.js` (quando existir); a UI não as reimplementa. Mudou regra: atualize teste e `PROJETO.md` seção 3.
- Sessões usam as skills do caveman: respostas terse (`caveman`), exploração ampla com `caveman-explore`.
