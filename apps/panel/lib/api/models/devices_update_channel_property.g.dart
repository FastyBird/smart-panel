// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_update_channel_property.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesUpdateChannelPropertyImpl _$$DevicesUpdateChannelPropertyImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesUpdateChannelPropertyImpl(
      name: json['name'] as String?,
      unit: json['unit'] as String?,
      format: json['format'] as List<dynamic>?,
      invalid: json['invalid'],
      step: json['step'] as num?,
      value: json['value'],
    );

Map<String, dynamic> _$$DevicesUpdateChannelPropertyImplToJson(
        _$DevicesUpdateChannelPropertyImpl instance) =>
    <String, dynamic>{
      'name': instance.name,
      'unit': instance.unit,
      'format': instance.format,
      'invalid': instance.invalid,
      'step': instance.step,
      'value': instance.value,
    };
