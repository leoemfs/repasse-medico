/* ============================================================
 * Pasta raiz do aplicativo na rede (SOL-F36, F37 e F38)
 *   Repasse Médico (raiz)
 *   ├─ Fluxo mensal                       ← Fluxo sincronizado (1 arquivo por competência)
 *   ├─ Equivalência TUSS (sincronização)  ← equivalencias.json
 *   ├─ Bases de dados / Comp_MM-AAAA      ← planilha de laudos (Apolo) e Power BI do mês
 *   ├─ backups
 *   └─ Competências / Comp_MM-AAAA
 *       ├─ Relatórios para conferência / USG | IMG / Unidade N - Nome ; Curitiba
 *       ├─ Correção de prestador / Unidade N - Nome
 *       ├─ Conferência cruzada
 *       └─ Não conformidades
 * A ferramenta lê os PDFs e as planilhas da pasta do mês, sincroniza Fluxo e equivalências e cria as pastas
 * com os nomes certos. Os arquivos ficam na rede; nada sai para a internet.
 * ============================================================ */
const PASTAS_RAIZ = {
  fluxo: { nome: 'Fluxo mensal', re: /^FLUXO MENSAL/ },
  eq: { nome: 'Equivalência TUSS (sincronização)', re: /^EQUIVALENCIAS? TUSS/ },
  bases: { nome: 'Bases de dados', re: /^BASES? DE DADOS/ },
  backups: { nome: 'backups', re: /^BACKUPS?$/ },
  comps: { nome: 'Competências', re: /^COMPETENCIAS$/ }
};
// Pastas do mês: reconhece os nomes da exportação e os que a equipe já usa (ex.: RELATORIOS-MV-CONFERENCIA,
// PLANILHAS-CONFERENCIA, CORREÇÃO DE PRESTEDOR, NAO CONFORMIDADES). Pastas novas são criadas com o nome padrão.
const PASTA_REL = { nome: 'Relatórios para conferência', re: /^RELATORIOS? (MV )?(PARA )?CONFERENCIA/ };
const PASTA_CORR = { nome: 'Correção de prestador', re: /^CORRECAO DE PREST/ };
const PASTA_PLAN = { nome: 'Planilhas utilizadas para conferência', re: /^PLANILHAS/ };
const PASTA_CONF = { nome: 'Conferência cruzada', re: /^CONFERENCIA CRUZADA/ };
const PASTA_NC = { nome: 'Não conformidades', re: /^NAO CONFORMIDADES/ };
const grupoDaPasta = n => { const t = norm(n); return /^(USG|ULTRA)/.test(t) ? 'usg' : /^(IMG|IMAGEM)/.test(t) ? 'img' : /^(CURITIBA|V3)/.test(t) ? 'curitiba' : ''; };
const nomeCompPasta = chave => `Comp_${chave.slice(5)}-${chave.slice(0, 4)}`;
const pastaComp = chave => ({ nome: nomeCompPasta(chave), re: new RegExp(`^COMP(ETENCIA)? ${chave.slice(5)} ${chave.slice(0, 4)}$`) });
const ehSubpastaConhecida = nome => Object.values(PASTAS_RAIZ).some(p => p.re.test(norm(nome))) || /^COMP(ETENCIA)? \d{2} \d{4}$/.test(norm(nome));
const ehPastaLegadaFluxo = h => !!h && PASTAS_RAIZ.fluxo.re.test(norm(h.name));
const limparNomePasta = s => String(s).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
const nomePastaUnidade = u => limparNomePasta(`Unidade ${u.cod} - ${u.nome}`);

