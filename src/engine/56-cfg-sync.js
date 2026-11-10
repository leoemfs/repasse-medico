/* ============================================================
 * v3.0 — Configuração compartilhada pela pasta da rede: mescla de três vias, como o Fluxo e as equivalências.
 * Vai para a pasta só o que é da equipe (Bases: unidades, prestadores e aliases, regras, faturistas, convênios,
 * classes, faixas, descontos, regras de classificação, parâmetros, pastas e modelos de exportação). Preferências
 * de cada pessoa (operador, tema, cor, menu, competência aberta) ficam no navegador (CHAVES_INDIVIDUAIS).
 * Cada lista com chave natural vira um item por chave (prestador pelo código, unidade pelo código, faturista e
 * convênio pelo nome…): duas pessoas mexendo em prestadores diferentes não conflitam.
 * ============================================================ */
const SCHEMA_CFG_SYNC = 'repasse-medico/configuracao-sync';
const LISTAS_CFG = {
  unidades: u => String(u.cod), prestadores: p => String(p.cod), faturistas: f => norm(f.nome), convenios: c => norm(c.nome || ''),
  classificacao: r => r.id, descontos: d => d.id, faixasUSG: f => f.id, modelosExportacao: m => m.id
};
const MAPAS_CFG = ['parametros', 'fechamento', 'pastas'];   // cada chave é um item da mescla
const FORA_DA_MESCLA_CFG = new Set(['schema', 'versaoSchema', 'revisao', 'atualizadoEm']);

function unidadesCfg(cfg) {
  const m = new Map(); if (!cfg) return m;
  for (const [k, v] of Object.entries(cfg)) {
    if (FORA_DA_MESCLA_CFG.has(k) || v === undefined) continue;
    if (LISTAS_CFG[k] && Array.isArray(v)) { m.set(`${k}|`, []); v.forEach((x, i) => m.set(`${k}|${LISTAS_CFG[k](x) || '#' + i}`, x)); }
    else if (MAPAS_CFG.includes(k) && v && typeof v === 'object' && !Array.isArray(v)) { m.set(`${k}|`, {}); for (const [ek, ev] of Object.entries(v)) m.set(`${k}|${ek}`, ev); }
    else m.set(k, v);
  }
  return m;
}
// Remonta a configuração; as listas guardam a ordem da versão local e depois a da pasta.
function montarCfg(m, ordem) {
  const c = {};
  for (const [p, v] of m) {
    if (v === undefined) continue;
    const i = p.indexOf('|');
    if (i < 0) { c[p] = clone(v); continue; }
    const k = p.slice(0, i), sub = p.slice(i + 1);
    if (LISTAS_CFG[k]) { c[k] = c[k] || []; if (sub) c[k].push(clone(v)); }
    else { c[k] = c[k] || {}; if (sub) c[k][sub] = clone(v); }
  }
  for (const k of Object.keys(LISTAS_CFG)) if (c[k] && ordem?.[k]) { const pos = new Map(ordem[k].map((x, i) => [x, i])); c[k].sort((a, b) => (pos.get(LISTAS_CFG[k](a)) ?? 1e9) - (pos.get(LISTAS_CFG[k](b)) ?? 1e9)); }
  return c;
}
// Sem «última versão sincronizada» (primeira vez, ou depois de restaurar um backup): junta o que der sem perder nada.
// Objetos: campo que só um lado tem entra; listas de objetos com id/código/nome viram união; marcas de tempo e
// origem não contam como diferença. Valores realmente diferentes viram conflito para a pessoa escolher.
const IGNORAR_SEM_BASE = new Set(['em', 'origem', 'atualizadoEm', 'importadoEm']);
const chaveItemLista = x => x && typeof x === 'object' ? (x.id ?? x.cod ?? (x.nome !== undefined ? norm(x.nome) : undefined)) : undefined;
function juntarSemBase(l, r) {
  if (json(l) === json(r)) return { v: l, conflito: false };
  if (l === undefined || l === null || l === '') return { v: r, conflito: false };
  if (r === undefined || r === null || r === '') return { v: l, conflito: false };
  if (Array.isArray(l) && Array.isArray(r)) {
    const objs = [...l, ...r].every(x => chaveItemLista(x) !== undefined), prim = [...l, ...r].every(x => x === null || typeof x !== 'object');
    if (prim) return { v: [...new Set([...l, ...r])], conflito: false };
    if (!objs) return { v: l, conflito: true };
    const out = [], idx = new Map(); let conflito = false;
    for (const x of l) { idx.set(String(chaveItemLista(x)), out.length); out.push(x); }
    for (const x of r) { const k = String(chaveItemLista(x)); if (!idx.has(k)) { idx.set(k, out.length); out.push(x); continue; } const j = juntarSemBase(out[idx.get(k)], x); out[idx.get(k)] = j.v; conflito ||= j.conflito; }
    return { v: out, conflito };
  }
  if (typeof l === 'object' && typeof r === 'object' && !Array.isArray(l) && !Array.isArray(r)) {
    const v = {}; let conflito = false;
    for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
      if (IGNORAR_SEM_BASE.has(k)) { v[k] = l[k] ?? r[k]; continue; }
      const j = juntarSemBase(l[k], r[k]); v[k] = j.v; conflito ||= j.conflito;
    }
    return { v, conflito };
  }
  return { v: l, conflito: true };
}
/* local × remoto × base. Devolve {cfg, conflitos:[{p, rotulo, local, remoto}]}; no conflito fica a versão local
 * até a escolha (aplicarEscolhasCfg). Nunca troca em silêncio um valor que os dois mudaram. */
