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
const TIPOS_DECISAO = { nc: 'Tratado: NC', considerar: 'Considerado no repasse', dispensado: 'Laudo dispensado' };
const chaveMVDecisao = r => r ? `M|${r.conta}|${r.atendimento}|${r.codigo}|${isoDia(r.data)}` : '';
const chaveLaudoDecisao = l => !l ? '' : l.idLaudo ? `L|${l.idLaudo}` : `L|${l.idPac}|${isoDia(l.data)}|${chaveTitulo(l.titulo)}`;
const chavesDaLinha = (r, l) => [chaveMVDecisao(r), chaveLaudoDecisao(l)].filter(Boolean);

function indiceDecisoes(ncs, considerar) {
  const m = new Map();
  for (const d of considerar || []) for (const k of d.chaves) m.set(k, { tipo: d.tipo === 'dispensado' ? 'dispensado' : 'considerar', id: d.id, justificativa: d.justificativa, por: d.por, em: d.em });
  for (const nc of ncs || []) {
    if (nc.situacao === 'nao-procede') continue;
    for (const k of nc.origem?.chavesLinha || []) m.set(k, { tipo: 'nc', ncId: nc.id, natureza: nc.natureza, situacao: nc.situacao, por: nc.criadaPor, em: nc.criadaEm });
  }
  return m;
}
const decisaoDaLinha = (idx, r, l) => chavesDaLinha(r, l).map(k => idx.get(k)).find(Boolean) || null;
function aplicarDecisoes(res, idx) {
  const n = { nc: 0, considerar: 0, dispensado: 0 };
  for (const x of res.linhas) { x.decisao = decisaoDaLinha(idx, x.r, x.l); if (x.decisao) n[x.decisao.tipo]++; }
  res.porDecisao = n;
  return res;
}
function registrarConsiderar(reg, chave, chaves, justificativa, por, resumo = {}, tipo = 'considerar') {
  if (!String(justificativa || '').trim()) throw new Error(tipo === 'dispensado' ? 'Informe a justificativa para dispensar o laudo.' : 'Informe a justificativa para considerar a linha no repasse.');
  const c = itemCompetencia(reg, chave);
  c.decisoes = c.decisoes || [];
  const d = { id: novoId('dec'), chaves, justificativa: justificativa.trim(), por, em: agoraISO(), resumo, ...(tipo === 'dispensado' ? { tipo } : {}) };
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
const pendenciasDaRodada = (rodada, idx) => rodada.linhas.filter(l => !linhaResolvida(l) && !idx.has(l.kd) && !(l.kl && idx.has(l.kl)));
