import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';

class PressureChannelCapability extends Capability
    with ChannelMeasuredMixin, ChannelActiveMixin, ChannelFaultMixin {
  PressureChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel get measuredProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.measured,
      );

  @override
  ChannelPropertyModel? get activeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.active,
      );

  @override
  ChannelPropertyModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.fault,
      );
}
