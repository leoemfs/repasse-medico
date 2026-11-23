/* ============================================================
 * Memória das decisões por linha na competência (SOL-F6)
 * - «Tratado: NC»: vem das próprias NCs da competência (menos «não procede»), pelas chaves
 *   da linha guardadas na origem da NC. Se o procedimento sair do relatório e o laudo
 *   aparecer «Só no laudo» na próxima rodada, ele continua reconhecido como NC.
 * - «Considerado no repasse»: a linha não bate, mas entra no repasse; justificativa obrigatória.
 * - Linha do MV reconhecida por conta + atendimento + código + data; laudo pelo ID do Apolo.
 *   Nenhuma das chaves leva nome de paciente.
 * ============================================================ */
// v3.0.0-alpha.4: «Dispensado» — laudo sem lançamento correspondente que não precisa de lançamento (ex.: 2ª página de um
// exame, laudo refeito, exame sem cobrança). Não entra no repasse e deixa de contar como pendência; justificativa obrigatória.
// SOL-F43: «Considerado no repasse» passa a se chamar «Aceito para pagamento» (mesma decisão, mesmos dados).
// «Resolvido no MV»: a linha foi corrigida no MV; fica pendente até a reconferência confirmar ou o aceite manual.
const TIPOS_DECISAO = { nc: 'Tratado: NC', considerar: 'Aceito para pagamento', dispensado: 'Laudo dispensado', resolvido: 'Resolvido no MV (aguarda reconferência)' };
/* v3.0.0-alpha.9 (P0 da auditoria de 16/11/2026):
 * 1. Linhas do MV que dividem conta + atendimento + código + data (cobrança repetida, mesmo código no mesmo dia) ganham a
 *    ordem na chave («…|2»). Antes, «Esta é a repetida → NC» levava as duas linhas para NC. Linhas únicas mantêm a chave
 *    de sempre, e as decisões já gravadas delas continuam valendo.
 * 2. A decisão de uma linha do MV é procurada só pela chave do MV. A chave do laudo serve para reconhecer o laudo quando
 *    ele aparece «Só no laudo». Antes, a NC «não lançado» (gravada pela chave do laudo) passava para o lançamento que o MV
 *    fez depois para corrigir, e a linha conferida ficava fora do fechamento. */
const chaveMVBase = r => `M|${r.conta}|${r.atendimento}|${r.codigo}|${isoDia(r.data)}`;
const chaveMVDecisao = r => r ? chaveMVBase(r) + (r.ordDecisao ? `|${r.ordDecisao.i}` : '') : '';
const chaveLaudoDecisao = l => !l ? '' : l.idLaudo ? `L|${l.idLaudo}` : `L|${l.idPac}|${isoDia(l.data)}|${chaveTitulo(l.titulo)}`;
const chavesDaLinha = (r, l) => [chaveMVDecisao(r), chaveLaudoDecisao(l)].filter(Boolean);
// Ordem de cada linha entre as que dividem a chave base, na ordem do relatório. Refeita a cada conferência (idempotente).
function marcarOrdemDecisao(regs) {
  const n = contar(regs || [], chaveMVBase), ord = new Map();
  for (const r of regs || []) { const k = chaveMVBase(r), t = n.get(k); ord.set(k, (ord.get(k) || 0) + 1); r.ordDecisao = t > 1 ? { i: ord.get(k), n: t } : null; }
  return regs;
}
// Chave «M|…|i» → [base, i]; chave sem ordem → [chave, 0].
const partesChaveMV = k => { const p = String(k || '').split('|'); return p[0] === 'M' && p.length === 6 ? [p.slice(0, 5).join('|'), +p[5]] : [String(k || ''), 0]; };

function indiceDecisoes(ncs, considerar) {
  const m = new Map(), laudos = ch => (ch || []).filter(k => String(k).startsWith('L|'));
  for (const d of considerar || []) for (const k of d.chaves) m.set(k, { tipo: TIPOS_DECISAO[d.tipo] && d.tipo !== 'nc' ? d.tipo : 'considerar', id: d.id, justificativa: d.justificativa, por: d.por, em: d.em, kls: laudos(d.chaves) });
  for (const nc of ncs || []) {
    if (nc.situacao === 'nao-procede') continue;
    const ch = nc.origem?.chavesLinha || [];
    for (const k of ch) m.set(k, { tipo: 'nc', ncId: nc.id, natureza: nc.natureza, situacao: nc.situacao, por: nc.criadaPor, em: nc.criadaEm, kls: laudos(ch), dup: nc.origem?.tipoCandidato === 'duplicidade' });
  }
  return m;
}
/* Decisão de uma linha do MV pela chave do MV (kd) e, só para desempate, a chave do laudo pareado (kl).
 * Linha repetida sem decisão própria («…|i»): a decisão gravada na chave base (antes desta versão, ou quando a linha
 * ainda era única) vale para UMA linha só — a do mesmo laudo, se a decisão tiver laudo; senão a 1ª, ou, na NC de
 * duplicidade, as repetidas (2ª em diante). Assim nenhuma decisão antiga passa a valer para uma cobrança a mais. */
