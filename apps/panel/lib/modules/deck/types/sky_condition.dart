import 'package:flutter/material.dart';

/// Weather condition mapped from OpenWeatherMap codes.
enum SkyCondition {
	clear,
	partlyCloudy,
	cloudy,
	overcast,
	rainy,
	heavyRain,
	stormy,
	snowy,
	windy,
	foggy,
}

/// Four time-of-day periods for sky rendering.
enum SkyTimeOfDay { morning, noon, evening, night }

/// Resolves time-of-day from current time, sunrise, and sunset using proportional day-length splits.
SkyTimeOfDay resolveSkyTimeOfDay(DateTime now, DateTime sunrise, DateTime sunset) {
	if (now.isBefore(sunrise)) return SkyTimeOfDay.night;

	final dayLength = sunset.difference(sunrise);
	final morningEnd = sunrise.add(dayLength * 0.3);
	final eveningStart = sunset.subtract(dayLength * 0.2);
	final twilightEnd = sunset.add(const Duration(minutes: 60));

	if (now.isBefore(morningEnd)) return SkyTimeOfDay.morning;
	if (now.isBefore(eveningStart)) return SkyTimeOfDay.noon;
	if (now.isBefore(twilightEnd)) return SkyTimeOfDay.evening;

	return SkyTimeOfDay.night;
}

/// Maps OpenWeatherMap weather code to [SkyCondition].
SkyCondition mapWeatherCodeToSkyCondition(int code) {
	if (code >= 200 && code <= 232) return SkyCondition.stormy;
	if (code >= 300 && code <= 321) return SkyCondition.rainy;
	if (code >= 500 && code <= 501) return SkyCondition.rainy;
	if (code >= 502 && code <= 531) return SkyCondition.heavyRain;
	if (code >= 600 && code <= 622) return SkyCondition.snowy;
	if (code >= 700 && code <= 762) return SkyCondition.foggy;
	if (code == 771) return SkyCondition.windy;
	if (code == 781) return SkyCondition.stormy;
	if (code == 800) return SkyCondition.clear;
	if (code == 801 || code == 802) return SkyCondition.partlyCloudy;
	if (code == 803) return SkyCondition.cloudy;
	if (code == 804) return SkyCondition.overcast;

	return SkyCondition.clear;
}

/// Visual configuration for the sky panel based on condition + time of day.
class SkyVisualConfig {
	final SkyCondition condition;
	final SkyTimeOfDay timeOfDay;
	final List<Color> gradientColors;
	final bool showSun;
	final bool showMoon;
	final bool showStars;
	final int cloudCount;
	final double cloudOpacity;
	final double sunOpacity;
	final double sunPosition;
	final double starOpacity;
	final bool showRain;
	final int rainIntensity;
	final bool showSnow;
	final int snowIntensity;
	final bool showWind;
	final bool showLightning;
	final bool showFog;
	final Color primaryTextColor;
	final Color secondaryTextColor;

	const SkyVisualConfig({
		required this.condition,
		required this.timeOfDay,
		required this.gradientColors,
		this.showSun = false,
		this.showMoon = false,
		this.showStars = false,
		this.cloudCount = 0,
		this.cloudOpacity = 0.3,
		this.sunOpacity = 1.0,
		this.sunPosition = 0.5,
		this.starOpacity = 1.0,
		this.showRain = false,
		this.rainIntensity = 0,
		this.showSnow = false,
		this.snowIntensity = 0,
		this.showWind = false,
		this.showLightning = false,
		this.showFog = false,
		this.primaryTextColor = Colors.white,
		this.secondaryTextColor = const Color(0xBFFFFFFF),
	});

	bool get isNight => timeOfDay == SkyTimeOfDay.night;
	bool get isDark => timeOfDay == SkyTimeOfDay.night || timeOfDay == SkyTimeOfDay.evening;

	/// Builds [SkyVisualConfig] from condition and time of day.
	factory SkyVisualConfig.fromCondition(SkyCondition condition, SkyTimeOfDay timeOfDay) {
		final gradient = skyGradientColors(condition, timeOfDay);
		final (primary, secondary) = _skyTextColors(condition, timeOfDay);

		// Base celestial config per day part
		final celestial = _celestialForTimeOfDay(timeOfDay);
		// Weather overlay modifiers
		final weather = _weatherOverlay(condition, timeOfDay);

		return SkyVisualConfig(
			condition: condition,
			timeOfDay: timeOfDay,
			gradientColors: gradient,
			showSun: celestial.showSun && weather.sunOpacity > 0,
			showMoon: celestial.showMoon,
			showStars: celestial.showStars,
			sunOpacity: celestial.sunOpacity * weather.sunOpacity,
			sunPosition: celestial.sunPosition,
			starOpacity: celestial.starOpacity,
			cloudCount: weather.cloudCount,
			cloudOpacity: weather.cloudOpacity,
			showRain: weather.showRain,
			rainIntensity: weather.rainIntensity,
			showSnow: weather.showSnow,
			snowIntensity: weather.snowIntensity,
			showWind: weather.showWind,
			showLightning: weather.showLightning,
			showFog: weather.showFog,
			primaryTextColor: primary,
			secondaryTextColor: secondary,
		);
	}

