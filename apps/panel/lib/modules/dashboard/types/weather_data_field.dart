import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum WeatherDataField {
  temperature('temperature'),
  temperatureMin('temperature_min'),
  temperatureMax('temperature_max'),
  feelsLike('feels_like'),
  humidity('humidity'),
  pressure('pressure'),
  weatherIcon('weather_icon'),
  weatherMain('weather_main'),
  weatherDescription('weather_description'),
  windSpeed('wind_speed');

  final String value;

  const WeatherDataField(this.value);

  static final utils = StringEnumUtils(
    WeatherDataField.values,
    (WeatherDataField payload) => payload.value,
  );

  static WeatherDataField? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
