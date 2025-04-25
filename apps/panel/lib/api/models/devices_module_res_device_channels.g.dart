// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_res_device_channels.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleResDeviceChannelsImpl
    _$$DevicesModuleResDeviceChannelsImplFromJson(Map<String, dynamic> json) =>
        _$DevicesModuleResDeviceChannelsImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DevicesModuleResDeviceChannelsMethod.fromJson(
              json['method'] as String),
          data: (json['data'] as List<dynamic>)
              .map((e) =>
                  DevicesModuleChannel.fromJson(e as Map<String, dynamic>))
              .toList(),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DevicesModuleResDeviceChannelsImplToJson(
        _$DevicesModuleResDeviceChannelsImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DevicesModuleResDeviceChannelsMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DevicesModuleResDeviceChannelsMethodEnumMap = {
  DevicesModuleResDeviceChannelsMethod.valueGet: 'GET',
  DevicesModuleResDeviceChannelsMethod.post: 'POST',
  DevicesModuleResDeviceChannelsMethod.patch: 'PATCH',
  DevicesModuleResDeviceChannelsMethod.delete: 'DELETE',
  DevicesModuleResDeviceChannelsMethod.$unknown: r'$unknown',
};
