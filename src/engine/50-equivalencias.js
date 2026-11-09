/* ============================================================
 * Base de equivalências TUSS (MV) ↔ título do laudo (Apolo)
 * Cada relação é um par (código TUSS, título) com status, escopo e histórico.
 * Só relação VALIDADA, dentro do escopo e sem conflito sustenta confirmação (RN-193 a RN-196).
 * ============================================================ */
const STATUS_EQ = { validada: 'Validada', pendente: 'Pendente', desativada: 'Desativada', coberta: 'Coberta por regra composta' };
const TIPOS_EQ = { titulo: 'Validada por título', descricao: 'Validada por descrição/contexto', exata: 'Exata (mesmo código)' };

// Chave de título: normalizado, com sufixo administrativo final -OP/-HM opcional.
const chaveTitulo = t => norm(t).replace(/\s+(OP|HM)$/, '').trim();

function eqVazia() {
  return { schema: SCHEMA_EQ, versaoSchema: 1, revisao: 0, atualizadoEm: agoraISO(), itens: [], compostas: [], catalogoTitulos: [], catalogoTUSS: [] };
}

/* ---------- Regras compostas e por convênio (SOL-F5, v2 de 04/11/2026) ----------
 * Um exame laudado no Apolo pode corresponder a MAIS DE UM procedimento na conta do MV.
 * Regra: {id, nome, titulos:[...], palavras:{todas:[...], umaDe:[...]}, itens:[{rotulo, codigos:[principal,
 *   alternativas...], qtd, excecoes:[{convenio:'UNIMED', tipo:'nao-exigido'|'quantidade', qtd}]}], escopo, status,
 *   responsavel, validadoEm, justificativa, historico}.
 * - Vários títulos do Apolo, ou títulos por palavras (ex.: contém DOPPLER e um de ARTICULAR, PUNHO, OMBRO…).
 * - Quantidade por procedimento: o mesmo código lançado 2 vezes (ex.: Doppler das duas mamas).
 * - Alternativas na mesma posição (qualquer um dos códigos).
 * - Excludente de convênio: «não exigido» ou outra quantidade naquele convênio (ex.: UNIMED paga só o Doppler).
 * Só regra VALIDADA vale na conferência. A versão antiga {titulo, codigos, porConvenio} é lida como v2. */
