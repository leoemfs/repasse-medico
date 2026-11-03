/* ============================================================
 * Fluxo mensal ligado aos dados da ferramenta
 * - SOL-F14: controle documental de USG, IMG e Curitiba lido de Bases (sem segundo cadastro).
 * - SOL-F13: classificação lida do Fechamento (produção e classe calculadas); o Fluxo só registra a
 *   conferência humana e o ajuste manual com justificativa.
 * - SOL-F16: status sugerido nas etapas, a partir dos dados. Nada conclui sozinho: um clique confirma.
 * ============================================================ */
// Quem entra em cada fluxo, pelas regras de Bases.
const GRUPOS_FLUXO_BASES = {
  usg: p => !!p.regras?.faixaUSG && !p.regras?.v3,
  img: p => !!p.regras?.participaIMG && !p.regras?.v3,
  curitiba: p => !!p.regras?.v3
};
function sincronizarDocumentalComBases(comp) {
  let n = 0;
  for (const [gid, entra] of Object.entries(GRUPOS_FLUXO_BASES)) {
    const eg = comp.grupos[gid]; if (!eg?.documental) continue;
    for (const p of S.cfg.prestadores) if (!p.naoRealizaRepasse && entra(p) && !eg.documental[p.cod] && !(eg.removidos || []).includes(String(p.cod))) { eg.documental[p.cod] = { ...novoDocumental({ cod: p.cod, nome: p.nomeMV }), origem: 'Bases' }; n++; }
  }
  return n;
}

