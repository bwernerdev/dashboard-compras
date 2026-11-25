# src/leitor — leitura de .xlsx por fluxo

O ExcelJS carrega o arquivo todo na memória e trava com a `base.xlsx` (54 MB compactados, 320 MB de XML). Este leitor não usa dependência: abre o zip por acesso direto e descompacta com o `DecompressionStream` nativo (navegador e Node 18+).

| Arquivo | Conteúdo |
|---|---|
| `zip.js` | `abrirZip` (lê só o diretório central), `fluxoDaParte` (descompacta uma parte por fluxo, com progresso), `textoDaParte` |
| `arquivo.js` | `copiarParaMemoria`: lê o arquivo inteiro numa leitura só, em sequência, com progresso ("Copiando o arquivo"). Direto de pasta de rede (Citrix), o acesso direto do zip fazia uma ida ao servidor por pulo e ficava muito lento. Feita na tela (`src/main.js`), que guarda a cópia para "Reimportar bases" e manda ao worker |
| `xlsx.js` | `abrirPasta` (abas + strings compartilhadas sob demanda), `lerAba` (a primeira linha com conteúdo é o cabeçalho e escolhe as colunas; demais linhas por callback), `lerAbaInteira` (abas pequenas), `LeitorDeLinhas` (XML em pedaços → linhas), `CelulaErro` |

## Detalhes
- As strings compartilhadas ficam no fim do zip: por isso o acesso direto em vez de ler o zip em sequência.
- Fórmulas: usa o valor gravado (`<v>`), igual ao que o Excel mostra.
- Tipos: `s` (string compartilhada), `str`, `inlineStr`, `b`, `e` (`CelulaErro`), número. Datas chegam como número (série); quem converte é `src/importar.js` pelo tipo do esquema.
- Sem zip64: arquivo com mais de 4 GB ou 65 mil partes dá erro claro.
- Medido em 11/11/2026: `base.xlsx` inteira (190 mil linhas) em ~3 s no Node.
