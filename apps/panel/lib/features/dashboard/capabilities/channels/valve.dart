import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class ValveChannelCapability extends Capability
    with ChannelOnMixin, ChannelFaultMixin {
  ValveChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel get onProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.on,
      );

  ChannelPropertyModel get typeProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.type,
      );

  ChannelPropertyModel? get durationProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.duration,
      );

  ChannelPropertyModel? get remainingProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.remaining,
      );

  ChannelPropertyModel? get modeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.mode,
      );

  @override
  ChannelPropertyModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.fault,
      );

  ValveTypeValue get type {
    final ValueType? value = typeProp.value;

    if (value is StringValueType && ValveTypeValue.contains(value.value)) {
      ValveTypeValue? type = ValveTypeValue.fromValue(value.value);

      if (type != null) {
        return type;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${typeProp.category.value}',
    );
  }

  bool get hasDuration => durationProp != null;

  int get duration {
    final ChannelPropertyModel? prop = durationProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    return 0;
  }

  int get minDuration {
    final FormatType? format = durationProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxDuration {
    final FormatType? format = durationProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 3600;
  }

  bool get hasRemaining => remainingProp != null;

  int get remaining {
    final ChannelPropertyModel? prop = remainingProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    return 0;
  }

  int get minRemaining {
    final FormatType? format = remainingProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxRemaining {
    final FormatType? format = remainingProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 3600;
  }

  bool get hasMode => modeProp != null;

  ValveModeValue get mode {
    final ChannelPropertyModel? prop = modeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && ValveModeValue.contains(value.value)) {
      ValveModeValue? type = ValveModeValue.fromValue(value.value);

      if (type != null) {
        return type;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${modeProp?.category.value}',
    );
  }

  List<ValveModeValue> get availableModes {
    final ChannelPropertyModel? prop = modeProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => ValveModeValue.fromValue(item))
          .whereType<ValveModeValue>()
          .toList();
    }

    return [];
  }
}
