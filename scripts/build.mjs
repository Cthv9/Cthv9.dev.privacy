// Genera il sito statico in _site/: un sottosito per ogni cartella di apps/.
//
//   apps/<slug>/app.json      titolo, descrizione e lingua dell'app
//   apps/<slug>/privacy.md    informativa -> _site/<slug>/index.html
//   apps/<slug>/<altro>.md    altre pagine -> _site/<slug>/<altro>.html
//
// I segnaposto {{NOME}} nei testi si sostituiscono con la variabile del
// repository PRIVACY_NOME (Settings > Secrets and variables > Actions >
// Variables). Così il repository, pubblico, non contiene i dati del titolare.
// Se manca una variabile la build FALLISCE: meglio nessuna pagina che una
// informativa con i segnaposto in vista.
//
// Uso locale:  PRIVACY_TITOLARE="..." PRIVACY_CONTATTO="..." npm run build
//              npm run preview   (segnaposto lasciati in vista, solo per vedere la grafica)
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPS = path.join(ROOT, 'apps');
const OUT = path.join(ROOT, '_site');
const preview = process.argv.includes('--preview');

const PLACEHOLDER = /\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/g;

function loadVars() {
  const vars = {};
  // Su Actions: tutte le variabili del repository, passate come JSON.
  if (process.env.VARS_JSON) Object.assign(vars, JSON.parse(process.env.VARS_JSON));
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('PRIVACY_')) vars[k] = v;
  }
  return vars;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const stripTags = (s) => s.replace(/<[^>]*>/g, '');

function slugify(text, used) {
  const base = stripTags(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&[a-z#0-9]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sezione';
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
  used.add(slug);
  return slug;
}

// Titoli con id (per i link interni) e tabelle scorrevoli su schermi stretti.
function decorate(html) {
  const used = new Set();
  return html
    .replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_, n, inner) => `<h${n} id="${slugify(inner, used)}">${inner}</h${n}>`)
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>');
}

const missing = new Map(); // NOME -> pagine che lo usano

function fillPlaceholders(html, vars, where) {
  return html.replace(PLACEHOLDER, (all, name) => {
    const value = vars[`PRIVACY_${name}`];
    if (value !== undefined && String(value).trim() !== '') return escapeHtml(String(value).trim());
    if (preview) return `<mark>[${name}]</mark>`;
    if (!missing.has(name)) missing.set(name, new Set());
    missing.get(name).add(where);
    return all;
  });
}

function renderPage(template, { lang, title, description, home, content }) {
  const map = {
    LANG: escapeHtml(lang),
    TITLE: escapeHtml(title),
    DESCRIPTION: escapeHtml(description || ''),
    HOME: home,
    CONTENT: content,
  };
  // Sulla pagina iniziale non serve il link "indietro".
  const out = template.replace(/%%([A-Z]+)%%/g, (all, k) => (k in map ? map[k] : all));
  return home === '' ? out.replace(/\s*<nav class="top">[\s\S]*?<\/nav>/, '') : out;
}

async function exists(p) {
  try {
    await readFile(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const vars = loadVars();
  const template = await readFile(path.join(ROOT, 'templates', 'page.html'), 'utf8');
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const slugs = (await readdir(APPS, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const apps = [];
  for (const slug of slugs) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`Nome cartella non valido in apps/: "${slug}" (solo minuscole, numeri e trattini)`);
    const dir = path.join(APPS, slug);
    const metaPath = path.join(dir, 'app.json');
    if (!(await exists(metaPath))) throw new Error(`Manca apps/${slug}/app.json`);
    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    if (!meta.title) throw new Error(`apps/${slug}/app.json: manca "title"`);
    const lang = meta.lang || 'it';

    const pages = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort();
    if (!pages.includes('privacy.md')) throw new Error(`Manca apps/${slug}/privacy.md`);
    await mkdir(path.join(OUT, slug), { recursive: true });

    for (const file of pages) {
      const where = `apps/${slug}/${file}`;
      const md = await readFile(path.join(dir, file), 'utf8');
      let html = decorate(marked.parse(md, { gfm: true }));
      html = fillPlaceholders(html, vars, where);
      const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
      const title = h1 ? stripTags(h1[1]) : meta.title;
      const outName = file === 'privacy.md' ? 'index.html' : file.replace(/\.md$/, '.html');
      const page = renderPage(template, {
        lang,
        title,
        description: meta.description,
        home: '../',
        content: html,
      });
      await writeFile(path.join(OUT, slug, outName), page);
    }
    apps.push({ slug, title: meta.title, description: meta.description || '' });
  }

  // Pagina iniziale: elenco delle informative disponibili.
  const list = apps
    .map((a) => `<li><a href="${a.slug}/">${escapeHtml(a.title)}</a>${a.description ? `<br><span class="muted">${escapeHtml(a.description)}</span>` : ''}</li>`)
    .join('\n');
  const indexHtml = `<h1>Informative privacy</h1>\n<p>Informative sul trattamento dei dati personali delle app.</p>\n<ul class="apps">\n${list}\n</ul>`;
  await writeFile(
    path.join(OUT, 'index.html'),
    renderPage(template, { lang: 'it', title: 'Informative privacy', description: 'Informative privacy delle app', home: '', content: indexHtml }),
  );

  if (missing.size > 0) {
    console.error('\nMancano variabili del repository (Settings > Secrets and variables > Actions > Variables):\n');
    for (const [name, where] of missing) {
      console.error(`  PRIVACY_${name}   usata in: ${[...where].join(', ')}`);
    }
    console.error('\nNessuna pagina da pubblicare finché non sono impostate.');
    process.exit(1);
  }
  console.log(`Sito generato in _site/: ${apps.length} app (${apps.map((a) => a.slug).join(', ')})${preview ? ' [anteprima, segnaposto in vista]' : ''}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
