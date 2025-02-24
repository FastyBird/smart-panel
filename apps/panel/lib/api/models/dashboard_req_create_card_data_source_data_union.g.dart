// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_create_card_data_source_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardReqCreateCardDataSourceDataUnionDeviceChannelImpl
    _$$DashboardReqCreateCardDataSourceDataUnionDeviceChannelImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqCreateCardDataSourceDataUnionDeviceChannelImpl(
          id: json['id'] as String,
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
          type: json['type'] as String? ?? 'device-channel',
        );

Map<String, dynamic>
    _$$DashboardReqCreateCardDataSourceDataUnionDeviceChannelImplToJson(
            _$DashboardReqCreateCardDataSourceDataUnionDeviceChannelImpl
                instance) =>
        <String, dynamic>{
          'id': instance.id,
          'device': instance.device,
          'channel': instance.channel,
          'property': instance.property,
          'icon': instance.icon,
          'type': instance.type,
        };
