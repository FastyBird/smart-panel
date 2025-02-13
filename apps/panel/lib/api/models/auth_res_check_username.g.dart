// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_res_check_username.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AuthResCheckUsernameImpl _$$AuthResCheckUsernameImplFromJson(
        Map<String, dynamic> json) =>
    _$AuthResCheckUsernameImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: AuthResCheckUsernameMethod.fromJson(json['method'] as String),
      data: AuthValidation.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$AuthResCheckUsernameImplToJson(
        _$AuthResCheckUsernameImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$AuthResCheckUsernameMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$AuthResCheckUsernameMethodEnumMap = {
  AuthResCheckUsernameMethod.valueGet: 'GET',
  AuthResCheckUsernameMethod.post: 'POST',
  AuthResCheckUsernameMethod.patch: 'PATCH',
  AuthResCheckUsernameMethod.delete: 'DELETE',
  AuthResCheckUsernameMethod.$unknown: r'$unknown',
};
