// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_card_tile_data_sources.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageCardTileDataSourcesImpl
    _$$DashboardResPageCardTileDataSourcesImplFromJson(
            Map<String, dynamic> json) =>
        _$DashboardResPageCardTileDataSourcesImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DashboardResPageCardTileDataSourcesMethod.fromJson(
              json['method'] as String),
          data: (json['data'] as List<dynamic>)
              .map((e) => DashboardResPageCardTileDataSourcesDataUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DashboardResPageCardTileDataSourcesImplToJson(
        _$DashboardResPageCardTileDataSourcesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method':
          _$DashboardResPageCardTileDataSourcesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPageCardTileDataSourcesMethodEnumMap = {
  DashboardResPageCardTileDataSourcesMethod.valueGet: 'GET',
  DashboardResPageCardTileDataSourcesMethod.post: 'POST',
  DashboardResPageCardTileDataSourcesMethod.patch: 'PATCH',
  DashboardResPageCardTileDataSourcesMethod.delete: 'DELETE',
  DashboardResPageCardTileDataSourcesMethod.$unknown: r'$unknown',
};
