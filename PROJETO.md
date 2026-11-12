# Dashboard de Compras — projeto

Substituir o `DASHBOARD COMPRAS 2026.xlsm` por um app web que lê as duas bases do ME, aplica as regras de negócio em um só lugar e gera um painel leve para a equipe de Suprimentos abrir pela Intranet.

Status: **fase 3 concluída** ("Gerar painel" para o SharePoint; resultado na seção 10); fase 2 na seção 9, fase 1 na seção 8. Falta publicar o primeiro painel e cadastrar o link na Intranet. Próxima é a fase 4.

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
| Dias em aberto (úteis) | Só SC sem pedido e não cancelada: dias úteis (seg–sex) da criação até hoje, contando os dois extremos. Mantido como na planilha (equipe, 12/11/2026): SC criada na segunda já tem 4 dias na quinta, então emergencial (máx. 3) fica Fora do Prazo |
| Horas em aberto | Dias em aberto × 8,8 |
| Dias da aprovação | Dias corridos da criação até hoje |
| Serviço | `Unidade` ∈ {UR, SER, SERV} |
| SLA atendimento | **Mudou em 12/11/2026 (pedido da equipe):** item em aberto com mais de 30 dias úteis em aberto → Fora do Prazo; até 30 → No Prazo, qualquer prioridade e tipo (`PRAZO_SLA_DIAS` em `src/regras.js`). Vazio se o item não está em aberto ou o status é Cancelado, Em Pedido ou Em Pré-Pedido. Antes: tabela `sla` abaixo, com `#N/D` para prioridade fora dela e "Fora do Prazo" em item com pedido (texto > número) |
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

1. **Regional** — cartões: SCs abertas, % no prazo, dias médios em aberto, mais antiga. Gráfico de SCs abertas por faixa de dias. Tabela das SCs abertas (ordenável, pesquisa, cor por SLA). Clique na regional/filial filtra.
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
| Contagem distinta com vazio (fase 2) | Igual à planilha: nos pré-pedidos, SC sem pré-pedido conta como 1 em cada grupo (DISTINCTCOUNT do modelo de dados). Decidido em 11/11/2026 |

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

## 8. Resultado da fase 1 (11/11/2026)

### Desempenho (bases de 11/11/2026)
| Arquivo | Linhas lidas | Mantidas (26 filiais) | Tempo Node | Tempo navegador (worker) |
|---|---|---|---|---|
| `base.xlsx` (54 MB) | 190.112 | 8.555 | ~3 s | 3,1 s |
| `Follow-Up.xlsx` (11 MB) | 76.389 | 2.983 | ~0,7 s | as duas juntas em 4,2 s |

Meta era < 20 s.

### Conferência com a planilha (`npm run conferir`)
Recalculando as 10.824 linhas da aba `Base` e as 2.357 da `Follow-UP` com `src/regras.js`, **tudo confere**:
- Colunas por linha: SC, OF, Filial Corr., Nm Fil Corr., Comprador Ajustado Completo, Comprador, Dias da Aprovação, Contrato?, Saving Real, Regional, Filial Ajust, Ano OF, Mês OF.
- Tabelas dinâmicas: **Spend** (11 filiais, ao centavo), **Saving** (total e economia por filial, com o filtro que estava aplicado: Comprador = Thayane, Contrato? = não) e **sc p Compr** (SCs distintas por comprador × status).
- Método dos dias úteis: DIATRABALHOTOTAL(0; 11/11/2026) = 33098, o mesmo número que a planilha mostra nas linhas quebradas.

As colunas da seção 2 (dias em aberto, Data, Serviço, SLA, tempos por etapa) não têm como conferir com a planilha, porque lá estão erradas. Ficam cobertas pelos testes unitários.

### Achados durante a fase 1
- O `Saving` vem do ME como texto pt-BR (`"268,93"`). Uma leitura ingênua zerava 86 linhas; a regra converte como o Excel.
- Na tabela Saving, os filtros ativos vêm das segmentações, não do filtro de página (que mostra "(Tudo)"). O painel novo precisa deixar os filtros ativos visíveis.

### Tela da fase 1
`npm run dev`: escolher/arrastar as duas bases, progresso, cartões (linhas, período, SCs em aberto, SLA, Spend, Economia) e prévia das SCs em aberto ordenadas por dias.

