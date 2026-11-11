// Tabela com ordenação por coluna, pesquisa, paginação, linha de total, "Copiar tabela" e exportação CSV.
import { el, substituir, novoId } from './dom.js';
import { formatarSerie } from '../datas.js';

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
 *            controle?: bool (coluna de botão: sem ordenar, fora do CSV, do "Copiar" e da pesquisa;
 *            o rótulo só para leitor de tela) }]
 * opções: titulo (legenda acessível), ordem { coluna, desc }, porPagina, pesquisa, nomeArquivo,
 *         rodape(linhas) -> [texto por coluna], vazio (texto sem linhas, ou função que o devolve), aoClicarLinha(linha),
 *         aoDuploClique(linha), classeLinha(linha) -> string,
 *         grupo { chave(linha), colunas: [ids], nome: ['SC', 'SCs'] }: linhas da mesma chave ficam
 *         juntas (na ordem da 1ª que aparece), as colunas do grupo só na 1ª linha (como a tabela
 *         dinâmica da planilha) e a paginação conta grupos. CSV e "Copiar tabela" repetem tudo.
 */
export function criarTabela(opcoes) {
  const {
    colunas, titulo, porPagina = 50, pesquisa = true, nomeArquivo = 'tabela.csv', rodape, vazio = 'Nada para mostrar.',
    aoClicarLinha, aoDuploClique, classeLinha, grupo,
  } = opcoes;
  const pesquisaveis = exportaveis(colunas);
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
  const tabela = el('table', { class: 'tabela' }, el('caption', { class: 'so-leitor' }, titulo), cabeca, corpo, pe);
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
    return [c.num ? 'num' : '', c.centro ? 'centro' : '', c.controle ? 'col-controle' : ''].join(' ').trim() || null;
  }

  const plural = (n, [um, varios]) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;
  const NOME_LINHA = ['linha', 'linhas'];

  /** Coluna do grupo fora da 1ª linha: vazia (e sem cor), a não ser que o valor mude dentro do grupo. */
  const ocultaNoGrupo = (c, l, primeira) => grupo && primeira !== l && grupo.colunas.includes(c.id)
    && textoDaCelula(c, l) === textoDaCelula(c, primeira);

  function td(c, l, primeira) {
    const oculta = ocultaNoGrupo(c, l, primeira);
    return el('td', {
      class: [classeColuna(c) ?? '', oculta ? '' : (c.classe?.(l) ?? '')].join(' ').trim() || null,
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

    substituir(corpo, pagina.length ? pagina.flatMap((g) => g.map((l, i) => el('tr', {
      class: [aoClicarLinha ? 'clicavel' : '', grupo && i === 0 ? 'grupo-inicio' : '', grupo && i < g.length - 1 ? 'grupo-continua' : '', classeLinha?.(l) ?? ''].join(' ').trim() || null,
      onclick: aoClicarLinha ? () => aoClicarLinha(l) : null,
      ondblclick: aoDuploClique ? (e) => { if (!e.target.closest('button, a, input')) aoDuploClique(l); } : null,
    }, colunas.map((c) => td(c, l, g[0]))))) : el('tr', {}, el('td', { colspan: colunas.length, class: 'tabela-vazia' }, typeof vazio === 'function' ? vazio() : vazio)));

    if (rodape && linhas.length) {
      const totais = rodape(linhas);
      substituir(pe, el('tr', {}, colunas.map((c, i) => el('td', { class: classeColuna(c) }, totais[i] ?? ''))));
    } else substituir(pe);

    const filtrado = linhas.length !== estado.linhas.length;
    if (grupo) {
      const total = filtrado ? ` (de ${plural(agrupar(estado.linhas).length, grupo.nome)})` : '';
      contagem.textContent = `${plural(grupos.length, grupo.nome)}, ${plural(linhas.length, ['item', 'itens'])}${total}`;
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
  }

  const elemento = el('div', { class: 'tabela-bloco' },
    el('div', { class: 'tabela-barra' }, campoPesquisa, contagem, botaoCopiar, botaoCsv),
    el('div', { class: 'tabela-rolagem' }, tabela),
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
