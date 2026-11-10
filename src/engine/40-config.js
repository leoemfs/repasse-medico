/* ============================================================
 * Configuração versionada: parâmetros, unidades, prestadores e
 * regras de classificação do tipo de item. Tudo editável na tela,
 * exportável em JSON e validado antes de importar (RN-215).
 * ============================================================ */
const SCHEMA_CONFIG = 'repasse-medico/configuracao';
const SCHEMA_EQ = 'repasse-medico/equivalencias';
const SCHEMA_BACKUP = 'repasse-medico/backup';

const TIPOS_ITEM = {
  procedimento: 'Procedimento / exame',
  hm: 'HM / honorário médico',
  taxa: 'Taxa',
  medicamento: 'Medicamento',
  material: 'Material / insumo',
  pacote: 'Pacote / agrupador',
  outro: 'Serviço administrativo / outro',
  desconhecido: 'Desconhecido — pendente de classificação'
};

// Padrões adotados (editáveis). A ordem importa: a primeira regra que casar define o tipo.
const CLASSIFICACAO_PADRAO = [
  { id: 'hm-sufixo', campo: 'descricao', padrao: '(^|\\s)-\\s*HM\\s*$', tipo: 'hm', nota: 'Descrição termina em «- HM»' },
  { id: 'hm-grupo', campo: 'grupo', padrao: 'HONORARIO', tipo: 'hm', nota: 'Grupo de honorários médicos (ex.: LAUDO URGENTE, 2ª via)' },
  { id: 'medicamento', campo: 'grupo', padrao: 'MEDICAMENTO', tipo: 'medicamento', nota: '' },
  { id: 'material', campo: 'grupo', padrao: 'MATERIA', tipo: 'material', nota: 'Materiais descartáveis e kits' },
  { id: 'pacote', campo: 'grupo', padrao: 'PACOTE', tipo: 'pacote', nota: '' },
  { id: 'taxa', campo: 'descricao', padrao: '\\bTAXA\\b|SEDACAO', tipo: 'taxa', nota: 'Taxas e sedação cobradas à parte' },
  { id: 'exames', campo: 'grupo', padrao: 'ULTRASSONOGRAFIA|TOMOGRAFIA|RESSONANCIA|RADIOLOGIA|MAMOGRAFIA|DENSITOMETRIA|ECOCARDIOGRAMA', tipo: 'procedimento', nota: 'Grupos de diagnóstico por imagem' }
].map(r => ({ ...r, ativa: true }));

const UNIDADES_PADRAO = [
  { cod: '1', nome: 'ULTRAMED APUCARANA (HPA)', apolo: ['GrupoSRA HPA'], pbi: '1 - ULTRAMED APUCARANA', empresa: 'SRA' },
  { cod: '2', nome: 'ALPHASONIC JACAREZINHO', apolo: ['GrupoSRA Jacarezinho'], pbi: '2 - ALPHASONIC - JACAREZINHO', empresa: 'SRA' },
  { cod: '4', nome: 'ULTRAMED CAMBÉ', apolo: ['Ultramed Cambe'], pbi: '4 - ULTRAMED CAMBE', empresa: 'STA' },
  { cod: '5', nome: 'ALPHASONIC CURITIBA', apolo: ['AlphaSonic Curitiba'], pbi: '5 - ALPHASONIC CURITIBA', empresa: 'V3' },
  { cod: '7', nome: 'ULTRAMED ARAPONGAS', apolo: ['Ultramed Arapongas Filial'], pbi: '7 - ULTRAMED ARAPONGAS FILIAL', empresa: 'SI2M' },
  { cod: '10', nome: 'ALPHASONIC APUCARANA', apolo: ['AlphaSonic Apucarana'], pbi: '10 - ALPHASONIC APUCARANA', empresa: 'SRA' },
  { cod: '11', nome: 'ULTRASONIC LONDRINA', apolo: [], pbi: '11 - ULTRASONIC LONDRI PR', empresa: '' },
  { cod: '17', nome: 'ALPHASONIC LONDRINA (PALHANO)', apolo: ['AlphaSonic Palhano', 'MedicalShare'], pbi: '17 - ALPHASONIC LONDRINA', empresa: '' }
];

