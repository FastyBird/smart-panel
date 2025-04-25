// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_module_res_check_username.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AuthModuleResCheckUsernameImpl _$$AuthModuleResCheckUsernameImplFromJson(
        Map<String, dynamic> json) =>
    _$AuthModuleResCheckUsernameImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method:
          AuthModuleResCheckUsernameMethod.fromJson(json['method'] as String),
      data: AuthModuleValidation.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$AuthModuleResCheckUsernameImplToJson(
        _$AuthModuleResCheckUsernameImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$AuthModuleResCheckUsernameMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$AuthModuleResCheckUsernameMethodEnumMap = {
  AuthModuleResCheckUsernameMethod.valueGet: 'GET',
  AuthModuleResCheckUsernameMethod.post: 'POST',
  AuthModuleResCheckUsernameMethod.patch: 'PATCH',
  AuthModuleResCheckUsernameMethod.delete: 'DELETE',
  AuthModuleResCheckUsernameMethod.$unknown: r'$unknown',
};
