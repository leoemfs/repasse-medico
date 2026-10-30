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
      <li class="${eqv ? 'feito' : ''}"><div><strong>Equivalências TUSS validadas</strong> <span class="muted">— ${eqv} validadas · ${eqp} pendentes. Sem validação, nada é confirmado automaticamente.</span></div></li>
      <li class="${S.pbi ? 'feito' : ''}"><div><strong>Power BI</strong> <span class="muted">— opcional, só consulta; não interfere nos motores.</span></div></li>
    </ol>
  </div>
  <div class="grid2">
    <div class="card fonte"><h3>Relatório de repasse MV (PDF)</h3>
      <div class="dz" id="dzMV">Clique ou arraste o(s) PDF(s)<small>Relatório de Repasse de Prestadores do SOULMV</small><input id="inMV" type="file" accept=".pdf,application/pdf" multiple hidden></div>
      <div class="estado" id="stMV">${r.length ? `${r.length} relatório(s) carregado(s).` : '<span class="muted">Nenhum PDF carregado.</span>'}</div></div>
    <div class="card fonte"><h3>Laudos do Apolo (.xlsx)</h3>
      <div class="dz" id="dzApolo">Clique ou arraste a planilha<small>Formato atual (BRANCH_NAME, TITLE…) ou antigo</small><input id="inApolo" type="file" accept=".xlsx" hidden></div>
      <div class="estado" id="stApolo">${a ? resumoApolo(a) : '<span class="muted">Nenhuma planilha carregada.</span>'}</div></div>
    <div class="card fonte"><h3>Equivalências TUSS</h3>
      <div class="dz" id="dzEq">Importar planilha de análise (.xlsx) ou base (.json)<small>Candidatos entram como pendentes; validação em «Equivalências TUSS»</small><input id="inEq" type="file" accept=".xlsx,.json" hidden></div>
      <div class="estado"><span class="badge ${eqv ? 'ok' : 'warn'}">${eqv} validadas</span> <span class="badge ${eqp ? 'warn' : 'ok'}">${eqp} pendentes</span> <span class="muted small">revisão ${S.eq.revisao}</span></div></div>
    <div class="card fonte"><h3>Power BI (.xlsx) — opcional</h3>
      <div class="dz" id="dzPBI">Clique ou arraste a planilha do Power BI<small>Catálogo de unidades, grupos, procedimentos e códigos de prestador</small><input id="inPBI" type="file" accept=".xlsx" hidden></div>
      <div class="estado" id="stPBI">${S.pbi ? `<span class="badge ok">${S.pbi.linhas.length} linhas</span> <span class="muted small">${esc(S.pbi.nome)}</span>` : '<span class="muted">Não carregado.</span>'}</div></div>
  </div>
  <div class="card"><h2>Relatórios do MV carregados</h2><div id="listaMV"></div></div>
  <div class="grid2">
    <div class="card"><h3>Conferência cruzada MV × Apolo</h3><p class="muted">Confirma se cada linha do repasse tem laudo e lista os laudos sem lançamento. Mostra pendências por categoria e marcadores.</p><div class="acoes"><button data-ir="conferencia">Abrir conferência →</button></div></div>
    <div class="card"><h3>Correção de prestador</h3><p class="muted">Identifica o médico do laudo de cada linha, separando identificados, não identificados, conflitos e dados insuficientes. Não sugere prestador.</p><div class="acoes"><button data-ir="correcao">Abrir correção →</button></div></div>
  </div>`;
  zonaArquivo($('dzMV'), $('inMV'), carregarPDFs);
  zonaArquivo($('dzApolo'), $('inApolo'), fs => carregarApolo(fs[0]));
  zonaArquivo($('dzEq'), $('inEq'), fs => importarEquivalenciasArquivo(fs[0], 'mesclar'));
  zonaArquivo($('dzPBI'), $('inPBI'), fs => carregarPBI(fs[0]));
  document.querySelectorAll('#pag-inicio [data-ir]').forEach(b => b.onclick = () => { location.hash = b.dataset.ir; });
  ligarPainelCompetencia();
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
        ${R.indFx ? `<div class="barra"><i style="width:${pct}%"></i></div>` : ''}</div>
      <div><h3>Bases alteradas nesta competência</h3>
        <div class="l"><div>Equivalências TUSS validadas<small>valem daqui em diante</small></div><span class="v">${R.eqVal}</span></div>
        ${porTipo.length ? porTipo.map(([t, l]) => `<div class="l"><div>${esc(TIPOS_ALTERACAO[t] || t)}<small title="${esc(l.map(a => a.descricao).join('\n'))}">${esc(l[l.length - 1].descricao)}${l[l.length - 1].por ? ` · ${esc(l[l.length - 1].por)}` : ''}</small></div><span class="v">${l.length}</span></div>`).join('') : '<p class="small muted">Nenhuma outra alteração nas bases nesta competência.</p>'}</div>
    </div>
    <div class="fechamento"><div><strong>${fechada ? `Fechada em ${new Date(est.fechadaEm).toLocaleString('pt-BR')} por ${esc(est.fechadaPor || '—')}` : 'Fechar a competência'}</strong>
      <p class="small muted">${fechada ? 'Somente leitura: sem rodadas novas, NCs ou mudanças no fluxo. Pendências podem ser levadas para a competência seguinte.' : 'Depois de pago e encaminhado ao Financeiro: a competência fica somente leitura. Reabrir exige justificativa e fica no histórico.'}</p>
      ${est.historico?.length ? `<details class="small"><summary>Histórico (${est.historico.length})</summary><ul>${est.historico.map(h => `<li>${new Date(h.em).toLocaleString('pt-BR')} · ${esc(h.por || '—')} · ${esc(h.acao)}${h.obs ? ` — ${esc(h.obs)}` : ''}</li>`).join('')}</ul></details>` : ''}</div>
      <div class="acoes" style="margin:0"><button class="sec" id="compPacote">Exportar pacote da competência</button>${fechada ? '<button class="sec" id="compReabrir">Reabrir…</button>' : `<button id="compFechar">Fechar ${rotuloCompetencia(ch)}…</button>`}</div></div></div>`;
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
  $('compPacote').onclick = () => exportarPacoteCompetencia(ch);
}
// Pacote para guardar na rede: NCs e fluxo em Excel, rodadas e resumo em JSON.
async function exportarPacoteCompetencia(ch) {
  const R = resumoCompetencia(ch), z = new JSZip(), mmaaaa = `${ch.slice(5)}-${ch.slice(0, 4)}`;
  const bin = zip => zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  if (R.ncs.length) {
    const pr = prazosNC(ch);
    z.file(`NAO_CONFORMIDADES_${mmaaaa}.xlsx`, await bin(xlsxNC(R.ncs, ch, { operador: S.operador, prazos: Object.fromEntries(Object.entries(pr.grupos).map(([k, g]) => [k, g.data])) })));
  }
  if (R.fx) z.file(`Fluxo_mensal_${mmaaaa}.xlsx`, await bin(xlsxFluxo(R.fx)));
  z.file(`rodadas_${mmaaaa}.json`, JSON.stringify({ schema: 'repasse-medico/rodadas', versaoSchema: 1, competencia: ch, exportadoEm: agoraISO(), rodadas: R.rods }, null, 1));
  z.file('resumo_competencia.json', JSON.stringify({ competencia: ch, producao: producaoEsperada(ch), exportadoEm: agoraISO(), operador: S.operador, motor: MOTOR_VERSAO,
    estado: estadoCompetencia(S.compReg, ch), rodadas: { conferencia: R.conf.length, correcao: R.corr.length, semAceite: R.semAceite }, naoConformidades: R.indNC,
    fluxo: R.indFx ? { concluidas: R.indFx.ok, total: R.indFx.total, vencidas: R.indFx.vencidas.length } : null, equivalenciasValidadas: R.eqVal }, null, 1));
  baixarBlob(await z.generateAsync({ type: 'blob', compression: 'DEFLATE' }), `Pacote_competencia_${mmaaaa}_${carimbo()}.zip`);
  if (R.ncs.length) avisar('Pacote gerado. Ele inclui a planilha de NCs, que tem dados de pacientes: guarde na rede conforme a política da empresa.', 'info');
}

