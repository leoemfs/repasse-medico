/* ============================================================
 * SOL-F18 (v3.0.0-alpha.30) — Não conformidades compartilhadas pela pasta da rede.
 * Um arquivo por competência, na pasta do mês: «AAAA-MM - Mês › 02 - Não conformidades › nao_conformidades.json»
 * (junto da planilha de NCs). Mescla de três vias, como Fluxo, Equivalências e Configuração:
 *   - NC pelo id (nasce num navegador e viaja pela pasta); dispensa de candidato pela chave do candidato;
 *   - mudou só de um lado → vale a mudança; mudou dos dois lados de jeito diferente → conflito, a pessoa escolhe;
 *   - apagada de um lado e intacta do outro → sai; apagada de um lado e alterada do outro → conflito;
 *   - sem «última versão sincronizada» (primeira vez): junta tudo; mesma NC com histórico que só cresceu → a mais longa;
 *   - a mesma NC registrada pelos dois ao mesmo tempo (ids diferentes, mesma chave) → fica a mais antiga, com o
 *     histórico das duas.
 * Os candidatos a NC continuam só no navegador (são refeitos a cada conferência).
 * ============================================================ */
const SCHEMA_NC_SYNC = 'repasse-medico/nao-conformidades-sync';
const ARQ_NC_SYNC = 'nao_conformidades.json';
// Parte da base de NCs que vai para a pasta: só a competência.
const partesNCSync = (nc, chave) => ({ itens: (nc?.itens || []).filter(x => x.competencia === chave), dispensados: (nc?.dispensados || []).filter(d => d.competencia === chave) });
function unidadesNC(p) {
  const m = new Map(); if (!p) return m;
  for (const x of p.itens || []) m.set('nc|' + x.id, x);
  for (const d of p.dispensados || []) m.set('disp|' + d.chave, d);
  return m;
}
const historicoContido = (curto, longo) => { const a = curto?.historico || [], b = longo?.historico || []; return a.length <= b.length && a.every((h, i) => JSON.stringify(h) === JSON.stringify(b[i])); };
function juntarHistoricoNC(v, outro) {
  if (!v || !Array.isArray(outro?.historico)) return v;
  const r = clone(v), vistos = new Set((r.historico || []).map(h => JSON.stringify(h)));
  for (const h of outro.historico) if (!vistos.has(JSON.stringify(h))) (r.historico ||= []).push(h);
  (r.historico || []).sort((a, b) => String(a.em).localeCompare(String(b.em)));
  return r;
}
/* local × remoto × base (partes da competência). Devolve {partes:{itens, dispensados}, conflitos:[{p, rotulo, local, remoto}]}. */
function mesclarNC(local, remoto, base) {
  if (!remoto) return { partes: clone(local), conflitos: [] };
  const L = unidadesNC(local), R = unidadesNC(remoto), B = unidadesNC(base), out = new Map(), conflitos = [];
  for (const p of new Set([...L.keys(), ...R.keys(), ...B.keys()])) {
    const l = L.get(p), r = R.get(p), b = B.get(p), jl = JSON.stringify(l), jr = JSON.stringify(r), jb = JSON.stringify(b);
    if (jl === jr) { out.set(p, l); continue; }
    if (base) {
      if (jl === jb) { out.set(p, r); continue; }   // só o outro mudou (ou apagou)
      if (jr === jb) { out.set(p, l); continue; }   // só eu mudei (ou apaguei)
    } else {
      if (!l || !r) { out.set(p, l || r); continue; }   // primeira vez: o que só um tem entra
      if (historicoContido(l, r)) { out.set(p, r); continue; }
      if (historicoContido(r, l)) { out.set(p, l); continue; }
    }
    if (p.startsWith('disp|')) { out.set(p, l || r); continue; }   // dispensa: tanto faz quem (a lista só esconde o candidato)
    out.set(p, l);
    const x = l || r;
    conflitos.push({ p, rotulo: `${x.paciente || '(paciente apagado pela retenção)'} · ${NATUREZA_NC[x.natureza]?.nome || x.natureza} · ${x.titulo || x.tituloEstudo || x.codigo || ''}`.trim(), local: l, remoto: r });
  }
  const itens = dedupNC([...out].filter(([p, v]) => p.startsWith('nc|') && v).map(([, v]) => clone(v)), B);
  const dispensados = [...out].filter(([p, v]) => p.startsWith('disp|') && v).map(([, v]) => clone(v));
  return { partes: { itens, dispensados }, conflitos };
}
// A mesma NC registrada nos dois navegadores antes de sincronizar (ids diferentes, mesma chave): fica a mais antiga.
function dedupNC(itens, B) {
  const porChave = new Map(), fora = new Set();
  for (const x of itens) {
    if (B.has('nc|' + x.id)) continue;   // já existia na última sincronização: não é duplicata nova
    const k = `${x.competencia}#${chaveNC(x)}`, y = porChave.get(k);
    if (!y) { porChave.set(k, x); continue; }
    const [fica, sai] = String(x.criadaEm) < String(y.criadaEm) ? [x, y] : [y, x];
    Object.assign(fica, juntarHistoricoNC(fica, sai)); fora.add(sai.id); porChave.set(k, fica);
  }
  return itens.filter(x => !fora.has(x.id));
}
function aplicarEscolhasNC(partes, conflitos, escolhas) {
  const r = clone(partes);
  conflitos.forEach((c, i) => {
    const v = escolhas[i] === 'remoto' ? juntarHistoricoNC(c.remoto, c.local) : juntarHistoricoNC(c.local, c.remoto), id = c.p.slice(3);
    const idx = r.itens.findIndex(x => x.id === id);
    if (idx >= 0) { if (v) r.itens[idx] = v; else r.itens.splice(idx, 1); } else if (v) r.itens.push(v);
  });
  return r;
}
// Põe as partes mescladas da competência de volta na base inteira (as outras competências não mudam).
function aplicarPartesNC(nc, chave, partes) {
  nc.itens = [...(nc.itens || []).filter(x => x.competencia !== chave), ...partes.itens];
  nc.dispensados = [...(nc.dispensados || []).filter(d => d.competencia !== chave), ...partes.dispensados];
  return nc;
}
function resumoValorNC(v) {
  if (!v) return 'apagada';
  const h = v.historico?.at(-1);
  return `${SITUACAO_NC[v.situacao] || v.situacao}${v.responsavel ? ` · ${v.responsavel}` : ''}${v.detalhe ? ` · «${v.detalhe}»` : ''}${h?.em ? ` · ${String(h.em).slice(0, 16).replace('T', ' ')}${h.por ? ` (${h.por})` : ''}` : ''}`;
}
