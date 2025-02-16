import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum Language {
  english('en_US'),
  czech('cs_CZ');

  final String value;

  const Language(this.value);

  static final utils = StringEnumUtils(
    Language.values,
    (Language payload) => payload.value,
  );

  static Language? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum TimeFormat {
  twelveHour('12h'),
  twentyFourHour('24h');

  final String value;

  const TimeFormat(this.value);

  static final utils = StringEnumUtils(
    TimeFormat.values,
    (TimeFormat payload) => payload.value,
  );

  static TimeFormat? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

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
