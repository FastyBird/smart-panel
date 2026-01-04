import 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_permission_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class ChannelPropertyView {
  final String _id;
  final String _type;
  final String _channel;
  final DevicesModulePropertyCategory _category;
  final String? _name;
  final List<DevicesModulePermissionType> _permission;
  final DevicesModuleDataType _dataType;
  final String? _unit;
  final FormatType? _format;
  final InvalidValueType? _invalid;
  final double? _step;
  final ValueType? _defaultValue;
  final ValueType? _value;

  ChannelPropertyView({
    required String id,
    required String type,
    required String channel,
    DevicesModulePropertyCategory category = DevicesModulePropertyCategory.generic,
    String? name,
    List<DevicesModulePermissionType> permission = const [],
    DevicesModuleDataType dataType = DevicesModuleDataType.unknown,
    String? unit,
    FormatType? format,
    InvalidValueType? invalid,
    double? step,
    ValueType? defaultValue,
    ValueType? value,
  })  : _id = id,
        _type = type,
        _channel = channel,
        _category = category,
        _name = name,
        _permission = permission,
        _dataType = dataType,
        _unit = unit,
        _format = format,
        _invalid = invalid,
        _step = step,
        _defaultValue = defaultValue,
        _value = value;

  String get id => _id;

  String get type => _type;

  String get channel => _channel;

  DevicesModulePropertyCategory get category => _category;

  String get name => _name ?? (_category.json ?? _category.toString());

  List<DevicesModulePermissionType> get permission => _permission;

  DevicesModuleDataType get dataType => _dataType;

  String? get unit => _unit;

  FormatType? get format => _format;

  InvalidValueType? get invalid => _invalid;

  double? get step => _step;

  ValueType? get defaultValue => _defaultValue;

  ValueType? get value => _value;

  bool get isReadable {
    return _permission.any(
      (permission) =>
          permission == DevicesModulePermissionType.ro ||
          permission == DevicesModulePermissionType.rw,
    );
  }

  bool get isWritable {
    return _permission.any(
      (permission) =>
          permission == DevicesModulePermissionType.wo ||
          permission == DevicesModulePermissionType.rw,
    );
  }
}
