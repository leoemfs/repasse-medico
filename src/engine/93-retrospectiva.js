/* ============================================================
 * SOL-F20 — Indicadores de fluxo para a retrospectiva mensal (PDCA)
 * Tudo sai de dados que já existem; nada aqui é digitado de novo:
 *  - lead time por prestador: geração no MV (etapa «Gerar» do Fluxo ou o marco) → 1ª conferência → aceite (rodada)
 *    → e-mail enviado → NF recebida → NF ao Financeiro (controle documental do Fluxo). Em dias úteis.
 *  - rodadas até o aceite: rodadas de conferência do mesmo relatório (prestador × unidade) até a aceita.
 *  - espera por terceiros: tempo das etapas do Fluxo em «Aguardando terceiros» (histórico) e das marcas
 *    «Aguardando terceiros» do Fechamento (SOL-F19), com o histórico das marcas retiradas.
 *  - cobertura de equivalências (SOL-F15), NCs por natureza e por faturista com reincidência (3 meses)
 *    e dias úteis de antecedência da entrega ao Financeiro × pagamento (meta do modelo: antecedenciaDias).
 * «O que melhorar no próximo mês» fica no Fluxo da competência (lista «melhorias», sincronizada pela pasta):
 * vira o backlog da competência seguinte, e o que não for feito nem descartado segue para a próxima.
 * ============================================================ */
const GRUPOS_RETRO = [
  { id: 'usg', nome: 'USG', marcoGerar: 'fechUSG', pagamento: 'pagUSG', tarefaNF: 'nf' },
  { id: 'img', nome: 'IMG', marcoGerar: 'inicioIMG', pagamento: 'pagIMG', tarefaNF: 'nf' },
  { id: 'curitiba', nome: 'Curitiba', marcoGerar: null, pagamento: 'pagCuritiba', tarefaNF: 'nf' },
  { id: 'sedacao', nome: 'Sedação', marcoGerar: null, pagamento: 'pagSedacao', tarefaNF: 'fin' }
];
const STATUS_MELHORIA = { aberta: 'Em aberto', andamento: 'Em andamento', feita: 'Feita', descartada: 'Descartada' };
const MELHORIA_ENCERRADA = s => s === 'feita' || s === 'descartada';

/* ---------- Datas ---------- */
// Dia (UTC, sem hora) de um carimbo ISO, pelo relógio local de quem registrou.
const diaDoCarimbo = iso => { if (!iso) return null; const d = new Date(iso); return isNaN(d) ? null : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); };
const diaDe = v => !v ? null : /T\d\d:/.test(String(v)) ? diaDoCarimbo(v) : paraData(v);
// Dias úteis de a até b (a exclusive, b inclusive); negativo se b vem antes de a. Mesmo dia = 0.
function diasUteisEntre(a, b, opcoesCal = {}) {
  if (!a || !b) return null;
  const sa = diaSerial(a), sb = diaSerial(b); if (sa === sb) return 0;
  const cals = new Map(), cal = ano => cals.get(ano) || cals.set(ano, calendario(ano, opcoesCal)).get(ano);
  const [de, ate] = sa < sb ? [sa, sb] : [sb, sa]; let n = 0;
  for (let s = de + 1; s <= ate; s++) { const d = new Date(s * 86400000); if (cal(d.getUTCFullYear()).util(d)) n++; }
  return sa < sb ? n : -n;
}
const media = l => { const v = l.filter(x => x !== null && x !== undefined && isFinite(x)); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length * 10) / 10 : null; };
const mediana = l => { const v = l.filter(x => x !== null && x !== undefined && isFinite(x)).sort((a, b) => a - b); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };

/* ---------- Geração no MV por grupo ---------- */
// Data da etapa «Gerar» concluída no Fluxo; sem ela, o marco do modelo (fechamento de USG / início do IMG).
function geracaoDoGrupo(fluxoComp, grupo, mk) {
  const t = fluxoComp?.grupos?.[grupo.id]?.tarefas?.gerar;
  if (t?.conclusao) return { data: paraData(t.conclusao), origem: 'etapa «Gerar» concluída no Fluxo' };
  if (grupo.marcoGerar && mk?.datas?.[grupo.marcoGerar]) return { data: mk.datas[grupo.marcoGerar], origem: 'marco do modelo (etapa «Gerar» sem data)' };
  return { data: null, origem: '' };
}

