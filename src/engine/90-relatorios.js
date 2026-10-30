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

function xlsxConferencia(res, ctx) {
  const st = s => ({ fill: STATUS_CONF[s].cor });
  const cabConf = [...cabecalho(['Origem', 'Categoria principal', 'Marcadores', 'Motivo / evidências']), ...cabecalho(colunasMV), ...cabecalho(colunasLaudo, { ...CAB, fill: '2E7D32' }), ...cabecalho(['Faixa do par', 'Equivalência usada', 'Responsável pela validação'], { ...CAB, fill: '5B5B5B' })];
  const linhaConf = x => {
    const f = st(x.status), p = x.par;
    return [{ v: x.origem, st: f }, { v: STATUS_CONF[x.status].nome, st: { ...f, b: true } }, { v: [...x.marcadores].map(m => MARCADORES[m]).join(' | '), st: { ...f, wrap: true } }, { v: x.motivos.join(' | '), st: { ...f, wrap: true } },
      ...celulasMV(x.r, x.tipo, f), ...celulasLaudo(x.l, f),
      { v: p ? p.tier : '', st: f }, { v: p?.proc?.relacao ? `${p.proc.relacao.codigo} × ${p.proc.relacao.titulo} (${STATUS_EQ[p.proc.relacao.status]})` : '', st: f }, { v: p?.proc?.relacao?.responsavel || '', st: f }];
  };
  const larg = [8, 22, 34, 70, 8, 30, 7, 12, 46, 26, 9, 10, 11, 30, 26, 11, 7, 11, 9, 11, 20, 12, 10, 22, 30, 12, 40, 34, 11, 26, 10, 30, 8, 50, 22];
  const todas = [cabConf, ...res.linhas.map(linhaConf)];
  const abas = [];
  // Resumo
  const R = [cabecalho(['Categoria principal', 'Registros únicos', 'Vl Repasse', 'Vl Total'])];
  const ordem = Object.keys(STATUS_CONF).sort((a, b) => STATUS_CONF[a].ordem - STATUS_CONF[b].ordem);
  for (const k of ordem) { const s = res.porStatus[k]; R.push([{ v: STATUS_CONF[k].nome, st: { fill: STATUS_CONF[k].cor, b: true } }, s.n, { v: s.vlRepasse, st: { fmt: 'money' } }, { v: s.vlTotal, st: { fmt: 'money' } }]); }
  const tot = ordem.reduce((a, k) => [a[0] + res.porStatus[k].n, a[1] + res.porStatus[k].vlRepasse, a[2] + res.porStatus[k].vlTotal], [0, 0, 0]);
  R.push([{ v: 'TOTAL de registros únicos', st: { b: true, bt: true } }, { v: tot[0], st: { b: true, bt: true } }, { v: r2(tot[1]), st: { b: true, bt: true, fmt: 'money' } }, { v: r2(tot[2]), st: { b: true, bt: true, fmt: 'money' } }]);
  R.push([], cabecalho(['Marcador (ocorrências)', 'Registros com o marcador']));
  for (const [k, n] of Object.entries(res.porMarcador)) if (n) R.push([MARCADORES[k], n]);
  R.push([{ v: 'Um registro pode ter vários marcadores: a soma das ocorrências não é o total de registros.', st: { wrap: true } }]);
  R.push([], cabecalho(['Tipo de item (linhas do MV)', 'Linhas']));
  for (const [k, n] of Object.entries(res.porTipo)) R.push([TIPOS_ITEM[k] || k, n]);
  R.push([], ...linhasMeta([
    ['Gerado em', new Date().toLocaleString('pt-BR')], ['Operador', ctx.operador || '(não informado)'], ['Relatório MV', ctx.relatorio.arquivo],
    ['Prestador do relatório', `${ctx.relatorio.cab.prestadorCod} - ${ctx.relatorio.cab.prestadorNome}`], ['Repasse', `${ctx.relatorio.cab.repasse} · ${ctx.relatorio.cab.descricao}`],
    ['Competência do repasse', ctx.relatorio.cab.competencia], ['Planilha de laudos', ctx.apoloNome], ['Unidade (escolhida na sessão)', ctx.unidadeNome],
    ['Médico(s) do laudo no escopo', ctx.medicosNomes || 'Todos os médicos'], ['Período de produção considerado', res.periodo ? `${fmtData(res.periodo[0])} a ${fmtData(res.periodo[1])}` : '—'],
    ['Modalidades do relatório', res.modalidades.join(', ') || '—'], ['Tolerância de data (dias)', ctx.parametros.tol],
    ['Linhas do MV', res.nMV], ['Procedimentos do MV', res.nProcedimentos], ['Laudos da unidade', res.nLaudosUnidade], ['Laudos no escopo «Só no laudo»', res.nLaudosEscopo], ['Pares formados', res.nPares],
    ['Equivalências validadas usadas (revisão da base)', `${res.eqValidadas} validadas · revisão ${res.eqRevisao}`], ['Versão do motor', MOTOR_VERSAO], ['Rodada', ctx.rodadaId || ''],
    ['Leitura', '«Conferido» = existe um laudo único e consistente; não prova que o valor está correto. Valores não são critério desta conferência.'], ['Privacidade', AVISO_LGPD]]));
  abas.push({ nome: 'Resumo', larguras: [52, 60, 16, 16], linhas: R, filtro: false, congelar: false });
  abas.push({ nome: 'Conferência', larguras: larg, linhas: todas, filtro: true });
  abas.push({ nome: 'Pendências', larguras: larg, linhas: [cabConf, ...res.linhas.filter(x => x.status !== 'conferido').map(linhaConf)], filtro: true });
  abas.push({ nome: 'MV original', larguras: [8, 30, 7, 12, 50, 28, 9, 10, 11, 32, 28, 11, 7, 11, 9, 11, 22], linhas: [cabecalho(colunasMV), ...res.linhas.filter(x => x.r).sort((a, b) => a.r.seq - b.r.seq).map(x => celulasMV(x.r, x.tipo))], filtro: true });
  abas.push({ nome: 'Apolo não conciliado', larguras: [12, 10, 22, 30, 12, 46, 40, 11, 30, 10, 30, 40], linhas: [[...cabecalho(colunasLaudo), ...cabecalho(['Marcadores'])], ...res.linhas.filter(x => x.status === 'so-laudo').map(x => [...celulasLaudo(x.l), [...x.marcadores].map(m => MARCADORES[m]).join(' | ')])], filtro: true });
  abas.push({ nome: 'Por procedimento', larguras: [12, 50, 12, 12, 12, 22], linhas: [cabecalho(['Código TUSS', 'Descrição MV', 'Linhas no MV', 'Conferidas', 'Com ressalva', 'Laudos do escopo com título validado']), ...res.porCodigo.map(e => [{ v: e.codigo, st: T }, e.desc, e.mv, e.conferido, e.ressalva, e.laudosValidados])], filtro: true });
  abas.push({ nome: 'Títulos sem validação', larguras: [70, 12], linhas: [cabecalho(['TITLE do Apolo no escopo sem nenhuma equivalência validada', 'Laudos']), ...res.titulosSemValidacao.map(([t, n]) => [t, n])], filtro: true });
  const C = [cabecalho(['Linha MV', 'Código TUSS', 'Paciente (MV)', 'Data (MV)', 'Categoria final', 'Faixa', 'TITLE candidato', 'Médico', 'Data laudo', 'Nível do nome', 'Dias de diferença', 'Equivalência', 'Associado à linha?'])];
  for (const x of res.linhas) if (x.r) for (const c of x.cands) C.push([x.r.seq, { v: x.r.codigo, st: T }, x.r.paciente, x.r.data, STATUS_CONF[x.status].nome, c.tier, c.l.titulo, c.l.medico, c.l.data || '', ['', 'semelhante', 'truncado', 'idêntico'][c.nm], c.dd, c.proc.estado, x.l === c.l ? 'SIM' : 'NÃO']);
  abas.push({ nome: 'Candidatos', larguras: [8, 12, 30, 11, 24, 7, 50, 30, 11, 12, 10, 14, 10], linhas: C, filtro: true });
  return criarXlsx(abas);
}

