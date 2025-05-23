import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/connection_type.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/firmware_revision.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/hardware_revision.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/link_quality.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/manufacturer.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/model.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/serial_number.dart';

class DeviceInformationChannelView extends ChannelView with ChannelFaultMixin {
  DeviceInformationChannelView({
    required super.channelModel,
    required super.properties,
  });

  ManufacturerChannelPropertyView get manufacturerProp =>
      properties.whereType<ManufacturerChannelPropertyView>().first;

  ModelChannelPropertyView get modelProp =>
      properties.whereType<ModelChannelPropertyView>().first;

  SerialNumberChannelPropertyView get serialNumberProp =>
      properties.whereType<SerialNumberChannelPropertyView>().first;

  FirmwareRevisionChannelPropertyView get firmwareRevisionProp =>
      properties.whereType<FirmwareRevisionChannelPropertyView>().first;

  HardwareRevisionChannelPropertyView? get hardwareRevisionProp =>
      properties.whereType<HardwareRevisionChannelPropertyView>().firstOrNull;

  LinkQualityChannelPropertyView? get linkQualityProp =>
      properties.whereType<LinkQualityChannelPropertyView>().firstOrNull;

  ConnectionTypeChannelPropertyView? get connectionTypeProp =>
      properties.whereType<ConnectionTypeChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  String get manufacturer {
    final ValueType? value = manufacturerProp.value;

    if (value is StringValueType) {
      return value.value;
    }

    throw Exception(
      'Channel is missing required value for property: ${manufacturerProp.category.value}',
    );
  }

  String get model {
    final ValueType? value = modelProp.value;

    if (value is StringValueType) {
      return value.value;
    }

    throw Exception(
      'Channel is missing required value for property: ${modelProp.category.value}',
    );
  }

  String get serialNumber {
    final ValueType? value = serialNumberProp.value;

    if (value is StringValueType) {
      return value.value;
    }

    throw Exception(
      'Channel is missing required value for property: ${serialNumberProp.category.value}',
    );
  }

  String get firmwareRevision {
    final ValueType? value = firmwareRevisionProp.value;

    if (value is StringValueType) {
      return value.value;
    }

    throw Exception(
      'Channel is missing required value for property: ${firmwareRevisionProp.category.value}',
    );
  }

  bool get hasHardwareRevision => hardwareRevisionProp != null;

  String? get hardwareRevision {
    final HardwareRevisionChannelPropertyView? prop = hardwareRevisionProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType) {
      return value.value;
    }

    return null;
  }

  bool get hasLinkQuality => linkQualityProp != null;

  int? get linkQuality {
    final LinkQualityChannelPropertyView? prop = linkQualityProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    return null;
  }

  bool get hasConnectionType => connectionTypeProp != null;

  ConnectionTypeValue? get connectionType {
    final ConnectionTypeChannelPropertyView? prop = connectionTypeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && ConnectionTypeValue.contains(value.value)) {
      return ConnectionTypeValue.fromValue(value.value);
    }

    return null;
  }
}
