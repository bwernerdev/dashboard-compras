// Tela Organograma: árvore de Suprimentos CDs (de cima para baixo, com linhas ligando chefe e
// equipe) e as filiais de cada comprador, como a aba "Organograma" da planilha antiga (texto
// copiado de lá em 12/11/2026; nomes corrigidos: "Bruno Wener" -> "Bruno Werner", "Acessoria" ->
// "Assessoria"). Fotos da mesma aba (organograma-fotos.js); quem não tem foto lá aparece com as
// iniciais. Só o organograma: sem contagem de SCs (pedido da equipe, 12/11/2026).
// Mudou a equipe ou a carteira de filiais: editar ARVORE abaixo (equipe = quem responde a ela).
import { el } from '../ui/dom.js';
import { bloco } from '../ui/cartoes.js';
import { FOTOS } from './organograma-fotos.js';

const ARVORE = {
  nome: 'Erico de Arruda Holanda', cargo: 'Diretor Executivo',
  equipe: [{
    nome: 'Valter Pedroso', cargo: 'Gerente Executivo',
    equipe: [{
      nome: 'Alex Borba', cargo: "Gerente Regional CD's",
      equipe: [{
        nome: 'Fabiano Lechinski', cargo: 'Coordenador Administrativo',
        equipe: [
          {
            nome: 'Thayane Morlus', cargo: 'Comprador',
            filiais: [
              '178.692 - Campinas - CD', '178.963 - Ribeirão Preto - CD', '178.697 - São Paulo - CD',
              '30.892 - SP Anhanguera - CD', '30.901 - Campinas - CD', '30.603 - Duque de Caxias - CD II',
            ],
          },
          {
            nome: 'Bruno Werner', cargo: 'Comprador',
            filiais: ['30.570 - Itajaí - Armazém', '30.572 - Itajaí - Fatiados', '30.573 - Itajaí - CD', '30.733 - Cambé - CD'],
          },
          { nome: 'Sandro Pereira', cargo: 'Assessoria de Suprimentos' },
          {
            nome: 'Vitor Cruz', cargo: 'Comprador',
            filiais: [
              '178.676 - Cabo de Santo Agostinho - CD', '178.356 - Aquiraz - CD', '178.675 - Ribeirão das Neves - CD',
              '30.910 - Salvador - CD', '30.965 - Vitória da Conquista - CD', '30.943 - Ribeirão das Neves - CD',
              '30.770 - Canoas - ADM', '30.458 - Nova Santa Rita - CD',
            ],
          },
        ],
      }],
    }],
  }],
};

const iniciais = (nome) => {
  const partes = nome.split(/\s+/).filter(Boolean);
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
};

/** Líder (tem equipe): cartão baixo, foto ao lado do nome, para a cadeia não ficar alta demais. */
function cartaoPessoa({ nome, cargo, filiais, equipe }) {
  const foto = FOTOS[nome];
  return el('div', { class: `org-no${equipe?.length ? ' org-no-lider' : ''}` },
    foto
      ? el('img', { class: 'org-avatar org-foto', src: foto, alt: '', width: '64', height: '64' })
      : el('span', { class: 'org-avatar', 'aria-hidden': 'true' }, iniciais(nome)),
    el('div', { class: 'org-texto' },
      el('strong', { class: 'org-nome' }, nome),
      el('span', { class: 'org-cargo' }, cargo)),
    filiais ? el('ul', { class: 'org-filiais', 'aria-label': `Filiais de ${nome}` }, filiais.map((f) => el('li', {}, f))) : null);
}

/** Pessoa e, embaixo, a equipe dela (lista aninhada: o leitor de tela anuncia a hierarquia). */
function ramo(pessoa) {
  return el('li', { class: 'org-ramo' },
    cartaoPessoa(pessoa),
    pessoa.equipe?.length ? el('ul', { class: 'org-nivel' }, pessoa.equipe.map(ramo)) : null);
}

export function telaOrganograma() {
  return el('div', { class: 'tela' }, bloco(
    { titulo: "Organograma Suprimentos CD's" },
    el('div', { class: 'org-arvore' }, el('ul', { class: 'org-nivel', 'aria-label': 'Organograma' }, ramo(ARVORE))),
  ));
}
