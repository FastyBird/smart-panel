import 'package:fastybird_smart_panel/modules/devices/models/model.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/data.dart';
import 'package:fastybird_smart_panel/modules/devices/types/data_types.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

abstract class ChannelPropertyModel extends Model {
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

  ChannelPropertyModel copyWith({
    ValueType? value,
    bool? clearValue,
  });
}
