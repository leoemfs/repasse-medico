/* ============================================================
 * Conferência → «O que falta decidir» (SOL-F40)
 * As pendências agrupadas pela decisão que as resolve; a ação fica na própria causa. Depois de decidir uma
 * equivalência, a conferência roda de novo sozinha (mesmo relatório, unidade e parâmetros).
 * ============================================================ */
const rotLinhaCz = x => `${x.r?.paciente || x.l?.paciente || '—'} · ${fmtData(x.r?.data || x.l?.data)}${x.r ? ` · ${x.r.codigo} ${x.r.procDesc || ''}` : ''}${x.l ? ` × «${x.l.titulo}»` : ''}`;
function botoesCausa(c, n) {
  const b = (ac, t, sec = true) => `<button class="${sec ? 'sec ' : ''}mini" data-cz="${n}" data-cza="${ac}">${t}</button>`, ver = c.linhas.length > 1 ? b('ver', `Ver as ${c.linhas.length} linhas`) : b('ver', 'Ver a linha');
  switch (c.tipo) {
    case 'eq-pendente': return b('validar', 'Validar e conferir de novo', false) + b('nao-eq', 'Não é equivalente') + ver;
    case 'eq-sem-cadastro': return b('cadastrar', 'Cadastrar, validar e conferir de novo', false) + ver;
    case 'eq-divergente': return (c.outros.length ? b('ou', 'Um ou outro (os dois códigos valem)', false) : b('cadastrar', 'Validar este par e conferir de novo', false)) + b('nc', 'Lançamento errado → NC') + ver;
    case 'eq-conflito': return b('equivalencias', 'Resolver em Equivalências', false) + ver;
    case 'convenio': return b('aceitar', `Aceitar ${c.linhas.length > 1 ? `as ${c.linhas.length} ` : ''}(mesmo convênio)`, false) + b('nc', 'Registrar NC') + ver;
    case 'data': return b('aceitar', `Aceitar ${c.linhas.length > 1 ? `as ${c.linhas.length} ` : ''}(data dentro do esperado)`, false) + ver;
    case 'composta-falta': return b('nc', 'Registrar NC do que falta', false) + b('aceitar', 'Considerar no repasse') + ver;
    case 'so-laudo': return b('ncs', 'Ir para os candidatos a NC', false) + ver;
    case 'hm': case 'classificacao': return b('bases', 'Abrir Bases', false) + ver;
    case 'repetida': return b('nc', 'Esta é a repetida → NC', false) + b('aceitar', 'As duas estão certas') + ver;
    case 'nome-semelhante': return b('aceitar', 'É o mesmo paciente', false) + b('nc', 'Não é → NC') + ver;
    default: return b('nc', 'Registrar NC', false) + b('aceitar', 'Considerar no repasse…') + ver;
  }
}
function cartaoCausas(CZ, res) {
  if (!CZ.faltam) return '';
  const MAX = S.conf.umaMais ? 1e9 : 25;
  const item = (c, n) => `<div class="cz${c.tipo === 'so-laudo' ? ' cz-sl' : ''}"><div><b>${esc(c.rotulo)}</b><small>${esc(c.acao)}${c.vl ? ` · R$ ${fmtBR(c.vl)} no MV` : ''}${c.linhas.length === 1 && res.linhas[c.linhas[0]] ? ` · ${esc(rotLinhaCz(res.linhas[c.linhas[0]]))}` : ''}</small>
    <div class="acoes" style="margin:6px 0 0">${botoesCausa(c, n)}</div></div><div class="cz-n">${c.linhas.length}<small>linha${c.linhas.length > 1 ? 's' : ''}</small></div></div>`;
  return `<div class="card" id="cfCausas"><h2>O que falta decidir <span class="muted small">${CZ.faltam} decisão(ões), da que resolve mais linhas para a que resolve menos</span></h2>
    ${CZ.grupos.map((c, n) => item(c, n)).join('')}
    ${CZ.umaUma.length ? `<div class="cz-sep">Uma a uma (${CZ.umaUma.length} linha${CZ.umaUma.length > 1 ? 's' : ''})</div>${CZ.umaUma.slice(0, MAX).map((c, n) => item(c, CZ.grupos.length + n)).join('')}
      ${CZ.umaUma.length > MAX ? `<button class="sec mini" id="czMais">Mostrar as outras ${CZ.umaUma.length - MAX}</button>` : ''}` : ''}
    <p class="small muted">Decisões de equivalência valem para todos os relatórios (e para a outra pessoa, com a pasta conectada) e a conferência roda de novo sozinha. As de linha (NC, considerar no repasse) ficam na competência, como antes.</p></div>`;
}
// Considerar no repasse várias linhas de uma vez, com uma justificativa (já sugerida).
async function considerarLinhas(res, idxs, titulo, sugestao) {
  if (!exigirAberta(S.comp, 'registrar decisões')) return false;
  const op = await exigirOperador(); if (!op) return false;
  const r = await dialogo(idxs.length > 1 ? `Aceitar ${idxs.length} linhas` : 'Aceitar a linha', `<p class="small">${esc(titulo)}</p><p class="small muted">As linhas entram no repasse e deixam de contar como pendência no aceite. A decisão vale para toda nova rodada da competência ${rotuloCompetencia(S.comp)}.</p>
    <label class="campo">Justificativa (obrigatória)<input type="text" name="just" value="${esc(sugestao)}"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Aceitar']]);
  if (r.botao !== 'ok') return false;
  if (!r.campos.just.trim()) { avisar('Informe a justificativa.', 'warn'); return false; }
  for (const i of idxs) { const x = res.linhas[i]; if (x.r) registrarConsiderar(S.compReg, S.comp, chavesDaLinha(x.r, x.l), r.campos.just.trim(), op, { codigo: x.r.codigo, desc: x.r.procDesc, titulo: x.l?.titulo || '' }); }
  salvarCompReg(); avisar(`${idxs.length} linha(s) aceita(s) nesta competência.`, 'ok');
  return true;
}
async function decidirEquivalenciaCausa(c, acao) {
  const op = await exigirOperador(); if (!op) return false;
  const doPar = S.eq.itens.filter(e => e.codigo === c.codigo && chaveTitulo(e.titulo) === chaveTitulo(c.titulo));
  if (acao === 'validar' || acao === 'nao-eq') {
    const alvo = doPar.filter(e => e.status === 'pendente' || e.status === 'coberta');
    const r = await dialogo(acao === 'validar' ? 'Validar a equivalência' : 'Não é equivalente', `<p><b>«${esc(c.titulo)}»</b> × <b>${esc(c.codigo)}</b> ${esc(c.desc)}</p><p class="small muted">${acao === 'validar' ? `Vale para todos os relatórios. Responsável: ${esc(op)}.${c.ambigua ? ' <b>Relação marcada como ambígua na análise:</b> confirme que o título identifica este código.' : ''}` : 'A relação fica desativada; as linhas continuam pendentes (procedimento diverge) até uma NC ou outra decisão.'}</p>
      <label class="campo">Justificativa${acao === 'validar' ? ' (recomendada)' : ' (obrigatória)'}<input type="text" name="just"></label>`, [['', 'Cancelar', 'sec'], ['ok', acao === 'validar' ? 'Validar e conferir de novo' : 'Desativar e conferir de novo']]);
    if (r.botao !== 'ok') return false;
    if (acao === 'nao-eq' && !r.campos.just.trim()) { avisar('Informe a justificativa.', 'warn'); return false; }
    alterarStatusEq(S.eq, alvo.map(e => e.id), acao === 'validar' ? 'validada' : 'desativada', op, r.campos.just || '', S.comp);
  } else if (acao === 'cadastrar') {
    const r = await dialogo('Cadastrar e validar a equivalência', `<p><b>«${esc(c.titulo)}»</b> × <b>${esc(c.codigo)}</b> ${esc(c.desc)}</p><p class="small muted">Vale para todos os relatórios. Responsável: ${esc(op)}.</p><label class="campo">Justificativa (recomendada)<input type="text" name="just"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Validar e conferir de novo']]);
    if (r.botao !== 'ok') return false;
    let e = doPar.find(x => x.escopo?.unidade === '*' && x.escopo?.modalidade === '*');
    if (!e) { e = novaRelacao({ codigo: c.codigo, titulo: c.titulo, descMV: c.desc, escopo: { unidade: '*', modalidade: '*' }, justificativa: r.campos.just || '', origem: `conferência (${op})` }); S.eq.itens.push(e); }
    alterarStatusEq(S.eq, [e.id], 'validada', op, r.campos.just || 'validada na conferência', S.comp);
  } else if (acao === 'ou') {
    const cods = [...new Set([...c.outros, c.codigo])];
    const r = await dialogo(`«${c.titulo}»: um código ou outro`, `<p class="small">Cria uma regra composta <b>validada</b> por ${esc(op)}: o título confirma <b>uma</b> linha com qualquer um destes códigos: <b>${cods.map(esc).join(', ')}</b>.</p><label class="campo">Justificativa (obrigatória)<input type="text" name="just"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Criar e conferir de novo']]);
    if (r.botao !== 'ok') return false;
    if (!r.campos.just.trim()) { avisar('Informe a justificativa.', 'warn'); return false; }
    const nova = novaComposta({ nome: `${c.titulo.slice(0, 50)} (um ou outro)`, titulos: [c.titulo], itens: [{ rotulo: 'um dos códigos', codigos: cods, qtd: 1, excecoes: [] }], justificativa: r.campos.just.trim(), origem: `conferência (${op})` });
    (S.eq.compostas ||= []).push(nova); alterarStatusComposta(S.eq, nova.id, 'validada', op, r.campos.just.trim(), S.comp);
  }
  salvarEq('Equivalência atualizada. Conferindo de novo…');
  await executarConferencia();
  return true;
}
function ligarCausas(raiz, CZ, res, ctx) {
  const todas = [...CZ.grupos, ...CZ.umaUma];
  if ($('czMais')) $('czMais').onclick = () => { S.conf.umaMais = true; desenharConferencia(); };
  raiz.querySelectorAll('[data-cz]').forEach(b => b.onclick = async () => {
    const c = todas[+b.dataset.cz], ac = b.dataset.cza; let ok = false;
    if (ac === 'ver') { S.conf.filtroLinhas = { idx: c.linhas, titulo: c.rotulo }; desenharConferencia(); $('cfTab')?.scrollIntoView({ block: 'start' }); return; }
    if (ac === 'equivalencias') { location.hash = 'equivalencias'; return; }
    if (ac === 'bases') { location.hash = 'bases'; return; }
    if (ac === 'ncs') { const h = [...$('cfRes').querySelectorAll('.card h2')].find(x => /NC/.test(x.textContent)); h ? h.scrollIntoView({ behavior: 'smooth', block: 'start' }) : (location.hash = 'nc'); return; }
    if (['validar', 'nao-eq', 'cadastrar', 'ou'].includes(ac)) { await decidirEquivalenciaCausa(c, ac); return; }
    if (ac === 'nc') ok = await abrirRegistroNC(c.linhas.map(i => candidatoDaLinhaConferencia(res.linhas[i], ctx, S.cfg)));
    if (ac === 'aceitar') {
      const sug = c.tipo === 'convenio' ? `Mesmo convênio escrito de outro jeito: MV «${c.mv}» × laudo «${c.laudo}»` : c.tipo === 'data' ? 'Data do laudo dentro do esperado para o atendimento' : c.tipo === 'nome-semelhante' ? 'Mesmo paciente: nome escrito de outro jeito' : c.tipo === 'repetida' ? 'As duas linhas estão certas (dois exames)' : '';
      ok = await considerarLinhas(res, c.linhas, c.rotulo, sug);
    }
    if (ok) { aplicarDecisoes(res, indiceDecisoesComp()); desenharConferencia(); }
  });
}
