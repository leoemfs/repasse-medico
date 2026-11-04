/* ============================================================
 * Início: arquivos da sessão (carregados uma vez, usados por todas as análises)
 * ============================================================ */
RENDER.inicio = () => {
  const r = S.relatorios, a = S.apolo, eqv = S.eq.itens.filter(e => e.status === 'validada').length, eqp = S.eq.itens.filter(e => e.status === 'pendente').length;
  $('pag-inicio').innerHTML = `${cartaoAvisoProducao()}${painelCompetencia()}
  <div class="card">
    <h2>Preparar o repasse</h2>
    <p class="lead">Carregue os arquivos uma vez; depois abra a análise. Nenhuma análise altera o MV: as correções são feitas lá, e a nova extração é conferida aqui em outra rodada.</p>
    <ol class="passos">
      <li class="${r.length ? 'feito' : ''}"><div><strong>Relatório(s) de repasse do MV</strong> <span class="muted">— PDF, um ou vários.</span></div></li>
      <li class="${a ? 'feito' : ''}"><div><strong>Planilha de laudos do Apolo</strong> <span class="muted">— competência de produção (ex.: 09/2026 para o repasse 10/2026).</span></div></li>
      <li class="${eqv ? 'feito' : ''}"><div><strong>Equivalências TUSS validadas</strong> <span class="muted">— ${eqv} validadas · ${eqp} pendentes. Sem validação, nada é confirmado automaticamente.</span> <a href="#equivalencias">Abrir Equivalências TUSS →</a></div></li>
      <li class="${S.pbi ? 'feito' : ''}"><div><strong>Power BI</strong> <span class="muted">— opcional, só consulta; não interfere nos motores.</span></div></li>
    </ol>
  </div>
  <div class="grid3 fontes">
    <div class="card fonte"><h3>Relatório de repasse MV (PDF)</h3>
      <div class="dz" id="dzMV">Clique ou arraste o(s) PDF(s)<small>Relatório de Repasse de Prestadores do SOULMV</small><input id="inMV" type="file" accept=".pdf,application/pdf" multiple hidden></div>
      <div class="estado" id="stMV">${r.length ? `${r.length} relatório(s) carregado(s).` : '<span class="muted">Nenhum PDF carregado.</span>'}</div></div>
    <div class="card fonte"><h3>Laudos do Apolo (.xlsx)</h3>
      <div class="dz" id="dzApolo">Clique ou arraste a planilha<small>Formato atual (BRANCH_NAME, TITLE…) ou antigo</small><input id="inApolo" type="file" accept=".xlsx" hidden></div>
      <div class="estado" id="stApolo">${a ? resumoApolo(a) + estadoGuardada('apolo', a) : S.restaurando ? '<span class="muted">Restaurando a planilha guardada…</span>' : '<span class="muted">Nenhuma planilha carregada.</span>'}</div></div>
    <div class="card fonte"><h3>Power BI (.xlsx) — opcional</h3>
      <div class="dz" id="dzPBI">Clique ou arraste a planilha do Power BI<small>Catálogo de unidades, grupos, procedimentos e códigos de prestador</small><input id="inPBI" type="file" accept=".xlsx" hidden></div>
      <div class="estado" id="stPBI">${S.pbi ? `<span class="badge ok">${S.pbi.linhas.length} linhas</span> <span class="muted small">${esc(S.pbi.nome)}</span><div class="acoes" style="margin-top:8px"><button class="sec mini" id="btPbiBase">Atualizar base de dados com o Power BI</button></div>${estadoGuardada('pbi', S.pbi)}` : S.restaurando ? '<span class="muted">Restaurando a planilha guardada…</span>' : '<span class="muted">Não carregado.</span>'}</div></div>
  </div>
  <div class="card"><div class="fx-topo" style="margin-bottom:6px"><h2 style="margin:0">Relatórios do MV carregados</h2>${S.relatorios.length || S.apolo || S.pbi ? '<button class="sec" id="btLimpar">Limpar arquivos…</button>' : ''}</div><div id="listaMV"></div></div>
  <div class="grid2">
    <div class="card"><h3>Conferência cruzada MV × Apolo</h3><p class="muted">Confirma se cada linha do repasse tem laudo e lista os laudos sem lançamento. Mostra pendências por categoria e marcadores.</p><div class="acoes"><button data-ir="conferencia">Abrir conferência →</button></div></div>
    <div class="card"><h3>Correção de prestador</h3><p class="muted">Identifica o médico do laudo de cada linha, separando identificados, não identificados, conflitos e dados insuficientes. Não sugere prestador.</p><div class="acoes"><button data-ir="correcao">Abrir correção →</button></div></div>
  </div>`;
  zonaArquivo($('dzMV'), $('inMV'), carregarPDFs);
  zonaArquivo($('dzApolo'), $('inApolo'), fs => carregarApolo(fs[0]));
  zonaArquivo($('dzPBI'), $('inPBI'), fs => carregarPBI(fs[0]));
  document.querySelectorAll('#pag-inicio [data-ir]').forEach(b => b.onclick = () => { location.hash = b.dataset.ir; });
  ligarPainelCompetencia();
  if ($('btLimpar')) $('btLimpar').onclick = limparArquivosSessao;
  ligarPlanilhasGuardadas($('pag-inicio'));
  if ($('btPbiBase')) $('btPbiBase').onclick = atualizarBasePowerBI;
  desenharListaMV();
};

