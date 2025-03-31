export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
	const locale = navigator.language || 'en-US';

	return new Intl.NumberFormat(locale, {
		style: 'decimal',
		...options,
	}).format(value);
}
