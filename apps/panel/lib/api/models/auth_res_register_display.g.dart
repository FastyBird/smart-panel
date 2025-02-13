// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_res_register_display.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AuthResRegisterDisplayImpl _$$AuthResRegisterDisplayImplFromJson(
        Map<String, dynamic> json) =>
    _$AuthResRegisterDisplayImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: AuthResRegisterDisplayMethod.fromJson(json['method'] as String),
      data: AuthDisplaySecret.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$AuthResRegisterDisplayImplToJson(
        _$AuthResRegisterDisplayImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$AuthResRegisterDisplayMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$AuthResRegisterDisplayMethodEnumMap = {
  AuthResRegisterDisplayMethod.valueGet: 'GET',
  AuthResRegisterDisplayMethod.post: 'POST',
  AuthResRegisterDisplayMethod.patch: 'PATCH',
  AuthResRegisterDisplayMethod.delete: 'DELETE',
  AuthResRegisterDisplayMethod.$unknown: r'$unknown',
};
