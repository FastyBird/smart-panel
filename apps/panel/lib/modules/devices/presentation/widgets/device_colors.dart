import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

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

/// Standardized sensor colors for consistent UI across all sensor displays
class SensorColors {
  /// Get color for a sensor based on its type
  static Color forType(String type, bool isDark) {
    switch (type) {
      case SensorType.temperature:
        return isDark ? AppColorsDark.info : AppColorsLight.info;
      case SensorType.humidity:
        return isDark ? AppColorsDark.success : AppColorsLight.success;
      case SensorType.aqi:
      case SensorType.pm:
      case SensorType.voc:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case SensorType.co2:
        return isDark ? AppColorsDark.error : AppColorsLight.error;
      case SensorType.pressure:
        return isDark ? AppColorsDark.info : AppColorsLight.info;
      case SensorType.contact:
      case SensorType.leak:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case SensorType.filter:
        return isDark ? AppColorsDark.teal : AppColorsLight.teal;
      default:
        return isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    }
  }

  /// Temperature sensor color (info/blue)
  static Color temperature(bool isDark) =>
      isDark ? AppColorsDark.info : AppColorsLight.info;

  /// Humidity sensor color (success/green)
  static Color humidity(bool isDark) =>
      isDark ? AppColorsDark.success : AppColorsLight.success;

  /// Air quality sensor color (warning/orange) - for AQI, PM, VOC
  static Color airQuality(bool isDark) =>
      isDark ? AppColorsDark.warning : AppColorsLight.warning;

  /// CO2 sensor color (error/red)
  static Color co2(bool isDark) =>
      isDark ? AppColorsDark.error : AppColorsLight.error;

  /// Pressure sensor color (info/blue)
  static Color pressure(bool isDark) =>
      isDark ? AppColorsDark.info : AppColorsLight.info;

  /// Contact/leak sensor color (warning/orange)
  static Color alert(bool isDark) =>
      isDark ? AppColorsDark.warning : AppColorsLight.warning;

  /// Filter sensor color (teal)
  static Color filter(bool isDark) =>
      isDark ? AppColorsDark.teal : AppColorsLight.teal;

  /// Default/fallback sensor color (secondary text)
  static Color defaultColor(bool isDark) =>
      isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
}

/// Device-specific colors helper using app theme colors
class DeviceColors {
  /// Humidity color (teal) for humidifier/dehumidifier devices
  static Color humidity(bool isDark) =>
      isDark ? AppColorsDark.teal : AppColorsLight.teal;

  static Color humidityLight9(bool isDark) =>
      isDark ? AppColorsDark.tealLight9 : AppColorsLight.tealLight9;

  static Color humidityLight7(bool isDark) =>
      isDark ? AppColorsDark.tealLight7 : AppColorsLight.tealLight7;

  static Color humidityLight5(bool isDark) =>
      isDark ? AppColorsDark.tealLight5 : AppColorsLight.tealLight5;

  /// Air color (success/green) for air purifier devices
  static Color air(bool isDark) =>
      isDark ? AppColorsDark.success : AppColorsLight.success;

  static Color airLight9(bool isDark) =>
      isDark ? AppColorsDark.successLight9 : AppColorsLight.successLight9;

  static Color airLight7(bool isDark) =>
      isDark ? AppColorsDark.successLight7 : AppColorsLight.successLight7;

  static Color airLight5(bool isDark) =>
      isDark ? AppColorsDark.successLight5 : AppColorsLight.successLight5;

  /// Fan color (info/blue) for fan devices
  static Color fan(bool isDark) =>
      isDark ? AppColorsDark.info : AppColorsLight.info;

  static Color fanLight9(bool isDark) =>
      isDark ? AppColorsDark.infoLight9 : AppColorsLight.infoLight9;

  static Color fanLight7(bool isDark) =>
      isDark ? AppColorsDark.infoLight7 : AppColorsLight.infoLight7;

  static Color fanLight5(bool isDark) =>
      isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5;

  /// Heating color (primary/red-orange) for heater devices
  static Color heating(bool isDark) =>
      isDark ? AppColorsDark.primary : AppColorsLight.primary;

  static Color heatingLight9(bool isDark) =>
      isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;

  static Color heatingLight7(bool isDark) =>
      isDark ? AppColorsDark.primaryLight7 : AppColorsLight.primaryLight7;

  static Color heatingLight5(bool isDark) =>
      isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5;

  /// Cooling color (flutter/blue-purple) for A/C and cooler devices
  static Color cooling(bool isDark) =>
      isDark ? AppColorsDark.flutter : AppColorsLight.flutter;

  static Color coolingLight9(bool isDark) =>
      isDark ? AppColorsDark.flutterLight9 : AppColorsLight.flutterLight9;

  static Color coolingLight7(bool isDark) =>
      isDark ? AppColorsDark.flutterLight7 : AppColorsLight.flutterLight7;

  static Color coolingLight5(bool isDark) =>
      isDark ? AppColorsDark.flutterLight5 : AppColorsLight.flutterLight5;
}
