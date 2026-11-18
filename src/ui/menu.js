// Menu de ações com nome (ex.: "Exportar ▾" no topo do app: Gerar painel e Imprimir; "⋯" das tabelas).
// Itens: role menuitem ou menuitemcheckbox.
// O botão abre/fecha a lista; os itens são os próprios botões de ação (mesmos ids e eventos de antes).
// Teclado: setas sobem/descem entre os itens ativos, Home/End, Esc fecha e volta ao botão; clique fora
// ou num item fecha. Só no app da equipe (o painel publicado tem só Imprimir, sem menu).

/** botao: abre o menu; painel: elemento com os itens (role=menu, hidden). */
export function ligarMenu(botao, painel) {
  const itens = () => [...painel.querySelectorAll('[role^="menuitem"]')].filter((i) => !i.disabled && !i.hidden);
  const aberto = () => !painel.hidden;

  function fechar(focarBotao = false) {
    if (!aberto()) return;
    painel.hidden = true;
    botao.setAttribute('aria-expanded', 'false');
    if (focarBotao) botao.focus();
  }

  function abrir(focarUltimo = false) {
    painel.hidden = false;
    botao.setAttribute('aria-expanded', 'true');
    const lista = itens();
    (focarUltimo ? lista.at(-1) : lista[0])?.focus();
  }

  botao.setAttribute('aria-haspopup', 'menu');
  botao.setAttribute('aria-expanded', 'false');
  botao.addEventListener('click', () => (aberto() ? fechar() : abrir()));
  botao.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      abrir(ev.key === 'ArrowUp');
    }
  });

  painel.addEventListener('keydown', (ev) => {
    const lista = itens();
    const i = lista.indexOf(document.activeElement);
    let j = null;
    if (ev.key === 'ArrowDown') j = (i + 1) % lista.length;
    else if (ev.key === 'ArrowUp') j = (i - 1 + lista.length) % lista.length;
    else if (ev.key === 'Home') j = 0;
    else if (ev.key === 'End') j = lista.length - 1;
    else if (ev.key === 'Escape') { ev.preventDefault(); fechar(true); return; }
    else if (ev.key === 'Tab') { fechar(); return; }
    if (j === null || !lista.length) return;
    ev.preventDefault();
    lista[j].focus();
  });
  // Escolheu um item: fecha (a ação do item roda pelo evento dele).
  painel.addEventListener('click', (ev) => { if (ev.target.closest('[role^="menuitem"]')) fechar(); });
  // Menus das tabelas são recriados a cada desenho: o ouvinte sai quando o menu deixa a página.
  const fora = (ev) => {
    if (!painel.isConnected && !botao.isConnected) { document.removeEventListener('pointerdown', fora); return; }
    if (aberto() && !painel.contains(ev.target) && !botao.contains(ev.target)) fechar();
  };
  document.addEventListener('pointerdown', fora);
  return { fechar };
}
