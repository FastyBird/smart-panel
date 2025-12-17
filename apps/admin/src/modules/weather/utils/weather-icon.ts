/**
 * Gets the weather icon name based on weather code and day/night time.
 *
 * @param code - Weather condition code (OpenWeatherMap codes)
 * @param sunrise - Sunrise time
 * @param sunset - Sunset time
 * @returns Icon name for Iconify (wi: prefix)
 */
export const getWeatherIcon = (
	code: number | null | undefined,
	sunrise?: Date | string | null,
	sunset?: Date | string | null
): string => {
	if (code === null || code === undefined) {
		return 'wi:na';
	}

	const isNight = isNightTime(sunrise, sunset);

	// Thunderstorms (200-299)
	if (code >= 200 && code < 300) {
		return isNight ? 'wi:night-thunderstorm' : 'wi:day-thunderstorm';
	}

	// Drizzle (300-399)
	if (code >= 300 && code < 400) {
		return isNight ? 'wi:night-showers' : 'wi:day-showers';
	}

	// Rain (500-599)
	if (code >= 500 && code <= 504) {
		return isNight ? 'wi:night-rain' : 'wi:day-rain';
	}
	if (code === 511) {
		return isNight ? 'wi:night-snow' : 'wi:day-snow';
	}
	if (code >= 520 && code < 600) {
		return isNight ? 'wi:night-showers' : 'wi:day-showers';
	}

	// Snow (600-699)
	if (code >= 600 && code < 700) {
		return isNight ? 'wi:night-snow' : 'wi:day-snow';
	}

	// Atmosphere (700-799)
	if (code >= 700 && code < 800) {
		return isNight ? 'wi:night-fog' : 'wi:day-fog';
	}

	// Clear (800)
	if (code === 800) {
		return isNight ? 'wi:night-clear' : 'wi:day-sunny';
	}

	// Clouds (801-804)
	if (code === 801) {
		return 'wi:cloud';
	}
	if (code === 802) {
		return isNight ? 'wi:night-cloudy' : 'wi:day-cloudy';
	}
	if (code === 803 || code === 804) {
		return isNight ? 'wi:night-cloudy-windy' : 'wi:day-cloudy-windy';
	}

	return 'wi:na';
};

/**
 * Determines if the current time is during nighttime.
 *
 * @param sunrise - Sunrise time
 * @param sunset - Sunset time
 * @returns True if current time is before sunrise or after sunset
 */
export const isNightTime = (sunrise?: Date | string | null, sunset?: Date | string | null): boolean => {
	if (!sunrise || !sunset) {
		return false;
	}

	const now = new Date();
	const sr = sunrise instanceof Date ? sunrise : new Date(sunrise);
	const ss = sunset instanceof Date ? sunset : new Date(sunset);

	return now <= sr || now >= ss;
};