---

## 9. Resultado da fase 2 (11/11/2026)

### O que existe
- **Casca:** topo com as abas Regional | Compradores | Saving, período das bases (Dados Gerais), "Atualizar bases", "Configuração", "Imprimir" e tema claro/escuro.
- **Filtros globais** numa faixa fixa acima de tudo: Regional, Filial, Comprador, Prioridade, Contrato?; "Mês do pedido" só no Saving. Clicar numa linha de regional/filial/comprador filtra o painel inteiro.
- **Regional:** SCs em aberto, % no prazo, itens fora do prazo, média e mais antiga; SCs por faixa de dias úteis (clique recorta a lista); tabela por regional ou filial com barra de SLA; lista dos itens em aberto (o recorte por SLA saiu em 12/11/2026, a pedido da equipe).
- **Compradores:** SCs distintas por comprador × status (barras empilhadas + tabela), pré-pedidos por comprador × regional, participação e SLA. "Pendente" destacado.
- **Saving:** total comprado, economia, % saving (2 casas), por filial, por mês do pedido e por comprador.
- **Toda tabela** ordena, pesquisa (lista de SCs), pagina e exporta CSV para o Excel pt-BR. "Imprimir" sai em A4 deitado com os filtros ativos escritos no topo.
- **Memória local:** a última importação fica no navegador (IndexedDB). Ao abrir, dias em aberto e SLA são recalculados para hoje. Nada sai do computador.
- **Configuração** editável na tela (filiais, compradores; o SLA saiu em 12/11/2026, prazo fixo de 30 dias úteis), salva no navegador, com "Restaurar padrão". Filial nova no de-para pede reimportar a Base.

### Conferência (`npm run conferir`, usando `src/analise.js`, as mesmas funções das telas)
- **Spend** e **Saving** por filial: batem ao centavo.
- **sc p Compr, SCs por comprador × status:** batem. Única diferença: a planilha tem 1 SC a mais em "-", que é uma linha vazia da tabela Base (o app não lê linha sem filial).
- **sc p Compr, pré-pedidos por comprador × regional:** batem (ex.: Thayane 1.354). A contagem distinta do modelo de dados da planilha conta o pré-pedido vazio como um valor (+1 em cada grupo com SC sem pré-pedido); por decisão de 11/11/2026 o app conta igual. Só aparecem compradores e regionais com pelo menos um pré-pedido de verdade.
- **Revalidação da aba sc p Compr (12/11/2026, pedido da equipe: "regra exatamente a da planilha"):** lidas as definições das 3 tabelas dinâmicas e das segmentações (todas em "Todos").
  - SCs por comprador × status: contagem distinta de "Solicitação de Compra" no modelo de dados, comprador = coluna "Comprador" (apelido do de-para; "-" fora dele; Pendente sem "Selecionado por"). Bate linha a linha, inclusive a linha Total Geral (3.837 x 3.836: a linha vazia da tabela Base).
  - Pré-pedidos (QTD Pré-Pedido): contagem distinta de "Número Pré-Pedido"; o vazio conta 1 em cada grupo (ex.: Thayane 1.354 = 1.353 pré-pedidos gerados + 1). A planilha mostra **só os compradores do de-para** (Thayane, Vitor, Bruno W.): "-" tinha 218 itens com pré-pedido e ficava de fora. **Corrigido no app**: "-" e Pendente saem da tabela e do cartão "Pré-pedidos" (antes o app mostrava "-" com 162).
  - % sc's atendidas: contagem de SC (itens) do comprador ÷ total dos compradores visíveis. A planilha foi salva filtrada só na Thayane (100%); o app com o filtro Comprador = Thayane dá 100%. Sem filtro, o app mostra todos.
  - `npm run conferir` passou a conferir também a linha Total Geral, comprador que só o app mostra e a % sc's atendidas.

### Base de 11/11/2026 na tela
397 SCs em aberto (622 itens), 74,1% no prazo, 143 itens fora do prazo, 70 sem prazo (status sem SLA ou sem linha na tabela), média de 9,7 dias úteis, mais antiga com 42.

