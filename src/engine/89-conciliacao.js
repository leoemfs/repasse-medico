/* ============================================================
 * Conciliação com o Power BI (SOL-F9)
 * O Power BI (faturamento) é consultado para explicar o que a conferência encontrou:
 * - laudo «Só no laudo»: há lançamento? em qual conta? para qual prestador? a conta está fechada?
 *   tem remessa? quem fechou?
 * Só sugere a natureza e o responsável da NC; nada é decidido sozinho. Nomes de pacientes do Power BI
 * ficam só na memória da sessão (não são gravados); CPF nunca é lido.
 * ============================================================ */
const SITUACAO_PBI = {
  'sem-lancamento': { nome: 'Sem lançamento no Power BI', natureza: 'nao-lancado' },
  'outro-prestador': { nome: 'Lançado para outro prestador', natureza: 'prestador-incorreto' },
  'outro-relatorio': { nome: 'Lançado para o médico do laudo (está no relatório dele)', natureza: '' },
  'conta-aberta': { nome: 'Lançado, conta aberta', natureza: 'conta-aberta' },
  'sem-remessa': { nome: 'Conta fechada, sem remessa', natureza: 'sem-remessa' },
  'lancado': { nome: 'Lançado (depois da geração do repasse?)', natureza: 'apos-geracao' }
};
const contaFechadaPBI = v => /^(S|SIM|Y|YES|TRUE|1|FECHADA)$/i.test(String(v || '').trim());
// Índice por dia (lançamentos com paciente e data).
function indicePBIPorDia(pbi) {
  if (pbi._porDia) return pbi._porDia;
  const m = new Map();
  for (const l of pbi.linhas) { if (!l.pn || !l.data) continue; const d = diaSerial(l.data); (m.get(d) || m.set(d, []).get(d)).push(l); }
  Object.defineProperty(pbi, '_porDia', { value: m, enumerable: false });
  return m;
}
/* Procura o atendimento do laudo no Power BI.
 * laudo: {pn, dia, titulo, modalidade}; opc: {unidadeCod, tol, prestadorCod, cfg, idxEq} */
function conciliarLaudo(pbi, laudo, opc) {
  if (!pbi || !laudo?.pn || laudo.dia === null || laudo.dia === undefined) return null;
  const porDia = indicePBIPorDia(pbi), tol = +opc.tol || 0, minTrunc = +opc.cfg?.parametros?.minTruncamento || 20, cands = [];
  for (let d = laudo.dia - tol; d <= laudo.dia + tol; d++) for (const l of porDia.get(d) || []) {
    if (opc.unidadeCod && opc.unidadeCod !== '*' && String(l.unidadeCod) !== String(opc.unidadeCod)) continue;
    const nm = nivelNome(laudo.pn, l.pn, minTrunc); if (nm < 2) continue;
    const mods = modalidadesDoGrupo(l.grupo);
    const eq = opc.idxEq && laudo.titulo ? avaliarProcedimento(opc.idxEq, l.codigo, laudo.titulo, { unidade: opc.unidadeCod, convenio: l.convenio }).estado : '';
    const pontos = (eq === 'validada' ? 4 : eq === 'pendente' ? 2 : 0) + (mods && laudo.modalidade && mods.includes(laudo.modalidade) ? 1 : 0) + (diaSerial(l.data) === laudo.dia ? 1 : 0) + (nm === 3 ? 1 : 0);
    if (!mods || !laudo.modalidade || mods.includes(laudo.modalidade) || eq === 'validada') cands.push({ l, pontos, eq });
  }
  if (!cands.length) return { situacao: 'sem-lancamento', ...SITUACAO_PBI['sem-lancamento'], texto: `Power BI: nenhum lançamento do paciente em ±${tol} dia(s)${opc.unidadeCod && opc.unidadeCod !== '*' ? ` na unidade ${opc.unidadeCod}` : ''} compatível com o laudo.` };
  cands.sort((a, b) => b.pontos - a.pontos);
  const l = cands[0].l, base = `conta ${l.conta || '—'} · atendimento ${l.atendimento || '—'} · ${l.codigo} ${l.desc}`;
  const faturista = l.faturista || '';
  let s;
  // Médico do laudo pelo cadastro (nome do MV ou alias validado): lançado para ele = está no relatório dele.
  const doLaudo = laudo.medico && opc.cfg ? prestadorDoMedico(opc.idxPrest || indicePrestadores(opc.cfg), laudo.medico) : null;
  if (opc.prestadorCod && l.prestador && String(l.prestador) !== String(opc.prestadorCod)) s = doLaudo?.estado === 'ok' && String(doLaudo.prestador.cod) === String(l.prestador) ? 'outro-relatorio' : 'outro-prestador';
  else if (l.contaFechada !== '' && !contaFechadaPBI(l.contaFechada)) s = 'conta-aberta';
  else if (l.contaFechada !== '' && !l.remessa) s = 'sem-remessa';
  else s = 'lancado';
  const detalhe = s === 'outro-relatorio' ? `lançado para o prestador ${l.prestador}, que é o médico do laudo` : s === 'outro-prestador' ? `lançado para o prestador ${l.prestador}, não ${opc.prestadorCod}` : s === 'conta-aberta' ? 'conta ainda aberta' : s === 'sem-remessa' ? 'conta fechada, sem remessa' : `lançado${l.remessa ? ` (remessa ${l.remessa})` : ''}: pode ter entrado depois da geração do repasse`;
  return { situacao: s, ...SITUACAO_PBI[s], linha: l, faturista, conta: l.conta, atendimento: l.atendimento, prestador: l.prestador,
    texto: `Power BI: ${base} — ${detalhe}${faturista ? ` · conta fechada por ${faturista}` : ''}.` };
}
/* Enriquece os candidatos «Só no laudo» com o que o Power BI mostra: natureza sugerida, responsável
 * (quem fechou a conta), conta e atendimento. Devolve o resumo por situação. */
function enriquecerCandidatosComPBI(cands, pbi, opc) {
  const resumo = Object.fromEntries(Object.keys(SITUACAO_PBI).map(k => [k, 0]));
  if (!pbi) return resumo;
  for (const c of cands) {
    if (c.tipo !== 'so-laudo') continue;
    const k = c.campos, data = paraData(k.data);
    const r = conciliarLaudo(pbi, { pn: norm(k.paciente), dia: data ? diaSerial(data) : null, titulo: k.titulo, modalidade: k.modalidade, medico: k.medico }, opc);
    if (!r) continue;
    resumo[r.situacao]++;
    c.pbi = { situacao: r.situacao, nome: r.nome, texto: r.texto };
    c.natureza = r.natureza || c.natureza;
    if (r.faturista && !k.responsavel) k.responsavel = r.faturista;
    if (r.conta && !k.conta) k.conta = r.conta;
    if (r.atendimento && !k.idAtendimento) k.idAtendimento = r.atendimento;
    c.motivo = `${c.motivo}${c.motivo ? ' · ' : ''}${r.texto}`;
  }
  return resumo;
}
