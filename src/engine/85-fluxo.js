/* ============================================================
 * Fluxo mensal: calendário de dias úteis, modelo de fluxos e competências
 * Módulo de acompanhamento: não altera o MV nem conclui etapas sozinho.
 * ============================================================ */
const SCHEMA_FLUXO = 'repasse-medico/fluxo';
const STATUS_TAREFA = {
  ni: 'Não iniciada', and: 'Em andamento', ter: 'Aguardando terceiros', cor: 'Pendente de correção', ok: 'Concluída', na: 'Não aplicável'
};

/* ---------- Calendário ---------- */
const dataUTC = (a, m, d) => new Date(Date.UTC(a, m - 1, d));
const somaDias = (d, n) => new Date(d.getTime() + n * 86400000);
function pascoa(ano) {   // algoritmo de Meeus/Jones/Butcher
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return dataUTC(ano, mes, dia);
}
// Feriados nacionais (Lei 662/1949, 6.802/1980 e 14.759/2023). Carnaval e Corpus Christi são pontos facultativos:
// entram só se marcados na configuração.
function feriadosNacionais(ano, { carnaval = false, corpusChristi = false } = {}) {
  const p = pascoa(ano);
  const lista = [
    [dataUTC(ano, 1, 1), 'Confraternização Universal'], [somaDias(p, -2), 'Sexta-feira Santa'], [dataUTC(ano, 4, 21), 'Tiradentes'],
    [dataUTC(ano, 5, 1), 'Dia do Trabalho'], [dataUTC(ano, 9, 7), 'Independência'], [dataUTC(ano, 10, 12), 'Nossa Senhora Aparecida'],
    [dataUTC(ano, 11, 2), 'Finados'], [dataUTC(ano, 11, 15), 'Proclamação da República'], [dataUTC(ano, 11, 20), 'Dia Nacional de Zumbi e da Consciência Negra'],
    [dataUTC(ano, 12, 25), 'Natal']
  ];
  if (carnaval) lista.push([somaDias(p, -48), 'Carnaval (segunda)'], [somaDias(p, -47), 'Carnaval (terça)']);
  if (corpusChristi) lista.push([somaDias(p, 60), 'Corpus Christi']);
  return lista.map(([d, nome]) => ({ data: isoDia(d), nome })).sort((a, b) => a.data.localeCompare(b.data));
}
function calendario(ano, opcoes) {
  const fer = new Map();
  for (const a of [ano - 1, ano, ano + 1]) for (const f of feriadosNacionais(a, opcoes)) fer.set(f.data, f.nome);
  const util = d => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !fer.has(isoDia(d));
  return {
    util, feriado: d => fer.get(isoDia(d)) || '',
    nUtil(mes, n) { let d = dataUTC(ano, mes, 1), c = 0; while (d.getUTCMonth() === mes - 1) { if (util(d) && ++c === n) return d; d = somaDias(d, 1); } return null; },
    ultimoUtil(mes) { let d = dataUTC(ano, mes + 1, 0); while (!util(d)) d = somaDias(d, -1); return d; },
    ajustar(d, sentido) { if (!d || sentido === 'nenhum') return d; while (!util(d)) d = somaDias(d, sentido === 'posterior' ? 1 : -1); return d; }
  };
}

/* Regras de prazo (nunca datas fixas no código):
 *  {tipo:'diaUtil', n} · {tipo:'ultimoDiaUtil'} · {tipo:'diaDoMes', dia, ajuste:'anterior'|'posterior'|'nenhum'}
 *  {tipo:'antesDe', marco, dias, ajuste} (dias corridos antes de outro marco) · {tipo:'menorDe', marcos:[…]} · {tipo:'marco', marco} · {tipo:'manual'} */