function novaComposta(campos) {
  return { id: novoId('cmp'), nome: '', titulos: [], palavras: null, itens: [], escopo: { unidade: '*', modalidade: '*' }, status: 'pendente', responsavel: '', validadoEm: '', justificativa: '', historico: [], ...campos };
}
function regraComposta(c) {
  if (Array.isArray(c.itens) && c.itens.length) return c;
  const itens = (c.codigos || []).map(cod => ({ rotulo: '', codigos: [cod], qtd: 1, excecoes: [] }));
  for (const v of c.porConvenio || []) {
    for (const it of itens) if (!v.codigos.includes(it.codigos[0])) it.excecoes.push({ convenio: v.convenio, tipo: 'nao-exigido', qtd: 0 });
    for (const cod of v.codigos) if (!itens.some(i => i.codigos.includes(cod))) itens.push({ rotulo: '', codigos: [cod], qtd: 0, excecoes: [{ convenio: v.convenio, tipo: 'quantidade', qtd: 1 }] });
  }
  return { ...c, nome: c.nome || c.titulo || '', titulos: c.titulos || (c.titulo ? [c.titulo] : []), palavras: c.palavras || null, itens };
}
const nomeComposta = c => { const r = regraComposta(c); return r.nome || r.titulos[0] || 'regra composta'; };
// Quantidade exigida de um procedimento no convênio da linha (exceção cujo texto está no nome do convênio).
function qtdNoConvenio(it, convenio = '') {
  const n = norm(convenio || ''), e = (it.excecoes || []).find(x => x.convenio && n.includes(norm(x.convenio)));
  return e ? (e.tipo === 'nao-exigido' ? 0 : (+e.qtd || 0)) : (+it.qtd || 0);
}
function esperadosDaComposta(c, convenio = '') {
  return regraComposta(c).itens.map((it, i) => ({ i, codigos: it.codigos, rotulo: it.rotulo || it.codigos[0], qtd: qtdNoConvenio(it, convenio), qtdGeral: +it.qtd || 0 }));
}
const textoEsperados = esp => esp.filter(e => e.qtd > 0).map(e => `${e.rotulo}${e.qtd > 1 ? ` ×${e.qtd}` : ''}`).join(' + ');
// O título do laudo é reconhecido pela regra: pela lista de títulos ou pelas palavras.
function compostaCasaTitulo(c, titulo) {
  const r = regraComposta(c), kt = chaveTitulo(titulo);
  if (r.titulos.some(t => chaveTitulo(t) === kt)) return 2;
  const p = r.palavras || {}, todas = (p.todas || []).filter(Boolean), umaDe = (p.umaDe || []).filter(Boolean);
  if (!todas.length && !umaDe.length) return 0;
  const t = norm(titulo);
  return todas.every(w => t.includes(norm(w))) && (!umaDe.length || umaDe.some(w => t.includes(norm(w)))) ? 1 : 0;
}
// Código usado pela regra (para a conferência apontar quem sustentou e o que sobra).
const codigosDaRegra = c => [...new Set(regraComposta(c).itens.flatMap(i => i.codigos))];
function alterarStatusComposta(base, id, novoStatus, responsavel, motivo = '', competencia = '') {
  if (!responsavel) throw new Error('Informe o responsável antes de validar regras compostas.');
  const c = (base.compostas || []).find(x => x.id === id); if (!c || c.status === novoStatus) return 0;
  c.historico.push({ em: agoraISO(), por: responsavel, de: c.status, para: novoStatus, motivo, competencia });
  c.status = novoStatus; if (novoStatus === 'validada') { c.responsavel = responsavel; c.validadoEm = agoraISO(); }
  base.revisao++; base.atualizadoEm = agoraISO();
  return 1;
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
function mesclarEquivalencias(base, novos, { catalogoTitulos = [], catalogoTUSS = [], compostas = [] } = {}) {
  // Regras compostas (SOL-F5): entram as de título e escopo ainda não cadastrados.
  base.compostas = base.compostas || [];
  const kc = c => `${norm(nomeComposta(c))}|${c.escopo?.unidade || '*'}`, temC = new Set(base.compostas.map(kc));
  for (const c of compostas) if (!temC.has(kc(c))) { base.compostas.push({ ...c, historico: c.historico || [] }); temC.add(kc(c)); }
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
  const compostas = (base.compostas || []).filter(c => c.status === 'validada').map(regraComposta), cacheComp = new Map();
  for (const e of base.itens) {
    if (e.status === 'desativada') continue;
    const kt = chaveTitulo(e.titulo); if (!kt) continue;
    (porTitulo.get(kt) || porTitulo.set(kt, []).get(kt)).push(e);
    (porCodigo.get(e.codigo) || porCodigo.set(e.codigo, []).get(e.codigo)).push(e);
  }
  return { porTitulo, porCodigo, compostas, cacheComp, revisao: base.revisao };
}

/* Avalia se o título do laudo sustenta o código TUSS do MV (RN-192, RN-198).
 * Resultado: validada · conflito · pendente · divergente (código tem validação, título não) · sem-cadastro */
function avaliarProcedimento(idx, codigo, titulo, { unidade = '', modalidade = '', convenio = '' } = {}) {
  const kt = chaveTitulo(titulo);
  if (!kt) return { estado: 'sem-titulo', motivo: 'Laudo sem TITLE' };
  // Regra composta validada para o título: vale por cima das relações simples (SOL-F5). Título da lista
  // antes de título por palavras.
  const ck = `${kt}|${unidade}|${modalidade}`;
  let comp = idx.cacheComp?.get(ck);
  if (comp === undefined) {
    let melhor = null, nota = 0;
    for (const c of idx.compostas || []) { if (!escopoCobre(c.escopo, unidade, modalidade)) continue; const n = compostaCasaTitulo(c, titulo); if (n > nota) { nota = n; melhor = c; } }
    comp = melhor; idx.cacheComp?.set(ck, comp);
  }
  if (comp) {
    const esp = esperadosDaComposta(comp, convenio), porConv = esp.some(e => e.qtd !== e.qtdGeral), nome = nomeComposta(comp);
    const item = esp.find(e => e.qtd > 0 && e.codigos.includes(codigo));
    if (item) return { estado: 'validada', composta: comp, esperados: esp, itemIdx: item.i, motivo: `Regra composta «${nome}» validada: «${titulo}» = ${textoEsperados(esp)}${porConv ? ` (convênio ${convenio})` : ''} (${comp.responsavel || 'sem responsável'})` };
    const dispensado = esp.find(e => e.qtd === 0 && e.codigos.includes(codigo));
    return { estado: 'divergente', composta: comp, esperados: esp, sobra: true, motivo: dispensado
      ? `Regra composta «${nome}»: no convênio ${convenio}, ${dispensado.rotulo} não é exigido (excludente do convênio); o código ${codigo} não deveria estar na conta`
      : `Regra composta «${nome}»: «${titulo}» = ${textoEsperados(esp)}; o código ${codigo} não faz parte` };
  }
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
    if (cods.length > 1) out.push({ chave: kt, titulo: val[0].titulo, codigos: cods, ids: val.map(e => e.id), relacoes: val });
  }
  return out;
}
// Desfazer conflito: ficam validadas só as relações do código escolhido; as demais do mesmo título voltam a pendente.
function resolverConflito(base, chaveT, codigoManter, responsavel, justificativa, competencia = '') {
  if (!String(justificativa || '').trim()) throw new Error('Informe a justificativa para desfazer o conflito.');
  const doTitulo = base.itens.filter(e => e.status === 'validada' && chaveTitulo(e.titulo) === chaveT);
  if (!doTitulo.some(e => e.codigo === codigoManter)) throw new Error(`O código ${codigoManter} não está validado para este título.`);
  const ids = doTitulo.filter(e => e.codigo !== codigoManter).map(e => e.id);
  return alterarStatusEq(base, ids, 'pendente', responsavel, `Conflito desfeito: mantido o código ${codigoManter}. ${justificativa.trim()}`, competencia);
}

