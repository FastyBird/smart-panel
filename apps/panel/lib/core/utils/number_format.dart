/// Number formatting utility for consistent display across the app.
///
/// Supports different locale formats:
/// - European (default): 1 234,56 (space for thousands, comma for decimal)
/// - US: 1,234.56 (comma for thousands, dot for decimal)
class NumberFormatUtils {
  /// Thousand separator character
  final String thousandSeparator;

  /// Decimal separator character
  final String decimalSeparator;

  const NumberFormatUtils({
    this.thousandSeparator = ' ',
    this.decimalSeparator = ',',
  });

  /// European format: 1 234,56 (space for thousands, comma for decimal)
  static const NumberFormatUtils european = NumberFormatUtils(
    thousandSeparator: ' ',
    decimalSeparator: ',',
  );

  /// US format: 1,234.56
  static const NumberFormatUtils us = NumberFormatUtils(
    thousandSeparator: ',',
    decimalSeparator: '.',
  );

  /// Default format (European)
  static const NumberFormatUtils defaultFormat = european;

  /// Format an integer with thousand separators.
  ///
  /// Example (European): 59955 -> "59.955"
  /// Example (US): 59955 -> "59,955"
  String formatInteger(int value) {
    final isNegative = value < 0;
    final absValue = value.abs().toString();

    if (absValue.length <= 3) {
      return isNegative ? '-$absValue' : absValue;
    }

    final buffer = StringBuffer();
    var count = 0;

    for (var i = absValue.length - 1; i >= 0; i--) {
      if (count > 0 && count % 3 == 0) {
        buffer.write(thousandSeparator);
      }
      buffer.write(absValue[i]);
      count++;
    }

    final result = buffer.toString().split('').reversed.join();
    return isNegative ? '-$result' : result;
  }

  /// Format a double with thousand separators and specified decimal places.
  ///
  /// Example (European): 1234.5 with 1 decimal -> "1.234,5"
  /// Example (US): 1234.5 with 1 decimal -> "1,234.5"
  String formatDecimal(double value, {int decimalPlaces = 1}) {
    final isNegative = value < 0;
    final absValue = value.abs();

    // Round to specified decimal places
    final multiplier = _pow10(decimalPlaces);
    final rounded = (absValue * multiplier).round() / multiplier;

    // Split into integer and decimal parts
    final parts = rounded.toStringAsFixed(decimalPlaces).split('.');
    final integerPart = int.parse(parts[0]);
    final decimalPart = parts.length > 1 ? parts[1] : '';

    // Format integer part with thousand separators
    final formattedInteger = formatInteger(integerPart).replaceFirst('-', '');

    // Combine with decimal part
    final result = decimalPlaces > 0
        ? '$formattedInteger$decimalSeparator$decimalPart'
        : formattedInteger;

    return isNegative ? '-$result' : result;
  }

  /// Format a number (int or double) with automatic type detection.
  ///
  /// For integers: formats with thousand separators only.
  /// For doubles: formats with thousand separators and specified decimal places.
  String format(num value, {int decimalPlaces = 0}) {
    if (value is int || decimalPlaces == 0) {
      return formatInteger(value.toInt());
    }
    return formatDecimal(value.toDouble(), decimalPlaces: decimalPlaces);
  }

  /// Helper to calculate 10^n without using dart:math
  int _pow10(int n) {
    var result = 1;
    for (var i = 0; i < n; i++) {
      result *= 10;
    }
    return result;
  }
}
