// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_temperature_info.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemTemperatureInfoImpl _$$SystemTemperatureInfoImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemTemperatureInfoImpl(
      cpu: (json['cpu'] as num?)?.toInt(),
      gpu: (json['gpu'] as num?)?.toInt(),
    );

Map<String, dynamic> _$$SystemTemperatureInfoImplToJson(
        _$SystemTemperatureInfoImpl instance) =>
    <String, dynamic>{
      'cpu': instance.cpu,
      'gpu': instance.gpu,
    };
