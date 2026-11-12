// Tabela com ordenação por coluna, pesquisa, paginação, linha de total, "Copiar tabela" e exportação CSV.
import { el, substituir, novoId } from './dom.js';
import { formatarSerie } from '../datas.js';
import { lerPreferencia, salvarPreferencia } from '../preferencias.js';
import { listaDeMarcar } from './filtros.js';

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Texto de uma célula para pesquisa e CSV. */
function textoDaCelula(col, linha) {
  const v = col.valor(linha);
  if (v === null || v === undefined || v === '') return '';
  if (col.tipo === 'data') return formatarSerie(v);
  return col.formato ? col.formato(v) : String(v);
}

/** Colunas que vão para CSV, "Copiar tabela" e pesquisa (não as de controle, como o olho). */
const exportaveis = (colunas) => colunas.filter((c) => !c.controle);

/** CSV para o Excel em pt-BR: ";" como separador, vírgula decimal, BOM UTF-8. */
export function gerarCsv(todas, linhas) {
  const colunas = exportaveis(todas);
  const campo = (v) => {
    const s = String(v ?? '');
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const valorCsv = (col, l) => {
    const v = col.valor(l);
    if (v === null || v === undefined) return '';
    if (col.tipo === 'data') return formatarSerie(v);
    if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6).replace('.', ',');
    return v;
  };
  const corpo = [colunas.map((c) => campo(c.rotulo)).join(';'),
    ...linhas.map((l) => colunas.map((c) => campo(valorCsv(c, l))).join(';'))];
  return `﻿${corpo.join('\r\n')}\r\n`;
}

/** Texto para colar no Excel: tabulação entre colunas, vírgula decimal, sem separador de milhar. */
export function gerarTsv(todas, linhas) {
  const colunas = exportaveis(todas);
  const campo = (v) => String(v ?? '').replace(/[\t\r\n]+/g, ' ');
  const valor = (col, l) => {
    const v = col.valor(l);
    if (v === null || v === undefined) return '';
    if (col.tipo === 'data') return formatarSerie(v);
    if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6).replace('.', ',');
    return v;
  };
  return [colunas.map((c) => campo(c.rotulo)).join('\t'),
    ...linhas.map((l) => colunas.map((c) => campo(valor(c, l))).join('\t'))].join('\r\n');
}

