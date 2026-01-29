import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/sensors_domain_view.dart';

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

  static SensorFreshness evaluate(DateTime? lastUpdated, SensorCategory category) {
    if (lastUpdated == null) return SensorFreshness.offline;

    final age = DateTime.now().difference(lastUpdated);
    final thresholds = FreshnessThresholds.forCategory(category);

    if (age <= thresholds.fresh) return SensorFreshness.fresh;
    if (age <= thresholds.recent) return SensorFreshness.recent;
    if (age <= thresholds.stale) return SensorFreshness.stale;
    return SensorFreshness.offline;
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

  static String label(SensorFreshness freshness, Duration age) {
    switch (freshness) {
      case SensorFreshness.fresh:
        return 'Live';
      case SensorFreshness.recent:
        return _formatAge(age);
      case SensorFreshness.stale:
        return 'Stale · ${_formatAge(age)}';
      case SensorFreshness.offline:
        return 'Offline';
    }
  }

  static String _formatAge(Duration age) {
    if (age.inMinutes < 1) return 'just now';
    if (age.inMinutes < 60) return '${age.inMinutes} min ago';
    if (age.inHours < 24) return '${age.inHours}h ago';
    return '${age.inDays}d ago';
  }
}
