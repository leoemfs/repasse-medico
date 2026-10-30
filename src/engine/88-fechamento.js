/* ============================================================
 * Fechamento do repasse (SOL-F7)
 * - Valor de cada prestador × unidade = total do relatório do MV da ÚLTIMA rodada de
 *   conferência COM ACEITE na competência. Sem aceite: o valor aparece como prévia.
 * - A ferramenta soma e confere; não recalcula repasse. Percentual de USG e valor por laudo
 *   do IMG viram avisos quando não batem com as regras de Bases.
 * - Situação: Verificar (rodada sem aceite) · Sem valores (sem relatório) · Conferido (com
 *   aceite, a enviar) · E-mail enviado (relatório enviado no Fluxo) · Concluído (NF ao Financeiro).
 * ============================================================ */
const SITUACAO_FECH = {
  verificar: { nome: 'Verificar', cor: 'FF0000', fc: 'FFFFFF' },
  sem: { nome: 'Sem valores', cor: 'FFC000', fc: '000000' },
  conferido: { nome: 'Conferido · a enviar', cor: 'D9D9D9', fc: '000000' },
  enviado: { nome: 'E-mail enviado / aguardando nota', cor: '00B0F0', fc: '000000' },
  concluido: { nome: 'Concluído', cor: '00B050', fc: 'FFFFFF' }
};
const fechamentoVazio = () => ({ ajustes: { usg: {}, img: {} }, blocos: { complementar: [], cetrus: [] }, valorPeriodoCetrus: 1000, obs: { usg: '', img: '' } });

// USG ou IMG: pela descrição do repasse; sem descrição, pelos grupos das linhas.
function tipoRepasseDaRodada(r) {
  const t = norm(`${r.descricao || ''} ${r.repasse || ''}`);
  if (/USG|ULTRASS/.test(t)) return 'usg';
  if (/\bIMG\b|IMAGEM|RAIO|TOMO|RESSON|MAMO|DENSIT/.test(t)) return 'img';
  const us = r.linhas.filter(l => /ULTRASS/.test(norm(l.grupo || ''))).length;
  return us > r.linhas.length / 2 ? 'usg' : 'img';
}

// Última rodada de conferência por prestador × unidade × tipo, e a última com aceite.
function rodadasDoFechamento(rodadas, chave) {
  const m = new Map();
  for (const r of rodadas) {
    if (r.tipo !== 'conferencia' || competenciaDaRodada(r) !== chave || !r.unidadeCod || r.unidadeCod === '*') continue;
    const tipo = tipoRepasseDaRodada(r), k = `${tipo}|${r.prestadorCod}|${r.unidadeCod}`;
    const e = m.get(k) || { tipo, prestadorCod: String(r.prestadorCod), prestadorNome: r.prestadorNome, unidadeCod: String(r.unidadeCod), ultima: null, aceita: null };
    if (!e.ultima || r.em > e.ultima.em) e.ultima = r;
    if (r.aceite && (!e.aceita || r.em > e.aceita.em)) e.aceita = r;
    m.set(k, e);
  }
  return [...m.values()];
}
const somaLinhas = (r, campo) => r2(r.linhas.reduce((s, l) => s + (+l[campo] || 0), 0));

/* Monta o fechamento da competência.
 * ctx: { rodadas, cfg, chave, decisoes (índice), fluxoComp, fech (ajustes/blocos), anterior (fechamento da competência anterior, opcional) } */
