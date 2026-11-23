/* ============================================================
 * V3 = Curitiba (unidade 5) — regras próprias por médico (SOL-F30)
 * Na V3 o repasse é calculado fora do MV. A ferramenta calcula pela regra cadastrada do médico,
 * mostra a memória de cálculo e gera o texto do e-mail no formato usado hoje.
 * - Doppler é sempre parte do grupo de USG (conta no volume e no faturamento de USG).
 * - HM: só se paga HM de USG/Doppler do convênio Unimed, sem laudo próprio: basta o exame base no relatório, e o valor é o
 *   mesmo da USG do médico. Os demais HM (raio-X, mamografia, ressonância, e o que não é USG no 78 PF) não são pagos a ninguém e ficam sinalizados para exclusão.
 * - Pacote de ressonância e mamografia: considerado pelo valor do MV e notificado (substitui o base Bradesco a 100%).
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
const regraV3Fixa = () => ({ modo: 'fixo', grupos: [{ grupo: GRUPO_USG_V3, valorLaudo: 0 }] });
const regraV3Padrao = () => ({
  modo: 'percentual',
  impostos: 9.15,
  usg: { forma: 'faixa-liquido', faixas: FAIXAS_V3_PADRAO.map(f => ({ ...f })), pct: 0, valor: 0 },
  hm: 'faturamento',
  outros: [{ nome: 'Densitometria', padrao: 'DENSITOM', forma: 'pct-bruto', pct: 10, valor: 0 }]
});

const ehUnidadeV3 = (cfg, cod) => { const u = unidadePorCod(cfg, cod); return u?.empresa ? norm(u.empresa) === 'V3' : String(cod) === '5'; };
const ehUSGouDoppler = (grupo, desc) => /ULTRASS|DOPPLER|\bUSG\b/.test(norm(`${grupo || ''} ${desc || ''}`));
const ehLinhaHM = l => l.tipoItem ? l.tipoItem === 'hm' : (/HONORARIO/.test(norm(l.grupo || '')) || /(^|\s)HM$/.test(norm(l.desc || '')));
/* HM de uma linha da unidade V3: devido ou a excluir. P3 (v3.0.0-alpha.12): configurável em Bases e regras →
 * «Modalidades e HM V3» (cfg.hmV3): trechos do grupo/descrição e do convênio, separados por «|». Padrão: USG/Doppler Unimed.
 * v3.0.0-alpha.21 (regras de Curitiba de 23/11/2026):
 * - gruposExcluir: grupos de HM que NUNCA são pagos a ninguém (77 - Honorario Medico Raio X, 81 - Honorario Medico Mamografia).
 *   Valem antes de tudo e entram no aviso «HM a excluir do MV». O «78 - HONORARIOS MEDICOS PF» NÃO entra em bloco: nos PDFs
 *   reais de 11/2026 é nele que o MV lança o HM de USG Unimed (pago) junto com HM de ressonância etc. (não pagos); dentro
 *   dele vale a regra geral (só USG/Doppler Unimed é devido).
 * - pacotes / pacoteConvenios: pacote de ressonância e mamografia é considerado (valor do MV) e notificado; o exame base do
 *   mesmo paciente e dia, do convênio Bradesco e lançado a 100% (erro do MV), é substituído pelo pacote. */
