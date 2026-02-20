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

enum TemperatureUnit {
  celsius('celsius'),
  fahrenheit('fahrenheit');

  final String value;

  const TemperatureUnit(this.value);

  static final utils = StringEnumUtils(
    TemperatureUnit.values,
    (TemperatureUnit payload) => payload.value,
  );

  static TemperatureUnit? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum WindSpeedUnit {
  metersPerSecond('ms'),
  kilometersPerHour('kmh'),
  milesPerHour('mph'),
  knots('knots');

  final String value;

  const WindSpeedUnit(this.value);

  static final utils = StringEnumUtils(
    WindSpeedUnit.values,
    (WindSpeedUnit payload) => payload.value,
  );

  static WindSpeedUnit? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum PressureUnit {
  hectopascal('hpa'),
  millibar('mbar'),
  inchesOfMercury('inhg'),
  millimetersOfMercury('mmhg');

  final String value;

  const PressureUnit(this.value);

  static final utils = StringEnumUtils(
    PressureUnit.values,
    (PressureUnit payload) => payload.value,
  );

  static PressureUnit? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum PrecipitationUnit {
  millimeters('mm'),
  inches('inches');

  final String value;

  const PrecipitationUnit(this.value);

  static final utils = StringEnumUtils(
    PrecipitationUnit.values,
    (PrecipitationUnit payload) => payload.value,
  );

  static PrecipitationUnit? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum DistanceUnit {
  kilometers('km'),
  miles('miles'),
  meters('meters'),
  feet('feet');

  final String value;

  const DistanceUnit(this.value);

  static final utils = StringEnumUtils(
    DistanceUnit.values,
    (DistanceUnit payload) => payload.value,
  );

  static DistanceUnit? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum HouseMode {
  home('home'),
  away('away'),
  night('night');

  final String value;

  const HouseMode(this.value);

  static final utils = StringEnumUtils(
    HouseMode.values,
    (HouseMode payload) => payload.value,
  );

  static HouseMode? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