/* ---------- Rodadas por relatório (prestador × unidade) ---------- */
function rodadasPorRelatorio(rodadas, chave, cfg) {
  const v3 = new Set((cfg?.prestadores || []).filter(p => p.regras?.v3).map(p => String(p.cod)));
  const m = new Map();
  for (const r of rodadas) {
    if (r.tipo !== 'conferencia' || competenciaDaRodada(r) !== chave || !r.unidadeCod || r.unidadeCod === '*') continue;
    const tipo = v3.has(String(r.prestadorCod)) ? 'curitiba' : tipoRepasseDaRodada({ ...r, linhas: r.linhas || [] });
    const k = `${tipo}|${r.prestadorCod}|${r.unidadeCod}`;
    (m.get(k) || m.set(k, { tipo, cod: String(r.prestadorCod), nome: r.prestadorNome || '', unidade: String(r.unidadeCod), lista: [] }).get(k)).lista.push(r);
  }
  for (const e of m.values()) {
    e.lista.sort((a, b) => String(a.em).localeCompare(String(b.em)));
    const aceitas = e.lista.filter(r => r.aceite);
    e.aceita = aceitas.at(-1) || null;
    // Aceite vale se a última rodada é a aceita (rodada nova depois do aceite = voltou para correção).
    e.valeAceite = !!e.aceita && e.lista.at(-1) === e.aceita;
    e.rodadasAteAceite = e.aceita ? e.lista.indexOf(e.aceita) + 1 : null;
    e.primeira = e.lista[0];
  }
  return [...m.values()];
}

/* ---------- Espera por terceiros ---------- */
// Períodos de uma etapa do Fluxo em «Aguardando terceiros», pelo histórico de status.
function periodosTerceirosEtapa(est, hoje) {
  const out = []; let ini = null;
  for (const h of est?.historico || []) {
    if (h.para === 'ter' && !ini) ini = h.em;
    else if (h.para !== 'ter' && ini) { out.push({ de: ini, ate: h.em }); ini = null; }
  }
  if (ini) out.push({ de: ini, ate: null, aberto: true, hoje: isoDia(hoje) });
  return out;
}
function esperaTerceiros({ fluxoComp, fech, hoje, opcoesCal }) {
  const itens = [], h = paraData(hoje);
  for (const g of fluxoComp?.modelo?.grupos || []) for (const t of g.tarefas) {
    const est = fluxoComp.grupos?.[g.id]?.tarefas?.[t.id];
    for (const p of periodosTerceirosEtapa(est, hoje)) {
      itens.push({ origem: 'fluxo', grupo: g.nome, alvo: t.nome, quem: est.responsavel || '', motivo: est.obs || '', de: diaDoCarimbo(p.de), ate: p.ate ? diaDoCarimbo(p.ate) : h, aberto: !!p.aberto });
    }
  }
  const nomeQuem = q => QUEM_AGUARDA.find(x => x[0] === q)?.[1] || 'Outro';
  for (const [tipo, mapa] of Object.entries(fech?.aguardando || {})) for (const [cod, a] of Object.entries(mapa || {}))
    itens.push({ origem: 'fechamento', grupo: tipo.toUpperCase(), alvo: `prestador ${cod}`, cod, tipo, quem: nomeQuem(a.quem), motivo: a.motivo || '', de: diaDoCarimbo(a.em), ate: h, aberto: true });
  for (const a of fech?.aguardandoHist || [])
    itens.push({ origem: 'fechamento', grupo: String(a.tipo || '').toUpperCase(), alvo: `prestador ${a.cod}`, cod: a.cod, tipo: a.tipo, quem: nomeQuem(a.quem), motivo: a.motivo || '', de: diaDoCarimbo(a.em), ate: diaDoCarimbo(a.ate), aberto: false });
  for (const x of itens) x.dias = Math.max(0, diasUteisEntre(x.de, x.ate, opcoesCal) || 0);
  itens.sort((a, b) => b.dias - a.dias);
  const porQuem = [...itens.reduce((m, x) => m.set(x.quem || '(sem responsável)', (m.get(x.quem || '(sem responsável)') || 0) + x.dias), new Map())].sort((a, b) => b[1] - a[1]);
  return { itens, total: itens.reduce((s, x) => s + x.dias, 0), abertos: itens.filter(x => x.aberto).length, porQuem };
}