function montarFechamento({ rodadas, cfg, chave, decisoes, fluxoComp, fech, anterior }) {
  fech = fech || fechamentoVazio();
  const tol = cfg.fechamento || FECHAMENTO_PADRAO, prestPorCod = new Map(cfg.prestadores.map(p => [String(p.cod), p]));
  const grupos = rodadasDoFechamento(rodadas, chave), linhasPrest = new Map();
  const pegar = (tipo, cod, nome) => {
    const k = `${tipo}|${cod}`;
    if (!linhasPrest.has(k)) { const p = prestPorCod.get(String(cod)); linhasPrest.set(k, { tipo, cod: String(cod), nome: p?.nomeMV || nome || '', p, unidades: {}, producao: {}, avisos: [], semAceite: [], decisoes: 0, pendencias: 0 }); }
    return linhasPrest.get(k);
  };
  // Valores por unidade a partir das rodadas.
  for (const g of grupos) {
    const x = pegar(g.tipo, g.prestadorCod, g.prestadorNome), r = g.aceita || g.ultima;
    x.unidades[g.unidadeCod] = somaLinhas(r, 'vlRepasse');
    if (g.tipo === 'usg') x.producao[g.unidadeCod] = somaLinhas(r, 'vlTotal');
    if (!g.aceita || g.ultima.em > g.aceita.em) x.semAceite.push(g.unidadeCod);
    x.decisoes += r.linhas.filter(l => l.decisao).length;
    if (decisoes) x.pendencias += pendenciasDaRodada(r, decisoes).length;
    x._rodadas = [...(x._rodadas || []), { r, unidade: g.unidadeCod }];
  }
  // Roster: quem tem regra cadastrada aparece mesmo sem relatório (situação «Sem valores»).
  for (const p of cfg.prestadores) {
    if (p.regras?.faixaUSG) pegar('usg', p.cod, p.nomeMV);
    if (p.regras?.participaIMG) pegar('img', p.cod, p.nomeMV);
  }
  const todos = [...linhasPrest.values()];
  // Produção de USG e classe (todas as unidades).
  const producaoUSG = new Map(todos.filter(x => x.tipo === 'usg').map(x => [x.cod, r2(Object.values(x.producao).reduce((s, v) => s + v, 0))]));
  const doc = (grupo, cod) => fluxoComp?.grupos?.[grupo]?.documental?.[cod] || null;
  for (const x of todos) {
    const aj = fech.ajustes[x.tipo]?.[x.cod] || {};
    x.board = x.tipo === 'usg' ? (+x.p?.regras?.board || 0) : 0;
    x.plantao = +aj.plantao || 0; x.descontos = +aj.descontos || 0; x.obs = aj.obs || '';
    x.total = r2(Object.values(x.unidades).reduce((s, v) => s + v, 0) + x.board + x.plantao);
    x.totalGeral = r2(x.total - x.descontos);
    x.temValores = Object.keys(x.unidades).length > 0;
    // Situação
    const d = [doc(x.tipo, x.cod), x.tipo === 'img' ? doc('curitiba', x.cod) : null].filter(Boolean);
    x.situacao = !x.temValores ? 'sem' : x.semAceite.length ? 'verificar' : d.some(y => y.nfFinanceiro) ? 'concluido' : d.some(y => y.relatorio) ? 'enviado' : 'conferido';
    if (x.semAceite.length) x.avisos.push(`sem aceite na(s) unidade(s) ${x.semAceite.join(', ')}`);
    if (x.pendencias) x.avisos.push(`${x.pendencias} pendência(s) na conferência`);
    // Classe (IMG) e produção
    x.producaoUSG = producaoUSG.get(x.cod) || 0;
    const cl = classeDoPrestador(cfg.classes, x.p, x.producaoUSG); x.classe = cl.classe; x.classeFixa = cl.fixa;
    // Conferências de regra
    for (const { r, unidade } of x._rodadas || []) {
      if (x.tipo === 'usg') {
        const esp = pctUSGEsperado(cfg, x.p, unidade);
        if (esp === null) { if (!x.avisos.some(a => a.startsWith('sem faixa'))) x.avisos.push('sem faixa de USG no cadastro'); continue; }
        const fora = r.linhas.filter(l => +l.vlTotal > 0 && Math.abs(l.vlRepasse / l.vlTotal - esp) * 100 > tol.toleranciaPct);
        if (fora.length) x.avisos.push(`unidade ${unidade}: ${fora.length} linha(s) fora de ${r2(esp * 100)}%`);
      } else {
        let div = 0, semRegra = new Map();
        for (const l of r.linhas) {
          if (l.tipoItem && l.tipoItem !== 'procedimento') continue;
          const v = valorEsperadoIMG(cfg, x.p, x.classe, l);
          if (v.motivo) semRegra.set(v.motivo, (semRegra.get(v.motivo) || 0) + 1);
          else if (Math.abs(v.esperado - l.vlRepasse) > tol.toleranciaValor) div++;
        }
        if (div) x.avisos.push(`unidade ${unidade}: ${div} laudo(s) com valor diferente da classe ${x.classe}`);
        for (const [m, n] of semRegra) x.avisos.push(`unidade ${unidade}: ${n} laudo(s) — ${m}`);
      }
    }
    delete x._rodadas;
    // Variação contra a competência anterior
    const ant = anterior?.prestadores.find(y => y.tipo === x.tipo && y.cod === x.cod);
    if (ant && ant.totalGeral > 0 && x.temValores) {
      x.variacao = r2((x.totalGeral - ant.totalGeral) / ant.totalGeral * 100);
      if (Math.abs(x.variacao) > (+tol.variacaoAlerta || 0)) x.avisos.push(`variação de ${x.variacao > 0 ? '+' : ''}${fmtBR(x.variacao)}% × competência anterior`);
    }
  }
  const usg = todos.filter(x => x.tipo === 'usg'), img = todos.filter(x => x.tipo === 'img');
  const faixaDe = x => x.p?.regras?.faixaUSG || '';
  const ordemFaixa = id => { const i = (cfg.faixasUSG || []).findIndex(f => f.id === id); return i < 0 ? 99 : i; };
  usg.sort((a, b) => ordemFaixa(faixaDe(a)) - ordemFaixa(faixaDe(b)) || a.nome.localeCompare(b.nome));
  img.sort((a, b) => (!!a.p?.regras?.v3 - !!b.p?.regras?.v3) || a.nome.localeCompare(b.nome));
  const semAceite = todos.filter(x => x.situacao === 'verificar').length;
  return { chave, prestadores: todos, usg, img, semAceite, previa: semAceite > 0 || !todos.some(x => x.temValores), fech };
}

