// Planilha CONTROLE DE CONTRATOS (anexo opcional, janela "Contratos"): abas lidas, colunas e contas.
// Sem leitor de xlsx nem config: este módulo também vai para o painel publicado.
// A leitura do arquivo fica em ./ler.js (só no app da equipe).

/**
 * Abas lidas, na ordem da janela. `nome`: nome da aba na planilha (sem diferenciar maiúsculas e acentos).
 * As outras (Renovações, Filiais, Dados, Responsaveis) ficam de fora: Renovações saiu a pedido da equipe (17/11/2026).
 */
export const ABAS = [
  { id: 'contratos', nome: 'Contratos', rotulo: 'Contratos' },
  { id: 'pequenoPorte', nome: 'Pequeno Porte', rotulo: 'Pequeno porte' },
  { id: 'me', nome: 'ME', rotulo: 'ME' },
  { id: 'inativos', nome: 'Inativos', rotulo: 'Inativos' },
];

/**
 * Colunas conhecidas: id -> { rotulo, cabecalhos (como vêm na planilha, normalizados), tipo? }.
 * tipo: 'data' (série do Excel; texto fica como veio), 'moeda', 'codigo' (número sem separador).
 * Coluna que não está aqui é ignorada.
 */
export const CAMPOS = {
  filial: { rotulo: 'Filial', cabecalhos: ['filial'] },
  resp: { rotulo: 'Responsável', cabecalhos: ['resp', 'responsavel'] },
  cnpj: { rotulo: 'CNPJ/CPF', cabecalhos: ['cnpjcpf', 'cnpj'] },
  fornecedor: { rotulo: 'Fornecedor', cabecalhos: ['fornecedor'] },
  objeto: { rotulo: 'Objeto', cabecalhos: ['objeto'] },
  setor: { rotulo: 'Setor responsável', cabecalhos: ['setorresponsavel'] },
  servicoLocacao: { rotulo: 'Serviço/Locação', cabecalhos: ['servicolocacao'] },
  status: { rotulo: 'Status', cabecalhos: ['status'] },
  vencimento: { rotulo: 'Vencimento', tipo: 'data', cabecalhos: [] }, // ME: a coluna "Prazo Venc." tem a data
  valor: { rotulo: 'Valor', tipo: 'moeda', cabecalhos: ['valor'] },
  inicio: { rotulo: 'Início', tipo: 'data', cabecalhos: ['inicio'] },
  fim: { rotulo: 'Fim', tipo: 'data', cabecalhos: ['fim'] },
  atualizacao: { rotulo: 'Atualização', tipo: 'data', cabecalhos: ['atualizacao'] },
  projuris: { rotulo: 'Contrato Projuris', tipo: 'codigo', cabecalhos: ['contratoprojuris'] },
  contratoMe: { rotulo: 'Contrato ME', tipo: 'codigo', cabecalhos: ['contratome'] },
  ifrs16: { rotulo: 'IFRS 16', tipo: 'codigo', cabecalhos: ['contratoifrs16', 'ifrs16'] },
  minuta: { rotulo: 'Minuta', cabecalhos: ['minuta'] },
  item: { rotulo: 'Item', tipo: 'codigo', cabecalhos: ['item'] },
  observacao: { rotulo: 'Observação', cabecalhos: ['observacao1', 'observacao'] },
  statusDemanda: { rotulo: 'Status demanda', cabecalhos: ['statusdemanda'] },
  encerramento: { rotulo: 'Encerramento', cabecalhos: ['encerramento'] },
};

/** Cabeçalho para comparar: sem acento, maiúsculas, espaço nem pontuação ("Prazo Venc. (dias)" -> "prazovencdias"). */
export const normalizarCabecalho = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '');

const PORCABECALHO = new Map(Object.entries(CAMPOS).flatMap(([id, c]) => c.cabecalhos.map((h) => [h, id])));

/** Texto limpo (espaços e quebras de linha viram um espaço); "", "-" e vazio viram null. Número fica número. */
function limpar(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s === '' || s === '-' ? null : s;
}

/** Filial como a equipe escreve: "30. 603" -> "30.603". */
export const normalizarFilial = (v) => (v === null ? null : String(v).replace(/\s+/g, ''));

/** Filial ajustada (3 últimos dígitos, como no de-para): "30.603" -> "603", "178.356" -> "356". */
export function filialAjustadaDoContrato(filial) {
  const d = String(filial ?? '').replace(/\D/g, '');
  return d.length >= 3 ? d.slice(-3) : null;
}

const ehCabecalho = (l) => (l ?? []).some((c) => normalizarCabecalho(c) === 'fornecedor');
const celulasCheias = (l) => (l ?? []).filter((c) => c !== null && c !== undefined && String(c).trim() !== '');

