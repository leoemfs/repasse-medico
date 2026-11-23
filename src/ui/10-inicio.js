/* ============================================================
 * Início: arquivos da sessão (carregados uma vez, usados por todas as análises)
 * ============================================================ */
// Complementos explícitos (P2, v3.0.0-alpha.11): o cartão da pasta raiz entra aqui, não por redefinição em outro arquivo.
RENDER.inicio = () => { desenharInicio(); complementoInicioPastaRaiz(); };
function desenharInicio() {
  /* v3.0.0-alpha.20 (simplificação): o Início é o painel do dia — marcos, arquivos do mês, andamento, o que pede você
   * e os relatórios do mês. Os quadros de upload ficam em «Carregar manualmente»; os atalhos para Conferência e Correção
   * saíram (o menu já leva lá); os marcos completos e as etapas ficam em Fechamento e envio › Etapas do mês. */
  const r = S.relatorios, a = S.apolo;
  $('pag-inicio').innerHTML = `${cartaoAvisoProducao()}${cabecalhoDoDia()}${painelCompetencia()}${painelControleUnidade()}
  <div class="card"><div class="fx-topo" style="margin-bottom:6px"><h2 style="margin:0">Relatórios do mês</h2>${S.relatorios.length || S.apolo || S.pbi ? '<button class="sec" id="btLimpar">Limpar arquivos…</button>' : ''}</div><div id="listaMV"></div></div>
  ${cartaoFecharCompetencia()}`;
  zonaArquivo($('dzMV'), $('inMV'), carregarPDFs);
  zonaArquivo($('dzApolo'), $('inApolo'), fs => carregarApolo(fs[0]));
  zonaArquivo($('dzPBI'), $('inPBI'), fs => carregarPBI(fs[0]));
  document.querySelectorAll('#pag-inicio [data-ir]').forEach(b => b.onclick = () => { if (b.dataset.fsub) FH.sub = b.dataset.fsub; location.hash = b.dataset.ir; });
  ligarPainelCompetencia();
  if ($('btLimpar')) $('btLimpar').onclick = limparArquivosSessao;
  ligarPlanilhasGuardadas($('pag-inicio'));
  if ($('btPbiBase')) $('btPbiBase').onclick = atualizarBasePowerBI;
  desenharListaMV();
}
// Marcos da competência para o Início: os dois últimos que passaram, o de hoje e os próximos (a linha completa fica nas Etapas do mês).
function marcosParaInicio(chave) {
  const comp = S.fluxo?.competencias[chave];
  let ms;
  if (comp) ms = indicadoresFluxo(comp).marcos;
  else { const [an, me] = chave.split('-').map(Number), d = calcularMarcos(S.fluxo.modelo, an, me, S.fluxo.modelo.calendario, {}).datas; ms = S.fluxo.modelo.marcos.filter(m => !m.oculto).map(m => ({ ...m, data: d[m.id] })); }
  const hoje = diaSerial(paraData(new Date()));
  ms = ms.filter(m => m.data).map(m => ({ ...m, d: diaSerial(m.data) - hoje })).sort((x, y) => x.d - y.d);
  const passados = ms.filter(m => m.d < 0).slice(-2), futuros = ms.filter(m => m.d >= 0).slice(0, 5);
  return [...passados, ...futuros];
}
function cabecalhoDoDia() {
  const ch = S.comp, fechada = compFechada(ch), hoje = new Date();
  const dia = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  const ms = S.fluxo ? marcosParaInicio(ch) : [];
  return `<div class="card ini-dia"><div class="ini-dia-topo"><div><span class="eyebrow">HOJE</span><h2 style="margin:2px 0 0">${esc(dia.charAt(0).toUpperCase() + dia.slice(1))} <span class="muted small">· competência ${rotuloCompetencia(ch)} ${fechada ? 'fechada' : 'aberta'} · produção ${rotuloMes(producaoEsperada(ch))}</span></h2></div>
    <a href="#fluxo" class="ini-link">Todos os marcos e etapas →</a></div>
    ${ms.length ? `<div class="marcos-linha" style="margin-top:10px">${ms.map(m => `<a href="#fluxo" class="mi ${m.d === 0 ? 'hoje' : m.d < 0 ? 'passado' : m.d <= 3 ? 'prox' : ''}" title="Ver nas Etapas do mês"><b>${fmtData(m.data).slice(0, 5)}${m.d === 0 ? ' · HOJE' : ''}${m.manual ? ' ✎' : ''}</b>${esc(m.nome)}<small>${m.d === 0 ? 'hoje' : m.d < 0 ? `há ${-m.d} dia(s)` : `em ${m.d} dia(s)`}</small></a>`).join('')}</div>` : ''}</div>`;
}
// «Pede você»: o que está parado esperando alguém, com o botão que leva até lá.
function pedidosDoDia(R) {
  const out = [], eqp = S.eq.itens.filter(e => e.status === 'pendente').length;
  const conf = relatoriosPara('cf'), comRodada = new Set(R.conf.map(x => String(x.prestadorCod)));
  const semConf = conf.filter(x => !comRodada.has(String(x.rel.cab.prestadorCod))).length;
  if (!S.relatorios.length) out.push(['Carregar os relatórios do MV (PDF)', 'pasta raiz ou «Carregar manualmente»', '', '']);
  if (!S.apolo) out.push(['Carregar a planilha de laudos do Apolo', `produção ${rotuloMes(producaoEsperada(S.comp))}`, '', '']);
  if (semConf) out.push([`${semConf} relatório(s) sem conferência`, 'nesta competência', 'conferencia', 'Conferir']);
  if (R.semAceite) out.push([`${R.semAceite} rodada(s) sem aceite`, 'conferência feita, falta o aceite', 'conferencia', 'Continuar']);
  if (eqp) out.push([`${eqp} equivalência(s) TUSS pendente(s)`, 'sem validação, nada é confirmado automaticamente', 'equivalencias', 'Validar']);
  if (R.indNC.porSituacao.aberta) out.push([`${R.indNC.porSituacao.aberta} NC(s) aberta(s)`, 'ainda não enviadas ao Qualiex', 'nc', 'Ver NCs']);
  // SOL-F49: descontos que mudam todo mês e o reajuste anual.
  const dc = descontosAConferir(S.cfg, S.comp);
  if (dc.length && !compFechada()) { let pag = ''; try { const mk = marcosFech(S.comp)[{ usg: 'pagUSG', img: 'pagIMG', curitiba: 'pagCuritiba' }[dc[0].tipo]]; if (mk) pag = `, pagamento ${fmtData(mk)}`; } catch (e) { }
    out.push([`Descontos a conferir no portal: ${dc.length}`, esc(dc.map(d => `${d.cod} · ${d.motivo}`).join(' · ')) + ` — ${esc([...new Set(dc.map(d => TIPOS_DESCONTO[d.tipo]))].join(', '))}${pag}`, 'fechamento', 'Conferir', dc[0].tipo]); }
  const rj = lembreteReajuste(S.cfg);
  if (rj) out.push([`Reajuste anual de ${rj.ano}`, 'revisar percentuais de USG, BOARD, valores do IMG e descontos fixos (Bases e regras → Reajuste anual)', 'bases', 'Abrir']);
  if (R.indFx?.vencidas.length) out.push([`${R.indFx.vencidas.length} etapa(s) com prazo vencido`, esc(R.indFx.vencidas[0].nome || ''), 'fluxo', 'Ver etapas']);
  if (R.indFx?.proximas.length) out.push([`${R.indFx.proximas.length} etapa(s) vencem em até 3 dias`, esc(R.indFx.proximas[0].nome || ''), 'fluxo', 'Ver etapas']);
  return out;
}
function cartaoFecharCompetencia() {
  const ch = S.comp, R = resumoCompetencia(ch), est = estadoCompetencia(S.compReg, ch), fechada = est.status === 'fechada';
  const porTipo = [...R.alt.reduce((m, a) => m.set(a.tipo, [...(m.get(a.tipo) || []), a]), new Map())];
  return `<div class="card fechamento ini-fech"><div><strong>${fechada ? `Competência fechada em ${new Date(est.fechadaEm).toLocaleString('pt-BR')} por ${esc(est.fechadaPor || '—')}` : `Fechar a competência ${rotuloCompetencia(ch)}`}</strong>
      <p class="small muted">${fechada ? 'Somente leitura: sem rodadas novas, NCs ou mudanças no fluxo. Pendências podem ser levadas para a competência seguinte.' : 'Depois de pago e encaminhado ao Financeiro: a competência fica somente leitura. Reabrir exige justificativa e fica no histórico.'}</p>
      <details class="small" id="iniBases"><summary>Bases alteradas nesta competência (${R.eqVal + R.alt.length})</summary>
        <div class="painel-comp"><div class="l"><div>Equivalências TUSS validadas<small>valem daqui em diante</small></div><span class="v">${R.eqVal}</span></div>
        ${porTipo.length ? porTipo.map(([t, l]) => `<div class="l"><div>${esc(TIPOS_ALTERACAO[t] || t)}<small title="${esc(l.map(a => a.descricao).join('\n'))}">${esc(l[l.length - 1].descricao)}${l[l.length - 1].por ? ` · ${esc(l[l.length - 1].por)}` : ''}</small></div><span class="v">${l.length}</span></div>`).join('') : '<p class="small muted">Nenhuma outra alteração nas bases nesta competência.</p>'}</div></details>
      ${est.historico?.length ? `<details class="small"><summary>Histórico (${est.historico.length})</summary><ul>${est.historico.map(h => `<li>${new Date(h.em).toLocaleString('pt-BR')} · ${esc(h.por || '—')} · ${esc(h.acao)}${h.obs ? ` — ${esc(h.obs)}` : ''}</li>`).join('')}</ul></details>` : ''}</div>
    <div class="acoes" style="margin:0"><button class="sec" id="compPacote" title="Pasta Comp_MM-AAAA (.zip): correção de prestador, NCs, planilhas usadas, relatórios por modalidade e unidade, conferências e planilha de controle">Exportar competência (pasta)</button>${fechada ? '<button class="sec" id="compReabrir">Reabrir…</button>' : `<button class="sec" id="compFechar">Fechar ${rotuloCompetencia(ch)}…</button>`}</div></div>`;
}

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
  const ch = S.comp, R = resumoCompetencia(ch), esp = producaoEsperada(ch), r = S.relatorios, a = S.apolo;
  const arq = (nome, sub, dom) => `<div class="l"><div>${nome}<small>${sub}</small></div><span class="v ${!dom ? 'muted' : dom.mes === esp ? 'txt-ok' : 'txt-warn'}">${!dom ? '—' : dom.mes === esp ? 'ok' : 'outro mês'}</span></div>`;
  const domMV = S.relatorios.map(x => producaoDoArquivo(x, () => x.rel.regs.map(r => r.data))).filter(Boolean);
  const mvDom = domMV.length ? (domMV.every(d => d.mes === esp) ? { mes: esp } : domMV.find(d => d.mes !== esp)) : null;
  const domAp = S.apolo ? producaoDoArquivo(S.apolo, () => S.apolo.laudos.map(l => l.data)) : null;
  const domPb = S.pbi ? producaoDoArquivo(S.pbi, () => S.pbi.linhas.map(l => l.data)) : null;
  const pct = R.indFx && R.indFx.total ? Math.round(R.indFx.ok / R.indFx.total * 100) : 0;
  const grupos = R.fx ? R.fx.modelo.grupos.filter(g => R.indFx.porGrupo[g.id]?.total && g.id !== 'prep') : [];
  const pedidos = pedidosDoDia(R);
  return `<div class="grid3 painel-comp ini-grid">
    <div class="card" id="iniArquivos"><h3>Arquivos do mês</h3>
      ${arq('Relatórios do MV', S.relatorios.length ? `${S.relatorios.length} PDF(s) · produção ${mvDom ? rotuloMes(mvDom.mes) : '—'}` : 'nenhum carregado', mvDom)}
      <div class="estado small" id="stMV">${r.length ? '' : '<span class="muted">Nenhum PDF carregado.</span>'}</div>
      ${arq('Laudos do Apolo', S.apolo ? `produção ${rotuloMes(domAp?.mes)}` : 'não carregado', domAp)}
      <div class="estado small" id="stApolo">${a ? resumoApolo(a) + estadoGuardada('apolo', a) : S.restaurando ? '<span class="muted">Restaurando a planilha guardada…</span>' : ''}</div>
      ${arq('Power BI <span class="muted small">(opcional)</span>', S.pbi ? `${S.pbi.linhas.length.toLocaleString('pt-BR')} lançamentos · ${rotuloMes(domPb?.mes)}` : 'não carregado', domPb)}
      <div class="estado small" id="stPBI">${S.pbi ? `<span class="muted small">${esc(S.pbi.nome)}</span><div class="acoes" style="margin-top:6px"><button class="sec mini" id="btPbiBase">Atualizar base de dados com o Power BI</button></div>${estadoGuardada('pbi', S.pbi)}` : S.restaurando ? '<span class="muted">Restaurando a planilha guardada…</span>' : ''}</div>
      <details class="ini-manual"${r.length || a ? '' : ' open'}><summary>Carregar manualmente…</summary>
        <div class="dz" id="dzMV">Relatório(s) do MV (PDF)<small>um ou vários · Relatório de Repasse de Prestadores do SOULMV</small><input id="inMV" type="file" accept=".pdf,application/pdf" multiple hidden></div>
        <div class="dz" id="dzApolo">Laudos do Apolo (.xlsx)<small>produção ${rotuloMes(esp)} · formato atual (BRANCH_NAME, TITLE…) ou antigo</small><input id="inApolo" type="file" accept=".xlsx" hidden></div>
        <div class="dz" id="dzPBI">Power BI (.xlsx)<small>opcional, só consulta</small><input id="inPBI" type="file" accept=".xlsx" hidden></div></details>
      <p class="small muted" style="margin:6px 0 0">Esperado: produção ${rotuloMes(esp)}.</p></div>
    <div class="card"><h3>Andamento</h3>
      ${grupos.length ? grupos.map(g => { const pg = R.indFx.porGrupo[g.id]; return `<div class="l"><div>${esc(g.nome.replace(/^Repasse (de )?/, ''))}<small>${pg.ok} de ${pg.total} etapas${pg.vencidas ? ` · <span class="txt-err">${pg.vencidas} vencida(s)</span>` : ''}</small></div><span class="v">${Math.round(pg.ok / pg.total * 100)}%</span></div><div class="barra"><i style="width:${Math.round(pg.ok / pg.total * 100)}%"></i></div>`; }).join('') : `<div class="l"><div>Etapas do mês<small>checklist não iniciado · <a href="#fluxo">iniciar</a></small></div><span class="v">—</span></div>`}
      <div class="l"><div>Conferências<small>${new Set(R.conf.map(r => r.prestadorCod)).size} prestador(es) · ${R.semAceite} sem aceite</small></div><span class="v">${R.conf.length}</span></div>
      <div class="l"><div>Não conformidades<small>${R.indNC.porSituacao.aberta} abertas · ${R.indNC.porSituacao.enviada + R.indNC.porSituacao.tratativa} enviadas ao Qualiex</small></div><span class="v">${R.ncs.length}</span></div>
      ${(() => { const h = historicoCobertura(S.rodadas, ch, 4), cob = coberturaCompetencia(S.rodadas, ch), ant = h[h.length - 2], d = cob.total && ant?.total ? Math.round((cob.pct - ant.pct) * 10) / 10 : null, f = v => fmtPct(v);
        return `<div class="l" id="cobInicio"><div>Cobertura automática<small>${cob.total ? `${cob.conferidas} de ${cob.total} linhas conferidas sem decisão manual${d !== null ? ` · ${d >= 0 ? '+' : ''}${f(d)} p.p. vs ${rotuloCompetencia(ant.chave)}` : ''}` : 'sem rodadas de conferência'} · <a href="#equivalencias" data-destrava>o que mais destrava</a></small></div><span class="v">${cob.total ? f(cob.pct) + '%' : '—'}</span></div>
        ${cob.total ? `<div class="barra"><i style="width:${cob.pct}%"></i></div>` : ''}
        <div class="hist-cob" title="Cobertura das últimas competências">${h.map(x => `<div><span style="height:${Math.max(2, Math.round(x.pct * 0.4))}px"${x.chave === ch ? ' class="atual"' : ''}></span>${x.total ? f(x.pct) + '%' : '—'}<small>${rotuloCompetencia(x.chave)}</small></div>`).join('')}</div>`; })()}
      ${R.indFx ? `<p class="small muted" style="margin:6px 0 0">${R.indFx.ok} de ${R.indFx.total} etapas do mês concluídas (${pct}%).</p>` : ''}</div>
    <div class="card"><h3>Pede você</h3>
      ${pedidos.length ? `<ul class="ini-pede">${pedidos.map(([t, sub, ir, bt, fsub]) => `<li><span><b>${t}</b><small>${sub}</small></span>${ir ? `<button class="sec mini" data-ir="${ir}"${fsub ? ` data-fsub="${fsub}"` : ''}>${bt}</button>` : ''}</li>`).join('')}</ul>` : '<p class="txt-ok">Nada esperando por você agora ✓</p>'}</div>
  </div>`;
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

