import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class DeviceInformationChannelCapability
    extends ChannelCapability<DeviceInformationChannelDataModel>
    with ChannelFaultMixin {
  DeviceInformationChannelCapability({
    required super.channel,
    required super.properties,
  });

  ChannelPropertyDataModel get manufacturerProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.manufacturer,
      );

  ChannelPropertyDataModel get modelProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.model,
      );

  ChannelPropertyDataModel get serialNumberProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.serialNumber,
      );

  ChannelPropertyDataModel get firmwareRevisionProp => properties.firstWhere(
        (property) =>
            property.category == PropertyCategoryType.firmwareRevision,
      );

  ChannelPropertyDataModel? get hardwareRevisionProp =>
      properties.firstWhereOrNull(
        (property) =>
            property.category == PropertyCategoryType.hardwareRevision,
      );

  ChannelPropertyDataModel? get linkQualityProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.linkQuality,
      );

  ChannelPropertyDataModel? get connectionTypeProp =>
      properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.connectionType,
      );

  @override
  ChannelPropertyDataModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.fault,
      );

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
    final ChannelPropertyDataModel? prop = hardwareRevisionProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType) {
      return value.value;
    }

    return null;
  }

  bool get hasLinkQuality => linkQualityProp != null;

  int? get linkQuality {
    final ChannelPropertyDataModel? prop = linkQualityProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    return null;
  }

  bool get hasConnectionType => connectionTypeProp != null;

  ConnectionTypeValue? get connectionType {
    final ChannelPropertyDataModel? prop = connectionTypeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && ConnectionTypeValue.contains(value.value)) {
      return ConnectionTypeValue.fromValue(value.value);
    }

    return null;
  }
}
