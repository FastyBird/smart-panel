// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_req_update_data_source_data_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl
    _$$DashboardReqUpdateDataSourceDataUnionDeviceChannelImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl(
          type: json['type'] as String,
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
        );

Map<String,
    dynamic> _$$DashboardReqUpdateDataSourceDataUnionDeviceChannelImplToJson(
        _$DashboardReqUpdateDataSourceDataUnionDeviceChannelImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'device': instance.device,
      'channel': instance.channel,
      'property': instance.property,
      'icon': instance.icon,
    };
