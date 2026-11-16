/* ============================================================
 * SOL-F43 (v3.0.0-alpha.6) — Classes de fechamento: o que a conferência autoriza a pagar.
 * Não é um motor novo: é a leitura da situação da linha (conferência) + as decisões já registradas.
 *   Devido      → «Conferido» (par único, nome seguro, mesma data, equivalência validada / regra composta / exame).
 *                 HM só quando a regra do prestador o inclui (hoje: V3, HM de USG/Doppler Unimed → conferido).
 *   Aceito      → decisão «Aceito para pagamento» (antes «Considerado no repasse»), com justificativa, quem e quando.
 *   NC          → NC registrada (menos «não procede»). Fora do fechamento.
 *   Excluído    → taxa, material e medicamento (nunca compõem repasse) e HM sem regra do prestador (excluir do MV).
 *   Pendente    → todo o resto: ressalva sem aceite, ambíguo, só no faturamento, equivalência não validada,
 *                 composição incompleta, pacote, desconhecido e «Resolvido no MV» ainda não reconferido.
 * Valor para pagamento = Devido + Aceito. Devido + Aceito + Pendente + NC + Excluído = total do relatório do MV.
 * ============================================================ */
const CLASSES_FECH = {
  devido: { nome: 'Devido', entra: true, cor: 'C6EFCE', def: 'Conferido: par único, nome seguro, mesma data e equivalência validada' },
  aceito: { nome: 'Aceito', entra: true, cor: 'E4DCF5', def: 'Aceito para pagamento, com justificativa (quem e quando)' },
  pend: { nome: 'Pendente', entra: false, cor: 'FFEB9C', def: 'Sem decisão: não entra no fechamento até ser aceito, virar NC ou ser reconferido' },
  nc: { nome: 'Não conformidade', entra: false, cor: 'FFC7CE', def: 'NC registrada: fora do fechamento; «não procede» devolve a linha ao cálculo' },
  excluido: { nome: 'Excluído', entra: false, cor: 'E4E4E4', def: 'Não compõe repasse: taxa, material, medicamento e HM sem regra do prestador' }
};
const ORDEM_CLASSES = ['devido', 'aceito', 'pend', 'nc', 'excluido'];
const TIPOS_NUNCA_REPASSE = new Set(['taxa', 'material', 'medicamento']);
// Rodadas feitas a partir desta versão guardam a regra de valor; as anteriores continuam com o total do MV.
const REGRA_VALOR_F43 = 'f43';

/* Classe de uma linha do MV. tipo = tipo do item (procedimento, hm, taxa…); estado = situação da conferência;
 * decisao = tipo da decisão da competência (nc, considerar, resolvido…) ou ''. */
function classeDaLinha(tipo, estado, decisao) {
  if (TIPOS_NUNCA_REPASSE.has(tipo)) return 'excluido';
  if (decisao === 'nc') return 'nc';
  if (tipo === 'hm') return estado === 'conferido' ? 'devido' : 'excluido';
  if (decisao === 'considerar') return 'aceito';
  if (decisao === 'resolvido') return 'pend';
  return estado === 'conferido' ? 'devido' : 'pend';
}
// Linha do resultado da conferência (só as que vêm do MV têm classe; laudos «Só no laudo» não têm valor).
const classeDaLinhaConf = x => x.r ? classeDaLinha(x.tipo, x.status, x.decisao?.tipo || '') : null;
// Linha guardada numa rodada, com as decisões atuais da competência.
const decisaoDaLinhaRodada = (idx, l) => (idx && (idx.get(l.kd) || (l.kl && idx.get(l.kl)))) || null;
const classeDaLinhaRodada = (l, idx) => classeDaLinha(l.tipoItem || 'procedimento', l.estado, idx ? (decisaoDaLinhaRodada(idx, l)?.tipo || '') : (l.decisao || ''));

