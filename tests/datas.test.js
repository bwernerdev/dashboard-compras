import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  serie, partesDaSerie, serieDeTexto, formatarSerie, diaDaSemana, dias, diasUteis, serieDeData,
} from '../src/datas.js';

test('série do Excel: 11/11/2026 = 46337 e volta', () => {
  assert.equal(serie(2026, 11, 11), 46337);
  assert.deepEqual(partesDaSerie(46337.75), { ano: 2026, mes: 11, dia: 11 });
  assert.equal(serieDeData(new Date(2026, 10, 11, 23, 59)), 46337);
  assert.equal(formatarSerie(46337.5), '11/11/2026');
});

test('série 0 é 00/01/1900, como ANO(0) e MÊS(0) do Excel', () => {
  assert.deepEqual(partesDaSerie(0), { ano: 1900, mes: 1, dia: 0 });
});

test('texto dd/mm/aaaa vira série (com ou sem hora)', () => {
  assert.equal(serieDeTexto('11/11/2026'), 46337);
  assert.equal(serieDeTexto('01/02/2026 12:00'), serie(2026, 2, 1) + 0.5);
  assert.equal(serieDeTexto('Todos(as)'), null);
  assert.equal(serieDeTexto(null), null);
});

test('dia da semana bate com o calendário', () => {
  for (let d = serie(2025, 12, 1); d < serie(2026, 3, 1); d++) {
    const { ano, mes, dia } = partesDaSerie(d);
    assert.equal(diaDaSemana(d), new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay());
  }
});

test('DIAS: diferença das partes inteiras; vazio conta 0', () => {
  assert.equal(dias(46337.9, 46330.1), 7);
  assert.equal(dias(46337, null), 46337);
});

test('DIATRABALHOTOTAL: seg-sex, inclui os extremos, sem feriados', () => {
  // 03/11/2026 (ter) a 11/11/2026 (qua): 3,4,5,6,9,10,11 = 7 dias
  assert.equal(diasUteis(serie(2026, 11, 3), serie(2026, 11, 11)), 7);
  assert.equal(diasUteis(serie(2026, 11, 11), serie(2026, 11, 11)), 1);
  assert.equal(diasUteis(serie(2026, 11, 7), serie(2026, 11, 8)), 0); // sábado e domingo
  assert.equal(diasUteis(serie(2026, 11, 11), serie(2026, 11, 3)), -7);
  assert.equal(diasUteis(serie(2026, 11, 3) + 0.9, serie(2026, 11, 11) + 0.1), 7);
});

test('mesmo método da planilha: DIATRABALHOTOTAL(0; 11/11/2026) = 33098', () => {
  // É o valor que a planilha antiga mostra nas linhas com a referência quebrada.
  assert.equal(diasUteis(0, 46337), 33098);
});
