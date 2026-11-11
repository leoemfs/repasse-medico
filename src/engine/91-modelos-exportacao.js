/* ============================================================
 * v3.0 — Modelos de exportação: catálogo de colunas da aba principal do Excel da conferência.
 * «Padrão (ordem de quem confere)» reproduz exatamente o layout operacional em uso (SOL-F40); «Completo» acrescenta
 * as colunas técnicas que já existem nos dados. A equipe pode criar, editar e salvar modelos próprios
 * (cfg.modelosExportacao, compartilhados pela pasta); cada pessoa escolhe o seu (preferência local).
 * O modelo só escolhe e ordena colunas: os dados da conferência não mudam para caber no layout.
 * ============================================================ */
const TXT = { fmt: 'text' };
const COLUNAS_EXPORT_CONF = [
  { id: 'situacao', rotulo: 'Situação', grupo: 'sit', larg: 22, valor: (x, c, a) => ({ v: STATUS_CONF[x.status].nome, st: { ...a.f, b: true } }) },
  { id: 'decisao', rotulo: 'Decisão na competência', grupo: 'sit', larg: 28, valor: (x, c, a) => ({ v: a.textoDecisao(a.dec), st: a.dec ? { fill: COR_DECISAO[a.dec.tipo], b: true } : {} }) },
  { id: 'paciente', rotulo: 'Paciente', larg: 32, valor: x => x.r?.paciente || x.l?.paciente || '' },
  { id: 'data', rotulo: 'Data', larg: 11, valor: x => x.r?.data || x.l?.data || '' },
  { id: 'codigo', rotulo: 'Cód. TUSS MV', larg: 12, valor: x => ({ v: x.r?.codigo || '', st: TXT }) },
  { id: 'procMV', rotulo: 'Procedimento no MV', larg: 40, valor: x => x.r?.procDesc || '' },
  { id: 'titulo', rotulo: 'Laudo (TITLE)', grupo: 'ap', larg: 40, valor: x => x.l?.titulo || '' },
  { id: 'falta', rotulo: 'O que falta / por quê', grupo: 'obs', larg: 44, valor: (x, c, a) => ({ v: a.falta, st: { wrap: true } }) },
  { id: 'vlRepasse', rotulo: 'Vl Repasse', larg: 12, valor: x => x.r ? { v: x.r.vlRepasse, st: { fmt: 'money' } } : '' },
  { id: 'convenioMV', rotulo: 'Convênio MV', larg: 24, valor: x => x.r?.convenio || '' },
  { id: 'unidadeMV', rotulo: 'Unidade MV', larg: 24, valor: (x, c) => x.r ? c.unidadeNome : '' },
  { id: 'grupoMV', rotulo: 'Grupo de procedimento MV', larg: 24, valor: x => x.r?.grupoNome || '' },
  { id: 'medicoMV', rotulo: 'Médico MV', larg: 28, valor: x => x.r ? x.r.prestadorNome : '' },
  { id: 'pacienteMV', rotulo: 'Paciente MV', larg: 30, valor: x => x.r?.paciente || '' },
  { id: 'pacienteApolo', rotulo: 'Paciente Apolo', grupo: 'ap', larg: 30, valor: x => x.l?.paciente || '' },
  { id: 'dataApolo', rotulo: 'Data Apolo', grupo: 'ap', larg: 11, valor: x => x.l?.data || '' },
  { id: 'estudo', rotulo: 'Descrição do estudo (STUDY)', grupo: 'ap', larg: 40, valor: x => x.l?.descricao || '' },
  { id: 'convenioApolo', rotulo: 'Convênio Apolo', grupo: 'ap', larg: 24, valor: x => x.l?.convenio || '' },
  { id: 'unidadeApolo', rotulo: 'Unidade Apolo', grupo: 'ap', larg: 22, valor: x => x.l?.unidade || '' },
  { id: 'modalidade', rotulo: 'Modalidade Apolo', grupo: 'ap', larg: 10, valor: x => x.l?.modalidade || '' },
  { id: 'medicoApolo', rotulo: 'Médico Apolo', grupo: 'ap', larg: 28, valor: x => x.l?.medico || '' },
  { id: 'ressalvas', rotulo: 'Ressalvas', grupo: 'obs', larg: 34, valor: x => ({ v: [...x.marcadores].map(m => MARCADORES[m]).join(' | '), st: { wrap: true } }) },
  { id: 'observacoes', rotulo: 'Observações e análise', grupo: 'obs', larg: 80, valor: x => ({ v: x.motivos.join(' | '), st: { wrap: true } }) },
  // Colunas que já existem nos dados e não estão no padrão (aba «Técnico» / «MV original»).
  { id: 'conta', rotulo: 'Conta', larg: 11, valor: x => ({ v: x.r?.conta || '', st: TXT }) },
  { id: 'atendimento', rotulo: 'Atendimento', larg: 12, valor: x => ({ v: x.r?.atendimento || '', st: TXT }) },
  { id: 'remessa', rotulo: 'Remessa', larg: 10, valor: x => ({ v: x.r?.remessa || '', st: TXT }) },
  { id: 'vlTotal', rotulo: 'Vl Total', larg: 12, valor: x => x.r ? { v: x.r.vlTotal, st: { fmt: 'money' } } : '' },
  { id: 'quant', rotulo: 'Quant.', larg: 7, valor: x => x.r?.quant ?? '' },
  { id: 'repasseMV', rotulo: 'Nº do repasse (MV)', larg: 10, valor: x => ({ v: x.r?.repasse || '', st: TXT }) },
  { id: 'linhaMV', rotulo: 'Linha MV', larg: 8, valor: x => x.r?.seq || '' },
  { id: 'paginaMV', rotulo: 'Página MV', larg: 7, valor: x => x.r?.pagina || '' },
  { id: 'tipoItem', rotulo: 'Tipo de item', larg: 22, valor: x => TIPOS_ITEM[x.tipo] || x.tipo || '' },
  { id: 'idLaudo', rotulo: 'Laudo: ID', grupo: 'ap', larg: 12, valor: x => ({ v: x.l?.idLaudo || '', st: TXT }) },
  { id: 'linhaPlanilha', rotulo: 'Laudo: linha da planilha', grupo: 'ap', larg: 10, valor: x => x.l?.linhaPlanilha || '' },
  { id: 'origem', rotulo: 'Origem (MV/Apolo)', larg: 8, valor: x => x.origem || '' }
];
const IDS_PADRAO_CONF = ['situacao', 'decisao', 'paciente', 'data', 'codigo', 'procMV', 'titulo', 'falta', 'vlRepasse', 'convenioMV', 'unidadeMV', 'grupoMV', 'medicoMV', 'pacienteMV', 'pacienteApolo', 'dataApolo', 'estudo', 'convenioApolo', 'unidadeApolo', 'modalidade', 'medicoApolo', 'ressalvas', 'observacoes'];
const MODELOS_EXPORT_FIXOS = [
  { id: 'padrao', nome: 'Padrão — ordem de quem confere (layout operacional atual)', alvo: 'conferencia', colunas: IDS_PADRAO_CONF, fixo: true },
  { id: 'completo', nome: 'Completo — padrão + colunas técnicas (conta, atendimento, IDs, linha do MV)', alvo: 'conferencia', colunas: [...IDS_PADRAO_CONF.slice(0, 9), 'conta', 'atendimento', 'remessa', 'vlTotal', 'quant', ...IDS_PADRAO_CONF.slice(9), 'repasseMV', 'linhaMV', 'paginaMV', 'tipoItem', 'idLaudo', 'linhaPlanilha', 'origem'], fixo: true }
];
const colunaExport = id => COLUNAS_EXPORT_CONF.find(c => c.id === id);
// Colunas válidas do modelo (ids desconhecidos são ignorados; sem colunas válidas, vale o padrão).
function colunasDoModelo(ids) {
  const cols = (Array.isArray(ids) ? ids : []).map(colunaExport).filter(Boolean);
  return cols.length ? cols : IDS_PADRAO_CONF.map(colunaExport);
}
const modelosExportacao = cfg => [...MODELOS_EXPORT_FIXOS, ...(cfg?.modelosExportacao || []).filter(m => m && m.id && Array.isArray(m.colunas))];
const modeloExportacao = (cfg, id) => modelosExportacao(cfg).find(m => m.id === id) || MODELOS_EXPORT_FIXOS[0];