/* ---------- F13: classificação ---------- */
function fechamentoDoFluxo(comp) {
  try { return comp.chave === S.comp ? fechamentoAtual() : montarFechamento({ rodadas: S.rodadas, cfg: S.cfg, chave: comp.chave, fech: fechDaCompetencia(comp.chave), fluxoComp: comp }); } catch (e) { return null; }
}
function linhasClassificacao(comp) {
  const f = fechamentoDoFluxo(comp), cl = comp.grupos.classif?.classificacao || {};
  return (f?.img || []).map(x => {
    const e = cl[x.cod] || {}, classe = e.classeManual || x.classe;
    const mudou = e.conferidoEm && (e.producaoConferida !== x.producaoUSG || e.classeConferida !== x.classe);
    return { cod: x.cod, nome: x.nome, producao: x.producaoUSG, classeCalc: x.classe, fixa: x.classeFixa, classe, manual: e.classeManual || '', just: e.justificativa || '', conferido: !!e.conferidoEm && !mudou, mudou, e };
  });
}
function blocoClassificacao(comp, g) {
  const linhas = linhasClassificacao(comp), ok = linhas.filter(l => l.conferido).length;
  return `<h4 class="sub-fx">Classificação por prestador (calculada no Fechamento)</h4>
    <p class="small muted">Produção bruta de USG e classe vêm do Fechamento (cortes em Bases → Classes e valores IMG). Aqui você só confere; o ajuste manual exige justificativa e aparece como aviso quando difere do calculado. ${ok} de ${linhas.length} conferido(s).</p>
    <div class="acoes" style="margin:0 0 6px"><button class="sec" data-clconf="*"${linhas.length && ok < linhas.length ? '' : ' disabled'}>Conferir todos os que não têm ajuste</button><a href="#fechamento" class="small">Abrir Fechamento → Produção e classe</a></div>
    <div class="tw"><table class="tab-fx"><thead><tr><th>Prestador</th><th class="n">Produção bruta USG (R$)</th><th>Classe calculada</th><th>Ajuste manual</th><th>Conferência</th></tr></thead><tbody>${linhas.length ? linhas.map(l => `<tr data-clp="${esc(l.cod)}">
      <td>${esc(l.cod)} · ${esc(l.nome)}</td><td class="n">${l.fixa ? '<span class="small">classe fixa</span>' : fmtBR(l.producao)}</td><td><b>${esc(l.classeCalc)}</b>${l.fixa ? ' <span class="small muted">(fixa)</span>' : ''}</td>
      <td><select data-clman aria-label="Ajuste manual">${opcoes([['', '— usa a calculada —'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D']], l.manual)}</select>${l.manual && l.manual !== l.classeCalc ? `<small class="txt-warn" style="display:block">difere do calculado (${esc(l.classeCalc)}): ${esc(l.just || 'sem justificativa')}</small>` : ''}</td>
      <td>${l.conferido ? `${stTarefa('ok')} <small class="muted">${esc(l.e.conferidoPor || '')} · ${new Date(l.e.conferidoEm).toLocaleDateString('pt-BR')}</small> <button class="sec mini" data-cldes>desfazer</button>` : `${l.mudou ? '<small class="txt-warn">valor mudou depois da conferência</small> ' : ''}<button class="sec mini" data-clconf="${esc(l.cod)}">Conferir</button>`}</td></tr>`).join('')
      : '<tr><td colspan="5" class="muted">Nenhum prestador de IMG em Bases. Marque «Recebe repasse de IMG» nas regras do prestador.</td></tr>'}</tbody></table></div>`;
}
function ligarClassificacao(comp, sec) {
  const eg = comp.grupos.classif; if (!eg) return;
  const linhas = () => linhasClassificacao(comp);
  const conferir = l => { eg.classificacao[l.cod] = { ...(eg.classificacao[l.cod] || {}), cod: l.cod, nome: l.nome, conferidoPor: S.operador, conferidoEm: agoraISO(), producaoConferida: l.producao, classeConferida: l.classeCalc }; };
  sec.querySelectorAll('[data-clconf]').forEach(b => b.onclick = async () => {
    const op = await exigirOperador(); if (!op) return;
    const alvo = b.dataset.clconf === '*' ? linhas().filter(l => !l.conferido && !l.manual) : linhas().filter(l => l.cod === b.dataset.clconf);
    alvo.forEach(conferir); salvarFluxo(`${alvo.length} classificação(ões) conferida(s).`); desenharAcompanhamento();
  });
  sec.querySelectorAll('[data-cldes]').forEach(b => b.onclick = () => { const cod = b.closest('tr').dataset.clp, e = eg.classificacao[cod]; if (e) { delete e.conferidoEm; delete e.conferidoPor; } salvarFluxo(); desenharAcompanhamento(); });
  sec.querySelectorAll('[data-clman]').forEach(sel => sel.onchange = async () => {
    const cod = sel.closest('tr').dataset.clp, l = linhas().find(x => x.cod === cod);
    let just = '';
    if (sel.value && sel.value !== l.classeCalc) {
      const r = await dialogo(`Ajuste manual da classe — ${l.nome}`, `<p class="small">Calculada: <b>${esc(l.classeCalc)}</b> · ajuste: <b>${esc(sel.value)}</b>. O ajuste vale só para o registro do Fluxo; o Fechamento continua usando a regra de Bases (classe fixa no cadastro do prestador).</p><label class="campo">Justificativa (obrigatória)<input type="text" name="just"></label>`, [['', 'Cancelar', 'sec'], ['ok', 'Salvar ajuste']]);
      if (r.botao !== 'ok' || !r.campos.just.trim()) { if (r.botao === 'ok') avisar('Informe a justificativa.', 'warn'); return desenharAcompanhamento(); }
      just = r.campos.just.trim();
    }
    eg.classificacao[cod] = { ...(eg.classificacao[cod] || {}), cod, nome: l.nome, classeManual: sel.value, justificativa: just, ajustePor: S.operador, ajusteEm: agoraISO() };
    salvarFluxo(); desenharAcompanhamento();
  });
}

/* ---------- F16: status sugerido ---------- */
const RANK_ST = { ni: 0, and: 1, ter: 1, cor: 1, ok: 2, na: 3 };
function sugestoesFluxo(comp) {
  const sug = {}, f = fechamentoDoFluxo(comp), put = (k, status, texto) => { sug[k] = { status, texto }; };
  const conta = (lista, ok, total) => !total ? null : ok >= total ? 'ok' : ok ? 'and' : null;
  if (f) {
    for (const [g, lista] of [['usg', f.usg], ['img', f.img], ['curitiba', f.curitiba || []]]) {
      const comValores = lista.filter(x => x.temValores), aceitos = comValores.filter(x => !x.semAceite.length && !x.manual).length;
      if (comValores.length) {
        const st = aceitos >= comValores.length ? 'ok' : 'and', t = `${aceitos} de ${comValores.length} prestador(es) com aceite`;
        if (g === 'usg') { put('usg.conf', st, t); put('usg.valid', aceitos === comValores.length ? 'ok' : null, t); put('usg.gerar', 'ok', `${comValores.length} relatório(s) de USG conferidos na ferramenta`); }
        if (g === 'img') { put('img.cruzada', st, t); put('img.validacao', aceitos === comValores.length ? 'ok' : null, t); put('img.individuais', 'ok', `${comValores.length} relatório(s) de IMG conferidos na ferramenta`); }
        if (g === 'curitiba') { put('curitiba.conf', st, t); put('curitiba.cruzada', st, t); put('curitiba.valid', aceitos === comValores.length ? 'ok' : null, t); }
      }
    }
    if (f.img.some(x => x.producaoUSG > 0)) put('classif.apurar', 'ok', 'produção bruta de USG calculada no Fechamento');
  }
  const cl = linhasClassificacao(comp), clOk = cl.filter(l => l.conferido).length;
  if (cl.length) { const st = conta(null, clOk, cl.length), t = `${clOk} de ${cl.length} classificação(ões) conferida(s)`; ['conferir', 'classificar', 'registrar', 'validar'].forEach(k => put('classif.' + k, st, t)); }
  for (const g of ['usg', 'img', 'curitiba']) {
    const docs = Object.values(comp.grupos[g]?.documental || {}); if (!docs.length) continue;
    const env = docs.filter(d => d.relatorio).length, nf = docs.filter(d => d.nfFinanceiro).length;
    put(`${g}.envio`, conta(null, env, docs.length), `${env} de ${docs.length} relatório(s) e prévia(s) enviados`);
    put(`${g}.nf`, conta(null, nf, docs.length), `${nf} de ${docs.length} NF(s) encaminhadas ao Financeiro`);
  }
  const corr = (S.rodadas || []).filter(r => r.tipo === 'correcao' && competenciaDaRodada(r) === comp.chave).length;
  if (corr) put('img.processar', 'ok', `${corr} rodada(s) de correção de prestador neste mês`);
  if (S.nc) {
    const ind = indicadoresNC(S.nc.itens.filter(x => x.competencia === comp.chave));
    for (const g of ['usg', 'img', 'curitiba']) { const p = ind.porPrazo[g]; if (p.total) put(`nc.${g}`, p.abertas ? 'and' : 'ok', p.abertas ? `${p.abertas} de ${p.total} NC(s) ainda não enviadas ao Qualiex` : `${p.total} NC(s), todas enviadas`); }
  }
  return sug;
}
// Sugestão que vale mostrar para uma etapa: só quando avança em relação ao status atual.
function sugestaoDaTarefa(sugs, gId, tId, atual) {
  const s = sugs[`${gId}.${tId}`];
  return s && s.status && atual !== 'na' && RANK_ST[s.status] > RANK_ST[atual] ? s : null;
}
