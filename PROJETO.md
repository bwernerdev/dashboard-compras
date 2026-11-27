# Dashboard de Compras — projeto

Substituir o `DASHBOARD COMPRAS 2026.xlsm` por um app web que lê as duas bases do ME, aplica as regras de negócio em um só lugar e gera um painel leve para a equipe de Suprimentos abrir pela Intranet.

Status: **fase 4 concluída** (demais telas públicas, seção 11); fase 3 na seção 10, fase 2 na seção 9, fase 1 na seção 8. Fase 5 (favorito abre o app) é opcional. Painel publicado no OneDrive/SharePoint com link na Intranet (seção 7); ajustes pedidos pela equipe seguem nas seções finais.

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
| Filial ajustada | `Código da filial` (sem ponto) → de-para `Base Analitico` → filial ajustada → nome e regional. Diferença pedida pela equipe (17/11/2026): Itajaí separada em "Itajaí - HUB" (570), "Itajaí - Fatiados" (572) e "Itajaí - CD" (573); na planilha as três eram "Itajai" (o `npm run conferir` usa os nomes antigos) |
| Comprador | `Selecionado por` sem o prefixo `"FDS - "`; vazio = `Pendente`; nome completo → apelido pelo de-para |
| Data de referência | Data do pedido, se houver; senão data de criação da SC |
| Dias em aberto | **Mudou em 25/11/2026 (pedido do usuário):** só SC sem pedido e não cancelada, igual aos Dias da aprovação (dias corridos da criação até hoje). Antes eram dias úteis seg–sex com os dois extremos, e a SC 7709618 (36 corridos, 27 úteis) aparecia no prazo na Status com 36 na tabela. Horas em aberto continuam em dias úteis x 8,8 |
| Horas em aberto | Dias em aberto × 8,8 |
| Dias da aprovação | Dias corridos da criação até hoje |
| Serviço | `Unidade` ∈ {UR, SER, SERV} |
| SLA atendimento | **Mudou em 12/11/2026 (pedido da equipe):** item em aberto com mais de 30 dias em aberto (corridos desde 25/11/2026) → Fora do Prazo; até 30 → No Prazo, qualquer prioridade e tipo (`PRAZO_SLA_DIAS` em `src/regras.js`). Vazio se o item não está em aberto ou o status é Cancelado, Em Pedido ou Em Pré-Pedido. Antes: tabela `sla` abaixo, com `#N/D` para prioridade fora dela e "Fora do Prazo" em item com pedido (texto > número) |
| Status Pré-Pedido (Atendimento) | **Novo em 12/11/2026 (pedido da equipe), não existe na planilha:** coluna AI da base ("Status Pré-Pedido"). "APROVAÇÃO NÍVEL 1" → "Ag. aprovação " + aprovador GA da filial (Configuração > Filiais, coluna "Aprovador GA (nível 1)", pelo código do ME; sem nome: "Ag. aprovação GA"); NÍVEL 2 e 3 → "Ag. aprovação Corporativo"; demais status como vêm do ME; vazio fica vazio (`aprovacaoPrePedido` em `src/regras.js`) |
| Contrato? | `Nº Contrato` preenchido |
| Spend / Total comprado | Soma de `Preço Total do item Pedido c/ Impostos` |
| Saving Real | `Saving` × `Quantidade do item Solicitação` (mantido como hoje, decisão de 11/11/2026). O ME manda o Saving como texto pt-BR (`"268,93"`); o Excel converte na conta, o app também. Texto vazio vira 0 |
| % Saving | Economia ÷ (Total comprado + Economia) |
| Tempo por etapa | Pré-pedido = criação pré-pedido − criação SC; Pedido = pedido − pré-pedido; Cotação = pré-pedido − cotação (ou hoje − cotação se ainda em cotação); Pendência de compra = cotação − criação SC (ou hoje − criação se ainda pendente); Pendência de contrato e Cancelado análogos |