	/// Default fallback config when no weather data is available.
	factory SkyVisualConfig.defaultSky() {
		return SkyVisualConfig.fromCondition(SkyCondition.clear, SkyTimeOfDay.noon);
	}

	/// Celestial bodies config per day part (before weather modifiers).
	static SkyVisualConfig _celestialForTimeOfDay(SkyTimeOfDay timeOfDay) {
		switch (timeOfDay) {
			case SkyTimeOfDay.morning:
				return const SkyVisualConfig(
					condition: SkyCondition.clear,
					timeOfDay: SkyTimeOfDay.morning,
					gradientColors: [],
					showSun: true,
					sunPosition: 0.15,
					sunOpacity: 0.9,
					showStars: true,
					starOpacity: 0.15,
				);
			case SkyTimeOfDay.noon:
				return const SkyVisualConfig(
					condition: SkyCondition.clear,
					timeOfDay: SkyTimeOfDay.noon,
					gradientColors: [],
					showSun: true,
					sunPosition: 0.5,
					sunOpacity: 1.0,
				);
			case SkyTimeOfDay.evening:
				return const SkyVisualConfig(
					condition: SkyCondition.clear,
					timeOfDay: SkyTimeOfDay.evening,
					gradientColors: [],
					showSun: true,
					sunPosition: 0.85,
					sunOpacity: 0.8,
					showStars: true,
					starOpacity: 0.3,
				);
			case SkyTimeOfDay.night:
				return const SkyVisualConfig(
					condition: SkyCondition.clear,
					timeOfDay: SkyTimeOfDay.night,
					gradientColors: [],
					showMoon: true,
					showStars: true,
					starOpacity: 1.0,
				);
		}
	}

	/// Weather overlay modifiers (clouds, precipitation, sun dimming).
	static SkyVisualConfig _weatherOverlay(SkyCondition condition, SkyTimeOfDay timeOfDay) {
		final isNight = timeOfDay == SkyTimeOfDay.night;
		final isDim = timeOfDay == SkyTimeOfDay.evening || timeOfDay == SkyTimeOfDay.morning;
		final baseCloudOp = isNight ? 0.25 : (isDim ? 0.35 : 0.4);

		const stub = SkyCondition.clear;
		const stubTime = SkyTimeOfDay.noon;
		const stubGrad = <Color>[];

		switch (condition) {
			case SkyCondition.clear:
				return const SkyVisualConfig(
					condition: stub,
					timeOfDay: stubTime,
					gradientColors: stubGrad,
					sunOpacity: 1.0,
				);
			case SkyCondition.partlyCloudy:
				return SkyVisualConfig(
					condition: stub,
					timeOfDay: stubTime,
					gradientColors: stubGrad,
					cloudCount: 2,
					cloudOpacity: baseCloudOp,
					sunOpacity: 0.9,
				);
			case SkyCondition.cloudy:
				return SkyVisualConfig(
					condition: stub,
					timeOfDay: stubTime,
					gradientColors: stubGrad,
					cloudCount: 4,
					cloudOpacity: baseCloudOp + 0.15,
					sunOpacity: 0.5,
				);
			case SkyCondition.overcast:
				return SkyVisualConfig(
					condition: stub,
					timeOfDay: stubTime,
					gradientColors: stubGrad,
					cloudCount: 5,
					cloudOpacity: baseCloudOp + 0.25,
					sunOpacity: 0.0,
				);
			case SkyCondition.rainy:
				return SkyVisualConfig(
					condition: stub,
					timeOfDay: stubTime,
					gradientColors: stubGrad,
					cloudCount: 4,
					cloudOpacity: baseCloudOp + 0.15,
					showRain: true,
					rainIntensity: 40,
					sunOpacity: 0.0,
				);
			case SkyCondition.heavyRain:
				return SkyVisualConfig(
					condition: stub,
					timeOfDay: stubTime,
					gradientColors: stubGrad,
					cloudCount: 5,
					cloudOpacity: baseCloudOp + 0.25,
					showRain: true,
					rainIntensity: 80,
					sunOpacity: 0.0,
				);
			case SkyCondition.stormy:
				return SkyVisualConfig(
					condition: stub,
					timeOfDay: stubTime,
					gradientColors: stubGrad,
					cloudCount: 5,
					cloudOpacity: baseCloudOp + 0.3,
					showRain: true,
					rainIntensity: 80,
					showLightning: true,
					sunOpacity: 0.0,
				);
			case SkyCondition.snowy:
				return SkyVisualConfig(
					condition: stub,
					timeOfDay: stubTime,
					gradientColors: stubGrad,
					cloudCount: 3,
					cloudOpacity: baseCloudOp + 0.1,
					showSnow: true,
					snowIntensity: 40,
					sunOpacity: 0.2,
				);
			case SkyCondition.windy:
				return SkyVisualConfig(
					condition: stub,
					timeOfDay: stubTime,
					gradientColors: stubGrad,
					cloudCount: 2,
					cloudOpacity: baseCloudOp,
					showWind: true,
					sunOpacity: 1.0,
				);
			case SkyCondition.foggy:
				return SkyVisualConfig(
					condition: stub,
					timeOfDay: stubTime,
					gradientColors: stubGrad,
					cloudCount: 2,
					cloudOpacity: baseCloudOp - 0.1,
					showFog: true,
					sunOpacity: 0.15,
				);
		}
	}
}