function indicadoresFechamento(f, cfg, ncs = []) {
  const somaPor = (lista, chaveFn) => { const m = new Map(); for (const x of lista) for (const [k, v] of chaveFn(x)) m.set(k, r2((m.get(k) || 0) + v)); return [...m]; };
  const porUnidade = t => somaPor(f[t], x => Object.entries(x.unidades)).sort((a, b) => +a[0] - +b[0]).map(([u, v]) => [`${u} - ${unidadePorCod(cfg, u)?.nome || ''}`, v]);
  return {
    totais: { usg: r2(f.usg.reduce((s, x) => s + x.totalGeral, 0)), img: r2(f.img.reduce((s, x) => s + x.totalGeral, 0)) },
    usgPorUnidade: porUnidade('usg'), imgPorUnidade: porUnidade('img'),
    usgPorFaixa: somaPor(f.usg, x => [[(cfg.faixasUSG.find(y => y.id === x.p?.regras?.faixaUSG)?.nome) || 'Sem faixa', x.totalGeral]]),
    imgPorClasse: somaPor(f.img, x => [[`Classe ${x.classe}${x.classeFixa ? ' (fixa)' : ''}`, x.totalGeral]]).sort(),
    porSituacao: Object.keys(SITUACAO_FECH).map(k => [SITUACAO_FECH[k].nome, f.prestadores.filter(x => x.situacao === k).length]),
    variacoes: f.prestadores.filter(x => x.variacao !== undefined && Math.abs(x.variacao) > (+cfg.fechamento.variacaoAlerta || 0)).map(x => [`${x.tipo.toUpperCase()} · ${x.cod} - ${x.nome}`, x.variacao]),
    ncs: { total: ncs.length, impactam: ncs.filter(n => n.impactaPagamento).length, valor: r2(ncs.filter(n => n.impactaPagamento).reduce((s, n) => s + (+n.valor || 0), 0)) },
    decisoes: f.prestadores.reduce((s, x) => s + x.decisoes, 0)
  };
}

