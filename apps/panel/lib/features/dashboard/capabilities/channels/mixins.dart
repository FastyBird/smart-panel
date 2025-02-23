import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

mixin ChannelActiveMixin {
  ChannelPropertyModel? get activeProp;

  bool get hasActive => activeProp != null;

  bool get isActive {
    final ChannelPropertyModel? prop = activeProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    return false;
  }
}

mixin ChannelBrightnessMixin {
  ChannelPropertyModel? get brightnessProp;

  bool get hasBrightness => brightnessProp != null;

  int get brightness {
    final ChannelPropertyModel? prop = brightnessProp;

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

  int get minBrightness {
    final FormatType? format = brightnessProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxBrightness {
    final FormatType? format = brightnessProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 100;
  }
}

mixin ChannelDensityMixin {
  ChannelPropertyModel? get densityProp;

  bool get hasDensity => densityProp != null;

  double get density {
    final ChannelPropertyModel? prop = densityProp;

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

  double get minDensity {
    final FormatType? format = densityProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toDouble();
    }

    return 0.0;
  }

  double get maxDensity {
    final FormatType? format = densityProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toDouble();
    }

    return 100.0;
  }
}

mixin ChannelDetectedMixin {
  ChannelPropertyModel? get detectedProp;

  bool get hasDetected => detectedProp != null;

  bool get detected {
    final ChannelPropertyModel? prop = detectedProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    return false;
  }
}

mixin ChannelDistanceMixin {
  ChannelPropertyModel? get distanceProp;

  bool get hasDistance => distanceProp != null;

  double get distance {
    final ChannelPropertyModel? prop = distanceProp;

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

  double get minDistance {
    final FormatType? format = distanceProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toDouble();
    }

    return 0.0;
  }

  double get maxDistance {
    final FormatType? format = distanceProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toDouble();
    }

    return 100.0;
  }
}

mixin ChannelFaultMixin {
  ChannelPropertyModel? get faultProp;

  bool get hasFault {
    final ChannelPropertyModel? prop = faultProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value > 0;
    }

    return false;
  }

  num? get faultCode {
    final ChannelPropertyModel? prop = faultProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value;
    }

    return null;
  }
}

mixin ChannelMeasuredMixin {
  ChannelPropertyModel? get measuredProp;

  bool get hasMeasured => measuredProp != null;

  double get measured {
    final ChannelPropertyModel? prop = measuredProp;

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

  double get minMeasured {
    final FormatType? format = measuredProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toDouble();
    }

    return 0.0;
  }

  double get maxMeasured {
    final FormatType? format = measuredProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toDouble();
    }

    return 100.0;
  }
}

mixin ChannelOnMixin {
  ChannelPropertyModel? get onProp;

  bool get hasOn => onProp != null;

  bool get on {
    final ChannelPropertyModel? prop = onProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    return false;
  }
}

mixin ChannelPercentageMixin {
  ChannelPropertyModel? get percentageProp;

  bool get hasPercentage => percentageProp != null;

  int get percentage {
    final ChannelPropertyModel? prop = percentageProp;

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

  int get minPercentage {
    final FormatType? format = percentageProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxPercentage {
    final FormatType? format = percentageProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 100;
  }
}

mixin ChannelObstructionMixin {
  ChannelPropertyModel? get obstructionProp;

  bool get hasObstruction => obstructionProp != null;

  bool get obstruction {
    final ChannelPropertyModel? prop = obstructionProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    return false;
  }
}

mixin ChannelPeakLevelMixin {
  ChannelPropertyModel? get peakLevelProp;

  bool get hasPeakLevel => peakLevelProp != null;

  double get peakLevel {
    final ChannelPropertyModel? prop = peakLevelProp;

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

  double get minPeakLevel {
    final FormatType? format = peakLevelProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toDouble();
    }

    return 0.0;
  }

  double get maxPeakLevel {
    final FormatType? format = peakLevelProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toDouble();
    }

    return 100.0;
  }
}

mixin ChannelTamperedMixin {
  ChannelPropertyModel? get tamperedProp;

  bool get hasTampered => tamperedProp != null;

  bool get isTampered {
    final ChannelPropertyModel? prop = tamperedProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    return false;
  }
}

mixin ChannelTemperatureMixin {
  ChannelPropertyModel? get temperatureProp;

  bool get hasTemperature => temperatureProp != null;

  double get temperature {
    final ChannelPropertyModel? prop = temperatureProp;

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

  double get minTemperature {
    final FormatType? format = temperatureProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toDouble();
    }

    return 0.0;
  }

  double get maxTemperature {
    final FormatType? format = temperatureProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toDouble();
    }

    return 100.0;
  }
}

mixin ChannelTiltMixin {
  ChannelPropertyModel? get tiltProp;

  bool get hasTilt => tiltProp != null;

  int get tilt {
    final ChannelPropertyModel? prop = tiltProp;

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

  int get minTilt {
    final FormatType? format = tiltProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return -90;
  }

  int get maxTilt {
    final FormatType? format = tiltProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 90;
  }
}

mixin ChannelVolumeMixin {
  ChannelPropertyModel? get volumeProp;

  bool get hasVolume => volumeProp != null;

  int get volume {
    final ChannelPropertyModel? prop = volumeProp;

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

  int get minVolume {
    final FormatType? format = volumeProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxVolume {
    final FormatType? format = volumeProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 100;
  }
}
