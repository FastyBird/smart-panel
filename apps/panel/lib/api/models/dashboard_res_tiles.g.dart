// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_tiles.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResTilesImpl _$$DashboardResTilesImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResTilesImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardResTilesMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => DashboardTile.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResTilesImplToJson(
        _$DashboardResTilesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResTilesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResTilesMethodEnumMap = {
  DashboardResTilesMethod.valueGet: 'GET',
  DashboardResTilesMethod.post: 'POST',
  DashboardResTilesMethod.patch: 'PATCH',
  DashboardResTilesMethod.delete: 'DELETE',
  DashboardResTilesMethod.$unknown: r'$unknown',
};
