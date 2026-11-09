/* ============================================================
 * Fluxo mensal: acompanhamento da competência e manutenção do modelo de fluxos
 * ============================================================ */
const FX = { sub: 'acomp', chave: null, abertos: new Set(), filtro: 'todos', busca: '' };
const OPCOES_STATUS = Object.entries(STATUS_TAREFA);
const CLS_STATUS = { ni: 's-ni', and: 's-and', ter: 's-ter', cor: 's-cor', ok: 's-ok', na: 's-na' };
const stTarefa = k => `<span class="stt ${CLS_STATUS[k]}">${esc(STATUS_TAREFA[k])}</span>`;
const fmtCurta = d => d ? fmtData(d).slice(0, 5) : '—';

function carregarFluxo() {
  const f = lerLocal(CHAVES.fluxo);
  S.fluxo = f && !validarFluxo(f).length ? f : { schema: SCHEMA_FLUXO, versaoSchema: 1, modelo: modeloFluxoPadrao(), competencias: {} };
}
function salvarFluxo(msg = '') {
  if (!gravarLocal(CHAVES.fluxo, S.fluxo)) avisar('Não foi possível gravar o fluxo neste navegador. Exporte um backup em Configurações.', 'err');
  else if (msg) avisar(msg, 'ok');
  atualizarNavFluxo();
}
const chaveAtual = () => { const d = new Date(); return chaveCompetencia(d.getFullYear(), d.getMonth() + 1); };
const compAtual = () => S.fluxo.competencias[FX.chave] || null;
// Competência fechada: a aba continua navegável (grupos, filtros, busca, exportação), mas nada se altera.
function travarSeFechada(el) {
  if (!el || !compFechada(FX.chave)) return;
  el.querySelectorAll('input:not([type=search]), select, textarea, button:not([data-tg]):not([data-f]):not(#fxExp)').forEach(x => { x.disabled = true; });
}
function atualizarNavFluxo() {
  const c = S.fluxo?.competencias[S.comp || chaveAtual()], b = $('navFluxo'); if (!b) return;
  const n = c ? indicadoresFluxo(c).vencidas.length : 0;
  b.hidden = !n; b.textContent = n;
  const a = b.closest('a'), nome = n ? `Fluxo mensal · ${n} etapa(s) com prazo vencido` : 'Fluxo mensal';
  a.setAttribute('aria-label', nome); a.querySelector('.dica').textContent = nome; sincronizarPontos();
}
const nomeTarefaRef = (comp, gId, ref) => {
  const [g, t] = ref.includes('.') ? ref.split('.') : [gId, ref];
  const grupo = comp.modelo.grupos.find(x => x.id === g), tarefa = grupo?.tarefas.find(x => x.id === t);
  return tarefa ? { g, t, nome: (g !== gId ? grupo.nome + ': ' : '') + tarefa.nome, status: comp.grupos[g]?.tarefas[t]?.status } : null;
};

RENDER.fluxo = async () => {
  if (DB.ok) S.rodadas = await dbTodas();   // sugestões e classificação usam as rodadas mais recentes
  FX.chave = S.comp || chaveAtual();
  const p = $('pag-fluxo');
  p.innerHTML = `<div class="subabas" role="tablist"><button role="tab" class="${FX.sub === 'acomp' ? 'on' : ''}" data-sub="acomp" aria-selected="${FX.sub === 'acomp'}">Acompanhamento</button><button role="tab" class="${FX.sub === 'divisao' ? 'on' : ''}" data-sub="divisao" aria-selected="${FX.sub === 'divisao'}">Divisão do trabalho</button><button role="tab" class="${FX.sub === 'modelo' ? 'on' : ''}" data-sub="modelo" aria-selected="${FX.sub === 'modelo'}">Modelo e prazos</button></div><div id="fxCorpo"></div>`;
  p.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { FX.sub = b.dataset.sub; RENDER.fluxo(); });
  FX.sub === 'modelo' ? desenharModeloFluxo() : FX.sub === 'divisao' ? desenharDivisaoFluxo() : desenharAcompanhamento();
};

