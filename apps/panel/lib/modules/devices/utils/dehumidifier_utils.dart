import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/material.dart';

/// Utility class for dehumidifier channel related label conversions and icons.
class DehumidifierUtils {
  /// Get icon for dehumidifier mode.
  static IconData getModeIcon(DehumidifierModeValue mode) {
    switch (mode) {
      case DehumidifierModeValue.auto:
        return Icons.auto_mode;
      case DehumidifierModeValue.manual:
        return Icons.tune;
      case DehumidifierModeValue.continuous:
        return Icons.all_inclusive;
      case DehumidifierModeValue.laundry:
        return Icons.dry_cleaning;
      case DehumidifierModeValue.quiet:
        return Icons.volume_off;
    }
  }

  /// Get human-readable label for dehumidifier mode.
  static String getModeLabel(
    AppLocalizations localizations,
    DehumidifierModeValue mode,
  ) {
    switch (mode) {
      case DehumidifierModeValue.auto:
        return localizations.dehumidifier_mode_auto;
      case DehumidifierModeValue.manual:
        return localizations.dehumidifier_mode_manual;
      case DehumidifierModeValue.continuous:
        return localizations.dehumidifier_mode_continuous;
      case DehumidifierModeValue.laundry:
        return localizations.dehumidifier_mode_laundry;
      case DehumidifierModeValue.quiet:
        return localizations.dehumidifier_mode_quiet;
    }
  }

  /// Get human-readable label for dehumidifier status.
  static String getStatusLabel(
    AppLocalizations localizations,
    DehumidifierStatusValue status,
  ) {
    switch (status) {
      case DehumidifierStatusValue.idle:
        return localizations.dehumidifier_status_idle;
      case DehumidifierStatusValue.dehumidifying:
        return localizations.dehumidifier_status_dehumidifying;
      case DehumidifierStatusValue.defrosting:
        return localizations.dehumidifier_status_defrosting;
    }
  }

  /// Get human-readable label for dehumidifier timer preset.
  static String getTimerPresetLabel(
    AppLocalizations localizations,
    DehumidifierTimerPresetValue preset,
  ) {
    switch (preset) {
      case DehumidifierTimerPresetValue.off:
        return localizations.dehumidifier_timer_off;
      case DehumidifierTimerPresetValue.value30m:
        return localizations.dehumidifier_timer_30m;
      case DehumidifierTimerPresetValue.value1h:
        return localizations.dehumidifier_timer_1h;
      case DehumidifierTimerPresetValue.value2h:
        return localizations.dehumidifier_timer_2h;
      case DehumidifierTimerPresetValue.value4h:
        return localizations.dehumidifier_timer_4h;
      case DehumidifierTimerPresetValue.value8h:
        return localizations.dehumidifier_timer_8h;
      case DehumidifierTimerPresetValue.value12h:
        return localizations.dehumidifier_timer_12h;
    }
  }

  /// Format seconds to human-readable duration string.
  static String formatSeconds(AppLocalizations localizations, int seconds) {
    if (seconds == 0) return localizations.dehumidifier_timer_off;
    final hours = seconds ~/ 3600;
    final mins = (seconds % 3600) ~/ 60;
    if (hours > 0 && mins > 0) {
      return localizations.duration_format_hours_minutes(hours, mins);
    }
    if (hours > 0) return localizations.duration_format_hours(hours);
    return localizations.duration_format_minutes(mins);
  }
}
