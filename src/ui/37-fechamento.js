/* ============================================================
 * Fechamento do repasse da competência: USG, IMG, produção e classe, indicadores e exportação
 * ============================================================ */
const FH = { sub: 'usg' };
const chipSitFech = k => `<span class="fs fs-${k}">${esc(SITUACAO_FECH[k].nome)}</span>`;
function fechDaCompetencia(chave = S.comp) {
  const c = estadoCompetencia(S.compReg, chave);
  return { ...fechamentoVazio(), ...(c.fechamento || {}) };
}
function salvarFech(mutar) {
  if (!exigirAberta(S.comp, 'alterar o fechamento')) return false;
  const c = itemCompetencia(S.compReg, S.comp);
  c.fechamento = { ...fechamentoVazio(), ...(c.fechamento || {}) };
  mutar(c.fechamento); salvarCompReg();
  return true;
}
function marcosFech(chave) {
  const comp = S.fluxo.competencias[chave], [a, m] = chave.split('-').map(Number);
  return (comp ? marcosDaCompetencia(comp) : calcularMarcos(S.fluxo.modelo, a, m, S.fluxo.modelo.calendario, {})).datas;
}
function fechamentoAtual() {
  const base = { rodadas: S.rodadas, cfg: S.cfg };
  const ant = competenciaVizinha(S.comp, -1);
  const anterior = montarFechamento({ ...base, chave: ant, fech: fechDaCompetencia(ant), fluxoComp: S.fluxo.competencias[ant] });
  return montarFechamento({ ...base, chave: S.comp, decisoes: indiceDecisoesComp(), fluxoComp: S.fluxo.competencias[S.comp], fech: fechDaCompetencia(), anterior });
}

RENDER.fechamento = async () => {
  S.rodadas = await dbTodas();
  const f = fechamentoAtual(), mk = marcosFech(S.comp), fechada = compFechada();
  const lista = FH.sub === 'img' ? f.img : f.usg;
  const cont = k => lista.filter(x => x.situacao === k).length;
  $('pag-fechamento').innerHTML = `<div class="fx-topo"><h2 class="fx-titulo">Fechamento da competência ${rotuloCompetencia(S.comp)}</h2>
    <div class="acoes" style="margin:0"><button class="sec" id="fhInd">Exportar indicadores</button><button id="fhExp">Exportar competência (3 abas)</button></div></div>
    ${f.previa ? `<div class="aviso-fixo warn"><b>PRÉVIA</b> — ${f.semAceite ? `${f.semAceite} prestador(es) com rodada sem aceite` : 'nenhuma rodada de conferência nesta competência'}. A planilha sai marcada como prévia até todos terem aceite.</div>` : '<div class="aviso-fixo ok">Todos os prestadores com valores têm aceite: a exportação sai como versão final.</div>'}
    <div class="subabas" role="tablist">${[['usg', `Repasse USG <em>pagto ${fmtCurta(mk.pagUSG)}</em>`], ['img', `Repasse IMG <em>pagto ${fmtCurta(mk.pagIMG)}</em>`], ['producao', 'Produção USG e classe'], ['indicadores', 'Indicadores']].map(([k, t]) => `<button role="tab" class="${FH.sub === k ? 'on' : ''}" aria-selected="${FH.sub === k}" data-fsub="${k}">${t}</button>`).join('')}</div>
    ${['usg', 'img'].includes(FH.sub) ? `<div class="nc-kpis">${Object.keys(SITUACAO_FECH).map(k => `<div class="nc-kpi"><b>${cont(k)}</b><small>${chipSitFech(k)}</small></div>`).join('')}</div>` : ''}
    <div id="fhCorpo"></div>`;
  $('pag-fechamento').querySelectorAll('[data-fsub]').forEach(b => b.onclick = () => { FH.sub = b.dataset.fsub; RENDER.fechamento(); });
  $('fhExp').onclick = () => exportarFechamento(f, mk);
  $('fhInd').onclick = () => baixarZip(xlsxIndicadoresFechamento(f, indicadoresFechamento(f, S.cfg, S.nc.itens.filter(x => x.competencia === S.comp)), { operador: S.operador }), `Indicadores_fechamento_${S.comp.slice(5)}-${S.comp.slice(0, 4)}_${carimbo()}.xlsx`);
  const corpo = $('fhCorpo');
  if (FH.sub === 'usg') desenharUSG(corpo, f, mk); else if (FH.sub === 'img') desenharIMG(corpo, f, mk); else if (FH.sub === 'producao') desenharProducao(corpo, f); else desenharIndicadoresFech(corpo, f);
  if (fechada) corpo.querySelectorAll('input, textarea, [data-fhadd], [data-fhrm]').forEach(x => { x.disabled = true; });
};

