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

/// Whether it is currently day or night based on sunrise/sunset.
enum SkyTimeOfDay { day, night }

/// Resolves day/night from current time and sunrise/sunset.
SkyTimeOfDay resolveSkyTimeOfDay(DateTime now, DateTime sunrise, DateTime sunset) {
	return (now.isAfter(sunrise) && now.isBefore(sunset)) ? SkyTimeOfDay.day : SkyTimeOfDay.night;
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

	/// Builds [SkyVisualConfig] from condition and time of day.
	factory SkyVisualConfig.fromCondition(SkyCondition condition, SkyTimeOfDay timeOfDay) {
		final isNight = timeOfDay == SkyTimeOfDay.night;
		final gradient = skyGradientColors(condition, isNight);
		final (primary, secondary) = _skyTextColors(condition, isNight);

		switch (condition) {
			case SkyCondition.clear:
				return isNight
						? SkyVisualConfig(
								condition: condition,
								timeOfDay: timeOfDay,
								gradientColors: gradient,
								showMoon: true,
								showStars: true,
								primaryTextColor: primary,
								secondaryTextColor: secondary,
							)
						: SkyVisualConfig(
								condition: condition,
								timeOfDay: timeOfDay,
								gradientColors: gradient,
								showSun: true,
								primaryTextColor: primary,
								secondaryTextColor: secondary,
							);
			case SkyCondition.partlyCloudy:
				return isNight
						? SkyVisualConfig(
								condition: condition,
								timeOfDay: timeOfDay,
								gradientColors: gradient,
								showMoon: true,
								showStars: true,
								cloudCount: 2,
								cloudOpacity: 0.2,
								primaryTextColor: primary,
								secondaryTextColor: secondary,
							)
						: SkyVisualConfig(
								condition: condition,
								timeOfDay: timeOfDay,
								gradientColors: gradient,
								showSun: true,
								cloudCount: 2,
								cloudOpacity: 0.35,
								sunOpacity: 0.9,
								primaryTextColor: primary,
								secondaryTextColor: secondary,
							);
			case SkyCondition.cloudy:
				return isNight
						? SkyVisualConfig(
								condition: condition,
								timeOfDay: timeOfDay,
								gradientColors: gradient,
								showMoon: true,
								cloudCount: 4,
								cloudOpacity: 0.3,
								primaryTextColor: primary,
								secondaryTextColor: secondary,
							)
						: SkyVisualConfig(
								condition: condition,
								timeOfDay: timeOfDay,
								gradientColors: gradient,
								showSun: true,
								cloudCount: 4,
								cloudOpacity: 0.5,
								sunOpacity: 0.5,
								primaryTextColor: primary,
								secondaryTextColor: secondary,
							);
			case SkyCondition.overcast:
				return isNight
						? SkyVisualConfig(
								condition: condition,
								timeOfDay: timeOfDay,
								gradientColors: gradient,
								cloudCount: 5,
								cloudOpacity: 0.45,
								primaryTextColor: primary,
								secondaryTextColor: secondary,
							)
						: SkyVisualConfig(
								condition: condition,
								timeOfDay: timeOfDay,
								gradientColors: gradient,
								cloudCount: 5,
								cloudOpacity: 0.6,
								sunOpacity: 0.0,
								primaryTextColor: primary,
								secondaryTextColor: secondary,
							);
			case SkyCondition.rainy:
				return SkyVisualConfig(
					condition: condition,
					timeOfDay: timeOfDay,
					gradientColors: gradient,
					cloudCount: 4,
					cloudOpacity: isNight ? 0.35 : 0.5,
					showRain: true,
					rainIntensity: 40,
					primaryTextColor: primary,
					secondaryTextColor: secondary,
				);
			case SkyCondition.heavyRain:
				return SkyVisualConfig(
					condition: condition,
					timeOfDay: timeOfDay,
					gradientColors: gradient,
					cloudCount: 5,
					cloudOpacity: isNight ? 0.45 : 0.6,
					showRain: true,
					rainIntensity: 80,
					primaryTextColor: primary,
					secondaryTextColor: secondary,
				);
			case SkyCondition.stormy:
				return SkyVisualConfig(
					condition: condition,
					timeOfDay: timeOfDay,
					gradientColors: gradient,
					cloudCount: 5,
					cloudOpacity: isNight ? 0.5 : 0.65,
					showRain: true,
					rainIntensity: 80,
					showLightning: true,
					primaryTextColor: primary,
					secondaryTextColor: secondary,
				);
			case SkyCondition.snowy:
				return SkyVisualConfig(
					condition: condition,
					timeOfDay: timeOfDay,
					gradientColors: gradient,
					cloudCount: 3,
					cloudOpacity: isNight ? 0.25 : 0.4,
					showSnow: true,
					snowIntensity: 40,
					primaryTextColor: primary,
					secondaryTextColor: secondary,
				);
			case SkyCondition.windy:
				return isNight
						? SkyVisualConfig(
								condition: condition,
								timeOfDay: timeOfDay,
								gradientColors: gradient,
								showMoon: true,
								showStars: true,
								cloudCount: 2,
								cloudOpacity: 0.2,
								showWind: true,
								primaryTextColor: primary,
								secondaryTextColor: secondary,
							)
						: SkyVisualConfig(
								condition: condition,
								timeOfDay: timeOfDay,
								gradientColors: gradient,
								showSun: true,
								cloudCount: 2,
								cloudOpacity: 0.35,
								showWind: true,
								primaryTextColor: primary,
								secondaryTextColor: secondary,
							);
			case SkyCondition.foggy:
				return SkyVisualConfig(
					condition: condition,
					timeOfDay: timeOfDay,
					gradientColors: gradient,
					cloudCount: 2,
					cloudOpacity: isNight ? 0.15 : 0.25,
					showFog: true,
					primaryTextColor: primary,
					secondaryTextColor: secondary,
				);
		}
	}

	/// Default fallback config when no weather data is available.
	factory SkyVisualConfig.defaultSky() {
		return SkyVisualConfig.fromCondition(SkyCondition.clear, SkyTimeOfDay.day);
	}
}

/// Returns (primary, secondary) text colors for sky content overlay.
///
/// Light backgrounds (foggy day, snowy day) use dark text for contrast;
/// dark backgrounds (night, stormy) use bright white text.
(Color, Color) _skyTextColors(SkyCondition condition, bool isNight) {
	if (isNight) {
		return (const Color(0xE6FFFFFF), const Color(0x80FFFFFF));
	}

	switch (condition) {
		case SkyCondition.foggy:
		case SkyCondition.overcast:
			return (const Color(0xDD2A3E4A), const Color(0x994A5E6A));
		case SkyCondition.snowy:
			return (Colors.white, const Color(0xA6FFFFFF));
		case SkyCondition.cloudy:
		case SkyCondition.rainy:
			return (Colors.white, const Color(0xB3FFFFFF));
		case SkyCondition.heavyRain:
		case SkyCondition.stormy:
			return (Colors.white, const Color(0xB3FFFFFF));
		case SkyCondition.clear:
		case SkyCondition.partlyCloudy:
		case SkyCondition.windy:
			return (Colors.white, const Color(0xBFFFFFFF));
	}
}

/// Returns the 4-color gradient for a given condition and day/night.
List<Color> skyGradientColors(SkyCondition condition, bool isNight) {
	final map = isNight ? _nightGradients : _dayGradients;

	return map[condition]!;
}

const _dayGradients = <SkyCondition, List<Color>>{
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
};

const _nightGradients = <SkyCondition, List<Color>>{
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
};
