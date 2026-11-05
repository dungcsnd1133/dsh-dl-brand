/**
 * Plugin body: fill the sidebar brand slots and add the Vietnamese locale.
 *
 * `inject` below is what the host reads from package.json's `dsh.client.inject`
 * too; both must list the services used here or the row mounts before they
 * exist and the registration silently misses.
 */

/** Required client services: the slot registry and the locale catalog. */
const inject = ['slots', 'locale']

/**
 * @param {object} ctx - client root context.
 */
function apply(ctx) {
	// Brand: one declaration-aware registration set, the same shape the official
	// brand plugin uses. Both slots are `single`, and the official row is
	// disabled by this bundle's patch, so DL is their only occupant.
	ctx.slots.inject('sidebar.brand.mark', () => ctx.slots.inject('sidebar.brand.name', function* () {
		yield ctx.slots.register({ name: 'sidebar.brand.mark' }, DlBrandMark)
		yield ctx.slots.register({ name: 'sidebar.brand.name' }, DlBrandName)
	}))

	// Locale: a language pack plus its dictionaries. Failure here must not take
	// the brand down with it, so it is isolated and only logged.
	ctx.effect(() => {
		try {
			return registerVietnamese(ctx)
		} catch (error) {
			console.error('dsh-dl-brand: Vietnamese locale registration failed', error)
			return () => {}
		}
	}, 'dl-brand: vietnamese locale')
}

exports.apply = apply
exports.inject = inject
exports.DlBrandMark = DlBrandMark
exports.DlBrandName = DlBrandName
