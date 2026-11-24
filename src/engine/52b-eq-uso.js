/* ============================================================
 * SOL-F50 (v3.0.0-alpha.24) — Uso das equivalências nas conferências (trazida da v2.1.0-alpha.20 para a 3.0).
 * Para cada relação código × título validada e cada regra composta: quantas linhas do MV ela confirmou
 * («Conferido» ou «com ressalva»), em quais competências, prestadores e unidades, e a última competência com uso.
 *
 * Decisões do usuário (23/11/2026):
 *  1. Os dois computadores veem o mesmo uso: cada conferência vira um RESUMO por relatório (competência ×
 *     prestador × unidade × repasse), sem paciente, guardado no navegador e na pasta da rede
 *     («01 - Sistema › Equivalências TUSS › uso_equivalencias.json»). Junta por relatório; vale o mais recente.
 *  2. O resumo não depende das rodadas inteiras: a retenção (que resume rodadas antigas) não apaga o histórico.
 *  3. «Em uso» = confirmou linhas em uma das últimas 3 competências (padrão; muda no filtro).
 * A relação é identificada pela chave natural (código × título × escopo), igual nos dois navegadores; a regra
 * composta, pelo id. Nada aqui muda a conferência, o fechamento nem as rodadas.
 * ============================================================ */
const SCHEMA_USO_EQ = 'repasse-medico/uso-equivalencias';
const SIT_USO = { 'em-uso': 'Em uso', parada: 'Parada', 'nunca-usada': 'Nunca usada' };
const LINHA_CONFIRMADA = ['conferido', 'ressalva'];
const usoEqVazio = () => ({ schema: SCHEMA_USO_EQ, versaoSchema: 1, resumos: {} });
// Grupo da relação para o filtro USG / IMG (Doppler é sempre do grupo de USG).
const grupoDaRelacaoEq = e => (e.escopo?.modalidade === 'US' || /ULTRASS|ULTRASON|\bUSG?\b|DOPPLER|ECOGRAF|ECOCARD/.test(norm(`${e.titulo || ''} ${e.descMV || ''}`))) ? 'usg' : 'img';

/* Relação que sustentou a linha da rodada: pelo id guardado (eqId, desde a alpha.24) ou, nas rodadas antigas,
 * pelo par código × título no escopo da unidade (a validada primeiro, a de escopo mais específico depois). */
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

/* Resumo de uma rodada de conferência: [confirmadas, com ressalva, pareadas sem confirmar, Vl Repasse] por relação
 * (chave natural) e por regra composta (id). Rodada resumida pela retenção (sem linhas) não gera resumo. */
function resumoUsoDaRodada(r, base, achar = localizadorDeRelacoes(base)) {
  if (r.tipo !== 'conferencia' || !(r.linhas || []).length || !r.unidadeCod || r.unidadeCod === '*') return null;
  const comp = competenciaDaRodada(r); if (!comp) return null;
  const rel = {}, cmp = {};
  for (const l of r.linhas) {
    if (!ehLinhaProcedimento(l) || l.eq !== 'validada') continue;
    let alvo, k;
    if (l.composta) { alvo = cmp; k = l.composta; }
    else { const e = achar(l, r.unidadeCod); if (!e) continue; alvo = rel; k = chaveRelacaoEq(e); }
    const v = alvo[k] || (alvo[k] = [0, 0, 0, 0]);
    if (!LINHA_CONFIRMADA.includes(l.estado)) { v[2]++; continue; }
    v[0]++; if (l.estado === 'ressalva') v[1]++; v[3] = r2(v[3] + (+l.vlRepasse || 0));
  }
  return { k: `${comp}|${chaveRelatorioRodada(r)}`, comp, prest: String(r.prestadorCod || ''), prestNome: r.prestadorNome || '', un: String(r.unidadeCod),
    gr: tipoRepasseDaRodada(r), em: r.em, rodadaId: r.id, por: r.operador || '', rel, cmp };
}
// Junta dois conjuntos de resumos (navegador × pasta): por relatório, vale o resumo da rodada mais recente.
function mesclarUsoEq(a, b) {
  const out = usoEqVazio();
  for (const fonte of [a, b]) for (const [k, x] of Object.entries(fonte?.resumos || {})) {
    const y = out.resumos[k]; if (!y || String(x.em) > String(y.em)) out.resumos[k] = x;
  }
  return out;
}
/* Acrescenta ao conjunto os resumos das rodadas guardadas neste navegador (a última de cada relatório por competência).
 * Devolve {uso, mudou}. Usado ao abrir a subaba e logo depois de cada conferência. */
