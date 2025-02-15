import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum WeatherLocationTypeType {
  cityName('city_name'),
  cityId('city_id'),
  latLon('lat_lon'),
  zipCode('zip_code');

  final String value;

  const WeatherLocationTypeType(this.value);

  static final utils = StringEnumUtils(
    WeatherLocationTypeType.values,
    (WeatherLocationTypeType payload) => payload.value,
  );

  static WeatherLocationTypeType? fromValue(String value) =>
      utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum WeatherUnitType {
  celsius('celsius'),
  fahrenheit('fahrenheit');

  final String value;

  const WeatherUnitType(this.value);

  static final utils = StringEnumUtils(
    WeatherUnitType.values,
    (WeatherUnitType payload) => payload.value,
  );

  static WeatherUnitType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