function descreverRegra(r, marcos = []) {
  const nome = id => marcos.find(m => m.id === id)?.nome || id;
  if (!r || r.tipo === 'manual') return 'manual';
  if (r.tipo === 'diaUtil') return `${r.n}º dia útil`;
  if (r.tipo === 'ultimoDiaUtil') return 'último dia útil';
  if (r.tipo === 'diaDoMes') return `dia ${r.dia}${r.ajuste === 'anterior' ? ' (dia útil anterior se não útil)' : r.ajuste === 'posterior' ? ' (dia útil seguinte se não útil)' : ''}`;
  if (r.tipo === 'antesDe') return `${r.dias} dias corridos antes de «${nome(r.marco)}»`;
  if (r.tipo === 'menorDe') return `o que vier primeiro: ${r.marcos.map(nome).join(' / ')}`;
  if (r.tipo === 'marco') return `= «${nome(r.marco)}»`;
  return '—';
}
// Calcula todos os marcos de uma competência (mês de trabalho), respeitando dependências entre eles.
function calcularMarcos(modelo, ano, mes, opcoesCal, manuais = {}) {
  const cal = calendario(ano, opcoesCal), out = {}, emCalculo = new Set();
  const calc = id => {
    if (out[id] !== undefined) return out[id];
    const m = modelo.marcos.find(x => x.id === id); if (!m) return null;
    if (manuais[id]?.data) return (out[id] = paraData(manuais[id].data));
    if (emCalculo.has(id)) return null; emCalculo.add(id);
    out[id] = dataRegra(m.regra);
    return out[id];
  };
  const dataRegra = r => {
    if (!r) return null;
    switch (r.tipo) {
      case 'diaUtil': return cal.nUtil(mes, +r.n);
      case 'ultimoDiaUtil': return cal.ultimoUtil(mes);
      case 'diaDoMes': return cal.ajustar(dataUTC(ano, mes, Math.min(+r.dia, new Date(Date.UTC(ano, mes, 0)).getUTCDate())), r.ajuste || 'anterior');
      case 'antesDe': { const b = calc(r.marco); return b ? cal.ajustar(somaDias(b, -(+r.dias)), r.ajuste || 'anterior') : null; }
      case 'menorDe': { const ds = r.marcos.map(calc).filter(Boolean); return ds.length ? new Date(Math.min(...ds.map(d => d.getTime()))) : null; }
      case 'marco': return calc(r.marco);
      default: return null;
    }
  };
  for (const m of modelo.marcos) calc(m.id);
  return { datas: out, prazoDe: r => dataRegra(r), cal };
}

