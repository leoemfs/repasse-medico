/* ============================================================
 * Conferência cruzada MV × Apolo
 * ============================================================ */
const NIVEL_NOME = ['', 'semelhante', 'truncado', 'idêntico'];
const FAIXA = { 1: 'validada · mesma data', 2: 'validada · data na tolerância', 3: 'não validada · mesma data', 4: 'não validada · data na tolerância', 5: 'nome semelhante', 6: 'sem equivalência · mesma data' };

// Finalidade do PDF: o do prestador genérico vai para a Correção; os demais, para a Conferência.
const finalidadePadrao = rel => String(rel.cab.prestadorCod) === String(S.cfg.parametros.prestadorGenerico || '2') ? 'correcao' : 'conferencia';
const relatoriosPara = prefixo => S.relatorios.filter(x => (x.finalidade || finalidadePadrao(x.rel)) === (prefixo === 'co' ? 'correcao' : 'conferencia'));
/* Pedido de 17/11/2026: cada aba sincroniza só a pasta dela, sem reler tudo — Conferência lê «Relatórios para conferência»;
 * Correção de prestador lê «Correção de prestador». Só aparece com a pasta raiz conectada. */
function botaoSyncPasta(prefixo) {
  if (!pastaConectadaConf()) return '';
  const so = prefixo === 'co' ? 'correcao' : 'conferencia', nome = so === 'correcao' ? PASTA_CORR.nome : PASTA_REL.nome;
  return `<button class="sec" data-syncpasta="${so}" title="Lê só «${esc(nome)}» da competência ${esc(rotuloCompetencia(S.comp))}: PDFs novos ou que mudaram">Sincronizar pasta</button>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-syncpasta]'); if (!b) return;
  const so = b.dataset.syncpasta;
  comProcessando(b, async () => { await atualizarDaPasta({ so }); (so === 'correcao' ? RENDER.correcao : RENDER.conferencia)(); }, 'a leitura da pasta');
});
function semRelatorioPara(prefixo) {
  const outro = prefixo === 'co' ? 'Conferência' : 'Correção de prestador';
  return `<div class="card"><h2>Nenhum relatório para ${prefixo === 'co' ? 'a correção de prestador' : 'a conferência'}</h2><p class="lead">${S.relatorios.length} PDF(s) carregado(s), todos marcados para ${outro}. ${prefixo === 'co' ? `O relatório do prestador genérico (código ${esc(S.cfg.parametros.prestadorGenerico || '2')}) entra aqui automaticamente.` : ''} Para mudar, use a coluna «Finalidade» na lista de relatórios do Início.</p><div class="acoes"><button onclick="location.hash='inicio'">Ir para o Início</button></div>${botaoSyncPasta(prefixo) ? `<div class="acoes">${botaoSyncPasta(prefixo)}</div>` : ''}</div>`;
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
    <div class="campo"><span class="small muted">${rels.length} de ${todos.length} relatório(s)</span>${prefixo === 'cf' && rels.length > 1 && (F.un !== '*' || F.gr !== '*') ? `<button type="button" class="sec mini" data-cflote>Conferir os ${rels.length} relatórios filtrados</button>` : ''}${prefixo === 'cf' && rels.length && F.un !== '*' && F.gr !== '*' ? `<button type="button" class="sec mini" data-cfunica title="Todos os prestadores desta unidade e grupo num Excel só, gravado em ${esc(PASTA_PLAN_CONF.nome)}">Excel único: ${esc(rotGr(F.gr))} · unidade ${esc(F.un)} (${rels.length})</button>` : ''}</div></div>` : '';
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
    <div id="${prefixo}Extra"></div></div>${prefixo === 'cf' ? '<div class="rot-rel" id="cfRotRels"></div>' : ''}`;
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

// Subaba «Prestadores por unidade» e as abas do topo (22-prestadores-unidade.js) entram aqui, explicitamente (P2).
RENDER.conferencia = () => { if (CU.sub === 'unidades') return desenharControleUnidade(); desenharPaginaConferencia(); complementoConferenciaUnidades(); };
function desenharPaginaConferencia() {
  const p = $('pag-conferencia');
  if (!S.relatorios.length || !S.apolo) { p.innerHTML = faltamArquivos('cf'); return; }
  if (!relatoriosPara('cf').length) { p.innerHTML = semRelatorioPara('cf'); return; }
  p.innerHTML = `${cartaoAvisoProducao()}<div class="card cf-param"><h2>O que conferir</h2>${seletoresAnalise('cf', S.cfg.parametros.tolConferencia)}
    <div class="acoes"><button id="cfRodar">${S.conf && S.conf.ctx.chaveCompetencia === S.comp ? 'Conferir' : 'Executar conferência'}</button>${botaoSyncPasta('cf')}<span class="muted small" title="Cada execução vira uma rodada registrada, com versões das bases e parâmetros. O histórico fica na aba «Histórico e detalhes».">A unidade dos laudos vem do relatório (pasta ou nome do arquivo); o médico do laudo, do cadastro do prestador.</span></div></div>
    <div id="cfRoteiro"></div>
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
  const relRot = $('cfRel'); if (relRot) { const f = relRot.onchange; relRot.onchange = e => { f(e); desenharRoteiroConf(); }; const fu = $('cfUn').onchange; $('cfUn').onchange = e => { fu(e); desenharRoteiroConf(); }; }
  desenharRoteiroConf();
  $('cfRodar').onclick = () => comProcessando($('cfRodar'), executarConferencia, 'a conferência');
  if (S.conf && S.conf.ctx.chaveCompetencia === S.comp) desenharConferencia();
};
function faltamArquivos(prefixo = 'cf') {
  return `<div class="card"><h2>Faltam arquivos</h2><p class="lead">Carregue ${S.relatorios.length ? '' : 'o relatório do MV (PDF)'}${!S.relatorios.length && !S.apolo ? ' e ' : ''}${S.apolo ? '' : 'a planilha de laudos do Apolo'} no Início.</p><div class="acoes"><button onclick="location.hash='inicio'">Ir para o Início</button>${botaoSyncPasta(prefixo)}</div></div>`;
}

