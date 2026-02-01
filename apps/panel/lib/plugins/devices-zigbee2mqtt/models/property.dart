import 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_permission_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/plugins/devices-zigbee2mqtt/constants.dart';

class Zigbee2mqttChannelPropertyModel extends ChannelPropertyModel {
  Zigbee2mqttChannelPropertyModel({
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
          type: zigbee2mqttDeviceType,
        );

  factory Zigbee2mqttChannelPropertyModel.fromJson(Map<String, dynamic> json) {
    final rawValue = json['value'];
    final PropertyValueState? valueState = rawValue is Map<String, dynamic>
        ? PropertyValueState.fromJson(rawValue)
        : null;

    return Zigbee2mqttChannelPropertyModel(
      channel: json['channel'],
      id: json['id'],
      category: DevicesModulePropertyCategory.fromJson(json['category']),
      name: json['name'],
      permission: (json['permissions'] as List<dynamic>? ?? [])
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
  Zigbee2mqttChannelPropertyModel copyWith({
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

    return Zigbee2mqttChannelPropertyModel(
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