/* ---------- NCs: natureza, faturista e reincidência ---------- */
// NCs «da competência»: registradas nela (as trazidas de outra competência não contam de novo) e que procedem.
const ncsDaRetro = (todas, chave) => todas.filter(n => n.competencia === chave && !n.deCompetencia && n.situacao !== 'nao-procede');
function ncsRetrospectiva(todas, chave, meses = 3) {
  const atuais = ncsDaRetro(todas, chave), janela = Array.from({ length: meses }, (_, i) => competenciaVizinha(chave, -i));
  const porMes = new Map(janela.map(c => [c, ncsDaRetro(todas, c)]));
  const reincide = chaveFn => k => janela.filter(c => porMes.get(c).some(n => chaveFn(n) === k)).length;
  const faturista = n => n.categoria === 'prestador' ? '' : (n.responsavel || '(sem responsável)');
  const ranking = (f, rein) => [...contar(atuais, f)].filter(([k]) => k).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .map(([k, n]) => ({ k, n, valor: r2(atuais.filter(x => f(x) === k && x.impactaPagamento).reduce((s, x) => s + (+x.valor || 0), 0)), meses: rein(k) }));
  const porNatureza = ranking(n => n.natureza, reincide(n => n.natureza)).map(x => ({ ...x, nome: NATUREZA_NC[x.k]?.nome || x.k }));
  const porFaturista = ranking(faturista, reincide(faturista));
  // Faturista × natureza que se repete em 2 ou mais dos últimos meses: é o que a retrospectiva deve atacar.
  const par = n => faturista(n) ? `${faturista(n)}|${n.natureza}` : '';
  const reincidencias = ranking(par, reincide(par)).filter(x => x.meses >= 2).map(x => { const [f, nat] = x.k.split('|'); return { ...x, faturista: f, natureza: NATUREZA_NC[nat]?.nome || nat }; });
  return { total: atuais.length, impactam: atuais.filter(n => n.impactaPagamento).length, valor: r2(atuais.filter(n => n.impactaPagamento).reduce((s, n) => s + (+n.valor || 0), 0)), porNatureza, porFaturista, reincidencias, meses: janela };
}

/* ---------- Antecedência da entrega ao Financeiro ---------- */
function antecedenciaFinanceiro(fluxoComp, mk, opcoesCal, meta) {
  return GRUPOS_RETRO.map(g => {
    const pag = mk?.datas?.[g.pagamento] || null, eg = fluxoComp?.grupos?.[g.id];
    const docs = Object.values(eg?.documental || {}), comNF = docs.filter(d => d.nfFinanceiro);
    const tarefa = eg?.tarefas?.[g.tarefaNF];
    // Entrega = última NF encaminhada (a entrega só termina com a última); sem controle documental, a etapa de NF concluída.
    let entrega = comNF.length ? new Date(Math.max(...comNF.map(d => paraData(d.nfFinanceiro).getTime()))) : null, origem = comNF.length ? 'última NF encaminhada' : '';
    if (!entrega && tarefa?.conclusao) { entrega = paraData(tarefa.conclusao); origem = 'etapa de NF concluída'; }
    const dias = entrega && pag ? diasUteisEntre(entrega, pag, opcoesCal) : null;
    return { id: g.id, nome: g.nome, pagamento: pag, entrega, origem, dias, previstos: docs.length, entregues: comNF.length, parcial: docs.length > 0 && comNF.length < docs.length,
      situacao: dias === null ? 'sem' : dias < 0 ? 'atrasada' : dias < meta ? 'abaixo' : 'ok', semFluxo: !eg };
  });
}

