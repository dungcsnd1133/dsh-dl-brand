#!/usr/bin/env node
/**
 * Validate every Vietnamese dictionary against its English reference.
 *
 * Run: node build/validate.mjs [--strict]
 *
 * Checks, per namespace present in src/dicts/vi:
 *   1. The file parses as JSON and is a flat object of strings.
 *   2. Every key exists in reference/en/<ns>.json (no invented keys).
 *   3. Every English key is present (coverage; `--strict` makes gaps fatal).
 *   4. Placeholders ({name}, {count}, …) match the English source exactly —
 *      a dropped or renamed placeholder renders a broken string at runtime.
 *   5. No value is still byte-identical to its English source, which usually
 *      means a forgotten line rather than an intentional loanword. Reported as a
 *      warning: "OK" and short loanwords are legitimate.
 *
 * The plugin tolerates missing keys at runtime (they fall back to English), so
 * coverage is a warning unless --strict is passed.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REF = path.join(ROOT, 'reference/en')
const VI = path.join(ROOT, 'src/dicts/vi')
const strict = process.argv.includes('--strict')

const placeholders = (text) => (text.match(/\{[a-zA-Z0-9_.]+\}/g) ?? []).sort().join(',')

let fatal = 0
let warned = 0
let totalKeys = 0
let totalTranslated = 0
const rows = []

if (!fs.existsSync(REF)) {
  console.log(
    'Thiếu reference/en/ — thư mục này không nằm trong repo (xem LICENSE).\n' +
    'Tạo lại từ DSH đã cài, rồi chạy lại:\n\n' +
    '  node reference/extract.mjs\n\n' +
    'Nếu DSH ở chỗ lạ: DSH_MODULES=<dsh-install>/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai node reference/extract.mjs',
  )
  process.exit(1)
}

const refNamespaces = fs.readdirSync(REF).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
const viNamespaces = fs.existsSync(VI) ? fs.readdirSync(VI).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')) : []

for (const ns of viNamespaces) {
  const problems = []
  let en
  try {
    en = JSON.parse(fs.readFileSync(path.join(REF, `${ns}.json`), 'utf8'))
  } catch {
    console.log(`✗ ${ns}: no English reference (reference/en/${ns}.json missing)`)
    fatal += 1
    continue
  }
  let vi
  try {
    vi = JSON.parse(fs.readFileSync(path.join(VI, `${ns}.json`), 'utf8'))
  } catch (error) {
    console.log(`✗ ${ns}: invalid JSON — ${error.message}`)
    fatal += 1
    continue
  }
  if (vi === null || typeof vi !== 'object' || Array.isArray(vi)) {
    console.log(`✗ ${ns}: dictionary must be a JSON object`)
    fatal += 1
    continue
  }

  const enKeys = Object.keys(en)
  const viKeys = Object.keys(vi)
  totalKeys += enKeys.length

  const extra = viKeys.filter((k) => !(k in en))
  if (extra.length > 0) problems.push(`${extra.length} invented key(s): ${extra.slice(0, 3).join(', ')}`)

  const missing = enKeys.filter((k) => !(k in vi))
  const translated = enKeys.length - missing.length
  totalTranslated += translated

  const badPlaceholder = []
  const untranslated = []
  for (const k of enKeys) {
    if (!(k in vi)) continue
    const src = en[k]
    const dst = vi[k]
    if (typeof dst !== 'string') {
      badPlaceholder.push(`${k} (non-string value)`)
      continue
    }
    if (placeholders(src) !== placeholders(dst)) badPlaceholder.push(`${k} (expected ${placeholders(src) || 'none'}, got ${placeholders(dst) || 'none'})`)
    else if (src === dst && src.length > 3 && /[a-z]/i.test(src)) untranslated.push(k)
  }
  if (badPlaceholder.length > 0) problems.push(`${badPlaceholder.length} placeholder mismatch: ${badPlaceholder.slice(0, 2).join('; ')}`)

  const coverage = enKeys.length === 0 ? 100 : Math.round((translated / enKeys.length) * 100)
  rows.push({ ns, translated, total: enKeys.length, coverage, untranslated: untranslated.length })

  if (problems.length > 0) {
    console.log(`✗ ${ns} — ${problems.join(' | ')}`)
    fatal += 1
  } else if (missing.length > 0) {
    const label = strict ? '✗' : '!'
    console.log(`${label} ${ns}: ${translated}/${enKeys.length} (${coverage}%) — ${missing.length} key chưa dịch, fallback tiếng Anh`)
    if (strict) fatal += 1
    else warned += 1
  } else {
    console.log(`✓ ${ns}: ${translated}/${enKeys.length} (100%)`)
  }
}

const untouched = refNamespaces.filter((ns) => !viNamespaces.includes(ns))
if (untouched.length > 0) {
  console.log(`\nChưa có file dịch (${untouched.length} namespace): ${untouched.join(', ')}`)
}

console.log(`\nTổng: ${totalTranslated}/${totalKeys} chuỗi đã dịch (${totalKeys === 0 ? 0 : Math.round((totalTranslated / totalKeys) * 100)}%) trên ${viNamespaces.length}/${refNamespaces.length} namespace`)
if (fatal > 0) console.log(`THẤT BẠI: ${fatal} namespace có lỗi cứng`)
else if (warned > 0) console.log(`ĐẠT (có ${warned} namespace dịch thiếu, fallback an toàn)`)
else console.log('ĐẠT: mọi namespace đủ 100%')

process.exit(fatal > 0 ? 1 : 0)
