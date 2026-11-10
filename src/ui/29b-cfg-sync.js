/* ============================================================
 * v3.0 — Configuração compartilhada pela pasta raiz (Configuração compartilhada/configuracao.json).
 * Mesmo modelo do Fluxo e das equivalências: mescla de três vias com a última versão sincronizada, conferência
 * do que ficou gravado e escolha explícita quando os dois mudaram o mesmo item. Preferências individuais
 * (operador, tema, cor, menu) não vão para a pasta.
 * ============================================================ */
PASTAS_RAIZ.cfg = { nome: 'Configuração compartilhada', re: /^CONFIGURACAO/ };
const SYC = { status: 'off', erro: '', lm: 0, meta: null, ocupado: false, pendente: false, conferidoEm: 0, conflitos: 0 };
const ARQ_CFG = 'configuracao.json';
const dirCfg = () => caminho([PASTAS_RAIZ.cfg], true);
const cfgGravadaLocal = () => lerLocal(CHAVES.cfg);
const cfgSemSalvar = () => { try { return JSON.stringify(S.cfg) !== JSON.stringify(cfgGravadaLocal()); } catch (e) { return false; } };

async function sincronizarCfg({ interativo = false } = {}) {
  if (!SY.handle || SY.legado) { SYC.status = 'off'; return; }
  if (SYC.ocupado) { SYC.pendente = true; return; }
  if (!(await temPermissaoPasta(interativo))) { SYC.status = 'permissao'; atualizarBarraCfg(); return; }
  // Edição em andamento nas Bases (S.cfg diferente do que está gravado): não mistura com a versão da pasta.
  if (cfgSemSalvar()) {
    if (!interativo) { SYC.status = 'edicao'; atualizarBarraCfg(); return; }
    if (!await confirmar('Alterações não salvas', 'A configuração tem alterações que ainda não foram salvas. Salvar agora e sincronizar com a pasta?', 'Salvar e sincronizar')) { SYC.status = 'edicao'; atualizarBarraCfg(); return; }
    salvarCfgSemSync('Configuração salva.');
  }
  SYC.ocupado = true;
  try {
    for (let t = 0; t < 3; t++) {
      const dir = await dirCfg(); let remoto = null, lm = 0;
      try { const f = await (await dir.getFileHandle(ARQ_CFG)).getFile(); lm = f.lastModified; const d = JSON.parse(await f.text()); if (d.schema !== SCHEMA_CFG_SYNC || !d.cfg) throw new Error(`${ARQ_CFG} não é a configuração compartilhada`); remoto = d; }
      catch (e) { if (e.name !== 'NotFoundError') throw e; }
      if (remoto && validarConfig(remoto.cfg).length) throw new Error(`${ARQ_CFG} inválido: ${validarConfig(remoto.cfg).slice(0, 3).join('; ')}`);
      const local = cfgGravadaLocal() || S.cfg, base = lerLocal(CHAVES.cfgSyncBase);
      let { cfg, conflitos } = mesclarCfg(local, remoto?.cfg || null, base);
      if (conflitos.length) {
        if (!interativo && !['#configuracoes', '#bases'].includes(location.hash)) { SYC.status = 'conflito'; SYC.conflitos = conflitos.length; return; }
        const quem = remoto?.atualizadoPor || 'outra pessoa';
        const r = await dialogo(`${conflitos.length} item(ns) da configuração mudados pelos dois`, `<p class="small">Você e ${esc(quem)} mudaram os mesmos itens${base ? ' desde a última sincronização' : ' (primeira sincronização ou backup restaurado)'}. Escolha qual versão fica em cada um; nada é trocado sem a sua escolha.</p>
          ${conflitos.map((x, i) => `<div class="sy-conf"><b>${esc(x.rotulo)}</b><label class="small"><input type="radio" name="c${i}" value="local" checked> A minha: ${esc(resumoValorCfg(x.local))}</label><label class="small"><input type="radio" name="c${i}" value="remoto"> A de ${esc(quem)}: ${esc(resumoValorCfg(x.remoto))}</label></div>`).join('')}`, [['', 'Decidir depois', 'sec'], ['ok', 'Aplicar escolhas']]);
        if (r.botao !== 'ok') { SYC.status = 'conflito'; SYC.conflitos = conflitos.length; return; }
        cfg = aplicarEscolhasCfg(cfg, conflitos, conflitos.map((x, i) => r.campos[`c${i}`] === 'remoto' ? 'remoto' : 'local'));
      }
      migrarConfig(cfg);
      const erros = validarConfig(cfg); if (erros.length) throw new Error(`a mescla não passou na validação (${erros.slice(0, 3).join('; ')}); nada foi gravado`);
      const sem = c => JSON.stringify({ ...c, revisao: 0, atualizadoEm: '' });
      if (sem(cfg) !== sem(local)) {
        if (!base) backupAntesDeSubstituirSemReset(CHAVES.cfgAnterior, local);
        S.cfg = cfg; gravarLocal(CHAVES.cfg, S.cfg); aplicarPastasConfig?.();
        if (remoto) avisar(`Configuração atualizada com as mudanças de ${remoto.atualizadoPor || 'outra pessoa'} (pasta compartilhada).`, 'ok');
        if (['#configuracoes', '#bases'].includes(location.hash)) RENDER[location.hash.slice(1)]();
      }
      if (!remoto || sem(remoto.cfg) !== sem(S.cfg)) {
        const fh = await dir.getFileHandle(ARQ_CFG, { create: true });
        if (lm && (await fh.getFile()).lastModified !== lm) continue;
        const meta = { atualizadoEm: agoraISO(), atualizadoPor: S.operador || '' };
        const texto = JSON.stringify({ schema: SCHEMA_CFG_SYNC, versaoSchema: 1, motor: MOTOR_VERSAO, ...meta, cfg: S.cfg });
        const w = await fh.createWritable(); await w.write(texto); await w.close();
        const gravado = await fh.getFile(); if (await gravado.text() !== texto) continue;
        SYC.lm = gravado.lastModified; SYC.meta = meta;
      } else { SYC.lm = lm; SYC.meta = { atualizadoEm: remoto.atualizadoEm, atualizadoPor: remoto.atualizadoPor }; }
      gravarLocal(CHAVES.cfgSyncBase, S.cfg);
      SYC.status = 'ok'; SYC.erro = ''; SYC.conflitos = 0; SYC.conferidoEm = Date.now();
      return;
    }
    SYC.status = 'erro'; SYC.erro = 'o arquivo da pasta mudou durante a gravação; tente de novo';
  } catch (e) { SYC.status = 'erro'; SYC.erro = e.message || String(e); }
  finally { SYC.ocupado = false; atualizarBarraCfg(); if (SYC.pendente) { SYC.pendente = false; setTimeout(() => sincronizarCfg(), 50); } }
}
// Cópia de segurança sem apagar a base de sincronização (usada pela própria sincronização).
function backupAntesDeSubstituirSemReset(chave, valor) { gravarLocal(chave, { em: agoraISO(), valor }); }
async function checarCfgPasta() {
  if (!SY.handle || SY.legado || SYC.ocupado || SYC.status === 'permissao') return;
  if (SYC.status === 'edicao' && !cfgSemSalvar()) SYC.status = 'ok';
  try { const f = await (await (await dirCfg()).getFileHandle(ARQ_CFG)).getFile(); if (f.lastModified !== SYC.lm) sincronizarCfg(); } catch (e) { if (e.name === 'NotFoundError') sincronizarCfg(); }
}
// Toda gravação da configuração agenda a sincronização.
const salvarCfgSemSync = salvarCfg;
let syncCfgAgendada = 0;
salvarCfg = function (...a) { salvarCfgSemSync(...a); if (SY.handle && !SY.legado && SYC.status !== 'permissao') { clearTimeout(syncCfgAgendada); syncCfgAgendada = setTimeout(() => sincronizarCfg(), 800); } };
const _checarEqPastaCfg = checarEqPasta;
checarEqPasta = async function () { _checarEqPastaCfg(); checarCfgPasta(); };
const _definirPastaSyncCfg = definirPastaSync;
definirPastaSync = async function (h) { await _definirPastaSyncCfg(h); if (h) await sincronizarCfg({ interativo: true }); else { SYC.status = 'off'; } };
const _restaurarPastaSyncCfg = restaurarPastaSync;
restaurarPastaSync = async function () { await _restaurarPastaSyncCfg(); if (SY.handle && SY.status === 'ok') await sincronizarCfg(); };

