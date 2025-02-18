import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class ElectricalEnergyChannelCapability
    extends ChannelCapability<ElectricalEnergyChannelDataModel>
    with ChannelFaultMixin, ChannelActiveMixin {
  ElectricalEnergyChannelCapability({
    required super.channel,
    required super.properties,
  });

  ChannelPropertyDataModel get consumptionProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.consumption,
      );

  ChannelPropertyDataModel get rateProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.rate,
      );

  @override
  ChannelPropertyDataModel? get activeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.active,
      );

  @override
  ChannelPropertyDataModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.fault,
      );

  double get consumption {
    final ValueType? value = consumptionProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  double get rate {
    final ValueType? value = rateProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }
}
