/* ============================================================
 * Início: arquivos da sessão (carregados uma vez, usados por todas as análises)
 * ============================================================ */
RENDER.inicio = () => {
  const r = S.relatorios, a = S.apolo, eqv = S.eq.itens.filter(e => e.status === 'validada').length, eqp = S.eq.itens.filter(e => e.status === 'pendente').length;
  $('pag-inicio').innerHTML = `
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
  desenharListaMV();
};

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
