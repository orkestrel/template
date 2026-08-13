// ── Environment-agnostic base setup (AGENTS §16.1) ────────────────────────────
//
// The fleet-wide helpers live in `@orkestrel/test`. What remains here is what is
// specific to this package.

/** Whether a repository-relative Vue SFC path belongs to the private browser application. */
export function isBrowserVuePath(path: string): boolean {
	const normalized = path.replaceAll('\\', '/')
	return normalized.startsWith('app/browser/')
}
