/* ============================================================
 * Conferências compartilhadas pela pasta da rede (pedido de 26/11/2026) — mescla em 87c-conf-sync.js.
 * Decisões de linha, observações e rodadas (com o aceite) da competência vão para
 * «AAAA-MM - Mês › conferencias_compartilhadas.json». Gravar uma decisão, uma observação ou uma rodada (aceite) agenda a
 * sincronização; o relógio de 30 s confere se a outra pessoa mudou o arquivo; trocar a competência sincroniza a nova.
 * Sem escolha manual: a regra de mescla resolve (a mais recente vale), e cada registro mostra quem fez.
 * ============================================================ */
const SYD = { status: 'off', erro: '', lm: 0, comp: '', meta: null, ocupado: false, pendente: false, autores: [], local: '' };
const CHAVE_SYNC_CONF = 'rm2.confSyncBase';   // {competência: {decisoes, observacoes}} da última versão sincronizada
const baseConfSync = chave => { const b = (lerLocal(CHAVE_SYNC_CONF) || {})[chave]; return b ? { ...b, rodadas: [] } : null; };
function gravarBaseConfSync(chave, partes) { const m = lerLocal(CHAVE_SYNC_CONF) || {}; m[chave] = { decisoes: partes.decisoes, observacoes: partes.observacoes }; gravarLocal(CHAVE_SYNC_CONF, m); }
async function dirConfSync(chave, criar = true) { const d = await dirCompetencia(chave, criar); if (d) SYD.local = d.name; return d; }
async function sincronizarConf({ interativo = false } = {}) {
  if (!SY.handle || SY.legado || !S.compReg) return;
  if (SYD.ocupado) { SYD.pendente = true; return; }
  if (!(await temPermissaoPasta(interativo))) { SYD.status = 'permissao'; atualizarBarraConf(); return; }
  const chave = S.comp; SYD.ocupado = true; atualizarBarraConf();
  try {
    for (let t = 0; t < 3; t++) {
      let dir = await dirConfSync(chave, false), remoto = null, lm = 0;
      if (dir) try { const f = await (await dir.getFileHandle(ARQ_CONF_SYNC)).getFile(); lm = f.lastModified; const d = JSON.parse(await f.text()); if (d.schema !== SCHEMA_CONF_SYNC) throw new Error(`${ARQ_CONF_SYNC} não é a base de conferências`); remoto = d; }
      catch (e) { if (e.name !== 'NotFoundError') throw e; }
      const todas = await dbRodadasJanela(chave, true), local = partesConfSync(S.compReg, todas, chave);   // só as rodadas da competência (índice do banco)
      const rem = remoto ? { decisoes: remoto.decisoes || [], observacoes: remoto.observacoes || [], rodadas: remoto.rodadas || [] } : null;
      const { partes, novas } = mesclarConf(local, rem, baseConfSync(chave));
      // Decisões e observações → registro da competência; rodadas novas ou mudadas → banco do navegador.
      if (JSON.stringify([partes.decisoes, partes.observacoes]) !== JSON.stringify([local.decisoes, local.observacoes])) { aplicarPartesConf(S.compReg, chave, partes); salvarCompReg(); }
      const porId = new Map(local.rodadas.map(r => [r.id, JSON.stringify(r)]));
      for (const r of partes.rodadas) if (porId.get(r.id) !== JSON.stringify(r)) { await dbGravar(r); const i = S.rodadas.findIndex(x => x.id === r.id); if (i >= 0) S.rodadas[i] = r; else if (competenciaDaRodada(r) === S.comp) S.rodadas.push(r); }
      const chegou = novas.decisoes + novas.observacoes + novas.rodadas;
      if (chegou && remoto) {
        avisar(`Chegaram pela pasta (${remoto.atualizadoPor || 'outra pessoa'}): ${[novas.decisoes && `${novas.decisoes} decisão(ões)`, novas.observacoes && `${novas.observacoes} observação(ões)`, novas.rodadas && `${novas.rodadas} rodada(s)`].filter(Boolean).join(', ')}.`, 'ok');
        if (S.conf && S.conf.ctx?.chaveCompetencia === chave) { aplicarDecisoes(S.conf.res, indiceDecisoesComp()); if (location.hash === '#conferencia') desenharConferencia(); }
        else if (location.hash === '#conferencia') RENDER.conferencia();
      }
      const remJ = rem ? JSON.stringify(rem) : '';
      if (remJ !== JSON.stringify(partes) && (remoto || partes.decisoes.length || partes.observacoes.length || partes.rodadas.length)) {
        dir = dir || await dirConfSync(chave, true);
        const fh = await dir.getFileHandle(ARQ_CONF_SYNC, { create: true });
        if (lm && (await fh.getFile()).lastModified !== lm) continue;   // a outra pessoa gravou no meio: mescla de novo
        const meta = { atualizadoEm: agoraISO(), atualizadoPor: S.operador || '' };
        const texto = JSON.stringify({ schema: SCHEMA_CONF_SYNC, versaoSchema: 1, motor: MOTOR_VERSAO, competencia: chave, ...meta, ...partes });
        const w = await fh.createWritable(); await w.write(texto); await w.close();
        const gravado = await fh.getFile(); if (await gravado.text() !== texto) continue;
        SYD.lm = gravado.lastModified; SYD.meta = meta;
      } else { SYD.lm = lm; SYD.meta = remoto ? { atualizadoEm: remoto.atualizadoEm, atualizadoPor: remoto.atualizadoPor } : SYD.meta; }
      gravarBaseConfSync(chave, partes); SYD.autores = resumoAutoresConf(partes);
      SYD.comp = chave; SYD.status = 'ok'; SYD.erro = '';
      return;
    }
    SYD.status = 'erro'; SYD.erro = 'o arquivo da pasta mudou durante a gravação; tente de novo';
  } catch (e) { SYD.status = 'erro'; SYD.erro = e.message || String(e); }
  finally { SYD.ocupado = false; atualizarBarraConf(); if (SYD.pendente) { SYD.pendente = false; setTimeout(() => sincronizarConf(), 50); } }
}
async function checarConfPasta() {
  if (!SY.handle || SY.legado || SYD.ocupado || SYD.status === 'permissao') return;
  if (SYD.comp !== S.comp) return sincronizarConf();
  try { const d = await dirConfSync(S.comp, false); if (!d) return; const f = await (await d.getFileHandle(ARQ_CONF_SYNC)).getFile(); if (f.lastModified !== SYD.lm) sincronizarConf(); }
  catch (e) { if (e.name === 'NotFoundError') sincronizarConf(); }
}
function barraConf() {
  if (!SY.handle || SY.legado) return `<div class="sy-barra off" id="confSync"><span class="sy-dot"></span><b>Conferências só neste navegador.</b><span class="muted">Conecte a pasta raiz do aplicativo para dividir decisões, observações, rodadas e aceites com a outra pessoa.</span></div>`;
  const cls = SYD.status === 'ok' ? 'ok' : 'warn';
  const txt = SYD.ocupado ? 'Sincronizando…' : { ok: 'Conferências sincronizadas no aceite', permissao: 'Acesso à pasta precisa ser liberado', erro: `Sem acesso à pasta — guardado neste navegador (${esc(SYD.erro)})`, off: 'Conectando…' }[SYD.status] || SYD.status;
  const quem = SYD.autores.filter(a => a.quem !== '—' || a.decisoes || a.rodadas).map(a => `<b>${esc(a.quem)}</b>: ${[a.decisoes && `${a.decisoes} decisão(ões)`, a.observacoes && `${a.observacoes} obs.`, a.rodadas && `${a.rodadas} rodada(s)`, a.aceites && `${a.aceites} aceite(s)`].filter(Boolean).join(', ')}`).join(' · ');
  return `<div class="sy-barra ${cls}" id="confSync"><span class="sy-dot"></span><b>${txt}</b> <code>${esc(SY.handle.name)}\\${esc(SYD.local || nomePastaMes(S.comp))}\\${ARQ_CONF_SYNC}</code><span class="muted">${quem ? ` · ${quem}` : ''} · decisões e observações vão para a pasta no aceite do relatório (ou em «Atualizar agora»)</span><span class="sy-esp"></span><button class="${cls === 'ok' ? 'sec ' : ''}mini" data-syd="agora">${SYD.status === 'permissao' ? 'Liberar acesso' : 'Atualizar agora'}</button></div>`;
}
function atualizarBarraConf() { const b = $('confSync'); if (!b) return; b.outerHTML = barraConf(); ligarBarraConf(); }
function ligarBarraConf() { document.querySelectorAll('#confSync [data-syd]').forEach(b => b.onclick = () => sincronizarConf({ interativo: true })); }
// Ao abrir a Conferência, sincroniza só se a competência ainda não foi sincronizada nesta sessão (o relógio de 30 s traz o
// que a outra pessoa gravar).
window.addEventListener('hashchange', () => { if (location.hash === '#conferencia' && SY.handle && !SY.legado && SYD.status !== 'permissao' && SYD.comp !== S.comp) sincronizarConf(); });
// Barra no topo da Conferência (como a das NCs).
{ const desenhar = RENDER.conferencia; RENDER.conferencia = (...a) => { desenhar(...a); const p = $('pag-conferencia'); if (p && !$('confSync')) { p.insertAdjacentHTML('afterbegin', barraConf()); ligarBarraConf(); } }; }
