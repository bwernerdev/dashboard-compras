// Tabela com ordenação por coluna, pesquisa, paginação, linha de total e exportação CSV.
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

/** CSV para o Excel em pt-BR: ";" como separador, vírgula decimal, BOM UTF-8. */
export function gerarCsv(colunas, linhas) {
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

function baixar(nome, conteudo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
  const a = el('a', { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * colunas: [{ id, rotulo, valor(linha), formato?(valor), tipo?: 'data', num?: bool,
 *            exibir?(linha) -> Node|texto, classe?(linha) -> string, titulo? }]
 * opções: titulo (legenda acessível), ordem { coluna, desc }, porPagina, pesquisa, nomeArquivo,
 *         rodape(linhas) -> [texto por coluna], vazio (texto sem linhas), aoClicarLinha(linha).
 */
export function criarTabela(opcoes) {
  const {
    colunas, titulo, porPagina = 50, pesquisa = true, nomeArquivo = 'tabela.csv', rodape, vazio = 'Nada para mostrar.',
    aoClicarLinha,
  } = opcoes;
  const estado = { linhas: opcoes.linhas ?? [], termo: '', pagina: 0, ordem: opcoes.ordem ?? null };

  const idPesquisa = novoId('pesq');
  const campoPesquisa = pesquisa ? el('input', {
    type: 'search', id: idPesquisa, class: 'campo', placeholder: 'Pesquisar na tabela',
    'aria-label': `Pesquisar em ${titulo}`,
    oninput: (ev) => { estado.termo = normalizar(ev.target.value); estado.pagina = 0; render(); },
  }) : null;
  const contagem = el('span', { class: 'tabela-contagem', 'aria-live': 'polite' });
  const botaoCsv = el('button', {
    type: 'button', class: 'botao botao-sec botao-pequeno',
    onclick: () => baixar(nomeArquivo, gerarCsv(colunas, linhasVisiveis())),
  }, 'Exportar CSV');

  const cabeca = el('thead');
  const corpo = el('tbody');
  const pe = el('tfoot');
  const tabela = el('table', { class: 'tabela' }, el('caption', { class: 'so-leitor' }, titulo), cabeca, corpo, pe);
  const paginacao = el('div', { class: 'paginacao' });

  function linhasVisiveis() {
    let linhas = estado.linhas;
    if (estado.termo) {
      linhas = linhas.filter((l) => colunas.some((c) => normalizar(textoDaCelula(c, l)).includes(estado.termo)));
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
      const ativa = estado.ordem?.coluna === c.id;
      const sort = ativa ? (estado.ordem.desc ? 'descending' : 'ascending') : 'none';
      return el('th', { scope: 'col', class: c.num ? 'num' : null, 'aria-sort': sort, title: c.titulo ?? null },
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

  function render() {
    renderCabecalho();
    const linhas = linhasVisiveis();
    const paginas = Math.max(1, Math.ceil(linhas.length / porPagina));
    estado.pagina = Math.min(estado.pagina, paginas - 1);
    const inicio = estado.pagina * porPagina;
    const pagina = linhas.slice(inicio, inicio + porPagina);

    substituir(corpo, pagina.length ? pagina.map((l) => el('tr', {
      class: aoClicarLinha ? 'clicavel' : null,
      onclick: aoClicarLinha ? () => aoClicarLinha(l) : null,
    }, colunas.map((c) => el('td', {
      class: [c.num ? 'num' : '', c.classe?.(l) ?? ''].join(' ').trim() || null,
    }, c.exibir ? c.exibir(l) : (textoDaCelula(c, l) || '-'))))) : el('tr', {}, el('td', { colspan: colunas.length, class: 'tabela-vazia' }, vazio)));

    if (rodape && linhas.length) {
      const totais = rodape(linhas);
      substituir(pe, el('tr', {}, colunas.map((c, i) => el('td', { class: c.num ? 'num' : null }, totais[i] ?? ''))));
    } else substituir(pe);

    contagem.textContent = linhas.length === estado.linhas.length
      ? `${linhas.length} linha${linhas.length === 1 ? '' : 's'}`
      : `${linhas.length} de ${estado.linhas.length} linhas`;

    substituir(paginacao, paginas > 1 ? [
      el('button', {
        type: 'button', class: 'botao botao-sec botao-pequeno', disabled: estado.pagina === 0,
        onclick: () => { estado.pagina--; render(); },
      }, 'Anterior'),
      el('span', {}, `${inicio + 1}–${Math.min(inicio + porPagina, linhas.length)} de ${linhas.length}`),
      el('button', {
        type: 'button', class: 'botao botao-sec botao-pequeno', disabled: estado.pagina >= paginas - 1,
        onclick: () => { estado.pagina++; render(); },
      }, 'Próxima'),
    ] : []);
  }

  const elemento = el('div', { class: 'tabela-bloco' },
    el('div', { class: 'tabela-barra' }, campoPesquisa, contagem, botaoCsv),
    el('div', { class: 'tabela-rolagem' }, tabela),
    paginacao);
  render();

  return {
    elemento,
    atualizar(linhas) { estado.linhas = linhas; estado.pagina = 0; render(); },
  };
}
