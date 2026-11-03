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

/* ---------- Atualizar a base de dados com o Power BI (SOL-F21) ----------
 * Só catálogos, sem dados de pacientes: faturistas (com as unidades em que fecharam contas),
 * convênios (com o tipo do Power BI; o tipo marcado à mão nunca é trocado) e procedimentos (TUSS). */
function previaAtualizacaoPowerBI(cfg, eq, pbi) {
  const fat = (pbi.faturistas || []).map(([n]) => n).filter(n => !cfg.faturistas.some(f => norm(f.nome) === norm(n)));
  const conv = (pbi.convenios || []).filter(([n]) => !(cfg.convenios || []).some(c => norm(c.nome) === norm(n)));
  const tipar = (pbi.convenios || []).filter(([n, t]) => t && (cfg.convenios || []).some(c => norm(c.nome) === norm(n) && !c.tipo));
  const tussBase = new Set((eq.catalogoTUSS || []).map(t => String(t.codigo)));
  const tuss = (pbi.procedimentos || []).filter(p => p.codigo && !tussBase.has(String(p.codigo)));
  return { faturistas: fat, convenios: conv, tipar, tuss };
}
function aplicarAtualizacaoPowerBI(cfg, eq, pbi, escolhas = { faturistas: true, convenios: true, tuss: true }) {
  const r = { faturistas: 0, unidadesFaturistas: 0, convenios: 0, tipados: 0, tuss: 0 };
  if (escolhas.faturistas) {
    r.faturistas = registrarFaturistas(cfg, (pbi.faturistas || []).map(([n]) => n), `Power BI ${pbi.nome}`);
    for (const f of cfg.faturistas) { const m = pbi.unidadesDoFaturista?.[f.nome]; if (m && !f.unidades && !f.generico) { f.unidades = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([c]) => c).join(', '); r.unidadesFaturistas++; } }
  }
  if (escolhas.convenios) { const x = registrarConvenios(cfg, pbi.convenios || [], `Power BI ${pbi.nome}`); r.convenios = x.novos; r.tipados = x.tipados; }
  if (escolhas.tuss) {
    eq.catalogoTUSS = eq.catalogoTUSS || [];
    const tem = new Set(eq.catalogoTUSS.map(t => String(t.codigo)));
    for (const p of pbi.procedimentos || []) if (p.codigo && !tem.has(String(p.codigo))) { eq.catalogoTUSS.push({ codigo: String(p.codigo), desc: p.desc, grupo: p.grupo, origem: 'Power BI' }); tem.add(String(p.codigo)); r.tuss++; }
  }
  return r;
}