function resumoApolo(a) {
  const al = [];
  if (a.semNome) al.push(`${a.semNome} sem nome`); if (a.semData) al.push(`${a.semData} sem data`); if (a.semMedico) al.push(`${a.semMedico} sem médico`); if (a.idsDuplos) al.push(`${a.idsDuplos} ID(s) com dois nomes`);
  return `<span class="badge ok">${a.laudos.length.toLocaleString('pt-BR')} laudos</span> <span class="muted small">${esc(a.nome)} · última linha com dados ${a.ultimaLinha} · ${a.segundos.toFixed(1)} s</span>${al.length ? `<div class="small" style="margin-top:6px;color:var(--warn)">Atenção: ${esc(al.join(' · '))}</div>` : ''}${a.ignoradas ? `<div class="small muted">${a.ignoradas} linha(s) vazias ignoradas.</div>` : ''}`;
}

function desenharListaMV() {
  const c = $('listaMV'); if (!c) return;
  if (!S.relatorios.length) { c.innerHTML = '<p class="muted">Nenhum relatório carregado.</p>'; return; }
  c.innerHTML = `<div class="tw"><table><thead><tr><th>Arquivo</th><th>Prestador</th><th>Repasse</th><th>Competência</th><th class="n">Linhas</th><th class="n">Vl Repasse</th><th>Totais do PDF</th><th></th></tr></thead><tbody>${S.relatorios.map(x => {
    const r = x.rel;
    return `<tr><td>${esc(x.nome)}</td><td>${esc(r.cab.prestadorCod)} - ${esc(r.cab.prestadorNome)}</td><td>${esc(r.cab.repasse)} · ${esc(r.cab.descricao)}</td><td>${esc(r.cab.competencia)}</td><td class="n">${r.regs.length}</td><td class="n">${fmtBR(r.totExtraido[0])}</td>
      <td>${r.ok ? '<span class="badge ok">Conferem</span>' : `<span class="badge err" title="${esc(r.avisos.join('\n'))}">${r.avisos.length} aviso(s)</span>`}${r.notas.length ? ` <span class="muted small" title="${esc(r.notas.join('\n'))}">ⓘ ${r.notas.length} nota(s)</span>` : ''}</td>
      <td style="white-space:nowrap"><button class="sec" data-xl="${x.id}">Excel</button> <button class="perigo" data-rm="${x.id}" title="Remover da sessão">✕</button></td></tr>`;
  }).join('')}</tbody></table></div>
  ${S.relatorios.some(x => !x.rel.ok) ? `<ul class="avisos">${S.relatorios.flatMap(x => x.rel.avisos.slice(0, 6).map(a => `<li>${esc(x.nome)}: ${esc(a)}</li>`)).join('')}</ul>` : ''}`;
  c.querySelectorAll('[data-xl]').forEach(b => b.onclick = () => { const x = S.relatorios.find(y => y.id === b.dataset.xl); baixarZip(xlsxExtracao(x.rel), `MV_extraido_${nomeSeguro(x.rel.cab.prestadorNome)}_${x.rel.cab.repasse}.xlsx`); });
  c.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { S.relatorios = S.relatorios.filter(y => y.id !== b.dataset.rm); RENDER.inicio(); });
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
      S.relatorios.push({ id: novoId('mv'), nome: f.name, tamanho: f.size, hash, rel });
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
    S.apolo = await lerApolo(bytes, f.name, n => { const b = $('barApolo'); if (b) b.style.width = Math.min(95, n / 300) + '%'; });
    S.apolo.hash = hashBytes(bytes); S.apolo.tamanho = f.size;
    const semUnidade = [...new Set(S.apolo.laudos.map(l => norm(l.unidade)))].filter(u => !S.cfg.unidades.some(x => (x.apolo || []).map(norm).includes(u)));
    avisar(`${f.name}: ${S.apolo.laudos.length} laudos lidos.${semUnidade.length ? ` ${semUnidade.length} unidade(s) do Apolo sem cadastro em Bases.` : ''}`, semUnidade.length ? 'warn' : 'ok');
  } catch (e) { S.apolo = null; avisar(`${f.name}: ${e.message}`, 'err'); }
  RENDER.inicio();
}

async function carregarPBI(f) {
  if (!/\.xlsx$/i.test(f.name)) return avisar('Envie a planilha do Power BI em .xlsx.', 'err');
  $('stPBI').textContent = `Lendo ${f.name}…`;
  try { S.pbi = await lerPowerBI(await lerArquivo(f), f.name); avisar(`${f.name}: ${S.pbi.linhas.length} linhas (base de consulta).`, 'ok'); }
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
