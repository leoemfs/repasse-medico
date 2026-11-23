/* ============================================================
 * Relatórios Excel. Códigos TUSS sempre como texto; dados originais preservados;
 * registros únicos e ocorrências de marcadores contados separadamente (RN-187, RN-211, RN-215).
 * ============================================================ */
const AVISO_LGPD = 'Este arquivo contém dados pessoais e de saúde (LGPD). Armazene, compartilhe e descarte conforme a política da empresa.';
const T = { fmt: 'text' };
// Todos os repasses do PDF (geração original, complementar e lançamentos manuais).
const textoRepasses = cab => (cab.repasses || []).length > 1 ? cab.repasses.map(x => `${x.numero}${x.data ? ` de ${x.data}` : ''}${x.descricao ? ` · ${x.descricao}` : ''} (${x.linhas} linha(s), R$ ${fmtBR(x.vlRepasse)})`).join('; ') : `${cab.repasse} · ${cab.descricao}`;
const colunasMV = ['Linha MV', 'Chave da linha', 'Página', 'Código TUSS (MV)', 'Descrição MV', 'Grupo de procedimento', 'Remessa', 'Conta', 'Atendimento', 'Paciente (MV)', 'Convênio (MV)', 'Data (MV)', 'Quant.', 'Vl Repasse', '% Repasse', 'Vl Total', 'Tipo de item'];
const celulasMV = (r, tipo, f = {}) => r ? [
  { v: r.seq, st: f }, { v: r.chave, st: { ...f, ...T } }, { v: r.pagina, st: f }, { v: r.codigo, st: { ...f, ...T } }, { v: r.procDesc, st: f }, { v: r.grupoNome, st: f },
  { v: r.remessa, st: { ...f, ...T } }, { v: r.conta, st: { ...f, ...T } }, { v: r.atendimento, st: { ...f, ...T } }, { v: r.paciente, st: f }, { v: r.convenio, st: f },
  { v: r.data, st: f }, { v: r.quant, st: f }, { v: r.vlRepasse, st: { ...f, fmt: 'money' } }, { v: r2(r.pct * 10000) / 10000, st: { ...f, fmt: 'pct' } }, { v: r.vlTotal, st: { ...f, fmt: 'money' } }, { v: TIPOS_ITEM[tipo] || tipo || '', st: f }
] : colunasMV.map(() => ({ v: '', st: f }));
const linhasMeta = meta => meta.map(([a, b]) => [{ v: a, st: { b: true } }, { v: b ?? '', st: { wrap: true } }]);

