// Dados do app da equipe, sem DOM: Base e Follow-Up importados, base anterior (variação nos cartões),
// histórico dos mini gráficos, anexo de contratos, cópias dos arquivos para "Reimportar bases" e a
// configuração (de-para). Faz o fluxo de importar, reimportar, restaurar ao abrir e recalcular.
// Saiu do main.js em 19/11/2026 para ser testado em Node (tests/bases.test.js).
//
// A tela (main.js) passa uma "vista" que recebe os dados: definirBase(tipo, dados),
// definirAnteriores(anteriores), definirHistorico(pontos), reiniciarTelas() e desenhar().
// Armazenamento (IndexedDB/localStorage), importação (worker) e leitura dos contratos vêm por
// parâmetro, com os de verdade como padrão; os testes passam falsos.

import { importarNoWorker } from './importacao.js';
import { criarConfig, CONFIG_PADRAO } from './config/index.js';
import { hojeSerie, formatarSerie } from './datas.js';
import * as memoria from './memoria.js';
import { brutosDe, recalcular, juntarAoHistorico, copiaValida } from './memoria.js';
import { copiarParaMemoria } from './leitor/arquivo.js';
import { lerContratos } from './contratos/ler.js';
import { resumoStatus, resumoEmAberto, itensEmAberto } from './analise.js';

export const ROTULOS = { base: 'Base', followUp: 'Follow-Up' };

/** Dia do ME da base: a anterior só troca quando chega base de outro dia (reimportar no mesmo dia mantém). */
export const diaDaBase = (meta) => Math.floor(meta?.dadosGerais?.execucao ?? meta?.hoje ?? 0);

/** Resumos da base inteira (sem filtros) do dia do ME: o que os mini gráficos mostram. */
export const pontoDe = (meta, registros) => ({ dia: diaDaBase(meta), status: resumoStatus(registros), aberto: resumoEmAberto(itensEmAberto(registros)) });

/**
 * vista: ver o topo do arquivo. configSalva: configuração editada neste navegador (ou null: padrão).
 * armazenamento: funções de memoria.js (salvar/ler importações, cópias, histórico, configuração).
 * importarArquivo(tipo, arquivo, { hoje, config, aoAvancar, sinal }): importação no worker.
 * lerContratosDe(arquivo), copiar(arquivo, { sinal, aoAvancar }), hoje(): trocáveis nos testes.
 */
