import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/consumption.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/rate.dart';

class ElectricalEnergyChannelView extends ChannelView
    with ChannelFaultMixin, ChannelActiveMixin {
  ElectricalEnergyChannelView({
    required super.id,
    required super.type,
    super.category,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });

  ConsumptionChannelPropertyView get consumptionProp =>
      properties.whereType<ConsumptionChannelPropertyView>().first;

  RateChannelPropertyView? get rateProp =>
      properties.whereType<RateChannelPropertyView>().firstOrNull;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  bool get hasRate => rateProp != null;

  double get consumption {
    final ValueType? value = consumptionProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  double get rate {
    final ValueType? value = rateProp?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }
}