// Responsáveis pelo fechamento da conta (faturistas). Os genéricos valem para qualquer unidade.
const FATURISTAS_PADRAO = [
  { nome: 'FATURISTA DA UNIDADE', unidades: '', generico: true, ativo: true, origem: 'padrão' },
  { nome: 'PARTICULAR - EQUIPE UNIDADE', unidades: '', generico: true, ativo: true, origem: 'padrão' }
];
const RETENCAO_NC_PADRAO = 60;

function configPadrao() {
  return {
    schema: SCHEMA_CONFIG, versaoSchema: 1, revisao: 1, atualizadoEm: agoraISO(),
    parametros: { tolConferencia: 7, tolCorrecao: 0, minTruncamento: 20, valorSimbolico: 0.01, retencaoNC: RETENCAO_NC_PADRAO, prestadorGenerico: '2' },
    unidades: UNIDADES_PADRAO.map(u => ({ ...clone(u), cnpj: UNIDADES_REGRAS[u.cod]?.cnpj || '', pctUSG: UNIDADES_REGRAS[u.cod]?.pctUSG ? { ...UNIDADES_REGRAS[u.cod].pctUSG } : null })),
    prestadores: [],
    faturistas: clone(FATURISTAS_PADRAO),
    faixasUSG: clone(FAIXAS_USG_PADRAO), classes: classesPadrao(), convenios: [], fechamento: { ...FECHAMENTO_PADRAO },
    classificacao: clone(CLASSIFICACAO_PADRAO)
  };
}

function validarConfig(c) {
  const erros = [];
  if (!c || c.schema !== SCHEMA_CONFIG) erros.push('arquivo não é uma configuração do Repasse Médico');
  else {
    if (c.versaoSchema !== 1) erros.push(`versão de esquema ${c.versaoSchema} não suportada`);
    const p = c.parameters || c.parametros;
    if (!p || [p.tolConferencia, p.tolCorrecao, p.minTruncamento].some(v => !Number.isFinite(+v) || +v < 0)) erros.push('parâmetros ausentes ou inválidos');
    if (!Array.isArray(c.unidades) || c.unidades.some(u => !u.cod)) erros.push('tabela de unidades inválida');
    if (!Array.isArray(c.prestadores)) erros.push('tabela de prestadores inválida');
    if (c.faturistas !== undefined && (!Array.isArray(c.faturistas) || c.faturistas.some(f => !f.nome))) erros.push('tabela de faturistas inválida');
    if (p && p.retencaoNC !== undefined && !(+p.retencaoNC >= 1 && +p.retencaoNC <= 366)) erros.push('retenção de dados das NCs fora de 1 a 366 dias');
    if (c.modelosExportacao !== undefined && (!Array.isArray(c.modelosExportacao) || c.modelosExportacao.some(m => !m || !m.id || !Array.isArray(m.colunas)))) erros.push('modelos de exportação inválidos');
    if (!Array.isArray(c.classificacao)) erros.push('regras de classificação inválidas');
    else for (const r of c.classificacao) { try { new RegExp(r.padrao); } catch (e) { erros.push(`regra «${r.id}» com padrão inválido`); } if (!TIPOS_ITEM[r.tipo]) erros.push(`regra «${r.id}» com tipo desconhecido`); }
    const cods = contar(c.unidades || [], u => String(u.cod));
    for (const [k, n] of cods) if (n > 1) erros.push(`unidade ${k} repetida`);
    const nomesApolo = contar((c.unidades || []).flatMap(u => (u.apolo || []).map(norm)), x => x);
    for (const [k, n] of nomesApolo) if (n > 1) erros.push(`nome do Apolo «${k}» ligado a mais de uma unidade`);
  }
  return erros;
}

