/* ============================================================
 * Equivalências em planilha (.xlsx), linha a linha, e a leitura em português de cada regra composta.
 * Abas: Leia-me · Relações (1 linha por código × título) · Regras compostas (1 linha por regra, com a leitura)
 * · Itens das regras (1 linha por procedimento esperado) · Títulos das regras (1 linha por título reconhecido).
 * ============================================================ */
// «O laudo «X» espera na conta: 1× 40901300 (USG transvaginal) e 1× 40901386 (Doppler). Na UNIMED, o Doppler não é exigido.»
function leituraRegraComposta(c0, descDe = () => '', curta = false) {
  const c = regraComposta(c0), qt = n => `${n}×`;
  const reconhece = c.titulos.length ? `Laudo com o título ${c.titulos.map(t => `«${t}»`).join(' ou ')}` : 'Laudo';
  const pal = c.palavras && ((c.palavras.todas || []).length || (c.palavras.umaDe || []).length) ? `${c.titulos.length ? ' ou com' : ' com'} título que contém ${(c.palavras.todas || []).join(' e ')}${(c.palavras.umaDe || []).length ? `${(c.palavras.todas || []).length ? ' e ' : ''}uma destas palavras: ${c.palavras.umaDe.join(', ')}` : ''}` : '';
  const itens = c.itens.map(it => `${qt(it.qtd)} ${it.codigos.map(cd => `${cd}${descDe(cd) ? ` (${descDe(cd)})` : ''}`).join(' ou ')}${it.rotulo && !it.codigos.some(cd => descDe(cd)) ? ` [${it.rotulo}]` : ''}`);
  const esp = itens.length === 1 && c.itens[0].codigos.length > 1 ? `uma linha com qualquer um destes códigos: ${itens[0].replace(/^1× /, '')}` : itens.join(' e ');
  const exc = c.itens.flatMap(it => (it.excecoes || []).map(e => `No convênio ${e.convenio}, ${it.rotulo || it.codigos[0]} ${e.tipo === 'nao-exigido' ? 'não é exigido (se vier na conta, sobra)' : `é esperado ${qt(e.qtd)}`}.`));
  const unid = c.escopo?.unidade && c.escopo.unidade !== '*' ? ` Vale só na unidade ${c.escopo.unidade}.` : '';
  const me = (c.titulosMesmoEstudo || []).length ? ` Laudos do mesmo estudo (mesmo paciente e dia, não cobram outra linha): ${c.titulosMesmoEstudo.map(t => `«${t}»`).join(', ')}.` : '';
  if (curta) return `Espera na conta: ${esp}.${exc.length ? ' ' + exc.join(' ') : ''}${(c.titulosMesmoEstudo || []).length ? ' Laudos do mesmo estudo não cobram outra linha.' : ''}`;
  return `${reconhece}${pal} espera na conta: ${esp}.${exc.length ? ' ' + exc.join(' ') : ''}${unid}${me}`;
}
function xlsxEquivalencias(eq, { usoTitulo = new Map(), operador = '' } = {}) {
  const desc = new Map(); for (const t of eq.catalogoTUSS || []) desc.set(String(t.codigo), t.desc || t.descricao || '');
  for (const e of eq.itens || []) if (e.descMV && !desc.has(e.codigo)) desc.set(e.codigo, e.descMV);
  const descDe = cd => desc.get(String(cd)) || '';
  const regras = (eq.compostas || []).map(regraComposta), nomeR = id => { const r = regras.find(x => x.id === id); return r ? nomeComposta(r) : ''; };
  const dt = s => s ? String(s).slice(0, 10).split('-').reverse().join('/') : '';
  const ST = { validada: 'C6EFCE', pendente: 'FFEB9C', desativada: 'D9D9D9', coberta: 'DDEBF7' };
  const rel = [cabecalho(['Status', 'Código TUSS (MV)', 'Descrição no MV', 'TITLE do laudo (Apolo)', 'Laudos no Apolo carregado', 'Unidade', 'Modalidade', 'Responsável', 'Validada em', 'Confiança da análise', 'Ambígua', 'Coberta pela regra composta', 'Justificativa / análise', 'Última mudança'])];
  for (const e of [...(eq.itens || [])].sort((a, b) => a.titulo.localeCompare(b.titulo) || a.codigo.localeCompare(b.codigo))) {
    const h = (e.historico || []).at(-1);
    rel.push([{ v: STATUS_EQ[e.status] || e.status, st: { fill: ST[e.status] || 'FFFFFF', b: true } }, { v: e.codigo, st: { fmt: 'text' } }, e.descMV || descDe(e.codigo), e.titulo, usoTitulo.get(chaveTitulo(e.titulo)) || '', e.escopo?.unidade === '*' ? 'todas' : e.escopo?.unidade || '', e.escopo?.modalidade === '*' ? 'todas' : e.escopo?.modalidade || '',
      e.responsavel || '', dt(e.validadoEm), e.confianca || '', e.ambiguo ? 'sim' : '', e.cobertaPor ? nomeR(e.cobertaPor) : '', { v: [e.justificativa, e.atencao].filter(Boolean).join(' | '), st: { wrap: true } }, h ? `${dt(h.em)} · ${h.por || '—'}: ${STATUS_EQ[h.de] || h.de} → ${STATUS_EQ[h.para] || h.para}${h.motivo ? ` (${h.motivo})` : ''}` : '']);
  }
  const R = [cabecalho(['Regra', 'Status', 'Como a regra funciona (leitura)', 'Títulos do Apolo', 'Palavras do título', 'Laudos do mesmo estudo', 'Unidade', 'Responsável', 'Validada em', 'Justificativa'])];
  const I = [cabecalho(['Regra', 'Status', 'Item', 'Nome curto', 'Código(s) TUSS aceitos', 'Descrição no MV', 'Quantidade esperada', 'Exceção: convênio', 'Exceção: o que muda', 'Exceção: quantidade'])];
  const T = [cabecalho(['TITLE do laudo (Apolo)', 'Laudos no Apolo carregado', 'Reconhecido por', 'Regra', 'Status da regra', 'Espera na conta'])];
  for (const r of regras) {
    const st = { v: STATUS_EQ[r.status] || r.status, st: { fill: ST[r.status] || 'FFFFFF', b: true } }, nome = nomeComposta(r);
    R.push([{ v: nome, st: { b: true } }, st, { v: leituraRegraComposta(r, descDe), st: { wrap: true } }, { v: r.titulos.join('\n'), st: { wrap: true } },
      r.palavras ? [(r.palavras.todas || []).length ? `contém: ${r.palavras.todas.join(', ')}` : '', (r.palavras.umaDe || []).length ? `e uma de: ${r.palavras.umaDe.join(', ')}` : ''].filter(Boolean).join(' ') : '',
      { v: (r.titulosMesmoEstudo || []).join('\n'), st: { wrap: true } }, r.escopo?.unidade && r.escopo.unidade !== '*' ? r.escopo.unidade : 'todas', r.responsavel || '', dt(r.validadoEm), r.justificativa || '']);
    r.itens.forEach((it, k) => {
      const ex = it.excecoes || [];
      const base = [nome, st, k + 1, it.rotulo || '', { v: it.codigos.join(' ou '), st: { fmt: 'text' } }, { v: it.codigos.map(descDe).filter(Boolean).join(' / '), st: { wrap: true } }, it.qtd];
      if (!ex.length) I.push([...base, '', '', '']);
      for (const e of ex) I.push([...base, e.convenio, e.tipo === 'nao-exigido' ? 'não exigido' : 'quantidade diferente', e.tipo === 'nao-exigido' ? 0 : e.qtd]);
    });
    const espera = r.itens.map(it => `${it.qtd}× ${it.codigos.join(' ou ')}`).join(' + ');
    for (const t of r.titulos) T.push([t, usoTitulo.get(chaveTitulo(t)) || '', 'título da lista', nome, st, espera]);
    for (const t of r.titulosMesmoEstudo || []) T.push([t, usoTitulo.get(chaveTitulo(t)) || '', 'laudo do mesmo estudo', nome, st, 'nada a mais (mesmo exame)']);
    if (r.palavras && ((r.palavras.todas || []).length || (r.palavras.umaDe || []).length)) T.push([`(palavras) contém ${(r.palavras.todas || []).join(' e ')}${(r.palavras.umaDe || []).length ? ` e uma de ${r.palavras.umaDe.join(', ')}` : ''}`, '', 'palavras do título', nome, st, espera]);
  }
  const L = [cabecalho(['Aba', 'O que mostra']), ...[
    ['Relações', 'Uma linha por relação código TUSS do MV × TITLE do laudo do Apolo. Só «Validada» confirma automaticamente na conferência. «Coberta por regra composta» = a relação está resolvida por uma regra composta validada.'],
    ['Regras compostas', 'Uma linha por regra. A coluna «Como a regra funciona» diz, em português, o que o laudo espera encontrar na conta do MV, as exceções por convênio e os laudos do mesmo estudo.'],
    ['Itens das regras', 'Uma linha por procedimento que a regra espera na conta (e uma por exceção de convênio). «Código(s) aceitos» com «ou» = qualquer um deles vale. Quantidade 2 = o código precisa vir duas vezes.'],
    ['Títulos das regras', 'Uma linha por título do Apolo que aciona uma regra (título da lista, palavras do título ou laudo do mesmo estudo).'],
    ['Como ler uma regra composta', 'Uma regra composta diz: quando o laudo tem este título, a conta do MV deve ter estes procedimentos. Ex.: «USG transvaginal com Doppler» = 1× transvaginal + 1× Doppler. «Um ou outro» é uma regra com um item só e vários códigos: qualquer um confirma o laudo. Exceção por convênio muda a quantidade (ex.: UNIMED ×1) ou dispensa o item (não exigido).'],
    ['Gerado em', `${new Date().toLocaleString('pt-BR')}${operador ? ` · ${operador}` : ''} · base revisão ${eq.revisao || ''} · ${(eq.itens || []).length} relações · ${regras.length} regras compostas`]
  ].map(([a, b]) => [{ v: a, st: { b: true } }, { v: b, st: { wrap: true } }])];
  return criarXlsx([
    { nome: 'Leia-me', larguras: [28, 120], linhas: L, filtro: false, congelar: false },
    { nome: 'Relações', larguras: [16, 12, 44, 50, 10, 9, 10, 20, 11, 12, 8, 30, 60, 60], linhas: rel, filtro: true },
    { nome: 'Regras compostas', larguras: [34, 12, 90, 50, 30, 40, 9, 20, 11, 40], linhas: R, filtro: R.length > 1 },
    { nome: 'Itens das regras', larguras: [34, 12, 6, 22, 24, 50, 10, 22, 20, 10], linhas: I, filtro: I.length > 1 },
    { nome: 'Títulos das regras', larguras: [56, 10, 22, 34, 12, 34], linhas: T, filtro: T.length > 1 }
  ]);
}

// Modo da regra composta: «juntos» (a conta tem cada item) ou «ou» (um item só, com códigos alternativos).
const modoComposta = c0 => { const c = regraComposta(c0); return c.itens.length === 1 && c.itens[0].codigos.length > 1 && (+c.itens[0].qtd || 1) === 1 ? 'ou' : 'juntos'; };
function itensNoModo(c0, modo) {
  const c = regraComposta(c0), cods = [...new Set(c.itens.flatMap(it => it.codigos))];
  if (modo === 'ou') return [{ rotulo: 'um dos códigos', codigos: cods, qtd: 1, excecoes: [] }];
  return cods.map(cd => ({ rotulo: '', codigos: [cd], qtd: 1, excecoes: [] }));
}