/* ---------- Modelo padrão (especificação de 29/10/2026) ---------- */
const TF = (id, nome, prazo = null, extra = {}) => ({ id, nome, prazo, ...extra });
const DU = n => ({ tipo: 'diaUtil', n }), MK = marco => ({ tipo: 'marco', marco });
function modeloFluxoPadrao() {
  return {
    schema: SCHEMA_FLUXO + '/modelo', versaoSchema: 1, revisao: 1, atualizadoEm: agoraISO(),
    calendario: { carnaval: false, corpusChristi: false, antecedenciaDias: 5 },
    marcos: [
      { id: 'fechUSG', nome: 'Fechamento USG (geração no MV)', regra: DU(5) },
      { id: 'pagUSG', nome: 'Pagamento USG', regra: { tipo: 'diaDoMes', dia: 15, ajuste: 'anterior' } },
      { id: 'envioUSG', nome: 'Envio de relatórios USG', regra: { tipo: 'antesDe', marco: 'pagUSG', dias: 5, ajuste: 'anterior' } },
      { id: 'ecoEudes', nome: 'Ecodoppler Dr. Eudes', regra: DU(9) },
      { id: 'ncUSG', nome: 'NCs de USG', regra: DU(15) },
      { id: 'inicioIMG', nome: 'Início da classificação / IMG', regra: DU(15) },
      { id: 'fimCuritiba', nome: 'Curitiba — finalizar e enviar', regra: DU(20) },
      { id: 'pagIMG', nome: 'Pagamento IMG', regra: { tipo: 'ultimoDiaUtil' } },
      { id: 'envioIMG', nome: 'Envio de relatórios IMG', regra: { tipo: 'antesDe', marco: 'pagIMG', dias: 5, ajuste: 'anterior' } },
      { id: 'ncIMG', nome: 'NCs de IMG e demais', regra: { tipo: 'ultimoDiaUtil' } },
      { id: 'pagCuritiba', nome: 'Pagamento Curitiba', regra: { tipo: 'ultimoDiaUtil' } },
      { id: 'envioCuritiba', nome: 'Envio de relatórios Curitiba', regra: { tipo: 'menorDe', marcos: ['fimCuritiba', 'antesPagCuritiba'] } },
      { id: 'antesPagCuritiba', nome: 'Curitiba — 5 dias antes do pagamento', regra: { tipo: 'antesDe', marco: 'pagCuritiba', dias: 5, ajuste: 'anterior' }, oculto: true },
      { id: 'pagSedacao', nome: 'Pagamento Sedação', regra: { tipo: 'ultimoDiaUtil' } },
      { id: 'envioSedacao', nome: 'Envio de relatórios Sedação', regra: { tipo: 'antesDe', marco: 'pagSedacao', dias: 5, ajuste: 'anterior' } }
    ],
    grupos: [
      { id: 'prep', nome: 'Preparação do mês', desc: 'Apolo · regras dos prestadores · relatórios das máquinas · PET-CT · ecodoppler', tarefas: [
        TF('apoloSol', 'Solicitar a planilha de laudos do Apolo (Jhonas, e-mail)', DU(1), { responsavel: 'Jhonas' }),
        TF('apoloRec', 'Receber a planilha de laudos do Apolo', DU(2), { depende: ['apoloSol'], responsavel: 'Jhonas' }),
        TF('regras', 'Trocar regras dos prestadores: classe → Ultrassonografia', DU(1)),
        TF('marianaSol', 'Solicitar relatório da máquina — Dra. Mariana (25%)', DU(1), { responsavel: 'Dra. Mariana' }),
        TF('marianaRec', 'Receber relatório da máquina — Dra. Mariana (25%)', DU(3), { depende: ['marianaSol'], responsavel: 'Dra. Mariana' }),
        TF('pauloSol', 'Solicitar relatório da máquina — Dr. Paulo (20%)', DU(1), { responsavel: 'Dr. Paulo' }),
        TF('pauloRec', 'Receber relatório da máquina — Dr. Paulo (20%)', DU(3), { depende: ['pauloSol'], responsavel: 'Dr. Paulo' }),
        TF('pet', 'Conferência de PET-CT (laudos × Power BI) — anotar se manual ou via ferramenta', { tipo: 'manual' }, { depende: ['apoloRec'], vinculo: 'conferencia' }),
        TF('ecoCalc', 'Repasse de ecodopplercardiograma — Dr. Eudes (unidade 10)', MK('ecoEudes'), { depende: ['apoloRec'] }),
        TF('ecoConf', 'Conferência do ecodopplercardiograma', MK('ecoEudes'), { depende: ['ecoCalc'] })] },
      { id: 'usg', nome: 'Repasse de Ultrassonografia (USG)', desc: 'fechamento no 5º dia útil · pagamento no dia 15', documental: true, tarefas: [
        TF('confData', 'Confirmar data de fechamento (WhatsApp corporativo)', DU(4)),
        TF('gerar', 'Gerar o repasse de USG no MV (marco: fecha os valores)', MK('fechUSG'), { marco: true }),
        TF('conf', 'Conferência dos valores e procedimentos', null, { depende: ['gerar'], vinculo: 'conferencia' }),
        TF('diverg', 'Identificação das divergências', null, { depende: ['conf'] }),
        TF('corr', 'Correções necessárias', null, { depende: ['diverg'] }),
        TF('valid', 'Validação final para envio', MK('envioUSG'), { depende: ['corr'] }),
        TF('envio', 'Envio dos relatórios e prévias', MK('envioUSG'), { depende: ['valid'] }),
        TF('nf', 'Notas fiscais e encaminhamento ao Financeiro', MK('pagUSG'), { depende: ['envio'] })] },
      { id: 'classif', nome: 'Classificação dos prestadores por produção', desc: 'produção bruta de USG → classes A/B/C/D (registradas manualmente)', classificacao: true, tarefas: [
        TF('apurar', 'Apurar a produção bruta de USG por prestador', MK('inicioIMG')),
        TF('conferir', 'Conferir valores e base de cálculo', null, { depende: ['apurar'] }),
        TF('classificar', 'Classificar cada prestador (A, B, C ou D)', null, { depende: ['conferir'] }),
        TF('registrar', 'Registrar a classificação da competência', null, { depende: ['classificar'] }),
        TF('validar', 'Validar: todos os prestadores com classe definida', null, { depende: ['registrar'] }),
        TF('liberar', 'Liberar a geração do repasse de IMG', null, { depende: ['validar'] })] },
      { id: 'img', nome: 'Repasse de IMG — demais modalidades', desc: 'todas as unidades, exceto Curitiba · pagamento no último dia útil', documental: true,
        matriz: { colunas: ['Gerado', 'Prestador genérico', 'Correção no MV', 'Conferência', 'NCs', 'Envio'], excetoUnidades: ['5'] }, tarefas: [
          TF('gerar', 'Gerar os repasses dos prestadores no MV', MK('inicioIMG'), { depende: ['classif.liberar'] }),
          TF('generico', 'Identificar relatórios com prestador genérico', null, { depende: ['gerar'] }),
          TF('processar', 'Extrair o relatório do prestador genérico e processar na Correção de prestador', null, { depende: ['generico'], vinculo: 'correcao' }),
          TF('investigar', 'Investigar manualmente os não identificados', null, { depende: ['processar'] }),
          TF('corrigirMV', 'Corrigir os prestadores no MV', null, { depende: ['investigar'] }),
          TF('individuais', 'Gerar os relatórios individuais (após as correções)', null, { depende: ['corrigirMV'] }),
          TF('cruzada', 'Conferência Cruzada dos relatórios individuais', null, { depende: ['individuais'], vinculo: 'conferencia' }),
          TF('analise', 'Análise e investigação das divergências', null, { depende: ['cruzada'] }),
          TF('devolutivas', 'Correções e devolutivas', null, { depende: ['analise'] }),
          TF('validacao', 'Validação final dos valores de repasse', MK('envioIMG'), { depende: ['devolutivas'] }),
          TF('envio', 'Preparação e envio dos relatórios e prévias', MK('envioIMG'), { depende: ['validacao'] }),
          TF('nf', 'Notas fiscais e encaminhamento ao Financeiro', MK('pagIMG'), { depende: ['envio'] })] },
      { id: 'curitiba', nome: 'Repasse de Curitiba', desc: 'fluxo próprio, sem separação USG/IMG · até o 20º dia útil', documental: true, tarefas: [
        TF('gerar', 'Preparação e geração dos repasses', null),
        TF('conf', 'Conferência dos dados', null, { depende: ['gerar'] }),
        TF('prest', 'Correções de prestadores, quando necessárias', null, { depende: ['conf'], vinculo: 'correcao' }),
        TF('cruzada', 'Conferência Cruzada', null, { depende: ['conf'], vinculo: 'conferencia' }),
        TF('analise', 'Análise das divergências e causas', null, { depende: ['cruzada'] }),
        TF('nc', 'Tratamento das não conformidades', null, { depende: ['analise'] }),
        TF('valid', 'Validação final', MK('envioCuritiba'), { depende: ['analise'] }),
        TF('envio', 'Envio dos relatórios e prévias por e-mail', MK('envioCuritiba'), { depende: ['valid'] }),
        TF('nf', 'Notas fiscais e encaminhamento ao Financeiro', MK('pagCuritiba'), { depende: ['envio'] })] },
      { id: 'sedacao', nome: 'Repasse de Sedação', desc: 'pagamento no último dia útil · prazo próprio, não o de USG', documental: true,
        regrasFixas: ['Não repassar UNIMED dos anestesistas das unidades 17 e 2.'], tarefas: [
          TF('prep', 'Preparação do repasse', null),
          TF('conf', 'Conferência da produção', null, { depende: ['prep'] }),
          TF('valores', 'Validação dos valores', null, { depende: ['conf'] }),
          TF('diverg', 'Divergências e não conformidades', null, { depende: ['valores'] }),
          TF('envio', 'Envio dos relatórios e prévias', MK('envioSedacao'), { depende: ['valores'] }),
          TF('nf', 'Controle das notas fiscais', MK('pagSedacao'), { depende: ['envio'] }),
          TF('fin', 'Encaminhamento ao Financeiro', MK('pagSedacao'), { depende: ['nf'] })] },
      { id: 'nc', nome: 'Não conformidades', desc: 'documentação e envio por modalidade — não bloqueiam os demais repasses', tarefas: [
        TF('usg', 'Documentar e enviar as NCs de USG (após o fechamento de USG)', MK('ncUSG'), { depende: ['usg.gerar'] }),
        TF('img', 'Documentar e enviar as NCs de IMG e demais modalidades', MK('ncIMG')),
        TF('curitiba', 'Documentar e enviar as NCs de Curitiba', MK('fimCuritiba')),
        TF('sedacao', 'Documentar e enviar as NCs de Sedação', MK('pagSedacao'))] }
    ],
    prestadores: {}   // grupoId → [{cod, nome, unidade}] : lista fixa por fluxo, copiada para cada competência
  };
}