/* ---------- Retrospectiva da competência ---------- */
// ctx: { chave, f (montarFechamento), rodadas, cfg, fluxoComp, fluxoModelo, ncs (todas), fech, hoje }
function retrospectivaCompetencia({ chave, f, rodadas, cfg, fluxoComp, fluxoModelo, ncs = [], fech, hoje = new Date() }) {
  const [ano, mes] = chave.split('-').map(Number), modelo = fluxoComp?.modelo || fluxoModelo || modeloFluxoPadrao();
  const opcoesCal = modelo.calendario || {}, meta = +(modelo.calendario?.antecedenciaDias ?? 5);
  const mk = fluxoComp ? marcosDaCompetencia(fluxoComp) : calcularMarcos(modelo, ano, mes, opcoesCal, {});
  const du = (a, b) => diasUteisEntre(a, b, opcoesCal);
  const relatorios = rodadasPorRelatorio(rodadas, chave, cfg);
  const geracao = Object.fromEntries(GRUPOS_RETRO.map(g => [g.id, geracaoDoGrupo(fluxoComp, g, mk)]));
  // Lead time por prestador (os que têm relatório na competência).
  const prestadores = (f?.prestadores || []).filter(x => x.temValores).map(x => {
    const rel = relatorios.filter(e => e.cod === x.cod && e.tipo === x.tipo);
    const gerado = geracao[x.tipo]?.data || null;
    const primeiraConf = rel.length ? diaDoCarimbo(rel.map(e => e.primeira.em).sort()[0]) : null;
    const todosAceitos = rel.length > 0 && rel.every(e => e.valeAceite);
    const aceite = todosAceitos ? diaDoCarimbo(rel.map(e => e.aceita.aceite?.em || e.aceita.em).sort().at(-1)) : null;
    const d = x.doc || {}, envio = paraData(d.relatorio), nfRec = paraData(d.nfRecebida), nfFin = paraData(d.nfFinanceiro);
    const rodadasAteAceite = todosAceitos ? Math.max(...rel.map(e => e.rodadasAteAceite)) : null;
    const etapas = {
      geracaoConf: du(gerado, primeiraConf), confAceite: du(primeiraConf, aceite), aceiteEnvio: du(aceite, envio),
      envioNF: du(envio, nfRec), nfFinanceiro: du(nfRec, nfFin), total: du(gerado, nfFin), geracaoAceite: du(gerado, aceite)
    };
    return { tipo: x.tipo, cod: x.cod, nome: x.nome, unidades: rel.map(e => e.unidade), coluna: x.coluna, gerado, primeiraConf, aceite, envio, nfRec, nfFin,
      rodadas: rel.reduce((s, e) => s + e.lista.length, 0), rodadasAteAceite, aceiteNaPrimeira: todosAceitos && rel.every(e => e.rodadasAteAceite === 1), etapas };
  }).sort((a, b) => (b.etapas.total ?? b.etapas.geracaoAceite ?? -1) - (a.etapas.total ?? a.etapas.geracaoAceite ?? -1) || a.nome.localeCompare(b.nome));
  const relAceitos = relatorios.filter(e => e.valeAceite);
  const rodadas_ = {
    relatorios: relatorios.length, aceitos: relAceitos.length,
    media: media(relAceitos.map(e => e.rodadasAteAceite)), max: relAceitos.length ? Math.max(...relAceitos.map(e => e.rodadasAteAceite)) : null,
    naPrimeira: relAceitos.filter(e => e.rodadasAteAceite === 1).length,
    pctPrimeira: relAceitos.length ? Math.round(relAceitos.filter(e => e.rodadasAteAceite === 1).length / relAceitos.length * 1000) / 10 : null,
    distribuicao: [...contar(relAceitos, e => Math.min(e.rodadasAteAceite, 4))].sort((a, b) => a[0] - b[0]).map(([n, q]) => [n >= 4 ? '4 ou mais' : String(n), q])
  };
  const lead = k => ({ media: media(prestadores.map(p => p.etapas[k])), mediana: mediana(prestadores.map(p => p.etapas[k])), n: prestadores.filter(p => p.etapas[k] !== null).length });
  const leadTime = { geracaoConf: lead('geracaoConf'), confAceite: lead('confAceite'), aceiteEnvio: lead('aceiteEnvio'), envioNF: lead('envioNF'), nfFinanceiro: lead('nfFinanceiro'), geracaoAceite: lead('geracaoAceite'), total: lead('total') };
  const cob = coberturaCompetencia(rodadas, chave);
  const terceiros = esperaTerceiros({ fluxoComp, fech, hoje, opcoesCal });
  const nc = ncsRetrospectiva(ncs, chave);
  const antecedencia = antecedenciaFinanceiro(fluxoComp, mk, opcoesCal, meta);
  const comDias = antecedencia.filter(a => a.dias !== null);
  const resumo = {
    chave, prestadores: prestadores.length, comAceite: prestadores.filter(p => p.aceite).length, concluidos: prestadores.filter(p => p.nfFin).length,
    leadAceite: leadTime.geracaoAceite.media, leadTotal: leadTime.total.media, rodadasMedia: rodadas_.media, pctPrimeira: rodadas_.pctPrimeira,
    terceirosDias: terceiros.total, cobertura: cob.total ? cob.pct : null, ncs: nc.total, ncsImpactam: nc.impactam, reincidencias: nc.reincidencias.length,
    antecedenciaMin: comDias.length ? Math.min(...comDias.map(a => a.dias)) : null, meta
  };
  return { chave, geracao, prestadores, rodadas: rodadas_, leadTime, cobertura: cob, terceiros, nc, antecedencia, meta, resumo, temFluxo: !!fluxoComp };
}

