/* ============================================================
 * v3.0 — Equivalência por título do Apolo (manutenção da base em uma tela).
 * 1. A planilha do Apolo vira uma lista de TÍTULOS DISTINTOS (não de laudos), com quantas vezes cada um aparece,
 *    modalidades, unidades e exemplos sem nome de paciente.
 * 2. Cada título tem a sua situação na base: validado, coberto por regra composta, em conflito, pendente ou sem cadastro.
 * 3. As sugestões combinam semelhança de texto (título × descrição do procedimento), reaproveitamento de títulos
 *    parecidos já validados e compatibilidade de modalidade. Sugestão nunca valida nada: quem confirma é a pessoa.
 * ============================================================ */
const SITUACAO_TITULO = {
  'sem-cadastro': { nome: 'Sem equivalência', ordem: 0, cls: 'err' },
  conflito: { nome: 'Em conflito', ordem: 1, cls: 'err' },
  pendente: { nome: 'Pendente de validação', ordem: 2, cls: 'warn' },
  composta: { nome: 'Regra composta', ordem: 3, cls: 'info' },
  validada: { nome: 'Validada', ordem: 4, cls: 'ok' }
};
// Situação de um título na base (todas as relações não desativadas do título, em qualquer escopo).
function situacaoTitulo(idx, titulo, modalidade = '') {
  const kt = chaveTitulo(titulo), rel = idx.porTitulo.get(kt) || [];
  const comp = (idx.compostas || []).find(c => escopoCobre(c.escopo, '', modalidade) && compostaCasaTitulo(c, titulo) > 0);
  const val = [...new Set(rel.filter(e => e.status === 'validada').map(e => e.codigo))];
  const situacao = comp ? 'composta' : val.length > 1 ? 'conflito' : val.length === 1 ? 'validada' : rel.some(e => e.status === 'pendente' || e.status === 'coberta') ? 'pendente' : 'sem-cadastro';
  return { situacao, codigos: comp ? codigosDaRegra(comp) : val, composta: comp || null, relacoes: rel };
}
/* Títulos distintos da planilha (opcional: só de uma unidade). Exemplos sem nome de paciente. */
function titulosDoApolo(apolo, eqBase, cfg, { unidade = '*' } = {}) {
  if (!apolo?.laudos) return [];
  const idx = indiceEquivalencias(eqBase), nomesUn = unidade && unidade !== '*' ? nomesApoloDaUnidade(cfg, unidade) : null;
  const g = new Map();
  for (const l of apolo.laudos) {
    if (nomesUn && !nomesUn.has(norm(l.unidade))) continue;
    const k = chaveTitulo(l.titulo); if (!k) continue;
    let e = g.get(k);
    if (!e) g.set(k, e = { chave: k, variantes: new Map(), n: 0, modalidades: new Map(), unidades: new Map(), medicos: new Set(), exemplos: [] });
    e.n++; e.variantes.set(l.titulo, (e.variantes.get(l.titulo) || 0) + 1);
    if (l.modalidade) e.modalidades.set(l.modalidade, (e.modalidades.get(l.modalidade) || 0) + 1);
    e.unidades.set(l.unidade, (e.unidades.get(l.unidade) || 0) + 1);
    if (l.mn) e.medicos.add(l.mn);
    if (e.exemplos.length < 4) e.exemplos.push({ data: l.data, unidade: l.unidade, medico: l.medico, convenio: l.convenio, descricao: l.descricao, modalidade: l.modalidade });
  }
  const mais = m => [...m].sort((a, b) => b[1] - a[1]);
  return [...g.values()].map(e => {
    const titulo = mais(e.variantes)[0][0], modalidade = mais(e.modalidades)[0]?.[0] || '', s = situacaoTitulo(idx, titulo, modalidade);
    return { chave: e.chave, titulo, variantes: mais(e.variantes).map(([t]) => t), n: e.n, modalidade, modalidades: mais(e.modalidades), unidades: mais(e.unidades), nMedicos: e.medicos.size, exemplos: e.exemplos, ...s };
  }).sort((a, b) => SITUACAO_TITULO[a.situacao].ordem - SITUACAO_TITULO[b.situacao].ordem || b.n - a.n || a.titulo.localeCompare(b.titulo));
}

