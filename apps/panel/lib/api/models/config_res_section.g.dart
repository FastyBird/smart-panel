// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_res_section.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigResSectionImpl _$$ConfigResSectionImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigResSectionImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: ConfigResSectionMethod.fromJson(json['method'] as String),
      data: ConfigResSectionDataUnion.fromJson(
          json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$ConfigResSectionImplToJson(
        _$ConfigResSectionImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$ConfigResSectionMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$ConfigResSectionMethodEnumMap = {
  ConfigResSectionMethod.valueGet: 'GET',
  ConfigResSectionMethod.post: 'POST',
  ConfigResSectionMethod.patch: 'PATCH',
  ConfigResSectionMethod.delete: 'DELETE',
  ConfigResSectionMethod.$unknown: r'$unknown',
};
