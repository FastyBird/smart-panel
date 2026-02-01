import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Maps a semantic color to its Light5 background variant for header icons.
Color getSemanticBackgroundColor(BuildContext context, Color semanticColor) {
  final isDark = Theme.of(context).brightness == Brightness.dark;

  if (semanticColor == (isDark ? AppColorsDark.success : AppColorsLight.success)) {
    return isDark ? AppColorsDark.successLight5 : AppColorsLight.successLight5;
  }
  if (semanticColor == (isDark ? AppColorsDark.info : AppColorsLight.info)) {
    return isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5;
  }
  if (semanticColor == (isDark ? AppColorsDark.warning : AppColorsLight.warning)) {
    return isDark ? AppColorsDark.warningLight5 : AppColorsLight.warningLight5;
  }
  if (semanticColor == (isDark ? AppColorsDark.danger : AppColorsLight.danger)) {
    return isDark ? AppColorsDark.dangerLight5 : AppColorsLight.dangerLight5;
  }
  if (semanticColor == (isDark ? AppColorsDark.primary : AppColorsLight.primary)) {
    return isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5;
  }
  // Fallback
  return isDark ? AppFillColorDark.light : AppFillColorLight.light;
}

class ColorUtils {
  /// Convert RGB to Flutter Color
  static Color fromRGB(int red, int green, int blue) {
    return Color.fromARGB(255, red, green, blue);
  }

  /// Convert Hue, Saturation, and Brightness to Flutter Color
  static Color fromHSV(double hue, double saturation, double brightness) {
    final hsvColor = HSVColor.fromAHSV(
      1.0,
      hue,
      saturation / 100,
      brightness / 100,
    );

    return hsvColor.toColor();
  }

  /// Convert a Flutter Color to RGB
  static RgbModel toRGB(Color color) {
    return RgbModel(
      red: color.r.toInt() * 255,
      green: color.g.toInt() * 255,
      blue: color.b.toInt() * 255,
    );
  }

  /// Convert a Flutter Color to HSV
  static HsvModel toHSV(Color color) {
    final HSVColor hsvColor = HSVColor.fromColor(color);

    return HsvModel(
      hue: hsvColor.hue,
      saturation: (hsvColor.saturation * 100).toInt(),
      value: (hsvColor.value * 100).toInt(),
    );
  }
}

class RgbModel {
  final int red;
  final int green;
  final int blue;

  const RgbModel({
    required this.red,
    required this.green,
    required this.blue,
  });
}

class HsvModel {
  final double hue;
  final int saturation;
  final int value;

  const HsvModel({
    required this.hue,
    required this.saturation,
    required this.value,
  });
}