/* ---------- Painel da competência: arquivos, o que foi feito, bases alteradas e fechamento ---------- */
function resumoCompetencia(chave) {
  const rods = S.rodadas.filter(r => competenciaDaRodada(r) === chave);
  const conf = rods.filter(r => r.tipo === 'conferencia'), corr = rods.filter(r => r.tipo === 'correcao');
  const ncs = S.nc.itens.filter(x => x.competencia === chave), indNC = indicadoresNC(ncs);
  const fx = S.fluxo.competencias[chave], indFx = fx ? indicadoresFluxo(fx) : null;
  const eqVal = S.eq.itens.filter(e => (e.historico || []).some(h => h.competencia === chave && h.para === 'validada')).length;
  const alt = estadoCompetencia(S.compReg, chave).alteracoes || [];
  return { rods, conf, corr, semAceite: rods.filter(r => !r.aceite).length, ncs, indNC, fx, indFx, eqVal, alt };
}
function painelCompetencia() {
  const ch = S.comp, R = resumoCompetencia(ch), est = estadoCompetencia(S.compReg, ch), fechada = est.status === 'fechada', esp = producaoEsperada(ch);
  const arq = (nome, sub, dom) => `<div class="l"><div>${nome}<small>${sub}</small></div><span class="v ${!dom ? 'muted' : dom.mes === esp ? 'txt-ok' : 'txt-warn'}">${!dom ? '—' : dom.mes === esp ? 'ok' : 'outro mês'}</span></div>`;
  const domMV = S.relatorios.map(x => producaoDoArquivo(x, () => x.rel.regs.map(r => r.data))).filter(Boolean);
  const mvDom = domMV.length ? (domMV.every(d => d.mes === esp) ? { mes: esp } : domMV.find(d => d.mes !== esp)) : null;
  const domAp = S.apolo ? producaoDoArquivo(S.apolo, () => S.apolo.laudos.map(l => l.data)) : null;
  const domPb = S.pbi ? producaoDoArquivo(S.pbi, () => S.pbi.linhas.map(l => l.data)) : null;
  const prestConf = new Set(R.conf.map(r => r.prestadorCod)).size, unCorr = [...new Set(R.corr.map(r => r.unidadeCod))].join(', ');
  const porTipo = [...R.alt.reduce((m, a) => m.set(a.tipo, [...(m.get(a.tipo) || []), a]), new Map())];
  const pct = R.indFx && R.indFx.total ? Math.round(R.indFx.ok / R.indFx.total * 100) : 0;
  return `<div class="card painel-comp"><h2>Painel da competência ${rotuloCompetencia(ch)} <span class="comp-st ${fechada ? 'fechada' : 'aberta'}">${fechada ? 'fechada' : 'aberta'}</span></h2>
    <div class="grid3">
      <div><h3>Arquivos desta sessão</h3>
        ${arq('Relatórios do MV', S.relatorios.length ? `${S.relatorios.length} PDF(s) · produção ${S.relatorios.length && mvDom ? rotuloMes(mvDom.mes) : '—'}` : 'nenhum carregado', mvDom)}
        ${arq('Laudos do Apolo', S.apolo ? `produção ${rotuloMes(domAp?.mes)}` : 'não carregado', domAp)}
        ${arq('Power BI', S.pbi ? `${S.pbi.linhas.length.toLocaleString('pt-BR')} lançamentos · ${rotuloMes(domPb?.mes)}` : 'não carregado', domPb)}
        <p class="small muted">Esperado: produção ${rotuloMes(esp)}. Os arquivos ficam só na memória desta sessão.</p></div>
      <div><h3>O que foi feito nesta competência</h3>
        <div class="l"><div>Rodadas de conferência<small>${prestConf} prestador(es)</small></div><span class="v">${R.conf.length}</span></div>
        <div class="l"><div>Rodadas de correção de prestador<small>${unCorr ? `unidade(s) ${esc(unCorr)}` : '—'}</small></div><span class="v">${R.corr.length}</span></div>
        <div class="l"><div>Não conformidades<small>${R.indNC.porSituacao.aberta} abertas · ${R.indNC.porSituacao.enviada + R.indNC.porSituacao.tratativa} enviadas ao Qualiex</small></div><span class="v">${R.ncs.length}</span></div>
        <div class="l"><div>Fluxo mensal<small>${R.indFx ? `${R.indFx.ok} de ${R.indFx.total} etapas concluídas · ${R.indFx.vencidas.length} vencida(s)` : 'checklist não iniciado'}</small></div><span class="v">${R.indFx ? pct + '%' : '—'}</span></div>
        ${R.indFx ? `<div class="barra"><i style="width:${pct}%"></i></div>` : ''}
        ${(() => { const h = historicoCobertura(S.rodadas, ch, 4), cob = coberturaCompetencia(S.rodadas, ch), ant = h[h.length - 2], d = cob.total && ant?.total ? Math.round((cob.pct - ant.pct) * 10) / 10 : null, f = v => fmtPct(v);
          return `<div class="l" id="cobInicio"><div>Cobertura automática<small>${cob.total ? `${cob.conferidas} de ${cob.total} linhas conferidas sem decisão manual${d !== null ? ` · ${d >= 0 ? '+' : ''}${f(d)} p.p. vs ${rotuloCompetencia(ant.chave)}` : ''}` : 'sem rodadas de conferência'} · <a href="#equivalencias" data-destrava>o que mais destrava</a></small></div><span class="v">${cob.total ? f(cob.pct) + '%' : '—'}</span></div>
          ${cob.total ? `<div class="barra"><i style="width:${cob.pct}%"></i></div>` : ''}
          <div class="hist-cob" title="Cobertura das últimas competências">${h.map(x => `<div><span style="height:${Math.max(2, Math.round(x.pct * 0.4))}px"${x.chave === ch ? ' class="atual"' : ''}></span>${x.total ? f(x.pct) + '%' : '—'}<small>${rotuloCompetencia(x.chave)}</small></div>`).join('')}</div>`; })()}</div>
      <div><h3>Bases alteradas nesta competência</h3>
        <div class="l"><div>Equivalências TUSS validadas<small>valem daqui em diante</small></div><span class="v">${R.eqVal}</span></div>
        ${porTipo.length ? porTipo.map(([t, l]) => `<div class="l"><div>${esc(TIPOS_ALTERACAO[t] || t)}<small title="${esc(l.map(a => a.descricao).join('\n'))}">${esc(l[l.length - 1].descricao)}${l[l.length - 1].por ? ` · ${esc(l[l.length - 1].por)}` : ''}</small></div><span class="v">${l.length}</span></div>`).join('') : '<p class="small muted">Nenhuma outra alteração nas bases nesta competência.</p>'}</div>
    </div>
    <div class="fechamento"><div><strong>${fechada ? `Fechada em ${new Date(est.fechadaEm).toLocaleString('pt-BR')} por ${esc(est.fechadaPor || '—')}` : 'Fechar a competência'}</strong>
      <p class="small muted">${fechada ? 'Somente leitura: sem rodadas novas, NCs ou mudanças no fluxo. Pendências podem ser levadas para a competência seguinte.' : 'Depois de pago e encaminhado ao Financeiro: a competência fica somente leitura. Reabrir exige justificativa e fica no histórico.'}</p>
      ${est.historico?.length ? `<details class="small"><summary>Histórico (${est.historico.length})</summary><ul>${est.historico.map(h => `<li>${new Date(h.em).toLocaleString('pt-BR')} · ${esc(h.por || '—')} · ${esc(h.acao)}${h.obs ? ` — ${esc(h.obs)}` : ''}</li>`).join('')}</ul></details>` : ''}</div>
      <div class="acoes" style="margin:0"><button class="sec" id="compPacote" title="Pasta Comp_MM-AAAA (.zip): correção de prestador, NCs, planilhas usadas, relatórios por modalidade e unidade, conferências e planilha de controle">Exportar competência (pasta)</button>${fechada ? '<button class="sec" id="compReabrir">Reabrir…</button>' : `<button id="compFechar">Fechar ${rotuloCompetencia(ch)}…</button>`}</div></div></div>`;
}
function ligarPainelCompetencia() {
  const ch = S.comp;
  if ($('compFechar')) $('compFechar').onclick = async () => {
    const op = await exigirOperador(); if (!op) return;
    const R = resumoCompetencia(ch), pend = [];
    if (R.indNC.porSituacao.aberta) pend.push(`${R.indNC.porSituacao.aberta} NC(s) abertas, não enviadas ao Qualiex`);
    if (R.indFx && R.indFx.total - R.indFx.ok - R.indFx.na > 0) pend.push(`${R.indFx.total - R.indFx.ok - R.indFx.na} etapa(s) do fluxo não concluídas`);
    if (R.semAceite) pend.push(`${R.semAceite} rodada(s) sem aceite`);
    const r = await dialogo(`Fechar a competência ${rotuloCompetencia(ch)}?`, `<p>Ela fica somente leitura: sem rodadas novas, NCs ou mudanças no fluxo. As bases continuam editáveis (valem para todas as competências).</p>
      ${pend.length ? `<p class="small" style="color:var(--warn)">Pendências (não impedem o fechamento):</p><ul class="small">${pend.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="small txt-ok">Sem pendências.</p>'}
      <label class="campo">Observação (opcional)<input type="text" name="obs"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Fechar competência']]);
    if (r.botao !== 'ok') return;
    fecharCompetencia(S.compReg, ch, op, r.campos.obs.trim()); salvarCompReg();
    avisar(`Competência ${rotuloCompetencia(ch)} fechada.`, 'ok'); irPara('inicio', true);
  };
  if ($('compReabrir')) $('compReabrir').onclick = async () => {
    const op = await exigirOperador(); if (!op) return;
    const r = await dialogo(`Reabrir a competência ${rotuloCompetencia(ch)}?`, `<p class="small">A reabertura fica registrada no histórico da competência.</p><label class="campo">Justificativa (obrigatória)<input type="text" name="just"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Reabrir']]);
    if (r.botao !== 'ok') return;
    if (!r.campos.just.trim()) return avisar('Informe a justificativa para reabrir.', 'warn');
    reabrirCompetencia(S.compReg, ch, op, r.campos.just); salvarCompReg();
    avisar(`Competência ${rotuloCompetencia(ch)} reaberta.`, 'ok'); irPara('inicio', true);
  };
  $('compPacote').onclick = () => exportarPastaCompetencia(ch);
}
function resumoApolo(a) {
  const al = [];
  if (a.semNome) al.push(`${a.semNome} sem nome`); if (a.semData) al.push(`${a.semData} sem data`); if (a.semMedico) al.push(`${a.semMedico} sem médico`); if (a.idsDuplos) al.push(`${a.idsDuplos} ID(s) com dois nomes`);
  return `<span class="badge ok">${a.laudos.length.toLocaleString('pt-BR')} laudos</span> <span class="muted small">${esc(a.nome)} · última linha com dados ${a.ultimaLinha} · ${a.segundos.toFixed(1)} s</span>${al.length ? `<div class="small" style="margin-top:6px;color:var(--warn)">Atenção: ${esc(al.join(' · '))}</div>` : ''}${a.ignoradas ? `<div class="small muted">${a.ignoradas} linha(s) vazias ignoradas.</div>` : ''}`;
}

function desenharListaMV() {
  const c = $('listaMV'); if (!c) return;
  if (!S.relatorios.length) { c.innerHTML = '<p class="muted">Nenhum relatório carregado.</p>'; return; }
  c.innerHTML = `<div class="tw"><table><thead><tr><th>Arquivo</th><th>Prestador</th><th>Repasse</th><th>Competência</th><th>Produção</th><th>Finalidade</th><th class="n">Linhas</th><th class="n">Vl Repasse</th><th>Totais do PDF</th><th></th></tr></thead><tbody>${S.relatorios.map(x => {
    const r = x.rel;
    return `<tr><td>${esc(x.nome)}</td><td>${esc(r.cab.prestadorCod)} - ${esc(r.cab.prestadorNome)}</td><td>${esc(r.cab.repasse)} · ${esc(r.cab.descricao)}</td><td>${esc(r.cab.competencia)}</td><td>${(() => { const d = producaoDoArquivo(x, () => r.regs.map(l => l.data)); return d ? `<span class="${d.mes === producaoEsperada(S.comp) ? '' : 'txt-warn'}">${rotuloMes(d.mes)}</span>` : '—'; })()}</td>
      <td><select data-fin="${x.id}" aria-label="Finalidade">${opcoes([['conferencia', 'Conferência'], ['correcao', 'Correção de prestador']], x.finalidade || finalidadePadrao(r))}</select></td><td class="n">${r.regs.length}</td><td class="n">${fmtBR(r.totExtraido[0])}</td>
      <td>${r.ok ? '<span class="badge ok">Conferem</span>' : `<span class="badge err" title="${esc(r.avisos.join('\n'))}">${r.avisos.length} aviso(s)</span>`}${r.notas.length ? ` <span class="muted small" title="${esc(r.notas.join('\n'))}">ⓘ ${r.notas.length} nota(s)</span>` : ''}</td>
      <td style="white-space:nowrap"><button class="sec" data-xl="${x.id}">Excel</button> <button class="perigo" data-rm="${x.id}" title="Remover da sessão">✕</button></td></tr>`;
  }).join('')}</tbody></table></div>
  ${S.relatorios.some(x => !x.rel.ok) ? `<ul class="avisos">${S.relatorios.flatMap(x => x.rel.avisos.slice(0, 6).map(a => `<li>${esc(x.nome)}: ${esc(a)}</li>`)).join('')}</ul>` : ''}`;
  c.querySelectorAll('[data-xl]').forEach(b => b.onclick = () => { const x = S.relatorios.find(y => y.id === b.dataset.xl); baixarZip(xlsxExtracao(x.rel), `MV_extraido_${nomeSeguro(x.rel.cab.prestadorNome)}_${x.rel.cab.repasse}.xlsx`); });
  c.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { S.relatorios = S.relatorios.filter(y => y.id !== b.dataset.rm); RENDER.inicio(); });
  c.querySelectorAll('[data-fin]').forEach(s => s.onchange = () => { S.relatorios.find(y => y.id === s.dataset.fin).finalidade = s.value; avisar(`Relatório marcado para ${s.value === 'correcao' ? 'a Correção de prestador' : 'a Conferência'}.`, 'ok'); });
}

async function carregarPDFs(files) {
  for (const f of files) {
    if (!/\.pdf$/i.test(f.name)) { avisar(`${f.name}: envie o relatório em PDF.`, 'err'); continue; }
    $('stMV').innerHTML = `Lendo ${esc(f.name)}…`;
    try {
      const bytes = await lerArquivo(f), hash = hashBytes(bytes);
      if (S.relatorios.some(x => x.hash === hash)) { avisar(`${f.name} já está carregado.`, 'warn'); continue; }
      const { linhas } = await lerLinhasPdf(pdfjs, bytes);
      const rel = interpretarMV(linhas, f.name);
      if (!rel.regs.length) { avisar(`${f.name}: nenhuma linha de atendimento reconhecida. ${rel.avisos[0] || ''}`, 'err'); continue; }
      const item = { id: novoId('mv'), nome: f.name, tamanho: f.size, hash, rel };
      Object.defineProperty(item, 'bytes', { value: bytes, enumerable: false });   // só na memória: vai para a pasta da competência
      if (!await aceitarProducao(f.name, producaoDoArquivo(item, () => rel.regs.map(l => l.data)))) continue;
      item.finalidade = finalidadePadrao(rel);
      S.relatorios.push(item);
      if (registrarPrestadorDoMV(S.cfg, rel.cab.prestadorCod, rel.cab.prestadorNome)) salvarCfg();
      avisar(`${f.name}: ${rel.regs.length} linhas · ${rel.ok ? 'totais conferem com o PDF' : 'há avisos na conferência de totais'}.`, rel.ok ? 'ok' : 'warn');
    } catch (e) { avisar(`${f.name}: erro ao ler o PDF (${e.message}).`, 'err'); }
  }
  RENDER.inicio();
}

async function carregarApolo(f) {
  if (!/\.xlsx$/i.test(f.name)) return avisar('Envie a planilha de laudos em .xlsx.', 'err');
  $('stApolo').innerHTML = `Lendo ${esc(f.name)}… <div class="barra"><i id="barApolo"></i></div>`;
  try {
    const bytes = await lerArquivo(f);
    const ap = await lerApolo(bytes, f.name, n => { const b = $('barApolo'); if (b) b.style.width = Math.min(95, n / 300) + '%'; });
    if (!await aceitarProducao(f.name, producaoDoArquivo(ap, () => ap.laudos.map(l => l.data)))) return RENDER.inicio();
    S.apolo = ap; S.apolo.hash = hashBytes(bytes); S.apolo.tamanho = f.size; Object.defineProperty(S.apolo, 'bytes', { value: bytes, enumerable: false });
    await guardarPlanilha('apolo', S.apolo);
    const semUnidade = [...new Set(S.apolo.laudos.map(l => norm(l.unidade)))].filter(u => !S.cfg.unidades.some(x => (x.apolo || []).map(norm).includes(u)));
    avisar(`${f.name}: ${S.apolo.laudos.length} laudos lidos.${semUnidade.length ? ` ${semUnidade.length} unidade(s) do Apolo sem cadastro em Bases.` : ''}`, semUnidade.length ? 'warn' : 'ok');
  } catch (e) { S.apolo = null; avisar(`${f.name}: ${e.message}`, 'err'); }
  RENDER.inicio();
}

async function carregarPBI(f) {
  if (!/\.xlsx$/i.test(f.name)) return avisar('Envie a planilha do Power BI em .xlsx.', 'err');
  $('stPBI').textContent = `Lendo ${f.name}…`;
  try {
    const bytesPB = await lerArquivo(f), pb = await lerPowerBI(bytesPB, f.name);
    Object.defineProperty(pb, 'bytes', { value: bytesPB, enumerable: false });
    if (!await aceitarProducao(f.name, producaoDoArquivo(pb, () => pb.linhas.map(l => l.data)))) return RENDER.inicio();
    S.pbi = pb; pb.tamanho = f.size; await guardarPlanilha('pbi', pb); avisar(`${f.name}: ${S.pbi.linhas.length} linhas. Use «Atualizar base de dados com o Power BI» para trazer faturistas, convênios e procedimentos novos.`, 'ok');
  }
  catch (e) { S.pbi = null; avisar(`${f.name}: ${e.message}`, 'err'); }
  RENDER.inicio();
}

// Importa a planilha de análise (.xlsx) ou uma base JSON; JSON pode substituir (com backup) ou mesclar.
async function importarEquivalenciasArquivo(f, modo) {
  try {
    const bytes = await lerArquivo(f);
    if (/\.xlsx$/i.test(f.name)) {
      const imp = await importarPlanilhaEquivalencias(bytes, f.name);
      const m = mesclarEquivalencias(S.eq, imp.itens, imp);
      if (m.adicionadas) { S.eq.revisao++; S.eq.atualizadoEm = agoraISO(); }
      salvarEq(`${f.name}: ${m.adicionadas} relações novas como PENDENTES (${m.ignoradas} já existiam). Valide em «Equivalências TUSS».`);
    } else {
      const base = JSON.parse(new TextDecoder().decode(bytes));
      const erros = validarEq(base);
      if (erros.length) throw new Error('arquivo inválido: ' + erros.join('; '));
      if (modo === 'substituir') {
        if (!await confirmar('Substituir a base de equivalências?', `A base atual (${S.eq.itens.length} relações, revisão ${S.eq.revisao}) será guardada como cópia de segurança e substituída por ${base.itens.length} relações.`, 'Substituir')) return;
        backupAntesDeSubstituir(CHAVES.eqAnterior, S.eq);
        S.eq = base; S.eq.revisao = Math.max(S.eq.revisao || 0, 0) + 1;
        salvarEq(`Base substituída: ${base.itens.length} relações (cópia da anterior guardada).`);
      } else {
        const m = mesclarEquivalencias(S.eq, base.itens.map(e => ({ ...e, historico: e.historico || [] })), base);
        if (m.adicionadas) { S.eq.revisao++; S.eq.atualizadoEm = agoraISO(); }
        salvarEq(`${m.adicionadas} relações adicionadas; ${m.ignoradas} já existiam e foram mantidas como estavam.`);
      }
    }
  } catch (e) { avisar(`${f.name}: ${e.message}`, 'err'); }
  const pag = location.hash.slice(1) || 'inicio'; if (RENDER[pag]) RENDER[pag]();
}

/* ---------- Arquivos da sessão: produção esperada e limpeza ---------- */
// Arquivo de produção diferente da esperada pela competência do topo: pergunta antes de incluir.
async function aceitarProducao(nome, dom) {
  const esp = producaoEsperada(S.comp);
  if (!dom || dom.mes === esp) return true;
  return confirmar('Arquivo de outra produção', `«${esc(nome)}» é de produção <b>${rotuloMes(dom.mes)}</b>, mas a competência ${rotuloCompetencia(S.comp)} espera produção ${rotuloMes(esp)}. As análises seriam gravadas em ${rotuloCompetencia(S.comp)}. Incluir mesmo assim? (Se o arquivo é de outra competência, troque a competência no topo antes.)`, 'Incluir mesmo assim');
}
function limparSessao(oque) {
  if (oque === 'tudo' || oque === 'pdfs') S.relatorios = [];
  if (oque === 'tudo' || oque === 'bases') { S.apolo = null; S.pbi = null; }
}
async function limparArquivosSessao() {
  const r = await dialogo('Limpar arquivos da sessão', `<p class="small muted">Tira os arquivos da memória desta sessão. Rodadas, NCs, decisões e o fluxo continuam gravados.</p>
    <label class="opcao-conf"><input type="radio" name="oque" value="pdfs" checked> Só os PDFs do MV (${S.relatorios.length})</label>
    <label class="opcao-conf"><input type="radio" name="oque" value="bases"> Só Apolo e Power BI</label>
    <label class="opcao-conf"><input type="radio" name="oque" value="tudo"> Tudo</label>
    <label class="small" style="display:block;margin-top:8px"><input type="checkbox" name="apagarGuardadas"> apagar também as planilhas guardadas da competência ${rotuloCompetencia(S.comp)} (sem marcar, elas voltam ao recarregar a página)</label>`, [['', 'Cancelar', 'sec'], ['ok', 'Limpar']]);
  if (r.botao !== 'ok') return;
  if (r.campos.apagarGuardadas && r.campos.oque !== 'pdfs') for (const t of ['apolo', 'pbi']) await removerPlanilhaGuardada(t);
  limparSessao(r.campos.oque); avisar('Arquivos da sessão limpos.', 'ok'); RENDER.inicio();
}
// Na troca de competência: arquivos de outra produção podem ser limpos de uma vez.
async function oferecerLimpezaNaTroca() {
  const esp = producaoEsperada(S.comp), fora = [];
  for (const x of S.relatorios) { const d = producaoDoArquivo(x, () => x.rel.regs.map(l => l.data)); if (d && d.mes !== esp) fora.push(d.mes); }
  for (const a of [S.apolo, S.pbi]) { const d = a && producaoDoArquivo(a, () => (a.laudos || a.linhas).map(l => l.data)); if (d && d.mes !== esp) fora.push(d.mes); }
  if (!fora.length) return;
  const meses = [...new Set(fora)].map(rotuloMes).join(', ');
  if (await confirmar('Arquivos de outra produção', `A competência ${rotuloCompetencia(S.comp)} espera produção ${rotuloMes(esp)}, mas há ${fora.length} arquivo(s) carregado(s) de produção ${meses}. Limpar todos os arquivos da sessão?`, 'Limpar arquivos')) {
    limparSessao('tudo'); avisar('Arquivos da sessão limpos para a nova competência.', 'ok'); irPara(paginaAtual);
  }
}

// Ação única: o que o Power BI traz de novo para a base de dados (faturistas, convênios, procedimentos).
async function atualizarBasePowerBI() {
  if (!S.pbi) return avisar('Carregue a planilha do Power BI no Início.', 'warn');
  const op = await exigirOperador(); if (!op) return;
  const pv = previaAtualizacaoPowerBI(S.cfg, S.eq, S.pbi);
  const item = (k, n, txt, exemplos) => `<label class="opcao-conf"><input type="checkbox" name="${k}"${n ? ' checked' : ' disabled'}> <b>${n}</b> ${txt}${n ? `<small class="nc-det">${esc(exemplos.slice(0, 6).join(' · '))}${n > 6 ? ' …' : ''}</small>` : ''}</label>`;
  const r = await dialogo('Atualizar base de dados com o Power BI', `<p class="small muted">${esc(S.pbi.nome)}. Só entram catálogos, sem dados de pacientes. Nada do que foi marcado à mão é trocado.</p>
    ${item('faturistas', pv.faturistas.length, 'faturista(s) novo(s), com as unidades em que fecharam contas', pv.faturistas)}
    ${item('convenios', pv.convenios.length + pv.tipar.length, `convênio(s): ${pv.convenios.length} novo(s), ${pv.tipar.length} sem tipo que recebem o tipo do Power BI`, [...pv.convenios, ...pv.tipar].map(([n, t]) => `${n} (${TIPOS_CONVENIO[t] || 'sem tipo'})`))}
    ${item('tuss', pv.tuss.length, 'procedimento(s) (TUSS) novo(s) no catálogo', pv.tuss.map(p => `${p.codigo} ${p.desc}`))}
    <p class="small muted">O SUS continua marcado à mão em Bases → Convênios: o Power BI só traz Convênio ou Particular.</p>`, [['', 'Cancelar', 'sec'], ['ok', 'Atualizar']]);
  if (r.botao !== 'ok') return;
  const x = aplicarAtualizacaoPowerBI(S.cfg, S.eq, S.pbi, r.campos);
  if (x.faturistas || x.unidadesFaturistas || x.convenios || x.tipados) salvarCfg(`Base atualizada com o Power BI: ${x.faturistas} faturista(s), ${x.convenios} convênio(s) novo(s), ${x.tipados} convênio(s) tipado(s).`, 'regras');
  if (x.tuss) salvarEq(`${x.tuss} procedimento(s) do Power BI no catálogo TUSS.`);
  avisar(`Base de dados atualizada: ${x.faturistas} faturista(s), ${x.convenios} convênio(s) novo(s) e ${x.tipados} tipado(s), ${x.tuss} procedimento(s).`, 'ok');
  RENDER.inicio();
}
