/* ============================================================
 * Regras de repasse (SOL-F7): percentuais de USG, classes por produção, valores de laudo
 * do IMG, convênios (SUS · Convênio · Particular) e regras diferenciadas por prestador.
 * Padrão para todos; diferenciado no cadastro do prestador. A ferramenta não recalcula
 * o repasse: usa as regras para conferir e avisar.
 * ============================================================ */
const FAIXAS_USG_PADRAO = [
  { id: 'geral', nome: 'Repasse médicos geral', base: 'unidade', acrescimo: 0 },
  { id: 'mais2', nome: 'Repasse com acréscimo de 2%', base: 'unidade', acrescimo: 0.02 },
  { id: 'residente', nome: 'Repasse residentes 35%', base: 'residente', acrescimo: 0 },
  ...[40, 49, 50, 55, 70].map(n => ({ id: 'p' + n, nome: `Repasse ${n}%`, base: 'fixo', pct: n / 100 }))
];
// Percentual de USG por unidade (médicos / residentes) e CNPJ para a nota fiscal.
const UNIDADES_REGRAS = {
  1: { cnpj: '10.304.593/0001-33', pctUSG: { medico: 0.44, residente: 0.35 } },
  2: { cnpj: '10.304.593/0004-86', pctUSG: { medico: 0.49, residente: 0.35 } },
  4: { cnpj: '09.346.898/0002-00', pctUSG: { medico: 0.40, residente: 0.35 } },
  5: { cnpj: '10.563.835/0001-03', pctUSG: null },
  7: { cnpj: '02.978.370/0002-04', pctUSG: { medico: 0.40, residente: 0.35 } },
  10: { cnpj: '10.304.593/0005-67', pctUSG: { medico: 0.44, residente: 0.35 } },
  11: { cnpj: '', pctUSG: null },
  17: { cnpj: '10.304.593/0007-29', pctUSG: { medico: 0.42, residente: 0.35 } }
};
const EXAMES_IMG = { RX: 'Raio-X', MAMO: 'Mamografia', DENSITO: 'Densitometria', TOMO: 'Tomografia', RESSO: 'Ressonância' };
const COLUNAS_CLASSE = ['residente', 'D', 'C', 'B', 'A'];
const v5 = (residente, D, C, B, A) => ({ residente, D, C, B, A });
function classesPadrao() {
  return {
    vigencia: '2026',
    // Produção bruta de USG (todas as unidades) ACIMA do valor → classe. Abaixo do último corte: D.
    cortes: [{ classe: 'A', acima: 26524.38 }, { classe: 'B', acima: 19679.38 }, { classe: 'C', acima: 9411.88 }],
    valores: {
      convenio: { RX: v5(3, 4.1, 4.5, 4.9, 5.5), MAMO: v5(8, 15.3, 16.83, 18.36, 20.66), DENSITO: v5(5, 7.14, 7.14, 8.16, 9.18), TOMO: v5(18, 20.4, 24.48, 26.52, 29.58), RESSO: v5(22, 32.65, 35.7, 40.8, 44.88) },
      sus: { RX: v5(3, 3.2, 3.5, 3.8, 4.3), MAMO: v5(8, 11, 12, 13.2, 14.85), DENSITO: v5(5, 6, 6.5, 7, 8), TOMO: v5(15, 20, 22, 24, 27), RESSO: v5(17, 26, 28, 31, 40) }
    },
    // Procedimentos equivalentes: valem N exames do tipo base, ou um valor fixo.
    equivalentes: [
      { nome: 'Angiotomografia', padrao: 'ANGIO ?TOMO|ANGIO ?TC|ANGIOTC', exame: 'TOMO', fator: 2 },
      { nome: 'Angiorressonância', padrao: 'ANGIO ?R+ESSO|ANGIO ?RM|ANGIORM', exame: 'RESSO', fator: 1.5 },
      { nome: 'Artrorressonância', padrao: 'ARTRO ?R+ESSO|ARTRO ?RM', exame: 'RESSO', fator: 2 },
      { nome: 'Artrotomografia', padrao: 'ARTRO ?TOMO|ARTRO ?TC', exame: 'TOMO', fator: 2 },
      { nome: 'Dacriotomografia', padrao: 'DACRIO', exame: 'TOMO', fator: 2 },
      { nome: 'Infiltração tomografia', padrao: 'INFILTRA.*(TOMO|TC)', exame: 'TOMO', fator: 1.5 },
      { nome: 'Infiltração ressonância', padrao: 'INFILTRA.*(R+ESSO|RM)', exame: 'RESSO', fator: 1.5 },
      { nome: 'Perfusão', padrao: 'PERFUSAO', valor: 250 },
      { nome: 'Fusão de imagem', padrao: 'FUSAO', pctUnidade: true }
    ]
  };
}
// Categorias de NF complementar: padrão de unidade/CNPJ de emissão e valor unitário, editáveis pelo uso.
const CATEGORIAS_NF_PADRAO = [
  { nome: 'Laudos PET-CT', tipos: ['img'], unidade: '17', valorUnitario: 0 },
  { nome: 'Aplicação Pluvicto', tipos: ['img'], unidade: '17', valorUnitario: 0 },
  { nome: 'Curso Cetrus', tipos: ['img'], unidade: '17', valorUnitario: 1000 },
  { nome: 'Reajuste', tipos: ['img'], unidade: '', valorUnitario: 0 }
];
const FECHAMENTO_PADRAO = { cnpjBoard: '10.304.593/0007-29', cnpjPlantao: '10.304.593/0001-33', variacaoAlerta: 30, toleranciaPct: 0.5, toleranciaValor: 0.05, categoriasNF: CATEGORIAS_NF_PADRAO };
const TIPOS_CONVENIO = { SUS: 'SUS', CONVENIO: 'Convênio', PARTICULAR: 'Particular' };

