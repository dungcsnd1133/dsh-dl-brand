/**
 * Vietnamese locale registration.
 *
 * The host ships only `zh` and `en` as built-in locales (`LOCALE_IDS` in
 * @deepseek-ai/dsh-client-locale), so `vi` is contributed as a language pack:
 * one `addLanguage` call puts it in the language picker, and one `register`
 * call per namespace supplies its dictionary.
 *
 * Two properties of the host API shape this file:
 *   - `register(ns, locale, dict)` is keyed by (namespace, locale) and throws on
 *     a duplicate pair. A namespace's texts have one owner, so we only ever add
 *     `vi` — never `en` or `zh`, which the origin package already owns.
 *   - `addLanguage({ id, label, fallback })` requires the fallback to already be
 *     registered. `en` is built-in, so it always is.
 *
 * Partial coverage is intentional and safe. Any key absent from a `vi`
 * dictionary falls through the declared fallback chain to English, so a
 * namespace translated only halfway still renders correctly; the missing keys
 * simply stay English. That is why VN_DICTS may ship incomplete and why empty
 * namespaces are skipped rather than registered.
 */

/** The language this pack adds, as the picker shows it. */
const VI_LANGUAGE = {
	id: 'vi',
	label: 'Tiếng Việt',
	fallback: 'en',
}

/**
 * Register the `vi` language and every dictionary that has content.
 * @param {object} ctx - client context carrying the `locale` service.
 * @returns {() => void} disposes every registration made here.
 */
function registerVietnamese(ctx) {
	const dispose = []

	// Dictionaries first: `register` is independent of catalog membership, and
	// registering them before the language keeps a mid-flight failure from
	// leaving a pickable language with no texts.
	for (const ns of Object.keys(VI_DICTS)) {
		const dict = VI_DICTS[ns]
		if (dict === null || typeof dict !== 'object') continue
		if (Object.keys(dict).length === 0) continue
		dispose.push(ctx.locale.register(ns, VI_LANGUAGE.id, dict))
	}

	dispose.push(ctx.locale.addLanguage(VI_LANGUAGE))

	return () => {
		// Reverse order: drop the catalog entry before its dictionaries, so an
		// active `vi` selection falls back while its texts are still present.
		for (let i = dispose.length - 1; i >= 0; i -= 1) {
			try {
				dispose[i]()
			} catch (error) {
				console.warn('dsh-dl-brand: locale disposer failed', error)
			}
		}
	}
}
