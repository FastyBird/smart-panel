import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/direction.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/locked.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mode.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/natural_breeze.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/speed.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/swing.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/timer.dart';

class FanChannelView extends ChannelView with ChannelOnMixin {
  FanChannelView({
    required super.id,
    required super.type,
    super.category,
    super.name,
    super.description,
    required super.device,
    super.parent,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });

  @override
  OnChannelPropertyView get onProp =>
      properties.whereType<OnChannelPropertyView>().first;

  SwingChannelPropertyView? get swingProp =>
      properties.whereType<SwingChannelPropertyView>().firstOrNull;

  SpeedChannelPropertyView? get speedProp =>
      properties.whereType<SpeedChannelPropertyView>().firstOrNull;

  DirectionChannelPropertyView? get directionProp =>
      properties.whereType<DirectionChannelPropertyView>().firstOrNull;

  ModeChannelPropertyView? get modeProp =>
      properties.whereType<ModeChannelPropertyView>().firstOrNull;

  LockedChannelPropertyView? get lockedProp =>
      properties.whereType<LockedChannelPropertyView>().firstOrNull;

  TimerChannelPropertyView? get timerProp =>
      properties.whereType<TimerChannelPropertyView>().firstOrNull;

  NaturalBreezeChannelPropertyView? get naturalBreezeProp =>
      properties.whereType<NaturalBreezeChannelPropertyView>().firstOrNull;

  bool get hasSwing => swingProp != null;

  bool get swing {
    final SwingChannelPropertyView? prop = swingProp;

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

  bool get hasSpeed => speedProp != null;

  /// Returns true if speed is numeric (0-100%), false if enum-based
  bool get isSpeedNumeric {
    final FormatType? format = speedProp?.format;
    return format is NumberListFormatType;
  }

  /// Returns true if speed is enum-based (off, low, medium, high, turbo, auto)
  bool get isSpeedEnum {
    final FormatType? format = speedProp?.format;
    return format is StringListFormatType;
  }

  double get speed {
    final SpeedChannelPropertyView? prop = speedProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    // Handle string values (backend may return numbers as strings)
    if (value is StringValueType) {
      final parsed = double.tryParse(value.value);
      if (parsed != null) {
        return parsed;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toDouble();
    }

    if (defaultValue is StringValueType) {
      final parsed = double.tryParse(defaultValue.value);
      if (parsed != null) {
        return parsed;
      }
    }

    return 0;
  }

  double get minSpeed {
    final FormatType? format = speedProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toDouble();
    }

    return 0.0;
  }

  double get maxSpeed {
    final FormatType? format = speedProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toDouble();
    }

    return 100.0;
  }

  /// Get the step value for numeric speed (default: 1)
  double get speedStep {
    final double? step = speedProp?.step;
    return step ?? 1.0;
  }

  /// Get current speed level (for enum-based speed)
  FanSpeedLevelValue? get speedLevel {
    final SpeedChannelPropertyView? prop = speedProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && FanSpeedLevelValue.contains(value.value)) {
      return FanSpeedLevelValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        FanSpeedLevelValue.contains(defaultValue.value)) {
      return FanSpeedLevelValue.fromValue(defaultValue.value);
    }

    return null;
  }

  /// Get available speed levels (for enum-based speed)
  List<FanSpeedLevelValue> get availableSpeedLevels {
    final SpeedChannelPropertyView? prop = speedProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => FanSpeedLevelValue.fromValue(item))
          .whereType<FanSpeedLevelValue>()
          .toList();
    }

    return [];
  }

  bool get hasDirection => directionProp != null;

  FanDirectionValue? get direction {
    final DirectionChannelPropertyView? prop = directionProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && FanDirectionValue.contains(value.value)) {
      return FanDirectionValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        FanDirectionValue.contains(defaultValue.value)) {
      return FanDirectionValue.fromValue(defaultValue.value);
    }

    return null;
  }

  bool get hasMode => modeProp != null;

  FanModeValue? get mode {
    final ModeChannelPropertyView? prop = modeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && FanModeValue.contains(value.value)) {
      return FanModeValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        FanModeValue.contains(defaultValue.value)) {
      return FanModeValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<FanModeValue> get availableModes {
    final ModeChannelPropertyView? prop = modeProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => FanModeValue.fromValue(item))
          .whereType<FanModeValue>()
          .toList();
    }

    return [];
  }

  bool get hasLocked => lockedProp != null;

  bool get locked {
    final LockedChannelPropertyView? prop = lockedProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    // Handle string values (backend may return booleans as strings)
    if (value is StringValueType) {
      final lower = value.value.toLowerCase();
      if (lower == 'true' || lower == '1') return true;
      if (lower == 'false' || lower == '0') return false;
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    if (defaultValue is StringValueType) {
      final lower = defaultValue.value.toLowerCase();
      if (lower == 'true' || lower == '1') return true;
      if (lower == 'false' || lower == '0') return false;
    }

    return false;
  }

  bool get hasNaturalBreeze => naturalBreezeProp != null;

  bool get naturalBreeze {
    final NaturalBreezeChannelPropertyView? prop = naturalBreezeProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    // Handle string values (backend may return booleans as strings)
    if (value is StringValueType) {
      final lower = value.value.toLowerCase();
      if (lower == 'true' || lower == '1') return true;
      if (lower == 'false' || lower == '0') return false;
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    if (defaultValue is StringValueType) {
      final lower = defaultValue.value.toLowerCase();
      if (lower == 'true' || lower == '1') return true;
      if (lower == 'false' || lower == '0') return false;
    }

    return false;
  }

  bool get hasTimer => timerProp != null;

  /// Returns true if timer is numeric (minutes/seconds)
  bool get isTimerNumeric {
    final FormatType? format = timerProp?.format;
    return format is NumberListFormatType;
  }

  /// Returns true if timer is enum-based (off, 30m, 1h, 2h, etc.)
  bool get isTimerEnum {
    final FormatType? format = timerProp?.format;
    return format is StringListFormatType;
  }

  /// Get numeric timer value in minutes (for numeric timer)
  int get timer {
    final TimerChannelPropertyView? prop = timerProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    // Handle string values (backend may return numbers as strings)
    if (value is StringValueType) {
      final parsed = int.tryParse(value.value);
      if (parsed != null) {
        return parsed;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    if (defaultValue is StringValueType) {
      final parsed = int.tryParse(defaultValue.value);
      if (parsed != null) {
        return parsed;
      }
    }

    return 0;
  }

  int get minTimer {
    final FormatType? format = timerProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxTimer {
    final FormatType? format = timerProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 720; // 12 hours in minutes
  }

  /// Get the step value for numeric timer (default: 1)
  int get timerStep {
    final double? step = timerProp?.step;
    return step?.toInt() ?? 1;
  }

  /// Get current timer preset (for enum-based timer)
  FanTimerPresetValue? get timerPreset {
    final TimerChannelPropertyView? prop = timerProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && FanTimerPresetValue.contains(value.value)) {
      return FanTimerPresetValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        FanTimerPresetValue.contains(defaultValue.value)) {
      return FanTimerPresetValue.fromValue(defaultValue.value);
    }

    return null;
  }

  /// Get available timer presets (for enum-based timer)
  List<FanTimerPresetValue> get availableTimerPresets {
    final TimerChannelPropertyView? prop = timerProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => FanTimerPresetValue.fromValue(item))
          .whereType<FanTimerPresetValue>()
          .toList();
    }

    return [];
  }
}
