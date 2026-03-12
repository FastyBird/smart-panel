/**
 * Simulation context provides environmental data for realistic device simulation.
 * It includes time-based information, location data, and environmental conditions.
 */
export interface SimulationContext {
	/**
	 * Current timestamp for simulation
	 */
	timestamp: Date;

	/**
	 * Hour of day (0-23) for time-based simulations
	 */
	hour: number;

	/**
	 * Day of year (1-366) for seasonal simulations
	 */
	dayOfYear: number;

	/**
	 * Season based on northern hemisphere
	 */
	season: 'winter' | 'spring' | 'summer' | 'autumn';

	/**
	 * Whether it's considered nighttime (for lighting, etc.)
	 */
	isNight: boolean;

	/**
	 * Base outdoor temperature (Celsius) based on season and time
	 */
	outdoorTemperature: number;

	/**
	 * Base outdoor humidity (%) based on season
	 */
	outdoorHumidity: number;

	/**
	 * Latitude for location-based calculations (default: 50.0 - Central Europe)
	 */
	latitude: number;
}

/**
 * Configuration options for creating simulation context
 */
export interface SimulationContextConfig {
	/**
	 * Latitude for location-based calculations
	 * Default: 50.0 (Central Europe)
	 */
	latitude?: number;

	/**
	 * Custom timestamp (for testing)
	 */
	timestamp?: Date;
}

/**
 * Creates a simulation context with current environmental conditions
 */
export function createSimulationContext(config: SimulationContextConfig = {}): SimulationContext {
	const timestamp = config.timestamp ?? new Date();
	const latitude = config.latitude ?? 50.0;
	const hour = timestamp.getHours();
	const dayOfYear = getDayOfYear(timestamp);
	const season = getSeason(dayOfYear, latitude);
	const isNight = getIsNight(hour, dayOfYear, latitude);
	const outdoorTemperature = getOutdoorTemperature(hour, dayOfYear, latitude);
	const outdoorHumidity = getOutdoorHumidity(season, hour);

	return {
		timestamp,
		hour,
		dayOfYear,
		season,
		isNight,
		outdoorTemperature,
		outdoorHumidity,
		latitude,
	};
}

/**
 * Get day of year (1-366)
 */
function getDayOfYear(date: Date): number {
	const start = new Date(date.getFullYear(), 0, 0);
	const diff = date.getTime() - start.getTime();
	const oneDay = 1000 * 60 * 60 * 24;
	return Math.floor(diff / oneDay);
}

/**
 * Determine season based on day of year (northern hemisphere)
 */
function getSeason(dayOfYear: number, latitude: number): 'winter' | 'spring' | 'summer' | 'autumn' {
	// Flip seasons for southern hemisphere
	const isNorthern = latitude >= 0;

	// Northern hemisphere seasons
	if (dayOfYear >= 80 && dayOfYear < 172) {
		return isNorthern ? 'spring' : 'autumn';
	} else if (dayOfYear >= 172 && dayOfYear < 266) {
		return isNorthern ? 'summer' : 'winter';
	} else if (dayOfYear >= 266 && dayOfYear < 355) {
		return isNorthern ? 'autumn' : 'spring';
	}
	return isNorthern ? 'winter' : 'summer';
}

/**
 * Determine if it's night based on time and approximate sunrise/sunset
 */
function getIsNight(hour: number, dayOfYear: number, latitude: number): boolean {
	// Simple approximation of sunrise/sunset times
	// Summer days are longer, winter days are shorter
	const summerSunrise = 5;
	const summerSunset = 21;
	const winterSunrise = 8;
	const winterSunset = 17;

	// Calculate seasonal variation (peak at summer solstice ~day 172 for northern hemisphere)
	// For northern hemisphere: day 172 (June 21) = longest day, day 355 (Dec 21) = shortest day
	// For southern hemisphere: day 172 (June 21) = shortest day, day 355 (Dec 21) = longest day
	let seasonalFactor = Math.cos(((dayOfYear - 172) * Math.PI) / 182.5);

	// Invert for southern hemisphere (their summer is our winter)
	if (latitude < 0) {
		seasonalFactor = -seasonalFactor;
	}

	// Adjust for latitude (higher latitudes have more extreme day length variation)
	const latitudeFactor = Math.abs(latitude) / 90;

	const sunrise = winterSunrise - (winterSunrise - summerSunrise) * ((seasonalFactor + 1) / 2) * latitudeFactor;
	const sunset = winterSunset + (summerSunset - winterSunset) * ((seasonalFactor + 1) / 2) * latitudeFactor;

	return hour < sunrise || hour >= sunset;
}

/**
 * Calculate outdoor temperature based on time of day and season
 */
function getOutdoorTemperature(hour: number, dayOfYear: number, latitude: number): number {
	// Base temperatures by season (Celsius)
	const seasonTemps = {
		winter: { min: -5, max: 5 },
		spring: { min: 5, max: 18 },
		summer: { min: 15, max: 30 },
		autumn: { min: 8, max: 18 },
	};

	const season = getSeason(dayOfYear, latitude);
	const { min, max } = seasonTemps[season];

	// Temperature varies through the day (coldest at 5am, warmest at 3pm)
	const hourOffset = hour - 5;
	const dayProgress = hourOffset < 0 ? hourOffset + 24 : hourOffset;
	const tempCycle = Math.sin((dayProgress / 24) * Math.PI * 2 - Math.PI / 2);

	// Map -1..1 to min..max with most variation in afternoon
	const baseTemp = min + ((max - min) * (tempCycle + 1)) / 2;

	// Add some random variation (±2°C)
	const variation = (Math.random() - 0.5) * 4;

	return Math.round((baseTemp + variation) * 10) / 10;
}

/**
 * Calculate outdoor humidity based on season and time
 */
function getOutdoorHumidity(season: 'winter' | 'spring' | 'summer' | 'autumn', hour: number): number {
	// Base humidity by season
	const seasonHumidity = {
		winter: { min: 70, max: 90 },
		spring: { min: 50, max: 75 },
		summer: { min: 40, max: 65 },
		autumn: { min: 60, max: 85 },
	};

	const { min, max } = seasonHumidity[season];

	// Humidity is typically higher in early morning and evening
	const isMorningEvening = hour < 8 || hour > 18;
	const baseHumidity = isMorningEvening ? (min + max) / 2 + 10 : (min + max) / 2 - 5;

	// Add random variation
	const variation = (Math.random() - 0.5) * 10;

	return Math.round(Math.max(min, Math.min(max, baseHumidity + variation)));
}