/// Returns (primary, secondary) text colors for sky content overlay.
///
/// Night & evening always use light text.
/// Morning & noon use dark text for clear/cloudy, light text for rainy/stormy.
(Color, Color) _skyTextColors(SkyCondition condition, SkyTimeOfDay timeOfDay) {
	if (timeOfDay == SkyTimeOfDay.night || timeOfDay == SkyTimeOfDay.evening) {
		return (const Color(0xE6FFFFFF), const Color(0x80FFFFFF));
	}

	switch (condition) {
		case SkyCondition.rainy:
		case SkyCondition.heavyRain:
		case SkyCondition.stormy:
			return (Colors.white, const Color(0xB3FFFFFF));
		case SkyCondition.clear:
		case SkyCondition.partlyCloudy:
		case SkyCondition.cloudy:
		case SkyCondition.overcast:
		case SkyCondition.snowy:
		case SkyCondition.windy:
		case SkyCondition.foggy:
			return (const Color(0xDD2A3E4A), const Color(0x994A5E6A));
	}
}

/// Returns the 4-color gradient for a given condition and time of day.
List<Color> skyGradientColors(SkyCondition condition, SkyTimeOfDay timeOfDay) {
	final map = _gradients[timeOfDay]!;

	return map[condition]!;
}

// =============================================================================
// GRADIENTS — 4 day parts × 10 conditions = 40 gradient sets
// =============================================================================

