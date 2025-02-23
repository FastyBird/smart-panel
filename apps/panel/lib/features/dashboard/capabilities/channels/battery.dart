import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class BatteryChannelCapability extends Capability
    with ChannelPercentageMixin, ChannelFaultMixin {
  BatteryChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel get percentageProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.percentage,
      );

  ChannelPropertyModel get statusProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.status,
      );

  @override
  ChannelPropertyModel get faultProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.fault,
      );

  bool get isOk {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && BatteryStateValue.contains(value.value)) {
      return value.value == BatteryStateValue.ok.value;
    }

    return false;
  }

  bool get isLow {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && BatteryStateValue.contains(value.value)) {
      return value.value == BatteryStateValue.low.value;
    }

    return false;
  }

  bool get isCharging {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && BatteryStateValue.contains(value.value)) {
      return value.value == BatteryStateValue.charging.value;
    }

    return false;
  }
}
