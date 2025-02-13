// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_card_tile_data_source.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageCardTileDataSourceImpl
    _$$DashboardResPageCardTileDataSourceImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageCardTileDataSourceImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DashboardResPageCardTileDataSourceMethod.fromJson(
              json['method'] as String),
          data: DashboardResPageCardTileDataSourceDataUnion.fromJson(
              json['data'] as Map<String, dynamic>),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DashboardResPageCardTileDataSourceImplToJson(
        _$DashboardResPageCardTileDataSourceImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method':
          _$DashboardResPageCardTileDataSourceMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPageCardTileDataSourceMethodEnumMap = {
  DashboardResPageCardTileDataSourceMethod.valueGet: 'GET',
  DashboardResPageCardTileDataSourceMethod.post: 'POST',
  DashboardResPageCardTileDataSourceMethod.patch: 'PATCH',
  DashboardResPageCardTileDataSourceMethod.delete: 'DELETE',
  DashboardResPageCardTileDataSourceMethod.$unknown: r'$unknown',
};
