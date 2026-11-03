/* ============================================================
 * Descontos parcelados (SOL-F31): cadastro em Bases → Prestadores e alertas no Fechamento
 * ============================================================ */
const COR_SIT_DESC = { ativo: 'ok', recorrente: 'info', ultima: 'warn', quitado: 'ok', futuro: 'info', adiado: 'warn', encerrado: '' };
function cardDescontos() {
  const l = [...(S.cfg.descontos || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  return `<div class="card" data-sub="prestadores" id="cardDesc"><h2>Descontos parcelados <span class="muted small">${l.length} cadastrado(s) · situação em ${rotuloCompetencia(S.comp)}</span></h2>
    <p class="lead">Adiantamentos, pensão alimentícia e outros descontos combinados. A parcela de cada mês entra sozinha em DESCONTOS no Fechamento, com a observação «parcela 7/10». Dá para mudar à mão no mês, e a mudança fica registrada.</p>
    <div class="tw"><table><thead><tr><th>Prestador</th><th>Motivo</th><th class="n">Parcela (R$)</th><th>Parcelas</th><th>Aplica em</th><th>Situação</th><th>Histórico</th><th></th></tr></thead><tbody>
    ${l.map(d => { const sit = situacaoDesconto(d, S.comp), p = parcelaDoMes(d, S.comp), h = historicoDesconto(d, S.comp);
      return `<tr><td>${esc(d.cod)} - ${esc(d.nome || '')}</td><td>${esc(d.motivo)}${d.obs ? `<small class="nc-det">${esc(d.obs)}</small>` : ''}</td><td class="n">${fmtBR(d.valorParcela)}</td>
        <td>${+d.parcelas ? `${p ? `${p.n} de ${d.parcelas}` : `${d.parcelas} parcela(s)`}<small class="nc-det">início ${rotuloCompetencia(d.inicio)}</small>` : `recorrente<small class="nc-det">desde ${rotuloCompetencia(d.inicio)}</small>`}</td>
        <td>${esc(TIPOS_DESCONTO[d.tipo] || d.tipo)}</td><td><span class="badge ${COR_SIT_DESC[sit.k] || ''}">${esc(sit.nome)}</span></td>
        <td>${h.length ? `<details><summary class="small">${h.filter(x => !x.adiada).length} parcela(s) até ${rotuloCompetencia(S.comp)}</summary><ul class="small">${h.map(x => `<li>${rotuloCompetencia(x.chave)}: ${x.adiada ? 'adiada' : `${x.recorrente ? '' : `${x.n}/${x.total} · `}R$ ${fmtBR(x.valor)}`}</li>`).join('')}</ul></details>` : '<span class="muted small">—</span>'}</td>
        <td style="white-space:nowrap"><button class="sec mini" data-desc-ed="${esc(d.id)}" aria-label="Editar">✎</button> <button class="perigo mini" data-desc-rm="${esc(d.id)}" aria-label="Excluir">✕</button></td></tr>`; }).join('') || '<tr><td colspan="8" class="muted">Nenhum desconto cadastrado.</td></tr>'}</tbody></table></div>
    <div class="acoes"><button class="sec" data-desc-novo="">+ Desconto</button></div></div>`;
}
function ligarDescontos(raiz, depois) {
  raiz.querySelectorAll('[data-desc-novo]').forEach(b => b.onclick = () => editarDesconto(null, b.dataset.descNovo || '').then(depois));
  raiz.querySelectorAll('[data-desc-ed]').forEach(b => b.onclick = () => editarDesconto(b.dataset.descEd).then(depois));
  raiz.querySelectorAll('[data-desc-rm]').forEach(b => b.onclick = async () => {
    const d = S.cfg.descontos.find(x => x.id === b.dataset.descRm); if (!d) return;
    if (!await confirmar('Excluir desconto?', `${esc(d.nome)} · ${esc(d.motivo)} · R$ ${fmtBR(d.valorParcela)}. Para parar de descontar e manter o histórico, use ✎ → «Encerrar».`, 'Excluir')) return;
    S.cfg.descontos = S.cfg.descontos.filter(x => x !== d);
    salvarCfg(`Desconto de ${d.cod} - ${d.nome} (${d.motivo}) excluído.`, 'prestadores'); depois();
  });
  raiz.querySelectorAll('[data-desc-adiar]').forEach(b => b.onclick = async () => {
    if (!exigirAberta(S.comp, 'adiar a parcela')) return;
    const d = S.cfg.descontos.find(x => x.id === b.dataset.descAdiar); if (!d) return;
    d.adiadas = [...new Set([...(d.adiadas || []), S.comp])].sort();
    salvarCfg(`Desconto de ${d.cod} - ${d.nome} (${d.motivo}): parcela de ${rotuloCompetencia(S.comp)} levada para o próximo mês.`, 'prestadores');
    avisar('Parcela levada para o próximo mês: as seguintes andam um mês.', 'ok'); depois();
  });
  raiz.querySelectorAll('[data-desc-volta]').forEach(b => b.onclick = () => {
    const d = S.cfg.descontos.find(x => x.id === b.dataset.descVolta); if (!d) return;
    d.adiadas = (d.adiadas || []).filter(c => c !== S.comp);
    salvarCfg(`Desconto de ${d.cod} - ${d.nome} (${d.motivo}): parcela de ${rotuloCompetencia(S.comp)} voltou a ser descontada.`, 'prestadores'); depois();
  });
}
async function editarDesconto(id, tipoPadrao = '') {
  const op = await exigirOperador(); if (!op) return;
  S.cfg.descontos = S.cfg.descontos || [];
  const atual = id ? S.cfg.descontos.find(x => x.id === id) : null;
  const d = atual || { cod: '', nome: '', motivo: '', valorParcela: '', parcelas: '', inicio: S.comp, tipo: tipoPadrao || 'img', obs: '' };
  const mesInput = k => k ? k : '';
  const r = await dialogo(`${atual ? 'Editar' : 'Novo'} desconto parcelado`, `<div class="grid2">
      ${campoBusca({ nome: 'prestador', rotulo: 'Prestador (busca no cadastro)', fonte: 'prestador', valor: d.nome, cod: d.cod, preencheCod: 'cod', obrigatorio: true })}
      <label class="campo">Código<input type="text" name="cod" value="${esc(d.cod)}" style="max-width:120px"></label>
      <label class="campo">Motivo *<input type="text" name="motivo" list="dlMotivoDesc" value="${esc(d.motivo)}" placeholder="ex.: Adiantamento"></label>
      <label class="campo">Valor da parcela (R$) *<input type="number" step="0.01" min="0" name="valorParcela" value="${esc(d.valorParcela)}"></label>
      <label class="campo">Número de parcelas<input type="number" step="1" min="0" name="parcelas" value="${+d.parcelas || ''}"><span class="small muted">vazio = recorrente (ex.: pensão)</span></label>
      <label class="campo">Primeira parcela na competência *<input type="month" name="inicio" value="${esc(mesInput(d.inicio))}"></label>
      <label class="campo">Aplica em *<select name="tipo">${opcoes(Object.entries(TIPOS_DESCONTO), d.tipo)}</select></label>
      <label class="campo">Observação<input type="text" name="obs" value="${esc(d.obs || '')}"></label></div>
    <datalist id="dlMotivoDesc">${['Adiantamento', 'Pensão alimentícia', 'Ajuste de repasse', ...new Set(S.cfg.descontos.map(x => x.motivo))].filter((v, i, a) => a.indexOf(v) === i).map(m => `<option value="${esc(m)}"></option>`).join('')}</datalist>
    ${atual ? `<p class="small muted">Situação em ${rotuloCompetencia(S.comp)}: ${esc(situacaoDesconto(atual, S.comp).nome)}.${(atual.adiadas || []).length ? ` Adiadas: ${atual.adiadas.map(rotuloCompetencia).join(', ')}.` : ''}</p>` : ''}`,
    [['', 'Cancelar', 'sec'], ...(atual && !atual.encerradoEm ? [['encerrar', `Encerrar em ${rotuloCompetencia(S.comp)}`, 'perigo']] : []), ...(atual?.encerradoEm ? [['reabrir', 'Reativar', 'sec']] : []), ['ok', atual ? 'Salvar' : 'Incluir']]);
  if (r.botao === 'encerrar') { atual.encerradoEm = S.comp; salvarCfg(`Desconto de ${atual.cod} - ${atual.nome} (${atual.motivo}) encerrado em ${rotuloCompetencia(S.comp)}.`, 'prestadores'); return; }
  if (r.botao === 'reabrir') { delete atual.encerradoEm; salvarCfg(`Desconto de ${atual.cod} - ${atual.nome} (${atual.motivo}) reativado.`, 'prestadores'); return; }
  if (r.botao !== 'ok') return;
  const c = r.campos, p = S.cfg.prestadores.find(x => String(x.cod) === c.cod.trim());
  const dados = { cod: c.cod.trim(), nome: p?.nomeMV || c.prestador.trim(), motivo: c.motivo.trim(), valorParcela: +c.valorParcela || 0, parcelas: c.parcelas === '' ? 0 : +c.parcelas, inicio: c.inicio, tipo: c.tipo, obs: c.obs.trim() };
  const erros = validarDesconto(dados);
  if (!p && dados.cod) erros.push('o código não está no cadastro de prestadores');
  if (erros.length) return avisar('Desconto não gravado: ' + erros.join('; ') + '.', 'warn');
  if (atual) Object.assign(atual, dados, { alteradoPor: op, alteradoEm: agoraISO() });
  else S.cfg.descontos.push({ id: novoId('desc'), ...dados, adiadas: [], por: op, em: agoraISO() });
  salvarCfg(`Desconto ${atual ? 'alterado' : 'cadastrado'}: ${dados.cod} - ${dados.nome} · ${dados.motivo} · R$ ${fmtBR(dados.valorParcela)} ${dados.parcelas ? `× ${dados.parcelas}` : '(recorrente)'} desde ${rotuloCompetencia(dados.inicio)} · ${TIPOS_DESCONTO[dados.tipo]}.`, 'prestadores');
  avisar(`Desconto ${atual ? 'atualizado' : 'cadastrado'}.`, 'ok');
}
// Fechamento: parcelas do mês e alertas do tipo (USG, IMG ou Curitiba).
function cartaoDescontosFech(f, tipo) {
  const lista = listaFech(f, tipo).filter(x => (x.parcelas || []).length), alertas = (f.alertasDescontos || []).filter(a => a.tipo === tipo);
  const adiadas = (S.cfg.descontos || []).filter(d => d.tipo === tipo && (d.adiadas || []).includes(S.comp));
  const cls = { ultima: 'warn', 'sem-valores': 'err', 'sem-linha': 'err', maior: 'err' };
  return `<div class="card desc-cartao"><h3>Descontos parcelados do mês — ${NOME_TIPO_FECH[tipo]}</h3>
    ${lista.length ? `<div class="tw"><table><thead><tr><th>Cód.</th><th>Prestador</th><th>Parcelas do mês</th><th class="n">Automático</th><th class="n">Em DESCONTOS</th></tr></thead><tbody>${lista.map(x => `<tr><td>${esc(x.cod)}</td><td>${esc(x.nome)}</td><td class="small">${x.parcelas.map(p => `${esc(p.obs)} · R$ ${fmtBR(p.valor)}`).join('<br>')}</td><td class="n">${x.temValores ? fmtBR(x.descontosAuto) : '<span class="small muted">sem valores</span>'}</td><td class="n"><b>${fmtBR(x.descontos)}</b>${x.descontosManual ? ' <span class="badge warn">manual</span>' : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Nenhuma parcela neste mês.</p>'}
    ${alertas.length ? `<h4 style="margin:10px 0 4px">Alertas</h4>${alertas.map(a => `<div class="alerta-desc ${cls[a.k] || ''}">${esc(a.texto)}${a.adiar ? ` <button class="sec mini" data-desc-adiar="${esc(a.id)}">Levar para o próximo mês</button>` : ''}</div>`).join('')}` : ''}
    ${adiadas.length ? `<p class="small muted">Adiadas neste mês: ${adiadas.map(d => `${esc(d.nome)} · ${esc(d.motivo)} <button class="sec mini" data-desc-volta="${esc(d.id)}">desfazer</button>`).join(' · ')}</p>` : ''}
    <div class="acoes"><button class="sec" data-desc-novo="${tipo}">+ Desconto</button><span class="small muted">Cadastro completo em Bases → Prestadores e regras → Descontos parcelados.</span></div></div>`;
}
