/* ============================================================
 * Não conformidades: registro por competência, candidatos vindos das análises,
 * importação da planilha manual e exportação para o Qualiex
 * ============================================================ */
const NCV = { chave: null, aba: 'todas', f: { situacao: '', natureza: '', unidade: '', responsavel: '', mod: '' }, busca: '', sel: new Set(), revisar: null, selCand: new Set() };
const CLS_SIT = { aberta: 's-ab', enviada: 's-env', tratativa: 's-tra', regularizada: 's-reg', 'nao-procede': 's-np' };
const chipSit = k => `<span class="nc-sit ${CLS_SIT[k]}">${esc(SITUACAO_NC[k])}</span>`;
const ROTULO_ORIGEM = { conferencia: 'conferência', correcao: 'correção', manual: 'manual', importada: 'importada' };
const MODALIDADES_NC = [['', '—'], ['US', 'US'], ['CT', 'CT'], ['MR', 'MR'], ['CR', 'CR'], ['DX', 'DX'], ['MG', 'MG'], ['OT', 'OT']];
const retencaoNC = () => +S.cfg.parametros.retencaoNC || RETENCAO_NC_PADRAO;

function carregarNC() {
  const b = lerLocal(CHAVES.nc);
  S.nc = b && !validarNC(b).length ? b : ncVazia();
  const n = aplicarRetencaoNC(S.nc, retencaoNC());
  if (n) { salvarNC(); setTimeout(() => avisar(`${n} não conformidade(s) passaram de ${retencaoNC()} dias: nome e ID do paciente foram apagados (retenção).`, 'info'), 400); }
}
function salvarNC(msg = '') {
  if (!gravarLocal(CHAVES.nc, S.nc)) avisar('Não foi possível gravar as não conformidades neste navegador. Exporte a planilha para não perder o trabalho.', 'err');
  else if (msg) avisar(msg, 'ok');
  atualizarNavNC();
}
function atualizarNavNC() {
  const b = $('navNC'); if (!b || !S.nc) return;
  const n = S.nc.itens.filter(x => x.situacao === 'aberta').length;
  b.hidden = !n; b.textContent = n;
  const a = b.closest('a'), nome = n ? `Não conformidades · ${n} aberta(s), não enviadas` : 'Não conformidades';
  a.setAttribute('aria-label', nome); a.querySelector('.dica').textContent = nome; sincronizarPontos();
}

/* ---------- Candidatos da sessão (só na memória: somem ao recarregar a página) ---------- */
function guardarCandidatosNC(chave, rotulo, curto, itens) {
  S.ncCand = (S.ncCand || []).filter(f => f.chave !== chave);
  S.ncCand.push({ chave, rotulo, curto, itens, competencia: S.comp });
}
function chavesRegistradasNC() { return new Set(S.nc.itens.flatMap(x => [chaveNC(x), x.origem?.chaveCandidato]).filter(Boolean)); }
// Lista achatada com o estado de cada candidato: nova, registrada ou dispensada.
function candidatosNC(filtro = {}) {
  const reg = chavesRegistradasNC(), disp = S.ncDispensados || new Set(), out = [];
  for (const f of S.ncCand || []) {
    if (filtro.fonte ? f.chave !== filtro.fonte : f.competencia !== S.comp) continue;
    for (const c of f.itens) {
      if (filtro.tipo && c.tipo !== filtro.tipo) continue;
      out.push({ c, fonte: f, estado: reg.has(c.chave) ? 'registrada' : disp.has(c.chave) ? 'dispensada' : 'nova' });
    }
  }
  return out;
}
// Cartão usado na conferência e na correção: resumo dos candidatos desta análise e atalho para a revisão.
function cartaoCandidatosNC(fonte) {
  const lista = candidatosNC({ fonte }), novos = lista.filter(x => x.estado === 'nova');
  const porTipo = [...contar(lista, x => x.c.tipo)];
  return `<div class="card nc-cartao"><h2>Possíveis não conformidades <span class="muted small">${novos.length} para revisar · ${lista.length - novos.length} já registradas ou dispensadas</span></h2>
    <p class="lead">O sistema só separa os candidatos. Você revisa, aponta o que é NC e escolhe a natureza e o responsável. Também dá para apontar qualquer linha da tabela: abra o detalhe e use «Apontar como NC».</p>
    ${porTipo.length ? `<div class="marcadores">${porTipo.map(([t, n]) => `<span class="marc">${esc(TIPOS_CANDIDATO_NC[t].nome)} · ${n}</span>`).join('')}</div>
    <div class="acoes"><button data-revisar-nc="${esc(fonte)}">Revisar na aba Não conformidades</button></div>` : '<p class="muted small">Nenhum candidato nesta análise.</p>'}</div>`;
}
function ligarCartaoCandidatosNC(cont) {
  cont.querySelectorAll('[data-revisar-nc]').forEach(b => b.onclick = () => { NCV.revisar = { fonte: b.dataset.revisarNc }; NCV.selCand.clear(); location.hash = 'nc'; });
}

