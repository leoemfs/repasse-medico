/* ============================================================
 * Bases → regras de repasse: faixas de USG, parâmetros do fechamento, classes e valores
 * do IMG, convênios (SUS · Convênio · Particular) e regras de cada prestador
 * ============================================================ */
const nomeFaixa = id => (S.cfg.faixasUSG || []).find(f => f.id === id)?.nome || '';
function resumoRegras(p) {
  const r = p.regras || {}, partes = [];
  if (r.faixaUSG) partes.push(`USG: ${esc(nomeFaixa(r.faixaUSG))}${Object.values(r.pctUSGUnidade || {}).some(v => v !== '' && v !== null) ? ' (diferenciado)' : ''}`);
  if (r.board) partes.push(`BOARD R$ ${fmtBR(r.board)}`);
  if (r.v3) partes.push(`V3${r.v3regra ? '' : ' (sem regra)'}`);
  if (r.participaIMG && !r.v3) partes.push(`IMG${r.classeFixa ? ` · classe fixa ${esc(r.classeFixa)}` : ''}${r.tabelaIMG === 'residente' || r.tipo === 'residente' ? ' · tabela de residente' : ''}`);
  if ((r.excecoesIMG || []).length) partes.push(`exceções: ${r.excecoesIMG.map(e => `${EXAMES_IMG[e.exame] || e.exame} R$ ${fmtBR(e.valor)}`).join(', ')}`);
  return partes.join(' · ') || '<span class="muted">sem regras</span>';
}

