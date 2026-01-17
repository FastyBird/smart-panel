import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/obstruction.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/percentage.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/position.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/type.dart';

class DoorChannelView extends ChannelView
    with ChannelObstructionMixin, ChannelPercentageMixin, ChannelFaultMixin {
  DoorChannelView({
    required super.id,
    required super.type,
    super.category,
    super.name,
    super.description,
    required super.device,
    super.parent,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });

  @override
  ObstructionChannelPropertyView? get obstructionProp =>
      properties.whereType<ObstructionChannelPropertyView>().firstOrNull;

  StatusChannelPropertyView get statusProp =>
      properties.whereType<StatusChannelPropertyView>().first;

  PositionChannelPropertyView get positionProp =>
      properties.whereType<PositionChannelPropertyView>().first;

  TypeChannelPropertyView get typeProp =>
      properties.whereType<TypeChannelPropertyView>().first;

  @override
  PercentageChannelPropertyView? get percentageProp =>
      properties.whereType<PercentageChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  DoorStatusValue get status {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && DoorStatusValue.contains(value.value)) {
      DoorStatusValue? status = DoorStatusValue.fromValue(value.value);

      if (status != null) {
        return status;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${statusProp.category.json}',
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

  DoorTypeValue get doorType {
    final ValueType? value = typeProp.value;

    if (value is StringValueType && DoorTypeValue.contains(value.value)) {
      DoorTypeValue? doorTypeValue = DoorTypeValue.fromValue(value.value);

      if (doorTypeValue != null) {
        return doorTypeValue;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${typeProp.category.json}',
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
