/* ============================================================
 * v3.0 — Backup completo, versionado e verificável.
 * Partes: configuração compartilhada (Bases, regras, parâmetros, pastas, modelos de exportação), equivalências,
 * fluxo mensal, registro das competências, controle de prestadores por unidade, preferências de quem exportou,
 * e, quando marcado, não conformidades (dados de pacientes) e rodadas.
 * Cada parte leva a sua impressão digital: arquivo truncado ou editado à mão é recusado antes de restaurar.
 * ============================================================ */
const VERSAO_BACKUP = 2;
const PARTES_BACKUP = {
  configuracao: 'Configuração (Bases, regras, parâmetros, pastas e modelos de exportação)',
  equivalencias: 'Equivalências TUSS e regras compostas',
  fluxo: 'Fluxo mensal',
  competencias: 'Competências (abertas/fechadas e alterações)',
  controleUnidades: 'Controle de prestadores por unidade',
  preferencias: 'Preferências de quem exportou (tema, cor, menu)',
  nc: 'Não conformidades (contém nomes de pacientes)',
  rodadas: 'Rodadas de conferência e correção'
};
const hashParte = v => hashTexto(JSON.stringify(v ?? null)) + ':' + JSON.stringify(v ?? null).length;
function montarBackup(partes, meta = {}) {
  const b = { schema: SCHEMA_BACKUP, versaoSchema: VERSAO_BACKUP, exportadoEm: agoraISO(), motor: MOTOR_VERSAO, ...meta, partes: [], integridade: {} };
  for (const [k, v] of Object.entries(partes)) {
    if (v === undefined || !PARTES_BACKUP[k]) continue;
    b[k] = clone(v); b.partes.push(k); b.integridade[k] = hashParte(b[k]);   // cópia: o backup não muda com o estado depois
  }
  return b;
}
// Resumo legível de cada parte (para a prévia antes de restaurar).
function resumoParteBackup(k, v) {
  if (!v) return '';
  if (k === 'configuracao') return `revisão ${v.revisao ?? '—'} · ${(v.unidades || []).length} unidades · ${(v.prestadores || []).length} prestadores · ${(v.faturistas || []).length} faturistas`;
  if (k === 'equivalencias') return `revisão ${v.revisao ?? '—'} · ${(v.itens || []).filter(e => e.status === 'validada').length} validadas · ${(v.itens || []).filter(e => e.status === 'pendente').length} pendentes · ${(v.compostas || []).length} regras compostas`;
  if (k === 'fluxo') return `${Object.keys(v.competencias || {}).length} competência(s)`;
  if (k === 'competencias') return `${Object.keys(v.itens || {}).length} competência(s) registradas`;
  if (k === 'controleUnidades') return `${Object.keys(v || {}).length} competência(s)`;
  if (k === 'nc') return `${(v.itens || []).length} NC(s)`;
  if (k === 'rodadas') return `${(v || []).length} rodada(s)`;
  if (k === 'preferencias') return Object.keys(v).join(', ');
  return '';
}
// a > b? «3.0.0-alpha.2» > «3.0.0-alpha.1» > «2.1.0-alpha.19»; versão final > pré-versão com o mesmo número.
function versaoMaior(a, b) {
  const p = s => { const [nucleo, pre] = String(s || '0').split('-'); return { n: nucleo.split('.').map(x => +x || 0), pre: pre === undefined ? null : pre.split('.').map(x => (/^\d+$/.test(x) ? +x : x)) }; };
  const A = p(a), B = p(b);
  for (let i = 0; i < 3; i++) if ((A.n[i] || 0) !== (B.n[i] || 0)) return (A.n[i] || 0) > (B.n[i] || 0);
  if (!A.pre || !B.pre) return !A.pre && !!B.pre;
  for (let i = 0; i < Math.max(A.pre.length, B.pre.length); i++) {
    const x = A.pre[i], y = B.pre[i]; if (x === y) continue; if (x === undefined) return false; if (y === undefined) return true;
    if (typeof x === typeof y) return x > y; return typeof x === 'string';
  }
  return false;
}
/* Valida antes de qualquer restauração. validadores: {configuracao: fn, equivalencias: fn, fluxo: fn, competencias: fn, nc: fn}
 * (cada um devolve lista de erros). Devolve {erros, avisos, partes:[{k, nome, resumo, ok, erros}]}. */
function validarBackup(b, validadores = {}) {
  const erros = [], avisos = [], partes = [];
  if (!b || b.schema !== SCHEMA_BACKUP) return { erros: ['o arquivo não é um backup do Repasse Médico'], avisos, partes };
  if (![1, VERSAO_BACKUP].includes(b.versaoSchema)) erros.push(`versão de backup ${b.versaoSchema} não suportada por esta versão da ferramenta`);
  if (b.motor && versaoMaior(b.motor, MOTOR_VERSAO)) avisos.push(`backup gerado por uma versão mais nova (${b.motor}); esta é a ${MOTOR_VERSAO}. Atualize a ferramenta antes de restaurar, se possível.`);
  const lista = b.versaoSchema === 1 ? Object.keys(PARTES_BACKUP).filter(k => b[k] !== undefined) : (b.partes || []);
  if (b.versaoSchema === 1) avisos.push('backup no formato antigo (v1): sem verificação de integridade por parte.');
  for (const k of lista) {
    if (!PARTES_BACKUP[k]) continue;
    const v = b[k], pe = [];
    if (v === undefined) pe.push('parte listada, mas ausente do arquivo (arquivo incompleto)');
    else {
      if (b.versaoSchema === VERSAO_BACKUP && b.integridade?.[k] !== hashParte(v)) pe.push('impressão digital não confere (arquivo incompleto ou alterado)');
      if (validadores[k]) pe.push(...validadores[k](v));
      if (k === 'rodadas' && !Array.isArray(v)) pe.push('lista de rodadas inválida');
    }
    partes.push({ k, nome: PARTES_BACKUP[k], resumo: resumoParteBackup(k, v), ok: !pe.length, erros: pe });
  }
  if (!partes.length) erros.push('o backup não tem nenhuma parte reconhecida');
  return { erros, avisos, partes };
}
// Nome do arquivo: data e hora, quem gravou e se foi automático (para a limpeza só mexer nos automáticos).
const nomeArquivoBackup = (operador, auto) => `backup_repasse_${carimboBackup()}_${nomeSeguroBackup(operador || 'sem-operador')}${auto ? '_auto' : ''}.json`;
const carimboBackup = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`; };
const nomeSeguroBackup = s => norm(s).replace(/\s+/g, '_').slice(0, 40) || 'x';
