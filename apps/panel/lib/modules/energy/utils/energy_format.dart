import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

/// Adaptive decimal places for energy values so large numbers stay compact.
int energyDecimals(double value) {
  final abs = value.abs();
  if (abs >= 100) return 0;
  if (abs >= 10) return 1;
  return 2;
}

/// Auto-scaled energy value with appropriate unit.
///
/// Converts large kWh values to MWh, GWh, or TWh for readability.
/// Returns a record with formatted value string and unit string.
({String value, String unit}) formatEnergyScaled(double kWh) {
  final abs = kWh.abs();

  if (abs >= 1e9) {
    final scaled = kWh / 1e9;
    return (value: NumberUtils.formatDecimal(scaled, decimalPlaces: energyDecimals(scaled)), unit: 'TWh');
  }
  if (abs >= 1e6) {
    final scaled = kWh / 1e6;
    return (value: NumberUtils.formatDecimal(scaled, decimalPlaces: energyDecimals(scaled)), unit: 'GWh');
  }
  if (abs >= 1e3) {
    final scaled = kWh / 1e3;
    return (value: NumberUtils.formatDecimal(scaled, decimalPlaces: energyDecimals(scaled)), unit: 'MWh');
  }

  return (value: NumberUtils.formatDecimal(kWh, decimalPlaces: energyDecimals(kWh)), unit: 'kWh');
}

/// Returns localized short day name for weekday (1=Monday, 7=Sunday).
String getShortDayName(AppLocalizations l10n, int weekday) {
  return switch (weekday) {
    1 => l10n.day_monday_short,
    2 => l10n.day_tuesday_short,
    3 => l10n.day_wednesday_short,
    4 => l10n.day_thursday_short,
    5 => l10n.day_friday_short,
    6 => l10n.day_saturday_short,
    7 => l10n.day_sunday_short,
    _ => '',
  };
}