### Testes
- `npm test`: 48 testes unitários (inclui `tests/analise.test.js`).
- `npm run test:e2e`: 8 testes no Chrome com bases fictícias (importação, filtros, as três telas, memória, CSV, configuração, tema).

---

## 10. Resultado da fase 3 (11/11/2026)

### O que existe
- **Botão "Gerar painel"** no app da equipe (ativo depois de importar a Base): baixa `painel-compras.html` e mostra como publicar.
- **O arquivo** é um `.html` único (CSS, JS e dados embutidos), com as telas **Regional** e **Saving**, os filtros globais, tema e "Copiar tabela". Números congelados na data em que foi gerado (o topo mostra "dados de dd/mm/aaaa hh:mm").
- **Dados dentro do arquivo:** só os campos que essas duas telas usam (`src/painel/dados.js`). O detalhe do item (descrição, solicitante, código) vai só para SC em aberto. **Não vão:** tela Compradores, pré-pedidos, configuração (de-para com descrições e nomes completos), regras de importação.
- **No quadro do SharePoint:** aviso no topo, sem "Exportar CSV" e sem "Imprimir"; "Copiar tabela" cola em células no Excel. Baixado e aberto no computador: CSV e Imprimir voltam.
- Casca comum ao app e ao painel (`src/ui/casca.js`): o painel usa as mesmas telas e contas do app.

### Base de 11/11/2026
Painel com 8.555 linhas: **0,18 MB**, gerado em ~0,1 s. Aberto num quadro isolado igual ao do SharePoint, mostra os mesmos números do app (397 SCs em aberto, 622 itens, 74,1% no prazo, 143 fora).

### Pendências de compra e contrato (11/11/2026)
Status do acompanhamento diário. No ME esses itens **nunca** têm "Selecionado por" (6.099 de 6.099 na base de 11/11/2026), então ficam no comprador **"Pendente"**: filtrar por um comprador os esconde. A lista de SCs em aberto (Regional) ganhou o recorte **Status** com contagem (lista de marcar: vários status de uma vez, igual aos filtros globais) e o atalho **"Só pendências"** (378 itens nas 26 filiais: 210 de compra, 168 de contrato). Lista vazia com pendência escolhida explica o filtro Comprador. Em aberto: como a equipe divide as pendências entre compradores (categoria/"Grupo Produto", filial?). Com a regra, o app pode atribuir o comprador.

### Lista de SCs em aberto agrupada por SC (11/11/2026)
Pedido da equipe: igual à tabela dinâmica da aba Regional, cada SC aparece uma vez (Dias da aprovação, SC, Data, Prioridade na 1ª linha) com os itens embaixo (Status, Produto, Código, Qtd., Solicitante, Filial, Nome da filial, Comprador, Regional). A equipe pediu para tirar as colunas Dias em aberto, SLA, Prazo máx. e Item; o recorte de faixa de dias continua. O recorte de SLA acima da lista saiu em 12/11/2026 (pedido da equipe); o SLA segue nos cartões e na tabela por regional. Ordem: Dias da aprovação, do maior para o menor. Dias da aprovação e Qtd. centralizados. O painel publicado deixou de levar `item` e `slaMax` (dados versão 2). Contagem "397 SCs, 622 itens"; paginação por SC. CSV e "Copiar tabela" continuam com um item por linha, tudo preenchido (melhor para filtrar no Excel). Conferido com a SC 7715098: 3 itens, como na planilha.

### Largura das colunas (12/11/2026)
Pedido da equipe: aumentar e diminuir colunas. Em todas as tabelas, a borda direita do cabeçalho muda a largura: **arrastar**, ou **setas** com o foco nela (10 px; Shift: 50 px). **Dois cliques** na borda fazem o **autoajuste**: a coluna fica com a largura do maior conteúdo da página (cabeçalho numa linha), como no Excel; **"Larguras originais"** (barra da tabela) volta todas. Texto que não cabe fica com reticências (texto inteiro ao passar o mouse). Mínimo 40 px. Lembradas neste navegador por tabela. Arrastar não reordena.

