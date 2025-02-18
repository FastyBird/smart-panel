import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

mixin ChannelActiveMixin {
  ChannelPropertyDataModel? get activeProp;

  bool get hasActive => activeProp != null;

  bool get isActive {
    final ChannelPropertyDataModel? prop = activeProp;

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
  ChannelPropertyDataModel? get brightnessProp;

  bool get hasBrightness => brightnessProp != null;

  int get brightness {
    final ChannelPropertyDataModel? prop = brightnessProp;

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
  ChannelPropertyDataModel? get densityProp;

  bool get hasDensity => densityProp != null;

  double get density {
    final ChannelPropertyDataModel? prop = densityProp;

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
  ChannelPropertyDataModel? get detectedProp;

  bool get hasDetected => detectedProp != null;

  bool get detected {
    final ChannelPropertyDataModel? prop = detectedProp;

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
  ChannelPropertyDataModel? get distanceProp;

  bool get hasDistance => distanceProp != null;

  double get distance {
    final ChannelPropertyDataModel? prop = distanceProp;

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
  ChannelPropertyDataModel? get faultProp;

  bool get hasFault {
    final ChannelPropertyDataModel? prop = faultProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value > 0;
    }

    return false;
  }

  num? get faultCode {
    final ChannelPropertyDataModel? prop = faultProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value;
    }

    return null;
  }
}

mixin ChannelMeasuredMixin {
  ChannelPropertyDataModel? get measuredProp;

  bool get hasMeasured => measuredProp != null;

  double get measured {
    final ChannelPropertyDataModel? prop = measuredProp;

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
  ChannelPropertyDataModel? get onProp;

  bool get hasOn => onProp != null;

  bool get on {
    final ChannelPropertyDataModel? prop = onProp;

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
  ChannelPropertyDataModel? get percentageProp;

  bool get hasPercentage => percentageProp != null;

  int get percentage {
    final ChannelPropertyDataModel? prop = percentageProp;

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
  ChannelPropertyDataModel? get obstructionProp;

  bool get hasObstruction => obstructionProp != null;

  bool get obstruction {
    final ChannelPropertyDataModel? prop = obstructionProp;

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
  ChannelPropertyDataModel? get peakLevelProp;

  bool get hasPeakLevel => peakLevelProp != null;

  double get peakLevel {
    final ChannelPropertyDataModel? prop = peakLevelProp;

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
  ChannelPropertyDataModel? get tamperedProp;

  bool get hasTampered => tamperedProp != null;

  bool get isTampered {
    final ChannelPropertyDataModel? prop = tamperedProp;

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
  ChannelPropertyDataModel? get temperatureProp;

  bool get hasTemperature => temperatureProp != null;

  double get temperature {
    final ChannelPropertyDataModel? prop = temperatureProp;

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
  ChannelPropertyDataModel? get tiltProp;

  bool get hasTilt => tiltProp != null;

  int get tilt {
    final ChannelPropertyDataModel? prop = tiltProp;

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
  ChannelPropertyDataModel? get volumeProp;

  bool get hasVolume => volumeProp != null;

  int get volume {
    final ChannelPropertyDataModel? prop = volumeProp;

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
