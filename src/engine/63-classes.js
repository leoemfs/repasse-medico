/* ============================================================
 * SOL-F43 (v3.0.0-alpha.6) — Classes de fechamento: o que a conferência autoriza a pagar.
 * Não é um motor novo: é a leitura da situação da linha (conferência) + as decisões já registradas.
 *   Devido      → «Conferido» (par único, nome seguro, mesma data, equivalência validada / regra composta / exame).
 *                 HM só na V3 (HM de USG/Doppler Unimed → conferido). Fora da V3 nenhum HM é pago (SOL-F48).
 *   Aceito      → decisão «Aceito para pagamento» (antes «Considerado no repasse»), com justificativa, quem e quando.
 *   NC          → NC registrada (menos «não procede»). Fora do fechamento.
 *   Excluído    → taxa, material e medicamento (nunca compõem repasse), HM sem regra do prestador (excluir do MV) e,
 *                 na V3, o exame base Bradesco a 100% substituído pelo pacote de ressonância/mamografia.
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
  if (tipo === 'hm') {
    if (estado === 'conferido') return 'devido';
    // V3: HM de USG Unimed sem o exame base no relatório espera decisão (pode ser aceito); os demais HM são excluídos.
    if (estado === 'hm-sem-base') return decisao === 'considerar' ? 'aceito' : 'pend';
    return 'excluido';
  }
  if (decisao === 'considerar') return 'aceito';
  // V3: exame base Bradesco a 100% substituído pelo pacote de ressonância/mamografia não compõe repasse.
  if (estado === 'substituido-pacote') return 'excluido';
  if (decisao === 'resolvido') return 'pend';
  return estado === 'conferido' ? 'devido' : 'pend';
}
// Linha do resultado da conferência (só as que vêm do MV têm classe; laudos «Só no laudo» não têm valor).
const classeDaLinhaConf = x => x.r ? classeDaLinha(x.tipo, x.status, x.decisao?.tipo || '') : null;
// Linha guardada numa rodada, com as decisões atuais da competência.
// Linhas da rodada são todas do MV: a decisão vem da chave do MV (a do laudo só desempata a linha repetida). v3.0.0-alpha.9.
const decisaoDaLinhaRodada = (idx, l) => decisaoPorChaveMV(idx, l.kd, l.kl || '');
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
  const doMV = res.linhas.filter(x => x.r), porKd = new Map(doMV.map(x => [chaveMVDecisao(x.r), x]));
  const porLaudo = new Map(); for (const x of res.linhas) { const k = chaveLaudoDecisao(x.l); if (k && !porLaudo.has(k)) porLaudo.set(k, x); }
  const hashDaRodada = id => (rodadas.find(r => r.id === id)?.arquivos || []).find(a => a.papel === 'MV')?.hash || '';
  const doRelatorio = k => String(k).startsWith('M|');
  // Linha do relatório atual que leva a decisão gravada nas chaves (a mesma regra da classe, também para a linha repetida).
  const linhaDaChave = (kd, chaves, dup) => {
    if (porKd.has(kd)) return porKd.get(kd);
    const idx = new Map([[kd, { kls: (chaves || []).filter(k => String(k).startsWith('L|')), dup }]]);
    return doMV.find(x => decisaoPorChaveMV(idx, chaveMVDecisao(x.r), chaveLaudoDecisao(x.l))) || null;
  };
  const avaliar = (chaves, hashOrigem, dup = false) => {
    const kd = (chaves || []).find(doRelatorio);
    if (!kd) {
      // v3.0.0-alpha.9: NC de laudo sem lançamento («Só no laudo»). Se o laudo agora tem par no MV, o lançamento foi feito:
      // a NC está corrigida e a linha segue a própria classe (a NC não passa para ela).
      const kl = (chaves || []).find(k => String(k).startsWith('L|')), x = kl && porLaudo.get(kl);
      if (!x) return null;
      return x.r ? { situacao: 'lancada', linha: x } : { situacao: 'aguardando', linha: null };
    }
    const x = linhaDaChave(kd, chaves, dup);
    if (!x) return { situacao: 'corrigida', linha: null };
    return { situacao: hashOrigem && hashOrigem !== hashAtual ? 'continua' : 'aguardando', linha: x };
  };
  const out = { ncs: [], resolvidos: [], hm: [] };
  // Só as NCs deste relatório (prestador × unidade da rodada em que nasceram); sem rodada, só se a linha está aqui.
  const desteRelatorio = nc => { const r = rodadas.find(y => y.id === nc.origem?.rodadaId); return r ? String(r.prestadorCod) === String(ctx.relatorio.cab.prestadorCod) && String(r.unidadeCod) === String(ctx.unidadeCod) : null; };
  for (const nc of ncs || []) {
    if (nc.situacao === 'nao-procede') continue;
    const a = avaliar(nc.origem?.chavesLinha, hashDaRodada(nc.origem?.rodadaId), nc.origem?.tipoCandidato === 'duplicidade'); if (!a) continue;
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
