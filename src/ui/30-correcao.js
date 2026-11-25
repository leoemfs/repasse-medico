/* ============================================================
 * Correção / identificação de prestador
 * ============================================================ */
RENDER.correcao = () => {
  const p = $('pag-correcao');
  if (!S.relatorios.length || !S.apolo) { p.innerHTML = faltamArquivos('co'); return; }
  if (!relatoriosPara('co').length) { p.innerHTML = semRelatorioPara('co'); return; }
  p.innerHTML = `${cartaoAvisoProducao()}<div class="card"><h2>Parâmetros</h2><p class="lead">Identifica o médico do laudo de cada linha do relatório só com evidência verificável: nome idêntico ou truncado, data dentro da tolerância e equivalência TUSS validada. Não há sugestão de prestador para os casos não identificados.</p>
    ${seletoresAnalise('co', S.cfg.parametros.tolCorrecao)}
    <div class="acoes"><button id="coRodar">Executar identificação</button>${botaoSyncPasta('co')}</div></div><div id="coRes">${cartaoOutraCompetencia(S.corr, 'correção de prestador')}</div>`;
  if (!$('coRel')) { $('coRodar').disabled = true; return; }
  $('coExtra').innerHTML = '';
  $('coRodar').onclick = () => comProcessando($('coRodar'), executarCorrecao, 'a identificação');
  if (S.corr && S.corr.ctx.chaveCompetencia === S.comp) desenharCorrecao();
};

async function executarCorrecao() {
  const x = relSelecionado('co'), un = $('coUn').value, tol = +$('coTol').value;
  if (!un) return avisar('Escolha a unidade dos laudos: o PDF não informa a unidade.', 'warn');
  if (!exigirAberta(S.comp, 'executar uma correção de prestador')) return;
  const res = corrigirPrestador(x.rel, S.apolo, S.cfg, S.eq, { unidadeCod: un, tol });
  const ctx = { chaveCompetencia: S.comp, relId: x.id, relatorio: x.rel, apoloNome: S.apolo.nome, unidadeCod: un, unidadeNome: un === '*' ? 'Todas as unidades' : `${un} - ${unidadePorCod(S.cfg, un)?.nome || ''}`,
    parametros: { tol }, operador: S.operador, cfgRevisao: S.cfg.revisao, em: new Date().toLocaleString('pt-BR'),
    arquivos: [{ papel: 'MV', nome: x.nome, hash: x.hash }, { papel: 'Apolo', nome: S.apolo.nome, hash: S.apolo.hash }] };
  const rodada = registroRodada(res, ctx); ctx.rodadaId = rodada.id;
  const ant = rodadaAnterior(S.rodadas, rodada);
  await guardarRodada(rodada);
  // Mesmo prestador e unidade (ex.: «Reler o PDF»): mantém filtros e busca.
  const antes = S.corr && String(S.corr.ctx?.relatorio?.cab?.prestadorCod) === String(x.rel.cab.prestadorCod) && S.corr.ctx?.unidadeCod === un ? S.corr : null;
  S.corr = { res, ctx, rodada, comparacao: ant ? { ant, grupos: compararRodadas(ant, rodada) } : null, filtro: antes?.filtro || new Set(), busca: antes?.busca || '', soLista: !!antes?.soLista };
  ctx.fonteNC = `corr|${x.id}|${un}`;
  guardarCandidatosNC(ctx.fonteNC, `Correção ${x.rel.cab.prestadorCod} - ${x.rel.cab.prestadorNome} · ${ctx.unidadeNome}`, `Corr. ${x.rel.cab.prestadorCod} · un. ${un}`, candidatosDaCorrecao(res, ctx, S.cfg));
  desenharCorrecao();
  avisar(`Identificação concluída: ${res.porEstado.identificado.n} de ${res.linhas.length} linhas com prestador identificado.`, 'ok');
}

