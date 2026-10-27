/* ============================================================
 * Painel «Equivalências desta rodada»: mostra os pares código × título que impediram
 * confirmações e permite ao operador validá-los explicitamente, com registro (RN-184, RN-193).
 * ============================================================ */
const ROTULO_EQ = { pendente: 'Pendente', 'sem-cadastro': 'Sem cadastro', divergente: 'Título validado p/ outro código', conflito: 'Em conflito', validada: 'Validada' };

function paresDaConferencia(res) {
  const m = new Map();
  const add = (r, l, proc) => {
    if (!l || proc.estado === 'validada' || proc.estado === 'sem-titulo') return;
    const k = `${r.codigo}|${chaveTitulo(l.titulo)}`;
    const e = m.get(k) || { codigo: r.codigo, descMV: r.procDesc, titulo: l.titulo, estado: proc.estado, relacao: proc.relacao || null, n: 0 };
    e.n++; m.set(k, e);
  };
  for (const x of res.linhas) {
    if (!x.r) continue;
    if (x.par) add(x.r, x.par.l, x.par.proc);
    else for (const c of x.cands) if (c.nm >= 2) add(x.r, c.l, c.proc);
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.codigo.localeCompare(b.codigo));
}
function paresDaCorrecao(res) {
  const idx = indiceEquivalencias(S.eq);
  return res.ocorrencias.map(o => {
    const rel = (idx.porTitulo.get(chaveTitulo(o.titulo)) || []).find(e => e.codigo === o.codigo) || null;
    return { codigo: o.codigo, descMV: o.descMV, titulo: o.titulo, estado: o.estadoEq, relacao: rel, n: o.n };
  });
}

function painelEqRodada(cont, pares, aoReprocessar) {
  if (!pares.length) { cont.innerHTML = '<p class="muted">Nenhum par código × título pendente nesta rodada.</p>'; return; }
  const sel = new Set();
  cont.innerHTML = `<p class="lead">Estes pares apareceram nos laudos do paciente na data, mas não estão validados. <strong>Valide só o que você conferiu:</strong> a validação passa a sustentar confirmações automáticas nas próximas rodadas e fica registrada com seu nome.</p>
    <div class="acoes"><label class="small"><input type="checkbox" id="eqrTodos"> selecionar todos</label><button id="eqrValidar" disabled>Validar selecionadas</button><button id="eqrReproc" class="sec">Reprocessar com a base atual</button><span id="eqrInfo" class="muted small"></span></div>
    <div id="eqrTab" style="margin-top:8px"></div>`;
  const t = tabela($('eqrTab'), {
    porPagina: 100, linhas: pares, colunas: [
      { t: '', html: (x) => `<input type="checkbox" data-k="${esc(x.codigo + '|' + x.titulo)}"${sel.has(x) ? ' checked' : ''}>` },
      { t: 'Código', v: x => x.codigo }, { t: 'Descrição MV', v: x => x.descMV }, { t: 'TITLE do Apolo', v: x => x.titulo },
      { t: 'Situação', html: x => `${esc(ROTULO_EQ[x.estado] || x.estado)}${x.relacao?.ambiguo ? ' <span class="badge warn">ambígua</span>' : ''}` },
      { t: 'Ocorrências', n: true, v: x => x.n },
      { t: 'Observação da análise', v: x => x.relacao ? [x.relacao.confianca && `confiança ${x.relacao.confianca}`, x.relacao.atencao].filter(Boolean).join(' · ') : '' }
    ]
  });
  const ligar = () => cont.querySelectorAll('#eqrTab input[data-k]').forEach(ch => ch.onchange = () => {
    const x = pares.find(p => p.codigo + '|' + p.titulo === ch.dataset.k); ch.checked ? sel.add(x) : sel.delete(x);
    $('eqrValidar').disabled = !sel.size; $('eqrInfo').textContent = sel.size ? `${sel.size} selecionada(s)` : '';
  });
  ligar(); new MutationObserver(ligar).observe($('eqrTab'), { childList: true });
  $('eqrTodos').onchange = e => { sel.clear(); if (e.target.checked) pares.forEach(p => sel.add(p)); t.atualizar(pares); $('eqrValidar').disabled = !sel.size; $('eqrInfo').textContent = sel.size ? `${sel.size} selecionada(s)` : ''; };
  $('eqrReproc').onclick = aoReprocessar;
  $('eqrValidar').onclick = async () => {
    const op = await exigirOperador(); if (!op) return;
    const divergentes = [...sel].filter(x => x.estado === 'divergente').length;
    const ok = await dialogo('Validar equivalências', `<p>${sel.size} par(es) código × título serão marcados como <strong>validados</strong> por <strong>${esc(op)}</strong>.</p>${divergentes ? `<p class="badge warn">${divergentes} título(s) já validados para outro código: validar aqui cria conflito, e o conflito bloqueia confirmações até ser resolvido.</p>` : ''}<label class="campo">Justificativa (opcional)<input type="text" name="motivo" placeholder="ex.: conferido com a tabela TUSS e o laudo"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Validar']]);
    if (ok.botao !== 'ok') return;
    const ids = [];
    for (const x of sel) {
      let rel = x.relacao && S.eq.itens.find(e => e.id === x.relacao.id);
      if (!rel) { rel = novaRelacao({ codigo: x.codigo, descMV: x.descMV, titulo: x.titulo, origem: 'cadastrada na validação de uma rodada' }); S.eq.itens.push(rel); }
      ids.push(rel.id);
    }
    const n = alterarStatusEq(S.eq, ids, 'validada', op, ok.campos.motivo || 'validada a partir dos resultados de uma rodada');
    salvarEq(`${n} equivalência(s) validada(s). Reprocesse para aplicar.`);
    aoReprocessar();
  };
}
