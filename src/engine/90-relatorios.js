/* ============================================================
 * Relatórios Excel. Códigos TUSS sempre como texto; dados originais preservados;
 * registros únicos e ocorrências de marcadores contados separadamente (RN-187, RN-211, RN-215).
 * ============================================================ */
const AVISO_LGPD = 'Este arquivo contém dados pessoais e de saúde (LGPD). Armazene, compartilhe e descarte conforme a política da empresa.';
const T = { fmt: 'text' };
const colunasMV = ['Linha MV', 'Chave da linha', 'Página', 'Código TUSS (MV)', 'Descrição MV', 'Grupo de procedimento', 'Remessa', 'Conta', 'Atendimento', 'Paciente (MV)', 'Convênio (MV)', 'Data (MV)', 'Quant.', 'Vl Repasse', '% Repasse', 'Vl Total', 'Tipo de item'];
const celulasMV = (r, tipo, f = {}) => r ? [
  { v: r.seq, st: f }, { v: r.chave, st: { ...f, ...T } }, { v: r.pagina, st: f }, { v: r.codigo, st: { ...f, ...T } }, { v: r.procDesc, st: f }, { v: r.grupoNome, st: f },
  { v: r.remessa, st: { ...f, ...T } }, { v: r.conta, st: { ...f, ...T } }, { v: r.atendimento, st: { ...f, ...T } }, { v: r.paciente, st: f }, { v: r.convenio, st: f },
  { v: r.data, st: f }, { v: r.quant, st: f }, { v: r.vlRepasse, st: { ...f, fmt: 'money' } }, { v: r2(r.pct * 10000) / 10000, st: { ...f, fmt: 'pct' } }, { v: r.vlTotal, st: { ...f, fmt: 'money' } }, { v: TIPOS_ITEM[tipo] || tipo || '', st: f }
] : colunasMV.map(() => ({ v: '', st: f }));
const colunasLaudo = ['Laudo: ID', 'Laudo: linha da planilha', 'Laudo: unidade', 'Laudo: paciente', 'Laudo: ID paciente', 'Laudo: TITLE', 'Laudo: STUDY_DESCRIPTION', 'Laudo: data', 'Laudo: convênio', 'Laudo: modalidade', 'Laudo: médico'];
const celulasLaudo = (l, f = {}) => l ? [
  { v: l.idLaudo, st: { ...f, ...T } }, { v: l.linhaPlanilha, st: f }, { v: l.unidade, st: f }, { v: l.paciente, st: f }, { v: l.idPac, st: { ...f, ...T } }, { v: l.titulo, st: f },
  { v: l.descricao, st: f }, { v: l.data || '', st: f }, { v: l.convenio, st: f }, { v: l.modalidade, st: f }, { v: l.medico, st: f }
] : colunasLaudo.map(() => ({ v: '', st: f }));
const linhasMeta = meta => meta.map(([a, b]) => [{ v: a, st: { b: true } }, { v: b ?? '', st: { wrap: true } }]);