// Excel da extração (MV original), um por PDF.
function xlsxExtracao(rel) {
  const linhas = [cabecalho([...colunasMV, 'Repetição'])];
  for (const r of rel.regs) linhas.push([...celulasMV(r, ''), r.repeticao ? `repetida ${r.repeticao.i}/${r.repeticao.n}` : '']);
  const meta = [cabecalho(['Item', 'Valor']), ...linhasMeta([
    ['Arquivo', rel.arquivo], ['Prestador', `${rel.cab.prestadorCod} - ${rel.cab.prestadorNome}`], ['Repasse', textoRepasses(rel.cab)],
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

/* SOL-F48: HM que não compõe o repasse (fora da V3, todo HM; na V3, o que não é de USG Unimed) — lista para pedir a exclusão no MV. */
const CAB_HM_EXCLUIR = ['Atendimento', 'Conta', 'Remessa', 'Paciente', 'Data', 'Cód. procedimento', 'Descrição MV', 'Grupo de procedimento', 'Convênio', 'Vl Repasse', 'Vl Total', 'Motivo'];
const hmAExcluir = res => res.linhas.filter(x => x.r && x.tipo === 'hm' && classeDaLinhaConf(x) === 'excluido');
const linhaHMExcluir = x => [{ v: x.r.atendimento, st: T }, { v: x.r.conta, st: T }, { v: x.r.remessa, st: T }, x.r.paciente, x.r.data, { v: x.r.codigo, st: T }, x.r.procDesc, x.r.grupoNome, x.r.convenio,
  { v: x.r.vlRepasse, st: { fmt: 'money' } }, { v: x.r.vlTotal, st: { fmt: 'money' } }, { v: x.motivos.find(m => /^HM/.test(m)) || x.motivos[0] || '', st: { wrap: true } }];
const LARG_HM_EXCLUIR = [12, 11, 10, 32, 11, 14, 44, 30, 24, 12, 12, 70];

/* Excel da conferência cruzada (SOL-F23). Aba principal com o MV lado a lado com o Apolo e a
 * decisão da competência; o técnico (faixa, equivalência, chaves, candidatos) fica em abas à parte.
 * As decisões (NC, aceitar para pagamento) são tomadas na ferramenta; aqui só aparecem. */
const COR_DECISAO = { nc: 'C6EFCE', considerar: 'E4DFEC', dispensado: 'EDEDED' };
function xlsxConferencia(res, ctx) {
  const st = s => ({ fill: STATUS_CONF[s].cor });
  const SIT = { ...CAB, fill: '404040' }, AP = { ...CAB, fill: '2E7D32' }, OBS = { ...CAB, fill: '7F7F7F' };
  // Ordem de quem confere (SOL-F40): situação → paciente → data → o que o MV lançou → o que o laudo diz → o que falta.
  const CZ = causasDaConferencia(res, ctx.compostas || []);
  // v3.0: a aba principal segue o modelo de exportação escolhido (Configurações → Exportação). O modelo «Padrão»
  // tem exatamente as colunas e a ordem de antes; os outros só escolhem e ordenam colunas do catálogo.
  const cols = colunasDoModelo(ctx.colunasExportacao), GRUPO = { sit: SIT, ap: AP, obs: OBS };
  const cabPrincipal = cols.map(c => ({ v: c.rotulo, st: GRUPO[c.grupo] || CAB }));
  const textoDecisao = d => d ? `${TIPOS_DECISAO[d.tipo]}${d.justificativa ? ': ' + d.justificativa : ''}${d.tipo === 'nc' && d.situacao ? ` (${SITUACAO_NC[d.situacao] || d.situacao})` : ''}` : '';
  const linhaPrincipal = (x, n) => {
    const dec = x.decisao, i = res.linhas[n] === x ? n : res.linhas.indexOf(x);
    const aux = { f: st(x.status), dec, textoDecisao, falta: dec || x.status === 'conferido' || x.status === 'nao-procedimental' ? '' : (CZ.porLinha.get(i) || x.motivos[0] || '') };
    return cols.map(c => c.valor(x, ctx, aux));
  };
  const largP = cols.map(c => c.larg);
  // «O que falta decidir»: uma linha por pendência, agrupada pela decisão que a resolve.
  const F = [cabecalho(['Decisão', 'O que decidir', 'Ação sugerida', 'Linhas na decisão', 'Paciente', 'Data', 'Cód. TUSS MV', 'Procedimento no MV', 'Laudo (TITLE)', 'Convênio MV', 'Convênio laudo', 'Vl Repasse', 'Por quê'])];
  [...CZ.grupos, ...CZ.umaUma].forEach((c, n) => {
    const cor = n % 2 ? 'FFF2CC' : 'FCE4D6';
    for (const i of c.linhas) { const x = res.linhas[i], r = x.r, l = x.l;
      F.push([{ v: n + 1, st: { fill: cor, b: true } }, { v: c.rotulo, st: { fill: cor, wrap: true } }, { v: c.acao, st: { wrap: true } }, c.linhas.length, r?.paciente || l?.paciente || '', r?.data || l?.data || '', { v: r?.codigo || '', st: T }, r?.procDesc || '', l?.titulo || '', r?.convenio || '', l?.convenio || '', r ? { v: r.vlRepasse, st: { fmt: 'money' } } : '', { v: x.motivos.join(' | '), st: { wrap: true } }]); }
  });
  if (F.length === 1) F.push(['Nada falta decidir neste relatório: é só registrar o aceite na ferramenta.']);
  const pendente = x => x.status !== 'conferido' && !x.decisao;
  // Resumo
  const R = [cabecalho(['Categoria principal', 'Registros únicos', 'Vl Repasse', 'Vl Total'])];
  const ordem = Object.keys(STATUS_CONF).sort((a, b) => STATUS_CONF[a].ordem - STATUS_CONF[b].ordem);
  for (const k of ordem) { const s = res.porStatus[k]; R.push([{ v: STATUS_CONF[k].nome, st: { fill: STATUS_CONF[k].cor, b: true } }, s.n, { v: s.vlRepasse, st: { fmt: 'money' } }, { v: s.vlTotal, st: { fmt: 'money' } }]); }
  const tot = ordem.reduce((a, k) => [a[0] + res.porStatus[k].n, a[1] + res.porStatus[k].vlRepasse, a[2] + res.porStatus[k].vlTotal], [0, 0, 0]);
  R.push([{ v: 'TOTAL de registros únicos', st: { b: true, bt: true } }, { v: tot[0], st: { b: true, bt: true } }, { v: r2(tot[1]), st: { b: true, bt: true, fmt: 'money' } }, { v: r2(tot[2]), st: { b: true, bt: true, fmt: 'money' } }]);
  // SOL-F43: o que a conferência autoriza a pagar.
  const TC = totaisPorClasse(res.linhas, classeDaLinhaConf);
  R.push([], cabecalho(['Fechamento (classe)', 'Linhas do MV', 'Vl Repasse', 'Entra no fechamento?']));
  for (const k of ORDEM_CLASSES) R.push([{ v: CLASSES_FECH[k].nome, st: { fill: CLASSES_FECH[k].cor, b: true } }, TC[k].n, { v: TC[k].valor, st: { fmt: 'money' } }, CLASSES_FECH[k].entra ? 'sim' : 'não']);
  R.push([{ v: 'VALOR PARA PAGAMENTO (Devido + Aceito)', st: { b: true, bt: true } }, '', { v: TC.pagar, st: { b: true, bt: true, fmt: 'money' } }, '']);
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
    ['Prestador do relatório', `${ctx.relatorio.cab.prestadorCod} - ${ctx.relatorio.cab.prestadorNome}`], ['Repasse', textoRepasses(ctx.relatorio.cab)],
    ['Competência do repasse (MV)', ctx.relatorio.cab.competencia], ['Planilha de laudos', ctx.apoloNome], ['Unidade (escolhida na sessão)', ctx.unidadeNome],
    ['Médico(s) do laudo no escopo', ctx.medicosNomes || 'Todos os médicos'], ['Período de produção considerado', res.periodo ? `${fmtData(res.periodo[0])} a ${fmtData(res.periodo[1])}` : '—'],
    ['Modalidades do relatório', res.modalidades.join(', ') || '—'], ['Tolerância de data (dias)', ctx.parametros.tol],
    ['Linhas do MV', res.nMV], ['Procedimentos do MV', res.nProcedimentos], ['Laudos da unidade', res.nLaudosUnidade], ['Laudos no escopo «Só no laudo»', res.nLaudosEscopo], ['Pares formados', res.nPares],
    ['Equivalências validadas usadas (revisão da base)', `${res.eqValidadas} validadas · revisão ${res.eqRevisao}`], ['Versão do motor', MOTOR_VERSAO], ['Rodada', ctx.rodadaId || ''],
    ...(ctx.filtroTexto ? [['Exportação', `SÓ O FILTRADO NA TELA: ${ctx.filtroTexto}. O Resumo e as abas valem só para essas linhas.`]] : []),
    ['Leitura', '«Conferido» = existe um laudo único e consistente; não prova que o valor está correto. Valores não são critério desta conferência.'],
    ['Decisões', 'NC e «aceitar para pagamento» são registradas na ferramenta (aba Conferência, detalhe da linha) e valem para toda nova rodada da competência.'], ['Privacidade', AVISO_LGPD]])];
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
    { nome: 'O que falta decidir', larguras: [9, 60, 44, 10, 32, 11, 12, 40, 40, 22, 22, 12, 80], linhas: F, filtro: F.length > 2 },
    { nome: 'Conferência', larguras: largP, linhas: [cabPrincipal, ...res.linhas.map(linhaPrincipal)], filtro: true },
    { nome: 'Resumo', larguras: [52, 22, 16, 16], linhas: R, filtro: false, congelar: false },
    { nome: 'Informações', larguras: [44, 110], linhas: I, filtro: false, congelar: false },
    { nome: 'Técnico', larguras: [24, 8, 8, 30, 7, 10, 11, 12, 7, 9, 12, 22, 12, 10, 12, 8, 60, 24], linhas: [cabTec, ...res.linhas.map(linhaTec)], filtro: true },
    { nome: 'Por procedimento', larguras: [12, 50, 12, 12, 12, 22], linhas: [cabecalho(['Código TUSS', 'Descrição MV', 'Linhas no MV', 'Conferidas', 'Com ressalva', 'Laudos do escopo com título validado']), ...res.porCodigo.map(e => [{ v: e.codigo, st: T }, e.desc, e.mv, e.conferido, e.ressalva, e.laudosValidados])], filtro: true },
    { nome: 'Títulos sem validação', larguras: [70, 12], linhas: [cabecalho(['TITLE do Apolo no escopo sem nenhuma equivalência validada', 'Laudos']), ...res.titulosSemValidacao.map(([t, n]) => [t, n])], filtro: true },
    { nome: 'Candidatos', larguras: [8, 12, 30, 11, 24, 7, 50, 30, 11, 12, 10, 14, 10], linhas: C, filtro: true },
    { nome: 'MV original', larguras: [8, 30, 7, 12, 50, 28, 9, 10, 11, 32, 28, 11, 7, 11, 9, 11, 22], linhas: [cabecalho(colunasMV), ...res.linhas.filter(x => x.r).sort((a, b) => a.r.seq - b.r.seq).map(x => celulasMV(x.r, x.tipo))], filtro: true },
    ...(hmAExcluir(res).length ? [{ nome: 'HM a excluir do MV', larguras: LARG_HM_EXCLUIR, linhas: [cabecalho(CAB_HM_EXCLUIR), ...hmAExcluir(res).map(linhaHMExcluir)], filtro: true }] : [])
  ]);
}

