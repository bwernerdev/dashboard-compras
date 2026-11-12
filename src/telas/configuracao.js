// Diálogo "Configuração": de-para de filiais e apelidos de compradores. O prazo do SLA é fixo
// (30 dias úteis, `PRAZO_SLA_DIAS` em regras.js).
// Fica salvo neste navegador (localStorage). A ordem das linhas importa: vale a primeira
// que bate, como o PROCV da planilha antiga.
import { el, substituir } from '../ui/dom.js';
import { CONFIG_PADRAO, normalizarCodigoFilial } from '../config/index.js';

const SECOES = [
  {
    id: 'filiais', titulo: 'Filiais', ajuda: 'Código como vem do ME (sem ponto). Linhas de filiais fora desta lista são descartadas na importação.',
    campos: [
      { id: 'codigo', rotulo: 'Código ME', largura: '8em' },
      { id: 'ajustada', rotulo: 'Filial', largura: '5em' },
      { id: 'nome', rotulo: 'Nome', largura: '10em' },
      { id: 'regional', rotulo: 'Regional', largura: '14em' },
      { id: 'descricao', rotulo: 'Descrição', largura: '22em' },
      { id: 'aprovadorGA', rotulo: 'Aprovador GA (nível 1)', largura: '12em' },
    ],
    nova: () => ({ codigo: '', ajustada: '', nome: '', regional: '', descricao: '', aprovadorGA: '' }),
  },
  {
    id: 'compradores', titulo: 'Compradores', ajuda: 'Nome completo depois de "FDS - " no "Selecionado por". Quem não está aqui aparece como "-".',
    campos: [
      { id: 'nome', rotulo: 'Nome completo', largura: '20em' },
      { id: 'apelido', rotulo: 'Apelido', largura: '10em' },
    ],
    nova: () => ({ nome: '', apelido: '' }),
  },
];

const copiar = (config) => JSON.parse(JSON.stringify(config));

/** Confere a configuração editada. Retorna lista de problemas (vazia = ok). */
export function validarConfig(config) {
  const erros = [];
  config.filiais.forEach((f, i) => {
    if (!normalizarCodigoFilial(f.codigo)) erros.push(`Filiais, linha ${i + 1}: falta o código.`);
    if (!String(f.ajustada ?? '').trim()) erros.push(`Filiais, linha ${i + 1}: falta a filial.`);
  });
  const codigos = config.filiais.map((f) => normalizarCodigoFilial(f.codigo)).filter(Boolean);
  const repetidos = [...new Set(codigos.filter((c, i) => codigos.indexOf(c) !== i))];
  if (repetidos.length) erros.push(`Filiais: código repetido (${repetidos.join(', ')}).`);
  config.compradores.forEach((c, i) => {
    if (!String(c.nome ?? '').trim() || !String(c.apelido ?? '').trim()) erros.push(`Compradores, linha ${i + 1}: preencha nome e apelido.`);
  });
  return erros;
}

function editorDeLista(secao, linhas) {
  const corpo = el('tbody');
  const desenhar = () => substituir(corpo, linhas.map((linha, i) => el('tr', {},
    secao.campos.map((c) => el('td', {}, el('input', {
      class: 'campo', type: c.numero ? 'number' : 'text', value: linha[c.id] ?? '', style: { width: c.largura },
      'aria-label': `${secao.titulo}, linha ${i + 1}, ${c.rotulo}`,
      oninput: (ev) => { linha[c.id] = c.numero ? (ev.target.value === '' ? NaN : Number(ev.target.value)) : ev.target.value; },
    }))),
    el('td', {}, el('button', {
      type: 'button', class: 'botao botao-link', 'aria-label': `Remover linha ${i + 1} de ${secao.titulo}`,
      onclick: () => { linhas.splice(i, 1); desenhar(); },
    }, 'Remover')))));
  desenhar();
  return el('section', { class: 'config-secao' },
    el('h3', {}, secao.titulo),
    el('p', { class: 'texto-fraco' }, secao.ajuda),
    el('div', { class: 'tabela-rolagem' },
      el('table', { class: 'tabela tabela-edicao' },
        el('thead', {}, el('tr', {}, secao.campos.map((c) => el('th', { scope: 'col' }, c.rotulo)), el('th', {}, el('span', { class: 'so-leitor' }, 'Ações')))),
        corpo)),
    el('button', {
      type: 'button', class: 'botao botao-sec botao-pequeno',
      onclick: () => { linhas.push(secao.nova()); desenhar(); corpo.lastElementChild?.querySelector('input')?.focus(); },
    }, `Adicionar em ${secao.titulo.split(' ')[0]}`));
}

/**
 * Abre o diálogo. config: configuração atual (objeto simples).
 * aoSalvar(novaConfig) e aoRestaurar() devolvem um texto de aviso (ou null).
 */
export function abrirConfiguracao({ config, personalizada, aoSalvar, aoRestaurar }) {
  const rascunho = copiar(config);
  const avisos = el('div', { class: 'config-avisos', role: 'alert' });
  const dialogo = el('dialog', { class: 'dialogo dialogo-largo', 'aria-labelledby': 'titulo-config' });

  const fechar = () => { dialogo.close(); dialogo.remove(); };
  const salvar = () => {
    const erros = validarConfig(rascunho);
    if (erros.length) {
      substituir(avisos, el('ul', {}, erros.map((e) => el('li', {}, e))));
      avisos.querySelector('li') && avisos.scrollIntoView({ block: 'nearest' });
      return;
    }
    const aviso = aoSalvar(copiar(rascunho));
    fechar();
    if (aviso) window.alert(aviso);
  };

  dialogo.append(
    el('header', { class: 'dialogo-cabecalho' },
      el('h2', { id: 'titulo-config' }, 'Configuração'),
      el('button', { type: 'button', class: 'botao botao-link', onclick: fechar, 'aria-label': 'Fechar configuração' }, '✕')),
    el('p', { class: 'texto-fraco' },
      personalizada ? 'Usando configuração editada neste navegador. ' : 'Usando a configuração padrão (copiada da planilha antiga). ',
      'Vale a primeira linha que bate, como o PROCV. Fica salva só neste navegador.'),
    avisos,
    el('div', { class: 'dialogo-corpo' }, SECOES.map((s) => editorDeLista(s, rascunho[s.id]))),
    el('footer', { class: 'dialogo-rodape' },
      el('button', {
        type: 'button', class: 'botao botao-sec',
        onclick: () => {
          if (!window.confirm('Voltar para a configuração padrão? As edições deste navegador serão apagadas.')) return;
          const aviso = aoRestaurar();
          fechar();
          if (aviso) window.alert(aviso);
        },
      }, 'Restaurar padrão'),
      el('span', { class: 'espaco' }),
      el('button', { type: 'button', class: 'botao botao-sec', onclick: fechar }, 'Cancelar'),
      el('button', { type: 'button', class: 'botao', onclick: salvar }, 'Salvar')));

  dialogo.addEventListener('cancel', (ev) => { ev.preventDefault(); fechar(); });
  document.body.append(dialogo);
  dialogo.showModal();
}

export { CONFIG_PADRAO };
