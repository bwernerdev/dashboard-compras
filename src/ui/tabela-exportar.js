// Saída das tabelas (ui/tabela.js): texto das células, texto para colar no Excel, baixar e copiar.
// A planilha do "Exportar Excel" fica em tabela-xlsx.js.
import { el } from './dom.js';
import { formatarSerie } from '../datas.js';

/** Texto de uma célula para pesquisa e para a tela. */
export function textoDaCelula(col, linha) {
  const v = col.valor(linha);
  if (v === null || v === undefined || v === '') return '';
  if (col.tipo === 'data') return typeof v === 'number' ? formatarSerie(v) : String(v); // data digitada como texto fica como veio
  return col.formato ? col.formato(v) : String(v);
}

/** Colunas que vão para o Excel, "Copiar tabela" e pesquisa (não as de controle, como o olho). */
export const exportaveis = (colunas) => colunas.filter((c) => !c.controle);

/** Valor para o Excel em pt-BR: data dd/mm/aaaa, número com vírgula decimal e sem separador de milhar. */
function valorDeSaida(col, linha) {
  const v = col.valor(linha);
  if (v === null || v === undefined) return '';
  if (col.tipo === 'data' && typeof v === 'number') return formatarSerie(v);
  if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6).replace('.', ',');
  return v;
}

/** Texto para colar no Excel: tabulação entre colunas, vírgula decimal, sem separador de milhar. */
export function gerarTsv(todas, linhas) {
  const colunas = exportaveis(todas);
  const campo = (v) => String(v ?? '').replace(/[\t\r\n]+/g, ' ');
  return [colunas.map((c) => campo(c.rotulo)).join('\t'),
    ...linhas.map((l) => colunas.map((c) => campo(valorDeSaida(c, l))).join('\t'))].join('\r\n');
}

/** Baixa um arquivo gerado na hora. */
export function baixar(nome, conteudo, tipo) {
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
  let ok;
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

/** "Exportar Excel" só onde download funciona (no quadro do SharePoint não: painel/painel.js desliga). */
const exportacao = { arquivo: true };
export function definirExportacao({ arquivo }) { exportacao.arquivo = arquivo; }
export const podeExportar = () => exportacao.arquivo;
