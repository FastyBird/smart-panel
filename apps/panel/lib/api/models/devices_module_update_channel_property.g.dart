// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_update_channel_property.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleUpdateChannelPropertyImpl
    _$$DevicesModuleUpdateChannelPropertyImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesModuleUpdateChannelPropertyImpl(
          type: json['type'] as String,
          name: json['name'] as String?,
          unit: json['unit'] as String?,
          format: json['format'] as List<dynamic>?,
          invalid: json['invalid'],
          step: json['step'] as num?,
          value: json['value'],
        );

Map<String, dynamic> _$$DevicesModuleUpdateChannelPropertyImplToJson(
        _$DevicesModuleUpdateChannelPropertyImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'name': instance.name,
      'unit': instance.unit,
      'format': instance.format,
      'invalid': instance.invalid,
      'step': instance.step,
      'value': instance.value,
    };
