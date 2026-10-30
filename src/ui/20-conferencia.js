/* ============================================================
 * Conferência cruzada MV × Apolo
 * ============================================================ */
const NIVEL_NOME = ['', 'semelhante', 'truncado', 'idêntico'];
const FAIXA = { 1: 'validada · mesma data', 2: 'validada · data na tolerância', 3: 'não validada · mesma data', 4: 'não validada · data na tolerância', 5: 'nome semelhante', 6: 'sem equivalência · mesma data' };

function seletoresAnalise(prefixo, tolPadrao) {
  const rels = S.relatorios;
  const ultimo = S[prefixo === 'cf' ? 'conf' : 'corr']?.ctx;
  const relSel = ultimo?.relId && rels.some(r => r.id === ultimo.relId) ? ultimo.relId : rels[0]?.id;
  const rel = rels.find(r => r.id === relSel);
  const sugerida = rel ? unidadeSugeridaPeloArquivo(rel.nome) : '';
  const unSel = ultimo?.relId === relSel ? ultimo.unidadeCod : (sugerida && unidadePorCod(S.cfg, sugerida) ? sugerida : '');
  return `<div class="grid4">
    <label class="campo">Relatório MV<select id="${prefixo}Rel">${opcoes(rels.map(r => [r.id, `${r.rel.cab.prestadorCod} - ${r.rel.cab.prestadorNome} · ${r.rel.cab.descricao || r.nome}`]), relSel)}</select></label>
    <label class="campo">Unidade dos laudos<select id="${prefixo}Un"><option value="">— escolher —</option>${opcoes(S.cfg.unidades.map(u => [u.cod, `${u.cod} - ${u.nome}`]), unSel)}<option value="*"${unSel === '*' ? ' selected' : ''}>Todas as unidades (não recomendado)</option></select>
      <span class="small muted" id="${prefixo}UnDica">${sugerida && !ultimo ? 'Sugerida pelo nome do arquivo: confirme.' : 'O PDF não informa a unidade: a escolha é da sessão.'}</span></label>
    <label class="campo">Tolerância de data (dias)<input id="${prefixo}Tol" type="number" min="0" max="60" value="${ultimo?.parametros?.tol ?? tolPadrao}"></label>
    <div id="${prefixo}Extra"></div></div>`;
}
function relSelecionado(prefixo) { return S.relatorios.find(r => r.id === $(prefixo + 'Rel').value); }

/* ---------- Competência: produção dos arquivos e resultado de outra competência ---------- */
// Mês dominante das datas de cada arquivo, calculado uma vez por arquivo carregado.
function producaoDoArquivo(obj, datas) {
  if (!obj) return null;
  if (!obj.__producao) obj.__producao = mesDominante(datas());
  return obj.__producao;
}
function avisosProducao() {
  const esp = producaoEsperada(S.comp), out = [];
  const checar = (nome, dom) => { if (dom && dom.mes !== esp) out.push(`${nome}: produção ${rotuloMes(dom.mes)}`); };
  for (const x of S.relatorios) checar(`MV ${x.rel.cab.prestadorCod} - ${x.rel.cab.prestadorNome}`, producaoDoArquivo(x, () => x.rel.regs.map(r => r.data)));
  if (S.apolo) checar('Laudos do Apolo', producaoDoArquivo(S.apolo, () => S.apolo.laudos.map(l => l.data)));
  if (S.pbi) checar('Power BI', producaoDoArquivo(S.pbi, () => S.pbi.linhas.map(l => l.data)));
  return out;
}
function cartaoAvisoProducao() {
  const av = avisosProducao();
  return av.length ? `<div class="aviso-fixo warn">A competência ${rotuloCompetencia(S.comp)} espera produção ${rotuloMes(producaoEsperada(S.comp))}, mas há arquivo de outro mês — ${av.map(esc).join(' · ')}. Confirme antes de analisar: as rodadas e NCs serão gravadas em ${rotuloCompetencia(S.comp)}.</div>` : '';
}
function cartaoOutraCompetencia(x, nome) {
  return x && x.ctx.chaveCompetencia !== S.comp ? `<div class="card"><p class="muted">A última ${nome} desta sessão é da competência ${rotuloCompetencia(x.ctx.chaveCompetencia)}. Volte para ela no topo para ver o resultado, ou execute uma nova aqui em ${rotuloCompetencia(S.comp)}.</p></div>` : '';
}

