/* ============================================================
 * V3 = Curitiba (unidade 5) — regras próprias por médico (SOL-F30)
 * Na V3 o repasse é calculado fora do MV. A ferramenta calcula pela regra cadastrada do médico,
 * mostra a memória de cálculo e gera o texto do e-mail no formato usado hoje.
 * - Doppler é sempre parte do grupo de USG (conta no volume e no faturamento de USG).
 * - HM: só se paga HM de USG/Doppler do convênio Unimed (mesmo sem laudo). Os demais HM não são
 *   pagos e ficam sinalizados para exclusão (não viram NC sozinhos).
 * - Arredonda só no final (assim o exemplo do Dr. Ian dá R$ 73.608,69).
 * ============================================================ */
const FORMAS_V3 = { 'faixa-liquido': '% do líquido por faixa de volume', 'pct-liquido': '% do líquido', 'pct-bruto': '% do bruto', 'por-laudo': 'valor por laudo', 'nao-paga': 'não paga' };
const FORMAS_OUTROS_V3 = ['pct-bruto', 'pct-liquido', 'por-laudo', 'nao-paga'];
const FORMAS_HM_V3 = { faturamento: 'entra no faturamento da USG', 'valor-laudo': 'igual a um laudo de USG', 'nao-paga': 'não paga' };
const FAIXAS_V3_PADRAO = [{ de: 0, pct: 65 }, { de: 800, pct: 68 }, { de: 1000, pct: 70 }];
// Dois modos (pedido de 03/11/2026): só o Dr. Ian recebe por percentual; os demais médicos da V3
// recebem valor fixo por laudo, cadastrado por GRUPO de procedimento do MV (como no MV).
const MODOS_V3 = { fixo: 'Valor fixo por laudo, por grupo do MV', percentual: 'Percentual do faturamento por faixa de volume (como o Dr. Ian)' };
const GRUPO_USG_V3 = '*USG*';   // grupo especial: todos os procedimentos de USG e Doppler
const rotuloGrupoV3 = g => g === GRUPO_USG_V3 ? 'USG (inclui Doppler)' : g;
const regraV3Fixa = () => ({ modo: 'fixo', grupos: [{ grupo: GRUPO_USG_V3, valorLaudo: 0, valorHM: 0 }] });
const regraV3Padrao = () => ({
  modo: 'percentual',
  impostos: 9.15,
  usg: { forma: 'faixa-liquido', faixas: FAIXAS_V3_PADRAO.map(f => ({ ...f })), pct: 0, valor: 0 },
  hm: 'faturamento',
  outros: [{ nome: 'Densitometria', padrao: 'DENSITOM', forma: 'pct-bruto', pct: 10, valor: 0 }]
});

const ehUnidadeV3 = (cfg, cod) => { const u = unidadePorCod(cfg, cod); return u?.empresa ? norm(u.empresa) === 'V3' : String(cod) === '5'; };
const ehUSGouDoppler = (grupo, desc) => /ULTRASS|DOPPLER|\bUSG\b/.test(norm(`${grupo || ''} ${desc || ''}`));
const ehUnimed = convenio => /UNIMED/.test(norm(convenio || ''));
const ehLinhaHM = l => l.tipoItem ? l.tipoItem === 'hm' : (/HONORARIO/.test(norm(l.grupo || '')) || /(^|\s)HM$/.test(norm(l.desc || '')));
// HM de uma linha da unidade V3: devido (USG/Doppler Unimed) ou a excluir.
const hmV3Devido = (grupo, desc, convenio) => ehUSGouDoppler(grupo, desc) && ehUnimed(convenio);
// Grupo do MV escolhido na regra: casa pelo nome do grupo (ou parte dele); «|» separa alternativas.
const casaGrupoV3 = (padrao, l) => { const t = norm(`${l.grupo || ''} ${l.desc || ''}`); return String(padrao || '').split('|').map(norm).filter(Boolean).some(x => t.includes(x)); };
// Entrada da regra por valor fixo para uma linha: grupo exato primeiro, depois o grupo especial de USG.
function grupoFixoV3(regra, l) {
  const gs = regra.grupos || [];
  return gs.find(g => g.grupo !== GRUPO_USG_V3 && norm(g.grupo) === norm(l.grupo || ''))
    || (ehUSGouDoppler(l.grupo, l.desc) ? gs.find(g => g.grupo === GRUPO_USG_V3) : null)
    || gs.find(g => g.grupo !== GRUPO_USG_V3 && casaGrupoV3(g.grupo, l)) || null;
}

