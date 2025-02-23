import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class DoorChannelCapability extends Capability
    with ChannelObstructionMixin, ChannelPercentageMixin, ChannelFaultMixin {
  DoorChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel get obstructionProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.obstruction,
      );

  ChannelPropertyModel get statusProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.status,
      );

  ChannelPropertyModel get positionProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.position,
      );

  ChannelPropertyModel get typeProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.type,
      );

  @override
  ChannelPropertyModel? get percentageProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.percentage,
      );

  @override
  ChannelPropertyModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.fault,
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
