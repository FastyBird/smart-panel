import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/door.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class DoorChannelCapability extends ChannelCapability<DoorChannelDataModel>
    with ChannelObstructionMixin, ChannelPercentageMixin, ChannelFaultMixin {
  DoorChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyDataModel get obstructionProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.obstruction,
      );

  ChannelPropertyDataModel get statusProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.status,
      );

  ChannelPropertyDataModel get positionProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.position,
      );

  ChannelPropertyDataModel get typeProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.type,
      );

  @override
  ChannelPropertyDataModel? get percentageProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.percentage,
      );

  @override
  ChannelPropertyDataModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.fault,
      );

  DoorStatusValue get status {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && DoorStatusValue.contains(value.value)) {
      DoorStatusValue? status = DoorStatusValue.fromValue(value.value);

      if (status != null) {
        return status;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${statusProp.category.value}',
    );
  }

  bool get isOpen => status == DoorStatusValue.open;

  bool get isClosed => status == DoorStatusValue.closed;

  bool get isOpening => status == DoorStatusValue.opening;

  bool get isClosing => status == DoorStatusValue.closing;

  bool get isStopped => status == DoorStatusValue.stopped;

  List<DoorStatusValue> get availableStatuses {
    final FormatType? format = statusProp.format;

    if (format is StringListFormatType) {
      format.value
          .map((item) => DoorStatusValue.fromValue(item))
          .whereType<DoorStatusValue>()
          .toList();
    }

    return [];
  }

  DoorTypeValue get type {
    final ValueType? value = typeProp.value;

    if (value is StringValueType && DoorTypeValue.contains(value.value)) {
      DoorTypeValue? type = DoorTypeValue.fromValue(value.value);

      if (type != null) {
        return type;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${typeProp.category.value}',
    );
  }

  DoorPositionValue? get currentAction {
    final ValueType? value = positionProp.value;

    if (value is StringValueType && DoorPositionValue.contains(value.value)) {
      return DoorPositionValue.fromValue(value.value);
    }

    return null;
  }
}
