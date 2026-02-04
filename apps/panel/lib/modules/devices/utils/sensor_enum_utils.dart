import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

/// Translates sensor enum string values to localized labels.
///
/// Use [short] = true for compact tile display, false for detail/long display.
/// Returns null if no translation is found (caller should fall back to raw value).
class SensorEnumUtils {
  SensorEnumUtils._();

  static String? translate(
    AppLocalizations l,
    String channelCategory,
    String propertyCategory,
    String value, {
    bool short = true,
  }) {
    final ch = channelCategory.toLowerCase();
    final prop = propertyCategory.toLowerCase();
    final v = value.toLowerCase();

    // Air quality level
    if (ch == 'air_quality' && prop == 'level') {
      return _airQualityLevel(l, v);
    }

    // VOC level
    if (ch == 'volatile_organic_compounds' && prop == 'level') {
      return _vocLevel(l, v);
    }

    // Gas-like levels (ozone, sulphur_dioxide, nitrogen_dioxide, gas)
    if ((ch == 'ozone' || ch == 'sulphur_dioxide' || ch == 'nitrogen_dioxide') && prop == 'level') {
      return _gasLevel(l, v);
    }

    // Gas status
    if (ch == 'gas' && prop == 'status') {
      return _gasStatus(l, v, short: short);
    }

    // Gas level
    if (ch == 'gas' && prop == 'level') {
      return _gasLevel(l, v);
    }

    // Illuminance level
    if (ch == 'illuminance' && prop == 'level') {
      return _illuminanceLevel(l, v, short: short);
    }

    // Leak level
    if (ch == 'leak' && prop == 'level') {
      return _leakLevel(l, v, short: short);
    }

    // Battery percentage level
    if (ch == 'battery_percentage' && prop == 'level') {
      return _batteryLevel(l, v, short: short);
    }

    // Battery status
    if (ch == 'battery' && prop == 'status') {
      return _batteryStatus(l, v, short: short);
    }

    return null;
  }

  /// Translate primary sensor value using channel category only.
  /// For primary readings where propertyCategory is not available,
  /// we infer it from the channel category.
  static String? translatePrimary(
    AppLocalizations l,
    String channelCategory,
    String value, {
    bool short = true,
  }) {
    final ch = channelCategory.toLowerCase();

    // Map channel category to its typical primary property category
    switch (ch) {
      case 'air_quality':
        return translate(l, ch, 'level', value, short: short);
      case 'volatile_organic_compounds':
        return translate(l, ch, 'level', value, short: short);
      case 'ozone':
      case 'sulphur_dioxide':
      case 'nitrogen_dioxide':
        return translate(l, ch, 'level', value, short: short);
      case 'gas':
        // Primary for gas is typically status
        return translate(l, ch, 'status', value, short: short)
            ?? translate(l, ch, 'level', value, short: short);
      case 'illuminance':
        return translate(l, ch, 'level', value, short: short);
      case 'leak':
        return translate(l, ch, 'level', value, short: short);
      case 'battery_percentage':
        return translate(l, ch, 'level', value, short: short);
      case 'battery':
        return translate(l, ch, 'status', value, short: short);
      default:
        return null;
    }
  }

  static String? _airQualityLevel(AppLocalizations l, String v) {
    switch (v) {
      case 'excellent':
        return l.air_quality_level_excellent;
      case 'good':
        return l.air_quality_level_good;
      case 'fair':
        return l.air_quality_level_fair;
      case 'inferior':
        return l.air_quality_level_inferior;
      case 'poor':
        return l.air_quality_level_poor;
      case 'unknown':
        return l.air_quality_level_unknown;
      default:
        return null;
    }
  }

  static String? _vocLevel(AppLocalizations l, String v) {
    switch (v) {
      case 'good':
        return l.voc_level_good;
      case 'moderate':
        return l.voc_level_moderate;
      case 'poor':
        return l.voc_level_poor;
      default:
        return null;
    }
  }

  static String? _gasLevel(AppLocalizations l, String v) {
    switch (v) {
      case 'low':
        return l.gas_level_low;
      case 'medium':
        return l.gas_level_medium;
      case 'high':
        return l.gas_level_high;
      default:
        return null;
    }
  }

  static String? _gasStatus(AppLocalizations l, String v, {required bool short}) {
    switch (v) {
      case 'normal':
        return short ? l.sensor_enum_gas_status_normal : l.sensor_enum_gas_status_normal_long;
      case 'testing':
        return short ? l.sensor_enum_gas_status_testing : l.sensor_enum_gas_status_testing_long;
      case 'detected':
        return short ? l.sensor_enum_gas_status_detected : l.sensor_enum_gas_status_detected_long;
      default:
        return null;
    }
  }

  static String? _illuminanceLevel(AppLocalizations l, String v, {required bool short}) {
    switch (v) {
      case 'dark':
        return short ? l.sensor_enum_illuminance_dark : l.sensor_enum_illuminance_dark_long;
      case 'dim':
        return short ? l.sensor_enum_illuminance_dim : l.sensor_enum_illuminance_dim_long;
      case 'light':
        return short ? l.sensor_enum_illuminance_light : l.sensor_enum_illuminance_light_long;
      case 'bright':
        return short ? l.sensor_enum_illuminance_bright : l.sensor_enum_illuminance_bright_long;
      default:
        return null;
    }
  }

  static String? _leakLevel(AppLocalizations l, String v, {required bool short}) {
    switch (v) {
      case 'none':
        return short ? l.sensor_enum_leak_none : l.sensor_enum_leak_none_long;
      case 'detected':
        return short ? l.sensor_enum_leak_detected : l.sensor_enum_leak_detected_long;
      default:
        return null;
    }
  }

  static String? _batteryLevel(AppLocalizations l, String v, {required bool short}) {
    switch (v) {
      case 'normal':
        return short ? l.sensor_enum_battery_level_normal : l.sensor_enum_battery_level_normal_long;
      case 'low':
        return short ? l.sensor_enum_battery_level_low : l.sensor_enum_battery_level_low_long;
      default:
        return null;
    }
  }

  static String? _batteryStatus(AppLocalizations l, String v, {required bool short}) {
    switch (v) {
      case 'normal':
        return short ? l.sensor_enum_battery_status_normal : l.sensor_enum_battery_status_normal_long;
      case 'charging':
        return short ? l.sensor_enum_battery_status_charging : l.sensor_enum_battery_status_charging_long;
      case 'not_charging':
        return short ? l.sensor_enum_battery_status_not_charging : l.sensor_enum_battery_status_not_charging_long;
      case 'not_chargeable':
        return short ? l.sensor_enum_battery_status_not_chargeable : l.sensor_enum_battery_status_not_chargeable_long;
      default:
        return null;
    }
  }
}
