// Casca comum dos diálogos (app e painel): <dialog> modal com cabeçalho (título, subtítulo opcional
// e ✕), corpo e rodapé opcional. Esc e ✕ fecham e tiram o diálogo da página. Antes cada diálogo
// (Atualizar bases, Painel gerado, Configuração, Contratos) repetia este esqueleto.
import { el } from './dom.js';

/**
 * Abre um diálogo modal e devolve { dialogo, fechar }.
 * id: id do título (aria-labelledby). classe: classes a mais do <dialog> ("dialogo-largo", "janela").
 * subtitulo: texto fraco ao lado do título. classeCabecalho: classe a mais do cabeçalho.
 * corpo: nós entre o cabeçalho e o rodapé. rodape: nós do rodapé (sem rodapé se null).
 * fecharNoEsc(dialogo): false mantém o diálogo aberto no Esc (ex.: Contratos com uma lista de marcar aberta,
 * que fecha primeiro). rotuloFechar: nome do ✕ para leitor de tela.
 */
export function abrirDialogo({
  id, titulo, subtitulo = null, classe = '', classeCabecalho = '', corpo = [], rodape = null,
  fecharNoEsc = () => true, rotuloFechar = 'Fechar',
}) {
  const fechar = () => { dialogo.close(); dialogo.remove(); };
  const h2 = el('h2', { id }, titulo);
  // Tudo pelo el(): item null no corpo (parágrafo opcional) é pulado. O append nativo escreveria "null".
  const dialogo = el('dialog', { class: `dialogo ${classe}`.trim(), 'aria-labelledby': id },
    el('header', { class: `dialogo-cabecalho ${classeCabecalho}`.trim() },
      subtitulo === null ? h2 : el('div', { class: 'janela-titulo' }, h2, el('span', { class: 'texto-fraco' }, subtitulo)),
      el('button', { type: 'button', class: 'botao botao-link', onclick: fechar, 'aria-label': rotuloFechar }, '✕')),
    corpo,
    rodape ? el('footer', { class: 'dialogo-rodape' }, rodape) : null);
  dialogo.addEventListener('cancel', (ev) => {
    ev.preventDefault();
    if (fecharNoEsc(dialogo)) fechar();
  });
  document.body.append(dialogo);
  dialogo.showModal();
  return { dialogo, fechar };
}

/** "Versão do app: 19/11/2026 abc1234" (data do build e commit, vite.config.js); "local" fora do build. */
export const versaoDoApp = () => el('span', { class: 'espaco dialogo-versao' },
  `Versão do app: ${typeof __VERSAO__ === 'string' ? __VERSAO__ : 'local'}`);
