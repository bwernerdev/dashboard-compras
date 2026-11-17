// Tabela com ordenação por coluna, pesquisa, paginação, linha de total, "Copiar tabela" e "Exportar Excel".
// Partes em módulos próprios: tabela-exportar.js (copiar, baixar), tabela-xlsx.js (Excel), tabela-larguras.js (larguras e
// caber na largura), tabela-colunas.js (colunas ocultas), tabela-densidade.js (botão "Compacta").
import { el, substituir, novoId } from './dom.js';
import { textoDaCelula, exportaveis, gerarTsv, baixar, copiarTexto, podeExportar } from './tabela-exportar.js';
import { gerarXlsx, TIPO_XLSX } from './tabela-xlsx.js';
import { criarLarguras, criarAjuste } from './tabela-larguras.js';
import { criarColunasOcultas } from './tabela-colunas.js';
import { botaoDensidade } from './tabela-densidade.js';
import { lerConjunto, salvarConjunto } from '../preferencias.js';

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * colunas: [{ id, rotulo, valor(linha), formato?(valor), tipo?: 'data', num?: bool, centro?: bool,
 *            exibir?(linha) -> Node|texto, classe?(linha) -> string, titulo?,
 *            semDuploClique?: bool (clique e dois cliques nessa coluna não disparam aoClicarLinha nem
 *            aoDuploClique: servem para selecionar o texto e copiar),
 *            controle?: bool (coluna de botão: sem ordenar, fora do Excel, do "Copiar" e da pesquisa;
 *            o rótulo só para leitor de tela) }]
 * opções: titulo (legenda acessível), ordem { coluna, desc }, porPagina, pesquisa, nomeArquivo,
 *         rodape(linhas) -> [texto por coluna], vazio (texto sem linhas, ou função que o devolve), aoClicarLinha(linha),
 *         aoDuploClique(linha), classeLinha(linha) -> string,
 *         grupo { chave(linha), colunas: [ids], nome: ['SC', 'SCs'] }: linhas da mesma chave ficam
 *         juntas (na ordem da 1ª que aparece), as colunas do grupo só na 1ª linha (como a tabela
 *         dinâmica da planilha) e a paginação conta grupos. Excel e "Copiar tabela" repetem tudo.
 *         recolhido(chave) -> bool: grupo recolhido vira uma linha só, com as `colunasRecolhido`
 *         preenchidas e o resto vazio (como recolher a SC na tabela dinâmica); `nomeRecolhido`:
 *         ['atendida', 'atendidas'] entra na contagem.
 * Larguras: arrastar a borda direita do cabeçalho (ou setas com o foco nela) muda a largura da
 * coluna; texto que não cabe fica com reticências. Dois cliques na borda: autoajuste (largura do
 * maior conteúdo da página, como no Excel). "Larguras originais" volta todas ao automático.
 * Lembradas neste navegador por `nomeArquivo`.
 * caberNaLargura: se as colunas passam da largura da área, as de texto (texto-longo/medio e as com
 * largura salva) encolhem na proporção (com reticências) para a tabela caber sem rolar para o lado; refaz ao mudar a janela ou as linhas.
 * escolherColunas: botão "Colunas" (lista de marcar) para ocultar colunas; lembrado por `nomeArquivo`.
 * Coluna com `ocultaPadrao: true` começa oculta até a pessoa escolher.
 * Colunas ocultas só saem da tela: Excel e "Copiar tabela" continuam com todas.
 * "Exportar Excel" (toda tabela, só onde download funciona): planilha .xlsx com as linhas filtradas, número,
 * data, % e R$ de verdade, cabeçalho com filtro (tabela-xlsx.js). Arquivo = `nomeArquivo` com .xlsx;
 * xlsx: nome da aba da planilha (sem ele, o título da tabela).
 * recolhida: tabela com os números de um gráfico (pedido da equipe, 17/11/2026): começa fechada atrás
 * do botão "Ver tabela (N linhas)", para a tela não ficar longa. Aberta ou fechada fica lembrada neste
 * navegador por `nomeArquivo` (preferência `tabelas-abertas`).
 */