### Lista de SCs em tela cheia (12/11/2026)
Pedido da equipe: a lista "SCs em aberto" ocupar a tela toda, em desktop (não há uso em celular). Botão **"Tela cheia"** no título do bloco: a lista cobre a janela e a tabela usa toda a altura que sobra (cabeçalho fixo, rolagem só dentro dela), de borda a borda: sem margem à esquerda, à direita e embaixo; a paginação sobe para a linha da pesquisa. **Esc** ou "Sair da tela cheia" volta; com a lista de Status aberta, o Esc fecha a lista primeiro. Lembrada neste navegador (`lista-tela-cheia`). Vale também no painel publicado (dentro do quadro do SharePoint).
- Sem rolagem para o lado de 1366 a 1920 px, nos dois modos: Produto, Solicitante e Nome da filial encolhem com a janela (reticências; texto inteiro ao passar o mouse), cabeçalhos quebram em 2 linhas quando falta espaço, células e margens mais justas abaixo de 1500 px e página até 1920 px de largura (antes 1500).

### SCs de regularização em vermelho (12/11/2026)
Pedido da equipe: SC com "Categoria solicitação" = **REGULARIZAÇÃO** (compra já feita, SC aberta depois) fica com a **linha toda em vermelho** na lista de SCs em aberto da Regional. A planilha antiga não tinha essa cor: regra nova.
- Categoria vale para a SC inteira (nenhuma SC mistura categorias na base de 11/11/2026): todos os itens ficam vermelhos. Base de 11/11/2026: 51 SCs em aberto (57 itens) de 397.
- Cor: vermelho claro com texto vermelho escuro (estilo do Excel: fundo `#ffc7ce`, texto `#9c0006`); tema escuro `#4a1d22` / `#ffb3b8`. Tokens `--linha-reg-*`. A coluna do olho fica sem cor (fora da grade).
- Sem legenda (tirada em 12/11/2026 a pedido da equipe, para sobrar espaço para a tabela: a equipe conhece a cor). Leitor de tela ouve "(regularização)" na célula da SC.
- `analise.ehRegularizacao` (sem maiúsculas nem acento). Também no painel publicado: dados versão 3 com o campo `categoria`.

### SCs atendidas: olho e duplo clique (11/11/2026)
Pedido da equipe: marcar na lista de SCs em aberto as SCs que o comprador já atendeu (a SC continua sem pedido no ME até a próxima base). Na lista da Regional, cada SC tem um **olho** à esquerda, fora da grade; clicar no olho ou dar **dois cliques** em qualquer linha da SC (menos na coluna SC: ali dois cliques selecionam o número para copiar) **recolhe** a SC numa linha só, com Dias da aprovação (fundo cinza) e SC, o resto vazio: igual a recolher a SC na tabela dinâmica da planilha (pedido da equipe em 12/11/2026; antes a SC sumia da lista). Olho riscado ou dois cliques expandem de novo. Sem aviso nem "Desfazer" (tirados a pedido da equipe, para sobrar espaço): o olho riscado desfaz; a contagem mostra "N SCs (M atendidas)". Recolhida fica neutra, sem o vermelho de regularização.
- Só muda a lista: cartões, gráficos e tabelas por regional continuam contando a SC (ela ainda está em aberto no ME).
- Fica salvo **neste navegador** (`localStorage`, `src/atendidas.js`), por número de Solicitação; cada marca vence em 120 dias. Não vai para outros computadores nem para o painel.
- Só no app da equipe (`ligarAtendidas()` no `main.js`); o painel publicado mostra a lista inteira, sem olho.
- CSV, "Copiar tabela", pesquisa e impressão ignoram a coluna do olho (`controle: true` em `ui/tabela.js`).

### Cores da planilha (11/11/2026)
Pedido da equipe: mesmas cores da formatação condicional do `.xlsm` (abas Status, Entrega, Regional, Saving; tema Office).
| Valor | Planilha (selo na tabela) | Gráfico claro / escuro |
|---|---|---|
| Em Pedido | `#C6E0B4` | `#1BAF7A` / `#199E70` |
| Em Pré-Pedido | `#2F5597` (texto branco) | `#6250D6` / `#9085E9` |
| Em Cotação | `#FFE699` | `#EDA100` / `#C98500` |
| Em pendências de compra | `#B4C6E7` | `#6AA8F0` / `#5594DC` |
| Em pendências de contrato | `#8EA9DB` (planilha: `#B4C6E7`, igual à de compra) | `#1D5FB0` / `#2A5FC4` |
| Sel. Comprador | sem cor (como na planilha) | `#9AA1AB` / `#8B929C` |
| Cancelado | `#FF0000` | `#E5483B` / `#E0584C` |
| NORMAL / URGENTE / EMERGENCIAL | marca `#D9D9D9` / `#FFFF00` / `#C00000` | — |
| % Saving "-" ou < 0,1% / ≥ 6% | `#FFD966` / `#00B050` | — |

