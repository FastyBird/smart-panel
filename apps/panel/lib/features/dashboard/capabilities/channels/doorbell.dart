import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class DoorbellChannelCapability extends Capability
    with ChannelBrightnessMixin, ChannelTamperedMixin {
  DoorbellChannelCapability({
    required super.channel,
    required super.properties,
  });

  ChannelPropertyModel get eventPropProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.event,
      );

  @override
  ChannelPropertyModel? get brightnessProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.brightness,
      );

  @override
  ChannelPropertyModel? get tamperedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.tampered,
      );

  ButtonEventValue? get event {
    final ValueType? value = eventPropProp.value;

    if (value is StringValueType && ButtonEventValue.contains(value.value)) {
      return ButtonEventValue.fromValue(value.value);
    }

    return null;
  }

  List<ButtonEventValue> get availableEvents {
    final FormatType? format = eventPropProp.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => ButtonEventValue.fromValue(item))
          .whereType<ButtonEventValue>()
          .toList();
    }

    return [];
  }
}