// Acrescenta as regras a configurações antigas sem apagar o que o usuário editou.
function migrarRegras(c) {
  let mudou = false;
  for (const u of c.unidades || []) {
    const pad = UNIDADES_REGRAS[u.cod];
    if (u.cnpj === undefined) { u.cnpj = pad?.cnpj || ''; mudou = true; }
    if (u.pctUSG === undefined) { u.pctUSG = pad?.pctUSG ? { ...pad.pctUSG } : null; mudou = true; }
  }
  if (!Array.isArray(c.faixasUSG)) { c.faixasUSG = clone(FAIXAS_USG_PADRAO); mudou = true; }
  if (!c.classes) { c.classes = classesPadrao(); mudou = true; }
  // 04/11/2026: a fusão de imagem passa a valer o percentual da unidade (antes R$ 250,00 fixo). Migra uma vez.
  if (c.classes && !c.classes.fusaoPctUnidade) { const f = (c.classes.equivalentes || []).find(e => e.padrao === 'FUSAO'); if (f && !f.pct) { f.pctUnidade = true; f.valor = 0; } c.classes.fusaoPctUnidade = true; mudou = true; }
  if (!Array.isArray(c.convenios)) { c.convenios = []; mudou = true; }
  if (!c.fechamento) { c.fechamento = clone(FECHAMENTO_PADRAO); mudou = true; }
  if (!Array.isArray(c.fechamento.categoriasNF)) { c.fechamento.categoriasNF = clone(CATEGORIAS_NF_PADRAO); mudou = true; }
  for (const p of c.prestadores || []) if (p.regras === undefined) { p.regras = regrasPrestadorVazias(); mudou = true; }
  return mudou;
}
const regrasPrestadorVazias = () => ({ tipo: 'medico', faixaUSG: '', pctUSGUnidade: {}, board: 0, participaIMG: false, v3: false, v3regra: null, classeFixa: '', tabelaIMG: 'padrao', excecoesIMG: [], obs: '' });

/* ---------- USG ---------- */
// Percentual esperado de USG do prestador numa unidade (null = sem regra).
function pctUSGEsperado(cfg, p, unidadeCod) {
  const r = p?.regras; if (!r) return null;
  const dif = r.pctUSGUnidade?.[unidadeCod];
  if (dif !== undefined && dif !== '' && dif !== null) return +dif;
  const f = (cfg.faixasUSG || []).find(x => x.id === r.faixaUSG); if (!f) return null;
  if (f.base === 'fixo') return +f.pct;
  const u = unidadePorCod(cfg, unidadeCod); if (!u?.pctUSG) return null;
  return f.base === 'residente' ? +u.pctUSG.residente : r2((+u.pctUSG.medico + (+f.acrescimo || 0)) * 10000) / 10000;
}

/* ---------- Classe por produção ---------- */
function classePorProducao(classes, producao) {
  for (const c of classes.cortes) if (producao > c.acima) return c.classe;
  return 'D';
}
const classeDoPrestador = (classes, p, producao) => p?.regras?.classeFixa ? { classe: p.regras.classeFixa, fixa: true } : { classe: classePorProducao(classes, producao || 0), fixa: false };

