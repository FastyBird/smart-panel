import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';

class MicrophoneChannelCapability extends Capability
    with ChannelActiveMixin, ChannelVolumeMixin {
  MicrophoneChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel get activeProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.active,
      );

  @override
  ChannelPropertyModel? get volumeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.volume,
      );
}
