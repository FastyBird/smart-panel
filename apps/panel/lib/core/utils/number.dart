import 'package:intl/intl.dart';

class NumberUtils {
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
}
