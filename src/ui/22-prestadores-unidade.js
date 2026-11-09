/* ============================================================
 * Conferência → «Prestadores por unidade» (SOL-F35)
 * Quem laudou na planilha de laudos × quem já tem relatório, conferência e aceite, por unidade e grupo.
 * ============================================================ */
const CU = { sub: 'conferir', unidade: '', grupo: '', soFalta: true };
const CHAVE_CONTROLE_UN = 'rm2.controleUnidades', fmtN = n => (+n || 0).toLocaleString('pt-BR');
const marcasControle = () => { const t = lerLocal(CHAVE_CONTROLE_UN) || {}; return t[S.comp] || (t[S.comp] = { gerado: {}, dispensado: {} }); };
function gravarMarcasControle(m) { const t = lerLocal(CHAVE_CONTROLE_UN) || {}; t[S.comp] = m; if (!gravarLocal(CHAVE_CONTROLE_UN, t)) avisar('Não foi possível gravar a marca neste navegador.', 'err'); }
// PDFs da sessão (para «relatório sem conferência»).
const sessaoControle = () => S.relatorios.filter(x => (x.finalidade || finalidadePadrao(x.rel)) !== 'correcao')
  .map(x => ({ prestadorCod: x.rel.cab.prestadorCod, tipo: tipoRepasseDaRodada({ descricao: x.rel.cab.descricao, repasse: x.rel.cab.repasse, linhas: x.rel.regs.map(r => ({ grupo: r.grupoNome })) }) }));
const controleAtual = () => S.apolo ? controlePrestadoresUnidade({ laudos: S.apolo.laudos, cfg: S.cfg, rodadas: S.rodadas, chave: S.comp, sessao: sessaoControle(), marcas: marcasControle(), naoSRA: S.cfg.medicosNaoSRA || [] }) : null;

const abasConferencia = () => `<div class="subabas" role="tablist" style="margin-bottom:12px">${[['conferir', 'Conferir relatório'], ['unidades', 'Prestadores por unidade']].map(([k, t]) => `<button role="tab" class="${CU.sub === k ? 'on' : ''}" aria-selected="${CU.sub === k}" data-cusub="${k}">${t}</button>`).join('')}</div>`;
const ligarAbasConferencia = raiz => raiz.querySelectorAll('[data-cusub]').forEach(b => b.onclick = () => { CU.sub = b.dataset.cusub; RENDER.conferencia(); });

const _renderConferencia = RENDER.conferencia;
RENDER.conferencia = () => {
  if (CU.sub === 'unidades') return desenharControleUnidade();
  _renderConferencia();
  const p = $('pag-conferencia'); p.insertAdjacentHTML('afterbegin', abasConferencia()); ligarAbasConferencia(p);
  if (CU.abrir) { const a = CU.abrir; CU.abrir = null; preSelecionarConferencia(a); }
};
// «Abrir conferência»: escolhe o PDF do prestador (se carregado), a unidade e o médico do prestador.
function preSelecionarConferencia(a) {
  const rel = S.relatorios.find(x => x.id === a.relId) || S.relatorios.find(x => String(x.rel.cab.prestadorCod) === String(a.cod) && (x.finalidade || finalidadePadrao(x.rel)) !== 'correcao');
  if (!rel || !$('cfRel')) return avisar(`O PDF do prestador ${a.cod} não está carregado nesta sessão. Carregue-o no Início para conferir.`, 'warn');
  $('cfRel').value = rel.id; $('cfRel').dispatchEvent(new Event('change'));
  if ($('cfUn')) { $('cfUn').value = a.unidade; $('cfUn').dispatchEvent(new Event('change')); }
  $('cfRel').scrollIntoView({ block: 'center' });
}