// Excel da extração (MV original), um por PDF.
function xlsxExtracao(rel) {
  const linhas = [cabecalho([...colunasMV, 'Repetição'])];
  for (const r of rel.regs) linhas.push([...celulasMV(r, ''), r.repeticao ? `repetida ${r.repeticao.i}/${r.repeticao.n}` : '']);
  const meta = [cabecalho(['Item', 'Valor']), ...linhasMeta([
    ['Arquivo', rel.arquivo], ['Prestador', `${rel.cab.prestadorCod} - ${rel.cab.prestadorNome}`], ['Repasse', `${rel.cab.repasse} · ${rel.cab.descricao}`],
    ['Competência', rel.cab.competencia], ['Linhas extraídas', rel.regs.length], ['Conferência de totais', rel.ok ? 'OK — somas iguais aos totais impressos' : 'COM AVISOS'],
    ...rel.avisos.map(a => ['Aviso', a]), ...rel.notas.map(n => ['Nota', n]), ['Privacidade', AVISO_LGPD]])];
  const conf = [cabecalho(['Conferência', 'Vl Repasse (PDF)', 'Vl Total (PDF)', 'Vl Repasse (extraído)', 'Vl Total (extraído)', 'Resultado']),
    ...rel.conferencias.map(c => [c.rotulo, { v: c.impressoRepasse, st: { fmt: 'money' } }, { v: c.impressoTotal, st: { fmt: 'money' } }, { v: c.extraidoRepasse, st: { fmt: 'money' } }, { v: c.extraidoTotal, st: { fmt: 'money' } }, { v: c.ok ? 'OK' : 'DIVERGENTE', st: { fill: c.ok ? 'C6EFCE' : 'FFC7CE' } }])];
  return criarXlsx([
    { nome: 'MV original', larguras: [8, 30, 7, 12, 50, 28, 9, 10, 11, 32, 28, 11, 7, 11, 9, 11, 22, 12], linhas, filtro: true },
    { nome: 'Totais', larguras: [70, 16, 16, 18, 18, 14], linhas: conf, filtro: false },
    { nome: 'Informações', larguras: [26, 100], linhas: meta, filtro: false, congelar: false }
  ]);
}

/* Excel da conferência cruzada (SOL-F23). Aba principal com o MV lado a lado com o Apolo e a
 * decisão da competência; o técnico (faixa, equivalência, chaves, candidatos) fica em abas à parte.
 * As decisões (NC, considerar no repasse) são tomadas na ferramenta; aqui só aparecem. */
