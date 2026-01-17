import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/percentage.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';

class BatteryChannelView extends ChannelView
    with ChannelPercentageMixin, ChannelFaultMixin {
  BatteryChannelView({
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
  PercentageChannelPropertyView get percentageProp =>
      properties.whereType<PercentageChannelPropertyView>().first;

  StatusChannelPropertyView get statusProp =>
      properties.whereType<StatusChannelPropertyView>().first;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  bool get isOk {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && BatteryStatusValue.contains(value.value)) {
      return value.value == BatteryStatusValue.ok.value;
    }

    return false;
  }

  bool get isLow {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && BatteryStatusValue.contains(value.value)) {
      return value.value == BatteryStatusValue.low.value;
    }

    return false;
  }

  bool get isCharging {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && BatteryStatusValue.contains(value.value)) {
      return value.value == BatteryStatusValue.charging.value;
    }

    return false;
  }
}