### Tabela SLA da planilha antiga (dias; não usada desde 12/11/2026)
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
ExcelJS (usado no `giro-estoque`) carrega o arquivo inteiro na memória; com 54 MB e 190 mil linhas isso trava o navegador. Feito na fase 1 (`src/leitor/`):
- Web Worker (a tela não congela) com descompactação por fluxo pelo `DecompressionStream` nativo (sem dependência) e leitura do XML da planilha linha a linha.
- Lê só as colunas usadas e **descarta na hora** as linhas fora das 26 filiais.
- Barra de progresso; meta: < 20 s para a `base.xlsx` atual. Medido: ~3 s.

As bases continuam vindo como hoje: o favorito do ME (bookmarklet "Relatório de Requisição - Friboi V2" + "Follow-up - Friboi") baixa as duas com todas as filiais. **O filtro das 26 filiais fica no app**, não no ME, para não exigir mudança no favorito nem rodar macro à parte. Se um dia o peso incomodar, dá para acrescentar o filtro de filial no favorito (opcional, fora do escopo).

### 4.4 Período — **o que vier nas bases**
Sem histórico acumulado (decisão de 11/11/2026). O painel cobre a janela que o favorito baixa (hoje 60 dias). O período aparece no topo do painel, lido da aba "Dados Gerais" de cada base (Data Início / Data Fim).

### 4.5 Regras em um módulo só, com testes
`src/regras.js` com uma função por regra da seção 3; `src/config/` com de-para de filiais, apelidos de compradores e tabela SLA, **editáveis pela interface** na fase 2 (hoje exigem mexer em aba oculta). Testes unitários com dados fictícios cobrindo cada regra, inclusive o caso corrigido da seção 2. Conferência com a planilha real por script local (`npm run conferir`), sem dados reais no git.

### 4.6 Repositório próprio, **público** desde 12/11/2026
Nasceu privado (regras e nomes de filiais são internos). Em 12/11/2026 o usuário decidiu torná-lo público, com tudo (histórico, regras, nomes e fotos do organograma), para a equipe testar pelo GitHub Pages: https://bwernerdev.github.io/dashboard-compras/. Planilhas (`*.xlsx`, `*.xlsm`) nunca entram no git (`.gitignore` já criado).

### 4.7 Quem vê o quê — **dois públicos** (11/11/2026)
O `.xlsm` anexado na Intranet fica protegido por senha (estrutura + 4 abas); a equipe de Suprimentos tem a senha e acesso total. Protegida, a planilha mostra só 8 abas e esconde as outras 11 (e os botões da aba `Botão`):

| Público | Hoje (`.xlsm`) | No app novo |
|---|---|---|
| **Equipe de Suprimentos** (acesso total) | Todas as abas, com a senha | O **app** (importar, configurar, todas as telas, inclusive Compradores) |
| **Quem abre o anexo da Intranet** | Só as abas visíveis: Capa, Status, Entrega, Regional, Spend, Saving, Atendimento, Organograma | O **painel gerado** ("Gerar painel"), só com as telas dessas abas |

Ocultas hoje: Base, Follow-UP, sla, Base Analitico, Botão, Contr - Cot, scs Filial, Med Temp, sc p Compr, sc p Cat, Regularização.

**A senha do Excel não protege dados:** o `.xlsx` não é criptografado, e qualquer leitor de arquivo vê as abas ocultas sem a senha (o leitor do app faz isso). No painel gerado vale o mesmo para tudo que estiver dentro do `.html`. Por isso a regra é: **o que não é para o público da Intranet não entra no arquivo** (nem escondido). A tela Compradores (`sc p Compr`) fica só no app da equipe, e o painel leva só os campos que as telas públicas usam.

---

## 5. Telas — prioridade

**Filtros globais** (barra superior, valem para todas as telas): Regional, Filial, Comprador, Prioridade, Status, Período (mês/ano do pedido), Contrato sim/não.

