// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_module_throttle_status.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemModuleThrottleStatusImpl _$$SystemModuleThrottleStatusImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemModuleThrottleStatusImpl(
      undervoltage: json['undervoltage'] as bool? ?? false,
      frequencyCapping: json['frequency_capping'] as bool? ?? false,
      throttling: json['throttling'] as bool? ?? false,
      softTempLimit: json['soft_temp_limit'] as bool? ?? false,
    );

Map<String, dynamic> _$$SystemModuleThrottleStatusImplToJson(
        _$SystemModuleThrottleStatusImpl instance) =>
    <String, dynamic>{
      'undervoltage': instance.undervoltage,
      'frequency_capping': instance.frequencyCapping,
      'throttling': instance.throttling,
      'soft_temp_limit': instance.softTempLimit,
    };
