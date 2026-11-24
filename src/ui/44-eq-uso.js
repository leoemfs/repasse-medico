/* ============================================================
 * Equivalências → «Uso nas conferências» (SOL-F50, v3.0.0-alpha.24; prévia aprovada em 23/11/2026)
 * O que cada relação validada e cada regra composta confirmou nas conferências, por competência, prestador e
 * unidade; o que está parado ou nunca foi usado; e o impacto antes de tirar uma validação.
 * O uso vem dos resumos de cada conferência (S.usoEq), juntados pela pasta da rede: os dois computadores veem o mesmo.
 * ============================================================ */
const FU = { tipo: 'relacoes', sit: '*', busca: '', janela: 3, grupo: '*', sel: new Set() };
const ARQ_USO_EQ = 'uso_equivalencias.json';
const COR_USO = { 'em-uso': 'ok', parada: 'warn', 'nunca-usada': 'err' };
const seloUso = s => `<span class="badge ${COR_USO[s] || ''}">${esc(SIT_USO[s] || s)}</span>`;
const compDoImpacto = uso => uso.competencias.includes(S.comp) ? S.comp : uso.competencias.at(-1) || S.comp;

/* ---------- Registro e sincronização dos resumos ---------- */
// Chamado por guardarRodada (00-base.js) a cada conferência registrada.
function registrarUsoDaRodada(r) {
  const x = resumoUsoDaRodada(r, S.eq); if (!x) return;
  S.usoEq = mesclarUsoEq(S.usoEq, { resumos: { [x.k]: x } }); gravarLocal(CHAVES.usoEq, S.usoEq);
  clearTimeout(registrarUsoDaRodada.t); registrarUsoDaRodada.t = setTimeout(() => sincronizarUsoEq(), 800);
}
// Junta os resumos do navegador com os da pasta («01 - Sistema › Equivalências TUSS › uso_equivalencias.json»). Sem conflito:
// por relatório vale o resumo mais recente.
async function sincronizarUsoEq() {
  if (!SY.handle || SY.legado || sincronizarUsoEq.ocupado) return;
  if (!(await temPermissaoPasta(false))) return;
  sincronizarUsoEq.ocupado = true;
  try {
    const dir = await dirEq(); let remoto = null;
    try { const d = JSON.parse(await (await (await dir.getFileHandle(ARQ_USO_EQ)).getFile()).text()); if (d.schema === SCHEMA_USO_EQ) remoto = d; }
    catch (e) { if (e.name !== 'NotFoundError' && !(e instanceof SyntaxError)) throw e; }
    const junto = mesclarUsoEq(S.usoEq, remoto);
    if (JSON.stringify(junto.resumos) !== JSON.stringify(S.usoEq?.resumos || {})) { S.usoEq = junto; gravarLocal(CHAVES.usoEq, S.usoEq); if (location.hash === '#equivalencias' && FE.sub === 'uso') desenharUsoEq(); }
    if (JSON.stringify(junto.resumos) !== JSON.stringify(remoto?.resumos || {})) {
      const w = await (await dir.getFileHandle(ARQ_USO_EQ, { create: true })).createWritable();
      await w.write(JSON.stringify({ ...junto, atualizadoEm: agoraISO(), atualizadoPor: S.operador || '', motor: MOTOR_VERSAO })); await w.close();
    }
  } catch (e) { console.warn('Uso das equivalências: não sincronizou com a pasta', e); }
  finally { sincronizarUsoEq.ocupado = false; }
}

