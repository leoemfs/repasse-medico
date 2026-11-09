/* ============================================================
 * SOL-F36 — Fluxo mensal compartilhado por arquivo numa pasta da rede.
 * Mescla de três vias (minha versão × versão da pasta × última versão sincronizada), por etapa:
 * o que só um mudou entra sozinho; a mesma etapa mudada pelos dois vira conflito para a pessoa escolher.
 * Só o Fluxo vai para a pasta: etapas, status, datas, anotações, controle documental e divisão das unidades.
 * ============================================================ */
const SCHEMA_FLUXO_SYNC = 'repasse-medico/fluxo-sync';
const SUBMAPAS_GRUPO = ['tarefas', 'documental', 'classificacao', 'matriz'];   // cada entrada é uma unidade da mescla
const MAPAS_COMP = ['marcosManuais', 'divisao'];
const LISTAS_COMP = ['anotacoes'];   // listas com id: une por id
const json = v => v === undefined ? undefined : JSON.stringify(v);

// Achata a competência em unidades da mescla: caminho → valor.
function unidadesFluxo(comp) {
  const m = new Map(); if (!comp) return m;
  for (const [k, v] of Object.entries(comp)) {
    if (k === 'grupos') {
      for (const [g, gv] of Object.entries(v || {})) for (const [sk, sv] of Object.entries(gv || {})) {
        if (SUBMAPAS_GRUPO.includes(sk) && sv && typeof sv === 'object' && !Array.isArray(sv)) { m.set(`grupos|${g}|${sk}|`, {}); for (const [ek, ev] of Object.entries(sv)) m.set(`grupos|${g}|${sk}|${ek}`, ev); }
        else m.set(`grupos|${g}|${sk}`, sv);
      }
    } else if (MAPAS_COMP.includes(k) && v && typeof v === 'object') { m.set(`${k}|`, {}); for (const [ek, ev] of Object.entries(v)) m.set(`${k}|${ek}`, ev); }
    else if (LISTAS_COMP.includes(k) && Array.isArray(v)) { m.set(`${k}|`, []); for (const it of v) m.set(`${k}|#${it.id}`, it); }
    else m.set(k, v);
  }
  return m;
}
// Remonta a competência a partir das unidades (a ordem das listas segue a data).
function montarFluxo(m) {
  const c = {};
  for (const [p, v] of [...m].sort((a, b) => a[0].split('|').length - b[0].split('|').length)) {
    if (v === undefined) continue;
    const ps = p.split('|');
    if (ps[0] === 'grupos') {
      const g = ((c.grupos ||= {})[ps[1]] ||= {});
      if (ps.length === 3) g[ps[2]] = clone(v);
      else if (ps[3] === '') g[ps[2]] = g[ps[2]] || {};
      else (g[ps[2]] ||= {})[ps[3]] = clone(v);
    } else if (MAPAS_COMP.includes(ps[0])) { if (ps[1] === '') c[ps[0]] = c[ps[0]] || {}; else (c[ps[0]] ||= {})[ps[1]] = clone(v); }
    else if (LISTAS_COMP.includes(ps[0])) { if (ps[1] === '') c[ps[0]] = c[ps[0]] || []; else (c[ps[0]] ||= []).push(clone(v)); }
    else c[p] = clone(v);
  }
  for (const k of LISTAS_COMP) if (c[k]) c[k].sort((a, b) => String(a.em || '').localeCompare(String(b.em || '')));
  return c;
}
// Nome legível de uma unidade da mescla (para o diálogo de conflito).
function rotuloUnidadeFluxo(comp, p) {
  const ps = p.split('|');
  if (ps[0] === 'grupos') {
    const g = comp?.modelo?.grupos?.find(x => x.id === ps[1]), gn = g?.nome || ps[1];
    if (ps[2] === 'tarefas') return `${gn}: ${g?.tarefas?.find(t => t.id === ps[3])?.nome || ps[3]}`;
    if (ps[2] === 'documental') return `${gn}: controle documental de ${ps[3]}`;
    if (ps[2] === 'classificacao') return `Classificação de ${ps[3]}`;
    return `${gn}: ${ps.slice(2).join(' ')}`;
  }
  if (ps[0] === 'divisao') { const [un, gr] = ps[1].split(':'); return `Divisão: unidade ${un} · ${GRUPOS_CONTROLE?.[gr] || gr}`; }
  if (ps[0] === 'anotacoes') return 'Anotação';
  if (ps[0] === 'marcosManuais') return `Marco ${ps[1]}`;
  return p;
}
// Resumo de um valor para o diálogo de conflito.
function resumoValorFluxo(v) {
  if (v === undefined) return 'apagado';
  if (v && typeof v === 'object') {
    if ('status' in v && STATUS_TAREFA?.[v.status]) return `${STATUS_TAREFA[v.status]}${v.obs ? ` · «${v.obs}»` : ''}${v.historico?.length ? ` (${v.historico.at(-1).por || '—'}, ${String(v.historico.at(-1).em || '').slice(11, 16)})` : ''}`;
    if ('relatorio' in v || 'nfRecebida' in v) return [v.relatorio && `e-mail ${v.relatorio}`, v.nfRecebida && `NF recebida ${v.nfRecebida}`, v.nfFinanceiro && `NF ao Financeiro ${v.nfFinanceiro}`, v.pendencia && `pendência «${v.pendencia}»`].filter(Boolean).join(' · ') || 'sem marcações';
    if ('status' in v && 'por' in v) return `${v.status} · ${v.por || '—'}`;
  }
  const t = typeof v === 'string' ? v : JSON.stringify(v); return t.length > 120 ? t.slice(0, 117) + '…' : t;
}

