// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_res_channel_properties.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleResChannelPropertiesImpl
    _$$DevicesModuleResChannelPropertiesImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesModuleResChannelPropertiesImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DevicesModuleResChannelPropertiesMethod.fromJson(
              json['method'] as String),
          data: (json['data'] as List<dynamic>)
              .map((e) => DevicesModuleChannelProperty.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DevicesModuleResChannelPropertiesImplToJson(
        _$DevicesModuleResChannelPropertiesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method':
          _$DevicesModuleResChannelPropertiesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesModuleResChannelPropertiesMethodEnumMap = {
  DevicesModuleResChannelPropertiesMethod.valueGet: 'GET',
  DevicesModuleResChannelPropertiesMethod.post: 'POST',
  DevicesModuleResChannelPropertiesMethod.patch: 'PATCH',
  DevicesModuleResChannelPropertiesMethod.delete: 'DELETE',
  DevicesModuleResChannelPropertiesMethod.$unknown: r'$unknown',
};