/* ---------- Textos usados também na Base de equivalências ---------- */
function textoUsoHtml(uso, e) {
  const u = uso.relacoes.get(e.id);
  if (u?.linhas) { const s = uso.situacao(u); return `${u.linhas.toLocaleString('pt-BR')} linha(s) · últ. ${esc(rotuloCompetencia(u.ultima))}${s === 'parada' ? ' <span class="badge warn">parada</span>' : ''}`; }
  return e.status === 'validada' && uso.competencias.length ? '<span class="badge err">nunca usada</span>' : '—';
}
function detalheUsoRelacao(uso, e) {
  const u = uso.relacoes.get(e.id); if (!u?.linhas) return '';
  return `<h4>Uso nas conferências</h4><p class="small">${u.linhas} linha(s) confirmada(s) · ${[...u.porComp].sort((a, b) => a[0].localeCompare(b[0])).map(([c, x]) => `${esc(rotuloCompetencia(c))}: ${x.linhas}`).join(' · ')} · ${u.prestadores.size} prestador(es)</p>`;
}
function textoImpacto(imp, n, comp) {
  if (!imp.comUso) return `<p class="small muted">${n === 1 ? 'Esta relação não confirmou' : `Nenhuma das ${n} confirmou`} linhas nas conferências: sem impacto.</p>`;
  return `<div class="aviso-fixo warn small" style="margin:8px 0"><b>Impacto:</b> ${imp.comUso} de ${n} confirmaram <b>${imp.linhasTotal.toLocaleString('pt-BR')} linha(s)</b> nas conferências, <b>${imp.linhasComp.toLocaleString('pt-BR')} em ${esc(rotuloCompetencia(comp))}</b> (${imp.relatoriosComp} relatório(s)). Na próxima conferência, essas linhas ficam <b>Pendente</b>. Rodadas e aceites já feitos não mudam.</div>`;
}
const motivoComUso = (motivo, imp) => [String(motivo || '').trim(), imp?.comUso ? `uso: ${imp.linhasTotal} linha(s) nas conferências` : ''].filter(Boolean).join(' · ');

