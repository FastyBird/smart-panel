import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/types/sensor_category.dart';

// ============================================================================
// FRESHNESS ENUM & THRESHOLDS
// ============================================================================

enum SensorFreshness {
  fresh,
  recent,
  stale,
  offline,
}

class FreshnessThresholds {
  final Duration fresh;
  final Duration recent;
  final Duration stale;

  const FreshnessThresholds({
    required this.fresh,
    required this.recent,
    required this.stale,
  });

  /// Environment sensors: temp, humidity, light, airQuality
  static const environment = FreshnessThresholds(
    fresh: Duration(minutes: 5),
    recent: Duration(minutes: 30),
    stale: Duration(hours: 2),
  );

  /// Safety sensors: smoke, gas, leak
  static const safety = FreshnessThresholds(
    fresh: Duration(minutes: 2),
    recent: Duration(minutes: 10),
    stale: Duration(minutes: 30),
  );

  /// Security sensors: motion
  static const security = FreshnessThresholds(
    fresh: Duration(minutes: 1),
    recent: Duration(minutes: 5),
    stale: Duration(minutes: 15),
  );

  /// Energy sensors
  static const energy = FreshnessThresholds(
    fresh: Duration(minutes: 10),
    recent: Duration(hours: 1),
    stale: Duration(hours: 6),
  );

  static FreshnessThresholds forCategory(SensorCategory category) {
    switch (category) {
      case SensorCategory.temperature:
      case SensorCategory.humidity:
      case SensorCategory.light:
      case SensorCategory.airQuality:
        return environment;
      case SensorCategory.safety:
        return safety;
      case SensorCategory.motion:
        return security;
      case SensorCategory.energy:
        return energy;
    }
  }
}

// ============================================================================
// FRESHNESS UTILITIES
// ============================================================================

class SensorFreshnessUtils {
  SensorFreshnessUtils._();

  /// Evaluate data age freshness (fresh/recent/stale).
  /// Does NOT return offline — offline is determined by device connectivity.
  static SensorFreshness evaluate(DateTime? lastUpdated, SensorCategory category) {
    if (lastUpdated == null) return SensorFreshness.stale;

    final age = DateTime.now().difference(lastUpdated);
    final thresholds = FreshnessThresholds.forCategory(category);

    if (age <= thresholds.fresh) return SensorFreshness.fresh;
    if (age <= thresholds.recent) return SensorFreshness.recent;
    return SensorFreshness.stale;
  }

  static Color color(SensorFreshness freshness, bool isDark) {
    switch (freshness) {
      case SensorFreshness.fresh:
        return isDark ? AppColorsDark.success : AppColorsLight.success;
      case SensorFreshness.recent:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case SensorFreshness.stale:
        // Use warning dark variant for an orange-ish tone
        return isDark ? AppColorsDark.warningDark2 : AppColorsLight.warningDark2;
      case SensorFreshness.offline:
        return isDark
            ? AppTextColorDark.placeholder
            : AppTextColorLight.placeholder;
    }
  }

  static String label(SensorFreshness freshness, Duration age, AppLocalizations l) {
    switch (freshness) {
      case SensorFreshness.fresh:
        return l.sensor_freshness_live;
      case SensorFreshness.recent:
        return _formatAge(age, l);
      case SensorFreshness.stale:
        return '${l.sensor_freshness_stale} · ${_formatAge(age, l)}';
      case SensorFreshness.offline:
        return l.sensor_freshness_offline;
    }
  }

  static String _formatAge(Duration age, AppLocalizations l) {
    if (age.inMinutes < 1) return l.time_ago_just_now;
    if (age.inMinutes < 60) return l.time_ago_minutes(age.inMinutes);
    if (age.inHours < 24) return l.time_ago_hours(age.inHours);
    return l.time_ago_days(age.inDays);
  }
}