function faixaV3(faixas, exames) {
  const l = [...(faixas || [])].filter(f => f.pct !== '' && f.pct !== null && f.pct !== undefined).sort((a, b) => (+a.de || 0) - (+b.de || 0));
  let r = null; for (const f of l) if (exames >= (+f.de || 0)) r = f;
  if (!r) return null;
  const prox = l[l.indexOf(r) + 1];
  return { pct: +r.pct, de: +r.de || 0, ate: prox ? +prox.de - 1 : null };
}
const rotuloFaixaV3 = f => !f ? '' : f.ate === null ? `${f.de}+ exames` : f.de ? `${f.de}–${f.ate}` : `até ${f.ate}`;
function resumoRegraV3(regra) {
  if (!regra) return '';
  if (regra.modo === 'fixo') return 'Valor fixo por laudo — ' + (regra.grupos || []).map(g => `${rotuloGrupoV3(g.grupo)}: R$ ${fmtBR(g.valorLaudo)}${+g.valorHM ? ` (HM Unimed R$ ${fmtBR(g.valorHM)})` : ''}`).join(' · ');
  const u = regra.usg || {}, p = [];
  const usg = u.forma === 'faixa-liquido' ? `${(u.faixas || []).map(f => +f.pct).join(' / ')}% do líquido por volume`
    : u.forma === 'pct-liquido' ? `${u.pct}% do líquido` : u.forma === 'pct-bruto' ? `${u.pct}% do bruto` : u.forma === 'por-laudo' ? `R$ ${fmtBR(u.valor)} por laudo` : 'não paga';
  p.push(`USG${regra.hm === 'faturamento' ? ' + HM Unimed' : ''}: ${usg}`);
  if (regra.hm === 'valor-laudo') p.push('HM Unimed = laudo de USG');
  if (regra.hm === 'nao-paga') p.push('HM não paga');
  for (const o of regra.outros || []) p.push(`${o.nome.toLowerCase()} ${o.forma === 'por-laudo' ? `R$ ${fmtBR(o.valor)} por laudo` : o.forma === 'nao-paga' ? 'não paga' : `${o.pct}% do ${o.forma === 'pct-bruto' ? 'bruto' : 'líquido'}`}`);
  p.push(`impostos ${fmtBR(regra.impostos)}%`);
  return p.join(' · ');
}
// Confere a regra antes de gravar. Devolve a lista de erros.
function validarRegraV3(regra) {
  const e = [], u = regra.usg || {};
  if (regra.modo === 'fixo') {
    const gs = regra.grupos || [];
    if (!gs.length) e.push('cadastre ao menos um grupo com valor por laudo');
    if (gs.some(g => !(+g.valorLaudo > 0) && !(+g.valorHM > 0))) e.push('cada grupo precisa de valor por laudo (ou de HM)');
    const vistos = new Set(); for (const g of gs) { const k = norm(g.grupo); if (vistos.has(k)) e.push(`grupo repetido: ${rotuloGrupoV3(g.grupo)}`); vistos.add(k); }
    return e;
  }
  if (!(+regra.impostos >= 0 && +regra.impostos < 100)) e.push('impostos entre 0 e 100%');
  if (u.forma === 'faixa-liquido' && !(u.faixas || []).length) e.push('informe ao menos uma faixa de volume');
  if (['pct-liquido', 'pct-bruto'].includes(u.forma) && !(+u.pct > 0)) e.push('informe o % da USG');
  if (u.forma === 'por-laudo' && !(+u.valor > 0)) e.push('informe o valor por laudo da USG');
  for (const o of regra.outros || []) {
    if (!o.nome || !o.padrao) e.push('cada exame extra precisa de nome e grupo do MV');
  }
  return e;
}

