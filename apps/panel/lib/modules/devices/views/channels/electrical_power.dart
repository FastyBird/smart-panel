import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/current.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/frequency.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/over_current.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/over_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/over_voltage.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/volume.dart';

class ElectricalPowerChannelView extends ChannelView
    with ChannelFaultMixin, ChannelActiveMixin {
  ElectricalPowerChannelView({
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

  PowerChannelPropertyView get powerProp =>
      properties.whereType<PowerChannelPropertyView>().first;

  VolumeChannelPropertyView? get voltageProp =>
      properties.whereType<VolumeChannelPropertyView>().firstOrNull;

  CurrentChannelPropertyView? get currentProp =>
      properties.whereType<CurrentChannelPropertyView>().firstOrNull;

  FrequencyChannelPropertyView? get frequencyProp =>
      properties.whereType<FrequencyChannelPropertyView>().firstOrNull;

  OverCurrentChannelPropertyView? get overCurrentProp =>
      properties.whereType<OverCurrentChannelPropertyView>().firstOrNull;

  OverVoltageChannelPropertyView? get overVoltageProp =>
      properties.whereType<OverVoltageChannelPropertyView>().firstOrNull;

  OverPowerChannelPropertyView? get overPowerProp =>
      properties.whereType<OverPowerChannelPropertyView>().firstOrNull;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  bool get hasVoltage => voltageProp != null;

  bool get hasCurrent => currentProp != null;

  bool get hasFrequency => frequencyProp != null;

  bool get hasOverCurrent => overCurrentProp != null;

  bool get hasOverVoltage => overVoltageProp != null;

  bool get hasOverPower => overPowerProp != null;

  double get power {
    final ValueType? value = powerProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  double get voltage {
    final ValueType? value = voltageProp?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  double get current {
    final ValueType? value = currentProp?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  double get frequency {
    final ValueType? value = frequencyProp?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  bool get isOverCurrent {
    final OverCurrentChannelPropertyView? prop = overCurrentProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    return false;
  }

  bool get isOverVoltage {
    final OverVoltageChannelPropertyView? prop = overVoltageProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    return false;
  }

  bool get isOverPower {
    final OverPowerChannelPropertyView? prop = overPowerProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    return false;
  }
}
