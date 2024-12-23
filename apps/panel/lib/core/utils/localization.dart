import 'package:fastybird_smart_panel/core/types/localization.dart';
import 'package:intl/intl.dart';

class LocalizationUtils {
  static String getLocalizedDayName(DayType day, [String? locale]) {
    final effectiveLocale = locale ?? Intl.getCurrentLocale();

    switch (day) {
      case DayType.monday:
        return Intl.message(
          'Monday',
          name: 'day_monday',
          locale: effectiveLocale,
          desc: 'The name of Monday',
        );
      case DayType.tuesday:
        return Intl.message(
          'Tuesday',
          name: 'day_tuesday',
          locale: effectiveLocale,
          desc: 'The name of Tuesday',
        );
      case DayType.wednesday:
        return Intl.message(
          'Wednesday',
          name: 'day_wednesday',
          locale: effectiveLocale,
          desc: 'The name of Wednesday',
        );
      case DayType.thursday:
        return Intl.message(
          'Thursday',
          name: 'day_thursday',
          locale: effectiveLocale,
          desc: 'The name of Thursday',
        );
      case DayType.friday:
        return Intl.message(
          'Friday',
          name: 'day_friday',
          locale: effectiveLocale,
          desc: 'The name of Friday',
        );
      case DayType.saturday:
        return Intl.message(
          'Saturday',
          name: 'day_saturday',
          locale: effectiveLocale,
          desc: 'The name of Saturday',
        );
      case DayType.sunday:
        return Intl.message(
          'Sunday',
          name: 'day_sunday',
          locale: effectiveLocale,
          desc: 'The name of Sunday',
        );
    }
  }

  static String getLocalizedShortDayName(DayType day, [String? locale]) {
    final effectiveLocale = locale ?? Intl.getCurrentLocale();

    switch (day) {
      case DayType.monday:
        return Intl.message(
          'Mon',
          name: 'day_monday_short',
          locale: effectiveLocale,
          desc: 'The name of Monday',
        );
      case DayType.tuesday:
        return Intl.message(
          'Tue',
          name: 'day_tuesday_short',
          locale: effectiveLocale,
          desc: 'The name of Tuesday',
        );
      case DayType.wednesday:
        return Intl.message(
          'Wed',
          name: 'day_wednesday_short',
          locale: effectiveLocale,
          desc: 'The name of Wednesday',
        );
      case DayType.thursday:
        return Intl.message(
          'Thu',
          name: 'day_thursday_short',
          locale: effectiveLocale,
          desc: 'The name of Thursday',
        );
      case DayType.friday:
        return Intl.message(
          'Fri',
          name: 'day_friday_short',
          locale: effectiveLocale,
          desc: 'The name of Friday',
        );
      case DayType.saturday:
        return Intl.message(
          'Sat',
          name: 'day_saturday_short',
          locale: effectiveLocale,
          desc: 'The name of Saturday',
        );
      case DayType.sunday:
        return Intl.message(
          'Sun',
          name: 'day_sunday_short',
          locale: effectiveLocale,
          desc: 'The name of Sunday',
        );
    }
  }
}
