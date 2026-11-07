/**
 * Assemble lib/client.js from the source pieces.
 *
 * Why a build step at all: a DSH client plugin is exactly ONE bundle file, and
 * its `require` only resolves modules the host supplies (`dsh.client.external`).
 * There is no relative-require support, so `lib/client.js` cannot import sibling
 * files at runtime. Several people therefore cannot share that one artifact;
 * they own separate sources here instead, and this script is the only writer of
 * `lib/client.js`.
 *
 * Sources, concatenated in this order:
 *   src/mark.js      — the DL brand mark (SVG) and wordmark components
 *   src/dicts/*.json — every Vietnamese dictionary, one file per locale namespace
 *   src/locale.js    — registration of the `vi` language and its dictionaries
 *   src/apply.js     — the plugin body wiring slots + locale
 *
 * Run: node build/build.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const dictDir = path.join(ROOT, 'src/dicts/vi')
const dictFiles = fs.existsSync(dictDir)
  ? fs.readdirSync(dictDir).filter((f) => f.endsWith('.json')).sort()
  : []

const dicts = dictFiles.map((file) => {
  const ns = file.replace(/\.json$/, '')
  const parsed = JSON.parse(fs.readFileSync(path.join(dictDir, file), 'utf8'))
  return { ns, body: JSON.stringify(parsed, null, 2) }
})

const dictLiteral = dicts.length === 0
  ? '{}'
  : '{\n' + dicts.map((d) => `    ${JSON.stringify(d.ns)}: ${d.body.replace(/\n/g, '\n    ')}`).join(',\n') + '\n  }'

const out = `window.__ModuleLoader__.load({
\tid: "dsh-dl-brand",
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

\t\tlet react = require("react");
\t\tlet jsx = require("react/jsx-runtime");

\t\t// ── brand components (src/mark.js) ──────────────────────────────────────
${indent(read('src/mark.js'), '\t\t')}
\t\t// ── Vietnamese dictionaries (src/dicts/vi/*.json) ─────────────────────
\t\tconst VI_DICTS = ${dictLiteral};

\t\t// ── icon unification (src/favicon.js) ────────────────────────────────
${indent(read('src/favicon.js'), '\t\t')}

\t\t// ── locale registration (src/locale.js) ──────────────────────────────
${indent(read('src/locale.js'), '\t\t')}
\t\t// ── plugin body (src/apply.js) ───────────────────────────────────────
${indent(read('src/apply.js'), '\t\t')}
\t\treturn module.exports;
\t}
});
`

function indent(text, prefix) {
  return text
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : prefix + line))
    .join('\n')
}

const target = path.join(ROOT, 'lib/client.js')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, out)
console.log(`built lib/client.js — ${dicts.length} dictionaries, ${out.length} bytes`)
for (const d of dicts) console.log(`  ${Object.keys(JSON.parse(d.body)).length.toString().padStart(5)}  ${d.ns}`)
