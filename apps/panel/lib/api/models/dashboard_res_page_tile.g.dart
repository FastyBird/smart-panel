// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageTileImpl _$$DashboardResPageTileImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResPageTileImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardResPageTileMethod.fromJson(json['method'] as String),
      data: DashboardResPageTileDataUnion.fromJson(
          json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResPageTileImplToJson(
        _$DashboardResPageTileImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResPageTileMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPageTileMethodEnumMap = {
  DashboardResPageTileMethod.valueGet: 'GET',
  DashboardResPageTileMethod.post: 'POST',
  DashboardResPageTileMethod.patch: 'PATCH',
  DashboardResPageTileMethod.delete: 'DELETE',
  DashboardResPageTileMethod.$unknown: r'$unknown',
};
