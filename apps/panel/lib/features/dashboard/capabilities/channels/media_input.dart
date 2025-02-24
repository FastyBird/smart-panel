import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class MediaInputChannelCapability extends Capability
    with ChannelActiveMixin {
  MediaInputChannelCapability({
    required super.channel,
    required super.properties,
  });

  ChannelPropertyModel get sourceProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.source,
      );

  @override
  ChannelPropertyModel? get activeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.active,
      );

  String get source {
    final ValueType? value = sourceProp.value;

    if (value is StringValueType) {
      return value.value;
    }

    throw Exception(
      'Channel is missing required value for property: ${sourceProp.category.value}',
    );
  }
}
