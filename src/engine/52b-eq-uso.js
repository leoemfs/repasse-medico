/* ============================================================
 * Uso das equivalências nas conferências (SOL-F41)
 * Para cada relação código × título e cada regra composta: quantas linhas do MV ela confirmou
 * («Conferido» ou «Conferido com ressalva»), em quais competências, relatórios, prestadores e unidades,
 * e qual foi a última competência em que confirmou alguma linha.
 * Usa a última rodada de conferência de cada relatório por competência (sem nome de paciente).
 * Situação de uso de quem está validado:
 *   em uso      — confirmou linhas em uma das últimas N competências com rodadas;
 *   parada      — confirmou linhas antes, mas não nessas N competências;
 *   nunca usada — nenhuma linha confirmada nas rodadas guardadas.
 * ============================================================ */
const SIT_USO = { 'em-uso': 'Em uso', parada: 'Parada', 'nunca-usada': 'Nunca usada' };
const LINHA_CONFIRMADA = ['conferido', 'ressalva'];

/* Relação que sustentou a linha. Rodadas desta versão em diante guardam o id (eqId); nas antigas a
 * relação é achada pelo par código × título, no escopo da unidade da rodada (a validada primeiro e a
 * de escopo mais específico depois). */
function localizadorDeRelacoes(base) {
  const porId = new Map(), porPar = new Map();
  for (const e of base.itens || []) {
    porId.set(e.id, e);
    const k = `${e.codigo}|${chaveTitulo(e.titulo)}`;
    (porPar.get(k) || porPar.set(k, []).get(k)).push(e);
  }
  return (l, unidadeCod) => {
    if (l.eqId && porId.has(l.eqId)) return porId.get(l.eqId);
    const un = !unidadeCod || unidadeCod === '*' ? '' : String(unidadeCod);
    const cands = (porPar.get(`${l.codigo}|${chaveTitulo(l.titulo || '')}`) || []).filter(e => escopoCobre(e.escopo, un, ''));
    return cands.sort((a, b) => (b.status === 'validada') - (a.status === 'validada') || (b.escopo?.unidade !== '*') - (a.escopo?.unidade !== '*'))[0] || null;
  };
}

function usoEquivalencias(rodadas, base, { janela = 3 } = {}) {
  const competencias = [...new Set((rodadas || []).filter(r => r.tipo === 'conferencia').map(competenciaDaRodada).filter(Boolean))].sort();
  const recentes = competencias.slice(-Math.max(1, +janela || 1));
  const relacoes = new Map(), compostas = new Map(), achar = localizadorDeRelacoes(base);
  const novo = () => ({ linhas: 0, ressalvas: 0, naoConfirmadas: 0, vlRepasse: 0, porComp: new Map(), prestadores: new Map(), unidades: new Set(), ultima: '' });
  const pegar = (m, id) => m.get(id) || m.set(id, novo()).get(id);
  for (const c of competencias) for (const r of ultimasRodadasConferencia(rodadas, c)) {
    const kr = chaveRelatorioRodada(r);
    for (const l of r.linhas || []) {
      if (!ehLinhaProcedimento(l) || l.eq !== 'validada') continue;
      let u;
      if (l.composta) u = pegar(compostas, l.composta);
      else { const e = achar(l, r.unidadeCod); if (!e) continue; u = pegar(relacoes, e.id); }
      const pc = u.porComp.get(c) || u.porComp.set(c, { linhas: 0, ressalvas: 0, naoConfirmadas: 0, vlRepasse: 0, relatorios: new Set() }).get(c);
      if (!LINHA_CONFIRMADA.includes(l.estado)) { u.naoConfirmadas++; pc.naoConfirmadas++; continue; }
      const vl = +l.vlRepasse || 0;
      u.linhas++; pc.linhas++; u.vlRepasse += vl; pc.vlRepasse += vl;
      if (l.estado === 'ressalva') { u.ressalvas++; pc.ressalvas++; }
      pc.relatorios.add(kr);
      u.prestadores.set(String(r.prestadorCod), r.prestadorNome || '');
      if (r.unidadeCod && r.unidadeCod !== '*') u.unidades.add(String(r.unidadeCod));
      if (c > u.ultima) u.ultima = c;
    }
  }
  for (const m of [relacoes, compostas]) for (const u of m.values()) { u.vlRepasse = r2(u.vlRepasse); for (const pc of u.porComp.values()) pc.vlRepasse = r2(pc.vlRepasse); }
  const situacao = u => !u || !u.linhas ? 'nunca-usada' : recentes.includes(u.ultima) ? 'em-uso' : 'parada';
  return { competencias, recentes, relacoes, compostas, situacao };
}

/* O que deixa de ser conferido sozinho se a validação sair: linhas e relatórios que essas relações
 * (ou regras compostas) confirmaram na competência e no total das rodadas guardadas. */
function impactoTirarValidacao(uso, ids, chave, tipo = 'relacoes') {
  const m = uso[tipo], relatorios = new Set();
  let linhasComp = 0, linhasTotal = 0, comUso = 0;
  for (const id of ids) {
    const u = m.get(id); if (!u || !u.linhas) continue;
    comUso++; linhasTotal += u.linhas;
    const pc = u.porComp.get(chave);
    if (pc) { linhasComp += pc.linhas; for (const k of pc.relatorios) relatorios.add(k); }
  }
  return { comUso, linhasComp, relatoriosComp: relatorios.size, linhasTotal };
}

