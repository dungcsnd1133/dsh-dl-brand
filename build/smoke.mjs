#!/usr/bin/env node
/**
 * End-to-end check of the built client bundle, without a browser.
 *
 * Run: node build/smoke.mjs
 *
 * Loads lib/client.js the way the DSH module loader does — a `require` stub
 * returning the host-provided modules — then asserts the plugin registers what
 * it promises:
 *   - `inject` names the services the body actually calls
 *   - `apply` fills both sidebar brand slots exactly once
 *   - every Vietnamese namespace reaches `locale.register` as `vi`
 *   - the `vi` language is added once, with `en` as its fallback
 *   - the mark renders for the sizes the sidebar asks for
 *
 * This is the gate before the plugin is enabled on the live instance: a bundle
 * that throws here would take the sidebar down for every user.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE = path.join(ROOT, 'lib/client.js')

let failures = 0
const check = (label, fn) => {
  try {
    fn()
    console.log(`✓ ${label}`)
  } catch (error) {
    console.log(`✗ ${label} — ${error.message}`)
    failures += 1
  }
}

if (!fs.existsSync(BUNDLE)) {
  console.log('✗ lib/client.js chưa được build — chạy: node build/build.mjs')
  process.exit(1)
}

// ── icon stub ────────────────────────────────────────────────────────────────
// The bundle receives `document` as a load-time parameter, so the icons feature
// can only be exercised through this object — reassigning globalThis.document
// later has no effect. Records what applyBrandIcons left in <head>.
const headLinks = []
const makeHeadLink = (rel, href) => {
	const attrs = { rel, href }
	const node = {
		getAttribute: (name) => attrs[name] ?? null,
		setAttribute: (name, value) => { attrs[name] = value },
		remove: () => { const at = headLinks.indexOf(node); if (at !== -1) headLinks.splice(at, 1) },
	}
	return node
}
headLinks.push(makeHeadLink('icon', './favicon.svg'), makeHeadLink('apple-touch-icon', './apple-touch-icon.png'))
const stubHead = {
	querySelectorAll: () => headLinks.slice(),
	appendChild: (node) => { headLinks.push(node) },
}

// ── host stubs ────────────────────────────────────────────────────────────────
const jsx = (type, props, key) => ({ type, props: { ...props, key } })
let idSeq = 0
const modules = {
  // useId mirrors React 18: a stable string per component instance. The mark
  // relies on it for gradient ids, so the stub must supply it.
  react: { useMemo: (f) => f(), createElement: jsx, useId: () => `:r${(idSeq += 1)}:` },
  'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
}

let registration
globalThis.window = {
  __ModuleLoader__: {
    load: (reg) => {
      registration = reg
    },
  },
}
globalThis.document = {
	documentElement: { lang: 'en' },
	head: stubHead,
	createElement: () => makeHeadLink(null, null),
}
// pngDataUrl builds an <img> to rasterise the apple-touch-icon. There is no DOM
// in Node, so it is stubbed to fail: the PNG path then resolves to null and
// leaves the existing icon, which is the documented fallback. The assertion is
// about the SVG favicon, which needs no canvas.
globalThis.Image = class {
	set src(_value) { if (typeof this.onerror === 'function') this.onerror() }
}

// ── load the bundle ──────────────────────────────────────────────────────────
const source = fs.readFileSync(BUNDLE, 'utf8')
try {
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', source)(globalThis.window, globalThis.document)
} catch (error) {
  console.log(`✗ bundle threw while loading — ${error.message}`)
  process.exit(1)
}

check('bundle registers itself through __ModuleLoader__', () => {
  if (!registration) throw new Error('no registration captured')
  if (registration.id !== 'dsh-dl-brand') throw new Error(`unexpected id ${registration.id}`)
})

const exports = registration.factory((spec) => {
  if (!(spec in modules)) throw new Error(`bundle required an unexpected module: ${spec}`)
  return modules[spec]
})

check('factory exports apply and inject', () => {
  if (typeof exports.apply !== 'function') throw new Error('apply is missing')
  if (!Array.isArray(exports.inject)) throw new Error('inject is missing')
})

// ── exercise apply against a recording context ───────────────────────────────
const registered = []
const languages = []
const dicts = []
const effects = []

/**
 * `slots.inject(name, setup)` runs `setup` when the named slot is declared. The
 * brand registration uses a generator that yields one disposer per occupant, so
 * the stub has to drain the iterator — calling the function and ignoring its
 * return value would leave both slots empty.
 */
