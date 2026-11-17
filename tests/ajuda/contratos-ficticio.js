// Planilha de contratos fictícia (mesmo formato da CONTROLE DE CONTRATOS, nada real), para os testes e o e2e.
import { criarXlsx } from './xlsx-ficticio.js';

/**
 * Abas: Contratos (título acima do cabeçalho, linha de total no fim), Pequeno Porte, ME (vencimento
 * na coluna "Prazo Venc. (dias)"), Inativos; Dados e Renovações (dois quadros, o segundo com título) são ignoradas pelo app.
 * Contratos, com hoje = `hoje`: A ativo vence em 10 dias; B ativo em 200 dias (valor em texto);
 * C em renovação, fim 5 dias atrás; D "VENCIDO " (com espaço), fim 40 dias atrás.
 */
export function abasDeContratos(hoje) {
  const cab = ['Filial', 'Resp', 'CNPJ/CPF', 'Fornecedor', 'Objeto', 'Prazo Venc. (dias)', 'Setor Responsável',
    'Contrato Projuris', 'Contrato ME ', 'Status', 'Valor', 'Inicio', 'Fim', 'Observação 1', 'Status demanda'];
  return [
    { nome: 'Contratos', linhas: [
      [null, null, hoje, 'CONTROLE DE CONTRATOS - EMPRESA TESTE'],
      cab,
      ['30. 570', 'Ana', '00.000.000/0001-01', 'FORNECEDOR A\r\nLTDA', 'LIMPEZA', 10, 'RH', 111, 222, 'ATIVO', 1000, hoje - 355, hoje + 10, 'obs A', 'em assinatura'],
      ['30. 572', 'Bia', '00.000.000/0001-02', 'FORNECEDOR B', 'VIGILÂNCIA', 200, 'Segurança', 112, 223, 'ATIVO', 'Conforme proposta', hoje - 165, hoje + 200],
      ['30. 573', 'Ana', '00.000.000/0001-03', 'FORNECEDOR C', 'LAVANDERIA', -5, 'RH', 113, 224, 'EM RENOVAÇÃO', 2500.5, hoje - 370, hoje - 5],
      ['30. 901', 'Caio', '00.000.000/0001-04', 'FORNECEDOR D', 'COLETA', -40, '-', 114, 225, 'VENCIDO ', '-', '01/01/2025', hoje - 40],
      [null, null, null, null, null, null, null, null, null, 'Total', 3500.5],
    ] },
    { nome: 'Pequeno Porte', linhas: [
      [hoje, null, hoje, 'CONTROLE DE CONTRATOS PEQUENO PORTE'],
      ['Filial', 'Resp.', 'CNPJ', 'Fornecedor', 'Objeto', 'Prazo Venc. (dias)', 'Setor Responsável', 'Serviço/ Locação', 'Contrato Projuris', 'IFRS 16', 'Status', 'Valor', 'Inicio', 'Fim'],
      ['30. 570', 'Ana', '00.000.000/0001-05', 'FORNECEDOR E', 'REFORMA', -100, 'Manutenção', 'S', 115, 'N/A', 'INATIVO', 4000, hoje - 130, hoje - 100],
    ] },
    { nome: 'ME', linhas: [
      ['Filial', 'Resp', 'CNPJ/CPF', 'Fornecedor', 'Objeto', 'Prazo Venc. (dias)', 'Contrato ME ', 'Status', 'Valor', 'Atualização'],
      ['30. 572', 'Bia', '00.000.000/0001-06', 'FORNECEDOR F', 'HORTIFRUTI', hoje + 20, 226, 'ATIVO', 'Tabela de preços', hoje - 60],
    ] },
    { nome: 'Dados', linhas: [['ATIVO'], ['INATIVO']] },
    { nome: 'Inativos', linhas: [
      ['Filial', 'Resp', 'CNPJ', 'Fornecedor', 'Objeto', 'Prazo Venc. (dias)', 'Status', 'Valor', 'Inicio', 'Fim', 'Encerramento'],
      ['30. 901', 'Caio', null, 'FORNECEDOR G', 'ESCRITÓRIO', null, 'INATIVO', 500, hoje - 900, hoje - 700, 'Fim do acordo'],
    ] },
    { nome: 'Renovações', linhas: [
      [null, 'Fornecedor', 'Prazo Renovação ', 'Valor Atual', 'Teve congelamento', 'Saving', 'Saving IGP-M', 'Porcent SV IGP-M', 'Saving Periodo Geral'],
      [null, 'Fornecedor H', 6, 11000, 'Não', 1000, 0, 0, 6000],
      [null, null, null, null, null, null, null, 'Total Redução:', 6000],
      ['Renovação segundo semestre 2099'],
      ['Filial ', 'Fornecedor', 'Prazo Renovação ', 'Valor Atual', 'Teve congelamento', 'Valor atualizado ', 'ÍNDICE CONTRATUAL ', 'REAJUSTE %', 'Mês renovação', 'Coluna Nova'],
      [570, 'FORNECEDOR I', '12 meses ', 8000, 'NÃO ', 8970.4, 'IPCA ', 0.1213, hoje - 30, 'x'],
    ] },
  ];
}

/** Blob .xlsx da planilha fictícia. */
export const criarContratosFicticios = (hoje) => criarXlsx(abasDeContratos(hoje));