function totaisPorClasse(linhas, classeDe, campo = 'vlRepasse') {
  const t = Object.fromEntries(ORDEM_CLASSES.map(k => [k, { n: 0, valor: 0 }]));
  for (const l of linhas) { const k = classeDe(l); if (!k) continue; t[k].n++; t[k].valor += +(l.r ? l.r[campo] : l[campo]) || 0; }
  for (const k of ORDEM_CLASSES) t[k].valor = r2(t[k].valor);
  t.pagar = r2(t.devido.valor + t.aceito.valor);
  t.total = r2(ORDEM_CLASSES.reduce((s, k) => s + t[k].valor, 0));
  return t;
}
const linhasParaPagamento = (rodada, idx) => rodada.linhas.filter(l => CLASSES_FECH[classeDaLinhaRodada(l, idx)]?.entra);
const usaRegraF43 = r => r?.regraValor === REGRA_VALOR_F43;

/* Reconferência (SOL-F42): o que devia ter saído do MV e continua no relatório.
 * ncs: NCs da competência; decisoes: registro de decisões da competência; res/ctx: conferência atual; rodadas: todas.
 * Devolve {ncs:[{nc, situacao, linha}], resolvidos:[{d, situacao, linha}], hm:[{linha, continua}]}. */
function situacaoCorrecoesMV(res, ctx, ncs, decisoes, rodadas) {
  const hashAtual = (ctx.arquivos || []).find(a => a.papel === 'MV')?.hash || '';
  const porKd = new Map(res.linhas.filter(x => x.r).map(x => [chaveMVDecisao(x.r), x]));
  const hashDaRodada = id => (rodadas.find(r => r.id === id)?.arquivos || []).find(a => a.papel === 'MV')?.hash || '';
  const doRelatorio = k => String(k).startsWith('M|');
  const avaliar = (chaves, hashOrigem) => {
    const kd = (chaves || []).find(doRelatorio); if (!kd) return null;
    const x = porKd.get(kd);
    if (!x) return { situacao: 'corrigida', linha: null };
    return { situacao: hashOrigem && hashOrigem !== hashAtual ? 'continua' : 'aguardando', linha: x };
  };
  const out = { ncs: [], resolvidos: [], hm: [] };
  // Só as NCs deste relatório (prestador × unidade da rodada em que nasceram); sem rodada, só se a linha está aqui.
  const desteRelatorio = nc => { const r = rodadas.find(y => y.id === nc.origem?.rodadaId); return r ? String(r.prestadorCod) === String(ctx.relatorio.cab.prestadorCod) && String(r.unidadeCod) === String(ctx.unidadeCod) : null; };
  for (const nc of ncs || []) {
    if (nc.situacao === 'nao-procede') continue;
    const a = avaliar(nc.origem?.chavesLinha, hashDaRodada(nc.origem?.rodadaId)); if (!a) continue;
    const deste = desteRelatorio(nc);
    if (deste === true || (deste === null && a.linha)) out.ncs.push({ nc, ...a });
  }
  for (const d of decisoes || []) if (d.tipo === 'resolvido' && (!d.resumo?.relatorio || d.resumo.relatorio === `${ctx.relatorio.cab.prestadorCod}|${ctx.unidadeCod}`)) { const a = avaliar(d.chaves, d.resumo?.hashMV || ''); if (a) out.resolvidos.push({ d, ...a }); }
  // HM sem regra: «continua» quando uma rodada anterior do mesmo relatório (outro PDF) já tinha a mesma linha.
  const anteriores = rodadas.filter(r => r.tipo === 'conferencia' && r.id !== ctx.rodadaId && String(r.prestadorCod) === String(ctx.relatorio.cab.prestadorCod) && String(r.unidadeCod) === String(ctx.unidadeCod) && (r.arquivos || []).find(a => a.papel === 'MV')?.hash !== hashAtual);
  const kdsAntes = new Set(anteriores.flatMap(r => r.linhas.map(l => l.kd)));
  for (const x of res.linhas) if (x.r && x.tipo === 'hm' && classeDaLinhaConf(x) === 'excluido') out.hm.push({ linha: x, continua: kdsAntes.has(chaveMVDecisao(x.r)) });
  return out;
}