/* ---------- Prazos do Fluxo mensal ---------- */
function prazosNC(chave) {
  const comp = S.fluxo.competencias[chave], [a, m] = chave.split('-').map(Number);
  const mk = comp ? marcosDaCompetencia(comp) : calcularMarcos(S.fluxo.modelo, a, m, S.fluxo.modelo.calendario, {});
  const out = {};
  for (const [k, g] of Object.entries(GRUPOS_PRAZO_NC)) out[k] = { ...g, data: mk.datas[g.marco] || null, status: comp?.grupos?.nc?.tarefas?.[g.tarefa]?.status || '' };
  return { grupos: out, iniciada: !!comp };
}
function rotuloPrazo(d) {
  if (!d) return { txt: 'sem data', cls: '' };
  const dif = diaSerial(d) - diaSerial(paraData(new Date()));
  if (dif < 0) return { txt: `${fmtCurta(d)} · venceu há ${-dif} dia(s)`, cls: 'txt-err' };
  if (dif === 0) return { txt: `${fmtCurta(d)} · hoje`, cls: 'txt-err' };
  return { txt: `${fmtCurta(d)} · ${dif === 1 ? 'amanhã' : `em ${dif} dias`}`, cls: dif <= 3 ? 'txt-warn' : '' };
}

/* ---------- Página ---------- */
RENDER.nc = () => {
  NCV.chave = S.comp;
  const fechada = compFechada(NCV.chave);
  const p = $('pag-nc'), itens = S.nc.itens.filter(x => x.competencia === NCV.chave), ind = indicadoresNC(itens);
  const pr = prazosNC(NCV.chave), dias = retencaoNC(), vencendo = vencendoRetencaoNC(S.nc, dias);
  const cands = candidatosNC(), temCand = (S.ncCand || []).some(f => f.competencia === NCV.chave), novos = cands.filter(x => x.estado === 'nova');
  const barras = (pares, max) => pares.length ? pares.map(([nome, n]) => `<div class="l"><span title="${esc(nome)}">${esc(nome)}</span><i style="width:${Math.max(2, Math.round(n / max * 100))}%"></i><b>${n}</b></div>`).join('') : '<p class="muted small">Sem NCs nesta competência.</p>';
  const topo = (pares, k) => pares.length > k ? [...pares.slice(0, k), [`outros ${pares.length - k}`, pares.slice(k).reduce((s, x) => s + x[1], 0)]] : pares;
  const nat = topo(ind.porNatureza.map(([n, q]) => [n, q]), 9), resp = topo(ind.porResponsavel, 6);
  const maxBar = Math.max(1, ...nat.map(x => x[1]), ...resp.map(x => x[1]));
  const tiposCand = [...contar(novos, x => x.c.tipo)];
  p.innerHTML = `<div class="fx-topo"><h2 class="fx-titulo">Não conformidades da competência ${rotuloCompetencia(NCV.chave)}</h2>
    <div class="acoes" style="margin:0"><button class="sec" id="ncImp"${fechada ? ' disabled' : ''}>Importar planilha manual</button><input type="file" id="ncArq" accept=".xlsx" hidden><button class="sec" id="ncNova"${fechada ? ' disabled' : ''}>+ Nova NC</button><button id="ncExp">Exportar para o Qualiex (.xlsx)</button></div></div>
    ${vencendo.length ? `<div class="aviso-fixo warn">${vencendo.length} NC(s) terão nome e ID do paciente apagados em até 7 dias (retenção de ${dias} dias após o registro). Exporte antes se precisar guardar a planilha na rede.</div>` : ''}
    <div class="nc-kpis">
      <div class="nc-kpi"><b>${ind.total}</b><small>NCs na competência</small></div>
      <div class="nc-kpi err"><b>${ind.porSituacao.aberta}</b><small>abertas (não enviadas)</small></div>
      <div class="nc-kpi"><b>${ind.porSituacao.enviada + ind.porSituacao.tratativa}</b><small>enviadas ao Qualiex (inclui em tratativa)</small></div>
      <div class="nc-kpi warn"><b>${ind.impactam}</b><small>impactam o pagamento</small></div>
      <div class="nc-kpi ok"><b>${ind.porSituacao.regularizada}</b><small>regularizadas</small></div></div>
    <div class="nc-duas">
      <div class="card barras"><h3>Por natureza (padronizada)</h3>${barras(nat, maxBar)}<h3 style="margin-top:14px">Por responsável pelo fechamento da conta</h3>${barras(resp, maxBar)}</div>
      <div class="card nc-cand"><h3>Candidatos vindos das análises desta sessão</h3>
        ${temCand ? `<p class="small muted">O sistema separa; você aponta o que é NC, a natureza e o responsável.</p>${tiposCand.length ? tiposCand.map(([t, n]) => `<div class="l"><div>${esc(TIPOS_CANDIDATO_NC[t].nome)}<small>${esc(TIPOS_CANDIDATO_NC[t].dica)}${TIPOS_CANDIDATO_NC[t].natureza ? ` · sugestão: ${esc(NATUREZA_NC[TIPOS_CANDIDATO_NC[t].natureza].nome.toLowerCase())}` : ''}</small></div><button class="mini" data-rev-tipo="${t}">Revisar ${n}</button></div>`).join('') : '<p class="small txt-ok">Todos os candidatos já foram registrados ou dispensados.</p>'}`
          : '<p class="small muted">Rode uma conferência cruzada ou uma correção de prestador: o que pode ser NC aparece aqui para você revisar. Os candidatos ficam só nesta sessão.</p>'}
        <h3 style="margin-top:14px">Prazos de envio (Fluxo mensal)</h3>
        ${Object.entries(pr.grupos).map(([k, g]) => { const r = rotuloPrazo(g.data), q = ind.porPrazo[k]; return `<div class="l"><div>${esc(g.nome)}<small>${q.total} NC(s) · ${q.abertas} aberta(s)${g.status ? ` · etapa no fluxo: ${esc(STATUS_TAREFA[g.status])}` : ''}</small></div><b class="${g.status === 'ok' ? 'txt-ok' : r.cls}">${g.status === 'ok' ? fmtCurta(g.data) + ' ✓' : r.txt}</b></div>`; }).join('')}
        ${pr.iniciada ? '' : '<p class="small muted">Competência ainda não iniciada no Fluxo mensal: datas calculadas pelo modelo.</p>'}</div></div>
    <div id="ncRevisao"></div>
    <div class="card"><div class="nc-abas" role="tablist">${[['todas', 'Todas', ind.total], ...Object.entries(CATEGORIA_NC).map(([k, n]) => [k, n, ind.porCategoria[k]])].map(([k, n, q]) => `<button role="tab" class="${NCV.aba === k ? 'on' : ''}" aria-selected="${NCV.aba === k}" data-aba="${k}">${esc(n)}<em>${q}</em></button>`).join('')}</div>
      <div class="nc-filtros" id="ncFiltros"></div><div id="ncTab"></div>
      <div class="acoes nc-lote"><span class="small muted" id="ncSelInfo"></span><button class="sec mini" data-lote="tudo">Selecionar as filtradas</button><button class="sec mini" data-lote="limpar">Limpar seleção</button>
        ${fechada ? '' : '<button class="mini" data-lote="enviada">Marcar como enviadas ao Qualiex</button><button class="mini" data-lote="responsavel">Definir responsável</button><button class="mini" data-lote="situacao">Mudar situação</button>'}<button class="mini" data-lote="seguinte">Levar para a competência seguinte</button>${fechada ? '' : '<button class="perigo mini" data-lote="excluir">Excluir</button>'}</div></div>
    <div class="card legenda"><h3>Como funciona</h3><ul>
      <li><b>Três categorias</b>, iguais às abas da planilha manual. A exportação sai nas mesmas abas e colunas, com situação, observações e uma aba de indicadores; ela pode ser importada de volta.</li>
      <li><b>Natureza padronizada + detalhe</b> («Procedimento não lançado na conta» + «RX patela») e observações livres. Na importação, o texto original fica nas observações.</li>
      <li><b>Situação</b>: Aberta → Enviada ao Qualiex → Em tratativa → Regularizada · Não procede. A pendência não resolvida pode ir para a competência seguinte, ligada à original.</li>
      <li><b>Privacidade</b>: tudo fica só neste navegador. Nome e ID do paciente são apagados ${dias} dias após o registro (ajuste em Configurações); natureza, unidade, responsável e situação ficam para os indicadores. <a href="#" id="ncApagar">Apagar agora os dados de pacientes desta competência</a>.</li></ul></div>`;

  $('ncNova').onclick = () => editarNC(null);
  $('ncImp').onclick = () => $('ncArq').click();
  $('ncArq').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importarPlanilhaNC(f); };
  $('ncExp').onclick = () => exportarNC(itens, pr);
  $('ncApagar').onclick = async ev => {
    ev.preventDefault();
    const alvo = itens.filter(x => !x.anonimizada && (x.paciente || x.idAtendimento));
    if (!alvo.length) return avisar('Nenhuma NC desta competência tem dados de paciente.', 'info');
    if (!await confirmar('Apagar dados de pacientes?', `Nome e ID/atendimento de ${alvo.length} NC(s) de ${rotuloCompetencia(NCV.chave)} serão apagados de vez. O restante da NC fica para os indicadores.`, 'Apagar')) return;
    alvo.forEach(anonimizarNC); salvarNC('Dados de pacientes apagados.'); RENDER.nc();
  };
  p.querySelectorAll('[data-rev-tipo]').forEach(b => b.onclick = () => { NCV.revisar = { tipo: b.dataset.revTipo }; NCV.selCand.clear(); desenharRevisao(); $('ncRevisao').scrollIntoView({ behavior: 'smooth' }); });
  p.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { NCV.aba = b.dataset.aba; NCV.sel.clear(); RENDER.nc(); });
  p.querySelectorAll('[data-lote]').forEach(b => b.onclick = () => acaoLoteNC(b.dataset.lote));
  desenharFiltrosNC(itens);
  desenharTabelaNC();
  desenharRevisao();
};

