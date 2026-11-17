// Tela Organograma: árvore de Suprimentos CDs (de cima para baixo, com linhas ligando chefe e
// equipe) e as filiais de cada comprador, como a aba "Organograma" da planilha antiga (texto
// copiado de lá em 12/11/2026; nomes corrigidos: "Bruno Wener" -> "Bruno Werner", "Acessoria" ->
// "Assessoria"). Fotos da mesma aba (organograma-fotos.js); quem não tem foto lá aparece com as
// iniciais. Só o organograma: sem contagem de SCs (pedido da equipe, 12/11/2026).
// Filiais como no resto do app (17/11/2026): código curto e nome do de-para ("570 · Itajaí - HUB"),
// tirado das bases (nomeFilial de cada filial); filial sem linha na base usa o nome padrão daqui.
// O texto da planilha ("30.570 - Itajaí - Armazém") fica no title. Sem filtros (telas/publicas.js).
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
              ['692', 'Campinas', '178.692 - Campinas - CD'], ['963', 'Rib. Preto', '178.963 - Ribeirão Preto - CD'], ['697', 'CDA', '178.697 - São Paulo - CD'],
              ['892', 'CDA', '30.892 - SP Anhanguera - CD'], ['901', 'Campinas', '30.901 - Campinas - CD'], ['603', 'Duque Cax.', '30.603 - Duque de Caxias - CD II'],
            ],
          },
          {
            nome: 'Bruno Werner', cargo: 'Comprador',
            filiais: [['570', 'Itajaí - HUB', '30.570 - Itajaí - Armazém'], ['572', 'Itajaí - Fatiados', '30.572 - Itajaí - Fatiados'], ['573', 'Itajaí - CD', '30.573 - Itajaí - CD'], ['733', 'CD Cambé', '30.733 - Cambé - CD']],
          },
          { nome: 'Sandro Pereira', cargo: 'Assessoria de Suprimentos' },
          {
            nome: 'Vitor Cruz', cargo: 'Comprador',
            filiais: [
              ['676', 'Cabo St. Ago.', '178.676 - Cabo de Santo Agostinho - CD'], ['356', 'Aquiraz', '178.356 - Aquiraz - CD'], ['675', 'Rib. Neves', '178.675 - Ribeirão das Neves - CD'],
              ['910', 'Salvador', '30.910 - Salvador - CD'], ['965', 'Vit. Conq.', '30.965 - Vitória da Conquista - CD'], ['943', 'Rib. Neves', '30.943 - Ribeirão das Neves - CD'],
              ['770', 'Nova Sta Rita', '30.770 - Canoas - ADM'], ['458', 'Nova Sta Rita', '30.458 - Nova Santa Rita - CD'],
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

/** Filial na lista do comprador: "570 · Itajaí - HUB" (nome das bases ou o padrão); planilha no title. */
const itemFilial = ([codigo, padrao, planilha], nomes) => el('li', { title: planilha },
  el('span', { class: 'org-filial-codigo' }, codigo), ` · ${nomes.get(codigo) ?? padrao}`);

/** Líder (tem equipe): cartão baixo, foto ao lado do nome, para a cadeia não ficar alta demais. */
function cartaoPessoa({ nome, cargo, filiais, equipe }, nomes) {
  const foto = FOTOS[nome];
  return el('div', { class: `org-no${equipe?.length ? ' org-no-lider' : ''}` },
    foto
      ? el('img', { class: 'org-avatar org-foto', src: foto, alt: '', width: '64', height: '64' })
      : el('span', { class: 'org-avatar', 'aria-hidden': 'true' }, iniciais(nome)),
    el('div', { class: 'org-texto' },
      el('strong', { class: 'org-nome' }, nome),
      el('span', { class: 'org-cargo' }, cargo)),
    filiais ? el('ul', { class: 'org-filiais', 'aria-label': `Filiais de ${nome}` }, filiais.map((f) => itemFilial(f, nomes))) : null);
}

/** Pessoa e, embaixo, a equipe dela (lista aninhada: o leitor de tela anuncia a hierarquia). */
function ramo(pessoa, nomes) {
  return el('li', { class: 'org-ramo' },
    cartaoPessoa(pessoa, nomes),
    pessoa.equipe?.length ? el('ul', { class: 'org-nivel' }, pessoa.equipe.map((p) => ramo(p, nomes))) : null);
}

/** Código da filial -> nome do de-para, tirado das bases (o painel publicado não leva a configuração). */
export function nomesDasFiliais(registros = []) {
  const nomes = new Map();
  for (const r of registros) if (r.filial && r.nomeFilial && !nomes.has(String(r.filial))) nomes.set(String(r.filial), r.nomeFilial);
  return nomes;
}

export function telaOrganograma(ctx) {
  const nomes = nomesDasFiliais(ctx?.registros);
  return el('div', { class: 'tela' }, bloco(
    { titulo: "Organograma Suprimentos CD's", subtitulo: 'Quem compra para cada filial. Código e nome da filial como nas outras telas; o nome completo aparece ao passar o mouse.' },
    el('div', { class: 'org-arvore' }, el('ul', { class: 'org-nivel', 'aria-label': 'Organograma' }, ramo(ARVORE, nomes))),
  ));
}