1. **Regional** — cartões: SCs abertas (desde 19/11/2026, pedido da equipe, o cartão "SCs em aberto sem pré-pedido" (rótulo assim desde 19/11/2026, com "de N em aberto; M só em pré-pedido" no detalhe, para bater com a tabela e a tela Status) não conta os itens Em Pré-Pedido: SC só com itens em pré-pedido sai, SC com algum item em outro status fica; gráfico, tabela e os outros cartões seguem com todas as em aberto; `scsSemPre`/`itensSemPre` em `resumoEmAberto`), % no prazo, dias médios em aberto, mais antiga. Gráfico de SCs abertas por faixa de dias. Tabela das SCs abertas (ordenável, pesquisa, cor por SLA). Clique na regional/filial filtra.
2. **Compradores** (`sc p Compr`) — por comprador: SCs por status (barras empilhadas), pré-pedidos distintos por regional, % de SCs atendidas, SLA no prazo. Linha "Pendente" destacada (SC sem comprador).
3. **Saving** — por filial e por comprador: total comprado, economia, % saving; evolução mensal; ranking.

Fase 4 (12/11/2026): Status, Entrega (Follow-Up), Spend, Atendimento e Organograma (seção 11). Depois, se a equipe quiser: Tempos por etapa, Contrato × Spot, Regularização.

Exportação em todas: Excel e PDF (mesmo padrão do `giro-estoque`).

---

## 6. Fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| 0 | Este documento (concluído em 11/11/2026) | Decisões fechadas, exceto o teste da Intranet (adiado para antes da fase 3) |
| 1 | Leitor das bases (worker) + `regras.js` + configuração + testes (concluída em 11/11/2026) | Lê as duas bases atuais em < 20 s; regras testadas |
| 2 | Telas Regional, Compradores, Saving + filtros globais (concluída em 11/11/2026) | Números de Saving e sc p Compr batem com o `.xlsm`; Regional bate com a regra corrigida |
| 3 | "Gerar painel": `.html` único, só com as telas públicas (seção 4.7), publicado no SharePoint/OneDrive com link na Intranet (seção 7). Concluída em 11/11/2026 (seção 10) | Link da Intranet abre o painel no quadro do SharePoint sem importar nada; "Copiar tabela" funciona; o arquivo não contém dados das telas internas |
| 4 | Demais telas públicas: Status, Entrega, Spend, Atendimento, Organograma, no app e no painel (Capa não: as abas já navegam). Concluída em 12/11/2026 (seção 11). Internas, se a equipe quiser: Contr - Cot, scs Filial, Med Temp, sc p Cat, Regularização | Paridade com as abas visíveis da planilha protegida |
| 5 (opcional) | Favorito do ME abre o app e entrega as bases direto, sem passar por Downloads | Atualização com um clique |

---

## 7. Decisões tomadas e perguntas em aberto

### Decidido em 11/11/2026
| Tema | Decisão |
|---|---|
| Intranet | Não aceita anexo `.html`, só link. Painel `.html` no SharePoint/OneDrive (link "Pessoas da empresa") cadastrado na Intranet; testes 1–3 na seção 7. Plano B (`.xlsx` enxuto) não é mais necessário |
| Filiais | Bases continuam com todas as filiais (favorito do ME); filtro no app |
| Dias úteis | Mesmo método atual: seg–sex, sem feriados |
| Saving Real | Mantido como hoje (quantidade da solicitação) |
| Período | O que vier nas bases; sem histórico acumulado |
| Repositório | Próprio, público desde 12/11/2026: `github.com/bwernerdev/dashboard-compras`; site no GitHub Pages |
| Correção da seção 2 | Aprovada: o painel publica os valores corrigidos (dias em aberto, Data, Serviço, SLA, tempos por etapa) |
| Públicos (seção 4.7) | Equipe de Suprimentos: app completo. Intranet: painel gerado só com as telas das 8 abas visíveis; Compradores fica de fora do arquivo |
| Contratos no painel (17/11/2026) | A planilha de contratos (anexo opcional) vai inteira para o painel publicado, com valores, CNPJs e observações: decisão do usuário |
| Contagem distinta com vazio (fase 2) | Igual à planilha: nos pré-pedidos, SC sem pré-pedido conta como 1 em cada grupo (DISTINCTCOUNT do modelo de dados). Decidido em 11/11/2026 |
| Filiais das consultas da planilha (12/11/2026) | As consultas do Power Query da planilha filtram as filiais por conta própria: a base (`Relatório (2)`) por uma lista de nomes, sem a 30555 (SP ANHANGUERA - MATRIZ) e sem o código 2751500; o Follow-Up (`Relatório (3)`) por uma lista de códigos, sem 30555, 30910 (Salvador) e 30733 (CD Cambé). O app filtra pelo de-para (26 filiais). Decisão da equipe: **manter** a 555 no app e **manter** Salvador e CD Cambé na Entrega (na lista do Follow-Up da planilha pareciam esquecidas). Comparando com a planilha, essas filiais explicam a diferença: base atual com 1.982 linhas da 555; Follow-Up de 11/11 com 371 (555) + 188 (Salvador) + 67 (Cambé) |

