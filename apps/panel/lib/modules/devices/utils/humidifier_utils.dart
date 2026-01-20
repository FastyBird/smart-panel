import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/material.dart';

/// Utility class for humidifier channel related label conversions and icons.
class HumidifierUtils {
  /// Get icon for humidifier mode.
  static IconData getModeIcon(HumidifierModeValue mode) {
    switch (mode) {
      case HumidifierModeValue.auto:
        return Icons.auto_mode;
      case HumidifierModeValue.manual:
        return Icons.tune;
      case HumidifierModeValue.sleep:
        return Icons.bedtime;
      case HumidifierModeValue.baby:
        return Icons.child_care;
    }
  }

  /// Get human-readable label for humidifier mode.
  static String getModeLabel(
    AppLocalizations localizations,
    HumidifierModeValue mode,
  ) {
    switch (mode) {
      case HumidifierModeValue.auto:
        return localizations.humidifier_mode_auto;
      case HumidifierModeValue.manual:
        return localizations.humidifier_mode_manual;
      case HumidifierModeValue.sleep:
        return localizations.humidifier_mode_sleep;
      case HumidifierModeValue.baby:
        return localizations.humidifier_mode_baby;
    }
  }

  /// Get human-readable label for humidifier status.
  static String getStatusLabel(
    AppLocalizations localizations,
    HumidifierStatusValue status,
  ) {
    switch (status) {
      case HumidifierStatusValue.idle:
        return localizations.humidifier_status_idle;
      case HumidifierStatusValue.humidifying:
        return localizations.humidifier_status_humidifying;
    }
  }

  /// Get icon for mist level.
  static IconData getMistLevelIcon(HumidifierMistLevelLevelValue level) {
    switch (level) {
      case HumidifierMistLevelLevelValue.off:
        return Icons.water_drop_outlined;
      case HumidifierMistLevelLevelValue.low:
        return Icons.water_drop;
      case HumidifierMistLevelLevelValue.medium:
        return Icons.water;
      case HumidifierMistLevelLevelValue.high:
        return Icons.waves;
    }
  }

  /// Get human-readable label for mist level.
  static String getMistLevelLabel(
    AppLocalizations localizations,
    HumidifierMistLevelLevelValue level,
  ) {
    switch (level) {
      case HumidifierMistLevelLevelValue.off:
        return localizations.humidifier_mist_level_off;
      case HumidifierMistLevelLevelValue.low:
        return localizations.humidifier_mist_level_low;
      case HumidifierMistLevelLevelValue.medium:
        return localizations.humidifier_mist_level_medium;
      case HumidifierMistLevelLevelValue.high:
        return localizations.humidifier_mist_level_high;
    }
  }

  /// Get human-readable label for humidifier timer preset.
  static String getTimerPresetLabel(
    AppLocalizations localizations,
    HumidifierTimerPresetValue preset,
  ) {
    switch (preset) {
      case HumidifierTimerPresetValue.off:
        return localizations.humidifier_timer_off;
      case HumidifierTimerPresetValue.value30m:
        return localizations.humidifier_timer_30m;
      case HumidifierTimerPresetValue.value1h:
        return localizations.humidifier_timer_1h;
      case HumidifierTimerPresetValue.value2h:
        return localizations.humidifier_timer_2h;
      case HumidifierTimerPresetValue.value4h:
        return localizations.humidifier_timer_4h;
      case HumidifierTimerPresetValue.value8h:
        return localizations.humidifier_timer_8h;
      case HumidifierTimerPresetValue.value12h:
        return localizations.humidifier_timer_12h;
    }
  }

  /// Format seconds to human-readable duration string.
  static String formatSeconds(AppLocalizations localizations, int seconds) {
    if (seconds == 0) return localizations.humidifier_timer_off;
    final hours = seconds ~/ 3600;
    final mins = (seconds % 3600) ~/ 60;
    if (hours > 0 && mins > 0) {
      return localizations.duration_format_hours_minutes(hours, mins);
    }
    if (hours > 0) return localizations.duration_format_hours(hours);
    return localizations.duration_format_minutes(mins);
  }
}
