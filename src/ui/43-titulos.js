/* ============================================================
 * v3.0 — Equivalências → «Títulos do Apolo»: manutenção da base por título, numa tela só.
 * Esquerda: os títulos distintos da planilha de laudos carregada (com quantos laudos, modalidade e situação),
 * pendentes primeiro e os mais frequentes no topo. Direita: o título escolhido lado a lado com o procedimento
 * de destino — sugestões, busca no catálogo, o que já existe na base — e a confirmação (simples, «juntos» ou
 * «um ou outro»). Depois de confirmar, o próximo título pendente já fica selecionado.
 * ============================================================ */
const TT = { busca: '', sit: 'pendentes', mod: '*', unidade: '*', sel: '', escolhidos: [], escopoMod: '*', motivo: '', limite: 200 };
const FILTRO_SIT_TT = { pendentes: ['sem-cadastro', 'conflito', 'pendente'], todos: null, 'sem-cadastro': ['sem-cadastro'], pendente: ['pendente'], conflito: ['conflito'], validada: ['validada'], composta: ['composta'] };
function desenharTitulos() {
  const pg = $('pag-equivalencias');
  if (!S.apolo) {
    pg.innerHTML = `<div class="card"><h2>Títulos do Apolo</h2>${abasEq()}<p class="lead">Carregue a planilha de laudos do Apolo (Início, ou «Atualizar da pasta») para listar os títulos distintos e indicar a equivalência de cada um.</p></div>`;
    ligarAbasEq(pg); return;
  }
  const todos = titulosDoApolo(S.apolo, S.eq, S.cfg, { unidade: TT.unidade }), q = norm(TT.busca), fs = FILTRO_SIT_TT[TT.sit];
  const lista = todos.filter(t => (!fs || fs.includes(t.situacao)) && (TT.mod === '*' || t.modalidade === TT.mod) && (!q || norm(t.variantes.join(' ')).includes(q) || t.codigos.some(c => c.includes(q))));
  const nLaudos = todos.reduce((a, t) => a + t.n, 0), nOk = todos.filter(t => t.situacao === 'validada' || t.situacao === 'composta').reduce((a, t) => a + t.n, 0);
  const cont = k => todos.filter(t => t.situacao === k).length;
  if (!TT.sel || !todos.some(t => t.chave === TT.sel)) { TT.sel = lista[0]?.chave || ''; TT.escolhidos = []; }
  const t = todos.find(x => x.chave === TT.sel), mods = [...new Set(todos.map(x => x.modalidade).filter(Boolean))].sort();
  pg.innerHTML = `<div class="card"><h2>Títulos do Apolo <span class="muted small">${esc(S.apolo.nome || '')}</span></h2>${abasEq()}
    <p class="lead">Um título por linha (não um laudo por linha). <b>${todos.length}</b> títulos distintos em ${nLaudos.toLocaleString('pt-BR')} laudos: <b>${Math.round(nOk / Math.max(1, nLaudos) * 1000) / 10}%</b> dos laudos já têm título validado ou coberto por regra composta.</p>
    <div class="grid4"><div><span class="badge err">${cont('sem-cadastro')}</span> sem equivalência</div><div><span class="badge warn">${cont('pendente')}</span> pendentes de validação</div><div><span class="badge err">${cont('conflito')}</span> em conflito</div><div><span class="badge ok">${cont('validada') + cont('composta')}</span> validados (${cont('composta')} por regra composta)</div></div>
    <div class="filtros">
      <label class="campo">Buscar título<input type="search" id="ttBuscaTit" value="${esc(TT.busca)}" placeholder="parte do título ou código"></label>
      <label class="campo">Situação<select id="ttSit">${opcoes([['pendentes', 'A resolver (sem, pendentes e conflitos)'], ['sem-cadastro', 'Sem equivalência'], ['pendente', 'Pendentes de validação'], ['conflito', 'Em conflito'], ['validada', 'Validados'], ['composta', 'Por regra composta'], ['todos', 'Todos']], TT.sit)}</select></label>
      <label class="campo">Modalidade<select id="ttMod">${opcoes([['*', 'Todas'], ...mods.map(m => [m, `${m} — ${NOME_MODALIDADE[m] || m}`])], TT.mod)}</select></label>
      <label class="campo">Unidade<select id="ttUn">${opcoes([['*', 'Todas'], ...S.cfg.unidades.filter(u => (u.apolo || []).length).map(u => [u.cod, `${u.cod} — ${u.nome}`])], TT.unidade)}</select></label></div></div>
  <div class="tt-grid">
    <div class="card"><div class="tw tt-lista"><table><thead><tr><th>Título do laudo</th><th class="n">Laudos</th><th>Mod.</th><th>Situação</th></tr></thead><tbody>
      ${lista.slice(0, TT.limite).map(x => `<tr class="tt-titulo${x.chave === TT.sel ? ' on' : ''}" data-tt="${esc(x.chave)}" tabindex="0"><td>${esc(x.titulo)}${x.variantes.length > 1 ? ` <span class="small muted">(+${x.variantes.length - 1} grafia${x.variantes.length > 2 ? 's' : ''})</span>` : ''}${x.codigos.length ? `<br><span class="small muted">${esc(x.codigos.join(x.situacao === 'composta' ? ' + ' : ', '))}</span>` : ''}</td><td class="n">${x.n.toLocaleString('pt-BR')}</td><td>${esc(x.modalidade)}</td><td><span class="badge ${SITUACAO_TITULO[x.situacao].cls}">${SITUACAO_TITULO[x.situacao].nome}</span></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nenhum título neste filtro.</td></tr>'}
    </tbody></table></div>${lista.length > TT.limite ? `<div class="acoes"><button class="sec mini" id="ttMais">Mostrar mais ${Math.min(200, lista.length - TT.limite)} de ${lista.length - TT.limite}</button></div>` : ''}</div>
    <div class="card tt-painel" id="ttPainel">${t ? painelTitulo(t) : '<p class="muted">Escolha um título na lista.</p>'}</div>
  </div>`;
  ligarAbasEq(pg); ligarBuscas(pg);
  let tm = 0; $('ttBuscaTit').oninput = e => { clearTimeout(tm); tm = setTimeout(() => { TT.busca = e.target.value; TT.sel = ''; desenharTitulos(); const i = $('ttBuscaTit'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
  $('ttSit').onchange = e => { TT.sit = e.target.value; TT.sel = ''; desenharTitulos(); };
  $('ttMod').onchange = e => { TT.mod = e.target.value; TT.sel = ''; desenharTitulos(); };
  $('ttUn').onchange = e => { TT.unidade = e.target.value; TT.sel = ''; desenharTitulos(); };
  if ($('ttMais')) $('ttMais').onclick = () => { TT.limite += 200; desenharTitulos(); };
  pg.querySelectorAll('[data-tt]').forEach(tr => { const ir = () => { TT.sel = tr.dataset.tt; TT.escolhidos = []; TT.motivo = ''; desenharTitulos(); }; tr.onclick = ir; tr.onkeydown = e => { if (e.key === 'Enter') ir(); }; });
  if (t) ligarPainelTitulo(t, lista);
}
function painelTitulo(t) {
  const cat = catalogo('tuss', S.cfg, contextoCatalogo()), desc = c => cat.find(x => String(x.cod) === String(c))?.nome || '';
  const sug = sugerirCodigos(t.titulo, cat, S.eq, { modalidade: t.modalidade });
  const fmtEx = e => `${e.data ? fmtData(e.data) : 'sem data'} · ${esc(e.unidade)} · ${esc(e.medico || 'sem médico')} · ${esc(e.convenio || '—')}${e.descricao && norm(e.descricao) !== norm(t.titulo) ? ` · «${esc(e.descricao)}»` : ''}`;
  const rel = t.relacoes.filter((x, i, a) => a.findIndex(y => y.id === x.id) === i);
  if (!TT.escopoMod || (TT.escopoMod !== '*' && TT.escopoMod !== t.modalidade)) TT.escopoMod = '*';
  return `<h3 style="margin-top:0">«${esc(t.titulo)}»</h3>
    <p class="small"><span class="badge ${SITUACAO_TITULO[t.situacao].cls}">${SITUACAO_TITULO[t.situacao].nome}</span> · <b>${t.n.toLocaleString('pt-BR')}</b> laudo(s) · ${t.modalidades.map(([m, n]) => `${esc(m)} ${n}`).join(', ') || 'sem modalidade'} · ${t.nMedicos} médico(s) · ${t.unidades.slice(0, 3).map(([u, n]) => `${esc(u)} (${n})`).join(', ')}${t.unidades.length > 3 ? '…' : ''}</p>
    ${t.variantes.length > 1 ? `<p class="small muted">Grafias no Apolo: ${t.variantes.slice(0, 5).map(v => `«${esc(v)}»`).join(', ')}</p>` : ''}
    <details class="small"><summary>Exemplos de laudos (sem nome de paciente)</summary><ul>${t.exemplos.map(e => `<li>${fmtEx(e)}</li>`).join('')}</ul></details>
    ${t.composta ? `<div class="linha-ini small" style="margin:8px 0"><b>Regra composta validada:</b> «${esc(nomeComposta(t.composta))}» = ${esc(textoEsperados(esperadosDaComposta(t.composta, '')))} <button class="sec mini" id="ttAbrirRegra">Abrir regra…</button></div>` : ''}
    <h4>Na base hoje</h4>
    ${rel.length ? `<ul class="tt-sug small">${rel.map(e => `<li><span><b>${esc(e.codigo)}</b> ${esc(e.descMV || desc(e.codigo))} <span class="muted">· ${STATUS_EQ[e.status]}${e.escopo?.modalidade && e.escopo.modalidade !== '*' ? ` · só ${esc(e.escopo.modalidade)}` : ''}${e.responsavel ? ` · ${esc(e.responsavel)}` : ''}</span></span><span>${e.status !== 'validada' ? `<button class="mini" data-ttval="${esc(e.id)}">Validar</button>` : ''}${e.status !== 'desativada' ? `<button class="sec mini" data-ttdes="${esc(e.id)}">Desativar</button>` : ''}</span></li>`).join('')}</ul>` : '<p class="small muted">Nenhuma relação cadastrada para este título.</p>'}
    <h4>Indicar o procedimento</h4>
    ${sug.length ? `<p class="small muted">Sugestões (nunca validam sozinhas — confira antes):</p><ul class="tt-sug small">${sug.map(s => `<li><label><input type="checkbox" data-ttcod="${esc(s.codigo)}"${TT.escolhidos.includes(s.codigo) ? ' checked' : ''}> <b>${esc(s.codigo)}</b> ${esc(s.desc)} <span class="muted">· ${esc(s.motivos.join(' · '))}</span></label><span class="badge ${s.nota >= 0.7 && !s.incompat ? 'ok' : s.nota >= 0.5 ? 'warn' : 'info'}">${Math.round(s.nota * 100)}%</span></li>`).join('')}</ul>` : '<p class="small muted">Sem sugestão por semelhança: procure pelo código ou pelo nome.</p>'}
    ${campoBusca({ nome: 'ttProc', rotulo: 'Procurar procedimento (código ou descrição do MV/TUSS)', fonte: 'tuss', valorCodigo: true, livre: true })}
    <div class="small" id="ttEscolhidos">${TT.escolhidos.length ? `Escolhido(s): ${TT.escolhidos.map(c => `<span class="cp-chip"><b>${esc(c)}</b> ${esc(desc(c))}<button type="button" data-ttrm="${esc(c)}" aria-label="Tirar">✕</button></span>`).join(' ')}` : '<span class="muted">Nenhum procedimento escolhido.</span>'}</div>
    <div class="grid2" style="margin-top:8px"><label class="campo">Vale para<select id="ttEscopo">${opcoes([['*', 'Qualquer modalidade'], ...(t.modalidade ? [[t.modalidade, `Só ${t.modalidade} (${NOME_MODALIDADE[t.modalidade] || t.modalidade})`]] : [])], TT.escopoMod)}</select></label>
      <label class="campo">Observação (opcional)<input type="text" id="ttMotivo" value="${esc(TT.motivo)}" placeholder="ex.: conferido com o faturamento"></label></div>
    <div class="acoes">${TT.escolhidos.length <= 1 ? `<button id="ttConfirmar"${TT.escolhidos.length ? '' : ' disabled'}>Confirmar equivalência</button>` : `<button id="ttJuntos">Juntos — regra composta…</button><button class="sec" id="ttOu">Um ou outro</button>`}<button class="sec" id="ttPular">Pular</button></div>
    ${TT.escolhidos.length > 1 ? '<p class="small muted">«Juntos»: o laudo sustenta uma linha de cada código (ex.: abdome total = superior + inferior; articular + Doppler). «Um ou outro»: qualquer um dos códigos confirma o laudo.</p>' : ''}`;
}
function ligarPainelTitulo(t, lista) {
  const pn = $('ttPainel'), proximo = () => { const i = lista.findIndex(x => x.chave === t.chave), nx = lista.slice(i + 1).find(x => FILTRO_SIT_TT.pendentes.includes(x.situacao)) || lista.find(x => x.chave !== t.chave && FILTRO_SIT_TT.pendentes.includes(x.situacao)); TT.sel = nx?.chave || ''; TT.escolhidos = []; TT.motivo = ''; };
  const guardarCampos = () => { TT.escopoMod = $('ttEscopo').value; TT.motivo = $('ttMotivo').value; };
  pn.querySelectorAll('[data-ttcod]').forEach(c => c.onchange = () => { guardarCampos(); TT.escolhidos = c.checked ? [...new Set([...TT.escolhidos, c.dataset.ttcod])] : TT.escolhidos.filter(x => x !== c.dataset.ttcod); desenharTitulos(); });
  pn.querySelectorAll('[data-ttrm]').forEach(b => b.onclick = () => { guardarCampos(); TT.escolhidos = TT.escolhidos.filter(x => x !== b.dataset.ttrm); desenharTitulos(); });
  pn.querySelector('[name="ttProc"]').addEventListener('busca-escolha', e => { const v = String(e.detail?.cod || e.target.value || '').replace(/\D/g, ''); if (v.length < 5) return avisar('Escolha um procedimento com código TUSS (5 dígitos ou mais).', 'warn'); guardarCampos(); TT.escolhidos = [...new Set([...TT.escolhidos, v])]; desenharTitulos(); });
  if ($('ttAbrirRegra')) $('ttAbrirRegra').onclick = () => editarComposta(t.composta.id);
  pn.querySelectorAll('[data-ttval]').forEach(b => b.onclick = async () => { const op = await exigirOperador(); if (!op) return; alterarStatusEq(S.eq, [b.dataset.ttval], 'validada', op, 'validada em Títulos do Apolo', S.comp); salvarEq('Equivalência validada.'); desenharTitulos(); });
  pn.querySelectorAll('[data-ttdes]').forEach(b => b.onclick = async () => {
    const e = S.eq.itens.find(x => x.id === b.dataset.ttdes); if (!e) return;
    const r = await dialogo('Desativar equivalência?', `<p class="small">«${esc(e.titulo)}» → <b>${esc(e.codigo)}</b> deixa de valer nas próximas conferências (fica no histórico).</p><label class="campo">Motivo (obrigatório)<input type="text" name="m"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Desativar', 'perigo']]);
    if (r.botao !== 'ok') return; if (!r.campos.m?.trim()) return avisar('Informe o motivo.', 'warn');
    const op = await exigirOperador(); if (!op) return;
    alterarStatusEq(S.eq, [e.id], 'desativada', op, r.campos.m.trim(), S.comp); aplicarCobertas(S.eq, op, S.comp); salvarEq('Equivalência desativada.'); desenharTitulos();
  });
  $('ttPular').onclick = () => { proximo(); desenharTitulos(); };
  const cat = () => catalogo('tuss', S.cfg, contextoCatalogo()), desc = c => cat().find(x => String(x.cod) === String(c))?.nome || '';
  if ($('ttConfirmar')) $('ttConfirmar').onclick = async () => {
    guardarCampos(); const op = await exigirOperador(); if (!op) return;
    const codigo = TT.escolhidos[0], outros = t.codigos.filter(c => c !== codigo && t.situacao !== 'composta');
    let substituir = false;
    if (t.situacao === 'composta') { if (!await confirmar('Título coberto por regra composta', `«${esc(t.titulo)}» já é resolvido pela regra «${esc(nomeComposta(t.composta))}», que vale por cima das relações simples. A relação simples fica registrada, mas a regra continua valendo. Confirmar mesmo assim?`, 'Confirmar')) return; }
    else if (outros.length) {
      const r = await dialogo('O título já está validado para outro código', `<p class="small">«${esc(t.titulo)}» já confirma <b>${esc(outros.join(', '))}</b>. Dois códigos validados para o mesmo título viram <b>conflito</b> e o título deixa de confirmar.</p>
        <label class="small" style="display:block"><input type="radio" name="o" value="sub" checked> Substituir: desativar ${esc(outros.join(', '))} e validar ${esc(codigo)}</label>
        <label class="small" style="display:block"><input type="radio" name="o" value="comp"> São válidos juntos ou um ou outro: montar regra composta com os ${outros.length + 1} códigos</label>`, [['', 'Cancelar', 'sec'], ['ok', 'Continuar']]);
      if (r.botao !== 'ok') return;
      if (r.campos.o === 'comp') { TT.escolhidos = [...new Set([...outros, codigo])]; return desenharTitulos(); }
      substituir = true;
    }
    try {
      confirmarEquivalenciaTitulo(S.eq, { titulo: t.titulo, codigo, descMV: desc(codigo), modalidade: TT.escopoMod, responsavel: op, motivo: TT.motivo, competencia: S.comp });
      if (substituir) { const ids = S.eq.itens.filter(e => e.status === 'validada' && chaveTitulo(e.titulo) === t.chave && e.codigo !== codigo).map(e => e.id); alterarStatusEq(S.eq, ids, 'desativada', op, `substituída por ${codigo} em Títulos do Apolo`, S.comp); }
    } catch (e) { return avisar(e.message, 'err'); }
    salvarEq(`«${t.titulo}» → ${codigo} validada. Rode de novo as conferências da competência para usar a nova equivalência.`); proximo(); desenharTitulos();
  };
  if ($('ttOu')) $('ttOu').onclick = async () => {
    guardarCampos(); const op = await exigirOperador(); if (!op) return;
    if (!await confirmar('Regra «um ou outro»', `«${esc(t.titulo)}» passa a confirmar <b>uma</b> linha com qualquer um destes códigos: ${esc(TT.escolhidos.join(', '))}. A regra fica validada por ${esc(op)}.`, 'Criar regra')) return;
    const nova = novaComposta({ nome: `${t.titulo.slice(0, 50)} (um ou outro)`, titulos: [t.titulo], escopo: { unidade: '*', modalidade: TT.escopoMod || '*' }, itens: [{ rotulo: 'um dos códigos', codigos: [...TT.escolhidos], qtd: 1, excecoes: [] }], justificativa: TT.motivo || 'criada em Títulos do Apolo', origem: 'Títulos do Apolo' });
    S.eq.compostas = S.eq.compostas || []; S.eq.compostas.push(nova); alterarStatusComposta(S.eq, nova.id, 'validada', op, TT.motivo || 'criada em Títulos do Apolo', S.comp); aplicarCobertas(S.eq, op, S.comp);
    salvarEq(`Regra «um ou outro» criada para «${t.titulo}».`); proximo(); desenharTitulos();
  };
  if ($('ttJuntos')) $('ttJuntos').onclick = () => { guardarCampos(); editarComposta(null, novaComposta({ nome: t.titulo.slice(0, 60), titulos: [t.titulo], escopo: { unidade: '*', modalidade: TT.escopoMod || '*' }, itens: TT.escolhidos.map(c => ({ rotulo: (desc(c) || c).replace(/\s*-\s*OP$/, '').slice(0, 40), codigos: [c], qtd: 1, excecoes: [] })), origem: 'Títulos do Apolo' })); };
}