/* ---------- Melhorias e backlog ---------- */
// Backlog da competência = melhorias registradas na anterior + backlog da anterior que não foi feito nem descartado
// (segue até 12 meses). A situação de cada item NESTA competência fica em comp.backlog[id] (sincronizado com a pasta).
function backlogDaCompetencia(competencias, chave, limite = 12) {
  const origem = [];
  const subir = (ch, prof) => {
    if (prof > limite) return [];
    const ant = competenciaVizinha(ch, -1), c = competencias[ant];
    const herdados = subir(ant, prof + 1).filter(it => !MELHORIA_ENCERRADA(c?.backlog?.[it.id]?.status));
    return [...herdados, ...(c?.melhorias || []).map(m => ({ ...m, deCompetencia: ant }))];
  };
  for (const it of subir(chave, 1)) origem.push(it);
  const atual = competencias[chave];
  return origem.map(it => ({ ...it, situacao: atual?.backlog?.[it.id] || { status: 'aberta' } }));
}
function novaMelhoria(texto, operador, indicador = '') {
  const t = String(texto || '').trim(); if (!t) throw new Error('Escreva o que melhorar.');
  return { id: novoId('mel'), em: agoraISO(), por: operador || '', texto: t, indicador };
}
function marcarBacklog(comp, id, status, operador, obs = '') {
  if (!STATUS_MELHORIA[status]) throw new Error('situação inválida');
  comp.backlog = comp.backlog || {};
  const a = comp.backlog[id] || {};
  comp.backlog[id] = { status, por: operador || '', em: agoraISO(), obs: String(obs || '').trim(), historico: [...(a.historico || []), { em: agoraISO(), por: operador || '', de: a.status || 'aberta', para: status }].slice(-20) };
  return comp.backlog[id];
}

