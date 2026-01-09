import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mode.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';

class RobotVacuumChannelView extends ChannelView
    with ChannelOnMixin, ChannelFaultMixin {
  RobotVacuumChannelView({
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
  OnChannelPropertyView? get onProp =>
      properties.whereType<OnChannelPropertyView>().firstOrNull;

  StatusChannelPropertyView get statusProp =>
      properties.whereType<StatusChannelPropertyView>().first;

  ModeChannelPropertyView? get modeProp =>
      properties.whereType<ModeChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  RobotVacuumStatusValue get status {
    final ValueType? value = statusProp.value;

    if (value is StringValueType &&
        RobotVacuumStatusValue.contains(value.value)) {
      RobotVacuumStatusValue? type =
          RobotVacuumStatusValue.fromValue(value.value);

      if (type != null) {
        return type;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${statusProp.category.json}',
    );
  }

  List<RobotVacuumStatusValue> get availableStatuses {
    final FormatType? format = statusProp.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => RobotVacuumStatusValue.fromValue(item))
          .whereType<RobotVacuumStatusValue>()
          .toList();
    }

    return [];
  }

  bool get hasMode => modeProp != null;

  RobotVacuumModeValue? get mode {
    final ModeChannelPropertyView? prop = modeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        RobotVacuumModeValue.contains(value.value)) {
      RobotVacuumModeValue? type = RobotVacuumModeValue.fromValue(value.value);

      if (type != null) {
        return type;
      }
    }

    return null;
  }

  List<RobotVacuumModeValue> get availableModes {
    final ModeChannelPropertyView? prop = modeProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => RobotVacuumModeValue.fromValue(item))
          .whereType<RobotVacuumModeValue>()
          .toList();
    }

    return [];
  }
}
