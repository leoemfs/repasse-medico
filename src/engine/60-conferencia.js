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
  'mesmo-estudo': 'Laudo do mesmo estudo (regra composta)',
  'mesmo-estudo-possivel': 'Pode ser o mesmo estudo (regra composta)',
  'valor-simbolico': 'Valor simbólico',
  'possivel-bilateral': 'Laudo já usado por linha do mesmo código',
  'modalidade-desconhecida': 'Modalidade do grupo não mapeada',
  'laudo-sem-data': 'Laudo sem data válida',
  'composta': 'Regra composta',
  'composta-falta': 'Composição incompleta',
  'hm-v3-devido': 'HM V3 devido',
  'hm-v3-excluir': 'HM V3 a excluir'
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
  const idx = indiceEquivalencias(eqBase), unidadeV3 = !!opc.unidadeCod && opc.unidadeCod !== '*' && ehUnidadeV3(cfg, opc.unidadeCod);
  const medicos = opc.medicos && opc.medicos.length ? new Set(opc.medicos) : null;   // null = todos os médicos
  const Lun = laudosDaUnidade(apolo, cfg, opc.unidadeCod);
  const ixNome = indiceNomes(Lun, l => l.dia, l => l.pn);

  const B = relatorio.regs.map(r => {
    const cls = classificarItem(r, cfg.classificacao);
    return { r, tipo: cls.tipo, regraTipo: cls.regra, pn: norm(r.paciente), dia: diaSerial(r.data), mods: modalidadesDoGrupo(r.grupoNome) };
  });
  const procs = B.filter(b => b.tipo === 'procedimento');
  const modsRelatorio = new Set(procs.flatMap(b => b.mods || []));
  const modsDesconhecidas = procs.some(b => !b.mods);
  const periodo = periodoDoRelatorio(procs.map(b => b.r));

  // 0) Exame (v3.0.0-alpha.4): laudos do mesmo paciente, dia, modalidade e médico. Quando um deles fecha uma regra composta
  // validada, os outros que são parte do mesmo exame (ex.: 2ª página só do Doppler) não disputam as linhas com ele: o exame
  // cumpre a regra, e eles só pegam linha que sobrar (2ª fase do pareamento). Sem disputa, não há «ambíguo» nem
  // «composição incompleta» falsa quando o Doppler vem numa página separada.
  const unEq = opc.unidadeCod === '*' ? '' : opc.unidadeCod, secundarioDe = new Map(), exames = new Map();
  for (const l of Lun) if (l.dia !== null && l.pn) { const k = `${l.pn}|${l.dia}|${l.modalidade}|${l.mn}`; (exames.get(k) || exames.set(k, []).get(k)).push(l); }
  for (const g of exames.values()) {
    if (g.length < 2) continue;
    const comRegra = g.map(l => ({ l, c: compostaDoTitulo(idx, l.titulo, unEq, l.modalidade) })).filter(x => x.c);
    if (!comRegra.length) continue;
    for (const l of g) { if (comRegra.some(x => x.l === l)) continue; const p = comRegra.find(x => parteDoExame(idx, x.c, l, unEq)); if (p) secundarioDe.set(l.i, p.l.i); }
  }
  // 1) Candidatos: mesmo paciente (nível ≥ 1), data dentro da tolerância, modalidade compatível.
  for (const b of procs) {
    b.cands = [];
    if (!b.pn || b.dia === null) continue;
    for (const l of ixNome.candidatos(b.pn, b.dia, tol)) {
      if (b.mods && !b.mods.includes(l.modalidade)) continue;
      const nm = nivelNome(b.pn, l.pn, minTrunc); if (!nm) continue;
      const proc = avaliarProcedimento(idx, b.r.codigo, l.titulo, { unidade: opc.unidadeCod, modalidade: l.modalidade, convenio: b.r.convenio });
      const dd = Math.abs(b.dia - l.dia);
      const tier = (proc.estado === 'validada' && nm >= 2 && dd === 0) ? 1 : (proc.estado === 'validada' && nm >= 2) ? 2
        : ((proc.estado === 'pendente' || proc.estado === 'conflito') && nm >= 2 && dd === 0) ? 3
          : ((proc.estado === 'pendente' || proc.estado === 'conflito') && nm >= 2) ? 4
            : (nm === 1 && ['validada', 'pendente', 'conflito'].includes(proc.estado)) ? 5
              : ((proc.estado === 'divergente' || proc.estado === 'sem-cadastro') && nm >= 2 && dd === 0) ? 6
                // Nome só semelhante, mesma data, convênio compatível e procedimento sem equivalência: par PENDENTE (decisão humana),
                // em vez de duas linhas soltas («Só no faturamento» + «Só no laudo»).
                : ((proc.estado === 'divergente' || proc.estado === 'sem-cadastro') && nm === 1 && dd === 0 && convenioCompativel(b.r.convenio, l.convenio) !== false) ? 7 : 0;
      if (!tier) continue;
      b.cands.push({ l, nm, dd, proc, tier, mesmoMedico: medicos ? medicos.has(l.mn) : null, conv: convenioCompativel(b.r.convenio, l.convenio) });
    }
    const ordem = (x, y) => x.tier - y.tier || (y.mesmoMedico === true) - (x.mesmoMedico === true) || y.nm - x.nm || x.dd - y.dd || (y.conv === true) - (x.conv === true) || x.l.i - y.l.i;
    b.cands.sort(ordem);
  }

  // 2) Pareamento um-para-um por faixa: a faixa mais segura escolhe primeiro.
  const usado = new Map();   // laudo.i → b (primeira linha)
  // Regra composta (SOL-F5): o mesmo laudo sustenta uma linha por código esperado da composição.
  // Cada procedimento da regra aceita tantas linhas quanto a sua quantidade (ex.: Doppler ×2).
  const compostoUsos = new Map();   // laudo.i → { id, esperados, usos:[n por procedimento], bs:[] }
  const cabeNoComposto = (b, c) => { const u = compostoUsos.get(c.l.i), k = c.proc.itemIdx; return !!(c.proc.composta && u && u.id === c.proc.composta.id && k !== undefined && (u.usos[k] || 0) < (u.esperados[k]?.qtd || 0)); };
  for (const fase2 of [false, true]) for (let t = 1; t <= 7; t++) {
    const fila = [];
    for (const b of procs) if (!b.par) for (const c of b.cands) if (c.tier === t && secundarioDe.has(c.l.i) === fase2 && (!usado.has(c.l.i) || cabeNoComposto(b, c))) fila.push({ b, c });
    fila.sort((x, y) => (y.c.mesmoMedico === true) - (x.c.mesmoMedico === true) || y.c.nm - x.c.nm || x.c.dd - y.c.dd || (y.c.conv === true) - (x.c.conv === true) || x.b.r.seq - y.b.r.seq || x.c.l.i - y.c.l.i);
    for (const { b, c } of fila) {
      if (b.par) continue;
      if (usado.has(c.l.i)) { if (!cabeNoComposto(b, c)) continue; const u = compostoUsos.get(c.l.i); b.par = c; u.usos[c.proc.itemIdx] = (u.usos[c.proc.itemIdx] || 0) + 1; u.bs.push(b); continue; }
      b.par = c; usado.set(c.l.i, b);
      if (c.proc.composta) { const usos = []; usos[c.proc.itemIdx] = 1; compostoUsos.set(c.l.i, { id: c.proc.composta.id, esperados: c.proc.esperados, usos, bs: [b] }); }
    }
  }

  // 3) Categoria principal + marcadores de cada linha do MV.
  const linhas = [];
  const chaveExame = l => `${chaveTitulo(l.titulo)}|${l.mn}|${l.dia}`;
  for (const b of B) {
    const r = b.r, marc = new Set(), motivos = [];
    if (r.repeticao) marc.add('linha-repetida');
    if (r.vlTotal <= simb) marc.add('valor-simbolico');
    const out = { origem: 'MV', b, r, l: null, tipo: b.tipo, regraTipo: b.regraTipo, marcadores: marc, motivos, cands: (b.cands || []).slice(0, 5) };
    // V3 (Curitiba): HM de USG/Doppler Unimed é devido mesmo sem laudo; os demais HM não são pagos (SOL-F30).
    if (b.tipo === 'hm' && unidadeV3) {
      if (hmV3Devido(r.grupoNome, r.procDesc, r.convenio)) {
        marc.add('hm-v3-devido'); out.status = 'conferido';
        motivos.push('HM V3 devido: HM de USG/Doppler do convênio Unimed entra no repasse da V3, mesmo sem laudo (regra da unidade).');
      } else {
        marc.add('hm-v3-excluir'); out.status = 'hm-pendente';
        motivos.push(`HM V3 a excluir: na V3 só se paga HM de USG/Doppler do convênio Unimed (este é «${r.procDesc || r.grupoNome}», convênio «${r.convenio || '—'}»). Sinalizar para exclusão; não é NC por si só.`);
      }
      linhas.push(out); continue;
    }
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
      const mesmoExame = c => secundarioDe.get(c.l.i) === p.l.i || secundarioDe.get(p.l.i) === c.l.i;
      const alt = b.cands.filter(c => c.tier === p.tier && c.l !== p.l && chaveExame(c.l) !== chaveExame(p.l) && !mesmoExame(c)
        && !(usado.has(c.l.i) && usado.get(c.l.i).r.codigo === r.codigo && usado.get(c.l.i) !== b));
      if (alt.length) { marc.add('ambiguo'); motivos.push(`${alt.length + 1} laudos plausíveis na mesma faixa: ${[p, ...alt].map(c => `«${c.l.titulo}» (${c.l.medico || 'sem médico'})`).join('; ')}`); }
      if (p.proc.composta) {
        marc.add('composta');
        const u = compostoUsos.get(p.l.i), falta = u ? u.esperados.filter(e => e.qtd > (u.usos[e.i] || 0)) : [];
        out.composta = p.proc.composta.id;
        motivos.push(`${p.proc.motivo}.${falta.length ? '' : ' Composição completa no MV.'}`);
        if (falta.length) { marc.add('composta-falta'); out.compostaFalta = true; motivos.push(`Composição incompleta: o laudo «${p.l.titulo}» espera ${textoEsperados(u.esperados)}; falta ${falta.map(e => `${e.rotulo} (esperado ×${e.qtd}, lançado ×${u.usos[e.i] || 0})`).join(', ')} no MV.`); }
      }
      const bloqueio = p.tier >= 3 || marc.has('ambiguo') || marc.has('outro-medico');
      out.status = bloqueio ? 'pendente' : (p.tier === 2 || marc.has('convenio-divergente') || marc.has('id-duplo') || marc.has('composta-falta')) ? 'ressalva' : 'conferido';
      if (out.status === 'conferido') motivos.unshift(`Par único: ${p.nm === 3 ? 'nome idêntico' : 'nome truncado compatível'}, mesma data, ${p.proc.motivo.toLowerCase()}`);
    } else {
      out.status = 'so-faturamento';
      // Regra composta: código que não faz parte da composição para o convênio (ex.: articular na UNIMED).
      const sobra = (b.cands || []).find(c => c.proc.sobra);
      if (sobra) { marc.add('eq-divergente'); out.compostaSobra = sobra.proc.composta.id; motivos.push(`${sobra.proc.motivo}: cobrança sem sustentação no laudo «${sobra.l.titulo}».`); }
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
  // Laudo do mesmo estudo de uma regra composta (ex.: «USG transvaginal com Doppler» fechou transvaginal + Doppler, e o
  // mesmo exame tem um 2º laudo «Doppler de transvaginal»): mesmo paciente e dia, e o título aponta para um código já
  // lançado pela composição — por equivalência validada ou por estar na lista «mesmo estudo» da regra.
  const mesmoEstudo = l => {
    if (l.dia === null) return null;
    for (const [li, u] of compostoUsos) {
      const L = usado.get(li)?.par?.l; if (!L || L === l || L.pn !== l.pn || L.dia !== l.dia) continue;
      const regra = (idx.compostas || []).find(c => c.id === u.id), cods = [...new Set(u.bs.map(b => b.r.codigo))];
      const naRegra = (regra?.titulosMesmoEstudo || []).some(t => chaveTitulo(t) === chaveTitulo(l.titulo));
      const viaEq = !naRegra && cods.some(cd => { const a = avaliarProcedimento(idx, cd, l.titulo, { unidade: opc.unidadeCod === '*' ? '' : opc.unidadeCod, modalidade: l.modalidade }); return a.estado === 'validada' && !a.composta; });
      // Laudo de outro médico no mesmo dia: pode ser parte do exame, mas quem recebe muda — fica para a pessoa decidir.
      return { L, regra, cods, via: L.mn !== l.mn ? null : naRegra ? 'regra' : viaEq ? 'eq' : null };
    }
    return null;
  };
  for (const l of [...escopo, ...escopoSemData]) {
    if (usado.has(l.i)) continue;
    const marc = new Set(); if (l.dia === null) marc.add('laudo-sem-data'); if (l.idDuplo) marc.add('id-duplo');
    const me = mesmoEstudo(l), nome = me?.regra ? nomeComposta(me.regra) : 'regra composta';
    if (me?.via) { marc.add('mesmo-estudo'); linhas.push({ origem: 'Apolo', status: 'conferido', b: null, r: null, l, tipo: 'procedimento', marcadores: marc, motivos: [`Mesmo estudo do laudo «${me.L.titulo}» (mesmo paciente e dia), já lançado pela regra composta «${nome}»: ${me.cods.join(' + ')}${me.via === 'regra' ? ' — título incluído na regra como do mesmo estudo' : ' — equivalência validada do título'}.`], cands: [], mesmoEstudo: me.regra?.id || '' }); continue; }
    if (me) { marc.add('mesmo-estudo-possivel'); linhas.push({ origem: 'Apolo', status: 'so-laudo', b: null, r: null, l, tipo: 'procedimento', marcadores: marc, motivos: ['Sem lançamento correspondente neste relatório do MV.', `Pode ser o mesmo estudo do laudo «${me.L.titulo}» (mesmo paciente e dia), já lançado pela regra composta «${nome}»: ${me.cods.join(' + ')}.`], cands: [], mesmoEstudoPossivel: { regraId: me.regra?.id || '', nome, laudo: me.L.titulo, cods: me.cods } }); continue; }
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
