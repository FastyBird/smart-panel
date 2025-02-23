import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class WindowCoveringChannelCapability extends Capability
    with
        ChannelObstructionMixin,
        ChannelPercentageMixin,
        ChannelTiltMixin,
        ChannelFaultMixin {
  WindowCoveringChannelCapability({
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
  ChannelPropertyModel? get tiltProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.tilt,
      );

  @override
  ChannelPropertyModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.fault,
      );

  WindowCoveringStatusValue get status {
    final ValueType? value = statusProp.value;

    if (value is StringValueType &&
        WindowCoveringStatusValue.contains(value.value)) {
      WindowCoveringStatusValue? status =
          WindowCoveringStatusValue.fromValue(value.value);

      if (status != null) {
        return status;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${statusProp.category.value}',
    );
  }

  bool get isOpen => status == WindowCoveringStatusValue.open;

  bool get isClosed => status == WindowCoveringStatusValue.closed;

  bool get isOpening => status == WindowCoveringStatusValue.opening;

  bool get isClosing => status == WindowCoveringStatusValue.closing;

  bool get isStopped => status == WindowCoveringStatusValue.stopped;

  List<WindowCoveringStatusValue> get availableStatuses {
    final FormatType? format = statusProp.format;

    if (format is StringListFormatType) {
      format.value
          .map((item) => WindowCoveringStatusValue.fromValue(item))
          .whereType<WindowCoveringStatusValue>()
          .toList();
    }

    return [];
  }

  WindowCoveringTypeValue get type {
    final ValueType? value = typeProp.value;

    if (value is StringValueType &&
        WindowCoveringTypeValue.contains(value.value)) {
      WindowCoveringTypeValue? type =
          WindowCoveringTypeValue.fromValue(value.value);

      if (type != null) {
        return type;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${typeProp.category.value}',
    );
  }

  WindowCoveringPositionValue? get currentAction {
    final ValueType? value = positionProp.value;

    if (value is StringValueType &&
        WindowCoveringPositionValue.contains(value.value)) {
      return WindowCoveringPositionValue.fromValue(value.value);
    }

    return null;
  }
}
