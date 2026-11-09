/* ============================================================
 * Equivalências → regras compostas e por convênio (SOL-F5, v2 de 04/11/2026)
 * Um exame laudado no Apolo pode corresponder a vários procedimentos na conta do MV. A lista mostra a
 * efetividade de cada regra na competência (contas que ela sustentou), e o cadastro usa a busca da base.
 * Só regra validada, com responsável, vale na conferência.
 * ============================================================ */
const CP = { simulacoes: new Map() };   // id da regra → último resultado da simulação (só nesta sessão)
const MAX_ITENS_CP = 6;
function descricaoItem(it) {
  const tuss = S.eq.catalogoTUSS || [], d = c => tuss.find(t => String(t.codigo) === String(c))?.desc || '';
  return `${esc(it.rotulo || d(it.codigos[0]) || it.codigos[0])}${it.qtd !== 1 ? ` <b>×${it.qtd}</b>` : ''}<small class="nc-det">${it.codigos.map(esc).join(' ou ')}</small>`;
}
function cardCompostas() {
  const l = (S.eq.compostas || []).map(regraComposta), ef = efetividadeCompostas(S.rodadas || [], S.comp);
  const efet = c => {
    const e = ef.get(c.id), sim = CP.simulacoes.get(c.id);
    if (c.status === 'validada' && e) return `<b>${e.contas.size} conta(s)</b><small class="nc-det">${e.linhas} linha(s) conferida(s)${e.falta ? ` · ${e.falta} faltando` : ''}${e.sobra ? ` · ${e.sobra} sobrando` : ''}</small><button class="sec mini" data-cmpex="${c.id}">exemplos</button>`;
    if (sim) return `<span class="muted small">simulação:</span> <b>${sim.contas} conta(s)</b><small class="nc-det">${sim.linhas} linha(s)${sim.falta ? ` · ${sim.falta} faltando` : ''}${sim.sobra ? ` · ${sim.sobra} sobrando` : ''}</small>`;
    return `<button class="sec mini" data-cmpsim="${c.id}">Simular</button>`;
  };
  return `<div class="card" id="cardCompostas"><h2>Regras compostas e por convênio <span class="muted small">${l.filter(c => c.status === 'validada').length} validada(s) · ${l.filter(c => c.status === 'pendente').length} pendente(s) · efetividade na competência ${rotuloCompetencia(S.comp)}</span></h2>
    <p class="lead">Quando um exame laudado corresponde a <b>vários procedimentos</b> na conta (ex.: TC abdome total = abdome superior + inferior; USG de mamas com Doppler = mamas + Doppler ×2; na UNIMED, só um Doppler). A conferência aceita um laudo para cada procedimento esperado e aponta o que falta ou sobra. «Nesta competência» conta o que a regra sustentou na última rodada de cada relatório.</p>
    ${l.length ? `<div class="tw"><table><thead><tr><th>Regra</th><th>Títulos do Apolo</th><th>Composição no MV</th><th>Exceções por convênio</th><th class="n">Nesta competência</th><th>Situação</th><th></th></tr></thead><tbody>${l.map(c => `<tr>
      <td><b>${esc(nomeComposta(c))}</b>${c.escopo.unidade === '*' ? '' : `<small class="nc-det">unidade ${esc(c.escopo.unidade)}</small>`}<small class="cp-leitura">${esc(leituraRegraComposta(c, descTussUI, true))}</small></td>
      <td class="small">${c.titulos.map(t => `<span class="tag-cp">${esc(t)}</span>`).join(' ')}${(c.titulosMesmoEstudo || []).length ? `<div class="muted" style="margin-top:4px">Mesmo estudo: ${c.titulosMesmoEstudo.map(t => `<span class="tag-cp">${esc(t)}</span>`).join(' ')}</div>` : ''}${c.palavras && ((c.palavras.todas || []).length || (c.palavras.umaDe || []).length) ? ` <span class="tag-cp">contém ${esc((c.palavras.todas || []).join(' + '))}${(c.palavras.umaDe || []).length ? ` e um de ${esc(c.palavras.umaDe.join(' · '))}` : ''}</span>` : ''}</td>
      <td class="small">${c.itens.map(descricaoItem).join('<span class="muted"> + </span>')}</td>
      <td class="small">${c.itens.flatMap(it => (it.excecoes || []).map(e => `<span class="badge info">${esc(e.convenio)}</span> ${esc(it.rotulo || it.codigos[0])}: ${e.tipo === 'nao-exigido' ? '<b>não exigido</b>' : `<b>×${e.qtd}</b>`}`)).join('<br>') || '<span class="muted">—</span>'}</td>
      <td class="n small">${efet(c)}</td>
      <td><span class="badge ${c.status === 'validada' ? 'ok' : c.status === 'pendente' ? 'warn' : 'info'}">${esc(STATUS_EQ[c.status])}</span>${c.responsavel ? `<small class="nc-det">${esc(c.responsavel)} · ${new Date(c.validadoEm).toLocaleDateString('pt-BR')}</small>` : ''}</td>
      <td style="white-space:nowrap">${c.status !== 'validada' ? `<button class="mini" data-cmpval="${c.id}">Validar</button> ` : ''}<button class="sec mini" data-cmped="${c.id}" aria-label="Editar">✎</button> ${c.status !== 'desativada' ? `<button class="perigo mini" data-cmpdes="${c.id}" title="Desativar">✕</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Nenhuma regra composta ainda.</p>'}
    <div class="acoes"><button class="sec" id="cmpNova">+ Regra composta</button><span class="small muted">A simulação refaz as conferências da competência com os PDFs e o Apolo carregados nesta sessão.</span></div></div>`;
}
function ligarCompostas(raiz) {
  if (!raiz.querySelector('#cardCompostas')) return;
  $('cmpNova').onclick = () => editarComposta(null);
  raiz.querySelectorAll('[data-cmped]').forEach(b => b.onclick = () => editarComposta(b.dataset.cmped));
  raiz.querySelectorAll('[data-cmpsim]').forEach(b => b.onclick = async () => {
    const c = S.eq.compostas.find(x => x.id === b.dataset.cmpsim); b.disabled = true; b.textContent = 'Simulando…';
    const r = await simularComposta(regraComposta(c)); if (!r) { b.disabled = false; b.textContent = 'Simular'; return; }
    CP.simulacoes.set(c.id, r); RENDER.equivalencias();
  });
  raiz.querySelectorAll('[data-cmpex]').forEach(b => b.onclick = () => {
    const c = S.eq.compostas.find(x => x.id === b.dataset.cmpex), e = efetividadeCompostas(S.rodadas || [], S.comp).get(c.id);
    dialogo(`Exemplos — ${nomeComposta(c)}`, listaExemplosCP(e?.exemplos || []), [['ok', 'Fechar']]);
  });
  const mudar = async (id, status, rotulo) => {
    const op = await exigirOperador(); if (!op) return;
    const c = regraComposta(S.eq.compostas.find(x => x.id === id));
    const r = await dialogo(`${rotulo} regra composta`, `<p class="small"><b>${esc(nomeComposta(c))}</b>: ${c.itens.map(it => esc(it.rotulo || it.codigos[0]) + (it.qtd !== 1 ? ` ×${it.qtd}` : '')).join(' + ')}</p><p class="small">Responsável: <b>${esc(op)}</b>.</p><label class="campo">Justificativa${status === 'validada' ? '' : ' (obrigatória)'}<input type="text" name="motivo"></label>`, [['', 'Cancelar', 'sec'], ['ok', rotulo]]);
    if (r.botao !== 'ok') return;
    if (status !== 'validada' && !r.campos.motivo.trim()) return avisar('Informe a justificativa.', 'warn');
    alterarStatusComposta(S.eq, id, status, op, r.campos.motivo.trim(), S.comp);
    salvarEq(`Regra composta «${nomeComposta(c)}» ${status === 'validada' ? 'validada' : 'desativada'}. Rode a conferência de novo para aplicar.`); RENDER.equivalencias();
  };
  raiz.querySelectorAll('[data-cmpval]').forEach(b => b.onclick = () => mudar(b.dataset.cmpval, 'validada', 'Validar'));
  raiz.querySelectorAll('[data-cmpdes]').forEach(b => b.onclick = () => mudar(b.dataset.cmpdes, 'desativada', 'Desativar'));
}
const listaExemplosCP = ex => ex.length ? `<ul class="small">${ex.map(x => `<li>${esc(x.prestador)} · unidade ${esc(x.unidade)} · ${x.data ? fmtData(paraData(x.data)) : 'sem data'} · conta ${esc(x.conta || '—')} / atendimento ${esc(x.atendimento || '—')} · ${esc(x.codigo)} ${esc(x.desc || '')}${x.falta ? ' · <b>composição incompleta</b>' : ''}</li>`).join('')}</ul>` : '<p class="muted small">Sem exemplos nesta competência.</p>';

/* Simulação: refaz, em memória, a última conferência de cada relatório carregado com a regra valendo,
 * e conta o que ela sustenta. Não grava rodadas nem muda nada. */
async function simularComposta(regra) {
  if (!S.apolo) { avisar('Carregue a planilha de laudos do Apolo no Início para simular.', 'warn'); return null; }
  S.rodadas = await dbTodas();
  const eqTemp = { ...S.eq, compostas: [...(S.eq.compostas || []).filter(c => c.id !== regra.id), { ...regra, status: 'validada' }] };
  const r = { contas: 0, linhas: 0, falta: 0, sobra: 0, relatorios: 0, semRodada: 0, exemplos: [] }, contas = new Set();
  for (const x of S.relatorios) {
    if ((x.finalidade || finalidadePadrao(x.rel)) === 'correcao') continue;
    const rod = ultimaRodadaDoRelatorio(x, 'conferencia', S.comp);
    if (!rod) { r.semRodada++; continue; }
    const medSel = rod.parametros?.medico || '@prest', medicos = medSel === '*' ? null : medSel === '@prest' ? medicosDoPrestador(S.cfg, x.rel.cab.prestadorCod) : [medSel];
    const res = conferirCruzado(x.rel, S.apolo, S.cfg, eqTemp, { unidadeCod: rod.unidadeCod, tol: rod.parametros?.tol ?? S.cfg.parametros.tolConferencia, medicos });
    r.relatorios++;
    for (const l of res.linhas) {
      if (l.composta === regra.id && (l.status === 'conferido' || l.status === 'ressalva')) {
        r.linhas++; contas.add(`${x.rel.cab.prestadorCod}|${l.r.conta}|${l.r.atendimento}`); if (l.compostaFalta) r.falta++;
        if (r.exemplos.length < 8) r.exemplos.push({ prestador: `${x.rel.cab.prestadorCod} - ${x.rel.cab.prestadorNome}`, unidade: rod.unidadeCod, data: isoDia(l.r.data), conta: l.r.conta, atendimento: l.r.atendimento, codigo: l.r.codigo, desc: l.r.procDesc, falta: !!l.compostaFalta });
      }
      if (l.compostaSobra === regra.id) r.sobra++;
    }
    await new Promise(ok => setTimeout(ok, 0));
  }
  r.contas = contas.size;
  if (!r.relatorios) avisar('Nenhuma conferência desta competência com o PDF carregado: rode as conferências ou carregue os PDFs para simular.', 'warn');
  return r;
}

const lerCodigos = t => [...new Set(String(t || '').split(/[\s,;+]+/).map(x => x.replace(/\D/g, '')).filter(x => x.length >= 5))];
const lerPalavras = t => String(t || '').split(/[,;·]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
// Lê o formulário do diálogo para uma regra (sem gravar).
function regraDoFormulario(k, base) {
  const itens = [];
  for (let i = 0; i < MAX_ITENS_CP; i++) {
    const codigos = [...lerCodigos(k['cod' + i]), ...lerCodigos(k['alt' + i])].filter((c, j, a) => a.indexOf(c) === j);
    if (!codigos.length) continue;
    const exc = (k['excConv' + i] || '').trim() && k['excTipo' + i] ? [{ convenio: k['excConv' + i].trim().toUpperCase(), tipo: k['excTipo' + i], qtd: k['excTipo' + i] === 'quantidade' ? Math.max(0, +k['excQtd' + i] || 0) : 0 }] : [];
    itens.push({ rotulo: (k['rot' + i] || '').trim(), codigos, qtd: Math.max(0, Math.round(+k['qtd' + i] || 1)), excecoes: exc });
  }
  const titulos = String(k.titulos || '').split('\n').map(t => t.trim()).filter(Boolean);
  const palavras = { todas: lerPalavras(k.palTodas), umaDe: lerPalavras(k.palUmaDe) };
  return { ...base, nome: (k.nome || '').trim(), titulos, palavras: palavras.todas.length || palavras.umaDe.length ? palavras : null, itens, escopo: { unidade: k.unidade || '*', modalidade: '*' }, justificativa: (k.just || '').trim() };
}
function validarRegraComposta(c, outras) {
  const e = [];
  if (!c.nome) e.push('dê um nome à regra');
  if (!c.titulos.length && !c.palavras) e.push('informe ao menos um título do Apolo ou as palavras do título');
  if (!c.itens.length) e.push('inclua os procedimentos da conta');
  const soma = c.itens.reduce((s, it) => s + it.qtd, 0);
  if (soma < 2 && !c.itens.some(it => it.excecoes.length)) e.push('a composição precisa de 2 ou mais procedimentos (ou quantidade 2), ou de uma exceção por convênio; para um código só, use a relação simples');
  const dup = outras.find(o => o.status !== 'desativada' && o.escopo.unidade === c.escopo.unidade && c.titulos.some(t => o.titulos.some(u => chaveTitulo(u) === chaveTitulo(t))));
  if (dup) e.push(`o título já está na regra «${nomeComposta(dup)}»`);
  return e;
}
async function editarComposta(id, rascunho = null, sim = null) {
  const op = await exigirOperador(); if (!op) return;
  S.eq.compostas = S.eq.compostas || [];
  const atual = id ? S.eq.compostas.find(x => x.id === id) : null;
  const c = rascunho || (atual ? regraComposta(atual) : novaComposta({ itens: [] }));
  const itens = [...c.itens]; while (itens.length < 3) itens.push({ rotulo: '', codigos: [], qtd: 1, excecoes: [] });
  const linhaItem = (it, i) => { const ex = (it.excecoes || [])[0] || {}; return `<div class="item-cp">
    <div>${campoBusca({ nome: 'cod' + i, rotulo: `Procedimento ${i + 1} (busca TUSS)`, fonte: 'tuss', valor: it.codigos[0] || '', valorCodigo: true, livre: true })}
      ${campoBusca({ nome: 'altBusca' + i, rotulo: 'Alternativas na mesma posição (opcional)', fonte: 'tuss', valorCodigo: true, livre: true })}<input type="text" name="alt${i}" value="${esc(it.codigos.slice(1).join(', '))}" placeholder="códigos aceitos no lugar deste" class="alt-cp"></div>
    <div><label class="campo">Nome curto<input type="text" name="rot${i}" value="${esc(it.rotulo || '')}" placeholder="ex.: Doppler"></label><label class="campo">Qtd.<input type="number" min="0" step="1" name="qtd${i}" value="${it.qtd ?? 1}" style="max-width:80px"></label></div>
    <div>${campoBusca({ nome: 'excConv' + i, rotulo: 'Exceção: convênio contém', fonte: 'convenio', valor: ex.convenio || '', livre: true })}
      <label class="campo">No convênio<select name="excTipo${i}">${opcoes([['', '— sem exceção —'], ['nao-exigido', 'não exigido (excludente)'], ['quantidade', 'outra quantidade']], ex.tipo || '')}</select></label>
      <label class="campo">Qtd. no convênio<input type="number" min="0" step="1" name="excQtd${i}" value="${ex.tipo === 'quantidade' ? ex.qtd : ''}" style="max-width:80px"></label></div></div>`; };
  const pr = dialogo(`${atual ? 'Editar' : 'Nova'} regra composta`, `<span class="dlg-largo" hidden></span>
    ${sim ? `<div class="sim-cp"><b>Simulação nesta competência:</b> sustenta <b>${sim.contas} conta(s) (${sim.linhas} linha(s))</b> · ${sim.falta} com composição incompleta · ${sim.sobra} sobrando · ${sim.relatorios} relatório(s) refeito(s)${sim.semRodada ? `, ${sim.semRodada} sem conferência` : ''}.${sim.exemplos.length ? `<details><summary class="small">ver exemplos</summary>${listaExemplosCP(sim.exemplos)}</details>` : ''}</div>` : ''}
    <div class="grid2"><label class="campo">Nome da regra *<input type="text" name="nome" value="${esc(c.nome || '')}" placeholder="ex.: USG mamas + Doppler"></label>
      <label class="campo">Unidade<select name="unidade"><option value="*">Todas</option>${opcoes(S.cfg.unidades.map(u => [u.cod, `${u.cod} - ${u.nome}`]), c.escopo?.unidade || '*')}</select></label></div>
    <h4 style="margin:8px 0 4px">Títulos do Apolo que a regra reconhece</h4>
    <div class="grid2"><div>${campoBusca({ nome: 'tituloBusca', rotulo: '+ Título (busca nos títulos do Apolo)', fonte: 'titulo', livre: true, dica: 'escolher acrescenta à lista abaixo' })}
      <label class="campo">Títulos (um por linha)<textarea name="titulos" rows="3">${esc(c.titulos.join('\n'))}</textarea></label></div>
      <div><label class="campo">Ou por palavras: o título contém todas estas<input type="text" name="palTodas" value="${esc((c.palavras?.todas || []).join(', '))}" placeholder="ex.: DOPPLER"></label>
      <label class="campo">e pelo menos uma destas (opcional)<input type="text" name="palUmaDe" value="${esc((c.palavras?.umaDe || []).join(', '))}" placeholder="ex.: ARTICULAR, PUNHO, OMBRO, JOELHO"></label><span class="small muted">Para variações de nome. Separe por vírgula.</span></div></div>
    <h4 style="margin:10px 0 4px">Composição na conta do MV</h4>
    <div class="itens-cp">${itens.slice(0, MAX_ITENS_CP).map(linhaItem).join('')}</div>
    ${itens.length < MAX_ITENS_CP ? '<p class="small muted">Precisa de mais procedimentos? Salve e edite de novo: aparecem mais linhas.</p>' : ''}
    <label class="campo">Justificativa<input type="text" name="just" value="${esc(c.justificativa || '')}"></label>
    <p class="small muted">Excludente de convênio: o convênio não remunera aquele procedimento nessa combinação. O texto do convênio vale para todos que o contêm («UNIMED» pega UNIMED CURITIBA, UNIMED LONDRINA…). Editar uma regra validada volta ela para pendente.</p>`,
    [['', 'Cancelar', 'sec'], ['simular', 'Simular nesta competência', 'sec'], ['pendente', 'Salvar pendente', 'sec'], ['ok', 'Salvar e validar']]);
  const corpo = $('dlgCorpo');
  corpo.querySelector('[name="tituloBusca"]').addEventListener('busca-escolha', e => { const t = corpo.querySelector('[name="titulos"]'), v = (e.detail?.nome || '').trim(); if (v && !t.value.split('\n').map(x => x.trim()).includes(v)) t.value = (t.value.trim() ? t.value.trim() + '\n' : '') + v; e.target.value = ''; });
  for (let i = 0; i < MAX_ITENS_CP; i++) { const b = corpo.querySelector(`[name="altBusca${i}"]`); if (b) b.addEventListener('busca-escolha', e => { const a = corpo.querySelector(`[name="alt${i}"]`), v = (e.detail?.cod || e.target.value || '').replace(/\D/g, ''); if (v && !lerCodigos(a.value).includes(v)) a.value = [...lerCodigos(a.value), v].join(', '); e.target.value = ''; }); }
  const r = await pr;
  if (!r.botao) return;
  const nova = regraDoFormulario(r.campos, atual ? regraComposta(atual) : novaComposta({}));
  if (r.botao === 'simular') {
    if (!nova.itens.length) { avisar('Inclua os procedimentos para simular.', 'warn'); return editarComposta(id, nova); }
    avisar('Simulando nas conferências da competência…', 'info');
    const s = await simularComposta(nova); if (s && atual) CP.simulacoes.set(atual.id, s);
    return editarComposta(id, nova, s);
  }
  const erros = validarRegraComposta(nova, (S.eq.compostas || []).filter(x => x !== atual).map(regraComposta));
  if (erros.length) { avisar('Regra não gravada: ' + erros.join('; ') + '.', 'warn'); return editarComposta(id, nova, sim); }
  const dados = { nome: nova.nome, titulos: nova.titulos, palavras: nova.palavras, itens: nova.itens, escopo: nova.escopo, justificativa: nova.justificativa };
  if (atual?.titulosMesmoEstudo) dados.titulosMesmoEstudo = atual.titulosMesmoEstudo;
  let alvo;
  if (atual) {
    const antes = JSON.stringify(regraComposta(atual).itens) + JSON.stringify([regraComposta(atual).titulos, atual.palavras || null, atual.escopo]);
    for (const k of ['titulo', 'codigos', 'porConvenio']) delete atual[k];
    Object.assign(atual, dados); alvo = atual;
    const mudou = antes !== JSON.stringify(atual.itens) + JSON.stringify([atual.titulos, atual.palavras, atual.escopo]);
    if (mudou && atual.status === 'validada' && r.botao !== 'ok') { atual.historico.push({ em: agoraISO(), por: op, de: 'validada', para: 'pendente', motivo: 'regra editada', competencia: S.comp }); atual.status = 'pendente'; }
  } else { alvo = novaComposta({ ...dados, origem: `cadastro manual (${op})` }); S.eq.compostas.push(alvo); }
  if (r.botao === 'ok') alterarStatusComposta(S.eq, alvo.id, 'validada', op, dados.justificativa || 'cadastro da regra composta', S.comp);
  if (sim) CP.simulacoes.set(alvo.id, sim);
  S.eq.revisao++; S.eq.atualizadoEm = agoraISO();
  salvarEq(`Regra composta «${dados.nome}» ${atual ? 'atualizada' : 'cadastrada'}${r.botao === 'ok' ? ' e validada' : ''}. Rode as conferências de novo para aplicar.`); RENDER.equivalencias();
}

// Descrição do código TUSS (catálogo da base ou descrição do MV nas relações), para a leitura em português das regras.
function descTussUI(cd) {
  const k = String(cd); if (!descTussUI.m || descTussUI.rev !== S.eq.revisao) { const m = new Map(); for (const t of S.eq.catalogoTUSS || []) m.set(String(t.codigo), t.desc || t.descricao || ''); for (const e of S.eq.itens || []) if (e.descMV && !m.has(e.codigo)) m.set(e.codigo, e.descMV); descTussUI.m = m; descTussUI.rev = S.eq.revisao; }
  return descTussUI.m.get(k) || '';
}
