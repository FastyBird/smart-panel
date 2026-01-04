import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/infrared.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/pan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/source.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tilt.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/zoom.dart';

class CameraChannelView extends ChannelView
    with ChannelTiltMixin, ChannelFaultMixin {
  CameraChannelView({
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

  StatusChannelPropertyView get statusProp =>
      properties.whereType<StatusChannelPropertyView>().first;

  SourceChannelPropertyView get sourceProp =>
      properties.whereType<SourceChannelPropertyView>().first;

  ZoomChannelPropertyView? get zoomProp =>
      properties.whereType<ZoomChannelPropertyView>().firstOrNull;

  PanChannelPropertyView? get panProp =>
      properties.whereType<PanChannelPropertyView>().firstOrNull;

  @override
  TiltChannelPropertyView? get tiltProp =>
      properties.whereType<TiltChannelPropertyView>().firstOrNull;

  InfraredChannelPropertyView? get infraredProp =>
      properties.whereType<InfraredChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  CameraStatusValue get status {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && CameraStatusValue.contains(value.value)) {
      CameraStatusValue? status = CameraStatusValue.fromValue(value.value);

      if (status != null) {
        return status;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${statusProp.category.json}',
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
      'Channel is missing required value for property: ${sourceProp.category.json}',
    );
  }

  bool get hasZoom => zoomProp != null;

  double get zoom {
    final ZoomChannelPropertyView? prop = zoomProp;

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
    final PanChannelPropertyView? prop = panProp;

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
    final InfraredChannelPropertyView? prop = infraredProp;

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