/* Calcula o repasse da V3 de um médico a partir das linhas dos relatórios do MV da unidade V3.
 * linhas: {grupo, desc, convenio, quant, vlTotal, vlRepasse, tipoItem}. */
function calcularV3(regra, linhas) {
  if (regra.modo === 'fixo') return calcularV3Fixo(regra, linhas);
  const imp = (+regra.impostos || 0) / 100, u = regra.usg || {};
  const r = { exames: 0, brutoUSG: 0, hm: { qtd: 0, valor: 0 }, hmExcluir: { qtd: 0, valor: 0, itens: new Map() }, outros: (regra.outros || []).map(o => ({ ...o, valorLaudo: +o.valor || 0, qtd: 0, bruto: 0, valor: 0 })), semRegra: new Map(), naoProcedimental: { qtd: 0, valor: 0 }, valorMV: 0 };
  for (const l of linhas) {
    const q = +l.quant || 1, v = +l.vlTotal || 0;
    r.valorMV += +l.vlRepasse || 0;
    if (ehLinhaHM(l)) {
      if (hmV3Devido(l.grupo, l.desc, l.convenio)) { r.hm.qtd += q; r.hm.valor += v; }
      else { r.hmExcluir.qtd += q; r.hmExcluir.valor += v; const k = `${l.desc || l.grupo} · ${l.convenio || 'sem convênio'}`; r.hmExcluir.itens.set(k, (r.hmExcluir.itens.get(k) || 0) + q); }
      continue;
    }
    if (l.tipoItem && l.tipoItem !== 'procedimento') { r.naoProcedimental.qtd += q; r.naoProcedimental.valor += v; continue; }
    if (ehUSGouDoppler(l.grupo, l.desc)) { r.exames += q; r.brutoUSG += v; continue; }
    const o = r.outros.find(x => casaGrupoV3(x.padrao, l));
    if (o) { o.qtd += q; o.bruto += v; continue; }
    const k = l.grupo || l.desc || 'sem grupo', e = r.semRegra.get(k) || { qtd: 0, valor: 0 };
    e.qtd += q; e.valor += v; r.semRegra.set(k, e);
  }
  const hmNaBase = regra.hm === 'faturamento' || (regra.hm === 'valor-laudo' && u.forma !== 'por-laudo');
  r.hmNaBase = hmNaBase;
  r.base = r.brutoUSG + (hmNaBase ? r.hm.valor : 0);
  r.liquido = r.base * (1 - imp);
  r.forma = u.forma;
  let usg = 0;
  if (u.forma === 'faixa-liquido') { r.faixa = faixaV3(u.faixas, r.exames); r.pct = r.faixa ? r.faixa.pct : 0; usg = r.liquido * r.pct / 100; }
  else if (u.forma === 'pct-liquido') { r.pct = +u.pct || 0; usg = r.liquido * r.pct / 100; }
  else if (u.forma === 'pct-bruto') { r.pct = +u.pct || 0; usg = r.base * r.pct / 100; }
  else if (u.forma === 'por-laudo') { r.valorLaudo = +u.valor || 0; r.laudosPagos = r.exames + (regra.hm === 'valor-laudo' ? r.hm.qtd : 0); usg = r.laudosPagos * r.valorLaudo; }
  r.valorUSGExato = usg;
  for (const o of r.outros) o.valor = o.forma === 'pct-bruto' ? o.bruto * (+o.pct || 0) / 100 : o.forma === 'pct-liquido' ? o.bruto * (1 - imp) * (+o.pct || 0) / 100 : o.forma === 'por-laudo' ? o.qtd * o.valorLaudo : 0;
  r.total = r2(usg + r.outros.reduce((s, o) => s + o.valor, 0));
  r.valorUSG = r2(usg);
  for (const k of ['brutoUSG', 'base', 'liquido', 'valorMV']) r[k] = r2(r[k]);
  r.hm.valor = r2(r.hm.valor); r.hmExcluir.valor = r2(r.hmExcluir.valor);
  for (const o of r.outros) { o.bruto = r2(o.bruto); o.valor = r2(o.valor); }
  r.impostos = +regra.impostos || 0;
  return r;
}

