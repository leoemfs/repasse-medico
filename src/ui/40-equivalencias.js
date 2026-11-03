/* ============================================================
 * Equivalências TUSS: revisão, validação em lote, conflitos, importação e exportação
 * ============================================================ */
const ORDEM_CONF = { Alta: 0, 'Média': 1, Baixa: 2 };
const FE = { busca: '', status: 'pendente', confianca: '*', ambiguo: '*', sel: new Set(), sub: 'base' };

RENDER.equivalencias = () => {
  if (FE.sub === 'destrava') return desenharDestrava();
  const it = S.eq.itens, cont = k => it.filter(e => e.status === k).length, conf = conflitosEquivalencias(S.eq);
  $('pag-equivalencias').innerHTML = `
  <div class="card"><h2>Base de equivalências <span class="muted small">revisão ${S.eq.revisao} · ${S.eq.atualizadoEm ? new Date(S.eq.atualizadoEm).toLocaleString('pt-BR') : ''}</span></h2>
    <p class="lead">Ordem: confiança da análise e, depois, quantidade de laudos com o título no Apolo carregado. Cada relação liga um código TUSS do MV a um TITLE do Apolo. Só relação <strong>validada</strong>, sem conflito, sustenta confirmação automática. Candidatos importados da planilha de análise entram como pendentes; a pontuação/confiança da planilha ordena a revisão, mas não valida nada.</p>
    <div class="grid4">
      <div><span class="badge ok">${cont('validada')}</span> validadas</div><div><span class="badge warn">${cont('pendente')}</span> pendentes (${it.filter(e => e.status === 'pendente' && e.ambiguo).length} ambíguas)</div>
      <div><span class="badge info">${cont('desativada')}</span> desativadas</div><div><span class="badge ${conf.length ? 'err' : 'ok'}">${conf.length}</span> conflitos</div></div>
    <div class="acoes"><button id="eqImpX" class="sec">Importar planilha de análise (.xlsx)</button><button id="eqImpJM" class="sec">Mesclar base (.json)</button><button id="eqImpJS" class="sec">Substituir base (.json)</button><button id="eqExp">Exportar base (.json)</button><button id="eqNova" class="sec">+ Nova relação</button>
      <input type="file" id="eqArqX" accept=".xlsx" hidden><input type="file" id="eqArqJM" accept=".json" hidden><input type="file" id="eqArqJS" accept=".json" hidden></div>${abasEq()}</div>
  ${conf.length ? `<div class="card" style="border-color:var(--err)"><h2>Conflitos</h2><p class="lead">O mesmo título está validado para mais de um código. Enquanto houver conflito, esse título não confirma nenhum dos códigos.</p><ul class="conflitos">${conf.map((c, i) => `<li>«${esc(c.titulo)}» → ${c.codigos.map(esc).join(', ')} <button class="sec mini" data-conf="${i}">Desfazer conflito…</button></li>`).join('')}</ul>
    <p class="small muted">Desfazer: você escolhe o código correto e as outras validações deste título voltam a pendente, com justificativa no histórico. Quando um laudo precisar de dois códigos (ex.: articular + doppler), a regra composta virá depois (SOL-F5).</p></div>` : ''}
  <div class="card"><div class="filtros">
    <label class="campo">Buscar<input type="search" id="eqBusca" value="${esc(FE.busca)}" placeholder="código, descrição MV ou TITLE do Apolo"></label>
    <label class="campo">Status<select id="eqSt">${opcoes([['*', 'Todos'], ['pendente', 'Pendentes'], ['validada', 'Validadas'], ['desativada', 'Desativadas']], FE.status)}</select></label>
    <label class="campo">Confiança da análise<select id="eqCf">${opcoes([['*', 'Todas'], ['Alta', 'Alta'], ['Média', 'Média'], ['Baixa', 'Baixa'], ['', 'Sem confiança']], FE.confianca)}</select></label>
    <label class="campo">Ambíguas<select id="eqAm">${opcoes([['*', 'Todas'], ['sim', 'Só ambíguas'], ['nao', 'Sem ambiguidade']], FE.ambiguo)}</select></label></div>
    <div class="acoes"><label class="small"><input type="checkbox" id="eqTodos"> selecionar todas do filtro</label>
      <button id="eqVal" disabled>Validar selecionadas</button><button id="eqPend" class="sec" disabled>Voltar a pendente</button><button id="eqDes" class="perigo" disabled>Desativar</button><span id="eqInfo" class="muted small"></span></div>
    <div id="eqTab" style="margin-top:10px"></div></div>`;
  ligarAbasEq($('pag-equivalencias'));
  $('pag-equivalencias').querySelectorAll('[data-conf]').forEach(b => b.onclick = () => desfazerConflito(conf[+b.dataset.conf]));
  // Laudos do Apolo carregado por título: ajuda a priorizar o que validar primeiro.
  const usoTitulo = S.apolo ? contar(S.apolo.laudos, l => chaveTitulo(l.titulo)) : new Map();
  const filtrar = () => {
    const q = norm(FE.busca);
    return S.eq.itens.filter(e => (FE.status === '*' || e.status === FE.status) && (FE.confianca === '*' || (e.confianca || '') === FE.confianca)
      && (FE.ambiguo === '*' || (FE.ambiguo === 'sim') === !!e.ambiguo) && (!q || norm(`${e.codigo} ${e.descMV} ${e.titulo}`).includes(q)))
      .sort((a, b) => (ORDEM_CONF[a.confianca] ?? 3) - (ORDEM_CONF[b.confianca] ?? 3) || (usoTitulo.get(chaveTitulo(b.titulo)) || 0) - (usoTitulo.get(chaveTitulo(a.titulo)) || 0) || a.codigo.localeCompare(b.codigo));
  };
  const info = () => { const n = FE.sel.size; ['eqVal', 'eqPend', 'eqDes'].forEach(id => $(id).disabled = !n); $('eqInfo').textContent = n ? `${n} selecionada(s)` : ''; };
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
  $('eqBusca').oninput = e => { FE.busca = e.target.value; refiltrar(); };
  $('eqSt').onchange = e => { FE.status = e.target.value; refiltrar(); };
  $('eqCf').onchange = e => { FE.confianca = e.target.value; refiltrar(); };
  $('eqAm').onchange = e => { FE.ambiguo = e.target.value; refiltrar(); };
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
  $('eqImpX').onclick = () => $('eqArqX').click(); $('eqArqX').onchange = e => e.target.files[0] && importarEquivalenciasArquivo(e.target.files[0], 'mesclar');
  $('eqImpJM').onclick = () => $('eqArqJM').click(); $('eqArqJM').onchange = e => e.target.files[0] && importarEquivalenciasArquivo(e.target.files[0], 'mesclar');
  $('eqImpJS').onclick = () => $('eqArqJS').click(); $('eqArqJS').onchange = e => e.target.files[0] && importarEquivalenciasArquivo(e.target.files[0], 'substituir');
  $('eqExp').onclick = () => baixarJSON(S.eq, `equivalencias_TUSS_rev${S.eq.revisao}_${carimbo()}.json`);
  $('eqNova').onclick = novaRelacaoManual;
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
