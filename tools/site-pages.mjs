// Monta o site do GitHub Pages a partir de publicacao/versoes.json (versões lançadas, a primeira é a atual):
// index.html = versão atual (com manifest do PWA); versoes/ = as anteriores (2.1.0-alpha e 3.x), só para baixar
// (abertas no mesmo site, misturariam os dados guardados no navegador).
import { execSync } from 'child_process';
import fs from 'fs';
const saida = process.argv[2] || 'site', sh = c => execSync(c, { encoding: 'utf8', maxBuffer: 64 << 20 });
const LINHA = /^(2\.1\.0-alpha(\.\d+)?|3\.\d+\.\d+(-(alpha|beta|rc)(\.\d+)?)?)$/;   // 2.1.0-alpha e a linha 3.x; as anteriores não entram
const { versoes } = JSON.parse(fs.readFileSync(new URL('../publicacao/versoes.json', import.meta.url)));
const lista = versoes.filter(v => LINHA.test(v.versao));
if (!lista.length) throw new Error('nenhuma versão publicável em publicacao/versoes.json');
const pagina = v => { const h = sh(`git show ${v.commit}:dist/Repasse_Medico_v${v.versao}.html`); if (!h.includes(`'${v.versao}'`) && !h.includes(v.versao)) throw new Error(`a página do commit ${v.commit} não é a versão ${v.versao}`); return h; };
fs.rmSync(saida, { recursive: true, force: true }); fs.mkdirSync(saida + '/versoes', { recursive: true });
/* v3.0 — PWA para o Edge no computador: manifest, ícones e versao.json (aviso de versão nova dentro da ferramenta).
 * O manifest só entra na página publicada; o HTML aberto pelo arquivo (file://) continua sem dependências.
 * Sem service worker: a página nunca fica presa numa versão antiga em cache. */
const atual = lista[0], manifest = {
  name: 'Repasse Médico', short_name: 'Repasse', description: 'Conferência do repasse médico: MV × Apolo, equivalências TUSS, correção de prestador e fechamento.',
  id: './', start_url: './', scope: './', display: 'standalone', display_override: ['window-controls-overlay', 'standalone'], orientation: 'any',
  background_color: '#f3f6fa', theme_color: '#172536', lang: 'pt-BR',
  icons: [{ src: 'icones/icone-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icones/icone-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icones/icone-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
};
fs.mkdirSync(`${saida}/icones`, { recursive: true });
for (const f of fs.readdirSync(new URL('../publicacao/icones/', import.meta.url))) fs.copyFileSync(new URL(`../publicacao/icones/${f}`, import.meta.url), `${saida}/icones/${f}`);
fs.writeFileSync(`${saida}/manifest.webmanifest`, JSON.stringify(manifest, null, 1));
fs.writeFileSync(`${saida}/versao.json`, JSON.stringify({ versao: atual.versao, data: atual.data, commit: atual.commit }));
const cabecalhoPWA = '<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#172536"><link rel="apple-touch-icon" href="icones/icone-192.png">';
const comPWA = h => h.includes('rel="manifest"') ? h : h.replace('</head>', cabecalhoPWA + '</head>');
fs.writeFileSync(`${saida}/index.html`, comPWA(pagina(lista[0])));
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
