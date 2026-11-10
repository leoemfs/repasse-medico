/* ============================================================
 * Conferência cruzada MV × Apolo
 * ============================================================ */
const NIVEL_NOME = ['', 'semelhante', 'truncado', 'idêntico'];
const FAIXA = { 1: 'validada · mesma data', 2: 'validada · data na tolerância', 3: 'não validada · mesma data', 4: 'não validada · data na tolerância', 5: 'nome semelhante', 6: 'sem equivalência · mesma data' };

// Finalidade do PDF: o do prestador genérico vai para a Correção; os demais, para a Conferência.
const finalidadePadrao = rel => String(rel.cab.prestadorCod) === String(S.cfg.parametros.prestadorGenerico || '2') ? 'correcao' : 'conferencia';
const relatoriosPara = prefixo => S.relatorios.filter(x => (x.finalidade || finalidadePadrao(x.rel)) === (prefixo === 'co' ? 'correcao' : 'conferencia'));
function semRelatorioPara(prefixo) {
  const outro = prefixo === 'co' ? 'Conferência' : 'Correção de prestador';
  return `<div class="card"><h2>Nenhum relatório para ${prefixo === 'co' ? 'a correção de prestador' : 'a conferência'}</h2><p class="lead">${S.relatorios.length} PDF(s) carregado(s), todos marcados para ${outro}. ${prefixo === 'co' ? `O relatório do prestador genérico (código ${esc(S.cfg.parametros.prestadorGenerico || '2')}) entra aqui automaticamente.` : ''} Para mudar, use a coluna «Finalidade» na lista de relatórios do Início.</p><div class="acoes"><button onclick="location.hash='inicio'">Ir para o Início</button></div></div>`;
}
// Filtro do seletor de relatórios por unidade e grupo (vários PDFs do mesmo prestador, lidos da pasta).
const FILTRO_REL = { cf: { un: '*', gr: '*' }, co: { un: '*', gr: '*' } };
const unDoRel = x => x.unidadePasta || unidadeSugeridaPeloArquivo(x.nome) || '';
const grDoRel = x => x.grupoPasta || (ehUnidadeV3(S.cfg, unDoRel(x)) ? 'curitiba' : tipoRepasseDaRodada({ descricao: x.rel.cab.descricao, repasse: x.rel.cab.repasse, linhas: x.rel.regs.map(l => ({ grupo: l.grupoNome })) }));
const rotGr = g => g === 'curitiba' ? 'Curitiba' : String(g || '').toUpperCase();
function seletoresAnalise(prefixo, tolPadrao) {
  const todos = relatoriosPara(prefixo), F = FILTRO_REL[prefixo];
  const proximo = prefixo === 'cf' && S.cfProximo && todos.some(r => r.id === S.cfProximo.relId) ? S.cfProximo : null;
  const ultimo = proximo || S[prefixo === 'cf' ? 'conf' : 'corr']?.ctx;
  if (proximo) S.cfProximo = null;
  const passa = x => (F.un === '*' || unDoRel(x) === F.un) && (F.gr === '*' || grDoRel(x) === F.gr);
  if (proximo && !todos.filter(passa).some(r => r.id === proximo.relId)) { F.un = '*'; F.gr = '*'; }
  const rels = todos.filter(passa).sort((a, b) => (+unDoRel(a) || 999) - (+unDoRel(b) || 999) || grDoRel(a).localeCompare(grDoRel(b)) || a.rel.cab.prestadorNome.localeCompare(b.rel.cab.prestadorNome));
  const uns = [...new Set(todos.map(unDoRel).filter(Boolean))].sort((a, b) => +a - +b), grs = [...new Set(todos.map(grDoRel))];
  const filtro = todos.length > 1 ? `<div class="filtros cf-fil"><label class="campo">Relatórios da unidade<select id="${prefixo}FUn">${opcoes([['*', 'Todas'], ...uns.map(u => [u, `${u} - ${unidadePorCod(S.cfg, u)?.nome || ''}`])], F.un)}</select></label>
    <label class="campo">Grupo<select id="${prefixo}FGr">${opcoes([['*', 'Todos'], ...grs.map(g => [g, rotGr(g)])], F.gr)}</select></label>
    <div class="campo"><span class="small muted">${rels.length} de ${todos.length} relatório(s)</span>${prefixo === 'cf' && rels.length > 1 && (F.un !== '*' || F.gr !== '*') ? `<button type="button" class="sec mini" data-cflote>Conferir os ${rels.length} relatórios filtrados</button>` : ''}</div></div>` : '';
  if (!rels.length) return filtro + '<p class="muted">Nenhum relatório com esse filtro.</p>';
  const relSel = ultimo?.relId && rels.some(r => r.id === ultimo.relId) ? ultimo.relId : rels[0]?.id;
  const rel = rels.find(r => r.id === relSel);
  const sugerida = rel ? (rel.unidadePasta || unidadeSugeridaPeloArquivo(rel.nome)) : '';
  const unSel = ultimo?.relId === relSel ? ultimo.unidadeCod : (sugerida && unidadePorCod(S.cfg, sugerida) ? sugerida : '');
  return `${filtro}<div class="grid4">
    <label class="campo">Relatório MV<select id="${prefixo}Rel">${opcoes(rels.map(r => [r.id, `${r.rel.cab.prestadorCod} - ${r.rel.cab.prestadorNome} · ${unDoRel(r) ? `unidade ${unDoRel(r)} ` : ''}${rotGr(grDoRel(r))} · ${r.rel.cab.descricao || r.nome}`]), relSel)}</select></label>
    <label class="campo">Unidade dos laudos<select id="${prefixo}Un"><option value="">— escolher —</option>${opcoes(S.cfg.unidades.map(u => [u.cod, `${u.cod} - ${u.nome}`]), unSel)}<option value="*"${unSel === '*' ? ' selected' : ''}>Todas as unidades (não recomendado)</option></select>
      <span class="small muted" id="${prefixo}UnDica">${sugerida && !ultimo ? (rel?.unidadePasta ? 'Pela pasta da unidade: confirme.' : 'Sugerida pelo nome do arquivo: confirme.') : 'O PDF não informa a unidade: a escolha é da sessão.'}</span></label>
    <label class="campo">Tolerância de data (dias)<input id="${prefixo}Tol" type="number" min="0" max="60" value="${ultimo?.parametros?.tol ?? tolPadrao}"></label>
    <div id="${prefixo}Extra"></div></div>`;
}
// Decisões da competência do topo: NCs registradas (pelas chaves da linha) e linhas consideradas no repasse.
const indiceDecisoesComp = (chave = S.comp) => indiceDecisoes(S.nc.itens.filter(x => x.competencia === chave), estadoCompetencia(S.compReg, chave).decisoes);
const chipDecisao = d => d ? ` <span class="st dec-${d.tipo}" title="${esc(d.tipo === 'nc' ? `NC ${SITUACAO_NC[d.situacao] || ''}` : d.justificativa)}">${esc(TIPOS_DECISAO[d.tipo])}</span>` : '';
function relSelecionado(prefixo) { return S.relatorios.find(r => r.id === $(prefixo + 'Rel').value); }

