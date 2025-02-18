import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/cooler.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class CoolerChannelCapability extends ChannelCapability<CoolerChannelDataModel>
    with ChannelTemperatureMixin {
  CoolerChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyDataModel get temperatureProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.temperature,
      );

  ChannelPropertyDataModel get statusProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.status,
      );

  bool get isCooling {
    final value = statusProp.value;

    return value is BooleanValueType ? value.value : false;
  }
}
