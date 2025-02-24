import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class CameraChannelCapability extends Capability
    with ChannelTiltMixin, ChannelFaultMixin {
  CameraChannelCapability({
    required super.channel,
    required super.properties,
  });

  ChannelPropertyModel get statusProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.status,
      );

  ChannelPropertyModel get sourceProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.source,
      );

  ChannelPropertyModel? get zoomProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.zoom,
      );

  ChannelPropertyModel? get panProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.pan,
      );

  @override
  ChannelPropertyModel? get tiltProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.tilt,
      );

  ChannelPropertyModel? get infraredProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.infrared,
      );

  @override
  ChannelPropertyModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.fault,
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
    final ChannelPropertyModel? prop = zoomProp;

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
    final ChannelPropertyModel? prop = panProp;

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
    final ChannelPropertyModel? prop = infraredProp;

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
}