const slotsCtx = {
  inject: (name, setup) => {
    const result = setup()
    const disposers = []
    if (result && typeof result.next === 'function') {
      for (let step = result.next(); step.done !== true; step = result.next()) {
        if (typeof step.value === 'function') disposers.push(step.value)
      }
    } else if (typeof result === 'function') {
      disposers.push(result)
    }
    return () => {
      for (const dispose of disposers.reverse()) dispose()
    }
  },
  register: (options, component) => {
    registered.push({ name: options.name, component })
    return () => {}
  },
}

const localeCtx = {
  register: (ns, locale, dict) => {
    dicts.push({ ns, locale, size: Object.keys(dict).length })
    return () => {}
  },
  addLanguage: (input) => {
    languages.push(input)
    return () => {}
  },
}

const ctx = {
  slots: slotsCtx,
  locale: localeCtx,
  effect: (fn) => {
    const dispose = fn()
    effects.push(dispose)
    return () => {
      if (typeof dispose === 'function') dispose()
    }
  },
}

try {
  exports.apply(ctx)
} catch (error) {
  console.log(`✗ apply threw — ${error.message}`)
  failures += 1
}

check('inject declares exactly the services the body uses', () => {
  const expected = ['slots', 'locale']
  for (const name of expected) if (!exports.inject.includes(name)) throw new Error(`inject is missing "${name}"`)
})

check('both sidebar brand slots are filled exactly once', () => {
  const names = registered.map((r) => r.name).sort()
  const expected = ['sidebar.brand.mark', 'sidebar.brand.name']
  for (const name of expected) {
    const count = names.filter((n) => n === name).length
    if (count !== 1) throw new Error(`${name} registered ${count} time(s), expected 1`)
  }
})

check('the DL mark renders at the sizes the sidebar requests', () => {
  const mark = registered.find((r) => r.name === 'sidebar.brand.mark')
  if (!mark) throw new Error('mark not registered')
  for (const size of [16, 20, 24, 32, 40]) {
    const out = mark.component({ size })
    if (out.type !== 'svg') throw new Error(`size ${size} did not render an svg`)
    if (out.props.width !== size) throw new Error(`size ${size} rendered width ${out.props.width}`)
    if (out.props['aria-label'] !== 'DL') throw new Error('mark lost its accessible name')
  }
})

