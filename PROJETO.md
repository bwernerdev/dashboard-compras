# Dashboard de Compras — projeto

Substituir o `DASHBOARD COMPRAS 2026.xlsm` por um app web que lê as duas bases do ME, aplica as regras de negócio em um só lugar e gera um painel leve para a equipe de Suprimentos abrir pela Intranet.

Status: **fase 0 — desenho**. Nenhum código ainda.

---

## 1. Situação atual

### Fluxo
1. Exportar do ME dois relatórios: `base.xlsx` (itens de SC → cotação → pré-pedido → pedido) e `Follow-Up.xlsx` (pedidos e entregas).
2. Colar cada um numa aba oculta do `.xlsm` (`Base` e `Follow-UP`).
3. Colunas de fórmula à esquerda transformam os dados (filial, comprador, regional, SLA, tempos por etapa, saving).
4. Tabelas dinâmicas + segmentações + gráficos montam as abas visíveis.
5. Anexar o `.xlsm` na Intranet.

### Números medidos (bases de 11/11/2026)
| Arquivo | Linhas | Colunas | Janela | Linhas das 26 filiais do de-para |
|---|---|---|---|---|
| `base.xlsx` | 190.112 | 55 | 12/09 a 11/11 (2 meses) | 8.555 (4,5%) |
| `Follow-Up.xlsx` | 76.389 | 26 | 11/08 a 10/11 (3 meses) | 2.983 (3,9%) |
| `.xlsm` | — | — | 36 MB, 19 abas, 17 tabelas dinâmicas, 32 segmentações, modelo de dados (Power Pivot) e macro | — |

**Mais de 95% do que é exportado não é usado.** As bases vêm com a empresa inteira; o painel só olha 26 filiais.

### Abas e o que calculam
| Aba | Fonte | Conteúdo |
|---|---|---|
| **Regional** ⭐ | Base | Lista de SCs abertas: dias em aberto (úteis), dias desde aprovação, prioridade, status, produto, solicitante, filial, comprador, regional |
| **sc p Compr** ⭐ | Base (modelo de dados) | Pré-pedidos distintos por comprador × regional; SCs distintas por comprador × status; % de SCs atendidas por comprador |
| **Saving** ⭐ | Base | Por filial: total comprado (pedido c/ impostos), economia (`Saving Real`), % saving = economia ÷ (total + economia). Filtro por comprador |
| Status | Base | Lista de SCs com status, data, dias em aberto |
| Entrega | Follow-UP | Lista de OFs com status de entrega |
| Atendimento | Base | SCs abertas com SLA (no prazo / fora do prazo) |
| Spend | Base | Valor de pedidos por filial e % do total |
| Contr - Cot | Base | OFs via cotação spot × via contrato, por filial |
| Med Temp | Base | Média de dias em cada etapa, por filial |
| Regularização | Base | Valor e quantidade por categoria da solicitação, por filial |
| scs Filial / sc p Cat | Base (modelo de dados) | SCs distintas por status/prioridade × filial |
| Capa, Organograma | — | Navegação e organograma |

Tabelas de apoio: `Base Analitico` (de-para filial → filial ajustada → nome → regional; nome completo do comprador → apelido) e `sla` (prazo mín/máx por prioridade × material/serviço).

---

## 2. Erro encontrado na planilha atual

Na aba `Base`, as colunas que usam referência comum (`BA10826`, `AB10826`…) em vez de referência de tabela (`[#This Row]`) apontam **10.823 linhas abaixo** da própria linha. A linha 2 lê a linha 10.825 (a última); da linha 3 em diante, lê linhas vazias.

Colunas afetadas: `Hora em Aberto (Uteis)`, `Dias em aberto (Uteis)`, `Data`, `Serviço`, `Min`, `Max`, `SlA atendimento`, `Cancelado`, `Em Cotação`, `Em Pedido`, `Em pendências de compra`, `Em Pré-Pedido`, `Em pendências de contrato`.

Efeito visível: a aba Atendimento mostra **33.098 dias em aberto** (dias desde 1900) e `#N/D` no SLA. A aba **Regional** usa `Dias em aberto` e `Data`, então também está errada. **Med Temp** também.

Colunas corretas (usam `[#This Row]`): `SC`, `Filial Corr.`, `Nm Fil Corr.`, `Comprador`, `Dias da Aprovação`, `Contrato?`, `Saving Real`, `Regional`, `Ano OF`, `Mês OF`. **Saving** e **sc p Compr** não dependem das colunas quebradas.