const COR_DECISAO = { nc: 'C6EFCE', considerar: 'E4DFEC' };
function xlsxConferencia(res, ctx) {
  const st = s => ({ fill: STATUS_CONF[s].cor });
  const SIT = { ...CAB, fill: '404040' }, AP = { ...CAB, fill: '2E7D32' }, OBS = { ...CAB, fill: '7F7F7F' };
  const cabPrincipal = [...cabecalho(['Status', 'Decisão na competência'], SIT),
    ...cabecalho(['Unidade MV', 'Paciente MV', 'Cód. TUSS MV', 'Descrição do procedimento MV', 'Data MV', 'Convênio MV', 'Grupo de procedimento MV', 'Médico MV', 'Vl Repasse']),
    ...cabecalho(['Unidade Apolo', 'Paciente Apolo', 'Título do laudo (TITLE)', 'Descrição do estudo (STUDY)', 'Data Apolo', 'Convênio Apolo', 'Modalidade Apolo', 'Médico Apolo'], AP),
    ...cabecalho(['Ressalvas', 'Observações e análise'], OBS)];
  const textoDecisao = d => d ? `${TIPOS_DECISAO[d.tipo]}${d.justificativa ? ': ' + d.justificativa : ''}${d.tipo === 'nc' && d.situacao ? ` (${SITUACAO_NC[d.situacao] || d.situacao})` : ''}` : '';
  const linhaPrincipal = x => {
    const r = x.r, l = x.l, f = st(x.status), dec = x.decisao;
    return [{ v: STATUS_CONF[x.status].nome, st: { ...f, b: true } }, { v: textoDecisao(dec), st: dec ? { fill: COR_DECISAO[dec.tipo], b: true } : {} },
      r ? ctx.unidadeNome : '', r?.paciente || '', { v: r?.codigo || '', st: T }, r?.procDesc || '', r?.data || '', r?.convenio || '', r?.grupoNome || '', r ? r.prestadorNome : '', r ? { v: r.vlRepasse, st: { fmt: 'money' } } : '',
      l?.unidade || '', l?.paciente || '', l?.titulo || '', l?.descricao || '', l?.data || '', l?.convenio || '', l?.modalidade || '', l?.medico || '',
      { v: [...x.marcadores].map(m => MARCADORES[m]).join(' | '), st: { wrap: true } }, { v: x.motivos.join(' | '), st: { wrap: true } }];
  };
  const largP = [24, 30, 24, 32, 12, 46, 11, 28, 24, 28, 12, 22, 32, 40, 40, 11, 28, 10, 28, 34, 80];
  const pendente = x => x.status !== 'conferido' && !x.decisao;
  // Resumo
  const R = [cabecalho(['Categoria principal', 'Registros únicos', 'Vl Repasse', 'Vl Total'])];
  const ordem = Object.keys(STATUS_CONF).sort((a, b) => STATUS_CONF[a].ordem - STATUS_CONF[b].ordem);
  for (const k of ordem) { const s = res.porStatus[k]; R.push([{ v: STATUS_CONF[k].nome, st: { fill: STATUS_CONF[k].cor, b: true } }, s.n, { v: s.vlRepasse, st: { fmt: 'money' } }, { v: s.vlTotal, st: { fmt: 'money' } }]); }
  const tot = ordem.reduce((a, k) => [a[0] + res.porStatus[k].n, a[1] + res.porStatus[k].vlRepasse, a[2] + res.porStatus[k].vlTotal], [0, 0, 0]);
  R.push([{ v: 'TOTAL de registros únicos', st: { b: true, bt: true } }, { v: tot[0], st: { b: true, bt: true } }, { v: r2(tot[1]), st: { b: true, bt: true, fmt: 'money' } }, { v: r2(tot[2]), st: { b: true, bt: true, fmt: 'money' } }]);
  R.push([], cabecalho(['Decisões na competência', 'Registros']));
  for (const [k, n] of Object.entries(res.porDecisao || {})) R.push([{ v: TIPOS_DECISAO[k], st: { fill: COR_DECISAO[k], b: true } }, n]);
  R.push([{ v: 'Pendentes (sem conferência e sem decisão)', st: { b: true } }, res.linhas.filter(pendente).length]);
  R.push([], cabecalho(['Ressalva (ocorrências)', 'Registros com a ressalva']));
  for (const [k, n] of Object.entries(res.porMarcador)) if (n) R.push([MARCADORES[k], n]);
  R.push([{ v: 'Um registro pode ter várias ressalvas: a soma das ocorrências não é o total de registros.', st: { wrap: true } }]);
  R.push([], cabecalho(['Tipo de item (linhas do MV)', 'Linhas']));
  for (const [k, n] of Object.entries(res.porTipo)) R.push([TIPOS_ITEM[k] || k, n]);
  // Informações
  const I = [cabecalho(['Item', 'Valor']), ...linhasMeta([
    ['Gerado em', new Date().toLocaleString('pt-BR')], ['Operador', ctx.operador || '(não informado)'], ['Competência', ctx.chaveCompetencia ? rotuloCompetencia(ctx.chaveCompetencia) : ''], ['Relatório MV', ctx.relatorio.arquivo],
    ['Prestador do relatório', `${ctx.relatorio.cab.prestadorCod} - ${ctx.relatorio.cab.prestadorNome}`], ['Repasse', `${ctx.relatorio.cab.repasse} · ${ctx.relatorio.cab.descricao}`],
    ['Competência do repasse (MV)', ctx.relatorio.cab.competencia], ['Planilha de laudos', ctx.apoloNome], ['Unidade (escolhida na sessão)', ctx.unidadeNome],
    ['Médico(s) do laudo no escopo', ctx.medicosNomes || 'Todos os médicos'], ['Período de produção considerado', res.periodo ? `${fmtData(res.periodo[0])} a ${fmtData(res.periodo[1])}` : '—'],
    ['Modalidades do relatório', res.modalidades.join(', ') || '—'], ['Tolerância de data (dias)', ctx.parametros.tol],
    ['Linhas do MV', res.nMV], ['Procedimentos do MV', res.nProcedimentos], ['Laudos da unidade', res.nLaudosUnidade], ['Laudos no escopo «Só no laudo»', res.nLaudosEscopo], ['Pares formados', res.nPares],
    ['Equivalências validadas usadas (revisão da base)', `${res.eqValidadas} validadas · revisão ${res.eqRevisao}`], ['Versão do motor', MOTOR_VERSAO], ['Rodada', ctx.rodadaId || ''],
    ['Leitura', '«Conferido» = existe um laudo único e consistente; não prova que o valor está correto. Valores não são critério desta conferência.'],
    ['Decisões', 'NC e «considerar no repasse» são registradas na ferramenta (aba Conferência, detalhe da linha) e valem para toda nova rodada da competência.'], ['Privacidade', AVISO_LGPD]])];
  // Técnico: chaves, faixa do par e equivalência usada
  const cabTec = [...cabecalho(['Status', 'Origem', 'Linha MV', 'Chave da linha', 'Página', 'Remessa', 'Conta', 'Atendimento', 'Quant.', '% Repasse', 'Vl Total', 'Tipo de item']),
    ...cabecalho(['Laudo: ID', 'Laudo: linha da planilha', 'Laudo: ID paciente'], AP), ...cabecalho(['Faixa do par', 'Equivalência usada', 'Responsável pela validação'], OBS)];
  const linhaTec = x => {
    const r = x.r, l = x.l, p = x.par;
    return [STATUS_CONF[x.status].nome, x.origem, r?.seq || '', { v: r?.chave || '', st: T }, r?.pagina || '', { v: r?.remessa || '', st: T }, { v: r?.conta || '', st: T }, { v: r?.atendimento || '', st: T },
      r?.quant ?? '', r ? { v: r2(r.pct * 10000) / 10000, st: { fmt: 'pct' } } : '', r ? { v: r.vlTotal, st: { fmt: 'money' } } : '', TIPOS_ITEM[x.tipo] || x.tipo || '',
      { v: l?.idLaudo || '', st: T }, l?.linhaPlanilha || '', { v: l?.idPac || '', st: T },
      p ? p.tier : '', p?.proc?.relacao ? `${p.proc.relacao.codigo} × ${p.proc.relacao.titulo} (${STATUS_EQ[p.proc.relacao.status]})` : '', p?.proc?.relacao?.responsavel || ''];
  };
  const C = [cabecalho(['Linha MV', 'Código TUSS', 'Paciente (MV)', 'Data (MV)', 'Categoria final', 'Faixa', 'TITLE candidato', 'Médico', 'Data laudo', 'Nível do nome', 'Dias de diferença', 'Equivalência', 'Associado à linha?'])];
  for (const x of res.linhas) if (x.r) for (const c of x.cands) C.push([x.r.seq, { v: x.r.codigo, st: T }, x.r.paciente, x.r.data, STATUS_CONF[x.status].nome, c.tier, c.l.titulo, c.l.medico, c.l.data || '', ['', 'semelhante', 'truncado', 'idêntico'][c.nm], c.dd, c.proc.estado, x.l === c.l ? 'SIM' : 'NÃO']);
  return criarXlsx([
    { nome: 'Conferência', larguras: largP, linhas: [cabPrincipal, ...res.linhas.map(linhaPrincipal)], filtro: true },
    { nome: 'Pendências', larguras: largP, linhas: [cabPrincipal, ...res.linhas.filter(pendente).map(linhaPrincipal)], filtro: true },
    { nome: 'Resumo', larguras: [52, 22, 16, 16], linhas: R, filtro: false, congelar: false },
    { nome: 'Informações', larguras: [44, 110], linhas: I, filtro: false, congelar: false },
    { nome: 'Técnico', larguras: [24, 8, 8, 30, 7, 10, 11, 12, 7, 9, 12, 22, 12, 10, 12, 8, 60, 24], linhas: [cabTec, ...res.linhas.map(linhaTec)], filtro: true },
    { nome: 'Por procedimento', larguras: [12, 50, 12, 12, 12, 22], linhas: [cabecalho(['Código TUSS', 'Descrição MV', 'Linhas no MV', 'Conferidas', 'Com ressalva', 'Laudos do escopo com título validado']), ...res.porCodigo.map(e => [{ v: e.codigo, st: T }, e.desc, e.mv, e.conferido, e.ressalva, e.laudosValidados])], filtro: true },
    { nome: 'Títulos sem validação', larguras: [70, 12], linhas: [cabecalho(['TITLE do Apolo no escopo sem nenhuma equivalência validada', 'Laudos']), ...res.titulosSemValidacao.map(([t, n]) => [t, n])], filtro: true },
    { nome: 'Candidatos', larguras: [8, 12, 30, 11, 24, 7, 50, 30, 11, 12, 10, 14, 10], linhas: C, filtro: true },
    { nome: 'MV original', larguras: [8, 30, 7, 12, 50, 28, 9, 10, 11, 32, 28, 11, 7, 11, 9, 11, 22], linhas: [cabecalho(colunasMV), ...res.linhas.filter(x => x.r).sort((a, b) => a.r.seq - b.r.seq).map(x => celulasMV(x.r, x.tipo))], filtro: true }
  ]);
}

