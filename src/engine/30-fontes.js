/* ============================================================
 * Planilhas de entrada: laudos do Apolo e base auxiliar do Power BI
 * ============================================================ */

/* Laudos do Apolo. Aceita o formato atual (inglês) e o antigo (português).
 * Nunca descarta laudo em silêncio: linha sem nome ou sem data entra marcada;
 * só é ignorada a linha sem nenhum dado útil, e a contagem é informada (RN-189). */
async function lerApolo(bytes, nome, onProgresso) {
  const t0 = Date.now();
  const rows = await lerXlsx(bytes, { onProgresso });
  if (!rows.length) throw new Error('Planilha vazia.');
  const X = mapearColunas(rows[0], {
    unidade: ['BRANCH_NAME', 'UNIDADE'], paciente: ['PATIENT_NAME', 'NOME DO PACIENTE'], idPac: ['PATIENT_ID', 'ID DO PACIENTE'],
    titulo: ['TITLE', 'TITULO DO PROCEDIMENTO'], descricao: ['STUDY_DESCRIPTION', 'DESCRICAO DO PROCEDIMENTO'],
    data: ['STUDY_DATETIME', 'DATA'], convenio: ['PATIENT_INSURANCE', 'CONVENIO'], modalidade: ['MODALITY', 'GRUPO DE PROCEDIMENTO'],
    medico: ['NAME_MEDICO', 'NOME DO MEDICO'], idLaudo: ['ID'], acesso: ['ACCESSION_NUMBER'], status: ['STATUS'], versao: ['VERSION']
  });
  const falta = ['paciente', 'titulo', 'data'].filter(k => X[k] < 0);
  if (falta.length) throw new Error(`Não parece a planilha de laudos do Apolo. Faltam as colunas: ${falta.join(', ')}. Cabeçalho lido: ${(rows[0] || []).filter(Boolean).join(' | ')}`);
  const g = (r, k) => X[k] < 0 || r[X[k]] === undefined ? '' : r[X[k]];
  const txt = (r, k) => String(fixMojibake(g(r, k))).trim();
  const laudos = []; let ignoradas = 0, semNome = 0, semData = 0, semMedico = 0, semTitulo = 0;
  rows.slice(1).forEach((r, k) => {
    const paciente = txt(r, 'paciente'), titulo = txt(r, 'titulo'), bruto = g(r, 'data');
    if (!paciente && !titulo && (bruto === '' || bruto === undefined)) { ignoradas++; return; }
    const data = paraData(bruto), medico = txt(r, 'medico');
    if (!paciente) semNome++; if (!data) semData++; if (!medico) semMedico++; if (!titulo) semTitulo++;
    laudos.push({
      i: laudos.length, linhaPlanilha: k + 2, idLaudo: String(g(r, 'idLaudo')), acesso: String(g(r, 'acesso')),
      unidade: txt(r, 'unidade') || '(sem unidade)', paciente, pn: norm(paciente), idPac: String(g(r, 'idPac')),
      titulo, tituloOriginal: String(g(r, 'titulo')), tn: norm(titulo), descricao: txt(r, 'descricao'),
      data, dia: diaSerial(data), convenio: txt(r, 'convenio'), modalidade: txt(r, 'modalidade').toUpperCase(), medico, mn: norm(medico)
    });
  });
  // PATIENT_ID com mais de um nome (cadastro duplicado conhecido): marcado, nunca corrigido.
  const nomesPorId = new Map();
  for (const l of laudos) if (l.idPac && l.pn) { const s = nomesPorId.get(l.idPac) || new Set(); s.add(l.pn); nomesPorId.set(l.idPac, s); }
  const idsDuplos = new Set([...nomesPorId].filter(([, s]) => s.size > 1).map(([id]) => id));
  for (const l of laudos) l.idDuplo = idsDuplos.has(l.idPac);
  return {
    nome, laudos, ignoradas, semNome, semData, semMedico, semTitulo, idsDuplos: idsDuplos.size,
    ultimaLinha: rows.ultima, colunas: X, temMedico: X.medico >= 0, temUnidade: X.unidade >= 0, segundos: (Date.now() - t0) / 1000
  };
}