/* ---------- Convênios ---------- */
const tipoConvenio = (cfg, nome) => (cfg.convenios || []).find(c => norm(c.nome) === norm(nome))?.tipo || '';
function registrarConvenios(cfg, lista, origem) {
  let novos = 0, tipados = 0;
  for (const [nome, tipo] of lista) {
    if (!String(nome || '').trim()) continue;
    const c = cfg.convenios.find(x => norm(x.nome) === norm(nome));
    const t = TIPOS_CONVENIO[String(tipo || '').toUpperCase()] ? String(tipo).toUpperCase() : '';
    if (!c) { cfg.convenios.push({ nome: String(nome).trim(), tipo: t, origem }); novos++; }
    else if (!c.tipo && t) { c.tipo = t; tipados++; }   // nunca troca um tipo já definido (ex.: SUS marcado à mão)
  }
  return { novos, tipados };
}

/* ---------- Valor esperado de um laudo do IMG ---------- */
const GRUPO_EXAME = [[/RADIOLOG|RAIO/, 'RX'], [/MAMOGRAF/, 'MAMO'], [/DENSITOMETR/, 'DENSITO'], [/TOMOGRAF/, 'TOMO'], [/RESSONANC/, 'RESSO']];
function exameDaLinha(classes, grupo, desc) {
  const d = norm(desc);
  for (const e of classes.equivalentes || []) { let re; try { re = new RegExp(e.padrao); } catch (x) { continue; } if (re.test(d)) return { exame: e.exame || '', fator: e.fator || 1, valorFixo: e.valor || 0, pct: +e.pct || 0, pctUnidade: !!e.pctUnidade, equivalente: e.nome }; }
  const g = norm(grupo);
  const ex = (GRUPO_EXAME.find(([re]) => re.test(g)) || [])[1];
  return ex ? { exame: ex, fator: 1, valorFixo: 0, equivalente: '' } : null;
}
// Devolve {esperado, explicacao} ou {motivo} quando não há regra (o aviso diz o que falta).
function valorEsperadoIMG(cfg, p, classe, linha, unidadeCod) {
  const ex = exameDaLinha(cfg.classes, linha.grupo, linha.desc);
  if (!ex) return { motivo: 'exame sem regra de valor' };
  const q = +linha.quant || 1;
  // Percentual da unidade onde foi realizado (ex.: fusão de imagem): o mesmo percentual geral de repasse da unidade.
  if (ex.pctUnidade) {
    const u = unidadeCod != null ? unidadePorCod(cfg, unidadeCod) : null, pu = +u?.pctUSG?.medico;
    if (!pu) return { motivo: unidadeCod != null ? `${ex.equivalente}: unidade ${unidadeCod} sem percentual cadastrado em Bases` : `${ex.equivalente}: unidade não informada` };
    return { esperado: r2((+linha.vlTotal || 0) * pu), explicacao: `${ex.equivalente}: ${fmtPct(pu * 100)}% da unidade ${unidadeCod} sobre o valor faturado (R$ ${fmtBR(linha.vlTotal)})` };
  }
  // Percentual sobre o valor faturado da linha (ex.: fusão de imagem, a partir de 2026).
  if (ex.pct) return { esperado: r2((+linha.vlTotal || 0) * ex.pct / 100), explicacao: `${ex.equivalente}: ${fmtPct(ex.pct)}% do valor faturado (R$ ${fmtBR(linha.vlTotal)})` };
  if (ex.valorFixo) return { esperado: r2(ex.valorFixo * q), explicacao: `${ex.equivalente}: R$ ${fmtBR(ex.valorFixo)} fixo` };
  const tipoConv = tipoConvenio(cfg, linha.convenio);
  if (!tipoConv) return { motivo: 'convênio sem tipo (SUS, Convênio ou Particular)' };
  const tabela = tipoConv === 'SUS' ? 'sus' : 'convenio', col = p?.regras?.tabelaIMG === 'residente' || p?.regras?.tipo === 'residente' ? 'residente' : classe;
  const exc = (p?.regras?.excecoesIMG || []).find(e => e.exame === ex.exame && (!e.tabela || e.tabela === tabela));
  const unit = exc ? +exc.valor : +cfg.classes.valores[tabela]?.[ex.exame]?.[col];
  if (!unit) return { motivo: `sem valor para ${EXAMES_IMG[ex.exame]} · ${col}` };
  return { esperado: r2(unit * ex.fator * q), explicacao: `${EXAMES_IMG[ex.exame]} ${tipoConv === 'SUS' ? 'SUS' : 'convênio/particular'} · ${col === 'residente' ? 'residente' : 'classe ' + col}${exc ? ' (exceção do prestador)' : ''}${ex.fator !== 1 ? ` × ${ex.fator} (${ex.equivalente})` : ''}` };
}

