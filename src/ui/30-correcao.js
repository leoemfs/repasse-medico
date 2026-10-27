/* ============================================================
 * Correção / identificação de prestador
 * ============================================================ */
RENDER.correcao = () => {
  const p = $('pag-correcao');
  if (!S.relatorios.length || !S.apolo) { p.innerHTML = faltamArquivos(); return; }
  p.innerHTML = `<div class="card"><h2>Parâmetros</h2><p class="lead">Identifica o médico do laudo de cada linha do relatório só com evidência verificável: nome idêntico ou truncado, data dentro da tolerância e equivalência TUSS validada. Não há sugestão de prestador para os casos não identificados.</p>
    ${seletoresAnalise('co', S.cfg.parametros.tolCorrecao)}
    <div class="acoes"><button id="coRodar">Executar identificação</button></div></div><div id="coRes"></div>`;
  $('coExtra').innerHTML = '';
  $('coRodar').onclick = executarCorrecao;
  if (S.corr) desenharCorrecao();
};

async function executarCorrecao() {
  const x = relSelecionado('co'), un = $('coUn').value, tol = +$('coTol').value;
  if (!un) return avisar('Escolha a unidade dos laudos: o PDF não informa a unidade.', 'warn');
  const res = corrigirPrestador(x.rel, S.apolo, S.cfg, S.eq, { unidadeCod: un, tol });
  const ctx = { relId: x.id, relatorio: x.rel, apoloNome: S.apolo.nome, unidadeCod: un, unidadeNome: un === '*' ? 'Todas as unidades' : `${un} - ${unidadePorCod(S.cfg, un)?.nome || ''}`,
    parametros: { tol }, operador: S.operador, cfgRevisao: S.cfg.revisao, em: new Date().toLocaleString('pt-BR'),
    arquivos: [{ papel: 'MV', nome: x.nome, hash: x.hash }, { papel: 'Apolo', nome: S.apolo.nome, hash: S.apolo.hash }] };
  const rodada = registroRodada(res, ctx); ctx.rodadaId = rodada.id;
  const ant = rodadaAnterior(S.rodadas, rodada);
  await guardarRodada(rodada);
  S.corr = { res, ctx, rodada, comparacao: ant ? { ant, grupos: compararRodadas(ant, rodada) } : null, filtro: new Set(), busca: '' };
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
    <div class="acoes"><input type="search" id="coBusca" placeholder="Buscar paciente, código ou médico…" value="${esc(S.corr.busca)}" style="max-width:420px"><button id="coExcel">Exportar planilha de trabalho</button></div>
    <div id="coTab" style="margin-top:10px"></div></div>
    <div class="grid2"><div class="card"><h2>Médicos identificados</h2><div id="coMed"></div></div>
    <div class="card"><h2>Equivalências desta rodada</h2><div id="coEq"></div></div></div>`;
  c.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { const s = S.corr.filtro; s.has(b.dataset.st) ? s.delete(b.dataset.st) : s.add(b.dataset.st); desenharCorrecao(); });
  $('coExcel').onclick = () => baixarZip(xlsxCorrecao(res, ctx), `Correcao_prestador_${nomeSeguro(ctx.relatorio.cab.prestadorNome)}_${ctx.relatorio.cab.repasse}_${carimbo()}.xlsx`);
  const filtrar = () => {
    const q = norm(S.corr.busca);
    return res.linhas.filter(o => (!S.corr.filtro.size || S.corr.filtro.has(o.estado)) && (!q || norm([o.r.paciente, o.r.codigo, o.r.procDesc, o.medico].join(' ')).includes(q)));
  };
  const t = tabela($('coTab'), {
    linhas: filtrar(), colunas: [
      { t: 'Linha', n: true, v: o => o.r.seq }, { t: 'Estado', html: o => chipStatus(o.estado, ESTADO_CORR[o.estado].nome) },
      { t: 'Código', v: o => o.r.codigo }, { t: 'Procedimento MV', v: o => o.r.procDesc }, { t: 'Paciente', v: o => o.r.paciente }, { t: 'Data', v: o => fmtData(o.r.data) },
      { t: 'Médico do laudo', v: o => o.estado === 'identificado' ? o.medico : '' }, { t: 'Cód. prestador', v: o => o.prestador?.cod || '' },
      { t: 'Motivo', v: o => MOTIVOS_CORR[o.motivo] || '' }, { t: 'Vl Repasse', n: true, v: o => fmtBR(o.r.vlRepasse) }
    ],
    detalhe: o => `<div class="det"><div><h4>Detalhe objetivo</h4><p>${esc(o.detalhe)}</p>${o.alertas.length ? `<h4>Alertas</h4><ul>${o.alertas.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      <div class="small muted">Tipo: ${esc(TIPOS_ITEM[o.tipo])} · grupo ${esc(o.r.grupoNome)} · conta ${esc(o.r.conta)} · atendimento ${esc(o.r.atendimento)} · ${esc(o.r.convenio)}</div></div>
      <div><h4>Laudos do paciente na data (sem nomes de médico quando não identificado)</h4>${o.evidencias.length ? `<ul>${o.evidencias.map(e => `<li>«${esc(e.titulo)}» · ${fmtData(e.data)} · nome ${NIVEL_NOME[e.nm]} · equivalência: ${esc(ROTULO_EQ[e.eq] || e.eq)}</li>`).join('')}</ul>` : '<p class="muted small">Nenhum.</p>'}</div></div>`
  });
  $('coBusca').oninput = e => { S.corr.busca = e.target.value; t.atualizar(filtrar()); };
  tabela($('coMed'), { porPagina: 50, linhas: res.porMedico, colunas: [{ t: 'Médico (Apolo)', v: m => m.medico }, { t: 'Cód. prestador', v: m => m.cod || 'sem cadastro' }, { t: 'Linhas', n: true, v: m => m.n }, { t: 'Vl Repasse', n: true, v: m => fmtBR(m.vlRepasse) }], vazio: 'Nenhum médico identificado.' });
  painelEqRodada($('coEq'), paresDaCorrecao(res), executarCorrecao);
}