/* ---------- Competência: produção dos arquivos e resultado de outra competência ---------- */
// Mês dominante das datas de cada arquivo, calculado uma vez por arquivo carregado.
function producaoDoArquivo(obj, datas) {
  if (!obj) return null;
  if (!obj.__producao) obj.__producao = mesDominante(datas());
  return obj.__producao;
}
function avisosProducao() {
  const esp = producaoEsperada(S.comp), out = [];
  const checar = (nome, dom) => { if (dom && dom.mes !== esp) out.push(`${nome}: produção ${rotuloMes(dom.mes)}`); };
  for (const x of S.relatorios) checar(`MV ${x.rel.cab.prestadorCod} - ${x.rel.cab.prestadorNome}`, producaoDoArquivo(x, () => x.rel.regs.map(r => r.data)));
  if (S.apolo) checar('Laudos do Apolo', producaoDoArquivo(S.apolo, () => S.apolo.laudos.map(l => l.data)));
  if (S.pbi) checar('Power BI', producaoDoArquivo(S.pbi, () => S.pbi.linhas.map(l => l.data)));
  return out;
}
function cartaoAvisoProducao() {
  const av = avisosProducao();
  return av.length ? `<div class="aviso-fixo warn">A competência ${rotuloCompetencia(S.comp)} espera produção ${rotuloMes(producaoEsperada(S.comp))}, mas há arquivo de outro mês — ${av.map(esc).join(' · ')}. Confirme antes de analisar: as rodadas e NCs serão gravadas em ${rotuloCompetencia(S.comp)}.</div>` : '';
}
function cartaoOutraCompetencia(x, nome) {
  return x && x.ctx.chaveCompetencia !== S.comp ? `<div class="card"><p class="muted">A última ${nome} desta sessão é da competência ${rotuloCompetencia(x.ctx.chaveCompetencia)}. Volte para ela no topo para ver o resultado, ou execute uma nova aqui em ${rotuloCompetencia(S.comp)}.</p></div>` : '';
}

RENDER.conferencia = () => {
  const p = $('pag-conferencia');
  if (!S.relatorios.length || !S.apolo) { p.innerHTML = faltamArquivos(); return; }
  if (!relatoriosPara('cf').length) { p.innerHTML = semRelatorioPara('cf'); return; }
  p.innerHTML = `${cartaoAvisoProducao()}<div class="card"><h2>Parâmetros</h2>${seletoresAnalise('cf', S.cfg.parametros.tolConferencia)}
    <div class="acoes"><button id="cfRodar">Executar conferência</button><span class="muted small">Cada execução vira uma rodada registrada, com versões das bases e parâmetros.</span></div></div>
    <div id="cfRes">${cartaoOutraCompetencia(S.conf, 'conferência')}</div>`;
  const extra = () => {
    const rel = relSelecionado('cf'), un = $('cfUn').value;
    const ligados = rel ? medicosDoPrestador(S.cfg, rel.rel.cab.prestadorCod) : [];
    const medUn = [...new Set(laudosDaUnidade(S.apolo, S.cfg, un || '*').map(l => l.medico).filter(Boolean))].sort();
    const presentes = ligados.filter(n => medUn.some(m => norm(m) === n));
    const nomesPresentes = presentes.map(n => medUn.find(m => norm(m) === n));
    // O médico do laudo vem do cadastro: nome do cabeçalho do MV ou alias validado. A escolha manual
    // só é lembrada para o mesmo relatório e a mesma unidade.
    const mesmo = S.conf?.ctx?.relId === rel?.id && S.conf?.ctx?.unidadeCod === un;
    const sel = mesmo ? S.conf.ctx.medicoSel : (presentes.length ? '@prest' : '*');
    const prest = S.cfg.prestadores.find(x => String(x.cod) === String(rel?.rel.cab.prestadorCod));
    const viaAlias = presentes.some(n => prest && norm(prest.nomeMV) !== n);
    const parecidos = !presentes.length && prest ? medUn.filter(m => { const a = tokensNome(norm(m)), b = tokensNome(norm(prest.nomeMV)); const [menor, maior] = a.length <= b.length ? [a, b] : [b, a]; return menor.length >= 2 && menor.every(x => maior.includes(x)); }).slice(0, 3) : [];
    $('cfExtra').innerHTML = `<label class="campo">Médico do laudo («Só no laudo»)<select id="cfMed">
      <option value="@prest"${sel === '@prest' ? ' selected' : ''}${presentes.length ? '' : ' disabled'}>${presentes.length ? `${esc(nomesPresentes.join(' + '))} (do cadastro)` : 'Prestador do relatório (sem vínculo nesta unidade)'}</option>
      <option value="*"${sel === '*' ? ' selected' : ''}>Todos os médicos da unidade</option>${opcoes(medUn.map(m => [norm(m), m]), sel)}</select>
      <span class="small muted">${presentes.length ? `Escolhido pelo cadastro do prestador ${esc(rel.rel.cab.prestadorCod)}: ${viaAlias ? 'alias validado' : 'nome igual ao do cabeçalho do MV'}.` : 'O nome do prestador não está entre os médicos do Apolo nesta unidade: crie um alias em Bases → Prestadores ou escolha o médico.'}</span>
      ${parecidos.length ? `<span class="small">Parecido no Apolo: ${parecidos.map(m => `<button type="button" class="sec mini" data-cfalias="${esc(m)}">Vincular «${esc(m)}» como alias</button>`).join(' ')}</span>` : ''}</label>`;
    $('cfExtra').querySelectorAll('[data-cfalias]').forEach(b => b.onclick = async () => {
      const op = await exigirOperador(); if (!op || !prest) return;
      if (!await confirmar('Vincular como alias?', `«${esc(b.dataset.cfalias)}» (Apolo) passa a identificar o prestador ${esc(prest.cod)} - ${esc(prest.nomeMV)}. O alias fica validado por ${esc(op)}.`, 'Vincular')) return;
      prest.aliases = prest.aliases || [];
      prest.aliases.push({ nome: b.dataset.cfalias, status: 'validado', responsavel: op, em: agoraISO(), motivo: 'vinculado na Conferência', origem: 'conferência', competencia: S.comp });
      salvarCfg(`Alias «${b.dataset.cfalias}» validado para o prestador ${prest.cod}.`, 'aliases'); extra();
    });
  };
  if (!$('cfRel')) { $('cfRodar').disabled = true; return; }
  $('cfRel').onchange = extra; $('cfUn').onchange = extra; extra();
  $('cfRodar').onclick = () => comProcessando($('cfRodar'), executarConferencia, 'a conferência');
  if (S.conf && S.conf.ctx.chaveCompetencia === S.comp) desenharConferencia();
};
function faltamArquivos() {
  return `<div class="card"><h2>Faltam arquivos</h2><p class="lead">Carregue ${S.relatorios.length ? '' : 'o relatório do MV (PDF)'}${!S.relatorios.length && !S.apolo ? ' e ' : ''}${S.apolo ? '' : 'a planilha de laudos do Apolo'} no Início.</p><div class="acoes"><button onclick="location.hash='inicio'">Ir para o Início</button></div></div>`;
}

