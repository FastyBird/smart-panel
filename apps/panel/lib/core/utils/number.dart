import 'package:fastybird_smart_panel/core/utils/unit_converter.dart';
import 'package:intl/intl.dart';

/// A utility class for formatting numbers with localization support.
///
/// All methods resolve the number format from the system configuration
/// (display override → system default → locale fallback). This ensures
/// consistent formatting across all screens based on the user's preference.
///
/// Number format options:
/// - [NumberFormat.commaDot]: 1,234.56 (US/UK style)
/// - [NumberFormat.dotComma]: 1.234,56 (German style)
/// - [NumberFormat.spaceComma]: 1 234,56 (French/Czech style)
/// - [NumberFormat.none]: 1234.56 (no grouping)
class NumberUtils {
  /// Returns the locale string that corresponds to the given [NumberFormat].
  static String _localeForFormat(NumberFormat format) {
    switch (format) {
      case NumberFormat.commaDot:
        return 'en_US';
      case NumberFormat.dotComma:
        return 'de_DE';
      case NumberFormat.spaceComma:
        return 'fr_FR';
      case NumberFormat.none:
        return 'en_US';
    }
  }

  /// Resolves the effective locale for number formatting.
  ///
  /// Priority: explicit [format] → explicit [locale] → resolved display units → app locale.
  static String _resolveLocale({String? locale, NumberFormat? format}) {
    if (format != null) return _localeForFormat(format);
    if (locale != null) return locale;

    try {
      final units = DisplayUnits.fromLocator();
      return _localeForFormat(units.numberFormat);
    } catch (_) {
      return Intl.getCurrentLocale();
    }
  }

  /// Whether the resolved format disables grouping separators.
  static bool _isNoGrouping({NumberFormat? format}) {
    if (format == NumberFormat.none) return true;
    if (format != null) return false;

    try {
      final units = DisplayUnits.fromLocator();
      return units.numberFormat == NumberFormat.none;
    } catch (_) {
      return false;
    }
  }

  /// Formats a double with the given decimal places and locale.
  static String formatNumber(double value,
      [int decimalPlaces = 2, String? locale, NumberFormat? format]) {
    final effectiveLocale = _resolveLocale(locale: locale, format: format);
    final noGrouping = _isNoGrouping(format: format);

    String pattern = noGrouping ? '###0' : '#,##0';

    if (decimalPlaces > 0) {
      pattern += '.${'0' * decimalPlaces}';
    }

    return NumberFormat(pattern, effectiveLocale).format(value);
  }

  /// Formats an integer with thousand separators.
  ///
  /// Example (comma_dot): 59955 → "59,955"
  /// Example (space_comma): 59955 → "59 955"
  static String formatInteger(int value,
      [String? locale, NumberFormat? format]) {
    final effectiveLocale = _resolveLocale(locale: locale, format: format);
    final noGrouping = _isNoGrouping(format: format);

    String pattern = noGrouping ? '###0' : '#,##0';

    return NumberFormat(pattern, effectiveLocale).format(value);
  }

  /// Formats a double with thousand separators and specified decimal places.
  ///
  /// Example (comma_dot): 1234.5 with 1 decimal → "1,234.5"
  /// Example (space_comma): 1234.5 with 1 decimal → "1 234,5"
  static String formatDecimal(double value,
      {int decimalPlaces = 1, String? locale, NumberFormat? format}) {
    return formatNumber(value, decimalPlaces, locale, format);
  }

  /// Returns a placeholder string for unavailable values, using the correct
  /// decimal separator for the current number format.
  ///
  /// Example (comma_dot): formatUnavailableNumber(2) → "--.-"
  /// Example (space_comma): formatUnavailableNumber(2) → "--,-"
  static String formatUnavailableNumber(
      [int decimalPlaces = 2, String? locale, NumberFormat? format]) {
    final effectiveLocale = _resolveLocale(locale: locale, format: format);

    final separator =
        NumberFormat.decimalPattern(effectiveLocale).symbols.DECIMAL_SEP;

    final decimalPart = List.generate(decimalPlaces, (_) => '-').join();

    if (decimalPlaces == 0) {
      return '--';
    }

    return "--$separator$decimalPart";
  }
}
