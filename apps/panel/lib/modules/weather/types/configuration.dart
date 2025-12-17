import 'package:fastybird_smart_panel/core/utils/enum.dart';

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