### Em aberto (nada travando a fase 3)
1. **Teste da Intranet (resolvido em 11/11/2026):** o anexo `.html` foi **recusado**. Fora planilhas, a Intranet só aceita **endereço web** (link). O painel tem de ficar **atrás do login da empresa** (os dados são internos; nada em endereço público, como GitHub Pages):
   - **a) Link para o `.html` no SharePoint/OneDrive da empresa.** **Teste 1 (11/11/2026): funcionou.** O link pede o login Microsoft da empresa e a pré-visualização mostra a página com o script rodando, mas dentro de um quadro isolado (`about:srcdoc`), não como site. Em quadro isolado costumam falhar: memória do navegador (localStorage/IndexedDB), download de CSV, imprimir e `confirm`. **Teste 2 (11/11/2026, Chrome 156, `teste-intranet.html` gerado por `scripts/gerar-teste-intranet.mjs`):**

     | Recurso | No quadro do SharePoint | Efeito no painel |
     |---|---|---|
     | Script, `Intl` pt-BR, `<dialog>` | OK | Funciona |
     | 1,2 MB de dados embutidos (120 mil linhas) | OK, 142 ms | O painel (~0,5–1 MB) cabe com folga |
     | localStorage, IndexedDB | Falham (origem opaca, sem `allow-same-origin`) | Painel não guarda nada; tema e aba não ficam lembrados |
     | Worker | Falha | Painel calcula na thread da tela (8,5 mil linhas: instantâneo) |
     | `window.print()`, `confirm()` | Bloqueados | Painel não usa `confirm`/`alert` (só `<dialog>`); imprimir depende do teste 3 |
     | Download de CSV (`<a download>`) | Sem confirmação de arquivo baixado: tratar como bloqueado | No quadro, o painel não oferece CSV |
     | Copiar (`execCommand('copy')`; `navigator.clipboard` falha) | OK (teste 3) | Botão "Copiar tabela" (texto com tabulação, cola em células no Excel) |
     | Abrir em nova aba (`window.open`) | Bloqueado (teste 3) | Sem "tela cheia" |

   **Decidido (11/11/2026): opção a, SharePoint/OneDrive.** O painel publicado detecta o quadro isolado (`window.top !== window`; `self.origin === 'null'` não serve, porque `file://` também dá `null`) e então: não usa memória, worker, `confirm`/`alert` nem `print`; troca "Exportar CSV" por **"Copiar tabela"**; mostra o aviso *"Para imprimir ou baixar em CSV, use ⋯ > Baixar no SharePoint e abra o arquivo"*. Aberto fora do quadro (baixado, `file://`), tudo funciona como no app.
   - **b) Endereço num servidor web interno (TI).** Abre direto no navegador; depende da TI.
   - **c) Plano B: `.xlsx` enxuto** (seção 4.2), anexado como hoje. Não precisa de hospedagem; perde a interatividade.

---

## 8. Fase 1 — leitor e regras (11/11/2026)
- Base 54 MB (190.112 linhas lidas, 8.555 mantidas, 26 filiais) + Follow-Up 11 MB: 4,2 s no navegador (worker). Meta era 20 s.
- `npm run conferir` bate com a planilha: colunas da Base/Follow-UP, Spend (ao centavo), Saving, sc p Compr, dias úteis (DIATRABALHOTOTAL(0; 11/11/2026) = 33098). Colunas da seção 2 (dias em aberto, SLA, tempos) só têm teste unitário: na planilha estão erradas.
- `Saving` vem do ME como texto pt-BR (`"268,93"`): converter como o Excel (leitura ingênua zerava 86 linhas).
- No Saving da planilha, os filtros ativos vêm das segmentações, não do filtro de página: o painel mostra os filtros ativos.