function desenharCorrecao() {
  const { res, ctx, comparacao } = S.corr, c = $('coRes'); if (!c) return;
  c.innerHTML = `<div class="card"><h2>Resultado <span class="muted small">rodada ${esc(ctx.rodadaId)}</span></h2>
    <dl class="kv"><dt>Relatório</dt><dd>${esc(ctx.relatorio.cab.prestadorCod)} - ${esc(ctx.relatorio.cab.prestadorNome)} · repasse ${esc(ctx.relatorio.cab.repasse)} · ${esc(ctx.relatorio.cab.descricao)}</dd>
    <dt>Unidade</dt><dd>${esc(ctx.unidadeNome)} · ${res.nLaudosUnidade.toLocaleString('pt-BR')} laudos · tolerância ${ctx.parametros.tol} dia(s)</dd>
    <dt>Equivalências</dt><dd>${res.eqValidadas} validadas (revisão ${res.eqRevisao})</dd>
    <dt>Reconciliação</dt><dd>${Object.values(res.porEstado).reduce((a, s) => a + s.n, 0)} = ${res.linhas.length} linhas do MV ${Object.values(res.porEstado).reduce((a, s) => a + s.n, 0) === res.linhas.length ? '<span class="badge ok">confere</span>' : '<span class="badge err">não confere</span>'}</dd></dl>
    ${comparacao ? resumoComparacao(comparacao) : ''}
    <div class="tiles">${Object.entries(ESTADO_CORR).map(([k, e]) => `<button class="tile st-${k}${res.porEstado[k].n ? '' : ' vazio'}${S.corr.filtro.has(k) ? ' sel' : ''}" data-st="${k}"><b>${res.porEstado[k].n}</b><small>${esc(e.nome)}</small><small class="muted" style="display:block;font-weight:400">R$ ${fmtBR(res.porEstado[k].vlRepasse)}</small></button>`).join('')}</div>
    <div class="marcadores">${Object.entries(res.porMotivo).map(([k, n]) => `<span class="marc">${esc(MOTIVOS_CORR[k])} · ${n}</span>`).join('')}</div>
    ${faixaForaCorrecao(res)}
    <div class="acoes"><input type="search" id="coBusca" placeholder="Buscar paciente, código ou médico…" value="${esc(S.corr.busca)}" style="max-width:420px"><button id="coExcel">Exportar planilha de trabalho</button>${botaoRelerCorrecao()}</div>
    <div id="coTab" style="margin-top:10px"></div></div>
    ${ctx.fonteNC ? cartaoCandidatosNC(ctx.fonteNC) : ''}
    <div class="grid2"><div class="card"><h2>Médicos identificados</h2><div id="coMed"></div></div>
    <div class="card"><h2>Equivalências desta rodada</h2><div id="coEq"></div></div></div>`;
  ligarCartaoCandidatosNC(c);
  ligarRelerCorrecao(c);
  if ($('coSoLista')) $('coSoLista').onclick = () => { S.corr.soLista = !S.corr.soLista; desenharCorrecao(); };
  c.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { const s = S.corr.filtro; s.has(b.dataset.st) ? s.delete(b.dataset.st) : s.add(b.dataset.st); desenharCorrecao(); });
  $('coExcel').onclick = () => entregarArquivo(xlsxCorrecao(res, ctx), nomeArquivoAnalise('correcao', ctx), 'corr', ctx.chaveCompetencia || S.comp);
  const filtrar = () => {
    const q = norm(S.corr.busca);
    return res.linhas.filter(o => (!S.corr.soLista || linhaForaCorrecao(S.cfg, o)) && (!S.corr.filtro.size || S.corr.filtro.has(o.estado)) && (!q || norm([o.r.paciente, o.r.codigo, o.r.procDesc, o.medico].join(' ')).includes(q)));
  };
  const t = tabela($('coTab'), {
    linhas: filtrar(), colunas: [
      { t: 'Linha', n: true, v: o => o.r.seq }, { t: 'Estado', html: o => `${chipStatus(o.estado, ESTADO_CORR[o.estado].nome)}${linhaForaCorrecao(S.cfg, o) ? '<br><span class="tag-fora">não pode ficar aqui</span>' : ''}` },
      { t: 'Código', v: o => o.r.codigo }, { t: 'Procedimento MV', v: o => o.r.procDesc }, { t: 'Paciente', html: o => `<span class="pac">${esc(o.r.paciente)}${o.r.paciente ? `<button type="button" class="cp-nome" data-copiar="${esc(o.r.paciente)}" title="Copiar o nome" aria-label="Copiar o nome">${ICONE_COPIAR}</button>` : ''}</span>` }, { t: 'Data', v: o => fmtData(o.r.data) },
      { t: 'Médico do laudo', v: o => o.estado === 'identificado' ? o.medico : '' }, { t: 'Cód. prestador', v: o => o.prestador?.cod || '' },
      { t: 'Motivo', v: o => MOTIVOS_CORR[o.motivo] || '' }, { t: 'Vl Repasse', n: true, v: o => fmtBR(o.r.vlRepasse) }
    ],
    classeLinha: o => linhaForaCorrecao(S.cfg, o) ? 'fora-corr' : '',
    detalhe: o => detalheLinhaCorrecao(o, res.linhas.indexOf(o))
  });
  $('coBusca').oninput = e => { S.corr.busca = e.target.value; t.atualizar(filtrar()); };
  $('coTab').addEventListener('click', async e => {
    const b = e.target.closest('[data-copiar]'); if (!b) return; e.stopPropagation();
    try { await navigator.clipboard.writeText(b.dataset.copiar); const k = b.closest('.cpv') || b; k.classList.add('ok'); setTimeout(() => k.classList.remove('ok'), 1200); }
    catch (_) { avisar('Não foi possível copiar: selecione o texto e use Ctrl+C.', 'warn'); }
  });
  $('coTab').addEventListener('click', e => { const b = e.target.closest('[data-nc-linha]'); if (b) abrirRegistroNC([candidatoDaLinhaCorrecao(res.linhas[+b.dataset.ncLinha], ctx, S.cfg)]).then(ok => ok && desenharCorrecao()); });
  tabela($('coMed'), { porPagina: 50, linhas: res.porMedico, colunas: [{ t: 'Médico (Apolo)', v: m => m.medico }, { t: 'Cód. prestador', v: m => m.cod || 'sem cadastro' }, { t: 'Linhas', n: true, v: m => m.n }, { t: 'Vl Repasse', n: true, v: m => fmtBR(m.vlRepasse) }], vazio: 'Nenhum médico identificado.' });
  painelEqRodada($('coEq'), paresDaCorrecao(res), executarCorrecao);
}

