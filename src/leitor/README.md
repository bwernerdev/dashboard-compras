# src/leitor — leitura de .xlsx por fluxo

O ExcelJS carrega o arquivo todo na memória e trava com a `base.xlsx` (54 MB compactados, 320 MB de XML). Este leitor não usa dependência: abre o zip por acesso direto e descompacta com o `DecompressionStream` nativo (navegador e Node 18+).

| Arquivo | Conteúdo |
|---|---|
| `zip.js` | `abrirZip` (lê só o diretório central), `fluxoDaParte` (descompacta uma parte por fluxo, com progresso), `textoDaParte` |
| `xlsx.js` | `abrirPasta` (abas + strings compartilhadas sob demanda), `lerAba` (cabeçalho escolhe as colunas; demais linhas por callback), `lerAbaInteira` (abas pequenas), `LeitorDeLinhas` (XML em pedaços → linhas), `CelulaErro` |

## Detalhes
- As strings compartilhadas ficam no fim do zip: por isso o acesso direto em vez de ler o zip em sequência.
- Fórmulas: usa o valor gravado (`<v>`), igual ao que o Excel mostra.
- Tipos: `s` (string compartilhada), `str`, `inlineStr`, `b`, `e` (`CelulaErro`), número. Datas chegam como número (série); quem converte é `src/importar.js` pelo tipo do esquema.
- Sem zip64: arquivo com mais de 4 GB ou 65 mil partes dá erro claro.
- Medido em 11/11/2026: `base.xlsx` inteira (190 mil linhas) em ~3 s no Node.
