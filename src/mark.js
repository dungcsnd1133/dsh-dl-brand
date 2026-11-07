/**
 * DL brand components.
 *
 * The mark is the Qwen geometric mark: three rounded blocks arranged in a
 * rotational triangle, their negative space reading as a "Q". This is the real
 * Qwen glyph — paths were taken from the official qwen-logo.svg served by
 * qwen.ai (viewBox 0 0 20 20 for the icon alone), not redrawn by eye.
 *
 * Why this and not a mascot or a "DL" letterform:
 *   - The sidebar renders the mark at 24px. Two letters in a 32-unit box turn
 *     to mush there; a soft mascot loses its eyes. The Qwen blocks are chunky
 *     positive shapes separated by wide negative space, so they stay legible at
 *     24px and still look composed at 40px.
 *   - It is the actual Qwen identity rather than an evocation of it.
 *
 * The mark ships in the DL brand gradient (violet → indigo → cyan). The official
 * palette is a single blue (#082DFF); the gradient is a deliberate brand
 * override, and the geometry is what carries the recognition.
 *
 * Two React components, both pure and dependency-free beyond `jsx`:
 *   DlBrandMark({ size }) — the mark, in the expanded brand row and the rail.
 *   DlBrandName()         — intentionally blank; see the component's own note.
 *
 * Constraints from the host, do not break them:
 *   - `size` is the requested square edge in pixels; the mark must fit exactly.
 *     The rail is narrow, so nothing may overflow its box.
 *   - No network requests and no external asset files: the bundle is read from
 *     disk as one file, so anything that is not inlined will 404.
 */

/**
 * The three official Qwen glyph paths, in the icon's own 20×20 space.
 * Inlined rather than imported: the client bundle resolves only host modules.
 */
const QWEN_PATHS = [
	'M16.4317 2.35157H11.5088C11.5088 2.14167 11.453 1.93176 11.3448 1.74482L10.6855 0.60346C10.4691 0.229567 10.0689 -0.0032959 9.63601 -0.0032959H8.31755C7.88462 -0.0032959 7.48449 0.226288 7.26803 0.60346L5.25097 4.09641C5.03451 4.4703 5.03451 4.93275 5.25097 5.30664L5.9102 6.448C6.12667 6.82189 6.5268 7.05476 6.95973 7.05476H16.4284C16.8613 7.05476 17.2615 6.82517 17.4779 6.448L18.1372 5.30664C18.3536 4.93275 18.3536 4.4703 18.1372 4.09641L17.4779 2.95505C17.2615 2.58116 16.8613 2.34829 16.4284 2.34829L16.4317 2.35157Z',
	'M0.164057 8.25187L2.62388 12.5156C2.44349 12.6205 2.28934 12.7714 2.18111 12.9583L1.52188 14.0997C1.30542 14.4736 1.30542 14.936 1.52188 15.3099L2.18111 16.4513C2.39758 16.8252 2.79771 17.058 3.23064 17.058H7.26475C7.69767 17.058 8.09781 16.8284 8.31427 16.4513L8.9735 15.3099C9.18997 14.936 9.18997 14.4736 8.9735 14.0997L4.2408 5.90027C4.02434 5.52638 3.62421 5.29352 3.19128 5.29352H1.87281C1.43989 5.29352 1.03975 5.5231 0.82329 5.90027L0.164057 7.04163C-0.0524071 7.41553 -0.0524071 7.87797 0.164057 8.25187Z',
	'M13.4077 19.3932L15.8675 15.1295C16.0479 15.2345 16.2578 15.2935 16.4743 15.2935H17.7927C18.2257 15.2935 18.6258 15.0639 18.8423 14.6868L19.5015 13.5454C19.718 13.1715 19.718 12.7091 19.5015 12.3352L17.4844 8.84223C17.268 8.46834 16.8678 8.23547 16.4349 8.23547H15.1164C14.6835 8.23547 14.2834 8.46506 14.0669 8.84223L9.33422 17.0416C9.11776 17.4155 9.11776 17.878 9.33422 18.2519L9.99346 19.3932C10.2099 19.7671 10.6101 20 11.043 20H12.3614C12.7944 20 13.1945 19.7704 13.411 19.3932H13.4077Z',
]

/**
 * Brand gradient. Fixed in both themes: a mark that recolours itself is not a
 * mark, and these three stops keep enough contrast against either sidebar fill.
 */
const DL_VIOLET = '#8B5CF6'
const DL_INDIGO = '#6366F1'
const DL_CYAN = '#06B6D4'

/**
 * Qwen mark in the DL gradient.
 * @param {{ size?: number }} props - requested square edge in pixels.
 */
function DlBrandMark({ size = 24, className }) {
	const edge = typeof size === 'number' && size > 0 ? size : 24
	// The sidebar mounts this mark twice at once (collapsed rail and expanded
	// row), and gradient ids are document-scoped. A shared id would make the two
	// instances race for one definition, so each gets its own from React useId.
	const uid = react.useId().replace(/[:]/g, '')
	const gradientId = 'dl-qwen-' + uid
	return jsx.jsx('svg', {
		width: edge,
		height: edge,
		viewBox: '0 0 20 20',
		role: 'img',
		'aria-label': 'DL',
		// The hero slot passes the host's own size/positioning class, and the
		// sidebar passes none; spreading it keeps both layouts intact without
		// this component knowing either layout.
		className: className,
		style: { display: 'block', flex: 'none' },
		children: [
			jsx.jsx('defs', {
				key: 'defs',
				children: jsx.jsx('linearGradient', {
					key: 'grad',
					id: gradientId,
					x1: '0',
					y1: '0',
					x2: '1',
					y2: '1',
					children: [
						jsx.jsx('stop', { key: 's1', offset: '0%', stopColor: DL_VIOLET }, 's1'),
						jsx.jsx('stop', { key: 's2', offset: '45%', stopColor: DL_INDIGO }, 's2'),
						jsx.jsx('stop', { key: 's3', offset: '100%', stopColor: DL_CYAN }, 's3'),
					],
				}, 'grad'),
			}, 'defs'),
			jsx.jsx('g', {
				key: 'glyph',
				fill: 'url(#' + gradientId + ')',
				children: QWEN_PATHS.map((d, index) =>
					jsx.jsx('path', { key: 'p' + index, d }, 'p' + index),
				),
			}, 'glyph'),
		],
	})
}

/**
 * The wordmark slot is filled with nothing.
 *
 * The brand row renders mark and name side by side. Returning an empty span
 * keeps the wordmark out while still satisfying the slot: leaving the slot
 * unregistered is not an option, because the sidebar's own fallback for it is a
 * "Local build" label that would sit next to the mark instead.
 *
 * The element is still rendered (rather than returning null) because the row
 * measures its children; a null occupant leaves the slot in a dead state.
 */
function DlBrandName() {
	return jsx.jsx('span', { 'aria-hidden': 'true', style: { display: 'none' } })
}
