// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_module_res_throttle_status.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemModuleResThrottleStatusImpl
    _$$SystemModuleResThrottleStatusImplFromJson(Map<String, dynamic> json) =>
        _$SystemModuleResThrottleStatusImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: SystemModuleResThrottleStatusMethod.fromJson(
              json['method'] as String),
          data: SystemModuleThrottleStatus.fromJson(
              json['data'] as Map<String, dynamic>),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$SystemModuleResThrottleStatusImplToJson(
        _$SystemModuleResThrottleStatusImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$SystemModuleResThrottleStatusMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$SystemModuleResThrottleStatusMethodEnumMap = {
  SystemModuleResThrottleStatusMethod.valueGet: 'GET',
  SystemModuleResThrottleStatusMethod.post: 'POST',
  SystemModuleResThrottleStatusMethod.patch: 'PATCH',
  SystemModuleResThrottleStatusMethod.delete: 'DELETE',
  SystemModuleResThrottleStatusMethod.$unknown: r'$unknown',
};
