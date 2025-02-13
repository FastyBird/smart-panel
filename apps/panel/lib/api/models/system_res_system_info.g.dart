// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_res_system_info.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemResSystemInfoImpl _$$SystemResSystemInfoImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemResSystemInfoImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: SystemResSystemInfoMethod.fromJson(json['method'] as String),
      data: SystemSystemInfo.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$SystemResSystemInfoImplToJson(
        _$SystemResSystemInfoImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$SystemResSystemInfoMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$SystemResSystemInfoMethodEnumMap = {
  SystemResSystemInfoMethod.valueGet: 'GET',
  SystemResSystemInfoMethod.post: 'POST',
  SystemResSystemInfoMethod.patch: 'PATCH',
  SystemResSystemInfoMethod.delete: 'DELETE',
  SystemResSystemInfoMethod.$unknown: r'$unknown',
};