/* ---------- Subaba ---------- */
function desenharUsoEq() {
  const pg = $('pag-equivalencias'), uso = usoEquivalencias(S.usoEq, S.eq, { janela: FU.janela, grupo: FU.grupo });
  const rel = FU.tipo === 'relacoes', descCod = cd => (S.eq.catalogoTUSS || []).find(t => t.codigo === cd)?.desc || '';
  const noGrupo = e => FU.grupo === '*' || grupoDaRelacaoEq(e) === FU.grupo;
  const todas = rel
    ? S.eq.itens.filter(e => (e.status === 'validada' || uso.relacoes.has(e.id)) && noGrupo(e)).map(e => ({ id: e.id, e, u: uso.relacoes.get(e.id), status: e.status, texto: `${e.codigo} ${e.descMV} ${e.titulo}` }))
    : (S.eq.compostas || []).filter(c => c.status === 'validada' || uso.compostas.has(c.id)).map(c0 => { const c = regraComposta(c0); return { id: c.id, c, u: uso.compostas.get(c.id), status: c.status, texto: `${nomeComposta(c)} ${c.titulos.join(' ')} ${codigosDaRegra(c).join(' ')}` }; });
  for (const x of todas) x.sit = uso.situacao(x.u);
  const val = todas.filter(x => x.status === 'validada'), cont = s => val.filter(x => x.sit === s).length;
  const q = norm(FU.busca), lista = todas.filter(x => (FU.sit === '*' || x.sit === FU.sit) && (!q || norm(x.texto).includes(q)))
    .sort((a, b) => (b.u?.linhas || 0) - (a.u?.linhas || 0) || (a.e ? a.e.titulo.localeCompare(b.e.titulo) : nomeComposta(a.c).localeCompare(nomeComposta(b.c))));
  for (const id of [...FU.sel]) if (!lista.some(x => x.id === id && x.status === 'validada')) FU.sel.delete(id);
  const ultimas = uso.competencias.slice(-4), compAtual = compDoImpacto(uso);
  const linhasAtual = val.reduce((s, x) => s + (x.u?.porComp.get(compAtual)?.linhas || 0), 0), vlAtual = val.reduce((s, x) => s + (x.u?.porComp.get(compAtual)?.vlRepasse || 0), 0);
  const kpi = (k, cor, n, t) => `<button type="button" class="nc-kpi" data-usosit="${k}" style="cursor:pointer;font:inherit;text-align:left;color:var(--text);width:100%${FU.sit === k && k !== '*' ? ';box-shadow:0 0 0 2px var(--accent) inset' : ''}"><b${cor ? ` style="color:var(--${cor})"` : ''}>${n}</b>${t}</button>`;
  pg.innerHTML = `<div class="card"><h2>Equivalências TUSS <span class="muted small">revisão ${S.eq.revisao}</span></h2>${abasEq()}</div>
    <div class="card" id="cardUsoEq"><h2>Uso nas conferências <span class="muted small">${uso.competencias.length ? `${uso.competencias.map(rotuloCompetencia).join(' · ')} · conferência mais recente de cada relatório` : 'nenhuma conferência registrada ainda'}</span></h2>
    <p class="lead">Quantas linhas do MV cada ${rel ? 'relação validada' : 'regra composta validada'} confirmou («Conferido» ou «com ressalva»). Mostra o que sustenta a conferência automática, o que <b>parou</b> de ser usado (o título pode ter mudado no Apolo ou o código no MV) e o que <b>nunca</b> foi usado — e o impacto antes de tirar uma validação.</p>
    <div class="nc-kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">${kpi('em-uso', 'ok', cont('em-uso'), `em uso <small style="display:block">(últimas ${uso.recentes.length || FU.janela} competência(s))</small>`)}${kpi('parada', 'warn', cont('parada'), 'paradas <small style="display:block">(usadas antes, não agora)</small>')}${kpi('nunca-usada', 'err', cont('nunca-usada'), 'nunca usadas')}${kpi('*', '', linhasAtual.toLocaleString('pt-BR'), `linhas confirmadas em ${esc(rotuloCompetencia(compAtual))}<small style="display:block">R$ ${fmtBR(vlAtual)} de Vl Repasse</small>`)}</div>
    <div class="filtros">
      <label class="campo">Mostrar<select id="usoTipo">${opcoes([['relacoes', 'Relações código × título'], ['compostas', 'Regras compostas']], FU.tipo)}</select></label>
      <label class="campo">Grupo<select id="usoGr">${opcoes([['*', 'Todos'], ['usg', 'USG (com Doppler)'], ['img', 'IMG (TC, RM, RX, MG, densitometria)']], FU.grupo)}</select></label>
      <label class="campo">«Em uso» = usada nas últimas<select id="usoJan">${opcoes([[1, '1 competência'], [2, '2 competências'], [3, '3 competências'], [6, '6 competências']], FU.janela)}</select></label>
      <label class="campo">Buscar<input type="search" id="usoBusca" value="${esc(FU.busca)}" placeholder="${rel ? 'código, descrição ou TITLE' : 'nome, título ou código'}"></label></div>
    <div class="acoes"><label class="small"><input type="checkbox" id="usoTodos"> selecionar as validadas do filtro</label>
      <button id="usoPend" class="sec"${FU.sel.size ? '' : ' disabled'}>Voltar a pendente…</button>${rel ? `<button id="usoDes" class="perigo"${FU.sel.size ? '' : ' disabled'}>Desativar…</button>` : ''}
      <span class="muted small">${FU.sel.size ? `${FU.sel.size} selecionada(s)` : ''}</span><button id="usoXlsx" class="sec" style="margin-left:auto">Exportar uso (.xlsx)</button></div>
    <div id="usoTab" style="margin-top:10px"></div>
    <p class="small muted">«Nunca usada» não quer dizer que está errada: o exame pode ser raro. «Parada» merece revisão. Grupo: relatórios de USG ou de IMG (Curitiba entra nos dois). O uso vem do resumo de cada conferência, juntado pela pasta da rede.</p></div>`;
  ligarAbasEq(pg);
  const porComp = u => `<span style="display:inline-flex;gap:2px;align-items:flex-end;height:22px;vertical-align:middle" title="${esc(ultimas.map(c => `${rotuloCompetencia(c)}: ${u?.porComp.get(c)?.linhas || 0}`).join(' · '))}">${(() => { const m = Math.max(1, ...ultimas.map(c => u?.porComp.get(c)?.linhas || 0)); return ultimas.map(c => { const n = u?.porComp.get(c)?.linhas || 0; return `<i style="display:block;width:9px;border-radius:2px 2px 0 0;background:var(${n ? '--accent' : '--line'});height:${n ? Math.max(3, Math.round(n / m * 22)) : 2}px"></i>`; }).join(''); })()}</span>`;
  const prest = u => u ? [...u.prestadores].map(([c, n]) => `${c} - ${n}`) : [];
  const colsRel = [{ t: 'Código', v: x => x.e.codigo }, { t: 'Descrição MV', v: x => x.e.descMV || descCod(x.e.codigo) }, { t: 'TITLE do Apolo', v: x => x.e.titulo },
    { t: 'Escopo', v: x => `${x.e.escopo.unidade === '*' ? 'todas' : 'unid. ' + x.e.escopo.unidade}${x.e.escopo.modalidade === '*' ? '' : ' · ' + x.e.escopo.modalidade}` }, { t: 'Grupo', v: x => grupoDaRelacaoEq(x.e).toUpperCase() }];
  const colsCmp = [{ t: 'Regra composta', html: x => `<b>${esc(nomeComposta(x.c))}</b><div class="small muted">${esc(leituraRegraComposta(x.c, descCod, true))}</div>` }, { t: 'Títulos', v: x => x.c.titulos.join(' · ') }];
  tabela($('usoTab'), {
    porPagina: 100, linhas: lista, vazio: uso.competencias.length || FU.grupo !== '*' ? 'Nada neste filtro.' : 'Nenhuma conferência registrada ainda: rode as conferências da competência para ver o uso.',
    colunas: [
      { t: '', html: x => x.status === 'validada' ? `<input type="checkbox" data-uso="${esc(x.id)}"${FU.sel.has(x.id) ? ' checked' : ''} aria-label="Selecionar">` : '' },
      ...(rel ? colsRel : colsCmp),
      { t: 'Situação de uso', html: x => x.status === 'validada' ? seloUso(x.sit) : `<span class="badge info">${esc(STATUS_EQ[x.status] || x.status)} hoje</span>` },
      { t: 'Linhas confirmadas', n: true, html: x => `<b>${(x.u?.linhas || 0).toLocaleString('pt-BR')}</b>${x.u?.ressalvas ? ` <span class="small muted">(${x.u.ressalvas} c/ ressalva)</span>` : ''}` },
      { t: ultimas.length ? `${rotuloCompetencia(ultimas[0]).slice(0, 2)} → ${rotuloCompetencia(ultimas.at(-1))}` : 'Competências', html: x => porComp(x.u) },
      { t: 'Última com uso', v: x => x.u?.ultima ? rotuloCompetencia(x.u.ultima) : '—' },
      { t: 'Prestadores', n: true, html: x => { const p = prest(x.u); return p.length ? `<span title="${esc(p.join('\n'))}">${p.length}</span>` : '0'; } },
      { t: `Vl Repasse em ${rotuloCompetencia(compAtual)}`, n: true, v: x => x.u?.porComp.get(compAtual)?.vlRepasse ? fmtBR(x.u.porComp.get(compAtual).vlRepasse) : '' },
      { t: 'Validada por', v: x => { const o = x.e || x.c; return o.responsavel ? `${o.responsavel}${o.validadoEm ? ' · ' + new Date(o.validadoEm).toLocaleDateString('pt-BR') : ''}` : ''; } }
    ],
    detalhe: x => {
      const u = x.u, cs = u ? [...u.porComp].sort((a, b) => b[0].localeCompare(a[0])) : [], h = ((x.e || x.c).historico || []).at(-1);
      return `<div class="det"><div><h4>Por competência</h4>${cs.length ? `<table class="small"><thead><tr><th>Competência</th><th class="n">Confirmadas</th><th class="n">Com ressalva</th><th class="n">Pareadas sem confirmar</th><th class="n">Relatórios</th><th class="n">Vl Repasse</th></tr></thead><tbody>
        ${cs.map(([c, p]) => `<tr><td>${esc(rotuloCompetencia(c))}</td><td class="n">${p.linhas}</td><td class="n">${p.ressalvas}</td><td class="n">${p.naoConfirmadas}</td><td class="n">${p.relatorios.size}</td><td class="n">${fmtBR(p.vlRepasse)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">Nenhuma linha nas conferências registradas.</p>'}
        ${u?.naoConfirmadas ? `<p class="small muted">${u.naoConfirmadas} linha(s) casaram título e código, mas ficaram pendentes por outro motivo (médico, data, nome, mais de um laudo).</p>` : ''}</div>
        <div><h4>Prestadores e unidades</h4>${prest(u).length ? `<ul class="small">${prest(u).map(p => `<li>${esc(p)}</li>`).join('')}</ul><p class="small">Unidades: ${esc([...u.unidades].sort((a, b) => +a - +b).join(', ') || '—')}</p>` : '<p class="muted small">—</p>'}
        <h4>Última mudança</h4><p class="small">${h ? `${new Date(h.em).toLocaleString('pt-BR')} · ${esc(h.por || '—')}: ${esc(STATUS_EQ[h.de] || h.de)} → ${esc(STATUS_EQ[h.para] || h.para)}${h.motivo ? ` (${esc(h.motivo)})` : ''}` : '—'}</p></div></div>`;
    }
  });
  const ligarSel = () => $('usoTab').querySelectorAll('[data-uso]').forEach(ch => ch.onchange = () => { ch.checked ? FU.sel.add(ch.dataset.uso) : FU.sel.delete(ch.dataset.uso); desenharUsoEq(); });
  ligarSel(); new MutationObserver(ligarSel).observe($('usoTab'), { childList: true });
  pg.querySelectorAll('[data-usosit]').forEach(b => b.onclick = () => { FU.sit = FU.sit === b.dataset.usosit || b.dataset.usosit === '*' ? '*' : b.dataset.usosit; desenharUsoEq(); });
  $('usoTipo').onchange = e => { FU.tipo = e.target.value; FU.sel.clear(); desenharUsoEq(); };
  $('usoGr').onchange = e => { FU.grupo = e.target.value; desenharUsoEq(); };
  $('usoJan').onchange = e => { FU.janela = +e.target.value; desenharUsoEq(); };
  $('usoBusca').oninput = e => { FU.busca = e.target.value; clearTimeout(desenharUsoEq.t); desenharUsoEq.t = setTimeout(() => { desenharUsoEq(); const i = $('usoBusca'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
  $('usoTodos').onchange = e => { FU.sel = new Set(e.target.checked ? lista.filter(x => x.status === 'validada').map(x => x.id) : []); desenharUsoEq(); };
  $('usoXlsx').onclick = () => baixarZip(xlsxUsoEquivalencias(S.eq, usoEquivalencias(S.usoEq, S.eq, { janela: FU.janela }), { operador: S.operador }), `uso_equivalencias_rev${S.eq.revisao}_${carimbo()}.xlsx`);
  const tirar = async status => {
    const op = await exigirOperador(); if (!op) return;
    const ids = [...FU.sel], tipo = rel ? 'relacoes' : 'compostas', imp = impactoTirarValidacao(uso, ids, compAtual, tipo), exige = !!imp.comUso;
    const rotulo = status === 'desativada' ? 'Desativar' : 'Voltar a pendente';
    const r = await dialogo(`${rotulo}: ${ids.length} ${rel ? 'relação(ões)' : 'regra(s) composta(s)'}`, `<p>Responsável: <strong>${esc(op)}</strong>.</p>${textoImpacto(imp, ids.length, compAtual)}<label class="campo">Justificativa${exige ? ' (obrigatória: tem uso nas conferências)' : ''}<input type="text" name="motivo"></label>`, [['', 'Cancelar', 'sec'], ['ok', rotulo]]);
    if (r.botao !== 'ok') return;
    if (exige && !(r.campos.motivo || '').trim()) return avisar('Essas equivalências confirmaram linhas nas conferências: informe a justificativa.', 'warn');
    const motivo = motivoComUso(r.campos.motivo, imp);
    const n = rel ? alterarStatusEq(S.eq, ids, status, op, motivo, S.comp) : ids.reduce((s, id) => s + alterarStatusComposta(S.eq, id, status, op, motivo, S.comp), 0);
    FU.sel.clear(); salvarEq(`${n} ${rel ? 'relação(ões)' : 'regra(s) composta(s)'} atualizada(s).`); desenharUsoEq();
  };
  $('usoPend').onclick = () => tirar('pendente');
  if ($('usoDes')) $('usoDes').onclick = () => tirar('desativada');
}