/* Valor fixo por laudo, por grupo do MV. HM de USG/Doppler Unimed paga o valor de HM do grupo de USG. */
function calcularV3Fixo(regra, linhas) {
  const r = { modo: 'fixo', forma: 'fixo', exames: 0, brutoUSG: 0, valorUSG: 0, hm: { qtd: 0, valor: 0, semValor: 0 }, hmExcluir: { qtd: 0, valor: 0, itens: new Map() }, outros: [], semRegra: new Map(), naoProcedimental: { qtd: 0, valor: 0 }, valorMV: 0, pct: 0, base: 0, liquido: 0, impostos: 0,
    itens: (regra.grupos || []).map(g => ({ ...g, rotulo: rotuloGrupoV3(g.grupo), qtd: 0, valor: 0, hmQtd: 0, hmValor: 0 })) };
  const itemDe = g => r.itens.find(i => i.grupo === g.grupo);
  for (const l of linhas) {
    const q = +l.quant || 1, v = +l.vlTotal || 0;
    r.valorMV += +l.vlRepasse || 0;
    if (ehLinhaHM(l)) {
      // HM de USG/Doppler paga o valor de HM do grupo de USG da regra.
      const gs = regra.grupos || [], g = gs.find(x => x.grupo === GRUPO_USG_V3) || gs.find(x => /ULTRASS|DOPPLER|\bUSG\b/.test(norm(x.grupo)));
      if (hmV3Devido(l.grupo, l.desc, l.convenio)) {
        if (g && +g.valorHM > 0) { const it = itemDe(g); it.hmQtd += q; it.hmValor += q * +g.valorHM; r.hm.qtd += q; r.hm.valor += q * +g.valorHM; }
        else r.hm.semValor += q;
      } else { r.hmExcluir.qtd += q; r.hmExcluir.valor += v; const k = `${l.desc || l.grupo} · ${l.convenio || 'sem convênio'}`; r.hmExcluir.itens.set(k, (r.hmExcluir.itens.get(k) || 0) + q); }
      continue;
    }
    if (l.tipoItem && l.tipoItem !== 'procedimento') { r.naoProcedimental.qtd += q; r.naoProcedimental.valor += v; continue; }
    const usg = ehUSGouDoppler(l.grupo, l.desc);
    if (usg) { r.exames += q; r.brutoUSG += v; }
    const g = grupoFixoV3(regra, l);
    if (g) { const it = itemDe(g); it.qtd += q; it.valor += q * (+g.valorLaudo || 0); continue; }
    const k = l.grupo || l.desc || 'sem grupo', e = r.semRegra.get(k) || { qtd: 0, valor: 0 };
    e.qtd += q; e.valor += v; r.semRegra.set(k, e);
  }
  for (const it of r.itens) { it.valor = r2(it.valor); it.hmValor = r2(it.hmValor); }
  r.valorUSG = r2(r.itens.filter(i => i.grupo === GRUPO_USG_V3 || /ULTRASS/.test(norm(i.grupo))).reduce((s, i) => s + i.valor, 0));
  r.outrosValor = r2(r.itens.filter(i => !(i.grupo === GRUPO_USG_V3 || /ULTRASS/.test(norm(i.grupo)))).reduce((s, i) => s + i.valor, 0));
  r.total = r2(r.itens.reduce((s, i) => s + i.valor + i.hmValor, 0));
  r.brutoUSG = r2(r.brutoUSG); r.valorMV = r2(r.valorMV); r.hm.valor = r2(r.hm.valor); r.hmExcluir.valor = r2(r.hmExcluir.valor);
  return r;
}

