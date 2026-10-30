/* ============================================================
 * Base de equivalências TUSS (MV) ↔ título do laudo (Apolo)
 * Cada relação é um par (código TUSS, título) com status, escopo e histórico.
 * Só relação VALIDADA, dentro do escopo e sem conflito sustenta confirmação (RN-193 a RN-196).
 * ============================================================ */
const STATUS_EQ = { validada: 'Validada', pendente: 'Pendente', desativada: 'Desativada' };
const TIPOS_EQ = { titulo: 'Validada por título', descricao: 'Validada por descrição/contexto', exata: 'Exata (mesmo código)' };

// Chave de título: normalizado, com sufixo administrativo final -OP/-HM opcional.
const chaveTitulo = t => norm(t).replace(/\s+(OP|HM)$/, '').trim();

function eqVazia() {
  return { schema: SCHEMA_EQ, versaoSchema: 1, revisao: 0, atualizadoEm: agoraISO(), itens: [], catalogoTitulos: [], catalogoTUSS: [] };
}

function novaRelacao(campos) {
  return {
    id: novoId('eq'), codigo: '', descMV: '', titulo: '', campo: 'TITLE', tipo: 'titulo', status: 'pendente',
    direcao: 'mv->apolo', escopo: { unidade: '*', modalidade: '*' }, confianca: '', ambiguo: false,
    justificativa: '', atencao: '', origem: '', responsavel: '', validadoEm: '', historico: [], ...campos
  };
}

function validarEq(base) {
  const erros = [];
  if (!base || base.schema !== SCHEMA_EQ) return ['arquivo não é uma base de equivalências do Repasse Médico'];
  if (base.versaoSchema !== 1) erros.push(`versão de esquema ${base.versaoSchema} não suportada`);
  if (!Array.isArray(base.itens)) return [...erros, 'lista de relações ausente'];
  base.itens.forEach((e, i) => {
    if (!/^\d{5,}$/.test(String(e.codigo))) erros.push(`relação ${i + 1}: código TUSS inválido «${e.codigo}»`);
    if (!String(e.titulo || '').trim()) erros.push(`relação ${i + 1}: título vazio`);
    if (!STATUS_EQ[e.status]) erros.push(`relação ${i + 1}: status inválido «${e.status}»`);
  });
  return erros.slice(0, 20);
}

/* Importa a planilha de análise (abas ANALISE_EQUIVALENCIAS, TODOS_APOLO e BASE_TUSS).
 * Todos os candidatos entram como PENDENTES: a planilha propõe, um responsável valida. */
