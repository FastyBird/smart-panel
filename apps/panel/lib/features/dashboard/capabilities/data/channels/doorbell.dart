import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/doorbell.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class DoorbellChannelCapability
    extends ChannelCapability<DoorbellChannelDataModel>
    with ChannelBrightnessMixin, ChannelTamperedMixin {
  DoorbellChannelCapability({
    required super.channel,
    required super.properties,
  });

  ChannelPropertyDataModel get eventPropProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.event,
      );

  @override
  ChannelPropertyDataModel? get brightnessProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.brightness,
      );

  @override
  ChannelPropertyDataModel? get tamperedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.tampered,
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