/* Excel da correção de prestador: feito para corrigir no MV. A aba principal tem só o que
 * precisa (status, atendimento/conta, procedimento e paciente do MV, médico e laudo do Apolo)
 * e o motivo fica no fim; o técnico vai para abas à parte. Não identificado não recebe médico (RN-206). */
function xlsxCorrecao(res, ctx) {
  const SIT = { ...CAB, fill: '404040' }, AP = { ...CAB, fill: '2E7D32' }, OBS = { ...CAB, fill: '7F7F7F' };
  const cab = [...cabecalho(['Status'], SIT),
    ...cabecalho(['Atendimento MV', 'Conta MV', 'Cód. TUSS MV', 'Descrição do procedimento MV', 'Paciente MV', 'Data MV', 'Convênio MV', 'Vl Repasse']),
    ...cabecalho(['Médico do laudo (Apolo)', 'Cód. prestador', 'Paciente Apolo', 'Data Apolo', 'Título do laudo (TITLE)', 'Descrição do estudo (STUDY)'], AP),
    ...cabecalho(['Observações', 'Alertas'], OBS)];
  const linha = o => {
    const r = o.r, l = o.estado === 'identificado' ? o.laudo : null, f = { fill: ESTADO_CORR[o.estado].cor };
    return [{ v: ESTADO_CORR[o.estado].nome, st: { ...f, b: true } },
      { v: r.atendimento, st: T }, { v: r.conta, st: T }, { v: r.codigo, st: T }, r.procDesc, r.paciente, r.data, r.convenio, { v: r.vlRepasse, st: { fmt: 'money' } },
      { v: l ? o.medico : '', st: l ? { b: true } : {} }, { v: o.prestador?.cod || '', st: T }, l?.paciente || '', l?.data || '', l?.titulo || '', l?.descricao || '',
      { v: [MOTIVOS_CORR[o.motivo], o.detalhe].filter(Boolean).join(' — '), st: { wrap: true } }, { v: o.alertas.join(' | '), st: { wrap: true } }];
  };
  const larg = [24, 13, 12, 12, 46, 32, 11, 28, 12, 32, 10, 32, 11, 40, 40, 80, 50];
  // Para corrigir no MV: identificados com médico diferente do prestador do relatório, agrupados por médico.
  const corrigir = res.linhas.filter(o => o.estado === 'identificado' && !(o.prestador && String(o.prestador.cod) === String(o.r.prestadorCod)))
    .sort((a, b) => a.medico.localeCompare(b.medico) || String(a.r.atendimento).localeCompare(String(b.r.atendimento)) || a.r.seq - b.r.seq);
  const R = [cabecalho(['Status', 'Registros', 'Vl Repasse', 'Vl Total'])];
  let n = 0;
  for (const [k, e] of Object.entries(ESTADO_CORR)) { const s = res.porEstado[k]; n += s.n; R.push([{ v: e.nome, st: { fill: e.cor, b: true } }, s.n, { v: s.vlRepasse, st: { fmt: 'money' } }, { v: s.vlTotal, st: { fmt: 'money' } }]); }
  R.push([{ v: 'TOTAL processado (linhas do MV)', st: { b: true, bt: true } }, { v: n, st: { b: true, bt: true } }]);
  R.push([{ v: n === ctx.relatorio.regs.length ? 'Reconciliado: soma dos estados = linhas do MV.' : 'ATENÇÃO: a soma dos estados difere das linhas do MV.', st: { b: true } }]);
  R.push([{ v: 'Linhas para corrigir no MV (médico do laudo diferente do prestador do relatório)', st: { b: true } }, corrigir.length]);
  R.push([], cabecalho(['Motivo (não identificados, conflitos e insuficientes)', 'Registros']));
  for (const [k, v] of Object.entries(res.porMotivo)) R.push([MOTIVOS_CORR[k] || k, v]);
  R.push([], cabecalho(['Médico identificado (Apolo)', 'Código do prestador', 'Linhas', 'Vl Repasse']));
  for (const m of res.porMedico) R.push([m.medico, { v: m.cod || 'sem cadastro', st: T }, m.n, { v: m.vlRepasse, st: { fmt: 'money' } }]);
  const I = [cabecalho(['Item', 'Valor']), ...linhasMeta([
    ['Gerado em', ctx.em], ['Operador', ctx.operador || '(não informado)'], ['Competência', ctx.chaveCompetencia ? rotuloCompetencia(ctx.chaveCompetencia) : ''], ['Relatório MV', ctx.relatorio.arquivo],
    ['Prestador do cabeçalho', `${ctx.relatorio.cab.prestadorCod} - ${ctx.relatorio.cab.prestadorNome}`], ['Repasse', `${ctx.relatorio.cab.repasse} · ${ctx.relatorio.cab.descricao}`],
    ['Planilha de laudos', ctx.apoloNome], ['Unidade (escolhida na sessão)', ctx.unidadeNome], ['Tolerância de data (dias)', ctx.parametros.tol],
    ['Equivalências validadas (revisão da base)', `${res.eqValidadas} · revisão ${res.eqRevisao}`], ['Versão do motor', MOTOR_VERSAO], ['Rodada', ctx.rodadaId || ''],
    ['Regra', 'Identificação só com nome idêntico ou truncado, data na tolerância e equivalência TUSS validada. Casos não identificados não recebem prestador sugerido (RN-206).'],
    ['Uso', 'Corrija no MV pela aba «Corrigir no MV» (agrupada por médico). Depois, extraia o relatório de novo e rode outra rodada para conferir o que mudou.'], ['Privacidade', AVISO_LGPD]])];
  const cabTec = [...cabecalho(['Status', 'Linha MV', 'Chave da linha', 'Página', 'Remessa', 'Quant.', '% Repasse', 'Vl Total', 'Grupo de procedimento', 'Tipo de item', 'Prestador do relatório']),
    ...cabecalho(['Laudo: ID', 'Laudo: linha da planilha', 'Origem do código do prestador', 'Laudos do paciente na data (equivalência)'], AP)];
  const linhaTec = o => { const r = o.r; return [ESTADO_CORR[o.estado].nome, r.seq, { v: r.chave, st: T }, r.pagina, { v: r.remessa, st: T }, r.quant, { v: r2(r.pct * 10000) / 10000, st: { fmt: 'pct' } }, { v: r.vlTotal, st: { fmt: 'money' } },
    r.grupoNome, TIPOS_ITEM[o.tipo] || o.tipo, `${r.prestadorCod} - ${r.prestadorNome}`, { v: o.laudo?.idLaudo || '', st: T }, o.laudo?.linhaPlanilha || '', o.viaPrestador,
    { v: o.evidencias.map(e => `«${e.titulo}» ${fmtData(e.data)} (${e.eq})`).join(' | '), st: { wrap: true } }]; };
  const O = [cabecalho(['Código TUSS (MV)', 'Descrição MV', 'TITLE encontrado no Apolo', 'Estado da equivalência', 'Ocorrências']), ...res.ocorrencias.map(o => [{ v: o.codigo, st: T }, o.descMV, o.titulo, o.estadoEq, o.n])];
  return criarXlsx([
    { nome: 'Corrigir no MV', larguras: larg, linhas: [cab, ...corrigir.map(linha)], filtro: true },
    { nome: 'Todas as linhas', larguras: larg, linhas: [cab, ...res.linhas.map(linha)], filtro: true },
    { nome: 'Não identificados', larguras: larg, linhas: [cab, ...res.linhas.filter(o => o.estado === 'nao-identificado').map(linha)], filtro: true },
    { nome: 'Conflitos e insuficientes', larguras: larg, linhas: [cab, ...res.linhas.filter(o => o.estado === 'conflito' || o.estado === 'insuficiente').map(linha)], filtro: true },
    { nome: 'Resumo', larguras: [70, 22, 16, 16], linhas: R, filtro: false, congelar: false },
    { nome: 'Informações', larguras: [40, 110], linhas: I, filtro: false, congelar: false },
    { nome: 'Equivalências a analisar', larguras: [12, 50, 60, 18, 12], linhas: O, filtro: true },
    { nome: 'Técnico', larguras: [24, 8, 30, 7, 10, 7, 9, 12, 28, 22, 34, 12, 10, 30, 80], linhas: [cabTec, ...res.linhas.map(linhaTec)], filtro: true }
  ]);
}

