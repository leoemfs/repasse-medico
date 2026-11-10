/* ============================================================
 * Equivalências TUSS: revisão, validação em lote, conflitos, importação e exportação
 * ============================================================ */
const ORDEM_CONF = { Alta: 0, 'Média': 1, Baixa: 2 };
const FE = { busca: '', status: 'pendente', confianca: '*', ambiguo: '*', sel: new Set(), sub: 'base', vis: 'lista', gmarcas: new Map() };

RENDER.equivalencias = () => {
  if (FE.sub === 'destrava') return desenharDestrava();
  if (FE.sub === 'titulos') return desenharTitulos();   // v3.0: manutenção por título do Apolo
  if (aplicarCobertas(S.eq, S.operador, S.comp)) gravarLocal(CHAVES.eq, S.eq);   // relações resolvidas por regra composta validada
  const it = S.eq.itens, cont = k => it.filter(e => e.status === k).length, todosConf = conflitosEquivalencias(S.eq);
  // Conflito coberto por regra composta validada (um ou outro / juntos) não trava mais a conferência.
  const cpVal = indiceEquivalencias(S.eq).compostas || [], regraDoConf = c => cpVal.find(r => compostaCasaTitulo(r, c.titulo) > 0);
  const conf = todosConf.filter(c => !regraDoConf(c)), cobertos = todosConf.filter(c => regraDoConf(c));
  // Sugestão: título com Doppler e um código de Doppler + um código base → «juntos»; senão «um ou outro».
  const sugestaoConf = c => { const dop = c.relacoes.filter(r => /DOPPLER/.test(norm(r.descMV || ''))).length; return /DOPPLER/.test(norm(c.titulo)) && dop && dop < c.codigos.length ? 'juntos' : 'ou'; };
  const descCod = (c, cod) => c.relacoes.find(r => r.codigo === cod)?.descMV || '';
  $('pag-equivalencias').innerHTML = `
  <div class="card"><h2>Base de equivalências <span class="muted small">revisão ${S.eq.revisao} · ${S.eq.atualizadoEm ? new Date(S.eq.atualizadoEm).toLocaleString('pt-BR') : ''}</span></h2>
    <p class="lead">Ordem: confiança da análise e, depois, quantidade de laudos com o título no Apolo carregado. Cada relação liga um código TUSS do MV a um TITLE do Apolo. Só relação <strong>validada</strong>, sem conflito, sustenta confirmação automática. Candidatos importados da planilha de análise entram como pendentes; a pontuação/confiança da planilha ordena a revisão, mas não valida nada.</p>
    <div class="grid4">
      <div><span class="badge ok">${cont('validada')}</span> validadas</div><div><span class="badge warn">${cont('pendente')}</span> pendentes (${it.filter(e => e.status === 'pendente' && e.ambiguo).length} ambíguas)</div>
      <div><span class="badge info">${cont('desativada')}</span> desativadas${cont('coberta') ? ` · <span class="badge info">${cont('coberta')}</span> cobertas por regra composta` : ''}</div><div><span class="badge ${conf.length ? 'err' : 'ok'}">${conf.length}</span> conflitos</div></div>
    ${S.apolo ? (() => { const n = titulosDoApolo(S.apolo, S.eq, S.cfg).filter(t => ['sem-cadastro', 'pendente', 'conflito'].includes(t.situacao)).length; return n ? `<p class="small"><span class="badge warn">${n}</span> título(s) da planilha do Apolo carregada ainda sem equivalência validada — <button class="mini" data-esub="titulos">Abrir «Títulos do Apolo»</button></p>` : ''; })() : ''}
    <div class="acoes"><button id="eqImpX" class="sec">Importar planilha de análise (.xlsx)</button><button id="eqImpJM" class="sec">Mesclar base (.json)</button><button id="eqImpJS" class="sec">Substituir base (.json)</button><button id="eqXlsx">Exportar planilha (.xlsx)</button><button id="eqExp" class="sec">Exportar base (.json)</button><button id="eqNova" class="sec">+ Nova relação</button>
      <input type="file" id="eqArqX" accept=".xlsx" hidden><input type="file" id="eqArqJM" accept=".json" hidden><input type="file" id="eqArqJS" accept=".json" hidden></div>${abasEq()}</div>
  ${conf.length || cobertos.length ? `<div class="card"${conf.length ? ' style="border-color:var(--err)"' : ''}><h2>Conflitos</h2>
    ${conf.length ? `<p class="lead">O mesmo título está validado para mais de um código. Enquanto houver conflito, esse título não confirma nenhum dos códigos. Muitas vezes não é erro: o título pode ser <b>um código ou outro</b> (ex.: escroto = bolsa escrotal <i>ou</i> órgãos superficiais) ou <b>os dois juntos</b> (ex.: título com Doppler = exame base <i>e</i> Doppler na mesma conta).</p>
    <ul class="conflitos">${conf.map((c, i) => { const sg = sugestaoConf(c); return `<li><div>«${esc(c.titulo)}» → ${c.codigos.map(k => `<b>${esc(k)}</b> <span class="muted small">${esc(descCod(c, k))}</span>`).join(' · ')}</div>
      <div class="small muted">Possível regra composta: ${sg === 'juntos' ? '<b>juntos</b> (base + Doppler na mesma conta)' : '<b>um ou outro</b> (qualquer um dos códigos confirma o laudo)'}.</div>
      <div class="acoes" style="margin-top:4px"><button class="${sg === 'ou' ? '' : 'sec '}mini" data-confou="${i}">Um ou outro</button><button class="${sg === 'juntos' ? '' : 'sec '}mini" data-confjt="${i}">Juntos (composta)…</button><button class="sec mini" data-conf="${i}">Só um código…</button></div></li>`; }).join('')}</ul>
    <p class="small muted">«Um ou outro» cria uma regra composta validada com os códigos como alternativas (o laudo sustenta uma linha). «Juntos» abre o cadastro da regra composta já preenchido (quantidade e convênio você ajusta). «Só um código» mantém o código escolhido e volta os outros a pendente. As relações validadas continuam no histórico.</p>` : ''}
    ${cobertos.length ? `<details class="small"><summary>${cobertos.length} título(s) com mais de um código resolvidos por regra composta</summary><ul>${cobertos.map(c => `<li>«${esc(c.titulo)}» → ${c.codigos.map(esc).join(', ')} · regra «${esc(nomeComposta(regraDoConf(c)))}»</li>`).join('')}</ul></details>` : ''}</div>` : ''}
  ${cardCompostas()}
  <div class="card"><div class="filtros">
    <label class="campo">Buscar<input type="search" id="eqBusca" value="${esc(FE.busca)}" placeholder="código, descrição MV ou TITLE do Apolo"></label>
    <label class="campo">Status<select id="eqSt">${opcoes([['*', 'Todos'], ['pendente', 'Pendentes'], ['validada', 'Validadas'], ['desativada', 'Desativadas'], ['coberta', 'Cobertas por regra composta']], FE.status)}</select></label>
    <label class="campo">Visualização<select id="eqVis">${opcoes([['lista', 'Uma relação por linha'], ['titulo', 'Agrupar por título (2+ códigos pendentes)']], FE.vis)}</select></label>
    <label class="campo">Confiança da análise<select id="eqCf">${opcoes([['*', 'Todas'], ['Alta', 'Alta'], ['Média', 'Média'], ['Baixa', 'Baixa'], ['', 'Sem confiança']], FE.confianca)}</select></label>
    <label class="campo">Ambíguas<select id="eqAm">${opcoes([['*', 'Todas'], ['sim', 'Só ambíguas'], ['nao', 'Sem ambiguidade']], FE.ambiguo)}</select></label></div>
    <div class="acoes"><label class="small"><input type="checkbox" id="eqTodos"> selecionar todas do filtro</label>
      <button id="eqVal" disabled>Validar selecionadas</button><button id="eqPend" class="sec" disabled>Voltar a pendente</button><button id="eqDes" class="perigo" disabled>Desativar</button><button id="eqCmp" class="cp-bt" disabled>Criar regra composta com as selecionadas…</button><span id="eqInfo" class="muted small"></span></div>
    <div id="eqTab" style="margin-top:10px"></div></div>`;
  ligarAbasEq($('pag-equivalencias')); ligarCompostas($('pag-equivalencias'));
  $('pag-equivalencias').querySelectorAll('[data-conf]').forEach(b => b.onclick = () => desfazerConflito(conf[+b.dataset.conf]));
  $('pag-equivalencias').querySelectorAll('[data-confou]').forEach(b => b.onclick = () => conflitoUmOuOutro(conf[+b.dataset.confou]));
  $('pag-equivalencias').querySelectorAll('[data-confjt]').forEach(b => b.onclick = () => { const c = conf[+b.dataset.confjt];
    editarComposta(null, novaComposta({ nome: c.titulo.slice(0, 60), titulos: [c.titulo], itens: c.codigos.map(k => ({ rotulo: (descCod(c, k) || k).replace(/\s*-\s*OP$/, '').slice(0, 40), codigos: [k], qtd: 1, excecoes: [] })), origem: 'conflito de equivalência' })); });
  // Laudos do Apolo carregado por título: ajuda a priorizar o que validar primeiro.
  const usoTitulo = S.apolo ? contar(S.apolo.laudos, l => chaveTitulo(l.titulo)) : new Map();
  const filtrar = () => {
    const q = norm(FE.busca);
    return S.eq.itens.filter(e => (FE.status === '*' || e.status === FE.status) && (FE.confianca === '*' || (e.confianca || '') === FE.confianca)
      && (FE.ambiguo === '*' || (FE.ambiguo === 'sim') === !!e.ambiguo) && (!q || norm(`${e.codigo} ${e.descMV} ${e.titulo}`).includes(q)))
      .sort((a, b) => (ORDEM_CONF[a.confianca] ?? 3) - (ORDEM_CONF[b.confianca] ?? 3) || (usoTitulo.get(chaveTitulo(b.titulo)) || 0) - (usoTitulo.get(chaveTitulo(a.titulo)) || 0) || a.codigo.localeCompare(b.codigo));
  };
  const info = () => { const n = FE.sel.size; ['eqVal', 'eqPend', 'eqDes', 'eqCmp'].forEach(id => $(id).disabled = !n); $('eqInfo').textContent = n ? `${n} selecionada(s)` : ''; };
  const ligarBotoesBase = () => {
    $('eqImpX').onclick = () => $('eqArqX').click(); $('eqArqX').onchange = e => e.target.files[0] && importarEquivalenciasArquivo(e.target.files[0], 'mesclar');
    $('eqImpJM').onclick = () => $('eqArqJM').click(); $('eqArqJM').onchange = e => e.target.files[0] && importarEquivalenciasArquivo(e.target.files[0], 'mesclar');
    $('eqImpJS').onclick = () => $('eqArqJS').click(); $('eqArqJS').onchange = e => e.target.files[0] && importarEquivalenciasArquivo(e.target.files[0], 'substituir');
    $('eqExp').onclick = () => baixarJSON(S.eq, `equivalencias_TUSS_rev${S.eq.revisao}_${carimbo()}.json`);
    $('eqXlsx').onclick = () => baixarZip(xlsxEquivalencias(S.eq, { usoTitulo, operador: S.operador }), `equivalencias_TUSS_rev${S.eq.revisao}_${carimbo()}.xlsx`);
    $('eqNova').onclick = novaRelacaoManual;
  };
  ligarBotoesBase();
  if (FE.vis === 'titulo') { desenharGruposTitulo(usoTitulo); ligarFiltrosEq(); return; }
  const t = tabela($('eqTab'), {
    porPagina: 100, linhas: filtrar(), colunas: [
      { t: '', html: e => `<input type="checkbox" data-id="${e.id}"${FE.sel.has(e.id) ? ' checked' : ''}>` },
      { t: 'Código', v: e => e.codigo }, { t: 'Descrição MV', v: e => e.descMV }, { t: 'TITLE do Apolo', v: e => e.titulo },
      { t: 'Status', html: e => `<span class="badge ${e.status === 'validada' ? 'ok' : e.status === 'pendente' ? 'warn' : 'info'}">${esc(STATUS_EQ[e.status])}</span>${e.ambiguo ? ' <span class="badge warn">ambígua</span>' : ''}` },
      { t: 'Confiança', v: e => e.confianca }, { t: 'Laudos no Apolo', n: true, v: e => S.apolo ? (usoTitulo.get(chaveTitulo(e.titulo)) || 0) : '—' }, { t: 'Escopo', v: e => `${e.escopo.unidade === '*' ? 'todas as unidades' : 'unidade ' + e.escopo.unidade}${e.escopo.modalidade === '*' ? '' : ' · ' + e.escopo.modalidade}` },
      { t: 'Responsável', v: e => e.responsavel ? `${e.responsavel} · ${new Date(e.validadoEm).toLocaleDateString('pt-BR')}` : '' }
    ],
    detalhe: e => `<div class="det"><div><h4>Análise de origem</h4><p class="small">${esc(e.justificativa || '—')}</p><h4>Ponto de atenção</h4><p class="small">${esc(e.atencao || '—')}</p><p class="small muted">Origem: ${esc(e.origem || '—')}</p></div>
      <div><h4>Histórico</h4>${e.historico.length ? `<ul class="small">${e.historico.map(h => `<li>${new Date(h.em).toLocaleString('pt-BR')} · ${esc(h.por)}: ${esc(STATUS_EQ[h.de] || h.de)} → ${esc(STATUS_EQ[h.para] || h.para)}${h.motivo ? ` (${esc(h.motivo)})` : ''}</li>`).join('')}</ul>` : '<p class="muted small">Sem alterações.</p>'}</div></div>`
  });
  const ligar = () => $('eqTab').querySelectorAll('input[data-id]').forEach(ch => ch.onchange = () => { ch.checked ? FE.sel.add(ch.dataset.id) : FE.sel.delete(ch.dataset.id); info(); });
  ligar(); new MutationObserver(ligar).observe($('eqTab'), { childList: true });
  const refiltrar = () => { FE.sel.clear(); $('eqTodos').checked = false; t.atualizar(filtrar()); info(); };
  ligarFiltrosEq(refiltrar);
  $('eqCmp').onclick = () => compostaDasSelecionadas();
  $('eqTodos').onchange = e => { FE.sel.clear(); if (e.target.checked) filtrar().forEach(x => FE.sel.add(x.id)); t.atualizar(filtrar()); info(); };
  const mudar = async (status, rotulo) => {
    const op = await exigirOperador(); if (!op) return;
    const amb = S.eq.itens.filter(e => FE.sel.has(e.id) && e.ambiguo).length;
    const r = await dialogo(`${rotulo} ${FE.sel.size} relação(ões)`, `<p>Responsável: <strong>${esc(op)}</strong>.</p>${status === 'validada' && amb ? `<p class="badge warn">${amb} relação(ões) ambíguas: confirme que o título identifica só este código.</p>` : ''}<label class="campo">Justificativa${status === 'validada' ? ' (recomendada)' : ''}<input type="text" name="motivo"></label>`, [['', 'Cancelar', 'sec'], ['ok', rotulo]]);
    if (r.botao !== 'ok') return;
    const n = alterarStatusEq(S.eq, [...FE.sel], status, op, r.campos.motivo, S.comp);
    FE.sel.clear(); salvarEq(`${n} relação(ões) atualizadas.`); RENDER.equivalencias();
  };
  $('eqVal').onclick = () => mudar('validada', 'Validar');
  $('eqPend').onclick = () => mudar('pendente', 'Voltar a pendente');
  $('eqDes').onclick = () => mudar('desativada', 'Desativar');
};

