export type NumberFormatSetting = 'comma_dot' | 'dot_comma' | 'space_comma' | 'none';

const localeForFormat = (format: NumberFormatSetting): string => {
	switch (format) {
		case 'comma_dot':
			return 'en-US';
		case 'dot_comma':
			return 'de-DE';
		case 'space_comma':
			return 'fr-FR';
		case 'none':
			return 'en-US';
	}
};

export const formatNumber = (value: number, options: Intl.NumberFormatOptions = {}, numberFormat?: NumberFormatSetting): string => {
	const locale = numberFormat ? localeForFormat(numberFormat) : (navigator.language || 'en-US');

	const formatOptions: Intl.NumberFormatOptions = {
		style: 'decimal',
		...options,
	};

	if (numberFormat === 'none') {
		formatOptions.useGrouping = false;
	}

	return new Intl.NumberFormat(locale, formatOptions).format(value);
};