function atualizarUsoComRodadas(uso, rodadas, base) {
  const achar = localizadorDeRelacoes(base), novos = usoEqVazio();
  const comps = [...new Set((rodadas || []).filter(r => r.tipo === 'conferencia').map(competenciaDaRodada).filter(Boolean))];
  for (const c of comps) for (const r of ultimasRodadasConferencia(rodadas, c)) { const x = resumoUsoDaRodada(r, base, achar); if (x) novos.resumos[x.k] = x; }
  const res = mesclarUsoEq(uso, novos);
  return { uso: res, mudou: JSON.stringify(res.resumos) !== JSON.stringify(uso?.resumos || {}) };
}

/* Uso agregado: relacoes (Map id → uso), compostas (Map id → uso), competências com resumo, as recentes e a situação.
 * grupo: '*' | 'usg' | 'img' — filtra os relatórios (Curitiba entra nos dois). */
function usoEquivalencias(uso, base, { janela = 3, grupo = '*' } = {}) {
  const resumos = Object.values(uso?.resumos || {}).filter(x => grupo === '*' || x.gr === grupo || x.gr === 'curitiba');
  const competencias = [...new Set(resumos.map(x => x.comp))].sort(), recentes = competencias.slice(-Math.max(1, +janela || 1));
  const idPorChave = new Map((base.itens || []).map(e => [chaveRelacaoEq(e), e.id]));
  const relacoes = new Map(), compostas = new Map();
  const novo = () => ({ linhas: 0, ressalvas: 0, naoConfirmadas: 0, vlRepasse: 0, porComp: new Map(), prestadores: new Map(), unidades: new Set(), ultima: '' });
  for (const x of resumos) for (const [m, mapa, id] of [...Object.entries(x.rel).map(([k, v]) => [v, relacoes, idPorChave.get(k)]), ...Object.entries(x.cmp).map(([k, v]) => [v, compostas, k])]) {
    if (!id) continue;
    const u = mapa.get(id) || mapa.set(id, novo()).get(id);
    const pc = u.porComp.get(x.comp) || u.porComp.set(x.comp, { linhas: 0, ressalvas: 0, naoConfirmadas: 0, vlRepasse: 0, relatorios: new Set() }).get(x.comp);
    u.naoConfirmadas += m[2]; pc.naoConfirmadas += m[2];
    if (!m[0]) continue;
    u.linhas += m[0]; pc.linhas += m[0]; u.ressalvas += m[1]; pc.ressalvas += m[1]; u.vlRepasse += m[3]; pc.vlRepasse += m[3];
    pc.relatorios.add(x.k); u.prestadores.set(x.prest, x.prestNome); u.unidades.add(x.un);
    if (x.comp > u.ultima) u.ultima = x.comp;
  }
  for (const m of [relacoes, compostas]) for (const u of m.values()) { u.vlRepasse = r2(u.vlRepasse); for (const pc of u.porComp.values()) pc.vlRepasse = r2(pc.vlRepasse); }
  const situacao = u => !u || !u.linhas ? 'nunca-usada' : recentes.includes(u.ultima) ? 'em-uso' : 'parada';
  return { competencias, recentes, relacoes, compostas, situacao };
}

/* O que deixa de ser conferido sozinho se a validação sair: linhas e relatórios que essas relações (ou regras
 * compostas) confirmaram na competência e no total. */
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

