import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/data.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/data_types.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class ChannelPropertyDataModel {
  final String _id;
  final String _channel;

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

  ChannelPropertyDataModel({
    required String id,
    required String channel,
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
        _value = value,
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;

  String get channel => _channel;

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