async function executarConferencia() {
  const x = relSelecionado('cf'), un = $('cfUn').value, tol = +$('cfTol').value, medSel = $('cfMed').value;
  if (!un) return avisar('Escolha a unidade dos laudos: o PDF não informa a unidade.', 'warn');
  if (!(tol >= 0)) return avisar('Tolerância inválida.', 'warn');
  if (!exigirAberta(S.comp, 'executar uma conferência')) return;
  const { res, rodada } = await rodarConferencia(x, un, tol, medSel);
  desenharConferencia();
  avisar(`Conferência concluída: ${res.porStatus.conferido.n} conferidas, ${res.nMV - res.porStatus.conferido.n} linhas do MV com pendência ou ressalva.`, 'ok');
  return rodada;
}
// Executa e registra uma conferência (usada pelo botão e para rodar de novo após validar equivalências).
async function rodarConferencia(x, un, tol, medSel) {
  const medicos = medSel === '*' ? null : medSel === '@prest' ? medicosDoPrestador(S.cfg, x.rel.cab.prestadorCod) : [medSel];
  const res = aplicarDecisoes(conferirCruzado(x.rel, S.apolo, S.cfg, S.eq, { unidadeCod: un, tol, medicos }), indiceDecisoesComp());
  const unidade = un === '*' ? 'Todas as unidades' : `${un} - ${unidadePorCod(S.cfg, un)?.nome || ''}`;
  const medicosNomes = medicos ? [...new Set(S.apolo.laudos.filter(l => medicos.includes(l.mn)).map(l => l.medico))].join(', ') : '';
  const ctx = { chaveCompetencia: S.comp, relId: x.id, relatorio: x.rel, apoloNome: S.apolo.nome, unidadeCod: un, unidadeNome: unidade, medicoSel: medSel, medicosNomes, parametros: { tol, medico: medSel }, operador: S.operador, cfgRevisao: S.cfg.revisao,
    arquivos: [{ papel: 'MV', nome: x.nome, hash: x.hash }, { papel: 'Apolo', nome: S.apolo.nome, hash: S.apolo.hash }] };
  const rodada = registroRodada(res, ctx); ctx.rodadaId = rodada.id;
  const ant = rodadaAnterior(S.rodadas, rodada);
  await guardarRodada(rodada);
  S.conf = { res, ctx, rodada, comparacao: ant ? { ant, grupos: compararRodadas(ant, rodada) } : null, filtroStatus: new Set(), filtroMarc: new Set(), busca: '' };
  ctx.fonteNC = `conf|${x.id}|${un}`;
  // Conciliação com o Power BI (SOL-F9): explica os «Só no laudo» e sugere natureza e responsável.
  const cands = candidatosDaConferencia(res, ctx, S.cfg);
  if (S.pbi) {
    const opcPBI = { unidadeCod: un, tol, prestadorCod: x.rel.cab.prestadorCod, cfg: S.cfg, idxEq: indiceEquivalencias(S.eq), idxPrest: indicePrestadores(S.cfg) };
    for (const l of res.linhas) if (l.status === 'so-laudo' && l.l) { const c = conciliarLaudo(S.pbi, l.l, opcPBI); if (c) { l.pbi = c; l.motivos.push(c.texto); } }
    ctx.pbiResumo = enriquecerCandidatosComPBI(cands, S.pbi, opcPBI); ctx.pbiNome = S.pbi.nome;
  }
  guardarCandidatosNC(ctx.fonteNC, `Conferência ${x.rel.cab.prestadorCod} - ${x.rel.cab.prestadorNome} · ${unidade}`, `Conf. ${x.rel.cab.prestadorCod} · un. ${un}`, cands);
  return { res, ctx, rodada };
}
/* Depois de validar equivalências: roda de novo, com os mesmos parâmetros, a última conferência de cada
 * relatório afetado que estiver carregado nesta sessão (PDF do MV e Apolo). Devolve o que rodou e o que faltou. */
