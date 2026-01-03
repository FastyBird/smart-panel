import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/data.dart';
import 'package:fastybird_smart_panel/modules/devices/types/data_types.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

/// Generic channel property model for unknown or unregistered device types.
/// Falls back to this when no plugin has registered a mapper for the device type.
class GenericChannelPropertyModel extends ChannelPropertyModel {
  final Map<String, dynamic> _configuration;

  GenericChannelPropertyModel({
    required super.id,
    required super.type,
    required super.channel,
    super.category = ChannelPropertyCategory.generic,
    super.name,
    super.permission = const [],
    super.dataType = DataType.unknown,
    super.unit,
    super.format,
    super.invalid,
    super.step,
    super.defaultValue,
    super.value,
    super.createdAt,
    super.updatedAt,
    Map<String, dynamic>? configuration,
  }) : _configuration = configuration ?? {};

  /// Raw configuration for unknown property types
  Map<String, dynamic> get configuration => _configuration;

  factory GenericChannelPropertyModel.fromJson(Map<String, dynamic> json) {
    return GenericChannelPropertyModel(
      id: json['id'],
      type: json['type'] ?? 'unknown',
      channel: json['channel'],
      category: ChannelPropertyCategory.fromValue(json['category']) ??
          ChannelPropertyCategory.generic,
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
      configuration: json,
    );
  }

  @override
  GenericChannelPropertyModel copyWith({
    ValueType? value,
    bool? clearValue,
  }) {
    ValueType? setValue = value ?? this.value;

    if (clearValue == true) {
      setValue = null;
    }

    return GenericChannelPropertyModel(
      id: id,
      type: type,
      channel: channel,
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
      configuration: _configuration,
    );
  }
}
