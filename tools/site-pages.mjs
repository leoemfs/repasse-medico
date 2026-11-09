// Monta o site do GitHub Pages a partir de publicacao/versoes.json (versões lançadas, a primeira é a atual):
// index.html = versão atual; versoes/ = as anteriores da linha 2.1.0-alpha, só para baixar
// (abertas no mesmo site, misturariam os dados guardados no navegador).
import { execSync } from 'child_process';
import fs from 'fs';
const saida = process.argv[2] || 'site', sh = c => execSync(c, { encoding: 'utf8', maxBuffer: 64 << 20 });
const LINHA = /^2\.1\.0-alpha(\.\d+)?$/;   // versões que importam; as anteriores à 2.1.0-alpha não entram
const { versoes } = JSON.parse(fs.readFileSync(new URL('../publicacao/versoes.json', import.meta.url)));
const lista = versoes.filter(v => LINHA.test(v.versao));
if (!lista.length) throw new Error('nenhuma versão 2.1.0-alpha em publicacao/versoes.json');
const pagina = v => { const h = sh(`git show ${v.commit}:dist/Repasse_Medico_v${v.versao}.html`); if (!h.includes(`'${v.versao}'`) && !h.includes(v.versao)) throw new Error(`a página do commit ${v.commit} não é a versão ${v.versao}`); return h; };
fs.rmSync(saida, { recursive: true, force: true }); fs.mkdirSync(saida + '/versoes', { recursive: true });
fs.writeFileSync(`${saida}/index.html`, pagina(lista[0]));
for (const v of lista.slice(1)) fs.writeFileSync(`${saida}/versoes/Repasse_Medico_v${v.versao}.html`, pagina(v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dataBR = d => d.split('-').reverse().join('/');
fs.writeFileSync(`${saida}/versoes/index.html`, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Versões do Repasse Médico</title>
<style>:root{--bg:#f3f6fa;--card:#fff;--text:#1d2939;--muted:#5f6f84;--line:#dde4ee;--accent:#1f5f99}@media (prefers-color-scheme:dark){:root{--bg:#0f1722;--card:#17212e;--text:#e6edf5;--muted:#9fb0c3;--line:#2a3646;--accent:#8cc0f0}}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 "Segoe UI",system-ui,Arial,sans-serif;padding:24px 16px}main{max-width:720px;margin:0 auto}a{color:var(--accent)}
li{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin:8px 0;list-style:none}ul{padding:0}small{color:var(--muted)}</style></head><body><main>
<h1>Repasse Médico — versões</h1>
<p><a href="../">Abrir a versão atual (v${esc(lista[0].versao)}, ${dataBR(lista[0].data)})</a></p>
<p><small>As versões anteriores ficam só para baixar e abrir do computador, se precisar voltar a uma delas. Abertas pelo arquivo, usam dados separados dos do site.</small></p>
<ul>${lista.slice(1).map(v => `<li><a href="Repasse_Medico_v${esc(v.versao)}.html" download>v${esc(v.versao)}</a> <small>· ${dataBR(v.data)}</small></li>`).join('') || '<li><small>Nenhuma versão anterior.</small></li>'}</ul>
</main></body></html>`);
console.log(`site: index.html = v${lista[0].versao}; ${lista.length - 1} versão(ões) anterior(es) em versoes/`);
