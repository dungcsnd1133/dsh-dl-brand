// Extract every client-plugin English dictionary into reference/en/<ns>.json.
// Literal-only parsing misses namespaces whose dictionaries interpolate
// constants (e.g. "en.goal": builtinCommon[...]), so each dictionary body is
// evaluated with its referenced constants stubbed where needed.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Locate the installed DSH client packages.
 *
 * `reference/en/` is deliberately NOT committed: it is a verbatim copy of DSH's
 * own English UI strings, which belong to the DSH distribution, and copying them
 * into a public repository would republish someone else's product text. Run this
 * script against a local DSH install to regenerate them; the dictionaries under
 * `src/dicts/vi/` are the only texts this package distributes.
 *
 * Override with DSH_MODULES when DSH lives somewhere unusual.
 */
function findDshModules() {
  if (process.env.DSH_MODULES) return process.env.DSH_MODULES

  const suffix = 'lib/node_modules/@deepseek-ai/dsh'
  const prefixes = [
    process.env.npm_config_prefix,
    '/usr/local',
    '/opt/homebrew',
    ...(process.env.NODE_PATH ?? '').split(path.delimiter).map((entry) => entry.replace(/\/node_modules\/?$/, '')),
  ].filter(Boolean)

  // A DSH installed somewhere the prefix list cannot guess (a versioned tree
  // under /data, a per-profile install) is found from the binary on PATH: its
  // real path is <install>/bin/dsh.
  const fromBinaries = () => {
    const dirs = (process.env.PATH ?? '').split(path.delimiter)
    for (const dir of dirs) {
      const bin = path.join(dir, 'dsh')
      if (!fs.existsSync(bin)) continue
      try {
        // The binary is a symlink to <install>/lib/bin.js (or <install>/bin/dsh),
        // so walk up until the directory holding package.json is found.
        let dir = path.dirname(fs.realpathSync(bin))
        for (let i = 0; i < 4 && !fs.existsSync(path.join(dir, 'package.json')); i += 1) {
          dir = path.dirname(dir)
        }
        if (fs.existsSync(path.join(dir, 'package.json'))) prefixes.push(dir)
      } catch {}
    }
  }
  fromBinaries()

  // Several DSH installs can coexist (a production one and a beta one, say), and
  // they do not carry the same set of client packages. Prefer the install with
  // the most client-UI packages, then the highest version, so running this never
  // silently extracts from an older tree.
  const found = []
  for (const prefix of prefixes) {
    const install = path.join(prefix, suffix)
    const modules = path.join(install, 'node_modules/@deepseek-ai')
    if (!fs.existsSync(path.join(modules, 'dsh-client-locale'))) continue
    const uiPackages = fs.readdirSync(modules).filter((name) => name.startsWith('dsh-client-ui-')).length
    let version = '0.0.0'
    try {
      version = JSON.parse(fs.readFileSync(path.join(install, 'package.json'), 'utf8')).version ?? version
    } catch {}
    found.push({ modules, uiPackages, version })
  }

  if (found.length === 0) {
    throw new Error(
      'could not find a DSH install; set DSH_MODULES to the directory holding ' +
      'dsh-client-ui-* and dsh-client-locale, usually ' +
      '<dsh-install>/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai',
    )
  }
  const compare = (a, b) => {
    const pa = a.version.split('.').map((n) => Number.parseInt(n, 10) || 0)
    const pb = b.version.split('.').map((n) => Number.parseInt(n, 10) || 0)
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
      if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
    }
    return 0
  }
  // Newest version wins: a package count only breaks ties, because an older
  // install can still ship more (or fewer) UI plugins without being the tree
  // whose strings this package was translated against.
  found.sort((a, b) => compare(b, a) || b.uiPackages - a.uiPackages)
  const chosen = found[0]
  console.log(`using DSH ${chosen.version} (${chosen.uiPackages} UI packages) at ${chosen.modules}`)
  return chosen.modules
}

const BASE = findDshModules()
// Always write beside this script, never beside the caller's cwd: the documented
// invocation is from the repo root, where a cwd-relative 'en/' would land in the
// wrong place and leave reference/en/ missing.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'en')
fs.mkdirSync(OUT, { recursive: true })

function braceEnd(s, start) {
  let depth = 0
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return i }
  }
  return -1
}

const inventory = {}
let total = 0
for (const d of fs.readdirSync(BASE).filter((x) => x.startsWith('dsh-client-ui-')).sort()) {
  const f = path.join(BASE, d, 'lib', 'client.js')
  if (!fs.existsSync(f)) continue
  const s = fs.readFileSync(f, 'utf8')
  const nsM = s.match(/const NS = "([a-z0-9.\-]+)"/)
  const ns = nsM ? nsM[1] : d
  const m = s.match(/\n\t\tconst en = \{/)
  if (!m) continue
  const start = s.indexOf('{', m.index)
  const end = braceEnd(s, start)
  if (end < 0) continue
  const body = s.slice(start, end + 1)
  let obj
  try {
    obj = JSON.parse(body)
  } catch {
    try {
      // Evaluate with a bare sandbox: identifier lookups resolve to a Proxy that
      // stringifies to itself, so interpolated constants do not abort the parse.
      const stub = new Proxy(function () {}, {
        get: (_t, k) => (k === Symbol.toPrimitive ? () => '' : stub),
        apply: () => stub,
      })
      const fn = new Function('__d', `with (__d) { return (${body}) }`)
      obj = fn(stub)
    } catch (e) {
      console.log('SKIP', ns, e.message.slice(0, 70))
      continue
    }
  }
  const keys = Object.keys(obj)
  if (keys.length === 0) continue
  inventory[ns] = { package: d, keys: keys.length, file: `en/${ns}.json` }
  fs.writeFileSync(path.join(OUT, `${ns}.json`), JSON.stringify(obj, null, 2) + '\n')
  total += keys.length
}
fs.writeFileSync('inventory.json', JSON.stringify(inventory, null, 2) + '\n')
console.log(`extracted ${total} strings across ${Object.keys(inventory).length} namespaces`)
