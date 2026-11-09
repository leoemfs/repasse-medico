// Monta o site do GitHub Pages: index.html = versão lançada mais recente (tag v2.1.0-alpha.N);
// versoes/ = as versões 2.1.0-alpha anteriores, só para baixar (abrir no mesmo site misturaria os dados do navegador).
import { execSync } from 'child_process';
import fs from 'fs';
const saida = process.argv[2] || 'site', sh = c => execSync(c, { encoding: 'utf8', maxBuffer: 64 << 20 });
const LINHA = /^v2\.1\.0-alpha(\.\d+)?$/;   // versões que importam; as anteriores à 2.1.0-alpha não entram
const num = t => +(t.match(/alpha\.(\d+)$/)?.[1] ?? 0);
const tags = sh('git tag').split('\n').filter(t => LINHA.test(t)).sort((a, b) => num(b) - num(a));
if (!tags.length) throw new Error('nenhuma tag v2.1.0-alpha* encontrada');
const pagina = t => sh(`git show ${t}:dist/Repasse_Medico_${t}.html`);
const data = t => sh(`git log -1 --format=%cs ${t}`).trim();
fs.rmSync(saida, { recursive: true, force: true }); fs.mkdirSync(saida + '/versoes', { recursive: true });
fs.writeFileSync(`${saida}/index.html`, pagina(tags[0]));
for (const t of tags.slice(1)) fs.writeFileSync(`${saida}/versoes/Repasse_Medico_${t}.html`, pagina(t));
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
fs.writeFileSync(`${saida}/versoes/index.html`, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Versões do Repasse Médico</title>
<style>:root{--bg:#f3f6fa;--card:#fff;--text:#1d2939;--muted:#5f6f84;--line:#dde4ee;--accent:#1f5f99}@media (prefers-color-scheme:dark){:root{--bg:#0f1722;--card:#17212e;--text:#e6edf5;--muted:#9fb0c3;--line:#2a3646;--accent:#8cc0f0}}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 "Segoe UI",system-ui,Arial,sans-serif;padding:24px 16px}main{max-width:720px;margin:0 auto}a{color:var(--accent)}
li{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin:8px 0;list-style:none}ul{padding:0}small{color:var(--muted)}</style></head><body><main>
<h1>Repasse Médico — versões</h1>
<p><a href="../">Abrir a versão atual (${esc(tags[0])}, ${data(tags[0])})</a></p>
<p><small>As versões anteriores ficam só para baixar e abrir do computador, se precisar voltar a uma delas. Abertas pelo arquivo, usam dados separados dos do site.</small></p>
<ul>${tags.slice(1).map(t => `<li><a href="Repasse_Medico_${esc(t)}.html" download>${esc(t)}</a> <small>· ${data(t)}</small></li>`).join('') || '<li><small>Nenhuma versão anterior.</small></li>'}</ul>
</main></body></html>`);
console.log(`site: index.html = ${tags[0]}; ${tags.length - 1} versão(ões) anterior(es) em versoes/`);
