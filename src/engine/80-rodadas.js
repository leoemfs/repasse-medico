/* ============================================================
 * Rodadas: cada execução é registrada com entradas, versões e resultado (RN-186).
 * O registro guarda só chaves de linha e estados, sem nomes de pacientes.
 * ============================================================ */
function registroRodada(res, ctx) {
  const linhasMV = res.tipo === 'conferencia' ? res.linhas.filter(x => x.r) : res.linhas;
  return {
    id: novoId('rod'), tipo: res.tipo, em: agoraISO(), operador: ctx.operador || '',
    arquivos: ctx.arquivos, unidadeCod: ctx.unidadeCod, prestadorCod: ctx.relatorio.cab.prestadorCod, prestadorNome: ctx.relatorio.cab.prestadorNome,
    repasse: ctx.relatorio.cab.repasse, competencia: ctx.relatorio.cab.competencia, chaveCompetencia: ctx.chaveCompetencia || '', descricao: ctx.relatorio.cab.descricao,
    parametros: ctx.parametros, versoes: { motor: MOTOR_VERSAO, equivalencias: res.eqRevisao, configuracao: ctx.cfgRevisao },
    contagens: res.tipo === 'conferencia' ? Object.fromEntries(Object.entries(res.porStatus).map(([k, v]) => [k, v.n])) : Object.fromEntries(Object.entries(res.porEstado).map(([k, v]) => [k, v.n])),
    // Por linha, sem nome de paciente: estado, valores e o que o fechamento precisa (grupo, descrição, convênio, tipo de item).
    linhas: linhasMV.map(x => ({ chave: x.r.chave, estado: x.status || x.estado, medico: x.medico || '', codigo: x.r.codigo, vlRepasse: x.r.vlRepasse,
      vlTotal: x.r.vlTotal, quant: x.r.quant, grupo: x.r.grupoNome, desc: x.r.procDesc, convenio: x.r.convenio, tipoItem: x.tipo || '',
      kd: chaveMVDecisao(x.r), kl: chaveLaudoDecisao(x.l || x.laudo), decisao: x.decisao?.tipo || '' })),
    aceite: null
  };
}

// Rodada anterior comparável: mesma competência, tipo, unidade e prestador do cabeçalho.
function rodadaAnterior(rodadas, atual) {
  return rodadas.filter(r => r.id !== atual.id && competenciaDaRodada(r) === competenciaDaRodada(atual) && r.tipo === atual.tipo && r.unidadeCod === atual.unidadeCod && r.prestadorCod === atual.prestadorCod && r.em < atual.em)
    .sort((a, b) => b.em.localeCompare(a.em))[0] || null;
}

/* Compara duas rodadas pela chave estável da linha (RN-212). A nova extração é evidência
 * de mudança nos dados; não prova quem fez a correção no sistema externo. */
function compararRodadas(ant, atual) {
  const A = new Map(ant.linhas.map(l => [l.chave, l])), B = new Map(atual.linhas.map(l => [l.chave, l]));
  const grupos = { agoraIdentificados: [], continuamPendentes: [], mudaramEstado: [], mudaramMedico: [], desapareceram: [], novos: [], semMudanca: [] };
  const ok = e => e === 'identificado' || e === 'conferido';
  for (const [k, b] of B) {
    const a = A.get(k);
    if (!a) { grupos.novos.push(b); continue; }
    if (a.estado !== b.estado) { (ok(b.estado) && !ok(a.estado) ? grupos.agoraIdentificados : grupos.mudaramEstado).push({ antes: a, depois: b }); continue; }
    if (a.medico !== b.medico) { grupos.mudaramMedico.push({ antes: a, depois: b }); continue; }
    (ok(b.estado) ? grupos.semMudanca : grupos.continuamPendentes).push(b);
  }
  for (const [k, a] of A) if (!B.has(k)) grupos.desapareceram.push(a);
  return grupos;
}
