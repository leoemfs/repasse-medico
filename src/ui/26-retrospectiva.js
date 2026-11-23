/* ============================================================
 * SOL-F20 — Retrospectiva mensal (PDCA), subaba do Fluxo mensal.
 * Indicadores calculados (93-retrospectiva.js), comparação com os 3 meses anteriores, backlog de melhorias
 * herdado do mês anterior e «o que melhorar no próximo mês» (gravado no Fluxo e sincronizado pela pasta).
 * ============================================================ */
const RT = { verPrest: false };
// Fechamento de qualquer competência (sem a variação contra a anterior, que a retrospectiva não usa).
function fechamentoDaCompetencia(ch) {
  return montarFechamento({ rodadas: S.rodadas, cfg: S.cfg, chave: ch, decisoes: indiceDecisoesComp(ch), fechada: compFechada(ch), fluxoComp: S.fluxo.competencias[ch], fech: fechDaCompetencia(ch) });
}
function retrospectivaDe(ch) {
  return retrospectivaCompetencia({ chave: ch, f: fechamentoDaCompetencia(ch), rodadas: S.rodadas, cfg: S.cfg, fluxoComp: S.fluxo.competencias[ch] || null, fluxoModelo: S.fluxo.modelo, ncs: S.nc?.itens || [], fech: fechDaCompetencia(ch) });
}
// Indicadores da comparação: rótulo, campo do resumo, formato e se «menor é melhor».
const INDICADORES_RETRO = [
  ['leadAceite', 'Lead time geração → aceite', v => `${fmtPct(v)} d.u.`, true],
  ['leadTotal', 'Lead time geração → NF ao Financeiro', v => `${fmtPct(v)} d.u.`, true],
  ['rodadasMedia', 'Rodadas até o aceite (média)', v => fmtPct(v), true],
  ['pctPrimeira', 'Aceite na 1ª rodada', v => `${fmtPct(v)}%`, false],
  ['terceirosDias', 'Espera por terceiros (d.u. somados)', v => String(v), true],
  ['cobertura', 'Cobertura de equivalências', v => `${fmtPct(v)}%`, false],
  ['ncs', 'NCs registradas no mês', v => String(v), true],
  ['reincidencias', 'Reincidências faturista × natureza', v => String(v), true],
  ['antecedenciaMin', 'Menor antecedência ao Financeiro', v => `${v} d.u.`, false]
];
const ETAPAS_LEAD = [['geracaoConf', 'Geração no MV → 1ª conferência'], ['confAceite', '1ª conferência → aceite'], ['aceiteEnvio', 'Aceite → e-mail enviado'], ['envioNF', 'E-mail → NF recebida'], ['nfFinanceiro', 'NF recebida → Financeiro']];
const diasTxt = v => v === null || v === undefined ? '—' : `${fmtPct(v)} d.u.`;
const tendencia = (atual, ant, menorMelhor) => {
  if (atual === null || atual === undefined || ant === null || ant === undefined || atual === ant) return '';
  const melhor = menorMelhor ? atual < ant : atual > ant;
  return ` <span class="rt-tend ${melhor ? 'melhor' : 'pior'}" title="${melhor ? 'melhorou' : 'piorou'} × mês anterior">${atual > ant ? '▲' : '▼'}</span>`;
};

