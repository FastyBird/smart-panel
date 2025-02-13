// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_res_check_email.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AuthResCheckEmailImpl _$$AuthResCheckEmailImplFromJson(
        Map<String, dynamic> json) =>
    _$AuthResCheckEmailImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: AuthResCheckEmailMethod.fromJson(json['method'] as String),
      data: AuthValidation.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$AuthResCheckEmailImplToJson(
        _$AuthResCheckEmailImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$AuthResCheckEmailMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$AuthResCheckEmailMethodEnumMap = {
  AuthResCheckEmailMethod.valueGet: 'GET',
  AuthResCheckEmailMethod.post: 'POST',
  AuthResCheckEmailMethod.patch: 'PATCH',
  AuthResCheckEmailMethod.delete: 'DELETE',
  AuthResCheckEmailMethod.$unknown: r'$unknown',
};
