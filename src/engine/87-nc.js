/* ============================================================
 * Não conformidades (SOL-F3)
 * - Nada vira NC sozinho: as análises só apontam candidatos; o usuário registra.
 * - Natureza padronizada + detalhe livre + observações: os indicadores somam pela natureza
 *   e o texto continua do jeito que a equipe escreve.
 * - Competência da NC = mês de trabalho (produção + 1), a mesma chave do Fluxo mensal.
 * - Dados de pacientes ficam só neste navegador e são apagados após o prazo de retenção
 *   (padrão 60 dias a partir do registro); o restante da NC fica para os indicadores.
 * ============================================================ */
const SCHEMA_NC = 'repasse-medico/nao-conformidades';
const SITUACAO_NC = { aberta: 'Aberta', enviada: 'Enviada ao Qualiex', tratativa: 'Em tratativa', regularizada: 'Regularizada', 'nao-procede': 'Não procede' };
const CATEGORIA_NC = { particular: 'Particular', convenio: 'Convênios (faturamento)', prestador: 'Correção de prestadores' };
// Ordem de exibição. «impacta» é só o valor inicial de «Impacta pagamento»; o usuário decide.
const NATUREZAS_NC = [
  { id: 'prestador-incorreto', nome: 'Prestador incorreto', impacta: true },
  { id: 'nao-lancado', nome: 'Procedimento não lançado na conta', impacta: true },
  { id: 'guia-negada', nome: 'Guia negada — cobrança particular', impacta: false },
  { id: 'conta-aberta', nome: 'Conta aberta (não repassada)', impacta: true },
  { id: 'lancado-incorreto', nome: 'Procedimento lançado incorretamente na conta', impacta: true },
  { id: 'apos-geracao', nome: 'Remessa ou conta fechada após a geração do repasse', impacta: true },
  { id: 'sem-remessa', nome: 'Conta fechada sem remessa', impacta: true },
  { id: 'duplicidade', nome: 'Duplicidade', impacta: false },
  { id: 'sem-atendimento', nome: 'Laudo sem atendimento no MV', impacta: true },
  { id: 'outras', nome: 'Outras', impacta: false }
];
const NATUREZA_NC = Object.fromEntries(NATUREZAS_NC.map(n => [n.id, n]));
// Leitura do texto livre da planilha manual. A ordem importa: a primeira regra que casar define a natureza.
const REGRAS_NATUREZA = [
  ['prestador-incorreto', /PRESTADOR INCORRETO/],
  ['apos-geracao', /APOS A GERACAO|REMESSA NAO ENTREGUE/],
  ['sem-remessa', /SEM REMESSA/],
  ['guia-negada', /GUIA NEGADA/],
  ['nao-lancado', /NAO LANCADO|FALTANTE/],
  ['lancado-incorreto', /INCORRET/],
  ['conta-aberta', /CONTA ABERTA|ATENDIMENTO ABERTO/],
  ['duplicidade', /DUPLICA|DOIS ATENDIMENTOS/],
  ['sem-atendimento', /NAO POSSUI ATENDIMENTO|SEM ATENDIMENTO/]
];
function naturezaPorTexto(texto) {
  const t = String(texto || '').trim(), n = norm(t);
  if (!n) return { natureza: 'outras', detalhe: '' };
  const id = (REGRAS_NATUREZA.find(([, re]) => re.test(n)) || ['outras'])[0];
  if (id === 'outras') return { natureza: id, detalhe: t };
  const parenteses = t.match(/\(([^)]*)\)\s*$/);
  return { natureza: id, detalhe: parenteses ? parenteses[1].trim() : '' };
}
// Texto da natureza como vai para a planilha: «PROCEDIMENTO NÃO LANÇADO NA CONTA (RX PATELA)».
function textoNatureza(nc) {
  const base = nc.natureza === 'outras' ? '' : (NATUREZA_NC[nc.natureza]?.nome || '').toUpperCase();
  if (!base) return nc.detalhe || 'OUTRAS';
  return nc.detalhe ? `${base} (${nc.detalhe})` : base;
}

