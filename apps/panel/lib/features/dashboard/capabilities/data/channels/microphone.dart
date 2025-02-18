import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/microphone.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';

class MicrophoneChannelCapability
    extends ChannelCapability<MicrophoneChannelDataModel>
    with ChannelActiveMixin, ChannelVolumeMixin {
  MicrophoneChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyDataModel get activeProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.active,
      );

  @override
  ChannelPropertyDataModel? get volumeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.volume,
      );
}
