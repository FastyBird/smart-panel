import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/volatile_organic_compounds.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class VolatileOrganicCompoundsChannelCapability
    extends ChannelCapability<VolatileOrganicCompoundsChannelDataModel>
    with
        ChannelDetectedMixin,
        ChannelDensityMixin,
        ChannelActiveMixin,
        ChannelFaultMixin,
        ChannelTamperedMixin {
  VolatileOrganicCompoundsChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyDataModel? get detectedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.detected,
      );

  @override
  ChannelPropertyDataModel? get densityProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.density,
      );

  ChannelPropertyDataModel? get levelProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.level,
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

  bool get hasLevel => levelProp != null;

  VolatileOrganicCompoundsLevelValue? get level {
    final ChannelPropertyDataModel? prop = levelProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        VolatileOrganicCompoundsLevelValue.contains(value.value)) {
      return VolatileOrganicCompoundsLevelValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        VolatileOrganicCompoundsLevelValue.contains(defaultValue.value)) {
      return VolatileOrganicCompoundsLevelValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<VolatileOrganicCompoundsLevelValue> get availableLevels {
    final ChannelPropertyDataModel? prop = levelProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => VolatileOrganicCompoundsLevelValue.fromValue(item))
          .whereType<VolatileOrganicCompoundsLevelValue>()
          .toList();
    }

    return [];
  }
}