// Planilha do uso: Leia-me · Relações · Regras compostas, uma coluna por competência.
function xlsxUsoEquivalencias(base, uso, { operador = '' } = {}) {
  const ST = { 'em-uso': 'C6EFCE', parada: 'FFEB9C', 'nunca-usada': 'FCE4D6' };
  const comps = uso.competencias, dt = s => s ? String(s).slice(0, 10).split('-').reverse().join('/') : '';
  const sit = u => { const s = uso.situacao(u); return { v: SIT_USO[s], st: { fill: ST[s], b: true } }; };
  const porComp = u => comps.map(c => u?.porComp.get(c)?.linhas || '');
  const escopo = e => `${e.escopo?.unidade === '*' || !e.escopo ? 'todas as unidades' : 'unidade ' + e.escopo.unidade}${e.escopo?.modalidade && e.escopo.modalidade !== '*' ? ' · ' + e.escopo.modalidade : ''}`;
  const rotC = comps.map(rotuloCompetencia), prest = u => u ? [...u.prestadores].map(([c, n]) => `${c} - ${n}`).join('\n') : '', uns = u => u ? [...u.unidades].sort((a, b) => +a - +b).join(', ') : '';
  const R = [cabecalho(['Situação de uso', 'Status', 'Grupo', 'Código TUSS (MV)', 'Descrição no MV', 'TITLE do laudo (Apolo)', 'Linhas confirmadas', 'Com ressalva', 'Pareadas sem confirmar', 'Vl Repasse confirmado', 'Última competência com uso', 'Prestadores', 'Unidades', 'Escopo', 'Responsável', 'Validada em', ...rotC])];
  for (const e of (base.itens || []).filter(e => e.status === 'validada' || uso.relacoes.has(e.id)).sort((a, b) => (uso.relacoes.get(b.id)?.linhas || 0) - (uso.relacoes.get(a.id)?.linhas || 0) || a.titulo.localeCompare(b.titulo))) {
    const u = uso.relacoes.get(e.id);
    R.push([sit(u), STATUS_EQ[e.status] || e.status, grupoDaRelacaoEq(e).toUpperCase(), { v: e.codigo, st: { fmt: 'text' } }, e.descMV || '', e.titulo, u?.linhas || 0, u?.ressalvas || 0, u?.naoConfirmadas || 0, { v: u?.vlRepasse || 0, st: { fmt: 'money' } },
      u?.ultima ? rotuloCompetencia(u.ultima) : '', prest(u), uns(u), escopo(e), e.responsavel || '', dt(e.validadoEm), ...porComp(u)]);
  }
  const C = [cabecalho(['Situação de uso', 'Status', 'Regra composta', 'Títulos do Apolo', 'Linhas confirmadas', 'Com ressalva', 'Pareadas sem confirmar', 'Vl Repasse confirmado', 'Última competência com uso', 'Prestadores', 'Unidades', 'Responsável', 'Validada em', ...rotC])];
  for (const c0 of (base.compostas || []).filter(c => c.status === 'validada' || uso.compostas.has(c.id))) {
    const c = regraComposta(c0), u = uso.compostas.get(c.id);
    C.push([sit(u), STATUS_EQ[c.status] || c.status, nomeComposta(c), { v: c.titulos.join('\n'), st: { wrap: true } }, u?.linhas || 0, u?.ressalvas || 0, u?.naoConfirmadas || 0, { v: u?.vlRepasse || 0, st: { fmt: 'money' } },
      u?.ultima ? rotuloCompetencia(u.ultima) : '', prest(u), uns(u), c.responsavel || '', dt(c.validadoEm), ...porComp(u)]);
  }
  const L = [cabecalho(['Item', 'O que significa']), ...[
    ['Linhas confirmadas', 'Linhas de procedimento do MV que ficaram «Conferido» ou «Conferido com ressalva» sustentadas por esta relação (ou regra), na conferência mais recente de cada relatório de cada competência.'],
    ['Pareadas sem confirmar', 'A relação casou o título com o código, mas a linha ficou pendente por outro motivo (outro médico, mais de um laudo, data, nome apenas semelhante).'],
    ['Em uso', `Confirmou linhas em pelo menos uma das últimas ${uso.recentes.length} competência(s) (${uso.recentes.map(rotuloCompetencia).join(', ') || '—'}).`],
    ['Parada', 'Confirmou linhas antes, mas não nas competências recentes. Vale revisar: o título pode ter mudado no Apolo ou o código no MV.'],
    ['Nunca usada', 'Validada, mas sem nenhuma linha confirmada. Não quer dizer que está errada: o exame pode ser raro.'],
    ['De onde vem', 'Resumo de cada conferência (sem paciente), juntado pela pasta da rede: os dois computadores veem o mesmo uso.'],
    ['Competências', comps.map(rotuloCompetencia).join(', ') || '—'],
    ['Gerado em', `${new Date().toLocaleString('pt-BR')}${operador ? ` · ${operador}` : ''} · base revisão ${base.revisao || ''}`]
  ].map(([a, b]) => [{ v: a, st: { b: true } }, { v: b, st: { wrap: true } }])];
  return criarXlsx([
    { nome: 'Leia-me', larguras: [24, 120], linhas: L, filtro: false, congelar: false },
    { nome: 'Relações', larguras: [13, 11, 8, 12, 40, 50, 10, 9, 10, 13, 12, 34, 10, 20, 20, 11, ...rotC.map(() => 9)], linhas: R, filtro: R.length > 1 },
    { nome: 'Regras compostas', larguras: [13, 11, 40, 50, 10, 9, 10, 13, 12, 34, 10, 20, 11, ...rotC.map(() => 9)], linhas: C, filtro: C.length > 1 }
  ]);
}
