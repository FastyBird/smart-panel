import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class SpeakerChannelCapability extends Capability
    with ChannelActiveMixin, ChannelVolumeMixin {
  SpeakerChannelCapability({
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

  ChannelPropertyModel? get modeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.mode,
      );

  bool get hasMode => modeProp != null;

  SpeakerModeValue get mode {
    final ChannelPropertyModel? prop = modeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && SpeakerModeValue.contains(value.value)) {
      SpeakerModeValue? type = SpeakerModeValue.fromValue(value.value);

      if (type != null) {
        return type;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${modeProp?.category.value}',
    );
  }

  List<SpeakerModeValue> get availableModes {
    final ChannelPropertyModel? prop = modeProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => SpeakerModeValue.fromValue(item))
          .whereType<SpeakerModeValue>()
          .toList();
    }

    return [];
  }
}
