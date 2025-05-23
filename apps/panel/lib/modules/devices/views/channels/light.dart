import 'dart:math';
import 'dart:ui';

import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/core/utils/color.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/brightness.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_blue.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_green.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_red.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_white.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/hue.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/saturation.dart';

class LightChannelView extends ChannelView
    with ChannelOnMixin, ChannelBrightnessMixin {
  LightChannelView({
    required super.channelModel,
    required super.properties,
  });

  @override
  OnChannelPropertyView get onProp =>
      properties.whereType<OnChannelPropertyView>().first;

  @override
  BrightnessChannelPropertyView? get brightnessProp =>
      properties.whereType<BrightnessChannelPropertyView>().firstOrNull;

  ColorRedChannelPropertyView? get colorRedProp =>
      properties.whereType<ColorRedChannelPropertyView>().firstOrNull;

  ColorGreenChannelPropertyView? get colorGreenProp =>
      properties.whereType<ColorGreenChannelPropertyView>().firstOrNull;

  ColorBlueChannelPropertyView? get colorBlueProp =>
      properties.whereType<ColorBlueChannelPropertyView>().firstOrNull;

  ColorWhiteChannelPropertyView? get colorWhiteProp =>
      properties.whereType<ColorWhiteChannelPropertyView>().firstOrNull;

  ColorTemperatureChannelPropertyView? get temperatureProp =>
      properties.whereType<ColorTemperatureChannelPropertyView>().firstOrNull;

  HueChannelPropertyView? get hueProp =>
      properties.whereType<HueChannelPropertyView>().firstOrNull;

  SaturationChannelPropertyView? get saturationProp =>
      properties.whereType<SaturationChannelPropertyView>().firstOrNull;

  Color get temperature {
    final tempProp = temperatureProp;

    if (tempProp != null) {
      final ValueType? temperatureValue = tempProp.value;

      int kelvin = temperatureValue is NumberValueType
          ? temperatureValue.value.toInt()
          : 0;

      kelvin = kelvin.clamp(1000, 40000);

      // Convert Kelvin to RGB
      double temperature = kelvin / 100.0;

      double red;
      double green;
      double blue;

      // Calculate Red
      if (temperature <= 66.0) {
        red = 255;
      } else {
        red = temperature - 60.0;
        red = 329.698727446 * pow(red, -0.1332047592);
        red = red.clamp(0, 255);
      }

      // Calculate Green
      if (temperature <= 66.0) {
        green = temperature;
        green = 99.4708025861 * log(green) - 161.1195681661;
        green = green.clamp(0, 255);
      } else {
        green = temperature - 60.0;
        green = 288.1221695283 * pow(green, -0.0755148492);
        green = green.clamp(0, 255);
      }

      // Calculate Blue
      if (temperature >= 66.0) {
        blue = 255;
      } else if (temperature <= 19.0) {
        blue = 0;
      } else {
        blue = temperature - 10.0;
        blue = 138.5177312231 * log(blue) - 305.0447927307;
        blue = blue.clamp(0, 255);
      }

      return Color.fromARGB(255, red.toInt(), green.toInt(), blue.toInt());
    }

    throw Exception('The light channel has not valid temperature properties');
  }

  Color get color {
    final red = colorRedProp;
    final green = colorGreenProp;
    final blue = colorBlueProp;

    final hue = hueProp;
    final saturation = saturationProp;
    final brightness = brightnessProp;

    if (red != null && green != null && blue != null) {
      final ValueType? redValue = red.value;

      int redColor = redValue is NumberValueType ? redValue.value.toInt() : 0;

      final ValueType? greenValue = green.value;

      int greenColor =
          greenValue is NumberValueType ? greenValue.value.toInt() : 0;

      final ValueType? blueValue = blue.value;

      int blueColor =
          blueValue is NumberValueType ? blueValue.value.toInt() : 0;

      return ColorUtils.fromRGB(
        redColor,
        greenColor,
        blueColor,
      );
    } else if (hue != null && saturation != null) {
      final ValueType? hueValue = hue.value;

      double hueLevel =
          hueValue is NumberValueType ? hueValue.value.toDouble() : 0.0;

      final ValueType? saturationValue = saturation.value;

      double saturationLevel = saturationValue is NumberValueType
          ? saturationValue.value.toDouble()
          : 0.0;

      final ValueType? brightnessValue = brightness?.value;

      double brightnessLevel = brightnessValue is NumberValueType
          ? brightnessValue.value.toDouble()
          : 0;

      return ColorUtils.fromHSV(
        hueLevel,
        saturationLevel,
        brightnessLevel,
      );
    }

    throw Exception('The light channel has not valid color properties');
  }

  bool get hasColor => properties.any(
        (property) => [
          ChannelPropertyCategory.colorRed,
          ChannelPropertyCategory.colorGreen,
          ChannelPropertyCategory.colorBlue,
          ChannelPropertyCategory.hue,
          ChannelPropertyCategory.saturation,
        ].contains(property.category),
      );

  bool get hasColorWhite => colorWhiteProp != null;

  int get colorWhite {
    final ColorWhiteChannelPropertyView? prop = colorWhiteProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    return 0;
  }

  int get minColorWhite {
    final FormatType? format = colorWhiteProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxColorWhite {
    final FormatType? format = colorWhiteProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 255;
  }

  bool get hasColorRed => colorRedProp != null;

  int get colorRed {
    final ColorRedChannelPropertyView? prop = colorRedProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    return 0;
  }

  int get minColorRed {
    final FormatType? format = colorRedProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxColorRed {
    final FormatType? format = colorRedProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 255;
  }

  bool get hasColorGreen => colorGreenProp != null;

  int get colorGreen {
    final ColorGreenChannelPropertyView? prop = colorGreenProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    return 0;
  }

  int get minColorGreen {
    final FormatType? format = colorGreenProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxColorGreen {
    final FormatType? format = colorGreenProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 255;
  }

  bool get hasColorBlue => colorBlueProp != null;

  int get colorBlue {
    final ColorBlueChannelPropertyView? prop = colorBlueProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    return 0;
  }

  int get minColorBlue {
    final FormatType? format = colorBlueProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxColorBlue {
    final FormatType? format = colorBlueProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 255;
  }

  bool get hasHue => hueProp != null;

  double get hue {
    final HueChannelPropertyView? prop = hueProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toDouble();
    }

    return 0.0;
  }

  double get minHue {
    final FormatType? format = hueProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toDouble();
    }

    return 0.0;
  }

  double get maxHue {
    final FormatType? format = hueProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toDouble();
    }

    return 1.0;
  }

  bool get hasSaturation => saturationProp != null;

  int get saturation {
    final SaturationChannelPropertyView? prop = saturationProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    return 0;
  }

  int get minSaturation {
    final FormatType? format = saturationProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxSaturation {
    final FormatType? format = saturationProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 100;
  }

  bool get hasTemperature => properties.any(
        (property) => [
          ChannelPropertyCategory.colorTemperature,
        ].contains(property.category),
      );
}
