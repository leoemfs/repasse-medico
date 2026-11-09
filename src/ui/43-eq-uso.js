/* ============================================================
 * Equivalências → «Uso nas conferências» (SOL-F41)
 * O que cada relação validada e cada regra composta confirmou nas rodadas guardadas: linhas por
 * competência, prestadores, unidades e a última competência em que confirmou alguma linha.
 * Achar as que nunca foram usadas ou pararam de ser usadas, e tirar a validação sabendo o impacto.
 * ============================================================ */
const FU = { tipo: 'relacoes', sit: '*', busca: '', janela: 3, sel: new Set() };
const COR_USO = { 'em-uso': 'ok', parada: 'warn', 'nunca-usada': 'err' };
const seloUso = s => `<span class="badge ${COR_USO[s] || ''}">${esc(SIT_USO[s] || s)}</span>`;
// Resumo curto do uso, para a lista da Base de equivalências.
const textoUso = (uso, e) => {
  const u = uso.relacoes.get(e.id);
  if (u?.linhas) return `${u.linhas} linha(s) · últ. ${rotuloCompetencia(u.ultima)}`;
  return e.status === 'validada' && uso.competencias.length ? 'nunca usada' : '—';
};

async function desenharUsoEq() {
  S.rodadas = await dbTodas();
  const pg = $('pag-equivalencias'), uso = usoEquivalencias(S.rodadas, S.eq, { janela: FU.janela });
  const rel = FU.tipo === 'relacoes', descCod = cd => (S.eq.catalogoTUSS || []).find(t => t.codigo === cd)?.desc || '';
  // Linhas da tabela: relações (ou regras) validadas e as que já confirmaram linhas mesmo sem estar validadas hoje.
  const todas = rel
    ? S.eq.itens.filter(e => e.status === 'validada' || uso.relacoes.has(e.id)).map(e => ({ id: e.id, e, u: uso.relacoes.get(e.id), status: e.status, texto: `${e.codigo} ${e.descMV} ${e.titulo}` }))
    : (S.eq.compostas || []).filter(c => c.status === 'validada' || uso.compostas.has(c.id)).map(c0 => { const c = regraComposta(c0); return { id: c.id, c, u: uso.compostas.get(c.id), status: c.status, texto: `${nomeComposta(c)} ${c.titulos.join(' ')} ${codigosDaRegra(c).join(' ')}` }; });
  for (const x of todas) x.sit = uso.situacao(x.u);
  const val = todas.filter(x => x.status === 'validada'), cont = s => val.filter(x => x.sit === s).length;
  const q = norm(FU.busca), lista = todas.filter(x => (FU.sit === '*' || x.sit === FU.sit) && (!q || norm(x.texto).includes(q)))
    .sort((a, b) => (b.u?.linhas || 0) - (a.u?.linhas || 0) || (a.e ? a.e.titulo.localeCompare(b.e.titulo) : nomeComposta(a.c).localeCompare(nomeComposta(b.c))));
  for (const id of [...FU.sel]) if (!lista.some(x => x.id === id && x.status === 'validada')) FU.sel.delete(id);
  const ultimas = uso.competencias.slice(-4), compAtual = uso.competencias.includes(S.comp) ? S.comp : uso.competencias.at(-1) || S.comp;
  const linhasAtual = val.reduce((s, x) => s + (x.u?.porComp.get(compAtual)?.linhas || 0), 0);
  pg.innerHTML = `<div class="card"><h2>Equivalências TUSS <span class="muted small">revisão ${S.eq.revisao}</span></h2>${abasEq()}</div>
    <div class="card" id="cardUsoEq"><h2>Uso nas conferências <span class="muted small">${uso.competencias.length ? `${uso.competencias.length} competência(s) com rodadas: ${uso.competencias.map(rotuloCompetencia).join(' · ')}` : 'nenhuma rodada de conferência guardada'}</span></h2>
    <p class="lead">Quantas linhas do MV cada ${rel ? 'relação validada' : 'regra composta validada'} confirmou («Conferido» ou «com ressalva»), na última rodada de cada relatório de cada competência. Serve para ver o que sustenta a conferência automática, achar o que <b>nunca foi usado</b> ou <b>parou de ser usado</b>, e saber o impacto antes de tirar uma validação.</p>
    <div class="grid4">
      <div><span class="badge ok">${cont('em-uso')}</span> em uso <span class="muted small">(últimas ${uso.recentes.length || FU.janela} competências)</span></div>
      <div><span class="badge warn">${cont('parada')}</span> paradas</div>
      <div><span class="badge err">${cont('nunca-usada')}</span> nunca usadas</div>
      <div><span class="badge info">${linhasAtual}</span> linhas confirmadas em ${rotuloCompetencia(compAtual)}</div></div>
    <div class="filtros">
      <label class="campo">Mostrar<select id="usoTipo">${opcoes([['relacoes', 'Relações código × título'], ['compostas', 'Regras compostas']], FU.tipo)}</select></label>
      <label class="campo">Situação de uso<select id="usoSit">${opcoes([['*', 'Todas'], ['em-uso', 'Em uso'], ['parada', 'Paradas'], ['nunca-usada', 'Nunca usadas']], FU.sit)}</select></label>
      <label class="campo">Em uso = usada nas últimas<select id="usoJan">${opcoes([[1, '1 competência'], [2, '2 competências'], [3, '3 competências'], [6, '6 competências']], FU.janela)}</select></label>
      <label class="campo">Buscar<input type="search" id="usoBusca" value="${esc(FU.busca)}" placeholder="${rel ? 'código, descrição ou TITLE' : 'nome, título ou código'}"></label></div>
    <div class="acoes"><label class="small"><input type="checkbox" id="usoTodos"> selecionar as validadas do filtro</label>
      <button id="usoPend" class="sec"${FU.sel.size ? '' : ' disabled'}>Voltar a pendente…</button>${rel ? `<button id="usoDes" class="perigo"${FU.sel.size ? '' : ' disabled'}>Desativar…</button>` : ''}
      <span class="muted small">${FU.sel.size ? `${FU.sel.size} selecionada(s)` : ''}</span><button id="usoXlsx" class="sec" style="margin-left:auto">Exportar uso (.xlsx)</button></div>
    <div id="usoTab" style="margin-top:10px"></div>
    <p class="small muted">«Nunca usada» não quer dizer que a relação está errada: o exame pode ser raro ou as rodadas dele não estão neste navegador. «Parada» merece revisão: o título pode ter mudado no Apolo ou o código no MV. As rodadas antigas não guardavam qual relação foi usada; nelas a relação é achada pelo par código × título.</p></div>`;
  ligarAbasEq(pg);
  const porComp = u => ultimas.map(c => `<span style="white-space:nowrap" class="small${u?.porComp.get(c)?.linhas ? '' : ' muted'}" title="${rotuloCompetencia(c)}">${rotuloCompetencia(c).slice(0, 2)}: ${u?.porComp.get(c)?.linhas || 0}</span>`).join(' · ');
  const prest = u => u ? [...u.prestadores].map(([c, n]) => `${c} - ${n}`) : [];
  const colsRel = [
    { t: 'Código', v: x => x.e.codigo }, { t: 'Descrição MV', v: x => x.e.descMV || descCod(x.e.codigo) }, { t: 'TITLE do Apolo', v: x => x.e.titulo },
    { t: 'Escopo', v: x => `${x.e.escopo.unidade === '*' ? 'todas' : 'unid. ' + x.e.escopo.unidade}${x.e.escopo.modalidade === '*' ? '' : ' · ' + x.e.escopo.modalidade}` }];
  const colsCmp = [{ t: 'Regra composta', html: x => `<b>${esc(nomeComposta(x.c))}</b><div class="small muted">${esc(leituraRegraComposta(x.c, descCod, true))}</div>` }, { t: 'Títulos', v: x => x.c.titulos.join(' · ') }];
  tabela($('usoTab'), {
    porPagina: 100, linhas: lista, vazio: uso.competencias.length ? 'Nada neste filtro.' : 'Sem rodadas de conferência guardadas: rode as conferências da competência para ver o uso.',
    colunas: [
      { t: '', html: x => x.status === 'validada' ? `<input type="checkbox" data-uso="${esc(x.id)}"${FU.sel.has(x.id) ? ' checked' : ''}>` : '' },
      ...(rel ? colsRel : colsCmp),
      { t: 'Situação de uso', html: x => `${x.status === 'validada' ? seloUso(x.sit) : `<span class="badge info">${esc(STATUS_EQ[x.status] || x.status)} hoje</span>`}` },
      { t: 'Linhas confirmadas', n: true, html: x => `<b>${x.u?.linhas || 0}</b>${x.u?.ressalvas ? ` <span class="small muted">(${x.u.ressalvas} c/ ressalva)</span>` : ''}` },
      { t: 'Últimas competências', html: x => porComp(x.u) || '—' },
      { t: 'Última com uso', v: x => x.u?.ultima ? rotuloCompetencia(x.u.ultima) : '—' },
      { t: 'Prestadores', n: true, html: x => { const p = prest(x.u); return p.length ? `<span title="${esc(p.join('\n'))}">${p.length}</span>` : '0'; } },
      { t: 'Vl Repasse confirmado', n: true, v: x => x.u?.vlRepasse ? fmtBR(x.u.vlRepasse) : '' },
      { t: 'Validada por', v: x => { const o = x.e || x.c; return o.responsavel ? `${o.responsavel}${o.validadoEm ? ' · ' + new Date(o.validadoEm).toLocaleDateString('pt-BR') : ''}` : ''; } }
    ],
    detalhe: x => {
      const u = x.u, cs = u ? [...u.porComp].sort((a, b) => b[0].localeCompare(a[0])) : [];
      return `<div class="det"><div><h4>Por competência</h4>${cs.length ? `<table class="small"><thead><tr><th>Competência</th><th class="n">Confirmadas</th><th class="n">Com ressalva</th><th class="n">Pareadas sem confirmar</th><th class="n">Relatórios</th><th class="n">Vl Repasse</th></tr></thead><tbody>
        ${cs.map(([c, p]) => `<tr><td>${rotuloCompetencia(c)}</td><td class="n">${p.linhas}</td><td class="n">${p.ressalvas}</td><td class="n">${p.naoConfirmadas}</td><td class="n">${p.relatorios.size}</td><td class="n">${fmtBR(p.vlRepasse)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">Nenhuma linha nas rodadas guardadas.</p>'}
        ${u?.naoConfirmadas ? `<p class="small muted">${u.naoConfirmadas} linha(s) casaram título e código, mas ficaram pendentes por outro motivo (médico, data, nome, mais de um laudo).</p>` : ''}</div>
        <div><h4>Prestadores e unidades</h4>${prest(u).length ? `<ul class="small">${prest(u).map(p => `<li>${esc(p)}</li>`).join('')}</ul><p class="small">Unidades: ${esc([...u.unidades].sort((a, b) => +a - +b).join(', ') || '—')}</p>` : '<p class="muted small">—</p>'}
        <h4>Última mudança</h4><p class="small">${(() => { const h = ((x.e || x.c).historico || []).at(-1); return h ? `${new Date(h.em).toLocaleString('pt-BR')} · ${esc(h.por || '—')}: ${esc(STATUS_EQ[h.de] || h.de)} → ${esc(STATUS_EQ[h.para] || h.para)}${h.motivo ? ` (${esc(h.motivo)})` : ''}` : '—'; })()}</p></div></div>`;
    }
  });
  const ligarSel = () => $('usoTab').querySelectorAll('[data-uso]').forEach(ch => ch.onchange = () => { ch.checked ? FU.sel.add(ch.dataset.uso) : FU.sel.delete(ch.dataset.uso); desenharUsoEq(); });
  ligarSel(); new MutationObserver(ligarSel).observe($('usoTab'), { childList: true });
  $('usoTipo').onchange = e => { FU.tipo = e.target.value; FU.sel.clear(); desenharUsoEq(); };
  $('usoSit').onchange = e => { FU.sit = e.target.value; FU.sel.clear(); desenharUsoEq(); };
  $('usoJan').onchange = e => { FU.janela = +e.target.value; FU.sel.clear(); desenharUsoEq(); };
  $('usoBusca').oninput = e => { FU.busca = e.target.value; clearTimeout(FU.t); FU.t = setTimeout(() => { desenharUsoEq().then(() => { const b = $('usoBusca'); b.focus(); b.setSelectionRange(FU.busca.length, FU.busca.length); }); }, 350); };
  $('usoTodos').onchange = e => { FU.sel.clear(); if (e.target.checked) lista.filter(x => x.status === 'validada').forEach(x => FU.sel.add(x.id)); desenharUsoEq(); };
  $('usoTodos').checked = FU.sel.size > 0 && FU.sel.size === lista.filter(x => x.status === 'validada').length;
  $('usoPend').onclick = () => tirarValidacaoUso(uso, 'pendente', compAtual);
  if ($('usoDes')) $('usoDes').onclick = () => tirarValidacaoUso(uso, 'desativada', compAtual);
  $('usoXlsx').onclick = () => baixarZip(xlsxUsoEquivalencias(S.eq, uso, { operador: S.operador }), `uso_equivalencias_rev${S.eq.revisao}_${carimbo()}.xlsx`);
}

// Texto do impacto de tirar a validação (usado aqui e na Base de equivalências).
function textoImpacto(imp, n, comp) {
  if (!imp.comUso) return `<p class="small">Nenhuma das ${n} confirmou linhas nas rodadas guardadas: tirar a validação não muda as conferências já feitas.</p>`;
  return `<p class="small" style="border-left:3px solid var(--warn);padding-left:8px">${imp.comUso} de ${n} confirmaram <b>${imp.linhasTotal} linha(s)</b> nas rodadas guardadas${imp.linhasComp ? `, sendo <b>${imp.linhasComp}</b> em ${imp.relatoriosComp} relatório(s) de ${rotuloCompetencia(comp)}` : ''}. Ao tirar a validação, essas linhas deixam de ser conferidas sozinhas a partir da próxima rodada; as rodadas e aceites já feitos não mudam.</p>`;
}

async function tirarValidacaoUso(uso, status, comp) {
  const ids = [...FU.sel]; if (!ids.length) return;
  const op = await exigirOperador(); if (!op) return;
  const rel = FU.tipo === 'relacoes', imp = impactoTirarValidacao(uso, ids, comp, rel ? 'relacoes' : 'compostas');
  const rotulo = status === 'pendente' ? 'Voltar a pendente' : 'Desativar';
  const nomes = rel ? S.eq.itens.filter(e => ids.includes(e.id)).map(e => `${e.codigo} × «${e.titulo}»`) : (S.eq.compostas || []).filter(c => ids.includes(c.id)).map(c => `«${nomeComposta(c)}»`);
  const r = await dialogo(`${rotulo}: ${ids.length} ${rel ? 'relação(ões)' : 'regra(s) composta(s)'}`, `<ul class="small">${nomes.slice(0, 12).map(t => `<li>${esc(t)}</li>`).join('')}${nomes.length > 12 ? `<li class="muted">e mais ${nomes.length - 12}</li>` : ''}</ul>
    ${textoImpacto(imp, ids.length, comp)}<p class="small">Responsável: <b>${esc(op)}</b>.</p><label class="campo">Justificativa (obrigatória)<input type="text" name="motivo"></label>`, [['', 'Cancelar', 'sec'], ['ok', rotulo]]);
  if (r.botao !== 'ok') return;
  const motivo = (r.campos.motivo || '').trim(); if (!motivo) return avisar('Informe a justificativa.', 'warn');
  let n = 0;
  if (rel) n = alterarStatusEq(S.eq, ids, status, op, `${motivo} (uso: ${imp.linhasTotal} linha(s) nas rodadas)`, S.comp);
  else for (const id of ids) n += alterarStatusComposta(S.eq, id, status, op, `${motivo} (uso: ${imp.linhasTotal} linha(s) nas rodadas)`, S.comp);
  FU.sel.clear();
  if (!rel) aplicarCobertas(S.eq, op, S.comp);
  salvarEq(`${n} ${rel ? 'relação(ões)' : 'regra(s)'}: ${rotulo.toLowerCase()}.${imp.linhasComp ? ` Rode de novo as conferências de ${rotuloCompetencia(comp)} para refletir.` : ''}`);
  desenharUsoEq();
}
