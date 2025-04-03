// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_create_data_source_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardReqCreateDataSourceDataUnionDeviceChannelImpl
    _$$DashboardReqCreateDataSourceDataUnionDeviceChannelImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreateDataSourceDataUnionDeviceChannelImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
        );

Map<String,
    dynamic> _$$DashboardReqCreateDataSourceDataUnionDeviceChannelImplToJson(
        _$DashboardReqCreateDataSourceDataUnionDeviceChannelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'device': instance.device,
      'channel': instance.channel,
      'property': instance.property,
      'icon': instance.icon,
    };
