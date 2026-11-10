/* ============================================================
 * v3.0 — Atualização controlada (site publicado e app instalado pelo Edge).
 * O site publica versao.json com a versão atual. A ferramenta confere ao abrir, a cada 30 minutos e ao voltar para
 * a janela; havendo versão nova, mostra um aviso fixo «Nova versão publicada — Atualizar agora», que não some sozinho.
 * Antes de recarregar, espera as sincronizações com a pasta terminarem (nada se perde na troca de versão).
 * Não há service worker: nenhuma versão antiga fica presa em cache, e a pasta conectada (guardada no IndexedDB
 * do endereço) continua a mesma depois da atualização — o Edge só pode pedir para liberar o acesso de novo.
 * ============================================================ */
const ATU = { remota: null, data: '', verificadoEm: 0, erro: '', timer: null };
const ehSitePublicado = () => location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
function textoAtualizacao() {
  if (!ehSitePublicado()) return 'aberta pelo arquivo: atualize baixando a versão nova do site.';
  if (ATU.erro) return `não foi possível verificar (${ATU.erro})`;
  if (!ATU.remota) return 'verificando…';
  return versaoMaior(ATU.remota, MOTOR_VERSAO) ? `versão ${ATU.remota} publicada — recarregue para usar` : `em dia (conferido às ${new Date(ATU.verificadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`;
}
async function verificarAtualizacao(manual = false) {
  if (!ehSitePublicado()) return;
  try {
    const r = await fetch(new URL('versao.json', location.href), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json(); ATU.remota = String(j.versao || ''); ATU.data = j.data || ''; ATU.verificadoEm = Date.now(); ATU.erro = '';
    if (ATU.remota && versaoMaior(ATU.remota, MOTOR_VERSAO)) mostrarAvisoAtualizacao();
    else if (manual) avisar(`Você está na versão mais nova (${MOTOR_VERSAO}).`, 'ok');
  } catch (e) { ATU.erro = e.message || String(e); if (manual) avisar(`Não foi possível verificar a atualização (${ATU.erro}).`, 'warn'); }
}
function mostrarAvisoAtualizacao() {
  let el = $('avisoVersao');
  if (!el) { el = document.createElement('div'); el.id = 'avisoVersao'; el.className = 'aviso-versao'; el.setAttribute('role', 'alert'); document.querySelector('.main')?.prepend(el); }
  el.innerHTML = `<b>Nova versão ${esc(ATU.remota)} publicada${ATU.data ? ` em ${esc(ATU.data.split('-').reverse().join('/'))}` : ''}.</b> <span>Você está usando a ${esc(MOTOR_VERSAO)}. Atualize para não trabalhar com regras antigas.</span> <button id="btAtualizar">Atualizar agora</button>`;
  $('btAtualizar').onclick = async () => {
    const b = $('btAtualizar'); b.disabled = true; b.textContent = 'Terminando a sincronização…';
    // Espera gravações pendentes na pasta (até 15 s) antes de recarregar.
    for (let i = 0; i < 30 && ((typeof SY !== 'undefined' && SY.ocupado) || (typeof SYQ !== 'undefined' && SYQ.ocupado) || (typeof SYC !== 'undefined' && SYC.ocupado)); i++) await new Promise(r => setTimeout(r, 500));
    location.reload();
  };
}
function iniciarVerificacaoAtualizacao() {
  if (!ehSitePublicado()) return;
  verificarAtualizacao();
  clearInterval(ATU.timer); ATU.timer = setInterval(() => verificarAtualizacao(), 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - ATU.verificadoEm > 5 * 60 * 1000) verificarAtualizacao(); });
}
