// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_module_res_login.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AuthModuleResLoginImpl _$$AuthModuleResLoginImplFromJson(
        Map<String, dynamic> json) =>
    _$AuthModuleResLoginImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: AuthModuleResLoginMethod.fromJson(json['method'] as String),
      data: AuthModuleTokenPair.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$AuthModuleResLoginImplToJson(
        _$AuthModuleResLoginImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$AuthModuleResLoginMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$AuthModuleResLoginMethodEnumMap = {
  AuthModuleResLoginMethod.valueGet: 'GET',
  AuthModuleResLoginMethod.post: 'POST',
  AuthModuleResLoginMethod.patch: 'PATCH',
  AuthModuleResLoginMethod.delete: 'DELETE',
  AuthModuleResLoginMethod.$unknown: r'$unknown',
};