async function importarPlanilhaEquivalencias(bytes, nomeArquivo) {
  const rowsA = await lerXlsx(bytes, { aba: 'ANALISE_EQUIVALENCIAS' });
  let rowsT = null, rowsB = null;
  try { rowsT = await lerXlsx(bytes, { aba: 'TODOS_APOLO' }); } catch (e) { }
  try { rowsB = await lerXlsx(bytes, { aba: 'BASE_TUSS' }); } catch (e) { }
  const XA = mapearColunas(rowsA[0], { titulo: ['TITLE_APOLO', 'TITLE'], codigo: ['COD_TUSS_CANDIDATO'], desc: ['DESCRICAO_TUSS_CANDIDATO'], confianca: ['CONFIANCA'], status: ['STATUS'], just: ['JUSTIFICATIVA'], atencao: ['PONTO_DE_ATENCAO'] });
  if (XA.titulo < 0 || XA.codigo < 0) throw new Error('Aba ANALISE_EQUIVALENCIAS sem as colunas TITLE_APOLO / COD_TUSS_CANDIDATO.');
  const tuss = new Map();
  if (rowsB) {
    const XB = mapearColunas(rowsB[0], { grupo: ['Grupo Procedimento'], codigo: ['Cod. Procedimento'], desc: ['Desc. Procedimento'] });
    for (const r of rowsB.slice(1)) { const c = String(r[XB.codigo] ?? '').replace(/\.0+$/, ''); if (c) tuss.set(c, { codigo: c, desc: String(r[XB.desc] ?? ''), grupo: String(r[XB.grupo] ?? '') }); }
  }
  const candidatosTexto = new Map();
  if (rowsT) {
    const XT = mapearColunas(rowsT[0], { titulo: ['TITLE'], cand: ['CANDIDATO_TUSS'] });
    for (const r of rowsT.slice(1)) candidatosTexto.set(String(r[XT.titulo] ?? ''), String(r[XT.cand] ?? ''));
  }
  const g = (r, k) => XA[k] < 0 || r[XA[k]] === undefined ? '' : String(r[XA[k]]).trim();
  const itens = [], catalogo = [];
  const origem = `planilha ${nomeArquivo}`;
  for (const r of rowsA.slice(1)) {
    const tituloOriginal = g(r, 'titulo'); if (!tituloOriginal) continue;
    const titulo = fixMojibake(tituloOriginal).trim();
    const statusPlanilha = g(r, 'status'), confianca = g(r, 'confianca');
    catalogo.push({ titulo, tituloOriginal, statusPlanilha, confianca });
    const base = { titulo, confianca, justificativa: g(r, 'just'), atencao: g(r, 'atencao'), origem, statusPlanilha };
    const codigos = new Set();
    const cod = g(r, 'codigo').replace(/\.0+$/, '');
    if (cod) codigos.add(cod);
    if (/AMB[IÍ]GUO/i.test(statusPlanilha)) {
      // Ambíguos: todos os candidatos citados viram relações pendentes marcadas como ambíguas.
      const txt = (candidatosTexto.get(tituloOriginal) || '') + ' ' + g(r, 'atencao');
      for (const m of txt.matchAll(/\b(\d{8})\s*-/g)) codigos.add(m[1]);
    }
    for (const c of codigos) itens.push(novaRelacao({ ...base, codigo: c, descMV: tuss.get(c)?.desc || (c === cod ? g(r, 'desc') : ''), ambiguo: /AMB[IÍ]GUO/i.test(statusPlanilha) }));
  }
  return { itens, catalogoTitulos: catalogo, catalogoTUSS: [...tuss.values()] };
}

/* Mescla relações novas numa base: o par (código, chave do título, escopo) identifica a relação.
 * Uma relação já existente nunca é rebaixada nem apagada pela importação. */
