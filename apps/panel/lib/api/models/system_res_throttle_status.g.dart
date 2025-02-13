// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_res_throttle_status.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemResThrottleStatusImpl _$$SystemResThrottleStatusImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemResThrottleStatusImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: SystemResThrottleStatusMethod.fromJson(json['method'] as String),
      data: SystemThrottleStatus.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$SystemResThrottleStatusImplToJson(
        _$SystemResThrottleStatusImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$SystemResThrottleStatusMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$SystemResThrottleStatusMethodEnumMap = {
  SystemResThrottleStatusMethod.valueGet: 'GET',
  SystemResThrottleStatusMethod.post: 'POST',
  SystemResThrottleStatusMethod.patch: 'PATCH',
  SystemResThrottleStatusMethod.delete: 'DELETE',
  SystemResThrottleStatusMethod.$unknown: r'$unknown',
};
