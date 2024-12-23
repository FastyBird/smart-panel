import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class CameraChannelDataModel extends ChannelDataModel
    with ChannelTiltMixin, ChannelFaultMixin {
  CameraChannelDataModel({
    required super.id,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: ChannelCategoryType.camera,
        );

  ChannelPropertyDataModel get statusProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.status,
      );

  ChannelPropertyDataModel get sourceProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.source,
      );

  ChannelPropertyDataModel? get zoomProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.zoom,
      );

  ChannelPropertyDataModel? get panProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.pan,
      );

  @override
  ChannelPropertyDataModel? get tiltProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.tilt,
      );

  ChannelPropertyDataModel? get infraredProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.infrared,
      );

  @override
  ChannelPropertyDataModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.fault,
      );

  CameraStatusValue get status {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && CameraStatusValue.contains(value.value)) {
      CameraStatusValue? status = CameraStatusValue.fromValue(value.value);

      if (status != null) {
        return status;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${statusProp.category.value}',
    );
  }

  bool get isAvailable => status == CameraStatusValue.available;

  bool get isInUse => status == CameraStatusValue.inUse;

  bool get isUnavailable => status == CameraStatusValue.unavailable;

  bool get isOffline => status == CameraStatusValue.offline;

  bool get isInitializing => status == CameraStatusValue.initializing;

  bool get hasError => status == CameraStatusValue.error;

  String get source {
    final ValueType? value = sourceProp.value;

    if (value is StringValueType) {
      return value.value;
    }

    throw Exception(
      'Channel is missing required value for property: ${sourceProp.category.value}',
    );
  }

  bool get hasZoom => zoomProp != null;

  double get zoom {
    final ChannelPropertyDataModel? prop = zoomProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toDouble();
    }

    return 1.0;
  }

  double get minZoom {
    final FormatType? format = zoomProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toDouble();
    }

    return 1.0;
  }

  double get maxZoom {
    final FormatType? format = zoomProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toDouble();
    }

    return 10.0;
  }

  bool get hasPan => panProp != null;

  int get pan {
    final ChannelPropertyDataModel? prop = panProp;

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

  int get minPan {
    final FormatType? format = panProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return -180;
  }

  int get maxPan {
    final FormatType? format = panProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 180;
  }

  bool get hasInfrared => infraredProp != null;

  bool get infrared {
    final ChannelPropertyDataModel? prop = infraredProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    return false;
  }

  factory CameraChannelDataModel.fromJson(
    Map<String, dynamic> json,
    List<ChannelPropertyDataModel> properties,
    List<ChannelControlDataModel> controls,
  ) {
    return CameraChannelDataModel(
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
