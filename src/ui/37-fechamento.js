/* ============================================================
 * Fechamento do repasse da competência: USG, IMG, produção e classe, indicadores e exportação
 * ============================================================ */
const FH = { sub: 'usg' };
// Selo da situação: estático nos indicadores; com x, vira botão que abre o menu de ações (SOL-F32).
const chipSitFech = (k, x = null, modo = '') => x
  ? `<button type="button" class="fs fs-${k} fs-menu" data-sit="${esc(modo || x.tipo)}|${esc(x.cod)}" title="Mudar a situação">${esc(SITUACAO_FECH[k].nome)}${x.manual ? ' ✎' : ''} ▾</button>${x.manual ? `<small class="fs-manual">manual: «${esc(x.manual.motivo)}» · ${esc(x.manual.por || '—')} ${new Date(x.manual.em).toLocaleDateString('pt-BR')}</small>` : ''}`
  : `<span class="fs fs-${k}">${esc(SITUACAO_FECH[k].nome)}</span>`;
function fechDaCompetencia(chave = S.comp) {
  const c = estadoCompetencia(S.compReg, chave);
  return { ...fechamentoVazio(), ...(c.fechamento || {}) };
}
function salvarFech(mutar) {
  if (!exigirAberta(S.comp, 'alterar o fechamento')) return false;
  const c = itemCompetencia(S.compReg, S.comp);
  c.fechamento = { ...fechamentoVazio(), ...(c.fechamento || {}) };
  mutar(c.fechamento); salvarCompReg();
  return true;
}
function marcosFech(chave) {
  const comp = S.fluxo.competencias[chave], [a, m] = chave.split('-').map(Number);
  return (comp ? marcosDaCompetencia(comp) : calcularMarcos(S.fluxo.modelo, a, m, S.fluxo.modelo.calendario, {})).datas;
}
function fechamentoAtual() {
  const base = { rodadas: S.rodadas, cfg: S.cfg };
  const ant = competenciaVizinha(S.comp, -1);
  const anterior = montarFechamento({ ...base, chave: ant, fech: fechDaCompetencia(ant), fluxoComp: S.fluxo.competencias[ant] });
  return montarFechamento({ ...base, chave: S.comp, decisoes: indiceDecisoesComp(), fluxoComp: S.fluxo.competencias[S.comp], fech: fechDaCompetencia(), anterior });
}

RENDER.fechamento = async () => {
  S.rodadas = await dbTodas();
  const f = fechamentoAtual(), mk = marcosFech(S.comp), fechada = compFechada();
  const lista = FH.sub === 'img' ? f.img : FH.sub === 'curitiba' ? f.curitiba : f.usg;
  const cont = k => lista.filter(x => x.situacao === k).length;
  $('pag-fechamento').innerHTML = `<div class="fx-topo"><h2 class="fx-titulo">Fechamento da competência ${rotuloCompetencia(S.comp)}</h2>
    <div class="acoes" style="margin:0"><button class="sec" id="fhInd">Exportar indicadores</button><button id="fhExp">Exportar competência</button></div></div>
    ${f.previa ? `<div class="aviso-fixo warn"><b>PRÉVIA</b> — ${f.semAceite ? `${f.semAceite} prestador(es) com rodada sem aceite` : 'nenhuma rodada de conferência nesta competência'}. A planilha sai marcada como prévia até todos terem aceite.</div>` : '<div class="aviso-fixo ok">Todos os prestadores com valores têm aceite: a exportação sai como versão final.</div>'}
    <div class="subabas" role="tablist">${[['usg', `Repasse USG <em>pagto ${fmtCurta(mk.pagUSG)}</em>`], ['img', `Repasse IMG <em>pagto ${fmtCurta(mk.pagIMG)}</em>`], ['curitiba', `Repasse Curitiba (V3) <em>pagto ${fmtCurta(mk.pagCuritiba)}</em>`], ['producao', 'Produção USG e classe'], ['indicadores', 'Indicadores']].map(([k, t]) => `<button role="tab" class="${FH.sub === k ? 'on' : ''}" aria-selected="${FH.sub === k}" data-fsub="${k}">${t}</button>`).join('')}</div>
    ${['usg', 'img', 'curitiba'].includes(FH.sub) ? `<div class="nc-kpis">${Object.keys(SITUACAO_FECH).map(k => `<div class="nc-kpi"><b>${cont(k)}</b><small>${chipSitFech(k)}</small></div>`).join('')}</div>` : ''}
    <div id="fhCorpo"></div>`;
  $('pag-fechamento').querySelectorAll('[data-fsub]').forEach(b => b.onclick = () => { FH.sub = b.dataset.fsub; RENDER.fechamento(); });
  $('fhExp').onclick = () => exportarFechamento(f, mk);
  $('fhInd').onclick = () => baixarZip(xlsxIndicadoresFechamento(f, { ...indicadoresFechamento(f, S.cfg, S.nc.itens.filter(x => x.competencia === S.comp)), cobertura: coberturaCompetencia(S.rodadas, S.comp) }, { operador: S.operador }), `Indicadores_fechamento_${S.comp.slice(5)}-${S.comp.slice(0, 4)}_${carimbo()}.xlsx`);
  const corpo = $('fhCorpo');
  if (FH.sub === 'usg') desenharUSG(corpo, f, mk); else if (FH.sub === 'img') desenharIMG(corpo, f, mk, 'img'); else if (FH.sub === 'curitiba') desenharCuritiba(corpo, f, mk); else if (FH.sub === 'producao') desenharProducao(corpo, f); else desenharIndicadoresFech(corpo, f);
  if (fechada) corpo.querySelectorAll('input, textarea, [data-nf-nova], [data-nf-ed], [data-nf-rm]').forEach(x => { x.disabled = true; });
};

const celValor = v => v === undefined ? '' : fmtBR(v);
const inputAjuste = (tipo, x, campo, largura = 80) => `<input type="${campo === 'obs' ? 'text' : 'number'}" step="0.01" data-aj="${tipo}|${x.cod}|${campo}" value="${esc(campo === 'obs' ? x.obs : (x[campo] || ''))}" style="width:${largura}px" aria-label="${campo}">`
  + (campo === 'descontos' && x.temValores && (x.parcelas || []).length ? ` <span class="badge ${x.descontosManual ? 'warn' : 'info'}" title="${esc(x.parcelas.map(p => p.obs).join('; '))}${x.descontosManual ? ` · automático seria R$ ${fmtBR(x.descontosAuto)}; apague o valor para voltar` : ''}">${x.descontosManual ? 'manual' : 'auto'}</span>` : '');