/* ---------------- Acompanhamento ---------------- */
function desenharAcompanhamento() {
  const c = $('fxCorpo'), comp = compAtual();
  const cab = `<div class="fx-topo"><h2 class="fx-titulo">Checklist da competência ${rotuloCompetencia(FX.chave)}</h2>
    <div class="acoes" style="margin:0">${comp ? '<button class="sec" id="fxExp">Exportar situação (.xlsx)</button>' : ''}</div></div>`;
  if (!comp) {
    const existentes = Object.keys(S.fluxo.competencias).sort().reverse();
    c.innerHTML = cab + `<div class="card"><h2>Competência ${rotuloCompetencia(FX.chave)} ainda não iniciada</h2><p class="lead">O checklist do mês é criado a partir do modelo de fluxos (revisão ${S.fluxo.modelo.revisao}): grupos, etapas, prazos e listas de prestadores. Depois de criado, mudanças no modelo não alteram este mês.</p>
      <div class="acoes"><button id="fxCriar">Iniciar competência ${rotuloCompetencia(FX.chave)}</button><button class="sec" id="fxIrModelo">Revisar o modelo antes</button></div>
      ${existentes.length ? `<p class="small muted" style="margin-top:12px">Competências registradas: ${existentes.map(k => `<a href="#" data-k="${k}">${rotuloCompetencia(k)}</a>`).join(' · ')}</p>` : ''}</div>`;
    $('fxCriar').onclick = () => { if (!exigirAberta(FX.chave, 'iniciar o checklist')) return; S.fluxo.competencias[FX.chave] = novaCompetencia(S.fluxo.modelo, FX.chave, S.operador); salvarFluxo(`Competência ${rotuloCompetencia(FX.chave)} iniciada.`); RENDER.fluxo(); oferecerLimpezaNaTroca(); };
    $('fxIrModelo').onclick = () => { FX.sub = 'modelo'; RENDER.fluxo(); };
    c.querySelectorAll('[data-k]').forEach(a => a.onclick = e => { e.preventDefault(); mudarCompetencia(a.dataset.k); });
  } else {
    // SOL-F14: prestadores de USG, IMG e Curitiba vêm de Bases (só inclui; remover é manual).
    if (!compFechada(FX.chave)) { const n = sincronizarDocumentalComBases(comp); if (n) { salvarFluxo(); FX.incluidosBases = n; } }
    const ind = indicadoresFluxo(comp), hoje = diaSerial(paraData(new Date()));
    const prox = [...ind.vencidas, ...ind.proximas].sort((a, b) => a.prazo - b.prazo).slice(0, 4);
    const pend = ['and', 'ter', 'cor'].reduce((a, k) => a + ind[k], 0);
    c.innerHTML = cab + `
    <div class="grid3 fx-kpis">
      <div class="card kpi"><h3>Operacional</h3><dl>
        <div><dt>Etapas concluídas</dt><dd>${ind.ok} de ${ind.total}</dd></div><div><dt>Em andamento · aguardando terceiros</dt><dd>${ind.and} · ${ind.ter}</dd></div>
        <div><dt>Pendentes de correção</dt><dd class="${ind.cor ? 'txt-err' : ''}">${ind.cor}</dd></div><div><dt>Prazos vencidos · vencem em 3 dias</dt><dd><span class="${ind.vencidas.length ? 'txt-err' : ''}">${ind.vencidas.length}</span> · <span class="${ind.proximas.length ? 'txt-warn' : ''}">${ind.proximas.length}</span></dd></div></dl></div>
      <div class="card kpi"><h3>Entrega documental</h3><dl>
        <div><dt>Relatórios e prévias enviados</dt><dd>${ind.doc.enviados} de ${ind.doc.previstos}</dd></div><div><dt>Notas fiscais recebidas</dt><dd>${ind.doc.nfRecebidas} de ${ind.doc.previstos}</dd></div>
        <div><dt>NFs encaminhadas ao Financeiro</dt><dd>${ind.doc.nfFinanceiro} de ${ind.doc.nfRecebidas}</dd></div><div><dt>Prestadores com documentação incompleta</dt><dd class="${ind.doc.incompletos ? 'txt-err' : ''}">${ind.doc.incompletos}</dd></div></dl></div>
      <div class="card kpi"><h3>Prazos</h3><dl>${prox.length ? prox.map(x => `<div><dt>${esc(x.nome)}</dt><dd class="${x.dias < 0 ? 'txt-err' : 'txt-warn'}">${x.dias < 0 ? `vencido há ${-x.dias} d` : x.dias === 0 ? 'hoje' : `${fmtCurta(x.prazo)} · ${x.dias} d`}</dd></div>`).join('') : '<div><dt>Nenhum prazo vencido ou próximo</dt><dd class="txt-ok">✓</dd></div>'}
        <div><dt>Etapas abertas</dt><dd>${pend + ind.ni}</dd></div></dl></div></div>
    <div class="card"><h3>Marcos da competência <span class="muted small">— clique para ajustar a data (com justificativa)</span></h3><div class="marcos-linha">${ind.marcos.map(m => {
      const d = diaSerial(m.data) - hoje;
      return `<button class="marco ${d === 0 ? 'hoje' : d < 0 ? 'passado' : d <= 3 ? 'prox' : ''}" data-marco="${m.id}" title="${esc(descreverRegra(m.regra, comp.modelo.marcos))}${m.manual ? ` · data manual: ${esc(m.justificativa)}` : ''}"><b>${fmtCurta(m.data)}${d === 0 ? ' · HOJE' : ''}${m.manual ? ' ✎' : ''}</b>${esc(m.nome)}<small>${esc(descreverRegra(m.regra, comp.modelo.marcos))}</small></button>`;
    }).join('')}</div></div>
    <div class="fx-filtros"><div class="marcadores" style="margin:0">${[['todos', 'Todas as etapas'], ['vencidas', 'Vencidas'], ['proximas', 'Vencem em 3 dias'], ['ter', 'Aguardando terceiros'], ['cor', 'Pendente de correção'], ['abertas', 'Não concluídas']].map(([k, t]) => `<button class="marc${FX.filtro === k ? ' sel' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
      <input type="search" id="fxBusca" placeholder="Buscar etapa, prestador ou observação…" value="${esc(FX.busca)}"></div>
    <div id="fxGrupos"></div>
    <div class="card" id="fxEntrega"></div>
    <div class="card" id="fxNotas"></div>`;
    $('fxExp').onclick = () => baixarZip(xlsxFluxo(comp), `Fluxo_mensal_${FX.chave}_${carimbo()}.xlsx`);
    c.querySelectorAll('[data-marco]').forEach(b => b.onclick = () => ajustarMarco(comp, b.dataset.marco));
    c.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { FX.filtro = b.dataset.f; desenharAcompanhamento(); });
    $('fxBusca').oninput = e => { FX.busca = e.target.value; desenharGrupos(comp); };
    desenharGrupos(comp); desenharEntrega(comp, ind); desenharNotas(comp);
  }
  travarSeFechada(c);
}

async function ajustarMarco(comp, id) {
  const m = comp.modelo.marcos.find(x => x.id === id), atual = comp.marcosManuais[id];
  const calc = calcularMarcos(comp.modelo, ...comp.chave.split('-').map(Number), comp.modelo.calendario).datas[id];
  const r = await dialogo(`Data de «${m.nome}»`, `<p class="small">Regra: ${esc(descreverRegra(m.regra, comp.modelo.marcos))} → <strong>${fmtData(calc)}</strong>. Prazos que dependem deste marco são recalculados.</p>
    <label class="campo">Data efetiva nesta competência<input type="date" name="data" value="${esc(atual?.data || isoDia(calc))}"></label>
    <label class="campo">Justificativa (obrigatória para exceção)<input type="text" name="just" value="${esc(atual?.justificativa || '')}"></label>`,
    [['', 'Cancelar', 'sec'], ...(atual ? [['limpar', 'Voltar à regra', 'sec']] : []), ['ok', 'Salvar']]);
  if (r.botao === 'limpar') { delete comp.marcosManuais[id]; salvarFluxo('Marco voltou à regra.'); return desenharAcompanhamento(); }
  if (r.botao !== 'ok' || !r.campos.data) return;
  if (r.campos.data === isoDia(calc)) { delete comp.marcosManuais[id]; salvarFluxo(); return desenharAcompanhamento(); }
  if (!r.campos.just.trim()) return avisar('Informe a justificativa da exceção de data.', 'warn');
  comp.marcosManuais[id] = { data: r.campos.data, justificativa: r.campos.just.trim(), por: S.operador, em: agoraISO() };
  salvarFluxo('Data do marco ajustada nesta competência.'); desenharAcompanhamento();
}

function passaFiltro(comp, g, t, mk) {
  const e = comp.grupos[g.id].tarefas[t.id]; if (!e) return false;
  const q = norm(FX.busca);
  if (q && !norm(`${t.nome} ${e.obs} ${e.responsavel}`).includes(q)) return false;
  const p = prazoTarefa(comp, g.id, t, mk), dif = p ? diaSerial(p) - diaSerial(paraData(new Date())) : null, aberta = e.status !== 'ok' && e.status !== 'na';
  switch (FX.filtro) {
    case 'vencidas': return aberta && dif !== null && dif < 0;
    case 'proximas': return aberta && dif !== null && dif >= 0 && dif <= 3;
    case 'ter': case 'cor': return e.status === FX.filtro;
    case 'abertas': return aberta;
    default: return true;
  }
}

function desenharGrupos(comp) {
  FX.sug = sugestoesFluxo(comp);
  const ind = indicadoresFluxo(comp), mk = ind.mk, cont = $('fxGrupos'), filtrando = FX.filtro !== 'todos' || FX.busca;
  const blocos = [];
  for (const g of comp.modelo.grupos) {
    const eg = comp.grupos[g.id]; if (!eg) continue;
    const tarefas = g.tarefas.filter(t => passaFiltro(comp, g, t, mk));
    if (filtrando && !tarefas.length) continue;
    const pg = ind.porGrupo[g.id], aberto = filtrando || FX.abertos.has(g.id), pp = pg.proximoPrazo;
    const deps = [...new Set(g.tarefas.flatMap(t => (t.depende || []).filter(d => d.includes('.'))))].map(d => nomeTarefaRef(comp, g.id, d)).filter(Boolean);
    blocos.push(`<section class="grupo-fx${aberto ? ' aberto' : ''}" data-g="${g.id}">
      <button class="gcab" data-tg="${g.id}" aria-expanded="${aberto}"><span class="seta" aria-hidden="true">▶</span>
        <span class="gnome"><b>${esc(g.nome)}</b><small>${esc(g.desc || '')}</small></span>
        <span class="gprog"><span class="barra"><i style="width:${pg.total ? Math.round(100 * pg.ok / pg.total) : 0}%"></i></span><small>${pg.ok} de ${pg.total} etapas</small></span>
        <span class="gprazo">${pp ? `<span class="${pp.dias < 0 ? 'txt-err' : pp.dias <= 3 ? 'txt-warn' : ''}">${pp.dias < 0 ? 'vencido · ' : pp.dias === 0 ? 'hoje · ' : ''}${fmtCurta(pp.prazo)} ${esc(pp.nome.length > 38 ? pp.nome.slice(0, 36) + '…' : pp.nome)}</span>` : '<span class="muted">sem prazo aberto</span>'}
          ${deps.map(d => `<small class="dep">Depende de: ${esc(d.nome)} ${d.status === 'ok' ? '✓' : `(${esc(STATUS_TAREFA[d.status] || '—')})`}</small>`).join('')}</span>
        ${stTarefa(pg.status)}</button>
      <div class="gcorpo">${aberto ? corpoGrupo(comp, g, tarefas, mk) : ''}</div></section>`);
  }
  cont.innerHTML = blocos.join('') || '<div class="card"><p class="muted">Nenhuma etapa corresponde ao filtro.</p></div>';
  cont.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => { const id = b.dataset.tg; FX.abertos.has(id) ? FX.abertos.delete(id) : FX.abertos.add(id); desenharGrupos(comp); });
  ligarGrupos(comp);
  travarSeFechada(cont);
}

function corpoGrupo(comp, g, tarefas, mk) {
  const eg = comp.grupos[g.id];
  let h = (g.regrasFixas || []).map(r => `<p class="regra-fixa">📌 ${esc(r)}</p>`).join('');
  if (g.id === 'nc' && S.nc) {
    const ind = indicadoresNC(S.nc.itens.filter(x => x.competencia === comp.chave));
    h += `<p class="small">Não conformidades desta competência: <b>${ind.total}</b> · ${ind.porSituacao.aberta} abertas · ${ind.porSituacao.enviada + ind.porSituacao.tratativa} enviadas ao Qualiex · ${ind.porSituacao.regularizada} regularizadas — <a href="#nc">abrir a aba Não conformidades</a></p>`;
  }
  h += `<div class="tw"><table class="tab-fx"><thead><tr><th>Etapa</th><th>Status</th><th>Prazo</th><th>Início</th><th>Concluída em</th><th>Responsável / dependência</th><th>Observação</th></tr></thead><tbody>${tarefas.map(t => {
    const e = eg.tarefas[t.id], p = prazoTarefa(comp, g.id, t, mk), dif = p ? diaSerial(p) - diaSerial(paraData(new Date())) : null, aberta = e.status !== 'ok' && e.status !== 'na';
    const deps = (t.depende || []).map(d => nomeTarefaRef(comp, g.id, d)).filter(d => d && d.status !== 'ok' && d.status !== 'na');
    const rods = rodadasParaTarefa(S.rodadas, comp, t.vinculo);
    return `<tr data-t="${t.id}"><td class="t-nome">${t.marco ? '<span class="badge info">marco</span> ' : ''}${esc(t.nome)}
        ${e.evidencias?.length ? `<small class="evid">📎 ${esc(e.evidencias.at(-1).desc)} em ${new Date(e.evidencias.at(-1).em).toLocaleDateString('pt-BR')}${e.evidencias.length > 1 ? ` (${e.evidencias.length}×)` : ''} — evidência, não conclui a etapa</small>` : ''}
        ${(() => { const sg = sugestaoDaTarefa(FX.sug || {}, g.id, t.id, e.status); return sg ? `<small class="sug-fx">💡 Sugestão: <b>${esc(STATUS_TAREFA[sg.status])}</b> — ${esc(sg.texto)} <button type="button" class="sec mini" data-sug="${t.id}">Confirmar</button></small>` : ''; })()}
        ${deps.length ? `<small class="dep">aguarda: ${deps.map(d => esc(d.nome)).join('; ')} (aviso, não bloqueia)</small>` : ''}
        ${t.vinculo ? (rods.length ? `<small><a href="#" data-rod="${t.id}">${rods.length} rodada(s) de ${t.vinculo === 'conferencia' ? 'conferência' : 'correção'} neste mês${e.rodada ? ' · vinculada ✓' : ' — vincular e confirmar'}</a></small>` : `<small class="muted">sem rodada de ${t.vinculo === 'conferencia' ? 'conferência' : 'correção'} neste mês</small>`) : ''}</td>
      <td><select data-c="status" class="sel-${e.status}" aria-label="Status">${opcoes(OPCOES_STATUS, e.status)}</select></td>
      <td class="nw"><button class="lnk ${aberta && dif !== null ? (dif < 0 ? 'txt-err' : dif <= 3 ? 'txt-warn' : '') : ''}" data-prazo="${t.id}" title="${e.prazoManual ? 'Prazo ajustado: ' + esc(e.prazoJust || '') : t.prazo ? esc(descreverRegra(t.prazo, comp.modelo.marcos)) : 'sem prazo — clique para definir'}">${p ? fmtCurta(p) : '—'}${e.prazoManual ? ' ✎' : ''}</button></td>
      <td><input type="date" data-c="inicio" value="${esc(e.inicio)}" aria-label="Início"></td><td><input type="date" data-c="conclusao" value="${esc(e.conclusao)}" aria-label="Concluída em"></td>
      <td><input type="text" data-c="responsavel" value="${esc(e.responsavel)}" aria-label="Responsável ou dependência"></td><td><input type="text" data-c="obs" value="${esc(e.obs)}" aria-label="Observação"></td></tr>`;
  }).join('')}</tbody></table></div>`;
  if (eg.documental) h += blocoDocumental(comp, g);
  if (eg.classificacao) h += blocoClassificacao(comp, g);
  if (eg.matriz && g.matriz) h += blocoMatriz(comp, g);
  h += `<label class="campo obs-sec">Observações da seção<textarea data-obs="${g.id}" rows="2" placeholder="Ex.: aguardando conclusão de laudos, correção pendente no MV, alteração excepcional no calendário…">${esc(eg.obs)}</textarea></label>`;
  return h;
}

function blocoDocumental(comp, g) {
  const lista = Object.values(comp.grupos[g.id].documental);
  const deBases = GRUPOS_FLUXO_BASES[g.id];
  return `<h4 class="sub-fx">Controle documental por prestador</h4>${deBases ? `<p class="small muted">A lista vem de Bases (${g.id === 'usg' ? 'prestadores com faixa de USG' : g.id === 'img' ? 'prestadores que recebem IMG' : 'médicos V3'}); quem for cadastrado lá entra aqui sozinho. Remover daqui vale só para este mês.</p>` : ''}<div class="tw"><table class="tab-fx"><thead><tr><th>Prestador</th><th>Relatório e prévia enviados</th><th>NF recebida</th><th>NF encaminhada ao Financeiro</th><th>Pendência</th><th></th></tr></thead><tbody>${lista.length ? lista.map(d => `<tr data-doc="${esc(d.cod)}">
      <td>${esc(d.cod)} · ${esc(d.nome)}${d.unidade ? ` <small class="muted">unid. ${esc(d.unidade)}</small>` : ''}${d.origem === 'Bases' ? ' <small class="muted" title="Incluído automaticamente pelas regras de Bases">· Bases</small>' : ''}</td>
      <td><input type="date" data-d="relatorio" value="${esc(d.relatorio)}" aria-label="Relatório enviado em"></td><td><input type="date" data-d="nfRecebida" value="${esc(d.nfRecebida)}" aria-label="NF recebida em"></td>
      <td><input type="date" data-d="nfFinanceiro" value="${esc(d.nfFinanceiro)}" aria-label="NF encaminhada em"></td><td><input type="text" data-d="pendencia" value="${esc(d.pendencia)}" aria-label="Pendência"></td>
      <td><button class="perigo ic" data-docrm="${esc(d.cod)}" title="Remover deste mês" aria-label="Remover deste mês">✕</button></td></tr>`).join('') : '<tr><td colspan="6" class="muted">Nenhum prestador neste fluxo. Adicione abaixo ou cadastre a lista no modelo.</td></tr>'}</tbody></table></div>
    <div class="acoes"><button class="sec" data-docadd="${g.id}">+ Prestador</button><button class="sec" data-docmv="${g.id}">Importar dos relatórios do MV carregados</button><button class="sec" data-docmodelo="${g.id}">Salvar esta lista no modelo</button></div>`;
}
function blocoMatriz(comp, g) {
  const un = S.cfg.unidades.filter(u => !(g.matriz.excetoUnidades || []).includes(String(u.cod))), mz = comp.grupos[g.id].matriz;
  return `<h4 class="sub-fx">Andamento por unidade (cada unidade avança no seu ritmo)</h4><div class="tw"><table class="tab-fx"><thead><tr><th>Unidade</th>${g.matriz.colunas.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${un.map(u => `<tr data-un="${esc(u.cod)}"><td>${esc(u.cod)} · ${esc(u.nome)}</td>${g.matriz.colunas.map((c, i) => `<td><select data-col="${i}" aria-label="${esc(c)} — ${esc(u.nome)}">${opcoes(OPCOES_STATUS, mz[u.cod]?.[i] || 'ni')}</select></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function ligarGrupos(comp) {
  const cont = $('fxGrupos');

  cont.querySelectorAll('section.grupo-fx').forEach(sec => {
    const gId = sec.dataset.g, eg = comp.grupos[gId], g = comp.modelo.grupos.find(x => x.id === gId);
    sec.querySelectorAll('tr[data-t]').forEach(tr => {
      const tId = tr.dataset.t, e = eg.tarefas[tId];
      tr.querySelectorAll('[data-c]').forEach(inp => inp.onchange = () => {
        const c = inp.dataset.c;
        if (c === 'status') { mudarStatusTarefa(comp, gId, tId, inp.value, S.operador); salvarFluxo(); desenharAcompanhamento(); return; }
        e[c] = inp.value.trim(); e.historico.push({ em: agoraISO(), por: S.operador, campo: c, valor: e[c] }); salvarFluxo();
      });
      const bp = tr.querySelector('[data-prazo]'); if (bp) bp.onclick = () => ajustarPrazo(comp, gId, g.tarefas.find(t => t.id === tId));
      const bs = tr.querySelector('[data-sug]'); if (bs) bs.onclick = () => {
        const sg = sugestaoDaTarefa(FX.sug || {}, gId, tId, e.status); if (!sg) return;
        mudarStatusTarefa(comp, gId, tId, sg.status, S.operador);
        e.historico.push({ em: agoraISO(), por: S.operador, campo: 'sugestão confirmada', valor: sg.texto });
        salvarFluxo(`Etapa marcada como «${STATUS_TAREFA[sg.status]}» (sugestão confirmada).`); desenharAcompanhamento();
      };
      const br = tr.querySelector('[data-rod]'); if (br) br.onclick = ev => { ev.preventDefault(); vincularRodada(comp, gId, g.tarefas.find(t => t.id === tId)); };
    });
    sec.querySelectorAll('[data-obs]').forEach(t => t.onchange = () => { eg.obs = t.value; salvarFluxo(); });
    sec.querySelectorAll('tr[data-doc]').forEach(tr => tr.querySelectorAll('[data-d]').forEach(inp => inp.onchange = () => { eg.documental[tr.dataset.doc][inp.dataset.d] = inp.value.trim(); salvarFluxo(); desenharEntrega(comp, indicadoresFluxo(comp)); }));
    sec.querySelectorAll('[data-docrm]').forEach(b => b.onclick = async () => { if (await confirmar('Remover prestador deste mês?', 'O registro documental deste prestador nesta competência será removido. O modelo não muda.', 'Remover')) { delete eg.documental[b.dataset.docrm]; eg.removidos = [...new Set([...(eg.removidos || []), b.dataset.docrm])]; salvarFluxo(); desenharAcompanhamento(); } });
    sec.querySelectorAll('[data-docadd]').forEach(b => b.onclick = () => adicionarPrestadorFluxo(comp, gId));
    sec.querySelectorAll('[data-docmv]').forEach(b => b.onclick = () => importarPrestadoresMV(comp, gId));
    sec.querySelectorAll('[data-docmodelo]').forEach(b => b.onclick = () => {
      S.fluxo.modelo.prestadores[gId] = Object.values(eg.documental).map(d => ({ cod: d.cod, nome: d.nome, unidade: d.unidade }));
      S.fluxo.modelo.revisao++; S.fluxo.modelo.atualizadoEm = agoraISO(); salvarFluxo('Lista de prestadores salva no modelo: será usada nas próximas competências.');
    });
    if (eg.classificacao) ligarClassificacao(comp, sec);
    sec.querySelectorAll('tr[data-un]').forEach(tr => tr.querySelectorAll('[data-col]').forEach(sel => sel.onchange = () => { (eg.matriz[tr.dataset.un] ||= [])[+sel.dataset.col] = sel.value; salvarFluxo(); }));
  });
}

async function ajustarPrazo(comp, gId, t) {
  const e = comp.grupos[gId].tarefas[t.id], mk = marcosDaCompetencia(comp), calc = t.prazo ? mk.prazoDe(t.prazo) : null;
  const r = await dialogo(`Prazo: ${t.nome}`, `<p class="small">${t.prazo ? `Regra: ${esc(descreverRegra(t.prazo, comp.modelo.marcos))} → <strong>${fmtData(calc) || '—'}</strong>.` : 'Esta etapa não tem prazo no modelo.'}</p>
    <label class="campo">Prazo nesta competência<input type="date" name="data" value="${esc(e.prazoManual || isoDia(calc))}"></label><label class="campo">Justificativa<input type="text" name="just" value="${esc(e.prazoJust || '')}"></label>`,
    [['', 'Cancelar', 'sec'], ...(e.prazoManual ? [['limpar', 'Voltar à regra', 'sec']] : []), ['ok', 'Salvar']]);
  if (r.botao === 'limpar') { e.prazoManual = ''; e.prazoJust = ''; salvarFluxo(); return desenharAcompanhamento(); }
  if (r.botao !== 'ok') return;
  if (calc && r.campos.data === isoDia(calc)) { e.prazoManual = ''; salvarFluxo(); return desenharAcompanhamento(); }
  if (calc && !r.campos.just.trim()) return avisar('Informe a justificativa para mudar um prazo calculado.', 'warn');
  e.prazoManual = r.campos.data; e.prazoJust = r.campos.just.trim();
  e.historico.push({ em: agoraISO(), por: S.operador, campo: 'prazo', valor: e.prazoManual, motivo: e.prazoJust }); salvarFluxo('Prazo ajustado nesta competência.'); desenharAcompanhamento();
}

// Rodada vinculada: evidência para o usuário confirmar. Nunca conclui a etapa sozinha.
async function vincularRodada(comp, gId, t) {
  const e = comp.grupos[gId].tarefas[t.id], rods = rodadasParaTarefa(S.rodadas, comp, t.vinculo);
  const r = await dialogo('Rodadas deste mês', `<p class="small">Escolha a rodada que comprova a etapa «${esc(t.nome)}». A etapa só é concluída se você marcar a opção abaixo.</p>
    ${rods.map(x => `<label class="opt-rod"><input type="radio" name="rod" value="${x.id}"${e.rodada === x.id ? ' checked' : ''}> ${new Date(x.em).toLocaleString('pt-BR')} · ${esc(x.prestadorCod)} - ${esc(x.prestadorNome)} · unid. ${esc(x.unidadeCod)}<br><small class="muted">${Object.entries(x.contagens).filter(([, n]) => n).map(([k, n]) => `${(STATUS_CONF[k] || ESTADO_CORR[k])?.nome || k}: ${n}`).join(' · ')}${x.aceite ? ' · aceite registrado' : ''}</small></label>`).join('')}
    <label class="small"><input type="checkbox" name="concluir"> marcar a etapa como concluída</label>`, [['', 'Cancelar', 'sec'], ['ok', 'Vincular']]);
  if (r.botao !== 'ok' || !r.campos.rod) return;
  e.rodada = r.campos.rod; e.historico.push({ em: agoraISO(), por: S.operador, campo: 'rodada', valor: e.rodada });
  if (r.campos.concluir) mudarStatusTarefa(comp, gId, t.id, 'ok', S.operador);
  salvarFluxo('Rodada vinculada à etapa.'); desenharAcompanhamento();
}

async function adicionarPrestadorFluxo(comp, gId) {
  const r = await dialogo('Adicionar prestador a este mês', `${campoBusca({ nome: 'nome', rotulo: 'Prestador', fonte: 'prestador', preencheCod: 'cod' })}
    <label class="campo">Código do prestador no MV<input type="text" name="cod"></label><label class="campo">Unidade (opcional)<select name="un"><option value="">—</option>${opcoes(S.cfg.unidades.map(u => [u.cod, `${u.cod} - ${u.nome}`]))}</select></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Adicionar']]);
  const cod = (r.campos.cod || '').trim(); if (r.botao !== 'ok' || !cod) return;
  const nome = r.campos.nome.trim() || S.cfg.prestadores.find(p => String(p.cod) === cod)?.nomeMV || '';
  const doc = comp.grupos[gId].documental; if (doc[cod]) return avisar('Este prestador já está na lista do mês.', 'warn');
  doc[cod] = novoDocumental({ cod, nome, unidade: r.campos.un }); comp.grupos[gId].removidos = (comp.grupos[gId].removidos || []).filter(c => c !== cod); salvarFluxo(); desenharAcompanhamento();
}
function importarPrestadoresMV(comp, gId) {
  if (!S.relatorios.length) return avisar('Carregue os relatórios do MV no Início para importar os prestadores dos cabeçalhos.', 'warn');
  const doc = comp.grupos[gId].documental; let n = 0;
  for (const x of S.relatorios) {
    const cod = x.rel.cab.prestadorCod; if (!cod || doc[cod]) continue;
    doc[cod] = novoDocumental({ cod, nome: x.rel.cab.prestadorNome, unidade: unidadeSugeridaPeloArquivo(x.nome) }); n++;
  }
  salvarFluxo(n ? `${n} prestador(es) importado(s) dos relatórios carregados.` : 'Nenhum prestador novo nos relatórios carregados.'); desenharAcompanhamento();
}

function desenharEntrega(comp, ind) {
  const c = $('fxEntrega'); if (!c) return;
  const nomes = Object.fromEntries(comp.modelo.grupos.map(g => [g.id, g.nome]));
  const pend = ind.doc.lista.filter(d => !(d.relatorio && d.nfRecebida && d.nfFinanceiro));
  c.innerHTML = `<h2>Entrega de relatórios e controle de notas fiscais</h2><p class="lead">Consolidado de todos os fluxos. Envio, NF recebida e NF encaminhada são registros independentes: uma nota recebida não conta como encaminhada.</p>
    <div class="grid4"><div><span class="badge info">${ind.doc.previstos}</span> prestadores previstos</div><div><span class="badge ${ind.doc.enviados === ind.doc.previstos ? 'ok' : 'warn'}">${ind.doc.enviados}</span> relatórios enviados</div>
    <div><span class="badge ${ind.doc.nfRecebidas === ind.doc.previstos ? 'ok' : 'warn'}">${ind.doc.nfRecebidas}</span> NFs recebidas</div><div><span class="badge ${ind.doc.nfFinanceiro === ind.doc.nfRecebidas && ind.doc.nfRecebidas ? 'ok' : 'warn'}">${ind.doc.nfFinanceiro}</span> NFs no Financeiro</div></div>
    <h4 class="sub-fx">Prestadores com documentação incompleta (${pend.length})</h4>
    ${pend.length ? `<div class="tw"><table class="tab-fx"><thead><tr><th>Fluxo</th><th>Prestador</th><th>Relatório</th><th>NF recebida</th><th>NF → Financeiro</th><th>Pendência</th></tr></thead><tbody>${pend.map(d => `<tr><td>${esc(nomes[d.grupo] || d.grupo)}</td><td>${esc(d.cod)} · ${esc(d.nome)}</td>
      <td>${d.relatorio ? '✓ ' + fmtCurta(paraData(d.relatorio)) : '<span class="txt-err">a enviar</span>'}</td><td>${d.nfRecebida ? '✓ ' + fmtCurta(paraData(d.nfRecebida)) : '<span class="txt-warn">aguardada</span>'}</td>
      <td>${d.nfFinanceiro ? '✓ ' + fmtCurta(paraData(d.nfFinanceiro)) : d.nfRecebida ? '<span class="txt-err">a encaminhar</span>' : '—'}</td><td class="muted">${esc(d.pendencia)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nenhuma pendência documental.</p>'}`;
}

function desenharNotas(comp) {
  const c = $('fxNotas'), grupos = comp.modelo.grupos;
  c.innerHTML = `<h2>Anotações da competência</h2><p class="lead">Bloco livre do mês, no lugar do bloco de notas e das anotações no e-mail.</p>
    <div class="nota-nova"><textarea id="fxNotaTxt" rows="2" placeholder="Escreva uma anotação…"></textarea><select id="fxNotaVinc" aria-label="Vínculo"><option value="">Geral</option>${opcoes(grupos.map(g => [g.id, g.nome]))}</select><button id="fxNotaAdd">Adicionar</button></div>
    <ul class="notas">${[...comp.anotacoes].reverse().map(n => `<li><div><small class="muted">${new Date(n.em).toLocaleString('pt-BR')}${n.por ? ' · ' + esc(n.por) : ''}${n.vinculo ? ' · ' + esc(grupos.find(g => g.id === n.vinculo)?.nome || n.vinculo) : ''}</small><p>${esc(n.texto)}</p></div><button class="perigo ic" data-nrm="${n.id}" aria-label="Apagar anotação">✕</button></li>`).join('') || '<li class="muted">Nenhuma anotação neste mês.</li>'}</ul>`;
  $('fxNotaAdd').onclick = () => {
    const t = $('fxNotaTxt').value.trim(); if (!t) return;
    comp.anotacoes.push({ id: novoId('n'), em: agoraISO(), por: S.operador, texto: t, vinculo: $('fxNotaVinc').value }); salvarFluxo(); desenharNotas(comp);
  };
  c.querySelectorAll('[data-nrm]').forEach(b => b.onclick = async () => { if (await confirmar('Apagar anotação?', 'A anotação será removida desta competência.', 'Apagar')) { comp.anotacoes = comp.anotacoes.filter(n => n.id !== b.dataset.nrm); salvarFluxo(); desenharNotas(comp); } });
}

function xlsxFluxo(comp) {
  const ind = indicadoresFluxo(comp), mk = ind.mk;
  const E = [cabecalho(['Grupo', 'Etapa', 'Status', 'Prazo', 'Prazo ajustado?', 'Início', 'Concluída em', 'Responsável / dependência', 'Observação', 'Rodada vinculada'])];
  for (const g of comp.modelo.grupos) for (const t of g.tarefas) {
    const e = comp.grupos[g.id]?.tarefas[t.id]; if (!e) continue;
    E.push([g.nome, t.nome, STATUS_TAREFA[e.status], prazoTarefa(comp, g.id, t, mk) || '', e.prazoManual ? `sim: ${e.prazoJust || ''}` : '', paraData(e.inicio) || '', paraData(e.conclusao) || '', e.responsavel, e.obs, e.rodada || '']);
  }
  const D = [cabecalho(['Fluxo', 'Código do prestador', 'Prestador', 'Unidade', 'Relatório enviado', 'NF recebida', 'NF encaminhada ao Financeiro', 'Pendência'])];
  for (const d of ind.doc.lista) D.push([comp.modelo.grupos.find(g => g.id === d.grupo)?.nome || d.grupo, { v: d.cod, st: { fmt: 'text' } }, d.nome, d.unidade, paraData(d.relatorio) || '', paraData(d.nfRecebida) || '', paraData(d.nfFinanceiro) || '', d.pendencia]);
  const M = [cabecalho(['Marco', 'Data', 'Regra', 'Ajuste manual'])];
  for (const m of ind.marcos) M.push([m.nome, m.data, descreverRegra(m.regra, comp.modelo.marcos), m.manual ? m.justificativa : '']);
  const R = [cabecalho(['Indicador', 'Valor']), ['Competência', rotuloCompetencia(comp.chave)], ['Etapas concluídas', `${ind.ok} de ${ind.total}`], ['Em andamento', ind.and], ['Aguardando terceiros', ind.ter], ['Pendentes de correção', ind.cor],
    ['Prazos vencidos', ind.vencidas.length], ['Vencem em 3 dias', ind.proximas.length], ['Relatórios enviados', `${ind.doc.enviados} de ${ind.doc.previstos}`], ['NFs recebidas', ind.doc.nfRecebidas], ['NFs encaminhadas ao Financeiro', ind.doc.nfFinanceiro],
    ['Documentação incompleta', ind.doc.incompletos], ['Gerado em', new Date().toLocaleString('pt-BR')], ['Operador', S.operador || '']];
  const N = [cabecalho(['Data', 'Autor', 'Vínculo', 'Anotação']), ...comp.anotacoes.map(n => [new Date(n.em).toLocaleString('pt-BR'), n.por, comp.modelo.grupos.find(g => g.id === n.vinculo)?.nome || 'Geral', n.texto])];
  const O = [cabecalho(['Grupo', 'Observações da seção']), ...comp.modelo.grupos.filter(g => comp.grupos[g.id]?.obs).map(g => [g.nome, comp.grupos[g.id].obs])];
  return criarXlsx([{ nome: 'Resumo', larguras: [36, 30], linhas: R, congelar: false }, { nome: 'Etapas', larguras: [34, 60, 20, 11, 24, 11, 11, 26, 50, 22], linhas: E, filtro: true },
    { nome: 'Documental', larguras: [34, 12, 34, 10, 14, 12, 18, 40], linhas: D, filtro: true }, { nome: 'Marcos', larguras: [40, 11, 50, 40], linhas: M },
    { nome: 'Observações', larguras: [40, 100], linhas: O }, { nome: 'Anotações', larguras: [18, 20, 30, 100], linhas: N }]);
}

/* ---------------- Modelo e prazos ---------------- */
const TIPOS_REGRA = [['', 'Sem prazo'], ['diaUtil', 'Nº dia útil'], ['ultimoDiaUtil', 'Último dia útil'], ['diaDoMes', 'Dia do mês'], ['antesDe', 'Dias corridos antes de um marco'], ['marco', 'Igual a um marco'], ['manual', 'Manual (definir no mês)']];
function editorRegra(r, marcos, chave, permitirMarco = true) {
  const t = r?.tipo || '';
  if (t === 'menorDe') return `<span class="small">${esc(descreverRegra(r, marcos))}</span>`;
  const sel = `<select data-r="tipo" aria-label="Tipo de regra">${opcoes(TIPOS_REGRA.filter(([v]) => permitirMarco || (v !== 'marco' && v !== 'antesDe')), t)}</select>`;
  const outros = marcos.filter(m => m.id !== chave);
  const extra = t === 'diaUtil' ? `<input type="number" min="1" max="23" data-r="n" value="${r.n}" style="width:64px" aria-label="Número do dia útil">`
    : t === 'diaDoMes' ? `<input type="number" min="1" max="31" data-r="dia" value="${r.dia}" style="width:64px" aria-label="Dia"><select data-r="ajuste" aria-label="Se não for dia útil">${opcoes([['anterior', 'se não útil: dia útil anterior'], ['posterior', 'se não útil: dia útil seguinte'], ['nenhum', 'não ajustar']], r.ajuste)}</select>`
      : t === 'antesDe' ? `<input type="number" min="0" max="31" data-r="dias" value="${r.dias}" style="width:64px" aria-label="Dias corridos"><select data-r="marco" aria-label="Marco">${opcoes(outros.map(m => [m.id, m.nome]), r.marco)}</select><select data-r="ajuste" aria-label="Se não for dia útil">${opcoes([['anterior', 'antecipa se não útil'], ['nenhum', 'não ajustar']], r.ajuste)}</select>`
        : t === 'marco' ? `<select data-r="marco" aria-label="Marco">${opcoes(outros.map(m => [m.id, m.nome]), r.marco)}</select>` : '';
  return `<span class="regra-ed">${sel}${extra}</span>`;
}
function lerRegra(el) {
  const v = k => el.querySelector(`[data-r="${k}"]`)?.value, t = v('tipo');
  if (!t) return null;
  if (t === 'diaUtil') return { tipo: t, n: +(v('n') || 1) };
  if (t === 'diaDoMes') return { tipo: t, dia: +(v('dia') || 1), ajuste: v('ajuste') || 'anterior' };
  if (t === 'antesDe') return { tipo: t, dias: +(v('dias') || 5), marco: v('marco'), ajuste: v('ajuste') || 'anterior' };
  if (t === 'marco') return { tipo: t, marco: v('marco') };
  return { tipo: t };
}
const regraPadrao = (tipo, marcos) => ({ diaUtil: { tipo, n: 1 }, diaDoMes: { tipo, dia: 15, ajuste: 'anterior' }, antesDe: { tipo, dias: 5, marco: marcos[0]?.id, ajuste: 'anterior' }, marco: { tipo, marco: marcos[0]?.id } }[tipo] || (tipo ? { tipo } : null));

function desenharModeloFluxo() {
  const md = S.fluxo.modelo, c = $('fxCorpo'), [ano, mes] = FX.chave.split('-').map(Number);
  const prev = calcularMarcos(md, ano, mes, md.calendario).datas, fer = feriadosNacionais(ano, md.calendario);
  c.innerHTML = `<div class="card"><h2>Modelo de fluxos <span class="muted small">revisão ${md.revisao}</span></h2>
    <p class="lead">O modelo define grupos, etapas, prazos e listas de prestadores. Cada competência guarda uma cópia do modelo de quando foi iniciada: mudanças aqui valem para os próximos meses. Use «Aplicar ao mês ${rotuloCompetencia(FX.chave)}» para levar etapas novas ao mês já iniciado sem perder o que foi registrado.</p>
    <div class="acoes"><button id="mdSalvar">Salvar modelo</button>${S.fluxo.competencias[FX.chave] ? `<button class="sec" id="mdAplicar">Aplicar ao mês ${rotuloCompetencia(FX.chave)}</button>` : ''}<button class="sec" id="mdPadrao">Restaurar modelo padrão</button></div></div>
  <div class="card"><h2>Calendário</h2><p class="lead">Feriados nacionais calculados automaticamente (inclusive Sexta-feira Santa). Datas que caírem fora do que a ferramenta calcula podem ser ajustadas mês a mês, com justificativa, clicando no marco.</p>
    <div class="acoes"><label class="small"><input type="checkbox" id="mdCarnaval"${md.calendario.carnaval ? ' checked' : ''}> considerar Carnaval como não útil (ponto facultativo)</label><label class="small"><input type="checkbox" id="mdCorpus"${md.calendario.corpusChristi ? ' checked' : ''}> considerar Corpus Christi como não útil (ponto facultativo)</label></div>
    <p class="small muted">Feriados de ${ano}: ${fer.map(f => `${f.data.slice(8)}/${f.data.slice(5, 7)} ${esc(f.nome)}`).join(' · ')}</p></div>
  <div class="card"><h2>Marcos e regras de prazo <span class="muted small">prévia para ${rotuloCompetencia(FX.chave)}</span></h2><div class="tw"><table class="tab-fx" id="mdMarcos"><thead><tr><th>Marco</th><th>Regra</th><th>Data em ${rotuloCompetencia(FX.chave)}</th></tr></thead><tbody>${md.marcos.filter(m => !m.oculto).map(m => `<tr data-m="${m.id}"><td><input type="text" data-mn value="${esc(m.nome)}" aria-label="Nome do marco"></td><td>${editorRegra(m.regra, md.marcos, m.id)}</td><td>${prev[m.id] ? fmtData(prev[m.id]) : '—'}</td></tr>`).join('')}</tbody></table></div></div>
  ${md.grupos.map(g => `<details class="card" data-mg="${g.id}"><summary>${esc(g.nome)} <span class="muted small">· ${g.tarefas.length} etapas${g.documental ? ` · ${(md.prestadores[g.id] || []).length} prestadores` : ''}${g.ativo === false ? ' · inativo' : ''}</span></summary>
    <div class="grid2" style="margin-top:10px"><label class="campo">Nome do grupo<input type="text" data-gn value="${esc(g.nome)}"></label><label class="campo">Descrição<input type="text" data-gd value="${esc(g.desc || '')}"></label></div>
    <div class="acoes"><label class="small"><input type="checkbox" data-gativo${g.ativo !== false ? ' checked' : ''}> ativo</label><label class="small"><input type="checkbox" data-gdoc${g.documental ? ' checked' : ''}> controle documental por prestador</label></div>
    <div class="tw" style="margin-top:8px"><table class="tab-fx"><thead><tr><th>Etapa</th><th>Prazo</th><th>Depende de</th><th>Rodada da ferramenta</th><th></th></tr></thead><tbody>${g.tarefas.map((t, i) => `<tr data-ti="${i}"><td><input type="text" data-tn value="${esc(t.nome)}" aria-label="Nome da etapa"></td><td>${editorRegra(t.prazo, md.marcos, null)}</td>
      <td><select data-tdep aria-label="Depende de"><option value="">—</option>${opcoes(md.grupos.flatMap(gg => gg.tarefas.filter(tt => !(gg.id === g.id && tt.id === t.id)).map(tt => [gg.id === g.id ? tt.id : `${gg.id}.${tt.id}`, (gg.id === g.id ? '' : gg.nome + ': ') + tt.nome])), (t.depende || [])[0] || '')}</select></td>
      <td><select data-tvin aria-label="Rodada vinculada">${opcoes([['', '—'], ['conferencia', 'Conferência cruzada'], ['correcao', 'Correção de prestador']], t.vinculo || '')}</select></td>
      <td><button class="perigo ic" data-trm="${i}" aria-label="Remover etapa">✕</button></td></tr>`).join('')}</tbody></table></div>
    <div class="acoes"><button class="sec" data-tadd>+ Etapa</button></div>
    ${g.documental ? `<h4 class="sub-fx">Prestadores deste fluxo (copiados para cada mês)</h4><p class="small">${(md.prestadores[g.id] || []).map(p => `<span class="badge info">${esc(p.cod)} · ${esc(p.nome)} <a href="#" data-prm="${esc(p.cod)}" aria-label="Remover">✕</a></span>`).join(' ') || '<span class="muted">Nenhum.</span>'}</p>
      <div class="acoes"><button class="sec" data-padd>+ Prestador</button><button class="sec" data-pmv>Importar dos relatórios do MV carregados</button></div>` : ''}
    ${(g.regrasFixas || []).length || true ? `<label class="campo" style="margin-top:8px">Regras fixas (avisos que aparecem todo mês; uma por linha)<textarea data-grf rows="2">${esc((g.regrasFixas || []).join('\n'))}</textarea></label>` : ''}</details>`).join('')}
  <div class="acoes"><button class="sec" id="mdNovoGrupo">+ Novo grupo de fluxo</button></div>`;
  const copia = () => {   // lê o formulário inteiro para o modelo em memória
    c.querySelectorAll('#mdMarcos tr[data-m]').forEach(tr => { const m = md.marcos.find(x => x.id === tr.dataset.m); m.nome = tr.querySelector('[data-mn]').value.trim() || m.nome; if (m.regra?.tipo !== 'menorDe') m.regra = lerRegra(tr) || m.regra; });
    c.querySelectorAll('[data-mg]').forEach(d => {
      const g = md.grupos.find(x => x.id === d.dataset.mg);
      g.nome = d.querySelector('[data-gn]').value.trim() || g.nome; g.desc = d.querySelector('[data-gd]').value.trim();
      g.ativo = d.querySelector('[data-gativo]').checked; g.documental = d.querySelector('[data-gdoc]').checked;
      g.regrasFixas = d.querySelector('[data-grf]').value.split('\n').map(s => s.trim()).filter(Boolean);
      d.querySelectorAll('tr[data-ti]').forEach(tr => { const t = g.tarefas[+tr.dataset.ti]; t.nome = tr.querySelector('[data-tn]').value.trim() || t.nome; t.prazo = lerRegra(tr); const dep = tr.querySelector('[data-tdep]').value; t.depende = dep ? [dep] : []; t.vinculo = tr.querySelector('[data-tvin]').value || null; });
    });
    md.calendario.carnaval = $('mdCarnaval').checked; md.calendario.corpusChristi = $('mdCorpus').checked;
  };
  const redesenhar = () => { copia(); desenharModeloFluxo(); };
  c.querySelectorAll('[data-r="tipo"]').forEach(s => s.onchange = () => { copia(); const tr = s.closest('tr'); const alvo = tr.dataset.m ? md.marcos.find(x => x.id === tr.dataset.m) : null;
    const nova = regraPadrao(s.value, md.marcos); if (alvo) alvo.regra = nova; else { const g = md.grupos.find(x => x.id === tr.closest('[data-mg]').dataset.mg); g.tarefas[+tr.dataset.ti].prazo = nova; } desenharModeloFluxo(); });
  c.querySelectorAll('[data-trm]').forEach(b => b.onclick = async () => { copia(); const g = md.grupos.find(x => x.id === b.closest('[data-mg]').dataset.mg); if (await confirmar('Remover etapa do modelo?', `«${esc(g.tarefas[+b.dataset.trm].nome)}» deixa de ser criada nos próximos meses.`, 'Remover')) { g.tarefas.splice(+b.dataset.trm, 1); desenharModeloFluxo(); } });
  c.querySelectorAll('[data-tadd]').forEach(b => b.onclick = () => { copia(); const g = md.grupos.find(x => x.id === b.closest('[data-mg]').dataset.mg); g.tarefas.push({ id: novoId('t'), nome: 'Nova etapa', prazo: null }); desenharModeloFluxo(); c.querySelector(`[data-mg="${g.id}"]`).open = true; });
  c.querySelectorAll('[data-padd]').forEach(b => b.onclick = async () => { copia(); const gId = b.closest('[data-mg]').dataset.mg;
    const r = await dialogo('Prestador do fluxo', `${campoBusca({ nome: 'nome', rotulo: 'Prestador', fonte: 'prestador', preencheCod: 'cod' })}<label class="campo">Código no MV<input type="text" name="cod"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Adicionar']]);
    const cod = (r.campos.cod || '').trim(); if (r.botao !== 'ok' || !cod) return;
    const l = md.prestadores[gId] ||= []; if (!l.some(p => p.cod === cod)) l.push({ cod, nome: r.campos.nome.trim() || S.cfg.prestadores.find(p => String(p.cod) === cod)?.nomeMV || '', unidade: '' });
    desenharModeloFluxo(); c.querySelector(`[data-mg="${gId}"]`).open = true; });
  c.querySelectorAll('[data-pmv]').forEach(b => b.onclick = () => { copia(); const gId = b.closest('[data-mg]').dataset.mg;
    if (!S.relatorios.length) return avisar('Carregue os relatórios do MV no Início para importar os prestadores.', 'warn');
    const l = md.prestadores[gId] ||= []; for (const x of S.relatorios) if (x.rel.cab.prestadorCod && !l.some(p => p.cod === x.rel.cab.prestadorCod)) l.push({ cod: x.rel.cab.prestadorCod, nome: x.rel.cab.prestadorNome, unidade: unidadeSugeridaPeloArquivo(x.nome) });
    desenharModeloFluxo(); c.querySelector(`[data-mg="${gId}"]`).open = true; });
  c.querySelectorAll('[data-prm]').forEach(a => a.onclick = e => { e.preventDefault(); copia(); const gId = a.closest('[data-mg]').dataset.mg; md.prestadores[gId] = (md.prestadores[gId] || []).filter(p => p.cod !== a.dataset.prm); desenharModeloFluxo(); c.querySelector(`[data-mg="${gId}"]`).open = true; });
  $('mdNovoGrupo').onclick = () => { copia(); md.grupos.push({ id: novoId('g'), nome: 'Novo fluxo', desc: '', tarefas: [{ id: novoId('t'), nome: 'Primeira etapa', prazo: null }] }); desenharModeloFluxo(); };
  $('mdCarnaval').onchange = redesenhar; $('mdCorpus').onchange = redesenhar;
  $('mdSalvar').onclick = () => { copia(); md.revisao++; md.atualizadoEm = agoraISO(); salvarFluxo(`Modelo salvo (revisão ${md.revisao}). Vale para as próximas competências.`); desenharModeloFluxo(); };
  $('mdPadrao').onclick = async () => { if (await confirmar('Restaurar o modelo padrão?', 'Grupos, etapas, prazos e listas de prestadores do modelo voltam ao padrão da especificação. Competências já iniciadas não mudam.', 'Restaurar')) { backupAntesDeSubstituir(CHAVES.fluxoAnterior, S.fluxo); const r = md.revisao; S.fluxo.modelo = modeloFluxoPadrao(); S.fluxo.modelo.revisao = r + 1; salvarFluxo('Modelo padrão restaurado.'); desenharModeloFluxo(); } };
  const ba = $('mdAplicar'); if (ba) ba.onclick = async () => {
    copia(); if (!await confirmar(`Aplicar o modelo ao mês ${rotuloCompetencia(FX.chave)}?`, 'Etapas, grupos e prestadores novos entram no mês. O que já foi registrado (status, datas, observações, documentos) é mantido. Etapas removidas do modelo deixam de aparecer neste mês.', 'Aplicar')) return;
    const comp = S.fluxo.competencias[FX.chave], nova = novaCompetencia(md, FX.chave, S.operador);
    for (const [gId, ng] of Object.entries(nova.grupos)) {
      const ant = comp.grupos[gId]; if (!ant) { comp.grupos[gId] = ng; continue; }
      for (const [tId, nt] of Object.entries(ng.tarefas)) if (!ant.tarefas[tId]) ant.tarefas[tId] = nt;
      if (ng.documental) { ant.documental ||= {}; for (const [k, v] of Object.entries(ng.documental)) if (!ant.documental[k]) ant.documental[k] = v; }
      if (ng.classificacao && !ant.classificacao) ant.classificacao = {}; if (ng.matriz && !ant.matriz) ant.matriz = {};
    }
    comp.modelo = clone(md); comp.historicoModelo = [...(comp.historicoModelo || []), { em: agoraISO(), por: S.operador, revisao: md.revisao }];
    salvarFluxo(`Modelo aplicado ao mês ${rotuloCompetencia(FX.chave)}.`);
  };
}