/* ---------- Competência ---------- */
const chaveCompetencia = (ano, mes) => `${ano}-${String(mes).padStart(2, '0')}`;
const rotuloCompetencia = k => `${k.slice(5)}/${k.slice(0, 4)}`;
function novaCompetencia(modelo, chave, operador = '') {
  const grupos = {};
  for (const g of modelo.grupos.filter(g => g.ativo !== false)) {
    grupos[g.id] = {
      tarefas: Object.fromEntries(g.tarefas.map(t => [t.id, { status: 'ni', inicio: '', conclusao: '', responsavel: t.responsavel || '', obs: '', prazoManual: '', historico: [] }])),
      obs: '',
      documental: g.documental ? Object.fromEntries((modelo.prestadores[g.id] || []).map(p => [p.cod, novoDocumental(p)])) : null,
      classificacao: g.classificacao ? {} : null,
      matriz: g.matriz ? {} : null
    };
  }
  // A competência guarda uma cópia do modelo: mudanças futuras no modelo não alteram o histórico.
  return { schema: SCHEMA_FLUXO + '/competencia', versaoSchema: 1, chave, criadaEm: agoraISO(), criadaPor: operador, modelo: clone(modelo), grupos, marcosManuais: {}, anotacoes: [] };
}
const novoDocumental = p => ({ cod: String(p.cod), nome: p.nome || '', unidade: p.unidade || '', relatorio: '', nfRecebida: '', nfFinanceiro: '', pendencia: '' });

