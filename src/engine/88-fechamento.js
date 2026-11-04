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
const fechamentoVazio = () => ({ ajustes: { usg: {}, img: {}, curitiba: {} }, nfs: [], blocos: { complementar: [], cetrus: [] }, valorPeriodoCetrus: 1000, obs: { usg: '', img: '', curitiba: '' }, manual: {} });

/* ---------- NF complementar (SOL-F28): lançamentos da competência em USG, IMG e Curitiba ----------
 * {id, tipo:'usg'|'img'|'curitiba', cod, nome, categoria, unidade (cód. da unidade do CNPJ de emissão),
 *  quantidade, valorUnitario, valor, obs, por, em}. A competência é sempre a do fechamento. */
// Lançamentos da competência; os blocos antigos (PET-CT/Pluvicto e Cetrus) viram lançamentos.
function nfsDoFechamento(fech) {
  if ((fech.nfs || []).length) return fech.nfs;
  const out = [], b = fech.blocos || {};
  for (const c of b.complementar || []) {
    if (+c.petct) out.push({ id: novoId('nf'), tipo: 'img', cod: String(c.cod || ''), nome: c.nome || '', categoria: 'Laudos PET-CT', unidade: '17', quantidade: 0, valorUnitario: 0, valor: +c.petct, obs: '', migrado: true });
    if (+c.pluvicto) out.push({ id: novoId('nf'), tipo: 'img', cod: String(c.cod || ''), nome: c.nome || '', categoria: 'Aplicação Pluvicto', unidade: '17', quantidade: 0, valorUnitario: 0, valor: +c.pluvicto, obs: '', migrado: true });
  }
  for (const c of b.cetrus || []) if (+c.periodos) out.push({ id: novoId('nf'), tipo: 'img', cod: String(c.cod || ''), nome: c.nome || '', categoria: 'Curso Cetrus', unidade: '17', quantidade: +c.periodos, valorUnitario: +fech.valorPeriodoCetrus || 1000, valor: r2(+c.periodos * (+fech.valorPeriodoCetrus || 1000)), obs: '', migrado: true });
  return out;
}
const valorNF = d => (+d.quantidade > 0 && +d.valorUnitario > 0) ? r2(+d.quantidade * +d.valorUnitario) : r2(+d.valor || 0);
function validarNF(d) {
  const e = [];
  if (!String(d.cod || '').trim() && !String(d.nome || '').trim()) e.push('informe o prestador');
  if (!String(d.categoria || '').trim()) e.push('informe do que se trata (categoria)');
  if (!String(d.unidade || '').trim()) e.push('escolha a unidade/CNPJ de emissão');
  if (!(valorNF(d) > 0)) e.push('informe o valor (ou quantidade × valor unitário)');
  return e;
}
// Categorias sugeridas para um fechamento: as cadastradas para o tipo (PET-CT, Pluvicto, Cetrus e Reajuste só no IMG).
const categoriasNF = (cfg, tipo) => (cfg.fechamento.categoriasNF || []).filter(c => (c.tipos || []).includes(tipo));
// Aprende o padrão (unidade e valor unitário) da categoria a cada lançamento.
function lembrarCategoriaNF(cfg, tipo, categoria, unidade, valorUnitario) {
  const l = cfg.fechamento.categoriasNF = cfg.fechamento.categoriasNF || [];
  let c = l.find(x => norm(x.nome) === norm(categoria));
  if (!c) { c = { nome: String(categoria).trim(), tipos: [], unidade: '', valorUnitario: 0 }; l.push(c); }
  if (!c.tipos.includes(tipo)) c.tipos.push(tipo);
  c.unidade = unidade || c.unidade; if (+valorUnitario > 0) c.valorUnitario = +valorUnitario;
}

