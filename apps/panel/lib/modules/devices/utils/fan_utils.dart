import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/material.dart';

/// Utility class for fan channel related label conversions and icons.
/// Used by air purifier, fan, and other devices with fan control.
class FanUtils {
  /// Get icon for fan mode.
  static IconData getModeIcon(FanModeValue mode) {
    switch (mode) {
      case FanModeValue.auto:
        return Icons.auto_mode;
      case FanModeValue.manual:
        return Icons.tune;
      case FanModeValue.eco:
        return Icons.eco;
      case FanModeValue.sleep:
        return Icons.bedtime;
      case FanModeValue.natural:
        return Icons.nature;
      case FanModeValue.turbo:
        return Icons.bolt;
    }
  }

  /// Get human-readable label for fan mode.
  static String getModeLabel(AppLocalizations localizations, FanModeValue mode) {
    switch (mode) {
      case FanModeValue.auto:
        return localizations.fan_mode_auto;
      case FanModeValue.manual:
        return localizations.fan_mode_manual;
      case FanModeValue.eco:
        return localizations.fan_mode_eco;
      case FanModeValue.sleep:
        return localizations.fan_mode_sleep;
      case FanModeValue.natural:
        return localizations.fan_mode_natural;
      case FanModeValue.turbo:
        return localizations.fan_mode_turbo;
    }
  }

  /// Get human-readable label for fan speed level.
  static String getSpeedLevelLabel(
    AppLocalizations localizations,
    FanSpeedLevelValue level,
  ) {
    switch (level) {
      case FanSpeedLevelValue.off:
        return localizations.fan_speed_off;
      case FanSpeedLevelValue.low:
        return localizations.fan_speed_low;
      case FanSpeedLevelValue.medium:
        return localizations.fan_speed_medium;
      case FanSpeedLevelValue.high:
        return localizations.fan_speed_high;
      case FanSpeedLevelValue.turbo:
        return localizations.fan_speed_turbo;
      case FanSpeedLevelValue.auto:
        return localizations.fan_speed_auto;
    }
  }

  /// Get human-readable label for fan timer preset.
  static String getTimerPresetLabel(
    AppLocalizations localizations,
    FanTimerPresetValue preset,
  ) {
    switch (preset) {
      case FanTimerPresetValue.off:
        return localizations.fan_timer_off;
      case FanTimerPresetValue.value30m:
        return localizations.fan_timer_30m;
      case FanTimerPresetValue.value1h:
        return localizations.fan_timer_1h;
      case FanTimerPresetValue.value2h:
        return localizations.fan_timer_2h;
      case FanTimerPresetValue.value4h:
        return localizations.fan_timer_4h;
      case FanTimerPresetValue.value8h:
        return localizations.fan_timer_8h;
      case FanTimerPresetValue.value12h:
        return localizations.fan_timer_12h;
    }
  }

  /// Format minutes to human-readable duration string.
  static String formatMinutes(AppLocalizations localizations, int minutes) {
    if (minutes == 0) return localizations.fan_timer_off;
    final hours = minutes ~/ 60;
    final mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return localizations.duration_format_hours_minutes(hours, mins);
    }
    if (hours > 0) return localizations.duration_format_hours(hours);
    return localizations.duration_format_minutes(mins);
  }

  /// Get human-readable label for fan direction.
  static String getDirectionLabel(
    AppLocalizations localizations,
    FanDirectionValue direction,
  ) {
    switch (direction) {
      case FanDirectionValue.clockwise:
        return localizations.fan_direction_clockwise;
      case FanDirectionValue.counterClockwise:
        return localizations.fan_direction_counter_clockwise;
    }
  }
}
