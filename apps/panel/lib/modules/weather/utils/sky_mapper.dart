import 'package:fastybird_smart_panel/core/widgets/sky/sky_condition.dart';

/// Maps OpenWeatherMap condition codes to [SkyCondition] for sky rendering.
class WeatherSkyMapper {
	/// Maps an OWM weather condition code to the appropriate [SkyCondition].
	///
	/// See: https://openweathermap.org/weather-conditions
	static SkyCondition fromWeatherCode(int code) {
		// 2xx: Thunderstorm
		if (code >= 200 && code < 300) {
			return SkyCondition.stormy;
		}

		// 3xx: Drizzle
		if (code >= 300 && code < 400) {
			return SkyCondition.rainy;
		}

		// 5xx: Rain
		if (code >= 500 && code < 600) {
			if (code == 511) {
				// Freezing rain
				return SkyCondition.snowy;
			}
			if (code >= 502) {
				// Heavy intensity rain and above
				return SkyCondition.heavyRain;
			}

			return SkyCondition.rainy;
		}

		// 6xx: Snow
		if (code >= 600 && code < 700) {
			return SkyCondition.snowy;
		}

		// 7xx: Atmosphere
		if (code >= 700 && code < 800) {
			if (code == 771) {
				// Squalls
				return SkyCondition.windy;
			}
			if (code == 781) {
				// Tornado
				return SkyCondition.stormy;
			}

			// Mist, smoke, haze, dust, fog, sand, volcanic ash
			return SkyCondition.foggy;
		}

		// 800: Clear
		if (code == 800) {
			return SkyCondition.clear;
		}

		// 801: Few clouds
		if (code == 801) {
			return SkyCondition.partlyCloudy;
		}

		// 802: Scattered clouds
		if (code == 802) {
			return SkyCondition.partlyCloudy;
		}

		// 803: Broken clouds
		if (code == 803) {
			return SkyCondition.cloudy;
		}

		// 804: Overcast clouds
		if (code == 804) {
			return SkyCondition.overcast;
		}

		// Default fallback
		return SkyCondition.clear;
	}
}