/* ---------- Excel da retrospectiva ---------- */
const fmtDiasRetro = v => v === null || v === undefined ? '' : v;
function xlsxRetrospectiva(ret, comparacao = [], backlog = [], melhorias = [], meta = {}) {
  const c = rotuloCompetencia(ret.chave), dt = d => d ? { v: d, st: { fmt: 'date' } } : '';
  const R = [[{ v: `Retrospectiva da competência ${c}`, st: { b: true } }], [`Gerado em ${new Date().toLocaleString('pt-BR')}${meta.operador ? ' por ' + meta.operador : ''} · lead times em dias úteis`], [],
    cabecalho(['Indicador', ...comparacao.map(x => rotuloCompetencia(x.chave))])];
  const linha = (nome, f) => R.push([nome, ...comparacao.map(x => { const v = f(x); return v === null || v === undefined ? '' : v; })]);
  linha('Prestadores com relatório', x => x.prestadores); linha('Com aceite', x => x.comAceite); linha('NF ao Financeiro', x => x.concluidos);
  linha('Lead time geração → aceite (média, dias úteis)', x => x.leadAceite); linha('Lead time geração → NF ao Financeiro (média)', x => x.leadTotal);
  linha('Rodadas até o aceite (média)', x => x.rodadasMedia); linha('Aceite na 1ª rodada (%)', x => x.pctPrimeira);
  linha('Espera por terceiros (dias úteis somados)', x => x.terceirosDias); linha('Cobertura de equivalências (%)', x => x.cobertura);
  linha('NCs (procedentes, registradas no mês)', x => x.ncs); linha('NCs que impactam pagamento', x => x.ncsImpactam); linha('Reincidências faturista × natureza', x => x.reincidencias);
  linha(`Menor antecedência ao Financeiro (meta ${ret.meta} dias úteis)`, x => x.antecedenciaMin);
  const P = [cabecalho(['Repasse', 'Cód.', 'Prestador', 'Unidades', 'Geração no MV', '1ª conferência', 'Aceite', 'E-mail enviado', 'NF recebida', 'NF ao Financeiro', 'Geração → conf.', 'Conf. → aceite', 'Aceite → e-mail', 'E-mail → NF', 'NF → Financeiro', 'Total', 'Rodadas', 'Rodadas até o aceite'])];
  for (const p of ret.prestadores) P.push([p.tipo.toUpperCase(), { v: p.cod, st: { fmt: 'text' } }, p.nome, p.unidades.join(', '), dt(p.gerado), dt(p.primeiraConf), dt(p.aceite), dt(p.envio), dt(p.nfRec), dt(p.nfFin),
    ...['geracaoConf', 'confAceite', 'aceiteEnvio', 'envioNF', 'nfFinanceiro', 'total'].map(k => fmtDiasRetro(p.etapas[k])), p.rodadas, fmtDiasRetro(p.rodadasAteAceite)]);
  const T = [cabecalho(['Origem', 'Grupo', 'Etapa / prestador', 'De quem', 'Motivo', 'Desde', 'Até', 'Dias úteis', 'Em aberto'])];
  for (const x of ret.terceiros.itens) T.push([x.origem === 'fluxo' ? 'Fluxo mensal' : 'Fechamento', x.grupo, x.alvo, x.quem, x.motivo, dt(x.de), x.aberto ? '' : dt(x.ate), x.dias, x.aberto ? 'sim' : '']);
  const N = [cabecalho(['Natureza', 'NCs', 'Valor que impacta', `Meses com NC (de ${ret.nc.meses.length})`])];
  for (const x of ret.nc.porNatureza) N.push([x.nome, x.n, { v: x.valor, st: { fmt: 'money' } }, x.meses]);
  N.push([], cabecalho(['Faturista', 'NCs', 'Valor que impacta', `Meses com NC (de ${ret.nc.meses.length})`]));
  for (const x of ret.nc.porFaturista) N.push([x.k, x.n, { v: x.valor, st: { fmt: 'money' } }, x.meses]);
  N.push([], cabecalho(['Reincidência: faturista', 'Natureza', 'NCs no mês', 'Meses com NC']));
  for (const x of ret.nc.reincidencias) N.push([x.faturista, x.natureza, x.n, x.meses]);
  const A = [cabecalho(['Repasse', 'Pagamento', 'Entrega ao Financeiro', 'Origem da data', 'Dias úteis de antecedência', 'Meta', 'NFs encaminhadas', 'Situação'])];
  const SIT = { ok: 'na meta', abaixo: 'abaixo da meta', atrasada: 'depois do pagamento', sem: 'sem entrega registrada' };
  for (const a of ret.antecedencia) A.push([a.nome, dt(a.pagamento), dt(a.entrega), a.origem, fmtDiasRetro(a.dias), ret.meta, a.previstos ? `${a.entregues} de ${a.previstos}` : '', SIT[a.situacao]]);
  const M = [cabecalho(['Origem', 'Competência', 'Melhoria', 'Registrada por', 'Em', 'Situação', 'Observação'])];
  for (const b of backlog) M.push(['Backlog', rotuloCompetencia(b.deCompetencia), b.texto, b.por, dt(diaDoCarimbo(b.em)), STATUS_MELHORIA[b.situacao.status] || b.situacao.status, b.situacao.obs || '']);
  for (const m of melhorias) M.push(['Para o próximo mês', c, m.texto, m.por, dt(diaDoCarimbo(m.em)), 'Em aberto', '']);
  return criarXlsx([
    { nome: 'Resumo', larguras: [52, ...comparacao.map(() => 12)], linhas: R, filtro: false, congelar: false },
    { nome: 'Lead time', larguras: [9, 8, 34, 12, 12, 12, 12, 12, 12, 14, 10, 10, 10, 10, 10, 8, 8, 10], linhas: P },
    { nome: 'Terceiros', larguras: [14, 12, 50, 18, 40, 12, 12, 10, 10], linhas: T },
    { nome: 'NCs', larguras: [44, 10, 16, 14], linhas: N, filtro: false },
    { nome: 'Antecedência', larguras: [12, 12, 14, 26, 14, 8, 14, 22], linhas: A },
    { nome: 'Melhorias', larguras: [18, 12, 70, 18, 12, 14, 40], linhas: M }
  ]);
}
