import 'package:flutter/material.dart';

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
      red: color.red,
      green: color.green,
      blue: color.blue,
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
