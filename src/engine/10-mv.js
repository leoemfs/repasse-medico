/* ============================================================
 * Relatório de Repasse de Prestadores (SOULMV / MV) em PDF
 * O PDF é a referência oficial: toda linha extraída é preservada,
 * na ordem original, e as somas são conferidas com os totais impressos.
 * ============================================================ */

// Reconstrói as linhas de texto de cada página a partir das posições do pdf.js.
async function lerLinhasPdf(pdfjs, bytes) {
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const linhas = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const itens = tc.items.filter(i => i.str !== undefined && i.str.trim() !== '')
      .map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width }));
    itens.sort((a, b) => b.y - a.y);
    const grupos = [];
    for (const it of itens) {
      const g = grupos.find(g => Math.abs(g.y - it.y) <= 3);
      if (g) g.itens.push(it); else grupos.push({ y: it.y, itens: [it] });
    }
    grupos.sort((a, b) => b.y - a.y);
    for (const g of grupos) {
      g.itens.sort((a, b) => a.x - b.x);
      let txt = '', fim = null;
      for (const it of g.itens) {
        if (fim !== null && it.x - fim > 1.2) txt += ' ';
        txt += it.s.replace(/\s+/g, ' ');
        fim = it.x + it.w;
      }
      linhas.push({ pagina: p, texto: txt.replace(/\s+/g, ' ').trim() });
    }
  }
  return { linhas, paginas: pdf.numPages };
}

const RE_MV = {
  prestador: /^Prestador:\s*(\d+)\s*-\s*(.+)$/,
  grupoRepasse: /^Grupo de Repasse:\s*(\d+)\s*-\s*(.+)$/,
  repasse: /^Repasse:\s*(\d+)(?:\s+Dt\.?\s*Repasse:\s*(\d{2}\/\d{2}\/\d{4}))?(?:\s+Descri[cç][aã]o:\s*(.*))?$/i,
  competencia: /Compet[eê]ncia:\s*(\d{2}\/\d{4})/i,
  emitido: /Em:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/,
  grupoProc: /^Grupo de Procedimento:\s*(\d+)\s*-\s*(.+)$/,
  proc: /^Procedimento:\s*(\d+)\s*(?:-\s*)?(.+)$/,
  totalProc: /^Total do Procedimento:\s*([\d.,]+)\s+([\d.,]+)\s*$/,
  totalGrupo: /Total do Grupo de Procedimento:\s*([\d.,]+)\s+([\d.,]+)/,
  totalGeral: /Total Geral do Repasse:\s*([\d.,]+)\s+([\d.,]+)/,
  // Remessa (opcional) · Conta · Atendimento · Paciente · CP · Atividade · Convênio · Data · Quant. · Qt.CH · valores
  linha: /^(?:(\d+)\s+)?(\d{6,})\s+(\d+)\s+(.+?)\s+(N|S|G|RM)\s+(\S+)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{2,4})\s+(\d+)\s+(\d+)\s+((?:-?[\d.]+,\d+\s*)+)$/,
  // Atendimento não informado (lançamento manual): uma coluna a menos
  linhaSemAtend: /^(?:(\d+)\s+)?(\d{6,})\s+()(.+?)\s+(N|S|G|RM)\s+(\S+)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{2,4})\s+(\d+)\s+(\d+)\s+((?:-?[\d.]+,\d+\s*)+)$/,
  data: /\d{2}\/\d{2}\/\d{2,4}/
};

