import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

/// Utility class for air quality related calculations and label conversions.
/// Used by air purifier, air quality sensors, and other air monitoring devices.
class AirQualityUtils {
  /// Calculate AQI based on particulate type and density.
  /// Uses EPA breakpoints for PM2.5 and PM10.
  static int calculateAqi(double density, AirParticulateModeValue mode) {
    switch (mode) {
      case AirParticulateModeValue.pm1:
        // PM1 doesn't have official EPA AQI breakpoints
        // Use PM2.5 breakpoints as approximation (PM1 is subset of PM2.5)
        return calculateAqiFromPm25(density);
      case AirParticulateModeValue.pm25:
        return calculateAqiFromPm25(density);
      case AirParticulateModeValue.pm10:
        return calculateAqiFromPm10(density);
    }
  }

  /// Calculate AQI from PM2.5 density using EPA breakpoints.
  static int calculateAqiFromPm25(double pm25) {
    // EPA AQI breakpoints for PM2.5 (µg/m³)
    if (pm25 <= 12.0) return (pm25 / 12.0 * 50).round();
    if (pm25 <= 35.4) return (50 + (pm25 - 12.0) / 23.4 * 50).round();
    if (pm25 <= 55.4) return (100 + (pm25 - 35.4) / 20.0 * 50).round();
    if (pm25 <= 150.4) return (150 + (pm25 - 55.4) / 95.0 * 50).round();
    if (pm25 <= 250.4) return (200 + (pm25 - 150.4) / 100.0 * 100).round();
    return (300 + (pm25 - 250.4) / 150.0 * 100).round().clamp(0, 500);
  }

  /// Calculate AQI from PM10 density using EPA breakpoints.
  static int calculateAqiFromPm10(double pm10) {
    // EPA AQI breakpoints for PM10 (µg/m³)
    if (pm10 <= 54) return (pm10 / 54 * 50).round();
    if (pm10 <= 154) return (50 + (pm10 - 54) / 100 * 50).round();
    if (pm10 <= 254) return (100 + (pm10 - 154) / 100 * 50).round();
    if (pm10 <= 354) return (150 + (pm10 - 254) / 100 * 50).round();
    if (pm10 <= 424) return (200 + (pm10 - 354) / 70 * 100).round();
    return (300 + (pm10 - 424) / 180 * 100).round().clamp(0, 500);
  }

  /// Calculate approximate AQI from air quality level enum.
  static int calculateAqiFromLevel(AirQualityLevelValue? level) {
    if (level == null) return 0;
    switch (level) {
      case AirQualityLevelValue.excellent:
        return 25; // 0-50 range
      case AirQualityLevelValue.good:
        return 40; // 0-50 range
      case AirQualityLevelValue.fair:
        return 75; // 51-100 range
      case AirQualityLevelValue.inferior:
        return 125; // 101-150 range
      case AirQualityLevelValue.poor:
        return 175; // 151-200 range
      case AirQualityLevelValue.unknown:
        return 0;
    }
  }

  /// Get human-readable label for air quality level.
  static String getAirQualityLevelLabel(
    AppLocalizations localizations,
    AirQualityLevelValue? level,
  ) {
    if (level == null) return localizations.air_quality_level_unknown;
    switch (level) {
      case AirQualityLevelValue.excellent:
        return localizations.air_quality_level_excellent;
      case AirQualityLevelValue.good:
        return localizations.air_quality_level_good;
      case AirQualityLevelValue.fair:
        return localizations.air_quality_level_fair;
      case AirQualityLevelValue.inferior:
        return localizations.air_quality_level_inferior;
      case AirQualityLevelValue.poor:
        return localizations.air_quality_level_poor;
      case AirQualityLevelValue.unknown:
        return localizations.air_quality_level_unknown;
    }
  }

  /// Get human-readable label for AQI value.
  static String getAqiLabel(AppLocalizations localizations, int aqi) {
    if (aqi < 50) return localizations.aqi_label_good;
    if (aqi < 100) return localizations.aqi_label_moderate;
    if (aqi < 150) return localizations.aqi_label_unhealthy_sensitive;
    if (aqi < 200) return localizations.aqi_label_unhealthy;
    if (aqi < 300) return localizations.aqi_label_very_unhealthy;
    return localizations.aqi_label_hazardous;
  }

  /// Get label for particulate mode (PM1, PM2.5, PM10).
  static String getParticulateLabel(
    AppLocalizations localizations,
    AirParticulateModeValue mode,
  ) {
    switch (mode) {
      case AirParticulateModeValue.pm1:
        return localizations.particulate_label_pm1;
      case AirParticulateModeValue.pm25:
        return localizations.particulate_label_pm25;
      case AirParticulateModeValue.pm10:
        return localizations.particulate_label_pm10;
    }
  }

  /// Get human-readable label for VOC level.
  static String getVocLevelLabel(
    AppLocalizations localizations,
    VolatileOrganicCompoundsLevelValue? level,
  ) {
    if (level == null) return localizations.air_quality_level_unknown;
    switch (level) {
      case VolatileOrganicCompoundsLevelValue.low:
        return localizations.sensor_enum_voc_level_low_long;
      case VolatileOrganicCompoundsLevelValue.medium:
        return localizations.sensor_enum_voc_level_medium_long;
      case VolatileOrganicCompoundsLevelValue.high:
        return localizations.sensor_enum_voc_level_high_long;
    }
  }

  /// Calculate VOC level label from concentration (µg/m³).
  /// Based on general indoor air quality guidelines.
  static String calculateVocLevelFromConcentration(
    AppLocalizations localizations,
    double concentration,
  ) {
    // Thresholds based on common indoor air quality standards
    // Good: < 300 µg/m³
    // Moderate: 300-500 µg/m³
    // Poor: > 500 µg/m³
    if (concentration < 300) return localizations.sensor_enum_voc_level_low_long;
    if (concentration < 500) return localizations.sensor_enum_voc_level_medium_long;
    return localizations.sensor_enum_voc_level_high_long;
  }

  /// Get human-readable label for ozone level.
  static String getOzoneLevelLabel(
    AppLocalizations localizations,
    OzoneLevelValue? level,
  ) {
    if (level == null) return localizations.air_quality_level_unknown;
    switch (level) {
      case OzoneLevelValue.low:
        return localizations.gas_level_low;
      case OzoneLevelValue.medium:
        return localizations.gas_level_medium;
      case OzoneLevelValue.high:
        return localizations.gas_level_high;
    }
  }

  /// Get human-readable label for sulphur dioxide level.
  static String getSulphurDioxideLevelLabel(
    AppLocalizations localizations,
    SulphurDioxideLevelValue? level,
  ) {
    if (level == null) return localizations.air_quality_level_unknown;
    switch (level) {
      case SulphurDioxideLevelValue.low:
        return localizations.gas_level_low;
      case SulphurDioxideLevelValue.medium:
        return localizations.gas_level_medium;
      case SulphurDioxideLevelValue.high:
        return localizations.gas_level_high;
    }
  }
}