async function rodarDeNovoAfetadas(rodadas) {
  const feitas = [], faltam = [];
  for (const r of rodadas) {
    const hash = (r.arquivos || []).find(a => a.papel === 'MV')?.hash;
    const x = S.relatorios.find(y => y.hash === hash) || S.relatorios.find(y => String(y.rel.cab.prestadorCod) === String(r.prestadorCod) && y.rel.cab.repasse === r.repasse && (!unDoRel(y) || unDoRel(y) === String(r.unidadeCod)));
    if (!x || !S.apolo) { faltam.push(r); continue; }
    const novo = await rodarConferencia(x, r.unidadeCod, r.parametros?.tol ?? S.cfg.parametros.tolConferencia, r.parametros?.medico || '@prest');
    feitas.push({ antes: r, depois: novo.rodada });
  }
  return { feitas, faltam };
}

function desenharConferencia() {
  const { res, ctx, comparacao } = S.conf, c = $('cfRes'); if (!c) return;
  aplicarDecisoes(res, indiceDecisoesComp(ctx.chaveCompetencia));
  const ordem = Object.keys(STATUS_CONF).sort((a, b) => STATUS_CONF[a].ordem - STATUS_CONF[b].ordem);
  const CZ = causasDaConferencia(res, S.eq.compostas || []), pct = CZ.totalMV ? Math.round(CZ.conferidas / CZ.totalMV * 100) : 0;
  const ehSL = g => g.tipo === 'so-laudo' || g.tipo.startsWith('sl-'), nLote = CZ.grupos.filter(g => !ehSL(g)).reduce((t, g) => t + g.linhas.length, 0);
  const seg = k => res.linhas.filter(x => x.r && (k === 'ok' ? (x.status === 'conferido' || x.status === 'nao-procedimental' || x.decisao) : !x.decisao && (k === 'ress' ? x.status === 'ressalva' : k === 'sf' ? x.status === 'so-faturamento' : !['conferido', 'nao-procedimental', 'ressalva', 'so-faturamento'].includes(x.status)))).length;
  const barra = CZ.totalMV ? ['ok', 'ress', 'pend', 'sf'].map(k => `<span class="cf-b-${k}" style="width:${seg(k) / CZ.totalMV * 100}%" title="${seg(k)}"></span>`).join('') : '';
  c.innerHTML = `<div class="card cf-frase"><h2>${esc(ctx.relatorio.cab.prestadorCod)} - ${esc(ctx.relatorio.cab.prestadorNome)} · ${esc(ctx.unidadeNome)} <span class="muted small">rodada ${esc(ctx.rodadaId)}</span></h2>
    <div class="cf-barra">${barra}</div>
    <p style="margin:6px 0"><b>${CZ.conferidas} de ${CZ.totalMV} linhas do MV conferidas${CZ.ressalvasDecididas ? ' (contando as já decididas)' : ''} · ${pct}%.</b> ${CZ.faltam ? `Faltam <b>${CZ.faltam} decisão(ões)</b>${nLote ? `: ${CZ.grupos.filter(g => !ehSL(g)).length} resolvem ${nLote} linha(s) de uma vez` : ''}${CZ.umaUma.length ? `${nLote ? ',' : ':'} ${CZ.umaUma.length} linha(s) precisam ser olhadas uma a uma` : ''}${CZ.grupos.some(ehSL) ? `${nLote || CZ.umaUma.length ? ', e' : ':'} ${CZ.grupos.filter(ehSL).reduce((t, g) => t + g.linhas.length, 0)} laudo(s) sem lançamento para apontar (correção de prestador ou NC)` : ''}.` : 'Nada falta decidir neste relatório: é só registrar o aceite.'}</p>
    <div class="acoes">${CZ.faltam ? '<button id="cfIrCausas">Começar pelas decisões</button>' : '<a class="small" href="#cfAceite">Ir para o aceite ↓</a>'}<button class="sec" id="cfVerTodas">Ver todas as linhas</button><button class="sec" id="cfExcel" data-cfexcel>Exportar Excel</button></div>
    ${ctx.pbiResumo ? `<div class="pbi-resumo" id="cfPBI"><b>Power BI</b> <span class="small muted">(${esc(ctx.pbiNome || '')})</span> — laudos «Só no laudo»: ${Object.entries(ctx.pbiResumo).filter(([, n]) => n).map(([k, n]) => `<span class="marc">${esc(SITUACAO_PBI[k].nome)} · ${n}</span>`).join(' ') || '<span class="small muted">nenhum</span>'}<p class="small muted" style="margin:4px 0 0">A natureza e o responsável (quem fechou a conta) já vêm sugeridos nos candidatos a NC; abra a linha para ver a conta e o atendimento.</p></div>` : (S.pbi ? '' : '<p class="small muted">Carregue o Power BI no Início para explicar os «Só no laudo» (lançamento, conta aberta, remessa, quem fechou).</p>')}</details></div>
    <details class="cf-det"${S.conf.detAberto ? ' open' : ''}><summary>Detalhes da rodada (relatório, período, volume, equivalências${comparacao ? ', comparação com a rodada anterior' : ''})</summary>
    <dl class="kv"><dt>Relatório</dt><dd>${esc(ctx.relatorio.cab.prestadorCod)} - ${esc(ctx.relatorio.cab.prestadorNome)} · repasse ${esc(ctx.relatorio.cab.repasse)} · ${esc(ctx.relatorio.cab.descricao)}</dd>
    <dt>Unidade</dt><dd>${esc(ctx.unidadeNome)}</dd><dt>Médico(s) no escopo</dt><dd>${esc(ctx.medicosNomes || 'Todos os médicos')}</dd>
    <dt>Período de produção</dt><dd>${res.periodo ? `${fmtData(res.periodo[0])} a ${fmtData(res.periodo[1])}` : '—'} · modalidades ${esc(res.modalidades.join(', ') || '—')}</dd>
    <dt>Volume</dt><dd>${res.nMV} linhas do MV (${res.nProcedimentos} procedimentos) · ${res.nLaudosEscopo} laudos no escopo · ${res.nPares} pares</dd>
    <dt>Equivalências</dt><dd>${res.eqValidadas} validadas (revisão ${res.eqRevisao})${res.eqValidadas ? '' : ' — <span style="color:var(--warn)">nenhuma validada: nada pode ser confirmado</span>'}</dd></dl>
    ${comparacao ? resumoComparacao(comparacao) : ''}</details></div>
    ${cartaoCausas(CZ, res)}
    <div class="card cf-aceite-card">${quadroAceite()}</div>
    <div class="card"><h2>Linhas</h2>
    <div class="tiles">${ordem.map(k => `<button class="tile st-${k}${res.porStatus[k].n ? '' : ' vazio'}${S.conf.filtroStatus.has(k) ? ' sel' : ''}" data-st="${k}"><b>${res.porStatus[k].n}</b><small>${esc(STATUS_CONF[k].nome)}</small>${res.porStatus[k].vlRepasse ? `<small class="muted" style="display:block;font-weight:400">R$ ${fmtBR(res.porStatus[k].vlRepasse)}</small>` : ''}</button>`).join('')}</div>
    <div class="marcadores">${Object.entries(res.porDecisao || {}).filter(([, n]) => n).map(([k, n]) => `<button class="marc dec-${k}${S.conf.filtroMarc.has('dec-' + k) ? ' sel' : ''}" data-m="dec-${k}">${esc(TIPOS_DECISAO[k])} · ${n}</button>`).join('')}${Object.entries(res.porMarcador).filter(([, n]) => n).map(([k, n]) => `<button class="marc${S.conf.filtroMarc.has(k) ? ' sel' : ''}" data-m="${k}">${esc(MARCADORES[k])} · ${n}</button>`).join('') || '<span class="muted small">Sem marcadores.</span>'}</div>
    <p class="small muted">Cada registro tem uma categoria principal; os marcadores contam ocorrências (um registro pode ter vários).</p>
    <div class="acoes"><input type="search" id="cfBusca" placeholder="Buscar paciente, código, título ou médico…" value="${esc(S.conf.busca)}" style="max-width:420px"><button id="cfExcel2" data-cfexcel>Exportar Excel</button><button id="cfLimpar" class="sec">Limpar filtros</button><label class="small"><input type="checkbox" id="cfSoFalta"${S.conf.soFalta !== false ? ' checked' : ''}> só o que falta decidir</label></div>
    ${S.conf.filtroLinhas ? `<div class="cf-fl small"><b>Mostrando as ${S.conf.filtroLinhas.idx.length} linha(s) de:</b> ${esc(S.conf.filtroLinhas.titulo)} <button class="sec mini" id="cfFlLimpar">Mostrar todas</button></div>` : ''}
    <div id="cfTab" style="margin-top:10px"></div></div>
    ${ctx.fonteNC ? cartaoCandidatosNC(ctx.fonteNC) : ''}
    <div class="card"><h2>Equivalências desta rodada</h2><div id="cfEq"></div></div>`;
  ligarCartaoCandidatosNC(c);
  c.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { const s = S.conf.filtroStatus; s.has(b.dataset.st) ? s.delete(b.dataset.st) : s.add(b.dataset.st); desenharConferencia(); });
  c.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const s = S.conf.filtroMarc; s.has(b.dataset.m) ? s.delete(b.dataset.m) : s.add(b.dataset.m); desenharConferencia(); });
  $('cfLimpar').onclick = () => { S.conf.filtroStatus.clear(); S.conf.filtroMarc.clear(); S.conf.busca = ''; S.conf.filtroLinhas = null; desenharConferencia(); };
  // Os dois botões de Excel (no topo do resultado e ao lado da busca) fazem a mesma coisa. Antes os dois tinham o mesmo id
  // e só o primeiro recebia a ação: o de baixo não fazia nada.
  c.querySelectorAll('[data-cfexcel]').forEach(bt => bt.onclick = () => entregarArquivo(xlsxConferencia(res, { ...ctx, compostas: S.eq.compostas || [], colunasExportacao: colunasExportacaoAtuais() }), nomeArquivoAnalise('conferencia', ctx), 'conf', ctx.chaveCompetencia || S.comp));
  if ($('cfIrCausas')) $('cfIrCausas').onclick = () => $('cfCausas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('cfVerTodas').onclick = () => { S.conf.soFalta = false; S.conf.filtroLinhas = null; desenharConferencia(); $('cfTab')?.scrollIntoView({ block: 'start' }); };
  $('cfSoFalta').onchange = e => { S.conf.soFalta = e.target.checked; desenharConferencia(); };
  if ($('cfFlLimpar')) $('cfFlLimpar').onclick = () => { S.conf.filtroLinhas = null; desenharConferencia(); };
  const det = c.querySelector('.cf-det'); if (det) det.ontoggle = () => { S.conf.detAberto = det.open; };
  ligarCausas(c, CZ, res, ctx);
  ligarQuadroAceite();
  const filtrar = () => {
    const q = norm(S.conf.busca);
    const fl = S.conf.filtroLinhas ? new Set(S.conf.filtroLinhas.idx) : null, soFalta = S.conf.soFalta !== false && !fl && !S.conf.filtroStatus.size;
    return res.linhas.filter((x, i) => (!fl || fl.has(i)) && (!soFalta || (!x.decisao && x.status !== 'conferido' && x.status !== 'nao-procedimental'))
      && (!S.conf.filtroStatus.size || S.conf.filtroStatus.has(x.status))
      && (!S.conf.filtroMarc.size || [...S.conf.filtroMarc].every(m => m.startsWith('dec-') ? x.decisao?.tipo === m.slice(4) : x.marcadores.has(m)))
      && (!q || norm([x.r?.paciente, x.r?.codigo, x.r?.procDesc, x.l?.paciente, x.l?.titulo, x.l?.medico].join(' ')).includes(q)));
  };
  const t = tabela($('cfTab'), {
    linhas: filtrar(), colunas: [
      { t: 'Situação', html: x => chipStatus(x.status, STATUS_CONF[x.status].nome) + chipDecisao(x.decisao) },
      { t: 'Paciente', v: x => x.r?.paciente || x.l?.paciente }, { t: 'Data', v: x => fmtData(x.r?.data || x.l?.data) },
      { t: 'Procedimento no MV', v: x => x.r ? `${x.r.codigo} · ${x.r.procDesc || ''}` : '—' }, { t: 'Laudo (Apolo)', v: x => x.l?.titulo || '—' },
      { t: 'O que falta / por quê', v: x => x.decisao ? '' : x.status === 'conferido' || x.status === 'nao-procedimental' ? '' : (CZ.porLinha.get(res.linhas.indexOf(x)) || x.motivos[0] || '') },
      { t: 'Vl Repasse', n: true, v: x => x.r ? fmtBR(x.r.vlRepasse) : '' }
    ],
    detalhe: x => `<div class="acoes" style="margin:0 0 8px">${botoesDecisao(x, res.linhas.indexOf(x))}</div><p class="small muted" style="margin:0 0 6px">Linha ${x.r ? x.r.seq : '—'} · origem ${esc(x.origem)} · médico do laudo ${esc(x.l?.medico || '—')}${x.marcadores.size ? ` · ${esc([...x.marcadores].map(m => MARCADORES[m]).join(' · '))}` : ''}</p><div class="det"><div><h4>Motivo / evidências</h4><ul>${x.motivos.map(m => `<li>${esc(m)}</li>`).join('')}</ul>
      ${x.r ? `<h4 style="margin-top:8px">Linha do MV</h4><div class="small">${esc(x.r.codigo)} - ${esc(x.r.procDesc)} · conta ${esc(x.r.conta)} · atendimento ${esc(x.r.atendimento)} · ${esc(x.r.convenio)} · página ${x.r.pagina}${x.r.repeticao ? ` · repetida ${x.r.repeticao.i}/${x.r.repeticao.n}` : ''}</div>` : ''}
      ${x.l ? `<h4 style="margin-top:8px">Laudo</h4><div class="small">${esc(x.l.titulo)} · ${esc(x.l.descricao)} · ${esc(x.l.unidade)} · ${esc(x.l.modalidade)} · ${esc(x.l.convenio)} · linha ${x.l.linhaPlanilha} da planilha</div>` : ''}</div>
      <div><h4>Candidatos (paciente e data na tolerância)</h4>${x.cands.length ? `<ul>${x.cands.map(cd => `<li>${cd.l === x.l ? '<strong>' : ''}«${esc(cd.l.titulo)}» · ${esc(cd.l.medico)} · ${fmtData(cd.l.data)} · nome ${NIVEL_NOME[cd.nm]} · ${esc(ROTULO_EQ[cd.proc.estado] || cd.proc.estado)} · faixa ${cd.tier} (${FAIXA[cd.tier]})${cd.l === x.l ? '</strong>' : ''}</li>`).join('')}</ul>` : '<p class="muted small">Nenhum candidato.</p>'}</div></div>`
  });
  $('cfBusca').oninput = e => { S.conf.busca = e.target.value; t.atualizar(filtrar()); };
  $('cfTab').addEventListener('click', async e => {
    const b = e.target.closest('[data-nc-linha],[data-considerar],[data-desconsiderar]'); if (!b) return;
    let ok = false;
    if (b.dataset.ncLinha !== undefined) ok = await abrirRegistroNC([candidatoDaLinhaConferencia(res.linhas[+b.dataset.ncLinha], ctx, S.cfg)]);
    else if (b.dataset.considerar !== undefined) ok = await considerarNoRepasse(res.linhas[+b.dataset.considerar]);
    else ok = await removerDecisaoConsiderar(res.linhas[+b.dataset.desconsiderar]);
    if (ok) { aplicarDecisoes(res, indiceDecisoesComp()); desenharConferencia(); }
  });
  painelEqRodada($('cfEq'), paresDaConferencia(res), executarConferencia);
}