/* ---------- Competência ---------- */
// Produção de setembro é repassada (e tem as NCs tratadas) na competência de outubro.
function competenciaDaProducao(d) {
  if (!d) return '';
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return chaveCompetencia(x.getUTCFullYear(), x.getUTCMonth() + 1);
}
function producaoDaCompetencia(chave) {
  const [a, m] = chave.split('-').map(Number), x = new Date(Date.UTC(a, m - 2, 1));
  return `${String(x.getUTCMonth() + 1).padStart(2, '0')}/${x.getUTCFullYear()}`;
}
function competenciaVizinha(chave, delta) {
  const [a, m] = chave.split('-').map(Number), d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return chaveCompetencia(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

/* ---------- Base ---------- */
const ncVazia = () => ({ schema: SCHEMA_NC, versaoSchema: 1, itens: [] });
function validarNC(b) {
  const e = [];
  if (!b || b.schema !== SCHEMA_NC) e.push('arquivo não é uma base de não conformidades');
  else {
    if (b.versaoSchema !== 1) e.push(`versão de esquema ${b.versaoSchema} não suportada`);
    if (!Array.isArray(b.itens)) e.push('lista de NCs inválida');
    else for (const x of b.itens) if (!x.id || !CATEGORIA_NC[x.categoria] || !NATUREZA_NC[x.natureza] || !SITUACAO_NC[x.situacao] || !/^\d{4}-\d{2}$/.test(x.competencia || '')) { e.push(`NC ${x.id || '(sem id)'} inválida`); break; }
  }
  return e;
}
// Mesma NC = mesma categoria, paciente (ID ou nome), data e título (+ médico, na correção de prestador).
const chaveNC = x => [x.categoria, norm(x.idAtendimento) || norm(x.paciente), x.data || '', chaveTitulo(x.titulo || x.tituloEstudo || ''), x.categoria === 'prestador' ? norm(x.medico) : ''].join('|');
const ncDaUnidade = (cfg, nome) => (cfg.unidades.find(u => (u.apolo || []).some(a => norm(a) === norm(nome)) || norm(u.nome) === norm(nome)) || {}).cod || '';
const CAMPOS_NC = ['unidade', 'unidadeCod', 'paciente', 'idAtendimento', 'data', 'tituloEstudo', 'titulo', 'convenio', 'modalidade', 'medico', 'prestadorIncorreto', 'prestadorCorrigido', 'responsavel', 'codigo', 'conta', 'detalhe', 'obs'];

// Categoria e natureza andam juntas: correção de prestador é sempre «prestador incorreto».
function ajustarCategoria(d) {
  if (d.categoria === 'prestador') d.natureza = 'prestador-incorreto';
  else if (d.natureza === 'prestador-incorreto') d.categoria = 'prestador';
  return d;
}
function novaNC(dados, operador = '') {
  const d = ajustarCategoria({ ...dados });
  if (!CATEGORIA_NC[d.categoria]) throw new Error('categoria não informada');
  if (!NATUREZA_NC[d.natureza]) throw new Error('natureza não informada');
  if (!/^\d{4}-\d{2}$/.test(d.competencia || '')) throw new Error('competência inválida');
  const nc = { id: novoId('nc'), competencia: d.competencia, categoria: d.categoria, natureza: d.natureza, situacao: SITUACAO_NC[d.situacao] ? d.situacao : 'aberta' };
  for (const k of CAMPOS_NC) nc[k] = String(d[k] ?? '').trim();
  nc.modalidade = nc.modalidade.toUpperCase();
  nc.impactaPagamento = d.impactaPagamento ?? NATUREZA_NC[d.natureza].impacta;
  nc.valor = +d.valor || 0;
  nc.origem = d.origem || { tipo: 'manual' };
  nc.criadaEm = agoraISO(); nc.criadaPor = operador;
  nc.enviadaEm = d.enviadaEm || (nc.situacao === 'enviada' ? isoDia(new Date()) : '');
  nc.regularizadaEm = ''; nc.deCompetencia = d.deCompetencia || ''; nc.levadaPara = '';
  nc.anonimizada = ''; nc.historico = [{ em: nc.criadaEm, por: operador, acao: `registrada (${nc.origem.tipo})` }];
  return nc;
}
// Registra várias NCs ignorando as que já existem na mesma competência. A contagem é por chave:
// duas linhas iguais na mesma planilha entram as duas; reimportar a planilha não repete nenhuma.
function registrarNCs(base, lista, operador = '') {
  const existentes = contar(base.itens, x => x.competencia + '#' + chaveNC(x));
  const novas = [], repetidas = [];
  for (const d of lista) {
    const nc = novaNC(d, operador), k = nc.competencia + '#' + chaveNC(nc);
    if (existentes.get(k) > 0) { existentes.set(k, existentes.get(k) - 1); repetidas.push(nc); continue; }
    base.itens.push(nc); novas.push(nc);
  }
  return { novas, repetidas };
}
function alterarNC(nc, mudancas, operador = '') {
  const d = ajustarCategoria({ ...nc, ...mudancas }), alterados = [];
  for (const k of ['competencia', 'categoria', 'natureza', ...CAMPOS_NC, 'impactaPagamento', 'valor']) {
    if (d[k] === undefined || d[k] === nc[k]) continue;
    alterados.push(k); nc[k] = typeof nc[k] === 'string' ? String(d[k]).trim() : d[k];
  }
  if (mudancas.situacao && mudancas.situacao !== nc.situacao) mudarSituacaoNC(nc, mudancas.situacao, operador);
  if (alterados.length) nc.historico.push({ em: agoraISO(), por: operador, acao: `alterou ${alterados.join(', ')}` });
  return alterados.length > 0;
}
function mudarSituacaoNC(nc, nova, operador = '', data = '') {
  if (!SITUACAO_NC[nova] || nc.situacao === nova) return false;
  const hoje = data || isoDia(new Date());
  nc.historico.push({ em: agoraISO(), por: operador, acao: `${SITUACAO_NC[nc.situacao]} → ${SITUACAO_NC[nova]}` });
  if (nova === 'enviada' && !nc.enviadaEm) nc.enviadaEm = hoje;
  if (nova === 'aberta') nc.enviadaEm = '';
  nc.regularizadaEm = nova === 'regularizada' ? hoje : '';
  nc.situacao = nova;
  return true;
}
// Pendência não resolvida segue para a competência seguinte como cópia ligada à original.
function levarParaSeguinte(base, nc, operador = '') {
  if (nc.levadaPara || ['regularizada', 'nao-procede'].includes(nc.situacao)) return null;
  const destino = competenciaVizinha(nc.competencia, 1);
  const copia = { ...clone(nc), id: novoId('nc'), competencia: destino, deCompetencia: nc.competencia, levadaPara: '', criadaEm: nc.criadaEm,
    historico: [...clone(nc.historico), { em: agoraISO(), por: operador, acao: `trazida de ${rotuloCompetencia(nc.competencia)}` }] };
  nc.levadaPara = destino; nc.historico.push({ em: agoraISO(), por: operador, acao: `levada para ${rotuloCompetencia(destino)}` });
  base.itens.push(copia);
  return copia;
}

/* ---------- Retenção dos dados de pacientes ---------- */
const idadeDias = (iso, hoje = new Date()) => Math.floor((hoje.getTime() - new Date(iso).getTime()) / 86400000);
function anonimizarNC(nc) { nc.paciente = ''; nc.idAtendimento = ''; nc.anonimizada = agoraISO(); }
// Apaga nome e ID/atendimento das NCs registradas há mais de «dias»; devolve quantas foram apagadas.
function aplicarRetencaoNC(base, dias, hoje = new Date()) {
  let n = 0;
  for (const nc of base.itens) if (!nc.anonimizada && (nc.paciente || nc.idAtendimento) && idadeDias(nc.criadaEm, hoje) > dias) { anonimizarNC(nc); n++; }
  return n;
}
const vencendoRetencaoNC = (base, dias, janela = 7, hoje = new Date()) =>
  base.itens.filter(nc => !nc.anonimizada && (nc.paciente || nc.idAtendimento) && dias - idadeDias(nc.criadaEm, hoje) <= janela);

/* ---------- Candidatos vindos das análises ---------- */
const TIPOS_CANDIDATO_NC = {
  'so-laudo': { nome: 'Só no laudo', natureza: 'nao-lancado', dica: 'laudo sem lançamento no MV' },
  'so-faturamento': { nome: 'Só no faturamento', natureza: '', dica: 'lançado no MV sem laudo correspondente' },
  'eq-divergente': { nome: 'Procedimento diverge', natureza: 'lancado-incorreto', dica: 'procedimento do MV diferente do laudo' },
  'outro-medico': { nome: 'Laudo de outro médico', natureza: 'prestador-incorreto', dica: 'par encontrado com laudo assinado por outro médico' },
  duplicidade: { nome: 'Linha repetida / possível duplicidade', natureza: 'duplicidade', dica: 'linha repetida no MV ou cobrança do mesmo código sem laudo próprio' },
  'prestador-identificado': { nome: 'Prestador identificado', natureza: 'prestador-incorreto', dica: 'correção de prestador: médico do laudo diferente do relatório' },
  manual: { nome: 'Apontada na análise', natureza: '', dica: 'linha escolhida pelo usuário' }
};
function camposDaLinha(r, l, ctx, cfg) {
  const un = ctx.unidadeCod && ctx.unidadeCod !== '*' ? unidadePorCod(cfg, ctx.unidadeCod) : null;
  const unidade = l?.unidade || un?.apolo?.[0] || un?.nome || '';
  return {
    unidade, unidadeCod: un?.cod || ncDaUnidade(cfg, unidade), paciente: l?.paciente || r?.paciente || '',
    idAtendimento: r?.atendimento || l?.idPac || '', data: isoDia(l?.data || r?.data || null),
    tituloEstudo: l?.descricao || '', titulo: l?.titulo || (r ? `${r.codigo} - ${r.procDesc}` : ''),
    convenio: l?.convenio || r?.convenio || '', modalidade: l?.modalidade || (r ? (modalidadesDoGrupo(r.grupoNome) || [])[0] || '' : ''),
    medico: l?.medico || r?.prestadorNome || '', codigo: r?.codigo || '', conta: r?.conta || '', valor: r ? r.vlRepasse : 0
  };
}
const categoriaSugerida = (campos, natureza) => natureza === 'prestador-incorreto' ? 'prestador' : /PARTICULAR/.test(norm(campos.convenio)) ? 'particular' : 'convenio';
function montarCandidato(tipo, campos, ctx, motivo, extra = {}) {
  const natureza = extra.natureza ?? TIPOS_CANDIDATO_NC[tipo].natureza;
  const c = { tipo, natureza, categoria: categoriaSugerida(campos, natureza), campos: { ...campos, ...(extra.campos || {}) }, motivo,
    competencia: ctx.competencia || competenciaDaProducao(paraData(campos.data)),
    origem: { tipo: ctx.tipoAnalise, rodadaId: ctx.rodadaId || '', relatorio: ctx.relatorio ? `${ctx.relatorio.cab.prestadorCod} - ${ctx.relatorio.cab.prestadorNome} · ${ctx.relatorio.cab.repasse}` : '' } };
  c.chave = chaveNC({ ...c.campos, categoria: c.categoria });
  return c;
}
function tipoCandidatoConferencia(x) {
  if (x.status === 'so-laudo') return 'so-laudo';
  if (x.r?.repeticao && x.r.repeticao.i > 1) return 'duplicidade';
  if (x.status === 'so-faturamento') return x.marcadores.has('possivel-bilateral') ? 'duplicidade' : 'so-faturamento';
  if (x.marcadores.has('eq-divergente')) return 'eq-divergente';
  if (x.marcadores.has('outro-medico')) return 'outro-medico';
  return null;
}
// Competência das NCs de uma análise: produção do relatório + 1.
const competenciaDoRelatorio = rel => { const p = periodoDoRelatorio(rel.regs); return p ? competenciaDaProducao(p[1]) : ''; };
function candidatoDaLinhaConferencia(x, ctx, cfg, tipo = null) {
  const t = tipo || tipoCandidatoConferencia(x) || 'manual';
  return montarCandidato(t, camposDaLinha(x.r, x.l, ctx, cfg), { ...ctx, tipoAnalise: 'conferencia', competencia: ctx.chaveCompetencia || competenciaDoRelatorio(ctx.relatorio) }, x.motivos.join(' · '));
}
function candidatosDaConferencia(res, ctx, cfg) {
  const out = [];
  for (const x of res.linhas) { const t = tipoCandidatoConferencia(x); if (t) out.push(candidatoDaLinhaConferencia(x, ctx, cfg, t)); }
  return out;
}
function candidatoDaLinhaCorrecao(o, ctx, cfg, tipo = null) {
  const campos = camposDaLinha(o.r, o.laudo, ctx, cfg);
  const ehPrestador = tipo === 'prestador-identificado' || o.estado === 'identificado';
  const extra = ehPrestador ? { campos: { prestadorIncorreto: o.r.prestadorCod, prestadorCorrigido: o.prestador ? `${o.medico} (${o.prestador.cod})` : o.medico, medico: o.medico } } : { natureza: '' };
  return montarCandidato(tipo || (ehPrestador ? 'prestador-identificado' : 'manual'), campos, { ...ctx, tipoAnalise: 'correcao', competencia: ctx.chaveCompetencia || competenciaDoRelatorio(ctx.relatorio) }, o.detalhe, extra);
}
// Só vira candidato o laudo de médico diferente do prestador do relatório.
function candidatosDaCorrecao(res, ctx, cfg) {
  return res.linhas.filter(o => o.estado === 'identificado' && !(o.prestador && String(o.prestador.cod) === String(o.r.prestadorCod)) && norm(o.medico) !== norm(o.r.prestadorNome))
    .map(o => candidatoDaLinhaCorrecao(o, ctx, cfg, 'prestador-identificado'));
}
// Candidato → dados de uma NC nova, com as escolhas do usuário por cima da sugestão.
const dadosDoCandidato = (c, escolha) => ({ ...c.campos, categoria: escolha.categoria || c.categoria, natureza: escolha.natureza || c.natureza, competencia: escolha.competencia || c.competencia,
  responsavel: escolha.responsavel ?? c.campos.responsavel ?? '', detalhe: escolha.detalhe || '', obs: escolha.obs || '', impactaPagamento: escolha.impactaPagamento,
  origem: { ...c.origem, tipoCandidato: c.tipo, motivo: c.motivo, chaveCandidato: c.chave } });

/* ---------- Faturista do atendimento (Power BI, quando a planilha trouxer a coluna) ---------- */
function faturistaDoAtendimento(pbi, atendimento, conta) {
  if (!pbi?.temFaturista || (!atendimento && !conta)) return '';
  const nomes = new Set(pbi.linhas.filter(l => l.faturista && ((atendimento && l.atendimento === String(atendimento)) || (conta && l.conta === String(conta)))).map(l => l.faturista));
  return nomes.size === 1 ? [...nomes][0] : '';
}

/* ---------- Importação da planilha manual ---------- */
const COLUNAS_NC_PLANILHA = {
  unidade: ['UNIDADE'], natureza: ['NATUREZA DA NÃO CONFORMIDADE', 'NATUREZA'], paciente: ['NOME DO PACIENTE', 'PACIENTE'],
  idAtendimento: ['ID ou atendimento', 'ID-ATENDIMENTO', 'ID / ATENDIMENTO', 'ID', 'ATENDIMENTO'],
  responsavel: ['RESPONSAVEL PELO FAT. DA CONTA', 'RESPONSAVEL PELO FECHA. DA CONTA', 'RESPONSÁVEL PELO FECHAMENTO DA CONTA', 'RESPONSAVEL'],
  data: ['DATA'], tituloEstudo: ['TITULO DO ESTUDO'], titulo: ['TITULO DO LAUDO'], convenio: ['CONVE.', 'CONVENIO', 'CONVÊNIO'], modalidade: ['MOD.', 'MODALIDADE'],
  medico: ['NOME DO MEDICO', 'MÉDICO'], prestadorIncorreto: ['PRESTADOR INCORRETO'], prestadorCorrigido: ['PRESTADOR CORRIGIDO'],
  situacao: ['SITUAÇÃO', 'SITUACAO'], impacta: ['IMPACTA PAGAMENTO'], obs: ['OBSERVAÇÕES', 'OBSERVACOES'], enviadaEm: ['ENVIADA AO QUALIEX EM'], detalhe: ['DETALHE']
};
function categoriaDaAba(nome, cab) {
  const n = norm(nome);
  if (/PARTICULAR/.test(n)) return 'particular';
  if (/CORRECAO|PRESTADOR/.test(n) || cab.prestadorIncorreto >= 0) return 'prestador';
  if (/CONVENIO|FAT/.test(n)) return 'convenio';
  return null;
}
const SITUACAO_POR_TEXTO = Object.fromEntries(Object.entries(SITUACAO_NC).map(([k, v]) => [norm(v), k]));
// abas: [{nome, rows}] já lidas. Devolve os dados prontos para registrarNCs e o resumo da leitura.
function interpretarPlanilhaNC(abas, competencia, cfg) {
  const dados = [], resumo = [], responsaveis = new Map(), unidadesSemCadastro = new Map();
  for (const { nome, rows } of abas) {
    if (!rows.length) continue;
    const X = mapearColunas(rows[0], COLUNAS_NC_PLANILHA), cat = categoriaDaAba(nome, X);
    if (!cat) { resumo.push({ aba: nome, categoria: '', lidas: 0, ignorada: 'aba não reconhecida' }); continue; }
    const g = (r, k) => X[k] < 0 || r[X[k]] === undefined || r[X[k]] === null ? '' : r[X[k]];
    const txt = (r, k) => String(fixMojibake(g(r, k))).replace(/\.0+$/, '').trim();
    let lidas = 0, vazias = 0;
    for (const r of rows.slice(1)) {
      const paciente = txt(r, 'paciente'), titulo = txt(r, 'titulo') || txt(r, 'tituloEstudo'), textoNat = txt(r, 'natureza');
      if (!paciente && !titulo && !textoNat) { vazias++; continue; }
      const nat = cat === 'prestador' ? { natureza: 'prestador-incorreto', detalhe: '' } : naturezaPorTexto(textoNat);
      const detalhe = txt(r, 'detalhe') || nat.detalhe;
      const unidade = txt(r, 'unidade'), unidadeCod = ncDaUnidade(cfg, unidade);
      if (unidade && !unidadeCod) unidadesSemCadastro.set(unidade, (unidadesSemCadastro.get(unidade) || 0) + 1);
      const responsavel = cat === 'prestador' ? '' : txt(r, 'responsavel');
      if (responsavel) responsaveis.set(responsavel, (responsaveis.get(responsavel) || 0) + 1);
      const d = { competencia, categoria: cat, natureza: nat.natureza, detalhe, unidade, unidadeCod, paciente, idAtendimento: txt(r, 'idAtendimento'),
        data: isoDia(paraData(g(r, 'data'))), tituloEstudo: txt(r, 'tituloEstudo'), titulo: txt(r, 'titulo'), convenio: txt(r, 'convenio'), modalidade: txt(r, 'modalidade'),
        medico: cat === 'prestador' ? txt(r, 'prestadorCorrigido') : txt(r, 'medico'), prestadorIncorreto: txt(r, 'prestadorIncorreto'), prestadorCorrigido: txt(r, 'prestadorCorrigido'),
        responsavel, obs: txt(r, 'obs'), situacao: SITUACAO_POR_TEXTO[norm(txt(r, 'situacao'))] || 'aberta', enviadaEm: isoDia(paraData(g(r, 'enviadaEm'))),
        origem: { tipo: 'importada', aba: nome } };
      const imp = norm(txt(r, 'impacta')); if (imp) d.impactaPagamento = /^(SIM|S|X|1|TRUE)$/.test(imp);
      // O texto original fica nas observações quando não é exatamente o texto padronizado.
      if (cat !== 'prestador' && textoNat && norm(textoNat) !== norm(textoNatureza(d))) d.obs = [d.obs, `Texto original: ${textoNat}`].filter(Boolean).join(' · ');
      dados.push(d); lidas++;
    }
    resumo.push({ aba: nome, categoria: cat, lidas, vazias });
  }
  return { dados, resumo, responsaveis: [...responsaveis].sort((a, b) => b[1] - a[1]), unidadesSemCadastro: [...unidadesSemCadastro] };
}
async function lerPlanilhaNC(bytes, competencia, cfg) {
  const zip = await JSZip.loadAsync(bytes), abas = await abasXlsx(zip), lidas = [];
  for (const a of abas) lidas.push({ nome: a.nome, rows: await lerXlsx(bytes, { aba: a.nome }) });
  return interpretarPlanilhaNC(lidas, competencia, cfg);
}
// Competência pelo nome do arquivo: «NÃO CONFORMIDADES 09-2026.xlsx» → 2026-09.
function competenciaDoNomeNC(nome) {
  const m = String(nome).match(/(\d{1,2})[-_. /](\d{4})/);
  return m && +m[1] >= 1 && +m[1] <= 12 ? chaveCompetencia(+m[2], +m[1]) : '';
}

/* ---------- Indicadores ---------- */
// Prazo de envio que vale para a NC no Fluxo mensal: Curitiba tem fluxo próprio; nas demais unidades, USG × IMG.
const GRUPOS_PRAZO_NC = { usg: { nome: 'NCs de USG', marco: 'ncUSG', tarefa: 'usg' }, img: { nome: 'NCs de IMG e demais', marco: 'ncIMG', tarefa: 'img' }, curitiba: { nome: 'NCs de Curitiba', marco: 'fimCuritiba', tarefa: 'curitiba' } };
const grupoPrazoNC = nc => String(nc.unidadeCod) === '5' ? 'curitiba' : nc.modalidade === 'US' ? 'usg' : 'img';
function indicadoresNC(itens) {
  const r = { total: itens.length, impactam: 0, valorImpacto: 0, porSituacao: {}, porCategoria: {}, porNatureza: [], porResponsavel: [], porUnidade: [], porMedico: [], porPrazo: { usg: { total: 0, abertas: 0 }, img: { total: 0, abertas: 0 }, curitiba: { total: 0, abertas: 0 } }, anonimizadas: 0, trazidas: 0 };
  for (const k of Object.keys(SITUACAO_NC)) r.porSituacao[k] = 0;
  for (const k of Object.keys(CATEGORIA_NC)) r.porCategoria[k] = 0;
  for (const nc of itens) {
    r.porSituacao[nc.situacao]++; r.porCategoria[nc.categoria]++;
    if (nc.impactaPagamento) { r.impactam++; r.valorImpacto = r2(r.valorImpacto + (+nc.valor || 0)); }
    const g = r.porPrazo[grupoPrazoNC(nc)]; g.total++; if (nc.situacao === 'aberta') g.abertas++;
    if (nc.anonimizada) r.anonimizadas++; if (nc.deCompetencia) r.trazidas++;
  }
  const ranking = f => [...contar(itens, f)].filter(([k]) => k).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  r.porNatureza = ranking(nc => nc.natureza).map(([k, n]) => [NATUREZA_NC[k].nome, n, k]);
  r.porResponsavel = ranking(nc => nc.categoria === 'prestador' ? '' : (nc.responsavel || '(sem responsável)'));
  r.porUnidade = ranking(nc => nc.unidade || '(sem unidade)');
  r.porMedico = ranking(nc => nc.medico);
  return r;
}