const celValor = v => v === undefined ? '' : fmtBR(v);
const inputAjuste = (tipo, x, campo, largura = 80) => `<input type="${campo === 'obs' ? 'text' : 'number'}" step="0.01" data-aj="${tipo}|${x.cod}|${campo}" value="${esc(campo === 'obs' ? x.obs : (x[campo] || ''))}" style="width:${largura}px" aria-label="${campo}">`;
const avisosHtml = x => x.avisos.length ? `<span class="fh-aviso" title="${esc(x.avisos.join('\n'))}">${esc(x.avisos.join(' · '))}</span>` : '';

function desenharUSG(corpo, f, mk) {
  const un = S.cfg.unidades.filter(u => u.pctUSG);
  const faixas = [...new Set(f.usg.map(x => x.p?.regras?.faixaUSG || ''))];
  corpo.innerHTML = `<div class="tw fh-tab"><table><thead><tr><th>Cód.</th><th class="fh-nome">Prestador</th><th>Situação</th>${un.map(u => `<th class="n fh-un" title="${esc(u.nome)}">${esc(u.cod)}<small>${esc(u.nome)}</small></th>`).join('')}<th class="n">BOARD</th><th class="n">PLANTÃO</th><th class="n">TOTAL</th><th class="n">DESCONTOS</th><th>Obs. do desconto</th><th class="n">TOTAL GERAL</th><th>Avisos</th><th></th></tr></thead><tbody>
    <tr class="fh-cnpj"><td></td><td>CNPJ para a NF</td><td></td>${un.map(u => `<td>${esc(u.cnpj || '')}</td>`).join('')}<td>${esc(S.cfg.fechamento.cnpjBoard)}</td><td>${esc(S.cfg.fechamento.cnpjPlantao)}</td><td colspan="6"></td></tr>
    ${faixas.map(fx => { const fa = S.cfg.faixasUSG.find(y => y.id === fx), l = f.usg.filter(x => (x.p?.regras?.faixaUSG || '') === fx);
      return `<tr class="fh-faixa"><td colspan="${un.length + 11}">${esc(fa?.nome || 'Sem faixa cadastrada (Bases → Prestadores e regras)')}${fa ? ' — ' + un.map(u => { const p = pctUSGEsperado(S.cfg, { regras: { faixaUSG: fx, pctUSGUnidade: {} } }, u.cod); return p === null ? '—' : r2(p * 100) + '%'; }).join(' · ') : ''}</td></tr>` +
        l.map(x => `<tr><td>${esc(x.cod)}</td><td class="fh-nome">${esc(x.nome)}</td><td>${chipSitFech(x.situacao)}</td>${un.map(u => `<td class="n">${celValor(x.unidades[u.cod])}</td>`).join('')}
          <td class="n">${x.board ? fmtBR(x.board) : ''}</td><td class="n">${inputAjuste('usg', x, 'plantao')}</td><td class="n">${fmtBR(x.total)}</td><td class="n">${inputAjuste('usg', x, 'descontos')}</td><td>${inputAjuste('usg', x, 'obs', 160)}</td>
          <td class="n"><b>${fmtBR(x.totalGeral)}</b></td><td>${avisosHtml(x)}</td><td>${x.temValores ? `<button class="sec mini" data-copiar="usg|${esc(x.cod)}">Copiar prévia</button>` : ''}</td></tr>`).join(''); }).join('')}
    <tr class="fh-total"><td></td><td>TOTAL USG</td><td></td>${un.map(u => `<td class="n">${fmtBR(f.usg.reduce((s, x) => s + (x.unidades[u.cod] || 0), 0))}</td>`).join('')}<td class="n">${fmtBR(f.usg.reduce((s, x) => s + x.board, 0))}</td><td class="n">${fmtBR(f.usg.reduce((s, x) => s + x.plantao, 0))}</td><td class="n">${fmtBR(f.usg.reduce((s, x) => s + x.total, 0))}</td><td class="n">${fmtBR(f.usg.reduce((s, x) => s + x.descontos, 0))}</td><td></td><td class="n"><b>${fmtBR(f.usg.reduce((s, x) => s + x.totalGeral, 0))}</b></td><td colspan="2"></td></tr>
    </tbody></table></div>${f.usg.length ? '' : '<p class="muted">Nenhum prestador de USG: cadastre as faixas em Bases → Prestadores e regras (ou importe a planilha de controle) e rode as conferências dos relatórios de USG.</p>'}
    <label class="campo">Observações da planilha de USG<textarea id="fhObsUSG" rows="2">${esc(f.fech.obs.usg || '')}</textarea></label>
    <p class="small muted">Valores por unidade = Vl Repasse do relatório da última rodada de conferência com aceite (sem aceite: última rodada, como prévia). BOARD vem do cadastro do prestador; PLANTÃO, DESCONTOS e observações são deste mês. Pagamento ${fmtData(mk.pagUSG)}.</p>`;
  ligarFech(corpo, f, mk);
}
function desenharIMG(corpo, f, mk) {
  const un = S.cfg.unidades.filter(u => u.cnpj && (u.pctUSG || u.cod === '5' || f.img.some(x => x.unidades[u.cod] !== undefined)));
  const linha = x => `<tr><td class="n">${x.classeFixa ? '<span class="small">fixo</span>' : x.producaoUSG ? fmtBR(x.producaoUSG) : '<span class="small muted">sem prod. USG</span>'}</td><td><b>${esc(x.classe)}</b></td><td>${esc(x.cod)}</td><td class="fh-nome">${esc(x.nome)}</td><td>${chipSitFech(x.situacao)}</td>
    ${un.map(u => `<td class="n">${celValor(x.unidades[u.cod])}</td>`).join('')}<td class="n">${inputAjuste('img', x, 'plantao')}</td><td class="n">${fmtBR(x.total)}</td><td class="n">${inputAjuste('img', x, 'descontos')}</td><td>${inputAjuste('img', x, 'obs', 160)}</td>
    <td class="n"><b>${fmtBR(x.totalGeral)}</b></td><td>${avisosHtml(x)}</td><td>${x.temValores ? `<button class="sec mini" data-copiar="img|${esc(x.cod)}">Copiar prévia</button>` : ''}</td></tr>`;
  const cab = `<thead><tr><th class="n">Produção USG</th><th>Classe</th><th>Cód.</th><th class="fh-nome">Prestador</th><th>Situação</th>${un.map(u => `<th class="n fh-un" title="${esc(u.nome)}">${esc(u.cod)}<small>${esc(u.nome)}</small></th>`).join('')}<th class="n">PLANTÃO</th><th class="n">TOTAL</th><th class="n">DESCONTOS</th><th>Obs. do desconto</th><th class="n">TOTAL GERAL</th><th>Avisos</th><th></th></tr></thead>`;
  const v3 = f.img.filter(x => x.p?.regras?.v3), principais = f.img.filter(x => !x.p?.regras?.v3);
  const bloco = (k, titulo, campos) => `<div class="card"><h3>${titulo}</h3><div class="tw"><table><thead><tr><th>Cód.</th><th class="fh-nome">Prestador</th>${campos.map(([, t]) => `<th>${t}</th>`).join('')}<th></th></tr></thead><tbody>${(f.fech.blocos[k] || []).map((b, i) => `<tr><td><input type="text" data-bl="${k}|${i}|cod" value="${esc(b.cod)}" style="width:70px"></td><td><input type="text" data-bl="${k}|${i}|nome" value="${esc(b.nome)}"></td>${campos.map(([c]) => `<td><input type="number" step="0.01" data-bl="${k}|${i}|${c}" value="${esc(b[c] ?? '')}" style="width:100px"></td>`).join('')}<td><button class="perigo mini" data-fhrm="${k}|${i}" aria-label="Remover">✕</button></td></tr>`).join('') || `<tr><td colspan="${campos.length + 3}" class="muted">Nenhum lançamento.</td></tr>`}</tbody></table></div><div class="acoes"><button class="sec mini" data-fhadd="${k}">+ Linha</button></div></div>`;
  corpo.innerHTML = `<div class="tw fh-tab"><table>${cab}<tbody><tr class="fh-cnpj"><td colspan="5">CNPJ para a NF</td>${un.map(u => `<td>${esc(u.cnpj)}</td>`).join('')}<td>${esc(S.cfg.fechamento.cnpjPlantao)}</td><td colspan="6"></td></tr>${principais.map(linha).join('')}</tbody></table></div>
    ${v3.length ? `<h3 class="fh-sub">Médicos V3 que recebem pela SRA (laudos)</h3><div class="tw fh-tab"><table>${cab}<tbody>${v3.map(linha).join('')}</tbody></table></div>` : ''}
    ${f.img.length ? '' : '<p class="muted">Nenhum prestador de IMG: marque «Recebe repasse de IMG» em Bases → Prestadores e regras (ou importe a planilha de controle).</p>'}
    <div class="grid2">${bloco('complementar', `NF complementar — laudos PET-CT e Pluvicto (17- ${esc(unidadePorCod(S.cfg, '17')?.nome || '')})`, [['petct', 'Laudos PET-CT (R$)'], ['pluvicto', 'Aplicação Pluvicto (R$)']])}
      ${bloco('cetrus', `NF complementar — Curso Cetrus (R$ ${fmtBR(f.fech.valorPeriodoCetrus)} por período)`, [['periodos', 'Períodos']])}</div>
    <label class="campo">Observações da planilha de IMG<textarea id="fhObsIMG" rows="2">${esc(f.fech.obs.img || '')}</textarea></label>
    <p class="small muted">Classe pela produção bruta de USG do prestador nesta competência (ou fixa no cadastro). Os avisos conferem o valor de cada laudo do relatório contra a tabela da classe; nada é recalculado. Pagamento ${fmtData(mk.pagIMG)}.</p>`;
  ligarFech(corpo, f, mk);
}
function desenharProducao(corpo, f) {
  const un = S.cfg.unidades.filter(u => u.pctUSG);
  const lista = [...new Map([...f.img, ...f.usg].map(x => [x.cod, x])).values()].filter(x => f.img.some(y => y.cod === x.cod) || x.producaoUSG);
  corpo.innerHTML = `<div class="card"><p class="lead">Produção bruta de USG (Vl Total dos relatórios de USG, todas as unidades) e a classe resultante. Cortes em Bases → Classes e valores IMG: A acima de ${fmtBR(S.cfg.classes.cortes[0].acima)}, B acima de ${fmtBR(S.cfg.classes.cortes[1].acima)}, C acima de ${fmtBR(S.cfg.classes.cortes[2].acima)}; D até o último corte ou sem produção.</p>
    <div class="tw fh-tab"><table><thead><tr><th>Classe</th><th>Cód.</th><th class="fh-nome">Prestador</th>${un.map(u => `<th class="n">Unidade ${esc(u.cod)} · ${r2(u.pctUSG.medico * 100)}%</th>`).join('')}<th class="n">Total</th><th></th></tr></thead><tbody>
    ${lista.sort((a, b) => a.nome.localeCompare(b.nome)).map(x => { const prod = f.usg.find(y => y.cod === x.cod)?.producao || {}, im = f.img.find(y => y.cod === x.cod) || x;
      return `<tr><td><b>${esc(im.classe)}</b></td><td>${esc(x.cod)}</td><td class="fh-nome">${esc(x.nome)}</td>${un.map(u => `<td class="n">${celValor(prod[u.cod])}</td>`).join('')}<td class="n"><b>${fmtBR(im.producaoUSG)}</b></td><td class="small">${im.classeFixa ? `fixo classe ${esc(im.classe)}` : !im.producaoUSG ? 'sem produção de USG / classe D' : ''}</td></tr>`; }).join('') || `<tr><td colspan="${un.length + 5}" class="muted">Sem produção de USG nesta competência.</td></tr>`}</tbody></table></div></div>`;
}
function desenharIndicadoresFech(corpo, f) {
  const ind = indicadoresFechamento(f, S.cfg, S.nc.itens.filter(x => x.competencia === S.comp));
  const tab = (titulo, pares, fmt = v => 'R$ ' + fmtBR(v)) => `<div class="card"><h3>${titulo}</h3>${pares.length ? `<table class="fh-ind">${pares.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${fmt(v)}</td></tr>`).join('')}</table>` : '<p class="muted small">—</p>'}</div>`;
  corpo.innerHTML = `<div class="nc-kpis"><div class="nc-kpi"><b>R$ ${fmtBR(ind.totais.usg)}</b><small>total USG</small></div><div class="nc-kpi"><b>R$ ${fmtBR(ind.totais.img)}</b><small>total IMG</small></div>
    <div class="nc-kpi warn"><b>${ind.variacoes.length}</b><small>variações acima de ${S.cfg.fechamento.variacaoAlerta}%</small></div><div class="nc-kpi err"><b>${ind.ncs.impactam}</b><small>NCs que impactam o pagamento</small></div><div class="nc-kpi"><b>${ind.decisoes}</b><small>linhas com decisão</small></div></div>
    <div class="grid3">${tab('USG por unidade', ind.usgPorUnidade)}${tab('USG por faixa', ind.usgPorFaixa)}${tab('Prestadores por situação', ind.porSituacao, v => v)}
      ${tab('IMG por unidade', ind.imgPorUnidade)}${tab('IMG por classe', ind.imgPorClasse)}${tab('Variação × competência anterior', ind.variacoes, v => (v > 0 ? '+' : '') + fmtBR(v) + '%')}</div>`;
}

function ligarFech(corpo, f, mk) {
  corpo.querySelectorAll('[data-aj]').forEach(inp => inp.onchange = () => {
    const [tipo, cod, campo] = inp.dataset.aj.split('|');
    if (salvarFech(fe => { fe.ajustes[tipo] = fe.ajustes[tipo] || {}; const a = fe.ajustes[tipo][cod] = fe.ajustes[tipo][cod] || {}; a[campo] = campo === 'obs' ? inp.value.trim() : (inp.value === '' ? 0 : +inp.value); })) RENDER.fechamento();
  });
  corpo.querySelectorAll('[data-copiar]').forEach(b => b.onclick = () => {
    const [tipo, cod] = b.dataset.copiar.split('|'), x = f[tipo].find(y => y.cod === cod);
    copiarTexto(textoPreviaPrestador(x, S.cfg, S.comp, tipo === 'usg' ? mk.pagUSG : mk.pagIMG), `Prévia de ${x.nome}`);
  });
  corpo.querySelectorAll('[data-bl]').forEach(inp => inp.onchange = () => {
    const [k, i, c] = inp.dataset.bl.split('|');
    salvarFech(fe => { fe.blocos[k][+i][c] = ['cod', 'nome'].includes(c) ? inp.value.trim() : +inp.value || 0; });
  });
  corpo.querySelectorAll('[data-fhadd]').forEach(b => b.onclick = () => { if (salvarFech(fe => { fe.blocos[b.dataset.fhadd] = [...(fe.blocos[b.dataset.fhadd] || []), { cod: '', nome: '' }]; })) RENDER.fechamento(); });
  corpo.querySelectorAll('[data-fhrm]').forEach(b => b.onclick = () => { const [k, i] = b.dataset.fhrm.split('|'); if (salvarFech(fe => { fe.blocos[k].splice(+i, 1); })) RENDER.fechamento(); });
  for (const [id, k] of [['fhObsUSG', 'usg'], ['fhObsIMG', 'img']]) if ($(id)) $(id).onchange = e => salvarFech(fe => { fe.obs[k] = e.target.value; });
}
async function copiarTexto(texto, titulo) {
  try { await navigator.clipboard.writeText(texto); avisar(`${titulo} copiada: cole no e-mail.`, 'ok'); }
  catch (e) { await dialogo(titulo, `<p class="small muted">Copie o texto abaixo (Ctrl+C) e cole no e-mail.</p><textarea rows="12" style="width:100%" readonly onfocus="this.select()">${esc(texto)}</textarea>`, [['ok', 'Fechar']]); }
}
async function exportarFechamento(f, mk) {
  const mmaaaa = `${S.comp.slice(5)}-${S.comp.slice(0, 4)}`;
  await baixarZip(xlsxFechamento(f, S.cfg, { pagUSG: mk.pagUSG, pagIMG: mk.pagIMG }), `REPASSE_${mmaaaa}_CONTROLE${f.previa ? '_PREVIA' : ''}_${carimbo()}.xlsx`);
  // Evidência nas etapas de envio do Fluxo mensal (não conclui nada sozinha).
  const comp = S.fluxo.competencias[S.comp];
  if (comp && !compFechada()) {
    for (const g of ['usg', 'img']) { const t = comp.grupos[g]?.tarefas?.envio; if (t) (t.evidencias = t.evidencias || []).push({ em: agoraISO(), por: S.operador, desc: `planilha de fechamento ${f.previa ? '(prévia) ' : ''}gerada` }); }
    salvarFluxo();
  }
  avisar(`Planilha ${f.previa ? 'PRÉVIA ' : ''}da competência ${rotuloCompetencia(S.comp)} gerada${comp ? '; registrada como evidência no Fluxo mensal (etapas de envio)' : ''}.`, 'ok');
}
