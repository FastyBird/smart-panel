/**
 * Locale-aware comparator used by the wizard step tables. Treats null/undefined as empty
 * strings, sorts numbers naturally (so `device 2` sorts before `device 10`), and ignores
 * case differences.
 */
export const compareLocale = (a: string | null | undefined, b: string | null | undefined): number => {
	const left = (a ?? '').toString();
	const right = (b ?? '').toString();
	return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
};
