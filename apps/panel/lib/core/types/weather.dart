import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum UnitType {
  celsius('celsius'),
  fahrenheit('fahrenheit');

  final String value;

  const UnitType(this.value);

  static final utils = StringEnumUtils(
    UnitType.values,
    (UnitType payload) => payload.value,
  );

  static UnitType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