function marcosDaCompetencia(comp) {
  const [ano, mes] = comp.chave.split('-').map(Number);
  return calcularMarcos(comp.modelo, ano, mes, comp.modelo.calendario, comp.marcosManuais);
}
function prazoTarefa(comp, gId, t, mk) {
  const est = comp.grupos[gId]?.tarefas[t.id];
  if (est?.prazoManual) return paraData(est.prazoManual);
  return t.prazo ? mk.prazoDe(t.prazo) : null;
}
function mudarStatusTarefa(comp, gId, tId, novo, operador = '') {
  const est = comp.grupos[gId].tarefas[tId];
  if (!STATUS_TAREFA[novo] || est.status === novo) return false;
  const hoje = isoDia(new Date());
  est.historico.push({ em: agoraISO(), por: operador, de: est.status, para: novo });
  if (novo !== 'ni' && !est.inicio) est.inicio = hoje;
  if (novo === 'ok' && !est.conclusao) est.conclusao = hoje;
  if (novo !== 'ok') est.conclusao = '';
  est.status = novo;
  return true;
}

/* ---------- Indicadores ---------- */
function indicadoresFluxo(comp, hoje = new Date()) {
  const mk = marcosDaCompetencia(comp), h = diaSerial(paraData(hoje)), r = { total: 0, ok: 0, and: 0, ter: 0, cor: 0, ni: 0, na: 0, vencidas: [], proximas: [], porGrupo: {} };
  for (const g of comp.modelo.grupos) {
    const eg = comp.grupos[g.id]; if (!eg) continue;
    const pg = { total: 0, ok: 0, status: 'ni', proximoPrazo: null, vencidas: 0 };
    for (const t of g.tarefas) {
      const e = eg.tarefas[t.id]; if (!e) continue;
      r[e.status]++;
      if (e.status === 'na') continue;
      r.total++; pg.total++; if (e.status === 'ok') { r.ok++; pg.ok++; continue; }
      const p = prazoTarefa(comp, g.id, t, mk); if (!p) continue;
      const dif = diaSerial(p) - h, item = { grupo: g.id, grupoNome: g.nome, tarefa: t.id, nome: t.nome, prazo: p, dias: dif };
      if (dif < 0) { r.vencidas.push(item); pg.vencidas++; } else if (dif <= 3) r.proximas.push(item);
      if (!pg.proximoPrazo || p < pg.proximoPrazo.prazo) pg.proximoPrazo = item;
    }
    const sts = g.tarefas.map(t => eg.tarefas[t.id]?.status).filter(s => s && s !== 'na');
    pg.status = !sts.length ? 'na' : sts.every(s => s === 'ok') ? 'ok' : sts.includes('cor') ? 'cor' : sts.includes('ter') ? 'ter' : sts.some(s => s !== 'ni') ? 'and' : 'ni';
    r.porGrupo[g.id] = pg;
  }
  // Documental: envio, NF recebida e NF encaminhada são contados separadamente (nunca deduzidos um do outro).
  const docs = Object.entries(comp.grupos).flatMap(([gid, eg]) => Object.values(eg.documental || {}).map(d => ({ ...d, grupo: gid })));
  r.doc = {
    previstos: docs.length, enviados: docs.filter(d => d.relatorio).length, nfRecebidas: docs.filter(d => d.nfRecebida).length,
    nfFinanceiro: docs.filter(d => d.nfFinanceiro).length, incompletos: docs.filter(d => !(d.relatorio && d.nfRecebida && d.nfFinanceiro)).length, lista: docs
  };
  r.marcos = comp.modelo.marcos.filter(m => !m.oculto).map(m => ({ ...m, data: mk.datas[m.id], manual: !!comp.marcosManuais[m.id]?.data, justificativa: comp.marcosManuais[m.id]?.justificativa || '' }))
    .filter(m => m.data).sort((a, b) => a.data - b.data);
  r.mk = mk;
  return r;
}

// Rodadas da ferramenta que podem evidenciar uma etapa (só sugestão: o usuário confirma).
function rodadasParaTarefa(rodadas, comp, vinculo) {
  if (!vinculo) return [];
  return rodadas.filter(r => r.tipo === vinculo && competenciaDaRodada(r) === comp.chave).sort((a, b) => b.em.localeCompare(a.em));
}

function validarFluxo(dados) {
  if (!dados || dados.schema !== SCHEMA_FLUXO) return ['arquivo não é um fluxo do Repasse Médico'];
  const e = [];
  if (!dados.modelo || !Array.isArray(dados.modelo.grupos) || !Array.isArray(dados.modelo.marcos)) e.push('modelo de fluxo inválido');
  if (typeof dados.competencias !== 'object') e.push('competências inválidas');
  return e;
}
