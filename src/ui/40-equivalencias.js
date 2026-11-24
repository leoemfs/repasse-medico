/* ============================================================
 * Equivalências TUSS: revisão, validação em lote, conflitos, importação e exportação
 * ============================================================ */
const ORDEM_CONF = { Alta: 0, 'Média': 1, Baixa: 2 };
const FE = { busca: '', status: 'pendente', confianca: '*', ambiguo: '*', sel: new Set(), sub: 'base', vis: 'lista', gmarcas: new Map(), vb: 'rel' };

// Barra da base compartilhada no topo, explicitamente (P2; antes em 97-decoracoes.js).
RENDER.equivalencias = () => { const r = desenharEquivalencias(); const pg = $('pag-equivalencias'); if (pg && !$('eqSync')) { pg.insertAdjacentHTML('afterbegin', barraEq()); ligarBarraEq(); } return r; };
function desenharEquivalencias() {
  if (FE.sub === 'destrava') return desenharDestrava();
  if (FE.sub === 'titulos') return desenharTitulos();
  if (FE.sub === 'uso') return desenharUsoEq();   // SOL-F50   // v3.0: manutenção por título do Apolo
  const it = S.eq.itens, cont = k => it.filter(e => e.status === k).length, todosConf = conflitosEquivalencias(S.eq);
  // Conflito coberto por regra composta validada (um ou outro / juntos) não trava mais a conferência.
  const cpVal = indiceEquivalencias(S.eq).compostas || [], regraDoConf = c => cpVal.find(r => compostaCasaTitulo(r, c.titulo) > 0);
  const conf = todosConf.filter(c => !regraDoConf(c)), cobertos = todosConf.filter(c => regraDoConf(c));
  // Sugestão: título com Doppler e um código de Doppler + um código base → «juntos»; senão «um ou outro».
  const sugestaoConf = c => { const dop = c.relacoes.filter(r => /DOPPLER/.test(norm(r.descMV || ''))).length; return /DOPPLER/.test(norm(c.titulo)) && dop && dop < c.codigos.length ? 'juntos' : 'ou'; };
  const descCod = (c, cod) => c.relacoes.find(r => r.codigo === cod)?.descMV || '';
  const nCob = cont('coberta'), maisAbertos = FE.confianca !== '*' || FE.ambiguo !== '*' || FE.vis !== 'lista';
  const kpi = (k, n, t) => `<button class="eq-kpi${FE.status === k ? ' on' : ''}" data-eqst="${k}"><b>${n}</b> ${t}</button>`;
  const item = (id, t, d) => `<button id="${id}" type="button">${t}<small>${d}</small></button>`;
  const liConf = (c, i) => { const sg = sugestaoConf(c); return `<li><div>«${esc(c.titulo)}» → ${c.codigos.map(k => `<b>${esc(k)}</b> <span class="muted small">${esc(descCod(c, k))}</span>`).join(' · ')}</div>
      <div class="small muted">Possível regra composta: ${sg === 'juntos' ? '<b>juntos</b> (base + Doppler na mesma conta)' : '<b>um ou outro</b> (qualquer um dos códigos confirma o laudo)'}.</div>
      <div class="acoes" style="margin-top:4px"><button class="${sg === 'ou' ? '' : 'sec '}mini" data-confou="${i}">Um ou outro</button><button class="${sg === 'juntos' ? '' : 'sec '}mini" data-confjt="${i}">Juntos (composta)…</button><button class="sec mini" data-conf="${i}">Só um código…</button></div></li>`; };
  // v3.0.0-alpha.36 (prévia aprovada em 24/11/2026): topo enxuto, conflitos numa linha, relações e regras separadas,
  // edição na própria linha e ações em lote só com seleção.
  $('pag-equivalencias').innerHTML = `
  <div class="card"><div class="eq-topo">
      <div class="eq-kpis">${kpi('pendente', cont('pendente'), 'pendentes')}${kpi('validada', cont('validada'), 'validadas')}${kpi('desativada', cont('desativada'), 'desativadas')}${nCob ? kpi('coberta', nCob, 'cobertas por regra') : ''}${kpi('*', it.length, 'todas')}
        <span class="small muted">revisão ${S.eq.revisao}${S.eq.atualizadoEm ? ` · ${new Date(S.eq.atualizadoEm).toLocaleString('pt-BR')}` : ''}</span></div>
      <div class="eq-acoes-topo"><details class="eq-arq"><summary class="sec" role="button">Arquivos ▾</summary><div class="lista">
          <h5>Trazer</h5>${item('eqImpX', 'Importar planilha de análise (.xlsx)', 'novos pares entram como pendentes')}${item('eqImpJM', 'Juntar com outra base (.json)', 'acrescenta o que falta; não muda o que existe')}${item('eqImpJS', 'Substituir a base (.json)…', 'troca tudo; a atual fica como cópia de segurança')}
          <h5>Levar</h5>${item('eqXlsx', 'Exportar planilha para conferir (.xlsx)', 'relações e regras em abas, para ler')}${item('eqExp', 'Exportar base (.json)', 'cópia completa da base')}</div></details>
        <button id="eqNova">+ Nova</button>
        <input type="file" id="eqArqX" accept=".xlsx" hidden><input type="file" id="eqArqJM" accept=".json" hidden><input type="file" id="eqArqJS" accept=".json" hidden></div></div>
    ${S.apolo ? (() => { const n = titulosDoApolo(S.apolo, S.eq, S.cfg).filter(t => ['sem-cadastro', 'pendente', 'conflito'].includes(t.situacao)).length; return n ? `<p class="small" style="margin:10px 0 0"><span class="badge warn">${n}</span> título(s) da planilha do Apolo carregada ainda sem equivalência validada — <button class="mini" data-esub="titulos">Abrir «Títulos do Apolo»</button></p>` : ''; })() : ''}
    ${abasEq()}
    ${conf.length ? `<div class="eq-alerta err"><details id="eqConfDet"${FE.confAberto ? ' open' : ''}><summary>⚠ <b>${conf.length} conflito(s):</b> o mesmo título validado para mais de um código não confirma nenhum deles${cobertos.length ? ` · ${cobertos.length} já resolvidos por regra composta` : ''}. <u>Resolver</u></summary>
      <ul class="conflitos">${conf.map(liConf).join('')}</ul>
      <p class="small muted">Muitas vezes não é erro: o título pode ser <b>um código ou outro</b> (escroto = bolsa escrotal <i>ou</i> órgãos superficiais) ou <b>os dois juntos</b> (título com Doppler = exame base <i>e</i> Doppler). «Só um código» mantém o escolhido e volta os outros a pendente.</p></details></div>`
      : `<div class="eq-alerta">${cobertos.length ? `<details><summary>✓ <b>Sem conflitos.</b> ${cobertos.length} título(s) com mais de um código estão resolvidos por regra composta. <u>Ver</u></summary><ul class="small">${cobertos.map(c => `<li>«${esc(c.titulo)}» → ${c.codigos.map(esc).join(', ')} · regra «${esc(nomeComposta(regraDoConf(c)))}»</li>`).join('')}</ul></details>` : '✓ <b>Sem conflitos.</b>'}</div>`}
    <div class="eq-seg" role="tablist"><button data-eqvb="rel" class="${FE.vb === 'rel' ? 'on' : ''}">Relações</button><button data-eqvb="reg" class="${FE.vb === 'reg' ? 'on' : ''}">Regras compostas (${(S.eq.compostas || []).length})</button></div>
    ${FE.vb === 'reg' ? cardCompostas() : `<div id="eqRel"><div class="eq-filtros">
      <input type="search" id="eqBusca" value="${esc(FE.busca)}" placeholder="Buscar código, descrição do MV ou título do Apolo" aria-label="Buscar">
      <details class="eq-mais"${maisAbertos ? ' open' : ''}><summary class="sec mini" role="button">Mais filtros ▾</summary><div class="grid3">
        <label class="campo">Confiança da análise<select id="eqCf">${opcoes([['*', 'Todas'], ['Alta', 'Alta'], ['Média', 'Média'], ['Baixa', 'Baixa'], ['', 'Sem confiança']], FE.confianca)}</select></label>
        <label class="campo">Ambíguas<select id="eqAm">${opcoes([['*', 'Todas'], ['sim', 'Só ambíguas'], ['nao', 'Sem ambiguidade']], FE.ambiguo)}</select></label>
        <label class="campo">Mostrar<select id="eqVis">${opcoes([['lista', 'Uma relação por linha'], ['titulo', 'Agrupar por título (2+ códigos pendentes)']], FE.vis)}</select></label></div></details></div>
      <div id="eqTab"></div>
      <div class="eq-lote" id="eqLote" hidden><b id="eqInfo"></b><button id="eqVal">Validar</button><button id="eqPend" class="sec">Voltar a pendente</button><button id="eqDes" class="sec">Desativar</button><button id="eqCmp" class="sec">Criar regra composta</button><button id="eqLimpa" class="sec" aria-label="Limpar seleção">✕</button></div></div>`}</div>`;
  const pg = $('pag-equivalencias');
  pg.querySelectorAll('[data-eqst]').forEach(b => b.onclick = () => { FE.status = b.dataset.eqst; FE.sel.clear(); if (FE.vb !== 'rel') FE.vb = 'rel'; RENDER.equivalencias(); });
  pg.querySelectorAll('[data-eqvb]').forEach(b => b.onclick = () => { FE.vb = b.dataset.eqvb; FE.sel.clear(); RENDER.equivalencias(); });
  const cd = $('eqConfDet'); if (cd) cd.ontoggle = () => { FE.confAberto = cd.open; };
  const arq = pg.querySelector('.eq-arq'); arq.querySelectorAll('.lista button').forEach(b => b.addEventListener('click', () => arq.removeAttribute('open')));
  ligarAbasEq($('pag-equivalencias')); ligarCompostas($('pag-equivalencias'));
  $('pag-equivalencias').querySelectorAll('[data-conf]').forEach(b => b.onclick = () => desfazerConflito(conf[+b.dataset.conf]));
  $('pag-equivalencias').querySelectorAll('[data-confou]').forEach(b => b.onclick = () => conflitoUmOuOutro(conf[+b.dataset.confou]));
  $('pag-equivalencias').querySelectorAll('[data-confjt]').forEach(b => b.onclick = () => { const c = conf[+b.dataset.confjt];
    editarComposta(null, novaComposta({ nome: c.titulo.slice(0, 60), titulos: [c.titulo], itens: c.codigos.map(k => ({ rotulo: (descCod(c, k) || k).replace(/\s*-\s*OP$/, '').slice(0, 40), codigos: [k], qtd: 1, excecoes: [] })), origem: 'conflito de equivalência' })); });
  // Laudos do Apolo carregado por título: ajuda a priorizar o que validar primeiro.
  const usoTitulo = S.apolo ? contar(S.apolo.laudos, l => chaveTitulo(l.titulo)) : new Map();
  // SOL-F50: linhas confirmadas por cada relação nas conferências (resumos, iguais nos dois computadores).
  const usoConf = usoEquivalencias(S.usoEq, S.eq, { janela: FU.janela });
  const filtrar = () => {
    const q = norm(FE.busca);
    return S.eq.itens.filter(e => (FE.status === '*' || e.status === FE.status) && (FE.confianca === '*' || (e.confianca || '') === FE.confianca)
      && (FE.ambiguo === '*' || (FE.ambiguo === 'sim') === !!e.ambiguo) && (!q || norm(`${e.codigo} ${e.descMV} ${e.titulo}`).includes(q)))
      .sort((a, b) => (ORDEM_CONF[a.confianca] ?? 3) - (ORDEM_CONF[b.confianca] ?? 3) || (usoTitulo.get(chaveTitulo(b.titulo)) || 0) - (usoTitulo.get(chaveTitulo(a.titulo)) || 0) || a.codigo.localeCompare(b.codigo));
  };
  const info = () => { const n = FE.sel.size; $('eqLote').hidden = !n; $('eqInfo').textContent = `${n} selecionada(s)`; const t = $('eqTodos'); if (t) t.checked = n > 0 && filtrar().every(x => FE.sel.has(x.id)); };
  const ligarBotoesBase = () => {
    $('eqImpX').onclick = () => $('eqArqX').click(); $('eqArqX').onchange = e => e.target.files[0] && importarEquivalenciasArquivo(e.target.files[0], 'mesclar');
    $('eqImpJM').onclick = () => $('eqArqJM').click(); $('eqArqJM').onchange = e => e.target.files[0] && importarEquivalenciasArquivo(e.target.files[0], 'mesclar');
    $('eqImpJS').onclick = () => $('eqArqJS').click(); $('eqArqJS').onchange = e => e.target.files[0] && importarEquivalenciasArquivo(e.target.files[0], 'substituir');
    $('eqExp').onclick = () => baixarJSON(S.eq, `equivalencias_TUSS_rev${S.eq.revisao}_${carimbo()}.json`);
    $('eqXlsx').onclick = () => baixarZip(xlsxEquivalencias(S.eq, { usoTitulo, operador: S.operador }), `equivalencias_TUSS_rev${S.eq.revisao}_${carimbo()}.xlsx`);
    $('eqNova').onclick = () => FE.vb === 'reg' ? editarComposta(null) : novaRelacaoManual();
  };
  ligarBotoesBase();
  if (FE.vb === 'reg') return;
  if (FE.vis === 'titulo') { desenharGruposTitulo(usoTitulo); ligarFiltrosEq(); return; }
  const t = tabela($('eqTab'), {
    porPagina: 100, linhas: filtrar(), vazio: 'Nada neste filtro.', colunas: [
      { t: '', th: () => '<input type="checkbox" id="eqTodos" aria-label="Selecionar todas do filtro">', html: e => `<input type="checkbox" data-id="${e.id}"${FE.sel.has(e.id) ? ' checked' : ''} aria-label="Selecionar">` },
      { t: 'Procedimento no MV', html: e => `<span class="eq-cod">${esc(e.codigo)}</span><small class="nc-det">${esc(e.descMV || '')}</small>` },
      { t: 'Título do laudo (Apolo)', html: e => `${esc(e.titulo)}${S.apolo ? `<small class="nc-det">${usoTitulo.get(chaveTitulo(e.titulo)) || 0} laudo(s) no Apolo</small>` : ''}` },
      { t: 'Situação', html: e => `<span class="badge ${e.status === 'validada' ? 'ok' : e.status === 'pendente' ? 'warn' : 'info'}">${esc(STATUS_EQ[e.status])}</span>${e.ambiguo ? ' <span class="badge warn">ambígua</span>' : ''}${e.confianca && e.status === 'pendente' ? `<small class="nc-det">confiança ${esc(e.confianca)}</small>` : ''}` },
      { t: 'Uso nas conferências', html: e => textoUsoHtml(usoConf, e) }
    ],
    detalhe: e => `<div class="det"><div><p class="small" style="margin-top:0"><b>${esc(STATUS_EQ[e.status])}</b>${e.responsavel ? ` · ${esc(e.responsavel)} em ${new Date(e.validadoEm).toLocaleDateString('pt-BR')}` : ''} · ${e.escopo.unidade === '*' ? 'todas as unidades' : 'unidade ' + esc(e.escopo.unidade)}${e.escopo.modalidade === '*' ? '' : ' · ' + esc(e.escopo.modalidade)}</p>
        <h4>Análise de origem</h4><p class="small">${esc(e.justificativa || '—')}</p>${e.atencao ? `<h4>Ponto de atenção</h4><p class="small">${esc(e.atencao)}</p>` : ''}<p class="small muted">Origem: ${esc(e.origem || '—')}</p>${detalheUsoRelacao(usoConf, e)}</div>
      <div><h4>Histórico</h4>${e.historico.length ? `<ul class="small">${e.historico.map(h => `<li>${new Date(h.em).toLocaleString('pt-BR')} · ${esc(h.por)}: ${esc(STATUS_EQ[h.de] || h.de)} → ${esc(STATUS_EQ[h.para] || h.para)}${h.motivo ? ` (${esc(h.motivo)})` : ''}</li>`).join('')}</ul>` : '<p class="muted small">Sem alterações.</p>'}</div></div>
      <div class="acoes">${e.status !== 'validada' ? `<button data-equm="validada" data-eqid="${e.id}">Validar</button>` : `<button class="sec" data-equm="pendente" data-eqid="${e.id}">Voltar a pendente</button>`}${e.status !== 'desativada' ? `<button class="sec" data-equm="desativada" data-eqid="${e.id}">Desativar…</button>` : `<button class="sec" data-equm="pendente" data-eqid="${e.id}">Reativar como pendente</button>`}<button class="sec" data-eqcp1="${e.id}" style="margin-left:auto">Criar regra composta com este título</button></div>`
  });
  const ligar = () => {
    $('eqTab').querySelectorAll('input[data-id]').forEach(ch => ch.onchange = () => { ch.checked ? FE.sel.add(ch.dataset.id) : FE.sel.delete(ch.dataset.id); ch.closest('tr').classList.toggle('sel', ch.checked); info(); });
    const tod = $('eqTodos'); if (tod) tod.onchange = e => { FE.sel.clear(); if (e.target.checked) filtrar().forEach(x => FE.sel.add(x.id)); t.atualizar(filtrar()); info(); };
    // Ações da própria linha (detalhe aberto): a mesma decisão do lote, para uma relação.
    $('eqTab').querySelectorAll('[data-equm]').forEach(b => b.onclick = () => { FE.sel = new Set([b.dataset.eqid]); mudar(b.dataset.equm, { validada: 'Validar', pendente: b.textContent.startsWith('Reativar') ? 'Reativar' : 'Voltar a pendente', desativada: 'Desativar' }[b.dataset.equm]); });
    $('eqTab').querySelectorAll('[data-eqcp1]').forEach(b => b.onclick = () => { FE.sel = new Set([b.dataset.eqcp1]); compostaDasSelecionadas(); });
  };
  ligar(); new MutationObserver(ligar).observe($('eqTab'), { childList: true });
  const refiltrar = () => { FE.sel.clear(); t.atualizar(filtrar()); info(); };
  ligarFiltrosEq(refiltrar);
  $('eqCmp').onclick = () => compostaDasSelecionadas();
  $('eqLimpa').onclick = () => { FE.sel.clear(); t.atualizar(filtrar()); info(); };
  const mudar = async (status, rotulo) => {
    const op = await exigirOperador(); if (!op) return;
    const amb = S.eq.itens.filter(e => FE.sel.has(e.id) && e.ambiguo).length;
    // SOL-F50: tirar a validação mostra o que essas relações confirmaram nas conferências; com uso, a justificativa é obrigatória.
    const valSel = status === 'validada' ? [] : S.eq.itens.filter(e => FE.sel.has(e.id) && e.status === 'validada').map(e => e.id);
    const imp = valSel.length ? impactoTirarValidacao(usoConf, valSel, compDoImpacto(usoConf)) : null, exige = !!imp?.comUso;
    const r = await dialogo(`${rotulo} ${FE.sel.size} relação(ões)`, `<p>Responsável: <strong>${esc(op)}</strong>.</p>${status === 'validada' && amb ? `<p class="badge warn">${amb} relação(ões) ambíguas: confirme que o título identifica só este código.</p>` : ''}${imp ? textoImpacto(imp, valSel.length, compDoImpacto(usoConf)) : ''}<label class="campo">Justificativa${status === 'validada' ? ' (recomendada)' : exige ? ' (obrigatória: tem uso nas conferências)' : ''}<input type="text" name="motivo"></label>`, [['', 'Cancelar', 'sec'], ['ok', rotulo]]);
    if (r.botao !== 'ok') return;
    if (exige && !(r.campos.motivo || '').trim()) return avisar('Essas relações confirmaram linhas nas conferências: informe a justificativa.', 'warn');
    const n = alterarStatusEq(S.eq, [...FE.sel], status, op, motivoComUso(r.campos.motivo, imp), S.comp);
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
  $('eqCf').onchange = e => { FE.confianca = e.target.value; re(); };
  $('eqAm').onchange = e => { FE.ambiguo = e.target.value; re(); };
  $('eqVis').onchange = e => { FE.vis = e.target.value; FE.sel.clear(); RENDER.equivalencias(); };
  if (!refiltrar) { const l = $('eqLote'); if (l) l.remove(); }
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
