// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_module_temperature_info.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemModuleTemperatureInfoImpl _$$SystemModuleTemperatureInfoImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemModuleTemperatureInfoImpl(
      cpu: (json['cpu'] as num?)?.toInt(),
      gpu: (json['gpu'] as num?)?.toInt(),
    );

Map<String, dynamic> _$$SystemModuleTemperatureInfoImplToJson(
        _$SystemModuleTemperatureInfoImpl instance) =>
    <String, dynamic>{
      'cpu': instance.cpu,
      'gpu': instance.gpu,
    };
