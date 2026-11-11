// Tela da fase 1: importa as duas bases e mostra um resumo para conferência.
// As telas Regional, Compradores e Saving entram na fase 2.

import { importarNoWorker } from './importacao.js';
import { hojeSerie, formatarSerie } from './datas.js';
import { ERRO_ND } from './regras.js';

const estado = { base: null, followUp: null };
const inteiro = new Intl.NumberFormat('pt-BR');

function cartao(rotulo, valor, detalhe = '') {
  return `<div class="cartao"><div class="cartao-rotulo">${rotulo}</div>`
    + `<div class="cartao-valor">${valor}</div><div class="cartao-detalhe">${detalhe}</div></div>`;
}

const escapar = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ouTraco = (v) => (v === null || v === undefined || v === '' ? '-' : v);

function periodo(meta) {
  const g = meta.dadosGerais;
  return g.inicio ? `${formatarSerie(g.inicio)} a ${formatarSerie(g.fim)}` : 'período não informado';
}

function renderizarResumo() {
  const el = document.getElementById('resumo');
  const partes = [];
  for (const [tipo, rotulo] of [['base', 'Base'], ['followUp', 'Follow-Up']]) {
    const r = estado[tipo];
    if (!r) continue;
    const m = r.meta;
    partes.push(cartao(`${rotulo}: linhas das 26 filiais`, inteiro.format(m.mantidas),
      `${inteiro.format(m.lidas)} lidas, ${inteiro.format(m.descartadas)} de outras filiais · ${periodo(m)} · ${(m.duracaoMs / 1000).toFixed(1)} s`));
  }
  if (estado.base) {
    const regs = estado.base.registros;
    const abertos = regs.filter((r) => r.diasEmAberto !== null);
    const scsAbertas = new Set(abertos.map((r) => r.solicitacao)).size;
    const noPrazo = regs.filter((r) => r.sla === 'No Prazo').length;
    const fora = regs.filter((r) => r.sla === 'Fora do Prazo').length;
    const semSla = regs.filter((r) => r.sla === ERRO_ND).length;
    const spend = regs.reduce((s, r) => s + (r.totalPedidoComImpostos ?? 0), 0);
    const economia = regs.reduce((s, r) => s + r.savingReal, 0);
    partes.push(cartao('SCs em aberto', inteiro.format(scsAbertas), `${inteiro.format(abertos.length)} itens sem pedido e não cancelados`));
    partes.push(cartao('SLA no prazo', noPrazo + fora ? `${Math.round((noPrazo / (noPrazo + fora)) * 100)}%` : '-',
      `${inteiro.format(noPrazo)} no prazo, ${inteiro.format(fora)} fora${semSla ? `, ${semSla} sem prazo (#N/D)` : ''}`));
    partes.push(cartao('Spend (pedido c/ impostos)', spend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })));
    partes.push(cartao('Economia (Saving Real)', economia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })));
    renderizarPrevia(abertos);
  }
  el.innerHTML = partes.join('');
  el.hidden = partes.length === 0;
}

function renderizarPrevia(abertos) {
  const linhas = [...abertos].sort((a, b) => b.diasEmAberto - a.diasEmAberto).slice(0, 200);
  const classeSla = (s) => (s === 'No Prazo' ? 'sla-ok' : s === 'Fora do Prazo' ? 'sla-fora' : s === ERRO_ND ? 'sla-erro' : '');
  document.getElementById('previa-linhas').innerHTML = linhas.map((r) => `<tr>
    <td class="num">${r.diasEmAberto}</td><td>${escapar(r.sc)}</td><td>${formatarSerie(r.data)}</td>
    <td>${escapar(r.prioridade)}</td><td>${escapar(r.status)}</td><td>${escapar(r.nomeFilial)}</td>
    <td>${escapar(r.regional)}</td><td>${escapar(ouTraco(r.comprador))}</td>
    <td class="${classeSla(r.sla)}">${escapar(ouTraco(r.sla))}</td></tr>`).join('');
  document.getElementById('previa').hidden = linhas.length === 0;
}

async function carregar(tipo, arquivo, caixa) {
  const status = caixa.querySelector('.arquivo-status');
  const barra = caixa.querySelector('progress');
  caixa.dataset.estado = 'lendo';
  status.textContent = `Lendo ${arquivo.name}...`;
  barra.hidden = false;
  barra.value = 0;
  try {
    const resultado = await importarNoWorker(tipo, arquivo, {
      hoje: hojeSerie(),
      aoAvancar(fracao, fase) {
        barra.value = fracao;
        status.textContent = `${fase}: ${Math.round(fracao * 100)}%`;
      },
    });
    estado[tipo] = resultado;
    caixa.dataset.estado = 'ok';
    status.textContent = `${arquivo.name}: ${inteiro.format(resultado.meta.mantidas)} linhas em ${(resultado.meta.duracaoMs / 1000).toFixed(1)} s`;
    renderizarResumo();
  } catch (erro) {
    caixa.dataset.estado = 'erro';
    status.textContent = erro.message;
  } finally {
    barra.hidden = true;
  }
}

for (const caixa of document.querySelectorAll('.arquivo')) {
  const tipo = caixa.dataset.tipo;
  const entrada = caixa.querySelector('input');
  entrada.addEventListener('change', () => {
    if (entrada.files[0]) carregar(tipo, entrada.files[0], caixa);
  });
  caixa.addEventListener('dragover', (ev) => { ev.preventDefault(); caixa.classList.add('arrastando'); });
  caixa.addEventListener('dragleave', () => caixa.classList.remove('arrastando'));
  caixa.addEventListener('drop', (ev) => {
    ev.preventDefault();
    caixa.classList.remove('arrastando');
    const arquivo = ev.dataTransfer.files[0];
    if (arquivo) carregar(tipo, arquivo, caixa);
  });
}
