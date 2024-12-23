import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/data.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/data_types.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class DevicePropertyDataModel extends PropertyDataModel {
  final String _device;

  DevicePropertyDataModel({
    required String device,
    required super.id,
    super.category,
    super.name,
    super.permission,
    super.dataType,
    super.unit,
    super.format,
    super.invalid,
    super.step,
    super.defaultValue,
    super.value,
    super.createdAt,
    super.updatedAt,
  }) : _device = UuidUtils.validateUuid(device);

  String get device => _device;

  factory DevicePropertyDataModel.fromJson(Map<String, dynamic> json) {
    return DevicePropertyDataModel(
      device: json['device'],
      id: json['id'],
      category: PropertyCategoryType.fromValue(json['category']) ??
          PropertyCategoryType.generic,
      name: json['name'],
      permission: (json['permission'] as List<dynamic>? ?? [])
          .map((e) => DataPermissionType.fromValue(e.toString()))
          .whereType<DataPermissionType>()
          .toList(),
      dataType:
          DataTypeType.fromValue(json['data_type']) ?? DataTypeType.unknown,
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
      value: json['value'] != null ? ValueType.fromJson(json['value']) : null,
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }

  @override
  DevicePropertyDataModel copyWith({
    ValueType? value,
  }) {
    return DevicePropertyDataModel(
      device: _device,
      id: _id,
      category: _category,
      name: _name,
      permission: _permission,
      dataType: _dataType,
      unit: _unit,
      format: _format,
      invalid: _invalid,
      step: _step,
      defaultValue: _defaultValue,
      value: value ?? _value,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
    );
  }
}

class ChannelPropertyDataModel extends PropertyDataModel {
  final String _channel;

  ChannelPropertyDataModel({
    required String channel,
    required super.id,
    super.category,
    super.name,
    super.permission,
    super.dataType,
    super.unit,
    super.format,
    super.invalid,
    super.step,
    super.defaultValue,
    super.value,
    super.createdAt,
    super.updatedAt,
  }) : _channel = UuidUtils.validateUuid(channel);

  String get channel => _channel;

  factory ChannelPropertyDataModel.fromJson(Map<String, dynamic> json) {
    return ChannelPropertyDataModel(
      channel: json['channel'],
      id: json['id'],
      category: PropertyCategoryType.fromValue(json['category']) ??
          PropertyCategoryType.generic,
      name: json['name'],
      permission: (json['permission'] as List<dynamic>? ?? [])
          .map((e) => DataPermissionType.fromValue(e.toString()))
          .whereType<DataPermissionType>()
          .toList(),
      dataType:
          DataTypeType.fromValue(json['data_type']) ?? DataTypeType.unknown,
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
      value: json['value'] != null ? ValueType.fromJson(json['value']) : null,
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }

  @override
  ChannelPropertyDataModel copyWith({
    ValueType? value,
  }) {
    return ChannelPropertyDataModel(
      channel: _channel,
      id: _id,
      category: _category,
      name: _name,
      permission: _permission,
      dataType: _dataType,
      unit: _unit,
      format: _format,
      invalid: _invalid,
      step: _step,
      defaultValue: _defaultValue,
      value: value ?? _value,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
    );
  }
}

abstract class PropertyDataModel {
  final String _id;

  final PropertyCategoryType _category;

  final String? _name;

  final List<DataPermissionType> _permission;

  final DataTypeType _dataType;
  final String? _unit;
  final FormatType? _format;
  final InvalidValueType? _invalid;
  final double? _step;
  final ValueType? _defaultValue;
  final ValueType? _value;

  final DateTime? _createdAt;
  final DateTime? _updatedAt;

  PropertyDataModel({
    required String id,
    PropertyCategoryType category = PropertyCategoryType.generic,
    String? name,
    List<DataPermissionType> permission = const [],
    DataTypeType dataType = DataTypeType.unknown,
    String? unit,
    FormatType? format,
    InvalidValueType? invalid,
    double? step,
    ValueType? defaultValue,
    ValueType? value,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : _id = UuidUtils.validateUuid(id),
        _category = category,
        _name = name,
        _permission = permission,
        _dataType = dataType,
        _unit = unit,
        _format = format,
        _invalid = invalid,
        _step = step,
        _defaultValue = defaultValue,
        _value = value,
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;

  PropertyCategoryType get category => _category;

  String? get name => _name;

  List<DataPermissionType> get permission => _permission;

  DataTypeType get dataType => _dataType;

  String? get unit => _unit;

  FormatType? get format => _format;

  InvalidValueType? get invalid => _invalid;

  double? get step => _step;

  ValueType? get defaultValue => _defaultValue;

  ValueType? get value => _value;

  DateTime? get createdAt => _createdAt;

  DateTime? get updatedAt => _updatedAt;

  bool get isReadable {
    return _permission.any(
      (permission) =>
          permission == DataPermissionType.readOnly ||
          permission == DataPermissionType.readWrite,
    );
  }

  bool get isWritable {
    return _permission.any(
      (permission) =>
          permission == DataPermissionType.writeOnly ||
          permission == DataPermissionType.readWrite,
    );
  }

  bool get isActive {
    if (_value is BooleanValueType) {
      return _value.value;
    }

    return false;
  }

  String? get formattedValue {
    if (_value is BooleanValueType) {
      return _value.value ? 'true' : 'false';
    } else if (_value is StringValueType) {
      return _value.value;
    } else if (_value is NumberValueType) {
      if (_dataType == DataTypeType.char ||
          _dataType == DataTypeType.uchar ||
          _dataType == DataTypeType.short ||
          _dataType == DataTypeType.ushort ||
          _dataType == DataTypeType.int ||
          _dataType == DataTypeType.uint) {
        return _value.value.toInt().toString();
      }

      return _value.value.toString();
    }

    return null;
  }

  copyWith({
    ValueType? value,
  });
}
