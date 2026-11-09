/* ============================================================
 * Equivalências → «O que mais destrava» (SOL-F15)
 * Pares título do Apolo × código do MV que travam a conferência automática na competência, do que
 * mais trava para o que menos trava. Validação em lote (com responsável e justificativa) e, em seguida,
 * a ferramenta roda de novo as conferências afetadas que estiverem carregadas nesta sessão.
 * ============================================================ */
const DV = { unidade: '*', sel: new Set(), abertos: new Set() };
const abasEq = () => `<div class="subabas" role="tablist">${[['base', 'Base de equivalências'], ['destrava', 'O que mais destrava'], ['uso', 'Uso nas conferências']].map(([k, t]) => `<button role="tab" class="${(FE.sub || 'base') === k ? 'on' : ''}" aria-selected="${(FE.sub || 'base') === k}" data-esub="${k}">${t}</button>`).join('')}</div>`;
function ligarAbasEq(raiz) { raiz.querySelectorAll('[data-esub]').forEach(b => b.onclick = () => { FE.sub = b.dataset.esub; RENDER.equivalencias(); }); }
// Atalho do Início («o que mais destrava»).
document.addEventListener('click', e => { if (e.target.closest('[data-destrava]')) FE.sub = 'destrava'; });
const SIT_PAR = { pendente: ['warn', 'pendente'], 'sem-cadastro': ['err', 'sem cadastro'], conflito: ['err', 'em conflito'] };

