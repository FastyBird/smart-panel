import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class OzoneChannelCapability extends Capability
    with
        ChannelDetectedMixin,
        ChannelDensityMixin,
        ChannelActiveMixin,
        ChannelFaultMixin,
        ChannelTamperedMixin {
  OzoneChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel? get detectedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.detected,
      );

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

  @override
  ChannelPropertyModel? get tamperedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.tampered,
      );

  bool get hasLevel => levelProp != null;

  OzoneLevelValue? get level {
    final ChannelPropertyModel? prop = levelProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && OzoneLevelValue.contains(value.value)) {
      return OzoneLevelValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        OzoneLevelValue.contains(defaultValue.value)) {
      return OzoneLevelValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<OzoneLevelValue> get availableLevels {
    final ChannelPropertyModel? prop = levelProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => OzoneLevelValue.fromValue(item))
          .whereType<OzoneLevelValue>()
          .toList();
    }

    return [];
  }
}
