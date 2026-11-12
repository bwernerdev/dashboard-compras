# src/painel — painel publicado na Intranet (fase 3)

O app da equipe tem o botão **Gerar painel**: baixa um `painel-compras.html` único (HTML + CSS + JS + dados), que vai para o OneDrive/SharePoint atrás do login da empresa. O link fica cadastrado na Intranet. Público: as telas das abas visíveis da planilha (`telas/publicas.js`: Status, Entrega, Regional, Spend, Saving, Atendimento, Organograma), sem Compradores, com os números congelados na data em que o painel foi gerado. Ver `PROJETO.md`, seções 4.7 e 7.

| Arquivo | Conteúdo |
|---|---|
| `dados.js` | O que vai dentro do painel: `CAMPOS_PUBLICOS` (só o que as telas públicas usam; dias da aprovação, código, qtd. e criação (Data da Regional) só de item em aberto), `CAMPOS_FOLLOW_UP` (tela Entrega; `followUp: null` se gerado sem a base), `VERSAO` 7 (`dataPedido` para a comparação de períodos), `montarDadosDoPainel`, `registrosDoPainel`, `followUpDoPainel`, `compactar`/`descompactar` (JSON, gzip, base64). Roda no navegador e no Node |
| `painel.js` | Entrada do painel: lê os dados embutidos, monta abas e filtros (`ui/casca.js`) e as telas públicas (`telas/publicas.js`; aba inicial Regional). Dentro de um quadro (`window.top !== window`, caso do SharePoint): sem CSV, sem Imprimir, mostra o aviso |
| `modelo.html` | Esqueleto do painel com as marcas `/*CSS*/`, `/*JS*/` e `__DADOS_DO_PAINEL__` |
| `gerar.js` | `gerarPainel({ registros, followUp, meta, hoje })`: modelo pronto + dados compactados. `NOME_DO_ARQUIVO` |
| `modelo.gerado.html` | Gerado por `npm run build:painel` (`vite.painel.config.js` na raiz; roda sozinho antes do `dev` e do `build`). Não versionar, não editar |

## Regras
- Nada de `config/` (de-para com descrições e nomes completos), `importar.js`, `memoria.js` nem `telas/compradores.js` / `telas/hoje.js` pode entrar no painel. O e2e (`e2e/painel.spec.js`) confere os dados embutidos.
- No quadro do SharePoint não funcionam: localStorage, IndexedDB, Worker, download, imprimir, `confirm`, janela nova, `navigator.clipboard`. Funcionam: script, dados embutidos, `<dialog>`, copiar com `execCommand`.
- Mudou os campos de `dados.js`: suba `VERSAO` e confira as telas públicas.
- Publicar: enviar o arquivo para a mesma pasta do OneDrive com o **mesmo nome** e escolher "Substituir". O link da Intranet continua o mesmo.
