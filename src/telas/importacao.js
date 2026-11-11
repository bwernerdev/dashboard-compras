// Caixas de importação das duas bases (escolher ou arrastar o arquivo).
// Usadas na tela vazia e no diálogo "Atualizar bases".
import { el } from '../ui/dom.js';
import * as fmt from '../ui/formatos.js';

const ARQUIVOS = [
  { tipo: 'base', titulo: 'Base', dica: 'base.xlsx (Relatório de Requisição - Friboi V2)', obrigatorio: true },
  { tipo: 'followUp', titulo: 'Follow-Up', dica: 'Follow-Up.xlsx (Follow-up - Friboi)', obrigatorio: false },
];

/** Texto de situação de uma base já carregada. */
export function situacaoDaBase(dados) {
  if (!dados) return null;
  const m = dados.meta;
  const quando = dados.salvoEm ? new Date(dados.salvoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;
  return `${m.arquivo ?? 'arquivo'}: ${fmt.inteiro(dados.registros.length)} linhas das filiais do de-para${quando ? ` · importado em ${quando}` : ''}`;
}

/**
 * estado: { base?, followUp? } (dados atuais, para mostrar a situação).
 * aoImportar(tipo, arquivo, aoAvancar) -> Promise (rejeita com a mensagem de erro).
 */
export function caixasDeImportacao({ estado, aoImportar }) {
  return el('section', { class: 'importacao', 'aria-label': 'Arquivos do ME' }, ARQUIVOS.map((a) => {
    const situacao = situacaoDaBase(estado[a.tipo]);
    const status = el('span', { class: 'arquivo-status', 'aria-live': 'polite' },
      situacao ?? (a.obrigatorio ? 'Escolha ou arraste o arquivo' : 'Opcional por enquanto: as telas atuais usam só a Base'));
    const barra = el('progress', { max: '1', value: '0', hidden: true });
    const entrada = el('input', { type: 'file', accept: '.xlsx', dataset: { tipo: a.tipo } });
    const caixa = el('label', { class: 'arquivo', dataset: { tipo: a.tipo, estado: situacao ? 'ok' : '' } },
      el('span', { class: 'arquivo-titulo' }, a.titulo),
      el('span', { class: 'arquivo-dica' }, a.dica),
      entrada, status, barra);

    const carregar = async (arquivo) => {
      caixa.dataset.estado = 'lendo';
      status.textContent = `Lendo ${arquivo.name}...`;
      barra.hidden = false;
      barra.value = 0;
      try {
        const dados = await aoImportar(a.tipo, arquivo, (fracao, fase) => {
          barra.value = fracao;
          status.textContent = `${fase}: ${Math.round(fracao * 100)}%`;
        });
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
    caixa.addEventListener('dragover', (ev) => { ev.preventDefault(); caixa.classList.add('arrastando'); });
    caixa.addEventListener('dragleave', () => caixa.classList.remove('arrastando'));
    caixa.addEventListener('drop', (ev) => {
      ev.preventDefault();
      caixa.classList.remove('arrastando');
      const arquivo = ev.dataTransfer.files[0];
      if (arquivo) carregar(arquivo);
    });
    return caixa;
  }));
}
