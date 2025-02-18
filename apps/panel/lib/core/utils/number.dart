import 'package:intl/intl.dart';

/// A utility class for formatting numbers with localization support.
class NumberUtils {
  /// Formats a number based on the given decimal places and locale.
  ///
  /// - [value]: The number to format. If `null`, a placeholder will be returned.
  /// - [decimalPlaces]: The number of decimal places to display.
  /// - [locale]: (Optional) The locale for formatting. Defaults to the current locale.
  ///
  /// Returns a formatted number string.
  static String formatNumber(double value, int decimalPlaces,
      [String? locale]) {
    final effectiveLocale = locale ?? Intl.getCurrentLocale();

    // Generate a dynamic pattern based on decimal places
    String pattern = '#,##0';

    if (decimalPlaces > 0) {
      pattern += '.${'0' * decimalPlaces}'; // Add the required number of zeros
    }

    return NumberFormat(pattern, effectiveLocale).format(value);
  }

  /// Returns a placeholder string for unavailable values, using the correct decimal separator.
  ///
  /// - [locale]: (Optional) The locale for formatting. Defaults to the current locale.
  ///
  /// Returns a string in the format `"--.-"` where `.` is replaced by the localized decimal separator.
  static String formatUnavailableNumber([String? locale]) {
    final effectiveLocale = locale ?? Intl.getCurrentLocale();

    final separator =
        NumberFormat.decimalPattern(effectiveLocale).symbols.DECIMAL_SEP;

    return "--$separator-";
  }
}