// Avisos recolhidos (como na Conferência): o botão mostra quantos; clicar abre a linha de detalhe e clicar de novo fecha.
FH.abertos = FH.abertos || new Set();
const chaveAviso = x => `${x.tipo}|${x.cod}`;
const avisosHtml = x => x.avisos.length ? `<button type="button" class="fh-avisos-bt${FH.abertos.has(chaveAviso(x)) ? ' aberto' : ''}" data-avisos="${esc(chaveAviso(x))}" aria-expanded="${FH.abertos.has(chaveAviso(x))}" title="Mostrar ou esconder os avisos">⚠ ${x.avisos.length} aviso${x.avisos.length > 1 ? 's' : ''} <span class="seta">▸</span></button>` : '';
const detAvisos = x => x.avisos.length ? `<tr class="detalhe fh-det" data-det="${esc(chaveAviso(x))}"${FH.abertos.has(chaveAviso(x)) ? '' : ' hidden'}><td colspan="40"><div class="fh-det-corpo"><b>Avisos de ${esc(x.nome)}</b><ul>${x.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div></td></tr>` : '';

function desenharUSG(corpo, f, mk) {
  const un = S.cfg.unidades.filter(u => u.pctUSG);
  const faixas = [...new Set(f.usg.map(x => x.p?.regras?.faixaUSG || ''))];
  corpo.innerHTML = `<div class="tw fh-tab"><table><thead><tr><th>Cód.</th><th class="fh-nome">Prestador</th><th>Situação</th>${un.map(u => `<th class="n fh-un" title="${esc(u.nome)}">${esc(u.cod)}<small>${esc(u.nome)}</small></th>`).join('')}<th class="n">BOARD</th><th class="n">PLANTÃO</th><th class="n">TOTAL</th><th class="n">DESCONTOS</th><th>Obs. do desconto</th><th class="n">TOTAL GERAL</th><th>Avisos</th><th></th></tr></thead><tbody>
    <tr class="fh-cnpj"><td></td><td>CNPJ para a NF</td><td></td>${un.map(u => `<td>${esc(u.cnpj || '')}</td>`).join('')}<td>${esc(S.cfg.fechamento.cnpjBoard)}</td><td>${esc(S.cfg.fechamento.cnpjPlantao)}</td><td colspan="6"></td></tr>
    ${faixas.map(fx => { const fa = S.cfg.faixasUSG.find(y => y.id === fx), l = f.usg.filter(x => (x.p?.regras?.faixaUSG || '') === fx);
      // Percentual da faixa embaixo de cada unidade, alinhado com a coluna.
      return `<tr class="fh-faixa"><td colspan="3">${esc(fa?.nome || 'Sem faixa cadastrada (Bases → Prestadores e regras)')}</td>${un.map(u => { const p = fa ? pctUSGEsperado(S.cfg, { regras: { faixaUSG: fx, pctUSGUnidade: {} } }, u.cod) : null; return `<td class="n fh-pct">${p === null ? '' : r2(p * 100) + '%'}</td>`; }).join('')}<td colspan="8"></td></tr>` +
        l.map(x => `<tr><td>${esc(x.cod)}</td><td class="fh-nome">${esc(x.nome)}</td><td>${chipSitFech(x.situacao, x, 'usg')}</td>${un.map(u => `<td class="n">${celValor(x.unidades[u.cod])}</td>`).join('')}
          <td class="n">${x.board ? fmtBR(x.board) : ''}</td><td class="n">${inputAjuste('usg', x, 'plantao')}</td><td class="n">${fmtBR(x.total)}</td><td class="n">${inputAjuste('usg', x, 'descontos')}</td><td>${inputAjuste('usg', x, 'obs', 160)}</td>
          <td class="n"><b>${fmtBR(x.totalGeral)}</b></td><td>${avisosHtml(x)}</td><td>${x.temValores ? `<button class="sec mini" data-copiar="usg|${esc(x.cod)}">Copiar prévia</button>` : ''}</td></tr>${detAvisos(x)}`).join(''); }).join('')}
    <tr class="fh-total"><td></td><td>TOTAL USG</td><td></td>${un.map(u => `<td class="n">${fmtBR(f.usg.reduce((s, x) => s + (x.unidades[u.cod] || 0), 0))}</td>`).join('')}<td class="n">${fmtBR(f.usg.reduce((s, x) => s + x.board, 0))}</td><td class="n">${fmtBR(f.usg.reduce((s, x) => s + x.plantao, 0))}</td><td class="n">${fmtBR(f.usg.reduce((s, x) => s + x.total, 0))}</td><td class="n">${fmtBR(f.usg.reduce((s, x) => s + x.descontos, 0))}</td><td></td><td class="n"><b>${fmtBR(f.usg.reduce((s, x) => s + x.totalGeral, 0))}</b></td><td colspan="2"></td></tr>
    </tbody></table></div>${f.usg.length ? '' : '<p class="muted">Nenhum prestador de USG: cadastre as faixas em Bases → Prestadores e regras (ou importe a planilha de controle) e rode as conferências dos relatórios de USG.</p>'}
    ${cartaoDescontosFech(f, 'usg')}${cartaoNF(f, 'usg')}
    <label class="campo">Observações da planilha de USG<textarea id="fhObsUSG" rows="2">${esc(f.fech.obs.usg || '')}</textarea></label>
    <p class="small muted">Valores por unidade = Vl Repasse do relatório da última rodada de conferência com aceite (sem aceite: última rodada, como prévia). BOARD vem do cadastro do prestador; PLANTÃO, DESCONTOS e observações são deste mês. Pagamento ${fmtData(mk.pagUSG)}.</p>`;
  ligarFech(corpo, f, mk);
}
// IMG (médicos do SRA) e Curitiba (médicos V3): mesma tabela; Curitiba só com os médicos da V3.
const listaFech = (f, modo) => modo === 'usg' ? f.usg : modo === 'curitiba' ? f.curitiba : f.img;
function desenharIMG(corpo, f, mk, modo) {
  const v3 = modo === 'curitiba', lista = listaFech(f, modo);
  const un = S.cfg.unidades.filter(u => u.cnpj && (v3 ? (u.cod === '5' || lista.some(x => x.unidades[u.cod] !== undefined)) : (u.pctUSG || u.cod === '5' || lista.some(x => x.unidades[u.cod] !== undefined)))).sort((a, b) => +a.cod - +b.cod);
  const linha = x => `<tr><td class="n">${x.classeFixa ? '<span class="small">fixo</span>' : x.producaoUSG ? fmtBR(x.producaoUSG) : '<span class="small muted">sem prod. USG</span>'}</td><td><b>${esc(x.classe)}</b></td><td>${esc(x.cod)}</td><td class="fh-nome">${esc(x.nome)}</td><td>${chipSitFech(x.situacao, x, modo)}</td>
    ${un.map(u => `<td class="n">${celValor(x.unidades[u.cod])}</td>`).join('')}<td class="n">${inputAjuste(x.tipo, x, 'plantao')}</td><td class="n">${fmtBR(x.total)}</td><td class="n">${inputAjuste(x.tipo, x, 'descontos')}</td><td>${inputAjuste(x.tipo, x, 'obs', 160)}</td>
    <td class="n"><b>${fmtBR(x.totalGeral)}</b></td><td>${avisosHtml(x)}</td><td>${x.temValores ? `<button class="sec mini" data-copiar="${modo}|${esc(x.cod)}">Copiar prévia</button>` : ''}</td></tr>${detAvisos(x)}`;
  const cab = `<thead><tr><th class="n">Produção USG</th><th>Classe</th><th>Cód.</th><th class="fh-nome">Prestador</th><th>Situação</th>${un.map(u => `<th class="n fh-un" title="${esc(u.nome)}">${esc(u.cod)}<small>${esc(u.nome)}</small></th>`).join('')}<th class="n">PLANTÃO</th><th class="n">TOTAL</th><th class="n">DESCONTOS</th><th>Obs. do desconto</th><th class="n">TOTAL GERAL</th><th>Avisos</th><th></th></tr></thead>`;
  corpo.innerHTML = `
    <div class="tw fh-tab"><table>${cab}<tbody><tr class="fh-cnpj"><td colspan="5">CNPJ para a NF</td>${un.map(u => `<td>${esc(u.cnpj)}</td>`).join('')}<td>${esc(S.cfg.fechamento.cnpjPlantao)}</td><td colspan="6"></td></tr>${lista.map(linha).join('')}</tbody></table></div>
    ${lista.length ? '' : `<p class="muted">${v3 ? 'Nenhum médico da V3: marque «Médico V3» nas regras do prestador (Bases → Prestadores e regras).' : 'Nenhum prestador de IMG: marque «Recebe repasse de IMG» em Bases → Prestadores e regras (ou importe a planilha de controle).'}</p>`}
    ${cartaoDescontosFech(f, modo)}${cartaoNF(f, modo)}
    <label class="campo">Observações da planilha de ${v3 ? 'Curitiba' : 'IMG'}<textarea id="${v3 ? 'fhObsCur' : 'fhObsIMG'}" rows="2">${esc(f.fech.obs[v3 ? 'curitiba' : 'img'] || '')}</textarea></label>
    <p class="small muted">${v3 ? '' : 'Classe pela produção bruta de USG do prestador nesta competência (ou fixa no cadastro). Os avisos conferem o valor de cada laudo do relatório contra a tabela da classe; nada é recalculado. '}Pagamento ${fmtData(v3 ? mk.pagCuritiba : mk.pagIMG)}.</p>`;
  ligarFech(corpo, f, mk);
}

