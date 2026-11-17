# src/contratos — planilha de contratos (anexo opcional)

A planilha `CONTROLE DE CONTRATOS.xlsx` entra pela importação ("Atualizar bases", caixa "Contratos (anexo)"), sem ser obrigatória. Abre no botão **Contratos** do topo, numa janela em tela cheia por cima do dashboard (`../telas/contratos.js`), separada das abas e dos filtros globais. Vai também para o painel publicado (decisão do usuário, 17/11/2026).

| Arquivo | Conteúdo |
|---|---|
| `dados.js` | Sem leitor nem config (entra no painel). `ABAS` (Contratos, Pequeno Porte, ME, Inativos; as outras abas da planilha são ignoradas, inclusive Renovações, que a equipe tirou em 17/11/2026), `CAMPOS` (cabeçalho da planilha → campo, rótulo e tipo: data, moeda, código), `lerBlocosDaAba(matriz, idAba)` (cada linha com "Fornecedor" abre um quadro, a janela mostra o 1º; linha de um texto só acima = título; totais e linhas vazias saem; cabeçalho desconhecido vira coluna com o nome da planilha), `prazoDias` (fim − hoje, dias corridos, como a coluna "Prazo Venc. (dias)"; na aba ME essa coluna já é a data do vencimento), `resumoContratos` (cartões: ativos, em renovação, vencem em até 30 dias, fim já passou sem INATIVO), `contarPor`, `statusDoContrato`, `filialAjustadaDoContrato` ("30. 603" → "603", para o nome da filial) |
| `ler.js` | `lerContratos(arquivo)`: abre o .xlsx com `../leitor/` e devolve `{ abas: { id: [quadro] }, meta }`. Só no app da equipe |

- Guardada no navegador (`memoria.js`, tipo `contratos`); volta ao abrir o app.
- Testes: `tests/contratos.test.js` com a planilha fictícia de `tests/ajuda/contratos-ficticio.js`. A planilha real nunca entra no repositório (`*.xlsx` no `.gitignore`).
