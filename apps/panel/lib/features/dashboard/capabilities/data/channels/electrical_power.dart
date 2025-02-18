import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class ElectricalPowerChannelCapability
    extends ChannelCapability<ElectricalPowerChannelDataModel>
    with ChannelFaultMixin, ChannelActiveMixin {
  ElectricalPowerChannelCapability({
    required super.channel,
    required super.properties,
  });

  ChannelPropertyDataModel get powerProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.power,
      );

  ChannelPropertyDataModel get voltageProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.voltage,
      );

  ChannelPropertyDataModel get currentProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.current,
      );

  ChannelPropertyDataModel get frequencyProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.frequency,
      );

  ChannelPropertyDataModel? get overCurrentProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.overCurrent,
      );

  ChannelPropertyDataModel? get overVoltageProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.overVoltage,
      );

  @override
  ChannelPropertyDataModel? get activeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.active,
      );

  @override
  ChannelPropertyDataModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.fault,
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
    final ChannelPropertyDataModel? prop = overCurrentProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    return false;
  }

  bool get hasOverVoltage => overVoltageProp != null;

  bool get isOverVoltage {
    final ChannelPropertyDataModel? prop = overVoltageProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    return false;
  }
}