export function criarBases({
  vista, configSalva = null, armazenamento = memoria, importarArquivo = importarNoWorker,
  lerContratosDe = lerContratos, copiar = copiarParaMemoria, hoje = hojeSerie,
}) {
  const estado = {
    config: configSalva ?? CONFIG_PADRAO,
    personalizada: !!configSalva,
    cfg: criarConfig(configSalva ?? CONFIG_PADRAO),
    hoje: hoje(),
    base: null, // { registros, brutos, meta, salvoEm }
    followUp: null,
    anterior: null, // base de outro dia do ME { brutos, meta, salvoEm }: variação nos cartões
    historico: [], // [{ dia, status, aberto }]: mini gráficos dos cartões (ver memoria.js)
    contratos: null, // anexo opcional (CONTROLE DE CONTRATOS): { abas, meta, salvoEm }, janela Contratos
    copias: {}, // { arquivo, salvoEm }: cópia do último arquivo de Base e Follow-Up (memoria.js, vale 8 h): "Reimportar bases" lê de novo
  };
  const importando = new Set();

  function definirBase(tipo, dados) {
    estado[tipo] = dados;
    vista.definirBase(tipo, dados);
  }

  // ---------- Base anterior e histórico ----------

  /** Recalcula a base anterior com o "hoje" dela: os cartões comparam com o que se via naquele dia. */
  function definirAnterior() {
    const a = estado.anterior;
    vista.definirAnteriores(a ? {
      registros: recalcular('base', a.brutos, estado.cfg, a.meta?.hoje ?? diaDaBase(a.meta)),
      rotulo: formatarSerie(diaDaBase(a.meta)).slice(0, 5),
    } : null);
  }

  /** As telas recebem só os dias antes da base atual; o valor atual vem da própria tela. */
  function definirHistorico() {
    const dia = estado.base ? diaDaBase(estado.base.meta) : Infinity;
    vista.definirHistorico(estado.historico.filter((p) => p.dia < dia));
  }

  function guardarPonto(meta, registros) {
    estado.historico = juntarAoHistorico(estado.historico, pontoDe(meta, registros));
    armazenamento.salvarHistorico(estado.historico);
    definirHistorico();
  }

  // ---------- Importação ----------

  /** Anexo de contratos: lido aqui mesmo (arquivo pequeno), sem worker e sem regras. */
  async function importarContratos(arquivo) {
    const lidos = await lerContratosDe(arquivo);
    estado.contratos = { ...lidos, salvoEm: Date.now() };
    armazenamento.salvarContratos(lidos);
    vista.desenhar();
    return estado.contratos;
  }

  /** Guarda a cópia do arquivo importado (Base e Follow-Up), na página e no navegador. */
  function lembrarArquivo(tipo, arquivo) {
    if (tipo === 'contratos' || arquivo === estado.copias[tipo]?.arquivo) return; // reimportou a mesma cópia: vale o horário dela
    estado.copias[tipo] = { arquivo, salvoEm: Date.now() };
    armazenamento.salvarCopia(tipo, estado.copias[tipo]);
  }

  async function importarSemLembrar(tipo, arquivo, aoAvancar, sinal) {
    if (tipo === 'contratos') return importarContratos(arquivo);
    const dia = hoje();
    const resultado = await importarArquivo(tipo, arquivo, { hoje: dia, config: estado.config, aoAvancar, sinal });
    const dados = { registros: resultado.registros, brutos: brutosDe(tipo, resultado.registros), meta: resultado.meta, salvoEm: Date.now() };
    if (tipo === 'base' && estado.base && diaDaBase(estado.base.meta) < diaDaBase(resultado.meta)) {
      estado.anterior = { brutos: estado.base.brutos, meta: estado.base.meta, salvoEm: estado.base.salvoEm };
      armazenamento.salvarAnterior(estado.anterior);
      definirAnterior();
    }
    estado.hoje = dia;
    vista.reiniciarTelas();
    definirBase(tipo, dados);
    if (tipo === 'base') guardarPonto(dados.meta, dados.registros);
    armazenamento.salvarImportacao(tipo, resultado.registros, resultado.meta);
    vista.desenhar();
    return dados;
  }

  /**
   * Importa um arquivo escolhido (clique ou arrastar) ou a cópia guardada (Reimportar). Primeiro copia o
   * arquivo para a memória numa leitura só ("Copiando o arquivo": pasta de rede no Citrix ficava lenta
   * com o leitor pulando entre partes); a cópia vai ao worker e fica guardada para "Reimportar bases".
   */
  async function importar(tipo, arquivo, aoAvancar, sinal) {
    // Uma importação por tipo: a caixa da tela vazia, a do diálogo e o Reimportar não correm juntas
    // (a que terminasse por último venceria, mesmo sendo o arquivo mais antigo).
    if (importando.has(tipo)) throw new Error(`Já há uma importação de ${ROTULOS[tipo] ?? 'Contratos'} em andamento: espere ela terminar ou cancele.`);
    importando.add(tipo);
    try {
      const copia = arquivo === estado.copias[tipo]?.arquivo ? arquivo
        : await copiar(arquivo, { sinal, aoAvancar: (f) => aoAvancar?.(f, 'Copiando o arquivo') });
      const dados = await importarSemLembrar(tipo, copia, aoAvancar, sinal);
      lembrarArquivo(tipo, copia);
      return dados;
    } finally {
      importando.delete(tipo);
    }
  }

  /** Cópia guardada do último arquivo deste tipo, se ainda vale (8 h) e dá para ler; sem ela, pede a caixa. */
  async function arquivoDeNovo(tipo) {
    const copia = estado.copias[tipo];
    if (copia && !copiaValida(copia)) {
      delete estado.copias[tipo];
      armazenamento.apagarCopia(tipo);
      throw new Error('a cópia do arquivo vale 8 horas e venceu: escolha o arquivo de novo pela caixa em "Atualizar bases"');
    }
    if (!copia) throw new Error('escolha o arquivo de novo pela caixa em "Atualizar bases"');
    try {
      await copia.arquivo.slice(0, 4).arrayBuffer(); // o navegador pode ter descartado a cópia (limpeza de dados)
    } catch {
      throw new Error('a cópia guardada do arquivo não pôde ser lida: escolha de novo pela caixa em "Atualizar bases"');
    }
    return copia.arquivo;
  }

  /**
   * "Reimportar bases" (Configuração): lê de novo a Base e o Follow-Up (se houver) das cópias guardadas
   * na importação, para trazer as linhas de filial nova do de-para. Devolve um texto por base.
   */
  async function reimportarBases(aoAvancar) {
    const tipos = ['base', 'followUp'].filter((t) => t === 'base' || estado[t] || estado.copias[t]);
    const arquivos = [];
    const resultado = [];
    for (const tipo of tipos) {
      try {
        arquivos.push({ tipo, arquivo: await arquivoDeNovo(tipo) });
      } catch (erro) {
        resultado.push(`${ROTULOS[tipo]}: ${erro.message}.`);
      }
    }
    for (const { tipo, arquivo } of arquivos) {
      try {
        const dados = await importar(tipo, arquivo, (fracao, fase) => aoAvancar(`${ROTULOS[tipo]}: ${fase} ${Math.round(fracao * 100)}%`));
        resultado.push(`${ROTULOS[tipo]}: ${arquivo.name}, ${dados.registros.length.toLocaleString('pt-BR')} linhas das filiais do de-para.`);
      } catch (erro) {
        resultado.push(`${ROTULOS[tipo]}: ${erro.message}`);
      }
    }
    return resultado;
  }

  // ---------- Recalcular, restaurar, configuração ----------

  /** Recalcula as bases guardadas (config nova ou outro dia). */
  function recalcularTudo() {
    estado.hoje = hoje();
    for (const tipo of ['base', 'followUp']) {
      const d = estado[tipo];
      if (d) definirBase(tipo, { ...d, registros: recalcular(tipo, d.brutos, estado.cfg, estado.hoje) });
    }
    definirAnterior();
  }

  /** Virou o dia com a página aberta: recalcula dias em aberto e SLA. Devolve true se recalculou. */
  function virouODia() {
    if (!estado.base || hoje() === estado.hoje) return false;
    recalcularTudo();
    return true;
  }

  /** Ao abrir: bases, cópias, contratos, base anterior e histórico guardados neste navegador. */
  async function restaurar() {
    const salvas = await armazenamento.lerImportacoes();
    for (const tipo of ['base', 'followUp']) {
      const s = salvas[tipo];
      if (s?.brutos) definirBase(tipo, { brutos: s.brutos, meta: s.meta, salvoEm: s.salvoEm, registros: recalcular(tipo, s.brutos, estado.cfg, estado.hoje) });
    }
    for (const tipo of ['base', 'followUp']) {
      const copia = salvas[`arquivo-${tipo}`];
      if (copiaValida(copia)) estado.copias[tipo] = { arquivo: copia.arquivo, salvoEm: copia.salvoEm };
      else if (copia) armazenamento.apagarCopia(tipo); // vencida (8 h): libera o espaço
    }
    if (salvas.contratos?.abas) estado.contratos = { abas: salvas.contratos.abas, meta: salvas.contratos.meta, salvoEm: salvas.contratos.salvoEm };
    const a = salvas['base-anterior'];
    if (a?.brutos && estado.base && diaDaBase(a.meta) < diaDaBase(estado.base.meta)) {
      estado.anterior = { brutos: a.brutos, meta: a.meta, salvoEm: a.salvoEm };
      definirAnterior();
    }
    // Histórico: o salvo; sem ele (ou sem o dia da base atual), monta com a anterior e a atual.
    estado.historico = salvas.historico?.pontos ?? [];
    if (estado.base && !estado.historico.some((p) => p.dia === diaDaBase(estado.base.meta))) {
      const ant = estado.anterior;
      if (ant && !estado.historico.some((p) => p.dia === diaDaBase(ant.meta))) {
        estado.historico = juntarAoHistorico(estado.historico,
          pontoDe(ant.meta, recalcular('base', ant.brutos, estado.cfg, ant.meta?.hoje ?? diaDaBase(ant.meta))));
      }
      guardarPonto(estado.base.meta, recalcular('base', estado.base.brutos, estado.cfg, estado.base.meta?.hoje ?? estado.hoje));
    } else definirHistorico();
  }

  function aplicarConfig(config, personalizada) {
    const codigosAntes = estado.cfg.codigosFiliais;
    estado.config = config;
    estado.personalizada = personalizada;
    estado.cfg = criarConfig(config);
    recalcularTudo();
    vista.desenhar();
    const novas = [...estado.cfg.codigosFiliais].filter((c) => !codigosAntes.has(c));
    return novas.length && estado.base
      ? `Filial nova no de-para (${novas.join(', ')}): use "Reimportar bases" na Configuração para trazer as linhas dela.`
      : null;
  }

  /** Configuração editada (Salvar na Configuração): guarda neste navegador e recalcula. Devolve o aviso ou null. */
  function salvarConfig(config) {
    armazenamento.salvarConfig(config);
    return aplicarConfig(config, true);
  }

  /** "Restaurar padrão": apaga a configuração editada e volta à do padrão. */
  function restaurarPadrao() {
    armazenamento.apagarConfig();
    return aplicarConfig(CONFIG_PADRAO, false);
  }

  return { estado, importar, reimportarBases, restaurar, virouODia, salvarConfig, restaurarPadrao };
}
