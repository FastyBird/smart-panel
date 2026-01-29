import 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_permission_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/plugins/devices-third-party/constants.dart';

class ThirdPartyChannelPropertyModel extends ChannelPropertyModel {
  ThirdPartyChannelPropertyModel({
    required super.id,
    required super.channel,
    super.category = DevicesModulePropertyCategory.generic,
    super.name,
    super.permission = const [],
    super.dataType = DevicesModuleDataType.unknown,
    super.unit,
    super.format,
    super.invalid,
    super.step,
    super.defaultValue,
    super.value,
    super.valueState,
    super.createdAt,
    super.updatedAt,
  }) : super(
          type: thirdPartyDeviceType,
        );

  factory ThirdPartyChannelPropertyModel.fromJson(Map<String, dynamic> json) {
    PropertyValueState? valueState;
    ValueType? legacyValue;
    final rawValue = json['value'];
    if (rawValue is Map<String, dynamic>) {
      valueState = PropertyValueState.fromJson(rawValue);
    } else if (rawValue != null) {
      legacyValue = ValueType.fromJson(rawValue);
    }

    return ThirdPartyChannelPropertyModel(
      channel: json['channel'],
      id: json['id'],
      category: DevicesModulePropertyCategory.fromJson(json['category']),
      name: json['name'],
      permission: (json['permission'] as List<dynamic>? ?? [])
          .map((e) => DevicesModulePermissionType.fromJson(e.toString()))
          .where((e) => e != DevicesModulePermissionType.$unknown)
          .toList(),
      dataType: DevicesModuleDataType.fromJson(json['data_type']),
      unit: json['unit'],
      format:
          json['format'] != null ? FormatType.fromJson(json['format']) : null,
      invalid: json['invalid'] != null
          ? InvalidValueType.fromJson(json['invalid'])
          : null,
      step: json['step'] != null ? (json['step'] as num).toDouble() : null,
      defaultValue: json['default_value'] != null
          ? ValueType.fromJson(json['default_value'])
          : null,
      value: legacyValue,
      valueState: valueState,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }

  @override
  ThirdPartyChannelPropertyModel copyWith({
    ValueType? value,
    bool? clearValue,
  }) {
    ValueType? setValue = value ?? value;

    if (clearValue != null) {
      setValue = null;
    }

    return ThirdPartyChannelPropertyModel(
      channel: channel,
      id: id,
      category: category,
      name: name,
      permission: permission,
      dataType: dataType,
      unit: unit,
      format: format,
      invalid: invalid,
      step: step,
      defaultValue: defaultValue,
      value: setValue,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}
