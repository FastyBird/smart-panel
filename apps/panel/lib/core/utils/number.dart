import 'package:fastybird_smart_panel/core/utils/unit_converter.dart';
import 'package:intl/intl.dart';

/// A utility class for formatting numbers with localization support.
///
/// All methods resolve the number format from the system configuration
/// (display override → system default → locale fallback). This ensures
/// consistent formatting across all screens based on the user's preference.
///
/// Number format options:
/// - [NumberFormatSetting.commaDot]: 1,234.56 (US/UK style)
/// - [NumberFormatSetting.dotComma]: 1.234,56 (German style)
/// - [NumberFormatSetting.spaceComma]: 1 234,56 (French/Czech style)
/// - [NumberFormatSetting.none]: 1234.56 (no grouping)
class NumberUtils {
  /// Returns the locale string that corresponds to the given [NumberFormatSetting].
  static String _localeForFormat(NumberFormatSetting format) {
    switch (format) {
      case NumberFormatSetting.commaDot:
        return 'en_US';
      case NumberFormatSetting.dotComma:
        return 'de_DE';
      case NumberFormatSetting.spaceComma:
        return 'fr_FR';
      case NumberFormatSetting.none:
        return 'en_US';
    }
  }

  /// Resolves the effective locale and grouping behavior in a single pass.
  ///
  /// Priority: explicit [format] → explicit [locale] → resolved display units → app locale.
  static ({String locale, bool noGrouping}) _resolveFormatting(
      {String? locale, NumberFormatSetting? format}) {
    if (format != null) {
      return (
        locale: _localeForFormat(format),
        noGrouping: format == NumberFormatSetting.none,
      );
    }

    if (locale != null) {
      return (locale: locale, noGrouping: false);
    }

    try {
      final units = DisplayUnits.fromLocator();
      return (
        locale: _localeForFormat(units.numberFormat),
        noGrouping: units.numberFormat == NumberFormatSetting.none,
      );
    } catch (_) {
      return (locale: Intl.getCurrentLocale(), noGrouping: false);
    }
  }

  /// Formats a double with the given decimal places and locale.
  static String formatNumber(double value,
      [int decimalPlaces = 2, String? locale, NumberFormatSetting? format]) {
    final fmt = _resolveFormatting(locale: locale, format: format);

    String pattern = fmt.noGrouping ? '###0' : '#,##0';

    if (decimalPlaces > 0) {
      pattern += '.${'0' * decimalPlaces}';
    }

    return NumberFormat(pattern, fmt.locale).format(value);
  }

  /// Formats an integer with thousand separators.
  ///
  /// Example (comma_dot): 59955 → "59,955"
  /// Example (space_comma): 59955 → "59 955"
  static String formatInteger(int value,
      [String? locale, NumberFormatSetting? format]) {
    final fmt = _resolveFormatting(locale: locale, format: format);

    String pattern = fmt.noGrouping ? '###0' : '#,##0';

    return NumberFormat(pattern, fmt.locale).format(value);
  }

  /// Formats a double with thousand separators and specified decimal places.
  ///
  /// Example (comma_dot): 1234.5 with 1 decimal → "1,234.5"
  /// Example (space_comma): 1234.5 with 1 decimal → "1 234,5"
  static String formatDecimal(double value,
      {int decimalPlaces = 1, String? locale, NumberFormatSetting? format}) {
    return formatNumber(value, decimalPlaces, locale, format);
  }

  /// Returns a placeholder string for unavailable values, using the correct
  /// decimal separator for the current number format.
  ///
  /// Example (comma_dot): formatUnavailableNumber(2) → "--.-"
  /// Example (space_comma): formatUnavailableNumber(2) → "--,-"
  static String formatUnavailableNumber(
      [int decimalPlaces = 2, String? locale, NumberFormatSetting? format]) {
    final effectiveLocale = _resolveFormatting(locale: locale, format: format).locale;

    final separator =
        NumberFormat.decimalPattern(effectiveLocale).symbols.DECIMAL_SEP;

    final decimalPart = List.generate(decimalPlaces, (_) => '-').join();

    if (decimalPlaces == 0) {
      return '--';
    }

    return "--$separator$decimalPart";
  }
}
