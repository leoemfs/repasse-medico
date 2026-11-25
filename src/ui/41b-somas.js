/* ============================================================
 * Equivalências → «Laudos que somam um código» (prévia aprovada em 25/11/2026: docs/prototipos/laudos-somam-codigo/)
 * Cadastro das regras do motor (src/engine/50b-somas.js): títulos dos laudos + código do MV + escopo.
 * ============================================================ */
const SM = { nova: false, nTit: 2 };
function cardSomas() {
  const l = S.eq.somas || [], val = l.filter(s => s.status === 'validada').length;
  const titulos = [...new Set([...(S.apolo?.laudos || []).map(x => x.titulo), ...(S.eq.itens || []).map(e => e.titulo)].filter(Boolean))].sort().slice(0, 4000);
  const codigos = (S.eq.catalogoTUSS || []).slice(0, 4000);
  const item = s => `<div class="sm-item${s.status === 'validada' ? '' : ' off'}"><div class="sm-tits">${s.titulos.map(t => `<span class="tag-cp">${esc(t)}</span>`).join('<span class="muted"> + </span>')}</div><span class="sm-eq">=</span>
    <div><b>${esc(s.codigo)}</b>${s.desc ? ` · ${esc(s.desc)}` : ''}<small class="nc-det">${s.status === 'validada' ? `validada por ${esc(s.responsavel || '—')} em ${new Date(s.validadoEm).toLocaleDateString('pt-BR')}` : 'sem validação (não vale na conferência)'} · ${s.escopo.unidade === '*' ? 'todas as unidades' : `unidade ${esc(s.escopo.unidade)}`}${s.escopo.convenio === '*' ? '' : ` · convênio ${esc(s.escopo.convenio)}`}</small></div>
    <button type="button" class="sec mini" data-smst="${esc(s.id)}">${s.status === 'validada' ? 'Tirar validação' : 'Validar de novo'}</button></div>`;
  return `<div id="cardSomas" class="card" style="margin-top:14px"><div class="fx-topo"><h2 style="margin:0">Laudos que somam um código <span class="muted small">${l.length} regra(s) · ${val} validada(s)</span></h2>${SM.nova ? '' : '<button type="button" class="sec" id="smNova">+ Nova regra</button>'}</div>
    <p class="lead">O contrário da regra composta: dois ou mais laudos do mesmo paciente, no mesmo dia e do mesmo médico valem <b>um código</b> da conta (ex.: TC abdome superior + inferior = TC abdome total). Na conferência, a linha do MV fecha com todos eles juntos.</p>
    <div class="sm-lista">${l.map(item).join('') || '<p class="muted small">Nenhuma regra ainda.</p>'}</div>
    ${SM.nova ? `<div class="sm-form"><div class="sm-tits-in"><span class="small muted">Títulos dos laudos (todos no mesmo dia)</span>${Array.from({ length: SM.nTit }, (_, i) => `<input data-smtit="${i}" list="smTitOpc" placeholder="título do laudo no Apolo">`).join('')}<datalist id="smTitOpc">${titulos.map(t => `<option value="${esc(t)}">`).join('')}</datalist><button type="button" class="sec mini" id="smMaisTit" style="justify-self:start">+ outro título</button></div>
      <div class="sm-dir"><label class="campo">Código no MV<input id="smCod" list="smCodOpc" placeholder="ex.: 41001095"><datalist id="smCodOpc">${codigos.map(t => `<option value="${esc(`${t.codigo} - ${t.desc || ''}`)}">`).join('')}</datalist></label>
        <label class="campo">Unidade<select id="smUn"><option value="*">Todas as unidades</option>${opcoes(S.cfg.unidades.map(u => [u.cod, `${u.cod} - ${u.nome}`]), '')}</select></label>
        <label class="campo">Convênio<select id="smConv"><option value="*">Todos os convênios</option>${opcoes((S.cfg.convenios || []).map(c => [c.nome, c.nome]), '')}</select></label>
        <div class="acoes" style="margin:0"><button type="button" id="smValidar">Validar regra</button><button type="button" class="sec" id="smCancelar">Cancelar</button></div></div></div>` : ''}</div>`;
}
function ligarSomas(raiz) {
  if (!raiz.querySelector('#cardSomas')) return;
  const re = () => RENDER.equivalencias();
  if ($('smNova')) $('smNova').onclick = () => { SM.nova = true; SM.nTit = 2; re(); };
  if ($('smCancelar')) $('smCancelar').onclick = () => { SM.nova = false; re(); };
  if ($('smMaisTit')) $('smMaisTit').onclick = () => { const vals = [...raiz.querySelectorAll('[data-smtit]')].map(i => i.value); SM.nTit++; re(); raiz.querySelectorAll('[data-smtit]').forEach((i, k) => { i.value = vals[k] || ''; }); };
  if ($('smValidar')) $('smValidar').onclick = async () => {
    const titulos = [...raiz.querySelectorAll('[data-smtit]')].map(i => i.value.trim()).filter(Boolean), cv = $('smCod').value.trim(), codigo = (cv.match(/^(\d+)/) || [])[1] || cv, desc = cv.includes(' - ') ? cv.slice(cv.indexOf(' - ') + 3) : '';
    if (titulos.length < 2) return avisar('Informe pelo menos dois títulos de laudo.', 'warn');
    if (new Set(titulos.map(chaveTitulo)).size < titulos.length) return avisar('Os títulos precisam ser diferentes.', 'warn');
    if (!/^\d+$/.test(codigo)) return avisar('Informe o código do procedimento no MV.', 'warn');
    const op = await exigirOperador(); if (!op) return;
    (S.eq.somas ||= []).push(novaSoma({ titulos, codigo, desc, escopo: { unidade: $('smUn').value, convenio: $('smConv').value } }, op));
    S.eq.revisao = (+S.eq.revisao || 0) + 1; S.eq.atualizadoEm = agoraISO(); SM.nova = false;
    salvarEq(`Regra validada: ${titulos.join(' + ')} = ${codigo}. Rode a conferência de novo para valer.`); re();
  };
  raiz.querySelectorAll('[data-smst]').forEach(b => b.onclick = async () => {
    const s = (S.eq.somas || []).find(x => x.id === b.dataset.smst); if (!s) return;
    const op = await exigirOperador(); if (!op) return;
    const para = s.status === 'validada' ? 'desativada' : 'validada';
    (s.historico ||= []).push({ em: agoraISO(), por: op, de: s.status, para, motivo: para === 'validada' ? 'validada de novo' : 'validação retirada' });
    s.status = para; if (para === 'validada') { s.responsavel = op; s.validadoEm = agoraISO(); }
    S.eq.revisao = (+S.eq.revisao || 0) + 1; S.eq.atualizadoEm = agoraISO();
    salvarEq(`Regra «${nomeSoma(s)}»: ${para === 'validada' ? 'validada' : 'validação retirada'}.`); re();
  });
}
