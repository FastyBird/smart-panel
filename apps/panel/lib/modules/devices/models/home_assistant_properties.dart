import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/data.dart';
import 'package:fastybird_smart_panel/modules/devices/types/data_types.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class HomeAssistantChannelPropertyModel extends ChannelPropertyModel {
  final String _haEntityId;

  final String _haAttribute;

  HomeAssistantChannelPropertyModel({
    required super.id,
    required super.channel,
    super.category = PropertyCategory.generic,
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
    required String haEntityId,
    required String haAttribute,
  })  : _haEntityId = haEntityId,
        _haAttribute = haAttribute,
        super(
          type: 'home-assistant',
        );

  String get haEntityId => _haEntityId;

  String get haAttribute => _haAttribute;

  factory HomeAssistantChannelPropertyModel.fromJson(
      Map<String, dynamic> json) {
    return HomeAssistantChannelPropertyModel(
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
      haEntityId: json['ha_entity_id'],
      haAttribute: json['ha_attribute'],
    );
  }

  @override
  HomeAssistantChannelPropertyModel copyWith({
    ValueType? value,
    bool? clearValue,
  }) {
    ValueType? setValue = value ?? value;

    if (clearValue != null) {
      setValue = null;
    }

    return HomeAssistantChannelPropertyModel(
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
      haEntityId: haEntityId,
      haAttribute: haAttribute,
    );
  }
}
