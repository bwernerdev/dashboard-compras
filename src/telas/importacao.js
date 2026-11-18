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
  const alca = await escolherAlca(tipo);
  if (!alca) return alca;
  try {
    return { arquivo: await alca.getFile(), alca };
  } catch {
    return null;
  }
}

// O seletor do navegador falhou nesta página (recurso bloqueado ou arquivo que ele não entrega, como
// pasta de rede no Citrix): daqui em diante as caixas usam o seletor comum, que lê o arquivo direto.
let seletorDoNavegadorFalhou = false;

/** Só a escolha: referência ao arquivo, undefined se cancelou, null sem o recurso ou se ele falhou. */
async function escolherAlca(tipo) {
  if (seletorDoNavegadorFalhou || typeof window.showOpenFilePicker !== 'function') return null;
  try {
    const [alca] = await window.showOpenFilePicker({ id: `importar-${tipo}`, types: TIPOS_XLSX, multiple: false });
    return alca;
  } catch (erro) {
    if (erro?.name === 'AbortError') return undefined;
    seletorDoNavegadorFalhou = true;
    return null;
  }
}

/** Se o navegador demorar para entregar o arquivo escolhido: avisa e passa ao seletor comum no próximo clique. */
const AVISO_DEMORA_MS = 10_000;

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

    // Referência escolhida no seletor do navegador: mostra que está abrindo já (a barra corre sem
    // porcentagem) e só então pede o arquivo. Pasta de rede pode demorar ou falhar aqui; antes a
    // caixa ficava sem nenhum sinal.
    let rodada = 0; // escolha mais recente: um getFile() atrasado não importa por cima de outra escolha
    const carregarDaAlca = async (alca) => {
      const minha = ++rodada;
      caixa.dataset.estado = 'lendo';
      status.textContent = `Abrindo ${alca.name}...`;
      barra.hidden = false;
      barra.removeAttribute('value');
      const aviso = setTimeout(() => {
        seletorDoNavegadorFalhou = true; // parado (pasta de rede no Citrix): o próximo clique usa o seletor comum
        status.textContent = `Abrindo ${alca.name}... O navegador está demorando para entregar o arquivo. Se não andar, clique de novo para escolher pelo seletor comum ou copie o arquivo para uma pasta do computador.`;
      }, AVISO_DEMORA_MS);
      let arquivo;
      try {
        arquivo = await alca.getFile();
      } catch (erro) {
        seletorDoNavegadorFalhou = true;
        if (minha !== rodada) return;
        caixa.dataset.estado = 'erro';
        barra.hidden = true;
        status.textContent = `O navegador não entregou o arquivo ${alca.name}${erro?.name ? ` (${erro.name})` : ''}. Clique de novo para escolher pelo seletor comum, arraste o arquivo para cá ou copie para uma pasta do computador.`;
        return;
      } finally {
        clearTimeout(aviso);
      }
      if (minha === rodada) await carregar(arquivo, alca);
    };

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

    entrada.addEventListener('change', () => { if (entrada.files[0]) { rodada++; carregar(entrada.files[0]); } });
    // Clique na caixa: seletor com a pasta lembrada por tipo; se o navegador não tiver, segue o comum.
    let seletorComum = false;
    entrada.addEventListener('click', async (ev) => {
      if (caixa.dataset.estado === 'lendo' && !seletorDoNavegadorFalhou) { ev.preventDefault(); return; } // já importando
      if (seletorComum || seletorDoNavegadorFalhou || typeof window.showOpenFilePicker !== 'function') { seletorComum = false; return; }
      ev.preventDefault();
      const alca = await escolherAlca(a.tipo);
      if (alca) carregarDaAlca(alca);
      else if (alca === null) {
        // O seletor do navegador deu erro. O seletor comum aberto daqui pode ser barrado (o clique já
        // foi usado): se não abrir, o aviso pede outro clique, que já vai direto ao seletor comum.
        caixa.dataset.estado = 'erro';
        status.textContent = 'O seletor de arquivos do navegador não abriu. Clique de novo para escolher o arquivo.';
        seletorComum = true;
        entrada.click();
      }
    });
    caixa.addEventListener('dragover', (ev) => { ev.preventDefault(); caixa.classList.add('arrastando'); });
    caixa.addEventListener('dragleave', () => caixa.classList.remove('arrastando'));
    caixa.addEventListener('drop', (ev) => {
      ev.preventDefault();
      caixa.classList.remove('arrastando');
      const arquivo = ev.dataTransfer.files[0];
      if (!arquivo) return;
      rodada++;
      // Arrastar também dá a referência ao arquivo (Chrome/Edge); pedida ainda dentro do evento.
      const item = ev.dataTransfer.items?.[0];
      const pedido = typeof item?.getAsFileSystemHandle === 'function' ? item.getAsFileSystemHandle().catch(() => null) : Promise.resolve(null);
      pedido.then((alca) => carregar(arquivo, alca?.kind === 'file' ? alca : null));
    });
    return caixa;
  }));
}