function itensFiltradosNC() {
  const q = norm(NCV.busca), f = NCV.f;
  return S.nc.itens.filter(x => x.competencia === NCV.chave && (NCV.aba === 'todas' || x.categoria === NCV.aba)
    && (!f.situacao || x.situacao === f.situacao) && (!f.natureza || x.natureza === f.natureza) && (!f.unidade || x.unidade === f.unidade)
    && (!f.responsavel || x.responsavel === f.responsavel) && (!f.mod || x.modalidade === f.mod)
    && (!q || norm([x.paciente, x.idAtendimento, x.titulo, x.tituloEstudo, x.medico, x.detalhe, x.obs, x.convenio].join(' ')).includes(q)))
    .sort((a, b) => (a.unidade || '').localeCompare(b.unidade || '') || (a.data || '').localeCompare(b.data || ''));
}
function desenharFiltrosNC(itens) {
  const valores = k => [...new Set(itens.map(x => x[k]).filter(Boolean))].sort();
  const sel = (k, rot, lista) => `<select data-f="${k}" aria-label="${rot}"><option value="">${rot}</option>${opcoes(lista, NCV.f[k])}</select>`;
  $('ncFiltros').innerHTML = sel('situacao', 'Todas as situações', Object.entries(SITUACAO_NC)) + sel('natureza', 'Todas as naturezas', NATUREZAS_NC.map(n => [n.id, n.nome]))
    + sel('unidade', 'Todas as unidades', valores('unidade').map(v => [v, v])) + sel('responsavel', 'Todos os responsáveis', valores('responsavel').map(v => [v, v]))
    + sel('mod', 'Todas as modalidades', valores('modalidade').map(v => [v, v])) + `<input type="search" id="ncBusca" placeholder="Buscar paciente, ID, título ou médico…" value="${esc(NCV.busca)}">`;
  $('ncFiltros').querySelectorAll('[data-f]').forEach(s => s.onchange = () => { NCV.f[s.dataset.f] = s.value; desenharTabelaNC(); });
  $('ncBusca').oninput = e => { NCV.busca = e.target.value; desenharTabelaNC(); };
}
function desenharTabelaNC() {
  const lista = itensFiltradosNC(), cont = $('ncTab');
  NCV.lista = lista;
  tabela(cont, {
    linhas: lista, porPagina: 100, vazio: 'Nenhuma NC nesta competência com esses filtros. Use «+ Nova NC», importe a planilha manual ou revise os candidatos das análises.',
    classeLinha: () => 'clicavel',
    colunas: [
      { t: '', html: x => `<input type="checkbox" data-sel="${x.id}"${NCV.sel.has(x.id) ? ' checked' : ''} aria-label="Selecionar">` },
      { t: 'Situação', html: x => chipSit(x.situacao) },
      { t: 'Natureza', html: x => `<span class="nc-nat">${esc(NATUREZA_NC[x.natureza].nome)}</span>${x.detalhe ? `<small class="nc-det">${esc(x.detalhe)}</small>` : ''}` },
      { t: 'Unidade', v: x => x.unidade },
      { t: 'Paciente', html: x => x.anonimizada ? '<span class="muted small">apagado</span>' : esc(x.paciente) },
      { t: 'ID / atend.', v: x => x.idAtendimento },
      { t: 'Data', v: x => fmtData(paraData(x.data)) },
      { t: 'Título do laudo', v: x => x.titulo || x.tituloEstudo },
      { t: 'Mod.', v: x => x.modalidade },
      { t: 'Médico', v: x => x.medico },
      { t: 'Responsável / prestador', html: x => x.categoria === 'prestador' ? `<span class="small">${esc(x.prestadorIncorreto || '?')} → ${esc(x.prestadorCorrigido || x.medico || '?')}</span>` : esc(x.responsavel || '—') },
      { t: 'Impacta pgto.', v: x => x.impactaPagamento ? 'sim' : 'não' },
      { t: 'Origem', html: x => `<span class="nc-orig">${esc(ROTULO_ORIGEM[x.origem?.tipo] || x.origem?.tipo || '')}</span>${x.deCompetencia ? `<small class="nc-det">de ${rotuloCompetencia(x.deCompetencia)}</small>` : ''}${x.levadaPara ? `<small class="nc-det">levada p/ ${rotuloCompetencia(x.levadaPara)}</small>` : ''}` }
    ]
  });
  cont.onclick = e => {
    const ch = e.target.closest('[data-sel]');
    if (ch) { ch.checked ? NCV.sel.add(ch.dataset.sel) : NCV.sel.delete(ch.dataset.sel); infoSelNC(); return; }
    if (e.target.closest('input,button,select,a')) return;
    const tr = e.target.closest('tbody tr[data-i]'); if (tr) editarNC(NCV.lista[+tr.dataset.i]);
  };
  infoSelNC();
}
const infoSelNC = () => { const el = $('ncSelInfo'); if (el) el.textContent = NCV.sel.size ? `${NCV.sel.size} selecionada(s):` : 'Com as selecionadas:'; };

