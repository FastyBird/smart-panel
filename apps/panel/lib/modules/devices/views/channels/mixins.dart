import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/brightness.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/concentration.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/distance.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/illuminance.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/obstruction.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/peak_level.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/percentage.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/position.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/pressure.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tampered.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tilt.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/volume.dart';

// Helper functions for parsing string values
bool _parseBool(String value) {
  final lower = value.toLowerCase();
  return lower == 'true' || lower == '1' || lower == 'on' || lower == 'yes';
}

int? _parseInt(String value) => int.tryParse(value);

double? _parseDouble(String value) => double.tryParse(value);

num? _parseNum(String value) => num.tryParse(value);

mixin ChannelActiveMixin {
  ActiveChannelPropertyView? get activeProp;

  bool get hasActive => activeProp != null;

  bool get isActive {
    final ActiveChannelPropertyView? prop = activeProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    if (value is StringValueType) {
      return _parseBool(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    if (defaultValue is StringValueType) {
      return _parseBool(defaultValue.value);
    }

    return false;
  }
}

mixin ChannelBrightnessMixin {
  BrightnessChannelPropertyView? get brightnessProp;

  bool get hasBrightness => brightnessProp != null;

  int get brightness {
    final BrightnessChannelPropertyView? prop = brightnessProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    if (value is StringValueType) {
      final parsed = _parseInt(value.value);
      if (parsed != null) {
        return parsed;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    if (defaultValue is StringValueType) {
      final parsed = _parseInt(defaultValue.value);
      if (parsed != null) {
        return parsed;
      }
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

mixin ChannelConcentrationMixin {
  ConcentrationChannelPropertyView? get concentrationProp;

  bool get hasConcentration => concentrationProp != null;

  double get concentration {
    final ConcentrationChannelPropertyView? prop = concentrationProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    if (value is StringValueType) {
      final parsed = _parseDouble(value.value);
      if (parsed != null) {
        return parsed;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toDouble();
    }

    if (defaultValue is StringValueType) {
      final parsed = _parseDouble(defaultValue.value);
      if (parsed != null) {
        return parsed;
      }
    }

    return 0.0;
  }

  double get minConcentration {
    final FormatType? format = concentrationProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toDouble();
    }

    return 0.0;
  }

  double get maxConcentration {
    final FormatType? format = concentrationProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toDouble();
    }

    return 100.0;
  }
}

mixin ChannelDetectedMixin {
  DetectedChannelPropertyView? get detectedProp;

  bool get hasDetected => detectedProp != null;

  bool get detected {
    final DetectedChannelPropertyView? prop = detectedProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    if (value is StringValueType) {
      return _parseBool(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    if (defaultValue is StringValueType) {
      return _parseBool(defaultValue.value);
    }

    return false;
  }
}

mixin ChannelDistanceMixin {
  DistanceChannelPropertyView? get distanceProp;

  bool get hasDistance => distanceProp != null;

  double get distance {
    final DistanceChannelPropertyView? prop = distanceProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    if (value is StringValueType) {
      final parsed = _parseDouble(value.value);
      if (parsed != null) {
        return parsed;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toDouble();
    }

    if (defaultValue is StringValueType) {
      final parsed = _parseDouble(defaultValue.value);
      if (parsed != null) {
        return parsed;
      }
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
  FaultChannelPropertyView? get faultProp;

  bool get hasFault {
    final FaultChannelPropertyView? prop = faultProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value > 0;
    }

    if (value is StringValueType) {
      final parsed = _parseNum(value.value);
      if (parsed != null) {
        return parsed > 0;
      }
    }

    return false;
  }

  num? get faultCode {
    final FaultChannelPropertyView? prop = faultProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value;
    }

    if (value is StringValueType) {
      return _parseNum(value.value);
    }

    return null;
  }
}

mixin ChannelPressureMixin {
  PressureChannelPropertyView? get pressureProp;

  bool get hasPressure => pressureProp != null;

  double get pressure {
    final PressureChannelPropertyView? prop = pressureProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    if (value is StringValueType) {
      final parsed = _parseDouble(value.value);
      if (parsed != null) {
        return parsed;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toDouble();
    }

    if (defaultValue is StringValueType) {
      final parsed = _parseDouble(defaultValue.value);
      if (parsed != null) {
        return parsed;
      }
    }

    return 0.0;
  }

  double get minPressure {
    final FormatType? format = pressureProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toDouble();
    }

    return 0.0;
  }

  double get maxPressure {
    final FormatType? format = pressureProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toDouble();
    }

    return 100.0;
  }
}

mixin ChannelIlluminanceMixin {
  IlluminanceChannelPropertyView? get illuminanceProp;

  bool get hasIlluminance => illuminanceProp != null;

  double get illuminance {
    final IlluminanceChannelPropertyView? prop = illuminanceProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    if (value is StringValueType) {
      final parsed = _parseDouble(value.value);
      if (parsed != null) {
        return parsed;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toDouble();
    }

    if (defaultValue is StringValueType) {
      final parsed = _parseDouble(defaultValue.value);
      if (parsed != null) {
        return parsed;
      }
    }

    return 0.0;
  }

  double get minIlluminance {
    final FormatType? format = illuminanceProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toDouble();
    }

    return 0.0;
  }

  double get maxIlluminance {
    final FormatType? format = illuminanceProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toDouble();
    }

    return 100000.0;
  }
}

mixin ChannelOnMixin {
  OnChannelPropertyView? get onProp;

  bool get hasOn => onProp != null;

  bool get on {
    final OnChannelPropertyView? prop = onProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    if (value is StringValueType) {
      return _parseBool(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    if (defaultValue is StringValueType) {
      return _parseBool(defaultValue.value);
    }

    return false;
  }
}

mixin ChannelPercentageMixin {
  PercentageChannelPropertyView? get percentageProp;

  bool get hasPercentage => percentageProp != null;

  int get percentage {
    final PercentageChannelPropertyView? prop = percentageProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    if (value is StringValueType) {
      final parsed = _parseInt(value.value);
      if (parsed != null) {
        return parsed;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    if (defaultValue is StringValueType) {
      final parsed = _parseInt(defaultValue.value);
      if (parsed != null) {
        return parsed;
      }
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

mixin ChannelPositionMixin {
  PositionChannelPropertyView? get positionProp;

  bool get hasPosition => positionProp != null;

  int get position {
    final PositionChannelPropertyView? prop = positionProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    if (value is StringValueType) {
      final parsed = _parseInt(value.value);
      if (parsed != null) {
        return parsed;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    if (defaultValue is StringValueType) {
      final parsed = _parseInt(defaultValue.value);
      if (parsed != null) {
        return parsed;
      }
    }

    return 0;
  }

  int get minPosition {
    final FormatType? format = positionProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxPosition {
    final FormatType? format = positionProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 100;
  }
}

mixin ChannelObstructionMixin {
  ObstructionChannelPropertyView? get obstructionProp;

  bool get hasObstruction => obstructionProp != null;

  bool get obstruction {
    final ObstructionChannelPropertyView? prop = obstructionProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    if (value is StringValueType) {
      return _parseBool(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    if (defaultValue is StringValueType) {
      return _parseBool(defaultValue.value);
    }

    return false;
  }
}

mixin ChannelPeakLevelMixin {
  PeakLevelChannelPropertyView? get peakLevelProp;

  bool get hasPeakLevel => peakLevelProp != null;

  double get peakLevel {
    final PeakLevelChannelPropertyView? prop = peakLevelProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    if (value is StringValueType) {
      final parsed = _parseDouble(value.value);
      if (parsed != null) {
        return parsed;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toDouble();
    }

    if (defaultValue is StringValueType) {
      final parsed = _parseDouble(defaultValue.value);
      if (parsed != null) {
        return parsed;
      }
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
  TamperedChannelPropertyView? get tamperedProp;

  bool get hasTampered => tamperedProp != null;

  bool get isTampered {
    final TamperedChannelPropertyView? prop = tamperedProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    if (value is StringValueType) {
      return _parseBool(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    if (defaultValue is StringValueType) {
      return _parseBool(defaultValue.value);
    }

    return false;
  }
}

mixin ChannelTemperatureMixin {
  TemperatureChannelPropertyView? get temperatureProp;

  bool get hasTemperature => temperatureProp != null;

  double get temperature {
    final TemperatureChannelPropertyView? prop = temperatureProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    if (value is StringValueType) {
      final parsed = _parseDouble(value.value);
      if (parsed != null) {
        return parsed;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toDouble();
    }

    if (defaultValue is StringValueType) {
      final parsed = _parseDouble(defaultValue.value);
      if (parsed != null) {
        return parsed;
      }
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
  TiltChannelPropertyView? get tiltProp;

  bool get hasTilt => tiltProp != null;

  int get tilt {
    final TiltChannelPropertyView? prop = tiltProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    if (value is StringValueType) {
      final parsed = _parseInt(value.value);
      if (parsed != null) {
        return parsed;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    if (defaultValue is StringValueType) {
      final parsed = _parseInt(defaultValue.value);
      if (parsed != null) {
        return parsed;
      }
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
  VolumeChannelPropertyView? get volumeProp;

  bool get hasVolume => volumeProp != null;

  int get volume {
    final VolumeChannelPropertyView? prop = volumeProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    if (value is StringValueType) {
      final parsed = _parseInt(value.value);
      if (parsed != null) {
        return parsed;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    if (defaultValue is StringValueType) {
      final parsed = _parseInt(defaultValue.value);
      if (parsed != null) {
        return parsed;
      }
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
