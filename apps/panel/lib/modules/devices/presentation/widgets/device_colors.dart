import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

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
