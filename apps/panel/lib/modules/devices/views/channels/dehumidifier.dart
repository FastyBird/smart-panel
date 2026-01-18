import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/locked.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mode.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/timer.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/water_tank_full.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/water_tank_level.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

class DehumidifierChannelView extends ChannelView
    with ChannelOnMixin, ChannelFaultMixin {
  DehumidifierChannelView({
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

  TimerChannelPropertyView? get timerProp =>
      properties.whereType<TimerChannelPropertyView>().firstOrNull;

  LockedChannelPropertyView? get lockedProp =>
      properties.whereType<LockedChannelPropertyView>().firstOrNull;

  WaterTankLevelChannelPropertyView? get waterTankLevelProp =>
      properties.whereType<WaterTankLevelChannelPropertyView>().firstOrNull;

  WaterTankFullChannelPropertyView? get waterTankFullProp =>
      properties.whereType<WaterTankFullChannelPropertyView>().firstOrNull;

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

  DehumidifierModeValue? get mode {
    final ModeChannelPropertyView? prop = modeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        DehumidifierModeValue.contains(value.value)) {
      return DehumidifierModeValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        DehumidifierModeValue.contains(defaultValue.value)) {
      return DehumidifierModeValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<DehumidifierModeValue> get availableModes {
    final ModeChannelPropertyView? prop = modeProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => DehumidifierModeValue.fromValue(item))
          .whereType<DehumidifierModeValue>()
          .toList();
    }

    return [];
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  bool get hasStatus => statusProp != null;

  DehumidifierStatusValue? get status {
    final StatusChannelPropertyView? prop = statusProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        DehumidifierStatusValue.contains(value.value)) {
      return DehumidifierStatusValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        DehumidifierStatusValue.contains(defaultValue.value)) {
      return DehumidifierStatusValue.fromValue(defaultValue.value);
    }

    return null;
  }

  bool get isDehumidifying {
    return status == DehumidifierStatusValue.dehumidifying;
  }

  bool get isDefrosting {
    return status == DehumidifierStatusValue.defrosting;
  }

  /// Computes whether the dehumidifier is actively dehumidifying.
  ///
  /// If the status property is available, uses it directly.
  /// Otherwise, falls back to comparing current humidity vs target:
  /// - If current > target (with delta tolerance), device should be dehumidifying
  /// - If current <= target, device is idle
  ///
  /// [currentHumidity] - The measured humidity from the humidity sensor channel
  /// [delta] - Tolerance in percentage points (default: 2%)
  bool computeIsDehumidifying({int? currentHumidity, int delta = 2}) {
    // If status is available, use it directly
    if (hasStatus && status != null) {
      return status == DehumidifierStatusValue.dehumidifying;
    }

    // Fallback: compare current humidity vs target
    if (currentHumidity == null) {
      return false;
    }

    final target = humidity;

    // If current is above target (plus delta), device should be dehumidifying
    // e.g., target = 50%, current = 55%, delta = 2 => 55 > (50 + 2) = true
    return currentHumidity > (target + delta);
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

  DehumidifierTimerPresetValue? get timerPreset {
    final TimerChannelPropertyView? prop = timerProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        DehumidifierTimerPresetValue.contains(value.value)) {
      return DehumidifierTimerPresetValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        DehumidifierTimerPresetValue.contains(defaultValue.value)) {
      return DehumidifierTimerPresetValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<DehumidifierTimerPresetValue> get availableTimerPresets {
    final TimerChannelPropertyView? prop = timerProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => DehumidifierTimerPresetValue.fromValue(item))
          .whereType<DehumidifierTimerPresetValue>()
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

    return 0;
  }

  bool get hasWaterTankFull => waterTankFullProp != null;

  bool get waterTankFull {
    final WaterTankFullChannelPropertyView? prop = waterTankFullProp;

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

  /// Returns true if water tank is nearly full (>75%) or full indicator is set
  bool get waterTankWarning {
    if (waterTankFull) return true;
    if (hasWaterTankLevel && waterTankLevel > 75) return true;
    return false;
  }
}
