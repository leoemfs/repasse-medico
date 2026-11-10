// v3.0.0-alpha.2 — Excel da conferência pela tela: sempre baixa (com e sem pasta conectada sem acesso liberado),
// e nome que difere só por partícula («DE») forma par com o laudo. Dados fictícios.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), erros = [];
const p = await (await b.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste Excel')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
await p.evaluate(() => {
  const { S } = window.__RM, d = new Date(Date.UTC(2026, 9, 19)), dia = Math.round(d / 864e5);
  S.apolo = { nome: 'apolo.xlsx', hash: 'h', laudos: [{ i: 0, linhaPlanilha: 2, idLaudo: '1', unidade: 'AlphaSonic Palhano', paciente: 'DAMARIS VIEIRA MATTOS', pn: 'DAMARIS VIEIRA MATTOS', idPac: '9', titulo: 'CARÓTIDAS E VERTEBRAIS', tn: 'CAROTIDAS E VERTEBRAIS', descricao: 'DOPPLER', data: d, dia, convenio: 'HOSPITALAR - ALPHASONIC LONDRINA', modalidade: 'US', medico: 'Carlos Alberto Morselli Diniz', mn: 'CARLOS ALBERTO MORSELLI DINIZ' }] };
  const reg = { seq: 1, pagina: 1, codigo: '40901360', procDesc: 'DOPPLER COLORIDO DE VASOS CERVICAIS ARTERIAIS BIL', grupoNome: 'ULTRASSONOGRAFIA - OUTROS', conta: '2549579', atendimento: '2214114', paciente: 'DAMARIS VIEIRA DE MATTOS', convenio: 'HOSPITALAR - ALPHASONIC', data: d, vlRepasse: 45.84, vlTotal: 91.67, pct: .5, quant: 1, prestadorCod: '10714', prestadorNome: 'CARLOS ALBERTO MORSELLI DINIZ', repasse: 'USG' };
  S.relatorios.push({ id: 'r1', nome: 'mv_10714.pdf', tamanho: 1, hash: 'h1', unidadePasta: '17', rel: { arquivo: 'mv_10714.pdf', cab: { prestadorCod: '10714', prestadorNome: 'CARLOS ALBERTO MORSELLI DINIZ', repasse: 'USG', descricao: 'REPASSE USG', competencia: '11/2026' }, regs: [reg], avisos: [], conferencias: [], ok: true } });
  window.__RM.irPara('conferencia');
});
await p.waitForSelector('#cfRodar'); if (await p.isVisible('#cfUn')) await p.selectOption('#cfUn', '17').catch(() => {});
await p.click('#cfRodar'); await p.waitForSelector('#cfExcel', { timeout: 15000 });
const st = await p.evaluate(() => window.__RM.S.conf.res.linhas.map(l => `${l.status}/${l.origem}`).join(','));
ok(st === 'pendente/MV', `«DAMARIS VIEIRA DE MATTOS» (MV) forma par com «DAMARIS VIEIRA MATTOS» (Apolo): pendente por falta de equivalência, não «Só no faturamento» + «Só no laudo» (${st})`);
const baixar = async () => { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.click('#cfExcel')]); return dl.suggestedFilename(); };
const n1 = await baixar().catch(e => 'ERRO ' + e.message);
ok(/^conferencia_medico_10714_.*\.xlsx$/.test(n1), `sem pasta: Excel baixado (${n1})`);
// Pasta conectada, mas o Edge ainda não liberou o acesso nesta sessão: antes a exportação parava sem aviso.
await p.evaluate(() => window.__RM.t.definirPastaSync({ name: 'Repasse Medico', kind: 'directory', queryPermission: async () => 'prompt', requestPermission: async () => { throw new DOMException('precisa de gesto do usuário', 'SecurityError'); }, async *values() {} }).catch(() => {}));
const n2 = await baixar().catch(e => 'ERRO ' + e.message);
// O botão ao lado da busca (tabela de linhas) também baixa — antes tinha o mesmo id do de cima e não fazia nada.
await p.evaluate(() => { const a = document.getElementById('aviso'); a.hidden = true; });
const [dl3] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }).catch(() => null), p.click('#cfExcel2')]);
ok(!!dl3 && /\.xlsx$/.test(dl3.suggestedFilename()), `botão «Exportar Excel» ao lado da busca baixa o Excel (${dl3?.suggestedFilename() || 'nada'})`);
ok(/\.xlsx$/.test(n2) && /libere o acesso/.test(await p.textContent('#aviso')), `pasta sem acesso liberado: Excel baixado mesmo assim, com aviso (${n2})`);
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