**Reavaliação (11/11/2026).** A 1ª versão pintava a célula inteira e usava os fundos da planilha também nas barras. Problemas: no gráfico, os fundos claros somem no tema claro e o azul-escuro e o roxo somem no escuro (o validador reprova); branco sobre `#FF0000` tem contraste 4,0, abaixo de 4,5; amarelo e vermelho significam coisas diferentes em Prioridade e Status, colunas vizinhas; contrato tinha uma cor na lista e outra no gráfico. Ficou assim:
- **Tabela:** Status e % Saving em selo com o fundo exato da planilha e texto preto (contraste ≥ 5:1); branco só no azul-escuro. Prioridade como marca quadrada + texto, então não se confunde com o status.
- **Gráfico:** a mesma família de cor de cada status, em tons validados por tema (luminosidade, daltonismo, contraste). As duas pendências se separam por claro/escuro, e o selo de contrato fica um tom acima para casar.
- Sel. Comprador fica cinza neutro no gráfico de propósito, porque não tem cor na planilha.

### Publicar (toda atualização)
1. App da equipe: "Atualizar bases" e depois "Gerar painel".
2. OneDrive/SharePoint, pasta do painel: enviar `painel-compras.html` e escolher **Substituir** (mesmo nome).
3. O link "Pessoas da empresa" e o cadastro na Intranet continuam os mesmos. A primeira vez: criar o link desse arquivo e cadastrar na Intranet.

### Testes
- `npm test`: 53 testes unitários (novos em `tests/painel.test.js`: campos públicos, compactação, `gerarTsv`).
- `npm run test:e2e`: 10 testes. Novos em `e2e/painel.spec.js`: painel aberto como arquivo e num iframe `sandbox` + `srcdoc` (como o SharePoint), conferindo telas, números, aviso, botões e que os dados embutidos não têm pré-pedido nem nome completo.

---

## 11. Resultado da fase 4 (12/11/2026)

Pedido da equipe: tudo o que as abas visíveis da planilha mostram precisa estar no painel gerado.

### O que existe
- **Abas na ordem da planilha**, no app e no painel (`src/telas/publicas.js`): Status, Entrega, Regional, Spend, Saving, Atendimento, Organograma. O app põe Compradores (interna) depois da Regional. Aba inicial: Regional.
- **Status** (aba Status): todas as SCs do período, SCs distintas por status (barra recorta a lista), lista agrupada por SC com recorte por Status e pesquisa (no lugar da segmentação Solicitante).
- **Entrega** (aba Entrega, base Follow-Up): OFs distintas por status de entrega e por filial, lista agrupada por SC e OF com fornecedor e CNPJ. Os filtros globais valem para o Follow-Up (`comprador` e `temContrato` passaram a ser calculados também no Follow-Up, `src/regras.js`). Sem Follow-Up importado, a tela avisa.
- **Spend** (aba Spend): pedido c/ impostos por filial com % do total e OFs distintas; por mês do pedido. A pizza virou barras ordenadas. Soma toda linha com valor, mesmo sem nº de pedido, como a planilha.
- **Atendimento** (aba Atendimento): itens em aberto um por linha, do mais antigo, com SLA (a coluna "Prazo máx." saiu com o prazo único de 30 dias); recorte Todos / Fora do prazo / No prazo. Cartões "SCs no prazo" e "SCs fora do prazo" contam SCs, não itens (pedido da equipe, 12/11/2026): SC fora = algum item fora; no prazo = algum item no prazo e nenhum fora.
- **Organograma**: texto e fotos da aba (cargos e filiais de cada comprador; fotos recortadas em 96 px dentro de `src/telas/organograma-fotos.js`, entram no painel). Erico não tem foto na planilha: iniciais. Corrigidos "Bruno Wener" e "Acessoria". Sem contagem de SCs (pedido da equipe). Mudou a equipe: editar `src/telas/organograma.js` e as fotos.
- **Painel** (`src/painel/dados.js`, `VERSAO` 4; 5 desde o SLA único): produto, solicitante, data e filial em toda linha (tela Status), `numeroPedido` (Spend) e `slaMax` (Atendimento); bloco `followUp` só com os campos da Entrega. Continuam fora: Compradores, pré-pedidos, configuração.