check('two mark instances never share gradient ids', () => {
  // The sidebar mounts the mark twice at once (rail + expanded row) and SVG ids
  // are document-scoped: a shared id makes one instance borrow the other's
  // gradient, or lose it when the first unmounts.
  const mark = registered.find((r) => r.name === 'sidebar.brand.mark')
  const idsOf = (node) => {
    const found = []
    const walk = (n) => {
      if (!n || typeof n !== 'object') return
      if (n.props) {
        if (typeof n.props.id === 'string') found.push(n.props.id)
        const kids = n.props.children
        if (kids) for (const kid of [].concat(kids)) walk(kid)
      }
    }
    walk(node)
    return found
  }
  const a = idsOf(mark.component({ size: 24 }))
  const b = idsOf(mark.component({ size: 24 }))
  if (a.length === 0) throw new Error('mark defines no gradient ids')
  const overlap = a.filter((id) => b.includes(id))
  if (overlap.length > 0) throw new Error(`two instances shared ids: ${overlap.join(', ')}`)
  // Every fill reference must resolve to an id the same instance defines.
  const single = mark.component({ size: 24 })
  const svg = JSON.stringify(single)
  const own = idsOf(single)
  for (const ref of svg.match(/url\(#([^)]+)\)/g) ?? []) {
    const id = ref.slice(5, -1)
    if (!own.includes(id)) throw new Error(`fill references undefined gradient ${id}`)
  }
})

check('the wordmark slot is occupied but renders no text', () => {
  // The slot must stay registered: leaving it empty makes the sidebar fall back
  // to its own "Local build" label beside the mark. The occupant renders an
  // empty, aria-hidden span instead.
  const name = registered.find((r) => r.name === 'sidebar.brand.name')
  if (!name) throw new Error('wordmark not registered')
  const out = name.component({})
  if (out.type !== 'span') throw new Error(`wordmark rendered ${String(out.type)}, expected span`)
  if (out.props.children !== undefined) throw new Error(`wordmark still renders text: ${JSON.stringify(out.props.children)}`)
  if (out.props['aria-hidden'] !== 'true') throw new Error('empty wordmark must be hidden from assistive tech')
})

check('the mark inlines the official Qwen glyph paths', () => {
  const mark = registered.find((r) => r.name === 'sidebar.brand.mark')
  const svg = mark.component({ size: 24 })
  if (svg.props.viewBox !== '0 0 20 20') throw new Error(`viewBox was ${svg.props.viewBox}, expected the icon's 0 0 20 20`)
  const collect = (n, out = []) => {
    if (!n || typeof n !== 'object') return out
    if (n.type === 'path') out.push(n.props.d)
    if (n.props?.children) for (const kid of [].concat(n.props.children)) collect(kid, out)
    return out
  }
  const paths = collect(svg)
  if (paths.length !== 3) throw new Error(`expected the 3 Qwen blocks, found ${paths.length} path(s)`)
  for (const d of paths) {
    if (typeof d !== 'string' || d.length < 200) throw new Error('a glyph path looks truncated')
  }
})

check('the vi language is added once with en as fallback', () => {
  if (languages.length !== 1) throw new Error(`${languages.length} languages added, expected 1`)
  const lang = languages[0]
  if (lang.id !== 'vi') throw new Error(`language id ${lang.id}`)
  if (lang.fallback !== 'en') throw new Error(`fallback ${lang.fallback}, expected en`)
  if (!lang.label || lang.label.trim() === '') throw new Error('label is empty')
})

check('every Vietnamese dictionary is registered under vi', () => {
  if (dicts.length === 0) throw new Error('no dictionaries registered')
  for (const d of dicts) {
    if (d.locale !== 'vi') throw new Error(`${d.ns} registered for ${d.locale}, expected vi`)
    if (d.size === 0) throw new Error(`${d.ns} registered an empty dictionary`)
  }
})

check('registration disposers are functions', () => {
  for (const dispose of effects) {
    if (typeof dispose !== 'function') throw new Error('effect did not return a disposer')
    dispose()
  }
})

// Icon unification: the export must exist, and the SVG it builds must reuse
// the mark's own geometry — a favicon with different paths is exactly the
// two-logos drift this feature exists to remove.
check('registerBrandIcons is exported and callable', () => {
  if (typeof exports.registerBrandIcons !== 'function') throw new Error('registerBrandIcons not exported')
})

// The disposer contract. ctx.effect calls the callback ONCE and adopts its
// return value as teardown. The first version of this feature called the
// restore function inside the callback instead of returning it, so mount
// swapped the icons and immediately put them back: the tab kept the default
// logo and nothing anywhere failed.
check('icon swap survives mount (returns a disposer, does not run it)', () => {
	const disposers = []
	const ctx = {
		effect: (callback) => {
			const teardown = callback()
			disposers.push(teardown)
			return teardown
		},
	}
	exports.registerBrandIcons(ctx)
	const brandIcons = headLinks.filter((link) =>
		String(link.getAttribute('href') ?? '').startsWith('data:image/svg+xml'))
	if (brandIcons.length === 0) {
		throw new Error('no brand icon after mount — the swap was reverted immediately')
	}
	if (disposers.length === 0) throw new Error('effect registered no disposer')
	if (disposers[0] === undefined) throw new Error('effect callback returned nothing to dispose with')
})

// ── summary ──────────────────────────────────────────────────────────────────
const totalKeys = dicts.reduce((sum, d) => sum + d.size, 0)
console.log(`\nNamespaces đăng ký: ${dicts.length} · chuỗi tiếng Việt: ${totalKeys}`)
if (failures > 0) {
  console.log(`THẤT BẠI: ${failures} kiểm tra`)
  process.exit(1)
}
console.log('ĐẠT: bundle sẵn sàng để bật trên instance')