### Quanto muda ao corrigir (base colada no `.xlsm` de 11/11/2026, 10.824 linhas)
| Coluna | Hoje | Corrigido |
|---|---|---|
| Dias em aberto (úteis) | 10.823 linhas com **33.098** (todas iguais) | Só os **438** itens sem pedido e não cancelados: de 2 a 52 dias, mediana 4. Demais ficam vazios |
| Data | `00:00:00` em todas, menos a linha 2 | Data do pedido ou, sem pedido, data de criação da SC |
| Serviço | `NÃO` em todas | 1.260 `SIM` (11,6%) e 9.564 `NÃO` |
| SLA atendimento | 393 `#N/D` | 340 No Prazo (86%) e 53 Fora do Prazo |
| Tempos por etapa (Med Temp) | Também leem linhas vazias | Não medido ainda; medir na fase 1 |

A aba **Regional** mostra hoje 33098 na coluna "Dias em aberto" e `00:00:00` em "Data" em todas as linhas.

Consequência para o projeto: o app mantém **o mesmo método** de cálculo (fórmula atual, dias úteis seg–sex, sem feriados, contando os dois extremos), mas lendo a própria linha. Valor idêntico ao exibido hoje não é possível, porque o exibido hoje é o erro. A validação compara com a regra aplicada linha a linha (testes da fase 1).

---

## 3. Regras de negócio (extraídas das fórmulas)

Chave do item: `Requisição ME` + `Item`. `SC` = 7 caracteres a partir da posição 5 de `Solicitação de Compra` (`FDS-7652633` → `7652633`).

| Campo | Regra |
|---|---|
| Filial ajustada | `Código da filial` (sem ponto) → de-para `Base Analitico` → filial ajustada → nome e regional |
| Comprador | `Selecionado por` sem o prefixo `"FDS - "`; vazio = `Pendente`; nome completo → apelido pelo de-para |
| Data de referência | Data do pedido, se houver; senão data de criação da SC |
| Dias em aberto (úteis) | Só SC sem pedido e não cancelada: dias úteis (seg–sex) da criação até hoje, contando os dois extremos |
| Horas em aberto | Dias em aberto × 8,8 |
| Dias da aprovação | Dias corridos da criação até hoje |
| Serviço | `Unidade` ∈ {UR, SER, SERV} |
| SLA mín/máx | Tabela `sla` por prioridade × serviço; vazio se status Cancelado, Em Pedido ou Em Pré-Pedido |
| SLA atendimento | Dias em aberto ≤ máx → No Prazo; senão Fora do Prazo |
| Contrato? | `Nº Contrato` preenchido |
| Spend / Total comprado | Soma de `Preço Total do item Pedido c/ Impostos` |
| Saving Real | `Saving` × `Quantidade do item Solicitação` (mantido como hoje, decisão de 11/11/2026) |
| % Saving | Economia ÷ (Total comprado + Economia) |
| Tempo por etapa | Pré-pedido = criação pré-pedido − criação SC; Pedido = pedido − pré-pedido; Cotação = pré-pedido − cotação (ou hoje − cotação se ainda em cotação); Pendência de compra = cotação − criação SC (ou hoje − criação se ainda pendente); Pendência de contrato e Cancelado análogos |

### Tabela SLA (dias)
| Prioridade | Material (mín–máx) | Serviço (mín–máx) |
|---|---|---|
| Normal | 7–15 | 8–30 |
| Urgente | 4–6 | 4–7 |
| Emergencial | 1–3 | 1–3 |

---

## 4. Decisões recomendadas

### 4.1 Tipo de app — **web estático, mesmo padrão do `giro-estoque`**
Vite + JavaScript puro, sem servidor, sem banco. Os dados nunca saem do navegador. Reaproveita CSS (tokens, tema escuro), componentes de cartão/tabela/gráfico e o fluxo de testes (`node --test` + Playwright) do `giro-estoque`.

Motivo: a equipe já usa esse formato; não depende de TI para servidor; funciona offline.

### 4.2 Dois modos no mesmo app — **quem atualiza** e **quem consulta**
- **Modo atualizar (você):** importa `base.xlsx` + `Follow-Up.xlsx`, aplica regras, confere, e clica "Gerar painel".
- **"Gerar painel"** produz **um único arquivo `.html`** com app + dados já processados e compactados (estimativa: 1–3 MB, contra 36 MB hoje).
- **Modo consulta (equipe):** abre o `.html` no navegador. Filtros, gráficos e exportação funcionam sem importar nada e sem internet.

Motivo: ninguém da equipe precisa baixar 65 MB de base; o arquivo fica 10–30× menor que o `.xlsm`; abre em qualquer PC sem Excel com macro habilitada.

**Restrição da Intranet (11/11/2026):** hoje só se anexam planilhas. Caminho:
1. **Teste com a Intranet (fase 0):** anexar um `.html` pequeno de teste. Se abrir no navegador, ótimo. Se só baixar, também serve: o arquivo abre a partir de Downloads (funciona via `file://`, sem servidor). Se o `.html` for recusado, testar `.zip` com o `.html` dentro.
2. **Plano B, se nada além de planilha for aceito:** "Gerar painel" também exporta um **`.xlsx` enxuto** (sem macro, sem fórmulas, sem modelo de dados): abas Regional, Compradores e Saving já calculadas, com filtro automático, formatação condicional e gráficos. Estimativa < 2 MB. Perde as segmentações interativas, mas resolve o peso e o erro.

