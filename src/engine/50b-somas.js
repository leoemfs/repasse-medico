/* ============================================================
 * Laudos que somam um código (prévia aprovada em 25/11/2026: docs/prototipos/laudos-somam-codigo/)
 * O contrário da regra composta: dois ou mais laudos do MESMO paciente, MESMO dia e MESMO médico valem UM código da
 * conta (ex.: TC abdome superior + TC abdome inferior = 41001095 TC ABDOME TOTAL). Fica em eq.somas e viaja pela pasta
 * junto com as equivalências. Só regra validada vale na conferência.
 * { id, titulos: [..], codigo, desc, escopo: { unidade: '*', convenio: '*' }, status, responsavel, validadoEm, historico }
 * ============================================================ */
function novaSoma({ titulos, codigo, desc = '', escopo = {} }, por) {
  return { id: 'som-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), titulos: titulos.map(t => String(t).trim()).filter(Boolean),
    codigo: String(codigo).trim(), desc: String(desc || '').trim(), escopo: { unidade: escopo.unidade || '*', convenio: escopo.convenio || '*' },
    status: 'validada', responsavel: por || '', validadoEm: agoraISO(), historico: [{ em: agoraISO(), por: por || '', de: '', para: 'validada', motivo: 'regra criada' }] };
}
const nomeSoma = s => `${s.titulos.join(' + ')} = ${s.codigo}${s.desc ? ' ' + s.desc : ''}`;
// Regras validadas que valem para o código, a unidade e o convênio da linha do MV.
function somasDoCodigo(eq, codigo, unidade, convenio) {
  return (eq?.somas || []).filter(s => s.status === 'validada' && String(s.codigo) === String(codigo)
    && ((s.escopo?.unidade || '*') === '*' || String(s.escopo.unidade) === String(unidade || ''))
    && ((s.escopo?.convenio || '*') === '*' || norm(s.escopo.convenio) === norm(convenio || '')));
}
/* Procura entre os laudos candidatos da linha um conjunto que cubra todos os títulos da regra, do mesmo médico e do mesmo
 * dia, com laudos ainda livres. Médicos em ordem de preferência (o do relatório primeiro). Devolve { soma, laudos } ou
 * { soma, falta: [títulos] } quando só uma parte existe; null se nenhuma regra se aplica. */
function somaDaLinha(regras, cands, livre, preferirMedico) {
  let parcial = null;
  for (const s of regras) {
    const chaves = s.titulos.map(chaveTitulo), porMed = new Map();
    for (const c of cands) { const k = chaveTitulo(c.l.titulo); if (!chaves.includes(k) || !livre(c.l)) continue; const g = `${c.l.mn}|${c.l.dia}`; (porMed.get(g) || porMed.set(g, []).get(g)).push(c); }
    const grupos = [...porMed.values()].sort((a, b) => (preferirMedico(b[0]) - preferirMedico(a[0])));
    for (const g of grupos) {
      const laudos = chaves.map(k => g.find(c => chaveTitulo(c.l.titulo) === k)?.l);
      if (laudos.every(Boolean)) return { soma: s, laudos };
      const falta = s.titulos.filter((t, i) => !laudos[i]);
      if (!parcial || falta.length < parcial.falta.length) parcial = { soma: s, falta, laudos: laudos.filter(Boolean) };
    }
  }
  return parcial;
}
