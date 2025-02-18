import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/temperature.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';

class TemperatureChannelCapability
    extends ChannelCapability<TemperatureChannelDataModel>
    with ChannelTemperatureMixin, ChannelFaultMixin, ChannelActiveMixin {
  TemperatureChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyDataModel get temperatureProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.temperature,
      );

  @override
  ChannelPropertyDataModel? get activeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.active,
      );

  @override
  ChannelPropertyDataModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.fault,
      );
}
