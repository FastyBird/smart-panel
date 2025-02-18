import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/battery.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class BatteryChannelCapability
    extends ChannelCapability<BatteryChannelDataModel>
    with ChannelPercentageMixin, ChannelFaultMixin {
  BatteryChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyDataModel get percentageProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.percentage,
      );

  ChannelPropertyDataModel get statusProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.status,
      );

  @override
  ChannelPropertyDataModel get faultProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.fault,
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
