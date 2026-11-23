/* ============================================================
 * Descontos parcelados (SOL-F31): cadastro em Bases → Prestadores e alertas no Fechamento
 * ============================================================ */
const COR_SIT_DESC = { ativo: 'ok', recorrente: 'info', ultima: 'warn', quitado: 'ok', futuro: 'info', adiado: 'warn', encerrado: '' };
function cardDescontos() {
  const l = [...(S.cfg.descontos || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  const nVar = l.filter(d => d.variavel).length;
  return `<div class="card" data-sub="prestadores" id="cardDesc"><h2>Descontos do prestador <span class="muted small">${l.length} cadastrado(s)${nVar ? ` · ${nVar} com valor que muda todo mês` : ''} · situação em ${rotuloCompetencia(S.comp)}</span></h2>
    <p class="lead">Pensão, adiantamento, plano de saúde e outros descontos combinados. <b>Valor fixo</b> entra sozinho em DESCONTOS no Fechamento, com a observação «parcela 7/10». <b>Valor que muda todo mês</b> vira um lembrete: o Fechamento pede o valor conferido no portal antes do pagamento.</p>
    <div class="tw"><table><thead><tr><th>Prestador</th><th>Motivo</th><th>Valor</th><th>Parcelas</th><th>Aplica em</th><th>Situação</th><th>Histórico</th><th></th></tr></thead><tbody>
    ${l.map(d => { const sit = situacaoDesconto(d, S.comp), p = parcelaDoMes(d, S.comp), h = historicoDesconto(d, S.comp);
      return `<tr><td>${esc(d.cod)} - ${esc(d.nome || '')}</td><td>${esc(d.motivo)}${d.obs ? `<small class="nc-det">${esc(d.obs)}</small>` : ''}</td><td>${d.variavel ? `<span class="badge warn">muda todo mês</span>${d.onde ? `<small class="nc-det">conferir em: ${esc(d.onde)}</small>` : ''}` : `R$ ${fmtBR(d.valorParcela)}`}</td>
        <td>${+d.parcelas ? `${p ? `${p.n} de ${d.parcelas}` : `${d.parcelas} parcela(s)`}<small class="nc-det">início ${rotuloCompetencia(d.inicio)}</small>` : `recorrente<small class="nc-det">desde ${rotuloCompetencia(d.inicio)}</small>`}</td>
        <td>${esc(TIPOS_DESCONTO[d.tipo] || d.tipo)}</td><td><span class="badge ${COR_SIT_DESC[sit.k] || ''}">${esc(sit.nome)}</span>${p?.variavel ? `<small class="nc-det">${p.conferir ? `<span class="badge warn">a conferir em ${rotuloCompetencia(S.comp)}</span>` : p.semDesconto ? 'sem desconto neste mês' : `lançado R$ ${fmtBR(p.valor)}`}</small>` : ''}</td>
        <td>${h.length ? `<details><summary class="small">${h.filter(x => !x.adiada).length} parcela(s) até ${rotuloCompetencia(S.comp)}</summary><ul class="small">${h.map(x => `<li>${rotuloCompetencia(x.chave)}: ${x.adiada ? 'adiada' : x.variavel && x.conferir ? 'a conferir' : `${x.recorrente ? '' : `${x.n}/${x.total} · `}R$ ${fmtBR(x.valor)}${x.lancamento ? ` · ${esc(x.lancamento.por || '—')}` : ''}`}</li>`).join('')}</ul></details>` : '<span class="muted small">—</span>'}</td>
        <td style="white-space:nowrap"><button class="sec mini" data-desc-ed="${esc(d.id)}" aria-label="Editar">✎</button> <button class="perigo mini" data-desc-rm="${esc(d.id)}" aria-label="Excluir">✕</button></td></tr>`; }).join('') || '<tr><td colspan="8" class="muted">Nenhum desconto cadastrado.</td></tr>'}</tbody></table></div>
    <div class="acoes"><button class="sec" data-desc-novo="">+ Desconto</button></div></div>${cardReajuste()}`;
}
/* SOL-F47 — Reajuste anual: mês do lembrete e o que revisar. */
function cardReajuste() {
  const r = S.cfg.reajusteAnual || reajustePadrao(), feitos = Object.entries(r.feitos || {}).sort((a, b) => b[0] - a[0]), lemb = lembreteReajuste(S.cfg);
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `<div class="card" data-sub="prestadores" id="cardReajuste"><h2>Reajuste anual</h2>
    <p class="lead">Uma vez por ano o cadastro é reajustado. A partir do mês escolhido, o Início lembra de revisar a lista abaixo, até alguém marcar o reajuste do ano como feito.</p>
    <div class="grid2"><label class="campo">Lembrar a partir de<select id="reajMes">${meses.map((m, i) => `<option value="${i + 1}"${+r.mes === i + 1 ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
      <div class="campo"><span>Último reajuste</span><b style="display:block;padding-top:8px">${feitos.length ? `${feitos[0][0]} · ${esc(feitos[0][1].por || '—')} em ${new Date(feitos[0][1].em).toLocaleDateString('pt-BR')}` : `nenhum marcado · primeiro lembrete em ${meses[(+r.mes || 1) - 1].toLowerCase()} de ${r.desde}`}</b></div></div>
    <p class="small" style="margin:12px 0 4px"><b>O que revisar</b></p><ul class="small" style="margin:0">${ITENS_REAJUSTE.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    ${lemb ? `<div class="acoes"><button data-reaj-feito="${lemb.ano}">Reajuste de ${lemb.ano} feito</button></div>` : ''}</div>`;
}
function ligarDescontos(raiz, depois) {
  raiz.querySelectorAll('[data-desc-novo]').forEach(b => b.onclick = () => editarDesconto(null, b.dataset.descNovo || '').then(depois));
  raiz.querySelectorAll('[data-desc-ed]').forEach(b => b.onclick = () => editarDesconto(b.dataset.descEd).then(depois));
  raiz.querySelectorAll('[data-desc-rm]').forEach(b => b.onclick = async () => {
    const d = S.cfg.descontos.find(x => x.id === b.dataset.descRm); if (!d) return;
    if (!await confirmar('Excluir desconto?', `${esc(d.nome)} · ${esc(d.motivo)} · R$ ${fmtBR(d.valorParcela)}. Para parar de descontar e manter o histórico, use ✎ → «Encerrar».`, 'Excluir')) return;
    S.cfg.descontos = S.cfg.descontos.filter(x => x !== d);
    salvarCfg(`Desconto de ${d.cod} - ${d.nome} (${d.motivo}) excluído.`, 'prestadores'); atualizarPillMenu(); depois();
  });
  raiz.querySelectorAll('[data-desc-adiar]').forEach(b => b.onclick = async () => {
    if (!exigirAberta(S.comp, 'adiar a parcela')) return;
    const d = S.cfg.descontos.find(x => x.id === b.dataset.descAdiar); if (!d) return;
    d.adiadas = [...new Set([...(d.adiadas || []), S.comp])].sort();
    salvarCfg(`Desconto de ${d.cod} - ${d.nome} (${d.motivo}): parcela de ${rotuloCompetencia(S.comp)} levada para o próximo mês.`, 'prestadores');
    avisar('Parcela levada para o próximo mês: as seguintes andam um mês.', 'ok'); depois();
  });
  // SOL-F47: valor do mês dos descontos que mudam todo mês.
  const lancar = async (id, valor, texto) => {
    if (!exigirAberta(S.comp, 'lançar o desconto do mês')) return;
    const op = await exigirOperador(); if (!op) return;
    const d = S.cfg.descontos.find(x => x.id === id); if (!d) return;
    lancarDescontoMes(d, S.comp, valor, op);
    salvarCfg(`Desconto de ${d.cod} - ${d.nome} (${d.motivo}) em ${rotuloCompetencia(S.comp)}: ${texto}.`, 'prestadores');
    atualizarPillMenu(); depois();
  };
  raiz.querySelectorAll('[data-desc-lanca]').forEach(b => b.onclick = () => {
    const v = +(raiz.querySelector(`[data-desc-valor="${b.dataset.descLanca}"]`)?.value || 0);
    if (!(v > 0)) return avisar('Informe o valor conferido no portal (ou use «Sem desconto este mês»).', 'warn');
    lancar(b.dataset.descLanca, v, `R$ ${fmtBR(v)} conferido`);
  });
  raiz.querySelectorAll('[data-desc-zero]').forEach(b => b.onclick = () => lancar(b.dataset.descZero, null, 'sem desconto neste mês'));
  raiz.querySelectorAll('[data-desc-corrige]').forEach(b => b.onclick = () => lancar(b.dataset.descCorrige, undefined, 'lançamento desfeito para corrigir'));
  const reajMes = raiz.querySelector('#reajMes');
  if (reajMes) reajMes.onchange = () => { S.cfg.reajusteAnual = { ...(S.cfg.reajusteAnual || reajustePadrao()), mes: +reajMes.value }; salvarCfg(`Reajuste anual lembrado a partir de ${reajMes.selectedOptions[0].text.toLowerCase()}.`, 'prestadores'); depois(); };
  raiz.querySelectorAll('[data-reaj-feito]').forEach(b => b.onclick = async () => {
    const op = await exigirOperador(); if (!op) return;
    if (!await confirmar(`Reajuste de ${b.dataset.reajFeito} feito?`, 'O lembrete some do Início até o próximo ano.', 'Marcar como feito')) return;
    S.cfg.reajusteAnual = S.cfg.reajusteAnual || reajustePadrao(); marcarReajusteFeito(S.cfg, b.dataset.reajFeito, op);
    salvarCfg(`Reajuste anual de ${b.dataset.reajFeito} marcado como feito.`, 'prestadores'); depois();
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
  const d = atual || { cod: '', nome: '', motivo: '', valorParcela: '', parcelas: '', inicio: S.comp, tipo: tipoPadrao || 'img', obs: '', variavel: false, onde: '' };
  const mesInput = k => k ? k : '';
  // Fixo × muda todo mês: mostra o campo certo assim que o diálogo abre.
  setTimeout(() => { const c = $('dlgCorpo'), alt = () => { const v = c.querySelector('[name="tipoValor"]:checked')?.value === 'variavel'; c.querySelector('#dcFixo').hidden = v; c.querySelector('#dcOnde').hidden = !v; c.querySelector('#dcExpl').hidden = !v; };
    c.querySelectorAll('[name="tipoValor"]').forEach(x => x.onchange = alt); alt(); }, 0);
  const r = await dialogo(`${atual ? 'Editar' : 'Novo'} desconto`, `<div class="grid2">
      ${campoBusca({ nome: 'prestador', rotulo: 'Prestador (busca no cadastro)', fonte: 'prestador', valor: d.nome, cod: d.cod, preencheCod: 'cod', obrigatorio: true })}
      <label class="campo">Código<input type="text" name="cod" value="${esc(d.cod)}" style="max-width:120px"></label>
      <label class="campo">Motivo *<input type="text" name="motivo" list="dlMotivoDesc" value="${esc(d.motivo)}" placeholder="ex.: Adiantamento"></label>
      <fieldset class="campo" style="grid-column:1/-1;border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin:0"><legend class="small" style="padding:0 4px">Valor *</legend>
        <label class="small" style="display:block;font-weight:400"><input type="radio" name="tipoValor" value="fixo"${d.variavel ? '' : ' checked'}> <b>Fixo</b>: o mesmo valor todo mês (ex.: pensão)</label>
        <label class="small" style="display:block;font-weight:400;margin-top:4px"><input type="radio" name="tipoValor" value="variavel"${d.variavel ? ' checked' : ''}> <b>Muda todo mês</b>: conferir no portal antes do pagamento (ex.: adiantamento Unimed, plano de saúde)</label></fieldset>
      <label class="campo" id="dcFixo">Valor da parcela (R$) *<input type="number" step="0.01" min="0" name="valorParcela" value="${esc(d.valorParcela || '')}"></label>
      <label class="campo" id="dcOnde">Onde conferir o valor *<input type="text" name="onde" value="${esc(d.onde || '')}" placeholder="ex.: Portal da Unimed"></label>
      <label class="campo">Número de parcelas<input type="number" step="1" min="0" name="parcelas" value="${+d.parcelas || ''}"><span class="small muted">vazio = recorrente (ex.: pensão)</span></label>
      <label class="campo">Primeira parcela na competência *<input type="month" name="inicio" value="${esc(mesInput(d.inicio))}"></label>
      <label class="campo">Aplica em *<select name="tipo">${opcoes(Object.entries(TIPOS_DESCONTO), d.tipo)}</select></label>
      <label class="campo">Observação<input type="text" name="obs" value="${esc(d.obs || '')}"></label></div>
    <p class="small muted" id="dcExpl">Todo mês, o Fechamento mostra este desconto como <b>a conferir</b> e pede o valor visto no portal antes do pagamento. O Início também lembra até ser lançado.</p>
    <datalist id="dlMotivoDesc">${['Adiantamento', 'Adiantamento Unimed', 'Plano de saúde', 'Pensão alimentícia', 'Ajuste de repasse', ...new Set(S.cfg.descontos.map(x => x.motivo))].filter((v, i, a) => a.indexOf(v) === i).map(m => `<option value="${esc(m)}"></option>`).join('')}</datalist>
    ${atual ? `<p class="small muted">Situação em ${rotuloCompetencia(S.comp)}: ${esc(situacaoDesconto(atual, S.comp).nome)}.${(atual.adiadas || []).length ? ` Adiadas: ${atual.adiadas.map(rotuloCompetencia).join(', ')}.` : ''}</p>` : ''}`,
    [['', 'Cancelar', 'sec'], ...(atual && !atual.encerradoEm ? [['encerrar', `Encerrar em ${rotuloCompetencia(S.comp)}`, 'perigo']] : []), ...(atual?.encerradoEm ? [['reabrir', 'Reativar', 'sec']] : []), ['ok', atual ? 'Salvar' : 'Incluir']]);
  if (r.botao === 'encerrar') { atual.encerradoEm = S.comp; salvarCfg(`Desconto de ${atual.cod} - ${atual.nome} (${atual.motivo}) encerrado em ${rotuloCompetencia(S.comp)}.`, 'prestadores'); atualizarPillMenu(); return; }
  if (r.botao === 'reabrir') { delete atual.encerradoEm; salvarCfg(`Desconto de ${atual.cod} - ${atual.nome} (${atual.motivo}) reativado.`, 'prestadores'); atualizarPillMenu(); return; }
  if (r.botao !== 'ok') return;
  const c = r.campos, p = S.cfg.prestadores.find(x => String(x.cod) === c.cod.trim());
  const variavel = c.tipoValor === 'variavel';
  const dados = { cod: c.cod.trim(), nome: p?.nomeMV || c.prestador.trim(), motivo: c.motivo.trim(), valorParcela: variavel ? 0 : +c.valorParcela || 0, parcelas: c.parcelas === '' ? 0 : +c.parcelas, inicio: c.inicio, tipo: c.tipo, obs: c.obs.trim(), variavel, onde: variavel ? c.onde.trim() : '' };
  const erros = validarDesconto(dados);
  if (!p && dados.cod) erros.push('o código não está no cadastro de prestadores');
  if (erros.length) return avisar('Desconto não gravado: ' + erros.join('; ') + '.', 'warn');
  if (atual) Object.assign(atual, dados, { alteradoPor: op, alteradoEm: agoraISO() });
  else S.cfg.descontos.push({ id: novoId('desc'), ...dados, adiadas: [], por: op, em: agoraISO() });
  salvarCfg(`Desconto ${atual ? 'alterado' : 'cadastrado'}: ${dados.cod} - ${dados.nome} · ${dados.motivo} · ${textoValorDesconto(dados)} ${dados.parcelas ? `× ${dados.parcelas}` : '(recorrente)'} desde ${rotuloCompetencia(dados.inicio)} · ${TIPOS_DESCONTO[dados.tipo]}.`, 'prestadores');
  avisar(`Desconto ${atual ? 'atualizado' : 'cadastrado'}.`, 'ok');
  atualizarPillMenu();
}
// Fechamento: parcelas do mês e alertas do tipo (USG, IMG ou Curitiba).
function cartaoDescontosFech(f, tipo) {
  const lista = listaFech(f, tipo), naLista = new Map(lista.map(x => [x.cod, x])), alertas = (f.alertasDescontos || []).filter(a => a.tipo === tipo && a.k !== 'conferir');
  const adiadas = (S.cfg.descontos || []).filter(d => d.tipo === tipo && (d.adiadas || []).includes(S.comp));
  const cls = { ultima: 'warn', 'sem-valores': 'err', 'sem-linha': 'err', maior: 'err' }, fechada = compFechada();
  // Uma linha por desconto do mês (SOL-F47): o fixo entra sozinho; o que muda todo mês fica «a conferir» até ser lançado.
  const linhas = (S.cfg.descontos || []).filter(d => d.tipo === tipo && naLista.has(String(d.cod))).map(d => ({ d, p: parcelaDoMes(d, S.comp), x: naLista.get(String(d.cod)) })).filter(o => o.p)
    .sort((a, b) => a.x.nome.localeCompare(b.x.nome) || a.d.motivo.localeCompare(b.d.motivo));
  const conferir = linhas.filter(o => o.p.conferir && o.x.temValores), manuais = lista.filter(x => x.descontosManual);
  let pag = ''; try { const mk = marcosFech(S.comp)[{ usg: 'pagUSG', img: 'pagIMG', curitiba: 'pagCuritiba' }[tipo]]; if (mk) pag = fmtData(mk); } catch (e) { }
  const sit = o => !o.p.variavel ? `<span class="badge info">${o.p.recorrente ? 'fixo · automático' : `parcela ${o.p.n}/${o.p.total}`}</span>`
    : o.p.conferir ? '<span class="badge warn">a conferir</span>'
      : `<span class="badge ok">${o.p.semDesconto ? 'sem desconto este mês' : 'conferido'}</span><small class="nc-det">${esc(o.p.lancamento.por || '—')} · ${new Date(o.p.lancamento.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>`;
  const valor = o => !o.p.variavel || !o.p.conferir || fechada ? fmtBR(o.p.valor) : `<input type="number" step="0.01" min="0" style="max-width:120px" data-desc-valor="${esc(o.d.id)}" placeholder="0,00" aria-label="Valor do mês de ${esc(o.x.nome)} · ${esc(o.d.motivo)}">`;
  const acao = o => !o.p.variavel || fechada ? '' : o.p.conferir ? `<button class="mini" data-desc-lanca="${esc(o.d.id)}">Lançar</button> <button class="sec mini" data-desc-zero="${esc(o.d.id)}">Sem desconto este mês</button>` : `<button class="sec mini" data-desc-corrige="${esc(o.d.id)}">✎ Corrigir</button>`;
  return `<div class="card desc-cartao"><h3>Descontos do mês — ${NOME_TIPO_FECH[tipo]}${pag ? ` <span class="muted small">· pagamento ${pag}</span>` : ''}</h3>
    ${conferir.length ? `<div class="alerta-desc warn">⚠ <b>${conferir.length} desconto(s) a conferir</b> no portal antes do pagamento${pag ? ` de ${pag}` : ''}. Enquanto não forem lançados, o prestador fica em «Verificar».</div>` : ''}
    ${linhas.length ? `<div class="tw"><table><thead><tr><th>Cód.</th><th>Prestador</th><th>Desconto</th><th>Onde conferir</th><th class="n">Valor do mês (R$)</th><th>Situação</th><th></th></tr></thead><tbody>${linhas.map(o => `<tr><td>${esc(o.x.cod)}</td><td>${esc(o.x.nome)}</td><td>${esc(o.d.motivo)}<small class="nc-det">${o.p.variavel ? 'muda todo mês' : 'valor fixo'} · ${o.p.recorrente ? 'recorrente' : `${o.p.n} de ${o.p.total}`}</small></td><td class="small">${esc(o.d.onde || '—')}</td><td class="n">${o.x.temValores ? valor(o) : '<span class="small muted">sem valores</span>'}</td><td>${sit(o)}</td><td style="white-space:nowrap">${o.x.temValores ? acao(o) : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Nenhum desconto neste mês.</p>'}
    ${manuais.length ? `<p class="small muted">DESCONTOS alterado à mão no fechamento: ${manuais.map(x => `${esc(x.nome)} (R$ ${fmtBR(x.descontos)} no lugar de R$ ${fmtBR(x.descontosAuto)})`).join(' · ')}.</p>` : ''}
    ${alertas.length ? `<h4 style="margin:10px 0 4px">Alertas</h4>${alertas.map(a => `<div class="alerta-desc ${cls[a.k] || ''}">${esc(a.texto)}${a.adiar ? ` <button class="sec mini" data-desc-adiar="${esc(a.id)}">Levar para o próximo mês</button>` : ''}</div>`).join('')}` : ''}
    ${adiadas.length ? `<p class="small muted">Adiadas neste mês: ${adiadas.map(d => `${esc(d.nome)} · ${esc(d.motivo)} <button class="sec mini" data-desc-volta="${esc(d.id)}">desfazer</button>`).join(' · ')}</p>` : ''}
    <div class="acoes"><button class="sec" data-desc-novo="${tipo}">+ Desconto</button><span class="small muted">Cadastro completo em Bases → Prestadores e regras → Descontos do prestador.</span></div></div>`;
}
/* SOL-F47 — contagem de descontos a conferir no item «Fechamento e envio» do menu. */
function atualizarPillMenu() {
  const a = document.querySelector('.nav a[data-pag="fechamento"]'); if (!a) return;
  a.querySelector('.pill-desc')?.remove();
  let n = 0; try { n = compFechada() ? 0 : descontosAConferir(S.cfg, S.comp).length; } catch (e) { }
  if (n) a.insertAdjacentHTML('beforeend', `<span class="pill pill-desc" title="${n} desconto(s) a conferir no portal">${n}</span>`);
}
