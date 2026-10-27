/* ============================================================
 * Motor de conferência cruzada MV × Apolo
 * - Toda linha do MV aparece no resultado, na ordem original.
 * - Cada registro tem UMA categoria principal e vários marcadores (RN-178).
 * - Só é «Conferido» o par único com equivalência validada, nome seguro e mesma data.
 * - Pontuação não existe aqui: a decisão segue faixas explícitas e regras de bloqueio.
 * ============================================================ */
const STATUS_CONF = {
  conferido: { nome: 'Conferido', cor: 'C6EFCE', ordem: 1 },
  ressalva: { nome: 'Conferido com ressalva', cor: 'FFEB9C', ordem: 2 },
  pendente: { nome: 'Pendente / ambíguo', cor: 'FCE4D6', ordem: 3 },
  'so-faturamento': { nome: 'Só no faturamento', cor: 'FFC7CE', ordem: 4 },
  'so-laudo': { nome: 'Só no laudo', cor: 'F8CBAD', ordem: 5 },
  'hm-pendente': { nome: 'HM — regra pendente', cor: 'D9E1F2', ordem: 6 },
  'nao-procedimental': { nome: 'Item não procedimental', cor: 'E2EFDA', ordem: 7 },
  'classificacao-pendente': { nome: 'Classificação pendente', cor: 'D9D9D9', ordem: 8 }
};
const MARCADORES = {
  'data-divergente': 'Data divergente',
  'nome-semelhante': 'Nome apenas semelhante',
  'eq-pendente': 'Equivalência não validada',
  'eq-conflito': 'Equivalência em conflito',
  'eq-divergente': 'Procedimento diverge',
  'eq-sem-cadastro': 'Sem equivalência cadastrada',
  'ambiguo': 'Mais de um laudo plausível',
  'outro-medico': 'Laudo de outro médico',
  'convenio-divergente': 'Convênio divergente',
  'id-duplo': 'ID de paciente com dois cadastros',
  'linha-repetida': 'Linha repetida no MV',
  'valor-simbolico': 'Valor simbólico',
  'possivel-bilateral': 'Laudo já usado por linha do mesmo código',
  'modalidade-desconhecida': 'Modalidade do grupo não mapeada',
  'laudo-sem-data': 'Laudo sem data válida'
};

// Período de produção coberto pelo relatório: do 1º dia do mês da menor data ao último dia do mês da maior.
function periodoDoRelatorio(regs) {
  const dias = regs.map(r => r.data).filter(Boolean).map(d => d.getTime());
  if (!dias.length) return null;
  const a = new Date(Math.min(...dias)), b = new Date(Math.max(...dias));
  return [new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1)), new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + 1, 0))];
}

function laudosDaUnidade(apolo, cfg, unidadeCod) {
  if (!unidadeCod || unidadeCod === '*') return apolo.laudos;
  const nomes = nomesApoloDaUnidade(cfg, unidadeCod);
  return apolo.laudos.filter(l => nomes.has(norm(l.unidade)));
}