async function desenharControleUnidade() {
  const pg = $('pag-conferencia');
  S.rodadas = await dbTodas();
  if (!S.apolo) { pg.innerHTML = abasConferencia() + `<div class="card"><h2>Prestadores por unidade</h2><p class="lead">Carregue a planilha de laudos do Apolo no Início. A lista de quem precisa de repasse sai dela, por unidade.</p><div class="acoes"><button onclick="location.hash='inicio'">Ir para o Início</button></div></div>`; return ligarAbasConferencia(pg); }
  const ctl = controleAtual(), uns = ctl.unidades.filter(u => u.grupos.some(G => G.itens.length));
  const gruposDe = u => u.grupos.map(G => G.grupo);
  if (!uns.some(u => u.cod === CU.unidade)) CU.unidade = uns[0]?.cod || '';
  const u = uns.find(x => x.cod === CU.unidade);
  if (u && !gruposDe(u).includes(CU.grupo)) CU.grupo = gruposDe(u)[0];
  const G = u?.grupos.find(x => x.grupo === CU.grupo);
  const faltaUn = x => x.grupos.reduce((s, g) => s + g.resumo.falta, 0);
  const k = (n, t, cor) => `<div class="cu-k"${cor ? ` style="border-color:var(--${cor})"` : ''}><b${cor ? ` style="color:var(--${cor})"` : ''}>${n}</b>${t}</div>`;
  const r = G?.resumo;
  const itens = G ? G.itens.filter(x => !CU.soFalta || FALTA_CONTROLE.has(x.situacao) || x.situacao === 'sem-laudo') : [];
  const cur = G?.grupo === 'curitiba';
  const regraTxt = rg => !rg ? 'sem regra cadastrada (conta todos)' : rg.modo === 'fixo' ? `valor fixo · ${(rg.grupos || []).map(g => rotuloGrupoV3(g.grupo)).join(', ')}` : 'percentual · todos';
  const acao = x => {
    if (x.situacao === 'gerar') return `<button class="sec mini" data-cuger="${esc(x.k)}">${x.gerado ? '↺ desmarcar gerado' : '✓ gerado no MV'}</button> <button class="sec mini" data-cudisp="${esc(x.k)}">Fora do repasse neste mês…</button>`;
    if (x.situacao === 'sem-cadastro' || x.situacao === 'conflito') return `<button class="sec mini" data-cucad="${esc(x.nome)}" data-n="${x.laudos}">Cadastrar ou vincular…</button>${cur ? ` <button class="sec mini" data-cunsra="${esc(x.nome)}">Não é pago pela SRA</button>` : ''}`;
    if (x.situacao === 'sem-laudo') return `<button class="sec mini" data-cudisp="${esc(x.k)}">Marcar como verificado…</button>`;
    if (x.situacao === 'conferido' || x.situacao === 'sem-conferencia' || x.situacao === 'aceito') return `<button class="mini" data-cuabrir="${esc(x.k)}">Abrir conferência</button>`;
    if ((x.situacao === 'fora' || x.situacao === 'verificado') && x.dispensado) return `<button class="sec mini" data-cuvolta="${esc(x.k)}">Desfazer</button>`;
    return '';
  };
  const sit = x => { const [c, t] = SITUACAO_CONTROLE[x.situacao]; return `<span class="badge ${c}">${t}</span>${x.gerado && x.situacao === 'gerar' ? `<div class="small muted">gerado no MV · ${esc(x.gerado.por)} · ${new Date(x.gerado.em).toLocaleDateString('pt-BR')}</div>` : ''}${x.dispensado ? `<div class="small muted">${esc(x.dispensado.motivo)} · ${esc(x.dispensado.por)}</div>` : ''}${x.situacao === 'conflito' ? `<div class="small muted">nome em dois cadastros: ${x.conflito.map(esc).join(', ')}</div>` : ''}`; };
  pg.innerHTML = abasConferencia() + `<div class="card"><h2>Prestadores por unidade <span class="muted small">planilha de laudos: ${esc(S.apolo.nome)} · competência ${esc(rotuloCompetencia(S.comp))}</span></h2>
    <p class="lead">Quem laudou (planilha de laudos) × quem já tem relatório, conferência e aceite. USG inclui o Doppler. Em Curitiba, um grupo só, com os médicos V3 e só os exames que a regra V3 de cada um cobre. Só médico, unidade e contagens.</p>
    <div class="acoes"><label class="small"><input type="checkbox" id="cuSoFalta"${CU.soFalta ? ' checked' : ''}> só o que falta (e avisos)</label><span style="flex:1"></span>
      <button class="sec" id="cuExp">Exportar lista para gerar no MV (Excel)</button><button class="sec" id="cuImp">Imprimir</button></div>
    <div class="cu-un" role="tablist">${uns.map(x => `<button class="${x.cod === CU.unidade ? 'on' : ''}" data-cuun="${x.cod}" title="${esc(x.nome)}">Unidade ${esc(x.cod)}<span class="q">${faltaUn(x)}</span></button>`).join('')}</div>
    ${ctl.semUnidade.length ? `<p class="small badge warn">Unidade do Apolo sem código no cadastro (Bases → Unidades, campo Apolo): ${ctl.semUnidade.map(x => `${esc(x.nome)} (${x.laudos} laudos)`).join(', ')}</p>` : ''}
    ${u ? `<div class="subabas" role="tablist">${u.grupos.map(g => `<button class="${g.grupo === CU.grupo ? 'on' : ''}" data-cugr="${g.grupo}">${GRUPOS_CONTROLE[g.grupo]} <em>${g.resumo.falta} falta(m)</em></button>`).join('')}</div>
    <h3>Unidade ${esc(u.cod)} - ${esc(u.nome)} · ${GRUPOS_CONTROLE[G.grupo]}</h3>
    <div class="cu-res">${k(r.laudaram, cur ? 'médicos V3 laudaram' : 'laudaram')}${k(r.aceitos, 'aceitos', 'ok')}${k(r.conferidos, 'conferidos sem aceite', 'info')}${r.semConferencia ? k(r.semConferencia, 'relatório sem conferência', 'warn') : ''}${k(r.gerar, 'a gerar no MV', 'err')}${r.semLaudo ? k(r.semLaudo, 'relatório sem laudo', 'warn') : ''}${r.semCadastro ? k(r.semCadastro, 'sem cadastro', 'warn') : ''}${r.fora + r.verificados ? k(r.fora + r.verificados, 'fora do repasse / verificados') : ''}</div>
    <div class="tw"><table class="cu-tab"><thead><tr><th>Cód.</th><th>Prestador</th>${cur ? '<th>Regra V3</th>' : ''}<th class="num">${cur ? 'Laudos que a SRA paga' : 'Laudos no Apolo'}</th>${cur ? '<th class="num">Fora da regra</th>' : ''}<th class="num">Linhas no MV</th><th>Situação</th><th></th></tr></thead><tbody>
    ${itens.map(x => `<tr class="${FALTA_CONTROLE.has(x.situacao) ? 'cu-falta' : ''}"><td>${esc(x.cod || '—')}</td><td>${esc(x.nome)}${x.cod ? '' : ' <span class="muted small">(Apolo)</span>'}</td>${cur ? `<td class="small">${esc(regraTxt(x.regraV3))}</td>` : ''}<td class="num">${fmtN(x.laudos)}</td>${cur ? `<td class="num">${x.foraRegra.length ? `${fmtN(x.foraRegra.reduce((s, f) => s + f.q, 0))}<div class="small muted">${x.foraRegra.map(f => esc(`${f.n}: ${f.q}`)).join(' · ')} (fora da regra)</div>` : '—'}</td>` : ''}<td class="num">${x.rodadaId ? fmtN(x.linhasMV) : '—'}</td><td>${sit(x)}</td><td>${acao(x)}</td></tr>`).join('') || `<tr><td colspan="8" class="muted">Nada faltando neste grupo.${CU.soFalta ? ' Desmarque «só o que falta» para ver todos.' : ''}</td></tr>`}
    </tbody></table></div>
    <p class="small muted">«Linhas no MV» vem da última rodada de conferência e serve só de referência rápida; a conferência diz o que bate. «Relatório sem laudo» é aviso, não NC.</p>
    ${cur && u.outros.length ? `<details class="cu-outros"><summary>Outros médicos na unidade ${esc(u.cod)} — não pagos pela SRA (${u.outros.length} médico(s) · ${fmtN(u.outros.reduce((s, o) => s + o.laudos, 0))} laudos) · só consulta</summary>
      <ul class="small">${u.outros.map(o => `<li>${esc(o.cod ? o.cod + ' - ' : '')}${esc(o.nome)} · ${fmtN(o.laudos)} laudos · <span class="muted">${esc(o.motivo)}${o.marca ? ` (${esc(o.marca.por)}, ${new Date(o.marca.em).toLocaleDateString('pt-BR')}) <button class="sec mini" data-cusra="${esc(o.marca.mn)}">Desfazer</button>` : ''}</span></li>`).join('')}</ul></details>` : ''}` : '<p class="muted">Nenhum laudo com unidade reconhecida na planilha.</p>'}</div>`;
  ligarAbasConferencia(pg);
  const re = () => desenharControleUnidade();
  pg.querySelectorAll('[data-cuun]').forEach(b => b.onclick = () => { CU.unidade = b.dataset.cuun; CU.grupo = ''; re(); });
  pg.querySelectorAll('[data-cugr]').forEach(b => b.onclick = () => { CU.grupo = b.dataset.cugr; re(); });
  $('cuSoFalta').onchange = e => { CU.soFalta = e.target.checked; re(); };
  $('cuExp').onclick = () => baixarZip(planilhaControleUnidade(ctl, S.comp), `prestadores_por_unidade_comp_${S.comp.slice(5)}-${S.comp.slice(0, 4)}.xlsx`);
  $('cuImp').onclick = () => imprimirControleUnidade(ctl);
  const acharItem = kk => G.itens.find(x => x.k === kk);
  pg.querySelectorAll('[data-cuger]').forEach(b => b.onclick = async () => {
    const op = await exigirOperador(); if (!op) return;
    const m = marcasControle(); if (m.gerado[b.dataset.cuger]) delete m.gerado[b.dataset.cuger]; else m.gerado[b.dataset.cuger] = { por: op, em: agoraISO() };
    gravarMarcasControle(m); re();
  });
  pg.querySelectorAll('[data-cudisp]').forEach(b => b.onclick = async () => {
    const op = await exigirOperador(); if (!op) return;
    const x = acharItem(b.dataset.cudisp), semLaudo = x.situacao === 'sem-laudo';
    const r2 = await dialogo(semLaudo ? `Relatório sem laudo — ${x.cod} ${x.nome}` : `Fora do repasse neste mês — ${x.cod} ${x.nome}`, `<p class="small">${semLaudo ? 'O aviso some desta competência; o motivo fica registrado.' : 'O prestador sai do que falta só nesta competência; o motivo fica registrado.'}</p><label class="campo">Motivo *<input type="text" name="motivo" placeholder="${semLaudo ? 'ex.: laudos com outro nome no Apolo' : 'ex.: pago por outra empresa'}"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Registrar']]);
    if (r2.botao !== 'ok') return;
    if (!r2.campos.motivo?.trim()) return avisar('Informe o motivo.', 'warn');
    const m = marcasControle(); m.dispensado[x.k] = { motivo: r2.campos.motivo.trim(), por: op, em: agoraISO() }; gravarMarcasControle(m); re();
  });
  pg.querySelectorAll('[data-cuvolta]').forEach(b => b.onclick = () => { const m = marcasControle(); delete m.dispensado[b.dataset.cuvolta]; gravarMarcasControle(m); re(); });
  pg.querySelectorAll('[data-cucad]').forEach(b => b.onclick = async () => { await cadastrarMedicoApolo(b.dataset.cucad, +b.dataset.n); re(); });
  pg.querySelectorAll('[data-cunsra]').forEach(b => b.onclick = async () => {
    const op = await exigirOperador(); if (!op) return;
    if (!await confirmar('Não é pago pela SRA?', `«${esc(b.dataset.cunsra)}» deixa de aparecer como pendência em Curitiba (ex.: equipe da G.O. Laudos) e vai para «Outros médicos — não pagos pela SRA». Fica no cadastro, com o seu nome.`, 'Confirmar')) return;
    S.cfg.medicosNaoSRA = (S.cfg.medicosNaoSRA || []).filter(x => x.mn !== norm(b.dataset.cunsra));
    S.cfg.medicosNaoSRA.push({ mn: norm(b.dataset.cunsra), nome: b.dataset.cunsra, por: op, em: agoraISO() });
    salvarCfg(`«${b.dataset.cunsra}» marcado como não pago pela SRA (Curitiba).`, 'prestadores'); re();
  });
  pg.querySelectorAll('[data-cusra]').forEach(b => b.onclick = () => { S.cfg.medicosNaoSRA = (S.cfg.medicosNaoSRA || []).filter(x => x.mn !== b.dataset.cusra); salvarCfg('Médico volta a ser avaliado em Curitiba.', 'prestadores'); re(); });
  pg.querySelectorAll('[data-cuabrir]').forEach(b => b.onclick = () => {
    const x = acharItem(b.dataset.cuabrir); CU.sub = 'conferir'; CU.abrir = { cod: x.cod, relId: x.relId, unidade: u.cod };
    if (!S.relatorios.length) { CU.abrir = null; return avisar(`Carregue o PDF do prestador ${x.cod} no Início para abrir a conferência.`, 'warn'); }
    RENDER.conferencia();
  });
}

// Impressão: só o que falta, por unidade e grupo (substitui a lista no papel).
function imprimirControleUnidade(ctl) {
  const blocos = ctl.unidades.flatMap(u => u.grupos.map(G => ({ u, G, itens: G.itens.filter(x => FALTA_CONTROLE.has(x.situacao) || x.situacao === 'sem-laudo') })).filter(b => b.itens.length));
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Prestadores por unidade ${esc(rotuloCompetencia(S.comp))}</title><style>body{font:12px Arial,sans-serif;margin:16px}h1{font-size:16px}h2{font-size:13px;margin:14px 0 4px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:3px 6px;text-align:left}td.n{text-align:right}.cx{width:18px}</style></head><body>
    <h1>Prestadores por unidade — o que falta · competência ${esc(rotuloCompetencia(S.comp))}</h1><p>Planilha de laudos: ${esc(S.apolo?.nome || '')} · impresso em ${new Date().toLocaleString('pt-BR')}</p>
    ${blocos.map(b => `<h2>Unidade ${esc(b.u.cod)} - ${esc(b.u.nome)} · ${GRUPOS_CONTROLE[b.G.grupo]}</h2><table><tr><th class="cx">✓</th><th>Cód.</th><th>Prestador</th><th>Laudos</th><th>Situação</th></tr>${b.itens.map(x => `<tr><td class="cx"></td><td>${esc(x.cod || '—')}</td><td>${esc(x.nome)}</td><td class="n">${x.laudos}</td><td>${SITUACAO_CONTROLE[x.situacao][1]}</td></tr>`).join('')}</table>`).join('') || '<p>Nada faltando.</p>'}</body></html>`;
  const w = window.open('', '_blank'); if (!w) return avisar('O navegador bloqueou a janela de impressão.', 'warn');
  w.document.write(html); w.document.close(); w.focus(); w.print();
}

// Resumo para o Início: o que falta por unidade e grupo.
function painelControleUnidade() {
  const ctl = controleAtual(); if (!ctl) return '';
  const linhas = ctl.unidades.flatMap(u => u.grupos.filter(G => G.resumo.falta || G.resumo.semLaudo).map(G => ({ u, G })));
  return `<div class="card"><div class="fx-topo"><h2 style="margin:0">Prestadores por unidade</h2><button class="sec mini" id="btCtlUn">Ver prestadores por unidade</button></div>
    ${linhas.length ? `<div class="cu-ini">${linhas.map(({ u, G }) => { const r = G.resumo, d = [r.gerar && `${r.gerar} a gerar no MV`, r.semConferencia && `${r.semConferencia} sem conferência`, r.conferidos && `${r.conferidos} sem aceite`, r.semCadastro && `${r.semCadastro} sem cadastro`, r.semLaudo && `${r.semLaudo} aviso(s) de relatório sem laudo`].filter(Boolean).join(' · ');
      return `<div class="linha-ini"><strong>Unidade ${esc(u.cod)} · ${G.grupo === 'curitiba' ? 'Curitiba' : G.grupo.toUpperCase()}:</strong> ${r.falta ? `faltam ${r.falta}` : 'nada faltando'} <span class="muted small">${d}</span></div>`; }).join('')}</div>`
      : '<p class="muted">Todos os prestadores que laudaram já têm repasse conferido e aceito.</p>'}</div>`;
}
document.addEventListener('click', e => { if (e.target.closest('#btCtlUn')) { CU.sub = 'unidades'; location.hash = 'conferencia'; if (location.hash === '#conferencia') RENDER.conferencia(); } });