- **Tabelas na altura da janela:** a área rolável vai até o fim da janela (desconta a faixa de filtros fixa, medida em `ui/casca.js`) e encolhe com poucas linhas. Corrigido o espaço vazio embaixo das páginas com lista de SCs: textos só para leitor de tela (`.so-leitor`) escapavam da área rolável e esticavam a página.
- **Organograma em árvore**, como na planilha: líderes em cadeia, equipe embaixo com as filiais; fotos de Bruno e Vitor recortadas dentro do círculo.
- **Aba "SCs por Comprador"** (era Compradores; id `compradores` mantido) com **período De/Até** pela "Data Criação solicitação": recorta cartões, gráfico e tabelas da tela; fica salvo no navegador; "Limpar período" volta a tudo.
- **Atendimento agrupado por SC:** itens da mesma SC juntos, com dias em aberto, SC, filial, regional e solicitante só na 1ª linha (como a Regional); a paginação conta SCs. CSV e "Copiar tabela" seguem com um item por linha.
- **Data da lista da Regional** (coluna "Data Aprovação" desde 12/11/2026) = "Data Criação solicitação" (coluna C do Relatório do ME). Antes vinha da coluna calculada `Data` (a maior entre pedido e criação), que para SC em aberto já dava a mesma data (0 diferenças nas bases de 11/11/2026); agora está explícito. Painel `VERSAO` 6 (+ `criacao` nas SCs em aberto).
- **Ajustes de UI/UX (12/11/2026, pedido da equipe):**
  - Regional também conta SLA por SC (cartões "SLA no prazo" e "SCs fora do prazo"; colunas "SCs no prazo"/"SCs fora do prazo" da tabela por regional), igual ao Atendimento; o detalhe do cartão mostra os itens fora.
  - Variação desde a base anterior nos cartões de Status, Regional e Atendimento ("▼ −1 desde 10/11"). A base anterior é a última de outro dia do ME (IndexedDB, tipo `base-anterior`; reimportar no mesmo dia não troca), recalculada com o "hoje" dela. Verde/vermelho só reforçam o sinal do texto; só no app da equipe, o painel não leva.
  - Base com 2+ dias úteis desde a execução no ME: selo do período em amarelo com o texto "N dias úteis atrás" (app e painel).
  - Subtítulos dos blocos em uma frase; o resto (como pesquisar, CSV, olho de atendida) num botão "?" ao lado do título, com dica no hover e no foco.
  - Spend e Saving por mês: barras deitadas no lugar de colunas (o gráfico `colunas` saiu).
  - Acabamento (pacote A): fundo da página um tom abaixo do branco, cantos de 12 px e sombra suave em cartões e blocos; cartões com ícone no canto (cor do tom) e número maior (`--fs-3xl`); tabelas com faixa alternada (por SC/OF nas agrupadas) e algarismos de largura fixa; esqueleto enquanto as bases salvas abrem (app) ou os dados descompactam (painel); fade curto ao trocar de aba (sem animação com "reduzir movimento"); estados vazios com ícone e "Limpar filtros".
  - Topo abaixo de 1100 px (janela pela metade): ações descem para uma linha própria; título e período não quebram. Sem layout de celular.
  - Pacote moderno (12/11/2026):
    - Aba **Hoje** (só no app, primeira aba): SCs que viraram fora do prazo desde a base anterior, que vencem em até 2 dias úteis, sem comprador (Pendente) e novas. Cada lista abre o detalhe da SC.
    - **Detalhe da SC:** clicar numa linha (Regional, Atendimento, Status, Hoje) abre um painel à direita com os dados da SC e todos os itens. Esc ou ✕ fecha. Na Regional com atendidas ligadas, o clique espera 260 ms para não brigar com o duplo clique.
    - **Mini gráficos** nos cartões de Status, Regional e Atendimento: histórico das últimas 30 bases de dias diferentes (IndexedDB, tipo `historico`). Só sem filtro ativo; aparecem a partir da 2ª base de outro dia.
    - **Topo compacto** ao rolar: título, abas e emblema numa linha só; volta ao topo, expande.
    - **Barras** com gradiente e animação de crescer ao abrir a aba (sem animação com "reduzir movimento").
    - **Comparação de períodos** em Spend e Saving: mês (ou trimestre) atual até o dia de hoje contra o mesmo trecho do anterior, pela data do pedido. Ignora o filtro "Mês do pedido". Painel `VERSAO` 7 (leva `dataPedido`).
    - **Densidade:** botão "Compacta" nas tabelas tira respiro das linhas (todas as tabelas; lembrado no navegador).
    - Colunas fixas ao rolar para o lado: testadas e retiradas (a equipe não gostou).
    - Clicar na coluna SC não abre o detalhe (serve para selecionar e copiar, como no duplo clique).
  - Recorte de Status das listas (Regional, Status e Entrega) salvo no navegador: volta ao abrir o app (e o painel, onde o navegador deixar guardar) e continua ao importar outra base.