/** Baixa um arquivo gerado na hora. */
export function baixar(nome, conteudo, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = el('a', { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Copia texto. Primeiro o jeito antigo (execCommand), que funciona no quadro isolado do
 * SharePoint (teste 3); depois a API nova. Retorna true se copiou.
 */
export async function copiarTexto(texto) {
  const area = el('textarea', { readonly: true, 'aria-hidden': 'true', style: { position: 'fixed', top: '0', left: '-9999px', opacity: '0' } });
  area.value = texto;
  document.body.append(area);
  area.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  area.remove();
  if (ok) return true;
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/** Exportar CSV só onde download funciona (no quadro do SharePoint não: painel/painel.js desliga). */
const exportacao = { csv: true };
export function definirExportacao({ csv }) { exportacao.csv = csv; }

/**
 * colunas: [{ id, rotulo, valor(linha), formato?(valor), tipo?: 'data', num?: bool, centro?: bool,
 *            exibir?(linha) -> Node|texto, classe?(linha) -> string, titulo?,
 *            semDuploClique?: bool (dois cliques nessa coluna não disparam aoDuploClique: servem para
 *            selecionar o texto e copiar),
 *            controle?: bool (coluna de botão: sem ordenar, fora do CSV, do "Copiar" e da pesquisa;
 *            o rótulo só para leitor de tela) }]
 * opções: titulo (legenda acessível), ordem { coluna, desc }, porPagina, pesquisa, nomeArquivo,
 *         rodape(linhas) -> [texto por coluna], vazio (texto sem linhas, ou função que o devolve), aoClicarLinha(linha),
 *         aoDuploClique(linha), classeLinha(linha) -> string,
 *         grupo { chave(linha), colunas: [ids], nome: ['SC', 'SCs'] }: linhas da mesma chave ficam
 *         juntas (na ordem da 1ª que aparece), as colunas do grupo só na 1ª linha (como a tabela
 *         dinâmica da planilha) e a paginação conta grupos. CSV e "Copiar tabela" repetem tudo.
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
 * Colunas ocultas só saem da tela: CSV e "Copiar tabela" continuam com todas.
 */
export function criarTabela(opcoes) {
  const {
    colunas, titulo, porPagina = 50, pesquisa = true, nomeArquivo = 'tabela.csv', rodape, vazio = 'Nada para mostrar.',
    aoClicarLinha, aoDuploClique, classeLinha, grupo, caberNaLargura = false, escolherColunas = false,
  } = opcoes;
  const pesquisaveis = exportaveis(colunas);
  const idTabela = novoId('tab');
  const chaveLarguras = `larguras:${nomeArquivo}`;
  const larguras = lerLarguras(chaveLarguras);
  const estiloLarguras = el('style');
  const estiloOcultas = el('style');
  const estiloAjuste = el('style'); // depois das larguras salvas: vence a regra de mesmo peso
  const estado = { linhas: opcoes.linhas ?? [], termo: '', pagina: 0, ordem: opcoes.ordem ?? null };

  const idPesquisa = novoId('pesq');
  const campoPesquisa = pesquisa ? el('input', {
    type: 'search', id: idPesquisa, class: 'campo', placeholder: 'Pesquisar na tabela',
    'aria-label': `Pesquisar em ${titulo}`,
    oninput: (ev) => { estado.termo = normalizar(ev.target.value); estado.pagina = 0; render(); },
  }) : null;
  const contagem = el('span', { class: 'tabela-contagem', 'aria-live': 'polite' });
  const botaoCsv = exportacao.csv ? el('button', {
    type: 'button', class: 'botao botao-sec botao-pequeno',
    onclick: () => baixar(nomeArquivo, gerarCsv(colunas, linhasVisiveis())),
  }, 'Exportar CSV') : null;
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
        alcaDeLargura(c),
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

  // --- Larguras das colunas ---
  const MIN_LARGURA = 40;
  let ultimaAjustada = null; // a que a pessoa acabou de mudar não encolhe no "caber na largura"
  const indice = new Map(colunas.map((c, i) => [c, i]));

  /** Regras de largura fixa (uma por coluna ajustada), só desta tabela. */
  function aplicarLarguras() {
    estiloLarguras.textContent = colunas.filter((c) => larguras.has(c.id)).map((c) => {
      const w = larguras.get(c.id);
      return `[data-tabela="${idTabela}"] .c-${indice.get(c)} { width: ${w}px; min-width: ${w}px; max-width: ${w}px; overflow: hidden; text-overflow: ellipsis; }`;
    }).join(' ');
    botaoLarguras.hidden = !larguras.size;
    pedirAjuste();
  }

  function mudarLargura(c, px) {
    ultimaAjustada = px === null ? null : c.id;
    if (px === null) larguras.delete(c.id);
    else larguras.set(c.id, Math.max(MIN_LARGURA, Math.round(px)));
    aplicarLarguras();
  }

  const guardarLarguras = () => salvarPreferencia(chaveLarguras, JSON.stringify(Object.fromEntries(larguras)));

  /** Largura que cabe o maior conteúdo da coluna na página atual (cabeçalho numa linha só). */
  function larguraDoConteudo(c) {
    const classe = `c-${indice.get(c)}`;
    const faixa = document.createRange();
    const medir = (no) => {
      faixa.selectNodeContents(no);
      const est = getComputedStyle(no);
      return faixa.getBoundingClientRect().width + parseFloat(est.paddingLeft) + parseFloat(est.paddingRight);
    };
    let maior = 0;
    for (const td of corpo.querySelectorAll(`td.${classe}`)) if (td.childNodes.length) maior = Math.max(maior, medir(td));
    const botao = cabeca.querySelector(`th.${classe} .th-botao`);
    if (botao) {
      botao.style.whiteSpace = 'nowrap';
      maior = Math.max(maior, medir(botao));
      botao.style.whiteSpace = '';
    }
    return Math.ceil(maior) + 2; // borda e arredondamento: sem reticências por 1 px
  }

  /** Borda direita do cabeçalho: arrastar, setas (10 px; Shift = 50 px), dois cliques = autoajuste. */
  function alcaDeLargura(c) {
    const th = () => alca.parentElement;
    const atual = () => larguras.get(c.id) ?? th().getBoundingClientRect().width;
    const alca = el('span', {
      class: 'th-alca', role: 'separator', 'aria-orientation': 'vertical', tabindex: '0',
      'aria-label': `Largura da coluna ${c.rotulo}: arraste ou use as setas; dois cliques ajustam ao conteúdo`,
      title: 'Arraste para mudar a largura. Dois cliques: ajusta ao conteúdo.',
      onclick: (ev) => ev.stopPropagation(),
      ondblclick: (ev) => { ev.stopPropagation(); mudarLargura(c, larguraDoConteudo(c)); guardarLarguras(); },
      onkeydown: (ev) => {
        if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
        ev.preventDefault();
        const passo = (ev.shiftKey ? 50 : 10) * (ev.key === 'ArrowLeft' ? -1 : 1);
        mudarLargura(c, atual() + passo);
        guardarLarguras();
      },
      onpointerdown: (ev) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        const inicioX = ev.clientX;
        const inicioL = atual();
        alca.setPointerCapture(ev.pointerId);
        alca.classList.add('arrastando');
        const mover = (e) => mudarLargura(c, inicioL + e.clientX - inicioX);
        const soltar = () => {
          alca.removeEventListener('pointermove', mover);
          alca.classList.remove('arrastando');
          guardarLarguras();
        };
        alca.addEventListener('pointermove', mover);
        alca.addEventListener('pointerup', soltar, { once: true });
        alca.addEventListener('pointercancel', soltar, { once: true });
      },
    });
    return alca;
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
        onclick: aoClicarLinha ? () => aoClicarLinha(l) : null,
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

    substituir(paginacao, paginas > 1 ? [
      el('button', {
        type: 'button', class: 'botao botao-sec botao-pequeno', disabled: estado.pagina === 0,
        onclick: () => { estado.pagina--; render(); },
      }, 'Anterior'),
      el('span', {}, `${inicio + 1}–${Math.min(inicio + porPagina, grupos.length)} de ${grupo ? plural(grupos.length, grupo.nome) : grupos.length}`),
      el('button', {
        type: 'button', class: 'botao botao-sec botao-pequeno', disabled: estado.pagina >= paginas - 1,
        onclick: () => { estado.pagina++; render(); },
      }, 'Próxima'),
    ] : []);
    pedirAjuste();
  }

  const botaoLarguras = el('button', {
    type: 'button', class: 'botao-link botao-pequeno', title: 'Volta todas as colunas à largura automática',
    onclick: () => { larguras.clear(); aplicarLarguras(); guardarLarguras(); },
  }, 'Larguras originais');

  // --- Colunas ocultas ---
  const chaveOcultas = `colunas-ocultas:${nomeArquivo}`;
  const escolhiveis = colunas.filter((c) => !c.controle);
  let ocultas = new Set(lerLista(chaveOcultas).filter((id) => escolhiveis.some((c) => c.id === id)));
  function aplicarOcultas() {
    estiloOcultas.textContent = colunas.filter((c) => ocultas.has(c.id))
      .map((c) => `[data-tabela="${idTabela}"] .c-${indice.get(c)} { display: none; }`).join(' ');
    pedirAjuste();
  }
  // Lista de marcar: marcado = visível; nada marcado na lista = todas (como os filtros).
  const visiveis = new Set(ocultas.size ? escolhiveis.map((c) => c.id).filter((id) => !ocultas.has(id)) : []);
  const botaoColunas = escolherColunas ? listaDeMarcar({
    id: 'colunas', rotulo: 'Colunas', valores: escolhiveis.map((c) => c.id),
    rotuloValor: (id) => escolhiveis.find((c) => c.id === id).rotulo,
    resumoVarios: (n) => { const k = escolhiveis.length - n; return k === 1 ? '1 oculta' : `${k} ocultas`; },
    selecionados: visiveis,
    aoMudar: (novo) => {
      ocultas = new Set(novo.size ? escolhiveis.map((c) => c.id).filter((id) => !novo.has(id)) : []);
      salvarPreferencia(chaveOcultas, JSON.stringify([...ocultas]));
      aplicarOcultas();
    },
  }) : null;

  // --- Caber na largura ---
  const rolagem = el('div', { class: 'tabela-rolagem' }, tabela);
  const LARGURA_MINIMA_TEXTO = 56;
  let ajustePendente = false;
  function pedirAjuste() {
    if (!caberNaLargura || ajustePendente) return;
    ajustePendente = true;
    // Microtarefa: roda depois de a tela pôr a tabela no documento (e funciona com a aba em segundo plano).
    queueMicrotask(() => { ajustePendente = false; caber(); });
  }
  /** Encolhem só as de texto que aceitam reticências (texto-longo/medio) e as com largura salva. */
  const encolhivel = (c) => c.id !== ultimaAjustada && (larguras.has(c.id)
    || /texto-(longo|medio)/.test((estado.linhas[0] && c.classe?.(estado.linhas[0])) || ''));
  /** Mede as colunas sem ajuste; se passam da área, encolhe as de texto na proporção. */
  function caber() {
    estiloAjuste.textContent = '';
    if (!rolagem.isConnected) return;
    const disponivel = rolagem.clientWidth;
    if (!disponivel || tabela.offsetWidth <= disponivel + 1) return;
    const medidas = colunas.filter((c) => !ocultas.has(c.id)).map((c) => {
      const th = cabeca.querySelector(`th.c-${indice.get(c)}`);
      const largura = th ? th.getBoundingClientRect().width : 0;
      return { c, largura, encolhe: encolhivel(c) && largura > LARGURA_MINIMA_TEXTO };
    });
    const fixa = medidas.filter((m) => !m.encolhe).reduce((s, m) => s + m.largura, 0);
    const encolhiveis = medidas.filter((m) => m.encolhe);
    const soma = encolhiveis.reduce((s, m) => s + m.largura, 0);
    if (!soma) return;
    const fator = Math.max(0, disponivel - fixa - 2) / soma;
    estiloAjuste.textContent = encolhiveis.map(({ c, largura }) => {
      const w = Math.max(LARGURA_MINIMA_TEXTO, Math.floor(largura * fator));
      return `[data-tabela="${idTabela}"] .c-${indice.get(c)} { width: ${w}px; min-width: 0; max-width: ${w}px; overflow: hidden; text-overflow: ellipsis; }`;
    }).join(' ');
  }
  if (caberNaLargura && typeof ResizeObserver === 'function') {
    let larguraAnterior = 0;
    const observador = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      if (w !== larguraAnterior) { larguraAnterior = w; pedirAjuste(); }
    });
    observador.observe(rolagem);
    rolagem.observadorLargura = observador; // referência viva enquanto a tabela existir
  }

  aplicarLarguras();
  aplicarOcultas();

  const elemento = el('div', { class: 'tabela-bloco' },
    estiloLarguras, estiloOcultas, estiloAjuste,
    el('div', { class: 'tabela-barra' }, campoPesquisa, contagem, botaoLarguras, botaoColunas, botaoCopiar, botaoCsv),
    rolagem,
    paginacao);
  render();

  return {
    elemento,
    /** Troca as linhas. `manterPagina`: fica na mesma página (ex.: ao ocultar uma SC da lista). */
    atualizar(linhas, { manterPagina = false } = {}) {
      estado.linhas = linhas;
      if (!manterPagina) estado.pagina = 0;
      render();
    },
  };
}

/** Lista salva (JSON); armazenamento bloqueado ou estragado = vazia. */
function lerLista(chave) {
  try {
    const lista = JSON.parse(lerPreferencia(chave, '[]'));
    return Array.isArray(lista) ? lista.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

/** Larguras salvas ({ idColuna: px }); armazenamento bloqueado ou estragado = nenhuma. */
function lerLarguras(chave) {
  try {
    const obj = JSON.parse(lerPreferencia(chave, '{}')) ?? {};
    return new Map(Object.entries(obj).filter(([, px]) => Number.isFinite(px) && px > 0));
  } catch { return new Map(); }
}