async function desenharDestrava() {
  S.rodadas = await dbTodas();
  const pg = $('pag-equivalencias');
  const naoCorr = new Set((S.eq.naoCorrespondem || []).map(x => `${chaveTitulo(x.titulo)}|${x.codigo}`));
  const pares = paresQueTravam(S.rodadas, S.comp, S.eq, { unidade: DV.unidade }).filter(p => !naoCorr.has(p.chave));
  for (const k of [...DV.sel]) if (!pares.some(p => p.chave === k && p.situacao !== 'conflito')) DV.sel.delete(k);
  const cob = coberturaCompetencia(S.rodadas, S.comp);
  const selPares = pares.filter(p => DV.sel.has(p.chave)), ganho = selPares.reduce((s, p) => s + p.travadas, 0);
  const novaPct = cob.total ? Math.round((cob.conferidas + ganho) / cob.total * 1000) / 10 : 0;
  const unidades = [...new Set(ultimasRodadasConferencia(S.rodadas, S.comp).map(r => String(r.unidadeCod)))].sort((a, b) => +a - +b);
  pg.innerHTML = `<div class="card"><h2>Equivalências TUSS <span class="muted small">revisão ${S.eq.revisao}</span></h2>${abasEq()}</div>
    <div class="card" id="cardDestrava"><h2>O que mais destrava <span class="muted small">competência ${rotuloCompetencia(S.comp)} · cobertura ${cob.total ? `${fmtPct(cob.pct)}% (${cob.conferidas} de ${cob.total} linhas)` : '—'}</span></h2>
    <p class="lead">Pares <b>título do Apolo × código do MV</b> que impedem a conferência automática, na última rodada de cada relatório desta competência. «Linhas que destravam» são as que viram «Conferido» com a equivalência validada (mesmo paciente, mesma data, sem outro bloqueio). Nada é validado sozinho.</p>
    <div class="acoes"><label class="small">Unidade <select id="dvUn"><option value="*">Todas</option>${opcoes(unidades.map(u => [u, `${u} - ${unidadePorCod(S.cfg, u)?.nome || ''}`]), DV.unidade)}</select></label>
      <span class="small muted">As rodadas desta versão em diante guardam o título pareado; rodadas antigas não entram na lista.</span></div>
    <div class="lote-dv${DV.sel.size ? '' : ' vazio'}"><b>${DV.sel.size} selecionado(s)</b>${DV.sel.size ? ` · validar destrava <b>+${ganho} linha(s)</b> (cobertura ${fmtPct(cob.pct)}% → ${fmtPct(novaPct)}%)` : ' · marque os pares para validar em lote'}
      <button id="dvValidar"${DV.sel.size ? '' : ' disabled'}>Validar selecionados…</button><button class="sec" id="dvNao"${DV.sel.size ? '' : ' disabled'}>Não correspondem…</button></div>
    ${pares.length ? `<div class="tw"><table class="dv-tab"><thead><tr><th><input type="checkbox" id="dvTodos" aria-label="Selecionar todos"></th><th>Título do Apolo</th><th>Código MV · descrição</th><th class="n">Linhas que destravam</th><th class="n">Linhas travadas</th><th class="n">Prestadores</th><th>Unidades</th><th>Situação hoje</th><th></th></tr></thead><tbody>
      ${pares.map(p => { const [c, t] = SIT_PAR[p.situacao] || ['', p.situacao]; return `<tr><td><input type="checkbox" data-dv="${esc(p.chave)}"${DV.sel.has(p.chave) ? ' checked' : ''}${p.situacao === 'conflito' ? ' disabled title="Desfaça o conflito na Base de equivalências antes de validar"' : ''}></td>
        <td>${esc(p.titulo)}</td><td>${esc(p.codigo)} · ${esc(p.descMV)}</td><td class="n"><b>${p.travadas}</b></td><td class="n">${p.linhas}</td><td class="n" title="${esc(p.prestadores.join('\n'))}">${p.prestadores.length}</td><td>${esc(p.unidades.join(', '))}</td>
        <td><span class="badge ${c}">${t}</span></td><td><button class="sec mini" data-dvver="${esc(p.chave)}">${DV.abertos.has(p.chave) ? 'esconder' : `ver ${p.exemplos.length} par(es)`}</button></td></tr>
        <tr class="detalhe"${DV.abertos.has(p.chave) ? '' : ' hidden'} data-dvdet="${esc(p.chave)}"><td colspan="9"><ul class="small" style="margin:4px 0">${p.exemplos.map(x => `<li>${esc(x.prestador)} · unidade ${esc(x.unidade)} · ${x.data ? fmtData(paraData(x.data)) : 'sem data'} · conta ${esc(x.conta || '—')} / atendimento ${esc(x.atendimento || '—')} · MV «${esc(x.desc || '')}» × laudo «${esc(p.titulo)}»</li>`).join('')}</ul></td></tr>`; }).join('')}</tbody></table></div>`
      : `<p class="muted">${ultimasRodadasConferencia(S.rodadas, S.comp).length ? 'Nenhum par travando a conferência nesta competência.' : 'Nenhuma rodada de conferência nesta competência ainda.'}</p>`}
    <p class="small muted">Par em conflito aparece, mas não entra no lote: desfaça o conflito na Base de equivalências. «Não correspondem» tira o par da lista (a linha continua pendente na conferência, para tratar como divergência). Sugestão: uma sessão de 1 a 2 horas no começo de cada competência, de cima para baixo.</p></div>`;
  ligarAbasEq(pg);
  $('dvUn').onchange = e => { DV.unidade = e.target.value; DV.sel.clear(); desenharDestrava(); };
  pg.querySelectorAll('[data-dv]').forEach(ch => ch.onchange = () => { ch.checked ? DV.sel.add(ch.dataset.dv) : DV.sel.delete(ch.dataset.dv); desenharDestrava(); });
  if ($('dvTodos')) $('dvTodos').onchange = e => { DV.sel.clear(); if (e.target.checked) pares.filter(p => p.situacao !== 'conflito').forEach(p => DV.sel.add(p.chave)); desenharDestrava(); };
  pg.querySelectorAll('[data-dvver]').forEach(b => b.onclick = () => { const k = b.dataset.dvver; DV.abertos.has(k) ? DV.abertos.delete(k) : DV.abertos.add(k); desenharDestrava(); });
  $('dvValidar').onclick = () => validarLoteDestrava(selPares, cob, ganho, novaPct);
  $('dvNao').onclick = () => naoCorrespondem(selPares);
}