function conferirCruzado(relatorio, apolo, cfg, eqBase, opc) {
  const tol = +opc.tol, minTrunc = +cfg.parametros.minTruncamento, simb = +cfg.parametros.valorSimbolico;
  const idx = indiceEquivalencias(eqBase);
  const medicos = opc.medicos && opc.medicos.length ? new Set(opc.medicos) : null;   // null = todos os médicos
  const Lun = laudosDaUnidade(apolo, cfg, opc.unidadeCod);
  const porDia = new Map();
  for (const l of Lun) if (l.dia !== null) (porDia.get(l.dia) || porDia.set(l.dia, []).get(l.dia)).push(l);

  const B = relatorio.regs.map(r => {
    const cls = classificarItem(r, cfg.classificacao);
    return { r, tipo: cls.tipo, regraTipo: cls.regra, pn: norm(r.paciente), dia: diaSerial(r.data), mods: modalidadesDoGrupo(r.grupoNome) };
  });
  const procs = B.filter(b => b.tipo === 'procedimento');
  const modsRelatorio = new Set(procs.flatMap(b => b.mods || []));
  const modsDesconhecidas = procs.some(b => !b.mods);
  const periodo = periodoDoRelatorio(procs.map(b => b.r));

  // 1) Candidatos: mesmo paciente (nível ≥ 1), data dentro da tolerância, modalidade compatível.
  for (const b of procs) {
    b.cands = [];
    if (!b.pn || b.dia === null) continue;
    for (let d = b.dia - tol; d <= b.dia + tol; d++) for (const l of porDia.get(d) || []) {
      if (b.mods && !b.mods.includes(l.modalidade)) continue;
      const nm = nivelNome(b.pn, l.pn, minTrunc); if (!nm) continue;
      const proc = avaliarProcedimento(idx, b.r.codigo, l.titulo, { unidade: opc.unidadeCod, modalidade: l.modalidade });
      const dd = Math.abs(b.dia - l.dia);
      const tier = (proc.estado === 'validada' && nm >= 2 && dd === 0) ? 1 : (proc.estado === 'validada' && nm >= 2) ? 2
        : ((proc.estado === 'pendente' || proc.estado === 'conflito') && nm >= 2 && dd === 0) ? 3
          : ((proc.estado === 'pendente' || proc.estado === 'conflito') && nm >= 2) ? 4
            : (nm === 1 && ['validada', 'pendente', 'conflito'].includes(proc.estado)) ? 5
              : ((proc.estado === 'divergente' || proc.estado === 'sem-cadastro') && nm >= 2 && dd === 0) ? 6 : 0;
      if (!tier) continue;
      b.cands.push({ l, nm, dd, proc, tier, mesmoMedico: medicos ? medicos.has(l.mn) : null, conv: convenioCompativel(b.r.convenio, l.convenio) });
    }
    const ordem = (x, y) => x.tier - y.tier || (y.mesmoMedico === true) - (x.mesmoMedico === true) || y.nm - x.nm || x.dd - y.dd || (y.conv === true) - (x.conv === true) || x.l.i - y.l.i;
    b.cands.sort(ordem);
  }

  // 2) Pareamento um-para-um por faixa: a faixa mais segura escolhe primeiro.
  const usado = new Map();   // laudo.i → b
  for (let t = 1; t <= 6; t++) {
    const fila = [];
    for (const b of procs) if (!b.par) for (const c of b.cands) if (c.tier === t && !usado.has(c.l.i)) fila.push({ b, c });
    fila.sort((x, y) => (y.c.mesmoMedico === true) - (x.c.mesmoMedico === true) || y.c.nm - x.c.nm || x.c.dd - y.c.dd || (y.c.conv === true) - (x.c.conv === true) || x.b.r.seq - y.b.r.seq || x.c.l.i - y.c.l.i);
    for (const { b, c } of fila) { if (b.par || usado.has(c.l.i)) continue; b.par = c; usado.set(c.l.i, b); }
  }

  // 3) Categoria principal + marcadores de cada linha do MV.
  const linhas = [];
  const chaveExame = l => `${chaveTitulo(l.titulo)}|${l.mn}|${l.dia}`;
  for (const b of B) {
    const r = b.r, marc = new Set(), motivos = [];
    if (r.repeticao) marc.add('linha-repetida');
    if (r.vlTotal <= simb) marc.add('valor-simbolico');
    const out = { origem: 'MV', b, r, l: null, tipo: b.tipo, regraTipo: b.regraTipo, marcadores: marc, motivos, cands: (b.cands || []).slice(0, 5) };
    if (b.tipo !== 'procedimento') {
      out.status = b.tipo === 'hm' ? 'hm-pendente' : b.tipo === 'desconhecido' ? 'classificacao-pendente' : 'nao-procedimental';
      motivos.push(b.tipo === 'hm' ? 'Item HM: preservado e fora do cruzamento de procedimentos até existir regra validada (RN-201).'
        : b.tipo === 'desconhecido' ? 'Tipo de item não reconhecido pelas regras de classificação: revisar e cadastrar regra.'
          : `${TIPOS_ITEM[b.tipo]}: sem correspondência esperada na planilha de laudos (RN-202).`);
      linhas.push(out); continue;
    }
    if (!b.mods) marc.add('modalidade-desconhecida');
    const p = b.par;
    if (p) {
      out.l = p.l; out.par = p;
      if (p.dd) { marc.add('data-divergente'); motivos.push(`Data: MV ${fmtData(r.data)} × laudo ${fmtData(p.l.data)}`); }
      if (p.nm === 1) { marc.add('nome-semelhante'); motivos.push(`Nome apenas semelhante: MV «${r.paciente}» × laudo «${p.l.paciente}»`); }
      if (p.proc.estado === 'pendente') { marc.add('eq-pendente'); motivos.push(`${p.proc.motivo}: ${r.codigo} × «${p.l.titulo}»`); }
      if (p.proc.estado === 'conflito') { marc.add('eq-conflito'); motivos.push(p.proc.motivo); }
      if (p.proc.estado === 'divergente') { marc.add('eq-divergente'); motivos.push(`Procedimento diverge: MV «${r.codigo} - ${r.procDesc}» × laudo «${p.l.titulo}». ${p.proc.motivo}`); }
      if (p.proc.estado === 'sem-cadastro') { marc.add('eq-sem-cadastro'); motivos.push(`Sem equivalência para ${r.codigo} × «${p.l.titulo}»`); }
      if (p.mesmoMedico === false) { marc.add('outro-medico'); motivos.push(`Laudo assinado por outro médico: ${p.l.medico || '(sem médico)'}`); }
      if (p.conv === false) { marc.add('convenio-divergente'); motivos.push(`Convênio: MV «${r.convenio}» × laudo «${p.l.convenio}»`); }
      if (p.l.idDuplo) marc.add('id-duplo');
      // Ambiguidade: outro laudo da mesma faixa, materialmente diferente, que não está com uma linha do mesmo código.
      const alt = b.cands.filter(c => c.tier === p.tier && c.l !== p.l && chaveExame(c.l) !== chaveExame(p.l)
        && !(usado.has(c.l.i) && usado.get(c.l.i).r.codigo === r.codigo && usado.get(c.l.i) !== b));
      if (alt.length) { marc.add('ambiguo'); motivos.push(`${alt.length + 1} laudos plausíveis na mesma faixa: ${[p, ...alt].map(c => `«${c.l.titulo}» (${c.l.medico || 'sem médico'})`).join('; ')}`); }
      const bloqueio = p.tier >= 3 || marc.has('ambiguo') || marc.has('outro-medico');
      out.status = bloqueio ? 'pendente' : (p.tier === 2 || marc.has('convenio-divergente') || marc.has('id-duplo')) ? 'ressalva' : 'conferido';
      if (out.status === 'conferido') motivos.unshift(`Par único: ${p.nm === 3 ? 'nome idêntico' : 'nome truncado compatível'}, mesma data, ${p.proc.motivo.toLowerCase()}`);
    } else {
      out.status = 'so-faturamento';
      const irmao = (b.cands || []).find(c => usado.has(c.l.i) && usado.get(c.l.i).r.codigo === r.codigo && c.tier <= 4);
      if (irmao) { marc.add('possivel-bilateral'); motivos.push(`Há laudo compatível («${irmao.l.titulo}») já associado a outra linha do mesmo código: verificar cobrança por lado ou duplicidade.`); }
      else if (b.cands && b.cands.length) motivos.push(`Laudos do paciente existem, mas já estão associados a outras linhas (${b.cands.length} candidato(s)).`);
      else motivos.push(b.pn ? `Nenhum laudo do paciente na unidade em ±${tol} dia(s) com modalidade compatível.` : 'Linha do MV sem nome de paciente.');
    }
    linhas.push(out);
  }

  // 4) Laudos do escopo sem lançamento no MV.
  const escopo = Lun.filter(l => (!medicos || medicos.has(l.mn))
    && (modsDesconhecidas || !modsRelatorio.size || modsRelatorio.has(l.modalidade))
    && (!periodo || (l.data && l.data >= periodo[0] && l.data <= periodo[1])));
  const escopoSemData = periodo ? Lun.filter(l => l.dia === null && (!medicos || medicos.has(l.mn))
    && (modsDesconhecidas || !modsRelatorio.size || modsRelatorio.has(l.modalidade))) : [];
  for (const l of [...escopo, ...escopoSemData]) {
    if (usado.has(l.i)) continue;
    const marc = new Set(); if (l.dia === null) marc.add('laudo-sem-data'); if (l.idDuplo) marc.add('id-duplo');
    linhas.push({ origem: 'Apolo', status: 'so-laudo', b: null, r: null, l, tipo: 'procedimento', marcadores: marc, motivos: ['Sem lançamento correspondente neste relatório do MV.'], cands: [] });
  }

  // 5) Indicadores: registros únicos × ocorrências de marcadores (RN-178, RN-187).
  const porStatus = {}; for (const k of Object.keys(STATUS_CONF)) porStatus[k] = { n: 0, vlRepasse: 0, vlTotal: 0 };
  const porMarcador = {}; for (const k of Object.keys(MARCADORES)) porMarcador[k] = 0;
  for (const x of linhas) {
    const s = porStatus[x.status]; s.n++; if (x.r) { s.vlRepasse += x.r.vlRepasse; s.vlTotal += x.r.vlTotal; }
    for (const m of x.marcadores) porMarcador[m]++;
  }
  for (const s of Object.values(porStatus)) { s.vlRepasse = r2(s.vlRepasse); s.vlTotal = r2(s.vlTotal); }
  const porTipo = Object.fromEntries([...contar(B, b => b.tipo)]);
  // Quantidade por procedimento: linhas do MV × laudos do escopo cujo título é validado para o código.
  const porCodigo = new Map();
  for (const b of procs) { const e = porCodigo.get(b.r.codigo) || { codigo: b.r.codigo, desc: b.r.procDesc, mv: 0, conferido: 0, ressalva: 0, laudosValidados: 0 }; e.mv++; porCodigo.set(b.r.codigo, e); }
  for (const x of linhas) if (x.r && porCodigo.has(x.r.codigo) && (x.status === 'conferido' || x.status === 'ressalva')) porCodigo.get(x.r.codigo)[x.status]++;
  for (const l of escopo) for (const e of (idx.porTitulo.get(chaveTitulo(l.titulo)) || [])) if (e.status === 'validada' && porCodigo.has(e.codigo)) porCodigo.get(e.codigo).laudosValidados++;
  const titulosSemValidacao = [...contar(escopo.filter(l => !(idx.porTitulo.get(chaveTitulo(l.titulo)) || []).some(e => e.status === 'validada')), l => l.titulo)].sort((a, b) => b[1] - a[1]);
  return {
    tipo: 'conferencia', linhas, porStatus, porMarcador, porTipo, porCodigo: [...porCodigo.values()], titulosSemValidacao,
    nMV: B.length, nProcedimentos: procs.length, nLaudosUnidade: Lun.length, nLaudosEscopo: escopo.length, nPares: usado.size,
    periodo, modalidades: [...modsRelatorio], modsDesconhecidas, eqRevisao: eqBase.revisao,
    eqValidadas: eqBase.itens.filter(e => e.status === 'validada').length
  };
}