/* ---------- Leitura da planilha de controle do repasse (cadastro inicial) ---------- */
// abas: [{nome, rows}]. Devolve faixas de USG, BOARD, participação no IMG, classe fixa, V3, CNPJs e percentuais.
function interpretarPlanilhaControle(abas) {
  const prest = new Map(), cnpj = {}, pctMedico = {}, avisos = [];
  const pegar = (cod, nome) => { const k = String(cod).replace(/\.0+$/, ''); if (!prest.has(k)) prest.set(k, { cod: k, nome: String(nome || '').trim(), faixaUSG: '', board: 0, participaIMG: false, v3: false, classeFixa: '' }); return prest.get(k); };
  const codUnidade = t => (String(t || '').match(/^\s*(\d+)\s*-/) || [])[1] || '';
  for (const { nome, rows } of abas) {
    const n = norm(nome);
    if (/REPASSE USG/.test(n)) {
      let faixa = 'geral', colUn = {}, colBoard = -1;
      for (const r of rows) {
        const a = norm(r[0] ?? ''), t = String(r[0] ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();   // t mantém o «%»
        if (/^REPASSE/.test(t) && !r[1]) faixa = /GERAL/.test(t) ? 'geral' : /ACRESCIMO/.test(t) ? 'mais2' : /RESIDENTE/.test(t) ? 'residente' : (t.match(/(\d+) ?%/) ? 'p' + t.match(/(\d+) ?%/)[1] : faixa);
        if (a === 'EMPRESAS') { colUn = {}; r.forEach((v, i) => { const c = codUnidade(v); if (c) colUn[i] = c; if (norm(v ?? '') === 'BOARD') colBoard = i; }); continue; }
        if (/^CNPJ/.test(a)) { for (const [i, c] of Object.entries(colUn)) if (r[i] && faixa === 'geral') cnpj[c] = cnpj[c] || String(r[i]).trim(); continue; }
        if (/^PORCETAGEM|^PORCENTAGEM/.test(a)) { if (faixa === 'geral') for (const [i, c] of Object.entries(colUn)) if (typeof r[i] === 'number') pctMedico[c] = r[i]; continue; }
        if (typeof r[0] === 'number' && r[1]) { const p = pegar(r[0], r[1]); p.faixaUSG = faixa; if (colBoard >= 0 && typeof r[colBoard] === 'number') p.board = r[colBoard]; }
      }
    } else if (/REPASSE IMG/.test(n)) {
      let v3 = false;
      for (const r of rows) {
        if (/MEDICOS V3/.test(norm(r[2] ?? ''))) v3 = true;
        if (/NF COMPLEMENTAR/.test(norm(r[2] ?? ''))) break;
        if (typeof r[2] === 'number' && r[3]) {
          const p = pegar(r[2], r[3]); p.participaIMG = true; if (v3) p.v3 = true;
          if (/FIXO/.test(norm(r[0] ?? '')) && /^[ABCD]$/.test(String(r[1] || '').trim())) p.classeFixa = String(r[1]).trim();
        }
      }
    }
  }
  if (!prest.size) avisos.push('Nenhum prestador encontrado: as abas esperadas são «REPASSE USG …» e «REPASSE IMG …».');
  return { prestadores: [...prest.values()], cnpj, pctMedico, avisos };
}
// Aplica a leitura ao cadastro: cria prestadores que faltam e preenche as regras (sem apagar exceções).
function aplicarPlanilhaControle(cfg, lida, origem) {
  let novos = 0, atualizados = 0;
  for (const x of lida.prestadores) {
    let p = cfg.prestadores.find(y => String(y.cod) === x.cod);
    if (!p) { p = { cod: x.cod, nomeMV: x.nome, aliases: [], naoRealizaRepasse: false, origem, em: agoraISO(), regras: regrasPrestadorVazias() }; cfg.prestadores.push(p); novos++; }
    p.regras = { ...regrasPrestadorVazias(), ...(p.regras || {}) };
    Object.assign(p.regras, { faixaUSG: x.faixaUSG || p.regras.faixaUSG, board: x.board || p.regras.board, participaIMG: x.participaIMG || p.regras.participaIMG, v3: x.v3 || p.regras.v3, classeFixa: x.classeFixa || p.regras.classeFixa });
    if (x.faixaUSG === 'residente') p.regras.tipo = 'residente';
    atualizados++;
  }
  for (const [cod, c] of Object.entries(lida.cnpj)) { const u = unidadePorCod(cfg, cod); if (u && !u.cnpj) u.cnpj = c; }
  return { novos, atualizados };
}
