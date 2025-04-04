// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_create_cards_page_data_source_union.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl
    _$$DashboardCreateCardsPageDataSourceUnionDeviceChannelImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          device: json['device'] as String,
          channel: json['channel'] as String,
          property: json['property'] as String,
          icon: json['icon'] as String?,
        );

Map<String,
    dynamic> _$$DashboardCreateCardsPageDataSourceUnionDeviceChannelImplToJson(
        _$DashboardCreateCardsPageDataSourceUnionDeviceChannelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'device': instance.device,
      'channel': instance.channel,
      'property': instance.property,
      'icon': instance.icon,
    };
