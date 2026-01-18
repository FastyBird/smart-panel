import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/locked.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mist_level.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mode.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/timer.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/warm_mist.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/water_tank_empty.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/water_tank_level.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

class HumidifierChannelView extends ChannelView
    with ChannelOnMixin, ChannelFaultMixin {
  HumidifierChannelView({
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

  HumidityChannelPropertyView get humidityProp =>
      properties.whereType<HumidityChannelPropertyView>().first;

  ModeChannelPropertyView? get modeProp =>
      properties.whereType<ModeChannelPropertyView>().firstOrNull;

  StatusChannelPropertyView? get statusProp =>
      properties.whereType<StatusChannelPropertyView>().firstOrNull;

  MistLevelChannelPropertyView? get mistLevelProp =>
      properties.whereType<MistLevelChannelPropertyView>().firstOrNull;

  WarmMistChannelPropertyView? get warmMistProp =>
      properties.whereType<WarmMistChannelPropertyView>().firstOrNull;

  TimerChannelPropertyView? get timerProp =>
      properties.whereType<TimerChannelPropertyView>().firstOrNull;

  LockedChannelPropertyView? get lockedProp =>
      properties.whereType<LockedChannelPropertyView>().firstOrNull;

  WaterTankLevelChannelPropertyView? get waterTankLevelProp =>
      properties.whereType<WaterTankLevelChannelPropertyView>().firstOrNull;

  WaterTankEmptyChannelPropertyView? get waterTankEmptyProp =>
      properties.whereType<WaterTankEmptyChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  // ---------------------------------------------------------------------------
  // Target Humidity
  // ---------------------------------------------------------------------------

  int get humidity {
    final ValueType? value = humidityProp.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    final ValueType? defaultValue = humidityProp.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    return 0;
  }

  int get minHumidity {
    final FormatType? format = humidityProp.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxHumidity {
    final FormatType? format = humidityProp.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 100;
  }

  // ---------------------------------------------------------------------------
  // Mode
  // ---------------------------------------------------------------------------

  bool get hasMode => modeProp != null;

  HumidifierModeValue? get mode {
    final ModeChannelPropertyView? prop = modeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && HumidifierModeValue.contains(value.value)) {
      return HumidifierModeValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        HumidifierModeValue.contains(defaultValue.value)) {
      return HumidifierModeValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<HumidifierModeValue> get availableModes {
    final ModeChannelPropertyView? prop = modeProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => HumidifierModeValue.fromValue(item))
          .whereType<HumidifierModeValue>()
          .toList();
    }

    return [];
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  bool get hasStatus => statusProp != null;

  HumidifierStatusValue? get status {
    final StatusChannelPropertyView? prop = statusProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        HumidifierStatusValue.contains(value.value)) {
      return HumidifierStatusValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        HumidifierStatusValue.contains(defaultValue.value)) {
      return HumidifierStatusValue.fromValue(defaultValue.value);
    }

    return null;
  }

  bool get isHumidifying {
    return status == HumidifierStatusValue.humidifying;
  }

  // ---------------------------------------------------------------------------
  // Mist Level
  // ---------------------------------------------------------------------------

  bool get hasMistLevel => mistLevelProp != null;

  bool get isMistLevelNumeric {
    final FormatType? format = mistLevelProp?.format;
    return format is NumberListFormatType;
  }

  bool get isMistLevelEnum {
    final FormatType? format = mistLevelProp?.format;
    return format is StringListFormatType;
  }

  /// Get numeric mist level value (0-100%)
  int get mistLevel {
    final MistLevelChannelPropertyView? prop = mistLevelProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

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

  int get minMistLevel {
    final FormatType? format = mistLevelProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxMistLevel {
    final FormatType? format = mistLevelProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 100;
  }

  HumidifierMistLevelLevelValue? get mistLevelPreset {
    final MistLevelChannelPropertyView? prop = mistLevelProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        HumidifierMistLevelLevelValue.contains(value.value)) {
      return HumidifierMistLevelLevelValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        HumidifierMistLevelLevelValue.contains(defaultValue.value)) {
      return HumidifierMistLevelLevelValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<HumidifierMistLevelLevelValue> get availableMistLevelPresets {
    final MistLevelChannelPropertyView? prop = mistLevelProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => HumidifierMistLevelLevelValue.fromValue(item))
          .whereType<HumidifierMistLevelLevelValue>()
          .toList();
    }

    return [];
  }

  // ---------------------------------------------------------------------------
  // Warm Mist
  // ---------------------------------------------------------------------------

  bool get hasWarmMist => warmMistProp != null;

  bool get warmMist {
    final WarmMistChannelPropertyView? prop = warmMistProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

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

  // ---------------------------------------------------------------------------
  // Timer
  // ---------------------------------------------------------------------------

  bool get hasTimer => timerProp != null;

  bool get isTimerNumeric {
    final FormatType? format = timerProp?.format;
    return format is NumberListFormatType;
  }

  bool get isTimerEnum {
    final FormatType? format = timerProp?.format;
    return format is StringListFormatType;
  }

  /// Get numeric timer value in seconds (for numeric timer)
  int get timer {
    final TimerChannelPropertyView? prop = timerProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

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

    return 86400; // 24 hours in seconds
  }

  int get timerStep {
    final double? step = timerProp?.step;
    return step?.toInt() ?? 60; // Default 1 minute
  }

  HumidifierTimerPresetValue? get timerPreset {
    final TimerChannelPropertyView? prop = timerProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        HumidifierTimerPresetValue.contains(value.value)) {
      return HumidifierTimerPresetValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        HumidifierTimerPresetValue.contains(defaultValue.value)) {
      return HumidifierTimerPresetValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<HumidifierTimerPresetValue> get availableTimerPresets {
    final TimerChannelPropertyView? prop = timerProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => HumidifierTimerPresetValue.fromValue(item))
          .whereType<HumidifierTimerPresetValue>()
          .toList();
    }

    return [];
  }

  // ---------------------------------------------------------------------------
  // Child Lock
  // ---------------------------------------------------------------------------

  bool get hasLocked => lockedProp != null;

  bool get locked {
    final LockedChannelPropertyView? prop = lockedProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

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

  // ---------------------------------------------------------------------------
  // Water Tank
  // ---------------------------------------------------------------------------

  bool get hasWaterTankLevel => waterTankLevelProp != null;

  int get waterTankLevel {
    final WaterTankLevelChannelPropertyView? prop = waterTankLevelProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    return 100; // Default full for humidifier
  }

  bool get hasWaterTankEmpty => waterTankEmptyProp != null;

  bool get waterTankEmpty {
    final WaterTankEmptyChannelPropertyView? prop = waterTankEmptyProp;

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

  /// Returns true if water tank is nearly empty (<20%) or empty indicator is set
  bool get waterTankWarning {
    if (waterTankEmpty) return true;
    if (hasWaterTankLevel && waterTankLevel < 20) return true;
    return false;
  }
}