function desenharRetrospectiva() {
  const c = $('fxCorpo'), ch = FX.chave, comp = compAtual(), fechada = compFechada(ch);
  const ret = retrospectivaDe(ch);
  const comparacao = [-3, -2, -1].map(n => competenciaVizinha(ch, n)).map(k => retrospectivaDe(k).resumo).concat([ret.resumo]);
  const ant = comparacao[2], r = ret.resumo, backlog = backlogDaCompetencia(S.fluxo.competencias, ch), melhorias = comp?.melhorias || [];
  const kpi = (titulo, valor, detalhe, k) => { const ind = INDICADORES_RETRO.find(i => i[0] === k); return `<div class="card rt-kpi"><h3>${esc(titulo)}</h3><b>${valor}${ind ? tendencia(r[k], ant[k], ind[3]) : ''}</b><small class="muted">${detalhe}</small></div>`; };
  const gargalo = ETAPAS_LEAD.map(([k, t]) => [k, t, ret.leadTime[k].media]).filter(x => x[2] !== null).sort((a, b) => b[2] - a[2])[0];
  const maxEtapa = Math.max(1, ...ETAPAS_LEAD.map(([k]) => ret.leadTime[k].media || 0));
  const SIT_ANT = { ok: ['ok', 'na meta'], abaixo: ['warn', 'abaixo da meta'], atrasada: ['err', 'depois do pagamento'], sem: ['info', 'sem entrega registrada'] };
  c.innerHTML = `<div class="fx-topo"><h2 class="fx-titulo">Retrospectiva da competência ${rotuloCompetencia(ch)}</h2>
      <div class="acoes" style="margin:0"><button class="sec" id="rtExp">Exportar retrospectiva (.xlsx)</button></div></div>
    <p class="small muted">Indicadores para a reunião de fim de mês (PDCA). Tudo sai do que já foi registrado: Fluxo mensal, rodadas e aceites, Fechamento e Não conformidades. Prazos em <b>dias úteis</b> (d.u.); ▲▼ comparam com ${rotuloCompetencia(ant.chave)}.</p>
    ${!ret.temFluxo ? `<div class="aviso-fixo warn">O checklist desta competência não foi iniciado no Fluxo mensal: a geração no MV usa os marcos do modelo, e envio, NFs e etapas em «Aguardando terceiros» ficam sem dados.</div>` : ''}
    <div class="rt-kpis">
      ${kpi('Lead time até o aceite', diasTxt(r.leadAceite), `geração no MV → aceite · ${r.comAceite} de ${r.prestadores} prestador(es) com aceite`, 'leadAceite')}
      ${kpi('Lead time até o Financeiro', diasTxt(r.leadTotal), `geração → NF encaminhada · ${r.concluidos} concluído(s)`, 'leadTotal')}
      ${kpi('Rodadas até o aceite', r.rodadasMedia === null ? '—' : fmtPct(r.rodadasMedia), r.pctPrimeira === null ? 'nenhum relatório com aceite' : `${fmtPct(r.pctPrimeira)}% aceitos na 1ª rodada · máx. ${ret.rodadas.max}`, 'rodadasMedia')}
      ${kpi('Espera por terceiros', `${r.terceirosDias} d.u.`, `${ret.terceiros.itens.length} espera(s), ${ret.terceiros.abertos} em aberto`, 'terceirosDias')}
      ${kpi('Cobertura de equivalências', r.cobertura === null ? '—' : `${fmtPct(r.cobertura)}%`, `${ret.cobertura.conferidas} de ${ret.cobertura.total} linhas conferidas automaticamente`, 'cobertura')}
      ${kpi('Não conformidades', String(r.ncs), `${r.ncsImpactam} impactam o pagamento · ${r.reincidencias} reincidência(s)`, 'ncs')}
      ${kpi('Antecedência ao Financeiro', r.antecedenciaMin === null ? '—' : `${r.antecedenciaMin} d.u.`, `menor entre os repasses · meta ${ret.meta} d.u.`, 'antecedenciaMin')}
    </div>

    <div class="card"><h2>Comparação entre meses</h2><div class="tw"><table class="rt-comp"><thead><tr><th>Indicador</th>${comparacao.map(x => `<th class="n${x.chave === ch ? ' rt-atual' : ''}">${rotuloCompetencia(x.chave)}</th>`).join('')}</tr></thead><tbody>
      ${INDICADORES_RETRO.map(([k, t, fmt, mm]) => `<tr><td>${esc(t)}</td>${comparacao.map((x, i) => `<td class="n${x.chave === ch ? ' rt-atual' : ''}">${x[k] === null || x[k] === undefined ? '<span class="muted">—</span>' : esc(fmt(x[k]))}${i ? tendencia(x[k], comparacao[i - 1][k], mm) : ''}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div><p class="small muted">«—»: sem dado no mês (sem rodada, sem aceite ou sem entrega registrada). As rodadas lidas são as da competência aberta e das 4 anteriores.</p></div>

    <div class="grid2 rt-grid">
      <div class="card"><h2>Onde o tempo foi gasto</h2>
        ${ETAPAS_LEAD.map(([k, t]) => { const l = ret.leadTime[k]; return `<div class="rt-barra${gargalo && gargalo[0] === k ? ' gargalo' : ''}"><span>${esc(t)}</span><div><i style="width:${l.media === null ? 0 : Math.max(2, Math.round(Math.max(0, l.media) / maxEtapa * 100))}%"></i></div><b>${diasTxt(l.media)}</b><small class="muted">${l.n ? `mediana ${diasTxt(l.mediana)} · ${l.n} prest.` : 'sem dados'}</small></div>`; }).join('')}
        ${gargalo ? `<p class="small">Gargalo do mês: <b>${esc(gargalo[1])}</b> (${diasTxt(gargalo[2])} em média).</p>` : '<p class="small muted">Sem prestadores com as datas das etapas.</p>'}
        <p class="small muted">Geração no MV: ${GRUPOS_RETRO.slice(0, 3).map(g => `${g.nome} ${ret.geracao[g.id].data ? fmtData(ret.geracao[g.id].data) : '—'}${ret.geracao[g.id].origem.startsWith('marco') ? ' (marco)' : ''}`).join(' · ')}.</p></div>
      <div class="card"><h2>Antecedência da entrega ao Financeiro</h2><div class="tw"><table><thead><tr><th>Repasse</th><th>Pagamento</th><th>Entrega</th><th class="n">Antecedência</th><th>Situação</th></tr></thead><tbody>
        ${ret.antecedencia.map(a => `<tr><td>${esc(a.nome)}</td><td>${a.pagamento ? fmtData(a.pagamento) : '—'}</td><td>${a.entrega ? fmtData(a.entrega) : '—'}${a.parcial ? ` <small class="muted">(${a.entregues} de ${a.previstos} NFs)</small>` : ''}</td><td class="n">${a.dias === null ? '—' : `${a.dias} d.u.`}</td><td><span class="badge ${SIT_ANT[a.situacao][0]}">${SIT_ANT[a.situacao][1]}</span></td></tr>`).join('')}
      </tbody></table></div><p class="small muted">Entrega = última NF encaminhada ao Financeiro no controle documental (ou a etapa de NF concluída). Meta: ${ret.meta} dias úteis antes do pagamento (Modelo e prazos).</p></div>
    </div>

    <div class="card"><div class="fx-topo"><h2 class="fx-titulo">Lead time por prestador</h2><label class="small"><input type="checkbox" id="rtVerPrest"${RT.verPrest ? ' checked' : ''}> mostrar as datas</label></div><div id="rtPrest"></div></div>

    <div class="grid2 rt-grid">
      <div class="card"><h2>Rodadas até o aceite</h2>
        ${ret.rodadas.aceitos ? `<p>${ret.rodadas.aceitos} de ${ret.rodadas.relatorios} relatório(s) (prestador × unidade) com aceite.</p><div class="tw"><table><thead><tr><th>Rodadas</th><th class="n">Relatórios</th></tr></thead><tbody>${ret.rodadas.distribuicao.map(([n, q]) => `<tr><td>${esc(n)}</td><td class="n">${q}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nenhum relatório com aceite nesta competência.</p>'}</div>
      <div class="card"><h2>Espera por terceiros</h2>
        ${ret.terceiros.itens.length ? `<p class="small">${ret.terceiros.porQuem.map(([q, d]) => `<b>${esc(q)}</b> ${d} d.u.`).join(' · ')}</p><div class="tw"><table><thead><tr><th>Etapa / prestador</th><th>De quem</th><th>Motivo</th><th class="n">Dias úteis</th></tr></thead><tbody>
          ${ret.terceiros.itens.slice(0, 12).map(x => `<tr><td>${esc(x.alvo)} <small class="muted">${esc(x.origem === 'fluxo' ? x.grupo : 'Fechamento ' + x.grupo)}</small></td><td>${esc(x.quem || '—')}</td><td class="small">${esc(x.motivo || '')}</td><td class="n">${x.dias}${x.aberto ? ' <span class="badge warn">em aberto</span>' : ''}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted">Nenhuma etapa do Fluxo nem prestador do Fechamento ficou em «Aguardando terceiros».</p>'}</div>
    </div>

    <div class="grid2 rt-grid">
      <div class="card"><h2>NCs por natureza</h2>${ret.nc.porNatureza.length ? `<div class="tw"><table><thead><tr><th>Natureza</th><th class="n">NCs</th><th class="n">Impacto</th><th class="n">Meses</th></tr></thead><tbody>${ret.nc.porNatureza.map(x => `<tr><td>${esc(x.nome)}</td><td class="n">${x.n}</td><td class="n">${x.valor ? fmtBR(x.valor) : '—'}</td><td class="n">${x.meses} de ${ret.nc.meses.length}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nenhuma NC registrada nesta competência.</p>'}</div>
      <div class="card"><h2>NCs por faturista</h2>${ret.nc.porFaturista.length ? `<div class="tw"><table><thead><tr><th>Faturista</th><th class="n">NCs</th><th class="n">Meses</th></tr></thead><tbody>${ret.nc.porFaturista.map(x => `<tr><td>${esc(x.k)}</td><td class="n">${x.n}</td><td class="n">${x.meses >= 2 ? `<span class="badge warn">${x.meses} de ${ret.nc.meses.length}</span>` : `${x.meses} de ${ret.nc.meses.length}`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Sem NCs de faturamento nesta competência.</p>'}
        ${ret.nc.reincidencias.length ? `<p class="small"><b>Reincidência</b> (mesma natureza em ${ret.nc.meses.length > 1 ? 'mais de um' : ''} dos últimos ${ret.nc.meses.length} meses): ${ret.nc.reincidencias.map(x => `${esc(x.faturista)} — ${esc(x.natureza)} (${x.meses} meses)`).join('; ')}.</p>` : ''}
        <p class="small muted">Contam as NCs registradas na competência (sem as trazidas de outro mês e sem as «não procede»).</p></div>
    </div>

    <div class="card rt-pdca"><h2>Backlog de melhorias</h2>
      ${backlog.length ? `<p class="small muted">Melhorias combinadas nos meses anteriores. O que não for marcado como feito ou descartado segue para a próxima competência.</p><ul class="rt-lista">${backlog.map(b => `<li data-bl="${esc(b.id)}"><div><p>${esc(b.texto)}</p><small class="muted">${rotuloCompetencia(b.deCompetencia)} · ${esc(b.por || '—')}${b.indicador ? ' · ' + esc(INDICADORES_RETRO.find(i => i[0] === b.indicador)?.[1] || b.indicador) : ''}${b.situacao.por ? ` · ${esc(STATUS_MELHORIA[b.situacao.status])} por ${esc(b.situacao.por)}${b.situacao.obs ? `: «${esc(b.situacao.obs)}»` : ''}` : ''}</small></div>
        <select data-blst aria-label="Situação da melhoria">${opcoes(Object.entries(STATUS_MELHORIA), b.situacao.status)}</select></li>`).join('')}</ul>` : '<p class="muted">Nenhuma melhoria em aberto vinda dos meses anteriores.</p>'}
      <h2 style="margin-top:18px">O que melhorar no próximo mês</h2>
      ${comp ? `<div class="rt-nova"><textarea id="rtTexto" rows="2" placeholder="ex.: pedir a planilha do Apolo no 1º dia útil; cobrar NF dos médicos no dia do e-mail"></textarea>
        <select id="rtInd" aria-label="Indicador ligado"><option value="">Indicador (opcional)</option>${opcoes(INDICADORES_RETRO.map(i => [i[0], i[1]]), '')}</select><button id="rtAdd">Adicionar</button></div>
        <ul class="rt-lista">${melhorias.map(m => `<li><div><p>${esc(m.texto)}</p><small class="muted">${new Date(m.em).toLocaleDateString('pt-BR')} · ${esc(m.por || '—')}${m.indicador ? ' · ' + esc(INDICADORES_RETRO.find(i => i[0] === m.indicador)?.[1] || m.indicador) : ''}</small></div><button class="perigo ic" data-mrm="${esc(m.id)}" aria-label="Apagar melhoria">✕</button></li>`).join('') || '<li class="muted">Nenhuma melhoria registrada para o próximo mês.</li>'}</ul>
        <p class="small muted">Cada item vira o backlog de ${rotuloCompetencia(competenciaVizinha(ch, 1))}. Fica no Fluxo da competência e vai para a pasta da rede com ele.</p>`
      : `<p class="muted">Inicie o checklist desta competência (Acompanhamento) para registrar melhorias e acompanhar o backlog.</p>`}
    </div>`;

  // Lead time por prestador (tabela paginada).
  const dtc = d => d ? fmtCurta(d) : '—';
  const colunas = [
    { t: 'Repasse', v: p => p.tipo.toUpperCase() }, { t: 'Prestador', html: p => `${esc(p.cod)} - ${esc(p.nome)}<br><small class="muted">un. ${esc(p.unidades.join(', ') || '—')}</small>` },
    ...(RT.verPrest ? [{ t: 'Geração', v: p => dtc(p.gerado) }, { t: '1ª conf.', v: p => dtc(p.primeiraConf) }, { t: 'Aceite', v: p => dtc(p.aceite) }, { t: 'E-mail', v: p => dtc(p.envio) }, { t: 'NF', v: p => dtc(p.nfRec) }, { t: 'Financeiro', v: p => dtc(p.nfFin) }] : []),
    ...ETAPAS_LEAD.map(([k, t]) => ({ t: t.replace('Geração no MV', 'Geração').replace(' recebida', ''), n: true, v: p => p.etapas[k] === null ? '—' : p.etapas[k] })),
    { t: 'Total', n: true, html: p => p.etapas.total === null ? (p.etapas.geracaoAceite === null ? '—' : `<span class="muted" title="até o aceite">${p.etapas.geracaoAceite}…</span>`) : `<b>${p.etapas.total}</b>` },
    { t: 'Rodadas', n: true, html: p => `${p.rodadas}${p.rodadasAteAceite ? ` <small class="muted">(aceite na ${p.rodadasAteAceite}ª)</small>` : ''}` }
  ];
  tabela($('rtPrest'), { colunas, linhas: ret.prestadores, porPagina: 50, vazio: 'Nenhum prestador com relatório conferido nesta competência.' });
  $('rtVerPrest').onchange = e => { RT.verPrest = e.target.checked; desenharRetrospectiva(); };
  $('rtExp').onclick = () => baixarZip(xlsxRetrospectiva(ret, comparacao, backlog, melhorias, { operador: S.operador }), `Retrospectiva_${ch.slice(5)}-${ch.slice(0, 4)}_${carimbo()}.xlsx`);
  // Melhorias e backlog (gravados no Fluxo da competência).
  if (comp) {
    $('rtAdd').onclick = async () => {
      if (!exigirAberta(ch, 'registrar melhorias')) return;
      const op = await exigirOperador(); if (!op) return;
      try { (comp.melhorias ||= []).push(novaMelhoria($('rtTexto').value, op, $('rtInd').value)); }
      catch (e) { return avisar(e.message, 'warn'); }
      salvarFluxo('Melhoria registrada para o próximo mês.'); desenharRetrospectiva();
    };
    c.querySelectorAll('[data-mrm]').forEach(b => b.onclick = async () => {
      if (!exigirAberta(ch, 'apagar melhorias')) return;
      if (!await confirmar('Apagar a melhoria?', 'Ela sai desta competência e do backlog do próximo mês.', 'Apagar')) return;
      comp.melhorias = (comp.melhorias || []).filter(m => m.id !== b.dataset.mrm); salvarFluxo(); desenharRetrospectiva();
    });
  }
  c.querySelectorAll('[data-blst]').forEach(s => s.onchange = async () => {
    const id = s.closest('[data-bl]').dataset.bl, st = s.value;
    if (!comp) { avisar('Inicie o checklist desta competência para acompanhar o backlog.', 'warn'); return desenharRetrospectiva(); }
    if (!exigirAberta(ch, 'mudar o backlog')) return desenharRetrospectiva();
    const op = await exigirOperador(); if (!op) return desenharRetrospectiva();
    let obs = '';
    if (MELHORIA_ENCERRADA(st)) { const r = await dialogo(st === 'feita' ? 'Melhoria feita' : 'Descartar a melhoria', `<label class="campo">Observação (opcional)<input type="text" name="obs" placeholder="${st === 'feita' ? 'o que foi feito' : 'por que não vale mais'}"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Salvar']]); if (r.botao !== 'ok') return desenharRetrospectiva(); obs = r.campos.obs; }
    marcarBacklog(comp, id, st, op, obs); salvarFluxo(`Backlog: «${STATUS_MELHORIA[st]}».`); desenharRetrospectiva();
  });
  if (fechada) c.querySelectorAll('textarea, #rtInd, #rtAdd, [data-mrm], [data-blst]').forEach(x => { x.disabled = true; });
}
