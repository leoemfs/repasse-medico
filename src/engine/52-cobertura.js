/* ============================================================
 * Cobertura de equivalências (SOL-F15)
 * Cobertura = linhas de procedimento do MV com status «Conferido» ÷ total de linhas de procedimento,
 * na última rodada de conferência de cada relatório da competência (prestador × unidade × repasse).
 * «O que mais destrava»: pares título do Apolo × código do MV que impedem a conferência automática.
 * Usa só o que a rodada guarda (sem nome de paciente).
 * ============================================================ */
const chaveRelatorioRodada = r => `${r.prestadorCod}|${r.unidadeCod}|${r.repasse}|${r.descricao || ''}`;
function ultimasRodadasConferencia(rodadas, chave) {
  const m = new Map();
  for (const r of rodadas) {
    if (r.tipo !== 'conferencia' || competenciaDaRodada(r) !== chave) continue;
    const k = chaveRelatorioRodada(r), a = m.get(k);
    if (!a || r.em > a.em) m.set(k, r);
  }
  return [...m.values()];
}
const ehLinhaProcedimento = l => !l.tipoItem || l.tipoItem === 'procedimento';
function coberturaCompetencia(rodadas, chave) {
  const ult = ultimasRodadasConferencia(rodadas, chave), por = new Map();
  let total = 0, conferidas = 0;
  for (const r of ult) {
    const proc = r.linhas.filter(ehLinhaProcedimento), ok = proc.filter(l => l.estado === 'conferido').length;
    total += proc.length; conferidas += ok;
    const e = por.get(r.prestadorCod) || { cod: r.prestadorCod, nome: r.prestadorNome, total: 0, conferidas: 0, bloqueios: new Map() };
    e.total += proc.length; e.conferidas += ok;
    for (const l of proc) if (l.eq && EQ_TRAVA.includes(l.eq) && l.estado !== 'conferido') { const k = `${l.titulo} × ${l.codigo}`; e.bloqueios.set(k, (e.bloqueios.get(k) || 0) + 1); }
    por.set(r.prestadorCod, e);
  }
  const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
  const porPrestador = [...por.values()].map(e => ({ ...e, pct: pct(e.conferidas, e.total), maiorBloqueio: [...e.bloqueios].sort((a, b) => b[1] - a[1])[0] || null })).sort((a, b) => a.pct - b.pct);
  return { chave, rodadas: ult.length, total, conferidas, pct: pct(conferidas, total), porPrestador };
}
function historicoCobertura(rodadas, chave, meses = 4) {
  const h = [];
  for (let i = meses - 1; i >= 0; i--) { const c = competenciaVizinha(chave, -i), x = coberturaCompetencia(rodadas, c); h.push({ chave: c, pct: x.pct, total: x.total, conferidas: x.conferidas }); }
  return h;
}

/* Pares que travam. A situação é reavaliada com a base de equivalências atual (pode ter mudado
 * depois da rodada). Linhas já conferidas ou com decisão não entram. */
function paresQueTravam(rodadas, chave, eqBase, { unidade = '*' } = {}) {
  const idx = indiceEquivalencias(eqBase), m = new Map();
  for (const r of ultimasRodadasConferencia(rodadas, chave)) {
    if (unidade !== '*' && String(r.unidadeCod) !== String(unidade)) continue;
    for (const l of r.linhas) {
      if (!l.titulo || !l.eq || !EQ_TRAVA.includes(l.eq) || l.estado === 'conferido' || l.decisao) continue;
      const k = `${chaveTitulo(l.titulo)}|${l.codigo}`;
      const e = m.get(k) || { chave: k, titulo: l.titulo, codigo: l.codigo, descMV: l.desc || '', linhas: 0, travadas: 0, prestadores: new Set(), unidades: new Set(), exemplos: [] };
      e.linhas++; if (l.eqTrava) e.travadas++;
      e.prestadores.add(`${r.prestadorCod} - ${r.prestadorNome}`); e.unidades.add(String(r.unidadeCod));
      if (e.exemplos.length < 3) { const [, conta, atend] = String(l.kd || '').split('|'); e.exemplos.push({ prestador: `${r.prestadorCod} - ${r.prestadorNome}`, unidade: r.unidadeCod, data: l.data, conta, atendimento: atend, desc: l.desc, eq: l.eq }); }
      m.set(k, e);
    }
  }
  return [...m.values()].map(e => {
    const av = avaliarProcedimento(idx, e.codigo, e.titulo);
    return { ...e, situacao: av.estado, relacao: av.relacao || null, prestadores: [...e.prestadores], unidades: [...e.unidades].sort((a, b) => +a - +b) };
  }).filter(e => EQ_TRAVA.includes(e.situacao)).sort((a, b) => b.travadas - a.travadas || b.linhas - a.linhas || a.titulo.localeCompare(b.titulo));
}

/* Validação em lote: valida a relação pendente ou cria e valida a que não existe (com responsável).
 * Conflito não entra (precisa «desfazer conflito»). Devolve quantas foram validadas. */
function validarParesEmLote(eqBase, pares, responsavel, motivo, competencia) {
  if (!responsavel) throw new Error('Informe o responsável antes de validar equivalências.');
  let n = 0;
  for (const p of pares) {
    if (p.situacao === 'conflito') continue;
    let rel = eqBase.itens.find(e => e.codigo === p.codigo && chaveTitulo(e.titulo) === chaveTitulo(p.titulo) && e.status !== 'desativada');
    if (!rel) {
      rel = novaRelacao({ codigo: p.codigo, titulo: p.titulo, descMV: p.descMV, justificativa: motivo, origem: `validação em lote (${responsavel})` });
      eqBase.itens.push(rel); eqBase.revisao++;
    }
    n += alterarStatusEq(eqBase, [rel.id], 'validada', responsavel, motivo, competencia);
  }
  return n;
}

/* Efetividade das regras compostas na competência (pedido de 04/11/2026): a partir das últimas rodadas,
 * quantas linhas e contas cada regra sustentou, quantas ficaram com composição incompleta e quantas sobraram. */
function efetividadeCompostas(rodadas, chave) {
  const m = new Map(), pegar = id => m.get(id) || m.set(id, { linhas: 0, contas: new Set(), falta: 0, sobra: 0, exemplos: [] }).get(id);
  for (const r of ultimasRodadasConferencia(rodadas, chave)) for (const l of r.linhas) {
    const [, conta, atend] = String(l.kd || '').split('|');
    if (l.composta) { const e = pegar(l.composta); if (l.estado === 'conferido' || l.estado === 'ressalva') { e.linhas++; e.contas.add(`${r.prestadorCod}|${conta}|${atend}`); if (l.compostaFalta) e.falta++; }
      if (e.exemplos.length < 8) e.exemplos.push({ prestador: `${r.prestadorCod} - ${r.prestadorNome}`, unidade: r.unidadeCod, data: l.data, conta, atendimento: atend, codigo: l.codigo, desc: l.desc, estado: l.estado, falta: !!l.compostaFalta }); }
    if (l.compostaSobra) pegar(l.compostaSobra).sobra++;
  }
  return m;
}
