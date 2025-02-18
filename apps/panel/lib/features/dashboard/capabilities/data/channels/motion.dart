import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/motion.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';

class MotionChannelCapability extends ChannelCapability<MotionChannelDataModel>
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
  ChannelPropertyDataModel get detectedProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.detected,
      );

  @override
  ChannelPropertyDataModel? get distanceProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.distance,
      );

  @override
  ChannelPropertyDataModel? get activeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.active,
      );

  @override
  ChannelPropertyDataModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.fault,
      );

  @override
  ChannelPropertyDataModel? get tamperedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.tampered,
      );
}
