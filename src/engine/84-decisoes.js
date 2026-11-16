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
const chaveMVDecisao = r => r ? `M|${r.conta}|${r.atendimento}|${r.codigo}|${isoDia(r.data)}` : '';
const chaveLaudoDecisao = l => !l ? '' : l.idLaudo ? `L|${l.idLaudo}` : `L|${l.idPac}|${isoDia(l.data)}|${chaveTitulo(l.titulo)}`;
const chavesDaLinha = (r, l) => [chaveMVDecisao(r), chaveLaudoDecisao(l)].filter(Boolean);

function indiceDecisoes(ncs, considerar) {
  const m = new Map();
  for (const d of considerar || []) for (const k of d.chaves) m.set(k, { tipo: TIPOS_DECISAO[d.tipo] && d.tipo !== 'nc' ? d.tipo : 'considerar', id: d.id, justificativa: d.justificativa, por: d.por, em: d.em });
  for (const nc of ncs || []) {
    if (nc.situacao === 'nao-procede') continue;
    for (const k of nc.origem?.chavesLinha || []) m.set(k, { tipo: 'nc', ncId: nc.id, natureza: nc.natureza, situacao: nc.situacao, por: nc.criadaPor, em: nc.criadaEm });
  }
  return m;
}
const decisaoDaLinha = (idx, r, l) => chavesDaLinha(r, l).map(k => idx.get(k)).find(Boolean) || null;
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
  : rodada.linhas.filter(l => !linhaResolvida(l) && !idx.has(l.kd) && !(l.kl && idx.has(l.kl)));
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
const observacoesDaLinha = (idx, r, l) => { const vistos = new Set(), out = []; for (const k of chavesDaLinha(r, l)) for (const o of idx.get(k) || []) if (!vistos.has(o.id)) { vistos.add(o.id); out.push(o); } return out.sort((a, b) => String(a.em).localeCompare(String(b.em))); };
