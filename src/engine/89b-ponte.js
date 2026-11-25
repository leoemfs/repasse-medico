/* ============================================================
 * Ponte Apolo → Power BI → MV pelo atendimento (prévia aprovada em 25/11/2026: docs/prototipos/ponte-atendimento/)
 * Sem ID em comum entre Apolo e Power BI: o laudo acha o atendimento no Power BI pelo nome completo + data + unidade +
 * grupo × modalidade + código × título (equivalências) + convênio — o mesmo filtro que a pessoa faz à mão. O atendimento
 * é único por data. Do atendimento, a linha do MV vem pelo número. O prestador do Power BI nunca decide o par (o repasse
 * do MV reflete as redistribuições feitas no MV): só aparece como informação. Nomes do Power BI ficam só na memória.
 * ============================================================ */

// Nome abreviado do Apolo («MARIA AP SANTOS OLIVEIRA», «M APARECIDA SANTOS») × nome completo do Power BI. Cada parte do
// nome curto casa, em ordem, com uma parte do longo: igual, inicial (1 letra) ou começo (2+ letras, ex.: AP); partes do longo podem
// sobrar (nome do meio omitido). A primeira parte precisa casar com a primeira do longo, e pelo menos duas partes de
// 3+ letras precisam casar — «M S» sozinho não liga ninguém.
function nomeAbreviadoCompat(a, b) {
  if (!a || !b) return false;
  const ta = tokensNome(a), tb = tokensNome(b), [c, l] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (c.length < 2) return false;
  const casa = (t, u) => t === u || (t.length === 1 && u[0] === t) || (t.length >= 2 && u.startsWith(t));
  if (!casa(c[0], l[0])) return false;
  let j = 1, fortes = c[0].length >= 3 ? 1 : 0;
  for (let i = 1; i < c.length; i++) {
    while (j < l.length && !casa(c[i], l[j])) j++;
    if (j >= l.length) return false;
    if (c[i].length >= 3) fortes++;
    j++;
  }
  return fortes >= 2;
}
// Nível de nome usado pela ponte: o da conferência, ou 2 (compatível) quando um é abreviação do outro.
const nivelNomePonte = (a, b, minTrunc = 20) => Math.max(nivelNome(a, b, minTrunc), nomeAbreviadoCompat(a, b) ? 2 : 0);

// Power BI agrupado por atendimento (cache na própria planilha, fora do que é gravado).
function indicePBIAtendimentos(pbi) {
  if (!pbi) return new Map();
  if (pbi._ixAt) return pbi._ixAt;
  const m = new Map();
  for (const l of pbi.linhas || []) {
    const k = String(l.atendimento || '').trim(); if (!k) continue;
    let a = m.get(k);
    if (!a) m.set(k, a = { atendimento: k, pn: l.pn, nome: l.paciente || '', dia: l.data ? diaSerial(l.data) : null, unidadeCod: l.unidadeCod, empresa: l.empresa, conta: l.conta, convenio: l.convenio, prestadores: new Set(), linhas: [] });
    if (l.prestador) a.prestadores.add(String(l.prestador));
    a.linhas.push(l);
  }
  const porDia = new Map(); for (const a of m.values()) if (a.dia !== null) (porDia.get(a.dia) || porDia.set(a.dia, []).get(a.dia)).push(a);
  Object.defineProperty(pbi, '_ixAt', { value: m, enumerable: false }); Object.defineProperty(pbi, '_ixAtDia', { value: porDia, enumerable: false });
  return m;
}
const unidadeDoLaudo = (cfg, l) => (cfg.unidades || []).find(u => (u.apolo || []).some(n => norm(n) === norm(l.unidade)))?.cod;

// Os seis critérios laudo × atendimento do Power BI. ok: true (bate) | false (não bate) | null (sem dado para comparar).
function criteriosPonte(l, at, opc) {
  const cfg = opc.cfg, un = unidadeDoLaudo(cfg, l);
  const grupoOk = l.modalidade ? at.linhas.some(x => (modalidadesDoGrupo(x.grupo) || []).includes(l.modalidade)) : null;
  const codigoOk = opc.idxEq && l.titulo ? at.linhas.some(x => avaliarProcedimento(opc.idxEq, x.codigo, l.titulo, { unidade: opc.unidadeCod, modalidade: l.modalidade, convenio: x.convenio }).estado === 'validada') : null;
  const cv = convenioCompativel(at.convenio, l.convenio, cfg);
  return [
    { k: 'Nome', ok: nivelNomePonte(l.pn, at.pn, +cfg.parametros?.minTruncamento || 20) >= 2 },
    { k: 'Data', ok: l.dia !== null && l.dia === at.dia },
    { k: 'Unidade', ok: un && at.unidadeCod ? String(un) === String(at.unidadeCod) : null },
    { k: 'Grupo × modalidade', ok: grupoOk },
    { k: 'Código × título', ok: codigoOk },
    { k: 'Convênio', ok: cv === null ? null : cv }
  ];
}
const pontosCriterios = cr => cr.filter(c => c.ok === true).length;

/* Atendimento(s) do laudo no Power BI. Nome e data precisam bater (o atendimento é único por data). Um só atendimento
 * possível = vínculo firme; dois ou mais = dúvida (sempre ressalva para a pessoa analisar), com o de mais critérios à frente. */
function ponteDoLaudo(pbi, l, opc) {
  if (!pbi || !l?.pn || l.dia === null || l.dia === undefined) return null;
  const minTrunc = +opc.cfg.parametros?.minTruncamento || 20, achados = [];
  indicePBIAtendimentos(pbi);
  for (const at of pbi._ixAtDia.get(l.dia) || []) {
    if (!at.pn || at.pn[0] !== l.pn[0]) continue;
    if (nivelNomePonte(l.pn, at.pn, minTrunc) < 2) continue;
    const cr = criteriosPonte(l, at, opc);
    if (cr[2].ok === false && cr[3].ok === false) continue;   // outra unidade e outro tipo de exame: não é este
    achados.push({ at, criterios: cr, pontos: pontosCriterios(cr) });
  }
  if (!achados.length) return { nivel: 'nenhum' };
  achados.sort((a, b) => b.pontos - a.pontos);
  return { nivel: achados.length === 1 ? 'firme' : 'duvida', melhor: achados[0], alternativas: achados.slice(1, 4) };
}
// Texto curto da ponte para a tela e para os motivos.
const textoPonte = p => p?.melhor ? `atendimento ${p.melhor.at.atendimento} no Power BI (${p.melhor.at.nome}) · ${p.melhor.pontos} de 6 critérios` : '';
