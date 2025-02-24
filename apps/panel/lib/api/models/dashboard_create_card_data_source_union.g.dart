// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_card_data_source_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateCardDataSourceUnionDeviceChannelImpl
    _$$DashboardCreateCardDataSourceUnionDeviceChannelImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCreateCardDataSourceUnionDeviceChannelImpl(
          id: json['id'] as String,
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
          type: json['type'] as String? ?? 'device-channel',
        );

Map<String, dynamic>
    _$$DashboardCreateCardDataSourceUnionDeviceChannelImplToJson(
            _$DashboardCreateCardDataSourceUnionDeviceChannelImpl instance) =>
        <String, dynamic>{
          'id': instance.id,
          'device': instance.device,
          'channel': instance.channel,
          'property': instance.property,
          'icon': instance.icon,
          'type': instance.type,
        };
