import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum LanguageType {
  english('en_US'),
  czech('cs_CZ');

  final String value;

  const LanguageType(this.value);

  static final utils = StringEnumUtils(
    LanguageType.values,
    (LanguageType payload) => payload.value,
  );

  static LanguageType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum TimeFormatType {
  twelveHour('12h'),
  twentyFourHour('24h');

  final String value;

  const TimeFormatType(this.value);

  static final utils = StringEnumUtils(
    TimeFormatType.values,
    (TimeFormatType payload) => payload.value,
  );

  static TimeFormatType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}

enum DayType {
  monday('monday'),
  tuesday('tuesday'),
  wednesday('wednesday'),
  thursday('thursday'),
  friday('friday'),
  saturday('saturday'),
  sunday('sunday');

  final String value;

  const DayType(this.value);

  static final utils = StringEnumUtils(
    DayType.values,
    (DayType payload) => payload.value,
  );

  static DayType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
