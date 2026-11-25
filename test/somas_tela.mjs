// v3.0.0-alpha.55 — Equivalências: cadastro de «Laudos que somam um código». Dados fictícios.

import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = new URL('..', import.meta.url).pathname;
const html = 'file://' + raiz + 'dist/' + fs.readdirSync(raiz + 'dist').find(f => f.startsWith('Repasse_Medico_v'));
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) process.exitCode = 1; };
const b = await chromium.launch(), erros = [];
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await p.clock.install({ time: new Date('2026-11-17T10:00:00') });
await p.addInitScript(() => localStorage.setItem('rm2.operador', JSON.stringify('Teste NC')));
await p.goto(html + '#inicio'); await p.waitForFunction(() => document.getElementById('stInit').textContent.includes('Pronto'), null, { timeout: 30000 });
await p.evaluate(() => window.__RM.irPara('equivalencias')); await p.waitForTimeout(400);
await p.evaluate(() => { const b = document.querySelector('[data-esub="base"]'); b && b.click(); }); await p.waitForTimeout(300);
await p.evaluate(() => { const b = document.querySelector('[data-eqvb="reg"]'); b && b.click(); }); await p.waitForTimeout(300);
ok(await p.locator('#cardSomas').count() === 1, 'cartão «Laudos que somam um código» ao lado das regras compostas');
await p.click('#smNova'); await p.waitForTimeout(200);
await p.fill('[data-smtit="0"]', 'TC ABDOME SUPERIOR'); await p.fill('[data-smtit="1"]', 'TC ABDOME INFERIOR'); await p.fill('#smCod', '41001095 - TC ABDOME TOTAL');
await p.click('#smValidar'); await p.waitForTimeout(400);
const s1 = await p.evaluate(() => (window.__RM.S.eq.somas || []).map(s => [s.titulos.join('+'), s.codigo, s.status, s.responsavel]));
ok(s1.length === 1 && s1[0][0] === 'TC ABDOME SUPERIOR+TC ABDOME INFERIOR' && s1[0][1] === '41001095' && s1[0][2] === 'validada' && s1[0][3] === 'Teste NC', `regra validada com os dois títulos e o código (${JSON.stringify(s1)})`);
await p.click('[data-smst]'); await p.waitForTimeout(300);
ok(await p.evaluate(() => window.__RM.S.eq.somas[0].status) === 'desativada', '«Tirar validação» desliga a regra (fica no histórico)');
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();
