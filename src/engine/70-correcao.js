/* ============================================================
 * Motor de identificação / correção de prestador (RN-205 a RN-214)
 * Independente da conferência cruzada. Identifica o médico do laudo somente com:
 *   nome do paciente idêntico ou truncado + data dentro da tolerância + equivalência TUSS VALIDADA.
 * Nunca sugere prestador para casos não identificados.
 * ============================================================ */
const ESTADO_CORR = {
  identificado: { nome: 'Prestador identificado', cor: 'C6EFCE', ordem: 1 },
  'nao-identificado': { nome: 'Prestador não identificado', cor: 'FFC7CE', ordem: 2 },
  conflito: { nome: 'Pendente por conflito', cor: 'FFEB9C', ordem: 3 },
  insuficiente: { nome: 'Dados insuficientes', cor: 'D9D9D9', ordem: 4 }
};
const MOTIVOS_CORR = {
  'item-nao-procedimental': 'Item não procedimental: sem regra de identificação',
  'sem-laudo': 'Nenhum laudo do paciente na data',
  'so-nome-semelhante': 'Só há laudo com nome apenas semelhante',
  'eq-nao-validada': 'Laudo encontrado, mas equivalência TUSS não validada',
  'eq-conflito': 'Equivalência TUSS em conflito',
  'medicos-diferentes': 'Laudos validados de médicos diferentes',
  'laudo-sem-medico': 'Laudo sem nome do médico',
  'mv-incompleto': 'Linha do MV sem paciente, data ou código',
  'outra-data': 'Laudo do paciente só em outra data'
};

