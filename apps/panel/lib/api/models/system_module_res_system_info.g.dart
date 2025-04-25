// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_module_res_system_info.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemModuleResSystemInfoImpl _$$SystemModuleResSystemInfoImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemModuleResSystemInfoImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method:
          SystemModuleResSystemInfoMethod.fromJson(json['method'] as String),
      data:
          SystemModuleSystemInfo.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$SystemModuleResSystemInfoImplToJson(
        _$SystemModuleResSystemInfoImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$SystemModuleResSystemInfoMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$SystemModuleResSystemInfoMethodEnumMap = {
  SystemModuleResSystemInfoMethod.valueGet: 'GET',
  SystemModuleResSystemInfoMethod.post: 'POST',
  SystemModuleResSystemInfoMethod.patch: 'PATCH',
  SystemModuleResSystemInfoMethod.delete: 'DELETE',
  SystemModuleResSystemInfoMethod.$unknown: r'$unknown',
};