/* Mescla de três vias. local = minha versão; remoto = a da pasta; base = a última sincronizada (ou null).
 * Devolve {comp, conflitos:[{p, rotulo, local, remoto}]}; no conflito, comp fica com a versão local até a escolha. */
function mesclarFluxo(local, remoto, base) {
  if (!remoto) return { comp: clone(local), conflitos: [] };
  if (!local) return { comp: clone(remoto), conflitos: [] };
  const L = unidadesFluxo(local), R = unidadesFluxo(remoto), B = unidadesFluxo(base);
  const out = new Map(), conflitos = [];
  for (const p of new Set([...L.keys(), ...R.keys(), ...B.keys()])) {
    const l = L.get(p), r = R.get(p), b = B.get(p), jl = json(l), jr = json(r), jb = json(b);
    if (jl === jr) { out.set(p, l); continue; }
    if (jl === jb) { out.set(p, r); continue; }          // só a pasta mudou
    if (jr === jb) { out.set(p, l); continue; }          // só eu mudei
    if (!base) {
      // Primeira sincronização (sem base): nada vira conflito.
      if (l === undefined || r === undefined) { out.set(p, l ?? r); continue; }
      if (p.split('|')[2] === 'tarefas' && l && r) {   // etapa: fica a de mudança mais recente, com o histórico das duas
        const ul = l.historico?.at(-1)?.em || '', ur = r.historico?.at(-1)?.em || '', v = clone(ul > ur ? l : r), o = ul > ur ? r : l, vistos = new Set((v.historico || []).map(h => json(h)));
        for (const h of o.historico || []) if (!vistos.has(json(h))) (v.historico ||= []).push(h);
        (v.historico || []).sort((a, b) => String(a.em).localeCompare(String(b.em))); out.set(p, v); continue;
      }
      if (l && r && typeof l === 'object' && typeof r === 'object' && !Array.isArray(l)) {   // ex.: controle documental: junta o que estiver preenchido
        const v = { ...l }; for (const [k, x] of Object.entries(r)) if (x !== '' && x != null) v[k] = x; out.set(p, v); continue;
      }
      out.set(p, r); continue;   // demais: fica a da pasta
    }
    out.set(p, l); conflitos.push({ p, rotulo: rotuloUnidadeFluxo(local, p), local: l, remoto: r });
  }
  return { comp: montarFluxo(out), conflitos };
}
// Aplica as escolhas ('local' | 'remoto') dos conflitos. Nas etapas, a escolhida leva o histórico das duas.
function aplicarEscolhasFluxo(comp, conflitos, escolhas) {
  const m = unidadesFluxo(comp);
  conflitos.forEach((c, i) => {
    const v = clone(escolhas[i] === 'remoto' ? c.remoto : c.local), outro = escolhas[i] === 'remoto' ? c.local : c.remoto;
    if (v && Array.isArray(v.historico) && Array.isArray(outro?.historico)) {
      const vistos = new Set(v.historico.map(h => json(h)));
      for (const h of outro.historico) if (!vistos.has(json(h))) v.historico.push(h);
      v.historico.sort((a, b) => String(a.em).localeCompare(String(b.em)));
    }
    m.set(c.p, v);
  });
  return montarFluxo(m);
}

/* ---------- Divisão do trabalho (unidade × grupo) ---------- */
const chaveDivisao = (un, gr) => `${un}:${gr}`;
function marcarDivisao(comp, un, gr, status, operador, extra = {}) {
  comp.divisao = comp.divisao || {};
  const k = chaveDivisao(un, gr), a = comp.divisao[k] || {};
  comp.divisao[k] = { ...a, status, por: operador, em: agoraISO(), historico: [...(a.historico || []), { em: agoraISO(), por: operador, de: a.status || 'livre', para: status }].slice(-30), ...extra };
  return comp.divisao[k];
}
// Últimas mudanças: histórico das etapas, divisão das unidades e anotações.
function feedFluxo(comp, n = 12) {
  const it = [];
  for (const [g, gv] of Object.entries(comp?.grupos || {})) for (const [t, tv] of Object.entries(gv.tarefas || {})) for (const h of tv.historico || [])
    it.push({ em: h.em, por: h.por, texto: `marcou «${rotuloUnidadeFluxo(comp, `grupos|${g}|tarefas|${t}`)}» como ${STATUS_TAREFA[h.para] || h.para}${h.campo ? ` (${h.campo})` : ''}` });
  for (const [k, d] of Object.entries(comp?.divisao || {})) for (const h of d.historico || []) {
    const [un, gr] = k.split(':'), alvo = `unidade ${un} · ${gr === 'curitiba' ? 'Curitiba' : gr.toUpperCase()}`;
    it.push({ em: h.em, por: h.por, texto: h.para === 'assumida' ? `assumiu a ${alvo}` : h.para === 'concluida' ? `concluiu a ${alvo}` : h.para === 'livre' ? `liberou a ${alvo}` : `${h.para} · ${alvo}` });
  }
  for (const a of comp?.anotacoes || []) it.push({ em: a.em, por: a.por, texto: `anotou: «${String(a.texto).slice(0, 80)}»` });
  return it.filter(x => x.em).sort((a, b) => String(b.em).localeCompare(String(a.em))).slice(0, n);
}