RENDER.conferencia = () => {
  const p = $('pag-conferencia');
  if (!S.relatorios.length || !S.apolo) { p.innerHTML = faltamArquivos(); return; }
  p.innerHTML = `${cartaoAvisoProducao()}<div class="card"><h2>Parâmetros</h2>${seletoresAnalise('cf', S.cfg.parametros.tolConferencia)}
    <div class="acoes"><button id="cfRodar">Executar conferência</button><span class="muted small">Cada execução vira uma rodada registrada, com versões das bases e parâmetros.</span></div></div>
    <div id="cfRes">${cartaoOutraCompetencia(S.conf, 'conferência')}</div>`;
  const extra = () => {
    const rel = relSelecionado('cf'), un = $('cfUn').value;
    const ligados = rel ? medicosDoPrestador(S.cfg, rel.rel.cab.prestadorCod) : [];
    const medUn = [...new Set(laudosDaUnidade(S.apolo, S.cfg, un || '*').map(l => l.medico).filter(Boolean))].sort();
    const presentes = ligados.filter(n => medUn.some(m => norm(m) === n));
    const sel = S.conf?.ctx?.relId === rel?.id ? S.conf.ctx.medicoSel : (presentes.length ? '@prest' : '*');
    $('cfExtra').innerHTML = `<label class="campo">Médico do laudo («Só no laudo»)<select id="cfMed">
      <option value="@prest"${sel === '@prest' ? ' selected' : ''}${presentes.length ? '' : ' disabled'}>Prestador do relatório${presentes.length ? '' : ' (sem vínculo nesta unidade)'}</option>
      <option value="*"${sel === '*' ? ' selected' : ''}>Todos os médicos da unidade</option>${opcoes(medUn.map(m => [norm(m), m]), sel)}</select>
      <span class="small muted">${presentes.length ? 'Vínculo pelo nome do cabeçalho do MV ou alias validado.' : 'Nome do prestador não encontrado entre os médicos do Apolo: vincule em Bases → Prestadores ou escolha o médico.'}</span></label>`;
  };
  $('cfRel').onchange = extra; $('cfUn').onchange = extra; extra();
  $('cfRodar').onclick = executarConferencia;
  if (S.conf && S.conf.ctx.chaveCompetencia === S.comp) desenharConferencia();
};
function faltamArquivos() {
  return `<div class="card"><h2>Faltam arquivos</h2><p class="lead">Carregue ${S.relatorios.length ? '' : 'o relatório do MV (PDF)'}${!S.relatorios.length && !S.apolo ? ' e ' : ''}${S.apolo ? '' : 'a planilha de laudos do Apolo'} no Início.</p><div class="acoes"><button onclick="location.hash='inicio'">Ir para o Início</button></div></div>`;
}

async function executarConferencia() {
  const x = relSelecionado('cf'), un = $('cfUn').value, tol = +$('cfTol').value, medSel = $('cfMed').value;
  if (!un) return avisar('Escolha a unidade dos laudos: o PDF não informa a unidade.', 'warn');
  if (!(tol >= 0)) return avisar('Tolerância inválida.', 'warn');
  if (!exigirAberta(S.comp, 'executar uma conferência')) return;
  const medicos = medSel === '*' ? null : medSel === '@prest' ? medicosDoPrestador(S.cfg, x.rel.cab.prestadorCod) : [medSel];
  const res = conferirCruzado(x.rel, S.apolo, S.cfg, S.eq, { unidadeCod: un, tol, medicos });
  const unidade = un === '*' ? 'Todas as unidades' : `${un} - ${unidadePorCod(S.cfg, un)?.nome || ''}`;
  const medicosNomes = medicos ? [...new Set(S.apolo.laudos.filter(l => medicos.includes(l.mn)).map(l => l.medico))].join(', ') : '';
  const ctx = { chaveCompetencia: S.comp, relId: x.id, relatorio: x.rel, apoloNome: S.apolo.nome, unidadeCod: un, unidadeNome: unidade, medicoSel: medSel, medicosNomes, parametros: { tol, medico: medSel }, operador: S.operador, cfgRevisao: S.cfg.revisao,
    arquivos: [{ papel: 'MV', nome: x.nome, hash: x.hash }, { papel: 'Apolo', nome: S.apolo.nome, hash: S.apolo.hash }] };
  const rodada = registroRodada(res, ctx); ctx.rodadaId = rodada.id;
  const ant = rodadaAnterior(S.rodadas, rodada);
  await guardarRodada(rodada);
  S.conf = { res, ctx, rodada, comparacao: ant ? { ant, grupos: compararRodadas(ant, rodada) } : null, filtroStatus: new Set(), filtroMarc: new Set(), busca: '' };
  ctx.fonteNC = `conf|${x.id}|${un}`;
  guardarCandidatosNC(ctx.fonteNC, `Conferência ${x.rel.cab.prestadorCod} - ${x.rel.cab.prestadorNome} · ${unidade}`, `Conf. ${x.rel.cab.prestadorCod} · un. ${un}`, candidatosDaConferencia(res, ctx, S.cfg));
  desenharConferencia();
  avisar(`Conferência concluída: ${res.porStatus.conferido.n} conferidas, ${res.nMV - res.porStatus.conferido.n} linhas do MV com pendência ou ressalva.`, 'ok');
}

