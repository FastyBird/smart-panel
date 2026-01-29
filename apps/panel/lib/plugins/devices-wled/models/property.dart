import 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_permission_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/plugins/devices-wled/constants.dart';

class WledChannelPropertyModel extends ChannelPropertyModel {
  WledChannelPropertyModel({
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
    super.valueState,
    super.createdAt,
    super.updatedAt,
  }) : super(
          type: wledDeviceType,
        );

  factory WledChannelPropertyModel.fromJson(Map<String, dynamic> json) {
    final rawValue = json['value'];
    final PropertyValueState? valueState = rawValue is Map<String, dynamic>
        ? PropertyValueState.fromJson(rawValue)
        : null;

    return WledChannelPropertyModel(
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
  WledChannelPropertyModel copyWith({
    PropertyValueState? valueState,
    bool? clearValue,
  }) {
    PropertyValueState? setValueState;

    if (clearValue == true) {
      setValueState = null;
    } else if (valueState != null) {
      setValueState = valueState;
    } else {
      setValueState = this.valueState;
    }

    return WledChannelPropertyModel(
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
      valueState: setValueState,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}
