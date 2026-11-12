// Tela Organograma: estrutura de Suprimentos CDs e as filiais de cada comprador, como a aba
// "Organograma" da planilha antiga (texto copiado de lá em 12/11/2026; nomes corrigidos:
// "Bruno Wener" -> "Bruno Werner", "Acessoria" -> "Assessoria"). Sem fotos: iniciais no lugar.
// Mudou a equipe ou a carteira de filiais: editar ESTRUTURA e COMPRADORES abaixo.
// Cada comprador mostra as SCs em aberto da regional dele (filtros globais valem) e filtra o
// painel por ela ao clicar.
import { el } from '../ui/dom.js';
import { bloco } from '../ui/cartoes.js';
import * as fmt from '../ui/formatos.js';
import { itensEmAberto, resumoEmAberto } from '../analise.js';

const ESTRUTURA = [
  { nome: 'Erico de Arruda Holanda', cargo: 'Diretor Executivo' },
  { nome: 'Valter Pedroso', cargo: 'Gerente Executivo' },
  { nome: 'Alex Borba', cargo: "Gerente Regional CD's" },
  { nome: 'Fabiano Lechinski', cargo: 'Coordenador Administrativo' },
];

const COMPRADORES = [
  {
    nome: 'Thayane Morlus', cargo: 'Comprador', regional: 'Filiais Thayane',
    filiais: [
      '178.692 - Campinas - CD', '178.963 - Ribeirão Preto - CD', '178.697 - São Paulo - CD',
      '30.892 - SP Anhanguera - CD', '30.901 - Campinas - CD', '30.603 - Duque de Caxias - CD II',
    ],
  },
  {
    nome: 'Bruno Werner', cargo: 'Comprador', regional: 'Filiais Bruno',
    filiais: ['30.570 - Itajaí - Armazém', '30.572 - Itajaí - Fatiados', '30.573 - Itajaí', '30.733 - Cambé - CD'],
  },
  {
    nome: 'Vitor Cruz', cargo: 'Comprador', regional: 'Filiais Vitor',
    filiais: [
      '178.676 - Cabo de Santo Agostinho - CD', '178.356 - Aquiraz - CD', '178.675 - Ribeirão das Neves - CD',
      '30.910 - Salvador - CD', '30.965 - Vitória da Conquista - CD', '30.943 - Ribeirão das Neves - CD',
      '30.770 - Canoas - ADM', '30.458 - Nova Santa Rita - CD',
    ],
  },
];

const APOIO = [{ nome: 'Sandro Pereira', cargo: 'Assessoria de Suprimentos' }];

const iniciais = (nome) => {
  const partes = nome.split(/\s+/).filter(Boolean);
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
};

function pessoa({ nome, cargo }, ...extra) {
  return el('div', { class: 'org-pessoa' },
    el('span', { class: 'org-avatar', 'aria-hidden': 'true' }, iniciais(nome)),
    el('div', { class: 'org-texto' },
      el('strong', {}, nome),
      el('span', { class: 'texto-fraco' }, cargo),
      ...extra));
}

export function telaOrganograma(ctx) {
  const abertos = itensEmAberto(ctx.registros);

  const cadeia = el('ol', { class: 'org-cadeia', 'aria-label': 'Liderança' },
    ESTRUTURA.map((p) => el('li', {}, pessoa(p))));

  const equipe = el('ul', { class: 'org-equipe', 'aria-label': 'Equipe' },
    COMPRADORES.map((c) => {
      const r = resumoEmAberto(abertos.filter((x) => x.regional === c.regional));
      return el('li', { class: 'org-comprador' },
        pessoa(c, el('button', {
          type: 'button', class: 'botao botao-link org-filtrar',
          title: `Filtrar o painel pela regional ${c.regional}`,
          onclick: () => ctx.filtrar('regional', c.regional),
        }, `${fmt.inteiro(r.scs)} SCs em aberto, ${fmt.inteiro(r.fora)} itens fora do prazo`)),
        el('ul', { class: 'org-filiais', 'aria-label': `Filiais de ${c.nome}` }, c.filiais.map((f) => el('li', {}, f))));
    }),
    APOIO.map((p) => el('li', { class: 'org-comprador' }, pessoa(p))));

  return el('div', { class: 'tela' }, bloco(
    { titulo: "Organograma Suprimentos CD's", subtitulo: 'SCs em aberto de cada comprador conforme os filtros atuais. Clique no número para filtrar o painel pela regional.' },
    cadeia,
    equipe,
  ));
}