const LM = { busca: '', grupo: '*', unidade: '*', fin: '*', tot: '*' };
function desenharListaMV() {
  const c = $('listaMV'); if (!c) return;
  if (!S.relatorios.length) { c.innerHTML = '<p class="muted">Nenhum relatório carregado.</p>'; return; }
  // Filtros (busca, grupo, unidade, finalidade, totais). O grupo vem da pasta ou, sem pasta, do próprio relatório.
  const tipoPdf = x => tipoRepasseDaRodada({ descricao: x.rel.cab.descricao, repasse: x.rel.cab.repasse, linhas: x.rel.regs.map(l => ({ grupo: l.grupoNome })) });
  const grupoDe = x => x.grupoPasta || (ehUnidadeV3(S.cfg, x.unidadePasta || '') ? 'curitiba' : tipoPdf(x));
  const unDe = x => x.unidadePasta || unidadeSugeridaPeloArquivo(x.nome) || '';
  const foraDaPasta = x => x.grupoPasta && x.grupoPasta !== 'curitiba' && tipoPdf(x) !== x.grupoPasta;
  const uns = [...new Set(S.relatorios.map(unDe).filter(Boolean))].sort((a, b) => +a - +b), q = norm(LM.busca);
  const vis = S.relatorios.filter(x => (!q || norm(`${x.nome} ${x.rel.cab.prestadorCod} ${x.rel.cab.prestadorNome} ${x.rel.cab.repasse} ${x.rel.cab.descricao}`).includes(q))
    && (LM.grupo === '*' || grupoDe(x) === LM.grupo) && (LM.unidade === '*' || (LM.unidade === '-' ? !unDe(x) : unDe(x) === LM.unidade))
    && (LM.fin === '*' || (x.finalidade || finalidadePadrao(x.rel)) === LM.fin) && (LM.tot === '*' || (LM.tot === 'ok' ? x.rel.ok : LM.tot === 'av' ? !x.rel.ok : foraDaPasta(x))));
  const nFora = S.relatorios.filter(foraDaPasta).length;
  c.innerHTML = `<div class="filtros lm-filtros">
      <label class="campo">Buscar<input type="search" id="lmBusca" value="${esc(LM.busca)}" placeholder="prestador, código, arquivo ou repasse"></label>
      <label class="campo">Grupo<select id="lmGrupo">${opcoes([['*', 'Todos'], ['usg', 'USG'], ['img', 'IMG'], ['curitiba', 'Curitiba']], LM.grupo)}</select></label>
      <label class="campo">Unidade<select id="lmUn">${opcoes([['*', 'Todas'], ...uns.map(u => [u, `${u} - ${unidadePorCod(S.cfg, u)?.nome || ''}`]), ['-', 'Sem unidade']], LM.unidade)}</select></label>
      <label class="campo">Finalidade<select id="lmFin">${opcoes([['*', 'Todas'], ['conferencia', 'Conferência'], ['correcao', 'Correção de prestador']], LM.fin)}</select></label>
      <label class="campo">Totais do PDF<select id="lmTot">${opcoes([['*', 'Todos'], ['ok', 'Conferem'], ['av', 'Com avisos'], ['pasta', `Grupo diferente da pasta (${nFora})`]], LM.tot)}</select></label></div>
    <p class="small muted">${vis.length} de ${S.relatorios.length} relatório(s).${nFora ? ` <span class="badge warn">${nFora} PDF(s) com grupo diferente da pasta</span> — confira se o relatório certo está na pasta.` : ''}</p>
    <div class="tw lm-tab"><table><thead><tr><th>Arquivo</th><th>Prestador</th><th>Unidade · grupo</th><th>Repasse</th><th>Competência</th><th>Produção</th><th>Finalidade</th><th class="n">Linhas</th><th class="n">Vl Repasse</th><th>Totais do PDF</th><th></th></tr></thead><tbody>${vis.map(x => {
    const r = x.rel, g = grupoDe(x);
    return `<tr><td>${esc(x.nome)}</td><td>${esc(r.cab.prestadorCod)} - ${esc(r.cab.prestadorNome)}</td><td>${unDe(x) ? `${esc(unDe(x))} · ` : ''}${g === 'curitiba' ? 'Curitiba' : g.toUpperCase()}${x.unidadePasta ? ' <span class="muted small">(pasta)</span>' : ''}${foraDaPasta(x) ? `<div><span class="badge warn" title="O relatório é de ${tipoPdf(x).toUpperCase()}, mas está na pasta ${x.grupoPasta.toUpperCase()}">PDF de ${tipoPdf(x).toUpperCase()} na pasta ${x.grupoPasta.toUpperCase()}</span></div>` : ''}</td><td>${esc(r.cab.repasse)} · ${esc(r.cab.descricao)}${(r.cab.repasses || []).length > 1 ? `<div class="small muted" title="${esc(r.cab.repasses.map(x => `${x.numero}${x.data ? ' de ' + x.data : ''}${x.descricao ? ' «' + x.descricao + '»' : ''}: ${x.linhas} linha(s), R$ ${fmtBR(x.vlRepasse)}`).join('\n'))}">+ ${r.cab.repasses.length - 1} repasse(s): ${esc(r.cab.repasses.slice(1).map(x => x.numero).join(', '))}</div>` : ''}</td><td>${esc(r.cab.competencia)}</td><td>${(() => { const d = producaoDoArquivo(x, () => r.regs.map(l => l.data)); return d ? `<span class="${d.mes === producaoEsperada(S.comp) ? '' : 'txt-warn'}">${rotuloMes(d.mes)}</span>` : '—'; })()}</td>
      <td><select data-fin="${x.id}" aria-label="Finalidade">${opcoes([['conferencia', 'Conferência'], ['correcao', 'Correção de prestador']], x.finalidade || finalidadePadrao(r))}</select></td><td class="n">${r.regs.length}</td><td class="n">${fmtBR(r.totExtraido[0])}</td>
      <td>${r.ok ? '<span class="badge ok">Conferem</span>' : `<span class="badge err" title="${esc(r.avisos.join('\n'))}">${r.avisos.length} aviso(s)</span>`}${r.notas.length ? ` <span class="muted small" title="${esc(r.notas.join('\n'))}">ⓘ ${r.notas.length} nota(s)</span>` : ''}</td>
      <td style="white-space:nowrap"><button class="sec" data-xl="${x.id}">Excel</button> <button class="perigo" data-rm="${x.id}" title="Remover da sessão">✕</button></td></tr>`;
  }).join('')}</tbody></table></div>
  ${S.relatorios.some(x => !x.rel.ok) ? `<ul class="avisos">${S.relatorios.flatMap(x => x.rel.avisos.slice(0, 6).map(a => `<li>${esc(x.nome)}: ${esc(a)}</li>`)).join('')}</ul>` : ''}`;
  $('lmBusca').oninput = e => { LM.busca = e.target.value; clearTimeout(LM.t); LM.t = setTimeout(() => { desenharListaMV(); const i = $('lmBusca'); i.focus(); i.setSelectionRange(LM.busca.length, LM.busca.length); }, 250); };
  [['lmGrupo', 'grupo'], ['lmUn', 'unidade'], ['lmFin', 'fin'], ['lmTot', 'tot']].forEach(([id, k]) => { $(id).onchange = e => { LM[k] = e.target.value; desenharListaMV(); }; });
  c.querySelectorAll('[data-xl]').forEach(b => b.onclick = () => { const x = S.relatorios.find(y => y.id === b.dataset.xl); baixarZip(xlsxExtracao(x.rel), `MV_extraido_${nomeSeguro(x.rel.cab.prestadorNome)}_${x.rel.cab.repasse}.xlsx`); });
  c.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { S.relatorios = S.relatorios.filter(y => y.id !== b.dataset.rm); RENDER.inicio(); });
  c.querySelectorAll('[data-fin]').forEach(s => s.onchange = () => { S.relatorios.find(y => y.id === s.dataset.fin).finalidade = s.value; avisar(`Relatório marcado para ${s.value === 'correcao' ? 'a Correção de prestador' : 'a Conferência'}.`, 'ok'); });
}

