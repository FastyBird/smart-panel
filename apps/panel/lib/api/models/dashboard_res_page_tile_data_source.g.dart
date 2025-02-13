// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_tile_data_source.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageTileDataSourceImpl
    _$$DashboardResPageTileDataSourceImplFromJson(Map<String, dynamic> json) =>
        _$DashboardResPageTileDataSourceImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DashboardResPageTileDataSourceMethod.fromJson(
              json['method'] as String),
          data: DashboardResPageTileDataSourceDataUnion.fromJson(
              json['data'] as Map<String, dynamic>),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DashboardResPageTileDataSourceImplToJson(
        _$DashboardResPageTileDataSourceImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResPageTileDataSourceMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPageTileDataSourceMethodEnumMap = {
  DashboardResPageTileDataSourceMethod.valueGet: 'GET',
  DashboardResPageTileDataSourceMethod.post: 'POST',
  DashboardResPageTileDataSourceMethod.patch: 'PATCH',
  DashboardResPageTileDataSourceMethod.delete: 'DELETE',
  DashboardResPageTileDataSourceMethod.$unknown: r'$unknown',
};