/* ---------- Sugestões ---------- */
// Palavras que não ajudam a distinguir procedimentos, e sinônimos comuns entre o Apolo e o MV.
const VAZIAS_EQ = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'COM', 'SEM', 'EM', 'A', 'O', 'AS', 'OS', 'PARA', 'POR', 'NA', 'NO', 'OU', 'OP', 'HM', 'EXAME', 'ESTUDO']);
const SINONIMOS_EQ = { USG: 'ULTRASSONOGRAFIA', US: 'ULTRASSONOGRAFIA', ULTRASSOM: 'ULTRASSONOGRAFIA', ECOGRAFIA: 'ULTRASSONOGRAFIA', ULTRASONOGRAFIA: 'ULTRASSONOGRAFIA', TC: 'TOMOGRAFIA', TOMO: 'TOMOGRAFIA', RM: 'RESSONANCIA', RNM: 'RESSONANCIA', RMN: 'RESSONANCIA', RX: 'RADIOGRAFIA', RAIO: 'RADIOGRAFIA', MMG: 'MAMOGRAFIA', MAMA: 'MAMAS', ABD: 'ABDOME', ABDOMEN: 'ABDOME', ABDOMINAL: 'ABDOME', TRANSVAG: 'TRANSVAGINAL', TV: 'TRANSVAGINAL', DOPPLERFLUXOMETRIA: 'DOPPLER', COLORIDO: 'DOPPLER', BILATERAL: 'BILATERAL' };
const tokensEq = s => [...new Set(norm(s).split(' ').filter(t => t && !VAZIAS_EQ.has(t) && !/^\d+$/.test(t)).map(t => SINONIMOS_EQ[t] || t))];
const tokenCasa = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && (a.startsWith(b.slice(0, 5)) && b.startsWith(a.slice(0, 5)))) || (a.length >= 6 && b.length >= 6 && simToken(a, b) >= 0.85);
// Semelhança (0..1) entre os tokens do título e da descrição: Dice com casamento aproximado de palavras.
function semelhancaTexto(ta, tb) {
  if (!ta.length || !tb.length) return 0;
  const usados = new Set(); let comuns = 0;
  for (const a of ta) { const j = tb.findIndex((b, i) => !usados.has(i) && tokenCasa(a, b)); if (j >= 0) { usados.add(j); comuns++; } }
  return (2 * comuns) / (ta.length + tb.length);
}
/* Sugere procedimentos para o título. catalogoTuss: [{cod, nome, info(grupo), origem}] (catalogo('tuss')).
 * Devolve até `limite` sugestões: {codigo, desc, grupo, nota, motivos:[...]}, da mais forte para a mais fraca. */
function sugerirCodigos(titulo, catalogoTuss, eqBase, { modalidade = '', limite = 8 } = {}) {
  const tt = tokensEq(titulo), kt = chaveTitulo(titulo), sug = new Map();
  const pegar = (codigo, desc, grupo) => sug.get(codigo) || sug.set(codigo, { codigo, desc: desc || '', grupo: grupo || '', texto: 0, reuso: 0, motivos: [] }).get(codigo);
  for (const it of catalogoTuss || []) {
    if (!it.cod || !/^\d{5,}$/.test(String(it.cod))) continue;
    const s = semelhancaTexto(tt, tokensEq(it.nome)); if (s < 0.25) continue;
    const e = pegar(String(it.cod), it.nome, it.info); e.texto = Math.max(e.texto, s);
  }
  // Reaproveitamento: títulos parecidos já validados indicam o código (com quem validou).
  const vistos = new Map();
  for (const e of eqBase?.itens || []) {
    if (e.status !== 'validada' || chaveTitulo(e.titulo) === kt) continue;
    const s = semelhancaTexto(tt, tokensEq(e.titulo)); if (s < 0.6) continue;
    const x = pegar(e.codigo, e.descMV, ''); if (s > x.reuso) { x.reuso = s; vistos.set(e.codigo, e); }
  }
  for (const [cod, e] of vistos) pegar(cod).motivos.push(`título parecido já validado: «${e.titulo}»${e.responsavel ? ` (${e.responsavel})` : ''}`);
  const descDe = new Map((catalogoTuss || []).map(it => [String(it.cod), it]));
  return [...sug.values()].map(e => {
    const c = descDe.get(e.codigo); if (!e.desc && c) e.desc = c.nome; if (!e.grupo && c) e.grupo = c.info || '';
    const mods = e.grupo ? modalidadesDoGrupo(e.grupo) : null, incompat = !!(modalidade && mods && !mods.includes(modalidade));
    if (e.texto >= 0.25) e.motivos.unshift(`texto ${Math.round(e.texto * 100)}% parecido com a descrição`);
    if (incompat) e.motivos.push(`grupo «${e.grupo}» não é da modalidade ${modalidade}`);
    const nota = Math.max(e.texto, e.reuso * 0.95) * (incompat ? 0.4 : 1) + (e.texto && e.reuso ? 0.05 : 0);
    return { ...e, nota: Math.min(1, Math.round(nota * 100) / 100), incompat };
  }).filter(e => e.nota >= 0.3).sort((a, b) => b.nota - a.nota || a.codigo.localeCompare(b.codigo)).slice(0, limite);
}
/* Confirma a equivalência simples título → código, com responsável e histórico. Reaproveita a relação existente
 * (pendente/coberta/desativada) em vez de duplicar. Não mexe em outros códigos validados do título: o chamador
 * decide (substituir, regra composta…) e a conferência continua apontando conflito enquanto houver dois. */
function confirmarEquivalenciaTitulo(eqBase, { titulo, codigo, descMV = '', modalidade = '*', responsavel, motivo = '', competencia = '' }) {
  if (!responsavel) throw new Error('Informe o responsável antes de validar equivalências.');
  if (!/^\d{5,}$/.test(String(codigo))) throw new Error(`Código TUSS inválido «${codigo}».`);
  const escopo = { unidade: '*', modalidade: modalidade || '*' };
  let rel = eqBase.itens.find(e => e.codigo === String(codigo) && chaveTitulo(e.titulo) === chaveTitulo(titulo) && (e.escopo?.unidade || '*') === '*' && (e.escopo?.modalidade || '*') === escopo.modalidade);
  if (!rel) { rel = novaRelacao({ codigo: String(codigo), titulo, descMV, escopo, origem: `Títulos do Apolo (${responsavel})`, justificativa: motivo }); eqBase.itens.push(rel); eqBase.revisao++; eqBase.atualizadoEm = agoraISO(); }
  else if (!rel.descMV && descMV) rel.descMV = descMV;
  alterarStatusEq(eqBase, [rel.id], 'validada', responsavel, motivo || 'confirmada em Títulos do Apolo', competencia);
  return rel;
}
