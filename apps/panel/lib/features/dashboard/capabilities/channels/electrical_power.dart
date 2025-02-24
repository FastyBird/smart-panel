import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class ElectricalPowerChannelCapability extends Capability
    with ChannelFaultMixin, ChannelActiveMixin {
  ElectricalPowerChannelCapability({
    required super.channel,
    required super.properties,
  });

  ChannelPropertyModel get powerProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.power,
      );

  ChannelPropertyModel get voltageProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.voltage,
      );

  ChannelPropertyModel get currentProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.current,
      );

  ChannelPropertyModel get frequencyProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.frequency,
      );

  ChannelPropertyModel? get overCurrentProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.overCurrent,
      );

  ChannelPropertyModel? get overVoltageProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.overVoltage,
      );

  @override
  ChannelPropertyModel? get activeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.active,
      );

  @override
  ChannelPropertyModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.fault,
      );

  double get power {
    final ValueType? value = powerProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  double get voltage {
    final ValueType? value = voltageProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  double get current {
    final ValueType? value = currentProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  double get frequency {
    final ValueType? value = frequencyProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  bool get hasOverCurrent => overCurrentProp != null;

  bool get isOverCurrent {
    final ChannelPropertyModel? prop = overCurrentProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    return false;
  }

  bool get hasOverVoltage => overVoltageProp != null;

  bool get isOverVoltage {
    final ChannelPropertyModel? prop = overVoltageProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    return false;
  }
}
