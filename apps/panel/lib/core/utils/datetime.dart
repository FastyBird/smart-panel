import 'dart:async';

import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:intl/intl.dart';

/// Format style for relative time strings.
enum TimeAgoFormat {
  /// Abbreviated: "5 min ago", "3 d ago"
  short,

  /// Single unit with full words: "5 minutes ago", "3 days ago"
  medium,

  /// Two-unit precision: "3 days 5 hours ago"
  full,
}

class DatetimeUtils {
  /// Formats a DateTime as a relative "time ago" string.
  ///
  /// [format] controls verbosity:
  /// - [TimeAgoFormat.short]: "5 min ago", "3 d ago"
  /// - [TimeAgoFormat.medium]: "5 minutes ago", "3 days ago"
  /// - [TimeAgoFormat.full]: "3 days 5 hours ago", "2 hours 30 minutes ago"
  static String formatTimeAgo(
    DateTime dateTime,
    AppLocalizations localizations, {
    TimeAgoFormat format = TimeAgoFormat.short,
  }) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inMinutes < 1) {
      return localizations.time_ago_just_now;
    }

    switch (format) {
      case TimeAgoFormat.short:
        return _formatShort(difference, localizations);
      case TimeAgoFormat.medium:
        return _formatMedium(difference, localizations);
      case TimeAgoFormat.full:
        return _formatFull(difference, localizations);
    }
  }

  static String _formatShort(Duration difference, AppLocalizations l) {
    if (difference.inHours < 1) {
      return l.time_ago_minutes(difference.inMinutes);
    } else if (difference.inDays < 1) {
      return l.time_ago_hours(difference.inHours);
    } else {
      return l.time_ago_days(difference.inDays);
    }
  }

  static String _formatMedium(Duration difference, AppLocalizations l) {
    if (difference.inHours < 1) {
      return l.time_ago_medium_minutes(difference.inMinutes);
    } else if (difference.inDays < 1) {
      return l.time_ago_medium_hours(difference.inHours);
    } else {
      return l.time_ago_medium_days(difference.inDays);
    }
  }

  static String _formatFull(Duration difference, AppLocalizations l) {
    if (difference.inHours < 1) {
      return l.time_ago_full_minutes(difference.inMinutes);
    } else if (difference.inDays < 1) {
      final hours = difference.inHours;
      final minutes = difference.inMinutes % 60;
      if (minutes == 0) {
        return l.time_ago_full_hours(hours);
      }
      return l.time_ago_full_hours_minutes(hours, minutes);
    } else {
      final days = difference.inDays;
      final hours = (difference.inHours % 24);
      if (hours == 0) {
        return l.time_ago_full_days(days);
      }
      return l.time_ago_full_days_hours(days, hours);
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

  /// Format a [Duration] as `m:ss` (e.g., `3:05`, `12:00`).
  static String formatDuration(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }
}