function desenharConferencia() {
  const { res, ctx, comparacao } = S.conf, c = $('cfRes'); if (!c) return;
  const ordem = Object.keys(STATUS_CONF).sort((a, b) => STATUS_CONF[a].ordem - STATUS_CONF[b].ordem);
  c.innerHTML = `<div class="card"><h2>Resultado <span class="muted small">rodada ${esc(ctx.rodadaId)}</span></h2>
    <dl class="kv"><dt>Relatório</dt><dd>${esc(ctx.relatorio.cab.prestadorCod)} - ${esc(ctx.relatorio.cab.prestadorNome)} · repasse ${esc(ctx.relatorio.cab.repasse)} · ${esc(ctx.relatorio.cab.descricao)}</dd>
    <dt>Unidade</dt><dd>${esc(ctx.unidadeNome)}</dd><dt>Médico(s) no escopo</dt><dd>${esc(ctx.medicosNomes || 'Todos os médicos')}</dd>
    <dt>Período de produção</dt><dd>${res.periodo ? `${fmtData(res.periodo[0])} a ${fmtData(res.periodo[1])}` : '—'} · modalidades ${esc(res.modalidades.join(', ') || '—')}</dd>
    <dt>Volume</dt><dd>${res.nMV} linhas do MV (${res.nProcedimentos} procedimentos) · ${res.nLaudosEscopo} laudos no escopo · ${res.nPares} pares</dd>
    <dt>Equivalências</dt><dd>${res.eqValidadas} validadas (revisão ${res.eqRevisao})${res.eqValidadas ? '' : ' — <span style="color:var(--warn)">nenhuma validada: nada pode ser confirmado</span>'}</dd></dl>
    ${comparacao ? resumoComparacao(comparacao) : ''}
    <div class="tiles">${ordem.map(k => `<button class="tile st-${k}${res.porStatus[k].n ? '' : ' vazio'}${S.conf.filtroStatus.has(k) ? ' sel' : ''}" data-st="${k}"><b>${res.porStatus[k].n}</b><small>${esc(STATUS_CONF[k].nome)}</small>${res.porStatus[k].vlRepasse ? `<small class="muted" style="display:block;font-weight:400">R$ ${fmtBR(res.porStatus[k].vlRepasse)}</small>` : ''}</button>`).join('')}</div>
    <div class="marcadores">${Object.entries(res.porMarcador).filter(([, n]) => n).map(([k, n]) => `<button class="marc${S.conf.filtroMarc.has(k) ? ' sel' : ''}" data-m="${k}">${esc(MARCADORES[k])} · ${n}</button>`).join('') || '<span class="muted small">Sem marcadores.</span>'}</div>
    <p class="small muted">Cada registro tem uma categoria principal; os marcadores contam ocorrências (um registro pode ter vários).</p>
    <div class="acoes"><input type="search" id="cfBusca" placeholder="Buscar paciente, código, título ou médico…" value="${esc(S.conf.busca)}" style="max-width:420px"><button id="cfExcel">Exportar Excel</button><button id="cfLimpar" class="sec">Limpar filtros</button></div>
    <div id="cfTab" style="margin-top:10px"></div></div>
    ${ctx.fonteNC ? cartaoCandidatosNC(ctx.fonteNC) : ''}
    <div class="card"><h2>Equivalências desta rodada</h2><div id="cfEq"></div></div>`;
  ligarCartaoCandidatosNC(c);
  c.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { const s = S.conf.filtroStatus; s.has(b.dataset.st) ? s.delete(b.dataset.st) : s.add(b.dataset.st); desenharConferencia(); });
  c.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const s = S.conf.filtroMarc; s.has(b.dataset.m) ? s.delete(b.dataset.m) : s.add(b.dataset.m); desenharConferencia(); });
  $('cfLimpar').onclick = () => { S.conf.filtroStatus.clear(); S.conf.filtroMarc.clear(); S.conf.busca = ''; desenharConferencia(); };
  $('cfExcel').onclick = () => baixarZip(xlsxConferencia(res, ctx), `Conferencia_${nomeSeguro(ctx.relatorio.cab.prestadorNome)}_${ctx.relatorio.cab.repasse}_${carimbo()}.xlsx`);
  const filtrar = () => {
    const q = norm(S.conf.busca);
    return res.linhas.filter(x => (!S.conf.filtroStatus.size || S.conf.filtroStatus.has(x.status))
      && (!S.conf.filtroMarc.size || [...S.conf.filtroMarc].every(m => x.marcadores.has(m)))
      && (!q || norm([x.r?.paciente, x.r?.codigo, x.r?.procDesc, x.l?.paciente, x.l?.titulo, x.l?.medico].join(' ')).includes(q)));
  };
  const t = tabela($('cfTab'), {
    linhas: filtrar(), colunas: [
      { t: 'Linha', n: true, v: x => x.r ? x.r.seq : '—' }, { t: 'Origem', v: x => x.origem },
      { t: 'Categoria', html: x => chipStatus(x.status, STATUS_CONF[x.status].nome) },
      { t: 'Código', v: x => x.r?.codigo || '' }, { t: 'Paciente', v: x => x.r?.paciente || x.l?.paciente },
      { t: 'Data', v: x => fmtData(x.r?.data || x.l?.data) }, { t: 'TITLE do laudo', v: x => x.l?.titulo || '' },
      { t: 'Médico do laudo', v: x => x.l?.medico || '' }, { t: 'Vl Repasse', n: true, v: x => x.r ? fmtBR(x.r.vlRepasse) : '' },
      { t: 'Marcadores', v: x => [...x.marcadores].map(m => MARCADORES[m]).join(' · ') }
    ],
    detalhe: x => `<div class="acoes" style="margin:0 0 8px"><button class="sec mini" data-nc-linha="${res.linhas.indexOf(x)}">Apontar como NC…</button></div><div class="det"><div><h4>Motivo / evidências</h4><ul>${x.motivos.map(m => `<li>${esc(m)}</li>`).join('')}</ul>
      ${x.r ? `<h4 style="margin-top:8px">Linha do MV</h4><div class="small">${esc(x.r.codigo)} - ${esc(x.r.procDesc)} · conta ${esc(x.r.conta)} · atendimento ${esc(x.r.atendimento)} · ${esc(x.r.convenio)} · página ${x.r.pagina}${x.r.repeticao ? ` · repetida ${x.r.repeticao.i}/${x.r.repeticao.n}` : ''}</div>` : ''}
      ${x.l ? `<h4 style="margin-top:8px">Laudo</h4><div class="small">${esc(x.l.titulo)} · ${esc(x.l.descricao)} · ${esc(x.l.unidade)} · ${esc(x.l.modalidade)} · ${esc(x.l.convenio)} · linha ${x.l.linhaPlanilha} da planilha</div>` : ''}</div>
      <div><h4>Candidatos (paciente e data na tolerância)</h4>${x.cands.length ? `<ul>${x.cands.map(cd => `<li>${cd.l === x.l ? '<strong>' : ''}«${esc(cd.l.titulo)}» · ${esc(cd.l.medico)} · ${fmtData(cd.l.data)} · nome ${NIVEL_NOME[cd.nm]} · ${esc(ROTULO_EQ[cd.proc.estado] || cd.proc.estado)} · faixa ${cd.tier} (${FAIXA[cd.tier]})${cd.l === x.l ? '</strong>' : ''}</li>`).join('')}</ul>` : '<p class="muted small">Nenhum candidato.</p>'}</div></div>`
  });
  $('cfBusca').oninput = e => { S.conf.busca = e.target.value; t.atualizar(filtrar()); };
  $('cfTab').addEventListener('click', e => { const b = e.target.closest('[data-nc-linha]'); if (b) abrirRegistroNC([candidatoDaLinhaConferencia(res.linhas[+b.dataset.ncLinha], ctx, S.cfg)]).then(ok => ok && desenharConferencia()); });
  painelEqRodada($('cfEq'), paresDaConferencia(res), executarConferencia);
}

function resumoComparacao({ ant, grupos }) {
  const n = k => grupos[k].length;
  return `<div class="card" style="background:var(--infobg);border-color:transparent;margin-top:12px"><strong>Comparação com a rodada de ${new Date(ant.em).toLocaleString('pt-BR')}</strong>
    <div class="small" style="margin-top:4px">${n('agoraIdentificados')} passaram a conferido/identificado · ${n('continuamPendentes')} continuam pendentes · ${n('mudaramEstado')} mudaram de categoria · ${n('mudaramMedico')} mudaram de médico · ${n('novos')} linhas novas · ${n('desapareceram')} saíram da extração · ${n('semMudanca')} sem mudança.</div>
    <div class="small muted">A nova extração mostra o que mudou nos dados; não prova quem fez a correção no MV.</div></div>`;
}