// USG ou IMG: pela descrição do repasse; sem descrição, pelos grupos das linhas.
function tipoRepasseDaRodada(r) {
  const t = norm(`${r.descricao || ''} ${r.repasse || ''}`);
  if (/USG|ULTRASS/.test(t)) return 'usg';
  if (/\bIMG\b|IMAGEM|RAIO|TOMO|RESSON|MAMO|DENSIT/.test(t)) return 'img';
  const us = r.linhas.filter(l => /ULTRASS|DOPPLER/.test(norm(l.grupo || ''))).length;   // Doppler é sempre do grupo de USG
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
  // Médicos da V3 (Curitiba) têm fechamento próprio: tudo deles vai para «curitiba» (SOL-F30).
  const ehV3 = cod => !!prestPorCod.get(String(cod))?.regras?.v3;
  const pegar = (tipo, cod, nome) => {
    if (ehV3(cod)) tipo = 'curitiba';
    const k = `${tipo}|${cod}`;
    if (!linhasPrest.has(k)) { const p = prestPorCod.get(String(cod)); linhasPrest.set(k, { tipo, cod: String(cod), nome: p?.nomeMV || nome || '', p, unidades: {}, producao: {}, avisos: [], semAceite: [], decisoes: 0, pendencias: 0 }); }
    return linhasPrest.get(k);
  };
  // Valores por unidade a partir das rodadas.
  for (const g of grupos) {
    const x = pegar(g.tipo, g.prestadorCod, g.prestadorNome), r = g.aceita || g.ultima;
    // Na V3 o relatório de USG e o de IMG da mesma unidade somam.
    x.unidades[g.unidadeCod] = r2((x.tipo === 'curitiba' ? (x.unidades[g.unidadeCod] || 0) : 0) + somaLinhas(r, 'vlRepasse'));
    if (g.tipo === 'usg' && x.tipo !== 'curitiba') x.producao[g.unidadeCod] = somaLinhas(r, 'vlTotal');
    if ((!g.aceita || g.ultima.em > g.aceita.em) && !x.semAceite.includes(g.unidadeCod)) x.semAceite.push(g.unidadeCod);
    x.decisoes += r.linhas.filter(l => l.decisao).length;
    if (decisoes) x.pendencias += pendenciasDaRodada(r, decisoes).length;
    x._rodadas = [...(x._rodadas || []), { r, unidade: g.unidadeCod }];
  }
  // Roster: quem tem regra cadastrada aparece mesmo sem relatório (situação «Sem valores»).
  for (const p of cfg.prestadores) {
    if (p.regras?.faixaUSG) pegar('usg', p.cod, p.nomeMV);
    if (p.regras?.participaIMG || p.regras?.v3) pegar('img', p.cod, p.nomeMV);
  }
  const todos = [...linhasPrest.values()];
  // Produção de USG e classe (todas as unidades).
  const producaoUSG = new Map(todos.filter(x => x.tipo === 'usg').map(x => [x.cod, r2(Object.values(x.producao).reduce((s, v) => s + v, 0))]));
  const doc = (grupo, cod) => fluxoComp?.grupos?.[grupo]?.documental?.[cod] || null;
  // Descontos parcelados (SOL-F31): a parcela do mês vai para a linha do prestador.
  for (const x of todos) x.temValores = Object.keys(x.unidades).length > 0;
  const alertasDescontos = aplicarDescontosParcelados(todos, cfg.descontos, chave);
  for (const x of todos) {
    // V3: a unidade de Curitiba é calculada pela regra do médico; as outras unidades seguem o MV.
    if (x.tipo === 'curitiba') {
      const regra = x.p?.regras?.v3regra, unV3 = Object.keys(x.unidades).filter(u => ehUnidadeV3(cfg, u));
      if (regra && unV3.length) {
        const linhas = (x._rodadas || []).filter(y => ehUnidadeV3(cfg, y.unidade)).flatMap(y => y.r.linhas);
        x.v3 = calcularV3(regra, linhas);
        unV3.forEach((u, i) => { x.unidades[u] = i ? 0 : x.v3.total; });
        x.avisos.push(...avisosV3(x.v3));
      } else if (!regra) x.avisos.push(unV3.length ? 'sem regra da V3 cadastrada: valor do relatório do MV' : 'sem regra da V3 cadastrada (Bases → Prestadores → Médicos V3)');
    }
    // Legado: até a SOL-F30 os ajustes e marcas dos médicos V3 ficavam em «img».
    const legado = (o, k) => o?.[k]?.[x.cod] || (x.tipo === 'curitiba' ? o?.img?.[x.cod] : null);
    const aj = x.tipo === 'curitiba' ? { ...(fech.ajustes.img?.[x.cod] || {}), ...(fech.ajustes.curitiba?.[x.cod] || {}) } : (fech.ajustes[x.tipo]?.[x.cod] || {});
    x.board = x.tipo === 'usg' ? (+x.p?.regras?.board || 0) : 0;
    x.plantao = +aj.plantao || 0;
    // Desconto: as parcelas do mês entram sozinhas; o valor digitado no mês vale por cima (manual).
    const parc = x.temValores ? (x.parcelas || []) : [];
    x.descontosAuto = r2(parc.reduce((s, p) => s + p.valor, 0));
    const manualDesc = aj.descontos !== undefined && aj.descontos !== '';
    x.descontos = manualDesc ? (+aj.descontos || 0) : x.descontosAuto;
    x.descontosManual = manualDesc && parc.length > 0 && x.descontos !== x.descontosAuto;
    x.obs = aj.obs || parc.map(p => p.obs).join('; ');
    x.total = r2(Object.values(x.unidades).reduce((s, v) => s + v, 0) + x.board + x.plantao);
    x.totalGeral = r2(x.total - x.descontos);
    if (parc.length) x.avisos.push(`desconto parcelado: ${parc.map(p => p.obs).join('; ')}${x.descontosManual ? ` (valor alterado à mão: R$ ${fmtBR(x.descontos)} no lugar de R$ ${fmtBR(x.descontosAuto)})` : ''}`);
    if (x.temValores && x.totalGeral < 0) { x.avisos.push(`desconto (R$ ${fmtBR(x.descontos)}) maior que o repasse do mês (R$ ${fmtBR(x.total)})`); alertasDescontos.push({ k: 'maior', cod: x.cod, tipo: x.tipo, texto: `${x.nome}: desconto (R$ ${fmtBR(x.descontos)}) maior que o repasse do mês (R$ ${fmtBR(x.total)}).` }); }
    // Situação
    const d = [doc(x.tipo, x.cod)].filter(Boolean);
    x.situacao = !x.temValores ? 'sem' : x.semAceite.length ? 'verificar' : d.some(y => y.nfFinanceiro) ? 'concluido' : d.some(y => y.relatorio) ? 'enviado' : 'conferido';
    // Marca manual «Verificar» (SOL-F32) fica por cima do cálculo até ser retirada.
    const manual = legado(fech.manual, x.tipo);
    if (manual) { x.situacaoCalculada = x.situacao; x.situacao = 'verificar'; x.manual = manual; x.avisos.push(`marcado para verificar: ${manual.motivo}`); }
    if (x.semAceite.length) x.avisos.push(`sem aceite na(s) unidade(s) ${x.semAceite.join(', ')}`);
    if (x.pendencias) x.avisos.push(`${x.pendencias} pendência(s) na conferência`);
    // Classe (IMG) e produção
    x.producaoUSG = producaoUSG.get(x.cod) || 0;
    // Classe A/B/C/D não se aplica aos médicos da V3.
    if (x.tipo === 'curitiba') { x.classe = ''; x.classeFixa = false; }
    else { const cl = classeDoPrestador(cfg.classes, x.p, x.producaoUSG); x.classe = cl.classe; x.classeFixa = cl.fixa; }
    // Conferências de regra
    for (const { r, unidade } of x.tipo === 'curitiba' ? [] : x._rodadas || []) {
      if (x.tipo === 'usg') {
        const esp = pctUSGEsperado(cfg, x.p, unidade);
        if (esp === null) { if (!x.avisos.some(a => a.startsWith('sem faixa'))) x.avisos.push('sem faixa de USG no cadastro'); continue; }
        const fora = r.linhas.filter(l => +l.vlTotal > 0 && Math.abs(l.vlRepasse / l.vlTotal - esp) * 100 > tol.toleranciaPct);
        if (fora.length) x.avisos.push(`unidade ${unidade}: ${fora.length} linha(s) fora de ${r2(esp * 100)}%`);
      } else {
        let div = 0, semRegra = new Map();
        for (const l of r.linhas) {
          if (l.tipoItem && l.tipoItem !== 'procedimento') continue;
          const v = valorEsperadoIMG(cfg, x.p, x.classe, l, unidade);
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
  const usg = todos.filter(x => x.tipo === 'usg'), img = todos.filter(x => x.tipo === 'img'), curitiba = todos.filter(x => x.tipo === 'curitiba').sort((a, b) => a.nome.localeCompare(b.nome));
  const faixaDe = x => x.p?.regras?.faixaUSG || '';
  const ordemFaixa = id => { const i = (cfg.faixasUSG || []).findIndex(f => f.id === id); return i < 0 ? 99 : i; };
  usg.sort((a, b) => ordemFaixa(faixaDe(a)) - ordemFaixa(faixaDe(b)) || a.nome.localeCompare(b.nome));
  img.sort((a, b) => a.nome.localeCompare(b.nome));
  const semAceite = todos.filter(x => x.situacao === 'verificar').length;
  return { chave, prestadores: todos, usg, img, curitiba, semAceite, alertasDescontos, previa: semAceite > 0 || !todos.some(x => x.temValores), fech, nfs: nfsDoFechamento(fech) };
}

function indicadoresFechamento(f, cfg, ncs = []) {
  const somaPor = (lista, chaveFn) => { const m = new Map(); for (const x of lista) for (const [k, v] of chaveFn(x)) m.set(k, r2((m.get(k) || 0) + v)); return [...m]; };
  const porUnidade = t => somaPor(f[t], x => Object.entries(x.unidades)).sort((a, b) => +a[0] - +b[0]).map(([u, v]) => [`${u} - ${unidadePorCod(cfg, u)?.nome || ''}`, v]);
  return {
    totais: { usg: r2(f.usg.reduce((s, x) => s + x.totalGeral, 0)), img: r2(f.img.reduce((s, x) => s + x.totalGeral, 0)), curitiba: r2((f.curitiba || []).reduce((s, x) => s + x.totalGeral, 0)) },
    usgPorUnidade: porUnidade('usg'), imgPorUnidade: porUnidade('img'),
    usgPorFaixa: somaPor(f.usg, x => [[(cfg.faixasUSG.find(y => y.id === x.p?.regras?.faixaUSG)?.nome) || 'Sem faixa', x.totalGeral]]),
    imgPorClasse: somaPor(f.img, x => [[`Classe ${x.classe}${x.classeFixa ? ' (fixa)' : ''}`, x.totalGeral]]).sort(),
    porSituacao: Object.keys(SITUACAO_FECH).map(k => [SITUACAO_FECH[k].nome, f.prestadores.filter(x => x.situacao === k).length]),
    variacoes: f.prestadores.filter(x => x.variacao !== undefined && Math.abs(x.variacao) > (+cfg.fechamento.variacaoAlerta || 0)).map(x => [`${x.tipo.toUpperCase()} · ${x.cod} - ${x.nome}`, x.variacao]),
    ncs: { total: ncs.length, impactam: ncs.filter(n => n.impactaPagamento).length, valor: r2(ncs.filter(n => n.impactaPagamento).reduce((s, n) => s + (+n.valor || 0), 0)) },
    decisoes: f.prestadores.reduce((s, x) => s + x.decisoes, 0),
    nfComplementar: ['usg', 'img', 'curitiba'].map(t => [{ usg: 'USG', img: 'IMG', curitiba: 'Curitiba (V3)' }[t], r2((f.nfs || []).filter(n => n.tipo === t).reduce((s, n) => s + valorNF(n), 0))]).filter(([, v]) => v)
  };
}

// Texto da prévia de um prestador, para colar no e-mail (uma NF por CNPJ).
function textoPreviaPrestador(x, cfg, chave, dataPagamento, nfs = []) {
  const un = u => unidadePorCod(cfg, u), L = [];
  // V3: o e-mail de hoje (memória de cálculo) e, se houver, as outras unidades e ajustes.
  if (x.tipo === 'curitiba' && x.v3) {
    L.push(textoEmailV3(x.v3));
    const outras = Object.entries(x.unidades).filter(([u]) => !ehUnidadeV3(cfg, u));
    if (outras.length || x.plantao || x.descontos) {
      L.push('', 'Outros valores do mês:');
      for (const [u, v] of outras) L.push(`${u}- ${un(u)?.nome || ''}${un(u)?.cnpj ? ` (CNPJ ${un(u).cnpj})` : ''}: R$ ${fmtBR(v)}`);
      if (x.plantao) L.push(`PLANTÃO (CNPJ ${cfg.fechamento.cnpjPlantao}): R$ ${fmtBR(x.plantao)}`);
      if (x.descontos) L.push(`Descontos: − R$ ${fmtBR(x.descontos)}${x.obs ? ` (${x.obs})` : ''}`);
      L.push(`Total geral bruto: R$ ${fmtBR(x.totalGeral)}`);
    }
    const minhas = nfs.filter(n => String(n.cod) === String(x.cod));
    if (minhas.length) { L.push('', 'NF complementar:'); for (const n of minhas) L.push(`${n.categoria}: R$ ${fmtBR(valorNF(n))}`); }
    return L.join('\n');
  }
  L.push(`Prévia do repasse de ${x.tipo === 'usg' ? 'USG' : x.tipo === 'curitiba' ? 'Curitiba (V3)' : 'IMG'} — competência ${rotuloCompetencia(chave)} (produção ${rotuloMes(producaoEsperada(chave))})`);
  L.push(`Prestador: ${x.cod} - ${x.nome}${x.tipo === 'img' && x.classe ? ` · classe ${x.classe}${x.classeFixa ? ' (fixa)' : ''}` : ''}`, '');
  for (const [u, v] of Object.entries(x.unidades).sort((a, b) => +a[0] - +b[0])) L.push(`${u}- ${un(u)?.nome || ''}${un(u)?.cnpj ? ` (CNPJ ${un(u).cnpj})` : ''}: R$ ${fmtBR(v)}`);
  if (x.board) L.push(`BOARD (CNPJ ${cfg.fechamento.cnpjBoard}): R$ ${fmtBR(x.board)}`);
  if (x.plantao) L.push(`PLANTÃO (CNPJ ${cfg.fechamento.cnpjPlantao}): R$ ${fmtBR(x.plantao)}`);
  if (x.descontos) L.push(`Descontos: − R$ ${fmtBR(x.descontos)}${x.obs ? ` (${x.obs})` : ''}`);
  L.push(`Total geral bruto: R$ ${fmtBR(x.totalGeral)}`);
  const minhas = nfs.filter(n => String(n.cod) === String(x.cod));
  if (minhas.length) {
    L.push('', 'NF complementar:');
    for (const n of minhas) { const u = un(n.unidade); L.push(`${n.categoria}${+n.quantidade > 0 ? ` (${n.quantidade} × R$ ${fmtBR(n.valorUnitario)})` : ''} — ${u ? `${u.cod}- ${u.nome}${u.cnpj ? ` (CNPJ ${u.cnpj})` : ''}` : ''}: R$ ${fmtBR(valorNF(n))}`); }
  }
  L.push('', `Emitir uma NF por CNPJ.${dataPagamento ? ` Pagamento previsto: ${fmtData(dataPagamento)}.` : ''}`);
  return L.join('\n');
}

/* ---------- Exportação no layout da planilha de controle (modelo enviado em 03/11/2026) ----------
 * Abas: REPASSE USG (blocos por faixa) · REPASSE IMG · REPASSE CURITIBA · PRODUÇÃO USG CLASSE.
 * Arial 10, bordas finas, cabeçalho azul 1F4E78, CNPJ em azul-claro, percentuais em azul médio,
 * valores em formato contábil R$, totais com fórmula, zoom 85%. */
const EST_FECH = {
  cab: { b: true, fc: 'FFFFFF', fill: '1F4E78', al: 'center', va: 'center', wrap: true, bd: 'tudo' },
  titulo: { fc: '1F4E78', al: 'center', va: 'center', wrap: true, bd: 'tudo' },
  cnpjRot: { b: true, fill: 'DCEAF7', al: 'center', va: 'center', wrap: true, bd: 'tudo' },
  cnpj: { fill: 'DCEAF7', al: 'center', va: 'center', wrap: true, bd: 'tudo' },
  pct: { fill: 'A6CAEC', al: 'center', va: 'center', fmt: 'pct2', bd: 'tudo' },
  centro: { al: 'center', va: 'center', bd: 'tudo' },
  centroB: { b: true, al: 'center', va: 'center', bd: 'tudo' },
  texto: { al: 'left', va: 'center', bd: 'tudo' },
  valor: { fmt: 'acct', va: 'center', bd: 'tudo' },
  valorB: { b: true, fmt: 'acct', al: 'center', va: 'center', bd: 'tudo' },
  num: { fmt: 'num2', al: 'center', va: 'center', bd: 'tudo' },
  numB: { b: true, fmt: 'num2', al: 'center', va: 'center', bd: 'tudo' },
  aviso: { b: true, fc: 'C00000', al: 'left', va: 'center', wrap: true },
  rotulo: { b: true, al: 'center', va: 'center', wrap: true, bd: 'tudo' }
};
function xlsxFechamento(f, cfg, meta = {}) {
  const E = EST_FECH, col = colLetra, dt = d => d ? fmtData(d).replace(/\//g, '-') : '';
  const sit = (x, base) => { const s = SITUACAO_FECH[x.situacao]; return x.situacao === 'sem' && !meta.corSemValores ? { ...base, fc: '000000' } : { ...base, fill: s.cor, fc: s.fc }; };
  const unNome = u => `${u.cod}- ${u.nome}`;
  const topo = (titulo, ultima, M) => { M.push(`A1:${col(ultima)}1`); return [[{ v: f.previa ? `PRÉVIA — ${f.semAceite} prestador(es) sem aceite. Valores sujeitos a alteração.` : titulo, st: f.previa ? E.aviso : { ...E.aviso, fc: '1F4E78' } }], []]; };
  // NF complementar: um bloco por categoria (e por unidade/CNPJ de emissão). Com quantidade, mostra
  // QUANTIDADE × VALOR UNITÁRIO; o total de cada médico é o valor da NF daquela categoria.
  const blocosNF = (L, M, A, lista, c0) => {
    const grupos = new Map();
    for (const n of lista) { const k = `${norm(n.categoria)}|${n.unidade}`; (grupos.get(k) || grupos.set(k, []).get(k)).push(n); }
    for (const nfs of grupos.values()) {
      const u = unidadePorCod(cfg, nfs[0].unidade), cat = nfs[0].categoria, comQtd = nfs.some(n => +n.quantidade > 0 && +n.valorUnitario > 0);
      const pad = Array(c0).fill(''), ult = c0 + 2 + (comQtd ? 2 : 0);
      L.push([]); let r = L.length + 1;
      L.push([...pad, { v: `NF COMPLEMENTAR — ${String(cat).toUpperCase()} — ${u ? `${u.cod}- ${u.nome} ${u.cnpj || ''}` : ''}`.trim(), st: E.titulo }, ...Array(ult - c0).fill({ v: '', st: E.titulo })]); M.push(`${col(c0)}${r}:${col(ult)}${r}`);
      r = L.length + 1;
      L.push([...pad, { v: 'MÉDICOS', st: E.cab }, { v: '', st: E.cab }, ...(comQtd ? [{ v: 'QUANTIDADE', st: E.cab }, { v: 'VALOR UNITÁRIO', st: E.cab }] : []), { v: `TOTAL PARA EMISSÃO DE NF — ${String(cat).toUpperCase()}`, st: E.cab }]);
      M.push(`${col(c0)}${r}:${col(c0 + 1)}${r}`); A[r] = 30;
      // Um médico por linha (lançamentos do mesmo médico na mesma categoria somam).
      const porPrest = new Map();
      for (const n of nfs) { const k = n.cod || norm(n.nome), e = porPrest.get(k) || { cod: n.cod, nome: n.nome, qtd: 0, vu: +n.valorUnitario || 0, v: 0, misto: false }; e.qtd += +n.quantidade || 0; if ((+n.valorUnitario || 0) !== e.vu) e.misto = true; e.v = r2(e.v + valorNF(n)); porPrest.set(k, e); }
      const ini = L.length + 1;
      for (const e of porPrest.values()) {
        const n = L.length + 1, formula = comQtd && e.qtd > 0 && !e.misto;
        L.push([...pad, { v: +e.cod || e.cod, st: E.centro }, { v: e.nome, st: E.texto },
          ...(comQtd ? [{ v: e.qtd || '', st: E.centro }, { v: e.qtd && !e.misto ? e.vu : '', st: E.valor }] : []),
          { v: e.v, ...(formula ? { f: `${col(c0 + 2)}${n}*${col(c0 + 3)}${n}` } : {}), st: E.valorB }]);
      }
      if (porPrest.size > 1) { const n = L.length + 1; L.push([...pad, { v: '', st: E.centroB }, { v: 'TOTAL', st: { ...E.texto, b: true } }, ...(comQtd ? [{ v: '', st: E.centro }, { v: '', st: E.centro }] : []), { v: r2(nfs.reduce((s2, x) => s2 + valorNF(x), 0)), f: `SUM(${col(ult)}${ini}:${col(ult)}${n - 1})`, st: E.valorB }]); }
    }
  };
  const legenda = (L, c) => { L.push([], []); const pad = Array(c).fill(''); L.push([...pad, { v: 'LEGENDA', st: E.rotulo }]); for (const s of Object.values(SITUACAO_FECH)) L.push([...pad, { v: s.nome, st: { ...E.rotulo, fill: s.cor, fc: s.fc } }]); };
  const observacoes = (L, c, linhas) => { if (!linhas.length) return; const pad = Array(c).fill(''); L.push([], [...pad, { v: 'OBSERVAÇÕES:', st: { b: true } }], ...linhas.map(t => [...pad, t])); };

  /* ---- REPASSE USG: um bloco por faixa ---- */
  const unUSG = cfg.unidades.filter(u => u.pctUSG && (u.cnpj || f.usg.some(x => x.unidades[u.cod] !== undefined)));
  const nU = unUSG.length, cB = 2 + nU, cP = cB + 1, cT = cB + 2, cD = cB + 3, cG = cB + 4;
  const MU = [], AU = {}, U = topo(`REPASSE USG — COMPETÊNCIA ${rotuloCompetencia(f.chave)} · PAGAMENTO ${meta.pagUSG ? fmtData(meta.pagUSG) : ''}`, cG, MU);
  const faixas = [...new Set(f.usg.map(x => x.p?.regras?.faixaUSG || ''))].sort((a, b) => cfg.faixasUSG.findIndex(y => y.id === a) - cfg.faixasUSG.findIndex(y => y.id === b));
  for (const fx of faixas) {
    const faixa = cfg.faixasUSG.find(y => y.id === fx), lista = f.usg.filter(x => (x.p?.regras?.faixaUSG || '') === fx);
    const r = U.length + 1;
    U.push([{ v: (faixa?.nome || 'Sem faixa cadastrada').toUpperCase(), st: E.titulo }, ...Array(cG).fill({ v: '', st: E.titulo })]); MU.push(`A${r}:${col(cG)}${r}`);
    U.push([{ v: 'EMPRESAS', st: E.cab }, { v: '', st: E.cab }, ...unUSG.map(u => ({ v: unNome(u), st: E.cab })), ...['BOARD', 'PLANTÃO', 'TOTAL', 'DESCONTOS', 'TOTAL GERAL BRUTO'].map(v => ({ v, st: E.cab }))]);
    AU[r + 1] = 38.25;
    MU.push(`A${r + 1}:B${r + 1}`, ...[cT, cD, cG].map(c => `${col(c)}${r + 1}:${col(c)}${r + 3}`));
    U.push([{ v: 'CNPJ PARA EMISSÃO DA NOTA FISCAL', st: E.cnpjRot }, { v: '', st: E.cnpjRot }, ...unUSG.map(u => ({ v: u.cnpj || '', st: E.cnpj })), { v: cfg.fechamento.cnpjBoard, st: E.cnpj }, { v: cfg.fechamento.cnpjPlantao, st: E.cnpj }, { v: '', st: E.cab }, { v: '', st: E.cab }, { v: '', st: E.cab }]);
    MU.push(`A${r + 2}:B${r + 2}`, `${col(cB)}${r + 2}:${col(cB)}${r + 3}`, `${col(cP)}${r + 2}:${col(cP)}${r + 3}`);
    const pctDe = u => pctUSGEsperado(cfg, { regras: { faixaUSG: fx, pctUSGUnidade: {} } }, u.cod);
    U.push([{ v: 'PORCENTAGEM', st: E.cnpjRot }, { v: '', st: E.cnpjRot }, ...unUSG.map(u => { const p = faixa ? pctDe(u) : null; return { v: p === null ? '' : p, st: E.pct }; }), { v: '', st: E.cnpj }, { v: '', st: E.cnpj }, { v: '', st: E.cab }, { v: '', st: E.cab }, { v: '', st: E.cab }]);
    MU.push(`A${r + 3}:B${r + 3}`);
    for (const x of lista) {
      const n = U.length + 1;
      U.push([{ v: +x.cod || x.cod, st: sit(x, E.centro) }, { v: x.nome, st: sit(x, E.texto) }, ...unUSG.map(u => ({ v: x.unidades[u.cod] ?? '', st: E.valor })),
        { v: x.board || '', st: E.valor }, { v: x.plantao || '', st: E.valor }, { v: x.total, f: `SUM(${col(2)}${n}:${col(cP)}${n})`, st: E.valor },
        { v: x.descontos, st: E.valor }, { v: x.totalGeral, f: `${col(cT)}${n}-${col(cD)}${n}`, st: E.valor }]);
    }
    U.push([]);
  }
  blocosNF(U, MU, AU, f.nfs.filter(n => n.tipo === 'usg'), 0);
  observacoes(U, 1, [...f.usg.filter(x => x.descontos && x.obs).map(x => `DESCONTO ${x.nome.toUpperCase()} R$ ${fmtBR(x.descontos)} ${x.obs.toUpperCase()}`), ...(f.fech.obs.usg ? [f.fech.obs.usg] : [])]);
  legenda(U, 1);

  /* ---- REPASSE IMG (sem os médicos da V3, que vão para a aba de Curitiba) ---- */
  const tabelaIMG = (lista, unidades, MI, AI) => {
    const nI = unidades.length, cPl = 4 + nI, cTo = cPl + 1, cDe = cPl + 2, cGe = cPl + 3, L = [];
    const r = 3;
    L.push([{ v: 'VALOR PRODUÇÃO DE USG', st: E.cab }, { v: 'CLASSE', st: E.cab }, { v: 'EMPRESAS', st: E.cab }, { v: '', st: E.cab }, ...unidades.map(u => ({ v: unNome(u), st: E.cab })), ...['PLANTÃO', 'TOTAL PRODUZIDO', 'DESCONTOS', 'TOTAL GERAL BRUTO'].map(v => ({ v, st: E.cab }))]);
    AI[r] = 38.25;
    MI.push(`A${r}:A${r + 2}`, `B${r}:B${r + 2}`, `C${r}:D${r}`, ...[cTo, cDe, cGe].map(c => `${col(c)}${r}:${col(c)}${r + 2}`));
    L.push([{ v: '', st: E.cab }, { v: '', st: E.cab }, { v: 'CNPJ PARA EMISSÃO DA NOTA FISCAL', st: E.cnpjRot }, { v: '', st: E.cnpjRot }, ...unidades.map(u => ({ v: u.cnpj || '', st: E.cnpj })), { v: cfg.fechamento.cnpjPlantao, st: E.cnpj }, { v: '', st: E.cab }, { v: '', st: E.cab }, { v: '', st: E.cab }]);
    MI.push(`C${r + 1}:D${r + 1}`, ...[...unidades.map((u, k) => 4 + k), cPl].map(c => `${col(c)}${r + 1}:${col(c)}${r + 2}`));
    L.push([{ v: '', st: E.cab }, { v: '', st: E.cab }, { v: 'MÉDICOS', st: E.cab }, { v: '', st: E.cab }, ...unidades.map(() => ({ v: '', st: E.cnpj })), { v: '', st: E.cnpj }, { v: '', st: E.cab }, { v: '', st: E.cab }, { v: '', st: E.cab }]);
    MI.push(`C${r + 2}:D${r + 2}`);
    for (const x of lista) {
      const n = r + L.length;
      const a = x.classeFixa ? { v: 'FIXO CLASSE', st: E.centroB } : x.producaoUSG ? { v: x.producaoUSG, st: E.valorB } : { v: 'SEM PROD. USG', st: E.centroB };
      L.push([a, { v: x.classe, st: E.centroB }, { v: +x.cod || x.cod, st: sit(x, E.centro) }, { v: x.nome, st: sit(x, E.texto) }, ...unidades.map(u => ({ v: x.unidades[u.cod] ?? '', st: E.valor })),
        { v: x.plantao || '', st: E.valor }, { v: x.total, f: `SUM(${col(4)}${n}:${col(cPl)}${n})`, st: E.valorB }, { v: x.descontos, st: E.valorB }, { v: x.totalGeral, f: `${col(cTo)}${n}-${col(cDe)}${n}`, st: E.valorB }]);
    }
    return { L, ultima: cGe };
  };
  const imgPrincipal = f.img.filter(x => !x.p?.regras?.v3);
  const unIMG = cfg.unidades.filter(u => u.cnpj && (u.pctUSG || u.cod === '5' || imgPrincipal.some(x => x.unidades[u.cod] !== undefined))).sort((a, b) => +a.cod - +b.cod);
  const MI = [], AI = {}, tI = tabelaIMG(imgPrincipal, unIMG, MI, AI);
  const I = [...topo(`REPASSE IMG — COMPETÊNCIA ${rotuloCompetencia(f.chave)} · PAGAMENTO ${meta.pagIMG ? fmtData(meta.pagIMG) : ''}`, tI.ultima, MI), ...tI.L];
  blocosNF(I, MI, AI, f.nfs.filter(n => n.tipo === 'img'), 2);
  observacoes(I, 3, [...imgPrincipal.filter(x => x.descontos && x.obs).map(x => `DESCONTO ${x.nome.toUpperCase()} R$ ${fmtBR(x.descontos)} ${x.obs.toUpperCase()}`), ...(f.fech.obs.img ? [f.fech.obs.img] : [])]);
  legenda(I, 3);

  /* ---- REPASSE CURITIBA (V3): só os médicos da V3, com o cálculo da regra de cada um (SOL-F30) ---- */
  const v3 = f.curitiba || [];
  const unV3 = cfg.unidades.filter(u => u.cnpj && (ehUnidadeV3(cfg, u.cod) || v3.some(x => x.unidades[u.cod] !== undefined))).sort((a, b) => (ehUnidadeV3(cfg, b.cod) - ehUnidadeV3(cfg, a.cod)) || +a.cod - +b.cod);
  const c0 = 8, cPlC = c0 + unV3.length, cToC = cPlC + 1, cDeC = cPlC + 2, cGeC = cPlC + 3, MC = [], AC = {};
  const C = [...topo(`REPASSE CURITIBA (V3) — COMPETÊNCIA ${rotuloCompetencia(f.chave)} · PAGAMENTO ${meta.pagCuritiba ? fmtData(meta.pagCuritiba) : ''}`, cGeC, MC)];
  C.push([...['CÓD.', 'MÉDICO V3', 'EXAMES USG (COM DOPPLER)', 'USG BRUTO', 'HM USG UNIMED', 'OUTROS EXAMES (V3)', 'LÍQUIDO (− IMPOSTOS)', '% REPASSE'].map(v => ({ v, st: E.cab })), ...unV3.map(u => ({ v: unNome(u), st: E.cab })), ...['PLANTÃO', 'TOTAL', 'DESCONTOS', 'TOTAL GERAL BRUTO'].map(v => ({ v, st: E.cab }))]);
  AC[3] = 38.25; MC.push(...[0, 1, 2, 3, 4, 5, 6, 7, cToC, cDeC, cGeC].map(c => `${col(c)}3:${col(c)}4`));
  C.push([...Array(c0).fill({ v: '', st: E.cab }), ...unV3.map(u => ({ v: u.cnpj || '', st: E.cnpj })), { v: cfg.fechamento.cnpjPlantao, st: E.cnpj }, ...Array(3).fill({ v: '', st: E.cab })]);
  for (const x of v3) {
    const n = C.length + 1, c = x.v3;
    C.push([{ v: +x.cod || x.cod, st: sit(x, E.centro) }, { v: x.nome, st: sit(x, E.texto) },
      { v: c ? c.exames : '', st: E.centro }, { v: c ? c.brutoUSG : '', st: E.valor }, { v: c ? c.hm.valor : '', st: E.valor }, { v: c ? (c.modo === 'fixo' ? c.outrosValor : r2(c.outros.reduce((s2, o) => s2 + o.valor, 0))) : '', st: E.valor },
      { v: c && c.modo !== 'fixo' && c.forma !== 'por-laudo' ? c.liquido : '', st: E.valor }, { v: c && c.pct ? c.pct / 100 : '', st: { ...E.pct, fill: undefined } },
      ...unV3.map(u => ({ v: x.unidades[u.cod] ?? '', st: E.valor })), { v: x.plantao || '', st: E.valor },
      { v: x.total, f: `SUM(${col(c0)}${n}:${col(cPlC)}${n})`, st: E.valorB }, { v: x.descontos, st: E.valorB }, { v: x.totalGeral, f: `${col(cToC)}${n}-${col(cDeC)}${n}`, st: E.valorB }]);
  }
  if (!v3.length) C.push([], [{ v: 'Nenhum médico da V3 cadastrado (Bases → Prestadores → Médicos V3).', st: { va: 'center' } }]);
  blocosNF(C, MC, AC, f.nfs.filter(n => n.tipo === 'curitiba'), 0);
  observacoes(C, 1, [...v3.filter(x => x.descontos && x.obs).map(x => `DESCONTO ${x.nome.toUpperCase()} R$ ${fmtBR(x.descontos)} ${x.obs.toUpperCase()}`), ...(f.fech.obs.curitiba ? [f.fech.obs.curitiba] : []),
    ...v3.filter(x => !x.v3).map(x => `${x.nome.toUpperCase()}: SEM REGRA DA V3 CADASTRADA — VALORES DO RELATÓRIO DO MV`)]);
  // Memória de cálculo de cada médico: o mesmo texto do e-mail.
  for (const x of v3.filter(y => y.v3)) {
    C.push([], [{ v: '' }, { v: `MEMÓRIA DE CÁLCULO — ${x.cod} - ${x.nome}`.toUpperCase(), st: { b: true, fc: '1F4E78' } }]);
    for (const t of textoEmailV3(x.v3).split('\n')) C.push([{ v: '' }, t]);
    for (const a of avisosV3(x.v3)) C.push([{ v: '' }, { v: `Aviso: ${a}`, st: { fc: 'C00000' } }]);
  }
  legenda(C, 1);

  /* ---- PRODUÇÃO USG CLASSE ---- */
  const unProd = cfg.unidades.filter(u => u.pctUSG);
  const cTot = 3 + unProd.length, cObs = cTot + 1, MP = [], AP = {};
  const P = [...topo(`PRODUÇÃO USG CLASSE — COMPETÊNCIA ${rotuloCompetencia(f.chave)}`, cObs, MP)];
  P.push([{ v: `Competência ${rotuloCompetencia(f.chave)} · produção ${rotuloMes(producaoEsperada(f.chave))}`, st: { al: 'center', va: 'center' } }]); MP.push(`A3:${col(cObs)}3`);
  P.push([{ v: 'CLASSE', st: E.cab }, { v: 'MÉDICOS', st: E.cab }, { v: '', st: E.cab }, ...unProd.map(u => ({ v: `UNIDADE ${u.cod}`, st: E.cab })), { v: 'TOTAL', st: E.cab }, { v: 'Observação', st: E.cab }]);
  P.push([{ v: '', st: E.cab }, { v: '', st: E.cab }, { v: '', st: E.cab }, ...unProd.map(u => ({ v: u.pctUSG.medico, st: E.pct })), { v: '', st: E.cab }, { v: '', st: E.cab }]);
  MP.push('A4:A5', 'B4:C5', `${col(cTot)}4:${col(cTot)}5`, `${col(cObs)}4:${col(cObs)}5`);
  for (const x of imgPrincipal) {
    const n = P.length + 1, prod = f.usg.find(y => y.cod === x.cod)?.producao || {};
    P.push([{ v: x.classe, st: E.centroB }, { v: +x.cod || x.cod, st: E.centro }, { v: x.nome, st: E.texto }, ...unProd.map(u => ({ v: prod[u.cod] ?? '', st: E.num })),
      { v: x.producaoUSG, f: `SUM(D${n}:${col(cTot - 1)}${n})`, st: E.numB }, { v: x.classeFixa ? `FIXO CLASSE ${x.classe}` : !x.producaoUSG ? 'SEM PROD. USG/CLASSE D' : '', st: E.centroB }]);
  }
  return criarXlsx([
    { nome: `REPASSE USG ${dt(meta.pagUSG)}`.trim(), larguras: [6, 50.3, ...unUSG.map(() => 18.1), 18.6, 18.1, 16.4, 16.4, 18.1], linhas: U, mesclar: MU, alturas: AU, zoom: 85, filtro: false, congelar: false },
    { nome: `REPASSE IMG ${dt(meta.pagIMG)}`.trim(), larguras: [18, 8.4, 10, 48.3, ...Array(tI.ultima - 6).fill(21.3), 15, 12, 16], linhas: I, mesclar: MI, alturas: AI, zoom: 85, filtro: false, congelar: false },
    { nome: `REPASSE CURITIBA ${dt(meta.pagCuritiba)}`.trim(), larguras: [8, 42, 13, 16, 16, 16, 18, 11, ...unV3.map(() => 21.3), 15, 16, 14, 18], linhas: C, mesclar: MC, alturas: AC, zoom: 85, filtro: false, congelar: false },
    { nome: `PRODUÇÃO USG CLASSE ${f.chave.slice(5)}-${f.chave.slice(0, 4)}`, larguras: [8.4, 10, 49.6, ...unProd.map(() => 14), 15, 26], linhas: P, mesclar: MP, alturas: AP, zoom: 85, filtro: false, congelar: false }
  ]);
}
function xlsxIndicadoresFechamento(f, ind, meta = {}) {
  const bloco = (titulo, pares, fmt = 'money') => [[{ v: titulo, st: { b: true, fill: 'D9E1F2' } }, { v: '', st: { fill: 'D9E1F2' } }], ...pares.map(([k, v]) => [k, { v, st: { fmt } }]), []];
  const linhas = [[{ v: `Indicadores do fechamento — competência ${rotuloCompetencia(f.chave)}${f.previa ? ' (PRÉVIA)' : ''}`, st: { b: true } }], [],
    ...linhasMeta([['Gerado em', new Date().toLocaleString('pt-BR')], ['Operador', meta.operador || ''], ['Total USG', `R$ ${fmtBR(ind.totais.usg)}`], ['Total IMG', `R$ ${fmtBR(ind.totais.img)}`], ['Total Curitiba (V3)', `R$ ${fmtBR(ind.totais.curitiba)}`],
      ['NCs da competência', `${ind.ncs.total} · ${ind.ncs.impactam} impactam o pagamento (R$ ${fmtBR(ind.ncs.valor)} nas vindas do MV)`], ['Linhas com decisão (NC ou considerada)', ind.decisoes]]), [],
    ...bloco('USG por unidade', ind.usgPorUnidade), ...bloco('USG por faixa', ind.usgPorFaixa), ...bloco('IMG por unidade', ind.imgPorUnidade), ...bloco('IMG por classe', ind.imgPorClasse),
    ...(ind.cobertura ? bloco(`Cobertura automática por prestador (%) — competência ${fmtBR(ind.cobertura.pct)}%`, ind.cobertura.porPrestador.map(e => [`${e.cod} - ${e.nome} (${e.conferidas} de ${e.total})${e.maiorBloqueio ? ` · maior bloqueio: ${e.maiorBloqueio[0]}` : ''}`, e.pct]), '') : []),
    ...bloco('Prestadores por situação', ind.porSituacao, 'int'), ...bloco('NF complementar por fechamento', ind.nfComplementar), ...bloco('Variação acima do limite (%)', ind.variacoes, '')];
  return criarXlsx([{ nome: 'Indicadores', larguras: [56, 20], linhas, filtro: false, congelar: false }]);
}
