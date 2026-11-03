/* ============================================================
 * Campo de busca no cadastro (SOL-F29): o mesmo em todo o sistema.
 * Digite o nome ou o código → lista da base de dados → escolher preenche o campo e o código.
 * ============================================================ */
const contextoCatalogo = () => ({ apolo: S.apolo, pbi: S.pbi, relatorios: S.relatorios, eq: S.eq });
// opções: nome (do campo), rotulo, fonte (prestador|convenio|faturista|tuss|unidade|titulo), valor, cod,
// livre (aceita texto fora do cadastro), valorCodigo (o campo guarda o código, não o nome), preencheCod (nome de outro campo que recebe o código)
function campoBusca({ nome, rotulo, fonte, valor = '', cod = '', livre = true, valorCodigo = false, preencheCod = '', dica = '', obrigatorio = false }) {
  return `<label class="campo campo-busca" data-busca="${fonte}" data-livre="${livre ? 1 : 0}"${valorCodigo ? ' data-valor-codigo="1"' : ''}${preencheCod ? ` data-preenche-cod="${esc(preencheCod)}"` : ''}>${esc(rotulo)}${obrigatorio ? ' *' : ''}
    <input type="text" name="${esc(nome)}" value="${esc(valor)}" autocomplete="off" spellcheck="false" placeholder="digite o nome ou o código…" data-busca-input role="combobox" aria-expanded="false">
    <input type="hidden" name="${esc(nome)}Cod" value="${esc(cod)}">
    ${dica ? `<span class="small muted">${esc(dica)}</span>` : ''}<div class="busca-lista" role="listbox" hidden></div></label>`;
}
function ligarBuscas(raiz) {
  raiz.querySelectorAll('[data-busca]').forEach(rot => {
    if (rot.dataset.ligado) return; rot.dataset.ligado = '1';
    const inp = rot.querySelector('[data-busca-input]'), cod = rot.querySelector('input[type=hidden]'), lista = rot.querySelector('.busca-lista');
    const fonte = rot.dataset.busca, livre = rot.dataset.livre === '1';
    let base = null, itens = [], ativo = 0;
    const fechar = () => { lista.hidden = true; inp.setAttribute('aria-expanded', 'false'); };
    const desenhar = () => {
      base = base || catalogo(fonte, S.cfg, contextoCatalogo());
      itens = buscarCatalogo(base, inp.value, 8);
      const texto = inp.value.trim(), exato = itens.some(it => norm(it.nome) === norm(texto) || (it.cod && it.cod === texto));
      const novo = livre && texto && !exato;
      lista.innerHTML = itens.map((it, i) => `<div class="op${i === ativo ? ' on' : ''}" role="option" data-i="${i}">${it.cod ? `<b>${esc(it.cod)}</b>` : ''}<span>${esc(it.nome || '(sem nome)')}</span><small>${esc(it.info || '')}</small></div>`).join('')
        + (novo ? `<div class="op novo${itens.length === ativo ? ' on' : ''}" data-i="${itens.length}">+ Usar «${esc(texto)}»${['faturista', 'convenio'].includes(fonte) ? ' e cadastrar' : ''}</div>` : '')
        + (!itens.length && !novo ? `<div class="op vazio">Nada encontrado em ${esc(FONTES_CATALOGO[fonte] || fonte)}.</div>` : '');
      lista.hidden = false; inp.setAttribute('aria-expanded', 'true');
    };
    const escolher = i => {
      const it = itens[i];
      if (it) {
        inp.value = rot.dataset.valorCodigo ? (it.cod || it.nome) : (it.nome || it.cod); cod.value = it.cod || '';
        if (rot.dataset.preencheCod) { const alvo = rot.closest('form, .card, #dlgCorpo, section')?.querySelector(`[name="${rot.dataset.preencheCod}"]`); if (alvo && it.cod) alvo.value = it.cod; }
        rot.dataset.escolhido = it.origem; delete rot.dataset.novo;
      } else if (livre && inp.value.trim()) { cod.value = ''; rot.dataset.novo = '1'; delete rot.dataset.escolhido; }
      fechar(); inp.dispatchEvent(new CustomEvent('busca-escolha', { bubbles: true, detail: it || { nome: inp.value.trim(), cod: '', origem: 'livre' } }));
    };
    inp.addEventListener('focus', () => { base = null; });
    inp.addEventListener('input', () => { cod.value = ''; delete rot.dataset.escolhido; ativo = 0; desenhar(); });
    inp.addEventListener('keydown', e => {
      const n = lista.querySelectorAll('.op[data-i]').length;
      if (e.key === 'ArrowDown') { e.preventDefault(); if (lista.hidden) { ativo = 0; desenhar(); } else { ativo = Math.min(n - 1, ativo + 1); desenhar(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); ativo = Math.max(0, ativo - 1); desenhar(); }
      else if (e.key === 'Enter' && !lista.hidden && n) { e.preventDefault(); e.stopPropagation(); escolher(ativo); }
      else if (e.key === 'Escape' && !lista.hidden) { e.preventDefault(); e.stopPropagation(); fechar(); }
    });
    lista.addEventListener('mousedown', e => { const op = e.target.closest('.op[data-i]'); if (!op) return; e.preventDefault(); escolher(+op.dataset.i); });
    inp.addEventListener('blur', () => setTimeout(fechar, 120));
  });
}
// Texto escolhido fora do cadastro (faturista ou convênio): pergunta se quer cadastrar.
async function oferecerCadastro(fonte, nome) {
  nome = String(nome || '').trim(); if (!nome) return false;
  if (fonte === 'faturista') {
    if (S.cfg.faturistas.some(f => norm(f.nome) === norm(nome))) return false;
    if (!await confirmar('Cadastrar faturista?', `«${esc(nome)}» não está no cadastro de faturistas. Cadastrar agora (Bases → Faturistas)?`, 'Cadastrar')) return false;
    registrarFaturistas(S.cfg, [nome], `cadastro rápido (${S.operador || '—'})`); salvarCfg(`Faturista «${nome}» cadastrado.`, 'faturistas'); return true;
  }
  if (fonte === 'convenio') {
    if (S.cfg.convenios.some(c => norm(c.nome) === norm(nome))) return false;
    const r = await dialogo('Cadastrar convênio?', `<p>«${esc(nome)}» não está no cadastro de convênios.</p><label class="campo">Tipo<select name="tipo">${opcoes([['', '— sem tipo —'], ...Object.entries(TIPOS_CONVENIO)], '')}</select></label>`, [['', 'Agora não', 'sec'], ['ok', 'Cadastrar']]);
    if (r.botao !== 'ok') return false;
    registrarConvenios(S.cfg, [[nome, r.campos.tipo]], `cadastro rápido (${S.operador || '—'})`); salvarCfg(`Convênio «${nome}» cadastrado.`, 'regras'); return true;
  }
  return false;
}
