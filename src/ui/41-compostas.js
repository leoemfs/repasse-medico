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
      <td style="white-space:nowrap">${c.status !== 'validada' ? `<button class="mini" data-cmpval="${c.id}">Validar</button> ` : ''}<button class="sec mini" data-cmped="${c.id}" aria-label="Editar">✎</button> ${c.itens.flatMap(it => it.codigos).length > 1 ? `<button class="sec mini" data-cmpmodo="${c.id}" title="Trocar entre «juntos» e «um ou outro»">⇄ ${modoComposta(c) === 'ou' ? 'Juntos' : 'Um ou outro'}</button>` : ''} ${c.status !== 'desativada' ? `<button class="perigo mini" data-cmpdes="${c.id}" title="Desativar">✕</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Nenhuma regra composta ainda.</p>'}
    <div class="acoes"><button class="sec" id="cmpNova">+ Regra composta</button><span class="small muted">A simulação refaz as conferências da competência com os PDFs e o Apolo carregados nesta sessão.</span></div></div>`;
}
function ligarCompostas(raiz) {
  if (!raiz.querySelector('#cardCompostas')) return;
  $('cmpNova').onclick = () => editarComposta(null);
  raiz.querySelectorAll('[data-cmped]').forEach(b => b.onclick = () => editarComposta(b.dataset.cmped));
  raiz.querySelectorAll('[data-cmpmodo]').forEach(b => b.onclick = async () => {
    const op = await exigirOperador(); if (!op) return;
    const c = S.eq.compostas.find(x => x.id === b.dataset.cmpmodo), novoModo = modoComposta(c) === 'ou' ? 'juntos' : 'ou', depois = { ...regraComposta(c), itens: itensNoModo(c, novoModo) };
    const perdeExc = regraComposta(c).itens.some(it => (it.excecoes || []).length) || regraComposta(c).itens.some(it => (+it.qtd || 1) !== 1);
    const r = await dialogo(`«${nomeComposta(c)}»: ${novoModo === 'ou' ? 'um ou outro' : 'juntos'}`, `<p class="small"><b>Hoje:</b> ${esc(leituraRegraComposta(c, descTussUI, true))}</p><p class="small"><b>Fica:</b> ${esc(leituraRegraComposta(depois, descTussUI, true))}</p>
      ${perdeExc ? '<p class="small badge warn">As quantidades diferentes de 1 e as exceções por convênio desta regra deixam de valer.</p>' : ''}<p class="small muted">A regra continua ${esc(STATUS_EQ[c.status] || c.status)}; a troca fica no histórico, com o seu nome. Rode as conferências de novo para aplicar.</p>
      <label class="campo">Justificativa (obrigatória)<input type="text" name="just" placeholder="${novoModo === 'ou' ? 'ex.: o escroto é lançado como bolsa escrotal ou como órgãos superficiais' : 'ex.: a conta traz os dois procedimentos'}"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Trocar']]);
    if (r.botao !== 'ok') return; if (!r.campos.just?.trim()) return avisar('Informe a justificativa.', 'warn');
    for (const k of ['titulo', 'codigos', 'porConvenio']) delete c[k];
    c.itens = depois.itens; c.titulos = depois.titulos; c.nome = c.nome || depois.nome;
    (c.historico ||= []).push({ em: agoraISO(), por: op, de: c.status, para: c.status, motivo: `trocada para «${novoModo === 'ou' ? 'um ou outro' : 'juntos'}»: ${r.campos.just.trim()}`, competencia: S.comp });
    S.eq.revisao++; S.eq.atualizadoEm = agoraISO(); salvarEq(`Regra «${nomeComposta(c)}» agora é «${novoModo === 'ou' ? 'um ou outro' : 'juntos'}». Rode as conferências de novo para aplicar.`); RENDER.equivalencias();
  });
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
  if (k.modo === 'ou' && itens.length) { const cods = [...new Set(itens.flatMap(it => it.codigos))]; itens.splice(0, itens.length, { rotulo: 'um dos códigos', codigos: cods, qtd: 1, excecoes: [] }); }
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
  if (soma < 2 && !c.itens.some(it => it.excecoes.length) && !(c.itens.length === 1 && c.itens[0].codigos.length > 1)) e.push('a composição precisa de 2 ou mais procedimentos (ou quantidade 2), ou de uma exceção por convênio; para um código só, use a relação simples');
  const dup = outras.find(o => o.status !== 'desativada' && o.escopo.unidade === c.escopo.unidade && c.titulos.some(t => o.titulos.some(u => chaveTitulo(u) === chaveTitulo(t))));
  if (dup) e.push(`o título já está na regra «${nomeComposta(dup)}»`);
  return e;
}
/* Cadastro de regra composta em 4 perguntas (aprovado em 09/11/2026):
 * 1) quando o laudo tiver o título… 2) a conta deve ter todos / um destes procedimentos 3) exceção por convênio
 * 4) outros laudos do mesmo exame — e «Como vai funcionar» em português, atualizado enquanto se preenche. */
function edDaRegra(c0) {
  const c = regraComposta(c0), modo = modoComposta(c);
  const procs = modo === 'ou' ? c.itens[0].codigos.map(cd => ({ codigos: [cd], qtd: 1, rotulo: '' })) : c.itens.map(it => ({ codigos: [...it.codigos], qtd: +it.qtd || 1, rotulo: it.rotulo || '' }));
  const excs = c.itens.flatMap((it, i) => (it.excecoes || []).map(e => ({ convenio: e.convenio, item: modo === 'ou' ? 0 : i, tipo: e.tipo, qtd: +e.qtd || 0 })));
  return { nome: c.nome || '', nomeAuto: !c.nome, unidade: c.escopo?.unidade || '*', just: c.justificativa || '', titulos: [...c.titulos], palTodas: (c.palavras?.todas || []).join(', '), palUmaDe: (c.palavras?.umaDe || []).join(', '), modo, procs, excs, mesmoEstudo: [...(c.titulosMesmoEstudo || [])] };
}
function regraDoEd(ED, base) {
  // Nome curto do item: o que já tinha, ou a descrição do MV até « - » ou «(», sem cortar palavra.
  const curto = d => { let t = String(d || '').split(/\s+-\s+|\s*\(/)[0].trim(); if (t.length > 40) t = t.slice(0, 40).replace(/\s+\S*$/, ''); return t; };
  const rot = p => p.rotulo || curto(descTussUI(p.codigos[0]) || p.desc) || p.codigos[0];
  const exc = i => ED.excs.filter(e => e.convenio.trim() && e.item === i).map(e => ({ convenio: e.convenio.trim().toUpperCase(), tipo: e.tipo, qtd: e.tipo === 'quantidade' ? Math.max(0, +e.qtd || 0) : 0 }));
  const itens = ED.modo === 'ou' ? (ED.procs.length ? [{ rotulo: 'um dos códigos', codigos: [...new Set(ED.procs.flatMap(p => p.codigos))], qtd: 1, excecoes: exc(0) }] : [])
    : ED.procs.map((p, i) => ({ rotulo: rot(p), codigos: p.codigos, qtd: Math.max(1, +p.qtd || 1), excecoes: exc(i) }));
  const palavras = { todas: lerPalavras(ED.palTodas), umaDe: lerPalavras(ED.palUmaDe) };
  const nome = ED.nome.trim() || (ED.titulos[0] ? ED.titulos[0].slice(0, 60) : '');
  return { ...base, nome, titulos: [...ED.titulos], palavras: palavras.todas.length || palavras.umaDe.length ? palavras : null, itens, escopo: { unidade: ED.unidade || '*', modalidade: '*' }, justificativa: ED.just.trim(), titulosMesmoEstudo: [...ED.mesmoEstudo] };
}
async function editarComposta(id, rascunho = null, sim = null) {
  const op = await exigirOperador(); if (!op) return;
  S.eq.compostas = S.eq.compostas || [];
  const atual = id ? S.eq.compostas.find(x => x.id === id) : null;
  const ED = edDaRegra(rascunho || (atual ? regraComposta(atual) : novaComposta({ itens: [] })));
  const chip = (t, ac, i) => `<span class="cp-chip">${esc(t)}<button type="button" data-ed="${ac}" data-i="${i}" aria-label="Tirar">✕</button></span>`;
  const desenharPassos = () => {
    const procs = ED.procs.map((p, i) => `${ED.modo === 'ou' && i ? '<div class="cp-ou">ou</div>' : ''}<div class="cp-proc"><span><b>${esc(p.codigos.join(' ou '))}</b> · ${esc(p.codigos.map(descTussUI).filter(Boolean).join(' / ') || p.desc || (p.rotulo !== p.codigos[0] ? p.rotulo : '') || '')}</span>
      ${ED.modo === 'juntos' ? `<span class="cp-qtd">vezes <button type="button" data-ed="menos" data-i="${i}">−</button><b>${p.qtd}</b><button type="button" data-ed="mais" data-i="${i}">+</button></span>` : '<span></span>'}<button type="button" class="cp-x" data-ed="tirarProc" data-i="${i}" aria-label="Tirar procedimento">✕</button></div>`).join('');
    const excs = ED.excs.map((e, i) => `<div class="cp-exc">No convênio <input type="text" data-exc="convenio" data-i="${i}" value="${esc(e.convenio)}" placeholder="ex.: UNIMED" list="cpConv">
      ${ED.modo === 'juntos' ? `o procedimento <select data-exc="item" data-i="${i}">${ED.procs.map((p, k) => `<option value="${k}"${k === e.item ? ' selected' : ''}>${esc(p.codigos.join(' ou '))} ${esc(descTussUI(p.codigos[0]).slice(0, 30))}</option>`).join('')}</select>` : 'o procedimento'}
      <select data-exc="tipo" data-i="${i}"><option value="nao-exigido"${e.tipo === 'nao-exigido' ? ' selected' : ''}>não é cobrado</option><option value="quantidade"${e.tipo === 'quantidade' ? ' selected' : ''}>é cobrado</option></select>
      ${e.tipo === 'quantidade' ? `<input type="number" min="0" data-exc="qtd" data-i="${i}" value="${e.qtd}" style="width:60px"> vez(es)` : ''}<button type="button" class="cp-x" data-ed="tirarExc" data-i="${i}" aria-label="Tirar exceção">✕</button></div>`).join('');
    $('cpPassos').innerHTML = `
      <div class="cp-passo"><div class="cp-n">1</div><div><h4>Quando o laudo do Apolo tiver o título…</h4>
        <div class="cp-chips">${ED.titulos.map((t, i) => chip(t, 'tirarTitulo', i)).join('')}</div>
        ${campoBusca({ nome: 'cpTitulo', rotulo: '', fonte: 'titulo', livre: true, dica: '' })}
        <details class="cp-mais"${ED.palTodas || ED.palUmaDe ? ' open' : ''}><summary>Reconhecer por palavras do título (para muitas variações, ex.: «DOPPLER» + «PUNHO, OMBRO, JOELHO»)</summary>
          <div class="grid2"><label class="campo">O título contém todas estas<input type="text" data-campo="palTodas" value="${esc(ED.palTodas)}" placeholder="ex.: DOPPLER"></label>
          <label class="campo">e pelo menos uma destas (opcional)<input type="text" data-campo="palUmaDe" value="${esc(ED.palUmaDe)}" placeholder="ex.: PUNHO, OMBRO, JOELHO"></label></div><span class="small muted">Separe por vírgula.</span></details></div></div>
      <div class="cp-passo"><div class="cp-n">2</div><div><h4>…a conta do MV deve ter:</h4>
        <div class="cp-modo"><button type="button" class="${ED.modo === 'juntos' ? 'on' : ''}" data-ed="modo" data-i="juntos"><b>${ED.modo === 'juntos' ? '◉' : '○'} Todos estes procedimentos</b><small>juntos na mesma conta (ex.: transvaginal <b>e</b> Doppler)</small></button>
          <button type="button" class="${ED.modo === 'ou' ? 'on' : ''}" data-ed="modo" data-i="ou"><b>${ED.modo === 'ou' ? '◉' : '○'} Um destes procedimentos</b><small>qualquer um confirma (ex.: bolsa escrotal <b>ou</b> órgãos superficiais)</small></button></div>
        ${procs || '<p class="small muted">Nenhum procedimento ainda.</p>'}
        ${campoBusca({ nome: 'cpProc', rotulo: '', fonte: 'tuss', valorCodigo: true, livre: true })}<span class="small muted">+ adicionar procedimento: digite o código ou o nome TUSS e escolha.</span></div></div>
      <div class="cp-passo"><div class="cp-n">3</div><div><h4>Exceção por convênio <span class="muted small">(opcional)</span></h4>
        ${excs}<button type="button" class="sec mini" data-ed="novaExc">+ adicionar exceção (ex.: na UNIMED o Doppler não é cobrado)</button>
        <datalist id="cpConv">${(S.cfg.convenios || []).map(cv => `<option value="${esc(cv.nome || cv)}">`).join('')}</datalist></div></div>
      <div class="cp-passo"><div class="cp-n">4</div><div><h4>Outros laudos do mesmo exame <span class="muted small">(opcional — não cobram outra linha)</span></h4>
        <div class="cp-chips">${ED.mesmoEstudo.map((t, i) => chip(t, 'tirarMesmo', i)).join('')}</div>
        ${campoBusca({ nome: 'cpMesmo', rotulo: '', fonte: 'titulo', livre: true })}</div></div>`;
    ligarBuscas($('cpPassos'));
    $('cpPassos').querySelector('[name="cpTitulo"]').addEventListener('busca-escolha', e => { const v = (e.detail?.nome || '').trim(); if (v && !ED.titulos.includes(v)) ED.titulos.push(v); redesenhar(); });
    $('cpPassos').querySelector('[name="cpMesmo"]').addEventListener('busca-escolha', e => { const v = (e.detail?.nome || '').trim(); if (v && !ED.mesmoEstudo.includes(v)) ED.mesmoEstudo.push(v); redesenhar(); });
    $('cpPassos').querySelector('[name="cpProc"]').addEventListener('busca-escolha', e => { const v = String(e.detail?.cod || e.target.value || '').replace(/\D/g, ''), nm = e.detail?.nome && e.detail.nome !== v ? e.detail.nome : ''; if (v.length >= 5 && !ED.procs.some(p => p.codigos.includes(v))) ED.procs.push({ codigos: [v], qtd: 1, rotulo: '', desc: nm }); redesenhar(); });
    $('cpPassos').querySelectorAll('[data-campo]').forEach(i => i.oninput = () => { ED[i.dataset.campo] = i.value; atualizarComo(); });
    $('cpPassos').querySelectorAll('[data-exc]').forEach(i => i.oninput = i.onchange = () => { const e = ED.excs[+i.dataset.i], k = i.dataset.exc; e[k] = k === 'item' || k === 'qtd' ? +i.value : i.value; if (k === 'tipo') redesenhar(); else atualizarComo(); });
    $('cpPassos').querySelectorAll('[data-ed]').forEach(b => b.onclick = () => {
      const i = b.dataset.i, a = b.dataset.ed;
      if (a === 'tirarTitulo') ED.titulos.splice(+i, 1); else if (a === 'tirarMesmo') ED.mesmoEstudo.splice(+i, 1);
      else if (a === 'tirarProc') { ED.procs.splice(+i, 1); ED.excs = ED.excs.filter(e => e.item !== +i).map(e => ({ ...e, item: e.item > +i ? e.item - 1 : e.item })); }
      else if (a === 'mais') ED.procs[+i].qtd++; else if (a === 'menos') ED.procs[+i].qtd = Math.max(1, ED.procs[+i].qtd - 1);
      else if (a === 'modo') { ED.modo = i; if (i === 'ou') ED.excs.forEach(e => { e.item = 0; }); }
      else if (a === 'novaExc') ED.excs.push({ convenio: '', item: 0, tipo: 'nao-exigido', qtd: 0 });
      else if (a === 'tirarExc') ED.excs.splice(+i, 1);
      redesenhar();
    });
  };
  const atualizarComo = () => {
    const r = regraDoEd(ED, {}), ok = (r.titulos.length || r.palavras) && r.itens.length;
    $('cpComo').innerHTML = ok ? `<b>Como vai funcionar:</b> ${esc(leituraRegraComposta(r, descTussUI))}` : '<b>Como vai funcionar:</b> <span class="muted">escolha o título do laudo (1) e os procedimentos da conta (2).</span>';
    const n = $('dlgCorpo').querySelector('[data-campo="nome"]'); if (n && ED.nomeAuto) n.placeholder = r.nome || 'preenchido com o 1º título';
  };
  const redesenhar = () => { desenharPassos(); atualizarComo(); };
  const pr = dialogo(`${atual ? 'Editar' : 'Nova'} regra composta`, `<span class="dlg-largo" hidden></span>
    ${sim ? `<div class="sim-cp"><b>Simulação nesta competência:</b> sustenta <b>${sim.contas} conta(s) (${sim.linhas} linha(s))</b> · ${sim.falta} com composição incompleta · ${sim.sobra} sobrando · ${sim.relatorios} relatório(s) refeito(s)${sim.semRodada ? ` · ${sim.semRodada} sem rodada` : ''}</div>` : ''}
    <div id="cpPassos"></div><div class="cp-como" id="cpComo"></div>
    <details class="cp-mais"><summary>Mais opções: nome da regra (preenchido sozinho), só numa unidade, justificativa</summary>
      <div class="grid2"><label class="campo">Nome da regra<input type="text" data-campo="nome" value="${esc(ED.nomeAuto ? '' : ED.nome)}"></label>
      <label class="campo">Unidade<select data-campo="unidade"><option value="*">Todas</option>${opcoes(S.cfg.unidades.map(u => [u.cod, `${u.cod} - ${u.nome}`]), ED.unidade)}</select></label></div>
      <label class="campo">Justificativa<input type="text" data-campo="just" value="${esc(ED.just)}"></label>
      <p class="small muted">O texto do convênio vale para todos que o contêm («UNIMED» pega UNIMED CURITIBA, UNIMED LONDRINA…). Editar uma regra validada volta ela para pendente, a não ser que você salve e valide.</p></details>`,
    [['', 'Cancelar', 'sec'], ['simular', 'Simular nesta competência', 'sec'], ['pendente', 'Salvar pendente', 'sec'], ['ok', 'Salvar e validar']]);
  redesenhar();
  $('dlgCorpo').querySelectorAll('details.cp-mais [data-campo]').forEach(i => i.oninput = i.onchange = () => { ED[i.dataset.campo] = i.value; if (i.dataset.campo === 'nome') ED.nomeAuto = !i.value.trim(); atualizarComo(); });
  // Enter numa busca não fecha o diálogo.
  $('dlgCorpo').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) e.preventDefault(); });
  const r = await pr;
  if (!r.botao) return;
  const nova = regraDoEd(ED, atual ? regraComposta(atual) : novaComposta({}));
  if (r.botao === 'simular') {
    if (!nova.itens.length) { avisar('Inclua os procedimentos para simular.', 'warn'); return editarComposta(id, nova); }
    avisar('Simulando nas conferências da competência…', 'info');
    const s = await simularComposta(nova); if (s && atual) CP.simulacoes.set(atual.id, s);
    return editarComposta(id, nova, s);
  }
  const erros = validarRegraComposta(nova, (S.eq.compostas || []).filter(x => x !== atual).map(regraComposta));
  if (erros.length) { avisar('Regra não gravada: ' + erros.join('; ') + '.', 'warn'); return editarComposta(id, nova, sim); }
  const dados = { nome: nova.nome, titulos: nova.titulos, palavras: nova.palavras, itens: nova.itens, escopo: nova.escopo, justificativa: nova.justificativa, titulosMesmoEstudo: nova.titulosMesmoEstudo };
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
  if (descTussUI.m.has(k)) return descTussUI.m.get(k);
  // Catálogo TUSS geral (base de dados, Power BI, relatórios carregados).
  try { const it = catalogo('tuss', S.cfg, contextoCatalogo()).find(x => String(x.cod) === k); if (it?.nome) { descTussUI.m.set(k, it.nome); return it.nome; } } catch (e) { /* sem catálogo */ }
  return '';
}
