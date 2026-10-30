/* ============================================================
 * Competência: mês de trabalho (produção + 1) escolhido no topo e válido para todas as abas.
 * - Ficam dentro dela: rodadas, NCs, fluxo mensal e anotações.
 * - Bases e equivalências valem para todas; cada alteração registra a competência em que foi feita.
 * - Fechada = somente leitura. Reabrir exige justificativa e fica no histórico.
 * ============================================================ */
const SCHEMA_COMP = 'repasse-medico/competencias';
const registroCompetenciasVazio = () => ({ schema: SCHEMA_COMP, versaoSchema: 1, itens: {} });
const validarRegistroCompetencias = r => !r || r.schema !== SCHEMA_COMP || typeof r.itens !== 'object' ? ['registro de competências inválido'] : [];
const estadoCompetencia = (reg, chave) => reg.itens[chave] || { status: 'aberta', historico: [], alteracoes: [] };
const itemCompetencia = (reg, chave) => reg.itens[chave] || (reg.itens[chave] = { status: 'aberta', historico: [], alteracoes: [] });
const competenciaFechada = (reg, chave) => reg.itens[chave]?.status === 'fechada';

function fecharCompetencia(reg, chave, por, obs = '') {
  const c = itemCompetencia(reg, chave);
  if (c.status === 'fechada') return false;
  Object.assign(c, { status: 'fechada', fechadaEm: agoraISO(), fechadaPor: por });
  c.historico.push({ em: c.fechadaEm, por, acao: 'fechada', obs });
  return true;
}
function reabrirCompetencia(reg, chave, por, justificativa) {
  if (!String(justificativa || '').trim()) throw new Error('Informe a justificativa para reabrir a competência.');
  const c = itemCompetencia(reg, chave);
  if (c.status !== 'fechada') return false;
  c.status = 'aberta'; c.fechadaEm = ''; c.fechadaPor = '';
  c.historico.push({ em: agoraISO(), por, acao: 'reaberta', obs: justificativa.trim() });
  return true;
}
// Alterações nas bases (que valem para todas as competências) ficam registradas onde foram feitas.
function registrarAlteracao(reg, chave, por, tipo, descricao) {
  const c = itemCompetencia(reg, chave);
  c.alteracoes.push({ em: agoraISO(), por, tipo, descricao });
  if (c.alteracoes.length > 500) c.alteracoes.splice(0, c.alteracoes.length - 500);
}
const TIPOS_ALTERACAO = { equivalencias: 'Equivalências TUSS', aliases: 'Aliases de prestador', prestadores: 'Prestadores', faturistas: 'Faturistas', unidades: 'Unidades', regras: 'Regras de classificação', parametros: 'Parâmetros', configuracao: 'Configuração' };
function tipoDaAlteracao(texto) {
  const n = norm(texto);
  return /FATURISTA/.test(n) ? 'faturistas' : /ALIAS/.test(n) ? 'aliases' : /PRESTADOR/.test(n) ? 'prestadores' : /UNIDADE/.test(n) ? 'unidades'
    : /REGRA/.test(n) ? 'regras' : /PARAMETRO/.test(n) ? 'parametros' : /EQUIVALENCIA|RELAC/.test(n) ? 'equivalencias' : 'configuracao';
}

/* ---------- Produção esperada × arquivos carregados ---------- */
const producaoEsperada = chave => competenciaVizinha(chave, -1);
// Mês com mais datas (AAAA-MM) e a parcela dele no total.
function mesDominante(datas) {
  const v = datas.filter(Boolean); if (!v.length) return null;
  const [mes, n] = [...contar(v, d => isoDia(d).slice(0, 7))].sort((a, b) => b[1] - a[1])[0];
  return { mes, parcela: n / v.length };
}
function conferirProducao(datas, chave) {
  const dom = mesDominante(datas), esperado = producaoEsperada(chave);
  if (!dom) return { estado: 'sem-data', esperado, encontrado: '' };
  return { estado: dom.mes === esperado ? 'ok' : 'outro', esperado, encontrado: dom.mes, parcela: dom.parcela };
}
const rotuloMes = m => m ? `${m.slice(5)}/${m.slice(0, 4)}` : '—';
// Competência de uma rodada: a escolhida no topo quando ela foi executada (rodadas antigas: mês da execução).
const competenciaDaRodada = r => r.chaveCompetencia || (r.em ? r.em.slice(0, 7) : '');