## 9. Fase 2 — telas do app (11 e 12/11/2026)
- **Casca:** abas, filtros globais (Regional, Filial, Comprador, Prioridade, Contrato?; "Mês do pedido" só no Saving), Atualizar bases, Configuração, Imprimir (A4 deitado, filtros no topo), tema claro/escuro. Clicar em linha de regional/filial/comprador filtra tudo.
- **Toda tabela:** ordena, pesquisa, pagina, exporta .xlsx. **Memória local:** última importação no IndexedDB; dias em aberto e SLA recalculados para hoje; nada sai do computador.
- **Configuração** (filiais e compradores) salva no navegador, com "Restaurar padrão". SLA fixo: 30 dias úteis. Filial nova no de-para pede reimportar a Base.
- **Regional:** SCs em aberto, % no prazo, fora do prazo, média, mais antiga; SCs por faixa de dias; tabela por regional/filial; lista de itens. **Compradores:** pré-pedidos por comprador × regional (primeiro), SCs distintas por comprador × status. **Saving:** total, economia, % por filial, mês e comprador.
- **Regras conferidas com a aba sc p Compr (12/11/2026):**
  - SCs por comprador × status: contagem distinta de "Solicitação de Compra"; "-" fora do de-para; Pendente sem "Selecionado por". Total Geral difere em 1 (linha vazia da Base).
  - Pré-pedidos: contagem distinta de "Número Pré-Pedido"; **vazio conta 1 por grupo**, igual à planilha (Thayane 1.354 = 1.353 + 1). Só compradores do de-para; "-" e Pendente ficam fora da tabela e do cartão.
  - Período De/Até: pré-pedidos recortados pela data de criação do pré-pedido; SCs, pela criação da SC.
  - Filial 555 mantida por decisão da equipe.
- Saíram a pedido da equipe (12/11): recorte por SLA da lista, tabela "Participação e SLA por comprador", legenda de regularização, coluna Prazo máx.

## 10. Fase 3 — painel publicado (11 e 12/11/2026)
- "Gerar painel" baixa `painel-compras.html` (CSS, JS e dados embutidos; números congelados na data da geração). Base de 11/11: 0,18 MB.
- **Dados públicos** (`src/painel/dados.js`): só o que as telas públicas usam. **Fora:** Compradores, pré-pedidos, configuração (de-para com nomes completos), regras de importação.
- No quadro do SharePoint: aviso no topo, sem Exportar Excel nem Imprimir; "Copiar tabela" cola no Excel. Aberto como arquivo no computador, os dois voltam.
- **Pendências de compra/contrato:** no ME nunca têm "Selecionado por", então ficam no comprador "Pendente" (filtrar por comprador as esconde). Recorte Status na lista e atalho "Só pendências". Em aberto: como dividir as pendências entre compradores.
- **Lista de SCs em aberto:** agrupada por SC (uma linha de SC, itens embaixo), ordem por Dias da aprovação decrescente, paginação por SC. CSV e "Copiar tabela" saem com um item por linha.
- **Colunas:** largura por arrasto, setas (10 px; Shift 50) ou duplo clique (autoajuste); "Larguras originais"; mínimo 40 px; lembrada por tabela.
- **Tela cheia** (`lista-tela-cheia`, Esc sai): sem rolagem lateral de 1366 a 1920 px.
- **Regularização:** categoria = REGULARIZAÇÃO deixa a linha toda vermelha (`#ffc7ce`/`#9c0006`; escuro `#4a1d22`/`#ffb3b8`; `--linha-reg-*`). `analise.ehRegularizacao`; campo `categoria` no painel. Leitor de tela ouve "(regularização)".
- **Emergencial:** faixa vermelha de 4 px à esquerda (`--pl-emergencial`, `classeDaLinhaSc` em `src/ui/cores-planilha.js`); pode somar com regularização; a prioridade continua escrita.
- **SC atendida:** olho à esquerda ou duplo clique (fora da coluna SC) recolhe a SC numa linha. Só muda a lista; cartões e gráficos continuam contando. Salvo no navegador (`localStorage`, `src/atendidas.js`), 120 dias; só no app, não no painel. Exportar, copiar, pesquisar e imprimir ignoram a coluna do olho (`controle: true`).

