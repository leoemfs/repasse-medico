/* ============================================================
 * Conferências compartilhadas pela pasta da rede (pedido de 26/11/2026): decisões de linha (aceitar para pagamento,
 * resolvido no MV, dispensar laudo), observações e rodadas (com o aceite do relatório) de cada competência.
 * Um arquivo por competência, na pasta do mês: «AAAA-MM - Mês › conferencias_compartilhadas.json».
 * Mescla de três vias pelo id, como as NCs (87b-nc-sync.js), sem pedir escolha:
 *   - decisão e observação: mudou só de um lado → vale a mudança; removida de um lado e intacta do outro → sai
 *     («Remover decisão» vale para os dois); o que só um tem entra. As decisões ficam em ordem de data: na mesma linha,
 *     a mais recente vale (o índice usa a última) e as duas aparecem com quem decidiu e quando;
 *   - rodada: nunca é apagada pela pasta (a retenção e «Limpar histórico» são de cada navegador); versões diferentes da
 *     mesma rodada → fica a de aceite mais recente (aceite e desfazer aceite viajam), juntando o histórico do aceite.
 * Cada registro guarda quem fez (por / operador), para cada pessoa saber o que foi feito por ela e pela outra.
 * ============================================================ */
const SCHEMA_CONF_SYNC = 'repasse-medico/conferencias-sync';
const ARQ_CONF_SYNC = 'conferencias_compartilhadas.json';
// Parte compartilhada da competência: decisões e observações (registro de competências) e rodadas da competência.
function partesConfSync(compReg, rodadas, chave) {
  const c = compReg?.itens?.[chave] || {};
  return { decisoes: clone(c.decisoes || []), observacoes: clone(c.observacoes || []),
    rodadas: clone((rodadas || []).filter(r => competenciaDaRodada(r) === chave)) };
}
function unidadesConf(p) {
  const m = new Map(); if (!p) return m;
  for (const d of p.decisoes || []) m.set('dec|' + d.id, d);
  for (const o of p.observacoes || []) m.set('obs|' + o.id, o);
  for (const r of p.rodadas || []) m.set('rod|' + r.id, r);
  return m;
}
// Último movimento do aceite da rodada: aceite atual ou o último desfeito (aceitarRodada / desfazerAceiteRodada).
const momentoAceite = r => [r?.aceite?.em || '', ...(r?.aceitesDesfeitos || []).map(a => a.desfeitoEm || '')].sort().at(-1) || '';
function juntarRodadas(a, b) {
  if (!a || !b) return a || b;
  const [fica, outra] = momentoAceite(b) > momentoAceite(a) ? [b, a] : [a, b];
  const r = clone(fica);
  // Rodada resumida pela retenção de um lado e completa do outro: as linhas completas ficam.
  if ((!r.linhas || !r.linhas.length) && outra.linhas?.length) r.linhas = clone(outra.linhas);
  const hist = new Map([...(outra.aceitesDesfeitos || []), ...(r.aceitesDesfeitos || [])].map(h => [JSON.stringify(h), h]));
  if (hist.size) r.aceitesDesfeitos = [...hist.values()].sort((x, y) => String(x.desfeitoEm).localeCompare(String(y.desfeitoEm)));
  return r;
}
/* local × remoto × base (última versão sincronizada, ou null). Devolve { partes, novas: {decisoes, observacoes, rodadas} }. */
function mesclarConf(local, remoto, base) {
  if (!remoto) return { partes: clone(local), novas: { decisoes: 0, observacoes: 0, rodadas: 0 } };
  const L = unidadesConf(local), R = unidadesConf(remoto), B = unidadesConf(base), out = new Map();
  for (const p of new Set([...L.keys(), ...R.keys(), ...B.keys()])) {
    const l = L.get(p), r = R.get(p), b = B.get(p), jl = JSON.stringify(l), jr = JSON.stringify(r), jb = JSON.stringify(b);
    if (p.startsWith('rod|')) { out.set(p, jl === jr ? l : juntarRodadas(l, r)); continue; }   // rodada: nunca sai pela pasta
    if (jl === jr) { out.set(p, l); continue; }
    if (base && jl === jb) { out.set(p, r); continue; }   // só o outro mudou (ou removeu)
    if (base && jr === jb) { out.set(p, l); continue; }   // só eu mudei (ou removi)
    out.set(p, l || r);   // primeira vez, ou os dois mudaram: o que existe fica
  }
  const por = k => [...out].filter(([p, v]) => p.startsWith(k) && v).map(([, v]) => clone(v));
  const ordem = (a, b) => String(a.em).localeCompare(String(b.em));
  const partes = { decisoes: por('dec|').sort(ordem), observacoes: por('obs|').sort(ordem), rodadas: por('rod|').sort(ordem) };
  const conta = k => [...out.keys()].filter(p => p.startsWith(k) && out.get(p) && !L.has(p)).length;
  return { partes, novas: { decisoes: conta('dec|'), observacoes: conta('obs|'), rodadas: conta('rod|') } };
}
// Põe decisões e observações mescladas de volta no registro (as rodadas vão para o banco do navegador, na tela).
function aplicarPartesConf(compReg, chave, partes) {
  const c = itemCompetencia(compReg, chave);
  c.decisoes = clone(partes.decisoes); c.observacoes = clone(partes.observacoes);
  return compReg;
}
// Quem fez o quê na competência (para a barra da Conferência).
function resumoAutoresConf(partes) {
  const m = new Map(), add = (quem, k) => { const a = m.get(quem || '—') || { decisoes: 0, observacoes: 0, rodadas: 0, aceites: 0 }; a[k]++; m.set(quem || '—', a); };
  for (const d of partes.decisoes || []) add(d.por, 'decisoes');
  for (const o of partes.observacoes || []) add(o.por, 'observacoes');
  for (const r of partes.rodadas || []) { add(r.operador, 'rodadas'); if (r.aceite) add(r.aceite.por, 'aceites'); }
  return [...m].map(([quem, n]) => ({ quem, ...n }));
}