// Texto da prévia de um prestador, para colar no e-mail (uma NF por CNPJ).
function textoPreviaPrestador(x, cfg, chave, dataPagamento) {
  const un = u => unidadePorCod(cfg, u), L = [];
  L.push(`Prévia do repasse de ${x.tipo === 'usg' ? 'USG' : 'IMG'} — competência ${rotuloCompetencia(chave)} (produção ${rotuloMes(producaoEsperada(chave))})`);
  L.push(`Prestador: ${x.cod} - ${x.nome}${x.tipo === 'img' ? ` · classe ${x.classe}${x.classeFixa ? ' (fixa)' : ''}` : ''}`, '');
  for (const [u, v] of Object.entries(x.unidades).sort((a, b) => +a[0] - +b[0])) L.push(`${u}- ${un(u)?.nome || ''}${un(u)?.cnpj ? ` (CNPJ ${un(u).cnpj})` : ''}: R$ ${fmtBR(v)}`);
  if (x.board) L.push(`BOARD (CNPJ ${cfg.fechamento.cnpjBoard}): R$ ${fmtBR(x.board)}`);
  if (x.plantao) L.push(`PLANTÃO (CNPJ ${cfg.fechamento.cnpjPlantao}): R$ ${fmtBR(x.plantao)}`);
  if (x.descontos) L.push(`Descontos: − R$ ${fmtBR(x.descontos)}${x.obs ? ` (${x.obs})` : ''}`);
  L.push(`Total geral bruto: R$ ${fmtBR(x.totalGeral)}`, '', `Emitir uma NF por CNPJ.${dataPagamento ? ` Pagamento previsto: ${fmtData(dataPagamento)}.` : ''}`);
  return L.join('\n');
}