/* Relações pendentes resolvidas por regra composta validada (mesmo título e código da regra) saem de «Pendentes»
 * e ficam «Cobertas por regra composta»; se a regra deixar de valer, voltam a pendente. Devolve o nº de mudanças. */
function aplicarCobertas(base, operador = '', competencia = '') {
  const regras = (base.compostas || []).map(regraComposta), porId = new Map(regras.map(r => [r.id, r]));
  const valida = regras.filter(r => r.status === 'validada');
  const cobre = (r, e) => compostaCasaTitulo(r, e.titulo) > 0 && r.itens.some(it => (it.codigos || []).includes(e.codigo)) && escopoCobre(r.escopo, e.escopo?.unidade === '*' ? '' : e.escopo?.unidade, e.escopo?.modalidade === '*' ? '' : e.escopo?.modalidade);
  let n = 0;
  for (const e of base.itens || []) {
    if (e.status === 'pendente') {
      const r = valida.find(x => cobre(x, e)); if (!r) continue;
      e.historico.push({ em: agoraISO(), por: operador || r.responsavel || '', de: 'pendente', para: 'coberta', motivo: `coberta pela regra composta «${nomeComposta(r)}»`, competencia });
      e.status = 'coberta'; e.cobertaPor = r.id; n++;
    } else if (e.status === 'coberta') {
      const r = porId.get(e.cobertaPor);
      if (r && r.status === 'validada' && cobre(r, e)) continue;
      e.historico.push({ em: agoraISO(), por: operador || '', de: 'coberta', para: 'pendente', motivo: r ? `regra composta «${nomeComposta(r)}» deixou de valer` : 'regra composta removida', competencia });
      e.status = 'pendente'; delete e.cobertaPor; n++;
    }
  }
  if (n) { base.revisao++; base.atualizadoEm = agoraISO(); }
  return n;
}