export function criarTabela(opcoes) {
  const {
    colunas, titulo, porPagina = 50, pesquisa = true, nomeArquivo = 'tabela.csv', rodape, vazio = 'Nada para mostrar.',
    aoClicarLinha, aoDuploClique, classeLinha, grupo, caberNaLargura = false, escolherColunas = false, xlsx, recolhida = false,
  } = opcoes;
  const pesquisaveis = exportaveis(colunas);
  const idTabela = novoId('tab');
  const indice = new Map(colunas.map((c, i) => [c, i]));
  const estado = { linhas: opcoes.linhas ?? [], termo: '', pagina: 0, ordem: opcoes.ordem ?? null };

  const idPesquisa = novoId('pesq');
  const campoPesquisa = pesquisa ? el('input', {
    type: 'search', id: idPesquisa, class: 'campo', placeholder: 'Pesquisar na tabela',
    'aria-label': `Pesquisar em ${titulo}`,
    oninput: (ev) => { estado.termo = normalizar(ev.target.value); estado.pagina = 0; render(); },
  }) : null;
  const contagem = el('span', { class: 'tabela-contagem', 'aria-live': 'polite' });
  // nomeArquivo segue terminando em .csv: é a chave das larguras e colunas salvas no navegador.
  const botaoExcel = podeExportar() ? el('button', {
    type: 'button', class: 'botao botao-sec botao-pequeno', title: 'Baixa as linhas filtradas numa planilha do Excel',
    onclick: async () => {
      botaoExcel.disabled = true;
      try {
        const planilha = await gerarXlsx(colunas, linhasVisiveis(), { aba: xlsx ?? titulo });
        baixar(nomeArquivo.replace(/\.csv$/i, '') + '.xlsx', planilha, TIPO_XLSX);
      } finally {
        botaoExcel.disabled = false;
      }
    },
  }, 'Exportar Excel') : null;
  const botaoCopiar = el('button', {
    type: 'button', class: 'botao botao-sec botao-pequeno', title: 'Copia as linhas filtradas para colar no Excel',
    onclick: async () => {
      const ok = await copiarTexto(gerarTsv(colunas, linhasVisiveis()));
      botaoCopiar.textContent = ok ? 'Copiado: cole no Excel' : 'Não foi possível copiar';
      clearTimeout(botaoCopiar.relogio);
      botaoCopiar.relogio = setTimeout(() => { botaoCopiar.textContent = 'Copiar tabela'; }, 2500);
    },
  }, 'Copiar tabela');

  const cabeca = el('thead');
  const corpo = el('tbody');
  const pe = el('tfoot');
  const tabela = el('table', { class: 'tabela', 'data-tabela': idTabela }, el('caption', { class: 'so-leitor' }, titulo), cabeca, corpo, pe);
  const paginacao = el('div', { class: 'paginacao' });

  // Larguras, colunas ocultas e caber na largura (cada uma chama ajuste.pedir ao mudar).
  const larguras = criarLarguras({ colunas, idTabela, indice, nomeArquivo, cabeca, corpo, aoMudar: () => ajuste.pedir() });
  const ocultas = criarColunasOcultas({ colunas, idTabela, indice, nomeArquivo, escolher: escolherColunas, aoMudar: () => ajuste.pedir() });
  /** Encolhem só as de texto que aceitam reticências (texto-longo/medio) e as com largura salva. */
  const encolhivel = (c) => c.id !== larguras.ultimaAjustada() && (larguras.larguras.has(c.id)
    || /texto-(longo|medio)/.test((estado.linhas[0] && c.classe?.(estado.linhas[0])) || ''));
  const ajuste = criarAjuste({
    ativo: caberNaLargura, colunas, idTabela, indice, tabela, cabeca, visivel: (c) => !ocultas.oculta(c.id), encolhivel,
  });

  function linhasVisiveis() {
    let linhas = estado.linhas;
    if (estado.termo) {
      linhas = linhas.filter((l) => pesquisaveis.some((c) => normalizar(textoDaCelula(c, l)).includes(estado.termo)));
    }
    if (estado.ordem) {
      const col = colunas.find((c) => c.id === estado.ordem.coluna);
      const sinal = estado.ordem.desc ? -1 : 1;
      linhas = [...linhas].sort((a, b) => {
        const va = col.valor(a);
        const vb = col.valor(b);
        if (va === vb) return 0;
        if (va === null || va === undefined || va === '') return 1; // vazios sempre no fim
        if (vb === null || vb === undefined || vb === '') return -1;
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sinal;
        return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * sinal;
      });
    }
    return linhas;
  }

  function renderCabecalho() {
    substituir(cabeca, el('tr', {}, colunas.map((c) => {
      if (c.controle) return el('th', { scope: 'col', class: classeColuna(c) }, el('span', { class: 'so-leitor' }, c.rotulo));
      const ativa = estado.ordem?.coluna === c.id;
      const sort = ativa ? (estado.ordem.desc ? 'descending' : 'ascending') : 'none';
      return el('th', { scope: 'col', class: classeColuna(c), 'aria-sort': sort, title: c.titulo ?? null },
        larguras.alca(c),
        el('button', {
          type: 'button', class: 'th-botao',
          onclick: () => {
            // 1º clique: números do maior para o menor, texto de A a Z; clique de novo inverte.
            estado.ordem = ativa ? { coluna: c.id, desc: !estado.ordem.desc } : { coluna: c.id, desc: !!c.num };
            render();
          },
        }, c.rotulo, el('span', { class: 'th-seta', 'aria-hidden': 'true' }, ativa ? (estado.ordem.desc ? '▼' : '▲') : '')));
    })));
  }

  /** Linhas em grupos (cada grupo = array). Sem `grupo`, cada linha é um grupo. */
  function agrupar(linhas) {
    if (!grupo) return linhas.map((l) => [l]);
    const mapa = new Map();
    for (const l of linhas) {
      const k = grupo.chave(l);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(l);
    }
    return [...mapa.values()];
  }

  /** num: número alinhado à direita; centro: centralizado (vence o num). */
  function classeColuna(c) {
    return [`c-${indice.get(c)}`, c.num ? 'num' : '', c.centro ? 'centro' : '', c.controle ? 'col-controle' : ''].join(' ').trim();
  }

  const plural = (n, [um, varios]) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;
  const NOME_LINHA = ['linha', 'linhas'];

  /** Coluna do grupo fora da 1ª linha: vazia (e sem cor), a não ser que o valor mude dentro do grupo. */
  const ocultaNoGrupo = (c, l, primeira) => grupo && primeira !== l && grupo.colunas.includes(c.id)
    && textoDaCelula(c, l) === textoDaCelula(c, primeira);

  function td(c, l, primeira) {
    const oculta = ocultaNoGrupo(c, l, primeira);
    const classe = oculta ? '' : (c.classe?.(l) ?? '');
    return el('td', {
      class: [classeColuna(c) ?? '', classe].join(' ').trim() || null,
      // Célula cortada com reticências: o texto inteiro aparece ao passar o mouse.
      title: /texto-(longo|medio)/.test(classe) ? textoDaCelula(c, l) || null : null,
      'data-sem-duplo-clique': c.semDuploClique || null,
    }, oculta ? '' : (c.exibir ? c.exibir(l) : (textoDaCelula(c, l) || '-')));
  }

  function render() {
    renderCabecalho();
    const linhas = linhasVisiveis();
    const grupos = agrupar(linhas);
    const paginas = Math.max(1, Math.ceil(grupos.length / porPagina));
    estado.pagina = Math.min(estado.pagina, paginas - 1);
    const inicio = estado.pagina * porPagina;
    const pagina = grupos.slice(inicio, inicio + porPagina);

    const recolhido = (g) => !!grupo?.recolhido?.(grupo.chave(g[0]));
    // `faixa`: grupos ímpares da página (por linha sem `grupo`) ganham o fundo alternado.
    substituir(corpo, pagina.length ? pagina.flatMap((g, ig) => {
      const rec = recolhido(g);
      const visiveis = rec ? [g[0]] : g;
      return visiveis.map((l, i) => el('tr', {
        class: [
          ig % 2 ? 'faixa' : '', aoClicarLinha ? 'clicavel' : '', grupo && i === 0 ? 'grupo-inicio' : '',
          grupo && i < visiveis.length - 1 ? 'grupo-continua' : '', rec ? 'grupo-recolhido' : '', classeLinha?.(l) ?? '',
        ].join(' ').trim() || null,
        // Clique em botão/link/campo da linha (olho, copiar) ou na coluna semDuploClique (SC) não conta como clique na linha.
        onclick: aoClicarLinha ? (e) => { if (!e.target.closest('button, a, input, [data-sem-duplo-clique]')) aoClicarLinha(l); } : null,
        ondblclick: aoDuploClique ? (e) => { if (!e.target.closest('button, a, input, [data-sem-duplo-clique]')) aoDuploClique(l); } : null,
      }, colunas.map((c) => (rec && !(grupo.colunasRecolhido ?? grupo.colunas).includes(c.id)
        ? el('td', { class: classeColuna(c) })
        : td(c, l, g[0])))));
    }) : el('tr', {}, el('td', { colspan: colunas.length, class: 'tabela-vazia' }, typeof vazio === 'function' ? vazio() : vazio)));

    if (rodape && linhas.length) {
      const totais = rodape(linhas);
      substituir(pe, el('tr', {}, colunas.map((c, i) => el('td', { class: classeColuna(c) }, totais[i] ?? ''))));
    } else substituir(pe);

    const filtrado = linhas.length !== estado.linhas.length;
    if (grupo) {
      const total = filtrado ? ` (de ${plural(agrupar(estado.linhas).length, grupo.nome)})` : '';
      const recolhidos = grupo.recolhido ? grupos.filter(recolhido).length : 0;
      const textoRecolhidos = recolhidos && grupo.nomeRecolhido ? ` (${plural(recolhidos, grupo.nomeRecolhido)})` : '';
      contagem.textContent = `${plural(grupos.length, grupo.nome)}${textoRecolhidos}, ${plural(linhas.length, ['item', 'itens'])}${total}`;
    } else {
      contagem.textContent = filtrado
        ? `${linhas.length} de ${plural(estado.linhas.length, NOME_LINHA)}`
        : plural(linhas.length, NOME_LINHA);
    }

    desenharPaginacao(paginacao, {
      pagina: estado.pagina, paginas,
      texto: `${inicio + 1}–${Math.min(inicio + porPagina, grupos.length)} de ${grupo ? plural(grupos.length, grupo.nome) : grupos.length}`,
      irPara: (p) => { estado.pagina = p; render(); },
    });
    ajuste.pedir();
    mostrarRecolhida?.();
  }

  larguras.aplicar();
  ocultas.aplicar();

  const elemento = el('div', { class: 'tabela-bloco' },
    larguras.estilo, ocultas.estilo, ajuste.estilo,
    el('div', { class: 'tabela-barra' }, campoPesquisa, contagem, larguras.botao, ocultas.botao, botaoDensidade(), botaoCopiar, botaoExcel),
    ajuste.rolagem,
    paginacao);

  // Tabela de gráfico recolhida: botão abre/fecha; o texto diz quantas linhas tem.
  let saida = elemento;
  let mostrarRecolhida = null;
  if (recolhida) {
    const CHAVE = 'tabelas-abertas';
    let aberta = lerConjunto(CHAVE).has(nomeArquivo);
    elemento.id = novoId('tabbloco');
    const botao = el('button', {
      type: 'button', class: 'botao botao-link tabela-alternar', 'aria-controls': elemento.id,
      onclick: () => {
        aberta = !aberta;
        const salvas = lerConjunto(CHAVE);
        if (aberta) salvas.add(nomeArquivo); else salvas.delete(nomeArquivo);
        salvarConjunto(CHAVE, salvas);
        mostrarRecolhida();
        if (aberta) ajuste.pedir();
      },
    });
    mostrarRecolhida = () => {
      elemento.hidden = !aberta;
      botao.setAttribute('aria-expanded', String(aberta));
      // Seta só visual (fora do nome do botão para leitor de tela).
      substituir(botao, el('span', { class: 'tabela-alternar-seta', 'aria-hidden': 'true' }, aberta ? '▾' : '▸'),
        aberta ? 'Ocultar tabela' : `Ver tabela (${plural(estado.linhas.length, NOME_LINHA)})`);
    };
    saida = el('div', { class: 'tabela-recolhivel' }, botao, elemento);
  }
  render();

  return {
    elemento: saida,
    /** Troca as linhas. `manterPagina`: fica na mesma página (ex.: ao ocultar uma SC da lista). */
    atualizar(linhas, { manterPagina = false } = {}) {
      estado.linhas = linhas;
      if (!manterPagina) estado.pagina = 0;
      render();
    },
  };
}

/** Anterior / "1–50 de N" / Próxima; nada com uma página só. */
function desenharPaginacao(alvo, { pagina, paginas, texto, irPara }) {
  substituir(alvo, paginas > 1 ? [
    el('button', {
      type: 'button', class: 'botao botao-sec botao-pequeno', disabled: pagina === 0,
      onclick: () => irPara(pagina - 1),
    }, 'Anterior'),
    el('span', {}, texto),
    el('button', {
      type: 'button', class: 'botao botao-sec botao-pequeno', disabled: pagina >= paginas - 1,
      onclick: () => irPara(pagina + 1),
    }, 'Próxima'),
  ] : []);
}