async function validarLoteDestrava(pares, cob, ganho, novaPct) {
  if (!pares.length) return;
  const op = await exigirOperador(); if (!op) return;
  const r = await dialogo(`Validar ${pares.length} equivalência(s)?`, `<ul class="small">${pares.map(p => `<li>${esc(p.titulo)} ↔ ${esc(p.codigo)} · ${esc(p.descMV)} <span class="muted">(${p.travadas} linha(s))</span></li>`).join('')}</ul>
    <label class="campo">Justificativa (vale para todos)<input type="text" name="motivo" value="títulos e códigos conferidos na sessão de validação de ${rotuloCompetencia(S.comp)}"></label>
    <p class="small muted">Ficam validadas por <b>${esc(op)}</b>, com data e revisão da base. Em seguida a ferramenta roda de novo as conferências afetadas que estiverem carregadas nesta sessão (cobertura esperada: ${fmtPct(cob.pct)}% → ${fmtPct(novaPct)}%, +${ganho} linha(s)).</p>`, [['', 'Cancelar', 'sec'], ['ok', `Validar ${pares.length}`]]);
  if (r.botao !== 'ok') return;
  if (!r.campos.motivo.trim()) return avisar('Informe a justificativa.', 'warn');
  const n = validarParesEmLote(S.eq, pares, op, r.campos.motivo.trim(), S.comp);
  salvarEq(`${n} equivalência(s) validadas em lote (O que mais destrava).`);
  DV.sel.clear();
  // Rodar de novo as conferências afetadas (aprovado em 03/11/2026).
  const chaves = new Set(pares.map(p => p.chave));
  const afetadas = ultimasRodadasConferencia(S.rodadas, S.comp).filter(rd => rd.linhas.some(l => l.titulo && chaves.has(`${chaveTitulo(l.titulo)}|${l.codigo}`)));
  if (compFechada()) { avisar(`${n} equivalência(s) validadas. A competência está fechada: as conferências não foram rodadas de novo.`, 'ok'); return desenharDestrava(); }
  const antes = coberturaCompetencia(S.rodadas, S.comp);
  const { feitas, faltam } = await rodarDeNovoAfetadas(afetadas);
  const depois = coberturaCompetencia(S.rodadas, S.comp);
  avisar(`${n} equivalência(s) validadas. ${feitas.length} conferência(s) rodadas de novo: cobertura ${fmtPct(antes.pct)}% → ${fmtPct(depois.pct)}%.${faltam.length ? ` ${faltam.length} relatório(s) não estão carregados nesta sessão (${faltam.map(x => `${x.prestadorCod} un. ${x.unidadeCod}`).join(', ')}): carregue o PDF e rode a conferência.` : ''}`, faltam.length ? 'warn' : 'ok');
  desenharDestrava();
}
async function naoCorrespondem(pares) {
  if (!pares.length) return;
  const op = await exigirOperador(); if (!op) return;
  const r = await dialogo(`${pares.length} par(es) não correspondem?`, `<p class="small">O título do laudo não sustenta o código do MV. Os pares saem desta lista e as relações pendentes são desativadas. As linhas continuam pendentes na conferência, para tratar como divergência (NC ou correção).</p><ul class="small">${pares.map(p => `<li>${esc(p.titulo)} × ${esc(p.codigo)}</li>`).join('')}</ul><label class="campo">Motivo<input type="text" name="motivo"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Confirmar']]);
  if (r.botao !== 'ok') return;
  S.eq.naoCorrespondem = S.eq.naoCorrespondem || [];
  for (const p of pares) {
    S.eq.naoCorrespondem.push({ titulo: p.titulo, codigo: p.codigo, por: op, em: agoraISO(), motivo: r.campos.motivo.trim(), competencia: S.comp });
    if (p.relacao && p.relacao.status === 'pendente') alterarStatusEq(S.eq, [p.relacao.id], 'desativada', op, `não corresponde: ${r.campos.motivo.trim()}`, S.comp);
  }
  S.eq.revisao++; S.eq.atualizadoEm = agoraISO();
  salvarEq(`${pares.length} par(es) marcados como «não correspondem».`); DV.sel.clear(); desenharDestrava();
}