/* ---------- Exportação: três abas no layout da planilha de controle ---------- */
function xlsxFechamento(f, cfg, meta = {}) {
  const N = { b: true }, money = { fmt: 'money' }, tit = { b: true, fc: '1F4E78' };
  const stNome = x => { const s = SITUACAO_FECH[x.situacao]; return { b: true, fill: s.cor, fc: s.fc }; };
  const col = i => colLetra(i);
  const prev = f.previa ? [[{ v: `PRÉVIA — ${f.semAceite} prestador(es) sem aceite. Valores sujeitos a alteração.`, st: { b: true, fc: 'C00000' } }], []] : [];
  const legenda = () => [[], [{ v: 'LEGENDA', st: N }], ...Object.values(SITUACAO_FECH).map(s => [{ v: s.nome, st: { fill: s.cor, fc: s.fc, b: true } }])];
  // USG
  const unUSG = cfg.unidades.filter(u => u.pctUSG && f.usg.some(x => x.unidades[u.cod] !== undefined) || (u.pctUSG && u.cnpj));
  const U = [...prev];
  const faixas = [...new Set(f.usg.map(x => x.p?.regras?.faixaUSG || ''))];
  for (const fx of faixas) {
    const faixa = cfg.faixasUSG.find(y => y.id === fx), lista = f.usg.filter(x => (x.p?.regras?.faixaUSG || '') === fx);
    U.push([{ v: (faixa?.nome || 'SEM FAIXA CADASTRADA').toUpperCase(), st: tit }]);
    U.push([{ v: 'EMPRESAS', st: CAB }, { v: '', st: CAB }, ...unUSG.map(u => ({ v: `${u.cod}- ${u.nome}`, st: CAB })), ...['BOARD', 'PLANTÃO', 'TOTAL', 'DESCONTOS', 'TOTAL GERAL BRUTO'].map(v => ({ v, st: CAB }))]);
    U.push([{ v: 'CNPJ PARA EMISSÃO DA NOTA FISCAL', st: N }, '', ...unUSG.map(u => u.cnpj), cfg.fechamento.cnpjBoard, cfg.fechamento.cnpjPlantao]);
    U.push([{ v: 'PORCENTAGEM', st: N }, '', ...unUSG.map(u => { const p = lista[0] ? pctUSGEsperado(cfg, { regras: { ...(lista[0].p?.regras || {}), pctUSGUnidade: {} } }, u.cod) : null; return p === null ? '' : { v: p, st: { fmt: 'pct' } }; })]);
    for (const x of lista) {
      const n = U.length + 1, ini = col(2), fim = col(2 + unUSG.length + 1);
      U.push([{ v: +x.cod || x.cod, st: stNome(x) }, { v: x.nome, st: stNome(x) }, ...unUSG.map(u => x.unidades[u.cod] !== undefined ? { v: x.unidades[u.cod], st: money } : ''),
        x.board ? { v: x.board, st: money } : '', x.plantao ? { v: x.plantao, st: money } : '',
        { v: x.total, f: `SUM(${ini}${n}:${fim}${n})`, st: money }, { v: x.descontos, st: money }, { v: x.totalGeral, f: `${col(2 + unUSG.length + 2)}${n}-${col(2 + unUSG.length + 3)}${n}`, st: { ...money, b: true } },
        x.avisos.length ? { v: x.avisos.join(' · '), st: { fc: '9C5700' } } : '']);
    }
    U.push([]);
  }
  if (f.fech.obs.usg) U.push([{ v: 'OBSERVAÇÕES:', st: N }], [f.fech.obs.usg]);
  U.push(...legenda());
  // IMG
  const unIMG = cfg.unidades.filter(u => u.cnpj && (f.img.some(x => x.unidades[u.cod] !== undefined) || u.pctUSG || u.cod === '5'));
  const cabIMG = ['VALOR PRODUÇÃO DE USG', 'CLASSE', 'MÉDICOS', '', ...unIMG.map(u => `${u.cod}- ${u.nome}`), 'PLANTÃO', 'TOTAL PRODUZIDO', 'DESCONTOS', 'TOTAL GERAL BRUTO'];
  const I = [...prev, cabecalho(cabIMG), ['', '', '', '', ...unIMG.map(u => u.cnpj), cfg.fechamento.cnpjPlantao]];
  const linhaIMG = x => {
    const n = I.length + 1, a = x.classeFixa ? 'FIXO CLASSE' : x.producaoUSG ? { v: x.producaoUSG, st: money } : 'SEM PROD. USG';
    return [a, x.classe, { v: +x.cod || x.cod, st: stNome(x) }, { v: x.nome, st: stNome(x) }, ...unIMG.map(u => x.unidades[u.cod] !== undefined ? { v: x.unidades[u.cod], st: money } : ''),
      x.plantao ? { v: x.plantao, st: money } : '', { v: x.total, f: `SUM(${col(4)}${n}:${col(4 + unIMG.length)}${n})`, st: money }, { v: x.descontos, st: money },
      { v: x.totalGeral, f: `${col(5 + unIMG.length)}${n}-${col(6 + unIMG.length)}${n}`, st: { ...money, b: true } }, x.avisos.length ? { v: x.avisos.join(' · '), st: { fc: '9C5700' } } : ''];
  };
  for (const x of f.img.filter(y => !y.p?.regras?.v3)) I.push(linhaIMG(x));
  const v3 = f.img.filter(y => y.p?.regras?.v3);
  if (v3.length) { I.push([], [{ v: 'MÉDICOS V3 QUE RECEBEM PELA SRA (LAUDOS)', st: tit }]); for (const x of v3) I.push(linhaIMG(x)); }
  const comp = f.fech.blocos.complementar || [], cet = f.fech.blocos.cetrus || [];
  if (comp.length) {
    I.push([], [{ v: `NF COMPLEMENTAR REPASSE LAUDOS PET-CT E PLUVICTO 17- ${unidadePorCod(cfg, '17')?.nome || ''} ${unidadePorCod(cfg, '17')?.cnpj || ''}`, st: tit }], cabecalho(['', '', 'MÉDICOS', '', 'LAUDOS PET-CT', 'APLICAÇÃO PLUVICTO', 'TOTAL PARA EMISSÃO DE NF COMPLEMENTAR']));
    for (const c of comp) { const n = I.length + 1; I.push(['', '', +c.cod || c.cod, c.nome, { v: +c.petct || 0, st: money }, { v: +c.pluvicto || 0, st: money }, { v: r2((+c.petct || 0) + (+c.pluvicto || 0)), f: `SUM(E${n}:F${n})`, st: money }]); }
  }
  if (cet.length) {
    I.push([], [{ v: `NF COMPLEMENTAR REPASSE CURSO CETRUS 17- ${unidadePorCod(cfg, '17')?.nome || ''} ${unidadePorCod(cfg, '17')?.cnpj || ''}`, st: tit }], cabecalho(['', '', 'MÉDICOS', '', `R$ ${fmtBR(f.fech.valorPeriodoCetrus)} POR PERÍODO`, 'TOTAL PARA EMISSÃO DE NF COMPLEMENTAR']));
    for (const c of cet) { const n = I.length + 1; I.push(['', '', +c.cod || c.cod, c.nome, +c.periodos || 0, { v: r2((+c.periodos || 0) * f.fech.valorPeriodoCetrus), f: `E${n}*${f.fech.valorPeriodoCetrus}`, st: money }]); }
  }
  const obsDesc = f.img.filter(x => x.descontos && x.obs).map(x => `DESCONTO ${x.nome.toUpperCase()} R$ ${fmtBR(x.descontos)} ${x.obs.toUpperCase()}`);
  if (f.fech.obs.img || obsDesc.length) I.push([], [{ v: 'OBSERVAÇÕES:', st: N }], ...obsDesc.map(t => [t]), ...(f.fech.obs.img ? [[f.fech.obs.img]] : []));
  I.push(...legenda());
  // PRODUÇÃO USG CLASSE
  const unProd = cfg.unidades.filter(u => u.pctUSG);
  const P = [...prev, [{ v: `Competência ${rotuloCompetencia(f.chave)} · produção ${rotuloMes(producaoEsperada(f.chave))}`, st: N }],
    cabecalho(['CLASSE', 'MÉDICOS', '', ...unProd.map(u => `UNIDADE ${u.cod}`), 'TOTAL', '']), ['', '', '', ...unProd.map(u => ({ v: u.pctUSG.medico, st: { fmt: 'pct' } }))]];
  for (const x of f.img) {
    const n = P.length + 1, prod = f.usg.find(y => y.cod === x.cod)?.producao || {};
    P.push([x.classe, +x.cod || x.cod, x.nome, ...unProd.map(u => prod[u.cod] !== undefined ? { v: prod[u.cod], st: money } : ''), { v: x.producaoUSG, f: `SUM(D${n}:${col(2 + unProd.length)}${n})`, st: { ...money, b: true } },
      x.classeFixa ? `FIXO CLASSE ${x.classe}` : !x.producaoUSG ? 'SEM PROD. USG/CLASSE D' : '']);
  }
  const dt = d => d ? fmtData(d).replace(/\//g, '-') : '';
  return criarXlsx([
    { nome: `REPASSE USG ${dt(meta.pagUSG)}`.trim(), larguras: [10, 38, ...unUSG.map(() => 16), 12, 12, 14, 12, 16, 60], linhas: U, filtro: false, congelar: false },
    { nome: `REPASSE IMG ${dt(meta.pagIMG)}`.trim(), larguras: [18, 8, 10, 38, ...unIMG.map(() => 15), 12, 15, 12, 16, 60], linhas: I, filtro: false, congelar: false },
    { nome: 'PRODUÇÃO USG CLASSE', larguras: [8, 10, 38, ...unProd.map(() => 14), 15, 26], linhas: P, filtro: false, congelar: false }
  ]);
}
function xlsxIndicadoresFechamento(f, ind, meta = {}) {
  const bloco = (titulo, pares, fmt = 'money') => [[{ v: titulo, st: { b: true, fill: 'D9E1F2' } }, { v: '', st: { fill: 'D9E1F2' } }], ...pares.map(([k, v]) => [k, { v, st: { fmt } }]), []];
  const linhas = [[{ v: `Indicadores do fechamento — competência ${rotuloCompetencia(f.chave)}${f.previa ? ' (PRÉVIA)' : ''}`, st: { b: true } }], [],
    ...linhasMeta([['Gerado em', new Date().toLocaleString('pt-BR')], ['Operador', meta.operador || ''], ['Total USG', `R$ ${fmtBR(ind.totais.usg)}`], ['Total IMG', `R$ ${fmtBR(ind.totais.img)}`],
      ['NCs da competência', `${ind.ncs.total} · ${ind.ncs.impactam} impactam o pagamento (R$ ${fmtBR(ind.ncs.valor)} nas vindas do MV)`], ['Linhas com decisão (NC ou considerada)', ind.decisoes]]), [],
    ...bloco('USG por unidade', ind.usgPorUnidade), ...bloco('USG por faixa', ind.usgPorFaixa), ...bloco('IMG por unidade', ind.imgPorUnidade), ...bloco('IMG por classe', ind.imgPorClasse),
    ...bloco('Prestadores por situação', ind.porSituacao, 'int'), ...bloco('Variação acima do limite (%)', ind.variacoes, '')];
  return criarXlsx([{ nome: 'Indicadores', larguras: [56, 20], linhas, filtro: false, congelar: false }]);
}
