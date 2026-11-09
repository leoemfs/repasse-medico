/* ============================================================
 * SOL-F37 — Equivalências TUSS compartilhadas pela pasta da rede: mescla de três vias.
 * Relação pela chave natural (código × título × escopo): cada navegador gera ids diferentes ao importar a mesma planilha.
 * Regra composta pelo id (nasce num navegador e viaja pela pasta). Catálogo TUSS: união por código.
 * ============================================================ */
const SCHEMA_EQ_SYNC = 'repasse-medico/equivalencias-sync';
const chaveRelacaoEq = e => `${e.codigo}|${chaveTitulo(e.titulo)}|${e.escopo?.unidade || '*'}|${e.escopo?.modalidade || '*'}`;
function unidadesEq(base) {
  const m = new Map(); if (!base) return m;
  for (const e of base.itens || []) m.set('rel|' + chaveRelacaoEq(e), e);
  for (const c of base.compostas || []) m.set('cmp|' + c.id, c);
  return m;
}
const RANK_STATUS_EQ = { pendente: 0, coberta: 1, desativada: 2, validada: 3 };
// Junta o histórico de duas versões da mesma relação/regra (sem repetir).
function juntarHistoricoEq(v, outro) {
  if (!v || !Array.isArray(outro?.historico)) return v;
  const r = clone(v), vistos = new Set((r.historico || []).map(h => JSON.stringify(h)));
  for (const h of outro.historico) if (!vistos.has(JSON.stringify(h))) (r.historico ||= []).push(h);
  (r.historico || []).sort((a, b) => String(a.em).localeCompare(String(b.em)));
  return r;
}
/* local × remoto × base (última sincronizada, ou null na primeira vez). Devolve {eq, conflitos:[{p, rotulo, local, remoto}]}.
 * Sem base: relação pendente de um lado fica com a decisão do outro; decisões diferentes viram conflito. */
function mesclarEq(local, remoto, base) {
  if (!remoto) return { eq: clone(local), conflitos: [] };
  if (!local) return { eq: clone(remoto), conflitos: [] };
  const L = unidadesEq(local), R = unidadesEq(remoto), B = unidadesEq(base), out = new Map(), conflitos = [];
  for (const p of new Set([...L.keys(), ...R.keys(), ...B.keys()])) {
    const l = L.get(p), r = R.get(p), b = B.get(p);
    const sem = x => { if (!x) return x; const { id, ...resto } = x; return JSON.stringify(p.startsWith('rel|') ? resto : x); };   // relação: o id não conta
    const jl = sem(l), jr = sem(r), jb = sem(b);
    if (jl === jr) { out.set(p, l); continue; }
    if (base) {
      if (jl === jb) { out.set(p, r); continue; }
      if (jr === jb) { out.set(p, l); continue; }
    } else {
      if (!l || !r) { out.set(p, l || r); continue; }
      if (p.startsWith('rel|') && l.status === r.status) { out.set(p, juntarHistoricoEq((l.historico?.length || 0) >= (r.historico?.length || 0) ? l : r, l.historico?.length >= r.historico?.length ? r : l)); continue; }
      if (p.startsWith('rel|') && (l.status === 'pendente' || r.status === 'pendente')) { const v = l.status === 'pendente' ? r : l; out.set(p, juntarHistoricoEq(v, v === l ? r : l)); continue; }
    }
    out.set(p, l);
    conflitos.push({ p, rotulo: p.startsWith('rel|') ? `«${(l || r).titulo}» → ${(l || r).codigo}` : `Regra composta «${nomeComposta(l || r)}»`, local: l, remoto: r });
  }
  const eq = { ...clone(remoto), ...clone(local) };
  eq.itens = [...out].filter(([p, v]) => p.startsWith('rel|') && v).map(([, v]) => clone(v));
  eq.compostas = [...out].filter(([p, v]) => p.startsWith('cmp|') && v).map(([, v]) => clone(v));
  const cat = new Map([...(remoto.catalogoTUSS || []), ...(local.catalogoTUSS || [])].map(t => [t.codigo, t]));
  if (cat.size) eq.catalogoTUSS = [...cat.values()];
  eq.revisao = Math.max(+local.revisao || 0, +remoto.revisao || 0) + 1;
  return { eq, conflitos };
}
function aplicarEscolhasEq(eq, conflitos, escolhas) {
  const r = clone(eq);
  conflitos.forEach((c, i) => {
    const v = juntarHistoricoEq(escolhas[i] === 'remoto' ? c.remoto : c.local, escolhas[i] === 'remoto' ? c.local : c.remoto);
    const lista = c.p.startsWith('rel|') ? r.itens : (r.compostas ||= []), chave = c.p.slice(4);
    const idx = lista.findIndex(x => (c.p.startsWith('rel|') ? chaveRelacaoEq(x) : x.id) === chave);
    if (idx >= 0) { if (v) lista[idx] = v; else lista.splice(idx, 1); } else if (v) lista.push(v);
  });
  return r;
}
function resumoValorEq(v) {
  if (!v) return 'apagada';
  if ('codigo' in v) { const h = v.historico?.at(-1); return `${STATUS_EQ[v.status] || v.status}${v.responsavel ? ` (${v.responsavel})` : ''}${h?.motivo ? ` · «${h.motivo}»` : ''}${h?.em ? ` · ${String(h.em).slice(0, 16).replace('T', ' ')}` : ''}`; }
  const r = regraComposta(v); return `${STATUS_EQ[r.status] || r.status} · ${textoEsperados(esperadosDaComposta(r, ''))}`;
}
// Quantas relações validadas chegaram pela pasta (para avisar e sugerir rodar de novo as conferências).
function novasValidadasEq(antes, depois) {
  const a = new Set((antes?.itens || []).filter(e => e.status === 'validada').map(chaveRelacaoEq));
  return (depois?.itens || []).filter(e => e.status === 'validada' && !a.has(chaveRelacaoEq(e)));
}