/* Não conformidades: as três abas da planilha manual da equipe (mesmas colunas) + situação e
 * observações no fim, e uma aba de indicadores. Reimportável pela própria aba de NCs. */
const COLUNAS_NC_EXPORT = {
  particular: ['UNIDADE', 'NATUREZA DA NÃO CONFORMIDADE', 'NOME DO PACIENTE', 'ID ou atendimento', 'RESPONSAVEL PELO FAT. DA CONTA', 'DATA', 'TITULO DO LAUDO', 'CONVE.', 'MOD.', 'NOME DO MEDICO'],
  convenio: ['UNIDADE', 'NATUREZA DA NÃO CONFORMIDADE', 'NOME DO PACIENTE', 'ID-ATENDIMENTO', 'RESPONSAVEL PELO FECHA. DA CONTA', 'DATA', 'TITULO DO LAUDO', 'CONVE.', 'MOD.', 'NOME DO MEDICO'],
  prestador: ['UNIDADE', 'PRESTADOR INCORRETO', 'NOME DO PACIENTE', 'ID', 'TITULO DO ESTUDO', 'DATA', 'TITULO DO LAUDO', 'CONVE.', 'MOD.', 'PRESTADOR CORRIGIDO']
};
const ABAS_NC = { particular: 'PARTICULAR', convenio: 'CONVENIOS (FAT)', prestador: 'Correção de prestadores' };
const COLUNAS_NC_EXTRA = ['SITUAÇÃO', 'IMPACTA PAGAMENTO', 'OBSERVAÇÕES', 'ENVIADA AO QUALIEX EM'];
const COR_SITUACAO_NC = { aberta: 'FFC7CE', enviada: 'DDEBF7', tratativa: 'E4DFEC', regularizada: 'C6EFCE', 'nao-procede': 'EDEDED' };
function xlsxNC(itens, chave, meta = {}) {
  const pac = nc => nc.anonimizada ? '(apagado pela retenção)' : nc.paciente;
  const dt = s => s ? paraData(s) : '';
  const linhaNC = nc => {
    const base = nc.categoria === 'prestador'
      ? [nc.unidade, { v: nc.prestadorIncorreto, st: T }, pac(nc), { v: nc.anonimizada ? '' : nc.idAtendimento, st: T }, nc.tituloEstudo, dt(nc.data), nc.titulo, nc.convenio, nc.modalidade, nc.prestadorCorrigido || nc.medico]
      : [nc.unidade, textoNatureza(nc), pac(nc), { v: nc.anonimizada ? '' : nc.idAtendimento, st: T }, nc.responsavel, dt(nc.data), nc.titulo, nc.convenio, nc.modalidade, nc.medico];
    return [...base, { v: SITUACAO_NC[nc.situacao], st: { fill: COR_SITUACAO_NC[nc.situacao] } }, nc.impactaPagamento ? 'SIM' : 'NÃO', nc.obs, dt(nc.enviadaEm)];
  };
  const ordem = (a, b) => (a.unidade || '').localeCompare(b.unidade || '') || (a.data || '').localeCompare(b.data || '');
  const abas = Object.keys(ABAS_NC).map(cat => ({
    nome: ABAS_NC[cat], filtro: true, larguras: cat === 'prestador' ? [22, 12, 34, 12, 40, 11, 40, 30, 7, 30, 18, 10, 40, 12] : [22, 50, 34, 12, 28, 11, 40, 30, 7, 30, 18, 10, 40, 12],
    linhas: [[...cabecalho(COLUNAS_NC_EXPORT[cat]), ...cabecalho(COLUNAS_NC_EXTRA, { ...CAB, fill: '5B5B5B' })], ...itens.filter(nc => nc.categoria === cat).sort(ordem).map(linhaNC)]
  }));
  const ind = indicadoresNC(itens), tot = Math.max(1, ind.total);
  const bloco = (titulo, pares) => [[{ v: titulo, st: { b: true, fill: 'D9E1F2' } }, { v: 'NCs', st: { b: true, fill: 'D9E1F2', al: 'center' } }, { v: '%', st: { b: true, fill: 'D9E1F2', al: 'center' } }],
    ...pares.map(([k, n]) => [k, n, { v: n / tot, st: { fmt: 'pct' } }]), []];
  const linhasInd = [
    [{ v: `Não conformidades — competência ${rotuloCompetencia(chave)} (produção ${producaoDaCompetencia(chave)})`, st: { b: true } }], [],
    ...linhasMeta([['Gerado em', new Date().toLocaleString('pt-BR')], ['Operador', meta.operador || ''], ['Total de NCs', ind.total], ['Impactam o pagamento', `${ind.impactam} (R$ ${fmtBR(ind.valorImpacto)} nas que vieram do MV)`],
      ...Object.entries(GRUPOS_PRAZO_NC).map(([k, g]) => [g.nome, `${ind.porPrazo[k].total} NCs · prazo de envio ${meta.prazos?.[k] ? fmtData(meta.prazos[k]) : '—'}`]),
      ['Trazidas de competências anteriores', ind.trazidas], ['Privacidade', AVISO_LGPD]]), [],
    ...bloco('Situação', Object.entries(ind.porSituacao).map(([k, n]) => [SITUACAO_NC[k], n])),
    ...bloco('Categoria', Object.entries(ind.porCategoria).map(([k, n]) => [CATEGORIA_NC[k], n])),
    ...bloco('Natureza', ind.porNatureza.map(([nome, n]) => [nome, n])),
    ...bloco('Responsável pelo fechamento da conta', ind.porResponsavel),
    ...bloco('Unidade', ind.porUnidade),
    ...bloco('Médico', ind.porMedico)
  ];
  return criarXlsx([...abas, { nome: 'Indicadores', larguras: [52, 40, 10], linhas: linhasInd, filtro: false, congelar: false }]);
}
