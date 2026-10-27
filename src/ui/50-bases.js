/* ============================================================
 * Bases: unidades, prestadores (código MV ↔ médico do Apolo), regras de tipo de item e Power BI
 * ============================================================ */
RENDER.bases = () => {
  const medApolo = S.apolo ? [...contar(S.apolo.laudos.filter(l => l.medico), l => l.medico)].sort((a, b) => a[0].localeCompare(b[0])) : [];
  const idxP = indicePrestadores(S.cfg);
  const semVinculo = medApolo.filter(([m]) => !idxP.has(norm(m)));
  const branches = S.apolo ? [...contar(S.apolo.laudos, l => l.unidade)] : [];
  const branchSemUn = branches.filter(([b]) => !S.cfg.unidades.some(u => (u.apolo || []).map(norm).includes(norm(b))));
  $('pag-bases').innerHTML = `
  <div class="card"><h2>Unidades</h2><p class="lead">A unidade escolhida na sessão filtra os laudos do Apolo pelos nomes cadastrados aqui (BRANCH_NAME). Vários nomes: separe por «|».</p>
    ${branchSemUn.length ? `<p class="badge warn">Unidades do Apolo sem cadastro: ${branchSemUn.map(([b, n]) => `${esc(b)} (${n})`).join(', ')}</p>` : ''}
    <div class="tw"><table><thead><tr><th>Cód.</th><th>Nome</th><th>Nome(s) no Apolo</th><th>Nome no Power BI</th><th>Empresa</th><th></th></tr></thead><tbody>${S.cfg.unidades.map((u, i) => `<tr>
      <td><input type="text" data-u="${i}" data-c="cod" value="${esc(u.cod)}" style="width:60px"></td><td><input type="text" data-u="${i}" data-c="nome" value="${esc(u.nome)}"></td>
      <td><input type="text" data-u="${i}" data-c="apolo" value="${esc((u.apolo || []).join(' | '))}"></td><td><input type="text" data-u="${i}" data-c="pbi" value="${esc(u.pbi)}"></td>
      <td><input type="text" data-u="${i}" data-c="empresa" value="${esc(u.empresa)}" style="width:80px"></td><td><button class="perigo" data-urm="${i}">✕</button></td></tr>`).join('')}</tbody></table></div>
    <div class="acoes"><button id="unSalvar">Salvar unidades</button><button id="unAdd" class="sec">+ Unidade</button><button id="unPad" class="sec">Restaurar padrão</button></div></div>

  <div class="card"><h2>Prestadores</h2><p class="lead">O par código ↔ nome vem do cabeçalho de cada relatório do MV carregado. O médico do Apolo só é ligado a um código por nome idêntico (após normalizar caixa e acentos) ou por <strong>alias validado</strong> com responsável (RN-208).</p>
    <div class="tw"><table><thead><tr><th>Código</th><th>Nome no MV</th><th>Aliases do Apolo</th><th>Não realiza repasse</th><th>Origem</th><th></th></tr></thead><tbody>${S.cfg.prestadores.length ? S.cfg.prestadores.map((p, i) => `<tr>
      <td>${esc(p.cod)}</td><td>${esc(p.nomeMV)}</td><td>${(p.aliases || []).map((a, j) => `<span class="badge ${a.status === 'validado' ? 'ok' : 'warn'}" title="${esc(a.responsavel || '')}">${esc(a.nome)} <a href="#" data-arm="${i}:${j}" title="remover">✕</a></span>`).join(' ') || '<span class="muted small">—</span>'}</td>
      <td><input type="checkbox" data-nr="${i}"${p.naoRealizaRepasse ? ' checked' : ''}></td><td class="small muted">${esc(p.origem || '')}</td><td><button class="sec" data-alias="${i}">+ Alias</button></td></tr>`).join('') : '<tr><td colspan="6" class="muted">Carregue um relatório do MV para registrar o prestador do cabeçalho, ou adicione manualmente.</td></tr>'}</tbody></table></div>
    <div class="acoes"><button id="prAdd" class="sec">+ Prestador manual</button></div>
    ${S.apolo ? `<details style="margin-top:12px"><summary>Médicos do Apolo sem vínculo com código de prestador (${semVinculo.length} de ${medApolo.length})</summary><p class="small muted">Lista para conferência. Nenhum vínculo é criado automaticamente.</p><ul class="small">${semVinculo.map(([m, n]) => `<li>${esc(m)} — ${n} laudos</li>`).join('')}</ul></details>` : ''}</div>

  <div class="card"><h2>Classificação do tipo de item</h2><p class="lead">Aplicada antes de qualquer equivalência (RN-199). A primeira regra ativa que casar define o tipo; sem regra, o item fica «Desconhecido — pendente». Padrões são expressões regulares sobre o texto normalizado (maiúsculas, sem acento).</p>
    <div class="tw"><table><thead><tr><th>Ativa</th><th>Campo</th><th>Padrão</th><th>Tipo</th><th>Nota</th><th></th></tr></thead><tbody>${S.cfg.classificacao.map((r, i) => `<tr>
      <td><input type="checkbox" data-cl="${i}" data-c="ativa"${r.ativa ? ' checked' : ''}></td><td><select data-cl="${i}" data-c="campo">${opcoes([['grupo', 'Grupo de procedimento'], ['descricao', 'Descrição do procedimento'], ['codigo', 'Código']], r.campo)}</select></td>
      <td><input type="text" data-cl="${i}" data-c="padrao" value="${esc(r.padrao)}"></td><td><select data-cl="${i}" data-c="tipo">${opcoes(Object.entries(TIPOS_ITEM), r.tipo)}</select></td>
      <td><input type="text" data-cl="${i}" data-c="nota" value="${esc(r.nota || '')}"></td><td><button class="perigo" data-clrm="${i}">✕</button></td></tr>`).join('')}</tbody></table></div>
    <div class="acoes"><button id="clSalvar">Salvar regras</button><button id="clAdd" class="sec">+ Regra</button><button id="clPad" class="sec">Restaurar padrão</button></div></div>

  <div class="card"><h2>Power BI (consulta)</h2><p class="lead">Base auxiliar: cataloga o que existe no faturamento. Não participa da conferência nem da identificação de prestador.</p>
    ${S.pbi ? `<dl class="kv"><dt>Arquivo</dt><dd>${esc(S.pbi.nome)}</dd><dt>Período</dt><dd>${S.pbi.periodo ? `${fmtData(S.pbi.periodo[0])} a ${fmtData(S.pbi.periodo[1])}` : '—'}</dd><dt>Linhas</dt><dd>${S.pbi.linhas.length.toLocaleString('pt-BR')}</dd></dl>
      <div class="grid3" style="margin-top:10px"><div><h3>Unidades</h3><ul class="small">${S.pbi.unidades.map(([u, n]) => `<li>${esc(u)} — ${n}</li>`).join('')}</ul></div>
      <div><h3>Grupos de procedimento</h3><ul class="small">${S.pbi.grupos.map(([g, n]) => `<li>${esc(g)} — ${n}</li>`).join('')}</ul></div>
      <div><h3>Códigos de prestador (CD_PRESTADOR)</h3><p class="small muted">${S.pbi.prestadores.length} códigos distintos. O Power BI não traz o nome do médico.</p></div></div>
      <details style="margin-top:8px"><summary>Procedimentos faturados (${S.pbi.procedimentos.length})</summary><div id="pbiProc"></div></details>` : '<p class="muted">Carregue a planilha do Power BI no Início para consultar.</p>'}</div>`;

  const pg = $('pag-bases');
  pg.querySelectorAll('[data-u]').forEach(inp => inp.onchange = () => { const u = S.cfg.unidades[+inp.dataset.u]; u[inp.dataset.c] = inp.dataset.c === 'apolo' ? inp.value.split('|').map(s => s.trim()).filter(Boolean) : inp.value.trim(); });
  pg.querySelectorAll('[data-urm]').forEach(b => b.onclick = () => { S.cfg.unidades.splice(+b.dataset.urm, 1); RENDER.bases(); });
  $('unAdd').onclick = () => { S.cfg.unidades.push({ cod: '', nome: '', apolo: [], pbi: '', empresa: '' }); RENDER.bases(); };
  $('unPad').onclick = async () => { if (await confirmar('Restaurar unidades padrão?', 'A tabela de unidades volta ao padrão.')) { S.cfg.unidades = clone(UNIDADES_PADRAO); salvarCfg('Unidades restauradas.'); RENDER.bases(); } };
  $('unSalvar').onclick = () => { const e = validarConfig(S.cfg); if (e.length) return avisar('Não salvo: ' + e.join('; '), 'err'); salvarCfg('Unidades salvas.'); RENDER.bases(); };
  pg.querySelectorAll('[data-nr]').forEach(ch => ch.onchange = () => { S.cfg.prestadores[+ch.dataset.nr].naoRealizaRepasse = ch.checked; salvarCfg('Prestador atualizado.'); });
  pg.querySelectorAll('[data-arm]').forEach(a => a.onclick = async ev => { ev.preventDefault(); const [i, j] = a.dataset.arm.split(':').map(Number); const p = S.cfg.prestadores[i];
    if (await confirmar('Remover alias?', `«${esc(p.aliases[j].nome)}» deixará de identificar o prestador ${esc(p.cod)}.`, 'Remover')) { p.aliases.splice(j, 1); salvarCfg('Alias removido.'); RENDER.bases(); } });
  pg.querySelectorAll('[data-alias]').forEach(b => b.onclick = () => adicionarAlias(+b.dataset.alias, medApolo));
  $('prAdd').onclick = async () => {
    const op = await exigirOperador(); if (!op) return;
    const r = await dialogo('Prestador manual', `<label class="campo">Código do prestador no MV<input type="text" name="cod"></label><label class="campo">Nome como no MV<input type="text" name="nome"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Adicionar']]);
    if (r.botao !== 'ok' || !r.campos.cod.trim() || !r.campos.nome.trim()) return;
    if (S.cfg.prestadores.some(p => String(p.cod) === r.campos.cod.trim())) return avisar('Já existe prestador com esse código.', 'warn');
    S.cfg.prestadores.push({ cod: r.campos.cod.trim(), nomeMV: r.campos.nome.trim(), aliases: [], naoRealizaRepasse: false, origem: `cadastro manual (${op})`, em: agoraISO() });
    salvarCfg('Prestador adicionado.'); RENDER.bases();
  };
  pg.querySelectorAll('[data-cl]').forEach(inp => inp.onchange = () => { const r = S.cfg.classificacao[+inp.dataset.cl]; r[inp.dataset.c] = inp.type === 'checkbox' ? inp.checked : inp.value; });
  pg.querySelectorAll('[data-clrm]').forEach(b => b.onclick = () => { S.cfg.classificacao.splice(+b.dataset.clrm, 1); RENDER.bases(); });
  $('clAdd').onclick = () => { S.cfg.classificacao.push({ id: novoId('r'), campo: 'descricao', padrao: '', tipo: 'outro', nota: '', ativa: true }); RENDER.bases(); };
  $('clPad').onclick = async () => { if (await confirmar('Restaurar regras padrão?', 'As regras de classificação voltam ao padrão adotado.')) { S.cfg.classificacao = clone(CLASSIFICACAO_PADRAO); salvarCfg('Regras restauradas.'); RENDER.bases(); } };
  $('clSalvar').onclick = () => { const e = validarConfig(S.cfg); if (e.length) return avisar('Não salvo: ' + e.join('; '), 'err'); salvarCfg('Regras salvas. Reprocesse as análises para aplicar.'); };
  if (S.pbi && $('pbiProc')) tabela($('pbiProc'), { porPagina: 100, linhas: S.pbi.procedimentos, colunas: [{ t: 'Código', v: p => p.codigo }, { t: 'Descrição', v: p => p.desc }, { t: 'Grupo', v: p => p.grupo }, { t: 'Lançamentos', n: true, v: p => p.n }] });
};

async function adicionarAlias(i, medApolo) {
  const op = await exigirOperador(); if (!op) return;
  const p = S.cfg.prestadores[i];
  const r = await dialogo(`Alias do Apolo para ${p.cod} - ${p.nomeMV}`, `<p class="small muted">Escolha o nome exatamente como aparece em NAME_MEDICO. O alias fica validado por ${esc(op)} e passa a identificar este código.</p>
    <label class="campo">Médico no Apolo${medApolo.length ? `<select name="nome"><option value="">— escolher —</option>${opcoes(medApolo.map(([m, n]) => [m, `${m} (${n} laudos)`]))}</select>` : '<input type="text" name="nome">'}</label>
    <label class="campo">Justificativa<input type="text" name="motivo"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Validar alias']]);
  const nome = (r.campos.nome || '').trim();
  if (r.botao !== 'ok' || !nome) return;
  const outro = S.cfg.prestadores.find(x => x !== p && (norm(x.nomeMV) === norm(nome) || (x.aliases || []).some(a => norm(a.nome) === norm(nome))));
  if (outro && !await confirmar('Nome já ligado a outro prestador', `«${esc(nome)}» já identifica o prestador ${esc(outro.cod)}. Com dois vínculos, a identificação fica em conflito e não é aplicada.`, 'Adicionar mesmo assim')) return;
  p.aliases = p.aliases || [];
  p.aliases.push({ nome, status: 'validado', responsavel: op, em: agoraISO(), motivo: r.campos.motivo || '', origem: 'cadastro manual' });
  salvarCfg('Alias validado.'); RENDER.bases();
}