/* ---------- Revisão de candidatos ---------- */
function desenharRevisao() {
  const cont = $('ncRevisao'); if (!cont) return;
  if (!NCV.revisar) { cont.innerHTML = ''; return; }
  const lista = candidatosNC(NCV.revisar), novos = lista.filter(x => x.estado === 'nova');
  const titulo = NCV.revisar.tipo ? TIPOS_CANDIDATO_NC[NCV.revisar.tipo].nome : (S.ncCand.find(f => f.chave === NCV.revisar.fonte)?.rotulo || 'Análise');
  cont.innerHTML = `<div class="card nc-revisao"><h2>Revisar candidatos · ${esc(titulo)} <span class="muted small">${novos.length} para revisar de ${lista.length}</span></h2>
    <p class="lead">Marque as linhas que são não conformidade e registre. As que não forem, dispense: elas saem da lista desta sessão.</p>
    <div class="acoes"><button class="sec mini" id="rvTodas">Selecionar as ${novos.length} para revisar</button><button class="sec mini" id="rvLimpar">Limpar seleção</button>
      <button id="rvReg">Registrar selecionadas como NC…</button><button class="sec" id="rvDisp">Dispensar selecionadas (não são NC)</button><button class="sec" id="rvFechar">Fechar</button></div>
    <div id="rvTab" style="margin-top:10px"></div></div>`;
  const ESTADO_CAND = { nova: '<span class="nc-sit s-ab">para revisar</span>', registrada: '<span class="nc-sit s-reg">registrada</span>', dispensada: '<span class="nc-sit s-np">dispensada</span>' };
  tabela($('rvTab'), {
    linhas: lista, porPagina: 100, vazio: 'Nenhum candidato.',
    colunas: [
      { t: '', html: x => x.estado === 'nova' ? `<input type="checkbox" data-cand="${esc(x.c.chave)}"${NCV.selCand.has(x.c.chave) ? ' checked' : ''} aria-label="Selecionar">` : '' },
      { t: 'Estado', html: x => ESTADO_CAND[x.estado] }, { t: 'Tipo', v: x => TIPOS_CANDIDATO_NC[x.c.tipo].nome },
      { t: 'Paciente', v: x => x.c.campos.paciente }, { t: 'Data', v: x => fmtData(paraData(x.c.campos.data)) },
      { t: 'Título / procedimento', v: x => x.c.campos.titulo }, { t: 'Médico', v: x => x.c.campos.medico }, { t: 'Convênio', v: x => x.c.campos.convenio },
      { t: 'Vl Repasse', n: true, v: x => x.c.campos.valor ? fmtBR(x.c.campos.valor) : '' },
      ...(NCV.revisar.tipo ? [{ t: 'Análise', html: x => `<span class="nc-orig" title="${esc(x.fonte.rotulo)}">${esc(x.fonte.curto)}</span>` }] : []),
      { t: 'Motivo', html: x => `<span class="small nc-motivo" title="${esc(x.c.motivo)}">${esc(x.c.motivo.length > 140 ? x.c.motivo.slice(0, 140) + '…' : x.c.motivo)}</span>` }
    ]
  });
  $('rvTab').onclick = e => { const ch = e.target.closest('[data-cand]'); if (ch) ch.checked ? NCV.selCand.add(ch.dataset.cand) : NCV.selCand.delete(ch.dataset.cand); };
  $('rvTodas').onclick = () => { novos.forEach(x => NCV.selCand.add(x.c.chave)); desenharRevisao(); };
  $('rvLimpar').onclick = () => { NCV.selCand.clear(); desenharRevisao(); };
  $('rvFechar').onclick = () => { NCV.revisar = null; NCV.selCand.clear(); desenharRevisao(); };
  const selecionados = () => novos.filter(x => NCV.selCand.has(x.c.chave)).map(x => x.c);
  $('rvReg').onclick = async () => { const s = selecionados(); if (!s.length) return avisar('Selecione ao menos uma linha.', 'warn'); if (await abrirRegistroNC(s)) { NCV.selCand.clear(); RENDER.nc(); } };
  $('rvDisp').onclick = () => {
    const s = selecionados(); if (!s.length) return avisar('Selecione ao menos uma linha.', 'warn');
    S.ncDispensados = S.ncDispensados || new Set(); s.forEach(c => S.ncDispensados.add(c.chave)); NCV.selCand.clear();
    avisar(`${s.length} candidato(s) dispensado(s) nesta sessão.`, 'ok'); RENDER.nc();
  };
}

