/* ============================================================
 * SOL-F18 (v3.0.0-alpha.30) — Não conformidades compartilhadas pela pasta da rede.
 * Arquivo da competência: «AAAA-MM - Mês › 02 - Não conformidades › nao_conformidades.json» (mescla em 87b-nc-sync.js).
 * Toda gravação das NCs (salvarNC) agenda a sincronização; o relógio de 30 s confere se a outra pessoa mudou o arquivo;
 * trocar a competência sincroniza a nova. Conflito (os dois mudaram a mesma NC) → a pessoa escolhe, com o histórico das duas.
 * As NCs têm nome de paciente: ficam só na pasta da rede (como a planilha de NCs) e seguem a retenção.
 * ============================================================ */
const SYN = { status: 'off', erro: '', lm: 0, comp: '', meta: null, ocupado: false, pendente: false, conflitos: 0, local: '' };
const CHAVE_SYNC_NC = 'rm2.ncSyncBase';   // {competência: partes da última versão sincronizada}
const baseNCSync = chave => (lerLocal(CHAVE_SYNC_NC) || {})[chave] || null;
function gravarBaseNCSync(chave, partes) { const m = lerLocal(CHAVE_SYNC_NC) || {}; m[chave] = partes; gravarLocal(CHAVE_SYNC_NC, m); }
// Gravação usada pela própria sincronização (não agenda outra). As da tela usam salvarNC (35-nc.js).
function gravarNCLocal(msg = '') {
  if (!gravarLocal(CHAVES.nc, S.nc)) avisar('Não foi possível gravar as não conformidades neste navegador. Exporte a planilha para não perder o trabalho.', 'err');
  else if (msg) avisar(msg, 'ok');
  atualizarNavNC();
}
async function dirNCSync(chave, criar = true) {
  const dC = await dirCompetencia(chave, criar); if (!dC) return null;
  const d = await subpasta(dC, PASTA_NC, criar); if (d) SYN.local = `${dC.name}\\${d.name}`;
  return d;
}
async function sincronizarNC({ interativo = false } = {}) {
  if (!SY.handle || SY.legado || !S.nc) return;
  if (SYN.ocupado) { SYN.pendente = true; return; }
  if (!(await temPermissaoPasta(interativo))) { SYN.status = 'permissao'; atualizarBarraNC(); return; }
  const chave = S.comp; SYN.ocupado = true; atualizarBarraNC();
  try {
    for (let t = 0; t < 3; t++) {
      let dir = await dirNCSync(chave, false), remoto = null, lm = 0;   // só cria a pasta quando houver o que gravar
      if (dir) try { const f = await (await dir.getFileHandle(ARQ_NC_SYNC)).getFile(); lm = f.lastModified; const d = JSON.parse(await f.text()); if (d.schema !== SCHEMA_NC_SYNC) throw new Error(`${ARQ_NC_SYNC} não é a base de não conformidades`); remoto = d; }
      catch (e) { if (e.name !== 'NotFoundError') throw e; }
      const local = partesNCSync(S.nc, chave), base = baseNCSync(chave);
      let { partes, conflitos } = mesclarNC(local, remoto ? { itens: remoto.itens || [], dispensados: remoto.dispensados || [] } : null, base);
      if (conflitos.length) {
        if (!interativo && location.hash !== '#nc') { SYN.status = 'conflito'; SYN.conflitos = conflitos.length; return; }
        const r = await dialogo(`${conflitos.length} NC(s) alteradas pelos dois`, `<p class="small">Você e ${esc(remoto?.atualizadoPor || 'outra pessoa')} alteraram as mesmas NCs desde a última sincronização. Escolha qual versão fica; o histórico das duas é guardado.</p>
          ${conflitos.map((x, i) => `<div class="sy-conf"><b>${esc(x.rotulo)}</b><label class="small"><input type="radio" name="c${i}" value="local" checked> A minha: ${esc(resumoValorNC(x.local))}</label><label class="small"><input type="radio" name="c${i}" value="remoto"> A da pasta: ${esc(resumoValorNC(x.remoto))}</label></div>`).join('')}`,
          [['', 'Depois', 'sec'], ['ok', 'Aplicar']]);
        if (r.botao !== 'ok') { SYN.status = 'conflito'; SYN.conflitos = conflitos.length; return; }
        partes = aplicarEscolhasNC(partes, conflitos, conflitos.map((x, i) => r.campos[`c${i}`] === 'remoto' ? 'remoto' : 'local'));
      }
      const antes = JSON.stringify(local), novas = partes.itens.filter(x => !local.itens.some(y => y.id === x.id)).length;
      if (JSON.stringify(partes) !== antes) {
        aplicarPartesNC(S.nc, chave, partes); S.ncDispensados = new Set((S.nc.dispensados || []).map(d => d.chave)); gravarNCLocal();
        if (novas && remoto) avisar(`${novas} NC(s) chegaram pela pasta (${remoto.atualizadoPor || 'outra pessoa'}).`, 'ok');
        if (location.hash === '#nc') RENDER.nc();
      }
      const remJ = remoto ? JSON.stringify({ itens: remoto.itens || [], dispensados: remoto.dispensados || [] }) : '';
      if (remJ !== JSON.stringify(partes) && (remoto || partes.itens.length || partes.dispensados.length)) {
        dir = dir || await dirNCSync(chave, true);
        const fh = await dir.getFileHandle(ARQ_NC_SYNC, { create: true });
        if (lm && (await fh.getFile()).lastModified !== lm) continue;   // a outra pessoa gravou no meio: mescla de novo
        const meta = { atualizadoEm: agoraISO(), atualizadoPor: S.operador || '' };
        const texto = JSON.stringify({ schema: SCHEMA_NC_SYNC, versaoSchema: 1, motor: MOTOR_VERSAO, competencia: chave, ...meta, ...partes });
        const w = await fh.createWritable(); await w.write(texto); await w.close();
        const gravado = await fh.getFile(); if (await gravado.text() !== texto) continue;
        SYN.lm = gravado.lastModified; SYN.meta = meta;
      } else { SYN.lm = lm; SYN.meta = remoto ? { atualizadoEm: remoto.atualizadoEm, atualizadoPor: remoto.atualizadoPor } : SYN.meta; }
      gravarBaseNCSync(chave, partes); SYN.comp = chave; SYN.status = 'ok'; SYN.erro = ''; SYN.conflitos = 0;
      return;
    }
    SYN.status = 'erro'; SYN.erro = 'o arquivo da pasta mudou durante a gravação; tente de novo';
  } catch (e) { SYN.status = 'erro'; SYN.erro = e.message || String(e); }
  finally { SYN.ocupado = false; atualizarBarraNC(); if (SYN.pendente) { SYN.pendente = false; setTimeout(() => sincronizarNC(), 50); } }
}
// Relógio: a outra pessoa mudou o arquivo da competência aberta?
async function checarNCPasta() {
  if (!SY.handle || SY.legado || SYN.ocupado || SYN.status === 'permissao') return;
  if (SYN.comp !== S.comp) return sincronizarNC();
  try { const d = await dirNCSync(S.comp, false); if (!d) return; const f = await (await d.getFileHandle(ARQ_NC_SYNC)).getFile(); if (f.lastModified !== SYN.lm) sincronizarNC(); }
  catch (e) { if (e.name === 'NotFoundError' && partesNCSync(S.nc, S.comp).itens.length) sincronizarNC(); }
}
function barraNC() {
  if (!SY.handle || SY.legado) return `<div class="sy-barra off" id="ncSync"><span class="sy-dot"></span><b>NCs só neste navegador.</b><span class="muted">Conecte a pasta raiz do aplicativo (Configurações → Pastas e sincronização) para dividir as NCs com a outra pessoa.</span></div>`;
  const ult = SYN.meta?.atualizadoEm ? ` · última mudança de <b>${esc(SYN.meta.atualizadoPor || '—')}</b> em ${new Date(SYN.meta.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '';
  const cls = SYN.status === 'ok' ? 'ok' : 'warn';
  const txt = SYN.ocupado ? 'Sincronizando…' : { ok: 'NCs sincronizadas', permissao: 'Acesso à pasta precisa ser liberado', erro: `Sem acesso à pasta — NCs guardadas neste navegador (${esc(SYN.erro)})`, conflito: `${SYN.conflitos} NC(s) alteradas pelos dois para escolher`, off: 'Conectando…' }[SYN.status] || SYN.status;
  return `<div class="sy-barra ${cls}" id="ncSync"><span class="sy-dot"></span><b>${txt}</b> <code>${esc(SY.handle.name)}\\${esc(SYN.local || `${nomePastaMes(S.comp)}\\${PASTA_NC.nome}`)}\\${ARQ_NC_SYNC}</code><span class="muted">${ult}</span><span class="sy-esp"></span><button class="${cls === 'ok' ? 'sec ' : ''}mini" data-syn="agora">${SYN.status === 'conflito' ? 'Resolver' : SYN.status === 'permissao' ? 'Liberar acesso' : 'Sincronizar agora'}</button></div>`;
}
function atualizarBarraNC() { const b = $('ncSync'); if (!b) return; b.outerHTML = barraNC(); ligarBarraNC(); }
function ligarBarraNC() { document.querySelectorAll('#ncSync [data-syn]').forEach(b => b.onclick = () => sincronizarNC({ interativo: true })); }
window.addEventListener('hashchange', () => { if (location.hash === '#nc' && SY.handle && !SY.legado && SYN.status !== 'permissao') sincronizarNC({ interativo: SYN.status === 'conflito' }); });
