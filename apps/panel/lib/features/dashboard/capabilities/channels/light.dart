import 'dart:math';
import 'dart:ui';

import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/core/utils/color.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class LightChannelCapability extends Capability
    with ChannelOnMixin, ChannelBrightnessMixin {
  LightChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel get onProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.on,
      );

  @override
  ChannelPropertyModel? get brightnessProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.brightness,
      );

  ChannelPropertyModel? get colorRedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.colorRed,
      );

  ChannelPropertyModel? get colorGreenProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.colorGreen,
      );

  ChannelPropertyModel? get colorBlueProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.colorBlue,
      );

  ChannelPropertyModel? get colorWhiteProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.colorWhite,
      );

  ChannelPropertyModel? get temperatureProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.colorTemperature,
      );

  ChannelPropertyModel? get hueProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.hue,
      );

  ChannelPropertyModel? get saturationProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.saturation,
      );

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
          PropertyCategory.colorRed,
          PropertyCategory.colorGreen,
          PropertyCategory.colorBlue,
          PropertyCategory.hue,
          PropertyCategory.saturation,
        ].contains(property.category),
      );

  bool get hasColorWhite => colorWhiteProp != null;

  int get colorWhite {
    final ChannelPropertyModel? prop = colorWhiteProp;

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
    final ChannelPropertyModel? prop = colorRedProp;

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
    final ChannelPropertyModel? prop = colorGreenProp;

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
    final ChannelPropertyModel? prop = colorBlueProp;

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
    final ChannelPropertyModel? prop = hueProp;

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
    final ChannelPropertyModel? prop = saturationProp;

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
          PropertyCategory.colorTemperature,
        ].contains(property.category),
      );
}
