// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_module_res_section.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigModuleResSectionImpl _$$ConfigModuleResSectionImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigModuleResSectionImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: ConfigModuleResSectionMethod.fromJson(json['method'] as String),
      data: ConfigModuleResSectionDataUnion.fromJson(
          json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$ConfigModuleResSectionImplToJson(
        _$ConfigModuleResSectionImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$ConfigModuleResSectionMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$ConfigModuleResSectionMethodEnumMap = {
  ConfigModuleResSectionMethod.valueGet: 'GET',
  ConfigModuleResSectionMethod.post: 'POST',
  ConfigModuleResSectionMethod.patch: 'PATCH',
  ConfigModuleResSectionMethod.delete: 'DELETE',
  ConfigModuleResSectionMethod.$unknown: r'$unknown',
};
