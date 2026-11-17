// Caixas de importação das bases do ME e do anexo de contratos (escolher ou arrastar o arquivo).
// Usadas na tela vazia e no diálogo "Atualizar bases".
import { el } from '../ui/dom.js';
import * as fmt from '../ui/formatos.js';

const ARQUIVOS = [
  { tipo: 'base', titulo: 'Base', dica: 'base.xlsx (Relatório de Requisição - Friboi V2)', vazio: 'Escolha ou arraste o arquivo' },
  { tipo: 'followUp', titulo: 'Follow-Up', dica: 'Follow-Up.xlsx (Follow-up - Friboi)', vazio: 'Opcional: sem ele, a aba Entrega fica vazia' },
  { tipo: 'contratos', titulo: 'Contratos (anexo)', dica: 'CONTROLE DE CONTRATOS.xlsx', vazio: 'Opcional: abre na janela Contratos (botão no topo)' },
];

const TIPOS_XLSX = [{
  description: 'Planilha do Excel (.xlsx)',
  accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
}];

/**
 * Escolher arquivo pelo seletor do navegador com um `id` por tipo (Chrome e Edge): cada caixa abre na
 * pasta da última importação daquele tipo (Base de um lugar, Follow-Up de outro, Contratos de outro).
 * A página nunca vê o caminho; quem lembra a pasta é o navegador. Sem o recurso (outros navegadores):
 * null, e vale o seletor comum do <input type="file">. Cancelar: undefined.
 * Escolheu: { arquivo, alca } (alca: referência ao arquivo no disco, para "Reimportar bases" ler de novo).
 */
export async function escolherComPastaLembrada(tipo) {
  if (typeof window.showOpenFilePicker !== 'function') return null;
  try {
    const [alca] = await window.showOpenFilePicker({ id: `importar-${tipo}`, types: TIPOS_XLSX, multiple: false });
    return { arquivo: await alca.getFile(), alca };
  } catch (erro) {
    return erro?.name === 'AbortError' ? undefined : null;
  }
}

/** Texto de situação de uma base já carregada. */
export function situacaoDaBase(dados) {
  if (!dados) return null;
  const m = dados.meta;
  const quando = dados.salvoEm ? new Date(dados.salvoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;
  const linhas = m.tipo === 'contratos'
    ? `${fmt.inteiro(m.linhas)} linhas em ${Object.keys(dados.abas).length} abas`
    : `${fmt.inteiro(dados.registros.length)} linhas das filiais do de-para`;
  return `${m.arquivo ?? 'arquivo'}: ${linhas}${quando ? ` · importado em ${quando}` : ''}`;
}

/**
 * estado: { base?, followUp?, contratos? } (dados atuais, para mostrar a situação).
 * aoImportar(tipo, arquivo, aoAvancar, alca) -> Promise (rejeita com a mensagem de erro). alca: referência
 * ao arquivo no disco (seletor do navegador ou arrastar, Chrome/Edge), ou null (seletor comum).
 */
export function caixasDeImportacao({ estado, aoImportar }) {
  return el('section', { class: 'importacao', 'aria-label': 'Arquivos do ME' }, ARQUIVOS.map((a) => {
    const situacao = situacaoDaBase(estado[a.tipo]);
    const status = el('span', { class: 'arquivo-status', 'aria-live': 'polite' },
      situacao ?? a.vazio);
    const barra = el('progress', { max: '1', value: '0', hidden: true });
    const entrada = el('input', { type: 'file', accept: '.xlsx', dataset: { tipo: a.tipo } });
    const caixa = el('label', { class: 'arquivo', dataset: { tipo: a.tipo, estado: situacao ? 'ok' : '' } },
      el('span', { class: 'arquivo-titulo' }, a.titulo),
      el('span', { class: 'arquivo-dica' }, a.dica),
      entrada, status, barra);

    const carregar = async (arquivo, alca = null) => {
      caixa.dataset.estado = 'lendo';
      status.textContent = `Lendo ${arquivo.name}...`;
      barra.hidden = false;
      barra.value = 0;
      try {
        const dados = await aoImportar(a.tipo, arquivo, (fracao, fase) => {
          barra.value = fracao;
          status.textContent = `${fase}: ${Math.round(fracao * 100)}%`;
        }, alca);
        caixa.dataset.estado = 'ok';
        status.textContent = `${situacaoDaBase(dados)} · ${(dados.meta.duracaoMs / 1000).toFixed(1)} s`;
      } catch (erro) {
        caixa.dataset.estado = 'erro';
        status.textContent = erro.message;
      } finally {
        barra.hidden = true;
        entrada.value = '';
      }
    };

    entrada.addEventListener('change', () => { if (entrada.files[0]) carregar(entrada.files[0]); });
    // Clique na caixa: seletor com a pasta lembrada por tipo; se o navegador não tiver, segue o comum.
    let seletorComum = false;
    entrada.addEventListener('click', async (ev) => {
      if (seletorComum || typeof window.showOpenFilePicker !== 'function') { seletorComum = false; return; }
      ev.preventDefault();
      const escolhido = await escolherComPastaLembrada(a.tipo);
      if (escolhido) carregar(escolhido.arquivo, escolhido.alca);
      else if (escolhido === null) { seletorComum = true; entrada.click(); }
    });
    caixa.addEventListener('dragover', (ev) => { ev.preventDefault(); caixa.classList.add('arrastando'); });
    caixa.addEventListener('dragleave', () => caixa.classList.remove('arrastando'));
    caixa.addEventListener('drop', (ev) => {
      ev.preventDefault();
      caixa.classList.remove('arrastando');
      const arquivo = ev.dataTransfer.files[0];
      if (!arquivo) return;
      // Arrastar também dá a referência ao arquivo (Chrome/Edge); pedida ainda dentro do evento.
      const item = ev.dataTransfer.items?.[0];
      const pedido = typeof item?.getAsFileSystemHandle === 'function' ? item.getAsFileSystemHandle().catch(() => null) : Promise.resolve(null);
      pedido.then((alca) => carregar(arquivo, alca?.kind === 'file' ? alca : null));
    });
    return caixa;
  }));
}