function mesclarCfg(local, remoto, base) {
  if (!remoto) return { cfg: clone(local), conflitos: [] };
  if (!local) return { cfg: clone(remoto), conflitos: [] };
  const L = unidadesCfg(local), R = unidadesCfg(remoto), B = unidadesCfg(base), out = new Map(), conflitos = [];
  for (const p of new Set([...L.keys(), ...R.keys(), ...(base ? B.keys() : [])])) {
    const l = L.get(p), r = R.get(p), jl = json(l), jr = json(r);
    if (jl === jr) { out.set(p, l); continue; }
    if (base) {
      const jb = json(B.get(p));
      if (jl === jb) { out.set(p, r); continue; }   // só a pasta mudou
      if (jr === jb) { out.set(p, l); continue; }   // só eu mudei
    } else {
      const j = juntarSemBase(l, r);
      if (!j.conflito) { out.set(p, j.v); continue; }
    }
    out.set(p, l); conflitos.push({ p, rotulo: rotuloUnidadeCfg(local, remoto, p), local: l, remoto: r });
  }
  const ordem = {};
  for (const k of Object.keys(LISTAS_CFG)) ordem[k] = [...(local[k] || []), ...(remoto[k] || [])].map(LISTAS_CFG[k]);
  const cfg = { ...clone(local), ...montarCfg(out, ordem) };
  for (const k of Object.keys(cfg)) if (!FORA_DA_MESCLA_CFG.has(k) && !out.has(k) && !out.has(`${k}|`)) delete cfg[k];
  cfg.revisao = Math.max(+local.revisao || 0, +remoto.revisao || 0) + 1;
  return { cfg, conflitos };
}
function aplicarEscolhasCfg(cfg, conflitos, escolhas) {
  const m = unidadesCfg(cfg), ordem = {};
  conflitos.forEach((c, i) => m.set(c.p, clone(escolhas[i] === 'remoto' ? c.remoto : c.local)));
  for (const k of Object.keys(LISTAS_CFG)) ordem[k] = (cfg[k] || []).map(LISTAS_CFG[k]);
  return { ...clone(cfg), ...montarCfg(m, ordem) };
}
const ROTULO_CFG = { unidades: 'Unidade', prestadores: 'Prestador', faturistas: 'Faturista', convenios: 'Convênio', classificacao: 'Regra de classificação', descontos: 'Desconto', faixasUSG: 'Faixa de USG', modelosExportacao: 'Modelo de exportação', parametros: 'Parâmetro', fechamento: 'Fechamento', pastas: 'Pasta', classes: 'Classes A/B/C/D' };
function rotuloUnidadeCfg(local, remoto, p) {
  const i = p.indexOf('|'), k = i < 0 ? p : p.slice(0, i), sub = i < 0 ? '' : p.slice(i + 1);
  if (!sub) return ROTULO_CFG[k] || k;
  const x = (local?.[k] || remoto?.[k]);
  if (LISTAS_CFG[k] && Array.isArray(x)) { const it = [...(local?.[k] || []), ...(remoto?.[k] || [])].find(y => LISTAS_CFG[k](y) === sub); return `${ROTULO_CFG[k] || k} ${it?.cod ? it.cod + ' — ' : ''}${it?.nomeMV || it?.nome || sub}`; }
  return `${ROTULO_CFG[k] || k}: ${sub}`;
}
function resumoValorCfg(v) {
  if (v === undefined) return 'apagado';
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('nomeMV' in v) return `${v.nomeMV} · ${(v.aliases || []).filter(a => a.status === 'validado').length} alias(es) validado(s)${v.regras?.faixaUSG ? ` · faixa ${v.regras.faixaUSG}` : ''}${v.naoRealizaRepasse ? ' · não realiza repasse' : ''}`;
    if ('apolo' in v) return `${v.nome} · Apolo: ${(v.apolo || []).join(', ') || '—'}`;
  }
  const t = typeof v === 'string' ? v : JSON.stringify(v); return t.length > 140 ? t.slice(0, 137) + '…' : t;
}
