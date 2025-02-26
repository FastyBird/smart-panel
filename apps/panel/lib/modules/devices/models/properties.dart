import 'package:fastybird_smart_panel/modules/devices/models/model.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/data.dart';
import 'package:fastybird_smart_panel/modules/devices/types/data_types.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class ChannelPropertyModel extends Model {
  final String _channel;

  final PropertyCategory _category;

  final String? _name;

  final List<Permission> _permission;

  final DataType _dataType;
  final String? _unit;
  final FormatType? _format;
  final InvalidValueType? _invalid;
  final double? _step;
  final ValueType? _defaultValue;
  final ValueType? _value;

  ChannelPropertyModel({
    required super.id,
    required String channel,
    PropertyCategory category = PropertyCategory.generic,
    String? name,
    List<Permission> permission = const [],
    DataType dataType = DataType.unknown,
    String? unit,
    FormatType? format,
    InvalidValueType? invalid,
    double? step,
    ValueType? defaultValue,
    ValueType? value,
    super.createdAt,
    super.updatedAt,
  })  : _channel = channel,
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

  String get channel => _channel;

  PropertyCategory get category => _category;

  String? get name => _name;

  List<Permission> get permission => _permission;

  DataType get dataType => _dataType;

  String? get unit => _unit;

  FormatType? get format => _format;

  InvalidValueType? get invalid => _invalid;

  double? get step => _step;

  ValueType? get defaultValue => _defaultValue;

  ValueType? get value => _value;

  bool get isReadable {
    return _permission.any(
      (permission) =>
          permission == Permission.readOnly ||
          permission == Permission.readWrite,
    );
  }

  bool get isWritable {
    return _permission.any(
      (permission) =>
          permission == Permission.writeOnly ||
          permission == Permission.readWrite,
    );
  }

  factory ChannelPropertyModel.fromJson(Map<String, dynamic> json) {
    return ChannelPropertyModel(
      channel: json['channel'],
      id: json['id'],
      category: PropertyCategory.fromValue(json['category']) ??
          PropertyCategory.generic,
      name: json['name'],
      permission: (json['permission'] as List<dynamic>? ?? [])
          .map((e) => Permission.fromValue(e.toString()))
          .whereType<Permission>()
          .toList(),
      dataType: DataType.fromValue(json['data_type']) ?? DataType.unknown,
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
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }

  ChannelPropertyModel copyWith({
    ValueType? value,
    bool? clearValue,
  }) {
    ValueType? setValue = value ?? _value;

    if (clearValue != null) {
      setValue = null;
    }

    return ChannelPropertyModel(
      channel: _channel,
      id: id,
      category: _category,
      name: _name,
      permission: _permission,
      dataType: _dataType,
      unit: _unit,
      format: _format,
      invalid: _invalid,
      step: _step,
      defaultValue: _defaultValue,
      value: setValue,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}
