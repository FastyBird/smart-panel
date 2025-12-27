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