/* ---------- Registro a partir de candidatos ---------- */
const datalistFaturistas = () => `<datalist id="dlFat">${S.cfg.faturistas.filter(f => f.ativo !== false).map(f => `<option value="${esc(f.nome)}"></option>`).join('')}</datalist>`;
const datalistUnidades = () => `<datalist id="dlUn">${[...new Set(S.cfg.unidades.flatMap(u => [...(u.apolo || []), u.nome]))].map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>`;
// Devolve verdadeiro se registrou algo.
async function abrirRegistroNC(cands) {
  if (!exigirAberta(S.comp, 'registrar NCs')) return false;
  const op = await exigirOperador(); if (!op) return false;
  const um = (f, vazio = '') => { const s = new Set(cands.map(f)); return s.size === 1 ? [...s][0] : vazio; };
  const natSug = um(c => c.natureza), catSug = um(c => c.categoria), compSug = um(c => c.competencia) || S.comp;
  const semSugestao = cands.filter(c => !c.natureza).length;
  const pbiSug = cands.map(c => faturistaDoAtendimento(S.pbi, c.campos.idAtendimento, c.campos.conta)).filter(Boolean).length;
  const r = await dialogo(`Registrar ${cands.length} NC(s)`, `<p class="small muted">${cands.length === 1 ? `${esc(cands[0].campos.paciente)} · ${esc(fmtData(paraData(cands[0].campos.data)))} · ${esc(cands[0].campos.titulo)}` : `${cands.length} linhas selecionadas. As escolhas abaixo valem para todas.`}</p>
    <div class="grid2"><label class="campo">Natureza<select name="natureza">${natSug ? '' : `<option value="">${semSugestao === cands.length ? '— escolher —' : 'Sugerida de cada linha'}</option>`}${opcoes(NATUREZAS_NC.map(n => [n.id, n.nome]), natSug)}</select></label>
    <label class="campo">Categoria (aba)<select name="categoria">${catSug ? '' : '<option value="">Sugerida de cada linha (particular pelo convênio)</option>'}${opcoes(Object.entries(CATEGORIA_NC), catSug)}</select></label>
    <label class="campo">Detalhe<input type="text" name="detalhe" placeholder="ex.: RX patela"></label>
    ${campoBusca({ nome: 'responsavel', rotulo: 'Responsável pelo fechamento da conta', fonte: 'faturista', dica: pbiSug ? `vazio = sugerido pelo Power BI (${pbiSug} linha(s))` : '' })}
    <label class="campo">Impacta o pagamento<select name="impacta">${opcoes([['', 'Padrão da natureza'], ['sim', 'Sim'], ['nao', 'Não']], '')}</select></label>
    <label class="campo">Competência<input type="month" name="competencia" value="${esc(compSug)}"></label></div>
    <label class="campo">Observações<textarea name="obs" rows="2"></textarea></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Registrar']]);
  if (r.botao !== 'ok') return false;
  const e = r.campos;
  await cadastrosNovosDoDialogo();
  if (!e.natureza && cands.some(c => !c.natureza)) { avisar(`Escolha a natureza: ${cands.filter(c => !c.natureza).length} linha(s) não têm sugestão.`, 'warn'); return false; }
  if (!/^\d{4}-\d{2}$/.test(e.competencia)) { avisar('Competência inválida.', 'warn'); return false; }
  if (!exigirAberta(e.competencia, 'registrar NCs')) return false;
  const dados = cands.map(c => {
    const responsavel = e.responsavel.trim() || faturistaDoAtendimento(S.pbi, c.campos.idAtendimento, c.campos.conta) || (c.categoria === 'particular' && !e.categoria ? 'PARTICULAR - EQUIPE UNIDADE' : '');
    return dadosDoCandidato(c, { natureza: e.natureza, categoria: e.categoria, competencia: e.competencia, responsavel, detalhe: e.detalhe.trim(), obs: e.obs.trim(), impactaPagamento: e.impacta ? e.impacta === 'sim' : undefined });
  });
  const { novas, repetidas } = registrarNCs(S.nc, dados, op);
  salvarNC(`${novas.length} NC(s) registrada(s) em ${rotuloCompetencia(e.competencia)}${repetidas.length ? ` · ${repetidas.length} já existiam e não foram repetidas` : ''}.`);
  return true;
}

/* ---------- Nova NC / edição ---------- */
function formNC(d) {
  return `<div class="grid2">
    <label class="campo">Categoria (aba)<select name="categoria">${opcoes(Object.entries(CATEGORIA_NC), d.categoria)}</select></label>
    <label class="campo">Natureza<select name="natureza">${opcoes(NATUREZAS_NC.map(n => [n.id, n.nome]), d.natureza)}</select></label>
    <label class="campo">Detalhe<input type="text" name="detalhe" value="${esc(d.detalhe)}" placeholder="ex.: RX patela"></label>
    <label class="campo">Situação<select name="situacao">${opcoes(Object.entries(SITUACAO_NC), d.situacao)}</select></label>
    ${campoBusca({ nome: 'unidade', rotulo: 'Unidade', fonte: 'unidade', valor: d.unidade })}
    <label class="campo">Competência<input type="month" name="competencia" value="${esc(d.competencia)}"></label>
    <label class="campo">Paciente${d.anonimizada ? '<input type="text" name="paciente" value="" placeholder="apagado pela retenção" disabled>' : `<input type="text" name="paciente" value="${esc(d.paciente)}">`}</label>
    <label class="campo">ID / atendimento${d.anonimizada ? '<input type="text" name="idAtendimento" value="" disabled>' : `<input type="text" name="idAtendimento" value="${esc(d.idAtendimento)}">`}</label>
    <label class="campo">Data do exame<input type="date" name="data" value="${esc(d.data)}"></label>
    <label class="campo">Modalidade<select name="modalidade">${opcoes(MODALIDADES_NC, d.modalidade)}</select></label>
    <label class="campo">Título do laudo<input type="text" name="titulo" value="${esc(d.titulo)}"></label>
    <label class="campo">Título do estudo<input type="text" name="tituloEstudo" value="${esc(d.tituloEstudo)}"></label>
    ${campoBusca({ nome: 'convenio', rotulo: 'Convênio', fonte: 'convenio', valor: d.convenio })}
    ${campoBusca({ nome: 'medico', rotulo: 'Médico', fonte: 'prestador', valor: d.medico })}
    ${campoBusca({ nome: 'responsavel', rotulo: 'Responsável pelo fechamento da conta', fonte: 'faturista', valor: d.responsavel, dica: 'Não usado em «Correção de prestadores».' })}
    <label class="campo">Impacta o pagamento<select name="impacta">${opcoes([['sim', 'Sim'], ['nao', 'Não']], d.impactaPagamento ? 'sim' : 'nao')}</select></label>
    ${campoBusca({ nome: 'prestadorIncorreto', rotulo: 'Prestador incorreto (código)', fonte: 'prestador', valor: d.prestadorIncorreto, valorCodigo: true, dica: 'Só em «Correção de prestadores».' })}
    ${campoBusca({ nome: 'prestadorCorrigido', rotulo: 'Prestador corrigido', fonte: 'prestador', valor: d.prestadorCorrigido })}</div>
    <label class="campo">Observações<textarea name="obs" rows="2">${esc(d.obs)}</textarea></label>`;
}
async function editarNC(nc) {
  if (!exigirAberta(nc ? nc.competencia : S.comp, nc ? 'editar NCs' : 'registrar NCs')) return;
  const op = await exigirOperador(); if (!op) return;
  const d = nc ? { ...nc } : { competencia: NCV.chave, categoria: NCV.aba !== 'todas' ? NCV.aba : 'convenio', natureza: NCV.aba === 'prestador' ? 'prestador-incorreto' : 'nao-lancado', situacao: 'aberta', impactaPagamento: true };
  const hist = nc ? `<details class="small" style="margin-top:6px"><summary>Histórico (${nc.historico.length})</summary><ul>${nc.historico.map(h => `<li>${new Date(h.em).toLocaleString('pt-BR')} · ${esc(h.por || '—')} · ${esc(h.acao)}</li>`).join('')}</ul>${nc.origem?.motivo ? `<p>Motivo apontado na análise: ${esc(nc.origem.motivo)}</p>` : ''}</details>` : '';
  const r = await dialogo(nc ? 'Editar não conformidade' : 'Nova não conformidade', formNC(d) + hist, nc ? [['', 'Cancelar', 'sec'], ['ok', 'Salvar']] : [['', 'Cancelar', 'sec'], ['ok', 'Registrar']]);
  if (r.botao !== 'ok') return;
  const e = r.campos;
  if (!/^\d{4}-\d{2}$/.test(e.competencia)) return avisar('Competência inválida.', 'warn');
  if (!exigirAberta(e.competencia, 'gravar NCs')) return;
  await cadastrosNovosDoDialogo();
  const dados = { ...e, impactaPagamento: e.impacta === 'sim', unidadeCod: ncDaUnidade(S.cfg, e.unidade) };
  delete dados.impacta;
  if (d.anonimizada) { delete dados.paciente; delete dados.idAtendimento; }
  if (nc) { alterarNC(nc, dados, op); salvarNC('NC atualizada.'); }
  else {
    if (!dados.paciente && !dados.titulo && !dados.idAtendimento) return avisar('Informe ao menos paciente, ID ou título.', 'warn');
    const { novas } = registrarNCs(S.nc, [{ ...dados, origem: { tipo: 'manual' } }], op);
    salvarNC(novas.length ? 'NC registrada.' : 'Já existe uma NC igual nesta competência.');
  }
  RENDER.nc();
}

/* ---------- Ações em lote ---------- */
async function acaoLoteNC(acao) {
  if (acao === 'tudo') { NCV.lista.forEach(x => NCV.sel.add(x.id)); return desenharTabelaNC(); }
  if (acao === 'limpar') { NCV.sel.clear(); return desenharTabelaNC(); }
  const sel = S.nc.itens.filter(x => NCV.sel.has(x.id));
  if (!sel.length) return avisar('Selecione ao menos uma NC na tabela.', 'warn');
  if (acao === 'seguinte' ? !exigirAberta(competenciaVizinha(NCV.chave, 1), 'receber NCs') : !exigirAberta(NCV.chave, 'alterar NCs')) return;
  const op = await exigirOperador(); if (!op) return;
  let msg = '';
  if (acao === 'enviada') { const n = sel.filter(x => mudarSituacaoNC(x, 'enviada', op)).length; msg = `${n} NC(s) marcadas como enviadas ao Qualiex.`; }
  else if (acao === 'responsavel') {
    const r = await dialogo(`Responsável de ${sel.length} NC(s)`, `${campoBusca({ nome: 'resp', rotulo: 'Responsável pelo fechamento da conta', fonte: 'faturista' })}`, [['', 'Cancelar', 'sec'], ['ok', 'Aplicar']]);
    if (r.botao !== 'ok') return;
    await cadastrosNovosDoDialogo();
    const n = sel.filter(x => x.categoria !== 'prestador' && alterarNC(x, { responsavel: r.campos.resp.trim() }, op)).length; msg = `Responsável definido em ${n} NC(s).`;
  } else if (acao === 'situacao') {
    const r = await dialogo(`Situação de ${sel.length} NC(s)`, `<label class="campo">Nova situação<select name="sit">${opcoes(Object.entries(SITUACAO_NC), 'tratativa')}</select></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Aplicar']]);
    if (r.botao !== 'ok') return;
    const n = sel.filter(x => mudarSituacaoNC(x, r.campos.sit, op)).length; msg = `${n} NC(s) agora «${SITUACAO_NC[r.campos.sit]}».`;
  } else if (acao === 'seguinte') {
    const n = sel.filter(x => levarParaSeguinte(S.nc, x, op)).length;
    msg = `${n} NC(s) levadas para ${rotuloCompetencia(competenciaVizinha(NCV.chave, 1))}${n < sel.length ? ` · ${sel.length - n} ignoradas (regularizada, não procede ou já levada)` : ''}.`;
  } else if (acao === 'excluir') {
    if (!await confirmar('Excluir NCs?', `${sel.length} NC(s) serão excluídas. Para uma NC que não se confirmou, prefira a situação «Não procede», que fica nos indicadores.`, 'Excluir')) return;
    const ids = new Set(sel.map(x => x.id)); S.nc.itens = S.nc.itens.filter(x => !ids.has(x.id)); msg = `${sel.length} NC(s) excluídas.`;
  }
  NCV.sel.clear(); salvarNC(msg); RENDER.nc();
}

