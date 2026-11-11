// Gera teste-intranet.html: página que verifica o que funciona onde o painel vai abrir
// (ex.: pré-visualização do SharePoint/OneDrive, que mostra o .html num quadro "about:srcdoc").
// Leva ~1,5 MB de dados FICTÍCIOS compactados, para testar o peso de um painel real.
// Uso: node scripts/gerar-teste-intranet.mjs  (grava na raiz do projeto)

import { writeFile } from 'node:fs/promises';

const LINHAS = 120_000;
let semente = 20261111;
const aleatorio = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
const linhas = [];
for (let i = 0; i < LINHAS; i++) {
  linhas.push(`FDS-${7000000 + i};${Math.floor(aleatorio() * 900)};${(aleatorio() * 100000).toFixed(2)};${Math.floor(aleatorio() * 60)}`);
}
const bruto = new TextEncoder().encode(linhas.join('\n'));
const fluxo = new Blob([bruto]).stream().pipeThrough(new CompressionStream('gzip'));
const compactado = Buffer.from(await new Response(fluxo).arrayBuffer());
const base64 = compactado.toString('base64');

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Teste Intranet 2</title>
<style>
  body { font-family: "Segoe UI", sans-serif; background: #f5f6f8; color: #1d2433; margin: 0; padding: 32px 16px; }
  main { max-width: 760px; margin: auto; background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  h1 { color: #2f5bd3; font-size: 22px; margin: 0 0 4px; }
  p { margin: 0 0 16px; color: #5f6672; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e2e5ea; vertical-align: top; }
  th { width: 34%; }
  .ok { color: #1a7f37; font-weight: 600; }
  .falha { color: #c62828; font-weight: 600; }
  .manual { color: #9a6700; font-weight: 600; }
  button { font: inherit; padding: 6px 12px; border: 0; border-radius: 6px; background: #2f5bd3; color: #fff; cursor: pointer; margin: 0 6px 6px 0; }
  code { font-size: 12px; word-break: break-all; }
</style>
</head>
<body>
<main>
  <h1>Teste Intranet 2: o que funciona aqui</h1>
  <p>Clique nos 6 botões do fim e tire um print. No 5, cole (Ctrl+V) numa planilha. Dados fictícios.</p>
  <table><tbody id="resultado"></tbody></table>
  <h2 style="font-size:16px;margin:20px 0 8px">Testes com clique (anote se funcionou)</h2>
  <button id="b-csv">1. Baixar CSV</button>
  <button id="b-imprimir">2. Imprimir</button>
  <button id="b-confirm">3. Pergunta (confirm)</button>
  <button id="b-dialogo">4. Janela do app (dialog)</button>
  <button id="b-copiar">5. Copiar tabela (cole no Excel)</button>
  <button id="b-aba">6. Abrir em nova aba</button>
  <dialog id="dialogo"><p>Janela do app abriu.</p><button onclick="this.closest('dialog').close()">Fechar</button></dialog>
</main>
<script id="dados" type="text/plain">${base64}</script>
<script>
(async () => {
  const corpo = document.getElementById('resultado');
  const linha = (nome, situacao, texto) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th'); th.textContent = nome;
    const td = document.createElement('td');
    const s = document.createElement('span'); s.className = situacao; s.textContent = situacao === 'ok' ? 'OK' : situacao === 'falha' ? 'FALHOU' : 'VER';
    td.append(s, ' ', texto);
    tr.append(th, td); corpo.append(tr);
    return td;
  };
  const tentar = async (nome, fn) => {
    try { const r = await fn(); linha(nome, 'ok', r ?? ''); }
    catch (e) { linha(nome, 'falha', String(e && e.message || e)); }
  };

  linha('Script', 'ok', 'roda');
  linha('Endereço', 'manual', location.href.slice(0, 120));
  linha('Origem', self.origin === 'null' ? 'manual' : 'ok', self.origin === 'null' ? 'opaca (quadro isolado)' : self.origin);
  linha('Dentro de quadro', 'manual', window.top !== window ? 'sim' : 'não');
  linha('Navegador', 'manual', navigator.userAgent);

  await tentar('localStorage (preferências)', () => {
    localStorage.setItem('teste-intranet', '1');
    const v = localStorage.getItem('teste-intranet');
    localStorage.removeItem('teste-intranet');
    if (v !== '1') throw new Error('não guardou');
    return 'grava e lê';
  });
  await tentar('IndexedDB (memória)', () => new Promise((ok, erro) => {
    const req = indexedDB.open('teste-intranet', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('x');
    req.onsuccess = () => { req.result.close(); indexedDB.deleteDatabase('teste-intranet'); ok('abre'); };
    req.onerror = () => erro(req.error);
    setTimeout(() => erro(new Error('sem resposta em 3 s')), 3000);
  }));
  await tentar('Dados embutidos (peso do painel)', async () => {
    const inicio = performance.now();
    const b64 = document.getElementById('dados').textContent.trim();
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const texto = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    const n = texto.split('\\n').length;
    if (n !== ${LINHAS}) throw new Error('linhas: ' + n);
    return (bytes.length / 1e6).toFixed(1) + ' MB compactados, ' + (texto.length / 1e6).toFixed(1) + ' MB abertos, ' + n.toLocaleString('pt-BR') + ' linhas em ' + Math.round(performance.now() - inicio) + ' ms';
  });
  await tentar('Worker (cálculo em segundo plano)', () => new Promise((ok, erro) => {
    const url = URL.createObjectURL(new Blob(['onmessage = (e) => postMessage(e.data * 2)'], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.onmessage = (e) => { w.terminate(); e.data === 42 ? ok('funciona') : erro(new Error('resposta errada')); };
    w.onerror = (e) => erro(new Error(e.message || 'erro'));
    w.postMessage(21);
    setTimeout(() => erro(new Error('sem resposta em 3 s')), 3000);
  }));
  await tentar('Números pt-BR', () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(1234.5));

  const marcar = (botao, texto) => { botao.textContent += ' → ' + texto; };
  document.getElementById('b-csv').onclick = (ev) => {
    try {
      const url = URL.createObjectURL(new Blob(['\\ufeffColuna;Valor\\r\\nTeste;1,5\\r\\n'], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = 'teste-intranet.csv';
      document.body.append(a); a.click(); a.remove();
      marcar(ev.target, 'baixou? confira os Downloads');
    } catch (e) { marcar(ev.target, 'erro: ' + e.message); }
  };
  document.getElementById('b-imprimir').onclick = (ev) => {
    const t = Date.now();
    try { window.print(); } catch (e) { marcar(ev.target, 'erro: ' + e.message); return; }
    marcar(ev.target, Date.now() - t < 300 ? 'não abriu (bloqueado?)' : 'abriu');
  };
  document.getElementById('b-confirm').onclick = (ev) => {
    const t = Date.now();
    let r;
    try { r = window.confirm('Pergunta de teste: clique OK'); } catch (e) { marcar(ev.target, 'erro: ' + e.message); return; }
    marcar(ev.target, r ? 'funcionou' : Date.now() - t < 300 ? 'bloqueado' : 'cancelado');
  };
  document.getElementById('b-copiar').onclick = async (ev) => {
    const texto = 'Coluna\\tValor\\r\\nTeste copiado\\t1,5\\r\\n';
    try {
      await navigator.clipboard.writeText(texto);
      marcar(ev.target, 'copiou (área de transferência)');
      return;
    } catch (e) { /* tenta o jeito antigo */ }
    const area = document.createElement('textarea');
    area.value = texto;
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    area.remove();
    marcar(ev.target, ok ? 'copiou (jeito antigo)' : 'bloqueado');
  };
  document.getElementById('b-aba').onclick = (ev) => {
    try {
      const url = URL.createObjectURL(new Blob(['<!doctype html>' + document.documentElement.outerHTML], { type: 'text/html' }));
      const janela = window.open(url, '_blank');
      marcar(ev.target, janela ? 'abriu: na aba nova, clique de novo em 1, 2 e 3' : 'bloqueado');
    } catch (e) { marcar(ev.target, 'erro: ' + e.message); }
  };
  document.getElementById('b-dialogo').onclick = (ev) => {
    try { document.getElementById('dialogo').showModal(); marcar(ev.target, 'abriu'); }
    catch (e) { marcar(ev.target, 'erro: ' + e.message); }
  };
})();
</script>
</body>
</html>
`;

await writeFile(new URL('../teste-intranet.html', import.meta.url), html);
console.log(`teste-intranet.html: ${(html.length / 1e6).toFixed(2)} MB (dados: ${(compactado.length / 1e6).toFixed(2)} MB compactados de ${(bruto.length / 1e6).toFixed(2)} MB)`);