const HM_V3_PADRAO = { procedimentos: 'ULTRASS|DOPPLER|USG', convenios: 'UNIMED', gruposExcluir: 'HONORARIO MEDICO RAIO X|HONORARIO MEDICO MAMOGRAFIA', pacotes: 'RESSON|MAMOG', pacoteConvenios: 'BRADESCO' };
// Grupo de HM: cada palavra do padrão precisa começar uma palavra do grupo («HONORARIO MEDICO MAMOGRAFIA» casa «81 - HONORARIOS MEDICOS MAMOGRAFIA»).
const compilarGruposHM = p => String(p || '').split('|').map(x => norm(x).split(/[^A-Z0-9]+/).filter(Boolean)).filter(x => x.length);
const casaGrupoHM = (padroes, grupo) => { const ws = norm(grupo || '').split(/[^A-Z0-9]+/).filter(Boolean); return padroes.some(pd => pd.every(w => ws.some(g => g.startsWith(w)))); };
const compilarHMV3 = hm => ({ proc: trechosPadrao(hm.procedimentos), conv: trechosPadrao(hm.convenios), gruposExcluir: compilarGruposHM(hm.gruposExcluir), pacotes: trechosPadrao(hm.pacotes), pacoteConv: trechosPadrao(hm.pacoteConvenios) });
let _hmV3Ativa = compilarHMV3(HM_V3_PADRAO);
// Situação do HM na V3: {devido, motivo: 'grupo' (grupo que nunca é pago) | 'procedimento' | 'convenio' | ''}.
function hmV3Situacao(grupo, desc, convenio) {
  // seriaDevido: HM de USG/Doppler Unimed lançado num grupo que nunca é pago — fica excluído, mas com destaque no aviso.
  if (casaGrupoHM(_hmV3Ativa.gruposExcluir, grupo)) return { devido: false, motivo: 'grupo', seriaDevido: casaTrechos(_hmV3Ativa.proc, `${grupo || ''} ${desc || ''}`) && casaTrechos(_hmV3Ativa.conv, convenio || '') };
  if (!casaTrechos(_hmV3Ativa.proc, `${grupo || ''} ${desc || ''}`)) return { devido: false, motivo: 'procedimento' };
  if (!casaTrechos(_hmV3Ativa.conv, convenio || '')) return { devido: false, motivo: 'convenio' };
  return { devido: true, motivo: '' };
}
const hmV3Devido = (grupo, desc, convenio) => hmV3Situacao(grupo, desc, convenio).devido;
const MOTIVO_HM_V3 = { grupo: 'grupo de HM que nunca é pago na V3', procedimento: 'HM que não é de USG/Doppler', convenio: 'HM de USG fora do convênio Unimed' };
// Pacote de ressonância ou mamografia na V3: considerado pelo valor do MV e notificado.
const ehPacoteV3 = l => (l.tipoItem || l.tipo) === 'pacote' && casaTrechos(_hmV3Ativa.pacotes, `${l.grupo || l.grupoNome || ''} ${l.desc || l.procDesc || ''}`);
const convenioPacoteV3 = conv => casaTrechos(_hmV3Ativa.pacoteConv, conv || '');
/* Aplica as regras configuráveis de uma configuração (chamado pela conferência, correção e fechamento, e pela tela ao
 * carregar ou gravar a configuração). Sem nada configurado, valem os padrões. */
let _regrasCfgChave = '';
function aplicarRegrasConfig(cfg) {
  const mod = cfg?.modalidadesGrupo?.length ? cfg.modalidadesGrupo : MODALIDADES_GRUPO_PADRAO, hm = { ...HM_V3_PADRAO, ...(cfg?.hmV3 || {}) };
  const chave = JSON.stringify([mod, hm]); if (chave === _regrasCfgChave) return;
  _regrasCfgChave = chave; _modalidadesAtivas = compilarModalidades(mod); _cacheModGrupo = new Map();
  _hmV3Ativa = compilarHMV3(hm);
}

/* Modalidade pelo TITLE do Apolo na V3 (23/11/2026: «em Curitiba a conferência e a correção de prestador sempre levam em
 * consideração a coluna title»). A V3 só faz mamografia, ultrassonografia (com Doppler), raio-X, densitometria e ressonância;
 * ainda não faz tomografia. Título que aponta uma só modalidade vale no lugar da MODALITY; senão fica a MODALITY. */
