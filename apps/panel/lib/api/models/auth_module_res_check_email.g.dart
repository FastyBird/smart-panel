// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_module_res_check_email.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AuthModuleResCheckEmailImpl _$$AuthModuleResCheckEmailImplFromJson(
        Map<String, dynamic> json) =>
    _$AuthModuleResCheckEmailImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: AuthModuleResCheckEmailMethod.fromJson(json['method'] as String),
      data: AuthModuleValidation.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$AuthModuleResCheckEmailImplToJson(
        _$AuthModuleResCheckEmailImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$AuthModuleResCheckEmailMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$AuthModuleResCheckEmailMethodEnumMap = {
  AuthModuleResCheckEmailMethod.valueGet: 'GET',
  AuthModuleResCheckEmailMethod.post: 'POST',
  AuthModuleResCheckEmailMethod.patch: 'PATCH',
  AuthModuleResCheckEmailMethod.delete: 'DELETE',
  AuthModuleResCheckEmailMethod.$unknown: r'$unknown',
};