/* ---------- Repasse Curitiba (V3) — SOL-F30 ----------
 * Valor da unidade V3 calculado pela regra do médico (Bases → Prestadores → Médicos V3);
 * outras unidades (laudos para o SRA) seguem o relatório do MV. */
function desenharCuritiba(corpo, f, mk) {
  const lista = f.curitiba;
  const un = S.cfg.unidades.filter(u => u.cnpj && (ehUnidadeV3(S.cfg, u.cod) || lista.some(x => x.unidades[u.cod] !== undefined))).sort((a, b) => (ehUnidadeV3(S.cfg, b.cod) - ehUnidadeV3(S.cfg, a.cod)) || +a.cod - +b.cod);
  const v = (x, fn) => x.v3 ? fn(x.v3) : '<span class="muted small">—</span>';
  const linha = x => `<tr><td>${esc(x.cod)}</td><td class="fh-nome">${esc(x.nome)}</td><td>${chipSitFech(x.situacao, x, 'curitiba')}</td>
    <td class="n">${v(x, c => c.exames.toLocaleString('pt-BR'))}</td><td class="n">${v(x, c => fmtBR(c.brutoUSG))}</td><td class="n">${v(x, c => c.hmNaBase || c.hm.valor ? fmtBR(c.hm.valor) : '<span class="muted small">não entra</span>')}</td>
    <td class="n">${v(x, c => fmtBR(c.modo === 'fixo' ? c.outrosValor : c.outros.reduce((s2, o) => s2 + o.valor, 0)))}</td><td class="n">${v(x, c => c.modo === 'fixo' ? '<span class="small">valor fixo</span>' : c.forma === 'por-laudo' ? '<span class="small">por laudo</span>' : fmtBR(c.liquido))}</td>
    <td class="n">${v(x, c => c.pct ? `<b>${fmtBR(c.pct).replace(',00', '')}%</b>${c.faixa ? `<small class="nc-det">${esc(rotuloFaixaV3(c.faixa))}</small>` : ''}` : c.forma === 'por-laudo' ? `<small>R$ ${fmtBR(c.valorLaudo)}</small>` : '')}</td>
    ${un.map(u => `<td class="n">${ehUnidadeV3(S.cfg, u.cod) && x.v3 ? `<b>${celValor(x.unidades[u.cod])}</b>` : celValor(x.unidades[u.cod])}</td>`).join('')}
    <td class="n">${inputAjuste('curitiba', x, 'plantao')}</td><td class="n">${fmtBR(x.total)}</td><td class="n">${inputAjuste('curitiba', x, 'descontos')}</td><td>${inputAjuste('curitiba', x, 'obs', 160)}</td>
    <td class="n"><b>${fmtBR(x.totalGeral)}</b></td><td>${avisosHtml(x)}</td>
    <td style="white-space:nowrap">${x.v3 ? `<button class="sec mini" data-memoria="${esc(x.cod)}">Memória de cálculo</button> ` : ''}${x.temValores ? `<button class="sec mini" data-copiar="curitiba|${esc(x.cod)}">${x.v3 ? 'Copiar e-mail' : 'Copiar prévia'}</button>` : ''}</td></tr>${detAvisos(x)}`;
  corpo.innerHTML = `<p class="small muted">Só os médicos da V3 (Curitiba). A unidade ${un.filter(u => ehUnidadeV3(S.cfg, u.cod)).map(u => esc(u.cod)).join(', ') || '5'} é calculada pela regra de cada médico (Bases → Prestadores → Médicos V3): Doppler conta como USG, HM só de USG/Doppler Unimed. Sem regra, vale o valor do relatório do MV. Classe A/B/C/D não se aplica.</p>
    <div class="tw fh-tab"><table><thead><tr><th>Cód.</th><th class="fh-nome">Médico V3</th><th>Situação</th><th class="n">Exames USG</th><th class="n">USG (bruto)</th><th class="n">HM Unimed</th><th class="n">Outros</th><th class="n">Líquido</th><th class="n">%</th>
      ${un.map(u => `<th class="n fh-un" title="${esc(u.nome)}">${esc(u.cod)}<small>${esc(u.nome)}${ehUnidadeV3(S.cfg, u.cod) ? ' · total da NF' : ''}</small></th>`).join('')}<th class="n">PLANTÃO</th><th class="n">TOTAL</th><th class="n">DESCONTOS</th><th>Obs. do desconto</th><th class="n">TOTAL GERAL</th><th>Avisos</th><th></th></tr></thead>
      <tbody><tr class="fh-cnpj"><td colspan="9">CNPJ para a NF</td>${un.map(u => `<td>${esc(u.cnpj)}</td>`).join('')}<td>${esc(S.cfg.fechamento.cnpjPlantao)}</td><td colspan="7"></td></tr>${lista.map(linha).join('')}
      <tr class="fh-total"><td></td><td>TOTAL CURITIBA</td><td colspan="7"></td>${un.map(u => `<td class="n">${fmtBR(lista.reduce((s2, x) => s2 + (x.unidades[u.cod] || 0), 0))}</td>`).join('')}<td class="n">${fmtBR(lista.reduce((s2, x) => s2 + x.plantao, 0))}</td><td class="n">${fmtBR(lista.reduce((s2, x) => s2 + x.total, 0))}</td><td class="n">${fmtBR(lista.reduce((s2, x) => s2 + x.descontos, 0))}</td><td></td><td class="n"><b>${fmtBR(lista.reduce((s2, x) => s2 + x.totalGeral, 0))}</b></td><td colspan="2"></td></tr></tbody></table></div>
    ${lista.length ? '' : '<p class="muted">Nenhum médico da V3: inclua em Bases → Prestadores → Médicos V3 (ou importe a planilha de controle).</p>'}
    ${cartaoDescontosFech(f, 'curitiba')}${cartaoNF(f, 'curitiba')}
    <label class="campo">Observações da planilha de Curitiba<textarea id="fhObsCur" rows="2">${esc(f.fech.obs.curitiba || '')}</textarea></label>
    <p class="small muted">Pagamento ${fmtData(mk.pagCuritiba)}.</p>`;
  ligarFech(corpo, f, mk);
  corpo.querySelectorAll('[data-memoria]').forEach(b => b.onclick = () => memoriaV3(lista.find(y => y.cod === b.dataset.memoria)));
}
async function memoriaV3(x) {
  const c = x.v3, texto = textoEmailV3(c);
  const exc = [...c.hmExcluir.itens].sort((a, b) => b[1] - a[1]);
  const origem = c.modo === 'fixo' ? `<li><b>Regra:</b> valor fixo por laudo, por grupo do MV.</li>
      ${c.itens.map(i => `<li><b>${esc(i.rotulo)}:</b> ${i.qtd} laudo(s) × R$ ${fmtBR(i.valorLaudo)} = R$ ${fmtBR(i.valor)}${i.hmQtd ? ` · HM Unimed ${i.hmQtd} × R$ ${fmtBR(i.valorHM)} = R$ ${fmtBR(i.hmValor)}` : ''}.</li>`).join('')}
      <li>Exames de USG e Doppler no mês: ${c.exames} (USG bruto no MV: R$ ${fmtBR(c.brutoUSG)}, só referência).</li>
      ${c.hm.semValor ? `<li>${c.hm.semValor} HM de USG/Doppler Unimed sem valor de HM na regra: não pagos.</li>` : ''}
      <li class="muted">Vl Repasse que o MV trouxe para a V3: R$ ${fmtBR(c.valorMV)} (só referência).</li>` : null;
  const r = await dialogo(`Memória de cálculo — ${x.cod} - ${x.nome}`, `<span class="dlg-largo" hidden></span><div class="grid2"><div><h4 style="margin:0 0 4px">Texto do e-mail</h4><pre class="memoria-v3">${esc(texto)}</pre></div>
    <div><h4 style="margin:0 0 4px">De onde vem cada número</h4><ul class="small">${origem || `
      <li><b>Exames USG:</b> soma da quantidade dos procedimentos de USG e Doppler do médico na V3 (${c.exames}).</li>
      <li><b>USG (bruto):</b> soma do Vl Total dessas linhas (R$ ${fmtBR(c.brutoUSG)}).</li>
      <li><b>HM Unimed:</b> ${c.hm.qtd} HM de USG/Doppler do convênio Unimed (R$ ${fmtBR(c.hm.valor)})${c.hmNaBase ? ', somados ao faturamento da USG' : c.forma === 'por-laudo' && x.p?.regras?.v3regra?.hm === 'valor-laudo' ? ', pagos como laudo de USG' : ', não pagos pela regra'}.</li>
      ${c.forma === 'faixa-liquido' ? `<li><b>Faixa:</b> ${c.exames} exames → ${c.faixa ? `${fmtBR(c.pct).replace(',00', '')}% (${esc(rotuloFaixaV3(c.faixa))})` : 'abaixo da primeira faixa'}.</li>` : ''}
      ${c.outros.map(o => `<li><b>${esc(o.nome)}:</b> ${o.qtd} exame(s), R$ ${fmtBR(o.bruto)} bruto → R$ ${fmtBR(o.valor)}.</li>`).join('')}
      <li>Calculado sem arredondar no meio; arredonda só no final.</li>
      <li class="muted">Vl Repasse que o MV trouxe para a V3: R$ ${fmtBR(c.valorMV)} (só referência).</li>`}</ul>
      ${exc.length ? `<h4 style="margin:8px 0 4px">HM a excluir (${c.hmExcluir.qtd} · R$ ${fmtBR(c.hmExcluir.valor)})</h4><ul class="small">${exc.slice(0, 12).map(([k, n]) => `<li>${esc(k)} — ${n}</li>`).join('')}${exc.length > 12 ? `<li>… e mais ${exc.length - 12}</li>` : ''}</ul>` : ''}
      ${c.semRegra.size ? `<h4 style="margin:8px 0 4px">Fora do cálculo (sem regra)</h4><ul class="small">${[...c.semRegra].map(([k, e]) => `<li>${esc(k)} — ${e.qtd} · R$ ${fmtBR(e.valor)}</li>`).join('')}</ul>` : ''}</div></div>`,
    [['', 'Fechar', 'sec'], ['copiar', 'Copiar texto do e-mail']]);
  if (r.botao === 'copiar') copiarTexto(texto, `Texto do e-mail de ${x.nome}`);
}

