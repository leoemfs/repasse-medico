/* ============================================================
 * SOL-F40 — Conferência por causa: o que falta decidir, agrupado pela decisão que resolve as linhas.
 * Uma validação de título × código resolve dezenas de linhas de uma vez; o resto é linha a linha.
 * ============================================================ */
const CAUSAS = {
  'eq-pendente': { acao: 'Validar a equivalência (ou marcar que não é equivalente)', titulo: c => `Equivalência não validada: «${c.titulo}» × ${c.codigo} ${c.desc}` },
  'eq-sem-cadastro': { acao: 'Cadastrar e validar a equivalência (ou deixar sem)', titulo: c => `Sem equivalência cadastrada: «${c.titulo}» × ${c.codigo} ${c.desc}` },
  'eq-divergente': { acao: 'Um ou outro (os dois códigos valem) ou lançamento errado → NC', titulo: c => c.outros.length ? `Título validado para outro código: «${c.titulo}» está validado para ${c.outros.join(', ')}, e o MV lançou ${c.codigo} ${c.desc}` : `Código validado para outros títulos: ${c.codigo} ${c.desc} × «${c.titulo}»` },
  'eq-conflito': { acao: 'Resolver o conflito em Equivalências (um ou outro, juntos ou só um código)', titulo: c => `Título em conflito: «${c.titulo}» está validado para mais de um código` },
  convenio: { acao: 'Aceitar se for o mesmo convênio escrito de outro jeito', titulo: c => `Convênio diferente: MV «${c.mv}» × laudo «${c.laudo}»` },
  data: { acao: 'Aceitar se a data estiver dentro do esperado', titulo: () => 'Data do laudo diferente da data do MV (dentro da tolerância)' },
  'composta-falta': { acao: 'Conferir a composição; registrar NC do que falta', titulo: c => `Composição incompleta: ${c.nome}` },
  'so-laudo': { acao: 'Revisar os candidatos a NC (laudo sem lançamento)', titulo: () => 'Laudos sem lançamento neste relatório (Só no laudo)' },
  hm: { acao: 'Cadastrar a regra de HM em Bases', titulo: () => 'Itens HM — regra pendente' },
  classificacao: { acao: 'Cadastrar a regra de classificação do item', titulo: () => 'Itens com classificação pendente' },
  repetida: { acao: 'Decidir qual lançamento vale; o outro vira NC (ou as duas estão certas)', titulo: () => 'Linha repetida no MV' },
  'nome-semelhante': { acao: 'Confirmar se é o mesmo paciente', titulo: () => 'Nome apenas semelhante' },
  ambiguo: { acao: 'Escolher o laudo certo (ou considerar no repasse)', titulo: () => 'Mais de um laudo plausível' },
  'outro-medico': { acao: 'Confirmar o médico (correção de prestador ou NC)', titulo: () => 'Laudo assinado por outro médico' },
  'so-faturamento': { acao: 'Registrar NC ou considerar no repasse', titulo: () => 'Só no faturamento: linha sem laudo' },
  outro: { acao: 'Revisar a linha', titulo: () => 'Revisar' }
};
const LINHA_A_LINHA = new Set(['repetida', 'nome-semelhante', 'ambiguo', 'outro-medico', 'so-faturamento', 'outro']);
// Devolve {grupos:[{k, tipo, titulo, acao, linhas:[índices], ...}], umaUma:[...], conferidas, total, faltam}.
function causasDaConferencia(res, compostas = []) {
  const g = new Map(), uma = [];
  const add = (k, base, i) => { const c = g.get(k) || g.set(k, { k, ...base, linhas: [] }).get(k); c.linhas.push(i); };
  const nomeCp = id => { const c = compostas.find(x => x.id === id); return c ? nomeComposta(c) : 'regra composta'; };
  res.linhas.forEach((x, i) => {
    if (x.decisao || x.status === 'conferido' || x.status === 'nao-procedimental') return;
    const m = x.marcadores, p = x.par, r = x.r, l = x.l, base = r && l ? { codigo: r.codigo, desc: r.procDesc || '', titulo: l.titulo } : {};
    if (x.status === 'so-laudo') return add('so-laudo', { tipo: 'so-laudo' }, i);
    if (x.status === 'hm-pendente') return add('hm', { tipo: 'hm' }, i);
    if (x.status === 'classificacao-pendente') return add('classificacao', { tipo: 'classificacao' }, i);
    if (x.status === 'so-faturamento') return uma.push({ k: 'sf|' + i, tipo: 'so-faturamento', linhas: [i] });
    if (p && m.has('eq-pendente')) return add(`eq|${r.codigo}|${chaveTitulo(l.titulo)}`, { tipo: 'eq-pendente', ...base, ambigua: !!p.proc.relacao?.ambiguo, relacaoId: p.proc.relacao?.id || '' }, i);
    if (p && m.has('eq-sem-cadastro')) return add(`eqn|${r.codigo}|${chaveTitulo(l.titulo)}`, { tipo: 'eq-sem-cadastro', ...base }, i);
    if (p && m.has('eq-divergente')) return add(`div|${r.codigo}|${chaveTitulo(l.titulo)}`, { tipo: 'eq-divergente', ...base, outros: p.proc.outrosCodigos || [] }, i);
    if (p && m.has('eq-conflito')) return add(`conf|${chaveTitulo(l.titulo)}`, { tipo: 'eq-conflito', ...base }, i);
    if (m.has('linha-repetida')) return uma.push({ k: 'rep|' + i, tipo: 'repetida', linhas: [i] });
    if (m.has('ambiguo')) return uma.push({ k: 'amb|' + i, tipo: 'ambiguo', linhas: [i] });
    if (m.has('outro-medico')) return uma.push({ k: 'med|' + i, tipo: 'outro-medico', linhas: [i] });
    if (m.has('nome-semelhante')) return uma.push({ k: 'nome|' + i, tipo: 'nome-semelhante', linhas: [i] });
    if (m.has('composta-falta')) return add(`cmp|${x.composta}`, { tipo: 'composta-falta', nome: nomeCp(x.composta) }, i);
    if (m.has('convenio-divergente') && r && l) return add(`conv|${norm(r.convenio)}|${norm(l.convenio)}`, { tipo: 'convenio', mv: r.convenio, laudo: l.convenio }, i);
    if (m.has('data-divergente')) return add('data', { tipo: 'data' }, i);
    uma.push({ k: 'out|' + i, tipo: 'outro', linhas: [i] });
  });
  const fim = c => ({ ...c, rotulo: CAUSAS[c.tipo].titulo(c), acao: CAUSAS[c.tipo].acao, vl: r2(c.linhas.reduce((s, i) => s + (+res.linhas[i].r?.vlRepasse || 0), 0)) });
  // Primeiro o que resolve mais linhas; «Só no laudo» por último entre os grupos (vai para as NCs).
  const grupos = [...g.values()].map(fim).sort((a, b) => (a.tipo === 'so-laudo') - (b.tipo === 'so-laudo') || b.linhas.length - a.linhas.length);
  const umaUma = uma.map(fim);
  const mv = res.linhas.filter(x => x.r), conferidas = mv.filter(x => x.status === 'conferido' || x.status === 'nao-procedimental' || x.decisao).length;
  const porLinha = new Map();
  [...grupos, ...umaUma].forEach((c, n) => { for (const i of c.linhas) porLinha.set(i, `${c.rotulo.split(':')[0]} (decisão ${n + 1})`); });
  return { grupos, umaUma, porLinha, conferidas, totalMV: mv.length, faltam: grupos.length + umaUma.length, ressalvasDecididas: res.linhas.filter(x => x.decisao).length };
}
