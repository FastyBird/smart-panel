// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_res_app.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigResAppImpl _$$ConfigResAppImplFromJson(Map<String, dynamic> json) =>
    _$ConfigResAppImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: ConfigResAppMethod.fromJson(json['method'] as String),
      data: ConfigApp.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$ConfigResAppImplToJson(_$ConfigResAppImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$ConfigResAppMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$ConfigResAppMethodEnumMap = {
  ConfigResAppMethod.valueGet: 'GET',
  ConfigResAppMethod.post: 'POST',
  ConfigResAppMethod.patch: 'PATCH',
  ConfigResAppMethod.delete: 'DELETE',
  ConfigResAppMethod.$unknown: r'$unknown',
};
