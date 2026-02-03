import 'package:fastybird_smart_panel/core/utils/theme.dart';

/// Sensor type identifiers for color mapping
class SensorType {
  static const String temperature = 'temp';
  static const String humidity = 'humidity';
  static const String aqi = 'aqi';
  static const String pm = 'pm';
  static const String voc = 'voc';
  static const String co2 = 'co2';
  static const String pressure = 'pressure';
  static const String contact = 'contact';
  static const String leak = 'leak';
  static const String filter = 'filter';
}

/// Standardized sensor colors for consistent UI across all sensor displays.
/// Returns [ThemeColors]; resolve to [Color] via [ThemeColorFamily.get](brightness, color).base where needed.
class SensorColors {
  /// Theme color key for a sensor type. Use for tile [activeColor] or [iconAccentColor].
  /// Returns [ThemeColors.neutral] for unknown types.
  static ThemeColors themeColorForType(String type) {
    switch (type) {
      case SensorType.temperature:
      case SensorType.pressure:
        return ThemeColors.info;
      case SensorType.humidity:
        return ThemeColors.success;
      case SensorType.aqi:
      case SensorType.pm:
      case SensorType.voc:
      case SensorType.contact:
      case SensorType.leak:
        return ThemeColors.warning;
      case SensorType.co2:
        return ThemeColors.error;
      case SensorType.filter:
        return ThemeColors.teal;
      default:
        return ThemeColors.neutral;
    }
  }

  /// Alias for [themeColorForType].
  static ThemeColors forType(String type) => themeColorForType(type);

  /// Temperature sensor (info/blue)
  static ThemeColors get temperature => ThemeColors.info;

  /// Humidity sensor (success/green)
  static ThemeColors get humidity => ThemeColors.success;

  /// Air quality (warning/orange) - AQI, PM, VOC
  static ThemeColors get airQuality => ThemeColors.warning;

  /// CO2 sensor (error/red)
  static ThemeColors get co2 => ThemeColors.error;

  /// Pressure sensor (info/blue)
  static ThemeColors get pressure => ThemeColors.info;

  /// Contact/leak sensor (warning/orange)
  static ThemeColors get alert => ThemeColors.warning;

  /// Filter sensor (teal)
  static ThemeColors get filter => ThemeColors.teal;

  /// Fallback for unknown sensor types
  static ThemeColors get defaultColor => ThemeColors.neutral;
}
