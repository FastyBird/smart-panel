import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum WeatherLocationType {
  cityName('city_name'),
  cityId('city_id'),
  latLon('lat_lon'),
  zipCode('zip_code');

  final String value;

  const WeatherLocationType(this.value);

  static final utils = StringEnumUtils(
    WeatherLocationType.values,
    (WeatherLocationType payload) => payload.value,
  );

  static WeatherLocationType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum WeatherUnit {
  celsius('celsius'),
  fahrenheit('fahrenheit');

  final String value;

  const WeatherUnit(this.value);

  static final utils = StringEnumUtils(
    WeatherUnit.values,
    (WeatherUnit payload) => payload.value,
  );

  static WeatherUnit? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