/** Coluna de um cabeçalho: { id, rotulo, tipo? } (desconhecida: id "c_<cabeçalho>", rotulo como veio), ou null. */
function colunaDoCabecalho(bruto, idAba) {
  const texto = String(bruto ?? '').replace(/\s+/g, ' ').trim();
  if (!texto) return null;
  const h = normalizarCabecalho(texto);
  // ME: "Prazo Venc. (dias)" tem a data do vencimento. Nas outras abas é conta (fim - hoje), refeita na janela.
  if (h === 'prazovencdias') return idAba === 'me' ? { id: 'vencimento', ...CAMPOS.vencimento } : null;
  const id = PORCABECALHO.get(h);
  if (id) return { id, rotulo: CAMPOS[id].rotulo, tipo: CAMPOS[id].tipo };
  return h ? { id: `c_${h}`, rotulo: texto } : null;
}

/**
 * Quadros de uma aba (matriz como a planilha: [[célula, ...], ...]). Cada linha com "Fornecedor" abre
 * um quadro (a janela mostra o 1º); a linha de uma célula só logo acima é o título. Linhas sem fornecedor, objeto nem filial (totais, linhas vazias) ficam de fora.
 * Retorna [{ titulo, campos: [{ id, rotulo, tipo? }], linhas: [objeto] }] (vazio sem cabeçalho).
 */
export function lerBlocosDaAba(matriz, idAba) {
  const blocos = [];
  let atual = null;
  const linhas = matriz.map((l) => l ?? []);
  // Próxima linha com conteúdo é cabeçalho? (aí a linha de um texto só acima é o título do quadro)
  const proximaCheia = (i) => linhas.slice(i + 1).find((l) => celulasCheias(l).length);
  linhas.forEach((l, n) => {
    const cheias = celulasCheias(l);
    if (!cheias.length) return;
    if (ehCabecalho(l)) {
      const colunas = [];
      l.forEach((c, i) => {
        const col = colunaDoCabecalho(c, idAba);
        if (col && !colunas.some((x) => x.id === col.id)) colunas.push({ ...col, i });
      });
      const anterior = linhas.slice(0, n).reverse().find((x) => celulasCheias(x).length);
      const cheiasAnt = anterior ? celulasCheias(anterior) : [];
      const titulo = cheiasAnt.length === 1 && typeof cheiasAnt[0] === 'string' ? cheiasAnt[0].replace(/\s+/g, ' ').trim() : null;
      atual = { titulo, colunas, linhas: [] };
      blocos.push(atual);
      return;
    }
    if (!atual) return;
    if (cheias.length === 1 && typeof cheias[0] === 'string' && ehCabecalho(proximaCheia(n))) return; // título
    const r = {};
    for (const { id, i } of atual.colunas) r[id] = limpar(l[i]);
    if ('filial' in r) r.filial = normalizarFilial(r.filial);
    if ((r.fornecedor ?? null) === null && (r.objeto ?? null) === null && (r.filial ?? null) === null) return;
    atual.linhas.push(r);
  });
  return blocos.map(({ titulo, colunas, linhas }) => ({
    titulo,
    campos: colunas.map(({ id, rotulo, tipo }) => (tipo ? { id, rotulo, tipo } : { id, rotulo })),
    linhas,
  }));
}

/** Status sem espaço sobrando e em maiúsculas ("VENCIDO " -> "VENCIDO"); vazio = null. */
export const statusDoContrato = (r) => (r.status ? String(r.status).trim().toUpperCase() : null);

/** Data do fim do contrato (Fim; na aba ME, o Vencimento), ou null se não for data. */
export const fimDoContrato = (r) => {
  const v = r.fim ?? r.vencimento;
  return typeof v === 'number' ? v : null;
};

/** Dias corridos do hoje até o fim (negativo: já passou), como a coluna "Prazo Venc. (dias)" da planilha. */
export function prazoDias(r, hoje) {
  const fim = fimDoContrato(r);
  return fim === null ? null : Math.round(fim - hoje);
}

export const PRAZO_AVISO_DIAS = 30;
const encerrado = (r) => statusDoContrato(r) === 'INATIVO';

/**
 * Cartões da janela: total, ativos, em renovação, vencem em até 30 dias e fim já passou (os dois últimos
 * sem contar INATIVO). Para Contratos, Pequeno porte e ME.
 */
export function resumoContratos(linhas, hoje) {
  const resumo = { total: linhas.length, ativos: 0, emRenovacao: 0, vencem: 0, vencidos: 0 };
  for (const r of linhas) {
    const st = statusDoContrato(r);
    if (st === 'ATIVO') resumo.ativos++;
    if (st === 'EM RENOVAÇÃO' || st === 'EM RENOVACAO') resumo.emRenovacao++;
    const p = prazoDias(r, hoje);
    if (p === null || encerrado(r)) continue;
    if (p < 0) resumo.vencidos++;
    else if (p <= PRAZO_AVISO_DIAS) resumo.vencem++;
  }
  return resumo;
}

/** Contagem por status (ordem: mais frequente primeiro). */
export function contarPor(linhas, campo) {
  const mapa = new Map();
  for (const r of linhas) {
    const v = campo === 'status' ? statusDoContrato(r) : r[campo];
    const k = v ?? '(vazio)';
    mapa.set(k, (mapa.get(k) ?? 0) + 1);
  }
  return new Map([...mapa].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR')));
}