function corrigirPrestador(relatorio, apolo, cfg, eqBase, opc) {
  const tol = +opc.tol, minTrunc = +cfg.parametros.minTruncamento;
  const idx = indiceEquivalencias(eqBase), idxPrest = indicePrestadores(cfg);
  const Lun = laudosDaUnidade(apolo, cfg, opc.unidadeCod);
  const ixNome = indiceNomes(Lun, l => l.dia, l => l.pn);
  const linhas = [], ocorrencias = new Map(), usoLaudo = new Map();

  for (const r of relatorio.regs) {
    const cls = classificarItem(r, cfg.classificacao);
    const o = { r, tipo: cls.tipo, regraTipo: cls.regra, estado: '', motivo: '', detalhe: '', medico: '', prestador: null, viaPrestador: '', evidencias: [], alertas: [] };
    linhas.push(o);
    if (cls.tipo !== 'procedimento') { o.estado = 'nao-identificado'; o.motivo = 'item-nao-procedimental'; o.detalhe = `${TIPOS_ITEM[cls.tipo]} (${r.grupoNome || 'sem grupo'}): o motor só identifica prestador de procedimentos.`; continue; }
    const pn = norm(r.paciente), dia = diaSerial(r.data), mods = modalidadesDoGrupo(r.grupoNome);
    if (!pn || dia === null || !r.codigo) { o.estado = 'insuficiente'; o.motivo = 'mv-incompleto'; o.detalhe = 'A linha do MV não traz paciente, data ou código legível.'; continue; }
    const seguros = [], semelhantes = [];
    for (const l of ixNome.candidatos(pn, dia, tol)) {
      if (mods && !mods.includes(l.modalidade)) continue;
      const nm = nivelNome(pn, l.pn, minTrunc);
      if (nm >= 2) seguros.push({ l, nm, dd: Math.abs(dia - l.dia), proc: avaliarProcedimento(idx, r.codigo, l.titulo, { unidade: opc.unidadeCod, convenio: r.convenio, modalidade: l.modalidade }) });
      else if (nm === 1) semelhantes.push(l);
    }
    const validos = seguros.filter(c => c.proc.estado === 'validada');
    const emConflito = seguros.filter(c => c.proc.estado === 'conflito');
    o.evidencias = seguros.map(c => ({ titulo: c.l.titulo, data: c.l.data, nm: c.nm, dd: c.dd, eq: c.proc.estado, idLaudo: c.l.idLaudo, linhaPlanilha: c.l.linhaPlanilha }));
    if (!seguros.length) {
      o.estado = 'nao-identificado';
      if (semelhantes.length) { o.motivo = 'so-nome-semelhante'; o.detalhe = `${semelhantes.length} laudo(s) com nome apenas semelhante na data: semelhança não identifica prestador (RN-206).`; }
      else {
        // Evidência objetiva, sem nomear médico: existe laudo do paciente em outra data próxima?
        let perto = null;
        for (let d = 1; d <= 7 && !perto; d++) for (const s of [dia - d, dia + d]) for (const l of ixNome.candidatos(pn, s, 0)) if (!perto && nivelNome(pn, l.pn, minTrunc) >= 2 && (!mods || mods.includes(l.modalidade))) perto = d;
        o.motivo = perto ? 'outra-data' : 'sem-laudo';
        o.detalhe = perto ? `Há laudo do paciente a ${perto} dia(s) da data do MV, fora da tolerância de ${tol} dia(s).` : `Nenhum laudo do paciente na unidade em ±${tol} dia(s) com modalidade compatível.`;
      }
      continue;
    }
    if (validos.some(c => !c.l.mn)) { o.estado = 'insuficiente'; o.motivo = 'laudo-sem-medico'; o.detalhe = 'O laudo compatível não tem NAME_MEDICO preenchido.'; continue; }
    const medicos = [...new Set(validos.map(c => c.l.mn))];
    const medicosConflito = [...new Set(emConflito.map(c => c.l.mn))];
    if (medicos.length === 1 && !medicosConflito.some(m => m !== medicos[0])) {
      const c = validos.sort((a, b) => a.dd - b.dd || b.nm - a.nm)[0];
      o.estado = 'identificado'; o.medico = c.l.medico; o.laudo = c.l;
      o.detalhe = `${c.nm === 3 ? 'Nome idêntico' : 'Nome truncado compatível'}, ${c.dd ? `data a ${c.dd} dia(s)` : 'mesma data'}, «${c.l.titulo}» validado para ${r.codigo} (${c.proc.relacao ? (c.proc.relacao.responsavel || 'sem responsável') : c.proc.composta ? `regra composta «${nomeComposta(c.proc.composta)}»${c.proc.composta.responsavel ? `, ${c.proc.composta.responsavel}` : ''}` : 'sem responsável'}).`;
      if (c.dd) o.alertas.push(`Data do laudo difere ${c.dd} dia(s)`);
      if (validos.length > 1) o.alertas.push(`${validos.length} laudos compatíveis do mesmo médico`);
      const pm = prestadorDoMedico(idxPrest, c.l.medico);
      if (pm.estado === 'ok') { o.prestador = pm.prestador; o.viaPrestador = pm.via; }
      else if (pm.estado === 'conflito') o.alertas.push(`Nome do médico ligado a mais de um código de prestador: ${pm.candidatos.map(p => p.cod).join(', ')}`);
      else o.alertas.push('Médico sem código de prestador cadastrado (Bases → Prestadores)');
      if (o.prestador && String(o.prestador.cod) === String(r.prestadorCod)) o.alertas.push('Prestador identificado é o mesmo do cabeçalho do relatório');
      if (o.prestador?.naoRealizaRepasse) o.alertas.push('Prestador marcado como «não realiza repasse»');
      (usoLaudo.get(c.l.i) || usoLaudo.set(c.l.i, []).get(c.l.i)).push(o);
      continue;
    }
    if (medicos.length > 1 || medicosConflito.length) {
      o.estado = 'conflito';
      o.motivo = medicos.length > 1 ? 'medicos-diferentes' : 'eq-conflito';
      o.detalhe = medicos.length > 1 ? `Laudos validados de ${medicos.length} médicos diferentes para a mesma linha: sem desempate automático (RN-209).`
        : `Equivalência em conflito: ${emConflito[0].proc.motivo}.`;
      continue;
    }
    // Laudos do paciente existem, mas nenhum com equivalência validada para o código.
    o.estado = 'nao-identificado'; o.motivo = 'eq-nao-validada';
    const titulos = [...new Set(seguros.map(c => c.l.titulo))];
    o.detalhe = `Laudo(s) do paciente na data, sem equivalência validada para ${r.codigo}: ${titulos.map(t => `«${t}»`).join(', ')}.`;
    for (const c of seguros) {
      const k = `${r.codigo}|${chaveTitulo(c.l.titulo)}`;
      const e = ocorrencias.get(k) || { codigo: r.codigo, descMV: r.procDesc, titulo: c.l.titulo, estadoEq: c.proc.estado, n: 0 };
      e.n++; ocorrencias.set(k, e);
    }
  }
  for (const lista of usoLaudo.values()) {
    const cods = new Set(lista.map(o => o.r.codigo));
    if (lista.length > 1 && cods.size > 1) lista.forEach(o => o.alertas.push(`O mesmo laudo sustenta ${lista.length} linhas com códigos diferentes`));
  }
  const porEstado = {}; for (const k of Object.keys(ESTADO_CORR)) porEstado[k] = { n: 0, vlRepasse: 0, vlTotal: 0 };
  for (const o of linhas) { const s = porEstado[o.estado]; s.n++; s.vlRepasse += o.r.vlRepasse; s.vlTotal += o.r.vlTotal; }
  for (const s of Object.values(porEstado)) { s.vlRepasse = r2(s.vlRepasse); s.vlTotal = r2(s.vlTotal); }
  const porMedico = [...linhas.filter(o => o.estado === 'identificado').reduce((m, o) => {
    const k = o.medico; const e = m.get(k) || { medico: o.medico, cod: o.prestador?.cod || '', n: 0, vlRepasse: 0 }; e.n++; e.vlRepasse = r2(e.vlRepasse + o.r.vlRepasse); m.set(k, e); return m;
  }, new Map()).values()].sort((a, b) => b.n - a.n);
  return {
    tipo: 'correcao', linhas, porEstado, porMedico, porMotivo: Object.fromEntries([...contar(linhas.filter(o => o.motivo), o => o.motivo)]),
    porTipo: Object.fromEntries([...contar(linhas, o => o.tipo)]), ocorrencias: [...ocorrencias.values()].sort((a, b) => b.n - a.n),
    nLaudosUnidade: Lun.length, eqRevisao: eqBase.revisao, eqValidadas: eqBase.itens.filter(e => e.status === 'validada').length
  };
}