/* Power BI: base auxiliar de consulta. Não participa das decisões dos motores.
 * CPF_PACIENTE nunca é lido. */
async function lerPowerBI(bytes, nome) {
  const rows = await lerXlsx(bytes);
  if (!rows.length) throw new Error('Planilha vazia.');
  const X = mapearColunas(rows[0], {
    empresa: ['Nome Empresa'], convenio: ['Nome Convenio'], grupo: ['Grupo Procedimento'], atendimento: ['Cod. Atendimento'],
    conta: ['Cod. Conta'], paciente: ['Nome Paciente'], codigo: ['Cod. Procedimento'], desc: ['Desc. Procedimento'],
    data: ['Data Atendimento'], quant: ['Quant. Lancamento'], valor: ['Valor Total Conta'], prestador: ['CD_PRESTADOR'], tipoConv: ['Tipo Convenio']
  });
  const falta = ['empresa', 'atendimento', 'codigo', 'data'].filter(k => X[k] < 0);
  if (falta.length) throw new Error(`Não parece a planilha do Power BI. Faltam: ${falta.join(', ')}.`);
  const g = (r, k) => X[k] < 0 || r[X[k]] === undefined ? '' : r[X[k]];
  const linhas = []; let ignoradas = 0;
  for (const r of rows.slice(1)) {
    const emp = String(g(r, 'empresa'));
    if (!/^\s*\d+\s*-/.test(emp)) { ignoradas++; continue; }   // linhas «Total» e «Filtros aplicados»
    const cod = String(g(r, 'codigo')).replace(/\.0+$/, '');
    linhas.push({
      empresa: emp.trim(), unidadeCod: emp.match(/^\s*(\d+)/)[1], grupo: String(fixMojibake(g(r, 'grupo'))).trim(),
      atendimento: String(g(r, 'atendimento')).replace(/\.0+$/, ''), conta: String(g(r, 'conta')).replace(/\.0+$/, ''),
      codigo: cod, desc: String(fixMojibake(g(r, 'desc'))).trim(), data: paraData(g(r, 'data')),
      prestador: String(g(r, 'prestador')).replace(/\.0+$/, ''), convenio: String(fixMojibake(g(r, 'convenio'))).trim()
    });
  }
  const datas = linhas.map(l => l.data).filter(Boolean).map(d => d.getTime());
  return {
    nome, linhas, ignoradas,
    periodo: datas.length ? [new Date(Math.min(...datas)), new Date(Math.max(...datas))] : null,
    unidades: [...contar(linhas, l => l.empresa)].sort((a, b) => b[1] - a[1]),
    grupos: [...contar(linhas, l => l.grupo)].sort((a, b) => b[1] - a[1]),
    prestadores: [...contar(linhas, l => l.prestador)].sort((a, b) => b[1] - a[1]),
    procedimentos: [...linhas.reduce((m, l) => { const k = l.codigo; const e = m.get(k) || { codigo: k, desc: l.desc, grupo: l.grupo, n: 0 }; e.n++; m.set(k, e); return m; }, new Map()).values()]
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
  };
}

/* ---------- Modalidade ---------- */
// Grupo de procedimento do MV → modalidades do Apolo (MODALITY) que podem conter o laudo.
const GRUPO_MODALIDADES = [
  [/ULTRASSONOGRAFIA|ECOCARDIOGRAMA/, ['US']],
  [/TOMOGRAFIA/, ['CT']],
  [/RESSONANCIA/, ['MR']],
  [/RADIOLOGIA/, ['CR', 'DX']],
  [/MAMOGRAFIA/, ['MG']],
  [/DENSITOMETRIA/, ['OT']]
];
function modalidadesDoGrupo(grupoNome) {
  const n = norm(grupoNome);
  for (const [re, mods] of GRUPO_MODALIDADES) if (re.test(n)) return mods;
  return null;   // desconhecido: não restringe, e o resultado informa
}
const NOME_MODALIDADE = { US: 'Ultrassonografia', CT: 'Tomografia', MR: 'Ressonância', CR: 'Radiografia (CR)', DX: 'Radiografia (DX)', MG: 'Mamografia', OT: 'Densitometria / outros' };