/* SOL-F45 (v3.0.0-alpha.17) — Planilha única da unidade × grupo (IMG, USG ou Curitiba): todos os prestadores que
 * produziram na competência, num Excel só, para trabalhar com filtros e manter uma planilha de controle por unidade.
 * itens: [{ res, ctx, rodada }] — conferência de cada relatório do MV, refeita com os parâmetros da última rodada dele e a
 *        base de equivalências atual (res = null quando o relatório ainda não tem conferência na competência).
 * controle: itens do grupo em «Prestadores por unidade» (quem laudou), para listar também quem ainda não tem relatório.
 * meta: { chave, unidadeCod, unidadeNome, grupo, operador, apoloNome, eqRevisao, colunasExportacao, compostas, idxObs }.
 * Mesmas regras da conferência de cada prestador: nada é recalculado aqui além da soma por classe (Devido + Aceito). */
function xlsxConferenciaUnidade(itens, controle, meta) {
  const SIT = { ...CAB, fill: '404040' }, AP = { ...CAB, fill: '2E7D32' }, OBS = { ...CAB, fill: '7F7F7F' }, PR = { ...CAB, fill: '1F4E78' };
  const textoDecisao = d => d ? `${TIPOS_DECISAO[d.tipo]}${d.justificativa ? ': ' + d.justificativa : ''}${d.tipo === 'nc' && d.situacao ? ` (${SITUACAO_NC[d.situacao] || d.situacao})` : ''}` : '';
  const cols = colunasDoModelo(meta.colunasExportacao), GRUPO = { sit: SIT, ap: AP, obs: OBS };
  const rotGrupo = { usg: 'USG', img: 'IMG', curitiba: 'Curitiba (V3)' }[meta.grupo] || String(meta.grupo || '').toUpperCase();
  const comConf = itens.filter(x => x.res).sort((a, b) => String(a.ctx.relatorio.cab.prestadorNome).localeCompare(String(b.ctx.relatorio.cab.prestadorNome)) || String(a.ctx.relatorio.cab.prestadorCod).localeCompare(String(b.ctx.relatorio.cab.prestadorCod)));
  const prest = it => [{ v: String(it.ctx.relatorio.cab.prestadorCod || ''), st: T }, it.ctx.relatorio.cab.prestadorNome || ''];
  // Aba «Conferência»: as linhas de todos os prestadores, com o prestador nas duas primeiras colunas.
  const P = [[...cabecalho(['Cód. prestador', 'Prestador'], PR), ...cols.map(c => ({ v: c.rotulo, st: GRUPO[c.grupo] || CAB }))]];
  const F = [cabecalho(['Cód. prestador', 'Prestador', 'O que decidir', 'Ação sugerida', 'Linhas na decisão', 'Paciente', 'Data', 'Cód. TUSS MV', 'Procedimento no MV', 'Laudo (TITLE)', 'Convênio MV', 'Convênio laudo', 'Vl Repasse', 'Por quê'])];
  const porCodigo = new Map();
  const resumo = [];
  for (const it of comConf) {
    const { res, ctx } = it, CZ = causasDaConferencia(res, meta.compostas || []), c2 = { ...ctx, idxObs: meta.idxObs };
    res.linhas.forEach((x, i) => {
      const dec = x.decisao, aux = { f: { fill: STATUS_CONF[x.status].cor }, dec, textoDecisao, falta: dec || x.status === 'conferido' || x.status === 'nao-procedimental' ? '' : (CZ.porLinha.get(i) || x.motivos[0] || '') };
      P.push([...prest(it), ...cols.map(c => c.valor(x, c2, aux))]);
    });
    [...CZ.grupos, ...CZ.umaUma].forEach(g => {
      for (const i of g.linhas) { const x = res.linhas[i], r = x.r, l = x.l;
        F.push([...prest(it), { v: g.rotulo, st: { wrap: true } }, { v: g.acao, st: { wrap: true } }, g.linhas.length, r?.paciente || l?.paciente || '', r?.data || l?.data || '', { v: r?.codigo || '', st: T }, r?.procDesc || '', l?.titulo || '', r?.convenio || '', l?.convenio || '', r ? { v: r.vlRepasse, st: { fmt: 'money' } } : '', { v: x.motivos.join(' | '), st: { wrap: true } }]); }
    });
    for (const e of res.porCodigo) { const a = porCodigo.get(e.codigo) || { codigo: e.codigo, desc: e.desc, mv: 0, conferido: 0, ressalva: 0, prestadores: new Set() }; a.mv += e.mv; a.conferido += e.conferido; a.ressalva += e.ressalva; a.prestadores.add(String(ctx.relatorio.cab.prestadorCod)); porCodigo.set(e.codigo, a); }
    const TC = totaisPorClasse(res.linhas, classeDaLinhaConf), soLaudo = res.linhas.filter(x => x.status === 'so-laudo' && !x.decisao).length;
    resumo.push({ it, TC, soLaudo, totalMV: r2(res.linhas.reduce((s, x) => s + (x.r?.vlRepasse || 0), 0)), nMV: res.nMV, faltam: CZ.faltam });
  }
  if (F.length === 1) F.push(['', 'Nada falta decidir nos relatórios desta planilha.']);
  // Aba «Prestadores»: uma linha por prestador (com relatório ou só com laudo), valores por classe e situação.
  const R = [cabecalho(['Cód. prestador', 'Prestador', 'Situação', 'Aceite do relatório', 'Laudos no Apolo', 'Linhas no MV', 'Total do MV (Vl Repasse)', 'Devido', 'Aceito', 'Para pagamento (Devido + Aceito)', 'Pendente', 'Não conformidade', 'Excluído', 'Decisões que faltam', '«Só no laudo» sem decisão', 'Relatório do MV', 'Última rodada'])];
  const ctlPorCod = new Map((controle || []).filter(x => x.cod).map(x => [String(x.cod), x]));
  const tot = { mv: 0, devido: 0, aceito: 0, pagar: 0, pend: 0, nc: 0, excluido: 0, nMV: 0, laudos: 0, faltam: 0, soLaudo: 0 };
  const money = v => ({ v, st: { fmt: 'money' } });
  for (const z of resumo) {
    const cab = z.it.ctx.relatorio.cab, rod = z.it.rodada, c = ctlPorCod.get(String(cab.prestadorCod)), TC = z.TC;
    const sit = rod?.aceite ? (z.faltam ? `Aceito — ${z.faltam} pendência(s) em aberto` : 'Aceito') : z.faltam ? `Conferindo — faltam ${z.faltam} decisão(ões)` : 'Conferido, sem aceite';
    R.push([...prest(z.it), { v: sit, st: { fill: rod?.aceite ? 'C6EFCE' : z.faltam ? 'FFEB9C' : 'DDEBF7', b: true } }, rod?.aceite ? `${rod.aceite.por || ''} · ${String(rod.aceite.em || '').slice(0, 10).split('-').reverse().join('/')}` : '',
      c ? c.laudos : '', z.nMV, money(z.totalMV), money(TC.devido.valor), money(TC.aceito.valor), { v: TC.pagar, st: { fmt: 'money', b: true } }, money(TC.pend.valor), money(TC.nc.valor), money(TC.excluido.valor), z.faltam, z.soLaudo,
      z.it.ctx.relatorio.arquivo || '', rod ? `${String(rod.em).slice(0, 10).split('-').reverse().join('/')} · ${rod.operador || ''}` : '']);
    Object.assign(tot, { mv: tot.mv + z.totalMV, devido: tot.devido + TC.devido.valor, aceito: tot.aceito + TC.aceito.valor, pagar: tot.pagar + TC.pagar, pend: tot.pend + TC.pend.valor, nc: tot.nc + TC.nc.valor, excluido: tot.excluido + TC.excluido.valor, nMV: tot.nMV + z.nMV, laudos: tot.laudos + (c?.laudos || 0), faltam: tot.faltam + z.faltam, soLaudo: tot.soLaudo + z.soLaudo });
  }
  // Relatório carregado, mas sem conferência na competência.
  for (const it of itens.filter(x => !x.res)) {
    const cab = it.ctx.relatorio.cab, c = ctlPorCod.get(String(cab.prestadorCod));
    R.push([...prest(it), { v: 'Relatório sem conferência', st: { fill: 'FCE4D6', b: true } }, '', c ? c.laudos : '', it.ctx.relatorio.regs.length, money(r2(it.ctx.relatorio.regs.reduce((s, r) => s + r.vlRepasse, 0))), '', '', '', '', '', '', '', '', it.ctx.relatorio.arquivo || '', '']);
  }
  // Quem laudou na unidade e grupo e não tem relatório nesta planilha (situação de «Prestadores por unidade»).
  const comRel = new Set(itens.map(it => String(it.ctx.relatorio.cab.prestadorCod)));
  for (const c of (controle || []).filter(x => !(x.cod && comRel.has(String(x.cod))) && x.situacao !== 'fora')) {
    R.push([{ v: c.cod || '', st: T }, c.nome, { v: SITUACAO_CONTROLE[c.situacao]?.[1] || c.situacao, st: { fill: c.situacao === 'gerar' ? 'FFC7CE' : 'EDEDED', b: true } }, c.aceite ? 'sim' : '', c.laudos, c.linhasMV || '', '', '', '', '', '', '', '', '', '', '', '']);
    tot.laudos += c.laudos;
  }
  const B = { b: true, bt: true };
  R.push([{ v: 'TOTAL', st: B }, { v: `${resumo.length} prestador(es) conferido(s)`, st: B }, { v: '', st: B }, { v: '', st: B }, { v: tot.laudos, st: B }, { v: tot.nMV, st: B },
    ...[tot.mv, tot.devido, tot.aceito, tot.pagar, tot.pend, tot.nc, tot.excluido].map(v => ({ v: r2(v), st: { ...B, fmt: 'money' } })), { v: tot.faltam, st: B }, { v: tot.soLaudo, st: B }, { v: '', st: B }, { v: '', st: B }]);
  R.push([], [{ v: 'Leitura', st: { b: true } }, { v: 'Para pagamento = Devido + Aceito (SOL-F43). Devido + Aceito + Pendente + NC + Excluído = total do MV de cada prestador. «Laudos no Apolo» vem de «Prestadores por unidade» (quem laudou na unidade e grupo).', st: { wrap: true } }]);
  const I = [cabecalho(['Item', 'Valor']), ...linhasMeta([
    ['Gerado em', new Date().toLocaleString('pt-BR')], ['Operador', meta.operador || '(não informado)'], ['Competência', meta.chave ? rotuloCompetencia(meta.chave) : ''],
    ['Unidade', meta.unidadeNome || meta.unidadeCod], ['Grupo', rotGrupo], ['Planilha de laudos', meta.apoloNome || ''],
    ['Relatórios do MV na planilha', itens.length], ['Com conferência', comConf.length], ['Sem conferência', itens.length - comConf.length],
    ['Equivalências (revisão da base)', meta.eqRevisao ?? ''], ['Versão do motor', MOTOR_VERSAO],
    ['Como foi feita', 'Cada relatório foi conferido de novo na hora, com os parâmetros (unidade, tolerância, médico) da última rodada dele na competência, a base de equivalências atual e as decisões registradas. Nenhuma rodada nova é gravada por esta planilha.'],
    ['Decisões', 'NC, «aceito para pagamento», dispensas e observações são registradas na ferramenta; aqui só aparecem. Use os filtros desta planilha para controle.'],
    ...itens.map(it => ['Relatório', `${it.ctx.relatorio.cab.prestadorCod} - ${it.ctx.relatorio.cab.prestadorNome} · ${it.ctx.relatorio.arquivo || ''}${it.rodada ? ` · rodada ${it.rodada.id}` : ' · sem conferência'}`]),
    ['Privacidade', AVISO_LGPD]])];
  const HMX = [[...cabecalho(['Cód. prestador', 'Prestador'], PR), ...cabecalho(CAB_HM_EXCLUIR)]];
  for (const it of comConf) for (const x of hmAExcluir(it.res)) HMX.push([...prest(it), ...linhaHMExcluir(x)]);
  const PC = [cabecalho(['Código TUSS', 'Descrição MV', 'Linhas no MV', 'Conferidas', 'Com ressalva', 'Prestadores'])];
  for (const e of [...porCodigo.values()].sort((a, b) => b.mv - a.mv)) PC.push([{ v: e.codigo, st: T }, e.desc, e.mv, e.conferido, e.ressalva, [...e.prestadores].join(', ')]);
  return criarXlsx([
    { nome: 'Prestadores', larguras: [12, 36, 34, 22, 12, 11, 16, 14, 14, 18, 14, 14, 14, 12, 14, 50, 24], linhas: R, filtro: true },
    { nome: 'Conferência', larguras: [12, 30, ...cols.map(c => c.larg)], linhas: P, filtro: true },
    { nome: 'O que falta decidir', larguras: [12, 30, 60, 44, 10, 32, 11, 12, 40, 40, 22, 22, 12, 80], linhas: F, filtro: F.length > 2 },
    { nome: 'Por procedimento', larguras: [12, 50, 12, 12, 12, 40], linhas: PC, filtro: true },
    ...(HMX.length > 1 ? [{ nome: 'HM a excluir do MV', larguras: [12, 30, ...LARG_HM_EXCLUIR], linhas: HMX, filtro: true }] : []),
    { nome: 'Informações', larguras: [34, 110], linhas: I, filtro: false, congelar: false }
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
    ['Prestador do cabeçalho', `${ctx.relatorio.cab.prestadorCod} - ${ctx.relatorio.cab.prestadorNome}`], ['Repasse', textoRepasses(ctx.relatorio.cab)],
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
