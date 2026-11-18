// Caixas de importação das bases do ME e do anexo de contratos (escolher ou arrastar o arquivo).
// Usadas na tela vazia e no diálogo "Atualizar bases".
import { el } from '../ui/dom.js';
import * as fmt from '../ui/formatos.js';

const ARQUIVOS = [
  { tipo: 'base', titulo: 'Base', dica: 'base.xlsx (Relatório de Requisição - Friboi V2)', vazio: 'Escolha ou arraste o arquivo' },
  { tipo: 'followUp', titulo: 'Follow-Up', dica: 'Follow-Up.xlsx (Follow-up - Friboi)', vazio: 'Opcional: sem ele, a aba Entrega fica vazia' },
  { tipo: 'contratos', titulo: 'Contratos (anexo)', dica: 'CONTROLE DE CONTRATOS.xlsx', vazio: 'Opcional: abre na janela Contratos (botão no topo)' },
];

// Clique na caixa: só o seletor comum do <input type="file">. O seletor do navegador com pasta lembrada
// por tipo (showOpenFilePicker, 17/11/2026) saiu em 18/11/2026: no Citrix, com arquivo de pasta de rede,
// ele não devolvia o arquivo e a importação não começava. Para "Reimportar bases", src/main.js guarda
// uma cópia do arquivo escolhido (clique ou arrastar).

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
 * aoImportar(tipo, arquivo, aoAvancar, sinal) -> Promise (rejeita com a mensagem de erro; "Cancelar" aborta o sinal).
 */
export function caixasDeImportacao({ estado, aoImportar }) {
  return el('section', { class: 'importacao', 'aria-label': 'Arquivos do ME' }, ARQUIVOS.map((a) => {
    const situacao = situacaoDaBase(estado[a.tipo]);
    const status = el('span', { class: 'arquivo-status', 'aria-live': 'polite' },
      situacao ?? a.vazio);
    const barra = el('progress', { max: '1', value: '0', hidden: true });
    // Nome próprio: o rótulo em volta também tem o botão Cancelar, que não deve entrar no nome do campo.
    const entrada = el('input', { type: 'file', accept: '.xlsx', 'aria-label': `${a.titulo}: ${a.dica}`, dataset: { tipo: a.tipo } });
    // Contratos é lido de uma vez, sem worker: não há o que cancelar.
    const cancelar = a.tipo === 'contratos' ? null
      : el('button', { type: 'button', class: 'botao botao-link arquivo-cancelar', hidden: true }, 'Cancelar');
    const caixa = el('label', { class: 'arquivo', dataset: { tipo: a.tipo, estado: situacao ? 'ok' : '' } },
      el('span', { class: 'arquivo-titulo' }, a.titulo),
      el('span', { class: 'arquivo-dica' }, a.dica),
      entrada, status, barra, cancelar);

    let controle = null; // AbortController da leitura em andamento; null = caixa livre
    cancelar?.addEventListener('click', (ev) => { ev.preventDefault(); controle?.abort(); });

    const carregar = async (arquivo) => {
      if (controle) return; // já lendo: o segundo arquivo não corre junto com o primeiro
      controle = new AbortController();
      caixa.dataset.estado = 'lendo';
      entrada.disabled = true;
      if (cancelar) cancelar.hidden = false;
      status.textContent = `Lendo ${arquivo.name}...`;
      barra.hidden = false;
      barra.value = 0;
      try {
        const dados = await aoImportar(a.tipo, arquivo, (fracao, fase) => {
          barra.value = fracao;
          status.textContent = `${fase}: ${Math.round(fracao * 100)}%`;
        }, controle.signal);
        caixa.dataset.estado = 'ok';
        status.textContent = `${situacaoDaBase(dados)} · ${(dados.meta.duracaoMs / 1000).toFixed(1)} s`;
      } catch (erro) {
        caixa.dataset.estado = 'erro';
        status.textContent = erro.message;
      } finally {
        controle = null;
        entrada.disabled = false;
        if (cancelar) cancelar.hidden = true;
        barra.hidden = true;
        entrada.value = '';
      }
    };

    entrada.addEventListener('change', () => { if (entrada.files[0]) carregar(entrada.files[0]); });
    caixa.addEventListener('dragover', (ev) => { ev.preventDefault(); if (!controle) caixa.classList.add('arrastando'); });
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
