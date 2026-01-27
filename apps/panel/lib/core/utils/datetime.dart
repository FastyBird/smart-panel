import 'dart:async';

import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:intl/intl.dart';

class DatetimeUtils {
  /// Formats a DateTime as a relative "time ago" string.
  ///
  /// Returns strings like "just now", "5 min ago", "2 h ago", "3 d ago".
  static String formatTimeAgo(DateTime dateTime, AppLocalizations localizations) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inMinutes < 1) {
      return localizations.time_ago_just_now;
    } else if (difference.inHours < 1) {
      return localizations.time_ago_minutes(difference.inMinutes);
    } else if (difference.inDays < 1) {
      return localizations.time_ago_hours(difference.inHours);
    } else {
      return localizations.time_ago_days(difference.inDays);
    }
  }

  // Stream that emits the current time every second
  static Stream<DateTime> getTimeStream() {
    return Stream.periodic(const Duration(seconds: 1), (_) => DateTime.now());
  }

  // Get formatted time
  static String getFormattedTime(DateTime dateTime, [String format = 'HH:mm']) {
    return DateFormat(format).format(dateTime);
  }

  // Get formatted date
  static String getFormattedDate(DateTime dateTime, [String? locale]) {
    final effectiveLocale = locale ?? Intl.getCurrentLocale();
    // Create a DateFormat object for the locale
    final dateFormat = DateFormat.yMMMMEEEEd(effectiveLocale);

    // Format the date and then remove the year part
    final formattedDate = dateFormat.format(dateTime);
    return formattedDate.replaceAll(RegExp(r'\s?\d{4}'), '').trim();
  }

  // Get formatted short day name like mon, tue, wed
  static String getShortDayName(DateTime dateTime) {
    return DateFormat.E(Intl.getCurrentLocale()).format(dateTime);
  }

  // Get formatted day name like monday, tuesday, wednesday
  static String getDayName(DateTime dateTime) {
    return DateFormat.EEEE(Intl.getCurrentLocale()).format(dateTime);
  }

  // Get formatted month and day name like Feb 15, Mar 10
  static String getShortMonthDay(DateTime dateTime) {
    return DateFormat.MMMd(Intl.getCurrentLocale()).format(dateTime);
  }
}