async function novaRelacaoManual() {
  const op = await exigirOperador(); if (!op) return;
  const tuss = S.eq.catalogoTUSS || [];
  const r = await dialogo('Nova relação código × título', `
    ${campoBusca({ nome: 'codigo', rotulo: 'Código TUSS do MV', fonte: 'tuss', valorCodigo: true, livre: true })}
    ${campoBusca({ nome: 'titulo', rotulo: 'TITLE do Apolo (exatamente como aparece)', fonte: 'titulo', livre: true })}
    <div class="grid2"><label class="campo">Unidade<select name="unidade"><option value="*">Todas</option>${opcoes(S.cfg.unidades.map(u => [u.cod, `${u.cod} - ${u.nome}`]))}</select></label>
    <label class="campo">Modalidade<select name="modalidade"><option value="*">Todas</option>${opcoes(Object.entries(NOME_MODALIDADE))}</select></label></div>
    <label class="campo">Justificativa<input type="text" name="just"></label>
    <label class="small"><input type="checkbox" name="validar"> já validar (responsável: ${esc(op)})</label>`, [['', 'Cancelar', 'sec'], ['ok', 'Cadastrar']]);
  if (r.botao !== 'ok') return;
  const codigo = (r.campos.codigo || '').replace(/\D/g, ''), titulo = (r.campos.titulo || '').trim();
  if (codigo.length < 5 || !titulo) return avisar('Informe o código TUSS completo e o título.', 'warn');
  const e = novaRelacao({ codigo, titulo, descMV: tuss.find(t => t.codigo === codigo)?.desc || catalogo('tuss', S.cfg, contextoCatalogo()).find(t => t.cod === codigo)?.nome || '', escopo: { unidade: r.campos.unidade, modalidade: r.campos.modalidade }, justificativa: r.campos.just || '', origem: `cadastro manual (${op})` });
  const m = mesclarEquivalencias(S.eq, [e]);
  if (!m.adicionadas) return avisar('Essa relação já existe na base.', 'warn');
  S.eq.revisao++; S.eq.atualizadoEm = agoraISO();
  if (r.campos.validar) alterarStatusEq(S.eq, [e.id], 'validada', op, r.campos.just || 'cadastro manual', S.comp);
  salvarEq('Relação cadastrada.'); RENDER.equivalencias();
}