function resumoComparacao({ ant, grupos }) {
  const n = k => grupos[k].length;
  return `<div class="card" style="background:var(--infobg);border-color:transparent;margin-top:12px"><strong>Comparação com a rodada de ${new Date(ant.em).toLocaleString('pt-BR')}</strong>
    <div class="small" style="margin-top:4px">${n('agoraIdentificados')} passaram a conferido/identificado · ${n('continuamPendentes')} continuam pendentes · ${n('mudaramEstado')} mudaram de categoria · ${n('mudaramMedico')} mudaram de médico · ${n('novos')} linhas novas · ${n('desapareceram')} saíram da extração · ${n('semMudanca')} sem mudança.</div>
    <div class="small muted">A nova extração mostra o que mudou nos dados; não prova quem fez a correção no MV.</div></div>`;
}

/* ---------- Decisões por linha (memória da competência) ---------- */
function botoesDecisao(x, i) {
  if (x.decisao?.tipo === 'nc') return `<span class="small">NC registrada (${esc(SITUACAO_NC[x.decisao.situacao] || '')}) — <a href="#nc">ver na aba Não conformidades</a>. Para desfazer, mude a NC para «Não procede».</span>`;
  if (x.decisao?.tipo === 'considerar') return `<span class="small">Considerado no repasse por ${esc(x.decisao.por || '—')}: «${esc(x.decisao.justificativa)}»</span> <button class="sec mini" data-desconsiderar="${i}">Remover decisão</button>`;
  return `<button class="sec mini" data-nc-linha="${i}">Apontar como NC…</button>${x.r ? ` <button class="sec mini" data-considerar="${i}">Considerar no repasse…</button>` : ''}`;
}
async function considerarNoRepasse(x) {
  if (!exigirAberta(S.comp, 'registrar decisões')) return false;
  const op = await exigirOperador(); if (!op) return false;
  const r = await dialogo('Considerar no repasse', `<p class="small">${esc(x.r.codigo)} - ${esc(x.r.procDesc)} · ${esc(fmtData(x.r.data))} · R$ ${fmtBR(x.r.vlRepasse)}</p>
    <p class="small muted">A linha não bate, mas entra no repasse. A decisão vale para toda nova rodada da competência ${rotuloCompetencia(S.comp)} e não conta como pendência no aceite.</p>
    <label class="campo">Justificativa (obrigatória)<input type="text" name="just"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Considerar no repasse']]);
  if (r.botao !== 'ok') return false;
  if (!r.campos.just.trim()) { avisar('Informe a justificativa.', 'warn'); return false; }
  registrarConsiderar(S.compReg, S.comp, chavesDaLinha(x.r, x.l), r.campos.just, op, { codigo: x.r.codigo, desc: x.r.procDesc, titulo: x.l?.titulo || '' });
  salvarCompReg(); avisar('Linha considerada no repasse nesta competência.', 'ok');
  return true;
}
async function removerDecisaoConsiderar(x) {
  if (!exigirAberta(S.comp, 'alterar decisões')) return false;
  if (!await confirmar('Remover decisão?', 'A linha volta a aparecer como pendente na conferência.', 'Remover')) return false;
  removerConsiderar(S.compReg, S.comp, x.decisao.id); salvarCompReg(); avisar('Decisão removida.', 'ok');
  return true;
}

/* ---------- Aceite na própria Conferência (SOL-F11) ----------
 * Mesmas regras de Rodadas: observação obrigatória quando há pendências (já descontadas as decisões).
 * O aceite fica na rodada (aparece em Rodadas e muda a situação no Fechamento). Desfazer guarda o histórico. */
const rodadaDaConf = () => S.conf && (S.rodadas.find(r => r.id === S.conf.ctx.rodadaId) || S.conf.rodada);
function proximoRelatorioConf() {
  const rels = relatoriosPara('cf'), i = rels.findIndex(r => r.id === S.conf?.ctx.relId);
  return i >= 0 && i < rels.length - 1 ? rels[i + 1] : null;
}
function quadroAceite() {
  const r = rodadaDaConf(); if (!r) return '';
  const chave = competenciaDaRodada(r), fechada = compFechada(chave), idx = indiceDecisoesComp(chave);
  const abertas = r.linhas.filter(l => !linhaResolvida(l)), comDecisao = abertas.filter(l => idx.has(l.kd) || (l.kl && idx.has(l.kl)));
  const pend = pendenciasDaRodada(r, idx).length, prox = proximoRelatorioConf(), nNC = comDecisao.filter(l => idx.get(l.kd)?.tipo === 'nc' || (l.kl && idx.get(l.kl)?.tipo === 'nc')).length;
  if (r.aceite) return `<div class="aceite-box feito" id="cfAceite"><b>Aceite desta rodada</b> <span class="badge ok">aceito</span>
    <p class="small" style="margin:6px 0">${esc(r.aceite.por)} · ${new Date(r.aceite.em).toLocaleString('pt-BR')}${r.aceite.obs ? ` — «${esc(r.aceite.obs)}»` : ''} · ${r.aceite.pendencias} pendência(s) no aceite</p>
    <div class="acoes" style="margin:0">${fechada ? '<span class="small muted">Competência fechada: reabra no Início para desfazer.</span>' : '<button class="sec mini" id="cfDesfazer">Desfazer aceite</button>'}<a href="#rodadas" class="small">Ver em Rodadas</a>
    ${prox ? `<button class="sec mini" id="cfProximo">Ir para o próximo relatório (${esc(prox.rel.cab.prestadorCod)} - ${esc(prox.rel.cab.prestadorNome)})</button>` : ''}</div></div>`;
  return `<div class="aceite-box" id="cfAceite"><b>Aceite desta rodada</b> <span class="badge warn">sem aceite</span>
    <p class="small" style="margin:6px 0">${abertas.length} linha(s) com pendência ou ressalva · <b>${comDecisao.length} já com decisão</b>${comDecisao.length ? ` (${nNC} NC, ${comDecisao.length - nNC} considerada(s) no repasse)` : ''} · <b>${pend} pendente(s)</b></p>
    ${fechada ? `<div class="acoes" style="margin:0"><button disabled>Registrar aceite</button><span class="small muted">Competência ${rotuloCompetencia(chave)} fechada: reabra no Início para registrar aceite.</span></div>` : `
    <label class="campo">Observação do aceite${pend ? ' (obrigatória: há pendências)' : ' (opcional)'}<textarea id="cfAceiteObs" rows="2" style="min-height:0;height:58px"></textarea></label>
    <div class="acoes" style="margin:0"><button id="cfAceitar">Registrar aceite</button>${prox ? `<button class="sec" id="cfAceitarProx">Registrar aceite e ir para o próximo relatório</button>` : ''}</div>
    <p class="small muted" style="margin:6px 0 0">O aceite aparece em Rodadas e muda a situação no Fechamento para «Conferido · a enviar».${prox ? ` Próximo relatório: ${esc(prox.rel.cab.prestadorCod)} - ${esc(prox.rel.cab.prestadorNome)}.` : ''}</p>`}</div>`;
}
function ligarQuadroAceite() {
  const irProximo = () => {
    const prox = proximoRelatorioConf(); if (!prox) return;
    S.cfProximo = { relId: prox.id, unidadeCod: S.conf.ctx.unidadeCod };
    S.conf = null; RENDER.conferencia(); window.scrollTo(0, 0);
    avisar(`Próximo relatório: ${prox.rel.cab.prestadorCod} - ${prox.rel.cab.prestadorNome}. Confira a unidade e o médico e execute a conferência.`, 'ok');
  };
  const aceitar = async proximo => {
    const r = rodadaDaConf(), chave = competenciaDaRodada(r);
    if (!exigirAberta(chave, 'registrar aceite')) return;
    const op = await exigirOperador(); if (!op) return;
    const pend = pendenciasDaRodada(r, indiceDecisoesComp(chave)).length, obs = ($('cfAceiteObs')?.value || '').trim();
    if (pend && !obs) { avisar('Com pendências abertas, informe uma observação para o aceite.', 'warn'); $('cfAceiteObs')?.focus(); return; }
    aceitarRodada(r, op, obs, pend); await guardarRodada(r);
    avisar(`Aceite registrado (${r.prestadorCod} - ${r.prestadorNome} · unidade ${r.unidadeCod}).`, 'ok');
    if (proximo) irProximo(); else desenharConferencia();
  };
  if ($('cfAceitar')) $('cfAceitar').onclick = () => aceitar(false);
  if ($('cfAceitarProx')) $('cfAceitarProx').onclick = () => aceitar(true);
  if ($('cfProximo')) $('cfProximo').onclick = irProximo;
  if ($('cfDesfazer')) $('cfDesfazer').onclick = async () => {
    const r = rodadaDaConf();
    if (!exigirAberta(competenciaDaRodada(r), 'desfazer o aceite')) return;
    const op = await exigirOperador(); if (!op) return;
    if (!await confirmar('Desfazer o aceite?', `O aceite de ${esc(r.aceite.por)} sai desta rodada e fica no histórico. O Fechamento volta a mostrar «Verificar» para este prestador e unidade, se não houver outra rodada aceita.`, 'Desfazer aceite')) return;
    desfazerAceiteRodada(r, op); await guardarRodada(r);
    avisar('Aceite desfeito.', 'ok'); desenharConferencia();
  };
}

// Trocar o relatório no seletor leva junto a unidade dele (da pasta ou do nome do arquivo), para não conferir na unidade do relatório anterior.
document.addEventListener('change', e => {
  if (e.target.id !== 'cfRel' && e.target.id !== 'coRel') return;
  const pre = e.target.id.slice(0, 2), x = S.relatorios.find(r => r.id === e.target.value), un = x ? (x.unidadePasta || unidadeSugeridaPeloArquivo(x.nome)) : '';
  const sel = $(pre + 'Un'); if (!sel || !un || ![...sel.options].some(o => o.value === un) || sel.value === un) return;
  sel.value = un; sel.dispatchEvent(new Event('change', { bubbles: true }));
  const dica = $(pre + 'UnDica'); if (dica) dica.textContent = x.unidadePasta ? 'Pela pasta da unidade: confirme.' : 'Sugerida pelo nome do arquivo: confirme.';
}, true);

// Filtros do seletor: redesenha a página com a lista filtrada.
document.addEventListener('change', e => {
  const m = /^(cf|co)F(Un|Gr)$/.exec(e.target.id || ''); if (!m) return;
  FILTRO_REL[m[1]][m[2] === 'Un' ? 'un' : 'gr'] = e.target.value;
  if (m[1] === 'cf') RENDER.conferencia(); else RENDER.correcao();
});
// Conferir em lote os relatórios filtrados: cada um na unidade dele, com o médico do cadastro (ou todos da unidade).
document.addEventListener('click', async e => {
  if (!e.target.closest('[data-cflote]')) return;
  const F = FILTRO_REL.cf, rels = relatoriosPara('cf').filter(x => (F.un === '*' || unDoRel(x) === F.un) && (F.gr === '*' || grDoRel(x) === F.gr));
  const semUn = rels.filter(x => !unDoRel(x)), ok = rels.filter(x => unDoRel(x));
  if (!S.apolo) return avisar('Carregue a planilha de laudos no Início.', 'warn');
  const op = await exigirOperador(); if (!op) return;
  if (!await confirmar(`Conferir ${ok.length} relatório(s)?`, `Cada relatório é conferido na unidade da pasta dele, com a tolerância ${esc($('cfTol')?.value || S.cfg.parametros.tolConferencia)} dia(s) e o médico do cadastro (ou todos os médicos da unidade, quando o prestador não tem vínculo nela). Cada um vira uma rodada.${semUn.length ? `<br><b>${semUn.length} sem unidade</b> ficam de fora: escolha a unidade de cada um.` : ''}`, 'Conferir')) return;
  const tol = +($('cfTol')?.value ?? S.cfg.parametros.tolConferencia); let n = 0;
  for (const x of ok) {
    const un = unDoRel(x), ligados = medicosDoPrestador(S.cfg, x.rel.cab.prestadorCod);
    const presente = laudosDaUnidade(S.apolo, S.cfg, un).some(l => ligados.includes(l.mn));
    avisar(`Conferindo ${++n} de ${ok.length}: ${x.rel.cab.prestadorCod} - ${x.rel.cab.prestadorNome} (unidade ${un})…`, 'info');
    await rodarConferencia(x, un, tol, presente ? '@prest' : '*');
    await new Promise(r => setTimeout(r, 0));
  }
  S.rodadas = await dbTodas();
  avisar(`${ok.length} conferência(s) rodadas${semUn.length ? `; ${semUn.length} sem unidade ficaram de fora` : ''}. Acompanhe em «Prestadores por unidade» e dê o aceite em cada uma.`, 'ok');
  RENDER.conferencia();
});