function mesclarEquivalencias(base, novos, { catalogoTitulos = [], catalogoTUSS = [] } = {}) {
  const k = e => `${e.codigo}|${chaveTitulo(e.titulo)}|${e.escopo?.unidade || '*'}|${e.escopo?.modalidade || '*'}`;
  const existentes = new Map(base.itens.map(e => [k(e), e]));
  let adicionadas = 0, ignoradas = 0;
  for (const e of novos) {
    if (existentes.has(k(e))) { ignoradas++; continue; }
    base.itens.push(e); existentes.set(k(e), e); adicionadas++;
  }
  const titulos = new Map((base.catalogoTitulos || []).map(t => [chaveTitulo(t.titulo), t]));
  for (const t of catalogoTitulos) if (!titulos.has(chaveTitulo(t.titulo))) titulos.set(chaveTitulo(t.titulo), t);
  base.catalogoTitulos = [...titulos.values()];
  const tuss = new Map((base.catalogoTUSS || []).map(t => [t.codigo, t]));
  for (const t of catalogoTUSS) if (!tuss.has(t.codigo)) tuss.set(t.codigo, t);
  base.catalogoTUSS = [...tuss.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  return { adicionadas, ignoradas };
}

// Muda o status de relações, sempre com responsável e histórico (RN-184, RN-196).
function alterarStatusEq(base, ids, novoStatus, responsavel, motivo = '', competencia = '') {
  if (!responsavel) throw new Error('Informe o responsável (Configurações → Operador) antes de validar ou desativar equivalências.');
  if (!STATUS_EQ[novoStatus]) throw new Error('Status inválido.');
  const alvo = new Set(ids); let n = 0;
  for (const e of base.itens) {
    if (!alvo.has(e.id) || e.status === novoStatus) continue;
    e.historico.push({ em: agoraISO(), por: responsavel, de: e.status, para: novoStatus, motivo, competencia });
    e.status = novoStatus; n++;
    if (novoStatus === 'validada') { e.responsavel = responsavel; e.validadoEm = agoraISO(); }
  }
  if (n) { base.revisao++; base.atualizadoEm = agoraISO(); }
  return n;
}

const escopoCobre = (escopo, unidade, modalidade) =>
  (!escopo || escopo.unidade === '*' || !unidade || String(escopo.unidade) === String(unidade)) &&
  (!escopo || escopo.modalidade === '*' || !modalidade || escopo.modalidade === modalidade);

/* Índice de consulta para os motores. Para cada chave de título: relações por código.
 * Conflito = o mesmo título validado para dois ou mais códigos em escopos que se sobrepõem. */
function indiceEquivalencias(base) {
  const porTitulo = new Map(), porCodigo = new Map();
  for (const e of base.itens) {
    if (e.status === 'desativada') continue;
    const kt = chaveTitulo(e.titulo); if (!kt) continue;
    (porTitulo.get(kt) || porTitulo.set(kt, []).get(kt)).push(e);
    (porCodigo.get(e.codigo) || porCodigo.set(e.codigo, []).get(e.codigo)).push(e);
  }
  return { porTitulo, porCodigo, revisao: base.revisao };
}

/* Avalia se o título do laudo sustenta o código TUSS do MV (RN-192, RN-198).
 * Resultado: validada · conflito · pendente · divergente (código tem validação, título não) · sem-cadastro */
function avaliarProcedimento(idx, codigo, titulo, { unidade = '', modalidade = '' } = {}) {
  const kt = chaveTitulo(titulo);
  if (!kt) return { estado: 'sem-titulo', motivo: 'Laudo sem TITLE' };
  const doTitulo = (idx.porTitulo.get(kt) || []).filter(e => escopoCobre(e.escopo, unidade, modalidade));
  const valTitulo = doTitulo.filter(e => e.status === 'validada');
  const relacao = doTitulo.filter(e => e.codigo === codigo);
  const validada = relacao.find(e => e.status === 'validada');
  if (validada) {
    const outros = [...new Set(valTitulo.filter(e => e.codigo !== codigo).map(e => e.codigo))];
    if (outros.length) return { estado: 'conflito', relacao: validada, outros, motivo: `Título «${titulo}» validado também para ${outros.join(', ')}` };
    return { estado: 'validada', relacao: validada, motivo: `Equivalência validada (${validada.responsavel || 'sem responsável'})` };
  }
  if (relacao.length) return { estado: 'pendente', relacao: relacao[0], motivo: `Equivalência ${relacao[0].ambiguo ? 'ambígua ' : ''}ainda não validada` };
  const valCodigo = (idx.porCodigo.get(codigo) || []).some(e => e.status === 'validada' && escopoCobre(e.escopo, unidade, modalidade));
  if (valCodigo || valTitulo.length) return { estado: 'divergente', motivo: valTitulo.length ? `Título validado para outro código (${[...new Set(valTitulo.map(e => e.codigo))].join(', ')})` : 'Código tem títulos validados, mas não este' };
  return { estado: 'sem-cadastro', motivo: 'Sem equivalência cadastrada para o par código × título' };
}

// Conflitos atuais entre relações validadas (para o painel da base).
function conflitosEquivalencias(base) {
  const out = [];
  const idx = indiceEquivalencias(base);
  for (const [kt, rel] of idx.porTitulo) {
    const val = rel.filter(e => e.status === 'validada');
    const cods = [...new Set(val.map(e => e.codigo))];
    if (cods.length > 1) out.push({ titulo: val[0].titulo, codigos: cods, ids: val.map(e => e.id) });
  }
  return out;
}
