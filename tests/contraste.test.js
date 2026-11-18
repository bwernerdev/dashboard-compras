// Contraste WCAG dos tokens (src/styles/tokens.css), nos dois temas.
// Texto sobre fundo: 4,5:1 (1.4.3). Borda de campo (input/select) sobre a superfície: 3:1 (1.4.11).
// O ../giro-estoque tem o mesmo teste (tests/contrast.test.js) com os mesmos limites:
// mudou uma cor compartilhada aqui, confira lá também.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

function bloco(seletor) {
  const inicio = css.indexOf('{', css.indexOf(seletor));
  const fim = css.indexOf('\n}', inicio);
  const pares = [...css.slice(inicio, fim).matchAll(/--([\w-]+):\s*#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)];
  return Object.fromEntries(pares.map(([, nome, hex]) => [nome, hex.length === 3 ? [...hex].map(c => c + c).join('') : hex]));
}

function luminancia(hex) {
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a, b) {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

const claro = bloco(':root {');
const temas = { claro, escuro: { ...claro, ...bloco('html[data-theme="dark"] {') } };

const texto = [
  ['text', 'surface'], ['text-muted', 'bg'], ['text-muted', 'surface'], ['accent-text', 'surface'],
  ['accent-ink', 'accent'], ['danger-fg', 'danger-bg'], ['warning-fg', 'warning-bg'],
  ['success-fg', 'success-bg'], ['neutral-fg', 'neutral-bg'], ['linha-reg-fg', 'linha-reg-bg'],
];
const bordaDeCampo = [['control-border', 'surface'], ['control-border', 'surface-2'], ['control-border', 'bg']];

for (const [tema, t] of Object.entries(temas)) {
  test(`contraste no tema ${tema}: texto >= 4,5:1 e borda de campo >= 3:1`, () => {
    for (const [pares, minimo] of [[texto, 4.5], [bordaDeCampo, 3]]) {
      for (const [frente, fundo] of pares) {
        assert.ok(t[frente] && t[fundo], `token ausente: --${frente} ou --${fundo}`);
        const valor = contraste(t[frente], t[fundo]);
        assert.ok(valor >= minimo, `--${frente} sobre --${fundo}: ${valor.toFixed(2)}:1 (mínimo ${minimo}:1)`);
      }
    }
  });
}
