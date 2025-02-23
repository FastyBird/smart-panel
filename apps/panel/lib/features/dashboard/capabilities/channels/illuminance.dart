import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class IlluminanceChannelCapability extends Capability
    with ChannelDensityMixin, ChannelActiveMixin, ChannelFaultMixin {
  IlluminanceChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel? get densityProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.density,
      );

  ChannelPropertyModel? get levelProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.level,
      );

  @override
  ChannelPropertyModel? get activeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.active,
      );

  @override
  ChannelPropertyModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.fault,
      );

  bool get hasLevel => levelProp != null;

  IlluminanceLevelValue? get level {
    final ChannelPropertyModel? prop = levelProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        IlluminanceLevelValue.contains(value.value)) {
      return IlluminanceLevelValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        IlluminanceLevelValue.contains(defaultValue.value)) {
      return IlluminanceLevelValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<IlluminanceLevelValue> get availableLevels {
    final ChannelPropertyModel? prop = levelProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => IlluminanceLevelValue.fromValue(item))
          .whereType<IlluminanceLevelValue>()
          .toList();
    }

    return [];
  }
}
