// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_res_channel_property.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleResChannelPropertyImpl
    _$$DevicesModuleResChannelPropertyImplFromJson(Map<String, dynamic> json) =>
        _$DevicesModuleResChannelPropertyImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DevicesModuleResChannelPropertyMethod.fromJson(
              json['method'] as String),
          data: DevicesModuleChannelProperty.fromJson(
              json['data'] as Map<String, dynamic>),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DevicesModuleResChannelPropertyImplToJson(
        _$DevicesModuleResChannelPropertyImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method':
          _$DevicesModuleResChannelPropertyMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesModuleResChannelPropertyMethodEnumMap = {
  DevicesModuleResChannelPropertyMethod.valueGet: 'GET',
  DevicesModuleResChannelPropertyMethod.post: 'POST',
  DevicesModuleResChannelPropertyMethod.patch: 'PATCH',
  DevicesModuleResChannelPropertyMethod.delete: 'DELETE',
  DevicesModuleResChannelPropertyMethod.$unknown: r'$unknown',
};