- **Lista de SCs da Regional (pedido da equipe):** 200 SCs por página (eram 50); as colunas cabem na largura da janela (as de texto e as alargadas encolhem com reticências, sem rolar para o lado); botão "Colunas" oculta colunas (lembrado no navegador; CSV e "Copiar tabela" seguem com todas); tela cheia só pelo botão: abrir o app ou importar mostra sempre a tela normal (pedido da equipe; antes abria sozinha e ficava lembrada).
- **Filtros lembrados no navegador:** a seleção dos filtros globais volta na próxima vez que abrir o app (e o painel, onde o navegador deixar guardar). "Limpar filtros" limpa também o que ficou salvo.
- **SLA com prazo único (pedido da equipe):** fora do prazo só com mais de 30 dias úteis em aberto, qualquer prioridade. Saiu a tabela de SLA da Configuração e a coluna "Prazo máx." do Atendimento; painel `VERSAO` 5 (sem `slaMax`). Bases de 11/11/2026: itens fora do prazo de 149 para 43.
- **Topo e identidade visual:** emblema da Controladoria Administrativa CDs (recortado do logo do `giro-estoque`, sem o texto) à esquerda, ocupando as duas linhas do topo; também é o ícone da aba. Topo em duas linhas fixas: título e ações em cima, abas embaixo (antes as ações quebravam sozinhas para uma segunda linha). Ações do topo, seletores de filtro e "Filtros" no mesmo tamanho (13 px, 28 px de altura); abas 14 px. Nada específico para celular (pedido da equipe).
- **Fontes padronizadas:** uma família (Segoe UI); todos os tamanhos na escala de tokens (setas de 9/10 px, iniciais do organograma e texto de impressão estavam fora); peso 650 virou 700 (a Segoe UI desenhava 700 de qualquer jeito); título do topo subiu para 20 px, acima dos títulos de bloco (16 px).
- **Listas de marcar como o filtro do Excel** (filtros globais e recortes de status): sem filtro, "Todos" e todas as opções aparecem marcados; desmarcar uma opção tira só ela; desmarcar "Todos" limpa a lista para marcar só o que interessa; marcar "Todos" volta a todas. Antes "Todos" era um botão que só limpava a seleção e ficava desativado sem filtro (parecia não funcionar).

### Bases de 11/11/2026
- `npm run conferir`: tudo confere, inclusive a tabela dinâmica Spend, agora calculada com a função da tela (`spendPorFilial`).
- Follow-Up: 2.983 itens, 1.259 OFs; não entregue 919 OFs (2.032 itens), parcial 409 (938), entregue 8 (13).
- Painel com Base + Follow-Up: ~0,72 MB (0,55 MB sem o Follow-Up).

### Testes
- `npm test`: 67 testes unitários (novos: SCs por status, spend por filial, entregas por status, Follow-Up no painel).
- `npm run test:e2e`: 15 testes (novos: ordem das abas, Status, Spend, Atendimento, Organograma, Entrega com e sem Follow-Up; painel com as 7 telas públicas e o Follow-Up).

