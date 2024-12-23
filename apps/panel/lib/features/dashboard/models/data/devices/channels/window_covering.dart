import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class WindowCoveringChannelDataModel extends ChannelDataModel
    with
        ChannelObstructionMixin,
        ChannelPercentageMixin,
        ChannelTiltMixin,
        ChannelFaultMixin {
  WindowCoveringChannelDataModel({
    required super.id,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: ChannelCategoryType.windowCovering,
        );

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
  ChannelPropertyDataModel? get tiltProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.tilt,
      );

  @override
  ChannelPropertyDataModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.fault,
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

  factory WindowCoveringChannelDataModel.fromJson(
    Map<String, dynamic> json,
    List<ChannelPropertyDataModel> properties,
    List<ChannelControlDataModel> controls,
  ) {
    return WindowCoveringChannelDataModel(
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
