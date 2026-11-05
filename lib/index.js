/**
 * Node half of dsh-dl-brand.
 *
 * The feature is entirely in the browser: brand slots and locale dictionaries
 * are client-plugin concerns, and the host contributes nothing. This module
 * exists only because a Cordis row needs something to import, and an empty
 * apply is the smallest thing that mounts cleanly.
 */
export const name = 'dsh-dl-brand'
export const inject = []
export function apply() {}
