// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_create_page_data_source_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardReqCreatePageDataSourceDataUnionDeviceChannelImpl
    _$$DashboardReqCreatePageDataSourceDataUnionDeviceChannelImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreatePageDataSourceDataUnionDeviceChannelImpl(
          id: json['id'] as String,
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
          type: json['type'] as String? ?? 'device-channel',
        );

Map<String, dynamic>
    _$$DashboardReqCreatePageDataSourceDataUnionDeviceChannelImplToJson(
            _$DashboardReqCreatePageDataSourceDataUnionDeviceChannelImpl
                instance) =>
        <String, dynamic>{
          'id': instance.id,
          'device': instance.device,
          'channel': instance.channel,
          'property': instance.property,
          'icon': instance.icon,
          'type': instance.type,
        };