Os dois formatos saem do mesmo motor de regras: a escolha não muda as fases 1 e 2.

### 4.3 Leitura das bases — **em segundo plano, por streaming, só o necessário**
ExcelJS (usado no `giro-estoque`) carrega o arquivo inteiro na memória; com 54 MB e 190 mil linhas isso trava o navegador. Proposta:
- Web Worker (a tela não congela) com descompactação por fluxo (`fflate`) e leitura do XML da planilha linha a linha.
- Ler só as ~35 colunas usadas e **descartar na hora** as linhas fora das 26 filiais.
- Barra de progresso; meta: < 20 s para a `base.xlsx` atual.

As bases continuam vindo como hoje: o favorito do ME (bookmarklet "Relatório de Requisição - Friboi V2" + "Follow-up - Friboi") baixa as duas com todas as filiais. **O filtro das 26 filiais fica no app**, não no ME, para não exigir mudança no favorito nem rodar macro à parte. Se um dia o peso incomodar, dá para acrescentar o filtro de filial no favorito (opcional, fora do escopo).

### 4.4 Período — **o que vier nas bases**
Sem histórico acumulado (decisão de 11/11/2026). O painel cobre a janela que o favorito baixa (hoje 60 dias). O período aparece no topo do painel, lido da aba "Dados Gerais" de cada base (Data Início / Data Fim).

### 4.5 Regras em um módulo só, com testes
`src/rules.js` com uma função por regra da seção 3; `src/config/` com de-para de filiais, apelidos de compradores e tabela SLA **editáveis pela interface** (hoje exigem mexer em aba oculta). Testes unitários com linhas reais anonimizadas cobrindo cada regra, inclusive o caso corrigido da seção 2.

### 4.6 Repositório próprio e **privado**
Como o `giro-estoque`, mas privado: as regras e os nomes de filiais são internos. Planilhas (`*.xlsx`, `*.xlsm`) nunca entram no git (`.gitignore` já criado).

---

## 5. Telas — prioridade

**Filtros globais** (barra superior, valem para todas as telas): Regional, Filial, Comprador, Prioridade, Status, Período (mês/ano do pedido), Contrato sim/não.

1. **Regional** — cartões: SCs abertas, % no prazo, dias médios em aberto, mais antiga. Gráfico de SCs abertas por faixa de dias. Tabela das SCs abertas (ordenável, pesquisa, cor por SLA). Clique na regional/filial filtra.
2. **Compradores** (`sc p Compr`) — por comprador: SCs por status (barras empilhadas), pré-pedidos distintos por regional, % de SCs atendidas, SLA no prazo. Linha "Pendente" destacada (SC sem comprador).
3. **Saving** — por filial e por comprador: total comprado, economia, % saving; evolução mensal; ranking.

Depois: Spend, Entrega (Follow-Up), Tempos por etapa, Contrato × Spot, Regularização.

Exportação em todas: Excel e PDF (mesmo padrão do `giro-estoque`).

---

## 6. Fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| 0 | Este documento + teste de anexo `.html` na Intranet | Formato de entrega definido (`.html` ou `.xlsx` enxuto) |
| 1 | Leitor das bases (worker) + `rules.js` + configuração + testes | Lê as duas bases atuais em < 20 s; regras testadas |
| 2 | Telas Regional, Compradores, Saving + filtros globais | Números de Saving e sc p Compr batem com o `.xlsm`; Regional bate com a regra corrigida |
| 3 | "Gerar painel" no formato definido na fase 0 | Arquivo anexado na Intranet abre sem importar nada |
| 4 | Demais telas | Paridade com as abas restantes |
| 5 (opcional) | Favorito do ME abre o app e entrega as bases direto, sem passar por Downloads | Atualização com um clique |

---

## 7. Decisões tomadas e perguntas em aberto

### Decidido em 11/11/2026
| Tema | Decisão |
|---|---|
| Intranet | Hoje só aceita planilha. Testar anexo `.html`; plano B é `.xlsx` enxuto (seção 4.2) |
| Filiais | Bases continuam com todas as filiais (favorito do ME); filtro no app |
| Dias úteis | Mesmo método atual: seg–sex, sem feriados |
| Saving Real | Mantido como hoje (quantidade da solicitação) |
| Período | O que vier nas bases; sem histórico acumulado |

### Em aberto
1. **Teste da Intranet:** resultado do anexo `.html` de teste (abre, baixa ou é recusado).
2. **Correção da seção 2:** de acordo em publicar os valores corrigidos (tabela "Quanto muda")?
3. **Repositório:** próprio e privado (recomendado) ou dentro de `projetos`?
