// Configuração padrão, copiada da aba `Base Analitico` do
// DASHBOARD COMPRAS 2026.xlsm em 11/11/2026. Dados internos, publicados com o repositório (público desde 12/11/2026, decisão do usuário).
// A ordem importa: as buscas reproduzem o PROCV do Excel (primeira ocorrência vence).

export const CONFIG_PADRAO = {
  // Código da filial (como vem do ME, sem ponto) -> filial ajustada, nome e regional.
  filiais: [
    { codigo: '30570', descricao: 'SEARA ALIMENTOS LTDA  -  ITAJAI - ARMAZEM', ajustada: '570', nome: 'Itajai', regional: 'Filiais Bruno' },
    { codigo: '30573', descricao: 'SEARA ALIMENTOS LTDA  -  ITAJAI - CD', ajustada: '573', nome: 'Itajai', regional: 'Filiais Bruno' },
    { codigo: '30572', descricao: 'SEARA ALIMENTOS LTDA  -  ITAJAI - FATIADOS', ajustada: '572', nome: 'Itajai', regional: 'Filiais Bruno' },
    { codigo: '178716', descricao: 'SEARA COMERCIO DE ALIMENTOS LT  -  BAURU - CD', ajustada: '716', nome: 'CDA', regional: 'Central Compras - Itajaí' },
    { codigo: '30901', descricao: 'SEARA ALIMENTOS LTDA  -  CAMPINAS - CD', ajustada: '901', nome: 'Campinas', regional: 'Filiais Thayane' },
    { codigo: '178692', descricao: 'SEARA COMERCIO DE ALIMENTOS LT  -  CAMPINAS - CD', ajustada: '692', nome: 'Campinas', regional: 'Filiais Thayane' },
    { codigo: '30892', descricao: 'SEARA ALIMENTOS LTDA  -  SP ANHANGUERA - CD', ajustada: '892', nome: 'CDA', regional: 'Filiais Thayane' },
    { codigo: '30458', descricao: 'SEARA ALIMENTOS LTDA  -  NOVA SANTA RITA - CD', ajustada: '458', nome: 'Nova Sta Rita', regional: 'Filiais Vitor' },
    { codigo: '30319', descricao: 'SEARA ALIMENTOS LTDA  -  RIBEIRAO PRETO - CD', ajustada: '319', nome: 'Rib. Preto', regional: 'Filiais Thayane' },
    { codigo: '178963', descricao: 'SEARA COMERCIO DE ALIMENTOS LT  -  RIBEIRAO PRETO - CD', ajustada: '963', nome: 'Rib. Preto', regional: 'Filiais Thayane' },
    { codigo: '178697', descricao: 'SEARA COMERCIO DE ALIMENTOS LT  -  SAO PAULO - CD', ajustada: '697', nome: 'CDA', regional: 'Filiais Thayane' },
    { codigo: '30770', descricao: 'SEARA ALIMENTOS LTDA  -  CANOAS - ADM', ajustada: '770', nome: 'Nova Sta Rita', regional: 'Filiais Vitor' },
    { codigo: '178356', descricao: 'SEARA COMERCIO DE ALIMENTOS LT  -  AQUIRAZ - CD', ajustada: '356', nome: 'Aquiraz', regional: 'Filiais Vitor' },
    { codigo: '178676', descricao: 'SEARA COMERCIO DE ALIMENTOS LT  -  CABO STO AGO - CD', ajustada: '676', nome: 'Cabo St. Ago.', regional: 'Filiais Vitor' },
    { codigo: '30603', descricao: 'SEARA ALIMENTOS LTDA  -  DUQUE DE CAXIAS - CD II', ajustada: '603', nome: 'Duque Cax.', regional: 'Filiais Thayane' },
    { codigo: '30358', descricao: 'SEARA ALIMENTOS LTDA  -  FORTALEZA - CD', ajustada: '358', nome: 'Aquiraz', regional: 'Central Compras - Itajaí' },
    { codigo: '30930', descricao: 'SEARA ALIMENTOS LTDA  -  RECIFE - ADM.', ajustada: '930', nome: 'Cabo St. Ago.', regional: 'Central Compras - Itajaí' },
    { codigo: '30357', descricao: 'SEARA ALIMENTOS LTDA  -  RECIFE - CD', ajustada: '357', nome: 'Cabo St. Ago.', regional: 'Central Compras - Itajaí' },
    { codigo: '30943', descricao: 'SEARA ALIMENTOS LTDA  -  RIBEIRAO DAS NEVES - CD', ajustada: '943', nome: 'Rib. Neves', regional: 'Filiais Vitor' },
    { codigo: '178675', descricao: 'SEARA COMERCIO DE ALIMENTOS LT  -  RIBEIRAO DAS NEVES - CD', ajustada: '675', nome: 'Rib. Neves', regional: 'Filiais Vitor' },
    { codigo: '178677', descricao: 'SEARA COMERCIO DE ALIMENTOS LT  -  SAO GONCALO DO AMARANTE - CD', ajustada: '677', nome: 'Cabo St. Ago.', regional: 'Central Compras - Itajaí' },
    { codigo: '30910', descricao: 'SEARA ALIMENTOS LTDA  -  SALVADOR - CD', ajustada: '910', nome: 'Salvador', regional: 'Filiais Vitor' },
    { codigo: '30965', descricao: 'SEARA ALIMENTOS LTDA  -  VITORIA DA CONQUISTA - CD', ajustada: '965', nome: 'Vit. Conq.', regional: 'Filiais Vitor' },
    { codigo: '30733', descricao: 'SEARA ALIMENTOS LTDA  -  CAMBE - CD', ajustada: '733', nome: 'CD Cambé', regional: 'Filiais Bruno' },
    { codigo: '30555', descricao: 'SEARA ALIMENTOS LTDA - SP ANHANGUERA - MATRIZ', ajustada: '555', nome: 'Matriz ', regional: 'Seara Matriz' },
    { codigo: '178329', descricao: 'SEARA COMERCIO DE ALIMENTOS LT - CAMBE - CD', ajustada: '329', nome: 'CD Cambé', regional: 'Filiais Bruno' },
  ],

  // Nome completo do comprador (depois do prefixo "FDS - ") -> apelido.
  // Quem não está aqui aparece como "-" (igual à planilha).
  compradores: [
    { nome: 'Bruno Matheus de Freitas Werner', apelido: 'Bruno W.' },
    { nome: 'Vitor Eduardo Antunes da Cruz', apelido: 'Vitor' },
    { nome: 'Matheus Alexandre Fortunato Petuco', apelido: 'Matheus' },
    { nome: 'Thayane da Silva Afonso Morlus', apelido: 'Thayane' },
    { nome: 'Pendente', apelido: 'Pendente' },
  ],
};
