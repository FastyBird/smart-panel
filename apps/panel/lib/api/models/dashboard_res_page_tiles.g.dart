// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_tiles.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageTilesImpl _$$DashboardResPageTilesImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResPageTilesImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardResPageTilesMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => DashboardResPageTilesDataUnion.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResPageTilesImplToJson(
        _$DashboardResPageTilesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResPageTilesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPageTilesMethodEnumMap = {
  DashboardResPageTilesMethod.valueGet: 'GET',
  DashboardResPageTilesMethod.post: 'POST',
  DashboardResPageTilesMethod.patch: 'PATCH',
  DashboardResPageTilesMethod.delete: 'DELETE',
  DashboardResPageTilesMethod.$unknown: r'$unknown',
};