// Planilha do uso: uma linha por relação e por regra composta, e o detalhe por competência.
function xlsxUsoEquivalencias(base, uso, { operador = '' } = {}) {
  const ST = { 'em-uso': 'C6EFCE', parada: 'FFEB9C', 'nunca-usada': 'FCE4D6' };
  const comps = uso.competencias, dt = s => s ? String(s).slice(0, 10).split('-').reverse().join('/') : '';
  const sit = u => { const s = uso.situacao(u); return { v: SIT_USO[s], st: { fill: ST[s], b: true } }; };
  const porComp = u => comps.map(c => u?.porComp.get(c)?.linhas || '');
  const escopo = e => `${e.escopo?.unidade === '*' || !e.escopo ? 'todas as unidades' : 'unidade ' + e.escopo.unidade}${e.escopo?.modalidade && e.escopo.modalidade !== '*' ? ' · ' + e.escopo.modalidade : ''}`;
  const rotC = comps.map(rotuloCompetencia);
  const R = [cabecalho(['Situação de uso', 'Status', 'Código TUSS (MV)', 'Descrição no MV', 'TITLE do laudo (Apolo)', 'Linhas confirmadas', 'Com ressalva', 'Pareadas sem confirmar', 'Vl Repasse confirmado', 'Última competência com uso', 'Prestadores', 'Unidades', 'Escopo', 'Responsável', 'Validada em', ...rotC])];
  const rels = (base.itens || []).filter(e => e.status === 'validada' || uso.relacoes.has(e.id));
  for (const e of rels.sort((a, b) => (uso.relacoes.get(b.id)?.linhas || 0) - (uso.relacoes.get(a.id)?.linhas || 0) || a.titulo.localeCompare(b.titulo))) {
    const u = uso.relacoes.get(e.id);
    R.push([sit(u), STATUS_EQ[e.status] || e.status, { v: e.codigo, st: { fmt: 'text' } }, e.descMV || '', e.titulo, u?.linhas || 0, u?.ressalvas || 0, u?.naoConfirmadas || 0, { v: u?.vlRepasse || 0, st: { fmt: 'money' } },
      u?.ultima ? rotuloCompetencia(u.ultima) : '', u ? [...u.prestadores].map(([c, n]) => `${c} - ${n}`).join('\n') : '', u ? [...u.unidades].sort((a, b) => +a - +b).join(', ') : '', escopo(e), e.responsavel || '', dt(e.validadoEm), ...porComp(u)]);
  }
  const C = [cabecalho(['Situação de uso', 'Status', 'Regra composta', 'Títulos do Apolo', 'Linhas confirmadas', 'Com ressalva', 'Pareadas sem confirmar', 'Vl Repasse confirmado', 'Última competência com uso', 'Prestadores', 'Unidades', 'Responsável', 'Validada em', ...rotC])];
  for (const c0 of (base.compostas || []).filter(c => c.status === 'validada' || uso.compostas.has(c.id))) {
    const c = regraComposta(c0), u = uso.compostas.get(c.id);
    C.push([sit(u), STATUS_EQ[c.status] || c.status, nomeComposta(c), { v: c.titulos.join('\n'), st: { wrap: true } }, u?.linhas || 0, u?.ressalvas || 0, u?.naoConfirmadas || 0, { v: u?.vlRepasse || 0, st: { fmt: 'money' } },
      u?.ultima ? rotuloCompetencia(u.ultima) : '', u ? [...u.prestadores].map(([k, n]) => `${k} - ${n}`).join('\n') : '', u ? [...u.unidades].sort((a, b) => +a - +b).join(', ') : '', c.responsavel || '', dt(c.validadoEm), ...porComp(u)]);
  }
  const L = [cabecalho(['Item', 'O que significa']), ...[
    ['Linhas confirmadas', 'Linhas de procedimento do MV que ficaram «Conferido» ou «Conferido com ressalva» sustentadas por esta relação (ou regra), na última rodada de cada relatório de cada competência.'],
    ['Pareadas sem confirmar', 'A relação casou o título com o código, mas a linha ficou pendente por outro motivo (outro médico, mais de um laudo, data, nome apenas semelhante).'],
    ['Em uso', `Confirmou linhas em pelo menos uma das últimas ${uso.recentes.length} competência(s) com rodadas (${uso.recentes.map(rotuloCompetencia).join(', ') || '—'}).`],
    ['Parada', 'Confirmou linhas antes, mas não nas competências recentes. Vale revisar: o título pode ter mudado no Apolo ou o código no MV.'],
    ['Nunca usada', 'Validada, mas sem nenhuma linha confirmada nas rodadas guardadas neste navegador. Não quer dizer que está errada: o exame pode ser raro.'],
    ['Rodadas', `${comps.length} competência(s) com rodadas de conferência: ${comps.map(rotuloCompetencia).join(', ') || '—'}.`],
    ['Gerado em', `${new Date().toLocaleString('pt-BR')}${operador ? ` · ${operador}` : ''} · base revisão ${base.revisao || ''}`]
  ].map(([a, b]) => [{ v: a, st: { b: true } }, { v: b, st: { wrap: true } }])];
  return criarXlsx([
    { nome: 'Leia-me', larguras: [24, 120], linhas: L, filtro: false, congelar: false },
    { nome: 'Relações', larguras: [13, 11, 12, 40, 50, 10, 9, 10, 13, 12, 34, 10, 20, 20, 11, ...rotC.map(() => 9)], linhas: R, filtro: R.length > 1 },
    { nome: 'Regras compostas', larguras: [13, 11, 40, 50, 10, 9, 10, 13, 12, 34, 10, 20, 11, ...rotC.map(() => 9)], linhas: C, filtro: C.length > 1 }
  ]);
}
