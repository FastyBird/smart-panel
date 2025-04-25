// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_module_res_app.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigModuleResAppImpl _$$ConfigModuleResAppImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigModuleResAppImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: ConfigModuleResAppMethod.fromJson(json['method'] as String),
      data: ConfigModuleApp.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$ConfigModuleResAppImplToJson(
        _$ConfigModuleResAppImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$ConfigModuleResAppMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$ConfigModuleResAppMethodEnumMap = {
  ConfigModuleResAppMethod.valueGet: 'GET',
  ConfigModuleResAppMethod.post: 'POST',
  ConfigModuleResAppMethod.patch: 'PATCH',
  ConfigModuleResAppMethod.delete: 'DELETE',
  ConfigModuleResAppMethod.$unknown: r'$unknown',
};
