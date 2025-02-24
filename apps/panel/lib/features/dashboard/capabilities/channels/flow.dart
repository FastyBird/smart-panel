import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class FlowChannelCapability extends Capability
    with ChannelActiveMixin, ChannelFaultMixin {
  FlowChannelCapability({
    required super.channel,
    required super.properties,
  });

  ChannelPropertyModel get rateProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.rate,
      );

  @override
  ChannelPropertyModel? get activeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.active,
      );

  @override
  ChannelPropertyModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.fault,
      );

  double get rate {
    final ValueType? value = rateProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }
}
