// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_res_login.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AuthResLoginImpl _$$AuthResLoginImplFromJson(Map<String, dynamic> json) =>
    _$AuthResLoginImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: AuthResLoginMethod.fromJson(json['method'] as String),
      data: AuthTokenPair.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$AuthResLoginImplToJson(_$AuthResLoginImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$AuthResLoginMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$AuthResLoginMethodEnumMap = {
  AuthResLoginMethod.valueGet: 'GET',
  AuthResLoginMethod.post: 'POST',
  AuthResLoginMethod.patch: 'PATCH',
  AuthResLoginMethod.delete: 'DELETE',
  AuthResLoginMethod.$unknown: r'$unknown',
};