async function desfazerConflito(c) {
  const op = await exigirOperador(); if (!op) return;
  const porCodigo = [...new Map(c.relacoes.map(e => [e.codigo, e])).values()];
  const r = await dialogo('Desfazer conflito', `<p class="small">«${esc(c.titulo)}» está validado para ${porCodigo.length} códigos. Escolha o correto: as validações dos outros voltam a pendente.</p>
    ${porCodigo.map((e, i) => `<label class="opcao-conf"><input type="radio" name="codigo" value="${esc(e.codigo)}"${i ? '' : ' checked'}> <b>${esc(e.codigo)}</b> — ${esc(e.descMV || '')} <span class="muted small">(validada por ${esc(e.responsavel || '—')}${e.validadoEm ? ' em ' + new Date(e.validadoEm).toLocaleDateString('pt-BR') : ''})</span></label>`).join('')}
    <label class="campo">Justificativa (obrigatória)<input type="text" name="just"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Manter o escolhido']]);
  if (r.botao !== 'ok') return;
  if (!r.campos.just.trim()) return avisar('Informe a justificativa para desfazer o conflito.', 'warn');
  try {
    const n = resolverConflito(S.eq, c.chave, r.campos.codigo, op, r.campos.just, S.comp);
    salvarEq(`Conflito desfeito em «${c.titulo}»: mantido ${r.campos.codigo}; ${n} relação(ões) voltaram a pendente.`);
  } catch (e) { return avisar(e.message, 'err'); }
  RENDER.equivalencias();
}

// Conflito → regra composta «um ou outro»: qualquer um dos códigos confirma o laudo (uma linha).
async function conflitoUmOuOutro(c) {
  const op = await exigirOperador(); if (!op) return;
  const r = await dialogo(`«${c.titulo}»: um código ou outro`, `<p class="small">Cria uma regra composta <b>validada</b> por ${esc(op)}: o título confirma <b>uma</b> linha com qualquer um destes códigos.</p>
    <ul class="small">${c.relacoes.filter((x, i, a) => a.findIndex(y => y.codigo === x.codigo) === i).map(x => `<li><b>${esc(x.codigo)}</b> — ${esc(x.descMV || '')}</li>`).join('')}</ul>
    <label class="campo">Justificativa (obrigatória)<input type="text" name="just" placeholder="ex.: escroto pode ser lançado como bolsa escrotal ou órgãos superficiais"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Criar e validar']]);
  if (r.botao !== 'ok') return;
  if (!r.campos.just?.trim()) return avisar('Informe a justificativa.', 'warn');
  const nova = novaComposta({ nome: `${c.titulo.slice(0, 50)} (um ou outro)`, titulos: [c.titulo], itens: [{ rotulo: 'um dos códigos', codigos: [...c.codigos], qtd: 1, excecoes: [] }], justificativa: r.campos.just.trim(), origem: 'conflito de equivalência' });
  S.eq.compostas = S.eq.compostas || []; S.eq.compostas.push(nova);
  alterarStatusComposta(S.eq, nova.id, 'validada', op, r.campos.just.trim(), S.comp);
  salvarEq(`Regra composta «${nova.nome}» validada: o conflito deixa de travar a conferência.`); RENDER.equivalencias();
}

// Filtros da lista (nas duas visualizações). Sem refiltrar (visualização por título), redesenha a página.
function ligarFiltrosEq(refiltrar) {
  const re = refiltrar || (() => RENDER.equivalencias());
  $('eqBusca').oninput = e => { FE.busca = e.target.value; if (refiltrar) re(); else { clearTimeout(FE.tBusca); FE.tBusca = setTimeout(() => { RENDER.equivalencias(); $('eqBusca').focus(); $('eqBusca').setSelectionRange(FE.busca.length, FE.busca.length); }, 350); } };
  $('eqSt').onchange = e => { FE.status = e.target.value; re(); };
  $('eqCf').onchange = e => { FE.confianca = e.target.value; re(); };
  $('eqAm').onchange = e => { FE.ambiguo = e.target.value; re(); };
  $('eqVis').onchange = e => { FE.vis = e.target.value; FE.sel.clear(); RENDER.equivalencias(); };
  if (!refiltrar) ['eqTodos', 'eqVal', 'eqPend', 'eqDes', 'eqCmp'].forEach(id => { const el = $(id); if (el) (el.closest('label') || el).style.display = 'none'; });
}
const rotuloCurto = d => String(d || '').replace(/\s*-\s*OP$/, '').slice(0, 40);
// «Criar regra composta com as selecionadas»: abre o cadastro com os títulos e os códigos marcados.
function compostaDasSelecionadas() {
  const sel = S.eq.itens.filter(e => FE.sel.has(e.id)); if (!sel.length) return;
  const titulos = [...new Set(sel.map(e => e.titulo))], cods = [...new Map(sel.map(e => [e.codigo, e])).values()];
  if (cods.length > MAX_ITENS_CP) avisar(`São ${cods.length} códigos; a regra comporta ${MAX_ITENS_CP}. Os demais ficam de fora — ajuste no cadastro.`, 'warn');
  editarComposta(null, novaComposta({ nome: titulos[0].slice(0, 60), titulos, itens: cods.slice(0, MAX_ITENS_CP).map(e => ({ rotulo: rotuloCurto(e.descMV) || e.codigo, codigos: [e.codigo], qtd: 1, excecoes: [] })) }));
}
// Visualização por título: só títulos com 2+ códigos pendentes; três decisões por título.
function desenharGruposTitulo(usoTitulo) {
  const q = norm(FE.busca), grupos = new Map();
  for (const e of S.eq.itens) {
    if (e.status !== 'pendente' || (q && !norm(`${e.codigo} ${e.descMV} ${e.titulo}`).includes(q))) continue;
    const k = chaveTitulo(e.titulo), g = grupos.get(k) || grupos.set(k, { k, titulo: e.titulo, rel: [] }).get(k); g.rel.push(e);
  }
  const lista = [...grupos.values()].map(g => ({ ...g, cods: [...new Map(g.rel.map(e => [e.codigo, e])).values()] })).filter(g => g.cods.length > 1)
    .sort((a, b) => (usoTitulo.get(b.k) || 0) - (usoTitulo.get(a.k) || 0) || a.titulo.localeCompare(b.titulo));
  const marcados = g => FE.gmarcas.get(g.k) || new Set(g.cods.map(e => e.codigo));
  const PAG = 60, pag = Math.min(FE.gpag || 0, Math.max(0, Math.ceil(lista.length / PAG) - 1)), vis = lista.slice(pag * PAG, (pag + 1) * PAG);
  $('eqTab').innerHTML = `<p class="small muted">${lista.length} título(s) com 2 ou mais códigos pendentes. Na maioria é «um código <i>ou</i> outro» (ex.: mamografia digital ou convencional); alguns são «um <i>e</i> outro» (ex.: Doppler de mamas = USG mamas + Doppler). Marque os códigos e escolha.</p>
    <div class="tw"><table class="eq-grupos"><thead><tr><th>TITLE do Apolo</th><th class="num">Laudos</th><th>Códigos pendentes para este título</th><th>Decisão</th></tr></thead><tbody>
    ${vis.map((g, i) => { const m = marcados(g); return `<tr data-gi="${pag * PAG + i}"><td><b>${esc(g.titulo)}</b></td><td class="num">${S.apolo ? (usoTitulo.get(g.k) || 0) : '—'}</td>
      <td>${g.cods.map(e => `<label class="tag-cod"><input type="checkbox" data-gcod="${esc(e.codigo)}"${m.has(e.codigo) ? ' checked' : ''}> ${esc(e.codigo)} <span class="muted">${esc(rotuloCurto(e.descMV))}</span>${e.confianca ? ` <span class="muted small">(${esc(e.confianca)})</span>` : ''}</label>`).join('')}</td>
      <td><div class="acoes" style="margin:0"><button class="cp-bt mini" data-gac="juntos">Juntos (composta)…</button><button class="sec mini" data-gac="ou">Um ou outro</button><button class="sec mini" data-gac="so">Só o marcado</button></div></td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">Nenhum título com mais de um código pendente.</td></tr>'}
    </tbody></table></div>
    ${lista.length > PAG ? `<div class="acoes"><button class="sec mini" data-gpag="-1"${pag ? '' : ' disabled'}>‹ Anterior</button><span class="small muted">${pag * PAG + 1}–${Math.min(lista.length, (pag + 1) * PAG)} de ${lista.length}</span><button class="sec mini" data-gpag="1"${(pag + 1) * PAG < lista.length ? '' : ' disabled'}>Próxima ›</button></div>` : ''}
    <p class="small muted">«Juntos» abre o cadastro da regra composta já preenchido (quantidade e convênio ali; simule antes de validar). «Um ou outro»: o laudo confere com qualquer um dos marcados (uma linha) — vira regra validada. «Só o marcado»: valida a relação do código marcado; os outros códigos do título são desativados («outro código escolhido para este título»). As relações cobertas por regra validada saem de Pendentes e voltam se a regra for desativada.</p>`;
  $('eqTab').querySelectorAll('[data-gpag]').forEach(b => b.onclick = () => { FE.gpag = pag + +b.dataset.gpag; desenharGruposTitulo(usoTitulo); });
  $('eqTab').querySelectorAll('[data-gcod]').forEach(ch => ch.onchange = () => { const g = lista[+ch.closest('tr').dataset.gi], m = new Set(marcados(g)); ch.checked ? m.add(ch.dataset.gcod) : m.delete(ch.dataset.gcod); FE.gmarcas.set(g.k, m); });
  $('eqTab').querySelectorAll('[data-gac]').forEach(b => b.onclick = () => decidirGrupoTitulo(lista[+b.closest('tr').dataset.gi], [...marcados(lista[+b.closest('tr').dataset.gi])], b.dataset.gac));
}
async function decidirGrupoTitulo(g, cods, acao) {
  const op = await exigirOperador(); if (!op) return;
  const desc = c => rotuloCurto(g.cods.find(e => e.codigo === c)?.descMV) || c;
  if (acao === 'juntos') {
    if (cods.length < 2) return avisar('Marque pelo menos dois códigos para «Juntos».', 'warn');
    return editarComposta(null, novaComposta({ nome: g.titulo.slice(0, 60), titulos: [g.titulo], itens: cods.slice(0, MAX_ITENS_CP).map(c => ({ rotulo: desc(c), codigos: [c], qtd: 1, excecoes: [] })) }));
  }
  if (acao === 'ou') {
    if (cods.length < 2) return avisar('Marque pelo menos dois códigos para «Um ou outro».', 'warn');
    const r = await dialogo(`«${g.titulo}»: um código ou outro`, `<p class="small">Cria uma regra composta <b>validada</b> por ${esc(op)}: o título confirma <b>uma</b> linha com qualquer um destes códigos.</p><ul class="small">${cods.map(c => `<li><b>${esc(c)}</b> — ${esc(desc(c))}</li>`).join('')}</ul><label class="campo">Justificativa (obrigatória)<input type="text" name="just"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Criar e validar']]);
    if (r.botao !== 'ok') return; if (!r.campos.just?.trim()) return avisar('Informe a justificativa.', 'warn');
    const nova = novaComposta({ nome: `${g.titulo.slice(0, 50)} (um ou outro)`, titulos: [g.titulo], itens: [{ rotulo: 'um dos códigos', codigos: cods, qtd: 1, excecoes: [] }], justificativa: r.campos.just.trim(), origem: `lista de pendentes (${op})` });
    (S.eq.compostas ||= []).push(nova); alterarStatusComposta(S.eq, nova.id, 'validada', op, r.campos.just.trim(), S.comp);
    FE.gmarcas.delete(g.k); salvarEq(`Regra «${nova.nome}» validada.`); return RENDER.equivalencias();
  }
  if (cods.length !== 1) return avisar('Para «Só o marcado», deixe marcado um código só.', 'warn');
  const outros = g.rel.filter(e => e.codigo !== cods[0]), este = g.rel.filter(e => e.codigo === cods[0]);
  const r = await dialogo(`«${g.titulo}» → ${cods[0]}`, `<p class="small">Valida <b>${esc(cods[0])}</b> — ${esc(desc(cods[0]))} para este título (responsável ${esc(op)}). ${outros.length} relação(ões) com outros códigos deste título ficam desativadas.</p><label class="campo">Justificativa (recomendada)<input type="text" name="just"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Validar']]);
  if (r.botao !== 'ok') return;
  alterarStatusEq(S.eq, este.map(e => e.id), 'validada', op, r.campos.just || '', S.comp);
  alterarStatusEq(S.eq, outros.map(e => e.id), 'desativada', op, `outro código escolhido para este título (${cods[0]})`, S.comp);
  FE.gmarcas.delete(g.k); salvarEq(`«${g.titulo}» → ${cods[0]} validada.`); RENDER.equivalencias();
}
