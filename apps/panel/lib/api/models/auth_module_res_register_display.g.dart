// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_module_res_register_display.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AuthModuleResRegisterDisplayImpl _$$AuthModuleResRegisterDisplayImplFromJson(
        Map<String, dynamic> json) =>
    _$AuthModuleResRegisterDisplayImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method:
          AuthModuleResRegisterDisplayMethod.fromJson(json['method'] as String),
      data: AuthModuleDisplaySecret.fromJson(
          json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$AuthModuleResRegisterDisplayImplToJson(
        _$AuthModuleResRegisterDisplayImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$AuthModuleResRegisterDisplayMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$AuthModuleResRegisterDisplayMethodEnumMap = {
  AuthModuleResRegisterDisplayMethod.valueGet: 'GET',
  AuthModuleResRegisterDisplayMethod.post: 'POST',
  AuthModuleResRegisterDisplayMethod.patch: 'PATCH',
  AuthModuleResRegisterDisplayMethod.delete: 'DELETE',
  AuthModuleResRegisterDisplayMethod.$unknown: r'$unknown',
};