const _gradients = <SkyTimeOfDay, Map<SkyCondition, List<Color>>>{
	// ── MORNING (warm golden-blue, sunrise tones) ──
	SkyTimeOfDay.morning: {
		SkyCondition.clear: [Color(0xFFE8A060), Color(0xFFD4B878), Color(0xFF8CC4D8), Color(0xFF6BB5D8)],
		SkyCondition.partlyCloudy: [Color(0xFFD4A070), Color(0xFFC8B488), Color(0xFF90BCD0), Color(0xFF78B0CC)],
		SkyCondition.cloudy: [Color(0xFFB8A08C), Color(0xFFACAA98), Color(0xFF98B0B8), Color(0xFF8CA4B0)],
		SkyCondition.overcast: [Color(0xFFA09890), Color(0xFF989498), Color(0xFF90989C), Color(0xFF8890A0)],
		SkyCondition.rainy: [Color(0xFF807878), Color(0xFF788088), Color(0xFF708890), Color(0xFF688898)],
		SkyCondition.heavyRain: [Color(0xFF686468), Color(0xFF607078), Color(0xFF587880), Color(0xFF507888)],
		SkyCondition.stormy: [Color(0xFF504848), Color(0xFF485058), Color(0xFF405860), Color(0xFF386068)],
		SkyCondition.snowy: [Color(0xFFC0B0A8), Color(0xFFB4B4B4), Color(0xFFA8BCC4), Color(0xFF9CB4C0)],
		SkyCondition.windy: [Color(0xFFD4A478), Color(0xFFC0B490), Color(0xFF8CC0D0), Color(0xFF70B0CC)],
		SkyCondition.foggy: [Color(0xFFBCB0A4), Color(0xFFB4ACA8), Color(0xFFACACB0), Color(0xFFA8A8AC)],
	},

	// ── NOON (bright blue, full daylight) ──
	SkyTimeOfDay.noon: {
		SkyCondition.clear: [Color(0xFF4A9FCC), Color(0xFF6BB5D8), Color(0xFF92CBE4), Color(0xFFC0DFF0)],
		SkyCondition.partlyCloudy: [Color(0xFF5EADD0), Color(0xFF7CC0DC), Color(0xFFA8D4E8), Color(0xFFC8DFEC)],
		SkyCondition.cloudy: [Color(0xFF7A9EAE), Color(0xFF93AEBB), Color(0xFFAABFC8), Color(0xFFC2D0D6)],
		SkyCondition.overcast: [Color(0xFF7E8E96), Color(0xFF95A2A8), Color(0xFFAAB5BA), Color(0xFFC0C8CC)],
		SkyCondition.rainy: [Color(0xFF5C7080), Color(0xFF6E8290), Color(0xFF8496A2), Color(0xFF9CACB6)],
		SkyCondition.heavyRain: [Color(0xFF4A5C68), Color(0xFF5A6E7A), Color(0xFF6E828C), Color(0xFF8898A2)],
		SkyCondition.stormy: [Color(0xFF2C3840), Color(0xFF3C4C56), Color(0xFF4E606A), Color(0xFF607480)],
		SkyCondition.snowy: [Color(0xFF8CA8B8), Color(0xFFA0BAC6), Color(0xFFB8CCD6), Color(0xFFD0DEE4)],
		SkyCondition.windy: [Color(0xFF5AA0C4), Color(0xFF72B4D0), Color(0xFF90C6DC), Color(0xFFB0D8E8)],
		SkyCondition.foggy: [Color(0xFFA0ACB2), Color(0xFFB0BAC0), Color(0xFFC0C8CC), Color(0xFFD2D8DA)],
	},

	// ── EVENING (warm oranges, purples, sunset) ──
	SkyTimeOfDay.evening: {
		SkyCondition.clear: [Color(0xFF1C2850), Color(0xFF5C3870), Color(0xFFC06848), Color(0xFFE8A040)],
		SkyCondition.partlyCloudy: [Color(0xFF242C4C), Color(0xFF583868), Color(0xFFB06850), Color(0xFFD89848)],
		SkyCondition.cloudy: [Color(0xFF2C3048), Color(0xFF4C3858), Color(0xFF886060), Color(0xFFB08058)],
		SkyCondition.overcast: [Color(0xFF303040), Color(0xFF44384C), Color(0xFF685858), Color(0xFF8C7060)],
		SkyCondition.rainy: [Color(0xFF1C2234), Color(0xFF342C40), Color(0xFF504848), Color(0xFF6C5C54)],
		SkyCondition.heavyRain: [Color(0xFF161C2C), Color(0xFF2C2838), Color(0xFF443C44), Color(0xFF584C4C)],
		SkyCondition.stormy: [Color(0xFF101420), Color(0xFF201C2C), Color(0xFF342C34), Color(0xFF443C40)],
		SkyCondition.snowy: [Color(0xFF283050), Color(0xFF4C3C64), Color(0xFF886878), Color(0xFFB09088)],
		SkyCondition.windy: [Color(0xFF202850), Color(0xFF543868), Color(0xFFB86850), Color(0xFFD89848)],
		SkyCondition.foggy: [Color(0xFF2C2C3C), Color(0xFF3C3844), Color(0xFF504C50), Color(0xFF686060)],
	},

	// ── NIGHT (deep indigo, dark) ──
	SkyTimeOfDay.night: {
		SkyCondition.clear: [Color(0xFF060A14), Color(0xFF0A1428), Color(0xFF0E1E3C), Color(0xFF142850)],
		SkyCondition.partlyCloudy: [Color(0xFF080E1C), Color(0xFF0C1830), Color(0xFF112244), Color(0xFF182850)],
		SkyCondition.cloudy: [Color(0xFF0C1018), Color(0xFF141C28), Color(0xFF1C2838), Color(0xFF283444)],
		SkyCondition.overcast: [Color(0xFF101418), Color(0xFF181C22), Color(0xFF22282E), Color(0xFF2E3438)],
		SkyCondition.rainy: [Color(0xFF0A0E14), Color(0xFF101820), Color(0xFF18222C), Color(0xFF222E38)],
		SkyCondition.heavyRain: [Color(0xFF080A10), Color(0xFF0E1218), Color(0xFF141C24), Color(0xFF1C2630)],
		SkyCondition.stormy: [Color(0xFF06080C), Color(0xFF0A0E14), Color(0xFF10161E), Color(0xFF181E28)],
		SkyCondition.snowy: [Color(0xFF0E1620), Color(0xFF162030), Color(0xFF1E2C40), Color(0xFF283848)],
		SkyCondition.windy: [Color(0xFF080E1C), Color(0xFF0C1830), Color(0xFF102040), Color(0xFF162850)],
		SkyCondition.foggy: [Color(0xFF121618), Color(0xFF1A2024), Color(0xFF242A2E), Color(0xFF303638)],
	},
};
