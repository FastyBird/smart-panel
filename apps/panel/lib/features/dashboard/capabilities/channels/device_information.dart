import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class DeviceInformationChannelCapability extends Capability
    with ChannelFaultMixin {
  DeviceInformationChannelCapability({
    required super.channel,
    required super.properties,
  });

  ChannelPropertyModel get manufacturerProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.manufacturer,
      );

  ChannelPropertyModel get modelProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.model,
      );

  ChannelPropertyModel get serialNumberProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.serialNumber,
      );

  ChannelPropertyModel get firmwareRevisionProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.firmwareRevision,
      );

  ChannelPropertyModel? get hardwareRevisionProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.hardwareRevision,
      );

  ChannelPropertyModel? get linkQualityProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.linkQuality,
      );

  ChannelPropertyModel? get connectionTypeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.connectionType,
      );

  @override
  ChannelPropertyModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.fault,
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
    final ChannelPropertyModel? prop = hardwareRevisionProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType) {
      return value.value;
    }

    return null;
  }

  bool get hasLinkQuality => linkQualityProp != null;

  int? get linkQuality {
    final ChannelPropertyModel? prop = linkQualityProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    return null;
  }

  bool get hasConnectionType => connectionTypeProp != null;

  ConnectionTypeValue? get connectionType {
    final ChannelPropertyModel? prop = connectionTypeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && ConnectionTypeValue.contains(value.value)) {
      return ConnectionTypeValue.fromValue(value.value);
    }

    return null;
  }
}