// Subpasta pelo nome (sem diferença de maiúsculas, acentos ou espaços); cria com o nome padrão se faltar.
async function subpasta(dir, alvo, criar = false) {
  const re = typeof alvo === 'string' ? new RegExp('^' + norm(alvo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') : alvo.re, nome = typeof alvo === 'string' ? alvo : alvo.nome;
  // v3.0: o nome configurado vale primeiro; nomes padrão/antigos só são aceitos na leitura, ou ao criar quando o
  // nome não foi personalizado (assim, trocar o nome da pasta de backups grava na pasta nova, e nada se perde ao ler).
  let parecida = null;
  for await (const h of dir.values()) if (h.kind === 'directory') { if (norm(h.name) === norm(nome)) return h; if (!parecida && re.test(norm(h.name))) parecida = h; }
  if (parecida && !(criar && alvo.personalizado)) return parecida;
  return criar ? dir.getDirectoryHandle(nome, { create: true }) : null;
}
async function caminho(partes, criar = false) {
  let d = SY.handle; if (!d || SY.legado) return null;
  for (const p of partes) { d = await subpasta(d, p, criar); if (!d) return null; }
  return d;
}
async function dirFluxo() {
  if (SY.legado) return SY.handle;
  const d = await subpasta(SY.handle, PASTAS_RAIZ.fluxo, true); SY.nomeFluxo = d.name; return d;
}
const dirEq = () => caminho([PASTAS_RAIZ.eq], true);

/* ---------- Criar as pastas da competência ---------- */
function estruturaCompetencia(chave) {
  const uns = S.cfg.unidades.filter(u => (u.apolo || []).length).sort((a, b) => +a.cod - +b.cod), comp = pastaComp(chave);
  const normais = uns.filter(u => !ehUnidadeV3(S.cfg, u.cod)), cam = [];
  for (const k of ['fluxo', 'eq', 'cfg', 'backups']) if (PASTAS_RAIZ[k]) cam.push([PASTAS_RAIZ[k]]);
  cam.push([PASTAS_RAIZ.bases, comp]);
  const base = [PASTAS_RAIZ.comps, comp];
  const G = { USG: { nome: 'USG', re: /^(USG|ULTRA)/ }, IMG: { nome: 'IMG', re: /^(IMG|IMAGEM)/ } }, un = u => ({ nome: nomePastaUnidade(u), re: new RegExp(`^(UNIDADE |UN )?${u.cod}\\b`) });
  for (const g of ['USG', 'IMG']) for (const u of normais) cam.push([...base, PASTA_REL, G[g], un(u)]);
  if (uns.some(u => ehUnidadeV3(S.cfg, u.cod))) cam.push([...base, PASTA_REL, { nome: 'Curitiba', re: /^(CURITIBA|V3)/ }]);
  for (const u of normais) cam.push([...base, PASTA_CORR, un(u)]);
  cam.push([...base, PASTA_CONF], [...base, PASTA_NC]);
  return cam;
}
const textoCaminho = c => c.map(p => typeof p === 'string' ? p : p.nome).join(' › ');
// Pasta do mês: Competências › Comp_MM-AAAA (ou Comp_MM-AAAA direto na raiz, se já existir assim).
async function dirCompetencia(chave, criar = false) {
  return (await caminho([PASTAS_RAIZ.comps, pastaComp(chave)])) || (await caminho([pastaComp(chave)])) || (criar ? caminho([PASTAS_RAIZ.comps, pastaComp(chave)], true) : null);
}
async function verificarEstrutura(chave = S.comp) {
  const cam = estruturaCompetencia(chave), faltam = [];
  const naRaiz = !(await caminho([PASTAS_RAIZ.comps, pastaComp(chave)])) && !!(await caminho([pastaComp(chave)]));
  for (const c of cam) { const cc = naRaiz && c[0] === PASTAS_RAIZ.comps ? c.slice(1) : c; if (!(await caminho(cc, false))) faltam.push(textoCaminho(cc)); }
  return { total: cam.length, faltam };
}
async function criarEstrutura(chave = S.comp) {
  if (!SY.handle || SY.legado) return avisar('Conecte primeiro a pasta raiz do aplicativo.', 'warn');
  if (!(await temPermissaoPasta(true))) return avisar('O acesso à pasta não foi liberado.', 'warn');
  const { faltam } = await verificarEstrutura(chave);
  if (!faltam.length) { avisar(`As pastas da competência ${rotuloCompetencia(chave)} já existem.`, 'ok'); return RENDER.inicio(); }
  if (!await confirmar(`Criar ${faltam.length} pasta(s)?`, `Dentro de «${esc(SY.handle.name)}», com os nomes que a ferramenta lê:<ul class="small">${faltam.slice(0, 14).map(f => `<li>${esc(f)}</li>`).join('')}${faltam.length > 14 ? `<li>… e mais ${faltam.length - 14}</li>` : ''}</ul>Pastas que já existem não mudam.`, 'Criar pastas')) return;
  const naRaiz = !(await caminho([PASTAS_RAIZ.comps, pastaComp(chave)])) && !!(await caminho([pastaComp(chave)]));
  try { for (const c of estruturaCompetencia(chave)) await caminho(naRaiz && c[0] === PASTAS_RAIZ.comps ? c.slice(1) : c, true); avisar(`Pastas da competência ${rotuloCompetencia(chave)} criadas.`, 'ok'); }
  catch (e) { avisar(`Não foi possível criar as pastas (${e.message}).`, 'err'); }
  PRI.verifComp = ''; RENDER.inicio();
}

/* ---------- Ler PDFs e planilhas da pasta do mês (SOL-F38) ---------- */
const PR = { lidos: new Map(), ultima: null, lendo: false };   // caminho → «tamanho|data» do que já foi lido nesta sessão
async function* arquivosEm(dir, rel = '') {
  for await (const h of dir.values()) {
    if (h.name.startsWith('_') || h.name.startsWith('~$')) continue;   // _antigos e arquivos temporários do Office
    if (h.kind === 'directory') yield* arquivosEm(h, `${rel}${h.name}/`); else yield { h, caminho: rel + h.name };
  }
}
const unidadeDoNomePasta = n => (norm(n).match(/^(?:UNIDADE |UN )?(\d+)\b/) || [])[1] || '';
async function atualizarDaPasta({ silencioso = false } = {}) {
  if (!SY.handle || SY.legado) { if (!silencioso) avisar('Conecte a pasta raiz do aplicativo no Início.', 'warn'); return null; }
  if (PR.lendo) return null;
  if (!(await temPermissaoPasta(!silencioso))) { if (!silencioso) avisar('O acesso à pasta não foi liberado.', 'warn'); return null; }
  PR.lendo = true; const r = { pdfs: 0, novos: 0, mudaram: 0, planilhas: 0, avisos: [] };
  try {
    const comp = nomeCompPasta(S.comp), dC = await dirCompetencia(S.comp);
    // Planilhas do mês: Bases de dados › Comp_MM-AAAA ou PLANILHAS-… dentro da pasta do mês (vale a mais recente de cada tipo).
    const dirsPl = [await caminho([PASTAS_RAIZ.bases, pastaComp(S.comp)]), dC ? await subpasta(dC, PASTA_PLAN) : null].filter(Boolean);
    if (dirsPl.length) {
      const pl = { apolo: null, pbi: null };
      for (const dB of dirsPl) for await (const { h, caminho: c } of arquivosEm(dB)) {
        if (!/\.xlsx$/i.test(h.name)) continue;
        const f = await h.getFile(), tipo = /POWER ?BI|PBI|FATURAMENTO/.test(norm(h.name)) ? 'pbi' : 'apolo';
        if (!pl[tipo] || f.lastModified > pl[tipo].f.lastModified) pl[tipo] = { f, c: dB.name + '/' + c };
      }
      for (const [tipo, x] of Object.entries(pl)) {
        if (!x) continue; const sig = `${x.f.size}|${x.f.lastModified}`, k = `${S.comp}|${x.c}`;
        const carregada = tipo === 'apolo' ? S.apolo?.nome === x.f.name : S.pbi?.nome === x.f.name;
        if (PR.lidos.get(k) === sig && carregada) continue;
        await (tipo === 'apolo' ? carregarApolo(x.f) : carregarPBI(x.f)); PR.lidos.set(k, sig); r.planilhas++;
      }
    } else r.avisos.push(`sem planilhas em Bases de dados › ${comp}`);
    // Relatórios: pasta do mês › Relatórios para conferência (RELATORIOS-MV-CONFERENCIA) | Correção de prestador.
    if (!dC) r.avisos.push(`sem a pasta Competências › ${comp}`);
    else for (const [pasta, finalidade] of [[PASTA_REL, 'conferencia'], [PASTA_CORR, 'correcao']]) {
      const d = await subpasta(dC, pasta); if (!d) continue;
      for await (const { h, caminho: c } of arquivosEm(d)) {
        if (!/\.pdf$/i.test(h.name)) continue;
        const partes = c.split('/'); r.pdfs++;
        const grupo = finalidade === 'correcao' ? '' : grupoDaPasta(partes[0]);
        const un = grupo === 'curitiba' ? String(S.cfg.unidades.find(u => ehUnidadeV3(S.cfg, u.cod))?.cod || '5') : unidadeDoNomePasta(partes.length > 1 ? partes[partes.length - 2] : '');
        const f = await h.getFile(), sig = `${f.size}|${f.lastModified}`, k = `${S.comp}|${pasta.nome}/${c}`;
        const atual = S.relatorios.find(x => x.caminhoPasta === k);
        if (atual && PR.lidos.get(k) === sig) continue;
        if (atual) S.relatorios = S.relatorios.filter(x => x !== atual);
        const n0 = S.relatorios.length; await carregarPDFs([f]);
        if (S.relatorios.length > n0) {
          const it = S.relatorios.at(-1); it.caminhoPasta = k; it.unidadePasta = un; it.grupoPasta = grupo; if (finalidade === 'correcao') it.finalidade = 'correcao';
          // Mesmo prestador × unidade lido de outro arquivo: fica o mais recente.
          const dup = S.relatorios.filter(x => x !== it && x.unidadePasta === un && x.grupoPasta === grupo && String(x.rel.cab.prestadorCod) === String(it.rel.cab.prestadorCod) && x.caminhoPasta);
          if (dup.length) { S.relatorios = S.relatorios.filter(x => !dup.includes(x)); r.avisos.push(`${it.rel.cab.prestadorCod} na unidade ${un}: mais de um PDF; ficou ${h.name}`); }
          atual ? r.mudaram++ : r.novos++;
        }
        PR.lidos.set(k, sig);
      }
    }
    PR.ultima = { em: Date.now(), ...r };
  } catch (e) { r.avisos.push(e.message); if (!silencioso) avisar(`Erro ao ler a pasta (${e.message}).`, 'err'); }
  finally { PR.lendo = false; }
  if (!silencioso || r.novos || r.mudaram || r.planilhas) avisar(`Pasta da competência ${rotuloCompetencia(S.comp)}: ${r.novos} PDF(s) novo(s), ${r.mudaram} atualizado(s)${r.planilhas ? `, ${r.planilhas} planilha(s)` : ''}${r.pdfs ? ` (${r.pdfs} na pasta)` : ''}${r.avisos.length ? ' · ' + r.avisos.join(' · ') : ''}.`, r.avisos.length ? 'warn' : 'ok');
  if (r.mudaram) avisar(`${r.mudaram} relatório(s) mudaram desde a última leitura: rode a conferência deles de novo.`, 'warn');
  if (location.hash === '#inicio' || !location.hash) RENDER.inicio();
  return r;
}

/* ---------- Equivalências sincronizadas (SOL-F37) ---------- */
const SYQ = { status: 'off', erro: '', lm: 0, meta: null, ocupado: false, pendente: false, conferidoEm: 0, conflitos: 0 };
const CHAVE_SYNC_EQ = CHAVES.eqSyncBase, ARQ_EQ = 'equivalencias.json';
async function sincronizarEq({ interativo = false } = {}) {
  if (!SY.handle || SY.legado) return;
  if (SYQ.ocupado) { SYQ.pendente = true; return; }
  if (!(await temPermissaoPasta(interativo))) { SYQ.status = 'permissao'; atualizarBarraEq(); return; }
  SYQ.ocupado = true;
  try {
    for (let t = 0; t < 3; t++) {
      const dir = await dirEq(); let remoto = null, lm = 0;
      try { const f = await (await dir.getFileHandle(ARQ_EQ)).getFile(); lm = f.lastModified; const d = JSON.parse(await f.text()); if (d.schema !== SCHEMA_EQ_SYNC) throw new Error(`${ARQ_EQ} não é a base de equivalências`); remoto = d; }
      catch (e) { if (e.name !== 'NotFoundError') throw e; }
      const base = lerLocal(CHAVE_SYNC_EQ), antes = S.eq;
      // Primeira vez com as duas bases: mostra o resultado antes de juntar (e guarda cópia da sua).
      let { eq, conflitos } = mesclarEq(S.eq, remoto?.eq || null, base);
      if (!base && remoto && JSON.stringify(eq.itens) !== JSON.stringify(S.eq.itens)) {
        if (!interativo) { SYQ.status = 'juntar'; return; }
        const c = b => `${b.itens.filter(e => e.status === 'validada').length} validadas · ${b.itens.filter(e => e.status === 'pendente').length} pendentes · ${(b.compostas || []).length} regras compostas`;
        const r = await dialogo('Juntar a sua base de equivalências com a da pasta', `<div class="grid2"><div class="linha-ini"><b>Sua base (este navegador)</b><br><span class="small muted">${c(S.eq)}</span></div><div class="linha-ini"><b>Base da pasta${remoto.atualizadoPor ? ` (${esc(remoto.atualizadoPor)})` : ''}</b><br><span class="small muted">${c(remoto.eq)}</span></div></div>
          <p><b>Resultado:</b> ${c(eq)}${conflitos.length ? ` · <b>${conflitos.length} divergência(s) para escolher</b>` : ''}</p><p class="small muted">Validada por um e pendente para o outro fica validada (com quem validou); o que só um tem entra. Antes de juntar, a sua base fica guardada para «Desfazer última substituição de equivalências» em Configurações.</p>`, [['', 'Agora não', 'sec'], ['ok', 'Juntar e conectar']]);
        if (r.botao !== 'ok') { SYQ.status = 'juntar'; return; }
        backupAntesDeSubstituir(CHAVES.eqAnterior, S.eq);
      }
      if (conflitos.length) {
        if (!interativo && location.hash !== '#equivalencias') { SYQ.status = 'conflito'; SYQ.conflitos = conflitos.length; return; }
        const r = await dialogo(`${conflitos.length} decisão(ões) diferentes nas equivalências`, `<p class="small">Você e ${esc(remoto?.atualizadoPor || 'outra pessoa')} decidiram diferente sobre os mesmos itens. Escolha qual fica; o histórico das duas é guardado.</p>
          ${conflitos.map((x, i) => `<div class="sy-conf"><b>${esc(x.rotulo)}</b><label class="small"><input type="radio" name="c${i}" value="local" checked> A minha: ${esc(resumoValorEq(x.local))}</label><label class="small"><input type="radio" name="c${i}" value="remoto"> A da pasta: ${esc(resumoValorEq(x.remoto))}</label></div>`).join('')}`, [['', 'Decidir depois', 'sec'], ['ok', 'Aplicar escolhas']]);
        if (r.botao !== 'ok') { SYQ.status = 'conflito'; SYQ.conflitos = conflitos.length; return; }
        eq = aplicarEscolhasEq(eq, conflitos, conflitos.map((x, i) => r.campos[`c${i}`] === 'remoto' ? 'remoto' : 'local'));
      }
      aplicarCobertas(eq, S.operador, S.comp);
      const mudouLocal = JSON.stringify(eq.itens) !== JSON.stringify(S.eq.itens) || JSON.stringify(eq.compostas || []) !== JSON.stringify(S.eq.compostas || []);
      if (mudouLocal) {
        const novas = novasValidadasEq(antes, eq); S.eq = eq; gravarEqLocal();
        if (novas.length && remoto) avisar(`${novas.length} relação(ões) validada(s) chegaram pela pasta (${remoto.atualizadoPor || 'outra pessoa'}). Rode de novo as conferências afetadas («O que mais destrava» ou a própria Conferência).`, 'ok');
        if (location.hash === '#equivalencias') RENDER.equivalencias();
      }
      const remEq = remoto ? JSON.stringify([remoto.eq.itens, remoto.eq.compostas || []]) : '';
      if (remEq !== JSON.stringify([S.eq.itens, S.eq.compostas || []])) {
        const fh = await dir.getFileHandle(ARQ_EQ, { create: true });
        if (lm && (await fh.getFile()).lastModified !== lm) continue;
        const meta = { atualizadoEm: agoraISO(), atualizadoPor: S.operador || '' };
        const texto = JSON.stringify({ schema: SCHEMA_EQ_SYNC, versaoSchema: 1, motor: MOTOR_VERSAO, ...meta, eq: S.eq });
        const w = await fh.createWritable(); await w.write(texto); await w.close();
        const gravado = await fh.getFile(); if (await gravado.text() !== texto) continue;   // gravação simultânea: mescla de novo
        SYQ.lm = gravado.lastModified; SYQ.meta = meta;
      } else { SYQ.lm = lm; SYQ.meta = remoto ? { atualizadoEm: remoto.atualizadoEm, atualizadoPor: remoto.atualizadoPor } : SYQ.meta; }
      gravarLocal(CHAVE_SYNC_EQ, S.eq);
      SYQ.status = 'ok'; SYQ.erro = ''; SYQ.conflitos = 0; SYQ.conferidoEm = Date.now();
      return;
    }
    SYQ.status = 'erro'; SYQ.erro = 'o arquivo da pasta mudou durante a gravação; tente de novo';
  } catch (e) { SYQ.status = 'erro'; SYQ.erro = e.message || String(e); }
  finally { SYQ.ocupado = false; atualizarBarraEq(); if (SYQ.pendente) { SYQ.pendente = false; setTimeout(() => sincronizarEq(), 50); } }
}
async function checarEqPasta() {
  if (!SY.handle || SY.legado || SYQ.ocupado || SYQ.status === 'permissao') return;
  try { const f = await (await (await dirEq()).getFileHandle(ARQ_EQ)).getFile(); if (f.lastModified !== SYQ.lm) sincronizarEq(); } catch (e) { if (e.name === 'NotFoundError') sincronizarEq(); }
}
// Toda gravação da base de equivalências agenda a sincronização.
const gravarEqLocal = () => { if (!gravarLocal(CHAVES.eq, S.eq)) avisar('Não foi possível gravar a base de equivalências neste navegador.', 'err'); };
const _salvarEq = salvarEq;
let syncEqAgendada = 0;
salvarEq = function (msg = '') { _salvarEq(msg); if (SY.handle && !SY.legado && SYQ.status !== 'permissao') { clearTimeout(syncEqAgendada); syncEqAgendada = setTimeout(() => sincronizarEq(), 800); } };
function barraEq() {
  if (!SY.handle || SY.legado) return `<div class="sy-barra off" id="eqSync"><span class="sy-dot"></span><b>Equivalências só neste navegador.</b><span class="muted">Conecte a pasta raiz do aplicativo no Início para dividir as validações com a outra pessoa.</span></div>`;
  const ult = SYQ.meta?.atualizadoEm ? ` · última mudança de <b>${esc(SYQ.meta.atualizadoPor || '—')}</b> em ${new Date(SYQ.meta.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '';
  const cls = SYQ.status === 'ok' ? 'ok' : 'warn', txt = { ok: SYQ.ocupado ? 'Sincronizando…' : 'Sincronizado', permissao: 'Acesso à pasta precisa ser liberado', erro: `Sem acesso à pasta — mudanças guardadas neste navegador (${esc(SYQ.erro)})`, conflito: `${SYQ.conflitos} decisão(ões) diferentes para escolher`, juntar: 'Falta juntar a sua base com a da pasta', off: 'Conectando…' }[SYQ.status] || SYQ.status;
  return `<div class="sy-barra ${cls}" id="eqSync"><span class="sy-dot"></span><b>${txt}</b> <code>${esc(SY.handle.name)}\\${esc(PASTAS_RAIZ.eq.nome)}\\${ARQ_EQ}</code><span class="muted">${ult}</span><span class="sy-esp"></span><button class="${cls === 'ok' ? 'sec ' : ''}mini" data-syq="agora">${SYQ.status === 'juntar' ? 'Juntar agora…' : SYQ.status === 'conflito' ? 'Resolver' : SYQ.status === 'permissao' ? 'Liberar acesso' : 'Atualizar agora'}</button></div>`;
}
function atualizarBarraEq() { const b = $('eqSync'); if (!b) return; b.outerHTML = barraEq(); ligarBarraEq(); }
function ligarBarraEq() { document.querySelectorAll('#eqSync [data-syq]').forEach(b => b.onclick = () => sincronizarEq({ interativo: true })); }
window.addEventListener('hashchange', () => { if (location.hash === '#equivalencias' && SY.handle && !SY.legado && SYQ.status !== 'permissao') sincronizarEq({ interativo: true }); });

/* ---------- Início: pasta raiz ---------- */
const PRI = { verif: null, verifComp: '' };
function cartaoPastaRaiz() {
  if (!suportaPasta()) return '';
  if (!SY.handle) return `<div class="card pr-card off"><div class="fx-topo"><h2 style="margin:0">Pasta raiz do aplicativo</h2><button id="prConectar">Conectar a pasta raiz…</button></div>
    <p class="small"><b>Lembrete:</b> conecte a pasta raiz na rede (a que contém Fluxo mensal, Equivalência TUSS, Bases de dados…). Com ela, a ferramenta lê os PDFs do MV e as planilhas do mês com um clique, sincroniza o Fluxo e as equivalências com a outra pessoa e cria as pastas com os nomes certos.</p></div>`;
  if (SY.legado) return `<div class="card pr-card warn"><div class="fx-topo"><h2 style="margin:0">Pasta raiz do aplicativo</h2><button id="prConectar">Conectar a pasta raiz…</button></div>
    <p class="small">Hoje está conectada só a pasta do Fluxo («${esc(SY.handle.name)}»). Conecte a pasta raiz (a de cima) para ler os relatórios e sincronizar as equivalências também.</p></div>`;
  const perm = SY.status === 'permissao', v = PRI.verifComp === S.comp ? PRI.verif : null, u = PR.ultima;
  return `<div class="card pr-card ${perm || (v && v.faltam.length) ? 'warn' : 'ok'}"><div class="fx-topo"><h2 style="margin:0">Pasta raiz: ${esc(SY.handle.name)}</h2>
    <div class="acoes" style="margin:0">${perm ? '<button id="prLiberar">Liberar acesso</button>' : `<button id="prAtualizar"${PR.lendo ? ' disabled' : ''}>${PR.lendo ? 'Lendo a pasta…' : 'Atualizar da pasta'}</button><button class="sec" id="prCriar">Criar pastas da competência ${rotuloCompetencia(S.comp)}</button>`}<button class="sec" id="prConectar">Trocar pasta raiz…</button></div></div>
    ${perm ? '<p class="small"><b>O Edge pede para liberar o acesso à pasta</b> a cada sessão (ou marque «permitir sempre»). Clique em «Liberar acesso».</p>' : `
    <p class="small muted">Lê de <code>Competências › ${nomeCompPasta(S.comp)} › ${PASTA_REL.nome}</code> (USG, IMG, Curitiba, por unidade), <code>${PASTA_CORR.nome}</code> e <code>Bases de dados › ${nomeCompPasta(S.comp)}</code> (laudos e Power BI). Só lê o que é novo ou mudou; pastas que começam com «_» (ex.: _antigos) ficam de fora.</p>
    <div class="pr-st"><span>${v ? (v.faltam.length ? `<span class="badge warn">${v.faltam.length} pasta(s) faltando</span> <span class="small muted">${esc(v.faltam.slice(0, 3).join(' · '))}${v.faltam.length > 3 ? ' …' : ''}</span>` : '<span class="badge ok">pastas da competência em ordem</span>') : '<span class="small muted">conferindo as pastas…</span>'}</span>
      <span class="small muted">${u ? `última leitura ${new Date(u.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}: ${u.pdfs} PDF(s) na pasta · ${u.novos} novo(s) · ${u.mudaram} atualizado(s)` : 'ainda não lida nesta sessão'}</span>
      <span class="small muted">Fluxo: ${esc({ ok: 'sincronizado', erro: 'sem acesso', conflito: 'conflito', permissao: 'liberar acesso' }[SY.status] || SY.status)} · Equivalências: ${esc({ ok: 'sincronizadas', erro: 'sem acesso', conflito: 'conflito', juntar: 'falta juntar', permissao: 'liberar acesso', off: '—' }[SYQ.status] || SYQ.status)}</span></div>`}</div>`;
}
function ligarPastaRaiz() {
  if ($('prConectar')) $('prConectar').onclick = () => escolherPastaSync();
  if ($('prLiberar')) $('prLiberar').onclick = async () => { if (await temPermissaoPasta(true)) { SY.status = 'ok'; iniciarTimerSync(); await sincronizarFluxo({ interativo: true }); await sincronizarEq({ interativo: true }); await atualizarDaPasta(); } else avisar('O acesso à pasta não foi liberado.', 'warn'); };
  if ($('prAtualizar')) $('prAtualizar').onclick = () => atualizarDaPasta();
  if ($('prCriar')) $('prCriar').onclick = () => criarEstrutura(S.comp);
  if (SY.handle && !SY.legado && SY.status !== 'permissao' && PRI.verifComp !== S.comp) {
    PRI.verifComp = S.comp; verificarEstrutura(S.comp).then(v => { PRI.verif = v; if (location.hash === '#inicio' || !location.hash) RENDER.inicio(); }).catch(() => {});
  }
}
const _renderInicio = RENDER.inicio;
RENDER.inicio = (...a) => {
  const r = _renderInicio(...a), pg = $('pag-inicio');
  const alvo = pg?.querySelector('.painel-comp'); const html = cartaoPastaRaiz();
  if (html) { alvo ? alvo.insertAdjacentHTML('afterend', html) : pg.insertAdjacentHTML('afterbegin', html); ligarPastaRaiz(); }
  return r;
};