/* ---------- NF complementar (SOL-F28) ---------- */
const NOME_TIPO_FECH = { usg: 'USG', img: 'IMG', curitiba: 'Curitiba (V3)' };
function cartaoNF(f, tipo) {
  const nfs = f.nfs.filter(n => n.tipo === tipo), cats = [...new Set(nfs.map(n => n.categoria))];
  const un = c => { const u = unidadePorCod(S.cfg, c); return u ? `${u.cod}- ${u.nome}` : '—'; };
  return `<div class="card nf-cartao"><h3>NFs complementares da competência — ${NOME_TIPO_FECH[tipo]}</h3>
    ${nfs.length ? `<div class="tw"><table><thead><tr><th>Cód.</th><th>Prestador</th>${cats.map(c => `<th class="n">${esc(c)}</th>`).join('')}<th class="n">Total</th><th>Unidade / CNPJ de emissão</th><th>Observação</th><th></th></tr></thead><tbody>
      ${nfs.map(n => `<tr><td>${esc(n.cod)}</td><td>${esc(n.nome)}</td>${cats.map(c => `<td class="n">${c === n.categoria ? `${fmtBR(valorNF(n))}${+n.quantidade > 0 ? `<small class="nc-det">${n.quantidade} × ${fmtBR(n.valorUnitario)}</small>` : ''}` : ''}</td>`).join('')}
        <td class="n"><b>${fmtBR(valorNF(n))}</b></td><td class="small">${esc(un(n.unidade))}</td><td class="small">${esc(n.obs || '')}</td>
        <td style="white-space:nowrap"><button class="sec mini" data-nf-ed="${esc(n.id)}" aria-label="Editar">✎</button> <button class="perigo mini" data-nf-rm="${esc(n.id)}" aria-label="Excluir">✕</button></td></tr>`).join('')}
      <tr class="fh-total"><td></td><td>Total de NFs complementares</td>${cats.map(c => `<td class="n">${fmtBR(nfs.filter(n => n.categoria === c).reduce((s, n) => s + valorNF(n), 0))}</td>`).join('')}<td class="n"><b>${fmtBR(nfs.reduce((s, n) => s + valorNF(n), 0))}</b></td><td colspan="3"></td></tr>
      </tbody></table></div>` : '<p class="muted small">Nenhuma NF complementar neste mês.</p>'}
    <div class="acoes"><button class="sec" data-nf-nova="${tipo}">+ NF complementar</button></div></div>`;
}
async function editarNF(tipo, id) {
  if (!exigirAberta(S.comp, 'alterar NFs complementares')) return;
  const op = await exigirOperador(); if (!op) return;
  const atual = id ? nfsDoFechamento(fechDaCompetencia()).find(n => n.id === id) : null;
  const d = atual || { cod: '', nome: '', categoria: '', unidade: '', quantidade: '', valorUnitario: '', valor: '', obs: '' };
  const cats = categoriasNF(S.cfg, tipo), unidades = S.cfg.unidades.filter(u => u.cnpj);
  const r = await dialogo(`${atual ? 'Editar' : 'Nova'} NF complementar — ${NOME_TIPO_FECH[tipo]}`, `<div class="grid2">
      ${campoBusca({ nome: 'prestador', rotulo: 'Prestador', fonte: 'prestador', valor: d.nome, cod: d.cod, preencheCod: 'cod', obrigatorio: true })}
      <label class="campo">Código<input type="text" name="cod" value="${esc(d.cod)}" style="max-width:120px"></label>
      <label class="campo">Do que se trata (categoria) *<input type="text" name="categoria" list="dlCatNF" value="${esc(d.categoria)}" placeholder="${cats.length ? 'ex.: ' + esc(cats[0].nome) : 'ex.: Reajuste'}"></label>
      <label class="campo">Unidade / CNPJ de emissão *<select name="unidade"><option value="">— escolher —</option>${opcoes(unidades.map(u => [u.cod, `${u.cod}- ${u.nome} · ${u.cnpj}`]), d.unidade)}</select></label>
      <label class="campo">Quantidade<input type="number" step="1" min="0" name="quantidade" value="${esc(d.quantidade || '')}"></label>
      <label class="campo">Valor unitário (R$)<input type="number" step="0.01" min="0" name="valorUnitario" value="${esc(d.valorUnitario || '')}"></label>
      <label class="campo">Valor total (R$)<input type="number" step="0.01" min="0" name="valor" value="${esc(d.valor || '')}"><span class="small muted">Com quantidade × valor unitário, o total é calculado.</span></label>
      <label class="campo">Observação<input type="text" name="obs" value="${esc(d.obs || '')}"></label></div>
    <datalist id="dlCatNF">${cats.map(c => `<option value="${esc(c.nome)}"></option>`).join('')}</datalist>
    <p class="small muted">Competência ${rotuloCompetencia(S.comp)}. A categoria lembra a unidade/CNPJ e o valor unitário usados por último.</p>`, [['', 'Cancelar', 'sec'], ['ok', atual ? 'Salvar' : 'Incluir']]);
  if (r.botao !== 'ok') return;
  const c = r.campos;
  const dados = { tipo, cod: c.cod.trim(), nome: c.prestador.trim(), categoria: c.categoria.trim(), unidade: c.unidade, quantidade: +c.quantidade || 0, valorUnitario: +c.valorUnitario || 0, valor: +c.valor || 0, obs: c.obs.trim() };
  const p = S.cfg.prestadores.find(x => String(x.cod) === dados.cod); if (p && !dados.nome) dados.nome = p.nomeMV;
  dados.valor = valorNF(dados);
  const erros = validarNF(dados); if (erros.length) return avisar('NF complementar não gravada: ' + erros.join('; ') + '.', 'warn');
  salvarFech(fe => {
    const lista = nfsDoFechamento(fe).map(x => ({ ...x }));
    if (atual) Object.assign(lista.find(x => x.id === atual.id), dados, { alteradoPor: op, alteradoEm: agoraISO() });
    else lista.push({ id: novoId('nf'), ...dados, por: op, em: agoraISO() });
    fe.nfs = lista; fe.blocos = { complementar: [], cetrus: [] };   // os blocos antigos já viraram lançamentos
  });
  lembrarCategoriaNF(S.cfg, tipo, dados.categoria, dados.unidade, dados.valorUnitario); salvarCfg();
  avisar(`NF complementar ${atual ? 'atualizada' : 'incluída'}: ${dados.nome || dados.cod} · ${dados.categoria} · R$ ${fmtBR(dados.valor)}.`, 'ok');
  RENDER.fechamento();
}
// No formulário: escolher a categoria preenche a unidade e o valor unitário padrão.
document.addEventListener('change', e => {
  if (e.target.name !== 'categoria' || !e.target.closest('#dlgCorpo') || !$('dlgCorpo').querySelector('[name="unidade"]')) return;
  const c = (S.cfg.fechamento.categoriasNF || []).find(x => norm(x.nome) === norm(e.target.value)); if (!c) return;
  const sel = $('dlgCorpo').querySelector('[name="unidade"]'), vu = $('dlgCorpo').querySelector('[name="valorUnitario"]');
  if (c.unidade && !sel.value) sel.value = c.unidade;
  if (+c.valorUnitario > 0 && !vu.value) vu.value = c.valorUnitario;
});

