// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_module_res_plugin.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigModuleResPluginImpl _$$ConfigModuleResPluginImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigModuleResPluginImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: ConfigModuleResPluginMethod.fromJson(json['method'] as String),
      data: ConfigModulePlugin.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$ConfigModuleResPluginImplToJson(
        _$ConfigModuleResPluginImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$ConfigModuleResPluginMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$ConfigModuleResPluginMethodEnumMap = {
  ConfigModuleResPluginMethod.valueGet: 'GET',
  ConfigModuleResPluginMethod.post: 'POST',
  ConfigModuleResPluginMethod.patch: 'PATCH',
  ConfigModuleResPluginMethod.delete: 'DELETE',
  ConfigModuleResPluginMethod.$unknown: r'$unknown',
};
