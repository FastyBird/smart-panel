import 'package:flutter/material.dart';

// =============================================================================
// SKY CONDITION ENUM
// =============================================================================

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

// =============================================================================
// SKY GRADIENTS — 10 conditions x 2 (day/night) = 20 variants
// =============================================================================

class SkyGradients {
	SkyGradients._();

	// Day gradients
	static const _clearDay = [Color(0xFF4A9FCC), Color(0xFF6BB5D8), Color(0xFF92CBE4), Color(0xFFC0DFF0)];
	static const _partlyCloudyDay = [Color(0xFF5EADD0), Color(0xFF7CC0DC), Color(0xFFA8D4E8), Color(0xFFC8DFEC)];
	static const _cloudyDay = [Color(0xFF7A9EAE), Color(0xFF93AEBB), Color(0xFFAABFC8), Color(0xFFC2D0D6)];
	static const _overcastDay = [Color(0xFF7E8E96), Color(0xFF95A2A8), Color(0xFFAAB5BA), Color(0xFFC0C8CC)];
	static const _rainyDay = [Color(0xFF5C7080), Color(0xFF6E8290), Color(0xFF8496A2), Color(0xFF9CACB6)];
	static const _heavyRainDay = [Color(0xFF4A5C68), Color(0xFF5A6E7A), Color(0xFF6E828C), Color(0xFF8898A2)];
	static const _stormyDay = [Color(0xFF2C3840), Color(0xFF3C4C56), Color(0xFF4E606A), Color(0xFF607480)];
	static const _snowyDay = [Color(0xFF8CA8B8), Color(0xFFA0BAC6), Color(0xFFB8CCD6), Color(0xFFD0DEE4)];
	static const _windyDay = [Color(0xFF5AA0C4), Color(0xFF72B4D0), Color(0xFF90C6DC), Color(0xFFB0D8E8)];
	static const _foggyDay = [Color(0xFFA0ACB2), Color(0xFFB0BAC0), Color(0xFFC0C8CC), Color(0xFFD2D8DA)];

	// Night gradients
	static const _clearNight = [Color(0xFF060A14), Color(0xFF0A1428), Color(0xFF0E1E3C), Color(0xFF142850)];
	static const _partlyCloudyNight = [Color(0xFF080E1C), Color(0xFF0C1830), Color(0xFF112244), Color(0xFF182850)];
	static const _cloudyNight = [Color(0xFF0C1018), Color(0xFF141C28), Color(0xFF1C2838), Color(0xFF283444)];
	static const _overcastNight = [Color(0xFF101418), Color(0xFF181C22), Color(0xFF22282E), Color(0xFF2E3438)];
	static const _rainyNight = [Color(0xFF0A0E14), Color(0xFF101820), Color(0xFF18222C), Color(0xFF222E38)];
	static const _heavyRainNight = [Color(0xFF080A10), Color(0xFF0E1218), Color(0xFF141C24), Color(0xFF1C2630)];
	static const _stormyNight = [Color(0xFF06080C), Color(0xFF0A0E14), Color(0xFF10161E), Color(0xFF181E28)];
	static const _snowyNight = [Color(0xFF0E1620), Color(0xFF162030), Color(0xFF1E2C40), Color(0xFF283848)];
	static const _windyNight = [Color(0xFF080E1C), Color(0xFF0C1830), Color(0xFF102040), Color(0xFF162850)];
	static const _foggyNight = [Color(0xFF121618), Color(0xFF1A2024), Color(0xFF242A2E), Color(0xFF303638)];

	static List<Color> get(SkyCondition c, bool isNight) {
		final map = isNight ? _nightMap : _dayMap;
		return map[c]!;
	}

	static const _dayMap = {
		SkyCondition.clear: _clearDay,
		SkyCondition.partlyCloudy: _partlyCloudyDay,
		SkyCondition.cloudy: _cloudyDay,
		SkyCondition.overcast: _overcastDay,
		SkyCondition.rainy: _rainyDay,
		SkyCondition.heavyRain: _heavyRainDay,
		SkyCondition.stormy: _stormyDay,
		SkyCondition.snowy: _snowyDay,
		SkyCondition.windy: _windyDay,
		SkyCondition.foggy: _foggyDay,
	};