function desenharProducao(corpo, f) {
  const un = S.cfg.unidades.filter(u => u.pctUSG);
  const lista = [...new Map([...f.img, ...f.usg].map(x => [x.cod, x])).values()].filter(x => f.img.some(y => y.cod === x.cod) || x.producaoUSG);
  corpo.innerHTML = `<div class="card"><p class="lead">Produção bruta de USG (Vl Total dos relatórios de USG, todas as unidades) e a classe resultante. Cortes em Bases → Classes e valores IMG: A acima de ${fmtBR(S.cfg.classes.cortes[0].acima)}, B acima de ${fmtBR(S.cfg.classes.cortes[1].acima)}, C acima de ${fmtBR(S.cfg.classes.cortes[2].acima)}; D até o último corte ou sem produção.</p>
    <div class="tw fh-tab"><table><thead><tr><th>Classe</th><th>Cód.</th><th class="fh-nome">Prestador</th>${un.map(u => `<th class="n">Unidade ${esc(u.cod)} · ${r2(u.pctUSG.medico * 100)}%</th>`).join('')}<th class="n">Total</th><th></th></tr></thead><tbody>
    ${lista.sort((a, b) => a.nome.localeCompare(b.nome)).map(x => { const prod = f.usg.find(y => y.cod === x.cod)?.producao || {}, im = f.img.find(y => y.cod === x.cod) || x;
      return `<tr><td><b>${esc(im.classe)}</b></td><td>${esc(x.cod)}</td><td class="fh-nome">${esc(x.nome)}</td>${un.map(u => `<td class="n">${celValor(prod[u.cod])}</td>`).join('')}<td class="n"><b>${fmtBR(im.producaoUSG)}</b></td><td class="small">${im.classeFixa ? `fixo classe ${esc(im.classe)}` : !im.producaoUSG ? 'sem produção de USG / classe D' : ''}</td></tr>`; }).join('') || `<tr><td colspan="${un.length + 5}" class="muted">Sem produção de USG nesta competência.</td></tr>`}</tbody></table></div></div>`;
}
function desenharIndicadoresFech(corpo, f) {
  const ind = indicadoresFechamento(f, S.cfg, S.nc.itens.filter(x => x.competencia === S.comp));
  const tab = (titulo, pares, fmt = v => 'R$ ' + fmtBR(v)) => `<div class="card"><h3>${titulo}</h3>${pares.length ? `<table class="fh-ind">${pares.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${fmt(v)}</td></tr>`).join('')}</table>` : '<p class="muted small">—</p>'}</div>`;
  corpo.innerHTML = `<div class="nc-kpis"><div class="nc-kpi"><b>R$ ${fmtBR(ind.totais.usg)}</b><small>total USG</small></div><div class="nc-kpi"><b>R$ ${fmtBR(ind.totais.img)}</b><small>total IMG</small></div><div class="nc-kpi"><b>R$ ${fmtBR(ind.totais.curitiba)}</b><small>total Curitiba (V3)</small></div>
    <div class="nc-kpi warn"><b>${ind.variacoes.length}</b><small>variações acima de ${S.cfg.fechamento.variacaoAlerta}%</small></div><div class="nc-kpi err"><b>${ind.ncs.impactam}</b><small>NCs que impactam o pagamento</small></div><div class="nc-kpi"><b>${ind.decisoes}</b><small>linhas com decisão</small></div></div>
    <div class="grid3">${tab('USG por unidade', ind.usgPorUnidade)}${tab('USG por faixa', ind.usgPorFaixa)}${tab('Prestadores por situação', ind.porSituacao, v => v)}
      ${tab('IMG por unidade', ind.imgPorUnidade)}${tab('IMG por classe', ind.imgPorClasse)}${tab('Variação × competência anterior', ind.variacoes, v => (v > 0 ? '+' : '') + fmtBR(v) + '%')}</div>
    ${(() => { const cob = coberturaCompetencia(S.rodadas, S.comp); return `<div class="card" id="cobFech"><h3>Cobertura automática por prestador <span class="muted small">${cob.total ? `${fmtPct(cob.pct)}% na competência · ${cob.conferidas} de ${cob.total} linhas` : 'sem rodadas de conferência'}</span></h3>
      ${cob.porPrestador.length ? `<div class="tw"><table><thead><tr><th>Prestador</th><th class="n">Linhas</th><th class="n">Conferidas</th><th class="n">Cobertura</th><th>Maior bloqueio (título × código)</th></tr></thead><tbody>${cob.porPrestador.map(e => `<tr><td>${esc(e.cod)} - ${esc(e.nome)}</td><td class="n">${e.total}</td><td class="n">${e.conferidas}</td><td class="n"><b>${fmtPct(e.pct)}%</b></td><td>${e.maiorBloqueio ? `${esc(e.maiorBloqueio[0])} <span class="muted small">(${e.maiorBloqueio[1]} linha(s))</span>` : '<span class="muted small">—</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="acoes"><a href="#equivalencias" data-destrava class="small">Ver o que mais destrava →</a></div></div>`; })()}`;
}

function ligarFech(corpo, f, mk) {
  corpo.querySelectorAll('[data-aj]').forEach(inp => inp.onchange = () => {
    const [tipo, cod, campo] = inp.dataset.aj.split('|');
    const x = [...f.usg, ...f.img, ...f.curitiba].find(y => y.tipo === tipo && y.cod === cod);
    const temParcela = campo === 'descontos' && (x?.parcelas || []).length;
    if (salvarFech(fe => { fe.ajustes[tipo] = fe.ajustes[tipo] || {}; const a = fe.ajustes[tipo][cod] = fe.ajustes[tipo][cod] || {};
      // Desconto com parcela automática: apagar o valor volta ao automático.
      if (temParcela && inp.value === '') delete a.descontos;
      else a[campo] = campo === 'obs' ? inp.value.trim() : (inp.value === '' ? 0 : +inp.value); })) {
      if (temParcela) registrarAlteracao(S.compReg, S.comp, S.operador || '', 'fechamento', inp.value === '' ? `${x.nome}: desconto voltou ao automático (R$ ${fmtBR(x.descontosAuto)}).` : `${x.nome}: desconto alterado à mão para R$ ${fmtBR(+inp.value)} (automático: R$ ${fmtBR(x.descontosAuto)}; ${x.parcelas.map(p => p.obs).join('; ')}).`);
      if (temParcela) salvarCompReg();
      RENDER.fechamento();
    }
  });
  corpo.querySelectorAll('[data-copiar]').forEach(b => b.onclick = () => {
    const [modo, cod] = b.dataset.copiar.split('|'), x = listaFech(f, modo).find(y => y.cod === cod);
    copiarTexto(textoPreviaPrestador(x, S.cfg, S.comp, modo === 'usg' ? mk.pagUSG : modo === 'curitiba' ? mk.pagCuritiba : mk.pagIMG, f.nfs.filter(n => n.tipo === modo)), `Prévia de ${x.nome}`);
  });
  // Avisos: abrir e fechar sem redesenhar a tabela (clique no botão ou na linha).
  const alternar = k => {
    const det = corpo.querySelector(`tr.fh-det[data-det="${CSS.escape(k)}"]`), bt = corpo.querySelector(`[data-avisos="${CSS.escape(k)}"]`); if (!det) return;
    det.hidden = !det.hidden; FH.abertos[det.hidden ? 'delete' : 'add'](k);
    if (bt) { bt.classList.toggle('aberto', !det.hidden); bt.setAttribute('aria-expanded', String(!det.hidden)); }
  };
  corpo.querySelectorAll('tr.fh-det').forEach(tr => { tr.cells[0].colSpan = tr.closest('table').tHead.rows[0].cells.length; });
  corpo.querySelectorAll('[data-avisos]').forEach(b => {
    b.onclick = e => { e.stopPropagation(); alternar(b.dataset.avisos); };
    const tr = b.closest('tr'); tr.classList.add('clicavel');
    tr.onclick = e => { if (!e.target.closest('input,button,select,a,textarea')) alternar(b.dataset.avisos); };
  });
  corpo.querySelectorAll('[data-sit]').forEach(b => b.onclick = e => { e.stopPropagation(); abrirMenuSituacao(b, f); });
  ligarDescontos(corpo, () => RENDER.fechamento());
  corpo.querySelectorAll('[data-nf-nova]').forEach(b => b.onclick = () => editarNF(b.dataset.nfNova));
  corpo.querySelectorAll('[data-nf-ed]').forEach(b => b.onclick = () => { const n = f.nfs.find(x => x.id === b.dataset.nfEd); if (n) editarNF(n.tipo, n.id); });
  corpo.querySelectorAll('[data-nf-rm]').forEach(b => b.onclick = async () => {
    const n = f.nfs.find(x => x.id === b.dataset.nfRm); if (!n) return;
    if (!await confirmar('Excluir NF complementar?', `${esc(n.nome || n.cod)} · ${esc(n.categoria)} · R$ ${fmtBR(valorNF(n))}`, 'Excluir')) return;
    if (salvarFech(fe => { fe.nfs = nfsDoFechamento(fe).filter(x => x.id !== n.id); fe.blocos = { complementar: [], cetrus: [] }; })) RENDER.fechamento();
  });
  for (const [id, k] of [['fhObsUSG', 'usg'], ['fhObsIMG', 'img'], ['fhObsCur', 'curitiba']]) if ($(id)) $(id).onchange = e => salvarFech(fe => { fe.obs = { ...fe.obs, [k]: e.target.value }; });
}
async function copiarTexto(texto, titulo) {
  try { await navigator.clipboard.writeText(texto); avisar(`${titulo} copiada: cole no e-mail.`, 'ok'); }
  catch (e) { await dialogo(titulo, `<p class="small muted">Copie o texto abaixo (Ctrl+C) e cole no e-mail.</p><textarea rows="12" style="width:100%" readonly onfocus="this.select()">${esc(texto)}</textarea>`, [['ok', 'Fechar']]); }
}
async function exportarFechamento(f, mk) {
  const mmaaaa = `${S.comp.slice(5)}-${S.comp.slice(0, 4)}`;
  await baixarZip(xlsxFechamento(f, S.cfg, { pagUSG: mk.pagUSG, pagIMG: mk.pagIMG, pagCuritiba: mk.pagCuritiba }), `REPASSE_${mmaaaa}_CONTROLE${f.previa ? '_PREVIA' : ''}_${carimbo()}.xlsx`);
  // Evidência nas etapas de envio do Fluxo mensal (não conclui nada sozinha).
  const comp = S.fluxo.competencias[S.comp];
  if (comp && !compFechada()) {
    for (const g of ['usg', 'img']) { const t = comp.grupos[g]?.tarefas?.envio; if (t) (t.evidencias = t.evidencias || []).push({ em: agoraISO(), por: S.operador, desc: `planilha de fechamento ${f.previa ? '(prévia) ' : ''}gerada` }); }
    salvarFluxo();
  }
  avisar(`Planilha ${f.previa ? 'PRÉVIA ' : ''}da competência ${rotuloCompetencia(S.comp)} gerada${comp ? '; registrada como evidência no Fluxo mensal (etapas de envio)' : ''}.`, 'ok');
}

/* ---------- Situação do prestador: menu de ações (SOL-F32) ----------
 * «Verificar» manual fica no fechamento da competência; envio e NF gravam no controle documental do
 * Fluxo mensal (o dono desses dados), e a situação calculada passa a refletir isso. */
const GRUPO_DOC = { usg: 'usg', img: 'img', curitiba: 'curitiba' };
const ACOES_DOC = [['relatorio', 'E-mail enviado (relatório e prévia)'], ['nfRecebida', 'NF recebida'], ['nfFinanceiro', 'NF encaminhada ao Financeiro']];
function fecharMenuSituacao() { const m = $('menuSit'); if (m) m.remove(); }
document.addEventListener('click', e => { if (!e.target.closest('#menuSit')) fecharMenuSituacao(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharMenuSituacao(); });
window.addEventListener('scroll', fecharMenuSituacao, true);
function abrirMenuSituacao(btn, f) {
  fecharMenuSituacao();
  const [modo, cod] = btn.dataset.sit.split('|'), x = listaFech(f, modo).find(y => y.cod === cod); if (!x) return;
  const comp = S.fluxo.competencias[S.comp], doc = comp?.grupos?.[GRUPO_DOC[modo]]?.documental?.[cod] || {};
  const m = document.createElement('div'); m.id = 'menuSit'; m.className = 'menu-sit'; m.setAttribute('role', 'menu');
  m.innerHTML = `<div class="cab">Situação de «${esc(x.nome)}»</div>
    ${x.manual ? '<button type="button" data-ac="tirar">Tirar a marca «Verificar» (volta ao calculado)</button>' : '<button type="button" data-ac="verificar">Marcar para verificar… <small>pede o motivo</small></button>'}
    <hr>${ACOES_DOC.map(([k, t]) => `<button type="button" data-ac="${k}">${doc[k] ? `✓ ${t} · ${fmtData(paraData(doc[k]))} <small>desfazer</small>` : `${t} <small>grava no Fluxo</small>`}</button>`).join('')}
    <hr><div class="rodape">Situação calculada: ${esc(SITUACAO_FECH[x.situacaoCalculada || x.situacao].nome)}</div>`;
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect(), w = 320;
  m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
  m.style.top = (r.bottom + 4 + m.offsetHeight > window.innerHeight ? Math.max(8, r.top - m.offsetHeight - 4) : r.bottom + 4) + 'px';
  m.querySelectorAll('[data-ac]').forEach(b => b.onclick = async e => { e.stopPropagation(); fecharMenuSituacao(); await acaoSituacao(b.dataset.ac, modo, x); });
}
async function acaoSituacao(ac, modo, x) {
  if (!exigirAberta(S.comp, 'mudar a situação')) return;
  const op = await exigirOperador(); if (!op) return;
  const tipo = x.tipo;   // as marcas manuais usam a tabela do prestador (usg, img ou curitiba)
  if (ac === 'verificar') {
    const r = await dialogo(`Marcar «${x.nome}» para verificar`, `<p class="small muted">A marca fica por cima da situação calculada até você tirar. Aparece na tela e na planilha (cor «Verificar»).</p><label class="campo">Motivo (obrigatório)<input type="text" name="motivo"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Marcar']]);
    if (r.botao !== 'ok') return;
    if (!r.campos.motivo.trim()) return avisar('Informe o motivo.', 'warn');
    salvarFech(fe => { fe.manual = fe.manual || {}; fe.manual[tipo] = { ...(fe.manual[tipo] || {}), [x.cod]: { motivo: r.campos.motivo.trim(), por: op, em: agoraISO() } }; });
    avisar(`${x.nome} marcado para verificar.`, 'ok');
  } else if (ac === 'tirar') {
    salvarFech(fe => { if (fe.manual?.[tipo]) delete fe.manual[tipo][x.cod]; if (tipo === 'curitiba' && fe.manual?.img) delete fe.manual.img[x.cod]; });
    avisar(`Marca «Verificar» retirada de ${x.nome}.`, 'ok');
  } else {
    const comp = S.fluxo.competencias[S.comp], g = comp?.grupos?.[GRUPO_DOC[modo]];
    if (!comp) return avisar(`Inicie o checklist da competência ${rotuloCompetencia(S.comp)} no Fluxo mensal para registrar envio e NF.`, 'warn');
    if (!g?.documental) return avisar('O grupo deste repasse no Fluxo mensal não tem controle documental.', 'warn');
    const d = g.documental[x.cod] = g.documental[x.cod] || novoDocumental({ cod: x.cod, nome: x.nome });
    d[ac] = d[ac] ? '' : isoDia(new Date());
    salvarFluxo(); avisar(`${x.nome}: ${ACOES_DOC.find(a => a[0] === ac)[1]} ${d[ac] ? `registrado em ${fmtData(paraData(d[ac]))}` : 'desfeito'} (controle documental do Fluxo).`, 'ok');
  }
  RENDER.fechamento();
}
