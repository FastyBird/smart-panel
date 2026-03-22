import 'package:intl/intl.dart';

/// A utility class for formatting numbers with localization support.
///
/// All methods use [Intl.getCurrentLocale] by default, which is synced
/// with the app's language setting. This ensures consistent formatting
/// across all screens (e.g., Czech → "1 234,56", English → "1,234.56").
class NumberUtils {
  /// Formats a double with the given decimal places and locale.
  static String formatNumber(double value,
      [int decimalPlaces = 2, String? locale]) {
    final effectiveLocale = locale ?? Intl.getCurrentLocale();

    String pattern = '#,##0';

    if (decimalPlaces > 0) {
      pattern += '.${'0' * decimalPlaces}';
    }

    return NumberFormat(pattern, effectiveLocale).format(value);
  }

  /// Formats an integer with thousand separators.
  ///
  /// Example (en): 59955 → "59,955"
  /// Example (cs): 59955 → "59 955"
  static String formatInteger(int value, [String? locale]) {
    final effectiveLocale = locale ?? Intl.getCurrentLocale();
    return NumberFormat('#,##0', effectiveLocale).format(value);
  }

  /// Formats a double with thousand separators and specified decimal places.
  ///
  /// Example (en): 1234.5 with 1 decimal → "1,234.5"
  /// Example (cs): 1234.5 with 1 decimal → "1 234,5"
  static String formatDecimal(double value,
      {int decimalPlaces = 1, String? locale}) {
    return formatNumber(value, decimalPlaces, locale);
  }

  /// Returns a placeholder string for unavailable values, using the correct
  /// decimal separator for the current locale.
  ///
  /// Example (en): formatUnavailableNumber(2) → "--.-"
  /// Example (cs): formatUnavailableNumber(2) → "--,-"
  static String formatUnavailableNumber(
      [int decimalPlaces = 2, String? locale]) {
    final effectiveLocale = locale ?? Intl.getCurrentLocale();

    final separator =
        NumberFormat.decimalPattern(effectiveLocale).symbols.DECIMAL_SEP;

    final decimalPart = List.generate(decimalPlaces, (_) => '-').join();

    if (decimalPlaces == 0) {
      return '--';
    }

    return "--$separator$decimalPart";
  }
}
