import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';

class MotionChannelCapability extends Capability
    with
        ChannelDetectedMixin,
        ChannelDistanceMixin,
        ChannelActiveMixin,
        ChannelFaultMixin,
        ChannelTamperedMixin {
  MotionChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel get detectedProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.detected,
      );

  @override
  ChannelPropertyModel? get distanceProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.distance,
      );

  @override
  ChannelPropertyModel? get activeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.active,
      );

  @override
  ChannelPropertyModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.fault,
      );

  @override
  ChannelPropertyModel? get tamperedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.tampered,
      );
}
