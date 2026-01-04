import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/command.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/obstruction.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/position.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tilt.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/type.dart';

class WindowCoveringChannelView extends ChannelView
    with
        ChannelObstructionMixin,
        ChannelPositionMixin,
        ChannelTiltMixin,
        ChannelFaultMixin {
  WindowCoveringChannelView({
    required super.id,
    required super.type,
    super.category,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });

  @override
  ObstructionChannelPropertyView? get obstructionProp =>
      properties.whereType<ObstructionChannelPropertyView>().firstOrNull;

  StatusChannelPropertyView get statusProp =>
      properties.whereType<StatusChannelPropertyView>().first;

  @override
  PositionChannelPropertyView get positionProp =>
      properties.whereType<PositionChannelPropertyView>().first;

  TypeChannelPropertyView get typeProp =>
      properties.whereType<TypeChannelPropertyView>().first;

  CommandChannelPropertyView? get commandProp =>
      properties.whereType<CommandChannelPropertyView>().firstOrNull;

  @override
  TiltChannelPropertyView? get tiltProp =>
      properties.whereType<TiltChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

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

    return WindowCoveringStatusValue.unknown;
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

  WindowCoveringTypeValue get windowCoveringType {
    final ValueType? value = typeProp.value;

    if (value is StringValueType &&
        WindowCoveringTypeValue.contains(value.value)) {
      WindowCoveringTypeValue? windowCoveringTypeValue =
          WindowCoveringTypeValue.fromValue(value.value);

      if (windowCoveringTypeValue != null) {
        return windowCoveringTypeValue;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${typeProp.category.json}',
    );
  }
}
