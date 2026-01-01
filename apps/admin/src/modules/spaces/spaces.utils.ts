/**
 * Canonicalize a space name for comparison
 * - trim whitespace
 * - convert to lowercase
 * - collapse multiple spaces
 * - normalize separators (_, - → space)
 * - remove diacritics
 *
 * @param name - The space name to canonicalize
 * @returns The canonicalized name
 */
export function canonicalizeSpaceName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[-_]/g, ' ')
		.replace(/\s+/g, ' ')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');
}

/**
 * Check if two space names are equivalent when canonicalized
 *
 * @param name1 - First space name
 * @param name2 - Second space name
 * @returns True if the names are equivalent
 */
export function areSpaceNamesEquivalent(name1: string, name2: string): boolean {
	return canonicalizeSpaceName(name1) === canonicalizeSpaceName(name2);
}
