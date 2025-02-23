import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class RobotVacuumChannelCapability extends Capability
    with ChannelOnMixin, ChannelFaultMixin {
  RobotVacuumChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel get onProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.on,
      );

  ChannelPropertyModel get statusProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.status,
      );

  ChannelPropertyModel? get modeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.mode,
      );

  @override
  ChannelPropertyModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.on,
      );

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
      'Channel is missing required value for property: ${statusProp.category.value}',
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
    final ChannelPropertyModel? prop = modeProp;

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
    final ChannelPropertyModel? prop = modeProp;

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
