/**
 * Unifies every logo surface the web UI shows.
 *
 * The sidebar mark was already the DL mark; the favicon and the apple-touch
 * icon were not — the host ships its own `favicon.svg`, `favicon-dark.svg` and
 * `apple-touch-icon.png`, and a plugin cannot replace files, only behaviour.
 * So the tab kept the default DSH logo while the sidebar showed ours: two
 * logos for one product, side by side on every tab.
 *
 * This rewrites the icon `<link>`s at runtime to data URLs built from the same
 * QWEN_PATHS and the same gradient as the sidebar mark, so the three surfaces
 * cannot drift apart again — they share one source of geometry.
 *
 * Constraints carried over from the mark:
 *   - No network requests, no external asset files: the bundle is one file
 *     read from disk, so everything is inlined as data URLs.
 *   - apple-touch-icon must be PNG (iOS ignores SVG), so it is rendered
 *     through a canvas from the same SVG. If a canvas is unavailable the old
 *     icon is left in place rather than shipping a broken href.
 */

/** One SVG string, used for the favicon and as the canvas source. */
function brandSvg() {
	const stops = QWEN_PATHS.map((d, index) => `<path d="${d}" fill="url(#dl-favicon-grad)" />`).join('')
	return (
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">' +
		'<defs><linearGradient id="dl-favicon-grad" x1="0" y1="0" x2="1" y2="1">' +
		`<stop offset="0%" stop-color="${DL_VIOLET}"/>` +
		`<stop offset="45%" stop-color="${DL_INDIGO}"/>` +
		`<stop offset="100%" stop-color="${DL_CYAN}"/>` +
		'</linearGradient></defs>' + stops + '</svg>'
	)
}

/** The SVG as a data URL, safe for href assignment. */
function svgDataUrl() {
	return 'data:image/svg+xml,' + encodeURIComponent(brandSvg())
}

/**
 * Render the SVG to a PNG data URL through a canvas.
 * @param {number} size - square edge in pixels.
 * @returns {Promise<string | null>} the PNG data URL, or null if unavailable.
 */
function pngDataUrl(size) {
	return new Promise((resolve) => {
		try {
			const image = new Image()
			image.onload = () => {
				try {
					const canvas = document.createElement('canvas')
					canvas.width = size
					canvas.height = size
					const context = canvas.getContext('2d')
					if (context === null) return resolve(null)
					context.drawImage(image, 0, 0, size, size)
					resolve(canvas.toDataURL('image/png'))
				} catch {
					resolve(null)
				}
			}
			image.onerror = () => resolve(null)
			image.src = svgDataUrl()
		} catch {
			resolve(null)
		}
	})
}

/**
 * Swap every icon link to the brand mark.
 *
 * The host declares two SVG favicons split by `prefers-color-scheme` plus a PNG
 * apple-touch-icon. The DL mark reads fine on both schemes (the gradient is
 * mid-luminance on transparent), so one link without a media query replaces
 * both; keeping two would mean maintaining two renders of one logo.
 *
 * @returns {() => void} restore function, for dispose.
 */
function applyBrandIcons() {
	const head = document.head
	if (head === null) return () => {}

	// Remember each link's original href so dispose puts the UI back exactly.
	const touched = []
	for (const link of Array.from(head.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]'))) {
		touched.push({ link, rel: link.getAttribute('rel'), href: link.getAttribute('href') })
	}

	const unified = document.createElement('link')
	unified.setAttribute('rel', 'icon')
	unified.setAttribute('type', 'image/svg+xml')
	unified.setAttribute('href', svgDataUrl())

	for (const { link } of touched) link.remove()
	head.appendChild(unified)

	// iOS home-screen icons must be PNG; SVG is silently ignored there, which
	// would leave the default DSH logo on the one surface users pin.
	void pngDataUrl(180).then((png) => {
		if (png === null) return
		const touch = document.createElement('link')
		touch.setAttribute('rel', 'apple-touch-icon')
		touch.setAttribute('href', png)
		head.appendChild(touch)
	})

	return () => {
		unified.remove()
		for (const { link } of head.querySelectorAll('link[rel="apple-touch-icon"]')) link.remove()
		for (const { link, rel, href } of touched) {
			if (rel !== null) link.setAttribute('rel', rel)
			if (href !== null) link.setAttribute('href', href)
			head.appendChild(link)
		}
	}
}

/**
 * Wire icon unification into the plugin lifecycle.
 * @param {object} ctx - client root context.
 */
function registerBrandIcons(ctx) {
	if (typeof ctx.effect !== 'function' || typeof document === 'undefined') return
	try {
		const restore = applyBrandIcons()
		ctx.effect(() => {
			restore()
			return () => {}
		}, 'dl-brand: unified icons')
	} catch (error) {
		console.error('dsh-dl-brand: icon unification failed', error)
	}
}
