// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_tile_data_sources.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageTileDataSourcesImpl
    _$$DashboardResPageTileDataSourcesImplFromJson(Map<String, dynamic> json) =>
        _$DashboardResPageTileDataSourcesImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DashboardResPageTileDataSourcesMethod.fromJson(
              json['method'] as String),
          data: (json['data'] as List<dynamic>)
              .map((e) => DashboardResPageTileDataSourcesDataUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DashboardResPageTileDataSourcesImplToJson(
        _$DashboardResPageTileDataSourcesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method':
          _$DashboardResPageTileDataSourcesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPageTileDataSourcesMethodEnumMap = {
  DashboardResPageTileDataSourcesMethod.valueGet: 'GET',
  DashboardResPageTileDataSourcesMethod.post: 'POST',
  DashboardResPageTileDataSourcesMethod.patch: 'PATCH',
  DashboardResPageTileDataSourcesMethod.delete: 'DELETE',
  DashboardResPageTileDataSourcesMethod.$unknown: r'$unknown',
};
