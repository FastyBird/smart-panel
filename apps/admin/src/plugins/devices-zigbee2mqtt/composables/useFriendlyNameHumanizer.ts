export interface IUseFriendlyNameHumanizer {
	humanize: (input: string) => string;
}

export const useFriendlyNameHumanizer = (): IUseFriendlyNameHumanizer => {
	const humanize = (input: string): string => {
		if (!input) return '';

		return (
			input
				// camelCase boundary: insert space before each uppercase letter
				.replace(/([a-z])([A-Z])/g, '$1 $2')
				// letter→digit boundary: "sensor3" → "sensor 3"
				.replace(/([a-zA-Z])(\d)/g, '$1 $2')
				// delimiters
				.replace(/[_-]+/g, ' ')
				// collapse whitespace
				.replace(/\s+/g, ' ')
				.trim()
				// Title-case each word
				.split(' ')
				.map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : ''))
				.join(' ')
		);
	};

	return { humanize };
};