// Configurações gravadas por versões anteriores ganham os campos novos sem perder o que o usuário editou.
function migrarConfig(c) {
  let mudou = false;
  if (!Array.isArray(c.faturistas)) { c.faturistas = clone(FATURISTAS_PADRAO); mudou = true; }
  if (c.parametros && c.parametros.retencaoNC === undefined) { c.parametros.retencaoNC = RETENCAO_NC_PADRAO; mudou = true; }
  // Prestador genérico: lançado antes de se saber quem lauda; o relatório dele vai para a Correção de prestador.
  if (c.parametros && c.parametros.prestadorGenerico === undefined) { c.parametros.prestadorGenerico = '2'; mudou = true; }
  // MedicalShare: nome antigo no Apolo da unidade 17 (Palhano), faturada pela AlphaSonic Londrina.
  const u17 = (c.unidades || []).find(u => String(u.cod) === '17');
  if (u17 && !(c.unidades || []).some(u => (u.apolo || []).some(a => norm(a) === 'MEDICALSHARE'))) { u17.apolo = [...(u17.apolo || []), 'MedicalShare']; mudou = true; }
  if (migrarRegras(c)) mudou = true;
  if (!Array.isArray(c.descontos)) { c.descontos = []; mudou = true; }   // descontos parcelados (SOL-F31)
  // v3.0: nomes das pastas e modelos de exportação da equipe (vão com a configuração compartilhada).
  if (!c.pastas || typeof c.pastas !== 'object' || Array.isArray(c.pastas)) { c.pastas = {}; mudou = true; }
  if (!Array.isArray(c.modelosExportacao)) { c.modelosExportacao = []; mudou = true; }
  return mudou;
}
// Inclui responsáveis novos (ex.: lidos da planilha manual ou do Power BI); devolve quantos entraram.
function registrarFaturistas(cfg, nomes, origem) {
  let n = 0;
  for (const bruto of nomes) {
    const nome = String(bruto || '').trim(); if (!nome) continue;
    if (cfg.faturistas.some(f => norm(f.nome) === norm(nome))) continue;
    cfg.faturistas.push({ nome, unidades: '', generico: false, ativo: true, origem, em: agoraISO() }); n++;
  }
  return n;
}

/* ---------- Classificação do tipo de item (RN-199) ---------- */
function classificarItem(reg, regras) {
  const campos = { grupo: norm(reg.grupoNome), descricao: norm(reg.procDesc), codigo: String(reg.codigo) };
  for (const r of regras) {
    if (!r.ativa) continue;
    const alvo = campos[r.campo]; if (alvo === undefined) continue;
    let re; try { re = new RegExp(r.padrao); } catch (e) { continue; }
    if (re.test(alvo)) return { tipo: r.tipo, regra: r.id };
  }
  return { tipo: 'desconhecido', regra: '' };
}

/* ---------- Unidades e prestadores ---------- */
const unidadePorCod = (cfg, cod) => cfg.unidades.find(u => String(u.cod) === String(cod)) || null;
const nomesApoloDaUnidade = (cfg, cod) => new Set((unidadePorCod(cfg, cod)?.apolo || []).map(norm));

/* Prestadores: o par código ↔ nome vem do cabeçalho do relatório MV (fonte oficial).
 * O médico do Apolo só é ligado ao prestador por nome normalizado idêntico ou por alias validado (RN-208). */
function registrarPrestadorDoMV(cfg, cod, nome) {
  if (!cod || !nome) return false;
  let p = cfg.prestadores.find(x => String(x.cod) === String(cod));
  if (p) { if (!p.nomeMV) p.nomeMV = nome; return false; }
  cfg.prestadores.push({ cod: String(cod), nomeMV: nome, aliases: [], naoRealizaRepasse: false, origem: 'cabeçalho do relatório MV', em: agoraISO(), regras: regrasPrestadorVazias() });
  return true;
}
// Índice: nome normalizado do Apolo → [{prestador, via}]. Duas entradas para o mesmo nome = conflito.
function indicePrestadores(cfg) {
  const idx = new Map();
  const add = (n, p, via) => { if (!n) return; const a = idx.get(n) || []; if (!a.some(x => x.p.cod === p.cod)) a.push({ p, via }); idx.set(n, a); };
  for (const p of cfg.prestadores) {
    add(norm(p.nomeMV), p, 'nome idêntico ao cabeçalho do MV');
    for (const a of p.aliases || []) if (a.status === 'validado') add(norm(a.nome), p, `alias validado (${a.responsavel || 'sem responsável'})`);
  }
  return idx;
}
function prestadorDoMedico(idx, medicoApolo) {
  const a = idx.get(norm(medicoApolo)) || [];
  if (a.length === 1) return { estado: 'ok', prestador: a[0].p, via: a[0].via };
  if (a.length > 1) return { estado: 'conflito', candidatos: a.map(x => x.p) };
  return { estado: 'sem-cadastro' };
}
// Médicos do Apolo ligados a um prestador do MV (para filtrar «Só no laudo» na conferência).
function medicosDoPrestador(cfg, cod) {
  const p = cfg.prestadores.find(x => String(x.cod) === String(cod));
  if (!p) return [];
  return [norm(p.nomeMV), ...(p.aliases || []).filter(a => a.status === 'validado').map(a => norm(a.nome))].filter(Boolean);
}
