/* ============================================================
 * Base de dados de referência (SOL-F29): catálogos usados pelos campos de busca do sistema.
 * Junta o que está cadastrado (Bases, equivalências) com o que veio dos arquivos da sessão
 * (MV, Apolo, Power BI), sem dados de pacientes. Cada item: {cod, nome, info, origem}.
 * ============================================================ */
const FONTES_CATALOGO = { prestador: 'Prestadores', convenio: 'Convênios', faturista: 'Faturistas', tuss: 'Procedimentos (TUSS)', unidade: 'Unidades', titulo: 'Títulos do Apolo' };

function resumoPrestador(p) {
  const r = p.regras || {}, partes = [];
  if (r.faixaUSG) partes.push('USG'); if (r.participaIMG && !r.v3) partes.push('IMG'); if (r.v3) partes.push('V3');
  return partes.join(' · ');
}
// ctx: { apolo, pbi, relatorios, eq }
function catalogo(fonte, cfg, ctx = {}) {
  const vistos = new Set(), out = [];
  const add = (item, chave) => { const k = chave ?? `${item.cod}|${norm(item.nome)}`; if (vistos.has(k)) return; vistos.add(k); out.push(item); };
  switch (fonte) {
    case 'prestador': {
      for (const p of cfg.prestadores) add({ cod: String(p.cod), nome: p.nomeMV, info: resumoPrestador(p), origem: 'cadastro' }, 'c' + p.cod);
      // Médicos do Apolo sem vínculo com código: aparecem para não precisar digitar o nome.
      const ligados = new Set(cfg.prestadores.flatMap(p => [norm(p.nomeMV), ...(p.aliases || []).map(a => norm(a.nome))]));
      if (ctx.apolo) for (const m of new Set(ctx.apolo.laudos.map(l => l.medico).filter(Boolean))) if (!ligados.has(norm(m))) add({ cod: '', nome: m, info: 'médico do Apolo, sem código', origem: 'apolo' }, 'a' + norm(m));
      if (ctx.pbi) for (const [c] of ctx.pbi.prestadores) if (c && !cfg.prestadores.some(p => String(p.cod) === String(c))) add({ cod: String(c), nome: '', info: 'código no Power BI, sem nome', origem: 'pbi' }, 'c' + c);
      break;
    }
    case 'convenio':
      for (const c of cfg.convenios || []) add({ cod: '', nome: c.nome, info: TIPOS_CONVENIO[c.tipo] || 'sem tipo', origem: 'cadastro' }, norm(c.nome));
      for (const x of ctx.relatorios || []) for (const r of x.rel.regs) if (r.convenio) add({ cod: '', nome: r.convenio, info: 'relatório do MV, sem cadastro', origem: 'mv' }, norm(r.convenio));
      if (ctx.pbi) for (const [n, t] of ctx.pbi.convenios || []) add({ cod: '', nome: n, info: `Power BI · ${TIPOS_CONVENIO[t] || ''}`, origem: 'pbi' }, norm(n));
      break;
    case 'faturista':
      for (const f of cfg.faturistas || []) if (f.ativo !== false) add({ cod: '', nome: f.nome, info: f.generico ? 'genérico' : (f.unidades ? `un. ${f.unidades}` : ''), origem: 'cadastro' }, norm(f.nome));
      if (ctx.pbi?.temFaturista) for (const [n] of ctx.pbi.faturistas) add({ cod: '', nome: n, info: 'Power BI, sem cadastro', origem: 'pbi' }, norm(n));
      break;
    case 'tuss': {
      const porCod = new Map();
      const pega = (codigo, desc, grupo, origem) => { if (!codigo) return; const e = porCod.get(codigo); if (!e) porCod.set(codigo, { cod: String(codigo), nome: desc || '', info: grupo || '', origem }); else { if (!e.nome && desc) e.nome = desc; if (!e.info && grupo) e.info = grupo; } };
      for (const t of ctx.eq?.catalogoTUSS || []) pega(t.codigo, t.desc, t.grupo, 'equivalências');
      for (const e of ctx.eq?.itens || []) pega(e.codigo, e.descMV, '', 'equivalências');
      for (const x of ctx.relatorios || []) for (const r of x.rel.regs) pega(r.codigo, r.procDesc, r.grupoNome, 'mv');
      for (const p of ctx.pbi?.procedimentos || []) pega(p.codigo, p.desc, p.grupo, 'pbi');
      for (const e of porCod.values()) add(e, e.cod);
      break;
    }
    case 'unidade':
      for (const u of cfg.unidades) add({ cod: String(u.cod), nome: u.nome, info: [...(u.apolo || [])].join(' · '), origem: 'cadastro' }, 'u' + u.cod);
      break;
    case 'titulo': {
      const n = new Map();
      for (const t of ctx.eq?.catalogoTitulos || []) n.set(chaveTitulo(t.titulo), { cod: '', nome: t.titulo, info: 'catálogo', origem: 'equivalências' });
      if (ctx.apolo) for (const [t, q] of contar(ctx.apolo.laudos, l => l.titulo)) if (t) n.set(chaveTitulo(t), { cod: '', nome: t, info: `${q} laudo(s) no Apolo`, origem: 'apolo' });
      for (const e of n.values()) add(e, norm(e.nome));
      break;
    }
  }
  return out;
}
// Busca por código (começo) ou por palavras do nome (todas presentes, em qualquer ordem).
function buscarCatalogo(lista, termo, limite = 8) {
  const t = norm(termo), palavras = t.split(' ').filter(Boolean);
  if (!palavras.length) return lista.slice(0, limite);
  const pontos = it => {
    const c = norm(it.cod), n = norm(it.nome);
    if (c && c === t) return 0;
    if (c && c.startsWith(t)) return 1;
    if (n.startsWith(t)) return 2;
    if (palavras.every(p => n.includes(p))) return 3;
    if (palavras.every(p => `${n} ${norm(it.info)}`.includes(p))) return 4;
    return -1;
  };
  return lista.map(it => [pontos(it), it]).filter(([p]) => p >= 0).sort((a, b) => a[0] - b[0] || a[1].nome.localeCompare(b[1].nome)).slice(0, limite).map(([, it]) => it);
}