/* ---------- Cartões ---------- */
function cardFaixasUSG() {
  return `<div class="card" data-sub="unidades"><h2>Faixas de repasse de USG</h2>
    <p class="lead">«Unidade» usa o percentual de médicos da unidade (mais o acréscimo); «Residente», o percentual de residentes da unidade; «Fixo», o mesmo percentual em todas. O prestador escolhe a faixa em «Prestadores e regras» e pode ter percentual diferenciado por unidade.</p>
    <div class="tw"><table><thead><tr><th>Nome</th><th>Base</th><th>Acréscimo (p.p.)</th><th>% fixo</th><th class="n">Prestadores</th><th></th></tr></thead><tbody>${S.cfg.faixasUSG.map((f, i) => `<tr>
      <td><input type="text" data-fx="${i}" data-c="nome" value="${esc(f.nome)}"></td>
      <td><select data-fx="${i}" data-c="base">${opcoes([['unidade', 'Unidade (médicos)'], ['residente', 'Unidade (residentes)'], ['fixo', 'Fixo']], f.base)}</select></td>
      <td><input type="number" step="0.01" data-fx="${i}" data-c="acrescimo" value="${f.acrescimo ? r2(f.acrescimo * 100) : ''}" style="width:80px"${f.base === 'fixo' ? ' disabled' : ''}></td>
      <td><input type="number" step="0.01" data-fx="${i}" data-c="pct" value="${f.base === 'fixo' ? r2(f.pct * 100) : ''}" style="width:80px"${f.base === 'fixo' ? '' : ' disabled'}></td>
      <td class="n">${S.cfg.prestadores.filter(p => p.regras?.faixaUSG === f.id).length || ''}</td><td><button class="perigo mini" data-fxrm="${i}" aria-label="Remover">✕</button></td></tr>`).join('')}</tbody></table></div>
    <div class="acoes"><button id="fxSalvar">Salvar faixas</button><button id="fxAdd" class="sec">+ Faixa</button></div></div>`;
}
function cardParametrosFechamento() {
  const f = S.cfg.fechamento;
  return `<div class="card" data-sub="unidades"><h2>Parâmetros do fechamento</h2>
    <div class="grid4"><label class="campo">CNPJ da NF do BOARD<input type="text" id="pfBoard" value="${esc(f.cnpjBoard)}"></label>
      <label class="campo">CNPJ da NF do PLANTÃO<input type="text" id="pfPlantao" value="${esc(f.cnpjPlantao)}"></label>
      <label class="campo">Avisar variação acima de (%)<input type="number" id="pfVar" min="0" value="${f.variacaoAlerta}"><span class="small muted">contra a competência anterior</span></label>
      <label class="campo">Tolerância do % de USG (p.p.)<input type="number" step="0.1" id="pfTolPct" min="0" value="${f.toleranciaPct}"><span class="small muted">e R$ ${fmtBR(f.toleranciaValor)} por laudo do IMG</span></label></div>
    <div class="acoes"><button id="pfSalvar">Salvar parâmetros</button></div></div>`;
}
function cardClasses() {
  const c = S.cfg.classes, tab = (k, titulo) => `<div><h3>${titulo}</h3><div class="tw"><table><thead><tr><th>Exame</th>${COLUNAS_CLASSE.map(x => `<th>${x === 'residente' ? 'Residentes' : 'Classe ' + x}</th>`).join('')}</tr></thead><tbody>${Object.keys(EXAMES_IMG).map(ex => `<tr><td>${EXAMES_IMG[ex]}</td>${COLUNAS_CLASSE.map(col => `<td><input type="number" step="0.01" data-val="${k}|${ex}|${col}" value="${c.valores[k][ex]?.[col] ?? ''}" style="width:72px"></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  return `<div class="card" data-sub="classes"><h2>Classes por produção de USG e valores por laudo do IMG <span class="muted small">vigência ${esc(c.vigencia)}</span></h2>
    <p class="lead">A classe sai da produção bruta de USG do prestador (Vl Total dos relatórios de USG, todas as unidades) na produção da competência. Classe fixa no cadastro do prestador vale por cima. A ferramenta usa a tabela só para conferir o valor de cada laudo do relatório do IMG e avisar quando não bate.</p>
    <div class="grid4">${c.cortes.map((x, i) => `<label class="campo">Classe ${esc(x.classe)}: produção acima de (R$)<input type="number" step="0.01" data-corte="${i}" value="${x.acima}"></label>`).join('')}<div class="campo">Classe D<span class="small">até o último corte ou sem produção</span></div></div>
    <div class="grid2" style="margin-top:8px">${tab('convenio', 'Convênios e particulares')}${tab('sus', 'SUS')}</div>
    <h3 style="margin-top:12px">Procedimentos equivalentes</h3>
    <div class="tw"><table><thead><tr><th>Nome</th><th>Padrão na descrição do MV</th><th>Equivale a (exame)</th><th>Nº de exames</th><th>Ou valor fixo (R$)</th><th></th></tr></thead><tbody>${c.equivalentes.map((e, i) => `<tr>
      <td><input type="text" data-eqv="${i}" data-c="nome" value="${esc(e.nome)}"></td><td><input type="text" data-eqv="${i}" data-c="padrao" value="${esc(e.padrao)}"></td>
      <td><select data-eqv="${i}" data-c="exame"><option value="">—</option>${opcoes(Object.entries(EXAMES_IMG), e.exame || '')}</select></td>
      <td><input type="number" step="0.5" data-eqv="${i}" data-c="fator" value="${e.fator || ''}" style="width:70px"></td><td><input type="number" step="0.01" data-eqv="${i}" data-c="valor" value="${e.valor || ''}" style="width:90px"></td>
      <td><button class="perigo mini" data-eqvrm="${i}" aria-label="Remover">✕</button></td></tr>`).join('')}</tbody></table></div>
    <div class="acoes"><button id="clsSalvar">Salvar classes e valores</button><button id="clsEqvAdd" class="sec">+ Equivalente</button><button id="clsPad" class="sec">Restaurar tabela 2026</button></div></div>`;
}
function conveniosVistos() {
  const m = new Map();
  for (const x of S.relatorios) for (const r of x.rel.regs) if (r.convenio && !m.has(norm(r.convenio))) m.set(norm(r.convenio), r.convenio);
  return [...m.values()].filter(n => !S.cfg.convenios.some(c => norm(c.nome) === norm(n)));
}
function cardConvenios() {
  const semTipo = S.cfg.convenios.filter(c => !c.tipo).length, vistos = conveniosVistos();
  return `<div class="card" data-sub="convenios"><h2>Convênios <span class="muted small">${S.cfg.convenios.length} cadastrados · ${semTipo} sem tipo</span></h2>
    <p class="lead">O tipo define a tabela de valores do IMG: SUS usa a tabela SUS; Convênio e Particular usam a de convênios e particulares. O Power BI traz Convênio ou Particular; o SUS é marcado aqui (o tipo marcado à mão nunca é trocado por uma importação).</p>
    <div class="acoes">${S.pbi ? `<button id="cvPbi" class="sec">Importar do Power BI (${S.pbi.convenios.length})</button>` : '<span class="small muted">Carregue o Power BI no Início para importar a lista com os tipos.</span>'}
      ${vistos.length ? `<button id="cvMV" class="sec">Incluir ${vistos.length} dos relatórios do MV carregados</button>` : ''}<button id="cvAdd" class="sec">+ Convênio</button>
      <label class="small"><input type="checkbox" id="cvSoSem"${BS.soSemTipo ? ' checked' : ''}> só os sem tipo</label><input type="search" id="cvBusca" placeholder="Buscar convênio…" style="max-width:260px"></div>
    <div id="cvTab" style="margin-top:8px"></div></div>`;
}

/* ---------- Ligações ---------- */
function ligarRegras(pg) {
  // Faixas de USG
  pg.querySelectorAll('[data-fx]').forEach(inp => inp.onchange = () => {
    const f = S.cfg.faixasUSG[+inp.dataset.fx], c = inp.dataset.c;
    if (c === 'acrescimo' || c === 'pct') f[c] = inp.value === '' ? 0 : +inp.value / 100; else f[c] = inp.value.trim();
    if (c === 'base') RENDER.bases();
  });
  pg.querySelectorAll('[data-fxrm]').forEach(b => b.onclick = async () => {
    const f = S.cfg.faixasUSG[+b.dataset.fxrm], n = S.cfg.prestadores.filter(p => p.regras?.faixaUSG === f.id).length;
    if (n) return avisar(`A faixa «${f.nome}» tem ${n} prestador(es). Troque a faixa deles antes de remover.`, 'warn');
    S.cfg.faixasUSG.splice(+b.dataset.fxrm, 1); salvarCfg(`Faixa de USG «${f.nome}» removida.`, 'regras'); RENDER.bases();
  });
  $('fxAdd').onclick = () => { S.cfg.faixasUSG.push({ id: novoId('fx'), nome: 'Nova faixa', base: 'fixo', pct: 0.4, acrescimo: 0 }); RENDER.bases(); };
  $('fxSalvar').onclick = () => { salvarCfg('Faixas de repasse de USG salvas.', 'regras'); RENDER.bases(); };
  // Parâmetros do fechamento
  $('pfSalvar').onclick = () => {
    Object.assign(S.cfg.fechamento, { cnpjBoard: $('pfBoard').value.trim(), cnpjPlantao: $('pfPlantao').value.trim(), variacaoAlerta: +$('pfVar').value || 0, toleranciaPct: +$('pfTolPct').value || 0 });
    salvarCfg('Parâmetros do fechamento salvos.', 'parametros');
  };
  // Prestadores
  pg.querySelectorAll('[data-regras]').forEach(b => b.onclick = () => editarRegrasPrestador(S.cfg.prestadores[+b.dataset.regras]));
  $('prCtrl').onclick = () => $('prCtrlArq').click();
  $('prCtrlArq').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importarPlanilhaControle(f); };
  // Classes e valores
  pg.querySelectorAll('[data-corte]').forEach(inp => inp.onchange = () => { S.cfg.classes.cortes[+inp.dataset.corte].acima = +inp.value || 0; });
  pg.querySelectorAll('[data-val]').forEach(inp => inp.onchange = () => { const [k, ex, col] = inp.dataset.val.split('|'); S.cfg.classes.valores[k][ex][col] = inp.value === '' ? null : +inp.value; });
  pg.querySelectorAll('[data-eqv]').forEach(inp => inp.onchange = () => { const e = S.cfg.classes.equivalentes[+inp.dataset.eqv], c = inp.dataset.c; e[c] = ['fator', 'valor'].includes(c) ? (inp.value === '' ? 0 : +inp.value) : inp.value.trim(); });
  pg.querySelectorAll('[data-eqvrm]').forEach(b => b.onclick = () => { S.cfg.classes.equivalentes.splice(+b.dataset.eqvrm, 1); RENDER.bases(); });
  $('clsEqvAdd').onclick = () => { S.cfg.classes.equivalentes.push({ nome: 'Novo equivalente', padrao: '', exame: 'TOMO', fator: 1 }); RENDER.bases(); };
  $('clsPad').onclick = async () => { if (await confirmar('Restaurar a tabela de 2026?', 'Cortes, valores e equivalentes voltam ao padrão da planilha de regras de classe.', 'Restaurar')) { S.cfg.classes = classesPadrao(); salvarCfg('Classes e valores do IMG restaurados (2026).', 'regras'); RENDER.bases(); } };
  $('clsSalvar').onclick = () => {
    const ruins = S.cfg.classes.equivalentes.filter(e => { try { new RegExp(e.padrao); return !e.padrao; } catch (x) { return true; } });
    if (ruins.length) return avisar(`Padrão inválido em: ${ruins.map(e => e.nome).join(', ')}.`, 'err');
    const c = S.cfg.classes.cortes.map(x => x.acima);
    if (!(c[0] > c[1] && c[1] > c[2])) return avisar('Os cortes precisam ser decrescentes: A > B > C.', 'err');
    salvarCfg('Classes e valores do IMG salvos.', 'regras');
  };
  // Convênios
  if ($('cvTab')) desenharConvenios();
  if ($('cvPbi')) $('cvPbi').onclick = () => { const r = registrarConvenios(S.cfg, S.pbi.convenios, `Power BI ${S.pbi.nome}`); salvarCfg(`${r.novos} convênio(s) novo(s) e ${r.tipados} com tipo preenchido, do Power BI.`, 'regras'); RENDER.bases(); };
  if ($('cvMV')) $('cvMV').onclick = () => { const r = registrarConvenios(S.cfg, conveniosVistos().map(n => [n, '']), 'relatórios do MV'); salvarCfg(`${r.novos} convênio(s) dos relatórios do MV (sem tipo: marque SUS, Convênio ou Particular).`, 'regras'); BS.soSemTipo = true; RENDER.bases(); };
  $('cvAdd').onclick = async () => {
    const r = await dialogo('Novo convênio', `${campoBusca({ nome: 'nome', rotulo: 'Nome (como no MV)', fonte: 'convenio', dica: 'A lista mostra também os convênios dos relatórios do MV e do Power BI ainda sem cadastro.' })}<label class="campo">Tipo<select name="tipo">${opcoes(Object.entries(TIPOS_CONVENIO), 'SUS')}</select></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Adicionar']]);
    if (r.botao !== 'ok' || !r.campos.nome.trim()) return;
    const x = registrarConvenios(S.cfg, [[r.campos.nome, r.campos.tipo]], `cadastro manual (${S.operador || '—'})`);
    if (!x.novos) return avisar('Esse convênio já está cadastrado.', 'warn');
    salvarCfg(`Convênio «${r.campos.nome.trim()}» cadastrado como ${TIPOS_CONVENIO[r.campos.tipo]}.`, 'regras'); RENDER.bases();
  };
  $('cvSoSem').onchange = e => { BS.soSemTipo = e.target.checked; desenharConvenios(); };
  $('cvBusca').oninput = () => desenharConvenios();
}
function desenharConvenios() {
  const q = norm($('cvBusca')?.value || '');
  const lista = S.cfg.convenios.filter(c => (!BS.soSemTipo || !c.tipo) && (!q || norm(c.nome).includes(q))).sort((a, b) => (!!a.tipo - !!b.tipo) || a.nome.localeCompare(b.nome));
  tabela($('cvTab'), {
    linhas: lista, porPagina: 100, vazio: 'Nenhum convênio. Importe do Power BI ou dos relatórios do MV.',
    colunas: [{ t: 'Convênio', v: c => c.nome }, { t: 'Tipo', html: c => `<select data-cv="${esc(c.nome)}" aria-label="Tipo"><option value="">— sem tipo —</option>${opcoes(Object.entries(TIPOS_CONVENIO), c.tipo)}</select>` }, { t: 'Origem', v: c => c.origem || '' }]
  });
  $('cvTab').onchange = e => {
    const s = e.target.closest('[data-cv]'); if (!s) return;
    const c = S.cfg.convenios.find(x => x.nome === s.dataset.cv); c.tipo = s.value;
    salvarCfg(`Convênio «${c.nome}» marcado como ${TIPOS_CONVENIO[c.tipo] || 'sem tipo'}.`, 'regras');
  };
}

/* ---------- Regras de um prestador ---------- */
async function editarRegrasPrestador(p) {
  const op = await exigirOperador(); if (!op) return;
  const r = { ...regrasPrestadorVazias(), ...(p.regras || {}) };
  const unUSG = S.cfg.unidades.filter(u => u.pctUSG);
  const d = await dialogo(`Regras de repasse — ${p.cod} - ${p.nomeMV}`, `<div class="grid2">
    <label class="campo">Tipo<select name="tipo">${opcoes([['medico', 'Médico'], ['residente', 'Residente']], r.tipo)}</select></label>
    <label class="campo">Faixa de repasse de USG<select name="faixaUSG"><option value="">— não faz USG —</option>${opcoes(S.cfg.faixasUSG.map(f => [f.id, f.nome]), r.faixaUSG)}</select></label>
    <label class="campo">BOARD fixo mensal (R$)<input type="number" step="0.01" name="board" value="${r.board || ''}"></label>
    <label class="campo">Classe do IMG<select name="classeFixa">${opcoes([['', 'Calculada pela produção de USG'], ['A', 'Fixa A'], ['B', 'Fixa B'], ['C', 'Fixa C'], ['D', 'Fixa D']], r.classeFixa)}</select></label>
    <label class="campo">Tabela de valores do IMG<select name="tabelaIMG">${opcoes([['padrao', 'Padrão (pela classe)'], ['residente', 'Residente']], r.tabelaIMG)}</select></label>
    <div class="campo"><label class="small"><input type="checkbox" name="participaIMG"${r.participaIMG ? ' checked' : ''}> Recebe repasse de IMG</label><label class="small"><input type="checkbox" name="v3"${r.v3 ? ' checked' : ''}> Médico V3 (Curitiba) <span class="muted">— regra em «Médicos V3»</span></label></div></div>
    <h4 style="margin:8px 0 4px">% de USG diferenciado por unidade <span class="muted small">(vazio = regra da faixa)</span></h4>
    <div class="grid4">${unUSG.map(u => `<label class="campo">${esc(u.cod)} - ${esc(u.nome)}<input type="number" step="0.01" name="pct_${esc(u.cod)}" value="${r.pctUSGUnidade?.[u.cod] !== undefined && r.pctUSGUnidade[u.cod] !== '' ? r2(r.pctUSGUnidade[u.cod] * 100) : ''}" placeholder="${(() => { const v = pctUSGEsperado(S.cfg, { regras: { ...r, pctUSGUnidade: {} } }, u.cod); return v === null ? '—' : r2(v * 100); })()}"></label>`).join('')}</div>
    <label class="campo">Exceções de valor no IMG <span class="small">uma por linha: EXAME=valor (exames: ${Object.keys(EXAMES_IMG).join(', ')}). Ex.: MAMO=18</span><textarea name="excecoes" rows="2">${esc((r.excecoesIMG || []).map(e => `${e.exame}=${e.valor}`).join('\n'))}</textarea></label>
    <label class="campo">Observação<input type="text" name="obs" value="${esc(r.obs || '')}"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Salvar regras']]);
  if (d.botao !== 'ok') return;
  const c = d.campos, exc = [], erros = [];
  for (const linha of String(c.excecoes || '').split('\n').map(s => s.trim()).filter(Boolean)) {
    const m = linha.toUpperCase().match(/^([A-Z]+)\s*=\s*([\d.,]+)$/);
    if (!m || !EXAMES_IMG[m[1]]) erros.push(linha); else exc.push({ exame: m[1], valor: numBR(m[2].includes(',') ? m[2] : m[2].replace('.', ',')) });
  }
  if (erros.length) return avisar(`Exceção não entendida: ${erros.join('; ')}. Use EXAME=valor, ex.: MAMO=18.`, 'err');
  const pct = {}; for (const u of unUSG) { const v = c['pct_' + u.cod]; if (v !== '' && v !== undefined) pct[u.cod] = +v / 100; }
  p.regras = { ...r, tipo: c.tipo, faixaUSG: c.faixaUSG, board: +c.board || 0, classeFixa: c.classeFixa, tabelaIMG: c.tabelaIMG, participaIMG: !!c.participaIMG, v3: !!c.v3, pctUSGUnidade: pct, excecoesIMG: exc, obs: c.obs.trim(), alteradoPor: op, alteradoEm: agoraISO() };
  salvarCfg(`Regras de repasse de ${p.cod} - ${p.nomeMV} atualizadas.`, 'prestadores'); RENDER.bases();
}

async function importarPlanilhaControle(f) {
  const op = await exigirOperador(); if (!op) return;
  let lida;
  try {
    const bytes = await lerArquivo(f), zip = await JSZip.loadAsync(bytes), abas = [];
    for (const a of await abasXlsx(zip)) abas.push({ nome: a.nome, rows: await lerXlsx(bytes, { aba: a.nome }) });
    lida = interpretarPlanilhaControle(abas);
  } catch (e) { return avisar(`Planilha não lida: ${e.message}`, 'err'); }
  if (!lida.prestadores.length) return avisar(lida.avisos.join(' '), 'warn');
  const porFaixa = [...contar(lida.prestadores.filter(x => x.faixaUSG), x => x.faixaUSG)].map(([k, n]) => `${nomeFaixa(k) || k}: ${n}`);
  const r = await dialogo('Importar regras da planilha de controle', `<p class="small muted">${esc(f.name)}</p><ul class="small">
    <li>${lida.prestadores.length} prestadores (${lida.prestadores.filter(x => !S.cfg.prestadores.some(p => String(p.cod) === x.cod)).length} novos no cadastro)</li>
    <li>USG por faixa — ${esc(porFaixa.join(' · ') || 'nenhum')}</li><li>BOARD: ${lida.prestadores.filter(x => x.board).length} · IMG: ${lida.prestadores.filter(x => x.participaIMG).length} (classe fixa: ${lida.prestadores.filter(x => x.classeFixa).length}, V3: ${lida.prestadores.filter(x => x.v3).length})</li>
    <li>CNPJs lidos: ${Object.keys(lida.cnpj).length} (só preenchem unidades sem CNPJ)</li></ul>
    <p class="small muted">Faixa, BOARD, IMG, classe fixa e V3 da planilha substituem os do cadastro; exceções e % diferenciado por unidade são mantidos.</p>`, [['', 'Cancelar', 'sec'], ['ok', 'Importar']]);
  if (r.botao !== 'ok') return;
  const x = aplicarPlanilhaControle(S.cfg, lida, `planilha de controle ${f.name}`);
  salvarCfg(`Regras de ${x.atualizados} prestador(es) importadas da planilha de controle (${x.novos} novos).`, 'prestadores'); RENDER.bases();
}

/* ---------- Médicos V3 (Curitiba) — SOL-F30 ----------
 * Um espaço só para os médicos da V3, com a regra de cada um. Não usam classe A/B/C/D nem as faixas
 * de USG do SRA. Doppler é sempre parte do grupo de USG. */
function cardMedicosV3() {
  const v3 = S.cfg.prestadores.map((p, i) => [p, i]).filter(([p]) => p.regras?.v3);
  return `<div class="card" data-sub="prestadores" id="cardV3"><h2>Médicos V3 (Curitiba) <span class="muted small">${v3.length} médico(s)</span></h2>
    <p class="lead">Na V3 o repasse é calculado fora do MV. O Fechamento → Repasse Curitiba (V3) calcula o valor da NF pela regra de cada médico e gera o texto do e-mail. Doppler conta como USG. HM: só USG/Doppler do convênio Unimed é pago (mesmo sem laudo); os demais ficam sinalizados para exclusão.</p>
    <div class="tw"><table><thead><tr><th>Cód.</th><th>Médico V3</th><th>Regra</th><th></th></tr></thead><tbody>
    ${v3.map(([p, i]) => `<tr><td>${esc(p.cod)}</td><td>${esc(p.nomeMV)}</td><td class="small">${p.regras.v3regra ? esc(resumoRegraV3(p.regras.v3regra)) : '<span class="badge warn">sem regra cadastrada</span>'}</td>
      <td style="white-space:nowrap"><button class="sec mini" data-v3regra="${i}">Regras…</button> <button class="perigo mini" data-v3rm="${i}" aria-label="Tirar da V3" title="Tirar da V3">✕</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nenhum médico da V3. Use «+ Médico V3» ou importe a planilha de controle (bloco «MÉDICOS V3»).</td></tr>'}</tbody></table></div>
    <div class="acoes"><button class="sec" id="v3Add">+ Médico V3</button></div></div>`;
}
function ligarMedicosV3(pg) {
  pg.querySelectorAll('[data-v3regra]').forEach(b => b.onclick = () => editarRegraV3(S.cfg.prestadores[+b.dataset.v3regra]));
  pg.querySelectorAll('[data-v3rm]').forEach(b => b.onclick = async () => {
    const p = S.cfg.prestadores[+b.dataset.v3rm];
    if (!await confirmar(`Tirar ${esc(p.nomeMV)} da V3?`, 'O médico sai do Fechamento de Curitiba. A regra cadastrada fica guardada, caso volte.', 'Tirar da V3')) return;
    p.regras = { ...regrasPrestadorVazias(), ...(p.regras || {}), v3: false };
    salvarCfg(`${p.cod} - ${p.nomeMV} deixou de ser médico V3.`, 'prestadores'); RENDER.bases();
  });
  if ($('v3Add')) $('v3Add').onclick = async () => {
    const r = await dialogo('Incluir médico V3', campoBusca({ nome: 'prestador', rotulo: 'Prestador (busca no cadastro)', fonte: 'prestador', preencheCod: 'cod', obrigatorio: true }) + '<input type="hidden" name="cod">', [['', 'Cancelar', 'sec'], ['ok', 'Incluir e cadastrar a regra']]);
    if (r.botao !== 'ok') return;
    const cod = (r.campos.cod || r.campos.prestadorCod || '').trim(), p = S.cfg.prestadores.find(x => String(x.cod) === cod);
    if (!p) return avisar('Escolha um prestador do cadastro (com código). Se ele não estiver lá, inclua em «+ Prestador manual».', 'warn');
    p.regras = { ...regrasPrestadorVazias(), ...(p.regras || {}), v3: true };
    salvarCfg(`${p.cod} - ${p.nomeMV} marcado como médico V3.`, 'prestadores');
    await editarRegraV3(p); RENDER.bases();
  };
}
async function editarRegraV3(p) {
  const op = await exigirOperador(); if (!op) return;
  const atual = p.regras?.v3regra, g = JSON.parse(JSON.stringify(atual || regraV3Padrao()));
  const outrosV3 = S.cfg.prestadores.filter(x => x !== p && x.regras?.v3 && x.regras.v3regra);
  const faixas = [...g.usg.faixas || []]; while (faixas.length < 5) faixas.push({ de: '', pct: '' });
  const outros = [...g.outros || []]; while (outros.length < 4) outros.push({ nome: '', padrao: '', forma: 'pct-bruto', pct: '', valor: '' });
  const d = await dialogo(`Regras da V3 — ${p.cod} - ${p.nomeMV}`, `<span class="dlg-largo" hidden></span>
    ${outrosV3.length ? `<label class="campo">Copiar a regra de<select name="copiar"><option value="">— não, usar os campos abaixo —</option>${opcoes(outrosV3.map(x => [String(x.cod), `${x.cod} - ${x.nomeMV}`]), '')}</select></label>` : ''}
    ${atual ? '' : '<p class="small muted">Sem regra cadastrada: os campos vêm com a regra do Dr. Ian como ponto de partida. Ajuste e salve.</p>'}
    <div class="grid4"><label class="campo">Impostos sobre o faturamento (%)<input type="number" step="0.01" min="0" name="impostos" value="${g.impostos}"><span class="small muted">líquido = bruto − impostos</span></label>
      <label class="campo">USG (inclui Doppler)<select name="usgForma">${opcoes(Object.entries(FORMAS_V3), g.usg.forma)}</select></label>
      <label class="campo">% da USG<input type="number" step="0.01" min="0" name="usgPct" value="${g.usg.pct || ''}"><span class="small muted">para «% do líquido» ou «% do bruto»</span></label>
      <label class="campo">Valor por laudo de USG (R$)<input type="number" step="0.01" min="0" name="usgValor" value="${g.usg.valor || ''}"></label></div>
    <h4 style="margin:8px 0 4px">Faixas de volume <span class="muted small">(para «% do líquido por faixa»; volume = quantidade de exames de USG e Doppler no mês)</span></h4>
    <div class="grid4">${faixas.slice(0, 5).map((f, k) => `<label class="campo">A partir de (exames)<input type="number" step="1" min="0" name="fxDe${k}" value="${f.de === '' ? '' : f.de}"></label><label class="campo">% do líquido<input type="number" step="0.01" min="0" name="fxPct${k}" value="${f.pct === '' ? '' : f.pct}"></label>`).join('')}</div>
    <label class="campo">HM de USG/Doppler Unimed<select name="hm">${opcoes(Object.entries(FORMAS_HM_V3), g.hm)}</select><span class="small muted">Os outros HM (raio-X, mamografia, outros convênios) nunca são pagos na V3 e ficam sinalizados para exclusão.</span></label>
    <h4 style="margin:8px 0 4px">Outros exames <span class="muted small">(texto que aparece no grupo ou na descrição do MV, ex.: DENSITOM)</span></h4>
    <div class="tw"><table><thead><tr><th>Exame</th><th>Texto de busca</th><th>Como paga</th><th>%</th><th>R$ por laudo</th></tr></thead><tbody>${outros.slice(0, 4).map((o, k) => `<tr>
      <td><input type="text" name="oNome${k}" value="${esc(o.nome)}"></td><td><input type="text" name="oPad${k}" value="${esc(o.padrao)}" style="width:110px"></td>
      <td><select name="oForma${k}">${opcoes(FORMAS_OUTROS_V3.map(f => [f, FORMAS_V3[f]]), o.forma)}</select></td>
      <td><input type="number" step="0.01" min="0" name="oPct${k}" value="${o.pct || ''}" style="width:70px"></td><td><input type="number" step="0.01" min="0" name="oVal${k}" value="${o.valor || ''}" style="width:90px"></td></tr>`).join('')}</tbody></table></div>
    <p class="small muted">Exames da V3 que não forem USG/Doppler nem estiverem aqui ficam fora do cálculo, com aviso no Fechamento.</p>`,
    [['', 'Cancelar', 'sec'], ...(atual ? [['limpar', 'Apagar regra', 'perigo']] : []), ['ok', 'Salvar regra']]);
  if (d.botao === 'limpar') {
    p.regras = { ...p.regras, v3regra: null, alteradoPor: op, alteradoEm: agoraISO() };
    salvarCfg(`Regra da V3 de ${p.cod} - ${p.nomeMV} apagada.`, 'prestadores'); RENDER.bases(); return;
  }
  if (d.botao !== 'ok') return;
  const c = d.campos;
  let regra;
  if (c.copiar) regra = JSON.parse(JSON.stringify(S.cfg.prestadores.find(x => String(x.cod) === c.copiar).regras.v3regra));
  else {
    const num = v => v === '' || v === undefined ? '' : +v;
    regra = {
      impostos: +c.impostos || 0,
      usg: { forma: c.usgForma, pct: +c.usgPct || 0, valor: +c.usgValor || 0,
        faixas: [0, 1, 2, 3, 4].map(k => ({ de: num(c['fxDe' + k]), pct: num(c['fxPct' + k]) })).filter(f => f.pct !== '').map(f => ({ de: +f.de || 0, pct: +f.pct })).sort((a, b) => a.de - b.de) },
      hm: c.hm,
      outros: [0, 1, 2, 3].map(k => ({ nome: (c['oNome' + k] || '').trim(), padrao: String(c['oPad' + k] || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim(), forma: c['oForma' + k], pct: +c['oPct' + k] || 0, valor: +c['oVal' + k] || 0 })).filter(o => o.nome || o.padrao)
    };
  }
  const erros = validarRegraV3(regra);
  if (erros.length) return avisar('Regra não gravada: ' + erros.join('; ') + '.', 'err');
  p.regras = { ...regrasPrestadorVazias(), ...(p.regras || {}), v3: true, v3regra: regra, alteradoPor: op, alteradoEm: agoraISO() };
  salvarCfg(`Regra da V3 de ${p.cod} - ${p.nomeMV} ${atual ? 'atualizada' : 'cadastrada'}: ${resumoRegraV3(regra)}.`, 'prestadores'); RENDER.bases();
}