/* ---------- Importação e exportação ---------- */
async function importarPlanilhaNC(f) {
  if (!exigirAberta(S.comp, 'importar NCs')) return;
  const op = await exigirOperador(); if (!op) return;
  let lida;
  const compArquivo = competenciaDoNomeNC(f.name);
  try { lida = await lerPlanilhaNC(await lerArquivo(f), compArquivo || NCV.chave, S.cfg); } catch (err) { return avisar(`Planilha não lida: ${err.message}`, 'err'); }
  if (!lida.dados.length) return avisar('Nenhuma NC encontrada. Abas esperadas: PARTICULAR, CONVENIOS (FAT) e Correção de prestadores.', 'warn');
  const novosResp = lida.responsaveis.filter(([n]) => !S.cfg.faturistas.some(x => norm(x.nome) === norm(n)));
  const r = await dialogo('Importar planilha de não conformidades', `<p class="small muted">${esc(f.name)}</p>
    <ul class="small">${lida.resumo.map(a => `<li><b>${esc(a.aba)}</b>: ${a.categoria ? `${a.lidas} NC(s) → ${esc(CATEGORIA_NC[a.categoria])}` : esc(a.ignorada)}</li>`).join('')}</ul>
    ${lida.unidadesSemCadastro.length ? `<p class="small" style="color:var(--warn)">Unidades sem cadastro (ficam como texto): ${lida.unidadesSemCadastro.map(([u, n]) => `${esc(u)} (${n})`).join(', ')}. Cadastre o nome em Bases → Unidades.</p>` : ''}
    <label class="campo">Competência das NCs<input type="month" name="competencia" value="${esc(compArquivo || NCV.chave)}"><span class="small muted">${compArquivo ? 'Lida do nome do arquivo.' : 'O nome do arquivo não traz a competência: confirme.'}</span></label>
    ${novosResp.length ? `<label class="small"><input type="checkbox" name="cadResp" checked> Cadastrar ${novosResp.length} responsável(is) novo(s) em Bases → Faturistas: ${novosResp.map(([n]) => esc(n)).join(', ')}</label>` : ''}
    <p class="small muted">A natureza em texto livre é lida para a lista padronizada; o texto original fica nas observações. NCs iguais já registradas na competência não são repetidas.</p>`, [['', 'Cancelar', 'sec'], ['ok', 'Importar']]);
  if (r.botao !== 'ok') return;
  const comp = r.campos.competencia;
  if (!/^\d{4}-\d{2}$/.test(comp)) return avisar('Competência inválida.', 'warn');
  if (!exigirAberta(comp, 'importar NCs')) return;
  const { novas, repetidas } = registrarNCs(S.nc, lida.dados.map(d => ({ ...d, competencia: comp, origem: { ...d.origem, arquivo: f.name } })), op);
  if (r.campos.cadResp) { const n = registrarFaturistas(S.cfg, novosResp.map(([n]) => n), `planilha de NCs ${f.name}`); if (n) salvarCfg(`${n} faturista(s) cadastrado(s) da planilha de NCs ${f.name}`, 'faturistas'); }
  salvarNC(`${novas.length} NC(s) importada(s) em ${rotuloCompetencia(comp)}${repetidas.length ? ` · ${repetidas.length} já existiam` : ''}.`);
  if (comp !== S.comp) mudarCompetencia(comp); else RENDER.nc();
}
async function exportarNC(itens, pr) {
  if (!itens.length) return avisar('Nenhuma NC nesta competência para exportar.', 'warn');
  const prazos = Object.fromEntries(Object.entries(pr.grupos).map(([k, g]) => [k, g.data]));
  await baixarZip(xlsxNC(itens, NCV.chave, { operador: S.operador, prazos }), `NAO_CONFORMIDADES_${NCV.chave.slice(5)}-${NCV.chave.slice(0, 4)}_${carimbo()}.xlsx`);
  const abertas = itens.filter(x => x.situacao === 'aberta');
  if (abertas.length && !compFechada(NCV.chave) && await confirmar('Marcar como enviadas?', `A planilha tem ${abertas.length} NC(s) abertas. Marcar como «Enviada ao Qualiex» com a data de hoje?`, 'Marcar como enviadas')) {
    const op = await exigirOperador(); if (!op) return;
    abertas.forEach(x => mudarSituacaoNC(x, 'enviada', op)); salvarNC(`${abertas.length} NC(s) marcadas como enviadas.`); RENDER.nc();
  }
}

// Depois de um diálogo: faturista ou convênio digitado fora do cadastro → oferecer cadastrar.
async function cadastrosNovosDoDialogo() {
  for (const rot of [...$('dlgCorpo').querySelectorAll('[data-busca][data-novo]')]) {
    const fonte = rot.dataset.busca, valor = rot.querySelector('[data-busca-input]').value;
    if (fonte === 'faturista' || fonte === 'convenio') await oferecerCadastro(fonte, valor);
  }
}