async function executarConferencia() {
  const x = relSelecionado('cf'), un = $('cfUn').value, tol = +$('cfTol').value, medSel = $('cfMed').value;
  if (!un) return avisar('Escolha a unidade dos laudos: o PDF não informa a unidade.', 'warn');
  if (!(tol >= 0)) return avisar('Tolerância inválida.', 'warn');
  if (!exigirAberta(S.comp, 'executar uma conferência')) return;
  const mesmo = S.conf && S.conf.ctx?.relId === x.id && S.conf.ctx?.unidadeCod === un, y = window.scrollY;
  const { res, rodada } = await rodarConferencia(x, un, tol, medSel);
  desenharConferencia();
  if (mesmo) window.scrollTo(window.scrollX, y);   // continua no mesmo ponto da tela
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
  // Mesmo relatório e unidade (ex.: rodou de novo depois de validar uma equivalência em «O que falta decidir»): fica na
  // mesma subaba, em vez de voltar para a Prévia (pedido de 24/11/2026).
  const antes = S.conf && S.conf.ctx?.relId === x.id && S.conf.ctx?.unidadeCod === un ? S.conf : null;
  S.conf = { res, ctx, rodada, comparacao: ant ? { ant, grupos: compararRodadas(ant, rodada) } : null, filtroStatus: new Set(), filtroMarc: new Set(), busca: '',
    ...(antes ? { aba: antes.aba, umaMais: antes.umaMais, soFalta: antes.soFalta } : {}) };
  ctx.fonteNC = `conf|${x.id}|${un}`;
  // Conciliação com o Power BI (SOL-F9): explica os «Só no laudo» e sugere natureza e responsável.
  let cands = candidatosDaConferencia(res, ctx, S.cfg);
  if (S.pbi) {
    const opcPBI = { unidadeCod: un, tol, prestadorCod: x.rel.cab.prestadorCod, cfg: S.cfg, idxEq: indiceEquivalencias(S.eq), idxPrest: indicePrestadores(S.cfg) };
    for (const l of res.linhas) if (l.status === 'so-laudo' && l.l) { const c = conciliarLaudo(S.pbi, l.l, opcPBI); if (c) { l.pbi = c; l.motivos.push(c.texto); } }
    ctx.pbiResumo = enriquecerCandidatosComPBI(cands, S.pbi, opcPBI); ctx.pbiNome = S.pbi.nome;
  }
  // P1: com todos os médicos no escopo, os candidatos «Só no laudo» ficam só os do prestador (quando há cadastro dele na unidade).
  let fora = 0;
  if (!medicos) { const ligados = medicosDoPrestador(S.cfg, x.rel.cab.prestadorCod); if (ligados.length && laudosDaUnidade(S.apolo, S.cfg, un).some(l => ligados.includes(l.mn))) { const e = escopoCandidatosNC(cands, ligados); cands = e.dentro; fora = e.fora.length; } }
  guardarCandidatosNC(ctx.fonteNC, `Conferência ${x.rel.cab.prestadorCod} - ${x.rel.cab.prestadorNome} · ${unidade}`, `Conf. ${x.rel.cab.prestadorCod} · un. ${un}`, cands, fora);
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

/* SOL-F43 — A prévia de conferência é a conferência oficial: o que entra no fechamento é Devido + Aceito.
 * Resultado em abas (Prévia · O que falta decidir · NCs e correções no MV · Aceite do relatório · Detalhes e equivalências),
 * para não rolar uma página longa. A aba escolhida fica na sessão. */
const ABAS_CONF = [['previa', 'Prévia de conferência'], ['decidir', 'O que falta decidir'], ['nc', 'NCs e correções no MV'], ['aceite', 'Aceite do relatório'], ['detalhes', 'Histórico e detalhes']];
const pillClasse = k => k ? `<span class="st cl-${k}" title="${esc(CLASSES_FECH[k].def)}">${esc(CLASSES_FECH[k].nome)}</span>` : '<span class="small muted">sem valor</span>';
function irAbaConf(k) { if (!S.conf) return; S.conf.aba = k; desenharConferencia(); $('cfAbas')?.scrollIntoView({ block: 'start' }); }
function desenharConferencia() {
  const { res, ctx, comparacao } = S.conf, c = $('cfRes'); if (!c) return;
  aplicarDecisoes(res, indiceDecisoesComp(ctx.chaveCompetencia));
  const aba = S.conf.aba || 'previa', chave = ctx.chaveCompetencia || S.comp, idxObs = indiceObservacoes(estadoCompetencia(S.compReg, chave).observacoes);
  const CZ = causasDaConferencia(res, S.eq.compostas || []), T = totaisPorClasse(res.linhas, classeDaLinhaConf);
  const corr = situacaoCorrecoesMV(res, ctx, S.nc.itens.filter(x => x.competencia === chave), estadoCompetencia(S.compReg, chave).decisoes, S.rodadas);
  const alertas = corr.ncs.filter(x => x.situacao === 'continua').length + corr.hm.filter(x => x.continua).length + corr.resolvidos.filter(x => x.situacao === 'continua').length;
  const ehSL = g => g.tipo === 'so-laudo' || g.tipo.startsWith('sl-'), nLote = CZ.grupos.filter(g => !ehSL(g)).reduce((t, g) => t + g.linhas.length, 0);
  const barra = T.total ? ORDEM_CLASSES.map(k => `<span class="cl-${k}" style="width:${T[k].valor / T.total * 100}%" title="${esc(CLASSES_FECH[k].nome)}: R$ ${fmtBR(T[k].valor)}"></span>`).join('') : '';
  const ordem = Object.keys(STATUS_CONF).sort((a, b) => STATUS_CONF[a].ordem - STATUS_CONF[b].ordem);
  const comV = res.linhas.filter(x => x.r), opc = (f, rot) => [...new Map(comV.map(x => [f(x), rot(x)])).entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  // SOL-F41 (v3.0.0-alpha.13): dias de todas as linhas (MV e «Só no laudo»), título e médico do laudo, observação com/sem.
  const diasF = [...new Map(res.linhas.map(x => x.r?.data || x.l?.data).filter(Boolean).map(d => [isoDia(d), fmtData(d)])).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const opcL = f => [...contar(res.linhas.filter(x => x.l && f(x.l)), x => f(x.l))].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const tile = k => `<button class="tot-cl${S.conf.filtroClasse === k ? ' sel' : ''}" data-cl="${k}" title="${esc(CLASSES_FECH[k].def)} · ${CLASSES_FECH[k].entra ? 'entra no fechamento' : 'fora do fechamento'} · clique para filtrar"><span class="faixa cl-${k}"></span><small>${esc(CLASSES_FECH[k].nome)}</small><b>R$ ${fmtBR(T[k].valor)}</b><small>${T[k].n} linha(s)${k === 'pend' && T[k].n ? ' · fora até decidir' : ''}</small></button>`;
  // v3.0.0-alpha.20 (simplificação): filtros ativos viram etiquetas; os 8 filtros ficam na gaveta «Filtros».
  const fAtivos = [['fProc', 'Procedimento'], ['fData', 'Data'], ['fDataAte', 'até'], ['fConv', 'Convênio'], ['fTit', 'Título'], ['fMed', 'Médico']].filter(([k]) => S.conf[k] && S.conf[k] !== '*');
  const nFiltros = fAtivos.length + (fObsAtual() ? 1 : 0);
  if (nFiltros) S.conf.verFiltros = true;
  const rotData = v => fmtData(new Date(v + 'T12:00:00'));
  const etiquetas = [...fAtivos.map(([k, t]) => `<button type="button" class="cf-etq" data-tirar="${k}" title="Tirar este filtro">${t}: ${esc(k.startsWith('fData') ? rotData(S.conf[k]) : S.conf[k])} ✕</button>`), ...(fObsAtual() ? [`<button type="button" class="cf-etq" data-tirar="fObs">${fObsAtual() === 'com' ? 'Com' : 'Sem'} observação ✕</button>`] : []), ...(S.conf.filtroClasse ? [`<button type="button" class="cf-etq" data-tirar="filtroClasse">Classe: ${esc(CLASSES_FECH[S.conf.filtroClasse].nome)} ✕</button>`] : [])].join('');
  const secao = (k, html) => `<section class="cf-sec" data-cfsec="${k}"${aba === k ? '' : ' hidden'} role="tabpanel" aria-labelledby="cfAba-${k}">${html}</section>`;
  c.innerHTML = `<div class="card cf-frase"><div class="cf-res-topo"><div class="cf-res-tit"><h2>${esc(ctx.relatorio.cab.prestadorCod)} - ${esc(ctx.relatorio.cab.prestadorNome)} · ${esc(ctx.unidadeNome)} <span class="muted small">rodada ${esc(ctx.rodadaId)}</span></h2>
      <div class="tot-cl pagar"><small>PARA PAGAMENTO (Devido + Aceito)</small><b>R$ ${fmtBR(T.pagar)}</b><small>de R$ ${fmtBR(T.total)} no relatório do MV</small></div></div>
      <div class="cf-cls">${ORDEM_CLASSES.map(tile).join('')}</div></div>
    <div class="cf-barra cf-barra-cl">${barra}</div>
    <p class="small" style="margin:6px 0">${CZ.conferidas} de ${CZ.totalMV} linhas do MV conferidas${CZ.ressalvasDecididas ? ' (contando as já decididas)' : ''} · ${CZ.totalMV ? Math.round(CZ.conferidas / CZ.totalMV * 100) : 0}%. ${CZ.faltam ? `Faltam <b>${CZ.faltam} decisão(ões)</b>${nLote ? `: ${CZ.grupos.filter(g => !ehSL(g)).length} resolvem ${nLote} linha(s) de uma vez` : ''}.` : 'Nada falta decidir: é só registrar o aceite.'}${alertas ? ` <b style="color:var(--err)">${alertas} item(ns) que deviam ter saído do MV continuam no relatório.</b>` : ''} <span class="muted">Clique numa classe para filtrar.</span></p>
    <div class="acoes">${CZ.faltam ? '<button id="cfIrCausas">Começar pelas decisões</button>' : '<button id="cfIrAceite">Ir para o aceite</button>'}<button class="sec" id="cfVerTodas">Ver todas as linhas</button><button class="sec" id="cfExcel" data-cfexcel>Exportar Excel</button>${botaoReconferir(ctx)}</div>
    ${ctx.pbiResumo ? `<div class="pbi-resumo" id="cfPBI"><b>Power BI</b> <span class="small muted">(${esc(ctx.pbiNome || '')})</span> — laudos «Só no laudo»: ${Object.entries(ctx.pbiResumo).filter(([, n]) => n).map(([k, n]) => `<span class="marc">${esc(SITUACAO_PBI[k].nome)} · ${n}</span>`).join(' ') || '<span class="small muted">nenhum</span>'}<p class="small muted" style="margin:4px 0 0">A natureza e o responsável (quem fechou a conta) já vêm sugeridos nos candidatos a NC; abra a linha para ver a conta e o atendimento.</p></div>` : ''}
    ${ehUnidadeV3(S.cfg, ctx.unidadeCod) ? cartaoAvisosV3(avisosConferenciaV3(res)) : ''}</div>
    <nav class="cf-abas" id="cfAbas" role="tablist" aria-label="Áreas da conferência">${ABAS_CONF.map(([k, t]) => { const n = k === 'decidir' ? CZ.faltam : k === 'nc' ? alertas : 0; return `<button role="tab" id="cfAba-${k}" data-cfaba="${k}" aria-selected="${aba === k}" class="${aba === k ? 'on' : ''}">${t}${n ? `<span class="n${k === 'nc' ? ' alerta' : ''}">${n}</span>` : ''}</button>`; }).join('')}</nav>
    ${secao('previa', `<div class="card"><h2 class="sr-only">Linhas do relatório</h2>
      <div class="cf-rapido"><input type="search" id="cfBusca" aria-label="Buscar" placeholder="Buscar paciente, código, título ou médico…" value="${esc(S.conf.busca)}">
        <label class="small cf-sofalta"><input type="checkbox" id="cfSoFalta"${S.conf.soFalta !== false ? ' checked' : ''}> só o que falta decidir</label>
        <label class="small cf-ordem" for="cfOrdem">Ordenar por <select id="cfOrdem">${opcoes(Object.entries(ORDENS_CONF), ordemConf().k)}</select></label>
        <div class="marcadores" style="margin:0">${ordem.filter(k => res.porStatus[k].n).map(k => `<button class="marc st-chip${S.conf.filtroStatus.has(k) ? ' sel' : ''}" data-st="${k}" title="Situação: ${esc(STATUS_CONF[k].nome)}${res.porStatus[k].vlRepasse ? ` · R$ ${fmtBR(res.porStatus[k].vlRepasse)}` : ''}">${esc(STATUS_CONF[k].nome)} · ${res.porStatus[k].n}</button>`).join('')}${Object.entries(res.porDecisao || {}).filter(([, n]) => n).map(([k, n]) => `<button class="marc dec-${k}${S.conf.filtroMarc.has('dec-' + k) ? ' sel' : ''}" data-m="dec-${k}">${esc(TIPOS_DECISAO[k])} · ${n}</button>`).join('')}${Object.entries(res.porMarcador).filter(([, n]) => n).map(([k, n]) => `<button class="marc${S.conf.filtroMarc.has(k) ? ' sel' : ''}" data-m="${k}">${esc(MARCADORES[k])} · ${n}</button>`).join('')}</div>
        <span class="sy-esp"></span><button type="button" class="sec mini" id="cfFiltrosBt" aria-expanded="${!!S.conf.verFiltros}" aria-controls="cfGaveta">Filtros${nFiltros ? ` (${nFiltros})` : ''}</button></div>
      ${etiquetas ? `<div class="cf-etqs">${etiquetas}</div>` : ''}
      <div class="cf-filtros cf-gaveta" id="cfGaveta"${S.conf.verFiltros ? '' : ' hidden'}>
        <label class="campo">Procedimento<select id="cfFProc"><option value="*">Todos</option>${opc(x => x.r.codigo, x => `${x.r.codigo} · ${x.r.procDesc}`).map(([v, t]) => `<option value="${esc(v)}"${S.conf.fProc === v ? ' selected' : ''}>${esc(t)} (${comV.filter(x => x.r.codigo === v).length})</option>`).join('')}</select></label>
        <label class="campo">Data${S.conf.fDataAte && S.conf.fDataAte !== '*' ? ' (de)' : ''}<select id="cfFData"><option value="*">${S.conf.fDataAte && S.conf.fDataAte !== '*' ? 'Desde o início' : 'Todas'}</option>${diasF.map(([v, t]) => `<option value="${esc(v)}"${S.conf.fData === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="campo">até<select id="cfFDataAte" aria-label="Data até"><option value="*">—</option>${diasF.map(([v, t]) => `<option value="${esc(v)}"${S.conf.fDataAte === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="campo">Convênio<select id="cfFConv"><option value="*">Todos</option>${opc(x => x.r.convenio, x => x.r.convenio).map(([v, t]) => `<option value="${esc(v)}"${S.conf.fConv === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="campo">Título do laudo<select id="cfFTit"><option value="*">Todos</option>${opcL(l => l.titulo).map(([v, n]) => `<option value="${esc(v)}"${S.conf.fTit === v ? ' selected' : ''}>${esc(v)} (${n})</option>`).join('')}</select></label>
        <label class="campo">Médico do laudo<select id="cfFMed"><option value="*">Todos</option>${opcL(l => l.medico).map(([v, n]) => `<option value="${esc(v)}"${S.conf.fMed === v ? ' selected' : ''}>${esc(v)} (${n})</option>`).join('')}</select></label>
        <label class="campo">Observação<select id="cfFObs">${opcoes([['', 'Todas'], ['com', 'Com observação'], ['sem', 'Sem observação']], fObsAtual())}</select></label></div>
      <div class="cf-selinfo small" id="cfSelInfo"></div>
      ${S.conf.filtroLinhas ? `<div class="cf-fl small"><b>Mostrando as ${S.conf.filtroLinhas.idx.length} linha(s) de:</b> ${esc(S.conf.filtroLinhas.titulo)} <button class="sec mini" id="cfFlLimpar">Mostrar todas</button></div>` : ''}
      <div id="cfTab" style="margin-top:10px"></div></div>`)}
    ${secao('decidir', CZ.faltam ? cartaoCausas(CZ, res) : '<div class="card"><h2>O que falta decidir</h2><p class="muted">Nada falta decidir neste relatório.</p></div>')}
    ${secao('nc', cartaoCorrecoesMV(corr) + (ctx.fonteNC ? cartaoCandidatosNC(ctx.fonteNC) : ''))}
    ${secao('aceite', `<div class="card cf-aceite-card">${quadroAceite()}</div>`)}
    ${secao('detalhes', `${cartaoHistoricoRelatorio(ctx)}<div class="card"><h2>Detalhes da rodada</h2>
      <dl class="kv"><dt>Relatório</dt><dd>${esc(ctx.relatorio.cab.prestadorCod)} - ${esc(ctx.relatorio.cab.prestadorNome)} · repasse ${esc(textoRepasses(ctx.relatorio.cab))}</dd>
      <dt>Unidade</dt><dd>${esc(ctx.unidadeNome)}</dd><dt>Médico(s) no escopo</dt><dd>${esc(ctx.medicosNomes || 'Todos os médicos')}</dd>
      <dt>Período de produção</dt><dd>${res.periodo ? `${fmtData(res.periodo[0])} a ${fmtData(res.periodo[1])}` : '—'} · modalidades ${esc(res.modalidades.join(', ') || '—')}</dd>
      <dt>Volume</dt><dd>${res.nMV} linhas do MV (${res.nProcedimentos} procedimentos) · ${res.nLaudosEscopo} laudos no escopo · ${res.nPares} pares</dd>
      <dt>Equivalências</dt><dd>${res.eqValidadas} validadas (revisão ${res.eqRevisao})${res.eqValidadas ? '' : ' — <span style="color:var(--warn)">nenhuma validada: nada pode ser confirmado</span>'}</dd></dl>
      ${comparacao ? resumoComparacao(comparacao) : ''}</div>
      <div class="card"><h2>Equivalências desta rodada</h2><div id="cfEq"></div></div>`)}`;
  ligarCartaoCandidatosNC(c);
  c.querySelectorAll('[data-cfaba]').forEach(b => b.onclick = () => irAbaConf(b.dataset.cfaba));
  c.querySelectorAll('[data-cl]').forEach(b => b.onclick = () => { S.conf.filtroClasse = S.conf.filtroClasse === b.dataset.cl ? null : b.dataset.cl; if (S.conf.filtroClasse) S.conf.soFalta = false; desenharConferencia(); });
  c.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { const s = S.conf.filtroStatus; s.has(b.dataset.st) ? s.delete(b.dataset.st) : s.add(b.dataset.st); desenharConferencia(); });
  c.querySelectorAll('[data-tirar]').forEach(b => b.onclick = () => { const k = b.dataset.tirar; S.conf[k] = k === 'fObs' ? '' : k === 'filtroClasse' ? null : '*'; desenharConferencia(); });
  $('cfFiltrosBt').onclick = () => { S.conf.verFiltros = !S.conf.verFiltros; $('cfGaveta').hidden = !S.conf.verFiltros; $('cfFiltrosBt').setAttribute('aria-expanded', String(S.conf.verFiltros)); };
  c.querySelectorAll('[data-m-v3]').forEach(b => b.onclick = () => { S.conf.filtroMarc = new Set([b.dataset.mV3]); S.conf.soFalta = false; S.conf.aba = 'previa'; desenharConferencia(); $('cfTab')?.scrollIntoView({ block: 'start' }); });
  c.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const s = S.conf.filtroMarc; s.has(b.dataset.m) ? s.delete(b.dataset.m) : s.add(b.dataset.m); desenharConferencia(); });
  // Os dois botões de Excel (topo e tabela) exportam tudo; «só o filtrado» fica na faixa do filtro. Com «Processando…» (P1).
  c.querySelectorAll('[data-cfexcel]').forEach(bt => bt.onclick = () => exportarExcelConf(bt, res, ctx));
  ligarReconferir(c);
  if ($('cfIrCausas')) $('cfIrCausas').onclick = () => irAbaConf('decidir');
  if ($('cfIrAceite')) $('cfIrAceite').onclick = () => irAbaConf('aceite');
  $('cfVerTodas').onclick = () => { Object.assign(S.conf, { soFalta: false, filtroLinhas: null, filtroClasse: null, aba: 'previa' }); desenharConferencia(); $('cfTab')?.scrollIntoView({ block: 'start' }); };
  if ($('cfFlLimpar')) $('cfFlLimpar').onclick = () => { S.conf.filtroLinhas = null; desenharConferencia(); };
  ligarCausas(c, CZ, res, ctx);
  ligarQuadroAceite();
  // Um dia, ou de… até… (só «até»: desde o início).
  const naFaixaDeData = d => { const de = S.conf.fData && S.conf.fData !== '*' ? S.conf.fData : '', ate = S.conf.fDataAte && S.conf.fDataAte !== '*' ? S.conf.fDataAte : '';
    if (!de && !ate) return true; if (!ate) return d === de; return (!de || d >= de) && d <= ate; };
  const filtrarSemOrdem = () => {
    const q = norm(S.conf.busca);
    const fl = S.conf.filtroLinhas ? new Set(S.conf.filtroLinhas.idx) : null, soFalta = S.conf.soFalta !== false && !fl && !S.conf.filtroStatus.size && !S.conf.filtroClasse;
    return res.linhas.filter((x, i) => (!fl || fl.has(i)) && (!soFalta || (x.r ? classeDaLinhaConf(x) === 'pend' && x.decisao?.tipo !== 'resolvido' : !x.decisao && x.status !== 'conferido'))
      && (!S.conf.filtroClasse || classeDaLinhaConf(x) === S.conf.filtroClasse)
      && (!S.conf.filtroStatus.size || S.conf.filtroStatus.has(x.status))
      && (!S.conf.filtroMarc.size || [...S.conf.filtroMarc].every(m => m.startsWith('dec-') ? x.decisao?.tipo === m.slice(4) : x.marcadores.has(m)))
      && (!S.conf.fProc || S.conf.fProc === '*' || x.r?.codigo === S.conf.fProc)
      && naFaixaDeData(isoDia(x.r?.data || x.l?.data))
      && (!S.conf.fConv || S.conf.fConv === '*' || (x.r?.convenio || '') === S.conf.fConv)
      && (!S.conf.fTit || S.conf.fTit === '*' || x.l?.titulo === S.conf.fTit)
      && (!S.conf.fMed || S.conf.fMed === '*' || x.l?.medico === S.conf.fMed)
      && (!fObsAtual() || (observacoesDaLinha(idxObs, x.r, x.l).length > 0) === (fObsAtual() === 'com'))
      && (!q || norm([x.r?.paciente, x.r?.codigo, x.r?.procDesc, x.l?.paciente, x.l?.titulo, x.l?.medico].join(' ')).includes(q)));
  };
  const filtrar = () => ordenarLinhasConf(filtrarSemOrdem(), ordemConf());   // v3.0.0-alpha.38: ordem escolhida (padrão: a do relatório)
  let grupos = new Map();
  const comGrupos = v => { grupos = ordemConf().k === 'pac' ? gruposPorPaciente(v) : new Map(); return v; };
  // Contagem e soma do filtro + ações em lote sobre as linhas pendentes visíveis.
  /* v3.0.0-alpha.20 (simplificação): as ações em lote só aparecem quando há linhas marcadas ou um filtro escolhido.
   * Com linhas marcadas, valem para as marcadas; sem marcação, para as do filtro (como antes). */
  S.conf.sel = S.conf.sel || new Set();
  const filtroAtivo = () => !!(S.conf.busca || S.conf.filtroStatus.size || S.conf.filtroMarc.size || S.conf.filtroClasse || S.conf.filtroLinhas || nFiltros);
  const infoSel = vis => {
    const el = $('cfSelInfo'); if (!el) return;
    const visSet = new Set(vis.map(x => res.linhas.indexOf(x)));
    for (const i of [...S.conf.sel]) if (!visSet.has(i)) S.conf.sel.delete(i);
    const marcadas = S.conf.sel.size ? vis.filter(x => S.conf.sel.has(res.linhas.indexOf(x))) : null, alvo = marcadas || vis;
    const pend = alvo.filter(x => x.r && classeDaLinhaConf(x) === 'pend' && !x.decisao);
    const slVis = alvo.filter(x => x.l && !x.r && x.status === 'so-laudo' && !x.decisao);   // SOL-F41: dispensar em lote
    const lote = !!marcadas || filtroAtivo();
    el.classList.toggle('cf-selbar', !!marcadas);
    el.innerHTML = `<b>${marcadas ? `${marcadas.length} marcada(s)` : `${vis.length} linha(s)${filtroAtivo() ? ' no filtro' : ''}`} · R$ ${fmtBR(alvo.reduce((s, x) => s + (x.r?.vlRepasse || 0), 0))}</b>${S.conf.filtroClasse ? ` · ${esc(CLASSES_FECH[S.conf.filtroClasse].nome)}` : ''}${marcadas ? ' <button class="sec mini" id="cfDesmarcar">Desmarcar</button>' : ''}<span class="sy-esp"></span>
      ${lote ? `<button class="mini" id="cfLoteAceitar"${pend.length ? '' : ' disabled'}>Aceitar para pagamento as ${pend.length} pendente(s)…</button><button class="sec mini" id="cfLoteNC"${pend.length ? '' : ' disabled'}>Registrar NC das ${pend.length} pendente(s)…</button>${slVis.length ? `<button class="sec mini" id="cfLoteDisp">Dispensar os ${slVis.length} laudo(s) «Só no laudo»…</button>` : ''}<button class="sec mini" id="cfLoteObs"${alvo.length ? '' : ' disabled'}>Observação nas ${alvo.length} linha(s)…</button>` : '<span class="muted">Marque linhas (ou filtre) para decidir em lote.</span>'}
      ${filtroAtivo() ? '<button class="sec mini" id="cfLimpar">Limpar filtros</button>' : ''}${alvo.length < res.linhas.length ? `<button class="sec mini" id="cfExcelFiltro">Exportar só ${marcadas ? 'as marcadas' : 'o filtrado'} (${alvo.length})</button>` : ''}`;
    if ($('cfDesmarcar')) $('cfDesmarcar').onclick = () => { S.conf.sel.clear(); refiltrar(); };
    if ($('cfExcelFiltro')) $('cfExcelFiltro').onclick = () => exportarExcelConf($('cfExcelFiltro'), resultadoFiltrado(res, alvo), { ...ctx, filtroTexto: marcadas ? `${alvo.length} linha(s) marcada(s)` : textoFiltroConf(vis) });
    if ($('cfLimpar')) $('cfLimpar').onclick = () => { S.conf.filtroStatus.clear(); S.conf.filtroMarc.clear(); S.conf.sel.clear(); Object.assign(S.conf, { busca: '', filtroLinhas: null, filtroClasse: null, fProc: '*', fData: '*', fDataAte: '*', fConv: '*', fTit: '*', fMed: '*', fObs: '' }); desenharConferencia(); };
    if (!lote) return;
    const fim = () => { S.conf.sel.clear(); aplicarDecisoes(res, indiceDecisoesComp()); desenharConferencia(); };
    $('cfLoteAceitar').onclick = async () => { if (await considerarLinhas(res, pend.map(x => res.linhas.indexOf(x)), `${pend.length} linha(s) pendente(s) ${marcadas ? 'marcada(s)' : 'do filtro'} · R$ ${fmtBR(pend.reduce((s, x) => s + x.r.vlRepasse, 0))}`, '')) fim(); };
    $('cfLoteNC').onclick = async () => { if (await abrirRegistroNC(pend.map(x => candidatoComObservacao(x, ctx)))) fim(); };
    if ($('cfLoteDisp')) $('cfLoteDisp').onclick = async () => { if (await dispensarLaudos(res, slVis.map(x => res.linhas.indexOf(x)))) fim(); };
    $('cfLoteObs').onclick = async () => { if (await observacaoEmLote(alvo)) { S.conf.sel.clear(); desenharConferencia(); } };
  };
  const t = tabela($('cfTab'), {
    linhas: comGrupos(filtrar()), colunas: [
      { t: '', th: ls => { const n = ls.filter(x => S.conf.sel.has(res.linhas.indexOf(x))).length;
        return `<input type="checkbox" class="cf-sel" data-seltodos aria-label="Selecionar todas as linhas do filtro" title="Selecionar todas as linhas do filtro"${ls.length && n === ls.length ? ' checked' : ''}>`; },
        html: x => { const i = res.linhas.indexOf(x); return `<input type="checkbox" class="cf-sel" data-sel="${i}" aria-label="Marcar a linha"${S.conf.sel.has(i) ? ' checked' : ''}>`; } },
      { t: 'Classe · situação', html: x => `${pillClasse(classeDaLinhaConf(x))}<div class="cf-sit">${chipStatus(x.status, STATUS_CONF[x.status].nome)}${chipDecisao(x.decisao)}${observacoesDaLinha(idxObs, x.r, x.l).length ? ' <span class="obs-i" title="tem observação">✎</span>' : ''}</div>` },
      { t: 'Paciente', th: () => thOrdem('pac', 'Paciente'), html: x => { const nome = x.r?.paciente || x.l?.paciente || '', g = grupos.get(x); return `<span class="pac">${esc(nome)}${nome ? `<button type="button" class="cp-nome" data-copiar="${esc(nome)}" title="Copiar o nome" aria-label="Copiar o nome">${ICONE_COPIAR}</button>` : ''}</span>${g?.inicio && g.n > 1 ? `<span class="grp-tag">${g.n} linhas</span>` : ''}`; } }, { t: 'Data', th: () => thOrdem('data', 'Data'), v: x => fmtData(x.r?.data || x.l?.data) },
      { t: 'Procedimento no MV', th: () => thOrdem('proc', 'Procedimento no MV'), v: x => x.r ? `${x.r.codigo} · ${x.r.procDesc || ''}` : '—' }, { t: 'Laudo (Apolo)', th: () => thOrdem('laudo', 'Laudo (Apolo)'), v: x => x.l?.titulo || '—' },
      { t: 'O que falta / por quê', v: x => x.decisao ? `${TIPOS_DECISAO[x.decisao.tipo] || ''}${x.decisao.justificativa ? ': ' + x.decisao.justificativa : ''}` : classeDaLinhaConf(x) === 'excluido' ? (x.tipo === 'hm' ? 'HM a excluir do MV: não compõe repasse (fora da V3 nenhum HM é pago)' : `${TIPOS_ITEM[x.tipo] || x.tipo}: não compõe repasse`) : x.status === 'conferido' || x.status === 'nao-procedimental' ? '' : (CZ.porLinha.get(res.linhas.indexOf(x)) || x.motivos[0] || '') },
      { t: 'Vl Repasse', n: true, th: () => thOrdem('vl', 'Vl Repasse'), v: x => x.r ? fmtBR(x.r.vlRepasse) : '' }
    ],
    classeLinha: x => { const g = grupos.get(x); return g ? `${g.banda ? 'grp-b' : ''}${g.inicio ? ' grp-ini' : ''}` : ''; },
    detalhe: x => { const k = classeDaLinhaConf(x), obs = observacoesDaLinha(idxObs, x.r, x.l), i = res.linhas.indexOf(x);
      return `${comparacaoMVLaudo(x, ctx)}<div class="acoes" style="margin:0 0 8px">${botoesDecisao(x, i)}</div>${k === 'pend' && !x.decisao ? '<p class="small muted" style="margin:-4px 0 8px">Depois de decidir, a próxima linha que falta decidir abre sozinha.</p>' : ''}<p class="small" style="margin:0 0 6px">${k ? `${pillClasse(k)} ${esc(CLASSES_FECH[k].def)}. ` : ''}<span class="muted">Linha ${x.r ? x.r.seq : '—'} · origem ${esc(x.origem)} · médico do laudo ${esc(x.l?.medico || '—')}${x.marcadores.size ? ` · ${esc([...x.marcadores].map(m => MARCADORES[m]).join(' · '))}` : ''}</span></p><div class="det"><div><h4>Motivo / evidências</h4><ul>${x.motivos.map(m => `<li>${atendimentosCopiaveis(esc(m))}</li>`).join('')}</ul>
      ${x.r ? `<h4 style="margin-top:8px">Linha do MV</h4><div class="small">${esc(x.r.codigo)} - ${esc(x.r.procDesc)} · conta ${esc(x.r.conta)} · atendimento ${copiavel(x.r.atendimento)} · ${esc(x.r.convenio)} · página ${x.r.pagina}${x.r.repasse ? ` · repasse ${esc(x.r.repasse)}` : ''}${x.r.repeticao ? ` · repetida ${x.r.repeticao.i}/${x.r.repeticao.n}` : ''}</div>` : ''}
      ${x.l ? `<h4 style="margin-top:8px">Laudo</h4><div class="small">ID Apolo ${copiavel(x.l.idLaudo)} · ${esc(x.l.titulo)} · ${esc(x.l.descricao)} · ${esc(x.l.unidade)} · ${esc(x.l.modalidade)} · ${esc(x.l.convenio)} · linha ${x.l.linhaPlanilha} da planilha</div>` : ''}
      <h4 style="margin-top:8px">Observação</h4><textarea class="cf-obs" data-obs="${i}" rows="2" placeholder="anotação sua sobre esta linha (não muda a classe; fica na competência)"></textarea><div class="acoes" style="margin-top:4px"><button class="sec mini" data-obs-salvar="${i}">Salvar observação</button></div>
      ${obs.length ? `<div class="small muted">${obs.map(o => `${new Date(o.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${esc(o.por || '—')}: «${esc(o.texto)}»`).join('<br>')}</div>` : ''}</div>
      <div><h4>Candidatos (paciente e data na tolerância)</h4>${x.cands.length ? `<ul>${x.cands.map((cd, j) => `<li>${cd.l === x.l ? '<strong>' : ''}«${esc(cd.l.titulo)}» · ${esc(cd.l.medico)} · ${fmtData(cd.l.data)} · nome ${NIVEL_NOME[cd.nm]} · ${esc(ROTULO_EQ[cd.proc.estado] || cd.proc.estado)} · faixa ${cd.tier} (${FAIXA[cd.tier]}) · título ${Math.round((cd.af || 0) * 100)}%${cd.l === x.l ? '</strong>' : ''}${x.r && k === 'pend' && !x.decisao && x.cands.length > 1 ? ` <button class="sec mini" data-escolher="${i}|${j}">Este é o laudo certo</button>` : ''}</li>`).join('')}</ul>` : '<p class="muted small">Nenhum candidato.</p>'}</div></div>`; }
  });
  // Caixa do cabeçalho (pedido de 24/11/2026): marca ou desmarca todas as linhas do filtro.
  const caixaTodos = v => { const cb = $('cfTab').querySelector('[data-seltodos]'); if (!cb) return; const n = v.filter(x => S.conf.sel.has(res.linhas.indexOf(x))).length; cb.checked = !!v.length && n === v.length; cb.indeterminate = n > 0 && n < v.length; };
  const refiltrar = () => { const v = comGrupos(filtrar()); t.atualizar(v); infoSel(v); caixaTodos(v); };
  // Ordem: seletor e títulos clicáveis (clicar de novo no mesmo título inverte). Fica lembrada neste navegador.
  const mudarOrdem = (k, inv) => { guardarOrdemConf({ k, inv }); $('cfOrdem').value = k; refiltrar(); };
  $('cfOrdem').onchange = e => mudarOrdem(e.target.value, false);
  $('cfTab').addEventListener('click', e => { const h = e.target.closest('[data-ordk]'); if (!h) return; const o = ordemConf(); mudarOrdem(h.dataset.ordk, o.k === h.dataset.ordk ? !o.inv : false); });
  $('cfTab').addEventListener('keydown', e => { const h = e.target.closest('[data-ordk]'); if (!h || (e.key !== 'Enter' && e.key !== ' ')) return; e.preventDefault(); h.click(); });
  infoSel(filtrar()); caixaTodos(filtrar());
  // «Decidir e ir para a próxima»: depois de uma decisão na linha aberta, abre a linha que ficou na mesma posição.
  if (S.conf.abrirPos != null) { const v = filtrar(); if (v.length) t.abrir(Math.min(S.conf.abrirPos, v.length - 1)); S.conf.abrirPos = null; }
  $('cfTab').addEventListener('change', e => {
    const v = filtrar();
    if (e.target.closest('[data-seltodos]')) {
      if (e.target.checked) v.forEach(x => S.conf.sel.add(res.linhas.indexOf(x))); else S.conf.sel.clear();
      $('cfTab').querySelectorAll('[data-sel]').forEach(c => c.checked = S.conf.sel.has(+c.dataset.sel));
    } else { const cb = e.target.closest('[data-sel]'); if (!cb) return; const i = +cb.dataset.sel; cb.checked ? S.conf.sel.add(i) : S.conf.sel.delete(i); }
    infoSel(v); caixaTodos(v);
  });
  // Copiar o nome do paciente com um clique (sem abrir a linha).
  $('cfTab').addEventListener('click', async e => {
    const b = e.target.closest('[data-copiar]'); if (!b) return;
    e.stopPropagation();
    try { await navigator.clipboard.writeText(b.dataset.copiar); const alvoOk = b.closest('.cpv') || b; alvoOk.classList.add('ok'); setTimeout(() => alvoOk.classList.remove('ok'), 1200); }
    catch (_) { avisar('Não foi possível copiar: selecione o nome e use Ctrl+C.', 'warn'); }
  });
  $('cfBusca').oninput = e => { S.conf.busca = e.target.value; refiltrar(); };
  $('cfFProc').onchange = e => { S.conf.fProc = e.target.value; S.conf.soFalta = false; desenharConferencia(); };
  $('cfFData').onchange = e => { S.conf.fData = e.target.value; S.conf.soFalta = false; desenharConferencia(); };
  $('cfFConv').onchange = e => { S.conf.fConv = e.target.value; S.conf.soFalta = false; desenharConferencia(); };
  $('cfSoFalta').onchange = e => { S.conf.soFalta = e.target.checked; desenharConferencia(); };
  $('cfFObs').onchange = e => { S.conf.fObs = e.target.value; if (e.target.value) S.conf.soFalta = false; desenharConferencia(); };
  $('cfFDataAte').onchange = e => { S.conf.fDataAte = e.target.value; S.conf.soFalta = false; desenharConferencia(); };
  $('cfFTit').onchange = e => { S.conf.fTit = e.target.value; S.conf.soFalta = false; desenharConferencia(); };
  $('cfFMed').onchange = e => { S.conf.fMed = e.target.value; S.conf.soFalta = false; desenharConferencia(); };
  $('cfTab').addEventListener('click', async e => {
    const b = e.target.closest('[data-nc-linha],[data-considerar],[data-desconsiderar],[data-dispensar],[data-resolvido],[data-escolher],[data-obs-salvar]'); if (!b) return;
    let ok = false;
    if (b.dataset.ncLinha !== undefined) ok = await abrirRegistroNC([candidatoComObservacao(res.linhas[+b.dataset.ncLinha], ctx)]);
    else if (b.dataset.considerar !== undefined) ok = await considerarNoRepasse(res.linhas[+b.dataset.considerar]);
    else if (b.dataset.dispensar !== undefined) ok = await dispensarLaudos(res, [+b.dataset.dispensar]);
    else if (b.dataset.resolvido !== undefined) ok = await resolvidoNoMV(res.linhas[+b.dataset.resolvido], ctx);
    else if (b.dataset.escolher !== undefined) { const [i, j] = b.dataset.escolher.split('|').map(Number), x = res.linhas[i], cd = x.cands[j]; ok = await considerarNoRepasse(x, `Laudo escolhido entre ${x.cands.length} candidatos: «${cd.l.titulo}» (${cd.l.medico || 'sem médico'}, ${fmtData(cd.l.data)})`); }
    else if (b.dataset.obsSalvar !== undefined) ok = await salvarObservacaoLinha(res.linhas[+b.dataset.obsSalvar], $('cfTab').querySelector(`[data-obs="${b.dataset.obsSalvar}"]`)?.value || '');
    else ok = await removerDecisaoConsiderar(res.linhas[+b.dataset.desconsiderar]);
    if (ok) { if (b.dataset.obsSalvar === undefined && b.dataset.desconsiderar === undefined) { const v = filtrar(), pos = v.indexOf(res.linhas[+(b.dataset.ncLinha ?? b.dataset.considerar ?? b.dataset.dispensar ?? b.dataset.resolvido ?? String(b.dataset.escolher).split('|')[0])]); if (pos >= 0) S.conf.abrirPos = pos; }
      aplicarDecisoes(res, indiceDecisoesComp()); desenharConferencia(); }
  });
  painelEqRodada($('cfEq'), paresDaConferencia(res), executarConferencia);
  desenharRoteiroConf();
}
/* v3.0.0-alpha.20 (simplificação): MV × laudo lado a lado, campo por campo, com a diferença destacada. */
/* v3.0.0-alpha.40 (prévia aprovada em 24/11/2026: docs/prototipos/quadro-comparacao/) — Comparação 1 a 1 MV × laudo num
 * quadro marcado, como planilha: faixa de título, colunas MV | Laudo | Resultado, diferença destacada e resumo no rodapé. */
function comparacaoMVLaudo(x, ctx = null) {
  if (!x.r || !x.l) return '';
  const cd = (x.cands || []).find(c => c.l === x.l), igual = (a, b) => norm(a || '') === norm(b || '');
  const b = (ok, t) => `<span class="badge ${ok ? 'ok' : 'warn'}">${esc(t)}</span>`;
  const mesmoDia = isoDia(x.r.data) === isoDia(x.l.data), eqOk = cd?.proc?.estado === 'validada';
  const cv = convenioCompativel(x.r.convenio, x.l.convenio);   // o MV corta o nome do convênio (mesma regra do motor)
  const cab = ctx?.relatorio?.cab, medMV = cab ? `${cab.prestadorCod} - ${cab.prestadorNome}` : '';
  const mesmoMed = cab && x.l.medico ? medicosDoPrestador(S.cfg, cab.prestadorCod).includes(norm(x.l.medico)) : null;
  const linhas = [
    ['Paciente', x.r.paciente, x.l.paciente, b(!cd || cd.nm >= 3, cd ? `nome ${NIVEL_NOME[cd.nm] || '—'}` : 'igual'), !!(cd && cd.nm < 3)],
    ['Data', fmtData(x.r.data), fmtData(x.l.data), b(mesmoDia, mesmoDia ? 'igual' : 'diferente'), !mesmoDia],
    ['Procedimento', `${x.r.codigo} · ${x.r.procDesc || ''}`, x.l.titulo, cd ? b(eqOk, eqOk ? 'equivalência validada' : (ROTULO_EQ[cd.proc.estado] || cd.proc.estado)) : '', !!(cd && !eqOk)],
    ['Convênio', x.r.convenio, x.l.convenio, cv === false ? b(false, 'diferente') : b(true, igual(x.r.convenio, x.l.convenio) || cv === null ? 'igual' : 'mesmo convênio (nome cortado no MV)'), cv === false],
    ['Médico', medMV, x.l.medico, mesmoMed === null ? '' : b(mesmoMed, mesmoMed ? 'mesmo prestador' : 'outro médico'), mesmoMed === false]
  ];
  const difs = linhas.filter(l => l[4]), iguais = linhas.filter(l => !l[4] && l[3]).length;
  const origem = [x.r.seq ? `linha ${x.r.seq} do relatório` : '', x.l.idLaudo ? `laudo ${x.l.idLaudo}${x.l.linhaPlanilha ? ` (linha ${x.l.linhaPlanilha} da planilha)` : ''}` : ''].filter(Boolean).join(' · ');
  return `<section class="cf-cmp qd" aria-label="Comparação 1 a 1 MV × laudo">
    <div class="qd-tit"><b>Comparação 1 a 1 · MV × laudo</b>${origem ? `<span>${esc(origem)}</span>` : ''}</div>
    <div class="qd-rol"><table class="qd-tab"><thead><tr><th></th><th class="mv">MV (relatório de repasse)</th><th>Laudo (Apolo)</th><th class="res">Resultado</th></tr></thead><tbody>
    ${linhas.map(([rot, mv, la, res, dif]) => `<tr${dif ? ' class="dif"' : ''}><td>${rot}</td><td class="mv">${esc(mv || '—')}</td><td>${esc(la || '—')}</td><td class="res">${res}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="qd-rod"><b>${iguais} igua${iguais === 1 ? 'l' : 'is'} · ${difs.length ? `${difs.length} diferença${difs.length > 1 ? 's' : ''}:` : 'nenhuma diferença'}</b>${difs.length ? ` ${esc(difs.map(l => l[0]).join(', '))} <span class="muted">— decida abaixo</span>` : ''}</div>
  </section>`;
}
/* Histórico deste relatório (antes só na tela «Rodadas»): cada rodada, o valor para pagamento e o aceite. */
function cartaoHistoricoRelatorio(ctx) {
  const idx = indiceDecisoesComp(ctx.chaveCompetencia);
  const rs = (S.rodadas || []).filter(r => r.tipo === 'conferencia' && competenciaDaRodada(r) === ctx.chaveCompetencia && String(r.prestadorCod) === String(ctx.relatorio.cab.prestadorCod) && String(r.unidadeCod) === String(ctx.unidadeCod)).sort((a, b) => b.em.localeCompare(a.em));
  if (!rs.length) return '';
  const pagar = r => r.resumida || !usaRegraF43(r) ? '—' : fmtBR(totaisPorClasse(r.linhas, l => classeDaLinhaRodada(l, idx)).pagar);
  return `<div class="card"><h2>Histórico deste relatório <span class="small muted">${rs.length} rodada(s) · <a href="#rodadas">todas as rodadas</a></span></h2><div class="tw"><table><thead><tr><th>Quando</th><th>Quem</th><th>PDF do MV</th><th class="n">Para pagamento</th><th>Resultado</th><th>Aceite</th></tr></thead><tbody>
    ${rs.map(r => `<tr${r.id === ctx.rodadaId ? ' class="cf-hist-atual"' : ''}><td>${new Date(r.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${r.id === ctx.rodadaId ? ' <span class="badge info">esta</span>' : ''}</td><td>${esc(r.operador || '—')}</td><td class="small">${esc((r.arquivos || []).find(a => a.papel === 'MV')?.nome || '—')}</td><td class="n">${pagar(r)}</td>
      <td class="small">${esc(Object.entries(r.contagens || {}).filter(([, n]) => n).map(([k, n]) => `${STATUS_CONF[k]?.nome || k}: ${n}`).join(' · '))}</td><td>${r.aceite ? `<span class="badge ok">${esc(r.aceite.por)} · ${new Date(r.aceite.em).toLocaleDateString('pt-BR')}</span>` : r.resumida ? '<span class="small muted">resumida</span>' : '<span class="badge warn">sem aceite</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
}
// Excel da conferência ao lado do PDF: 05 - Relatórios de repasse MV › USG | IMG | Curitiba › unidade (estrutura padronizada).
function subpastaDaConferencia(ctx) {
  const x = S.relatorios.find(r => r.id === ctx.relId), g = x ? grDoRel(x) : '', u = unidadePorCod(S.cfg, ctx.unidadeCod);
  if (!GRUPOS_REL[g]) return [];
  return g === 'curitiba' ? [GRUPOS_REL.curitiba] : [GRUPOS_REL[g], ...(u ? [nomePastaUnidadeRel(u)] : [])];
}
const fObsAtual = () => S.conf?.fObs === true ? 'com' : (S.conf?.fObs || '');
/* P1 (auditoria 16/11/2026) — Excel sem congelar a tela sem retorno: o botão mostra «Processando…» enquanto monta e gera.
 * «Exportar só o filtrado» leva só as linhas visíveis (o Resumo e as abas são do filtro, e a aba Informações diz qual). */
// v3.0.0-alpha.38: ordem da tabela da Conferência — preferência de cada pessoa (fica neste navegador).
const ordemConf = () => { const o = lerLocal(CHAVES.ordemConf); return o && ORDENS_CONF[o.k] ? o : { k: 'rel', inv: false }; };
const guardarOrdemConf = o => gravarLocal(CHAVES.ordemConf, o);
const thOrdem = (k, rot) => { const o = ordemConf(), on = o.k === k; return `<span class="th-ord" data-ordk="${k}" role="button" tabindex="0" aria-sort="${on ? (o.inv ? 'descending' : 'ascending') : 'none'}" title="Ordenar por ${esc(rot)}">${esc(rot)}${on ? `<span class="seta">${o.inv ? '▼' : '▲'}</span>` : ''}</span>`; };
function exportarExcelConf(bt, res, ctx) {
  const idxObs = indiceObservacoes(estadoCompetencia(S.compReg, ctx.chaveCompetencia || S.comp).observacoes);
  return comProcessando(bt, () => entregarArquivo(xlsxConferencia(res, { ...ctx, idxObs, compostas: S.eq.compostas || [], colunasExportacao: colunasExportacaoAtuais(), ordem: ordemConf() }),
    nomeArquivoAnalise('conferencia', ctx).replace(/\.xlsx$/i, ctx.filtroTexto ? '_filtrado.xlsx' : '.xlsx'), 'conf', ctx.chaveCompetencia || S.comp, subpastaDaConferencia(ctx)), 'a exportação do Excel');
}
function textoFiltroConf(vis) {
  const c = S.conf, partes = [];
  if (c.filtroClasse) partes.push(`classe ${CLASSES_FECH[c.filtroClasse].nome}`);
  if (c.filtroStatus.size) partes.push(`situação ${[...c.filtroStatus].map(k => STATUS_CONF[k]?.nome || k).join(', ')}`);
  if (c.filtroMarc.size) partes.push(`marcador ${[...c.filtroMarc].map(k => k.startsWith('dec-') ? TIPOS_DECISAO[k.slice(4)] : MARCADORES[k] || k).join(', ')}`);
  if (c.fProc && c.fProc !== '*') partes.push(`procedimento ${c.fProc}`);
  if (c.fDataAte && c.fDataAte !== '*') partes.push(`data ${c.fData && c.fData !== '*' ? `de ${fmtData(paraData(c.fData))} ` : ''}até ${fmtData(paraData(c.fDataAte))}`);
  else if (c.fData && c.fData !== '*') partes.push(`data ${fmtData(paraData(c.fData))}`);
  if (c.fConv && c.fConv !== '*') partes.push(`convênio ${c.fConv}`);
  if (c.fTit && c.fTit !== '*') partes.push(`título «${c.fTit}»`);
  if (c.fMed && c.fMed !== '*') partes.push(`médico ${c.fMed}`);
  if (fObsAtual()) partes.push(fObsAtual() === 'com' ? 'com observação' : 'sem observação');
  if (c.busca) partes.push(`busca «${c.busca}»`);
  if (c.filtroLinhas) partes.push(c.filtroLinhas.titulo);
  if (c.soFalta !== false && !c.filtroLinhas && !c.filtroStatus.size && !c.filtroClasse) partes.push('só o que falta decidir');
  return `${vis.length} linha(s) · ${partes.join(' · ') || 'filtro da tela'}`;
}
/* P1 — Reconferir em um clique: relê o PDF (da pasta da competência, ou um arquivo escolhido) e confere de novo com a mesma
 * unidade, médico, tolerância e aba. Antes eram 4 ou 5 passos (Início → atualizar → Conferência → escolher → executar). */
const pastaConectadaConf = () => typeof SY !== 'undefined' && !!SY.handle && !SY.legado;
function botaoReconferir(ctx) {
  const x = S.relatorios.find(r => r.id === ctx.relId), daPasta = pastaConectadaConf() && !!x?.caminhoPasta;
  return `<button class="sec" id="cfReconferir" title="Mantém unidade, médico, tolerância e a aba aberta">${daPasta ? 'Reler o PDF da pasta e conferir de novo' : 'Carregar o PDF novo e conferir de novo'}</button><input type="file" id="cfReArq" accept=".pdf,application/pdf" hidden>`;
}
function ligarReconferir(c) {
  const bt = c.querySelector('#cfReconferir'), arq = c.querySelector('#cfReArq'); if (!bt) return;
  bt.onclick = () => {
    const x = S.relatorios.find(r => r.id === S.conf.ctx.relId);
    if (pastaConectadaConf() && x?.caminhoPasta) return comProcessando(bt, () => reconferir(null), 'a reconferência');
    arq.value = ''; arq.click();
  };
  arq.onchange = () => arq.files[0] && comProcessando(bt, () => reconferir(arq.files[0]), 'a reconferência');
}
async function reconferir(arquivo) {
  if (!exigirAberta(S.comp, 'executar uma conferência')) return;
  const { ctx } = S.conf, aba = S.conf.aba || 'previa', atual = S.relatorios.find(r => r.id === ctx.relId);
  const prest = String(ctx.relatorio.cab.prestadorCod), hashAntes = (ctx.arquivos || []).find(a => a.papel === 'MV')?.hash || '';
  let x = null;
  if (!arquivo) {
    await atualizarDaPasta({ silencioso: true });
    x = S.relatorios.find(r => r.caminhoPasta && r.caminhoPasta === atual?.caminhoPasta)
      || S.relatorios.find(r => r.caminhoPasta && String(r.rel.cab.prestadorCod) === prest && r.unidadePasta === atual?.unidadePasta && (r.grupoPasta || '') === (atual?.grupoPasta || ''));
    if (!x) return avisar('O PDF deste relatório não foi encontrado na pasta da competência. Use «Carregar o PDF novo» ou confira no Início.', 'warn');
  } else {
    const n0 = S.relatorios.length; await carregarPDFs([arquivo]);
    if (S.relatorios.length === n0) { x = S.relatorios.find(r => r.nome === arquivo.name && String(r.rel.cab.prestadorCod) === prest); if (!x) return; }
    else {
      x = S.relatorios.at(-1);
      if (String(x.rel.cab.prestadorCod) !== prest) { S.relatorios.pop(); return avisar(`${arquivo.name} é do prestador ${x.rel.cab.prestadorCod} - ${x.rel.cab.prestadorNome}, não do ${prest}. Nada foi conferido.`, 'warn'); }
      if (atual) { for (const k of ['unidadePasta', 'grupoPasta', 'caminhoPasta']) if (atual[k] !== undefined) x[k] = atual[k]; x.finalidade = atual.finalidade || x.finalidade; S.relatorios = S.relatorios.filter(r => r !== atual); }
    }
  }
  await rodarConferencia(x, ctx.unidadeCod, ctx.parametros?.tol ?? S.cfg.parametros.tolConferencia, ctx.medicoSel || '@prest');
  S.conf.aba = aba;
  RENDER.conferencia();
  avisar(x.hash === hashAntes ? 'Conferido de novo com o mesmo PDF (o arquivo não mudou). As decisões e equivalências atuais já valem.' : 'PDF novo lido e conferido de novo: veja a aba «NCs e correções no MV» para a reconferência.', x.hash === hashAntes ? 'info' : 'ok');
}
// Curitiba (V3): avisos para agir no MV — HM a excluir, HM sem exame base, pacotes e exames fora do que a V3 faz.
function cartaoAvisosV3(a) {
  if (!a.total) return '<div class="v3-avisos small muted"><b>Curitiba (V3):</b> nenhum HM a excluir, pacote ou exame fora do que a V3 faz neste relatório.</div>';
  const R = v => `R$ ${fmtBR(v)}`, filtro = (m, t) => `<button class="sec mini" data-m-v3="${m}">${t}</button>`;
  const itens = [];
  if (a.convExcluir.n) itens.push(`<li><b class="v3-exc">⚠ ${a.convExcluir.n} linha(s) de convênio que não compõe o repasse (${R(a.convExcluir.valor)})</b> — ${esc(a.convExcluir.convenios.join(', '))}: fora da contagem de exames e do cálculo. Peça a exclusão no MV e reconfira. ${filtro('conv-excluir-v3', 'Ver linhas')}</li>`);
  if (a.hmExcluir.n) itens.push(`<li><b class="v3-exc">⚠ ${a.hmExcluir.n} HM a excluir do MV (${R(a.hmExcluir.valor)})</b> — não são pagos a ninguém: ${a.hmExcluir.grupos.map(g => `${esc(g.grupo)} · ${g.n}${g.rotuloMotivo ? ` <span class="muted">(${esc(g.rotuloMotivo)})</span>` : ''}`).join('; ')}. Peça a exclusão no MV e reconfira. ${filtro('hm-v3-excluir', 'Ver linhas')}${a.hmExcluir.usgUnimed.n ? `<br><b>Atenção:</b> ${a.hmExcluir.usgUnimed.n} deles (${R(a.hmExcluir.usgUnimed.valor)}) são HM de USG/Doppler Unimed lançados num desses grupos: confira se o grupo do MV está certo antes de excluir.` : ''}</li>`);
  if (a.hmSemBase.n) itens.push(`<li><b>${a.hmSemBase.n} HM de USG Unimed sem o exame base no relatório (${R(a.hmSemBase.valor)})</b> — ficam pendentes: ache o exame de USG ou aceite com justificativa. ${filtro('hm-v3-sem-base', 'Ver linhas')}</li>`);
  if (a.pacotes.n) itens.push(`<li><b>${a.pacotes.n} pacote(s) de ressonância/mamografia considerados (${R(a.pacotes.valor)})</b> pelo valor de repasse do MV${a.substituidos.n ? `; ${a.substituidos.n} exame(s) base Bradesco a 100% substituídos (${R(a.substituidos.valor)}, fora do fechamento)` : ''}. Confira se cada pacote corresponde ao exame base. ${filtro('pacote-v3', 'Ver pacotes')}${a.substituidos.n ? ' ' + filtro('base-pacote-v3', 'Ver bases') : ''}</li>`);
  else if (a.substituidos.n) itens.push(`<li><b>${a.substituidos.n} exame(s) base substituídos pelo pacote</b>. ${filtro('base-pacote-v3', 'Ver linhas')}</li>`);
  if (a.foraEscopo.n) itens.push(`<li><b>${a.foraEscopo.n} linha(s) de modalidade que a V3 não faz</b> (ex.: tomografia): verifique o lançamento. ${filtro('fora-escopo-v3', 'Ver linhas')}</li>`);
  return `<div class="v3-avisos" id="cfAvisosV3" role="status"><b>Curitiba (V3) — avisos para o MV</b><ul class="small">${itens.join('')}</ul></div>`;
}
// Aba «NCs e correções no MV»: o que devia ter saído do MV e o que já saiu (reconferência, SOL-F42).
function cartaoCorrecoesMV(corr) {
  const lin = x => x ? `${esc(x.r.paciente)} · ${esc(fmtData(x.r.data))} · ${esc(x.r.codigo)} ${esc(x.r.procDesc)} · R$ ${fmtBR(x.r.vlRepasse)}` : '';
  const cont = [...corr.ncs.filter(x => x.situacao === 'continua'), ...corr.resolvidos.filter(x => x.situacao === 'continua'), ...corr.hm.filter(x => x.continua)];
  const SIT = { corrigida: ['ok', 'Corrigida no MV (não está mais no relatório)'], aguardando: ['warn', 'Aguardando correção no MV (reimporte o PDF depois de corrigir)'], continua: ['err', 'Não corrigida: continua no MV'], lancada: ['ok', 'Corrigida: lançada no MV (o laudo agora tem par; a NC não passa para a linha)'] };
  return `<div class="card"><h2>Correções no MV</h2>
    ${cont.length ? `<div class="aviso-mv" role="alert"><b>⚠ ${cont.length} item(ns) que deviam ter saído do MV continuam no relatório reimportado — R$ ${fmtBR(cont.reduce((s, x) => s + (x.linha?.r?.vlRepasse || 0), 0))} ainda compõem a produção que o MV vai pagar.</b> A ferramenta já tira esses valores do fechamento. Retire no MV e reimporte o PDF; se a NC estava errada, marque «não procede».</div>` : '<p class="small muted">Nada que devia ter saído do MV continua no relatório.</p>'}
    <h3>NCs deste relatório</h3>${corr.ncs.length ? `<div class="tw"><table><thead><tr><th>Situação no MV</th><th>Linha</th><th>NC</th></tr></thead><tbody>${corr.ncs.map(x => `<tr><td><span class="badge ${SIT[x.situacao][0]}">${SIT[x.situacao][1]}</span></td><td class="small">${x.linha ? lin(x.linha) : esc(`${x.nc.paciente || '—'} · ${x.nc.codigo || ''} ${x.nc.titulo || ''}`)}</td><td class="small">${esc(NATUREZA_NC[x.nc.natureza]?.nome || x.nc.natureza || '')} · ${esc(x.nc.criadaPor || '—')} · ${new Date(x.nc.criadaEm).toLocaleDateString('pt-BR')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted">Nenhuma NC registrada para linhas deste relatório.</p>'}
    <h3>Resolvidos no MV</h3>${corr.resolvidos.length ? `<ul class="small">${corr.resolvidos.map(x => `<li><span class="badge ${SIT[x.situacao][0]}">${x.situacao === 'corrigida' ? 'Confirmado pela reconferência' : x.situacao === 'continua' ? 'Não confirmado: continua no MV' : 'Aguardando reconferência'}</span> ${x.linha ? lin(x.linha) : esc(x.d.resumo?.codigo || '')} — «${esc(x.d.justificativa)}» (${esc(x.d.por || '—')})</li>`).join('')}</ul><p class="small muted">Ficam pendentes até a reconferência confirmar (a linha sai do novo PDF) ou até você aceitar para pagamento.</p>` : '<p class="small muted">Nenhum.</p>'}
    <h3>HM a excluir do MV</h3>${corr.hm.length ? `<p class="small muted" style="margin-top:0">${corr.hm.some(x => x.linha.marcadores?.has('hm-v3-excluir')) ? 'Curitiba (V3): HM de raio-X, de mamografia e qualquer HM que não seja de USG Unimed (inclusive no 78 PF) não é pago a ninguém.' : 'Fora da V3 nenhum HM é pago, de nenhum grupo'}: estes itens não compõem o repasse — peça a exclusão no MV.</p><ul class="small">${corr.hm.map(x => `<li>${lin(x.linha)}${x.linha.r.grupoNome ? ` · <span class="muted">${esc(x.linha.r.grupoNome)} · ${esc(x.linha.r.convenio || '')}</span>` : ''}${x.continua ? ' — <b style="color:var(--err)">continua no MV depois da reconferência</b>' : ''}</li>`).join('')}</ul>` : '<p class="small muted">Nenhum HM a excluir.</p>'}</div>`;
}

function resumoComparacao({ ant, grupos }) {
  const n = k => grupos[k].length;
  return `<div class="card" style="background:var(--infobg);border-color:transparent;margin-top:12px"><strong>Comparação com a rodada de ${new Date(ant.em).toLocaleString('pt-BR')}</strong>
    <div class="small" style="margin-top:4px">${n('agoraIdentificados')} passaram a conferido/identificado · ${n('continuamPendentes')} continuam pendentes · ${n('mudaramEstado')} mudaram de categoria · ${n('mudaramMedico')} mudaram de médico · ${n('novos')} linhas novas · ${n('desapareceram')} saíram da extração · ${n('semMudanca')} sem mudança.</div>
    <div class="small muted">A nova extração mostra o que mudou nos dados; não prova quem fez a correção no MV.</div></div>`;
}

/* ---------- Decisões por linha (memória da competência) ---------- */
function botoesDecisao(x, i) {
  const k = classeDaLinhaConf(x);
  if (x.decisao?.tipo === 'nc') return `<span class="small">NC registrada (${esc(SITUACAO_NC[x.decisao.situacao] || '')}) — fora do fechamento. <a href="#nc">Ver na aba Não conformidades</a>; «Não procede» devolve a linha ao cálculo.</span>`;
  if (x.decisao?.tipo === 'resolvido') return `<span class="small">Resolvido no MV por ${esc(x.decisao.por || '—')}: «${esc(x.decisao.justificativa)}» — pendente até a reconferência confirmar.</span> <button class="mini" data-considerar="${i}">Aceitar para pagamento…</button> <button class="sec mini" data-desconsiderar="${i}">Remover decisão</button>`;
  if (x.decisao?.tipo === 'considerar' || x.decisao?.tipo === 'dispensado') return `<span class="small">${x.decisao.tipo === 'dispensado' ? 'Laudo dispensado' : 'Aceito para pagamento'} por ${esc(x.decisao.por || '—')}: «${esc(x.decisao.justificativa)}»</span> <button class="sec mini" data-desconsiderar="${i}">Remover decisão</button>`;
  if (k === 'excluido') return `<span class="small muted">${x.tipo === 'hm' ? 'HM a excluir do MV: não compõe repasse (fora da V3 nenhum HM é pago).' : 'Não compõe repasse: nenhuma decisão necessária.'}</span> <button class="sec mini" data-nc-linha="${i}">Apontar como NC…</button>`;
  if (k === 'devido') return `<span class="small muted">Conferido: entra no fechamento sem decisão.</span> <button class="sec mini" data-nc-linha="${i}">Apontar como NC…</button>`;
  return `${x.r ? `<button class="mini" data-considerar="${i}">Aceitar para pagamento…</button> ` : ''}<button class="sec mini" data-nc-linha="${i}">Apontar como NC…</button>${x.r ? ` <button class="sec mini" data-resolvido="${i}">Resolvido no MV…</button>` : ''}${!x.r && x.l ? ` <button class="sec mini" data-dispensar="${i}">Dispensar laudo…</button>` : ''}`;
}
async function considerarNoRepasse(x, sugestao = '') {
  if (!exigirAberta(S.comp, 'registrar decisões')) return false;
  const op = await exigirOperador(); if (!op) return false;
  const r = await dialogo('Aceitar para pagamento', `<p class="small">${esc(x.r.codigo)} - ${esc(x.r.procDesc)} · ${esc(fmtData(x.r.data))} · R$ ${fmtBR(x.r.vlRepasse)}</p>
    <p class="small muted">A linha passa a «Aceito» e <b>entra no fechamento</b>. A decisão é sua, fica registrada (quem e quando) e vale para toda nova rodada da competência ${rotuloCompetencia(S.comp)}.</p>
    <label class="campo">Justificativa (obrigatória)<input type="text" name="just" value="${esc(sugestao)}"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Aceitar para pagamento']]);
  if (r.botao !== 'ok') return false;
  if (!r.campos.just.trim()) { avisar('Informe a justificativa.', 'warn'); return false; }
  registrarConsiderar(S.compReg, S.comp, chavesDaLinha(x.r, x.l), r.campos.just, op, { codigo: x.r.codigo, desc: x.r.procDesc, titulo: x.l?.titulo || '' });
  salvarCompReg(); avisar('Linha aceita para pagamento nesta competência: entra no fechamento.', 'ok');
  return true;
}
// «Resolvido no MV»: a correção foi feita no MV; a linha fica pendente até o novo PDF confirmar (ou aceite manual).
async function resolvidoNoMV(x, ctx) {
  if (!exigirAberta(S.comp, 'registrar decisões')) return false;
  const op = await exigirOperador(); if (!op) return false;
  const r = await dialogo('Resolvido no MV', `<p class="small">${esc(x.r.codigo)} - ${esc(x.r.procDesc)} · ${esc(fmtData(x.r.data))} · R$ ${fmtBR(x.r.vlRepasse)}</p>
    <p class="small muted">A linha continua <b>pendente</b> (fora do fechamento) até você reimportar o PDF do MV e a ferramenta confirmar a correção, ou até você aceitar para pagamento. Se a linha continuar no novo PDF, a ferramenta avisa.</p>
    <label class="campo">O que foi corrigido no MV (obrigatório)<input type="text" name="just" placeholder="ex.: lançamento duplicado retirado da conta"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Registrar']]);
  if (r.botao !== 'ok') return false;
  if (!r.campos.just.trim()) { avisar('Informe o que foi corrigido no MV.', 'warn'); return false; }
  registrarConsiderar(S.compReg, S.comp, chavesDaLinha(x.r, null), r.campos.just, op, { codigo: x.r.codigo, desc: x.r.procDesc, hashMV: (ctx.arquivos || []).find(a => a.papel === 'MV')?.hash || '', relatorio: `${ctx.relatorio.cab.prestadorCod}|${ctx.unidadeCod}` }, 'resolvido');
  salvarCompReg(); avisar('Registrado como resolvido no MV: reimporte o PDF para a ferramenta confirmar.', 'ok');
  return true;
}
async function salvarObservacaoLinha(x, texto) {
  if (!String(texto).trim()) { avisar('Escreva a observação antes de salvar.', 'warn'); return false; }
  if (!exigirAberta(S.comp, 'registrar observações')) return false;
  const op = await exigirOperador(); if (!op) return false;
  registrarObservacao(S.compReg, S.comp, chavesDaLinha(x.r, x.l), texto, op);
  salvarCompReg(); avisar('Observação salva na competência.', 'ok');
  return true;
}
// «Só no laudo» que não precisa de lançamento: dispensa com justificativa (como o aceite de uma ressalva). Vale para toda nova
// rodada da competência, não entra no repasse e deixa de contar como pendência no aceite. «Remover decisão» desfaz.
const MOTIVOS_DISPENSA = ['2ª página / parte de um exame já lançado', 'Laudo refeito ou retificado (o original já foi lançado)', 'Exame sem cobrança (cortesia, repetição, controle)', 'Laudo de outra competência (já pago ou a pagar em outra)'];
async function dispensarLaudos(res, idxs) {
  if (!exigirAberta(S.comp, 'registrar decisões')) return false;
  const op = await exigirOperador(); if (!op) return false;
  const ls = idxs.map(i => res.linhas[i]).filter(x => x && x.l && !x.r && !x.decisao); if (!ls.length) return false;
  const r = await dialogo(ls.length > 1 ? `Dispensar ${ls.length} laudos` : 'Dispensar o laudo', `${ls.length === 1 ? `<p class="small"><b>«${esc(ls[0].l.titulo)}»</b> · ${esc(fmtData(ls[0].l.data))} · ${esc(ls[0].l.medico || 'sem médico')}</p>` : `<p class="small">${ls.slice(0, 6).map(x => `«${esc(x.l.titulo)}» (${esc(fmtData(x.l.data))})`).join(' · ')}${ls.length > 6 ? ' …' : ''}</p>`}
    <p class="small muted">O laudo não tem lançamento neste relatório e não precisa ter. Ele deixa de aparecer como pendência (inclusive no aceite) em toda nova rodada da competência ${rotuloCompetencia(S.comp)}. Não vira NC e não entra no repasse. «Remover decisão», na linha, desfaz.</p>
    <label class="campo">Motivo<select name="mot">${MOTIVOS_DISPENSA.map(m => `<option>${esc(m)}</option>`).join('')}<option value="">Outro (escrever abaixo)</option></select></label>
    <label class="campo">Justificativa / complemento<input type="text" name="just" placeholder="obrigatório se escolher «Outro»"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Dispensar']]);
  if (r.botao !== 'ok') return false;
  const just = [r.campos.mot, r.campos.just.trim()].filter(Boolean).join(': ');
  if (!just) { avisar('Informe o motivo para dispensar.', 'warn'); return false; }
  for (const x of ls) registrarConsiderar(S.compReg, S.comp, chavesDaLinha(null, x.l), just, op, { titulo: x.l.titulo, data: isoDia(x.l.data) }, 'dispensado');
  salvarCompReg(); avisar(`${ls.length} laudo(s) dispensado(s) nesta competência.`, 'ok');
  return true;
}
/* SOL-F41 (v3.0.0-alpha.13) — A observação da linha vai para a NC registrada a partir dela (no campo Observações). */
function candidatoComObservacao(x, ctx) {
  const c = candidatoDaLinhaConferencia(x, ctx, S.cfg);
  const obs = observacoesDaLinha(indiceObservacoes(estadoCompetencia(S.compReg, ctx.chaveCompetencia || S.comp).observacoes), x.r, x.l);
  if (obs.length) c.obsLinha = textoObservacoes(obs);
  return c;
}
// Observação em lote: o mesmo texto em todas as linhas visíveis do filtro (cada uma pela sua chave, sem nome de paciente).
async function observacaoEmLote(vis) {
  if (!exigirAberta(S.comp, 'registrar observações')) return false;
  const op = await exigirOperador(); if (!op) return false;
  const r = await dialogo(`Observação em ${vis.length} linha(s)`, `<p class="small muted">O texto entra em cada linha visível do filtro, com quem e quando. Fica na competência ${rotuloCompetencia(S.comp)} e aparece nas próximas rodadas; não muda a classe nem a situação.</p>
    <label class="campo">Observação<textarea name="txt" rows="3"></textarea></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Salvar']]);
  if (r.botao !== 'ok') return false;
  if (!r.campos.txt.trim()) { avisar('Escreva a observação.', 'warn'); return false; }
  for (const x of vis) registrarObservacao(S.compReg, S.comp, chavesDaLinha(x.r, x.l), r.campos.txt, op);
  salvarCompReg(); avisar(`Observação registrada em ${vis.length} linha(s).`, 'ok');
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
  const abertas = r.linhas.filter(l => !linhaResolvida(l)), comDecisao = abertas.filter(l => decisaoDaLinhaRodada(idx, l));
  // SOL-F41: quantas linhas desta conferência têm observação.
  const idxObsA = indiceObservacoes(estadoCompetencia(S.compReg, chave).observacoes), nObs = S.conf?.ctx?.rodadaId === r.id ? S.conf.res.linhas.filter(x => observacoesDaLinha(idxObsA, x.r, x.l).length).length : 0;
  const TC = totaisPorClasse(r.linhas, l => classeDaLinhaRodada(l, idx)), resumoCl = `<p class="small" style="margin:6px 0"><b>Para pagamento: R$ ${fmtBR(TC.pagar)}</b> (Devido R$ ${fmtBR(TC.devido.valor)} + Aceito R$ ${fmtBR(TC.aceito.valor)}) · fora do fechamento: pendente R$ ${fmtBR(TC.pend.valor)} · NC R$ ${fmtBR(TC.nc.valor)} · excluído R$ ${fmtBR(TC.excluido.valor)}${nObs ? ` · <span id="cfAceiteObsN">${nObs} linha(s) com observação</span>` : ''}</p>`;
  const pend = pendenciasDaRodada(r, idx).length, prox = proximoRelatorioConf(), nNC = comDecisao.filter(l => decisaoDaLinhaRodada(idx, l)?.tipo === 'nc').length;
  if (r.aceite) return `<div class="aceite-box feito" id="cfAceite"><b>Aceite do relatório</b> <span class="badge ok">aceito</span>${resumoCl}
    <p class="small" style="margin:6px 0">${esc(r.aceite.por)} · ${new Date(r.aceite.em).toLocaleString('pt-BR')}${r.aceite.obs ? ` — «${esc(r.aceite.obs)}»` : ''} · ${r.aceite.pendencias} pendência(s) no aceite</p>
    <div class="acoes" style="margin:0">${fechada ? '<span class="small muted">Competência fechada: reabra no Início para desfazer.</span>' : '<button class="sec mini" id="cfDesfazer">Desfazer aceite</button>'}<a href="#rodadas" class="small">Ver em Rodadas</a>
    ${prox ? `<button class="sec mini" id="cfProximo">Ir para o próximo relatório (${esc(prox.rel.cab.prestadorCod)} - ${esc(prox.rel.cab.prestadorNome)})</button>` : ''}</div></div>`;
  return `<div class="aceite-box" id="cfAceite"><b>Aceite do relatório</b> <span class="badge warn">sem aceite</span>${resumoCl}
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
  S.rodadas = await dbRodadasJanela();
  avisar(`${ok.length} conferência(s) rodadas${semUn.length ? `; ${semUn.length} sem unidade ficaram de fora` : ''}. Acompanhe em «Prestadores por unidade» e dê o aceite em cada uma.${F.un !== '*' && F.gr !== '*' ? ' Para a planilha de controle da unidade, use «Excel único».' : ''}`, 'ok');
  RENDER.conferencia();
});

/* SOL-F45 (v3.0.0-alpha.17) — Excel único da unidade × grupo: todos os prestadores dos relatórios filtrados (unidade e
 * grupo escolhidos no seletor) e quem laudou sem relatório, num arquivo só, gravado em «09 - Planilhas de repasse
 * conferidos › IMG | USG › unidade» (Curitiba: «09 › Curitiba»). Cada relatório é conferido de novo na hora, com os
 * parâmetros da última rodada dele na competência; nenhuma rodada é gravada. Relatório sem rodada entra como «sem conferência». */
function itensPlanilhaUnidade(un, gr, ch = S.comp) {
  const rels = relatoriosPara('cf').filter(x => unDoRel(x) === un && grDoRel(x) === gr), idxDec = indiceDecisoesComp(ch), uNome = `${un} - ${unidadePorCod(S.cfg, un)?.nome || ''}`;
  return rels.map(x => {
    const rod = (S.rodadas || []).filter(r => r.tipo === 'conferencia' && competenciaDaRodada(r) === ch && String(r.unidadeCod) === String(un) && (r.arquivos || []).some(a => a.papel === 'MV' && a.hash === x.hash))
      .sort((a, b) => b.em.localeCompare(a.em))[0] || null;
    const ctx = { chaveCompetencia: ch, relId: x.id, relatorio: { ...x.rel, arquivo: x.rel.arquivo || x.nome }, apoloNome: S.apolo?.nome || '', unidadeCod: un, unidadeNome: uNome, parametros: rod?.parametros || {}, operador: S.operador, rodadaId: rod?.id || '' };
    if (!rod || !S.apolo) return { res: null, ctx, rodada: null };
    const medSel = rod.parametros?.medico || '@prest', medicos = medSel === '*' ? null : medSel === '@prest' ? medicosDoPrestador(S.cfg, x.rel.cab.prestadorCod) : [medSel];
    const res = aplicarDecisoes(conferirCruzado(x.rel, S.apolo, S.cfg, S.eq, { unidadeCod: un, tol: rod.parametros?.tol ?? S.cfg.parametros.tolConferencia, medicos }), idxDec);
    return { res, ctx, rodada: rod };
  });
}
const nomePlanilhaUnidade = (un, gr, ch = S.comp) => `conferidos_${gr === 'curitiba' ? 'curitiba' : gr}_unidade_${String(un).replace(/[^\w-]/g, '')}_comp_${ch.slice(5)}-${ch.slice(0, 4)}.xlsx`;
const subpastaPlanilhaUnidade = (un, gr) => { const u = unidadePorCod(S.cfg, un); return gr === 'curitiba' ? [GRUPOS_REL.curitiba] : [GRUPOS_REL[gr], ...(u ? [nomePastaUnidadeRel(u)] : [])]; };
async function gerarPlanilhaUnidade(bt, un, gr) {
  if (!S.apolo) return avisar('Carregue a planilha de laudos no Início.', 'warn');
  return comProcessando(bt, async () => {
    S.rodadas = await dbRodadasJanela();
    const itens = itensPlanilhaUnidade(un, gr), ctl = controleAtual();
    const G = ctl?.unidades.find(u => String(u.cod) === String(un))?.grupos.find(g => g.grupo === gr);
    const xlsx = xlsxConferenciaUnidade(itens, G?.itens || [], { chave: S.comp, unidadeCod: un, unidadeNome: `${un} - ${unidadePorCod(S.cfg, un)?.nome || ''}`, grupo: gr, operador: S.operador, apoloNome: S.apolo.nome, eqRevisao: S.eq.revisao,
      colunasExportacao: colunasExportacaoAtuais(), compostas: S.eq.compostas || [], idxObs: indiceObservacoes(estadoCompetencia(S.compReg, S.comp).observacoes) });
    const sem = itens.filter(x => !x.res).length;
    await entregarArquivo(xlsx, nomePlanilhaUnidade(un, gr), 'conferidos', S.comp, subpastaPlanilhaUnidade(un, gr));
    if (sem) avisar(`${sem} de ${itens.length} relatório(s) ainda sem conferência nesta competência: entram na aba «Prestadores» como «Relatório sem conferência». Use «Conferir os relatórios filtrados» e gere de novo.`, 'warn');
  }, 'o Excel único da unidade');
}
document.addEventListener('click', e => {
  const bt = e.target.closest('[data-cfunica]'); if (!bt) return;
  const F = FILTRO_REL.cf; if (F.un === '*' || F.gr === '*') return avisar('Escolha a unidade e o grupo no filtro dos relatórios.', 'warn');
  gerarPlanilhaUnidade(bt, F.un, F.gr);
});

/* SOL-F51 (v3.0.0-alpha.26) — Roteiro deste relatório: em que passo ele está e o botão do próximo passo.
 * O passo vem do motor (roteiroDoRelatorio, 64-roteiro.js), pelo que já existe; nada a preencher. */
function rodadasDoRelatorio(cod, un) {
  return (S.rodadas || []).filter(r => r.tipo === 'conferencia' && competenciaDaRodada(r) === S.comp && String(r.prestadorCod) === String(cod) && String(r.unidadeCod) === String(un));
}
function enviadoDoRelatorio(x) {
  const g = grDoRel(x), d = S.fluxo?.competencias?.[S.comp]?.grupos?.[g]?.documental?.[x.rel.cab.prestadorCod];
  return d?.relatorio || '';
}
function roteiroDe(x, un) {
  const rods = rodadasDoRelatorio(x.rel.cab.prestadorCod, un);
  return roteiroDoRelatorio({ pdf: { nome: x.nome, hash: x.hash }, rodadas: rods, idx: indiceDecisoesComp(), enviado: enviadoDoRelatorio(x) });
}
// Unidade do relatório para o roteiro: a escolhida (se for o selecionado), a da pasta/nome, ou a da última rodada.
function unidadeParaRoteiro(x) {
  if ($('cfRel') && $('cfRel').value === x.id && $('cfUn')?.value) return $('cfUn').value;
  const u = unDoRel(x); if (u) return u;
  const r = (S.rodadas || []).filter(y => y.tipo === 'conferencia' && competenciaDaRodada(y) === S.comp && String(y.prestadorCod) === String(x.rel.cab.prestadorCod)).sort((a, b) => b.em.localeCompare(a.em))[0];
  return r?.unidadeCod || '';
}
function desenharRoteiroConf() {
  const c = $('cfRoteiro'); if (!c) return;
  const x = $('cfRel') ? relSelecionado('cf') : null, un = $('cfUn')?.value || '';
  if (!x || !un) { c.innerHTML = ''; return; }
  const rt = roteiroDe(x, un), mesmo = S.conf && S.conf.ctx.chaveCompetencia === S.comp && S.conf.ctx.relId === x.id && String(S.conf.ctx.unidadeCod) === String(un);
  const ult = rt.rodada, sub = `${esc(x.rel.cab.prestadorCod)} - ${esc(x.rel.cab.prestadorNome)}${ult ? ` · ${rodadasDoRelatorio(x.rel.cab.prestadorCod, un).length} rodada(s), última ${new Date(ult.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ' · nenhuma rodada nesta competência'}`;
  const bt = (k, t, sec = false) => `<button type="button"${sec ? ' class="sec"' : ''} data-rot="${k}">${t}</button>`;
  const rodar = mesmo ? '' : bt('rodar', ult ? 'Abrir a última conferência' : 'Executar conferência');
  const texto = [
    () => [`<b>Passo 1:</b> gere no MV a <b>versão hospitalar</b> (com o valor total) e salve na pasta da competência, em «Relatórios para conferência». ${pastaConectadaConf() ? 'Depois, sincronize a pasta.' : 'Ou carregue o PDF no Início.'}`, pastaConectadaConf() ? botaoSyncPasta('cf') : bt('inicio', 'Ir para o Início')],
    () => [ult ? `<b>Passo 2:</b> faltam <b>${rt.pendentes} decisão(ões)</b>. Em «O que falta decidir», aceite para pagamento, registre NC ou marque «Resolvido no MV» o que você vai corrigir lá.` : '<b>Passo 2:</b> execute a conferência deste relatório e decida o que ficar pendente.', ult ? (mesmo ? bt('decidir', 'Começar pelas decisões') : rodar) : bt('rodar', 'Executar conferência')],
    () => [`<b>Passo 3:</b> ${rt.alerta ? '<b style="color:var(--err)">o PDF novo ainda traz</b>' : 'você marcou'} ${[rt.resolvidos && `<b>${rt.resolvidos} linha(s) «Resolvido no MV»</b>`, rt.ncs && `<b>${rt.ncs} NC</b>`].filter(Boolean).join(' e ')} ${rt.alerta ? '— corrija no MV antes de seguir.' : 'para corrigir.'} Depois de corrigir no MV, gere a versão hospitalar de novo, substitua o PDF na pasta e confira de novo: as decisões já tomadas continuam valendo.`, mesmo ? `${bt('nc', 'Ver o que corrigir', true)}${botaoReconferir(S.conf.ctx)}` : rodar],
    () => ['<b>Passo 4:</b> há um <b>PDF novo</b> deste relatório. Confira de novo: a ferramenta reaplica as decisões e mostra se as correções saíram do MV.', bt('rodar', 'Conferir o PDF novo')],
    () => ['<b>Passo 5:</b> nada falta decidir nem corrigir. Registre o aceite: o valor desta rodada passa a ser o do Fechamento.', mesmo ? bt('aceite', 'Ir para o aceite') : rodar],
    () => ['<b>Passo 6:</b> o relatório está aceito. Tire no MV a <b>versão final</b> (sem o valor total e sem a %), salve e envie por e-mail com a prévia de todas as unidades. Depois, marque <b>E-mail</b> na linha do prestador em Fechamento e envio.', bt('fechamento', 'Abrir no Fechamento')],
    () => ['<b>Concluído:</b> aceito e e-mail marcado. Depois vêm NF recebida e NF ao Financeiro, na linha do prestador em Fechamento e envio.', bt('fechamento', 'Abrir no Fechamento', true)]
  ][rt.passo]();
  c.innerHTML = `<section class="card roteiro" aria-labelledby="cfRotTit"><div class="rot-cab"><h2 id="cfRotTit">Roteiro deste relatório</h2><span class="small muted">${sub}</span></div>
    <ol class="rot-passos">${PASSOS_ROTEIRO.map((ps, i) => { const cls = i < rt.passo ? 'feito' : i === rt.passo ? `atual${rt.alerta ? ' alerta' : ''}` : '';
      return `<li class="rot-passo ${cls}"${i === rt.passo ? ' aria-current="step"' : ''}><span class="n">${i < rt.passo ? '✓' : i + 1}</span><b>${esc(ps.nome)}</b><small>${esc(rt.detalhes[i] || ps.dica)}</small></li>`; }).join('')}</ol>
    <div class="rot-agora"><p>${texto[0]}</p><div class="acoes">${texto[1]}</div></div></section>`;
  c.querySelectorAll('[data-rot]').forEach(b => b.onclick = () => {
    const k = b.dataset.rot;
    if (k === 'rodar') return $('cfRodar')?.click();
    if (k === 'inicio') { location.hash = 'inicio'; return; }
    if (k === 'fechamento') { FH.sub = ['usg', 'img', 'curitiba'].includes(grDoRel(x)) ? grDoRel(x) : 'usg'; FH.fSit = null; location.hash = 'fechamento'; return; }
    irAbaConf(k);
  });
  if (mesmo) ligarReconferir(c);
  desenharRoteiroRelatorios();
}
// Passo de cada relatório da lista (filtro de unidade e grupo), em «O que conferir». Pedido de 24/11/2026: com dezenas de
// relatórios os botões ocupavam a tela toda; agora é uma linha com a contagem por passo e uma lista recolhível, com rolagem
// e busca (prévia em docs/prototipos/roteiro-relatorios-compacto.html). Clicar numa linha escolhe o relatório.
const RR = { aberto: null, passo: null, q: '' };
function desenharRoteiroRelatorios() {
  const alvo = $('cfRotRels'); if (!alvo || !$('cfRel')) return;
  const ids = [...$('cfRel').options].map(o => o.value), lista = ids.map(id => S.relatorios.find(r => r.id === id)).filter(Boolean);
  if (lista.length < 2) { alvo.innerHTML = ''; return; }
  const itens = lista.map(x => { const un = unidadeParaRoteiro(x), rt = un ? roteiroDe(x, un) : null;
    const k = !rt ? 'sem' : rt.passo >= 6 ? 'env' : 'p' + (rt.passo + 1);
    return { x, un, k, rot: !rt ? 'sem unidade' : rt.passo >= 6 ? '✓ enviado' : `passo ${rt.passo + 1}` }; });
  const cont = {}; itens.forEach(i => { cont[i.k] = cont[i.k] || { n: 0, rot: i.rot }; cont[i.k].n++; });
  const ordem = Object.keys(cont).sort((a, b) => (a === 'sem' ? -1 : b === 'sem' ? 1 : a === 'env' ? 1 : b === 'env' ? -1 : a.localeCompare(b, 'pt', { numeric: true })));
  if (RR.passo && !cont[RR.passo]) RR.passo = null;
  const aberto = RR.aberto ?? lista.length <= 8, sel = $('cfRel').value, q = norm(RR.q);
  const vis = itens.filter(i => (!RR.passo || i.k === RR.passo) && (!q || norm(`${i.x.rel.cab.prestadorCod} ${i.x.rel.cab.prestadorNome} UN ${i.un} ${rotGr(grDoRel(i.x))}`).includes(q)));
  alvo.innerHTML = `<div class="rr-topo"><span class="small muted">Em que passo está cada relatório:</span>${ordem.map(k => `<button type="button" class="marc${RR.passo === k ? ' sel' : ''}" data-rrpasso="${k}">${esc(cont[k].rot)} <i>${cont[k].n}</i></button>`).join('')}
    <button type="button" class="sec mini" data-rrabrir aria-expanded="${aberto}">${aberto ? 'Recolher ▴' : 'Ver lista ▾'}</button></div>
    ${aberto ? `<div class="rr-lista"><div class="rr-busca"><input id="rrBusca" placeholder="Buscar prestador ou unidade…" value="${esc(RR.q)}"><span class="small muted">${vis.length} de ${lista.length}${RR.passo ? ' · ' + esc(cont[RR.passo].rot) : ''}</span></div>
      <div class="rr-rolar"><table><thead><tr><th>Prestador</th><th>Un.</th><th>Grupo</th><th>Passo</th></tr></thead><tbody>${vis.map(i => `<tr data-rotrel="${esc(i.x.id)}"${i.x.id === sel ? ' class="sel"' : ''}><td>${esc(i.x.rel.cab.prestadorCod)} - ${esc(i.x.rel.cab.prestadorNome)}</td><td>${esc(i.un || '—')}</td><td>${esc(rotGr(grDoRel(i.x)))}</td><td>${esc(i.rot)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
  alvo.querySelectorAll('[data-rrpasso]').forEach(b => b.onclick = () => { const k = b.dataset.rrpasso; RR.passo = RR.passo === k ? null : k; if (RR.passo) RR.aberto = true; desenharRoteiroRelatorios(); });
  alvo.querySelector('[data-rrabrir]').onclick = () => { RR.aberto = !aberto; desenharRoteiroRelatorios(); };
  const bu = $('rrBusca'); if (bu) bu.oninput = () => { RR.q = bu.value; const pos = bu.selectionStart; desenharRoteiroRelatorios(); const n = $('rrBusca'); n.focus(); n.setSelectionRange(pos, pos); };
  alvo.querySelectorAll('[data-rotrel]').forEach(t => t.onclick = () => { $('cfRel').value = t.dataset.rotrel; $('cfRel').dispatchEvent(new Event('change')); });
  const linhaSel = alvo.querySelector('tr.sel'), rolar = alvo.querySelector('.rr-rolar'); if (linhaSel && rolar) rolar.scrollTop = Math.max(0, linhaSel.offsetTop - 60);
}
