import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class CoolerChannelCapability extends Capability
    with ChannelTemperatureMixin {
  CoolerChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel get temperatureProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.temperature,
      );

  ChannelPropertyModel get statusProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.status,
      );

  bool get isCooling {
    final value = statusProp.value;

    return value is BooleanValueType ? value.value : false;
  }
}