async function carregarPDFs(files, origem = null) {
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
      if (!await aceitarProducao(f.name, producaoDoArquivo(item, () => rel.regs.map(l => l.data)), origem)) continue;
      item.finalidade = finalidadePadrao(rel);
      S.relatorios.push(item);
      if (registrarPrestadorDoMV(S.cfg, rel.cab.prestadorCod, rel.cab.prestadorNome)) salvarCfg();
      avisar(`${f.name}: ${rel.regs.length} linhas · ${rel.ok ? 'totais conferem com o PDF' : 'há avisos na conferência de totais'}.`, rel.ok ? 'ok' : 'warn');
    } catch (e) { avisar(`${f.name}: erro ao ler o PDF (${e.message}).`, 'err'); }
  }
  // Só redesenha o Início se ele está aberto (a reconferência carrega o PDF a partir da Conferência).
  if (paginaAtual === 'inicio') RENDER.inicio();
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
// origem (PDF lido da pasta): mostra onde o arquivo está e permite «Ignorar este arquivo», lembrado neste navegador
// enquanto o arquivo não mudar. Antes, «Cancelar» valia só até recarregar e o aviso voltava a cada abertura.
async function aceitarProducao(nome, dom, origem = null) {
  const esp = producaoEsperada(S.comp);
  if (!dom || dom.mes === esp) return true;
  const texto = `<p>«${esc(nome)}» é de produção <b>${rotuloMes(dom.mes)}</b>, mas a competência ${rotuloCompetencia(S.comp)} espera produção ${rotuloMes(esp)}. As análises seriam gravadas em ${rotuloCompetencia(S.comp)}. Incluir mesmo assim? (Se o arquivo é de outra competência, troque a competência no topo antes.)</p>`;
  if (!origem) return confirmar('Arquivo de outra produção', texto.replace(/^<p>|<\/p>$/g, ''), 'Incluir mesmo assim');
  const r = await dialogo('Arquivo de outra produção', `${texto}<p class="small"><b>Onde está:</b> <code>${esc(origem.caminho)}</code><br><span class="muted">A ferramenta lê todas as subpastas de «Relatórios para conferência» e «Correção de prestador» (menos as que começam com «_»). Para tirar de vez, apague ou mova o arquivo dessa pasta, ou ignore-o aqui.</span></p>`,
    [['', 'Agora não', 'sec'], ['ignorar', 'Ignorar este arquivo', 'sec'], ['ok', 'Incluir mesmo assim']]);
  if (r.botao === 'ignorar') { ignorarPDF(origem, nome); avisar(`«${nome}» ignorado: não será lido de novo enquanto o arquivo não mudar. Para voltar a ler, use «PDFs ignorados» no cartão da pasta raiz.`, 'ok'); }
  return r.botao === 'ok';
}
const pdfsIgnorados = () => lerLocal(CHAVES.pdfsIgnorados) || {};
const pdfIgnorado = (chave, sig) => pdfsIgnorados()[chave]?.sig === sig;
function ignorarPDF(origem, nome) { const m = pdfsIgnorados(); m[origem.chave] = { sig: origem.sig, nome, caminho: origem.caminho, comp: S.comp, por: S.operador || '', em: agoraISO() }; gravarLocal(CHAVES.pdfsIgnorados, m); }
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