function interpretarMV(linhas, arquivo) {
  const cab = { prestadorCod: '', prestadorNome: '', grupoRepasseCod: '', grupoRepasseNome: '', repasse: '', dataRepasse: '', descricao: '', competencia: '', emitidoEm: '' };
  const regs = [], avisos = [], notas = [], naoReconhecidas = [];
  const totaisProc = new Map(), totaisGrupo = new Map();
  let proc = null, grupo = null, totalGeral = null;
  const definir = (campo, valor) => {
    if (!valor) return;
    if (cab[campo] && cab[campo] !== valor) avisos.push(`Cabeçalho muda ao longo do PDF (${campo}: «${cab[campo]}» → «${valor}»). Confira se o arquivo tem mais de um prestador.`);
    cab[campo] = valor;
  };
  /* v3.0.0-alpha.5 — Um PDF pode ter mais de uma geração de repasse do mesmo prestador: a geração complementar (contas
   * fechadas depois da 1ª geração) e os lançamentos manuais (um repasse por lançamento) vêm com outro número. Não é erro:
   * cada linha guarda o seu repasse, os totais são conferidos por repasse e o cabeçalho fica com o 1º (o original). */
  const repasses = new Map(); let secao = '';
  const abrirRepasse = (num, data, desc) => {
    secao = num;
    if (!repasses.has(num)) repasses.set(num, { numero: num, data: data || '', descricao: desc || '', linhas: 0, vlRepasse: 0, vlTotal: 0, totalGeral: null });
    const x = repasses.get(num); if (!x.data && data) x.data = data; if (!x.descricao && desc) x.descricao = desc;
    if (!cab.repasse) { cab.repasse = num; cab.dataRepasse = data || ''; cab.descricao = desc || ''; }
    else if (cab.repasse === num) { if (!cab.dataRepasse && data) cab.dataRepasse = data; if (!cab.descricao && desc) cab.descricao = desc; }
  };
  for (const { pagina, texto: l } of linhas) {
    let m;
    if ((m = l.match(RE_MV.prestador))) { definir('prestadorCod', m[1]); definir('prestadorNome', m[2].trim()); continue; }
    if ((m = l.match(RE_MV.grupoRepasse))) { definir('grupoRepasseCod', m[1]); definir('grupoRepasseNome', m[2].trim()); continue; }
    if ((m = l.match(RE_MV.repasse))) { abrirRepasse(m[1], m[2] || '', (m[3] || '').trim()); continue; }
    if ((m = l.match(RE_MV.competencia))) { definir('competencia', m[1]); }
    if (!cab.emitidoEm && (m = l.match(RE_MV.emitido))) cab.emitidoEm = m[1];
    if ((m = l.match(RE_MV.grupoProc))) { grupo = { cod: m[1], nome: m[2].trim() }; continue; }
    if ((m = l.match(RE_MV.proc))) { proc = { codigo: m[1], desc: m[2].trim(), grupo }; continue; }
    if ((m = l.match(RE_MV.totalProc)) && proc) { totaisProc.set(`${secao}|${proc.codigo}|${proc.desc}`, [numBR(m[1]), numBR(m[2])]); continue; }
    if ((m = l.match(RE_MV.totalGrupo)) && grupo) { totaisGrupo.set(`${secao}|${grupo.cod}`, [numBR(m[1]), numBR(m[2])]); }
    if ((m = l.match(RE_MV.totalGeral))) { totalGeral = [numBR(m[1]), numBR(m[2])]; if (repasses.has(secao)) repasses.get(secao).totalGeral = totalGeral; continue; }
    m = l.match(RE_MV.linha) || l.match(RE_MV.linhaSemAtend);
    if (m) {
      if (!proc) { avisos.push(`Linha de dados antes de qualquer «Procedimento:» (página ${pagina}): ${l}`); naoReconhecidas.push({ pagina, texto: l }); continue; }
      const v = m[11].trim().split(/\s+/).map(numBR);
      let vlRepasse, pct, vlTotal, pctCalculado = false;
      if (v.length >= 3) { [vlRepasse, pct, vlTotal] = v.slice(-3); pct = pct / 100; }
      else if (v.length === 2) { [vlRepasse, vlTotal] = v; pct = vlTotal ? vlRepasse / vlTotal : 0; pctCalculado = true; }
      else { avisos.push(`Linha com valores insuficientes (página ${pagina}): ${l}`); naoReconhecidas.push({ pagina, texto: l }); continue; }
      regs.push({
        seq: regs.length + 1, pagina, arquivo,
        codigo: proc.codigo, procDesc: proc.desc, grupoCod: proc.grupo?.cod || '', grupoNome: proc.grupo?.nome || '',
        remessa: m[1] || '', conta: m[2], atendimento: m[3] || '',
        paciente: m[4].trim(), cp: m[5], atividade: m[6], convenio: m[7].trim(),
        data: dataBR(m[8]), dataTexto: m[8], quant: +m[9], qtCh: +m[10],
        vlRepasse, pct, vlTotal, pctCalculado, textoOriginal: l, repasse: secao
      });
      if (repasses.has(secao)) { const x = repasses.get(secao); x.linhas++; x.vlRepasse += vlRepasse; x.vlTotal += vlTotal; }
      continue;
    }
    if (/^\d{5,}\s/.test(l) && RE_MV.data.test(l)) { avisos.push(`Linha NÃO reconhecida (página ${pagina}): ${l}`); naoReconhecidas.push({ pagina, texto: l }); }
  }
  for (const r of regs) Object.assign(r, { prestadorCod: cab.prestadorCod, prestadorNome: cab.prestadorNome, repasse: r.repasse || cab.repasse });
  cab.repasses = [...repasses.values()].map(x => ({ ...x, vlRepasse: r2(x.vlRepasse), vlTotal: r2(x.vlTotal) }));
  if (cab.repasses.length > 1) notas.push(`PDF com ${cab.repasses.length} repasses do prestador (geração complementar ou lançamento manual): ${cab.repasses.map(x => `${x.numero}${x.data ? ` de ${x.data}` : ''}${x.descricao ? ` «${x.descricao}»` : ''} · ${x.linhas} linha(s) · R$ ${fmtBR(x.vlRepasse)}`).join('; ')}. Cada linha guarda o seu repasse; a conferência considera todas.`);

  // Conferência por invariantes: soma extraída = totais impressos no PDF.
  const soma = new Map(), somaGrupo = new Map();
  for (const r of regs) {
    const k = `${r.repasse}|${r.codigo}|${r.procDesc}`, s = soma.get(k) || [0, 0]; s[0] += r.vlRepasse; s[1] += r.vlTotal; soma.set(k, s);
    const kg = `${r.repasse}|${r.grupoCod}`, g = somaGrupo.get(kg) || [0, 0]; g[0] += r.vlRepasse; g[1] += r.vlTotal; somaGrupo.set(kg, g);
  }
  const conferencias = [];
  const confere = (rotulo, impresso, extraido) => {
    const ok = Math.abs(impresso[0] - extraido[0]) <= 0.011 && Math.abs(impresso[1] - extraido[1]) <= 0.011;
    conferencias.push({ rotulo, impressoRepasse: impresso[0], impressoTotal: impresso[1], extraidoRepasse: r2(extraido[0]), extraidoTotal: r2(extraido[1]), ok });
    if (!ok) avisos.push(`DIVERGÊNCIA em ${rotulo}: PDF ${fmtBR(impresso[0])} / ${fmtBR(impresso[1])} × extraído ${fmtBR(extraido[0])} / ${fmtBR(extraido[1])}`);
  };
  const varios = repasses.size > 1, rotRep = k => { const [rp, ...resto] = k.split('|'); return `${resto.join(' - ')}${varios ? ` (repasse ${rp})` : ''}`; };
  for (const [k, t] of totaisProc) confere(`Procedimento ${rotRep(k)}`, t, soma.get(k) || [0, 0]);
  for (const k of soma.keys()) if (!totaisProc.has(k)) avisos.push(`Procedimento sem «Total do Procedimento» no PDF: ${rotRep(k)}`);
  for (const [k, t] of totaisGrupo) confere(`Grupo ${rotRep(k)}`, t, somaGrupo.get(k) || [0, 0]);
  const totExtraido = [regs.reduce((a, r) => a + r.vlRepasse, 0), regs.reduce((a, r) => a + r.vlTotal, 0)];
  // Total geral: um por repasse (cada geração tem o seu) ou um só no fim do PDF (soma de tudo).
  const comTotal = [...repasses.values()].filter(x => x.totalGeral);
  if (varios && comTotal.length > 1) { for (const x of comTotal) confere(`Total Geral do Repasse ${x.numero}`, x.totalGeral, [x.vlRepasse, x.vlTotal]); totalGeral = [comTotal.reduce((a, x) => a + x.totalGeral[0], 0), comTotal.reduce((a, x) => a + x.totalGeral[1], 0)].map(r2); }
  else if (totalGeral) confere('Total Geral do Repasse', totalGeral, totExtraido);
  else avisos.push('«Total Geral do Repasse» não encontrado: a conferência geral não foi feita.');
  if (varios) for (const x of repasses.values()) if (!x.totalGeral && comTotal.length > 1) avisos.push(`Repasse ${x.numero} sem «Total Geral do Repasse» no PDF: a conferência dele foi só por procedimento.`);
  if (!regs.length) avisos.push('Nenhuma linha de atendimento reconhecida neste PDF.');

  // Linhas idênticas repetidas: não são removidas (RN-185), apenas marcadas.
  const chaveRep = r => [r.codigo, r.conta, r.atendimento, r.dataTexto, r.vlRepasse, r.vlTotal].join('|');
  const cont = contar(regs, chaveRep), ord = new Map();
  for (const r of regs) {
    const k = chaveRep(r), n = cont.get(k);
    ord.set(k, (ord.get(k) || 0) + 1);
    r.repeticao = n > 1 ? { i: ord.get(k), n } : null;
    // Identificador estável da linha para comparar rodadas (sem nome de paciente).
    r.chave = `${r.codigo}|${r.conta}|${r.atendimento}|${isoDia(r.data)}|${ord.get(k)}`;
  }
  const nRep = regs.filter(r => r.repeticao).length;
  if (nRep) notas.push(`${nRep} linha(s) idênticas repetidas (mesmo procedimento, conta, atendimento, data e valores). Foram mantidas e marcadas para revisão.`);
  const nPct = regs.filter(r => r.pctCalculado).length;
  if (nPct) notas.push(`${nPct} linha(s) sem a coluna % Repasse: o percentual foi calculado como Vl Repasse ÷ Vl Total.`);
  const nQ = regs.filter(r => r.quant !== 1).length;
  if (nQ) notas.push(`${nQ} linha(s) com Quant. diferente de 1.`);

  const ok = regs.length > 0 && conferencias.every(c => c.ok) && !!totalGeral && !naoReconhecidas.length;
  return { arquivo, cab, regs, avisos, notas, conferencias, naoReconhecidas, totalGeral, totExtraido: totExtraido.map(r2), ok };
}

// Sugestão de unidade pelo nome do arquivo (ex.: «..._unidade_1_...»). É só sugestão: o usuário confirma.
function unidadeSugeridaPeloArquivo(nome) {
  const m = norm(nome).match(/\bUNIDADE (\d+)\b/) || String(nome).toUpperCase().match(/(?:^|[^A-Z0-9])UN(?:IDADE)?[ _-]?(\d+)(?=[^0-9]|$)/);
  return m ? m[1] : '';
}