const TXT_SYNC = { ok: 'sincronizada', permissao: 'acesso precisa ser liberado', erro: 'sem acesso', conflito: 'mudanças dos dois para escolher', edicao: 'alterações não salvas (sincroniza ao salvar)', off: 'só neste navegador' };
function barraCfg() {
  if (!SY.handle || SY.legado) return `<div class="sy-barra off" id="cfgSync"><span class="sy-dot"></span><b>Configuração só neste navegador.</b><span class="muted">Conecte a pasta raiz (Configurações → Pastas e sincronização) para dividir unidades, prestadores, aliases e regras com a outra pessoa.</span></div>`;
  const cls = SYC.status === 'ok' ? 'ok' : 'warn', ult = SYC.meta?.atualizadoEm ? ` · última mudança de <b>${esc(SYC.meta.atualizadoPor || '—')}</b> em ${new Date(SYC.meta.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '';
  const txt = SYC.ocupado ? 'Sincronizando…' : SYC.status === 'erro' ? `Sem acesso à pasta — mudanças guardadas neste navegador (${esc(SYC.erro)})` : `Configuração ${TXT_SYNC[SYC.status] || SYC.status}`;
  return `<div class="sy-barra ${cls}" id="cfgSync"><span class="sy-dot"></span><b>${txt}</b> <code>${esc(SY.handle.name)}\\${esc(PASTAS_RAIZ.cfg.nome)}\\${ARQ_CFG}</code><span class="muted">${ult}</span><span class="sy-esp"></span><button class="${cls === 'ok' ? 'sec ' : ''}mini" data-syc="agora">${SYC.status === 'conflito' ? 'Resolver' : SYC.status === 'permissao' ? 'Liberar acesso' : 'Atualizar agora'}</button></div>`;
}
function atualizarBarraCfg() { const b = $('cfgSync'); if (!b) return; b.outerHTML = barraCfg(); ligarBarraCfg(); }
function ligarBarraCfg() { document.querySelectorAll('#cfgSync [data-syc]').forEach(b => b.onclick = () => sincronizarCfg({ interativo: true })); }
window.addEventListener('hashchange', () => { if (['#bases', '#configuracoes'].includes(location.hash) && SY.handle && !SY.legado && SYC.status !== 'permissao') sincronizarCfg({ interativo: SYC.status === 'conflito' }); });

/* ---------- Nomes das pastas, configuráveis (Configurações → Pastas e sincronização) ----------
 * Ficam em cfg.pastas e valem para os dois (vão com a configuração compartilhada). Ao ler, a ferramenta continua
 * reconhecendo também os nomes padrão e os que a equipe já usava; ao criar, usa o nome configurado. */
// As pastas de sincronização (Fluxo, Equivalências, Configuração) têm nome fixo: é por elas que os dois navegadores se
// encontram, e renomear de um lado só dividiria os dados. As demais são configuráveis.
const PASTAS_FIXAS = { fluxo: [PASTAS_RAIZ.fluxo, 'Fluxo mensal sincronizado (um arquivo por competência)'], eq: [PASTAS_RAIZ.eq, 'Base de equivalências TUSS compartilhada'], cfg: [PASTAS_RAIZ.cfg, 'Configuração compartilhada (Bases, regras, parâmetros, modelos)'] };
const PASTAS_EDITAVEIS = {
  backups: [PASTAS_RAIZ.backups, 'Backups gravados pela ferramenta'],
  bases: [PASTAS_RAIZ.bases, 'Planilhas do mês: laudos do Apolo e Power BI (dentro: Comp_MM-AAAA)'],
  comps: [PASTAS_RAIZ.comps, 'Pastas das competências (dentro: Comp_MM-AAAA)'],
  rel: [PASTA_REL, 'No mês: PDFs do MV para conferência (USG, IMG, Curitiba)'],
  corr: [PASTA_CORR, 'No mês: PDFs do prestador genérico para correção'],
  plan: [PASTA_PLAN, 'No mês: planilhas usadas na conferência (alternativa a Bases de dados)'],
  conf: [PASTA_CONF, 'No mês: Excel das conferências gravados pela ferramenta'],
  nc: [PASTA_NC, 'No mês: planilhas de não conformidades']
};
const PADRAO_PASTAS = Object.fromEntries(Object.entries(PASTAS_EDITAVEIS).map(([k, [p]]) => [k, { nome: p.nome, re: p.re }]));
function aplicarPastasConfig() {
  const c = S.cfg?.pastas || {};
  for (const [k, [p]] of Object.entries(PASTAS_EDITAVEIS)) {
    const nome = limparNomePasta(c[k] || '') || PADRAO_PASTAS[k].nome, padrao = PADRAO_PASTAS[k];
    const reNome = new RegExp('^' + norm(nome).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
    p.nome = nome; p.personalizado = !!limparNomePasta(c[k] || ''); p.re = { test: s => reNome.test(s) || padrao.re.test(s) };
  }
}

/* ---------- Onde gravar o que a ferramenta gera (v3.0) ----------
 * Com a pasta raiz conectada e a opção ligada (Configurações → Pastas e sincronização), os Excel da conferência,
 * da correção e das NCs vão direto para a pasta da competência (Comp_MM-AAAA › Conferência cruzada | Não
 * conformidades), sem passar por Downloads. Sem pasta, sem permissão ou com erro, o arquivo é baixado como antes. */
const exportarNaPasta = () => !!SY.handle && !SY.legado && S.cfg?.parametros?.exportarNaPasta !== false;
async function entregarArquivo(zipOuBlob, nome, destino = 'conf', chave = S.comp) {
  // O arquivo é SEMPRE baixado. Com a pasta conectada e o acesso já liberado, também é gravado na pasta da competência.
  // (Pedir permissão aqui falhava: depois de gerar o Excel o Edge já não considera o clique, e a exportação parava sem aviso.)
  let blob;
  try { blob = zipOuBlob instanceof Blob ? zipOuBlob : await zipOuBlob.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' }); }
  catch (e) { avisar(`Não foi possível gerar o Excel (${e.message}).`, 'err'); return 'erro'; }
  baixarBlob(blob, nome);
  if (!exportarNaPasta()) return 'download';
  try {
    if (!(await temPermissaoPasta(false))) { avisar(`Excel baixado. Para gravar também na pasta da competência, libere o acesso à pasta (Configurações → Pastas e sincronização).`, 'warn'); return 'download'; }
    const dC = await dirCompetencia(chave, true), alvo = { conf: PASTA_CONF, nc: PASTA_NC }[destino] || PASTA_CONF;
    const d = await subpasta(dC, alvo, true), fh = await d.getFileHandle(nome, { create: true });
    const w = await fh.createWritable(); await w.write(blob); await w.close();
    if ((await fh.getFile()).size !== blob.size) throw new Error('o arquivo gravado ficou com tamanho diferente');
    avisar(`Excel baixado e gravado na pasta: ${nomeCompPasta(chave)} › ${alvo.nome} › ${nome}`, 'ok');
    return 'pasta';
  } catch (e) { avisar(`Excel baixado, mas não foi gravado na pasta (${e.message}).`, 'warn'); return 'download'; }
}
