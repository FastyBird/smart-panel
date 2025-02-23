import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class AirParticulateChannelCapability extends Capability
    with
        ChannelDetectedMixin,
        ChannelDensityMixin,
        ChannelActiveMixin,
        ChannelFaultMixin,
        ChannelTamperedMixin {
  AirParticulateChannelCapability({
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

  ChannelPropertyModel? get modeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.mode,
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

  bool get hasMode => modeProp != null;

  AirParticulateModeValue get mode {
    final ChannelPropertyModel? prop = modeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        AirParticulateModeValue.contains(value.value)) {
      AirParticulateModeValue? converted =
          AirParticulateModeValue.fromValue(value.value);

      if (converted != null) {
        return converted;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        AirParticulateModeValue.contains(defaultValue.value)) {
      AirParticulateModeValue? converted =
          AirParticulateModeValue.fromValue(defaultValue.value);

      if (converted != null) {
        return converted;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${modeProp?.category.value}',
    );
  }

  List<AirParticulateModeValue> get availableModes {
    final ChannelPropertyModel? prop = modeProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => AirParticulateModeValue.fromValue(item))
          .whereType<AirParticulateModeValue>()
          .toList();
    }

    return [];
  }
}
