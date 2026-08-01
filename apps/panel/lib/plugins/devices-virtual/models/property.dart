import 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_permission_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_virtual_plugin_data_channel_property_value_origin.dart';
import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/constants.dart';

class VirtualChannelPropertyModel extends ChannelPropertyModel {
  final DevicesVirtualPluginDataChannelPropertyValueOrigin _valueOrigin;

  final String? _sourceProperty;

  VirtualChannelPropertyModel({
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
    DevicesVirtualPluginDataChannelPropertyValueOrigin valueOrigin =
        DevicesVirtualPluginDataChannelPropertyValueOrigin.source,
    String? sourceProperty,
  })  : _valueOrigin = valueOrigin,
        _sourceProperty = sourceProperty,
        super(
          type: virtualDeviceType,
        );

  /// Whether the value is read from and written to [sourceProperty], or
  /// stored locally under this property's own id.
  DevicesVirtualPluginDataChannelPropertyValueOrigin get valueOrigin =>
      _valueOrigin;

  /// Property whose value this one projects. Null once the source has been
  /// deleted, or when [valueOrigin] is `local`.
  String? get sourceProperty => _sourceProperty;

  factory VirtualChannelPropertyModel.fromJson(Map<String, dynamic> json) {
    final rawValue = json['value'];
    final PropertyValueState? valueState = rawValue is Map<String, dynamic>
        ? PropertyValueState.fromJson(rawValue)
        : null;

    return VirtualChannelPropertyModel(
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
      valueOrigin: DevicesVirtualPluginDataChannelPropertyValueOrigin.fromJson(
        json['value_origin'],
      ),
      sourceProperty: json['source_property'] != null
          ? UuidUtils.validateUuid(json['source_property'])
          : null,
    );
  }

  @override
  VirtualChannelPropertyModel copyWith({
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

    return VirtualChannelPropertyModel(
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
      valueOrigin: valueOrigin,
      sourceProperty: sourceProperty,
    );
  }
}