const MODALIDADES_TITULO_V3 = [
  { mod: 'US', re: /ULTRAS+ONOGRAF|ULTRASS|ECOGRAF|DOPPLER|\bUSG?\b/ },
  { mod: 'MG', re: /MAMOGRAF|\bMAMO\b|TOMOSSINTESE/ },
  { mod: 'MR', re: /RES+N?ONANCIA|\bRMN?\b|\bRNM\b/ },
  { mod: 'OT', re: /DENSITOMETRIA|\bDMO\b/ },
  { mod: 'CR', re: /\bRX\b|RAIO[ -]?X|RADIOGRAF/ },
  { mod: 'CT', re: /TOMOGRAFIA|\bTC\b/ }
];
function modalidadeDoTituloV3(titulo) {
  const t = norm(titulo || ''), achou = MODALIDADES_TITULO_V3.filter(x => x.re.test(t)).map(x => x.mod);
  return achou.length === 1 ? achou[0] : '';
}
// Modalidades que a V3 faz hoje; outra (ex.: tomografia) aparece com aviso na conferência.
const MODALIDADES_V3 = new Set(['US', 'MG', 'MR', 'OT', 'CR', 'DX']);
/* Médicos de Londrina que laudam na V3 por produção (23/11/2026): laudos que não são de USG, pagos pelo relatório do MV
 * (fechamento do IMG, coluna da unidade 5). Lista padrão do usuário; pode mudar no cadastro (regras.v3producao). */
const MEDICOS_PRODUCAO_V3_PADRAO = [['7873', 'Amanda Souza de Assis'], ['5', 'Gustavo Andrade De Margalho'], ['8049', 'Heloisa Martins Cardoso'], ['10175', 'Henrique Pini Sonomiya'],
  ['11718', 'Lucas Franklin Amarante'], ['9033', 'Lucas Yamada'], ['8873', 'Lucca Maricato de Las Villas Rodrigues'], ['7', 'Marcelo Garcia Marini'], ['15', 'Marcelo Miyazaki Yoshida'],
  ['10264', 'Melanie Eiko'], ['12', 'Nilton Paccola Lovato'], ['14', 'Paulo Asshaias Felipe'], ['3', 'Rafael Ogasawara Ferreira'], ['9', 'Roberto Brazao Farinha'], ['13', 'Thales Cavallini Rossi'],
  ['10285', 'Wesley Americo Bergamin']].map(([cod, nome]) => ({ cod, nome }));
const COD_PRODUCAO_V3 = new Set(MEDICOS_PRODUCAO_V3_PADRAO.map(x => x.cod));
// Lista para a tela: os padrões (mesmo sem cadastro) e quem foi incluído à mão.
function medicosProducaoV3(cfg) {
  const porCod = new Map(cfg.prestadores.map(p => [String(p.cod), p])), out = [];
  for (const x of MEDICOS_PRODUCAO_V3_PADRAO) { const p = porCod.get(x.cod); out.push({ cod: x.cod, nome: p?.nomeMV || x.nome, p: p || null, padrao: true, ativo: p ? laudaV3Producao(p) : true, v3: !!p?.regras?.v3 }); }
  for (const p of cfg.prestadores) if (!COD_PRODUCAO_V3.has(String(p.cod)) && p.regras?.v3producao) out.push({ cod: String(p.cod), nome: p.nomeMV, p, padrao: false, ativo: laudaV3Producao(p), v3: !!p.regras?.v3 });
  return out;
}
const laudaV3Producao = p => !!p && !p.regras?.v3 && (p.regras?.v3producao !== undefined && p.regras?.v3producao !== null ? !!p.regras.v3producao : COD_PRODUCAO_V3.has(String(p.cod)));
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
  if (regra.modo === 'fixo') return 'Valor fixo por laudo — ' + (regra.grupos || []).map(g => `${rotuloGrupoV3(g.grupo)}: R$ ${fmtBR(g.valorLaudo)}${g.grupo === GRUPO_USG_V3 ? ' (HM Unimed pelo mesmo valor)' : ''}`).join(' · ');
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
    if (gs.some(g => !(+g.valorLaudo > 0))) e.push('cada grupo precisa de valor por laudo');
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
  const r = { exames: 0, brutoUSG: 0, hm: { qtd: 0, valor: 0 }, hmExcluir: { qtd: 0, valor: 0, itens: new Map() }, outros: (regra.outros || []).map(o => ({ ...o, valorLaudo: +o.valor || 0, qtd: 0, bruto: 0, valor: 0 })), semRegra: new Map(), naoProcedimental: { qtd: 0, valor: 0 }, pacotes: { qtd: 0, valor: 0 }, valorMV: 0 };
  for (const l of linhas) {
    const q = +l.quant || 1, v = +l.vlTotal || 0;
    r.valorMV += +l.vlRepasse || 0;
    if (ehLinhaHM(l)) {
      if (hmV3Devido(l.grupo, l.desc, l.convenio)) { r.hm.qtd += q; r.hm.valor += v; }
      else { r.hmExcluir.qtd += q; r.hmExcluir.valor += v; const k = `${l.desc || l.grupo} · ${l.convenio || 'sem convênio'}`; r.hmExcluir.itens.set(k, (r.hmExcluir.itens.get(k) || 0) + q); }
      continue;
    }
    if (ehPacoteV3(l)) { r.pacotes.qtd += q; r.pacotes.valor += +l.vlRepasse || 0; continue; }
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
  r.pacotes.valor = r2(r.pacotes.valor);
  r.total = r2(usg + r.outros.reduce((s, o) => s + o.valor, 0) + r.pacotes.valor);
  r.valorUSG = r2(usg);
  for (const k of ['brutoUSG', 'base', 'liquido', 'valorMV']) r[k] = r2(r[k]);
  r.hm.valor = r2(r.hm.valor); r.hmExcluir.valor = r2(r.hmExcluir.valor);
  for (const o of r.outros) { o.bruto = r2(o.bruto); o.valor = r2(o.valor); }
  r.impostos = +regra.impostos || 0;
  return r;
}