function decisaoPorChaveMV(idx, kd, kl) {
  if (!idx || !kd) return null;
  const d = idx.get(kd); if (d) return d;
  const [base, i] = partesChaveMV(kd); if (!i) return null;
  const b = idx.get(base); if (!b) return null;
  if (kl && b.kls?.length) return b.kls.includes(kl) ? b : null;
  return (b.dup ? i > 1 : i === 1) ? b : null;
}
const decisaoDaLinha = (idx, r, l) => r ? decisaoPorChaveMV(idx, chaveMVDecisao(r), chaveLaudoDecisao(l)) : (l && idx.get(chaveLaudoDecisao(l))) || null;
function aplicarDecisoes(res, idx) {
  const n = { nc: 0, considerar: 0, dispensado: 0, resolvido: 0 };
  for (const x of res.linhas) { x.decisao = decisaoDaLinha(idx, x.r, x.l); if (x.decisao) n[x.decisao.tipo]++; }
  res.porDecisao = n;
  return res;
}
function registrarConsiderar(reg, chave, chaves, justificativa, por, resumo = {}, tipo = 'considerar') {
  if (!String(justificativa || '').trim()) throw new Error(tipo === 'dispensado' ? 'Informe a justificativa para dispensar o laudo.' : tipo === 'resolvido' ? 'Informe o que foi corrigido no MV.' : 'Informe a justificativa para aceitar a linha para pagamento.');
  const c = itemCompetencia(reg, chave);
  c.decisoes = c.decisoes || [];
  const d = { id: novoId('dec'), chaves, justificativa: justificativa.trim(), por, em: agoraISO(), resumo, ...(tipo !== 'considerar' ? { tipo } : {}) };
  c.decisoes.push(d);
  return d;
}
function removerConsiderar(reg, chave, id) {
  const c = itemCompetencia(reg, chave), antes = (c.decisoes || []).length;
  c.decisoes = (c.decisoes || []).filter(d => d.id !== id);
  return antes !== c.decisoes.length;
}
// Linhas de uma rodada que continuam pendentes depois das decisões (para o aceite e o fechamento).
const linhaResolvida = l => ['conferido', 'identificado'].includes(l.estado);
// SOL-F43: na conferência, pendência = classe «Pendente» (taxa/material/medicamento e HM sem regra são «Excluído», não pendência;
// «Resolvido no MV» continua pendente até a reconferência). Correção de prestador segue a regra anterior.
const pendenciasDaRodada = (rodada, idx) => rodada.tipo === 'conferencia' ? rodada.linhas.filter(l => classeDaLinhaRodada(l, idx) === 'pend')
  : rodada.linhas.filter(l => !linhaResolvida(l) && !decisaoDaLinhaRodada(idx, l));
/* SOL-F43 — Observação por linha: anotação livre na competência, pela mesma chave da linha (sem nome de paciente).
 * Não muda a classe nem a situação; vale para toda nova rodada; editar acrescenta (o texto anterior fica no histórico). */
function registrarObservacao(reg, chave, chaves, texto, por) {
  const t = String(texto || '').trim(); if (!t) throw new Error('Escreva a observação.');
  const c = itemCompetencia(reg, chave); c.observacoes = c.observacoes || [];
  const o = { id: novoId('obs'), chaves, texto: t, por, em: agoraISO() }; c.observacoes.push(o); return o;
}
function indiceObservacoes(obs) {
  const m = new Map();
  for (const o of obs || []) for (const k of o.chaves || []) (m.get(k) || m.set(k, []).get(k)).push(o);
  return m;
}
// A observação é só anotação: na linha repetida, a gravada na chave base (antes da ordem na chave) aparece em todas.
const observacoesDaLinha = (idx, r, l) => { const vistos = new Set(), out = []; for (const k of [...chavesDaLinha(r, l), ...(r?.ordDecisao ? [chaveMVBase(r)] : [])]) for (const o of idx.get(k) || []) if (!vistos.has(o.id)) { vistos.add(o.id); out.push(o); } return out.sort((a, b) => String(a.em).localeCompare(String(b.em))); };

/* Rodadas gravadas antes da v3.0.0-alpha.9 têm a chave sem a ordem da repetição. Ao ler, as linhas que dividem a mesma
 * chave ganham a ordem (as linhas da rodada estão na ordem do relatório, como na conferência). Não grava nada. */
function normalizarChavesRodada(r) {
  if (!r || r.chavesV >= 2 || !Array.isArray(r.linhas)) return r;
  const n = contar(r.linhas.filter(l => l.kd && !partesChaveMV(l.kd)[1]), l => l.kd), ord = new Map();
  for (const l of r.linhas) if (n.get(l.kd) > 1) { ord.set(l.kd, (ord.get(l.kd) || 0) + 1); l.kd = `${l.kd}|${ord.get(l.kd)}`; }
  r.chavesV = 2;
  return r;
}

/* SOL-F41 (v3.0.0-alpha.13) — Observação por linha: texto para o Excel e para a NC, e retenção.
 * A observação é texto livre e pode ter dado de paciente: segue a mesma retenção das NCs (retencaoNC, em dias). Passado o
 * prazo, o texto é apagado; ficam quem escreveu e quando. */
const textoObservacoes = obs => (obs || []).map(o => `${o.texto} (${o.por || '—'}, ${String(o.em || '').slice(0, 10)})`).join(' | ');
const TEXTO_OBS_RETIDA = '(texto apagado pela retenção de dados de pacientes)';
function aplicarRetencaoObservacoes(reg, dias, hoje = new Date()) {
  let n = 0;
  for (const c of Object.values(reg?.itens || {})) for (const o of c.observacoes || []) {
    if (o.anonimizada || !o.em || idadeDias(o.em, hoje) <= dias) continue;
    o.texto = TEXTO_OBS_RETIDA; o.anonimizada = agoraISO(); n++;
  }
  return n;
}
