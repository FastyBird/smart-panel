import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/production.dart';

class ElectricalGenerationChannelView extends ChannelView
    with ChannelFaultMixin, ChannelActiveMixin {
  ElectricalGenerationChannelView({
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

  ProductionChannelPropertyView get productionProp =>
      properties.whereType<ProductionChannelPropertyView>().first;

  PowerChannelPropertyView? get powerProp =>
      properties.whereType<PowerChannelPropertyView>().firstOrNull;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  bool get hasPower => powerProp != null;

  double get production {
    final ValueType? value = productionProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  double get power {
    final ValueType? value = powerProp?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }
}
