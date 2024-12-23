import 'dart:async';

import 'package:intl/intl.dart';

class DatetimeUtils {
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
}