/* Valor fixo por laudo, por grupo do MV. HM de USG/Doppler Unimed paga o valor de HM do grupo de USG. */
function calcularV3Fixo(regra, linhas) {
  const r = { modo: 'fixo', forma: 'fixo', exames: 0, brutoUSG: 0, valorUSG: 0, hm: { qtd: 0, valor: 0, semValor: 0 }, hmExcluir: { qtd: 0, valor: 0, itens: new Map() }, outros: [], semRegra: new Map(), naoProcedimental: { qtd: 0, valor: 0 }, pacotes: { qtd: 0, valor: 0 }, valorMV: 0, pct: 0, base: 0, liquido: 0, impostos: 0,
    itens: (regra.grupos || []).map(g => ({ ...g, rotulo: rotuloGrupoV3(g.grupo), qtd: 0, valor: 0, hmQtd: 0, hmValor: 0 })) };
  // HM de USG/Doppler Unimed vale o mesmo que o laudo de USG do médico (regra de 23/11/2026, para qualquer médico da V3).
  const gsR = regra.grupos || [], gUSG = gsR.find(x => x.grupo === GRUPO_USG_V3) || gsR.find(x => /ULTRASS|DOPPLER|\bUSG\b/.test(norm(x.grupo)));
  for (const it of r.itens) it.valorHM = it.grupo === gUSG?.grupo ? (+gUSG.valorLaudo || 0) : 0;
  const itemDe = g => r.itens.find(i => i.grupo === g.grupo);
  for (const l of linhas) {
    const q = +l.quant || 1, v = +l.vlTotal || 0;
    r.valorMV += +l.vlRepasse || 0;
    if (ehLinhaHM(l)) {
      // HM de USG/Doppler Unimed paga o valor do laudo de USG da regra.
      const g = gUSG;
      if (hmV3Devido(l.grupo, l.desc, l.convenio)) {
        if (g && +g.valorLaudo > 0) { const it = itemDe(g); it.hmQtd += q; it.hmValor += q * +g.valorLaudo; r.hm.qtd += q; r.hm.valor += q * +g.valorLaudo; }
        else r.hm.semValor += q;
      } else { r.hmExcluir.qtd += q; r.hmExcluir.valor += v; const k = `${l.desc || l.grupo} · ${l.convenio || 'sem convênio'}`; r.hmExcluir.itens.set(k, (r.hmExcluir.itens.get(k) || 0) + q); }
      continue;
    }
    if (ehPacoteV3(l)) { r.pacotes.qtd += q; r.pacotes.valor += +l.vlRepasse || 0; continue; }
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
  r.pacotes.valor = r2(r.pacotes.valor);
  r.total = r2(r.itens.reduce((s, i) => s + i.valor + i.hmValor, 0) + r.pacotes.valor);
  r.brutoUSG = r2(r.brutoUSG); r.valorMV = r2(r.valorMV); r.hm.valor = r2(r.hm.valor); r.hmExcluir.valor = r2(r.hmExcluir.valor);
  return r;
}

// Avisos do cálculo da V3 (aparecem no Fechamento).
function avisosV3(c) {
  const a = [];
  if (c.hmExcluir.qtd) a.push(`${c.hmExcluir.qtd} HM a excluir (não pago na V3: R$ ${fmtBR(c.hmExcluir.valor)})`);
  for (const [g, e] of c.semRegra) a.push(`${e.qtd} exame(s) de «${g}» sem regra na V3 (R$ ${fmtBR(e.valor)} bruto, fora do cálculo)`);
  if (c.forma === 'faixa-liquido' && !c.faixa && c.exames) a.push('volume abaixo da primeira faixa da regra');
  if (c.hm?.semValor) a.push(`${c.hm.semValor} HM de USG/Doppler Unimed sem valor do laudo de USG na regra (não pago)`);
  if (c.pacotes?.qtd) a.push(`${c.pacotes.qtd} pacote(s) de ressonância/mamografia considerados pelo valor do MV (R$ ${fmtBR(c.pacotes.valor)}): conferir se substituem o exame base Bradesco a 100%`);
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
    if (c.pacotes?.qtd) L.push(`Pacotes (ressonância/mamografia): ${c.pacotes.qtd} = ${R(c.pacotes.valor)}`);
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
  if (c.pacotes?.qtd) L.push(`Pacotes (ressonância/mamografia): ${c.pacotes.qtd} = ${R(c.pacotes.valor)}`);
  L.push('', `Total para emissão da nota fiscal: ${R(c.total)}`);
  return L.join('\n');
}

/* Avisos de Curitiba de uma conferência da unidade V3 (23/11/2026): o que o usuário precisa ver para agir no MV.
 * hmExcluir: HM que nunca é pago (excluir do MV), por grupo; hmSemBase: HM de USG Unimed sem o exame base;
 * pacotes: pacotes de ressonância/mamografia considerados; substituidos: base Bradesco a 100% trocada pelo pacote;
 * foraEscopo: linhas de modalidade que a V3 não faz (ex.: tomografia). */
function avisosConferenciaV3(res) {
  const mv = (res?.linhas || []).filter(x => x.r), soma = l => r2(l.reduce((s, x) => s + (+x.r.vlRepasse || 0), 0));
  const hmExcluir = mv.filter(x => x.marcadores.has('hm-v3-excluir')), porGrupo = new Map();
  for (const x of hmExcluir) { const k = x.r.grupoNome || 'sem grupo', e = porGrupo.get(k) || porGrupo.set(k, { grupo: k, motivo: x.motivoHMV3 || '', linhas: [] }).get(k); e.linhas.push(x); }
  const grupos = [...porGrupo.values()].map(g => ({ ...g, n: g.linhas.length, valor: soma(g.linhas), rotuloMotivo: MOTIVO_HM_V3[g.motivo] || '' })).sort((a, b) => b.n - a.n);
  const pega = m => { const l = mv.filter(x => x.marcadores.has(m)); return { n: l.length, valor: soma(l), linhas: l }; };
  const out = { hmExcluir: { n: hmExcluir.length, valor: soma(hmExcluir), grupos }, hmSemBase: pega('hm-v3-sem-base'), pacotes: pega('pacote-v3'), substituidos: pega('base-pacote-v3'), foraEscopo: pega('fora-escopo-v3') };
  // HM de USG Unimed que caiu num grupo excluído (ex.: mamografia): conferir se o grupo está certo no MV.
  const usgNoGrupo = hmExcluir.filter(x => x.hmV3SeriaDevido);
  out.hmExcluir.usgUnimed = { n: usgNoGrupo.length, valor: soma(usgNoGrupo) };
  out.total = out.hmExcluir.n + out.hmSemBase.n + out.pacotes.n + out.substituidos.n + out.foraEscopo.n;
  return out;
}