	static const _nightMap = {
		SkyCondition.clear: _clearNight,
		SkyCondition.partlyCloudy: _partlyCloudyNight,
		SkyCondition.cloudy: _cloudyNight,
		SkyCondition.overcast: _overcastNight,
		SkyCondition.rainy: _rainyNight,
		SkyCondition.heavyRain: _heavyRainNight,
		SkyCondition.stormy: _stormyNight,
		SkyCondition.snowy: _snowyNight,
		SkyCondition.windy: _windyNight,
		SkyCondition.foggy: _foggyNight,
	};
}

// =============================================================================
// SKY CONFIG — visual element config per condition
// =============================================================================

class SkyConfig {
	final bool showSun, showMoon, showStars;
	final int cloudCount;
	final double cloudOpacity;
	final double sunOpacity;
	final bool showRain, showSnow, showWind, showLightning, showFog;
	final int rainIntensity, snowIntensity;

	const SkyConfig({
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
	});

	factory SkyConfig.fromCondition(SkyCondition c, bool isNight) {
		switch (c) {
			case SkyCondition.clear:
				return isNight
					? const SkyConfig(showMoon: true, showStars: true)
					: const SkyConfig(showSun: true);
			case SkyCondition.partlyCloudy:
				return isNight
					? const SkyConfig(showMoon: true, showStars: true, cloudCount: 2, cloudOpacity: 0.2)
					: const SkyConfig(showSun: true, cloudCount: 2, cloudOpacity: 0.35, sunOpacity: 0.9);
			case SkyCondition.cloudy:
				return isNight
					? const SkyConfig(showMoon: true, cloudCount: 4, cloudOpacity: 0.3)
					: const SkyConfig(showSun: true, cloudCount: 4, cloudOpacity: 0.5, sunOpacity: 0.5);
			case SkyCondition.overcast:
				return isNight
					? const SkyConfig(cloudCount: 5, cloudOpacity: 0.45)
					: const SkyConfig(cloudCount: 5, cloudOpacity: 0.6, sunOpacity: 0.0);
			case SkyCondition.rainy:
				return isNight
					? const SkyConfig(cloudCount: 4, cloudOpacity: 0.35, showRain: true, rainIntensity: 40)
					: const SkyConfig(cloudCount: 4, cloudOpacity: 0.5, showRain: true, rainIntensity: 40);
			case SkyCondition.heavyRain:
				return isNight
					? const SkyConfig(cloudCount: 5, cloudOpacity: 0.45, showRain: true, rainIntensity: 80)
					: const SkyConfig(cloudCount: 5, cloudOpacity: 0.6, showRain: true, rainIntensity: 80);
			case SkyCondition.stormy:
				return isNight
					? const SkyConfig(
						cloudCount: 5,
						cloudOpacity: 0.5,
						showRain: true,
						rainIntensity: 80,
						showLightning: true,
					)
					: const SkyConfig(
						cloudCount: 5,
						cloudOpacity: 0.65,
						showRain: true,
						rainIntensity: 80,
						showLightning: true,
					);
			case SkyCondition.snowy:
				return isNight
					? const SkyConfig(cloudCount: 3, cloudOpacity: 0.25, showSnow: true, snowIntensity: 40)
					: const SkyConfig(cloudCount: 3, cloudOpacity: 0.4, showSnow: true, snowIntensity: 40);
			case SkyCondition.windy:
				return isNight
					? const SkyConfig(showMoon: true, showStars: true, cloudCount: 2, cloudOpacity: 0.2, showWind: true)
					: const SkyConfig(showSun: true, cloudCount: 2, cloudOpacity: 0.35, showWind: true);
			case SkyCondition.foggy:
				return isNight
					? const SkyConfig(cloudCount: 2, cloudOpacity: 0.15, showFog: true)
					: const SkyConfig(cloudCount: 2, cloudOpacity: 0.25, showFog: true);
		}
	}
}
