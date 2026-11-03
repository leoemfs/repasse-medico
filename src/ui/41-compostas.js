/* ============================================================
 * Equivalências → regras compostas e por convênio (SOL-F5)
 * Um laudo pode sustentar mais de uma linha do MV (ex.: articular + doppler), e o conjunto de códigos
 * pode mudar por convênio (ex.: UNIMED = só doppler). Só regra validada, com responsável, vale.
 * ============================================================ */
function cardCompostas() {
  const l = S.eq.compostas || [];
  return `<div class="card" id="cardCompostas"><h2>Regras compostas e por convênio <span class="muted small">${l.filter(c => c.status === 'validada').length} validada(s) · ${l.filter(c => c.status === 'pendente').length} pendente(s)</span></h2>
    <p class="lead">Quando um laudo corresponde a <b>mais de um código</b> na conta. Ex.: «USG DE OMBRO COM DOPPLER» = articular + doppler; na UNIMED, só o doppler. A regra composta vale por cima das relações simples do mesmo título: a conferência aceita um laudo para cada código esperado e aponta o código que falta ou que sobra.</p>
    ${l.length ? `<div class="tw"><table><thead><tr><th>Título do Apolo</th><th>Códigos esperados</th><th>Por convênio</th><th>Escopo</th><th>Situação</th><th></th></tr></thead><tbody>${l.map(c => `<tr>
      <td>${esc(c.titulo)}</td><td>${c.codigos.map(esc).join(' + ')}</td><td class="small">${(c.porConvenio || []).map(v => `${esc(v.convenio)}: ${v.codigos.map(esc).join(' + ')}`).join('<br>') || '<span class="muted">—</span>'}</td>
      <td class="small">${c.escopo.unidade === '*' ? 'todas as unidades' : 'unidade ' + esc(c.escopo.unidade)}</td>
      <td><span class="badge ${c.status === 'validada' ? 'ok' : c.status === 'pendente' ? 'warn' : 'info'}">${esc(STATUS_EQ[c.status])}</span>${c.responsavel ? `<small class="nc-det">${esc(c.responsavel)} · ${new Date(c.validadoEm).toLocaleDateString('pt-BR')}</small>` : ''}</td>
      <td style="white-space:nowrap">${c.status !== 'validada' ? `<button class="mini" data-cmpval="${c.id}">Validar</button> ` : ''}<button class="sec mini" data-cmped="${c.id}">✎</button> ${c.status !== 'desativada' ? `<button class="perigo mini" data-cmpdes="${c.id}" title="Desativar">✕</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Nenhuma regra composta ainda.</p>'}
    <div class="acoes"><button class="sec" id="cmpNova">+ Regra composta</button></div></div>`;
}
function ligarCompostas(raiz) {
  if (!raiz.querySelector('#cardCompostas')) return;
  $('cmpNova').onclick = () => editarComposta(null);
  raiz.querySelectorAll('[data-cmped]').forEach(b => b.onclick = () => editarComposta(b.dataset.cmped));
  const mudar = async (id, status, rotulo) => {
    const op = await exigirOperador(); if (!op) return;
    const c = S.eq.compostas.find(x => x.id === id);
    const r = await dialogo(`${rotulo} regra composta`, `<p class="small">«${esc(c.titulo)}» = ${c.codigos.map(esc).join(' + ')}${(c.porConvenio || []).map(v => ` · ${esc(v.convenio)}: ${v.codigos.map(esc).join(' + ')}`).join('')}</p><p class="small">Responsável: <b>${esc(op)}</b>.</p><label class="campo">Justificativa${status === 'validada' ? '' : ' (obrigatória)'}<input type="text" name="motivo"></label>`, [['', 'Cancelar', 'sec'], ['ok', rotulo]]);
    if (r.botao !== 'ok') return;
    if (status !== 'validada' && !r.campos.motivo.trim()) return avisar('Informe a justificativa.', 'warn');
    alterarStatusComposta(S.eq, id, status, op, r.campos.motivo.trim(), S.comp);
    salvarEq(`Regra composta «${c.titulo}» ${status === 'validada' ? 'validada' : 'desativada'}. Rode a conferência de novo para aplicar.`); RENDER.equivalencias();
  };
  raiz.querySelectorAll('[data-cmpval]').forEach(b => b.onclick = () => mudar(b.dataset.cmpval, 'validada', 'Validar'));
  raiz.querySelectorAll('[data-cmpdes]').forEach(b => b.onclick = () => mudar(b.dataset.cmpdes, 'desativada', 'Desativar'));
}
const lerCodigos = t => [...new Set(String(t || '').split(/[\s,;+]+/).map(x => x.replace(/\D/g, '')).filter(x => x.length >= 5))];
async function editarComposta(id) {
  const op = await exigirOperador(); if (!op) return;
  S.eq.compostas = S.eq.compostas || [];
  const atual = id ? S.eq.compostas.find(x => x.id === id) : null;
  const c = atual || novaComposta({});
  const conv = [...(c.porConvenio || [])]; while (conv.length < 3) conv.push({ convenio: '', codigos: [] });
  const r = await dialogo(`${atual ? 'Editar' : 'Nova'} regra composta`, `
    ${campoBusca({ nome: 'titulo', rotulo: 'Título do laudo no Apolo (exatamente como aparece)', fonte: 'titulo', valor: c.titulo, livre: true })}
    <label class="campo">Códigos esperados na conta (TUSS, separados por vírgula)<input type="text" name="codigos" value="${esc(c.codigos.join(', '))}" placeholder="ex.: 40901220, 40901386"><span class="small muted">No geral: todos os códigos que o laudo sustenta (ex.: articular + doppler).</span></label>
    <h4 style="margin:8px 0 4px">Por convênio <span class="muted small">(texto no nome do convênio → códigos esperados naquele convênio)</span></h4>
    <div class="tw"><table><thead><tr><th>Convênio contém</th><th>Códigos esperados</th></tr></thead><tbody>${conv.slice(0, 3).map((v, k) => `<tr><td><input type="text" name="cv${k}" value="${esc(v.convenio)}" placeholder="${k ? '' : 'ex.: UNIMED'}"></td><td><input type="text" name="cvc${k}" value="${esc((v.codigos || []).join(', '))}" placeholder="${k ? '' : 'ex.: 40901386'}"></td></tr>`).join('')}</tbody></table></div>
    <div class="grid2"><label class="campo">Unidade<select name="unidade"><option value="*">Todas</option>${opcoes(S.cfg.unidades.map(u => [u.cod, `${u.cod} - ${u.nome}`]), c.escopo.unidade)}</select></label>
      <label class="campo">Justificativa<input type="text" name="just" value="${esc(c.justificativa || '')}"></label></div>
    ${atual ? '' : `<label class="small"><input type="checkbox" name="validar"> já validar (responsável: ${esc(op)})</label>`}
    <p class="small muted">Editar uma regra validada volta ela para pendente: valide de novo para valer.</p>`, [['', 'Cancelar', 'sec'], ['ok', atual ? 'Salvar' : 'Cadastrar']]);
  if (r.botao !== 'ok') return;
  const k = r.campos, titulo = (k.titulo || '').trim(), codigos = lerCodigos(k.codigos);
  const porConvenio = [0, 1, 2].map(i => ({ convenio: (k['cv' + i] || '').trim().toUpperCase(), codigos: lerCodigos(k['cvc' + i]) })).filter(v => v.convenio && v.codigos.length);
  if (!titulo || codigos.length < 1) return avisar('Informe o título e ao menos um código (para um código só, use a relação simples).', 'warn');
  if (codigos.length < 2 && !porConvenio.length) return avisar('Regra composta precisa de dois ou mais códigos, ou de uma variação por convênio.', 'warn');
  const outra = S.eq.compostas.find(x => x !== atual && x.status !== 'desativada' && chaveTitulo(x.titulo) === chaveTitulo(titulo) && x.escopo.unidade === k.unidade);
  if (outra) return avisar('Já existe regra composta para esse título nesse escopo: edite a existente.', 'warn');
  const dados = { titulo, codigos, porConvenio, escopo: { unidade: k.unidade, modalidade: '*' }, justificativa: k.just.trim() };
  if (atual) {
    const mudou = JSON.stringify([atual.titulo, atual.codigos, atual.porConvenio, atual.escopo]) !== JSON.stringify([dados.titulo, dados.codigos, dados.porConvenio, dados.escopo]);
    Object.assign(atual, dados);
    if (mudou && atual.status === 'validada') { atual.historico.push({ em: agoraISO(), por: op, de: 'validada', para: 'pendente', motivo: 'regra editada', competencia: S.comp }); atual.status = 'pendente'; }
  } else {
    const nova = novaComposta({ ...dados, origem: `cadastro manual (${op})` });
    S.eq.compostas.push(nova);
    if (k.validar) alterarStatusComposta(S.eq, nova.id, 'validada', op, dados.justificativa || 'cadastro manual', S.comp);
  }
  S.eq.revisao++; S.eq.atualizadoEm = agoraISO();
  salvarEq(`Regra composta «${titulo}» ${atual ? 'atualizada' : 'cadastrada'}.`); RENDER.equivalencias();
}
