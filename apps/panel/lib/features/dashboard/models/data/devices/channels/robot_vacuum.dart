import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class RobotVacuumChannelDataModel extends ChannelDataModel
    with ChannelOnMixin, ChannelFaultMixin {
  RobotVacuumChannelDataModel({
    required super.id,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: ChannelCategoryType.robotVacuum,
        );

  @override
  ChannelPropertyDataModel get onProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.on,
      );

  ChannelPropertyDataModel get statusProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.status,
      );

  ChannelPropertyDataModel? get modeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.mode,
      );

  @override
  ChannelPropertyDataModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.on,
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
    final ChannelPropertyDataModel? prop = modeProp;

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
    final ChannelPropertyDataModel? prop = modeProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => RobotVacuumModeValue.fromValue(item))
          .whereType<RobotVacuumModeValue>()
          .toList();
    }

    return [];
  }

  factory RobotVacuumChannelDataModel.fromJson(
    Map<String, dynamic> json,
    List<ChannelPropertyDataModel> properties,
    List<ChannelControlDataModel> controls,
  ) {
    return RobotVacuumChannelDataModel(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      device: json['device'],
      properties: properties,
      controls: controls,
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }
}
