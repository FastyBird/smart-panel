import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/valve.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class ValveChannelCapability extends ChannelCapability<ValveChannelDataModel>
    with ChannelOnMixin, ChannelFaultMixin {
  ValveChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyDataModel get onProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.on,
      );

  ChannelPropertyDataModel get typeProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.type,
      );

  ChannelPropertyDataModel? get durationProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.duration,
      );

  ChannelPropertyDataModel? get remainingProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.remaining,
      );

  ChannelPropertyDataModel? get modeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.mode,
      );

  @override
  ChannelPropertyDataModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.fault,
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
    final ChannelPropertyDataModel? prop = durationProp;

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
    final ChannelPropertyDataModel? prop = remainingProp;

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
    final ChannelPropertyDataModel? prop = modeProp;

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
    final ChannelPropertyDataModel? prop = modeProp;

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