### Cores da planilha (11/11/2026)
Mesmas cores da formatação condicional do `.xlsm` (tema Office).
| Valor | Planilha (selo na tabela) | Gráfico claro / escuro |
|---|---|---|
| Em Pedido | `#C6E0B4` | `#1BAF7A` / `#199E70` |
| Em Pré-Pedido | `#2F5597` (texto branco) | `#6250D6` / `#9085E9` |
| Em Cotação | `#FFE699` | `#EDA100` / `#C98500` |
| Em pendências de compra | `#B4C6E7` | `#6AA8F0` / `#5594DC` |
| Em pendências de contrato | `#8EA9DB` (planilha: `#B4C6E7`) | `#1D5FB0` / `#2A5FC4` |
| Sel. Comprador | sem cor | `#9AA1AB` / `#8B929C` |
| Cancelado | `#FF0000` | `#E5483B` / `#E0584C` |
| NORMAL / URGENTE / EMERGENCIAL | marca `#D9D9D9` / `#FFFF00` / `#C00000` | — |
| % Saving "-" ou < 0,1% / ≥ 6% | `#FFD966` / `#00B050` | — |

- **Tabela:** selo com o fundo exato da planilha e texto preto (contraste ≥ 5:1; branco só no azul-escuro). Prioridade em marca quadrada + texto, para não se confundir com o status.
- **Gráfico:** mesma família de cor, em tons validados por tema (contraste, daltonismo). Fundos da planilha somem no claro e o azul/roxo escuros somem no escuro.
- Sel. Comprador fica cinza neutro no gráfico de propósito.

### Publicar (toda atualização)
1. App da equipe: "Atualizar bases", depois "Gerar painel".
2. OneDrive/SharePoint: enviar `painel-compras.html` com **Substituir** (mesmo nome). O link e o cadastro na Intranet não mudam.

## 11. Fase 4 — demais telas públicas (12/11/2026)
- **Ordem das abas** (app e painel, `src/telas/publicas.js`): Status, Entrega, Regional, Spend, Saving, Atendimento, Organograma; no app, Compradores (interna) entra depois da Regional. Aba inicial: Regional.
- **Status:** SCs distintas por status (a barra recorta a lista), lista agrupada por SC com recorte Status e pesquisa.
- **Entrega** (Follow-Up): OFs distintas por status e filial, lista por SC e OF com fornecedor e CNPJ. `comprador` e `temContrato` também calculados no Follow-Up (`src/regras.js`). Sem Follow-Up, a tela avisa.
- **Spend:** pedido c/ impostos por filial (% do total, OFs distintas) e por mês; barras no lugar da pizza; soma toda linha com valor, mesmo sem nº de pedido.
- **Atendimento:** itens em aberto, mais antigos primeiro, com SLA; recorte Todos/Fora/No prazo. Cartões contam **SCs**: fora = algum item fora; no prazo = algum no prazo e nenhum fora.
- **Organograma:** `src/telas/organograma.js` + fotos em `organograma-fotos.js` (96 px, entram no painel). Mudou a equipe: editar os dois. Desde 19/11/2026 Lili Beth no lugar de Bruno Werner (regional "Filiais Lili"; Bruno W. continua no de-para para SCs antigas; `REGIONAIS_ANTIGAS`, `COMPRADORES_NOVOS` em `src/config/index.js`; o `conferir` usa o nome antigo).
- **Painel:** `VERSAO` 5 (`src/painel/dados.js`); bloco `followUp` só com campos da Entrega. Base de 11/11: 0,72 MB com Follow-Up.
- Follow-Up de 11/11: 2.983 itens, 1.259 OFs (não entregue 919, parcial 409, entregue 8).

## 12. Testes (estado de 12/11/2026)
`npm test`: 67 unitários. `npm run test:e2e`: 15 (importação, filtros, abas, memória, configuração, tema, painel como arquivo e em iframe `sandbox` + `srcdoc` como o SharePoint, sem pré-pedido nem nome completo nos dados embutidos).