function xlsxCorrecao(res, ctx) {
  const cabL = [...cabecalho(['Estado', 'Motivo', 'Detalhe objetivo', 'Médico do laudo (Apolo)', 'Código do prestador', 'Origem do código', 'Alertas']), ...cabecalho(colunasMV), ...cabecalho(['Prestador do cabeçalho do MV', 'Laudo: ID', 'Laudo: TITLE', 'Laudo: data', 'Laudo: linha da planilha', 'Unidade da sessão', 'Rodada', 'Executado em'], { ...CAB, fill: '2E7D32' })];
  const linhaL = o => {
    const f = { fill: ESTADO_CORR[o.estado].cor };
    return [{ v: ESTADO_CORR[o.estado].nome, st: { ...f, b: true } }, { v: MOTIVOS_CORR[o.motivo] || '', st: f }, { v: o.detalhe, st: { ...f, wrap: true } },
      { v: o.estado === 'identificado' ? o.medico : '', st: { ...f, b: true } }, { v: o.prestador?.cod || '', st: { ...f, ...T } }, { v: o.viaPrestador, st: f }, { v: o.alertas.join(' | '), st: { ...f, wrap: true } },
      ...celulasMV(o.r, o.tipo, f), { v: `${o.r.prestadorCod} - ${o.r.prestadorNome}`, st: f }, { v: o.laudo?.idLaudo || '', st: { ...f, ...T } }, { v: o.laudo?.titulo || '', st: f },
      { v: o.laudo?.data || '', st: f }, { v: o.laudo?.linhaPlanilha || '', st: f }, { v: ctx.unidadeNome, st: f }, { v: ctx.rodadaId || '', st: { ...f, ...T } }, { v: ctx.em, st: f }];
  };
  const larg = [24, 34, 70, 32, 10, 30, 50, 8, 30, 7, 12, 46, 26, 9, 10, 11, 30, 26, 11, 7, 11, 9, 11, 20, 30, 12, 46, 11, 10, 26, 22, 20];
  const R = [cabecalho(['Estado', 'Registros', 'Vl Repasse', 'Vl Total'])];
  let n = 0;
  for (const [k, e] of Object.entries(ESTADO_CORR)) { const s = res.porEstado[k]; n += s.n; R.push([{ v: e.nome, st: { fill: e.cor, b: true } }, s.n, { v: s.vlRepasse, st: { fmt: 'money' } }, { v: s.vlTotal, st: { fmt: 'money' } }]); }
  R.push([{ v: 'TOTAL processado (linhas do MV)', st: { b: true, bt: true } }, { v: n, st: { b: true, bt: true } }]);
  R.push([{ v: n === ctx.relatorio.regs.length ? 'Reconciliado: soma dos estados = linhas do MV.' : 'ATENÇÃO: a soma dos estados difere das linhas do MV.', st: { b: true } }]);
  R.push([], cabecalho(['Motivo (não identificados, conflitos e insuficientes)', 'Registros']));
  for (const [k, v] of Object.entries(res.porMotivo)) R.push([MOTIVOS_CORR[k] || k, v]);
  R.push([], cabecalho(['Médico identificado (Apolo)', 'Código do prestador', 'Linhas', 'Vl Repasse']));
  for (const m of res.porMedico) R.push([m.medico, { v: m.cod || 'sem cadastro', st: T }, m.n, { v: m.vlRepasse, st: { fmt: 'money' } }]);
  R.push([], ...linhasMeta([
    ['Gerado em', ctx.em], ['Operador', ctx.operador || '(não informado)'], ['Relatório MV', ctx.relatorio.arquivo], ['Prestador do cabeçalho', `${ctx.relatorio.cab.prestadorCod} - ${ctx.relatorio.cab.prestadorNome}`],
    ['Repasse', `${ctx.relatorio.cab.repasse} · ${ctx.relatorio.cab.descricao}`], ['Planilha de laudos', ctx.apoloNome], ['Unidade (escolhida na sessão)', ctx.unidadeNome],
    ['Tolerância de data (dias)', ctx.parametros.tol], ['Equivalências validadas (revisão da base)', `${res.eqValidadas} · revisão ${res.eqRevisao}`], ['Versão do motor', MOTOR_VERSAO], ['Rodada', ctx.rodadaId || ''],
    ['Regra', 'Identificação só com nome idêntico ou truncado, data na tolerância e equivalência TUSS validada. Casos não identificados não recebem prestador sugerido (RN-206).'],
    ['Uso', 'Planilha de trabalho: as correções são feitas no MV. Depois, importe a nova extração para conferir o que mudou.'], ['Privacidade', AVISO_LGPD]]));
  const O = [cabecalho(['Código TUSS (MV)', 'Descrição MV', 'TITLE encontrado no Apolo', 'Estado da equivalência', 'Ocorrências']), ...res.ocorrencias.map(o => [{ v: o.codigo, st: T }, o.descMV, o.titulo, o.estadoEq, o.n])];
  return criarXlsx([
    { nome: 'Resumo', larguras: [52, 22, 16, 16], linhas: R, filtro: false, congelar: false },
    { nome: 'Identificados', larguras: larg, linhas: [cabL, ...res.linhas.filter(o => o.estado === 'identificado').map(linhaL)], filtro: true },
    { nome: 'Não identificados', larguras: larg, linhas: [cabL, ...res.linhas.filter(o => o.estado === 'nao-identificado').map(linhaL)], filtro: true },
    { nome: 'Conflitos e insuficientes', larguras: larg, linhas: [cabL, ...res.linhas.filter(o => o.estado === 'conflito' || o.estado === 'insuficiente').map(linhaL)], filtro: true },
    { nome: 'Equivalências a analisar', larguras: [12, 50, 60, 18, 12], linhas: O, filtro: true },
    { nome: 'Todas as linhas', larguras: larg, linhas: [cabL, ...res.linhas.map(linhaL)], filtro: true }
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