/* Padrão da Conferência na Correção de prestador (prévia aprovada em 25/11/2026: docs/prototipos/correcao-padronizada/).
 * Só a aparência muda: cálculo, filtros, Excel e NC continuam os mesmos. */
function faixaForaCorrecao(res) {
  const r = resumoForaCorrecao(res, S.cfg); if (!r.n) return '';
  return `<div class="faixa-fora"><b>${r.n} linha(s) de prestadores que não podem ficar neste relatório</b><span>· R$ ${fmtBR(r.valor)} · ${r.prestadores.map(p => `${esc(p.nome || p.cod)} (${p.n})`).join(', ')}</span><button type="button" class="sec mini" id="coSoLista">${S.corr.soLista ? 'Mostrar todas' : 'Mostrar só essas'}</button></div>`;
}
function detalheLinhaCorrecao(o, i) {
  const fora = linhaForaCorrecao(S.cfg, o), nomePrest = o.prestador ? `${o.prestador.nomeMV || o.medico} (${o.prestador.cod})` : o.medico;
  const tags = [MOTIVOS_CORR[o.motivo], ...(o.alertas.length ? [`${o.alertas.length} alerta(s)`] : [])].filter(Boolean);
  const titulo = o.estado === 'identificado' ? (fora ? `Lançado no genérico, mas o laudo é de ${nomePrest}` : `Laudo de ${nomePrest}`) : ESTADO_CORR[o.estado].nome;
  const nivel = fora ? 'err' : o.estado === 'identificado' ? 'ok' : 'warn';
  const ch = (n, t) => `<span class="chip-s ${n}">${esc(t)}</span>`;
  const cards = o.evidencias.length ? o.evidencias.map(e => `<div class="la-cand"><b>«${esc(e.titulo)}» · ${fmtData(e.data)}</b><div class="chips-s">${e.nm >= 3 ? ch('ok', 'nome idêntico') : e.nm === 2 ? ch('warn', 'nome truncado') : ch('err', 'nome semelhante')}${(e.dd || 0) === 0 ? ch('ok', 'mesma data') : ch('warn', `data ±${e.dd} dia(s)`)}${e.eq === 'validada' ? ch('ok', 'equivalência validada') : ch(e.eq === 'divergente' ? 'err' : 'warn', ROTULO_EQ[e.eq] || e.eq || 'sem equivalência')}</div></div>`).join('') : '<p class="muted small">Nenhum laudo do paciente na data.</p>';
  return `<div class="la">
    <div class="la-topo">${chipStatus(o.estado, ESTADO_CORR[o.estado].nome)}${fora ? '<span class="tag-fora">não pode ficar neste relatório</span>' : ''}${tags.map(t => `<span class="la-tag">${esc(t)}</span>`).join('')}<span class="la-meta">Linha ${o.r.seq} do relatório · ${esc(TIPOS_ITEM[o.tipo] || '')}</span></div>
    <div class="la-diag ${nivel}"><b>${esc(titulo)}</b><p>${esc(o.detalhe)}${fora ? ' Esse prestador está na lista: corrija no MV.' : ''}</p></div>
    <div class="la-grid"><div><section class="cf-cmp qd"><div class="qd-tit"><b>Linha do MV</b></div><div class="qd-rol"><table class="qd-tab"><tbody>
      <tr><td>Paciente</td><td>${esc(o.r.paciente)}</td></tr><tr><td>Data</td><td>${fmtData(o.r.data)}</td></tr>
      <tr><td>Procedimento</td><td>${esc(`${o.r.codigo} · ${o.r.procDesc || ''}`)}</td></tr><tr><td>Convênio</td><td>${esc(o.r.convenio || '—')} · grupo ${esc(o.r.grupoNome || '—')}</td></tr>
      <tr><td>Identificação</td><td>atendimento ${copiavel(o.r.atendimento)}<br><span class="small muted">conta ${esc(o.r.conta || '—')}</span></td></tr></tbody></table></div></section>
      ${o.alertas.length ? `<div class="small" style="margin-top:8px"><b>Alertas</b><ul style="margin:4px 0 0;padding-left:18px">${o.alertas.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}</div>
      <div><h4 class="la-h">Laudos do paciente na data (${o.evidencias.length})</h4><div class="la-cands">${cards}</div></div></div>
    <div class="la-acoes"><button class="sec mini" data-nc-linha="${i}">Apontar como NC…</button></div></div>`;
}
// «Reler o PDF» (como na Conferência): pasta conectada relê o arquivo de lá; senão pede o PDF novo. Mantém unidade,
// tolerância, filtros e busca, e roda a identificação de novo.
function botaoRelerCorrecao() {
  const x = S.relatorios.find(r => r.id === S.corr?.ctx?.relId), daPasta = pastaConectadaConf() && !!x?.caminhoPasta;
  return `<button class="sec" id="coReler" title="Mantém unidade, tolerância e filtros">${daPasta ? 'Reler o PDF da pasta e identificar de novo' : 'Carregar o PDF novo e identificar de novo'}</button><input type="file" id="coReArq" accept=".pdf,application/pdf" hidden>`;
}
function ligarRelerCorrecao(c) {
  const bt = c.querySelector('#coReler'), arq = c.querySelector('#coReArq'); if (!bt) return;
  bt.onclick = () => { const x = S.relatorios.find(r => r.id === S.corr.ctx.relId); if (pastaConectadaConf() && x?.caminhoPasta) return comProcessando(bt, () => relerCorrecao(null), 'a releitura'); arq.value = ''; arq.click(); };
  arq.onchange = () => arq.files[0] && comProcessando(bt, () => relerCorrecao(arq.files[0]), 'a releitura');
}
async function relerCorrecao(arquivo) {
  if (!exigirAberta(S.comp, 'executar uma correção de prestador')) return;
  const { ctx } = S.corr, atual = S.relatorios.find(r => r.id === ctx.relId), prest = String(ctx.relatorio.cab.prestadorCod), un = ctx.unidadeCod, tol = ctx.parametros.tol;
  let x = null;
  if (!arquivo) {
    await atualizarDaPasta({ silencioso: true, so: 'correcao' });
    x = S.relatorios.find(r => r.caminhoPasta && r.caminhoPasta === atual?.caminhoPasta) || S.relatorios.find(r => r.caminhoPasta && String(r.rel.cab.prestadorCod) === prest && r.unidadePasta === atual?.unidadePasta);
    if (!x) return avisar('O PDF deste relatório não foi encontrado na pasta da competência. Use «Carregar o PDF novo» ou confira no Início.', 'warn');
  } else {
    const n0 = S.relatorios.length; await carregarPDFs([arquivo]);
    x = S.relatorios.length > n0 ? S.relatorios.at(-1) : S.relatorios.find(r => r.nome === arquivo.name && String(r.rel.cab.prestadorCod) === prest);
    if (!x) return;
    if (String(x.rel.cab.prestadorCod) !== prest) { if (S.relatorios.length > n0) S.relatorios.pop(); return avisar(`${arquivo.name} é do prestador ${x.rel.cab.prestadorCod} - ${x.rel.cab.prestadorNome}, não do ${prest}. Nada foi identificado.`, 'warn'); }
    x.finalidade = 'correcao';
  }
  RENDER.correcao();
  if ($('coRel')) { $('coRel').value = x.id; $('coRel').dispatchEvent(new Event('change')); }
  if ($('coUn')) $('coUn').value = un; if ($('coTol')) $('coTol').value = tol;
  await executarCorrecao();
}