// Avisos do cálculo da V3 (aparecem no Fechamento).
function avisosV3(c) {
  const a = [];
  if (c.hmExcluir.qtd) a.push(`${c.hmExcluir.qtd} HM a excluir (não pago na V3: R$ ${fmtBR(c.hmExcluir.valor)})`);
  for (const [g, e] of c.semRegra) a.push(`${e.qtd} exame(s) de «${g}» sem regra na V3 (R$ ${fmtBR(e.valor)} bruto, fora do cálculo)`);
  if (c.forma === 'faixa-liquido' && !c.faixa && c.exames) a.push('volume abaixo da primeira faixa da regra');
  if (c.hm?.semValor) a.push(`${c.hm.semValor} HM de USG/Doppler Unimed sem valor de HM na regra (não pago)`);
  return a;
}

// Texto do e-mail no formato usado hoje (exemplo do Dr. Ian, 10/2026).
function textoEmailV3(c) {
  if (c.modo === 'fixo') {
    const R = v => `R$ ${fmtBR(v)}`, L = ['Boa tarde, segue relatório de produção para conferência.', ''];
    for (const i of c.itens) {
      L.push(i.qtd ? `${i.rotulo}: ${i.qtd} laudo(s) × ${R(i.valorLaudo)} = ${R(i.valor)}` : `${i.rotulo}: R$ 0,00 (SEM PRODUÇÃO)`);
      if (i.hmQtd) L.push(`Honorários ${i.grupo === GRUPO_USG_V3 ? 'USG' : i.rotulo} UNIMED: ${i.hmQtd} × ${R(i.valorHM)} = ${R(i.hmValor)}`);
    }
    L.push('', `Total para emissão da nota fiscal: ${R(c.total)}`);
    return L.join('\n');
  }
  const R = v => `R$ ${fmtBR(v)}`, L = ['Boa tarde, segue relatório de produção para conferência.', '', `Foram realizados ${c.exames} exames de ultrassom.`, ''];
  for (const o of c.outros) {
    if (!o.qtd && !o.bruto) { L.push(`${o.nome}: R$ 0,00 (SEM PRODUÇÃO)`); continue; }
    const como = o.forma === 'pct-bruto' ? `${fmtBR(o.pct)}% de ${R(o.bruto)}` : o.forma === 'pct-liquido' ? `${fmtBR(o.pct)}% de ${R(o.bruto)} menos os impostos` : o.forma === 'por-laudo' ? `${o.qtd} × ${R(o.valorLaudo)}` : 'não paga';
    L.push(`${o.nome}: ${R(o.valor)} (${como})`);
  }
  if (c.hm.qtd || c.hmNaBase) L.push(`Honorários USG UNIMED: ${R(c.hm.valor)}`);
  L.push(`USG: ${R(c.brutoUSG)}`, '');
  const pctTxt = p => `${String(p).replace('.', ',')}%`;
  if (c.forma === 'por-laudo') {
    L.push(`Ultrassom: ${c.exames} exames${c.laudosPagos > c.exames ? ` + ${c.laudosPagos - c.exames} HM` : ''} × ${R(c.valorLaudo)} = ${R(c.valorUSG)}`);
  } else if (c.forma === 'nao-paga') {
    L.push('Ultrassom: não pago pela regra deste médico.');
  } else {
    const soma = c.hmNaBase ? `Ultrassom: ${R(c.brutoUSG)} mais HM ${R(c.hm.valor)} = ${R(c.base)}` : `Ultrassom: ${R(c.base)}`;
    L.push(soma);
    if (c.forma === 'pct-bruto') L.push(`* ${pctTxt(c.pct)} = ${R(c.valorUSG)}`);
    else L.push(`menos os impostos (${pctTxt(fmtBR(c.impostos))}) = ${R(c.liquido)} * ${pctTxt(c.pct)} = ${R(c.valorUSG)}`);
  }
  L.push('', `Total para emissão da nota fiscal: ${R(c.total)}`);
  return L.join('\n');
}
