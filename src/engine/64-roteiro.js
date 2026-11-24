/* ============================================================
 * SOL-F51 (v3.0.0-alpha.26) — Roteiro da conferência por relatório (prestador × unidade).
 * Não é um registro novo: o passo é LIDO do que já existe — PDF lido, rodadas, decisões, «Resolvido no MV»,
 * NCs nas linhas, aceite e e-mail marcado no Fechamento.
 *   0 Versão hospitalar no MV      → falta o PDF (nenhum lido e nenhuma rodada)
 *   1 Conferir e decidir           → PDF lido sem rodada, ou rodada com linhas pendentes sem decisão
 *   2 Corrigir no MV               → tudo decidido, mas há «Resolvido no MV» ou NC em linhas que continuam no PDF conferido
 *   3 Gerar de novo e reconferir   → há um PDF lido diferente do da última rodada (PDF novo: conferir de novo)
 *   4 Aceite do relatório          → nada a decidir nem a corrigir; falta o aceite
 *   5 Versão final e envio         → aceito; falta marcar o e-mail
 *   6 Concluído                    → aceito e e-mail marcado
 * ============================================================ */
const PASSOS_ROTEIRO = [
  { nome: 'Versão hospitalar no MV', dica: 'PDF com valor total, na pasta ou carregado' },
  { nome: 'Conferir e decidir', dica: 'aceitar, registrar NC ou marcar «Resolvido no MV»' },
  { nome: 'Corrigir no MV', dica: 'o que você marcou para corrigir' },
  { nome: 'Gerar de novo e reconferir', dica: 'novo PDF · «Reler o PDF e conferir de novo»' },
  { nome: 'Aceite do relatório', dica: 'nada falta decidir' },
  { nome: 'Versão final e envio', dica: 'PDF sem valor total + prévia por e-mail' }
];
const hashMVDaRodada = r => (r?.arquivos || []).find(a => a.papel === 'MV')?.hash || '';

/* pdf: {nome, hash} do relatório lido nesta sessão (ou null); rodadas: as de conferência deste prestador × unidade na
 * competência; idx: índice das decisões da competência; enviado: data do e-mail marcado (ou ''). */
function roteiroDoRelatorio({ pdf = null, rodadas = [], idx = null, enviado = '' }) {
  const ult = [...rodadas].filter(r => !r.resumida).sort((a, b) => b.em.localeCompare(a.em))[0] || null;
  const det = PASSOS_ROTEIRO.map(() => '');
  const out = { passo: 0, detalhes: det, alerta: false, rodada: ult, pendentes: 0, resolvidos: 0, ncs: 0, pdfNovo: false };
  if (!pdf && !ult) { det[0] = 'nenhum PDF lido para este relatório'; return out; }
  det[0] = pdf ? `lido: ${pdf.nome}` : `conferido: ${(ult.arquivos || []).find(a => a.papel === 'MV')?.nome || 'PDF'}`;
  if (!ult) { out.passo = 1; det[1] = 'falta executar a conferência'; return out; }
  // Linhas da última rodada com as decisões atuais da competência (mesma leitura das classes do fechamento, SOL-F43).
  for (const l of ult.linhas || []) {
    const d = idx ? decisaoDaLinhaRodada(idx, l)?.tipo || '' : (l.decisao || '');
    if (d === 'resolvido') out.resolvidos++;
    else if (d === 'nc') out.ncs++;
    else if (classeDaLinhaRodada(l, idx) === 'pend') out.pendentes++;
  }
  out.pdfNovo = !!(pdf && pdf.hash && hashMVDaRodada(ult) && pdf.hash !== hashMVDaRodada(ult));
  if (out.pdfNovo) {
    out.passo = 3; det[1] = 'decisões guardadas'; det[2] = 'PDF novo lido'; det[3] = 'falta conferir o PDF novo'; return out;
  }
  const reconferido = rodadas.some(r => hashMVDaRodada(r) && hashMVDaRodada(r) !== hashMVDaRodada(ult));
  // Aceite registrado (inclusive com pendências justificadas na observação): o relatório segue para o envio.
  if (ult.aceite) {
    det[1] = out.pendentes ? `${out.pendentes} pendente(s) no aceite, com observação` : 'tudo decidido';
    det[2] = out.resolvidos || out.ncs ? [out.resolvidos && `${out.resolvidos} resolvido(s) no MV`, out.ncs && `${out.ncs} NC`].filter(Boolean).join(' · ') : 'nada a corrigir';
    det[3] = reconferido ? 'reconferido ✓' : 'não precisou';
    det[4] = `aceito ${new Date(ult.aceite.em).toLocaleDateString('pt-BR')} por ${ult.aceite.por || '—'}`;
    if (!enviado) { out.passo = 5; det[5] = 'falta marcar o e-mail'; return out; }
    out.passo = 6; det[5] = `e-mail ${String(enviado).split('-').reverse().join('/')}`;
    return out;
  }
  if (out.pendentes) { out.passo = 1; det[1] = `${out.pendentes} decisão(ões) faltam`; return out; }
  det[1] = 'tudo decidido';
  if (out.resolvidos || out.ncs) {
    // Já foi conferido um PDF novo e as linhas continuam lá: alerta (o MV ainda vai pagar).
    const anteriores = rodadas.filter(r => r.id !== ult.id && r.em < ult.em && hashMVDaRodada(r) && hashMVDaRodada(r) !== hashMVDaRodada(ult));
    out.alerta = anteriores.length > 0;
    out.passo = 2;
    det[2] = [out.resolvidos && `${out.resolvidos} resolvido(s) no MV`, out.ncs && `${out.ncs} NC`].filter(Boolean).join(' · ') + (out.alerta ? ' — continuam no PDF novo' : '');
    det[3] = 'depois: gerar o PDF de novo';
    return out;
  }
  det[2] = 'nada a corrigir'; det[3] = reconferido ? 'reconferido ✓' : 'não precisou';
  out.passo = 4; det[4] = 'falta registrar';
  return out;
}
const rotuloPassoRoteiro = r => r.passo >= 6 ? '✓ enviado' : `passo ${r.passo + 1} de 6`;
